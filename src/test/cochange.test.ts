import { describe, it, expect } from 'vitest';
import { computeCochange, type CochangeCommit } from '../analysis/cochange';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-24T12:00:00.000Z');

function commit(date: string, files: Array<{ status?: 'A' | 'M' | 'D' | 'R'; path: string; oldPath?: string }>): CochangeCommit {
    return { date, files };
}

describe('co-change', () => {
    it('counts pairs, Jaccard and support deterministically', () => {
        const commits: CochangeCommit[] = [
            commit('2026-10-20T12:00:00.000Z', [{ path: 'src/a.ts' }, { path: 'src/b.ts' }, { path: 'src/c.ts' }]),
            commit('2026-10-19T12:00:00.000Z', [{ path: 'src/a.ts' }, { path: 'src/b.ts' }]),
            commit('2026-10-18T12:00:00.000Z', [{ path: 'src/a.ts' }, { path: 'src/c.ts' }]),
            commit('2026-10-17T12:00:00.000Z', [{ path: 'src/b.ts' }]),
        ];
        const result = computeCochange(commits, {
            now: NOW,
            minCochanges: 1,
            minJaccard: 0,
            excludeLinked: false,
        });
        const ab = result.pairs.find(p => p.a === 'src/a.ts' && p.b === 'src/b.ts');
        const ac = result.pairs.find(p => p.a === 'src/a.ts' && p.b === 'src/c.ts');
        expect(ab).toMatchObject({ cochanges: 2, aCommits: 3, bCommits: 3, linked: false });
        expect(ab!.jaccard).toBeCloseTo(0.5); // 2 / (3 + 3 - 2)
        expect(ac!.jaccard).toBeCloseTo(2 / 3); // 2 / (3 + 2 - 2)
        expect(result.commitsConsidered).toBe(3);
        expect(result.totalCommitsInWindow).toBe(4);
        expect(result.pairs[0].jaccard).toBeGreaterThanOrEqual(result.pairs[1].jaccard);
        expect(computeCochange(commits, { now: NOW, minCochanges: 1, minJaccard: 0 })).toEqual(result);
    });

    it('follows renames and excludes direct structural links', () => {
        const commits: CochangeCommit[] = [
            commit('2026-10-20T12:00:00.000Z', [
                { status: 'R', path: 'src/new-name.ts', oldPath: 'src/old-name.ts' },
                { path: 'src/b.ts' },
            ]),
            commit('2026-10-19T12:00:00.000Z', [
                { path: 'src/old-name.ts' },
                { path: 'src/b.ts' },
            ]),
        ];
        const result = computeCochange(commits, {
            now: NOW,
            minCochanges: 2,
            minJaccard: 0.1,
            linkedPairs: [['src/new-name.ts', 'src/b.ts']],
        });
        expect(result.pairs).toEqual([]);

        const unlinked = computeCochange(commits, {
            now: NOW,
            minCochanges: 2,
            minJaccard: 0.1,
            excludeLinked: false,
        });
        expect(unlinked.pairs[0]).toMatchObject({
            a: 'src/b.ts',
            b: 'src/new-name.ts',
            cochanges: 2,
            linked: false,
        });
    });

    it('respects the time window and merges giant commits out of the signal', () => {
        const old = commit(new Date(NOW - 400 * DAY).toISOString(), [
            { path: 'src/a.ts' },
            { path: 'src/b.ts' },
        ]);
        const recent = commit('2026-10-20T12:00:00.000Z', [
            { path: 'src/a.ts' },
            { path: 'src/b.ts' },
        ]);
        const giant = commit('2026-10-21T12:00:00.000Z', Array.from({ length: 60 }, (_, i) => ({ path: `bulk/${i}.ts` })));
        const result = computeCochange([old, recent, giant], {
            now: NOW,
            windowDays: 365,
            minCochanges: 1,
            minJaccard: 0,
            maxFilesPerCommit: 50,
        });
        expect(result.pairs).toHaveLength(1);
        expect(result.commitsConsidered).toBe(1);
        expect(result.totalCommitsInWindow).toBe(2);
        expect(result.pairs[0]).toMatchObject({ a: 'src/a.ts', b: 'src/b.ts', cochanges: 1 });
    });

    it('restricts results to allowed graph paths', () => {
        const commits: CochangeCommit[] = [
            commit('2026-10-20T12:00:00.000Z', [{ path: 'src/a.ts' }, { path: 'src/b.ts' }]),
            commit('2026-10-19T12:00:00.000Z', [{ path: 'src/a.ts' }, { path: 'src/b.ts' }]),
        ];
        const result = computeCochange(commits, {
            now: NOW,
            minCochanges: 2,
            minJaccard: 0,
            allowedPaths: ['src/a.ts'],
        });
        expect(result.pairs).toEqual([]);
        expect(result.commitsConsidered).toBe(0);
    });

    it('handles deletion-only commits and missing dates safely', () => {
        const result = computeCochange([
            { files: [{ status: 'D', path: 'src/a.ts' }] },
            { date: 'not-a-date', files: [{ path: 'src/a.ts' }, { path: 'src/b.ts' }] },
        ], { now: NOW });
        expect(result.pairs).toEqual([]);
        expect(result.totalCommitsInWindow).toBe(0);
    });
});
