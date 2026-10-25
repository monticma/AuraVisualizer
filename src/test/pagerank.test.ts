import { describe, it, expect } from 'vitest';
import { computePageRank } from '../analysis/pagerank';

function sum(values: Record<string, number>): number {
    return Object.values(values).reduce((acc, value) => acc + value, 0);
}

describe('PageRank (V2-16)', () => {
    it('ranks the target of a chain highest', () => {
        const rank = computePageRank(['a', 'b', 'c'], [
            { source: 'a', target: 'b' },
            { source: 'b', target: 'c' },
        ]);
        expect(rank.c).toBeGreaterThan(rank.b);
        expect(rank.b).toBeGreaterThan(rank.a);
        expect(sum(rank)).toBeCloseTo(1, 8);
    });

    it('converges deterministically on a symmetric graph', () => {
        const rank = computePageRank(['a', 'b', 'c', 'd'], [
            { source: 'a', target: 'b' },
            { source: 'b', target: 'a' },
            { source: 'c', target: 'd' },
            { source: 'd', target: 'c' },
        ]);
        expect(rank.a).toBeCloseTo(rank.b, 8);
        expect(rank.c).toBeCloseTo(rank.d, 8);
        expect(rank.a).toBeCloseTo(rank.c, 8);
        expect(sum(rank)).toBeCloseTo(1, 8);
    });

    it('gives isolated nodes the damping baseline and never divides by zero', () => {
        const rank = computePageRank(['hub', 'leaf', 'island'], [
            { source: 'leaf', target: 'hub' },
        ]);
        expect(rank.hub).toBeGreaterThan(rank.leaf);
        expect(rank.island).toBeGreaterThan(0);
        expect(rank.island).toBeCloseTo(rank.leaf, 8);
        expect(Number.isFinite(rank.island)).toBe(true);
        expect(sum(rank)).toBeCloseTo(1, 8);
        expect(computePageRank([], [])).toEqual({});
    });

    it('ignores duplicate edges, self-loops and unknown endpoints', () => {
        const rank = computePageRank(['a', 'b'], [
            { source: 'a', target: 'b' },
            { source: 'a', target: 'b' },
            { source: 'a', target: 'a' },
            { source: 'a', target: 'missing' },
        ]);
        expect(sum(rank)).toBeCloseTo(1, 8);
        expect(rank.b).toBeGreaterThan(rank.a);
    });

    it('supports damping 0 (uniform ranks)', () => {
        const rank = computePageRank(['a', 'b', 'c'], [
            { source: 'a', target: 'b' },
            { source: 'b', target: 'c' },
        ], { damping: 0, iterations: 2 });
        expect(rank.a).toBeCloseTo(1 / 3, 8);
        expect(rank.b).toBeCloseTo(1 / 3, 8);
        expect(rank.c).toBeCloseTo(1 / 3, 8);
    });
});
