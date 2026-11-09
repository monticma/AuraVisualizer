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
    RISK_WEIGHTS,
    isFixCommit,
    DEFAULT_FIX_KEYWORDS,
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
    it('keeps the weights summing to 1', () => {
        const total = Object.values(RISK_WEIGHTS).reduce((sum, w) => sum + w, 0);
        expect(total).toBeCloseTo(1, 10);
    });

    it('uses fallback caps when percentiles are unavailable', () => {
        const node = { complexity: 50, fanIn: 20, fanOut: 30, deadExports: [], symbols: { totalSymbols: 10 } };
        // complexity/50, fanIn/20, fanOut/30, churn/CHURN_CAP and relChurn saturate.
        // Without percentiles, recency and authors contribute nothing (they only
        // mean something relative to the repository), fixRatio passes through.
        // structural 0.21 + 0.18 + 0.08 and frequency 0.06 → 0.53
        expect(computeRiskScore(node, null, CHURN_CAP)).toBeCloseTo(53, 5);
        // …plus relChurn 0.09 and fixRatio 0.03 → 0.65
        expect(computeRiskScore(node, null, { commits: CHURN_CAP, relChurn: 1, fixRatio: 1 })).toBeCloseTo(65, 5);
    });

    it('combines percentiles with cycle and dead-code signals', () => {
        const half: RiskPercentiles = {
            complexity: () => 0.5,
            fanIn: () => 0.5,
            fanOut: () => 0.5,
            churn: () => 0.5,
            relChurn: () => 0.5,
            recency: () => 0.5,
            authors: () => 0.5,
            fixRatio: () => 0.5,
        };
        const node = { complexity: 10, fanIn: 2, fanOut: 2, cycleIds: ['a', 'b'], deadExports: [1, 2], symbols: { totalSymbols: 4 } };
        // eight percentile components (1 - 0.12 cycle - 0.12 dead = 0.76) at
        // 0.5 → 0.38, plus cycle 0.12 and dead 0.12 × 0.5 = 0.06 → 0.56
        expect(computeRiskScore(node, half, { commits: 4, relChurn: 1, recency: 1, authors: 2, fixRatio: 0.5 }))
            .toBeCloseTo(56, 5);
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
        // centrality weight is 0.18
        expect(computeRiskScore(node, pct, 0, { centrality: true })).toBeCloseTo(18, 5);
    });

    it('rewards rewrite volume, recency, authors and bug fixes', () => {
        const pct: RiskPercentiles = {
            complexity: () => 0,
            fanIn: () => 0,
            fanOut: () => 0,
            churn: () => 0,
            relChurn: () => 1,
            recency: () => 1,
            authors: () => 1,
            fixRatio: () => 1,
        };
        const node = { complexity: 0, fanIn: 0, fanOut: 0, deadExports: [], symbols: { totalSymbols: 1 } };
        // 0.09 + 0.06 + 0.05 + 0.03 = 0.23
        expect(computeRiskScore(node, pct, { commits: 1, relChurn: 3, recency: 1, authors: 3, fixRatio: 0.4 }))
            .toBeCloseTo(23, 5);
        // Same stats, no percentiles: relChurn saturates, fixRatio passes
        // through, frequency falls back to commits/CHURN_CAP.
        // 0.09 + 0.03 × 0.4 + 0.06 × 1/20 = 0.105
        expect(computeRiskScore(node, null, { commits: 1, relChurn: 3, recency: 1, authors: 3, fixRatio: 0.4 }))
            .toBeCloseTo(10.5, 5);
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

describe('risk-core — bug-fix detection', () => {
    it('recognises the usual words in a commit subject', () => {
        expect(isFixCommit('fix crash when saving')).toBe(true);
        expect(isFixCommit('Fix: null pointer in loader')).toBe(true);
        expect(isFixCommit('hotfix for the release')).toBe(true);
        expect(isFixCommit('revert the new parser')).toBe(true);
        expect(isFixCommit('regression in the city scale')).toBe(true);
        expect(isFixCommit('add city badges')).toBe(false);
        expect(isFixCommit('prefix handling')).toBe(false); // "fix" inside a word
        expect(isFixCommit('')).toBe(false);
    });

    it('accepts a custom pattern and survives an invalid one', () => {
        expect(isFixCommit('chore: repair the build', 'repair')).toBe(true);
        expect(isFixCommit('fix crash', 'repair')).toBe(false);
        // An unparsable pattern must not throw: it falls back to the default.
        expect(isFixCommit('fix crash', '([unclosed')).toBe(true);
    });

    it('exposes the default pattern', () => {
        expect(DEFAULT_FIX_KEYWORDS).toContain('hotfix');
    });
});

describe('risk-core — git percentiles and reasons', () => {
    const nodes = [
        { id: 'a', linesOfCode: 100, complexity: 1, fanIn: 0, fanOut: 0 },
        { id: 'b', linesOfCode: 100, complexity: 2, fanIn: 0, fanOut: 0 },
        { id: 'c', linesOfCode: 100, complexity: 3, fanIn: 0, fanOut: 0 },
    ];
    const stats: Record<string, import('../risk/risk-core').RiskGitStats> = {
        a: { commits: 1, relChurn: 0.1, recency: 0.2, authors: 1, fixRatio: 0 },
        b: { commits: 5, relChurn: 1.5, recency: 2.0, authors: 2, fixRatio: 0.2 },
        c: { commits: 9, relChurn: 3.0, recency: 4.0, authors: 3, fixRatio: 0.5 },
    };
    const byId: Record<string, import('../risk/risk-core').RiskGitStats> = stats;
    const pct = buildRiskPercentiles(nodes, (n) => byId[(n as { id?: string }).id || ''] || { commits: 0 });

    it('ranks rewrite volume, recency, authors and fix ratio', () => {
        expect(pct.relChurn!(0.1)).toBe(0);
        expect(pct.relChurn!(3)).toBe(1);
        expect(pct.recency!(0.2)).toBe(0);
        expect(pct.recency!(4)).toBe(1);
        expect(pct.authors!(1)).toBe(0);
        expect(pct.authors!(3)).toBe(1);
        expect(pct.fixRatio!(0)).toBe(0);
        expect(pct.fixRatio!(0.5)).toBe(1);
    });

    it('accepts the legacy bare commit count', () => {
        const legacy = buildRiskPercentiles(nodes, (n) => (n.complexity || 0) * 2);
        expect(legacy.churn(2)).toBe(0);
        expect(legacy.churn(6)).toBe(1);
        expect(legacy.relChurn!(0)).toBe(0);
    });

    it('writes a rewrite reason with the window and the rank', () => {
        const reasons = riskReasons(
            { complexity: 3, fanIn: 0, fanOut: 0, deadExports: [], symbols: { totalSymbols: 1 } },
            pct,
            { windowDays: 90, churn: 9, authorCount: 3, relChurn: 3, fixRatio: 0.5 },
        );
        const texts = reasons.map((r) => r.text);
        expect(texts.some((t) => /rewritten 3\.0× in 90 days/.test(t))).toBe(true);
        expect(texts.some((t) => /50% of its commits are fixes/.test(t))).toBe(true);
        expect(texts.some((t) => /^3 authors/.test(t))).toBe(true);
    });

    it('drops the rewrite reason for a file that barely changed', () => {
        const reasons = riskReasons(
            { complexity: 1, fanIn: 0, fanOut: 0, deadExports: [], symbols: { totalSymbols: 1 } },
            pct,
            { windowDays: 90, churn: 1, authorCount: 1, relChurn: 0.05, fixRatio: 0 },
        );
        expect(reasons.map((r) => r.text).some((t) => t.indexOf('rewritten') === 0)).toBe(false);
    });

    it('gives the author count a real weight now', () => {
        const reasons = riskReasons(
            { complexity: 1, fanIn: 0, fanOut: 0, deadExports: [], symbols: { totalSymbols: 1 } },
            pct,
            { windowDays: 90, churn: 3, authorCount: 3 },
        );
        const authors = reasons.find((r) => /^3 authors/.test(r.text));
        expect(authors!.weight).toBeGreaterThan(0);
    });
});
