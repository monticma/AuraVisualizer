/**
 * tools.ts — Shared Aura tool registry.
 *
 * One implementation of the deterministic GraphDB tools used by the legacy
 * webview chat, the VS Code LM tools and the @aura chat participant.
 *
 * Design: docs/Ideas/Done/AI-CHAT.md · strategy: docs/Ideas/AIChatStrategy.md.
 */

import type { GraphDB } from '../graph-db';
import { resolveContext } from '../mcp/context';
import { topRiskHotspots, type RiskSnapshot } from '../risk/risk-service';

/** A private tool the model can call, executed locally against the GraphDB. */
export interface AuraTool {
    name: string;
    description: string;
    inputSchema: object;
}

export const AURA_TOOLS: AuraTool[] = [
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
        description: 'Return circular dependency cycles: file-level imports and function-level recursion/mutual recursion with call lines.',
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
                sort_by: { type: 'string', enum: ['risk', 'impact', 'complexity', 'fan_in', 'lines'], description: 'Sort criterion (default risk)' },
                window_days: { type: 'number', description: 'Git history window in days for risk scoring (default 90)' },
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
        name: 'aura_get_cochange',
        description: 'Return the strongest temporal-coupling pairs: files that keep changing in the same commits without a direct dependency. Jaccard score = cochanges / union of commits.',
        inputSchema: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Maximum pairs (default 50)' },
                min_score: { type: 'number', description: 'Minimum Jaccard score 0–1 (default 0)' },
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
        description: 'Search for functions, classes, interfaces, methods or other symbols by name. Function results include cognitive complexity and maintainability when the language supports it.',
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
                include_methods: { type: 'boolean', description: 'Include class methods (default true)' },
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
        name: 'aura_generate_documentation',
        description: 'Generate a comprehensive documentation payload for the codebase: architecture overview, modules, critical dependencies, hotspots, cycles, dead code and inter-module links.',
        inputSchema: {
            type: 'object',
            properties: {
                hotspot_limit: { type: 'number', description: 'Number of top hotspots to include (default 15)' },
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
export function resolveFileArg(db: GraphDB, file: string): string | null {
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

/** Shortest filename in a community, used as a human-readable module name. */
function nameCommunity(files: string[], fanIn: Map<string, number>): string {
    if (files.length === 0) return '?';
    // Match the webview palette: the hub is the highest fan-in file, ties use
    // the smallest id. Naming by shortest basename used to disagree with the
    // palette, so @aura re-mapped a selected group to a different-looking one.
    let best = files[0];
    let bestScore = fanIn.get(best) ?? 0;
    for (const file of files) {
        const score = fanIn.get(file) ?? 0;
        if (score > bestScore || (score === bestScore && file < best)) {
            best = file;
            bestScore = score;
        }
    }
    return best.replace(/.*\//, '').replace(/\.[^.]+$/, '');
}

/** Fan-in per node, used to name communities exactly like the webview palette. */
function communityFanIn(db: GraphDB): Map<string, number> {
    return new Map(db.getAllNodes().map(node => [node.id, node.fan_in]));
}

/** Execute an Aura tool locally (deterministic, no LLM) against the GraphDB. */
export function runAuraTool(db: GraphDB, name: string, input: Record<string, unknown>, getRiskSnapshot?: (input?: Record<string, unknown>) => RiskSnapshot | undefined): unknown {
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
            const symbolCycles = db.getSymbolCycles();
            return {
                cycles: cycles.map(c => ({ files: c, length: c.length })),
                total: cycles.length,
                symbol_cycles: symbolCycles.map(c => ({
                    kind: c.kind,
                    nodes: c.nodes,
                    edges: c.edges,
                    confidence: c.confidence,
                    ambiguous: c.ambiguous,
                })),
                symbol_total: symbolCycles.length,
            };
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
            const sortBy = (input.sort_by as string) || 'risk';
            if (sortBy !== 'risk') {
                const hotspots = db.getHotspots(limit, sortBy);
                return {
                    sort_by: sortBy,
                    hotspots: hotspots.map(h => ({ file: h.id, lines: h.lines, complexity: h.complexity, fan_in: h.fan_in, fan_out: h.fan_out, impact_score: h.impact_score })),
                    total: hotspots.length,
                };
            }
            const snapshot = getRiskSnapshot?.(input);
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
        case 'aura_get_cochange': {
            const pairs = db.getCochange((input.limit as number) || 50, (input.min_score as number) || 0);
            return {
                pairs: pairs.map(p => ({
                    a: p.file_a,
                    b: p.file_b,
                    cochanges: p.cochanges,
                    jaccard: p.jaccard,
                    support: p.support,
                    a_commits: p.a_commits,
                    b_commits: p.b_commits,
                    linked: !!p.linked,
                })),
                total: pairs.length,
                window_days: pairs[0]?.window_days ?? 365,
                note: 'Temporal coupling without a direct structural edge — implicit contracts worth reviewing together.',
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
                results: results.map(r => ({ file: r.nodeId, symbol: r.name, kind: r.kind, line: r.line, visibility: r.visibility, is_static: r.isStatic, is_async: r.isAsync, cognitive: r.cognitive, maintainability: r.maintainability })),
                total: results.length,
            };
        }
        case 'aura_search_docs': {
            const results = db.searchDocs(input.query as string, (input.limit as number) || 10);
            return {
                query: input.query,
                results: results.map(r => ({ file: r.fileId, section: r.section, line: r.lineStart, score: r.score, excerpt: r.content.length > 600 ? r.content.slice(0, 600) + '…' : r.content })),
                total: results.length,
                note: results.length === 0
                    ? 'No documentation matched. The project may not have indexed any Markdown / text / rst files yet.'
                    : 'Results ranked by keyword-frequency score (higher = better). Section heading matches are weighted 3× over body matches.',
            };
        }
        case 'aura_get_architecture': {
            const overview = db.getArchitectureOverview();
            const meta = db.getAllMeta();
            return {
                project: meta.projectName || 'unknown',
                analyzed_at: meta.analyzedAt || 'unknown',
                total_files: Number(meta.totalFiles) || 0,
                total_links: Number(meta.totalLinks) || 0,
                languages: overview.map(o => ({ language: o.language, files: o.count, total_loc: o.total_loc, avg_complexity: o.avg_complexity })),
            };
        }
        case 'aura_find_unused_functions': {
            const unused = db.getUnusedFunctions(input.file as string | undefined, input.include_methods !== false);
            return {
                functions: unused.map(u => ({ file: u.nodeId, name: u.name, kind: u.kind, line: u.line, visibility: u.visibility })),
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
            const edges = db.getHeritage(resolved || undefined);
            return {
                file: input.file || 'all',
                heritage: edges.map(e => ({ source: e.source, target: e.target, type: e.type, label: e.label })),
                total: edges.length,
            };
        }
        case 'aura_generate_documentation': {
            const hotspotLimit = (input.hotspot_limit as number) || 15;
            const meta = db.getAllMeta();
            const overview = db.getArchitectureOverview();
            const communityData = db.getCommunities();
            const groups: Record<number, string[]> = {};
            for (const c of communityData) {
                (groups[c.community] ??= []).push(c.nodeId);
            }
            const communityFanInByName = communityFanIn(db);
            const modules = Object.entries(groups)
                .filter(([, files]) => files.length >= 2)
                .map(([id, files]) => ({ community: parseInt(id), name: nameCommunity(files, communityFanInByName), files, size: files.length }))
                .sort((a, b) => b.size - a.size);
            const singletons = Object.entries(groups)
                .filter(([, files]) => files.length < 2)
                .flatMap(([, files]) => files);
            const nodeToModule: Record<string, string> = {};
            for (const mod of modules) {
                for (const f of mod.files) nodeToModule[f] = mod.name;
            }
            const interModuleMap: Record<string, string[]> = {};
            for (const e of db.getAllEdges()) {
                const sm = nodeToModule[e.source];
                const tm = nodeToModule[e.target];
                if (sm && tm && sm !== tm) {
                    const key = `${sm} → ${tm}`;
                    (interModuleMap[key] ??= []).push(`${e.source} → ${e.target}`);
                }
            }
            const interModuleLinks = Object.entries(interModuleMap).map(([key, files]) => {
                const [from_module, to_module] = key.split(' → ');
                return { from_module, to_module, files: files.slice(0, 5) };
            });
            const hotspots = db.getHotspots(hotspotLimit, 'impact');
            const cycles = db.getCycles();
            const dead = db.getDeadCode();
            const deadByFile: Record<string, string[]> = {};
            for (const d of dead) {
                (deadByFile[d.nodeId] ??= []).push(`${d.symbol} (${d.kind})`);
            }
            const criticalDeps = db.getHotspots(10, 'fan_in');
            return {
                overview: {
                    project: meta.projectName || 'unknown',
                    analyzed_at: meta.analyzedAt || 'unknown',
                    total_files: Number(meta.totalFiles) || 0,
                    total_links: Number(meta.totalLinks) || 0,
                    languages: overview.map(o => ({ language: o.language, files: o.count, total_loc: o.total_loc, avg_complexity: o.avg_complexity })),
                },
                modules: modules.map(m => ({ name: m.name, size: m.size, files: m.files })),
                singletons,
                critical_dependencies: criticalDeps.map(h => ({ file: h.id, fan_in: h.fan_in, fan_out: h.fan_out, complexity: h.complexity, lines: h.lines })),
                hotspots: hotspots.map(h => ({ file: h.id, lines: h.lines, complexity: h.complexity, fan_in: h.fan_in, impact_score: h.impact_score })),
                cycles: cycles.map(c => ({ files: c, length: c.length })),
                dead_code: {
                    files: Object.entries(deadByFile).map(([file, symbols]) => ({ file, symbols })),
                    total_symbols: dead.length,
                    total_files: Object.keys(deadByFile).length,
                },
                inter_module_links: interModuleLinks,
                note: 'Use this data to generate comprehensive project documentation. Modules represent dependency-coupled groups detected via Louvain algorithm. Hotspots are files with highest complexity × fan-in. Critical dependencies are files imported by the most other files.',
            };
        }
        case 'aura_get_communities': {
            const communities = db.getCommunities();
            const groups: Record<number, string[]> = {};
            for (const c of communities) {
                (groups[c.community] ??= []).push(c.nodeId);
            }
            const communityFanInByName = communityFanIn(db);
            const named = Object.entries(groups)
                .filter(([, files]) => files.length >= 2)
                .map(([id, files]) => ({ community: parseInt(id), name: nameCommunity(files, communityFanInByName), files, size: files.length }))
                .sort((a, b) => b.size - a.size);
            const singletons = Object.entries(groups)
                .filter(([, files]) => files.length < 2)
                .flatMap(([, files]) => files);
            return {
                communities: named,
                singletons,
                total: named.length,
                note: `Detected ${named.length} architectural communities via Louvain algorithm`,
            };
        }
        default:
            return { error: `Unknown tool: ${name}` };
    }
}
