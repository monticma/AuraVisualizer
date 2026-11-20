import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The Aura Query Language lives in `webview/js/query.js` as a browser IIFE that
 * publishes `window.AuraQuery`. It is loaded the way the webview loads it — no
 * bundler, no module system — so these tests exercise the real shipped file.
 */
type CompileResult = { ok: boolean; fn?: (node: any) => boolean; error?: string; pos?: number };
type QueryApi = {
    compile: (expr: string) => CompileResult;
    prepareNode: (node: any, ctx: any) => any;
    listFields: () => string[];
    fieldType: (name: string) => string | null;
    operators: string[];
    registerMetricColumn: (key: string) => void;
    resetMetricColumns: () => void;
    metricColumns: () => string[];
};

let Q: QueryApi;

const ctx = {
    communityName: () => '',
    cycleNodeIds: new Set<string>(),
    pinnedNodes: new Set<unknown>(),
    dirtySet: new Set<string>(),
    notes: {} as Record<string, unknown>,
    cochangeScore: () => 0,
    churnScore: () => 0,
};

const node = {
    id: 'src/deep/a.ts',
    language: 'typescript',
    name: 'a.ts',
    path: 'src/deep/a.ts',
    group: 'src',
    extension: 'ts',
    fanIn: 7,
    fanOut: 2,
    complexity: 22,
    cognitive: 15,
    linesOfCode: 340,
    size: 1000,
    lastModified: Date.now(),
};

/** Evaluate against a fresh copy of the fixture (prepareNode mutates). */
function run(expr: string): boolean {
    const compiled = Q.compile(expr);
    if (!compiled.ok) throw new Error('compile failed: ' + compiled.error);
    const copy = JSON.parse(JSON.stringify(node));
    Q.prepareNode(copy, ctx);
    return !!compiled.fn!(copy);
}

beforeAll(() => {
    const src = readFileSync(join(__dirname, '..', '..', 'webview', 'js', 'query.js'), 'utf8');
    const win: { AuraQuery?: QueryApi } = {};
    new Function('window', src)(win);
    Q = win.AuraQuery!;
});

describe('Aura Query Language — string operators', () => {
    it('contains is a case-insensitive substring test', () => {
        expect(run('path contains "deep"')).toBe(true);
        expect(run('path contains "DEEP"')).toBe(true);
        expect(run('path contains "nope"')).toBe(false);
        expect(run('path contains ""')).toBe(true);
    });

    it('startswith and endswith anchor at the ends', () => {
        expect(run('name startswith "a."')).toBe(true);
        expect(run('path startswith "src"')).toBe(true);
        expect(run('path startswith "deep"')).toBe(false);
        expect(run('path endswith ".ts"')).toBe(true);
        expect(run('path endswith "src"')).toBe(false);
    });

    it('accepts a bare word as the pattern', () => {
        expect(run('path contains deep')).toBe(true);
    });
});

describe('Aura Query Language — between', () => {
    it('is inclusive on both bounds', () => {
        expect(run('complexity between 22 and 22')).toBe(true);
        expect(run('complexity between 20 and 30')).toBe(true);
        expect(run('complexity between 23 and 30')).toBe(false);
    });

    it('tolerates reversed bounds', () => {
        expect(run('complexity between 30 and 20')).toBe(true);
    });

    it('reports a clear error when "and" is missing', () => {
        const res = Q.compile('complexity between 20');
        expect(res.ok).toBe(false);
        expect(res.error).toMatch(/between/);
        expect(res.error).toMatch(/and/);
    });
});

describe('Aura Query Language — not in', () => {
    it('negates the membership test', () => {
        expect(run('language not in ["css"]')).toBe(true);
        expect(run('language not in ["typescript"]')).toBe(false);
        expect(run('language not in ["css", "typescript"]')).toBe(false);
    });

    it('requires a list', () => {
        const res = Q.compile('language not in "css"');
        expect(res.ok).toBe(false);
    });
});

describe('Aura Query Language — field to field', () => {
    it('compares two numeric fields of the same node', () => {
        expect(run('fanIn > fanOut')).toBe(true);
        expect(run('fanOut > fanIn')).toBe(false);
        expect(run('complexity >= cognitive')).toBe(true);
        expect(run('complexity < cognitive')).toBe(false);
    });

    it('keeps bare words as literals when they are not field names', () => {
        // `javascript` is not a field, so this stays a string comparison.
        expect(run('language == typescript')).toBe(true);
        expect(run('language == javascript')).toBe(false);
    });

    it('still treats a quoted string as a literal even when it names a field', () => {
        expect(run('name == "fanIn"')).toBe(false);
    });
});

describe('Aura Query Language — composition and reporting', () => {
    it('mixes the new operators with AND / OR / NOT', () => {
        expect(run('path contains "deep" AND complexity between 20 and 30')).toBe(true);
        expect(run('path contains "deep" AND NOT (complexity between 20 and 30)')).toBe(false);
        expect(run('language not in ["css"] OR fanIn > fanOut')).toBe(true);
    });

    it('advertises the new operators to the autocomplete', () => {
        for (const op of ['contains', 'startswith', 'endswith', 'between', 'not in']) {
            expect(Q.operators).toContain(op);
        }
    });

    it('keeps resolving the field names it always had', () => {
        expect(Q.listFields()).toContain('churn');
        expect(Q.listFields()).toContain('stalenote');
    });
});

describe('Aura Query Language — imported metric columns', () => {
    const runOn = (expr: string, extra: Record<string, unknown>): boolean => {
        const compiled = Q.compile(expr);
        if (!compiled.ok) throw new Error('compile failed: ' + compiled.error);
        const copy = { ...JSON.parse(JSON.stringify(node)), ...extra };
        Q.prepareNode(copy, ctx);
        return !!compiled.fn!(copy);
    };

    beforeAll(() => {
        Q.registerMetricColumn('coverage');
        Q.registerMetricColumn('eslintErrors');
    });

    it('is queryable after registration', () => {
        expect(Q.metricColumns()).toEqual(['coverage', 'eslinterrors']);
        expect(Q.listFields()).toContain('coverage');
        expect(Q.fieldType('coverage')).toBe('number');
        expect(runOn('coverage < 80', { metrics: { coverage: 42 } })).toBe(true);
        expect(runOn('coverage < 80', { metrics: { coverage: 91 } })).toBe(false);
    });

    it('combines with the metrics Aura computes itself', () => {
        // The heading use case: complex and badly covered.
        expect(runOn('coverage < 80 and cognitive > 40', { metrics: { coverage: 12 }, cognitive: 44 })).toBe(true);
        expect(runOn('coverage < 80 and cognitive > 40', { metrics: { coverage: 12 }, cognitive: 10 })).toBe(false);
    });

    it('treats a missing value as unknown, never as zero', () => {
        for (const expr of ['coverage < 80', 'coverage > 0', 'coverage == 0', 'coverage != 0', 'coverage between 0 and 100']) {
            expect(runOn(expr, {})).toBe(false);
            expect(runOn(expr, { metrics: {} })).toBe(false);
        }
    });

    it('supports between and field-to-field comparisons', () => {
        expect(runOn('coverage between 40 and 60', { metrics: { coverage: 55 } })).toBe(true);
        expect(runOn('coverage < eslintErrors', { metrics: { coverage: 3, eslintErrors: 9 } })).toBe(true);
    });

    it('is case-insensitive', () => {
        expect(runOn('COVERAGE < 80', { metrics: { coverage: 10 } })).toBe(true);
    });

    it('forgets the columns on reset, so a cleared import stops matching', () => {
        Q.resetMetricColumns();
        expect(Q.metricColumns()).toEqual([]);
        expect(Q.listFields()).not.toContain('coverage');
        // An unknown field never matches, whatever the node carries.
        expect(runOn('coverage < 80', { metrics: { coverage: 10 } })).toBe(false);
        Q.registerMetricColumn('coverage');
    });
});
