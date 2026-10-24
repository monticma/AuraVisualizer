import { describe, it, expect } from 'vitest';
import { computeSymbolCycles } from '../analysis/symbol-cycles';
import type { FunctionCallSite } from '../analyzer/types';

function call(
    callerFile: string,
    callerName: string,
    calleeFile: string,
    calleeName: string,
    callLine: number,
): FunctionCallSite {
    return { callerFile, callerName, calleeFile, calleeName, callLine };
}

describe('symbol cycles (V2-03)', () => {
    it('detects mutual recursion with call lines', () => {
        const cycles = computeSymbolCycles([
            call('a.ts', 'alpha', 'b.ts', 'beta', 3),
            call('b.ts', 'beta', 'a.ts', 'alpha', 7),
        ]);

        expect(cycles).toHaveLength(1);
        expect(cycles[0].kind).toBe('mutual');
        expect(cycles[0].nodes.map(n => n.name)).toEqual(['alpha', 'beta']);
        expect(cycles[0].edges.map(e => e.callLine)).toEqual([3, 7]);
        expect(cycles[0].confidence).toBe(0.8);
        expect(cycles[0].ambiguous).toBe(false);
    });

    it('detects direct recursion as a self-loop', () => {
        const cycles = computeSymbolCycles([
            call('tree.ts', 'walk', 'tree.ts', 'walk', 12),
        ]);

        expect(cycles).toHaveLength(1);
        expect(cycles[0].kind).toBe('recursive');
        expect(cycles[0].nodes).toEqual([{ file: 'tree.ts', name: 'walk' }]);
        expect(cycles[0].edges[0]).toMatchObject({
            callerName: 'walk', calleeName: 'walk', callLine: 12, confidence: 1,
        });
    });

    it('marks cycles through ambiguous targets', () => {
        const cycles = computeSymbolCycles([
            call('a.ts', 'alpha', 'b1.ts', 'beta', 5),
            call('a.ts', 'alpha', 'b2.ts', 'beta', 5),
            call('b1.ts', 'beta', 'a.ts', 'alpha', 9),
            call('b2.ts', 'beta', 'a.ts', 'alpha', 11),
        ]);

        expect(cycles).toHaveLength(2);
        expect(cycles.every(c => c.ambiguous)).toBe(true);
        expect(cycles.every(c => c.confidence === 0.5)).toBe(true);
        expect(cycles.flatMap(c => c.edges).every(e => e.confidence <= 0.8)).toBe(true);
    });

    it('deduplicates rotations of the same cycle', () => {
        const cycles = computeSymbolCycles([
            call('a.ts', 'a', 'b.ts', 'b', 1),
            call('b.ts', 'b', 'c.ts', 'c', 2),
            call('c.ts', 'c', 'a.ts', 'a', 3),
        ]);

        expect(cycles).toHaveLength(1);
        expect(cycles[0].nodes.map(n => n.name)).toEqual(['a', 'b', 'c']);
        expect(cycles[0].edges.map(e => e.calleeName)).toEqual(['b', 'c', 'a']);
    });

    it('ignores top-level <module> callers', () => {
        const cycles = computeSymbolCycles([
            call('main.ts', '<module>', 'a.ts', 'alpha', 2),
            call('a.ts', 'alpha', 'main.ts', '<module>', 8),
        ]);

        expect(cycles).toEqual([]);
    });
});
