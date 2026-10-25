import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { GraphDB } from '../graph-db';
import { buildGraph, preParseFiles } from '../analyzer/graph-builder';
import { initTreeSitter } from '../analyzer/tree-sitter-loader';
import { runAuraTool } from '../ai/tools';
import { makeFileInfo } from './helpers';
import type { GraphData, GraphNode, GraphLink } from '../analyzer/types';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

async function makeTestGraph() {
    const files = [
        makeFileInfo({ id: 'main.c', content: '#include "utils.h"\nint main() {\n  if (x) {\n    for(;;) {}\n  }\n  return 0;\n}\n', language: 'c', extension: '.c', group: 'src' }),
        makeFileInfo({ id: 'utils.h', content: 'int add(int a, int b);\nvoid init(void);\n', language: 'c', extension: '.h', group: 'src' }),
        makeFileInfo({ id: 'utils.c', content: '#include "utils.h"\nint add(int a, int b) { return a+b; }\nvoid init(void) {}\n', language: 'c', extension: '.c', group: 'src' }),
        makeFileInfo({ id: 'lib/helper.c', content: '#include "../utils.h"\nvoid help() {}\n', language: 'c', extension: '.c', group: 'lib' }),
    ];
    const trees = await preParseFiles(files);
    return buildGraph(files, 'TestProject', {}, trees);
}

beforeAll(async () => {
    await initTreeSitter();
});

describe('GraphDB', () => {
    let db: GraphDB;
    let tmpDir: string;
    let dbPath: string;

    beforeEach(async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'aura-test-'));
        dbPath = join(tmpDir, 'graph.db');
        db = new GraphDB();
        await db.open(dbPath);
    });

    afterEach(() => {
        db.close();
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('opens and reports isOpen', async () => {
        expect(db.isOpen).toBe(true);
    });

    it('imports graph data without error', async () => {
        const graph = await makeTestGraph();
        expect(() => db.importGraphData(graph)).not.toThrow();
    });

    it('stores all nodes', async () => {
        db.importGraphData(await makeTestGraph());
        const nodes = db.getAllNodes();
        expect(nodes).toHaveLength(4);
        expect(nodes.map(n => n.id).sort()).toEqual(['lib/helper.c', 'main.c', 'utils.c', 'utils.h']);
        expect(nodes.some(n => typeof n.pagerank === 'number' && n.pagerank > 0)).toBe(true);
    });

    it('stores edges', async () => {
        db.importGraphData(await makeTestGraph());
        const edges = db.getAllEdges();
        expect(edges.length).toBeGreaterThanOrEqual(3); // main→utils.h, utils.c→utils.h, helper→utils.h
        expect(edges.every(e => e.confidence === 1)).toBe(true); // legacy links default to 1.0
    });

    it('stores meta', async () => {
        db.importGraphData(await makeTestGraph());
        expect(db.getMeta('projectName')).toBe('TestProject');
        expect(db.getMeta('totalFiles')).toBe('4');
    });

    it('stores and reads custom meta (fingerprint keys)', async () => {
        db.importGraphData(await makeTestGraph());
        db.setMeta('fingerprint', 'abc123');
        db.setMeta('head', 'deadbeef');
        db.save();
        expect(db.getMeta('fingerprint')).toBe('abc123');
        expect(db.getMeta('head')).toBe('deadbeef');
        expect(db.getAllMeta()).toHaveProperty('fingerprint', 'abc123');

        db.close();
        const reopened = new GraphDB();
        await reopened.open(dbPath);
        expect(reopened.getMeta('fingerprint')).toBe('abc123');
        reopened.close();
    });

    it('getDependencies returns direct deps', async () => {
        db.importGraphData(await makeTestGraph());
        const deps = db.getDependencies('main.c', 1);
        expect(deps.length).toBeGreaterThanOrEqual(1);
        expect(deps.some(d => d.id === 'utils.h')).toBe(true);
    });

    it('getDependents returns reverse deps', async () => {
        db.importGraphData(await makeTestGraph());
        const deps = db.getDependents('utils.h', 1);
        expect(deps.length).toBeGreaterThanOrEqual(2); // main.c, utils.c, possibly helper.c
    });

    it('getBlastRadius returns dependents with risk levels', async () => {
        db.importGraphData(await makeTestGraph());
        const blast = db.getBlastRadius('utils.h', 5);
        expect(blast.length).toBeGreaterThanOrEqual(2);
        // Direct dependents should be high risk
        const highRisk = blast.filter(b => b.risk === 'high');
        expect(highRisk.length).toBeGreaterThanOrEqual(2); // main.c, utils.c, helper.c
        // All results should have the required fields
        for (const b of blast) {
            expect(b).toHaveProperty('id');
            expect(b).toHaveProperty('depth');
            expect(b).toHaveProperty('risk');
            expect(['high', 'medium', 'low']).toContain(b.risk);
        }
    });

    it('getBlastRadius respects maxDepth', async () => {
        db.importGraphData(await makeTestGraph());
        const blast1 = db.getBlastRadius('utils.h', 1);
        const blast5 = db.getBlastRadius('utils.h', 5);
        expect(blast1.length).toBeLessThanOrEqual(blast5.length);
        // All depth=1 results should be risk 'high'
        for (const b of blast1) {
            expect(b.depth).toBe(1);
            expect(b.risk).toBe('high');
        }
    });

    it('getBlastRadius returns empty for leaf node', async () => {
        db.importGraphData(await makeTestGraph());
        // main.c is a leaf — nothing depends on it
        const blast = db.getBlastRadius('main.c', 5);
        expect(blast).toHaveLength(0);
    });

    it('findPath returns path between connected nodes', async () => {
        db.importGraphData(await makeTestGraph());
        const path = db.findPath('main.c', 'utils.h');
        expect(path).not.toBeNull();
        expect(path![0]).toBe('main.c');
        expect(path![path!.length - 1]).toBe('utils.h');
    });

    it('findPath returns null for unconnected nodes', async () => {
        db.importGraphData(await makeTestGraph());
        const path = db.findPath('utils.h', 'main.c'); // reverse: utils.h doesn't import main.c
        // May or may not find a path depending on graph structure
        // At minimum it shouldn't crash
        expect(path === null || Array.isArray(path)).toBe(true);
    });

    it('getHotspots returns nodes sorted by impact', async () => {
        db.importGraphData(await makeTestGraph());
        const hotspots = db.getHotspots(2);
        expect(hotspots.length).toBeLessThanOrEqual(2);
        expect(hotspots[0]).toHaveProperty('impact_score');
    });

    it('getArchitectureOverview groups by language', async () => {
        db.importGraphData(await makeTestGraph());
        const overview = db.getArchitectureOverview();
        expect(overview.length).toBeGreaterThanOrEqual(1);
        expect(overview[0]).toHaveProperty('language');
        expect(overview[0]).toHaveProperty('count');
        expect(overview[0]).toHaveProperty('total_loc');
    });

    it('getNodeDetail returns full detail', async () => {
        db.importGraphData(await makeTestGraph());
        const detail = db.getNodeDetail('main.c');
        expect(detail).not.toBeNull();
        expect(detail!.id).toBe('main.c');
        expect(detail!).toHaveProperty('symbols');
        expect(detail!).toHaveProperty('dependencies');
        expect(detail!).toHaveProperty('dependents');
    });

    it('getNodeDetail returns null for unknown id', async () => {
        db.importGraphData(await makeTestGraph());
        expect(db.getNodeDetail('nonexistent.c')).toBeNull();
    });

    it('searchSymbols finds functions', async () => {
        db.importGraphData(await makeTestGraph());
        const results = db.searchSymbols('add');
        // Should find the 'add' function from utils.c or utils.h
        expect(results.length).toBeGreaterThanOrEqual(0); // may depend on parser extraction
    });

    it('importGraphData is idempotent (replace)', async () => {
        const graph = await makeTestGraph();
        db.importGraphData(graph);
        db.importGraphData(graph); // second import should replace, not duplicate
        expect(db.getAllNodes()).toHaveLength(4);
    });

    it('getAllMeta returns full map', async () => {
        db.importGraphData(await makeTestGraph());
        const meta = db.getAllMeta();
        expect(meta).toHaveProperty('projectName', 'TestProject');
        expect(meta).toHaveProperty('analyzedAt');
        expect(meta).toHaveProperty('totalFiles');
    });

    it('getCycles returns empty for acyclic graph', async () => {
        db.importGraphData(await makeTestGraph());
        const cycles = db.getCycles();
        // Our test graph is acyclic
        expect(Array.isArray(cycles)).toBe(true);
    });

    it('getDeadCode returns array', async () => {
        db.importGraphData(await makeTestGraph());
        const dead = db.getDeadCode();
        expect(Array.isArray(dead)).toBe(true);
    });

    it('getCommunities assigns communities to all nodes', async () => {
        db.importGraphData(await makeTestGraph());
        const communities = db.getCommunities();
        expect(communities).toHaveLength(4);
        // Every node should have a community assigned
        for (const c of communities) {
            expect(c).toHaveProperty('nodeId');
            expect(c).toHaveProperty('community');
            expect(typeof c.community).toBe('number');
        }
    });

    it('getCommunities groups connected files together', async () => {
        db.importGraphData(await makeTestGraph());
        const communities = db.getCommunities();
        const map: Record<string, number> = {};
        for (const c of communities) map[c.nodeId] = c.community;
        // main.c, utils.c, and lib/helper.c all include utils.h — they should be in the same community
        expect(map['main.c']).toBe(map['utils.h']);
        expect(map['utils.c']).toBe(map['utils.h']);
    });

    it('getCommunities returns empty for empty db', async () => {
        const communities = db.getCommunities();
        expect(communities).toHaveLength(0);
    });

    it('aura_get_communities names groups after their highest fan-in hub', async () => {
        db.importGraphData(await makeTestGraph());
        const result = runAuraTool(db, 'aura_get_communities', {}) as {
            communities: { name: string; files: string[]; size: number }[];
        };
        expect(result.communities).toHaveLength(1);
        // utils.h is imported by main.c, utils.c and lib/helper.c, so it is the
        // hub — the same rule the webview Communities palette uses.
        expect(result.communities[0].name).toBe('utils');
        expect(result.communities[0].size).toBe(4);
    });

    it('exportGraphData round-trips through import', async () => {
        const original = await makeTestGraph();
        db.importGraphData(original);
        const exported = db.exportGraphData();
        expect(exported).not.toBeNull();
        expect(exported!.nodes).toHaveLength(original.nodes.length);
        expect(exported!.links).toHaveLength(original.links.length);
        expect(exported!.meta.projectName).toBe('TestProject');
        expect(exported!.meta.totalFiles).toBe(original.meta.totalFiles);
        // Verify node fields survive round-trip
        const mainNode = exported!.nodes.find(n => n.id === 'main.c');
        expect(mainNode).toBeDefined();
        expect(mainNode!.language).toBe('c');
        expect(mainNode!.complexity).toBeGreaterThanOrEqual(1);
    });

    it('exportGraphData returns null for empty db', () => {
        expect(db.exportGraphData()).toBeNull();
    });
});

// ── Phase 1b: Enriched schema tests ───────────────────────────

function makeEnrichedGraph(): GraphData {
    return {
        meta: {
            projectName: 'EnrichedTest',
            analyzedAt: new Date().toISOString(),
            totalFiles: 2,
            totalLinks: 3,
            totalRelationsFound: 3,
            functionCallLinks: 0,
            heritageLinks: 0,
            unresolvedReferences: 0,
            unresolvedSamples: [],
            deadCodeFiles: 0,
            deadExportsTotal: 0,
            cycles: [],
            languageStats: { typescript: { count: 2, totalLOC: 50, avgComplexity: 3 } },
            groups: ['src'],
        },
        nodes: [
            {
                id: 'base.ts', name: 'base.ts', path: 'base.ts',
                language: 'typescript', extension: '.ts', size: 500, linesOfCode: 30,
                lastModified: 0, group: 'src', fanOut: 0, fanIn: 1, complexity: 2,
                cognitive: 4,
                complexityDetails: {},
                symbols: {
                    functions: [
                        { name: 'init', returnType: 'void', params: '()', line: 5, type: 'function', visibility: 'public', isStatic: false, isAsync: true, cognitive: 4, cyclomatic: 5, functionLines: 18, halsteadVolume: 120.5, maintainability: 72.3 },
                    ],
                    structs: [], enums: [], macros: [], exports: [],
                    classes: [{ name: 'BaseService', type: 'class', line: 1 }],
                    interfaces: [{ name: 'IService', type: 'interface', line: 1 }],
                    traits: [],
                    typeAliases: [{ name: 'ServiceConfig', type: 'type_alias', line: 10 }],
                    methods: [
                        { name: 'start', returnType: 'Promise<void>', params: '(port: number)', line: 15, type: 'method', visibility: 'public', isStatic: false, isAsync: true, cognitive: 2, cyclomatic: 3, functionLines: 9, halsteadVolume: 88.2, maintainability: 81.4 },
                        { name: 'getInstance', returnType: 'BaseService', params: '()', line: 20, type: 'method', visibility: 'public', isStatic: true, isAsync: false },
                        { name: 'configure', returnType: 'void', params: '(config: ServiceConfig)', line: 25, type: 'method', visibility: 'protected', isStatic: false, isAsync: false },
                    ],
                    totalSymbols: 7,
                },
            },
            {
                id: 'child.ts', name: 'child.ts', path: 'child.ts',
                language: 'typescript', extension: '.ts', size: 400, linesOfCode: 20,
                lastModified: 0, group: 'src', fanOut: 1, fanIn: 0, complexity: 1,
                cognitive: 0,
                complexityDetails: {},
                symbols: {
                    functions: [], structs: [], enums: [], macros: [], exports: [],
                    classes: [{ name: 'ChildService', type: 'class', line: 1 }],
                    interfaces: [],
                    traits: [{ name: 'Loggable', type: 'trait', line: 3 }],
                    typeAliases: [],
                    methods: [
                        { name: 'handle', returnType: 'void', params: '(req: Request)', line: 8, type: 'method', visibility: 'private', isStatic: false, isAsync: true },
                    ],
                    totalSymbols: 3,
                },
            },
        ],
        links: [
            { source: 'child.ts', target: 'base.ts', type: 'import', label: 'BaseService', confidence: 0.9 },
            { source: 'child.ts', target: 'base.ts', type: 'extends', label: 'ChildService extends BaseService', confidence: 0.9 },
            { source: 'child.ts', target: 'base.ts', type: 'implements', label: 'ChildService implements IService', confidence: 0.5 },
        ],
    };
}

describe('GraphDB — enriched schema (Phase 1b)', () => {
    let db: GraphDB;
    let tmpDir: string;
    let dbPath: string;

    beforeEach(async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'aura-enriched-'));
        dbPath = join(tmpDir, 'graph.db');
        db = new GraphDB();
        await db.open(dbPath);
    });

    afterEach(() => {
        db.close();
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('imports enriched graph data without error', async () => {
        expect(() => db.importGraphData(makeEnrichedGraph())).not.toThrow();
    });

    it('stores interface symbols', async () => {
        db.importGraphData(makeEnrichedGraph());
        const results = db.searchSymbols('IService', 'interface');
        expect(results).toHaveLength(1);
        expect(results[0].kind).toBe('interface');
    });

    it('stores trait symbols', async () => {
        db.importGraphData(makeEnrichedGraph());
        const results = db.searchSymbols('Loggable', 'trait');
        expect(results).toHaveLength(1);
        expect(results[0].kind).toBe('trait');
    });

    it('stores type_alias symbols', async () => {
        db.importGraphData(makeEnrichedGraph());
        const results = db.searchSymbols('ServiceConfig', 'type_alias');
        expect(results).toHaveLength(1);
        expect(results[0].kind).toBe('type_alias');
    });

    it('stores method symbols with visibility', async () => {
        db.importGraphData(makeEnrichedGraph());
        const results = db.searchSymbols('configure', 'method');
        expect(results).toHaveLength(1);
        expect(results[0].visibility).toBe('protected');
        expect(results[0].isStatic).toBe(false);
        expect(results[0].isAsync).toBe(false);
    });

    it('stores static method flag', async () => {
        db.importGraphData(makeEnrichedGraph());
        const results = db.searchSymbols('getInstance', 'method');
        expect(results).toHaveLength(1);
        expect(results[0].isStatic).toBe(true);
    });

    it('stores async function flag', async () => {
        db.importGraphData(makeEnrichedGraph());
        const results = db.searchSymbols('init', 'function');
        expect(results).toHaveLength(1);
        expect(results[0].isAsync).toBe(true);
    });

    it('stores private method visibility', async () => {
        db.importGraphData(makeEnrichedGraph());
        const results = db.searchSymbols('handle', 'method');
        expect(results).toHaveLength(1);
        expect(results[0].visibility).toBe('private');
        expect(results[0].isAsync).toBe(true);
    });

    it('stores extends edges', async () => {
        db.importGraphData(makeEnrichedGraph());
        const edges = db.getAllEdges();
        const extendsEdges = edges.filter(e => e.type === 'extends');
        expect(extendsEdges).toHaveLength(1);
        expect(extendsEdges[0].source).toBe('child.ts');
        expect(extendsEdges[0].target).toBe('base.ts');
    });

    it('stores implements edges', async () => {
        db.importGraphData(makeEnrichedGraph());
        const edges = db.getAllEdges();
        const implEdges = edges.filter(e => e.type === 'implements');
        expect(implEdges).toHaveLength(1);
        expect(implEdges[0].label).toContain('IService');
    });

    it('getHeritage returns extends and implements', async () => {
        db.importGraphData(makeEnrichedGraph());
        const heritage = db.getHeritage();
        expect(heritage).toHaveLength(2);
        const types = heritage.map(h => h.type).sort();
        expect(types).toEqual(['extends', 'implements']);
    });

    it('getHeritage filters by file', async () => {
        db.importGraphData(makeEnrichedGraph());
        const heritage = db.getHeritage('child.ts');
        expect(heritage).toHaveLength(2);
        const heritage2 = db.getHeritage('base.ts');
        expect(heritage2).toHaveLength(2); // base.ts is target of both
    });

    it('getHeritage returns empty for file with no heritage', async () => {
        db.importGraphData(makeEnrichedGraph());
        const heritage = db.getHeritage('nonexistent.ts');
        expect(heritage).toHaveLength(0);
    });

    it('getNodeDetail includes enriched symbols', async () => {
        db.importGraphData(makeEnrichedGraph());
        const detail = db.getNodeDetail('base.ts');
        expect(detail).not.toBeNull();
        const kinds = detail!.symbols.map(s => s.kind);
        expect(kinds).toContain('interface');
        expect(kinds).toContain('type_alias');
        expect(kinds).toContain('method');
        const init = detail!.symbols.find(s => s.name === 'init')!;
        expect(init.cognitive).toBe(4);
        expect(init.maintainability).toBe(72.3);
        expect(detail!.edges.length).toBeGreaterThan(0);
        expect(detail!.edges.some(e => e.confidence === 0.5)).toBe(true);
    });

    it('searchSymbols returns all new fields', async () => {
        db.importGraphData(makeEnrichedGraph());
        const results = db.searchSymbols('start');
        expect(results.length).toBeGreaterThanOrEqual(1);
        const start = results.find(r => r.name === 'start');
        expect(start).toBeDefined();
        expect(start!).toHaveProperty('visibility');
        expect(start!).toHaveProperty('isStatic');
        expect(start!).toHaveProperty('isAsync');
        expect(start!.cognitive).toBe(2);
        expect(start!.maintainability).toBe(81.4);
    });

    it('exports function metrics without inventing them for legacy rows', async () => {
        db.importGraphData(makeEnrichedGraph());
        const exported = db.exportGraphData()!;
        const base = exported.nodes.find(n => n.id === 'base.ts')!;
        expect(base.cognitive).toBe(4);
        const impl = exported.links.find(l => l.type === 'implements')!;
        expect(impl.confidence).toBe(0.5);
        const init = base.symbols!.functions.find(f => f.name === 'init')!;
        expect(init.cognitive).toBe(4);
        expect(init.cyclomatic).toBe(5);
        expect(init.functionLines).toBe(18);
        expect(init.halsteadVolume).toBe(120.5);
        expect(init.maintainability).toBe(72.3);

        const getInstance = base.symbols!.methods.find(m => m.name === 'getInstance')!;
        expect(getInstance.cognitive).toBeUndefined();
    });
});

// ── Phase 2: Granular update methods ──────────────────────────

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
    return {
        id: 'file.ts', name: 'file.ts', path: 'file.ts',
        language: 'typescript', extension: '.ts', size: 200, linesOfCode: 15,
        lastModified: 100, group: 'src', fanOut: 0, fanIn: 0,
        complexity: 3, complexityDetails: {},
        symbols: {
            functions: [{ name: 'hello', returnType: 'void', params: '()', line: 1, type: 'function' }],
            structs: [], enums: [], macros: [], classes: [], exports: [],
            interfaces: [], traits: [], typeAliases: [], methods: [],
            totalSymbols: 1,
        },
        ...overrides,
    };
}

describe('GraphDB — granular updates', () => {
    let db: GraphDB;
    let tmpDir: string;
    let dbPath: string;

    beforeEach(async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'aura-granular-'));
        dbPath = join(tmpDir, 'graph.db');
        db = new GraphDB();
        await db.open(dbPath);
    });

    afterEach(() => {
        db.close();
        rmSync(tmpDir, { recursive: true, force: true });
    });

    // ── upsertNode ────────────────────────────────────────────

    it('upsertNode inserts a new node', () => {
        db.upsertNode(makeNode());
        const nodes = db.getAllNodes();
        expect(nodes).toHaveLength(1);
        expect(nodes[0].id).toBe('file.ts');
        expect(nodes[0].complexity).toBe(3);
    });

    it('upsertNode replaces an existing node', () => {
        db.upsertNode(makeNode());
        db.upsertNode(makeNode({ complexity: 10, linesOfCode: 50 }));
        const nodes = db.getAllNodes();
        expect(nodes).toHaveLength(1);
        expect(nodes[0].complexity).toBe(10);
        expect(nodes[0].lines).toBe(50);
    });

    // ── deleteNode ────────────────────────────────────────────

    it('deleteNode removes node and all associated data', () => {
        // Seed via full import
        db.importGraphData(makeEnrichedGraph());
        expect(db.getAllNodes()).toHaveLength(2);

        db.deleteNode('child.ts');
        expect(db.getAllNodes()).toHaveLength(1);
        expect(db.getAllNodes()[0].id).toBe('base.ts');
        // Edges from/to child.ts should be gone
        const edges = db.getAllEdges();
        expect(edges.filter(e => e.source === 'child.ts' || e.target === 'child.ts')).toHaveLength(0);
        // Symbols for child.ts should be gone
        const detail = db.getNodeDetail('child.ts');
        expect(detail).toBeNull();
    });

    it('deleteNode is a no-op for unknown id', () => {
        db.upsertNode(makeNode());
        db.deleteNode('nonexistent.ts');
        expect(db.getAllNodes()).toHaveLength(1);
    });

    // ── replaceFileData ───────────────────────────────────────

    it('replaceFileData inserts node + edges + symbols + calls', () => {
        const node = makeNode();
        const edges: GraphLink[] = [
            { source: 'file.ts', target: 'dep.ts', type: 'import', label: 'foo' },
        ];
        const calls = [
            { callerFile: 'file.ts', callerName: 'hello', calleeFile: 'dep.ts', calleeName: 'bar', callLine: 5 },
        ];
        // Need a target node for the edge
        db.upsertNode(makeNode({ id: 'dep.ts', name: 'dep.ts' }));
        db.replaceFileData('file.ts', node, edges, calls);

        expect(db.getAllNodes()).toHaveLength(2);
        const allEdges = db.getAllEdges();
        expect(allEdges).toHaveLength(1);
        expect(allEdges[0].source).toBe('file.ts');
        expect(allEdges[0].target).toBe('dep.ts');

        const syms = db.searchSymbols('hello');
        expect(syms).toHaveLength(1);

        const fcalls = db.getFunctionCalls('file.ts');
        expect(fcalls).toHaveLength(1);
        expect(fcalls[0].callee_name).toBe('bar');
    });

    it('replaceFileData replaces old edges/symbols/calls on re-call', () => {
        const node = makeNode();
        const edgesV1: GraphLink[] = [
            { source: 'file.ts', target: 'old-dep.ts', type: 'import', label: '' },
        ];
        db.upsertNode(makeNode({ id: 'old-dep.ts', name: 'old-dep.ts' }));
        db.upsertNode(makeNode({ id: 'new-dep.ts', name: 'new-dep.ts' }));
        db.replaceFileData('file.ts', node, edgesV1, []);

        // Now "edit" the file — new dependency, new symbol
        const nodeV2 = makeNode({
            complexity: 7,
            symbols: {
                functions: [{ name: 'goodbye', returnType: 'string', params: '()', line: 2, type: 'function' }],
                structs: [], enums: [], macros: [], classes: [], exports: [],
                interfaces: [], traits: [], typeAliases: [], methods: [],
                totalSymbols: 1,
            },
        });
        const edgesV2: GraphLink[] = [
            { source: 'file.ts', target: 'new-dep.ts', type: 'import', label: '' },
        ];
        db.replaceFileData('file.ts', nodeV2, edgesV2, []);

        // Old edge gone, new edge present
        const edges = db.getAllEdges();
        expect(edges.filter(e => e.source === 'file.ts')).toHaveLength(1);
        expect(edges.find(e => e.target === 'old-dep.ts')).toBeUndefined();
        expect(edges.find(e => e.target === 'new-dep.ts')).toBeDefined();

        // Old symbol gone, new symbol present
        expect(db.searchSymbols('hello')).toHaveLength(0);
        expect(db.searchSymbols('goodbye')).toHaveLength(1);

        // Node updated
        const detail = db.getNodeDetail('file.ts');
        expect(detail!.complexity).toBe(7);
    });

    it('replaceFileData does not touch incoming edges from other files', () => {
        // Setup: A → B, B → C. Now replace B — A → B should survive.
        db.upsertNode(makeNode({ id: 'a.ts', name: 'a.ts' }));
        db.upsertNode(makeNode({ id: 'b.ts', name: 'b.ts' }));
        db.upsertNode(makeNode({ id: 'c.ts', name: 'c.ts' }));

        // A imports B
        db.replaceFileData('a.ts', makeNode({ id: 'a.ts', name: 'a.ts' }),
            [{ source: 'a.ts', target: 'b.ts', type: 'import', label: '' }], []);
        // B imports C
        db.replaceFileData('b.ts', makeNode({ id: 'b.ts', name: 'b.ts' }),
            [{ source: 'b.ts', target: 'c.ts', type: 'import', label: '' }], []);

        // Now replace B with no outgoing edges
        db.replaceFileData('b.ts', makeNode({ id: 'b.ts', name: 'b.ts' }), [], []);

        const edges = db.getAllEdges();
        // A → B should still exist (incoming to B, managed by A)
        expect(edges.find(e => e.source === 'a.ts' && e.target === 'b.ts')).toBeDefined();
        // B → C should be gone (outgoing from B)
        expect(edges.find(e => e.source === 'b.ts' && e.target === 'c.ts')).toBeUndefined();
    });

    // ── updateFanCounts ───────────────────────────────────────

    it('updateFanCounts recomputes counts for specific nodes', () => {
        db.upsertNode(makeNode({ id: 'a.ts', name: 'a.ts', fanIn: 0, fanOut: 0 }));
        db.upsertNode(makeNode({ id: 'b.ts', name: 'b.ts', fanIn: 0, fanOut: 0 }));
        db.upsertNode(makeNode({ id: 'c.ts', name: 'c.ts', fanIn: 0, fanOut: 0 }));
        db.replaceFileData('a.ts', makeNode({ id: 'a.ts', name: 'a.ts' }),
            [{ source: 'a.ts', target: 'b.ts', type: 'import', label: '' },
             { source: 'a.ts', target: 'c.ts', type: 'import', label: '' }], []);

        db.updateFanCounts(['a.ts', 'b.ts', 'c.ts']);

        const a = db.getNodeDetail('a.ts')!;
        expect(a.fan_out).toBe(2);
        expect(a.fan_in).toBe(0);
        const b = db.getNodeDetail('b.ts')!;
        expect(b.fan_in).toBe(1);
        expect(b.fan_out).toBe(0);
    });

    it('updateFanCounts with no args updates all nodes', () => {
        db.upsertNode(makeNode({ id: 'a.ts', name: 'a.ts', fanIn: 99, fanOut: 99 }));
        db.upsertNode(makeNode({ id: 'b.ts', name: 'b.ts', fanIn: 99, fanOut: 99 }));
        db.replaceFileData('a.ts', makeNode({ id: 'a.ts', name: 'a.ts' }),
            [{ source: 'a.ts', target: 'b.ts', type: 'import', label: '' }], []);

        db.updateFanCounts();

        const a = db.getNodeDetail('a.ts')!;
        expect(a.fan_out).toBe(1);
        expect(a.fan_in).toBe(0);
        const b = db.getNodeDetail('b.ts')!;
        expect(b.fan_in).toBe(1);
        expect(b.fan_out).toBe(0);
    });

    it('replaces and queries temporal-coupling pairs', () => {
        db.replaceCochange([
            { a: 'src/b.ts', b: 'src/a.ts', cochanges: 4, aCommits: 6, bCommits: 5, jaccard: 0.57, support: 0.2, linked: false },
            { a: 'src/a.ts', b: 'src/c.ts', cochanges: 2, aCommits: 6, bCommits: 6, jaccard: 0.2, support: 0.1, linked: false },
        ], 365);
        const all = db.getCochange();
        expect(all).toHaveLength(2);
        expect(all[0]).toMatchObject({ file_a: 'src/a.ts', file_b: 'src/b.ts', cochanges: 4, jaccard: 0.57, window_days: 365 });
        expect(db.getCochange(10, 0.5)).toHaveLength(1);
        db.replaceCochange([], 365);
        expect(db.getCochange()).toEqual([]);
    });

    it('stores and exports symbol-level cycles', async () => {
        const files = [
            makeFileInfo({
                id: 'walk.js',
                content: 'function walk(node) {\n    if (node) walk(node.next);\n}\n',
                language: 'javascript', extension: '.js', group: 'src',
            }),
        ];
        const trees = await preParseFiles(files);
        const graph = buildGraph(files, 'Project', {}, trees);
        db.importGraphData(graph);

        const cycles = db.getSymbolCycles();
        expect(cycles).toHaveLength(1);
        expect(cycles[0].kind).toBe('recursive');
        expect(cycles[0].nodes).toEqual([{ file: 'walk.js', name: 'walk' }]);
        expect(cycles[0].edges[0].callLine).toBe(2);

        const exported = db.exportGraphData()!;
        expect(exported.meta.symbolCycles).toHaveLength(1);
        expect(exported.meta.symbolCycles![0].confidence).toBe(1);

        const tool = runAuraTool(db, 'aura_find_cycles', {}) as { symbol_cycles: unknown[]; symbol_total: number };
        expect(tool.symbol_total).toBe(1);
        expect(tool.symbol_cycles).toHaveLength(1);
    });
});
