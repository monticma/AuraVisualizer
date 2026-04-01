/**
 * mcp-server.ts — Aura MCP Server
 *
 * Standalone Node.js process that exposes the Aura code-architecture graph
 * to AI assistants (Copilot, Claude, etc.) via the Model Context Protocol.
 *
 * Reads the SQLite database at AURA_DB_PATH (env var) and serves:
 *   - 3 resources  (overview, nodes, node detail)
 *   - 9 tools      (find_dependencies, find_dependents, find_path, etc.)
 *
 * Transport: stdio (standard for local MCP servers).
 * Launched by VS Code's MCP configuration (.vscode/mcp.json).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ListResourceTemplatesRequestSchema,
    ListToolsRequestSchema,
    CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import initSqlJs from 'sql.js';
import { GraphDB } from './graph-db';

// ── Env ────────────────────────────────────────────────────────

const DB_PATH = process.env.AURA_DB_PATH;
if (!DB_PATH) {
    process.stderr.write('AURA_DB_PATH environment variable is required\n');
    process.exit(1);
}

// ── Tool definitions ───────────────────────────────────────────

const TOOLS = [
    {
        name: 'find_dependencies',
        description: 'Find all transitive dependencies of a file (what it imports/requires). Returns dependency tree up to a configurable depth.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                file: { type: 'string', description: 'File path relative to the workspace root (e.g. "src/extension.ts")' },
                depth: { type: 'number', description: 'Maximum depth to traverse (default: 5)' },
            },
            required: ['file'],
        },
    },
    {
        name: 'find_dependents',
        description: 'Find all files that depend on a given file (blast radius / impact analysis). Returns impacted files with depth and risk level (high/medium/low). Shows what would be affected if this file changes.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                file: { type: 'string', description: 'File path relative to the workspace root' },
                depth: { type: 'number', description: 'Maximum depth to traverse (default: 5)' },
            },
            required: ['file'],
        },
    },
    {
        name: 'find_path',
        description: 'Find the shortest dependency path between two files. Returns null if no path exists.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                from: { type: 'string', description: 'Source file path' },
                to: { type: 'string', description: 'Target file path' },
            },
            required: ['from', 'to'],
        },
    },
    {
        name: 'find_cycles',
        description: 'Find all circular dependency cycles in the codebase.',
        inputSchema: {
            type: 'object' as const,
            properties: {},
        },
    },
    {
        name: 'find_dead_code',
        description: 'Find all dead code: exported symbols that are never imported by any other file.',
        inputSchema: {
            type: 'object' as const,
            properties: {},
        },
    },
    {
        name: 'get_hotspots',
        description: 'Get the most complex/impactful files in the codebase, ranked by impact score (complexity × fan-in).',
        inputSchema: {
            type: 'object' as const,
            properties: {
                limit: { type: 'number', description: 'Maximum number of results (default: 20)' },
                sort_by: { type: 'string', description: 'Sort criterion: "impact" (default), "complexity", "fan_in", or "lines"' },
            },
        },
    },
    {
        name: 'search_symbols',
        description: 'Search for functions, classes, interfaces, methods, or other symbols by name (substring match). Returns visibility, static/async flags.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                query: { type: 'string', description: 'Search string (matched as substring, case-insensitive in SQLite)' },
                kind: { type: 'string', description: 'Optional filter by symbol kind: "function", "method", "class", "struct", "enum", "macro", "export", "interface", "trait", "type_alias"' },
            },
            required: ['query'],
        },
    },
    {
        name: 'find_heritage',
        description: 'Find inheritance and implementation relationships (extends/implements edges). Optionally filter by file.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                file: { type: 'string', description: 'Optional file path to filter heritage edges for' },
            },
        },
    },
    {
        name: 'get_architecture',
        description: 'Get a high-level architecture overview: file count, lines of code, and average complexity grouped by programming language.',
        inputSchema: {
            type: 'object' as const,
            properties: {},
        },
    },
    {
        name: 'get_communities',
        description: 'Detect architectural communities (modules) using the Louvain algorithm. Groups files by actual dependency coupling, not directory structure.',
        inputSchema: {
            type: 'object' as const,
            properties: {},
        },
    },
];

// ── Tool handlers ──────────────────────────────────────────────

function handleTool(db: GraphDB, name: string, args: Record<string, unknown>): unknown {
    switch (name) {
        case 'find_dependencies': {
            const file = args.file as string;
            const depth = (args.depth as number) || 5;
            const deps = db.getDependencies(file, depth);
            return {
                file,
                depth,
                dependencies: deps,
                total: deps.length,
            };
        }
        case 'find_dependents': {
            const file = args.file as string;
            const depth = (args.depth as number) || 5;
            const blast = db.getBlastRadius(file, depth);
            const high = blast.filter(b => b.risk === 'high').length;
            const medium = blast.filter(b => b.risk === 'medium').length;
            const low = blast.filter(b => b.risk === 'low').length;
            return {
                file,
                depth,
                blast_radius: blast,
                total: blast.length,
                summary: `${high} high-risk, ${medium} medium-risk, ${low} low-risk`,
                note: `Modifying this file impacts ${blast.length} file(s) transitively`,
            };
        }
        case 'find_path': {
            const from = args.from as string;
            const to = args.to as string;
            const path = db.findPath(from, to);
            return path
                ? { from, to, path, length: path.length - 1 }
                : { from, to, path: null, message: 'No dependency path found between these files' };
        }
        case 'find_cycles': {
            const cycles = db.getCycles();
            return {
                cycles: cycles.map(c => ({ files: c, length: c.length })),
                total: cycles.length,
            };
        }
        case 'find_dead_code': {
            const dead = db.getDeadCode();
            // Group by file
            const byFile: Record<string, string[]> = {};
            for (const d of dead) {
                (byFile[d.nodeId] ??= []).push(`${d.symbol} (${d.kind})`);
            }
            return {
                files: Object.entries(byFile).map(([file, symbols]) => ({ file, symbols })),
                totalSymbols: dead.length,
                totalFiles: Object.keys(byFile).length,
            };
        }
        case 'get_hotspots': {
            const limit = (args.limit as number) || 20;
            const sortBy = (args.sort_by as string) || 'impact';
            const hotspots = db.getHotspots(limit, sortBy);
            return {
                hotspots: hotspots.map(h => ({
                    file: h.id,
                    lines: h.lines,
                    complexity: h.complexity,
                    fan_in: h.fan_in,
                    fan_out: h.fan_out,
                    impact_score: h.impact_score,
                })),
                sort_by: sortBy,
                total: hotspots.length,
            };
        }
        case 'search_symbols': {
            const query = args.query as string;
            const kind = args.kind as string | undefined;
            const results = db.searchSymbols(query, kind);
            return {
                query,
                kind: kind || 'all',
                results: results.map(r => ({
                    file: r.nodeId,
                    symbol: r.name,
                    kind: r.kind,
                    line: r.line,
                    visibility: r.visibility,
                    is_static: r.isStatic,
                    is_async: r.isAsync,
                })),
                total: results.length,
            };
        }
        case 'find_heritage': {
            const file = args.file as string | undefined;
            const edges = db.getHeritage(file);
            return {
                file: file || 'all',
                heritage: edges.map(e => ({
                    source: e.source,
                    target: e.target,
                    type: e.type,
                    label: e.label,
                })),
                total: edges.length,
            };
        }
        case 'get_architecture': {
            const overview = db.getArchitectureOverview();
            const meta = db.getAllMeta();
            return {
                project: meta.projectName || 'unknown',
                analyzed_at: meta.analyzedAt || 'unknown',
                total_files: Number(meta.totalFiles) || 0,
                total_links: Number(meta.totalLinks) || 0,
                languages: overview.map(o => ({
                    language: o.language,
                    files: o.count,
                    total_loc: o.total_loc,
                    avg_complexity: o.avg_complexity,
                })),
            };
        }
        case 'get_communities': {
            const communities = db.getCommunities();
            const groups: Record<number, string[]> = {};
            for (const c of communities) {
                (groups[c.community] ??= []).push(c.nodeId);
            }
            const sorted = Object.entries(groups)
                .map(([id, files]) => ({ community: parseInt(id), files, size: files.length }))
                .sort((a, b) => b.size - a.size);
            return {
                communities: sorted,
                total: sorted.length,
                note: `Detected ${sorted.length} architectural communities via Louvain algorithm`,
            };
        }
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

// ── Main ───────────────────────────────────────────────────────

async function main(): Promise<void> {
    // Initialize sql.js and open the database
    const { join, dirname } = await import('path');
    const wasmPath = join(dirname(require.resolve('sql.js')), 'sql-wasm.wasm');
    const SQL = await initSqlJs({ locateFile: () => wasmPath });

    const db = new GraphDB();
    db.openSync(SQL, DB_PATH!);

    const server = new Server(
        { name: 'aura', version: '1.0.0' },
        {
            capabilities: {
                resources: {},
                tools: {},
            },
        },
    );

    // ── Resources: list ────────────────────────────────────────

    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
        resources: [
            {
                uri: 'aura://overview',
                name: 'Architecture Overview',
                description: 'High-level project summary: languages, file counts, metrics',
                mimeType: 'application/json',
            },
            {
                uri: 'aura://nodes',
                name: 'All Nodes',
                description: 'Complete list of all files with metrics (LOC, complexity, fan-in/out)',
                mimeType: 'application/json',
            },
        ],
    }));

    // ── Resources: templates ───────────────────────────────────

    server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
        resourceTemplates: [
            {
                uriTemplate: 'aura://node/{id}',
                name: 'Node Detail',
                description: 'Full detail for a file: metrics, symbols, direct dependencies and dependents',
                mimeType: 'application/json',
            },
        ],
    }));

    // ── Resources: read ────────────────────────────────────────

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const uri = request.params.uri;

        if (uri === 'aura://overview') {
            const overview = db.getArchitectureOverview();
            const meta = db.getAllMeta();
            return {
                contents: [{
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify({
                        project: meta.projectName || 'unknown',
                        analyzed_at: meta.analyzedAt || 'unknown',
                        total_files: Number(meta.totalFiles) || 0,
                        total_links: Number(meta.totalLinks) || 0,
                        dead_code_files: Number(meta.deadCodeFiles) || 0,
                        dead_exports_total: Number(meta.deadExportsTotal) || 0,
                        languages: overview,
                    }, null, 2),
                }],
            };
        }

        if (uri === 'aura://nodes') {
            const nodes = db.getAllNodes();
            return {
                contents: [{
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(nodes, null, 2),
                }],
            };
        }

        // aura://node/{id} — id is the URL-encoded file path
        const nodeMatch = uri.match(/^aura:\/\/node\/(.+)$/);
        if (nodeMatch) {
            const fileId = decodeURIComponent(nodeMatch[1]);
            const detail = db.getNodeDetail(fileId);
            if (!detail) {
                throw new Error(`Node not found: ${fileId}`);
            }
            return {
                contents: [{
                    uri,
                    mimeType: 'application/json',
                    text: JSON.stringify(detail, null, 2),
                }],
            };
        }

        throw new Error(`Unknown resource: ${uri}`);
    });

    // ── Tools: list ────────────────────────────────────────────

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: TOOLS,
    }));

    // ── Tools: call ────────────────────────────────────────────

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        try {
            const result = handleTool(db, name, args ?? {});
            return {
                content: [{
                    type: 'text' as const,
                    text: JSON.stringify(result, null, 2),
                }],
            };
        } catch (err) {
            return {
                content: [{
                    type: 'text' as const,
                    text: `Error: ${err instanceof Error ? err.message : String(err)}`,
                }],
                isError: true,
            };
        }
    });

    // ── Connect transport ──────────────────────────────────────

    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write('Aura MCP Server running on stdio\n');
}

main().catch(err => {
    process.stderr.write(`Fatal: ${err}\n`);
    process.exit(1);
});
