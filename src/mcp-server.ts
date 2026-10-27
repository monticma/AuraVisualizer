/**
 * mcp-server.ts — Aura MCP Server
 *
 * Standalone Node.js process that exposes the Aura code-architecture graph
 * to AI assistants (Copilot, Claude, etc.) via the Model Context Protocol.
 *
 * Reads the SQLite database at AURA_DB_PATH (env var) and serves:
 *   - 3 resources  (overview, nodes, node detail)
 *   - 17 tools     (find_dependencies, find_dependents, find_path, get_cochange, etc.)
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
import { readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { GraphDB } from './graph-db';
import { runAuraTool } from './ai/tools';
import { buildRiskSnapshot, type RiskServiceCommit } from './risk/risk-service';

// ── Env ────────────────────────────────────────────────────────

const DB_PATH = process.env.AURA_DB_PATH;
if (!DB_PATH) {
    process.stderr.write('AURA_DB_PATH environment variable is required\n');
    process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────

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
        description: 'Find circular dependency cycles: file-level imports and function-level recursion or mutual recursion with call lines.',
        inputSchema: {
            type: 'object' as const,
            properties: {},
        },
    },
    {
        name: 'find_orphan_files',
        description: 'Find files that nothing imports (fan_in = 0) — orphan or entry-point files.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                limit: { type: 'number', description: 'Maximum files (default 100)' },
            },
        },
    },
    {
        name: 'get_largest_files',
        description: 'Find the largest files by lines of code, with complexity.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                limit: { type: 'number', description: 'Maximum files (default 20)' },
            },
        },
    },
    {
        name: 'get_cochange',
        description: 'Find temporal-coupling pairs: files that keep changing in the same commits without a direct structural dependency. Jaccard = cochanges / union commits.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                limit: { type: 'number', description: 'Maximum pairs (default 50)' },
                min_score: { type: 'number', description: 'Minimum Jaccard score 0–1 (default 0)' },
            },
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
        description: 'Get the most at-risk files in the codebase, ranked by repository-relative risk score (percentile-based: complexity, fan-in/out, cycles, dead code, git churn) with written reasons. Falls back to raw metric sorts via sort_by.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                limit: { type: 'number', description: 'Maximum number of results (default: 20)' },
                sort_by: { type: 'string', description: 'Sort criterion: "risk" (default — percentile-based score with written reasons), "impact", "complexity", "fan_in", or "lines"' },
                window_days: { type: 'number', description: 'Git history window in days used for churn and scoring (default: 90)' },
            },
        },
    },
    {
        name: 'search_symbols',
        description: 'Search for functions, classes, interfaces, methods, or other symbols by name (substring match). Returns visibility, static/async flags, and cognitive complexity / maintainability for supported functions.',
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
    {
        name: 'generate_documentation',
        description: 'Generate a comprehensive documentation payload for the codebase. Returns architecture overview, modules (communities with hub files), critical dependencies (high fan-in files), hotspots, dependency cycles, dead code, and inter-module links — everything an LLM needs to produce full project documentation in one call.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                hotspot_limit: { type: 'number', description: 'Number of top hotspots to include (default: 15)' },
            },
        },
    },
    {
        name: 'find_unused_functions',
        description: 'Find functions and methods that are never called anywhere in the codebase — not even within their own file. Useful for identifying dead logic that can be safely removed.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                file: { type: 'string', description: 'Optional file path to limit the search to a single file' },
                include_methods: { type: 'boolean', description: 'Include class methods (default: true). Set to false for standalone functions only.' },
            },
        },
    },
    {
        name: 'search_docs',
        description: 'Full-text search across project documentation files (Markdown, plain text, reStructuredText). Returns top matching chunks ranked by BM25 relevance, with file path, section heading, line offset, and excerpt. Use this to answer questions about how the project works, conventions, install steps, or any prose authored alongside the code.',
        inputSchema: {
            type: 'object' as const,
            properties: {
                query: { type: 'string', description: 'Natural-language keywords to search for' },
                limit: { type: 'number', description: 'Maximum number of chunks to return (default: 10)' },
            },
            required: ['query'],
        },
    },
    {
        name: 'resolve_context',
        description: 'Given a natural-language task description, return the most relevant files ranked with exact path:line anchors, metrics, and a 1-hop dependency neighborhood — ready-to-work context for an AI agent. Deterministic (no LLM).',
        inputSchema: {
            type: 'object' as const,
            properties: {
                task: { type: 'string', description: 'Task description, e.g. "add oauth login" or "fix rate limiting on the public API"' },
                limit: { type: 'number', description: 'Maximum number of files to return (default: 10)' },
            },
            required: ['task'],
        },
    },
];

// ── Tool handlers ──────────────────────────────────────────────

/**
 * Recompute the risk snapshot from the artifacts on disk: the graph database
 * (via the shared core — same scoring as the Risk tab) plus the git history
 * index written by the extension. No running extension host required.
 */
function loadRiskSnapshot(db: GraphDB, windowDays: number): ReturnType<typeof buildRiskSnapshot> {
    const graph = db.exportGraphData();
    let commits: RiskServiceCommit[] = [];
    try {
        const root = resolve(dirname(DB_PATH!), '..');
        const indexPath = join(root, '.aura', 'history', 'index.json');
        const idx = JSON.parse(readFileSync(indexPath, 'utf-8')) as { commits?: RiskServiceCommit[] };
        commits = idx.commits ?? [];
    } catch {
        // History not scanned yet — churn stays 0, the rest of the score still works.
    }
    return buildRiskSnapshot(graph?.nodes ?? [], commits, windowDays);
}

const AURA_TOOL_BY_MCP: Record<string, string> = {
    find_dependencies: 'aura_find_dependencies',
    find_dependents: 'aura_find_dependents',
    find_path: 'aura_find_path',
    find_cycles: 'aura_find_cycles',
    find_orphan_files: 'aura_find_orphan_files',
    get_largest_files: 'aura_get_largest_files',
    get_cochange: 'aura_get_cochange',
    find_dead_code: 'aura_find_dead_code',
    get_hotspots: 'aura_get_hotspots',
    search_symbols: 'aura_search_symbols',
    find_heritage: 'aura_find_heritage',
    get_architecture: 'aura_get_architecture',
    get_communities: 'aura_get_communities',
    generate_documentation: 'aura_generate_documentation',
    find_unused_functions: 'aura_find_unused_functions',
    search_docs: 'aura_search_docs',
    resolve_context: 'aura_resolve_context',
};

function handleTool(db: GraphDB, name: string, args: Record<string, unknown>): unknown {
    const auraName = AURA_TOOL_BY_MCP[name];
    if (!auraName) throw new Error(`Unknown tool: ${name}`);

    const input: Record<string, unknown> = { ...args };
    if (name === 'resolve_context') {
        if (!input.task) throw new Error('The "task" argument is required');
        if (input.limit === undefined) input.limit = 10;
    }

    const riskSnapshot = (riskInput?: Record<string, unknown>) => {
        const days = typeof riskInput?.window_days === 'number' && (riskInput.window_days as number) > 0
            ? Math.round(riskInput.window_days as number)
            : 90;
        return loadRiskSnapshot(db, days);
    };
    const result = runAuraTool(db, auraName, input, riskSnapshot) as Record<string, unknown>;
    if (result && typeof result.error === 'string') throw new Error(result.error);

    switch (name) {
        case 'find_dependencies': {
            const deps = (result.dependencies ?? []) as { file: string; depth: number }[];
            return {
                file: args.file as string,
                depth: (args.depth as number) || 5,
                dependencies: deps.map(d => ({ id: d.file, depth: d.depth })),
                total: deps.length,
            };
        }
        case 'find_dependents': {
            const blast = (result.dependents ?? []) as { file: string; depth: number; risk: string }[];
            const high = blast.filter(b => b.risk === 'high').length;
            const medium = blast.filter(b => b.risk === 'medium').length;
            const low = blast.filter(b => b.risk === 'low').length;
            return {
                file: args.file as string,
                depth: (args.depth as number) || 5,
                blast_radius: blast.map(b => ({ id: b.file, depth: b.depth, risk: b.risk })),
                total: blast.length,
                summary: `${high} high-risk, ${medium} medium-risk, ${low} low-risk`,
                note: `Modifying this file impacts ${blast.length} file(s) transitively`,
            };
        }
        case 'find_path': {
            if (!result.path) {
                return {
                    from: args.from,
                    to: args.to,
                    path: null,
                    message: 'No dependency path found between these files',
                    resolved_from: result.resolved_from,
                    resolved_to: result.resolved_to,
                };
            }
            return result;
        }
        case 'find_dead_code': {
            const symbols = (result.symbols ?? []) as { file: string; symbol: string; kind: string }[];
            const exempted = (result.exempted ?? []) as { file: string; symbol: string; kind: string; reason: string }[];
            const byFile: Record<string, string[]> = {};
            for (const d of symbols) (byFile[d.file] ??= []).push(`${d.symbol} (${d.kind})`);
            return {
                files: Object.entries(byFile).map(([file, list]) => ({ file, symbols: list })),
                totalSymbols: symbols.length,
                totalFiles: Object.keys(byFile).length,
                exemptedSymbols: exempted,
                exemptedTotal: exempted.length,
            };
        }
        case 'find_unused_functions': {
            const functions = (result.functions ?? []) as { file: string; name: string; kind: string; line: number; visibility: string }[];
            const byFile: Record<string, { name: string; kind: string; line: number; visibility: string }[]> = {};
            for (const f of functions) {
                (byFile[f.file] ??= []).push({ name: f.name, kind: f.kind, line: f.line, visibility: f.visibility });
            }
            return {
                files: Object.entries(byFile).map(([file, list]) => ({ file, functions: list })),
                totalFunctions: functions.length,
                totalFiles: Object.keys(byFile).length,
            };
        }
        case 'search_symbols':
            return {
                query: args.query,
                kind: args.kind || 'all',
                results: result.results,
                total: result.total,
            };
        case 'get_communities': {
            const communities = (result.communities ?? []) as { community: number; name: string; files: string[]; size: number }[];
            const singletons = (result.singletons ?? []) as string[];
            const sorted = communities.slice();
            if (singletons.length > 0) {
                sorted.push({ community: sorted.length, name: 'Others', files: singletons, size: singletons.length });
            }
            return {
                communities: sorted,
                total: sorted.length,
                note: `Detected ${sorted.length} architectural communities via Louvain algorithm`,
            };
        }
        case 'search_docs':
        case 'resolve_context':
        case 'get_hotspots':
        case 'find_cycles':
        case 'find_orphan_files':
        case 'get_largest_files':
        case 'get_cochange':
        case 'find_heritage':
        case 'get_architecture':
        case 'generate_documentation':
            return result;
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

// ── Main ───────────────────────────────────────────────────────

async function main(): Promise<void> {
    // Initialize sql.js and open the database
    const { join, dirname } = await import('path');
    const { existsSync } = await import('fs');
    let wasmPath = join(__dirname, 'sql-wasm.wasm');
    if (!existsSync(wasmPath)) {
        wasmPath = join(dirname(require.resolve('sql.js')), 'sql-wasm.wasm');
    }
    const SQL = await initSqlJs({ locateFile: () => wasmPath });

    const db = new GraphDB();
    db.openSync(SQL, DB_PATH!);

    const server = new Server(
        { name: 'aura', version: '1.1.0' },
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
