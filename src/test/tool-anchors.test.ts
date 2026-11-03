import { describe, it, expect } from 'vitest';
import { runAuraTool } from '../ai/tools';
import type { GraphDB } from '../graph-db';

/**
 * V3-15 contract: "no tool returns a bare path when a line exists".
 *
 * Every tool that knows a line must expose it as `line` *and* as a `path:line`
 * `anchor`; a tool that only knows a file must expose neither. The stub only
 * implements the queries the audited tools touch, which keeps the contract
 * readable and fast.
 */
function stubDb(overrides: Partial<Record<keyof GraphDB, unknown>> = {}): GraphDB {
    const base = {
        searchSymbols: () => [
            { nodeId: 'src/a.ts', name: 'parse', kind: 'function', line: 42, visibility: 'public', isStatic: false, isAsync: false },
            { nodeId: 'src/a.ts', name: 'legacy', kind: 'function', line: null, visibility: 'public', isStatic: false, isAsync: false },
        ],
        searchDocs: () => [
            { fileId: 'docs/guide.md', section: 'Install', lineStart: 12, score: 3, content: 'npm install' },
        ],
        getDeadCode: () => [
            { nodeId: 'src/b.ts', symbol: 'unusedHelper', kind: 'function', line: 7 },
            { nodeId: 'src/b.ts', symbol: 'maybeUnused', kind: 'function', line: null },
        ],
        getExemptedCode: () => [],
        getUnusedFunctions: () => [
            { nodeId: 'src/c.ts', name: 'orphan', kind: 'function', line: 3, visibility: 'public' },
        ],
        getHeritage: () => [
            { source: 'src/d.ts', target: 'src/base.ts', type: 'extends', label: 'Widget', confidence: 1, line: 21 },
            { source: 'src/e.ts', target: 'src/base.ts', type: 'implements', label: 'Missing', confidence: 1, line: null },
        ],
        getDependencies: () => [{ id: 'src/b.ts', depth: 1 }],
        getBlastRadius: () => [{ id: 'src/z.ts', depth: 1, risk: 'low' }],
        getEdges: () => [{ source: 'src/a.ts', target: 'src/b.ts' }],
        getCallSites: () => [
            { callerFile: 'src/a.ts', callerName: 'parse', calleeFile: 'src/b.ts', calleeName: 'helper', line: 15 },
        ],
        getAllNodes: () => [{ id: 'src/a.ts' }, { id: 'src/b.ts' }, { id: 'src/z.ts' }],
        getOrphanFiles: () => [],
        getHotspots: () => [],
        getNodeDetail: () => undefined,
        getNode: (id: string) => ({ id }),
        ...overrides,
    };
    return base as unknown as GraphDB;
}

const ANCHOR_RE = /^[\w./@-]+:\d+$/;

function collectAnchors(value: unknown, found: string[] = [], entries: Record<string, unknown>[] = []): string[] {
    if (Array.isArray(value)) {
        for (const item of value) collectAnchors(item, found, entries);
        return found;
    }
    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        if (typeof record.anchor === 'string') found.push(record.anchor);
        if ('line' in record || 'anchor' in record) entries.push(record);
        for (const key of Object.keys(record)) collectAnchors(record[key], found, entries);
    }
    return found;
}

const ANCHORED_TOOLS: [string, Record<string, unknown>][] = [
    ['aura_search_symbols', { query: 'parse' }],
    ['aura_search_docs', { query: 'install' }],
    ['aura_find_dead_code', {}],
    ['aura_find_unused_functions', {}],
    ['aura_find_heritage', {}],
    ['aura_find_dependencies', { file: 'src/a.ts' }],
    ['aura_find_dependents', { file: 'src/b.ts' }],
];

describe('tool anchors — contract (V3-15)', () => {
    it('every anchored tool emits well-formed path:line anchors', () => {
        const db = stubDb();
        for (const [name, input] of ANCHORED_TOOLS) {
            const payload = runAuraTool(db, name, input);
            const anchors = collectAnchors(payload);
            expect(anchors.length, `${name} should expose at least one anchor`).toBeGreaterThan(0);
            for (const anchor of anchors) {
                expect(anchor, `${name} → ${anchor}`).toMatch(ANCHOR_RE);
                expect(anchor.endsWith(':0')).toBe(false);
            }
        }
    });

    it('never anchors an entry whose line is unknown', () => {
        const db = stubDb();
        const dead = runAuraTool(db, 'aura_find_dead_code', {}) as { symbols: Record<string, unknown>[] };
        const withLine = dead.symbols.find(s => s.symbol === 'unusedHelper');
        const withoutLine = dead.symbols.find(s => s.symbol === 'maybeUnused');
        expect(withLine?.anchor).toBe('src/b.ts:7');
        expect(withoutLine && 'anchor' in withoutLine).toBe(false);

        const heritage = runAuraTool(db, 'aura_find_heritage', {}) as { heritage: Record<string, unknown>[] };
        expect(heritage.heritage[0].anchor).toBe('src/d.ts:21');
        expect('anchor' in heritage.heritage[1]).toBe(false);

        const symbols = runAuraTool(db, 'aura_search_symbols', { query: 'parse' }) as { results: Record<string, unknown>[] };
        expect(symbols.results[0].anchor).toBe('src/a.ts:42');
    });

    it('anchors the direct call sites of dependencies and dependents', () => {
        const deps = runAuraTool(stubDb(), 'aura_find_dependencies', { file: 'src/a.ts' }) as {
            call_sites: { anchor?: string; line: number; from: string }[];
            call_sites_total: number;
        };
        expect(deps.call_sites_total).toBe(1);
        expect(deps.call_sites[0]).toMatchObject({ from: 'parse', line: 15, anchor: 'src/a.ts:15' });

        const dependents = runAuraTool(stubDb(), 'aura_find_dependents', { file: 'src/b.ts' }) as {
            call_sites: { anchor?: string }[];
        };
        expect(dependents.call_sites[0].anchor).toBe('src/a.ts:15');
    });

    it('leaves file-level tools without an anchor key', () => {
        const db = stubDb();
        for (const name of ['aura_find_orphan_files', 'aura_get_hotspots']) {
            const payload = runAuraTool(db, name, {});
            expect(collectAnchors(payload)).toEqual([]);
        }
    });

    it('keeps the legacy file/line fields next to the anchor', () => {
        const symbols = runAuraTool(stubDb(), 'aura_search_symbols', { query: 'parse' }) as {
            results: { file: string; line: number; anchor?: string }[];
        };
        expect(symbols.results[0]).toMatchObject({ file: 'src/a.ts', line: 42, anchor: 'src/a.ts:42' });
    });
});
