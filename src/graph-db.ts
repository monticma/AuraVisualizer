/**
 * graph-db.ts — SQLite persistence layer for the Aura graph.
 *
 * Uses sql.js (WASM-based SQLite) to avoid native binding issues with Electron.
 * Stores nodes, edges, symbols, and cycles in `.aura/graph.db`.
 * Provides recursive CTE queries for transitive dependencies,
 * shortest paths, hotspots, dead code, etc.
 */

import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import type { GraphData, GraphNode } from './analyzer/types';

// ── Row types returned by queries ──────────────────────────────

export interface NodeRow {
    id: string;
    name: string;
    language: string;
    extension: string;
    group_name: string;
    size: number;
    lines: number;
    complexity: number;
    fan_in: number;
    fan_out: number;
    last_modified: number;
}

export interface EdgeRow {
    source: string;
    target: string;
    type: string;
    label: string;
}

export interface SymbolRow {
    node_id: string;
    name: string;
    kind: string;
    return_type: string;
    params: string;
    line: number;
    is_dead: number;
    visibility: string;
    is_static: number;
    is_async: number;
}

export interface DepRow {
    id: string;
    depth: number;
}

export interface BlastRadiusRow {
    id: string;
    depth: number;
    risk: 'high' | 'medium' | 'low';
}

export interface HotspotRow extends NodeRow {
    impact_score: number;
}

export interface OverviewRow {
    language: string;
    count: number;
    total_loc: number;
    avg_complexity: number;
}

// ── Schema ─────────────────────────────────────────────────────

const SCHEMA = `
CREATE TABLE IF NOT EXISTS nodes (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    language      TEXT NOT NULL,
    extension     TEXT NOT NULL,
    group_name    TEXT NOT NULL,
    size          INTEGER NOT NULL,
    lines         INTEGER NOT NULL,
    complexity    INTEGER NOT NULL,
    fan_in        INTEGER NOT NULL DEFAULT 0,
    fan_out       INTEGER NOT NULL DEFAULT 0,
    last_modified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS edges (
    source  TEXT NOT NULL,
    target  TEXT NOT NULL,
    type    TEXT NOT NULL,
    label   TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (source, target, type)
);

CREATE TABLE IF NOT EXISTS symbols (
    node_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    kind        TEXT NOT NULL,
    return_type TEXT DEFAULT '',
    params      TEXT DEFAULT '',
    line        INTEGER DEFAULT 0,
    is_dead     INTEGER DEFAULT 0,
    visibility  TEXT DEFAULT 'public',
    is_static   INTEGER DEFAULT 0,
    is_async    INTEGER DEFAULT 0,
    PRIMARY KEY (node_id, name, kind)
);

CREATE TABLE IF NOT EXISTS cycles (
    cycle_id  INTEGER NOT NULL,
    node_id   TEXT NOT NULL,
    position  INTEGER NOT NULL,
    PRIMARY KEY (cycle_id, position)
);

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target);
CREATE INDEX IF NOT EXISTS idx_symbols_node ON symbols(node_id);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_nodes_language ON nodes(language);
CREATE INDEX IF NOT EXISTS idx_nodes_group ON nodes(group_name);
`;

// ── Helpers ────────────────────────────────────────────────────

/** Run a SELECT and return all rows as typed objects. */
function queryAll<T>(db: SqlJsDatabase, sql: string, params: unknown[] = []): T[] {
    const stmt = db.prepare(sql);
    stmt.bind(params as (string | number | null | Uint8Array)[]);
    const rows: T[] = [];
    while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return rows;
}

/** Run a SELECT and return first row or undefined. */
function queryOne<T>(db: SqlJsDatabase, sql: string, params: unknown[] = []): T | undefined {
    const stmt = db.prepare(sql);
    stmt.bind(params as (string | number | null | Uint8Array)[]);
    let result: T | undefined;
    if (stmt.step()) {
        result = stmt.getAsObject() as T;
    }
    stmt.free();
    return result;
}

// ── Class ──────────────────────────────────────────────────────

export class GraphDB {
    private db: SqlJsDatabase | null = null;
    private dbPath: string = '';

    // ── Lifecycle ──────────────────────────────────────────────

    async open(dbPath: string): Promise<void> {
        // In production (bundled), sql-wasm.wasm sits next to extension.js in out/
        // In tests (vitest), fall back to node_modules location
        let wasmPath = join(__dirname, 'sql-wasm.wasm');
        if (!existsSync(wasmPath)) {
            wasmPath = join(dirname(require.resolve('sql.js')), 'sql-wasm.wasm');
        }
        const SQL = await initSqlJs({
            locateFile: () => wasmPath,
        });

        this.dbPath = dbPath;

        if (existsSync(dbPath)) {
            const fileBuffer = readFileSync(dbPath);
            this.db = new SQL.Database(fileBuffer);
        } else {
            this.db = new SQL.Database();
        }

        this.db.run(SCHEMA);
        this.migrateSchema();
    }

    /** Open synchronously from an already-initialized SQL module. For MCP server use. */
    openSync(SQL: { Database: new (data?: ArrayLike<number>) => SqlJsDatabase }, dbPath: string): void {
        this.dbPath = dbPath;
        if (existsSync(dbPath)) {
            const fileBuffer = readFileSync(dbPath);
            this.db = new SQL.Database(fileBuffer);
        } else {
            this.db = new SQL.Database();
        }
        this.db.run(SCHEMA);
        this.migrateSchema();
    }

    close(): void {
        this.db?.close();
        this.db = null;
    }

    get isOpen(): boolean {
        return this.db !== null;
    }

    /** Write current DB state to disk. */
    save(): void {
        if (!this.db || !this.dbPath) return;
        const data = this.db.export();
        writeFileSync(this.dbPath, Buffer.from(data));
    }

    // ── Import (full replace after each analysis) ──────────────

    importGraphData(data: GraphData): void {
        const db = this.ensureDb();

        db.run('BEGIN TRANSACTION');

        try {
            // Clear existing data
            db.run('DELETE FROM symbols');
            db.run('DELETE FROM edges');
            db.run('DELETE FROM cycles');
            db.run('DELETE FROM nodes');
            db.run('DELETE FROM meta');

            // Insert nodes
            for (const n of data.nodes) {
                db.run(
                    'INSERT INTO nodes (id, name, language, extension, group_name, size, lines, complexity, fan_in, fan_out, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [n.id, n.name, n.language, n.extension, n.group, n.size, n.linesOfCode, n.complexity, n.fanIn, n.fanOut, n.lastModified]
                );
            }

            // Insert edges
            for (const e of data.links) {
                const src = typeof e.source === 'object' ? (e.source as unknown as GraphNode).id : e.source;
                const tgt = typeof e.target === 'object' ? (e.target as unknown as GraphNode).id : e.target;
                db.run(
                    'INSERT OR IGNORE INTO edges (source, target, type, label) VALUES (?, ?, ?, ?)',
                    [src, tgt, e.type, e.label || '']
                );
            }

            // Insert symbols
            const insertSymbol = 'INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead, visibility, is_static, is_async) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
            for (const n of data.nodes) {
                if (!n.symbols) continue;
                const deadSet = new Set(n.deadExports || []);
                for (const fn of n.symbols.functions) {
                    db.run(insertSymbol,
                        [n.id, fn.name, fn.type || 'function', fn.returnType || '', fn.params || '', fn.line || 0, deadSet.has(fn.name) ? 1 : 0, fn.visibility || 'public', fn.isStatic ? 1 : 0, fn.isAsync ? 1 : 0]);
                }
                for (const m of n.symbols.methods || []) {
                    db.run(insertSymbol,
                        [n.id, m.name, m.type || 'method', m.returnType || '', m.params || '', m.line || 0, deadSet.has(m.name) ? 1 : 0, m.visibility || 'public', m.isStatic ? 1 : 0, m.isAsync ? 1 : 0]);
                }
                for (const s of n.symbols.structs)  db.run(insertSymbol, [n.id, s.name, s.type || 'struct', '', '', 0, 0, 'public', 0, 0]);
                for (const e of n.symbols.enums)    db.run(insertSymbol, [n.id, e.name, e.type || 'enum', '', '', 0, 0, 'public', 0, 0]);
                for (const m of n.symbols.macros)   db.run(insertSymbol, [n.id, m.name, m.type || 'macro', '', '', 0, 0, 'public', 0, 0]);
                for (const c of n.symbols.classes)  db.run(insertSymbol, [n.id, c.name, c.type || 'class', '', '', 0, deadSet.has(c.name) ? 1 : 0, 'public', 0, 0]);
                for (const ex of n.symbols.exports) db.run(insertSymbol, [n.id, ex.name, ex.type || 'export', '', '', 0, deadSet.has(ex.name) ? 1 : 0, 'public', 0, 0]);
                for (const i of n.symbols.interfaces || [])  db.run(insertSymbol, [n.id, i.name, i.type || 'interface', '', '', i.line || 0, 0, i.visibility || 'public', 0, 0]);
                for (const t of n.symbols.traits || [])      db.run(insertSymbol, [n.id, t.name, t.type || 'trait', '', '', t.line || 0, 0, t.visibility || 'public', 0, 0]);
                for (const ta of n.symbols.typeAliases || []) db.run(insertSymbol, [n.id, ta.name, ta.type || 'type_alias', '', '', ta.line || 0, 0, ta.visibility || 'public', 0, 0]);
            }

            // Insert cycles
            if (data.meta.cycles) {
                for (let ci = 0; ci < data.meta.cycles.length; ci++) {
                    const cycle = data.meta.cycles[ci];
                    for (let pos = 0; pos < cycle.length; pos++) {
                        db.run('INSERT INTO cycles (cycle_id, node_id, position) VALUES (?, ?, ?)', [ci, cycle[pos], pos]);
                    }
                }
            }

            // Insert meta
            const metaEntries: [string, string][] = [
                ['projectName', data.meta.projectName],
                ['analyzedAt', data.meta.analyzedAt],
                ['totalFiles', String(data.meta.totalFiles)],
                ['totalLinks', String(data.meta.totalLinks)],
                ['totalRelationsFound', String(data.meta.totalRelationsFound)],
                ['functionCallLinks', String(data.meta.functionCallLinks)],
                ['unresolvedReferences', String(data.meta.unresolvedReferences)],
                ['deadCodeFiles', String(data.meta.deadCodeFiles)],
                ['deadExportsTotal', String(data.meta.deadExportsTotal)],
                ['languageStats', JSON.stringify(data.meta.languageStats)],
                ['groups', JSON.stringify(data.meta.groups)],
            ];
            for (const [key, value] of metaEntries) {
                db.run('INSERT INTO meta (key, value) VALUES (?, ?)', [key, value]);
            }

            db.run('COMMIT');
        } catch (err) {
            db.run('ROLLBACK');
            throw err;
        }

        // Persist to disk
        this.save();
    }

    // ── Queries ────────────────────────────────────────────────

    /** Transitive dependencies of a file (what it depends on). */
    getDependencies(fileId: string, maxDepth: number = 5): DepRow[] {
        return queryAll<DepRow>(this.ensureDb(), `
            WITH RECURSIVE deps(id, depth) AS (
                SELECT target, 1 FROM edges WHERE source = ?
                UNION
                SELECT e.target, d.depth + 1
                FROM edges e JOIN deps d ON e.source = d.id
                WHERE d.depth < ?
            )
            SELECT id, MIN(depth) AS depth FROM deps GROUP BY id ORDER BY depth
        `, [fileId, maxDepth]);
    }

    /** Transitive dependents of a file (what depends on it — impact analysis). */
    getDependents(fileId: string, maxDepth: number = 5): DepRow[] {
        return queryAll<DepRow>(this.ensureDb(), `
            WITH RECURSIVE deps(id, depth) AS (
                SELECT source, 1 FROM edges WHERE target = ?
                UNION
                SELECT e.source, d.depth + 1
                FROM edges e JOIN deps d ON e.target = d.id
                WHERE d.depth < ?
            )
            SELECT id, MIN(depth) AS depth FROM deps GROUP BY id ORDER BY depth
        `, [fileId, maxDepth]);
    }

    /** Blast radius — directional dependents with risk level. */
    getBlastRadius(fileId: string, maxDepth: number = 5): BlastRadiusRow[] {
        const deps = this.getDependents(fileId, maxDepth);
        return deps.map(d => ({
            ...d,
            risk: (d.depth === 1 ? 'high' : d.depth === 2 ? 'medium' : 'low') as BlastRadiusRow['risk'],
        }));
    }

    /** Shortest path between two files. Returns null if no path exists. */
    findPath(from: string, to: string, maxDepth: number = 20): string[] | null {
        const rows = queryAll<{ route: string }>(this.ensureDb(), `
            WITH RECURSIVE path(id, route, depth) AS (
                SELECT ?, ?, 0
                UNION
                SELECT e.target, p.route || '|' || e.target, p.depth + 1
                FROM edges e JOIN path p ON e.source = p.id
                WHERE p.depth < ? AND INSTR(p.route, e.target) = 0
            )
            SELECT route FROM path WHERE id = ? ORDER BY depth LIMIT 1
        `, [from, from, maxDepth, to]);

        if (rows.length === 0) return null;
        return rows[0].route.split('|');
    }

    /** Top N hotspots sorted by impact score (complexity × fan_in). */
    getHotspots(limit: number = 20, sortBy: string = 'impact'): HotspotRow[] {
        const orderClause = sortBy === 'complexity' ? 'complexity DESC'
            : sortBy === 'fan_in' ? 'fan_in DESC'
            : sortBy === 'lines' ? 'lines DESC'
            : '(complexity * (fan_in + 1)) DESC';

        return queryAll<HotspotRow>(this.ensureDb(),
            `SELECT *, (complexity * (fan_in + 1)) AS impact_score FROM nodes ORDER BY ${orderClause} LIMIT ?`,
            [limit]
        );
    }

    /** All dead code (uncalled exports). */
    getDeadCode(): { nodeId: string; symbol: string; kind: string }[] {
        return queryAll<{ nodeId: string; symbol: string; kind: string }>(this.ensureDb(),
            'SELECT node_id AS nodeId, name AS symbol, kind FROM symbols WHERE is_dead = 1 ORDER BY node_id'
        );
    }

    /** All cycles. */
    getCycles(): string[][] {
        const rows = queryAll<{ cycle_id: number; node_id: string }>(this.ensureDb(),
            'SELECT cycle_id, node_id FROM cycles ORDER BY cycle_id, position'
        );
        const cycles: string[][] = [];
        let current: string[] = [];
        let currentId = -1;
        for (const row of rows) {
            if (row.cycle_id !== currentId) {
                if (current.length > 0) cycles.push(current);
                current = [];
                currentId = row.cycle_id;
            }
            current.push(row.node_id);
        }
        if (current.length > 0) cycles.push(current);
        return cycles;
    }

    /** Full detail for a single node. */
    getNodeDetail(fileId: string): (NodeRow & { symbols: SymbolRow[]; dependencies: string[]; dependents: string[] }) | null {
        const db = this.ensureDb();
        const node = queryOne<NodeRow>(db, 'SELECT * FROM nodes WHERE id = ?', [fileId]);
        if (!node) return null;

        const symbols = queryAll<SymbolRow>(db, 'SELECT * FROM symbols WHERE node_id = ?', [fileId]);
        const deps = queryAll<{ target: string }>(db, 'SELECT target FROM edges WHERE source = ?', [fileId]);
        const revDeps = queryAll<{ source: string }>(db, 'SELECT source FROM edges WHERE target = ?', [fileId]);

        return {
            ...node,
            symbols,
            dependencies: deps.map(d => d.target),
            dependents: revDeps.map(d => d.source),
        };
    }

    /** Architecture overview by language. */
    getArchitectureOverview(): OverviewRow[] {
        return queryAll<OverviewRow>(this.ensureDb(), `
            SELECT language,
                   COUNT(*) AS count,
                   SUM(lines) AS total_loc,
                   ROUND(AVG(complexity), 1) AS avg_complexity
            FROM nodes GROUP BY language ORDER BY count DESC
        `);
    }

    /** Search symbols by name (LIKE match). */
    searchSymbols(query: string, kind?: string): { nodeId: string; name: string; kind: string; line: number; visibility: string; isStatic: boolean; isAsync: boolean }[] {
        const db = this.ensureDb();
        const sql = 'SELECT node_id AS nodeId, name, kind, line, visibility, is_static AS isStatic, is_async AS isAsync FROM symbols WHERE name LIKE ?' +
            (kind ? ' AND kind = ?' : '') + ' ORDER BY name LIMIT 100';
        const params = kind ? [`%${query}%`, kind] : [`%${query}%`];
        const rows = queryAll<{ nodeId: string; name: string; kind: string; line: number; visibility: string; isStatic: number; isAsync: number }>(db, sql, params);
        return rows.map(r => ({ ...r, isStatic: !!r.isStatic, isAsync: !!r.isAsync, visibility: r.visibility || 'public' }));
    }

    /** Get heritage edges (extends, implements). */
    getHeritage(fileId?: string): EdgeRow[] {
        const db = this.ensureDb();
        if (fileId) {
            return queryAll<EdgeRow>(db,
                "SELECT * FROM edges WHERE type IN ('extends', 'implements') AND (source = ? OR target = ?) ORDER BY source, type",
                [fileId, fileId]
            );
        }
        return queryAll<EdgeRow>(db,
            "SELECT * FROM edges WHERE type IN ('extends', 'implements') ORDER BY source, type"
        );
    }

    /** Get all nodes. */
    getAllNodes(): NodeRow[] {
        return queryAll<NodeRow>(this.ensureDb(), 'SELECT * FROM nodes ORDER BY id');
    }

    /** Get all edges. */
    getAllEdges(): EdgeRow[] {
        return queryAll<EdgeRow>(this.ensureDb(), 'SELECT * FROM edges ORDER BY source, target');
    }

    /**
     * Community detection using Louvain algorithm.
     * Returns nodeId → communityId mapping.
     */
    getCommunities(): { nodeId: string; community: number }[] {
        const db = this.ensureDb();
        const nodes = queryAll<{ id: string }>(db, 'SELECT id FROM nodes');
        const edges = queryAll<{ source: string; target: string }>(db, 'SELECT source, target FROM edges');

        if (nodes.length === 0) return [];

        // Build adjacency with weights (undirected, multiple edge types count as 1)
        const nodeIndex = new Map<string, number>();
        nodes.forEach((n, i) => nodeIndex.set(n.id, i));
        const n = nodes.length;

        // Adjacency list: neighbor → weight
        const adj: Map<number, number>[] = Array.from({ length: n }, () => new Map());
        let totalWeight = 0;

        for (const e of edges) {
            const si = nodeIndex.get(e.source);
            const ti = nodeIndex.get(e.target);
            if (si === undefined || ti === undefined || si === ti) continue;
            adj[si].set(ti, (adj[si].get(ti) || 0) + 1);
            adj[ti].set(si, (adj[ti].get(si) || 0) + 1);
            totalWeight += 1;
        }

        if (totalWeight === 0) {
            return nodes.map((nd, i) => ({ nodeId: nd.id, community: i }));
        }

        const m2 = totalWeight * 2; // sum of all weights (undirected counted once)
        // degree of each node (sum of edge weights)
        const deg = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            let d = 0;
            for (const w of adj[i].values()) d += w;
            deg[i] = d;
        }

        // Initial: each node in its own community
        const community = new Int32Array(n);
        for (let i = 0; i < n; i++) community[i] = i;

        // Louvain phase 1: local moves
        let improved = true;
        let iterations = 0;
        while (improved && iterations < 20) {
            improved = false;
            iterations++;
            for (let i = 0; i < n; i++) {
                const ci = community[i];
                // Sum of weights to each neighboring community
                const commWeights = new Map<number, number>();
                for (const [j, w] of adj[i]) {
                    const cj = community[j];
                    commWeights.set(cj, (commWeights.get(cj) || 0) + w);
                }

                // Sum of degrees in each community
                const commDeg = new Map<number, number>();
                for (let j = 0; j < n; j++) {
                    if (j === i) continue;
                    const cj = community[j];
                    if (commWeights.has(cj) || cj === ci) {
                        commDeg.set(cj, (commDeg.get(cj) || 0) + deg[j]);
                    }
                }

                // Try removing i from ci and adding to best community
                const ki = deg[i];
                const wIn = commWeights.get(ci) || 0;
                const sumCi = commDeg.get(ci) || 0;
                const removeCost = wIn / totalWeight - (ki * sumCi) / (m2 * m2) * 2;

                let bestGain = 0;
                let bestComm = ci;
                for (const [cj, wj] of commWeights) {
                    if (cj === ci) continue;
                    const sumCj = commDeg.get(cj) || 0;
                    const gain = wj / totalWeight - (ki * sumCj) / (m2 * m2) * 2 - removeCost;
                    if (gain > bestGain) {
                        bestGain = gain;
                        bestComm = cj;
                    }
                }

                if (bestComm !== ci) {
                    community[i] = bestComm;
                    improved = true;
                }
            }
        }

        // Renumber communities to 0..k-1
        const idMap = new Map<number, number>();
        let nextId = 0;
        const result: { nodeId: string; community: number }[] = [];
        for (let i = 0; i < n; i++) {
            let cid = community[i];
            if (!idMap.has(cid)) idMap.set(cid, nextId++);
            result.push({ nodeId: nodes[i].id, community: idMap.get(cid)! });
        }

        return result;
    }

    /** Get meta value by key. */
    getMeta(key: string): string | null {
        const row = queryOne<{ value: string }>(this.ensureDb(), 'SELECT value FROM meta WHERE key = ?', [key]);
        return row?.value ?? null;
    }

    /** Get all meta as a map. */
    getAllMeta(): Record<string, string> {
        const rows = queryAll<{ key: string; value: string }>(this.ensureDb(), 'SELECT key, value FROM meta');
        const map: Record<string, string> = {};
        for (const r of rows) map[r.key] = r.value;
        return map;
    }

    // ── Private ────────────────────────────────────────────────

    /** Add columns that may be missing in older databases. */
    private migrateSchema(): void {
        const db = this.ensureDb();
        const cols = queryAll<{ name: string }>(db, "PRAGMA table_info('symbols')").map(c => c.name);
        const migrations: [string, string][] = [
            ['visibility', "ALTER TABLE symbols ADD COLUMN visibility TEXT DEFAULT 'public'"],
            ['is_static',  'ALTER TABLE symbols ADD COLUMN is_static INTEGER DEFAULT 0'],
            ['is_async',   'ALTER TABLE symbols ADD COLUMN is_async INTEGER DEFAULT 0'],
        ];
        for (const [col, sql] of migrations) {
            if (!cols.includes(col)) {
                db.run(sql);
            }
        }
    }

    private ensureDb(): SqlJsDatabase {
        if (!this.db) throw new Error('GraphDB is not open');
        return this.db;
    }
}
