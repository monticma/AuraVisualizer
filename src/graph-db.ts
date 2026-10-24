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
import type { GraphData, GraphNode, GraphLink } from './analyzer/types';
import type { CochangePair } from './analysis/cochange';

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
    cognitive: number | null;
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
    cognitive: number | null;
    cyclomatic: number | null;
    function_lines: number | null;
    halstead_volume: number | null;
    maintainability: number | null;
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

export interface CochangeRow {
    file_a: string;
    file_b: string;
    cochanges: number;
    a_commits: number;
    b_commits: number;
    union_commits: number;
    jaccard: number;
    support: number;
    linked: number;
    window_days: number;
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
    cognitive     INTEGER,
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
    cognitive   INTEGER,
    cyclomatic  INTEGER,
    function_lines INTEGER,
    halstead_volume REAL,
    maintainability REAL,
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

CREATE TABLE IF NOT EXISTS function_calls (
    caller_file  TEXT NOT NULL,
    caller_name  TEXT NOT NULL,
    callee_file  TEXT NOT NULL,
    callee_name  TEXT NOT NULL,
    call_line    INTEGER NOT NULL,
    PRIMARY KEY (caller_file, caller_name, callee_file, callee_name, call_line)
);

CREATE TABLE IF NOT EXISTS cochange_pairs (
    file_a        TEXT NOT NULL,
    file_b        TEXT NOT NULL,
    cochanges     INTEGER NOT NULL,
    a_commits     INTEGER NOT NULL,
    b_commits     INTEGER NOT NULL,
    union_commits INTEGER NOT NULL,
    jaccard       REAL NOT NULL,
    support       REAL NOT NULL,
    linked        INTEGER NOT NULL DEFAULT 0,
    window_days   INTEGER NOT NULL DEFAULT 365,
    PRIMARY KEY (file_a, file_b)
);

CREATE TABLE IF NOT EXISTS saved_queries (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    expr       TEXT NOT NULL,
    mode       TEXT NOT NULL DEFAULT 'highlight',
    created_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target);
CREATE INDEX IF NOT EXISTS idx_symbols_node ON symbols(node_id);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_nodes_language ON nodes(language);
CREATE INDEX IF NOT EXISTS idx_nodes_group ON nodes(group_name);
CREATE INDEX IF NOT EXISTS idx_fcalls_caller ON function_calls(caller_file, caller_name);
CREATE INDEX IF NOT EXISTS idx_fcalls_callee ON function_calls(callee_file, callee_name);
CREATE INDEX IF NOT EXISTS idx_cochange_score ON cochange_pairs(jaccard DESC, cochanges DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS doc_chunks USING fts4(
    file_id, section, content, line_start, tokenize=porter
);
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

/**
 * Extract searchable tokens from a free-text query.
 * Strips FTS operator characters and short noise words.
 */
function extractDocTokens(input: string): string[] {
    if (!input) return [];
    const cleaned = input.replace(/["()\:\*\^\-\+]/g, ' ').trim();
    if (!cleaned) return [];
    return cleaned.split(/\s+/).filter(t => t.length > 1);
}

/** Count non-overlapping case-sensitive substring occurrences. */
function countOccurrences(haystack: string, needle: string): number {
    if (!needle) return 0;
    let count = 0;
    let i = 0;
    while ((i = haystack.indexOf(needle, i)) !== -1) {
        count++;
        i += needle.length;
    }
    return count;
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

    // ── Saved queries (Aura Query Language favorites) ──────────

    listSavedQueries(): Array<{ id: string; name: string; expr: string; mode: string; createdAt: number }> {
        const db = this.ensureDb();
        return queryAll<{ id: string; name: string; expr: string; mode: string; created_at: number }>(
            db,
            'SELECT id, name, expr, mode, created_at FROM saved_queries ORDER BY created_at DESC'
        ).map(r => ({ id: r.id, name: r.name, expr: r.expr, mode: r.mode, createdAt: r.created_at }));
    }

    addSavedQuery(q: { id: string; name: string; expr: string; mode: string }): void {
        const db = this.ensureDb();
        db.run(
            'INSERT OR REPLACE INTO saved_queries (id, name, expr, mode, created_at) VALUES (?, ?, ?, ?, ?)',
            [q.id, q.name, q.expr, q.mode || 'highlight', Date.now()]
        );
        this.save();
    }

    deleteSavedQuery(id: string): void {
        const db = this.ensureDb();
        db.run('DELETE FROM saved_queries WHERE id = ?', [id]);
        this.save();
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
            db.run('DELETE FROM function_calls');

            // Insert nodes
            for (const n of data.nodes) {
                db.run(
                    'INSERT INTO nodes (id, name, language, extension, group_name, size, lines, complexity, cognitive, fan_in, fan_out, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [n.id, n.name, n.language, n.extension, n.group, n.size, n.linesOfCode, n.complexity, n.cognitive ?? null, n.fanIn, n.fanOut, n.lastModified]
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
            const insertSymbol = 'INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead, visibility, is_static, is_async, cognitive, cyclomatic, function_lines, halstead_volume, maintainability) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
            for (const n of data.nodes) {
                if (!n.symbols) continue;
                const deadSet = new Set(n.deadExports || []);
                for (const fn of n.symbols.functions) {
                    db.run(insertSymbol,
                        [n.id, fn.name, fn.type || 'function', fn.returnType || '', fn.params || '', fn.line || 0, deadSet.has(fn.name) ? 1 : 0, fn.visibility || 'public', fn.isStatic ? 1 : 0, fn.isAsync ? 1 : 0, fn.cognitive ?? null, fn.cyclomatic ?? null, fn.functionLines ?? null, fn.halsteadVolume ?? null, fn.maintainability ?? null]);
                }
                for (const m of n.symbols.methods || []) {
                    db.run(insertSymbol,
                        [n.id, m.name, m.type || 'method', m.returnType || '', m.params || '', m.line || 0, deadSet.has(m.name) ? 1 : 0, m.visibility || 'public', m.isStatic ? 1 : 0, m.isAsync ? 1 : 0, m.cognitive ?? null, m.cyclomatic ?? null, m.functionLines ?? null, m.halsteadVolume ?? null, m.maintainability ?? null]);
                }
                for (const s of n.symbols.structs)  db.run(insertSymbol, [n.id, s.name, s.type || 'struct', '', '', s.line || 0, 0, 'public', 0, 0, null, null, null, null, null]);
                for (const e of n.symbols.enums)    db.run(insertSymbol, [n.id, e.name, e.type || 'enum', '', '', e.line || 0, 0, 'public', 0, 0, null, null, null, null, null]);
                for (const m of n.symbols.macros)   db.run(insertSymbol, [n.id, m.name, m.type || 'macro', '', '', m.line || 0, 0, 'public', 0, 0, null, null, null, null, null]);
                for (const c of n.symbols.classes)  db.run(insertSymbol, [n.id, c.name, c.type || 'class', '', '', c.line || 0, deadSet.has(c.name) ? 1 : 0, 'public', 0, 0, null, null, null, null, null]);
                for (const ex of n.symbols.exports) db.run(insertSymbol, [n.id, ex.name, ex.type || 'export', '', '', ex.line || 0, deadSet.has(ex.name) ? 1 : 0, 'public', 0, 0, null, null, null, null, null]);
                for (const i of n.symbols.interfaces || [])  db.run(insertSymbol, [n.id, i.name, i.type || 'interface', '', '', i.line || 0, 0, i.visibility || 'public', 0, 0, null, null, null, null, null]);
                for (const t of n.symbols.traits || [])      db.run(insertSymbol, [n.id, t.name, t.type || 'trait', '', '', t.line || 0, 0, t.visibility || 'public', 0, 0, null, null, null, null, null]);
                for (const ta of n.symbols.typeAliases || []) db.run(insertSymbol, [n.id, ta.name, ta.type || 'type_alias', '', '', ta.line || 0, 0, ta.visibility || 'public', 0, 0, null, null, null, null, null]);
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

            // Insert function-level call sites
            if (data.functionCalls) {
                const insertCall = 'INSERT OR IGNORE INTO function_calls (caller_file, caller_name, callee_file, callee_name, call_line) VALUES (?, ?, ?, ?, ?)';
                for (const fc of data.functionCalls) {
                    db.run(insertCall, [fc.callerFile, fc.callerName, fc.calleeFile, fc.calleeName, fc.callLine]);
                }
            }

            db.run('COMMIT');
        } catch (err) {
            db.run('ROLLBACK');
            throw err;
        }

        // Persist to disk
        this.save();
    }

    // ── Granular updates (incremental parsing) ─────────────────

    /** Upsert a single node (INSERT OR REPLACE). */
    upsertNode(node: GraphNode): void {
        const db = this.ensureDb();
        db.run(
            `INSERT OR REPLACE INTO nodes (id, name, language, extension, group_name, size, lines, complexity, cognitive, fan_in, fan_out, last_modified)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [node.id, node.name, node.language, node.extension, node.group, node.size, node.linesOfCode, node.complexity, node.cognitive ?? null, node.fanIn, node.fanOut, node.lastModified]
        );
    }

    /** Delete a node and ALL associated data (edges from/to, symbols, function_calls). */
    deleteNode(nodeId: string): void {
        const db = this.ensureDb();
        db.run('BEGIN TRANSACTION');
        try {
            db.run('DELETE FROM edges WHERE source = ? OR target = ?', [nodeId, nodeId]);
            db.run('DELETE FROM symbols WHERE node_id = ?', [nodeId]);
            db.run('DELETE FROM function_calls WHERE caller_file = ? OR callee_file = ?', [nodeId, nodeId]);
            db.run('DELETE FROM doc_chunks WHERE file_id = ?', [nodeId]);
            db.run('DELETE FROM nodes WHERE id = ?', [nodeId]);
            db.run('COMMIT');
        } catch (err) {
            db.run('ROLLBACK');
            throw err;
        }
    }

    /**
     * Replace all outgoing edges, symbols, and call sites for a single file.
     * Also upserts the node itself. Does NOT call save() — caller decides when to persist.
     */
    replaceFileData(
        fileId: string,
        node: GraphNode,
        outEdges: GraphLink[],
        callSites: { callerFile: string; callerName: string; calleeFile: string; calleeName: string; callLine: number }[],
    ): void {
        const db = this.ensureDb();
        db.run('BEGIN TRANSACTION');
        try {
            // Upsert the node
            db.run(
                `INSERT OR REPLACE INTO nodes (id, name, language, extension, group_name, size, lines, complexity, cognitive, fan_in, fan_out, last_modified)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [node.id, node.name, node.language, node.extension, node.group, node.size, node.linesOfCode, node.complexity, node.cognitive ?? null, node.fanIn, node.fanOut, node.lastModified]
            );

            // Replace outgoing edges
            db.run('DELETE FROM edges WHERE source = ?', [fileId]);
            for (const e of outEdges) {
                db.run(
                    'INSERT OR IGNORE INTO edges (source, target, type, label) VALUES (?, ?, ?, ?)',
                    [e.source, e.target, e.type, e.label || '']
                );
            }

            // Replace symbols
            db.run('DELETE FROM symbols WHERE node_id = ?', [fileId]);
            if (node.symbols) {
                const deadSet = new Set(node.deadExports || []);
                const ins = 'INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead, visibility, is_static, is_async, cognitive, cyclomatic, function_lines, halstead_volume, maintainability) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
                for (const fn of node.symbols.functions) {
                    db.run(ins, [fileId, fn.name, fn.type || 'function', fn.returnType || '', fn.params || '', fn.line || 0, deadSet.has(fn.name) ? 1 : 0, fn.visibility || 'public', fn.isStatic ? 1 : 0, fn.isAsync ? 1 : 0, fn.cognitive ?? null, fn.cyclomatic ?? null, fn.functionLines ?? null, fn.halsteadVolume ?? null, fn.maintainability ?? null]);
                }
                for (const m of node.symbols.methods || []) {
                    db.run(ins, [fileId, m.name, m.type || 'method', m.returnType || '', m.params || '', m.line || 0, deadSet.has(m.name) ? 1 : 0, m.visibility || 'public', m.isStatic ? 1 : 0, m.isAsync ? 1 : 0, m.cognitive ?? null, m.cyclomatic ?? null, m.functionLines ?? null, m.halsteadVolume ?? null, m.maintainability ?? null]);
                }
                for (const s of node.symbols.structs)  db.run(ins, [fileId, s.name, s.type || 'struct', '', '', s.line || 0, 0, 'public', 0, 0, null, null, null, null, null]);
                for (const e of node.symbols.enums)     db.run(ins, [fileId, e.name, e.type || 'enum', '', '', e.line || 0, 0, 'public', 0, 0, null, null, null, null, null]);
                for (const m of node.symbols.macros)    db.run(ins, [fileId, m.name, m.type || 'macro', '', '', m.line || 0, 0, 'public', 0, 0, null, null, null, null, null]);
                for (const c of node.symbols.classes)   db.run(ins, [fileId, c.name, c.type || 'class', '', '', c.line || 0, deadSet.has(c.name) ? 1 : 0, 'public', 0, 0, null, null, null, null, null]);
                for (const ex of node.symbols.exports)  db.run(ins, [fileId, ex.name, ex.type || 'export', '', '', ex.line || 0, deadSet.has(ex.name) ? 1 : 0, 'public', 0, 0, null, null, null, null, null]);
                for (const i of node.symbols.interfaces || [])  db.run(ins, [fileId, i.name, i.type || 'interface', '', '', i.line || 0, 0, i.visibility || 'public', 0, 0, null, null, null, null, null]);
                for (const t of node.symbols.traits || [])      db.run(ins, [fileId, t.name, t.type || 'trait', '', '', t.line || 0, 0, t.visibility || 'public', 0, 0, null, null, null, null, null]);
                for (const ta of node.symbols.typeAliases || []) db.run(ins, [fileId, ta.name, ta.type || 'type_alias', '', '', ta.line || 0, 0, ta.visibility || 'public', 0, 0, null, null, null, null, null]);
            }

            // Replace call sites from this file
            db.run('DELETE FROM function_calls WHERE caller_file = ?', [fileId]);
            for (const fc of callSites) {
                db.run(
                    'INSERT OR IGNORE INTO function_calls (caller_file, caller_name, callee_file, callee_name, call_line) VALUES (?, ?, ?, ?, ?)',
                    [fc.callerFile, fc.callerName, fc.calleeFile, fc.calleeName, fc.callLine]
                );
            }

            db.run('COMMIT');
        } catch (err) {
            db.run('ROLLBACK');
            throw err;
        }
    }

    /** Recompute fan_in / fan_out from the edges table for given node IDs (or all nodes). */
    updateFanCounts(nodeIds?: string[]): void {
        const db = this.ensureDb();
        if (nodeIds && nodeIds.length > 0) {
            for (const id of nodeIds) {
                const fanOut = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM edges WHERE source = ?', [id]);
                const fanIn = queryOne<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM edges WHERE target = ?', [id]);
                db.run('UPDATE nodes SET fan_in = ?, fan_out = ? WHERE id = ?', [fanIn?.c ?? 0, fanOut?.c ?? 0, id]);
            }
        } else {
            db.run(`
                UPDATE nodes SET
                    fan_out = (SELECT COUNT(*) FROM edges WHERE edges.source = nodes.id),
                    fan_in  = (SELECT COUNT(*) FROM edges WHERE edges.target = nodes.id)
            `);
        }
    }

    // ── Export (reconstruct GraphData from DB) ─────────────────

    /** Reconstruct a full GraphData object from the DB. Returns null if DB is empty. */
    exportGraphData(): GraphData | null {
        const db = this.ensureDb();
        const nodes = queryAll<NodeRow>(db, 'SELECT * FROM nodes ORDER BY id');
        if (nodes.length === 0) return null;

        const edges = queryAll<EdgeRow>(db, 'SELECT * FROM edges ORDER BY source, target');
        const allSymbols = queryAll<SymbolRow>(db, 'SELECT * FROM symbols ORDER BY node_id');
        const meta = this.getAllMeta();
        const cycles = this.getCycles();
        const fcalls = queryAll<{ caller_file: string; caller_name: string; callee_file: string; callee_name: string; call_line: number }>(
            db, 'SELECT * FROM function_calls ORDER BY caller_file, call_line'
        );

        // Group symbols by node_id
        const symbolsByNode = new Map<string, SymbolRow[]>();
        for (const s of allSymbols) {
            let arr = symbolsByNode.get(s.node_id);
            if (!arr) { arr = []; symbolsByNode.set(s.node_id, arr); }
            arr.push(s);
        }

        // Build GraphNode array
        const graphNodes: GraphNode[] = nodes.map(n => {
            const syms = symbolsByNode.get(n.id) || [];
            const deadSymbols = syms.filter(s => s.is_dead).map(s => s.name);

            const functions = syms.filter(s => s.kind === 'function').map(s => ({
                name: s.name, returnType: s.return_type, params: s.params,
                line: s.line, type: s.kind, visibility: s.visibility, isStatic: !!s.is_static, isAsync: !!s.is_async,
                ...(s.cognitive === null ? {} : {
                    cognitive: s.cognitive,
                    cyclomatic: s.cyclomatic ?? undefined,
                    functionLines: s.function_lines ?? undefined,
                    halsteadVolume: s.halstead_volume ?? undefined,
                    maintainability: s.maintainability ?? undefined,
                }),
            }));
            const methods = syms.filter(s => s.kind === 'method').map(s => ({
                name: s.name, returnType: s.return_type, params: s.params,
                line: s.line, type: s.kind, visibility: s.visibility, isStatic: !!s.is_static, isAsync: !!s.is_async,
                ...(s.cognitive === null ? {} : {
                    cognitive: s.cognitive,
                    cyclomatic: s.cyclomatic ?? undefined,
                    functionLines: s.function_lines ?? undefined,
                    halsteadVolume: s.halstead_volume ?? undefined,
                    maintainability: s.maintainability ?? undefined,
                }),
            }));
            const structs = syms.filter(s => s.kind === 'struct').map(s => ({ name: s.name, type: s.kind, line: s.line }));
            const enums = syms.filter(s => s.kind === 'enum').map(s => ({ name: s.name, type: s.kind, line: s.line }));
            const macros = syms.filter(s => s.kind === 'macro').map(s => ({ name: s.name, type: s.kind, line: s.line }));
            const classes = syms.filter(s => s.kind === 'class').map(s => ({ name: s.name, type: s.kind, line: s.line }));
            const exports = syms.filter(s => s.kind.startsWith('export')).map(s => ({ name: s.name, type: s.kind, line: s.line }));
            const interfaces = syms.filter(s => s.kind === 'interface').map(s => ({ name: s.name, type: s.kind }));
            const traits = syms.filter(s => s.kind === 'trait').map(s => ({ name: s.name, type: s.kind }));
            const typeAliases = syms.filter(s => s.kind === 'type_alias').map(s => ({ name: s.name, type: s.kind }));

            const node: GraphNode = {
                id: n.id, name: n.name, path: n.id,
                language: n.language, extension: n.extension,
                size: n.size, linesOfCode: n.lines,
                lastModified: n.last_modified, group: n.group_name,
                fanOut: n.fan_out, fanIn: n.fan_in,
                complexity: n.complexity, complexityDetails: {},
            };
            if (n.cognitive !== null) node.cognitive = n.cognitive;

            if (syms.length > 0) {
                node.symbols = {
                    functions, methods, structs, enums, macros, classes,
                    exports, interfaces, traits, typeAliases,
                    totalSymbols: syms.length,
                };
            }
            if (deadSymbols.length > 0) node.deadExports = deadSymbols;

            return node;
        });

        // Tag nodes with cycle indices
        const nodeMap = new Map(graphNodes.map(n => [n.id, n]));
        for (let i = 0; i < cycles.length; i++) {
            for (const nodeId of cycles[i]) {
                const node = nodeMap.get(nodeId);
                if (node) {
                    if (!node.cycleIds) node.cycleIds = [];
                    node.cycleIds.push(i);
                }
            }
        }

        const links: GraphLink[] = edges.map(e => ({
            source: e.source, target: e.target, type: e.type, label: e.label,
        }));

        const langStats: Record<string, { count: number; totalLOC: number; avgComplexity: number }> =
            meta['languageStats'] ? JSON.parse(meta['languageStats']) : {};
        const groups: string[] = meta['groups'] ? JSON.parse(meta['groups']) : [];

        return {
            meta: {
                projectName: meta['projectName'] || '',
                analyzedAt: meta['analyzedAt'] || '',
                totalFiles: parseInt(meta['totalFiles'] || '0'),
                totalLinks: parseInt(meta['totalLinks'] || '0'),
                totalRelationsFound: parseInt(meta['totalRelationsFound'] || '0'),
                functionCallLinks: parseInt(meta['functionCallLinks'] || '0'),
                heritageLinks: parseInt(meta['heritageLinks'] || '0'),
                unresolvedReferences: parseInt(meta['unresolvedReferences'] || '0'),
                unresolvedSamples: [],
                deadCodeFiles: parseInt(meta['deadCodeFiles'] || '0'),
                deadExportsTotal: parseInt(meta['deadExportsTotal'] || '0'),
                cycles,
                languageStats: langStats,
                groups,
            },
            nodes: graphNodes,
            links,
            functionCalls: fcalls.map(fc => ({
                callerFile: fc.caller_file, callerName: fc.caller_name,
                calleeFile: fc.callee_file, calleeName: fc.callee_name,
                callLine: fc.call_line,
            })),
        };
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

    /** Files that nothing imports (fan_in = 0) — orphan / entry-point files. */
    getOrphanFiles(limit: number = 100): NodeRow[] {
        return queryAll<NodeRow>(this.ensureDb(),
            'SELECT * FROM nodes WHERE fan_in = 0 ORDER BY fan_out, name LIMIT ?',
            [limit]
        );
    }

    /** Replace all persisted co-change pairs (history scan / analysis refresh). */
    replaceCochange(pairs: CochangePair[], windowDays: number): void {
        const db = this.ensureDb();
        const days = Number.isFinite(windowDays) ? Math.round(windowDays) : 365;
        db.run('BEGIN TRANSACTION');
        try {
            db.run('DELETE FROM cochange_pairs');
            for (const pair of pairs) {
                const a = pair.a < pair.b ? pair.a : pair.b;
                const b = pair.a < pair.b ? pair.b : pair.a;
                db.run(
                    'INSERT OR REPLACE INTO cochange_pairs (file_a, file_b, cochanges, a_commits, b_commits, union_commits, jaccard, support, linked, window_days) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [a, b, pair.cochanges, pair.aCommits, pair.bCommits, pair.aCommits + pair.bCommits - pair.cochanges, pair.jaccard, pair.support, pair.linked ? 1 : 0, days]
                );
            }
            db.run('COMMIT');
            this.save();
        } catch (err) {
            try { db.run('ROLLBACK'); } catch { /* ignore */ }
            throw err;
        }
    }

    /** Strongest co-change pairs, optionally above a Jaccard threshold. */
    getCochange(limit: number = 50, minScore: number = 0): CochangeRow[] {
        const capped = Math.max(1, Math.min(500, Math.round(limit)));
        const threshold = Number.isFinite(minScore) ? Math.max(0, Math.min(1, minScore)) : 0;
        return queryAll<CochangeRow>(this.ensureDb(),
            'SELECT file_a, file_b, cochanges, a_commits, b_commits, union_commits, jaccard, support, linked, window_days FROM cochange_pairs WHERE jaccard >= ? ORDER BY jaccard DESC, cochanges DESC, file_a, file_b LIMIT ?',
            [threshold, capped]
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
    searchSymbols(query: string, kind?: string): { nodeId: string; name: string; kind: string; line: number; visibility: string; isStatic: boolean; isAsync: boolean; cognitive: number | null; maintainability: number | null }[] {
        const db = this.ensureDb();
        const sql = 'SELECT node_id AS nodeId, name, kind, line, visibility, is_static AS isStatic, is_async AS isAsync, cognitive, maintainability FROM symbols WHERE name LIKE ?' +
            (kind ? ' AND kind = ?' : '') + ' ORDER BY name LIMIT 100';
        const params = kind ? [`%${query}%`, kind] : [`%${query}%`];
        const rows = queryAll<{ nodeId: string; name: string; kind: string; line: number; visibility: string; isStatic: number; isAsync: number; cognitive: number | null; maintainability: number | null }>(db, sql, params);
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

    /** Find functions/methods never called anywhere (not even within their own file). */
    getUnusedFunctions(fileId?: string, includeMethods: boolean = true): { nodeId: string; name: string; kind: string; line: number; visibility: string }[] {
        const db = this.ensureDb();
        const kinds = includeMethods ? "('function', 'method')" : "('function')";
        const fileFilter = fileId ? ' AND s.node_id = ?' : '';
        const params = fileId ? [fileId] : [];
        return queryAll(db, `
            SELECT s.node_id AS nodeId, s.name, s.kind, s.line, s.visibility
            FROM symbols s
            WHERE s.kind IN ${kinds}${fileFilter}
              AND NOT EXISTS (
                SELECT 1 FROM function_calls fc
                WHERE fc.callee_name = s.name AND fc.callee_file = s.node_id
              )
            ORDER BY s.node_id, s.line
        `, params);
    }

    /** Get all nodes. */
    getAllNodes(): NodeRow[] {
        return queryAll<NodeRow>(this.ensureDb(), 'SELECT * FROM nodes ORDER BY id');
    }

    /** Get all edges. */
    getAllEdges(): EdgeRow[] {
        return queryAll<EdgeRow>(this.ensureDb(), 'SELECT * FROM edges ORDER BY source, target');
    }

    /** Get function-level call sites, optionally filtered by file. */
    getFunctionCalls(fileId?: string): { caller_file: string; caller_name: string; callee_file: string; callee_name: string; call_line: number }[] {
        const db = this.ensureDb();
        if (fileId) {
            return queryAll(db,
                'SELECT * FROM function_calls WHERE caller_file = ? OR callee_file = ? ORDER BY caller_file, call_line',
                [fileId, fileId]
            );
        }
        return queryAll(db, 'SELECT * FROM function_calls ORDER BY caller_file, call_line');
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

    // ── Documentation RAG (FTS5) ───────────────────────────────

    /** Delete all chunks for a single file. */
    deleteDocChunks(fileId: string): void {
        const db = this.ensureDb();
        db.run('DELETE FROM doc_chunks WHERE file_id = ?', [fileId]);
    }

    /** Replace all chunks for a single file (delete + insert). Does not save(). */
    replaceDocChunks(
        fileId: string,
        chunks: Array<{ section: string; content: string; lineStart: number }>,
    ): void {
        const db = this.ensureDb();
        db.run('DELETE FROM doc_chunks WHERE file_id = ?', [fileId]);
        const ins = 'INSERT INTO doc_chunks (file_id, section, content, line_start) VALUES (?, ?, ?, ?)';
        for (const c of chunks) {
            db.run(ins, [fileId, c.section, c.content, c.lineStart]);
        }
    }

    /** Bulk-replace ALL doc chunks (used after a full project re-analysis). Does not save(). */
    importDocChunks(chunks: Array<{ fileId: string; section: string; content: string; lineStart: number }>): void {
        const db = this.ensureDb();
        db.run('BEGIN TRANSACTION');
        try {
            db.run('DELETE FROM doc_chunks');
            const ins = 'INSERT INTO doc_chunks (file_id, section, content, line_start) VALUES (?, ?, ?, ?)';
            for (const c of chunks) {
                db.run(ins, [c.fileId, c.section, c.content, c.lineStart]);
            }
            db.run('COMMIT');
        } catch (err) {
            db.run('ROLLBACK');
            throw err;
        }
    }

    /**
     * Full-text search across documentation chunks using FTS4 MATCH +
     * a simple JS-side keyword frequency ranker (FTS4 has no built-in bm25).
     * @param query — free-text query (will be sanitized into a MATCH expression)
     * @param limit — max results (default 10)
     */
    searchDocs(query: string, limit: number = 10): Array<{
        fileId: string; section: string; content: string; lineStart: number; score: number;
    }> {
        const db = this.ensureDb();
        const tokens = extractDocTokens(query);
        const matchExpr = tokens.map(t => `"${t}"*`).join(' OR ');
        if (!matchExpr) return [];
        const rows = queryAll<{
            file_id: string; section: string; content: string; line_start: number;
        }>(db,
            `SELECT file_id, section, content, line_start
             FROM doc_chunks WHERE doc_chunks MATCH ?
             LIMIT ?`,
            [matchExpr, Math.max(limit * 5, 50)]
        );

        // Rank by total keyword hits in section (×3 weight) + content (×1)
        const scored = rows.map(r => {
            const sectionLow = (r.section || '').toLowerCase();
            const contentLow = r.content.toLowerCase();
            let score = 0;
            for (const t of tokens) {
                const lt = t.toLowerCase();
                if (!lt) continue;
                score += countOccurrences(sectionLow, lt) * 3;
                score += countOccurrences(contentLow, lt);
            }
            return {
                fileId: r.file_id,
                section: r.section,
                content: r.content,
                lineStart: r.line_start,
                score,
            };
        });
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, limit);
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
            ['cognitive',  'ALTER TABLE symbols ADD COLUMN cognitive INTEGER'],
            ['cyclomatic', 'ALTER TABLE symbols ADD COLUMN cyclomatic INTEGER'],
            ['function_lines', 'ALTER TABLE symbols ADD COLUMN function_lines INTEGER'],
            ['halstead_volume', 'ALTER TABLE symbols ADD COLUMN halstead_volume REAL'],
            ['maintainability', 'ALTER TABLE symbols ADD COLUMN maintainability REAL'],
        ];
        for (const [col, sql] of migrations) {
            if (!cols.includes(col)) {
                db.run(sql);
            }
        }

        const nodeCols = queryAll<{ name: string }>(db, "PRAGMA table_info('nodes')").map(c => c.name);
        if (!nodeCols.includes('cognitive')) {
            db.run('ALTER TABLE nodes ADD COLUMN cognitive INTEGER');
        }

        // Migrate: add function_calls table if missing
        const tables = queryAll<{ name: string }>(db, "SELECT name FROM sqlite_master WHERE type='table'").map(t => t.name);
        if (!tables.includes('function_calls')) {
            db.run(`CREATE TABLE function_calls (
                caller_file TEXT NOT NULL, caller_name TEXT NOT NULL,
                callee_file TEXT NOT NULL, callee_name TEXT NOT NULL,
                call_line INTEGER NOT NULL,
                PRIMARY KEY (caller_file, caller_name, callee_file, callee_name, call_line)
            )`);
            db.run('CREATE INDEX IF NOT EXISTS idx_fcalls_caller ON function_calls(caller_file, caller_name)');
            db.run('CREATE INDEX IF NOT EXISTS idx_fcalls_callee ON function_calls(callee_file, callee_name)');
        }

        // Migrate: add doc_chunks FTS virtual table if missing
        if (!tables.includes('doc_chunks')) {
            db.run(`CREATE VIRTUAL TABLE doc_chunks USING fts4(
                file_id, section, content, line_start, tokenize=porter
            )`);
        }
    }

    private ensureDb(): SqlJsDatabase {
        if (!this.db) throw new Error('GraphDB is not open');
        return this.db;
    }
}
