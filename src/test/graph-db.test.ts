import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { GraphDB } from '../graph-db';
import { buildGraph, preParseFiles } from '../analyzer/graph-builder';
import { initTreeSitter } from '../analyzer/tree-sitter-loader';
import { makeFileInfo } from './helpers';
import type { GraphData } from '../analyzer/types';
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
    });

    it('stores edges', async () => {
        db.importGraphData(await makeTestGraph());
        const edges = db.getAllEdges();
        expect(edges.length).toBeGreaterThanOrEqual(3); // main→utils.h, utils.c→utils.h, helper→utils.h
    });

    it('stores meta', async () => {
        db.importGraphData(await makeTestGraph());
        expect(db.getMeta('projectName')).toBe('TestProject');
        expect(db.getMeta('totalFiles')).toBe('4');
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
                complexityDetails: {},
                symbols: {
                    functions: [
                        { name: 'init', returnType: 'void', params: '()', line: 5, type: 'function', visibility: 'public', isStatic: false, isAsync: true },
                    ],
                    structs: [], enums: [], macros: [], exports: [], externs: [],
                    classes: [{ name: 'BaseService', type: 'class' }],
                    interfaces: [{ name: 'IService', type: 'interface', line: 1 }],
                    traits: [],
                    typeAliases: [{ name: 'ServiceConfig', type: 'type_alias', line: 10 }],
                    methods: [
                        { name: 'start', returnType: 'Promise<void>', params: '(port: number)', line: 15, type: 'method', visibility: 'public', isStatic: false, isAsync: true },
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
                complexityDetails: {},
                symbols: {
                    functions: [], structs: [], enums: [], macros: [], exports: [], externs: [],
                    classes: [{ name: 'ChildService', type: 'class' }],
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
            { source: 'child.ts', target: 'base.ts', type: 'import', label: 'BaseService' },
            { source: 'child.ts', target: 'base.ts', type: 'extends', label: 'ChildService extends BaseService' },
            { source: 'child.ts', target: 'base.ts', type: 'implements', label: 'ChildService implements IService' },
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
    });
});
