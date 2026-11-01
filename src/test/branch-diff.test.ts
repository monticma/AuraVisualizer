import { describe, it, expect } from 'vitest';
import {
    buildReviewPayload,
    computeComplexityDeltas,
    mergeDiffEntries,
    parseNameStatusZ,
    parseNumstatZ,
    sumTotals,
    type DeltaLike,
} from '../git/branch-diff-core';

// Shared fixtures: one added, one modified and one renamed file.
const nameStatus = parseNameStatusZ('A\0src/new.ts\0M\0src/app.ts\0R100\0old.ts\0src/moved.ts\0');
const numstat = parseNumstatZ('10\t0\tsrc/new.ts\0' + '4\t6\tsrc/app.ts\0' + '1\t1\t\0old.ts\0src/moved.ts\0');

describe('branch-diff-core — parseNameStatusZ', () => {
    it('reads added, modified and deleted entries', () => {
        const raw = 'A\0src/new.ts\0M\0src/app.ts\0D\0src/old.ts\0';
        expect(parseNameStatusZ(raw)).toEqual([
            { path: 'src/new.ts', status: 'added' },
            { path: 'src/app.ts', status: 'modified' },
            { path: 'src/old.ts', status: 'deleted' },
        ]);
    });

    it('reads a rename as one entry with both paths', () => {
        const raw = 'R100\0src/before.ts\0src/after.ts\0';
        expect(parseNameStatusZ(raw)).toEqual([
            { path: 'src/after.ts', oldPath: 'src/before.ts', status: 'renamed' },
        ]);
    });

    it('handles spaces, accents and mixed statuses', () => {
        const raw = 'M\0docs/réseau et graphe.md\0A\0src/é.ts\0';
        expect(parseNameStatusZ(raw)).toEqual([
            { path: 'docs/réseau et graphe.md', status: 'modified' },
            { path: 'src/é.ts', status: 'added' },
        ]);
    });

    it('ignores empty fields and survives truncated input', () => {
        expect(parseNameStatusZ('')).toEqual([]);
        expect(parseNameStatusZ('\0\0')).toEqual([]);
        expect(parseNameStatusZ('M\0')).toEqual([]);
    });
});

describe('branch-diff-core — parseNumstatZ', () => {
    it('reads additions and deletions per file', () => {
        const raw = '12\t3\tsrc/app.ts\0' + '0\t40\tsrc/old.ts\0';
        expect(parseNumstatZ(raw)).toEqual([
            { path: 'src/app.ts', additions: 12, deletions: 3, binary: undefined },
            { path: 'src/old.ts', additions: 0, deletions: 40, binary: undefined },
        ]);
    });

    it('flags binary files reported with dashes', () => {
        const raw = '-\t-\tassets/logo.png\0';
        expect(parseNumstatZ(raw)).toEqual([
            { path: 'assets/logo.png', additions: 0, deletions: 0, binary: true },
        ]);
    });

    it('reads the two-path form used by renames', () => {
        const raw = '5\t2\t\0src/before.ts\0src/after.ts\0';
        expect(parseNumstatZ(raw)).toEqual([
            { path: 'src/after.ts', oldPath: 'src/before.ts', additions: 5, deletions: 2, binary: undefined },
        ]);
    });

    it('ignores malformed entries', () => {
        expect(parseNumstatZ('nonsense\0')).toEqual([]);
        expect(parseNumstatZ('')).toEqual([]);
    });
});

describe('branch-diff-core — mergeDiffEntries', () => {
    it('joins both git outputs by path and sorts them', () => {
        expect(mergeDiffEntries(nameStatus, numstat)).toEqual([
            { path: 'src/app.ts', oldPath: undefined, status: 'modified', additions: 4, deletions: 6 },
            { path: 'src/moved.ts', oldPath: 'old.ts', status: 'renamed', additions: 1, deletions: 1 },
            { path: 'src/new.ts', oldPath: undefined, status: 'added', additions: 10, deletions: 0 },
        ]);
    });

    it('keeps files only numstat knows about as modified', () => {
        const files = mergeDiffEntries([], parseNumstatZ('3\t1\tsrc/typechange.ts\0'));
        expect(files).toEqual([
            { path: 'src/typechange.ts', oldPath: undefined, status: 'modified', additions: 3, deletions: 1, binary: undefined },
        ]);
    });

    it('marks the merged entry binary', () => {
        const files = mergeDiffEntries(parseNameStatusZ('M\0img.png\0'), parseNumstatZ('-\t-\timg.png\0'));
        expect(files[0].binary).toBe(true);
        expect(files[0].additions).toBe(0);
    });
});

describe('branch-diff-core — sumTotals', () => {
    it('counts files by status and sums the line churn', () => {
        const files = mergeDiffEntries(nameStatus, numstat);
        expect(sumTotals(files)).toEqual({
            files: 3,
            additions: 15,
            deletions: 7,
            added: 1,
            modified: 1,
            deleted: 0,
            renamed: 1,
        });
    });

    it('returns zeros for an empty diff', () => {
        expect(sumTotals([])).toEqual({ files: 0, additions: 0, deletions: 0, added: 0, modified: 0, deleted: 0, renamed: 0 });
    });
});

describe('branch-diff-core — computeComplexityDeltas', () => {
    const deltas: DeltaLike[] = [
        { hash: 'oldest', date: '2026-10-01', modified: { 'src/a.ts': { complexity: 10 }, 'src/b.ts': { complexity: 4 } } },
        { hash: 'middle', date: '2026-10-10', modified: { 'src/a.ts': { complexity: 14 } } },
        { hash: 'newest', date: '2026-10-20', modified: { 'src/a.ts': { complexity: 18 } } },
        { hash: 'outside', date: '2026-09-01', modified: { 'src/c.ts': { complexity: 1 } } },
    ];
    const range = new Set(['oldest', 'middle', 'newest']);
    const current = new Map([
        ['src/a.ts', 19],
        ['src/b.ts', 4],
        ['src/c.ts', 99],
    ]);

    it('measures against the oldest indexed commit of the range', () => {
        expect([...computeComplexityDeltas(deltas, range, current)]).toEqual([['src/a.ts', 9]]);
    });

    it('ignores commits outside the range and unchanged files', () => {
        const result = computeComplexityDeltas(deltas, range, current);
        expect(result.has('src/c.ts')).toBe(false);
        expect(result.has('src/b.ts')).toBe(false);
    });

    it('treats a file added on the branch as growing from zero', () => {
        const withAdded: DeltaLike[] = [
            { hash: 'newest', date: '2026-10-20', added: ['src/new.ts'] },
        ];
        const result = computeComplexityDeltas(withAdded, new Set(['newest']), new Map([['src/new.ts', 6]]));
        expect([...result]).toEqual([['src/new.ts', 6]]);
    });

    it('stays empty when the history index does not cover the range', () => {
        expect(computeComplexityDeltas(deltas, new Set(), current).size).toBe(0);
    });
});

describe('branch-diff-core — buildReviewPayload', () => {
    const diff = {
        repoRoot: '/repo',
        base: 'main',
        mergeBase: 'abc123',
        head: 'def456',
        totals: { files: 3, additions: 11, deletions: 7, added: 1, modified: 1, deleted: 0, renamed: 1 },
        files: [
            { path: 'src/app.ts', status: 'modified' as const, additions: 4, deletions: 6 },
            { path: 'src/new.ts', status: 'added' as const, additions: 5, deletions: 0 },
            { path: 'README.md', status: 'deleted' as const, additions: 0, deletions: 1 },
        ],
    };
    const nodeIds = new Set(['src/app.ts', 'src/new.ts', 'docs/guide.md']);
    const toNodeId = (repoPath: string) => repoPath;

    it('maps every file and seeds the blast with changed files present in the graph', () => {
        const payload = buildReviewPayload(diff, toNodeId, nodeIds, new Map());
        expect(payload.files.map(f => f.id)).toEqual(['src/app.ts', 'src/new.ts', 'README.md']);
        expect(payload.files.map(f => f.inGraph)).toEqual([true, true, false]);
        expect(payload.seeds).toEqual(['src/app.ts', 'src/new.ts']);
        expect(payload.base).toBe('main');
        expect(payload.mergeBase).toBe('abc123');
    });

    it('keeps the repository path for files outside the graph', () => {
        const payload = buildReviewPayload(diff, toNodeId, nodeIds, new Map());
        expect(payload.files[2]).toEqual({
            id: 'README.md',
            status: 'deleted',
            additions: 0,
            deletions: 1,
            inGraph: false,
        });
    });

    it('attaches the complexity delta only when the history index provides one', () => {
        const payload = buildReviewPayload(diff, toNodeId, nodeIds, new Map([['src/app.ts', 9]]));
        expect(payload.files[0].complexityDelta).toBe(9);
        expect(payload.files[1].complexityDelta).toBeUndefined();
    });

    it('drops the seed of a file that moved outside the mapped id', () => {
        const payload = buildReviewPayload(diff, () => undefined, nodeIds, new Map());
        expect(payload.seeds).toEqual([]);
        expect(payload.files.every(f => !f.inGraph)).toBe(true);
    });
});
