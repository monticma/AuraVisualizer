import { describe, it, expect } from 'vitest';
import {
    buildStatusPayload,
    formatWorktrees,
    mergeChangesWithRisk,
    type ChangedFile,
    type RiskView,
} from '../ai/tool-core';

describe('buildStatusPayload', () => {
    const base = { analyzedAt: '2024-05-01T10:00:00.000Z', head: 'aaaaaaaaaaaa', totalFiles: '120', totalLinks: '340' };

    it('flags a graph analysed at the current commit as fresh', () => {
        const payload = buildStatusPayload({ meta: base, currentHead: 'aaaaaaaaaaaa' });
        expect(payload.stale).toBe(false);
        expect(payload.analyzed_at).toBe(base.analyzedAt);
        expect(payload.files).toBe(120);
        expect(payload.links).toBe(340);
        expect(payload.head_at_analysis).toBe('aaaaaaaaaaaa');
        expect(payload.head_now).toBe('aaaaaaaaaaaa');
        expect(payload.reason).toContain('current commit');
    });

    it('flags a moved commit as stale and names both revisions', () => {
        const payload = buildStatusPayload({ meta: base, currentHead: 'bbbbbbbbbbbb' });
        expect(payload.stale).toBe(true);
        expect(payload.reason).toContain('aaaaaaa');
        expect(payload.reason).toContain('bbbbbbb');
    });

    it('cannot decide without an analysis', () => {
        const payload = buildStatusPayload({ meta: {}, currentHead: 'bbbbbbbbbbbb' });
        expect(payload.stale).toBeNull();
        expect(payload.reason).toContain('no analysis yet');
        expect(payload.files).toBe(0);
    });

    it('cannot decide without a fingerprint head', () => {
        const payload = buildStatusPayload({
            meta: { analyzedAt: base.analyzedAt },
            currentHead: 'bbbbbbbbbbbb',
        });
        expect(payload.stale).toBeNull();
        expect(payload.reason).toContain('fingerprint missing');
    });

    it('cannot decide without git', () => {
        const payload = buildStatusPayload({ meta: base, currentHead: null });
        expect(payload.stale).toBeNull();
        expect(payload.head_now).toBeNull();
        expect(payload.reason).toContain('git unavailable');
    });

    it('reports the age of the analysis in minutes', () => {
        const now = new Date('2024-05-01T10:30:00.000Z').getTime();
        const payload = buildStatusPayload({ meta: base, currentHead: 'aaaaaaaaaaaa', now });
        expect(payload.age_minutes).toBe(30);
    });

    it('leaves the age null when the timestamp is corrupt', () => {
        const payload = buildStatusPayload({
            meta: { ...base, analyzedAt: 'not-a-date' },
            currentHead: 'aaaaaaaaaaaa',
        });
        expect(payload.age_minutes).toBeNull();
    });
});

describe('formatWorktrees', () => {
    it('parses several worktrees including a detached one', () => {
        const raw = [
            'worktree /repo/main',
            'HEAD aaaaaaaaaaaa',
            'branch refs/heads/main',
            '',
            'worktree /repo/hotfix',
            'HEAD bbbbbbbbbbbb',
            'detached',
            '',
        ].join('\n');
        const trees = formatWorktrees(raw);
        expect(trees).toHaveLength(2);
        expect(trees[0]).toEqual({ path: '/repo/main', head: 'aaaaaaaaaaaa', branch: 'main', bare: false });
        expect(trees[1]).toEqual({ path: '/repo/hotfix', head: 'bbbbbbbbbbbb', branch: null, bare: false });
    });

    it('recognises a bare worktree and tolerates CRLF', () => {
        const raw = 'worktree /repo/bare\r\nHEAD cccccccccccc\r\nbare\r\n';
        const trees = formatWorktrees(raw);
        expect(trees).toHaveLength(1);
        expect(trees[0].bare).toBe(true);
        expect(trees[0].branch).toBeNull();
    });

    it('returns nothing for empty output', () => {
        expect(formatWorktrees('')).toEqual([]);
        expect(formatWorktrees(undefined)).toEqual([]);
    });
});

describe('mergeChangesWithRisk', () => {
    const risk = (score: number, bucket = 'high'): RiskView => ({
        score,
        bucket,
        reasons: ['reason 1', 'reason 2', 'reason 3', 'reason 4'],
    });

    it('orders by risk, then diff size, then path', () => {
        const changed: ChangedFile[] = [
            { file: 'a.ts', status: 'M', additions: 1, deletions: 0 },
            { file: 'b.ts', status: 'M', additions: 40, deletions: 0 },
            { file: 'c.ts', status: 'M', additions: 2, deletions: 0 },
        ];
        const scores: Record<string, number> = { 'a.ts': 40, 'b.ts': 90, 'c.ts': 40 };
        const merged = mergeChangesWithRisk(changed, file => risk(scores[file]));
        expect(merged.changes.map(c => c.file)).toEqual(['b.ts', 'c.ts', 'a.ts']);
    });

    it('pushes files unknown to the graph to the end', () => {
        const changed: ChangedFile[] = [
            { file: 'new.md', status: 'U', additions: 0, deletions: 0 },
            { file: 'old.ts', status: 'M', additions: 3, deletions: 1 },
        ];
        const merged = mergeChangesWithRisk(changed, file => (file === 'old.ts' ? risk(20) : null));
        expect(merged.changes[0].file).toBe('old.ts');
        expect(merged.changes[0].risk_score).toBe(20);
        expect(merged.changes[1].risk_score).toBeNull();
        expect(merged.changes[1].bucket).toBeNull();
        expect(merged.changes[1].reasons).toEqual([]);
    });

    it('keeps the top three risk reasons only', () => {
        const merged = mergeChangesWithRisk(
            [{ file: 'a.ts', status: 'M', additions: 1, deletions: 0 }],
            () => risk(75),
        );
        expect(merged.changes[0].reasons).toHaveLength(3);
    });

    it('sums the diff and counts the risky files', () => {
        const changed: ChangedFile[] = [
            { file: 'a.ts', status: 'M', additions: 10, deletions: 2 },
            { file: 'b.ts', status: 'M', additions: 5, deletions: 5 },
            { file: 'c.ts', status: 'M', additions: 1, deletions: 0 },
        ];
        const scores: Record<string, number> = { 'a.ts': 80, 'b.ts': 66, 'c.ts': 10 };
        const merged = mergeChangesWithRisk(changed, file => risk(scores[file]));
        expect(merged.total).toBe(3);
        expect(merged.additions).toBe(16);
        expect(merged.deletions).toBe(7);
        expect(merged.risky).toBe(2);
    });

    it('caps the returned rows but keeps the real total', () => {
        const changed: ChangedFile[] = Array.from({ length: 8 }, (_, i) => ({
            file: `f${i}.ts`,
            status: 'M',
            additions: i,
            deletions: 0,
        }));
        const merged = mergeChangesWithRisk(changed, () => risk(50), 3);
        expect(merged.changes).toHaveLength(3);
        expect(merged.total).toBe(8);
    });

    it('handles an empty change set', () => {
        const merged = mergeChangesWithRisk([], () => null);
        expect(merged).toEqual({ changes: [], total: 0, additions: 0, deletions: 0, risky: 0 });
    });
});
