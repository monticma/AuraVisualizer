import { describe, it, expect } from 'vitest';
import {
    DEFAULT_TRANSITIVE_DEPTH,
    MAX_TRANSITIVE_DEPTH,
    summarizeTransitive,
    transitiveClosure,
    type TransitiveEdge,
} from '../analysis/transitive';

const edges = (...pairs: [string, string][]): TransitiveEdge[] =>
    pairs.map(([source, target]) => ({ source, target }));

describe('transitive — transitiveClosure (imports)', () => {
    it('walks a chain and reports one file per depth', () => {
        const result = transitiveClosure(edges(['a', 'b'], ['b', 'c'], ['c', 'd']), 'a');
        expect(result.nodes).toEqual([
            { id: 'b', depth: 1, parent: 'a' },
            { id: 'c', depth: 2, parent: 'b' },
            { id: 'd', depth: 3, parent: 'c' },
        ]);
        expect(result.maxDepth).toBe(3);
        expect(result.byDepth).toEqual([1, 1, 1]);
        expect(result.longestChain).toEqual(['a', 'b', 'c', 'd']);
        expect(result.truncated).toBe(false);
    });

    it('keeps the shortest depth in a diamond', () => {
        const result = transitiveClosure(
            edges(['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd']),
            'a',
        );
        expect(result.nodes).toEqual([
            { id: 'b', depth: 1, parent: 'a' },
            { id: 'c', depth: 1, parent: 'a' },
            { id: 'd', depth: 2, parent: 'b' },
        ]);
        expect(result.byDepth).toEqual([2, 1]);
        expect(result.maxDepth).toBe(2);
    });

    it('survives cycles without revisiting the root', () => {
        const result = transitiveClosure(edges(['a', 'b'], ['b', 'c'], ['c', 'a']), 'a');
        expect(result.nodes.map(n => n.id)).toEqual(['b', 'c']);
        expect(result.maxDepth).toBe(2);
    });

    it('ignores self-loops and duplicates', () => {
        const result = transitiveClosure(edges(['a', 'a'], ['a', 'b'], ['a', 'b']), 'a');
        expect(result.nodes).toEqual([{ id: 'b', depth: 1, parent: 'a' }]);
    });

    it('returns an empty closure for an isolated file', () => {
        const result = transitiveClosure(edges(['x', 'y']), 'a');
        expect(result.nodes).toEqual([]);
        expect(result.maxDepth).toBe(0);
        expect(result.longestChain).toEqual([]);
        expect(summarizeTransitive(result)).toBe('no indirect import');
    });

    it('stops at the depth limit', () => {
        const result = transitiveClosure(edges(['a', 'b'], ['b', 'c'], ['c', 'd']), 'a', { maxDepth: 2 });
        expect(result.nodes.map(n => n.id)).toEqual(['b', 'c']);
        expect(result.depthLimit).toBe(2);
        expect(result.truncated).toBe(false);
    });

    it('reports truncation when the node cap is hit', () => {
        const result = transitiveClosure(
            edges(['a', 'b'], ['a', 'c'], ['a', 'd'], ['a', 'e']),
            'a',
            { maxNodes: 2 },
        );
        expect(result.nodes).toHaveLength(2);
        expect(result.truncated).toBe(true);
        expect(summarizeTransitive(result)).toBe('2 files · depth 1 · truncated at 2');
    });

    it('follows reverse edges for dependents', () => {
        const result = transitiveClosure(edges(['b', 'a'], ['c', 'b']), 'a', { direction: 'in' });
        expect(result.nodes).toEqual([
            { id: 'b', depth: 1, parent: 'a' },
            { id: 'c', depth: 2, parent: 'b' },
        ]);
        expect(result.longestChain).toEqual(['a', 'b', 'c']);
    });

    it('is deterministic regardless of the input edge order', () => {
        const forward = transitiveClosure(
            edges(['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd'], ['d', 'e']),
            'a',
        );
        const shuffled = transitiveClosure(
            edges(['d', 'e'], ['c', 'd'], ['a', 'c'], ['b', 'd'], ['a', 'b']),
            'a',
        );
        expect(shuffled.nodes).toEqual(forward.nodes);
        expect(shuffled.longestChain).toEqual(forward.longestChain);
    });

    it('clamps the depth to the documented setting range', () => {
        expect(transitiveClosure([], 'a').depthLimit).toBe(DEFAULT_TRANSITIVE_DEPTH);
        expect(transitiveClosure([], 'a', { maxDepth: 99 }).depthLimit).toBe(MAX_TRANSITIVE_DEPTH);
        expect(transitiveClosure([], 'a', { maxDepth: 0 }).depthLimit).toBe(1);
    });

    it('stays fast and bounded on a dense 10k-edge graph', () => {
        const big: TransitiveEdge[] = [];
        for (let i = 0; i < 10_000; i++) {
            big.push({ source: `n${i % 500}`, target: `n${(i * 7 + 3) % 500}` });
        }
        const started = Date.now();
        const result = transitiveClosure(big, 'n0', { maxDepth: 10, maxNodes: 500 });
        const elapsed = Date.now() - started;
        expect(result.nodes.length).toBeLessThanOrEqual(500);
        expect(elapsed).toBeLessThan(100);
    });
});

describe('transitive — summarizeTransitive', () => {
    it('summarises one file without plural', () => {
        const result = transitiveClosure(edges(['a', 'b']), 'a');
        expect(summarizeTransitive(result)).toBe('1 file · depth 1');
    });

    it('summarises dependents with their own wording', () => {
        expect(summarizeTransitive(transitiveClosure([], 'a', { direction: 'in' }))).toBe('no indirect dependent');
    });
});
