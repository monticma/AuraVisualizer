import { describe, it, expect } from 'vitest';
import { buildFileTrends, linearRegression, sparklinePoints, summarizeTrends, type TrendDeltas } from '../analysis/trend';

function delta(complexity: number, lines: number, symbols = 1): { complexity: number; linesOfCode: number; symbols: { totalSymbols: number } } {
    return { complexity, linesOfCode: lines, symbols: { totalSymbols: symbols } };
}

describe('complexity trends (V2-05)', () => {
    const commits = [
        { hash: 'c1', date: '2026-01-01T00:00:00Z' },
        { hash: 'c2', date: '2026-01-31T00:00:00Z' },
        { hash: 'c3', date: '2026-03-02T00:00:00Z' },
    ];

    it('detects a growing complexity trend', () => {
        const deltas: TrendDeltas = {
            c1: { added: ['a.ts'], modified: { 'a.ts': delta(2, 10, 1) } },
            c2: { modified: { 'a.ts': delta(4, 14, 2) } },
            c3: { modified: { 'a.ts': delta(6, 18, 3) } },
        };
        const trends = buildFileTrends(commits, deltas);
        const trend = trends['a.ts'];

        expect(trend).toBeDefined();
        expect(trend.samples).toBe(3);
        expect(trend.slopePer30Days).toBeCloseTo(2, 4);
        expect(trend.r2).toBeCloseTo(1, 4);
        expect(trend.direction).toBe('up');
        expect(trend.degrading).toBe(true);
        expect(trend.delta).toBe(4);
    });

    it('detects a declining complexity trend', () => {
        const deltas: TrendDeltas = {
            c1: { modified: { 'a.ts': delta(10, 30) } },
            c2: { modified: { 'a.ts': delta(7, 24) } },
            c3: { modified: { 'a.ts': delta(4, 18) } },
        };
        const trend = buildFileTrends(commits, deltas)['a.ts'];

        expect(trend.slopePer30Days).toBeLessThan(0);
        expect(trend.direction).toBe('down');
        expect(trend.improving).toBe(true);
        expect(trend.degrading).toBe(false);
    });

    it('keeps a flat series stable and NaN-free on short history', () => {
        const deltas: TrendDeltas = {
            c1: { modified: { 'a.ts': delta(5, 20) } },
            c2: { modified: { 'a.ts': delta(5, 20) } },
        };
        const flat = buildFileTrends(commits.slice(0, 2), deltas)['a.ts'];
        expect(flat.direction).toBe('flat');
        expect(flat.degrading).toBe(false);
        expect(Number.isFinite(flat.slopePer30Days)).toBe(true);
        expect(Number.isFinite(flat.r2)).toBe(true);

        const single = buildFileTrends([commits[0]], deltas)['a.ts'];
        expect(single.direction).toBe('unknown');
        expect(single.slopePer30Days).toBe(0);
        expect(single.r2).toBe(0);
        expect(Number.isNaN(single.slopePer30Days)).toBe(false);
    });

    it('ignores invalid states and handles zero-variance dates', () => {
        const deltas: TrendDeltas = {
            c1: { modified: { 'a.ts': { complexity: Number.NaN, linesOfCode: 10 } } },
            c2: { modified: { 'a.ts': delta(3, 10) } },
            c3: { modified: { 'a.ts': delta(4, 12) } },
        };
        const sameDay = [
            { hash: 'c1', date: '2026-01-01T00:00:00Z' },
            { hash: 'c2', date: '2026-01-01T00:00:00Z' },
            { hash: 'c3', date: '2026-01-01T00:00:00Z' },
        ];
        const trend = buildFileTrends(sameDay, deltas)['a.ts'];
        expect(trend.samples).toBe(2);
        expect(trend.slopePer30Days).toBe(0);
        expect(trend.r2).toBe(0);
        expect(Number.isFinite(trend.slopePer30Days)).toBe(true);
    });

    it('merges renamed paths into the current path', () => {
        const deltas: TrendDeltas = {
            c1: { modified: { 'old.ts': delta(1, 10) } },
            c2: { removed: ['old.ts'], modified: { 'new.ts': delta(3, 14) } },
            c3: { modified: { 'new.ts': delta(5, 18) } },
        };
        const trends = buildFileTrends(commits, deltas, {
            resolvePath: (path) => path === 'old.ts' ? 'new.ts' : path,
        });
        expect(trends['old.ts']).toBeUndefined();
        expect(trends['new.ts'].samples).toBe(3);
        expect(trends['new.ts'].delta).toBe(4);
        expect(trends['new.ts'].points[0].complexity).toBe(1);
    });

    it('drops removed files and summarizes trends', () => {
        const deltas: TrendDeltas = {
            c1: { modified: { 'a.ts': delta(1, 10), 'b.ts': delta(5, 20) } },
            c2: { removed: ['a.ts'], modified: { 'b.ts': delta(8, 26) } },
            c3: { modified: { 'b.ts': delta(11, 32) } },
        };
        const trends = buildFileTrends(commits, deltas);
        expect(trends['a.ts']).toBeUndefined();
        expect(trends['b.ts'].degrading).toBe(true);

        const summary = summarizeTrends(trends);
        expect(summary.files).toBe(1);
        expect(summary.degrading).toBe(1);
        expect(summary.improving).toBe(0);
        expect(summary.stable).toBe(0);
        expect(Number.isFinite(summary.averageSlopePer30Days)).toBe(true);
    });

    it('computes regression and sparkline coordinates', () => {
        const line = linearRegression([{ x: 0, y: 1 }, { x: 10, y: 3 }]);
        expect(line.slope).toBeCloseTo(0.2, 6);
        expect(line.r2).toBeCloseTo(1, 6);

        const points = [
            { hash: 'c1', date: 0, complexity: 1, lines: 10, symbols: 1 },
            { hash: 'c2', date: 30, complexity: 3, lines: 12, symbols: 1 },
            { hash: 'c3', date: 60, complexity: 2, lines: 14, symbols: 1 },
        ];
        const path = sparklinePoints(points, 100, 20);
        expect(path.split(' ')).toHaveLength(3);
        expect(path).not.toContain('NaN');
    });
});
