import { describe, it, expect } from 'vitest';
import {
    percentileLookup,
    buildRiskPercentiles,
    topPercentLabel,
    computeRiskScore,
    riskReasons,
    riskReasonsText,
    normalizeRiskWindow,
    buildRenameResolver,
    CHURN_CAP,
    type RiskPercentiles,
} from '../risk/risk-core';

describe('risk-core — percentileLookup', () => {
    it('ranks values between 0 and 1', () => {
        const p = percentileLookup([1, 2, 3, 4]);
        expect(p(1)).toBe(0);
        expect(p(4)).toBe(1);
        const mid = p(3);
        expect(mid).toBeGreaterThan(0);
        expect(mid).toBeLessThan(1);
    });

    it('excludes ties from the denominator (90% zeros + one 5)', () => {
        const values = new Array(9).fill(0).concat([5]);
        const p = percentileLookup(values);
        expect(p(0)).toBe(0);
        expect(p(5)).toBe(1);
    });

    it('returns 0 for empty input and for all-equal values', () => {
        expect(percentileLookup([])(42)).toBe(0);
        const p = percentileLookup([7, 7, 7]);
        expect(p(7)).toBe(0);
    });
});

describe('risk-core — buildRiskPercentiles', () => {
    it('ranks metrics across the given nodes via the churn accessor', () => {
        const nodes = [{ complexity: 1 }, { complexity: 2 }, { complexity: 3 }, { complexity: 4 }];
        const pct = buildRiskPercentiles(nodes, (n) => (n.complexity || 0) * 2);
        expect(pct.complexity(1)).toBe(0);
        expect(pct.complexity(4)).toBe(1);
        expect(pct.churn(2)).toBe(0);  // churn of the smallest node
        expect(pct.churn(8)).toBe(1);  // churn of the largest node
    });

    it('includes a PageRank centrality percentile', () => {
        const pct = buildRiskPercentiles([
            { pagerank: 0.1 }, { pagerank: 0.2 }, { pagerank: 0.9 },
        ], () => 0);
        expect(pct.centrality!(0.1)).toBe(0);
        expect(pct.centrality!(0.9)).toBe(1);
    });
});

describe('risk-core — topPercentLabel', () => {
    it('renders top N%', () => expect(topPercentLabel(0.94)).toBe('top 6%'));
    it('renders "the highest" for the maximum', () => expect(topPercentLabel(1)).toBe('the highest'));
    it('returns null when the rank carries no information', () => expect(topPercentLabel(0)).toBeNull());
});

describe('risk-core — normalizeRiskWindow', () => {
    it('accepts the three supported windows', () => {
        expect(normalizeRiskWindow(30)).toBe(30);
        expect(normalizeRiskWindow(90)).toBe(90);
        expect(normalizeRiskWindow(365)).toBe(365);
    });

    it('falls back to 90 for invalid values', () => {
        expect(normalizeRiskWindow(45)).toBe(90);
        expect(normalizeRiskWindow('90')).toBe(90);
        expect(normalizeRiskWindow(undefined)).toBe(90);
    });
});

describe('risk-core — computeRiskScore', () => {
    it('uses fallback caps when percentiles are unavailable', () => {
        const node = { complexity: 50, fanIn: 20, fanOut: 30, deadExports: [], symbols: { totalSymbols: 10 } };
        // complexity/50, fanIn/20, fanOut/30, churn/CHURN_CAP all saturate → 70/100
        expect(computeRiskScore(node, null, CHURN_CAP)).toBeCloseTo(70, 5);
    });

    it('combines percentiles with cycle and dead-code signals', () => {
        const half: RiskPercentiles = {
            complexity: () => 0.5,
            fanIn: () => 0.5,
            fanOut: () => 0.5,
            churn: () => 0.5,
        };
        const node = { complexity: 10, fanIn: 2, fanOut: 2, cycleIds: ['a', 'b'], deadExports: [1, 2], symbols: { totalSymbols: 4 } };
        // 0.5 × 0.70 + 0.15 (cycle) + 0.15 × 0.5 (dead) = 0.575 → 57.5
        expect(computeRiskScore(node, half, 0)).toBeCloseTo(57.5, 5);
    });

    it('replaces fan-in with PageRank when centrality is enabled', () => {
        const pct: RiskPercentiles = {
            complexity: () => 0,
            fanIn: () => 0,
            fanOut: () => 0,
            churn: () => 0,
            centrality: () => 1,
        };
        const node = { fanIn: 0, pagerank: 0.4, deadExports: [], symbols: { totalSymbols: 1 } };
        expect(computeRiskScore(node, pct, 0)).toBeCloseTo(0, 5);
        expect(computeRiskScore(node, pct, 0, { centrality: true })).toBeCloseTo(20, 5);
    });

    it('explains PageRank centrality when enabled', () => {
        const pct: RiskPercentiles = {
            complexity: () => 0, fanIn: () => 0, fanOut: () => 0, churn: () => 0, centrality: () => 1,
        };
        const reasons = riskReasons({ fanIn: 0, pagerank: 0.4 }, pct, {
            windowDays: 90, churn: 0, authorCount: 0, centrality: true,
        });
        expect(reasons.some(reason => reason.text.includes('centrality'))).toBe(true);
    });
});

describe('risk-core — buildRenameResolver', () => {
    it('is the identity when nothing was renamed', () => {
        const resolve = buildRenameResolver([
            { files: [{ status: 'A', path: 'a.ts' }, { status: 'M', path: 'b.ts' }] },
            { files: [{ status: 'M', path: 'a.ts' }] },
        ]);
        expect(resolve('a.ts')).toBe('a.ts');
        expect(resolve('unknown.ts')).toBe('unknown.ts');
    });

    it('maps a renamed file to its current path', () => {
        const resolve = buildRenameResolver([
            { files: [{ status: 'R', path: 'new/b.ts', oldPath: 'a.ts' }] },
        ]);
        expect(resolve('a.ts')).toBe('new/b.ts');
        expect(resolve('new/b.ts')).toBe('new/b.ts');
    });

    it('collapses rename chains (a→b then b→c gives a⇒c)', () => {
        // Commits are newest-first, like git log output.
        const resolve = buildRenameResolver([
            { files: [{ status: 'R', path: 'c.ts', oldPath: 'b.ts' }] },
            { files: [{ status: 'R', path: 'b.ts', oldPath: 'a.ts' }] },
        ]);
        expect(resolve('a.ts')).toBe('c.ts');
        expect(resolve('b.ts')).toBe('c.ts');
    });

    it('keeps the most recent rename when a historical path is reused', () => {
        const resolve = buildRenameResolver([
            { files: [{ status: 'R', path: 'second.ts', oldPath: 'reused.ts' }] },
            { files: [{ status: 'R', path: 'first.ts', oldPath: 'reused.ts' }] },
        ]);
        expect(resolve('reused.ts')).toBe('second.ts');
    });

    it('breaks rename cycles safely', () => {
        const resolve = buildRenameResolver([
            { files: [{ status: 'R', path: 'b.ts', oldPath: 'a.ts' }] },
            { files: [{ status: 'R', path: 'a.ts', oldPath: 'b.ts' }] },
        ]);
        const out = resolve('a.ts');
        expect(out === 'a.ts' || out === 'b.ts').toBe(true);
    });

    it('ignores rename entries without an old path', () => {
        const resolve = buildRenameResolver([
            { files: [{ status: 'R', path: 'a.ts' }] },
        ]);
        expect(resolve('a.ts')).toBe('a.ts');
    });
});

describe('risk-core — riskReasons', () => {
    const pct: RiskPercentiles = {
        complexity: (v) => (v >= 50 ? 0.99 : 0.1),
        fanIn: (v) => (v >= 10 ? 0.97 : 0.1),
        fanOut: () => 0.2,
        churn: (v) => (v >= 29 ? 0.99 : 0.1),
    };

    it('writes plain-language reasons with real numbers', () => {
        const node = { complexity: 60, fanIn: 12, fanOut: 3 };
        const reasons = riskReasons(node, pct, { windowDays: 90, churn: 29, authorCount: 4 });
        const text = riskReasonsText(reasons, ' | ');
        expect(text).toContain('complexity 60 (top 1% of the repo)');
        expect(text).toContain('12 files depend on it (top 3%)');
        expect(text).toContain('changed 29 times in 90 days (top 1%)');
        expect(text).toContain('depends on 3 files');
        expect(text).toContain('4 authors');
    });

    it('sorts by contribution, strongest factor first', () => {
        const node = { complexity: 60, fanIn: 12 };
        const reasons = riskReasons(node, pct, { windowDays: 90, churn: 0, authorCount: 0 });
        expect(reasons[0].text).toContain('complexity 60');
        expect(reasons[1].text).toContain('12 files depend on it');
    });

    it('flags a dependency cycle and a single author', () => {
        const node = { complexity: 0, fanIn: 0, fanOut: 0, cycleIds: ['x'] };
        const reasons = riskReasons(node, pct, { windowDays: 30, churn: 0, authorCount: 1 });
        expect(riskReasonsText(reasons, ' · ')).toBe('in a dependency cycle · single author');
    });

    it('reports unused symbols with the ratio', () => {
        const node = { complexity: 0, deadExports: [1, 2, 3], symbols: { totalSymbols: 12 } };
        const reasons = riskReasons(node, pct, { windowDays: 90, churn: 0, authorCount: 0 });
        expect(riskReasonsText(reasons, ' | ')).toBe('3 unused symbols of 12');
    });
});
