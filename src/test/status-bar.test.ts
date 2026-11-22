import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * `webview/js/status-bar.js` is a browser IIFE like `query.js`, so it is loaded
 * the way the webview loads it. Only the pure formatters are exercised here —
 * the DOM side is covered by the jsdom harness.
 */
type StatusApi = {
    formatCounts: (counts: Record<string, unknown> | null) => string;
    formatSelection: (node: Record<string, unknown> | null) => string;
    countsFrom: (
        graph: Record<string, unknown> | null,
        shown?: number,
        note?: string,
        queryExpr?: string,
    ) => Record<string, unknown>;
    TABS: Record<string, { selection: boolean; city?: boolean }>;
};

let S: StatusApi;

beforeAll(() => {
    const src = readFileSync(join(__dirname, '..', '..', 'webview', 'js', 'status-bar.js'), 'utf8');
    const win: { AuraStatus?: StatusApi } = {};
    new Function('window', 'document', src)(win, {});
    S = win.AuraStatus!;
});

describe('AuraStatus.formatCounts', () => {
    it('always leads with the query, present or not', () => {
        expect(S.formatCounts({ shown: 10, total: 10, query: '' })).toContain('⌕ —');
        expect(S.formatCounts({ shown: 10, total: 10, query: 'incycle' })).toContain('⌕ incycle');
    });

    it('reads "shown / total files", with thousands separated', () => {
        expect(S.formatCounts({ shown: 1234, total: 4567, query: '' }))
            .toBe('⌕ — · 1 234 / 4 567 files');
    });

    it('omits a count that is zero instead of writing it', () => {
        const text = S.formatCounts({ shown: 3, total: 3, query: '', cycles: 0, deadExports: 0 });
        expect(text).toBe('⌕ — · 3 / 3 files');
    });

    it('pluralises cycles and names the other counters', () => {
        expect(S.formatCounts({ shown: 3, total: 3, cycles: 1 })).toContain('1 cycle');
        expect(S.formatCounts({ shown: 3, total: 3, cycles: 2 })).toContain('2 cycles');
        expect(S.formatCounts({ shown: 3, total: 3, deadExports: 12 })).toContain('12 dead exports');
        expect(S.formatCounts({ shown: 3, total: 3, resolution: 91 })).toContain('91 % resolved');
    });

    it('does not claim a resolution it was never given', () => {
        expect(S.formatCounts({ shown: 3, total: 3 })).not.toContain('resolved');
    });

    it('appends the view note (truncation, pair count…)', () => {
        expect(S.formatCounts({ shown: 3, total: 900, note: 'top 400 shown' }))
            .toBe('⌕ — · 3 / 900 files · top 400 shown');
    });

    it('returns an empty string when there is nothing to say', () => {
        expect(S.formatCounts(null)).toBe('');
    });
});

describe('AuraStatus.formatSelection', () => {
    const file = { id: 'src/a.ts', linesOfCode: 340, complexity: 12, cognitive: 44, fanIn: 7, fanOut: 3 };

    it('describes a file in the shared vocabulary', () => {
        expect(S.formatSelection(file)).toBe('src/a.ts · 340 LOC · ccx 12 · cog 44 · 7 in · 3 out');
    });

    it('skips a value it does not have', () => {
        expect(S.formatSelection({ id: 'x.ts', linesOfCode: 10, complexity: 0, fanIn: 0, fanOut: 0 }))
            .toBe('x.ts · 10 LOC · 0 in · 0 out');
    });

    it('ignores clusters and symbols: they are not files', () => {
        expect(S.formatSelection({ id: 'dir', _isCluster: true })).toBe('');
        expect(S.formatSelection({ id: 'fn', _isSymbol: true })).toBe('');
    });

    it('returns an empty string without a node', () => {
        expect(S.formatSelection(null)).toBe('');
        expect(S.formatSelection({})).toBe('');
    });
});

describe('AuraStatus.countsFrom', () => {
    const graph = {
        nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        meta: {
            cycles: [['a', 'b']],
            deadExportsTotal: 4,
            resolution: { totals: { attempts: 200, resolved: 182, guessed: 3, unresolved: 18 } },
        },
    };

    it('computes the totals, the cycles and the resolution share', () => {
        const counts = S.countsFrom(graph, 2, 'note', 'ccx > 10');
        expect(counts).toMatchObject({
            shown: 2,
            total: 3,
            query: 'ccx > 10',
            cycles: 1,
            deadExports: 4,
            resolution: 91,
            note: 'note',
        });
    });

    it('falls back to the total when no shown count is given', () => {
        expect(S.countsFrom(graph).shown).toBe(3);
    });

    it('leaves the resolution undefined when nothing was attempted', () => {
        const counts = S.countsFrom({ nodes: [], meta: { resolution: { totals: { attempts: 0 } } } });
        expect(counts.resolution).toBeUndefined();
    });

    it('survives an empty graph', () => {
        expect(S.countsFrom(null)).toMatchObject({ shown: 0, total: 0, cycles: 0 });
    });
});

describe('AuraStatus.TABS', () => {
    it('gives a selection zone only where the objects carry no numbers', () => {
        expect(S.TABS.treemap.selection).toBe(true);
        expect(S.TABS.chord.selection).toBe(true);
        expect(S.TABS.dsm.selection).toBe(true);
        expect(S.TABS.table.selection).toBe(false);
        expect(S.TABS.metrics.selection).toBe(false);
        expect(S.TABS.risk.selection).toBe(false);
    });

    it('treats the City as its own case', () => {
        expect(S.TABS.city.city).toBe(true);
        expect(S.TABS.city.selection).toBe(false);
    });
});
