/**
 * tools.ts — Shared Aura tool registry.
 *
 * One implementation of the deterministic GraphDB tools used by the legacy
 * webview chat, the VS Code LM tools and the @aura chat participant.
 *
 * Design: docs/Ideas/Done/AI-CHAT.md · strategy: docs/Ideas/AIChatStrategy.md.
 */

import type { GraphDB } from '../graph-db';
import { transitiveClosure } from '../analysis/transitive';
import { resolveContext } from '../mcp/context';
import { topRiskHotspots, type RiskFileEntry, type RiskSnapshot } from '../risk/risk-service';
import { readBranchDiff } from '../git/branch-diff';
import { readCurrentHead, readWorkingTreeChanges, readWorktrees } from '../git/git-info';
import { withAnchor } from './anchors';
import { buildStatusPayload, mergeChangesWithRisk, type ChangedFile } from './tool-core';

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
        description: 'Return exported symbols that are never imported or called anywhere (dead code). Framework/test exemptions are returned separately with their reason.',
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
        description: 'Return architectural communities (modules) detected via the shared Louvain snapshot — groups of code files by dependency coupling. Documentation nodes and doc-reference edges are excluded; labels are full hub paths or user renames.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'aura_get_architecture_violations',
        description: 'Evaluate the project layer rules (.aura/arch-rules.json) against the dependency graph. Returns per-layer globs and Ca/Ce/instability, new (non-baselined) deny/slice violations with severity, and aggregated layer cycles. Pass a layer name to restrict everything to that layer. Documentation is excluded.',
        inputSchema: {
            type: 'object',
            properties: {
                layer: { type: 'string', description: 'Optional layer name to restrict violations, metrics and cycles' },
                include_baselined: { type: 'boolean', description: 'Include violations frozen in the baseline (default false)' },
                limit: { type: 'number', description: 'Maximum violations to return (default 100)' },
            },
        },
    },
    {
        name: 'aura_build',
        description: 'Readiness check: is the analysed graph still in sync with the checkout? Returns the analysis timestamp and age, file/link counts, the commit analysed vs the current HEAD, a stale flag (null when undecidable) and the reason. Call this FIRST when a task needs trustworthy graph data, and re-run "Aura: Visualize Codebase" when stale is true.',
        inputSchema: { type: 'object', properties: {} },
    },
    {
        name: 'aura_explain_file',
        description: 'One-call file briefing: language, size, complexity, fan-in/out, page rank, risk score with reasons, cycles, dead or unused symbols, incoming/outgoing call sites, dependencies/dependents, heritage, co-change partners and the architectural community. Use it instead of chaining several find_* calls when you need to understand a single file.',
        inputSchema: {
            type: 'object',
            properties: {
                file: { type: 'string', description: 'File path or basename, e.g. "src/graph-db.ts" or "graph-db.ts"' },
            },
            required: ['file'],
        },
    },
    {
        name: 'aura_hotspots_in_changes',
        description: 'Risky files inside the current changes, ranked by risk score. Defaults to the uncommitted working tree; pass "base" to review a branch against its merge base instead. Each row carries the diff size (+/-) and the risk reasons, so it answers "what should I double-check in this change set?".',
        inputSchema: {
            type: 'object',
            properties: {
                base: { type: 'string', description: 'Optional branch or commit to diff against (e.g. "main"). Omit to review the working tree.' },
                limit: { type: 'number', description: 'Maximum files to return (default 25)' },
            },
        },
    },
    {
        name: 'aura_list_repositories',
        description: 'Describe the workspace Aura is serving: root path, database path, analysis timestamp, file/link counts, current git HEAD, staleness, and every git worktree with its branch. Use it when a task must know which repository or worktree it is working on.',
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

/** Snapshot entries shared by the documentation generator and the communities tool. */
function communityEntries(communities: ReturnType<GraphDB['getCommunitySnapshot']>) {
    return communities.map(c => ({
        community: c.id,
        name: c.label,
        files: c.files,
        size: c.size,
        hub: c.hub,
        auto_name: c.autoLabel,
        custom: !!c.custom,
        others: !!c.isOthers,
    }));
}
/** Execute an Aura tool locally (deterministic, no LLM) against the GraphDB. */
export function runAuraTool(db: GraphDB, name: string, input: Record<string, unknown>, getRiskSnapshot?: (input?: Record<string, unknown>) => RiskSnapshot | undefined, getArchitecture?: (input: Record<string, unknown>) => unknown): unknown {
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
            const exempted = db.getExemptedCode();
            return {
                symbols: dead.map(d => withAnchor(
                    { file: d.nodeId, symbol: d.symbol, kind: d.kind, line: d.line },
                    d.nodeId, d.line,
                )),
                total: dead.length,
                exempted: exempted.map(e => ({ file: e.nodeId, symbol: e.symbol, kind: e.kind, reason: e.reason })),
                exempted_total: exempted.length,
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
                results: results.map(r => withAnchor(
                    { file: r.nodeId, symbol: r.name, kind: r.kind, line: r.line, visibility: r.visibility, is_static: r.isStatic, is_async: r.isAsync },
                    r.nodeId, r.line,
                )),
                total: results.length,
            };
        }
        case 'aura_search_docs': {
            const results = db.searchDocs(input.query as string, (input.limit as number) || 10);
            return {
                query: input.query,
                results: results.map(r => withAnchor(
                    { file: r.fileId, section: r.section, line: r.lineStart, score: r.score, excerpt: r.content.length > 200 ? r.content.slice(0, 200) + '…' : r.content },
                    r.fileId, r.lineStart,
                )),
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
                functions: unused.map(u => withAnchor(
                    { file: u.nodeId, name: u.name, kind: u.kind, line: u.line, visibility: u.visibility },
                    u.nodeId, u.line,
                )),
                total: unused.length,
            };
        }
        case 'aura_find_dependents': {
            const resolved = resolveFileArg(db, input.file as string);
            if (!resolved) {
                return { error: `File not found: ${input.file}. Ask the user for the exact path, or use aura_search_symbols to find it.` };
            }
            const blast = db.getBlastRadius(resolved, (input.depth as number) || 5);
            const closure = transitiveClosure(db.getEdges(), resolved, {
                direction: 'in',
                maxDepth: (input.depth as number) || 5,
            });
            const calls = db.getCallSites(resolved, 'in', 25);
            return {
                file: input.file,
                resolved_file: resolved,
                dependents: blast.map(b => ({ file: b.id, depth: b.depth, risk: b.risk })),
                call_sites: calls.map(c => withAnchor(
                    { from: c.callerFile + ':' + c.callerName, to: c.calleeName, line: c.line },
                    c.callerFile, c.line,
                )),
                call_sites_total: calls.length,
                total: blast.length,
                max_depth: closure.maxDepth,
                by_depth: closure.byDepth,
                longest_chain: closure.longestChain,
                truncated: closure.truncated,
            };
        }
        case 'aura_find_dependencies': {
            const resolved = resolveFileArg(db, input.file as string);
            if (!resolved) {
                return { error: `File not found: ${input.file}. Ask the user for the exact path, or use aura_search_symbols to find it.` };
            }
            const deps = db.getDependencies(resolved, (input.depth as number) || 5);
            const closure = transitiveClosure(db.getEdges(), resolved, {
                direction: 'out',
                maxDepth: (input.depth as number) || 5,
            });
            const calls = db.getCallSites(resolved, 'out', 25);
            return {
                file: input.file,
                resolved_file: resolved,
                dependencies: deps.map(d => ({ file: d.id, depth: d.depth })),
                call_sites: calls.map(c => withAnchor(
                    { from: c.callerName, to: c.calleeFile + ':' + c.calleeName, line: c.line },
                    c.callerFile, c.line,
                )),
                call_sites_total: calls.length,
                total: deps.length,
                max_depth: closure.maxDepth,
                by_depth: closure.byDepth,
                longest_chain: closure.longestChain,
                truncated: closure.truncated,
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
                heritage: edges.map(e => withAnchor(
                    { source: e.source, target: e.target, type: e.type, label: e.label, line: e.line },
                    e.source, e.line,
                )),
                total: edges.length,
            };
        }
        case 'aura_generate_documentation': {
            const hotspotLimit = (input.hotspot_limit as number) || 15;
            const meta = db.getAllMeta();
            const overview = db.getArchitectureOverview();
            const communityData = db.getCommunitySnapshot();
            const modules = communityEntries(communityData)
                .filter(module => !module.others && module.files.length >= 2)
                .sort((a, b) => b.size - a.size);
            const singletons = communityData
                .filter(community => community.isOthers)
                .flatMap(community => community.files);
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
            const exempted = db.getExemptedCode();
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
                    exempted_total: exempted.length,
                },
                inter_module_links: interModuleLinks,
                note: 'Use this data to generate comprehensive project documentation. Modules represent dependency-coupled groups detected via Louvain algorithm. Hotspots are files with highest complexity × fan-in. Critical dependencies are files imported by the most other files.',
            };
        }
        case 'aura_get_communities': {
            const named = communityEntries(db.getCommunitySnapshot())
                .sort((a, b) => b.size - a.size);
            return {
                communities: named,
                total: named.length,
                note: 'Architectural communities from the shared code-only Louvain snapshot. Labels are full hub paths (or user renames); documentation and doc-reference edges are excluded from membership, fan-in and centrality.',
            };
        }
        case 'aura_get_architecture_violations': {
            // The evaluation lives in the host (rules + baseline are files, not DB
            // state); the provider is injected by the extension.
            if (!getArchitecture) {
                return { error: 'Architecture rules are not available in this context.' };
            }
            return getArchitecture(input);
        }
        default:
            return { error: `Unknown tool: ${name}` };
    }
}

/** Everything the git-backed tools need from the host (paths + live providers). */
export interface AuraToolDeps {
    /** Workspace / repository root the graph was built from. */
    root: string;
    /** `.aura/graph.db` path, for `aura_list_repositories`. */
    dbPath?: string;
    getRiskSnapshot?: (input?: Record<string, unknown>) => RiskSnapshot | undefined;
    getArchitecture?: (input: Record<string, unknown>) => unknown;
}

/** Risk entry → the short view the tools expose. */
function riskView(entry: RiskFileEntry) {
    return {
        score: entry.score,
        bucket: entry.bucket,
        reasons: entry.reasons.map(r => r.text),
    };
}

/** `aura_build` — is the analysed graph still in sync with the checkout? */
async function buildTool(db: GraphDB, deps: AuraToolDeps) {
    const status = buildStatusPayload({
        meta: db.getAllMeta(),
        currentHead: await readCurrentHead(deps.root),
    });
    return {
        ...status,
        root: deps.root || null,
        database: deps.dbPath || null,
        note: status.stale === true
            ? 'The graph does not describe the current commit: metrics, links and risk scores may be outdated. Ask the user to re-run the analysis before trusting precise numbers.'
            : 'Graph data and checkout match — values can be quoted as-is.',
    };
}

/** `aura_explain_file` — one aggregated briefing for a single file. */
function explainFileTool(db: GraphDB, input: Record<string, unknown>, deps: AuraToolDeps) {
    const resolved = resolveFileArg(db, String(input.file || ''));
    if (!resolved) {
        return { error: `File not found: ${input.file}. Ask the user for the exact path, or use aura_search_symbols to find it.` };
    }
    const detail = db.getNodeDetail(resolved);
    if (!detail) return { error: `File not found in the graph: ${resolved}` };

    const snapshot = deps.getRiskSnapshot?.();
    const riskEntry = snapshot?.byId.get(resolved);

    const cycles = db.getCycles().filter(cycle => cycle.includes(resolved));
    const dead = db.getDeadCode().filter(d => d.nodeId === resolved);
    const unused = db.getUnusedFunctions(resolved, true);
    const outgoing = db.getCallSites(resolved, 'out', 25);
    const incoming = db.getCallSites(resolved, 'in', 25);
    const heritage = db.getHeritage(resolved);
    const cochange = db.getCochange(500, 0)
        .filter(pair => pair.file_a === resolved || pair.file_b === resolved)
        .slice(0, 10)
        .map(pair => ({
            file: pair.file_a === resolved ? pair.file_b : pair.file_a,
            cochanges: pair.cochanges,
            jaccard: pair.jaccard,
            linked: !!pair.linked,
        }));
    const communities = db.getCommunities();
    const labels = db.getCommunityLabels();
    const communityId = communities.find(c => c.nodeId === resolved)?.community;
    const groups = new Map<string, number>();
    for (const symbol of detail.symbols) {
        groups.set(symbol.kind, (groups.get(symbol.kind) || 0) + 1);
    }

    return {
        file: input.file,
        resolved_file: resolved,
        language: detail.language,
        lines: detail.lines,
        size_bytes: detail.size,
        complexity: detail.complexity,
        cognitive: detail.cognitive,
        fan_in: detail.fan_in,
        fan_out: detail.fan_out,
        pagerank: detail.pagerank,
        directory: detail.group_name,
        last_modified: detail.last_modified ? new Date(detail.last_modified).toISOString() : null,
        risk: riskEntry
            ? { ...riskView(riskEntry), percentile: riskEntry.scorePct, top_label: riskEntry.topLabel, metrics: { lines: riskEntry.lines, complexity: riskEntry.complexity, fan_in: riskEntry.fanIn, fan_out: riskEntry.fanOut, churn: riskEntry.churn, authors: riskEntry.authorCount } }
            : null,
        risk_window_days: snapshot?.windowDays ?? null,
        symbols: {
            total: detail.symbols.length,
            kinds: Array.from(groups.entries()).map(([kind, count]) => ({ kind, count })),
        },
        dead_exports: dead.map(d => withAnchor({ symbol: d.symbol, kind: d.kind, line: d.line }, resolved, d.line)),
        unused_functions: unused.map(u => withAnchor({ name: u.name, kind: u.kind, line: u.line, visibility: u.visibility }, resolved, u.line)),
        call_sites: {
            outgoing: outgoing.map(c => withAnchor({ to: c.calleeFile + ':' + c.calleeName, line: c.line }, c.callerFile, c.line)),
            incoming: incoming.map(c => withAnchor({ from: c.callerFile + ':' + c.callerName, line: c.line }, c.callerFile, c.line)),
            outgoing_total: outgoing.length,
            incoming_total: incoming.length,
        },
        dependencies: detail.dependencies.slice(0, 40),
        dependents: detail.dependents.slice(0, 40),
        dependents_total: detail.dependents.length,
        dependencies_total: detail.dependencies.length,
        heritage: heritage.map(e => withAnchor({ source: e.source, target: e.target, type: e.type, line: e.line }, e.source === resolved ? e.source : e.target, e.line)),
        cycles: cycles.map(cycle => ({ files: cycle, length: cycle.length })),
        cochange,
        community: communityId === undefined ? null : { id: communityId, name: labels[String(communityId)] || null },
        note: 'Aggregated briefing: risk first, then structure, then history. Anchors are "file:line" and safe to quote in a review.',
    };
}

/** `aura_hotspots_in_changes` — risk × changed files. */
async function hotspotsInChangesTool(db: GraphDB, input: Record<string, unknown>, deps: AuraToolDeps) {
    const base = typeof input.base === 'string' ? input.base.trim() : '';
    const limit = (input.limit as number) || 25;
    let changed: ChangedFile[];
    let scope: string;
    if (base) {
        try {
            const diff = await readBranchDiff(deps.root, base);
            changed = diff.files.map(f => ({ file: f.path, status: String(f.status), additions: f.additions, deletions: f.deletions }));
            scope = `branch changes since ${diff.mergeBase.slice(0, 7)}`;
        } catch (error) {
            return { error: `Could not diff against "${base}": ${(error as Error).message}` };
        }
    } else {
        changed = await readWorkingTreeChanges(deps.root);
        scope = 'uncommitted working tree';
    }

    const snapshot = deps.getRiskSnapshot?.();
    const merged = mergeChangesWithRisk(
        changed,
        file => {
            const id = resolveFileArg(db, file);
            const entry = id ? snapshot?.byId.get(id) : undefined;
            return entry ? riskView(entry) : null;
        },
        limit,
    );

    return {
        scope,
        base: base || null,
        changes: merged.changes,
        total: merged.total,
        additions: merged.additions,
        deletions: merged.deletions,
        risky: merged.risky,
        note: merged.total === 0
            ? 'Nothing changed — the working tree is clean and matches HEAD.'
            : 'Ranked by risk score (files unknown to the graph come last). Start with the first row.',
    };
}

/** `aura_list_repositories` — which repo/worktree is Aura serving? */
async function listRepositoriesTool(db: GraphDB, deps: AuraToolDeps) {
    const status = buildStatusPayload({
        meta: db.getAllMeta(),
        currentHead: await readCurrentHead(deps.root),
    });
    const worktrees = deps.root ? await readWorktrees(deps.root) : [];
    return {
        root: deps.root || null,
        database: deps.dbPath || null,
        analyzed_at: status.analyzed_at,
        age_minutes: status.age_minutes,
        files: status.files,
        links: status.links,
        head_at_analysis: status.head_at_analysis,
        head_now: status.head_now,
        stale: status.stale,
        worktrees,
        worktrees_total: worktrees.length,
        note: worktrees.length > 1
            ? 'Several worktrees share this repository — check which path the task refers to before editing files.'
            : 'Single-worktree repository.',
    };
}

/**
 * Async entry point for every Aura tool: the git-backed tools (V3-16) need
 * `await`, the deterministic GraphDB ones are delegated to `runAuraTool`.
 */
export async function runAuraToolAsync(db: GraphDB, name: string, input: Record<string, unknown>, deps: AuraToolDeps): Promise<unknown> {
    switch (name) {
        case 'aura_build':
            return buildTool(db, deps);
        case 'aura_explain_file':
            return explainFileTool(db, input, deps);
        case 'aura_hotspots_in_changes':
            return hotspotsInChangesTool(db, input, deps);
        case 'aura_list_repositories':
            return listRepositoriesTool(db, deps);
        default:
            return runAuraTool(db, name, input, deps.getRiskSnapshot, deps.getArchitecture);
    }
}
