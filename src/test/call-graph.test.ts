import { describe, expect, it } from 'vitest';
import {
    MODULE_SYMBOL,
    buildCallGraph,
    callGraphStats,
    calleesOf,
    callersOf,
    entryPoints,
    impactOf,
    resolveSymbol,
    shortestCallPath,
    symbolKey,
    type CallSiteInput,
} from '../analysis/call-graph';
import { runAuraTool } from '../ai/tools';

const site = (callerFile: string, callerName: string, calleeFile: string, calleeName: string, line: number): CallSiteInput =>
    ({ callerFile, callerName, calleeFile, calleeName, line });

/**
 *   src/a.ts  run   → helper        (a.ts:3)
 *             run   → parse       (a.ts:4, deux lignes : 4 et 9)
 *   src/b.ts  parse → format      (b.ts:2)
 *   src/c.ts  build → parse       (c.ts:7)   ← c appelle b.parse
 *   src/a.ts  run   → run         (a.ts:12)  récursion
 *   src/d.ts  <module> → build    (d.ts:1)
 */
const SITES: CallSiteInput[] = [
    site('src/a.ts', 'run', 'src/a.ts', 'helper', 3),
    site('src/a.ts', 'run', 'src/b.ts', 'parse', 4),
    site('src/a.ts', 'run', 'src/b.ts', 'parse', 9),
    site('src/b.ts', 'parse', 'src/b.ts', 'format', 2),
    site('src/c.ts', 'build', 'src/b.ts', 'parse', 7),
    site('src/a.ts', 'run', 'src/a.ts', 'run', 12),
    site('src/d.ts', MODULE_SYMBOL, 'src/c.ts', 'build', 1),
];

const graph = buildCallGraph(SITES);
const one = (query: string): ReturnType<typeof resolveSymbol>[number] => {
    const matches = resolveSymbol(graph, query);
    expect(matches.length).toBe(1);
    return matches[0];
};

describe('buildCallGraph', () => {
    it('counts sites, symbols and edges', () => {
        const stats = callGraphStats(graph);
        expect(stats.sites).toBe(7);
        expect(stats.edges).toBe(6);            // run→parse fusionne deux lignes
        expect(stats.symbols).toBe(6);          // run, helper, parse, format, build, <module>
        expect(stats.moduleSymbols).toBe(1);
        expect(stats.functions).toBe(5);
    });

    it('keeps both call lines on one edge', () => {
        const parse = one('src/b.ts::parse');
        const caller = callersOf(graph, parse).entries.find(entry => entry.symbol.name === 'run')!;
        expect(caller.lines).toEqual([4, 9]);
        expect(caller.confidence).toBe(0.8);
    });

    it('scores a local call at 1.0', () => {
        const helper = one('src/a.ts::helper');
        // run → helper est local, donc exclu par défaut : il faut le demander.
        expect(callersOf(graph, helper, { includeLocal: true }).entries[0].confidence).toBe(1);
    });

    it('scores an ambiguous target at 0.5', () => {
        const ambiguous = buildCallGraph([
            site('src/x.ts', 'caller', 'src/p.ts', 'dup', 1),
            site('src/x.ts', 'caller', 'src/q.ts', 'dup', 1),
        ]);
        const dup = resolveSymbol(ambiguous, 'src/p.ts::dup')[0];
        expect(callersOf(ambiguous, dup).entries[0].confidence).toBe(0.5);
        expect(callersOf(ambiguous, dup).entries[0].targets).toBe(2);
    });

    it('ignores incomplete sites instead of inventing symbols', () => {
        const partial = buildCallGraph([
            site('', 'run', 'src/b.ts', 'parse', 1),
            site('src/a.ts', 'run', '', 'parse', 1),
        ]);
        expect(partial.symbols.size).toBe(0);
        expect(partial.skipped).toBe(2);
    });

    it('is deterministic whatever the input order', () => {
        const reversed = buildCallGraph([...SITES].reverse());
        expect([...reversed.symbols.keys()].sort()).toEqual([...graph.symbols.keys()].sort());
        const a = callersOf(graph, one('src/b.ts::parse')).entries.map(entry => `${entry.symbol.key}@${entry.lines.join(',')}`);
        const b = callersOf(reversed, resolveSymbol(reversed, 'src/b.ts::parse')[0])
            .entries.map(entry => `${entry.symbol.key}@${entry.lines.join(',')}`);
        expect(a).toEqual(b);
    });
});

describe('resolveSymbol', () => {
    it('accepts an exact key', () => {
        expect(one('src/b.ts::parse').file).toBe('src/b.ts');
    });

    it('accepts file:name', () => {
        expect(one('src/b.ts:parse').key).toBe(symbolKey('src/b.ts', 'parse'));
    });

    it('returns every symbol sharing a bare name', () => {
        const many = buildCallGraph([
            site('src/a.ts', 'run', 'src/p.ts', 'dup', 1),
            site('src/a.ts', 'run', 'src/q.ts', 'dup', 2),
        ]);
        expect(resolveSymbol(many, 'dup').map(match => match.file)).toEqual(['src/p.ts', 'src/q.ts']);
    });

    it('hides <module> unless asked', () => {
        expect(resolveSymbol(graph, MODULE_SYMBOL)).toHaveLength(0);
        expect(resolveSymbol(graph, MODULE_SYMBOL, { includeModule: true })).toHaveLength(1);
    });

    it('returns nothing for an unknown symbol', () => {
        expect(resolveSymbol(graph, 'nope')).toEqual([]);
        expect(resolveSymbol(graph, '')).toEqual([]);
    });

    it('strips a leading ./', () => {
        expect(one('./src/b.ts::parse').key).toBe('src/b.ts::parse');
    });
});

describe('callersOf / calleesOf', () => {
    it('lists callers grouped by symbol', () => {
        const result = callersOf(graph, one('src/b.ts::parse'));
        expect(result.total).toBe(2);                       // run (a.ts) et build (c.ts)
        expect(result.entries.map(entry => entry.symbol.key)).toEqual(['src/a.ts::run', 'src/c.ts::build']);
        expect(result.distinctFiles).toBe(2);
    });

    it('excludes same-file calls by default and counts them', () => {
        const result = callersOf(graph, one('src/b.ts::format'));
        expect(result.total).toBe(0);
        expect(result.localTotal).toBe(1);
        expect(callersOf(graph, one('src/b.ts::format'), { includeLocal: true }).total).toBe(1);
    });

    it('hides <module> callers by default', () => {
        const result = callersOf(graph, one('src/c.ts::build'));
        expect(result.total).toBe(0);
        expect(callersOf(graph, one('src/c.ts::build'), { includeModule: true }).total).toBe(1);
    });

    it('truncates and says so', () => {
        const result = callersOf(graph, one('src/b.ts::parse'), { limit: 1 });
        expect(result.entries).toHaveLength(1);
        expect(result.truncated).toBe(true);
        expect(result.total).toBe(2);
    });

    it('lists callees with lines', () => {
        const result = calleesOf(graph, one('src/a.ts::run'));
        // helper et run sont dans le même fichier : seuls les appels sortants restent.
        expect(result.entries.map(entry => entry.symbol.name)).toEqual(['parse']);
        expect(result.localTotal).toBe(2);
        expect(result.entries[0].lines).toEqual([4, 9]);
        // Groupés par fichier, puis par nom : a.ts (helper, run) avant b.ts (parse).
        expect(calleesOf(graph, one('src/a.ts::run'), { includeLocal: true }).entries.map(entry => entry.symbol.name))
            .toEqual(['helper', 'run', 'parse']);
    });

    it('counts ambiguous callers', () => {
        const ambiguous = buildCallGraph([
            site('src/x.ts', 'caller', 'src/p.ts', 'dup', 1),
            site('src/x.ts', 'caller', 'src/q.ts', 'dup', 1),
        ]);
        expect(callersOf(ambiguous, resolveSymbol(ambiguous, 'src/p.ts::dup')[0]).ambiguous).toBe(1);
    });
});

describe('impactOf', () => {
    it('walks the reverse graph with depths', () => {
        const result = impactOf(graph, one('src/b.ts::parse'));
        expect(result.impacted.map(entry => `${entry.symbol.key}:${entry.depth}`)).toEqual([
            'src/a.ts::run:1',
            'src/c.ts::build:1',
        ]);
        expect(result.distinctFiles).toBe(2);
        expect(result.maxDepth).toBe(1);
    });

    it('survives a recursion in the graph', () => {
        const result = impactOf(graph, one('src/a.ts::run'));
        expect(result.total).toBe(0);
    });

    it('honours maxDepth', () => {
        const chain = buildCallGraph([
            site('d.ts', 'd', 'c.ts', 'c', 1),
            site('c.ts', 'c', 'b.ts', 'b', 1),
            site('b.ts', 'b', 'a.ts', 'a', 1),
        ]);
        const shallow = impactOf(chain, resolveSymbol(chain, 'a.ts::a')[0], { maxDepth: 1 });
        expect(shallow.impacted.map(entry => entry.symbol.name)).toEqual(['b']);
        const deep = impactOf(chain, resolveSymbol(chain, 'a.ts::a')[0], { maxDepth: 5 });
        expect(deep.impacted.map(entry => entry.symbol.name)).toEqual(['b', 'c', 'd']);
    });

    it('truncates on demand', () => {
        const result = impactOf(graph, one('src/b.ts::parse'), { limit: 1 });
        expect(result.impacted).toHaveLength(1);
        expect(result.truncated).toBe(true);
    });
});

describe('shortestCallPath', () => {
    const moduleOf = (file: string): ReturnType<typeof resolveSymbol>[number] => {
        const matches = resolveSymbol(graph, `${file}::${MODULE_SYMBOL}`, { includeModule: true });
        expect(matches.length).toBe(1);
        return matches[0];
    };

    it('finds the path from an entry to a callee', () => {
        const result = shortestCallPath(graph, moduleOf('src/d.ts'), one('src/b.ts::parse'));
        expect(result.found).toBe(true);
        expect(result.steps.map(step => step.symbol.name)).toEqual([MODULE_SYMBOL, 'build', 'parse']);
        // `line` est la ligne d'appel qui MÈNE à l'étape : d.ts:1 puis c.ts:7.
        expect(result.steps[1].line).toBe(1);
        expect(result.steps[2].line).toBe(7);
        expect(result.steps[0].line).toBeUndefined();
    });

    it('returns the symbol itself for a self query', () => {
        const result = shortestCallPath(graph, one('src/a.ts::run'), one('src/a.ts::run'));
        expect(result.found).toBe(true);
        expect(result.steps).toHaveLength(1);
    });

    it('reports when no path exists', () => {
        const result = shortestCallPath(graph, one('src/b.ts::parse'), one('src/a.ts::run'));
        expect(result.found).toBe(false);
        expect(result.steps).toEqual([]);
    });

    it('does not loop on a recursion', () => {
        const result = shortestCallPath(graph, one('src/a.ts::run'), one('src/a.ts::helper'));
        expect(result.steps.map(step => step.symbol.name)).toEqual(['run', 'helper']);
    });

    it('honours maxDepth', () => {
        expect(shortestCallPath(graph, moduleOf('src/d.ts'), one('src/b.ts::parse'), { maxDepth: 1 }).found).toBe(false);
    });
});

describe('outils (glue runAuraTool)', () => {
    // Le module est pur ; ce test couvre la couche outil : requête `fichier::nom`,
    // note honnête quand rien n'est trouvé, ancres et groupement par symbole.
    const fakeDb = {
        // `orphan` n'a aucun appelant : c'est la racine attendue par le test
        // des points d'entrée.
        getFunctionCalls: () => [...SITES, site('src/lonely.ts', 'orphan', 'src/a.ts', 'helper', 1)].map(site => ({
            caller_file: site.callerFile,
            caller_name: site.callerName,
            callee_file: site.calleeFile,
            callee_name: site.calleeName,
            call_line: site.line,
        })),
    } as unknown as Parameters<typeof runAuraTool>[0];

    it('answers find_callers with anchors', () => {
        const payload = runAuraTool(fakeDb, 'aura_find_callers', { symbol: 'src/b.ts::parse' }) as {
            total: number; matches: { entries: { anchor?: string }[] }[];
        };
        expect(payload.total).toBe(2);
        expect(payload.matches[0].entries[0].anchor).toBe('src/a.ts:4');
    });

    it('accepts a bare name and a file hint', () => {
        const bare = runAuraTool(fakeDb, 'aura_find_callees', { symbol: 'run' }) as { match_count: number };
        expect(bare.match_count).toBe(1);
        const hinted = runAuraTool(fakeDb, 'aura_find_callees', { symbol: 'parse', file: 'src/b.ts' }) as { query: string };
        expect(hinted.query).toBe('src/b.ts::parse');
    });

    it('says the graph is static when nothing is found', () => {
        const payload = runAuraTool(fakeDb, 'aura_find_callers', { symbol: 'db.getCallSites' }) as { total: number; note?: string };
        expect(payload.total).toBe(0);
        expect(payload.note).toContain('is not recorded');
        expect(payload.note).toContain('not a proof');
    });

    it('answers symbol_impact with depths', () => {
        const payload = runAuraTool(fakeDb, 'aura_symbol_impact', { symbol: 'src/b.ts::parse' }) as {
            total: number; matches: { impacted: { depth: number; name: string }[] }[];
        };
        expect(payload.total).toBe(2);
        expect(payload.matches[0].impacted.map(entry => `${entry.name}:${entry.depth}`)).toEqual(['run:1', 'build:1']);
    });

    it('answers trace_flow and reports a missing path', () => {
        const found = runAuraTool(fakeDb, 'aura_trace_flow', {
            from: `src/d.ts::${MODULE_SYMBOL}`, to: 'src/b.ts::parse',
        }) as { found: boolean; length: number };
        expect(found.found).toBe(true);
        expect(found.length).toBe(2);
        const missing = runAuraTool(fakeDb, 'aura_trace_flow', {
            from: 'src/b.ts::parse', to: 'src/a.ts::run',
        }) as { found: boolean; note?: string };
        expect(missing.found).toBe(false);
        expect(missing.note).toContain('dynamic dispatch');
    });

    it('answers find_entry_points with counts', () => {
        const payload = runAuraTool(fakeDb, 'aura_find_entry_points', {}) as { total: number; counts: Record<string, number> };
        expect(payload.total).toBeGreaterThan(0);
        expect(payload.counts.root).toBeGreaterThan(0);
    });
});

describe('entryPoints', () => {
    const withEntries = buildCallGraph([
        ...SITES,
        site('src/tool.ts', 'main', 'src/a.ts', 'run', 5),
        site('src/extension.ts', 'activate', 'src/a.ts', 'run', 3),
        site('src/lonely.ts', 'orphan', 'src/a.ts', 'helper', 1),
    ]);

    it('detects main, lifecycle and package entries', () => {
        const entries = entryPoints(withEntries, { packageEntries: ['src/d.ts'] });
        const named = entries.filter(entry => entry.reason !== 'root').map(entry => `${entry.reason}:${entry.symbol.name}`);
        expect(named).toContain('main:main');
        expect(named).toContain('lifecycle:activate');
        expect(named).toContain('package:' + MODULE_SYMBOL);
    });

    it('falls back to graph roots', () => {
        // `run` est appelé (dont par lui-même), `orphan` par personne.
        const entries = entryPoints(withEntries);
        expect(entries.some(entry => entry.reason === 'root' && entry.symbol.name === 'run')).toBe(false);
        expect(entries.some(entry => entry.reason === 'root' && entry.symbol.name === 'orphan')).toBe(true);
    });

    it('can hide the test files', () => {
        const tests = buildCallGraph([...SITES, site('src/a.test.ts', MODULE_SYMBOL, 'src/a.ts', 'run', 1)]);
        expect(entryPoints(tests).some(entry => entry.reason === 'test')).toBe(true);
        expect(entryPoints(tests, { includeTests: false }).some(entry => entry.reason === 'test')).toBe(false);
    });

    it('orders main before roots', () => {
        const entries = entryPoints(withEntries);
        const firstRoot = entries.findIndex(entry => entry.reason === 'root');
        const firstMain = entries.findIndex(entry => entry.reason === 'main');
        expect(firstMain).toBeLessThan(firstRoot);
    });
});
