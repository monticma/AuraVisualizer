/**
 * chat.ts — Aura Assistant engine.
 *
 * Streams an AI answer from VS Code's built-in language model (`vscode.lm`),
 * grounded in the analyzed codebase via `resolveContext` + documentation search.
 *
 * Design: docs/Ideas/Done/AI-CHAT.md (Option A — chat in the webview).
 * Current strategy: docs/Ideas/AIChatStrategy.md (VS Code Chat participant @aura).
 */

import * as vscode from 'vscode';
import type { GraphDB } from './graph-db';
import { resolveContext } from './mcp/context';
import { topRiskHotspots, type RiskSnapshot } from './risk/risk-service';

export interface ChatStreamCallbacks {
    onChunk: (text: string) => void;
    onDone: (fullText: string) => void;
    onError: (message: string) => void;
    /** Fired when the model invokes an Aura tool (for UI transparency). */
    onToolCall?: (name: string) => void;
}

const SYSTEM_PROMPT =
    'You are Aura, the code architecture assistant of the Aura 3D Visualizer extension. ' +
    'You have access to tools that query the analyzed codebase. ' +
    'ALWAYS call the relevant tool(s) when the question is about the codebase ' +
    '(files, dependencies, orphan files, cycles, dead code, hotspots, symbols, architecture, documentation). ' +
    'Answer ONLY from the tool results — never guess or invent files. ' +
    'When citing files, use the format `path/to/file.ts:line`. ' +
    'If a tool returns no results, say so honestly instead of guessing.';

/** A private tool the model can call, executed locally against the GraphDB. */
interface AuraTool {
    name: string;
    description: string;
    inputSchema: object;
}

const AURA_TOOLS: AuraTool[] = [
    {
        name: 'aura_resolve_context',
        description: 'Given a natural-language task description, return the most relevant files in the codebase, ranked, with path:line anchors and metrics.',
        inputSchema: {
            type: 'object',
            properties: {
                task: { type: 'string', description: 'Task description, e.g. "add oauth login"' },
                limit: { type: 'number', description: 'Maximum files to return (default 8)' },
            },
            required: ['task'],
        },
    },
    {
        name: 'aura_find_orphan_files',
        description: 'Return files that nothing imports (fan_in = 0). These are orphan or entry-point files. Use this to answer questions about orphaned, isolated or unused files.',
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Maximum files to return (default 100)' },
            },
        },
    },
    {
        name: 'aura_find_cycles',
        description: 'Return all circular dependency cycles between files in the codebase.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'aura_find_dead_code',
        description: 'Return exported symbols that are never imported or called anywhere (dead code).',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'aura_get_hotspots',
        description: 'Return the most at-risk files, ranked by Aura\'s repository-relative risk score (percentile-based, with written reasons). NOT for line counts — use aura_get_largest_files for that.',
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Maximum files (default 20)' },
            },
        },
    },
    {
        name: 'aura_get_largest_files',
        description: 'Return the files with the most lines of code, sorted by descending line count, including their complexity. Use this for questions about the largest / biggest files.',
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Maximum files (default 20)' },
            },
        },
    },
    {
        name: 'aura_find_path',
        description: 'Find the shortest dependency path between two files.',
        inputSchema: {
            type: 'object',
            properties: {
                from: { type: 'string', description: 'Source file path' },
                to: { type: 'string', description: 'Target file path' },
            },
            required: ['from', 'to'],
        },
    },
    {
        name: 'aura_search_symbols',
        description: 'Search for functions, classes, interfaces, methods or other symbols by name.',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Search string (substring match)' },
                kind: { type: 'string', description: 'Optional filter: function, method, class, struct, enum, macro, export, interface, trait, type_alias' },
            },
            required: ['query'],
        },
    },
    {
        name: 'aura_search_docs',
        description: 'Full-text search across project documentation (Markdown, text, reStructuredText).',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string', description: 'Natural-language keywords' },
                limit: { type: 'number', description: 'Maximum chunks (default 10)' },
            },
            required: ['query'],
        },
    },
    {
        name: 'aura_get_architecture',
        description: 'Return the high-level architecture overview: file count, lines of code and average complexity grouped by language.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'aura_find_unused_functions',
        description: 'Return functions and methods that are never called anywhere in the codebase.',
        inputSchema: {
            type: 'object',
            properties: {
                file: { type: 'string', description: 'Optional file path to limit the search' },
            },
        },
    },
    {
        name: 'aura_find_dependents',
        description: 'Return the files that depend on a given file (blast radius / impact analysis). Use this to answer "what depends on X" or "what would be affected if X changes".',
        inputSchema: {
            type: 'object',
            properties: {
                file: { type: 'string', description: 'File path relative to the workspace root' },
                depth: { type: 'number', description: 'Maximum depth (default 5)' },
            },
            required: ['file'],
        },
    },
    {
        name: 'aura_find_dependencies',
        description: 'Return the transitive dependencies of a file (what it imports/requires).',
        inputSchema: {
            type: 'object',
            properties: {
                file: { type: 'string', description: 'File path relative to the workspace root' },
                depth: { type: 'number', description: 'Maximum depth (default 5)' },
            },
            required: ['file'],
        },
    },
    {
        name: 'aura_find_heritage',
        description: 'Return inheritance and implementation relationships (extends/implements edges).',
        inputSchema: {
            type: 'object',
            properties: {
                file: { type: 'string', description: 'Optional file path to filter heritage edges for' },
            },
        },
    },
    {
        name: 'aura_get_communities',
        description: 'Return architectural communities (modules) detected via the Louvain algorithm — groups of files by dependency coupling.',
        inputSchema: { type: 'object', properties: {} },
    },
];

/** Resolve a file path or basename (e.g. "server.ts") to a full node id. */
function resolveFileArg(db: GraphDB, file: string): string | null {
    if (!file) return null;
    const all = db.getAllNodes();
    // 1. Exact id match
    if (all.some(n => n.id === file)) return file;
    const lower = file.toLowerCase();
    // 2. Exact basename match (case-insensitive)
    for (const n of all) {
        if (n.name.toLowerCase() === lower) return n.id;
    }
    // 3. Path ends-with match
    for (const n of all) {
        if (n.id.toLowerCase().endsWith('/' + lower)) return n.id;
    }
    // 4. Substring match (last resort)
    for (const n of all) {
        if (n.id.toLowerCase().includes(lower)) return n.id;
    }
    return null;
}

/** Execute an Aura tool locally (deterministic, no LLM) against the GraphDB. */
function runAuraTool(db: GraphDB, name: string, input: Record<string, unknown>, getRiskSnapshot?: () => RiskSnapshot | undefined): unknown {
    switch (name) {
        case 'aura_resolve_context':
            return resolveContext(db, input.task as string, (input.limit as number) || 8);
        case 'aura_find_orphan_files': {
            const files = db.getOrphanFiles((input.limit as number) || 100);
            return {
                files: files.map(f => ({ file: f.id, language: f.language, lines: f.lines, fan_in: f.fan_in, fan_out: f.fan_out, complexity: f.complexity })),
                total: files.length,
            };
        }
        case 'aura_find_cycles': {
            const cycles = db.getCycles();
            return { cycles: cycles.map(c => ({ files: c, length: c.length })), total: cycles.length };
        }
        case 'aura_find_dead_code': {
            const dead = db.getDeadCode();
            return {
                symbols: dead.map(d => ({ file: d.nodeId, symbol: d.symbol, kind: d.kind })),
                total: dead.length,
            };
        }
        case 'aura_get_hotspots': {
            const limit = (input.limit as number) || 20;
            const snapshot = getRiskSnapshot?.();
            if (snapshot) {
                return topRiskHotspots(snapshot, limit);
            }
            const hotspots = db.getHotspots(limit, 'impact');
            return {
                hotspots: hotspots.map(h => ({ file: h.id, lines: h.lines, complexity: h.complexity, fan_in: h.fan_in, fan_out: h.fan_out, impact_score: h.impact_score })),
                total: hotspots.length,
            };
        }
        case 'aura_get_largest_files': {
            const files = db.getHotspots((input.limit as number) || 20, 'lines');
            return {
                files: files.map(f => ({ file: f.id, lines: f.lines, complexity: f.complexity, fan_in: f.fan_in, fan_out: f.fan_out })),
                total: files.length,
            };
        }
        case 'aura_find_path': {
            const from = resolveFileArg(db, input.from as string);
            const to = resolveFileArg(db, input.to as string);
            if (!from || !to) {
                return { error: `Could not resolve ${!from ? input.from : input.to}. Ask the user for the exact path.` };
            }
            const path = db.findPath(from, to);
            return path
                ? { from: input.from, resolved_from: from, to: input.to, resolved_to: to, path, length: path.length - 1 }
                : { from: input.from, resolved_from: from, to: input.to, resolved_to: to, path: null };
        }
        case 'aura_search_symbols': {
            const results = db.searchSymbols(input.query as string, input.kind as string | undefined);
            return {
                results: results.map(r => ({ file: r.nodeId, symbol: r.name, kind: r.kind, line: r.line, visibility: r.visibility })),
                total: results.length,
            };
        }
        case 'aura_search_docs': {
            const results = db.searchDocs(input.query as string, (input.limit as number) || 10);
            return {
                results: results.map(r => ({ file: r.fileId, section: r.section, line: r.lineStart, excerpt: r.content.slice(0, 300) })),
                total: results.length,
            };
        }
        case 'aura_get_architecture': {
            const overview = db.getArchitectureOverview();
            const meta = db.getAllMeta();
            return {
                project: meta.projectName || 'unknown',
                total_files: Number(meta.totalFiles) || 0,
                total_links: Number(meta.totalLinks) || 0,
                languages: overview.map(o => ({ language: o.language, files: o.count, total_loc: o.total_loc, avg_complexity: o.avg_complexity })),
            };
        }
        case 'aura_find_unused_functions': {
            const unused = db.getUnusedFunctions(input.file as string | undefined, true);
            return {
                functions: unused.map(u => ({ file: u.nodeId, name: u.name, kind: u.kind, line: u.line })),
                total: unused.length,
            };
        }
        case 'aura_find_dependents': {
            const resolved = resolveFileArg(db, input.file as string);
            if (!resolved) {
                return { error: `File not found: ${input.file}. Ask the user for the exact path, or use aura_search_symbols to find it.` };
            }
            const blast = db.getBlastRadius(resolved, (input.depth as number) || 5);
            return {
                file: input.file,
                resolved_file: resolved,
                dependents: blast.map(b => ({ file: b.id, depth: b.depth, risk: b.risk })),
                total: blast.length,
            };
        }
        case 'aura_find_dependencies': {
            const resolved = resolveFileArg(db, input.file as string);
            if (!resolved) {
                return { error: `File not found: ${input.file}. Ask the user for the exact path, or use aura_search_symbols to find it.` };
            }
            const deps = db.getDependencies(resolved, (input.depth as number) || 5);
            return {
                file: input.file,
                resolved_file: resolved,
                dependencies: deps.map(d => ({ file: d.id, depth: d.depth })),
                total: deps.length,
            };
        }
        case 'aura_find_heritage': {
            const resolved = input.file ? resolveFileArg(db, input.file as string) : undefined;
            if (input.file && !resolved) {
                return { error: `File not found: ${input.file}` };
            }
            const edges = db.getHeritage(resolved);
            return {
                heritage: edges.map(e => ({ source: e.source, target: e.target, type: e.type, label: e.label })),
                total: edges.length,
            };
        }
        case 'aura_get_communities': {
            const communities = db.getCommunities();
            const groups: Record<number, string[]> = {};
            for (const c of communities) {
                (groups[c.community] ??= []).push(c.nodeId);
            }
            const modules = Object.entries(groups)
                .filter(([, files]) => files.length >= 2)
                .map(([id, files]) => ({ community: parseInt(id), size: files.length, files }))
                .sort((a, b) => b.size - a.size);
            return { modules, total: modules.length };
        }
        default:
            return { error: `Unknown tool: ${name}` };
    }
}

/**
 * Stream an AI answer for a user prompt, with a tool-calling loop: the model
 * can query the analyzed codebase through deterministic Aura tools, and the
 * final text answer is streamed back to the caller.
 * Must be called in response to a user action (VS Code shows a consent dialog
 * on first `vscode.lm` use).
 */
export async function runChatStream(
    getDb: () => GraphDB | undefined,
    prompt: string,
    callbacks: ChatStreamCallbacks,
    getRiskSnapshot?: () => RiskSnapshot | undefined,
): Promise<void> {
    // 1. Select a language model (the one configured in VS Code).
    let model: vscode.LanguageModelChat;
    try {
        const models = await vscode.lm.selectChatModels({});
        if (models.length === 0) {
            callbacks.onError('No language model available. Configure a chat model in VS Code (e.g. GitHub Copilot) and retry.');
            return;
        }
        model = models[0];
    } catch (err) {
        callbacks.onError(err instanceof Error ? err.message : String(err));
        return;
    }

    const db = getDb();
    const userMessage = db
        ? SYSTEM_PROMPT + '\n\nUSER QUESTION: ' + prompt
        : SYSTEM_PROMPT + '\n\n(The workspace has not been analyzed yet — no codebase tools are available. Tell the user to run "Aura: Visualize Codebase".)\n\nUSER QUESTION: ' + prompt;

    const messages: vscode.LanguageModelChatMessage[] = [
        vscode.LanguageModelChatMessage.User(userMessage),
    ];

    const tools = AURA_TOOLS.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
    }));

    const MAX_ITERATIONS = 6;

    try {
        let fullText = '';
        for (let i = 0; i < MAX_ITERATIONS; i++) {
            const options: vscode.LanguageModelChatRequestOptions = db ? { tools } : {};
            const response = await model.sendRequest(messages, options, undefined);

            const toolCalls: vscode.LanguageModelToolCallPart[] = [];
            for await (const part of response.stream) {
                if (part instanceof vscode.LanguageModelTextPart) {
                    fullText += part.value;
                    callbacks.onChunk(part.value);
                } else if (part instanceof vscode.LanguageModelToolCallPart) {
                    toolCalls.push(part);
                }
            }

            // No tool calls → this was the final answer.
            if (toolCalls.length === 0 || !db) break;

            // Execute tool calls and feed the results back to the model.
            for (const tc of toolCalls) {
                if (callbacks.onToolCall) callbacks.onToolCall(tc.name);
                let result: unknown;
                try {
                    result = runAuraTool(db, tc.name, tc.input as Record<string, unknown>, getRiskSnapshot);
                } catch (err) {
                    result = { error: err instanceof Error ? err.message : String(err) };
                }
                messages.push(vscode.LanguageModelChatMessage.Assistant([tc]));
                messages.push(vscode.LanguageModelChatMessage.User([
                    new vscode.LanguageModelToolResultPart(
                        tc.callId,
                        [new vscode.LanguageModelTextPart(JSON.stringify(result))],
                    ),
                ]));
            }
        }
        callbacks.onDone(fullText);
    } catch (err) {
        callbacks.onError(err instanceof Error ? err.message : String(err));
    }
}
