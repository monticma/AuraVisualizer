/**
 * context.ts — resolve_context ranking engine for the Aura MCP server.
 *
 * Deterministic (no LLM): tokenizes a natural-language task, gathers candidate
 * files from symbol names, file names/paths and documentation, then ranks them
 * by token-frequency-weighted hits + structural centrality (fan_in) + recency.
 *
 * Kept as a standalone module (no process-level side effects) so it can be
 * unit-tested and reused.
 */

import type { GraphDB } from '../graph-db';

/** Common English task verbs / noise words that don't identify files. */
const STOPWORDS = new Set([
    'add', 'the', 'a', 'an', 'to', 'in', 'of', 'for', 'and', 'or', 'with',
    'on', 'this', 'that', 'into', 'from', 'using', 'use', 'make', 'new',
    'fix', 'implement', 'create', 'change', 'update', 'remove', 'delete',
    'need', 'want', 'should', 'would', 'can', 'code', 'project', 'file',
    'files', 'how', 'what', 'where', 'which', 'when', 'why', 'do', 'does',
    'is', 'are', 'be', 'by', 'as', 'at', 'it', 'we', 'you', 'i', 'me',
]);

/**
 * Split a natural-language task into meaningful lowercase tokens:
 * splits camelCase / snake_case, drops stopwords and 1-char noise.
 */
export function tokenizeTask(text: string): string[] {
    if (!text) return [];
    const words = text
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')   // camelCase → camel Case
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // ACRONYMCase → ACRONYM Case
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(w => w.length > 1 && !STOPWORDS.has(w));
    return [...new Set(words)];
}

/** Matched symbol anchor (path:line target). */
export interface ContextAnchor {
    symbol: string;
    kind: string;
    line: number;
    visibility: string;
}

/** Matched documentation snippet. */
export interface ContextDocHit {
    section: string;
    line: number;
    excerpt: string;
}

/** Result shape returned by resolveContext. */
export interface ResolveContextResult {
    task: string;
    files: Array<{
        file: string;
        score: number;
        metrics?: { language: string; lines: number; complexity: number; fan_in: number; fan_out: number };
        anchors: ContextAnchor[];
        doc_hits: ContextDocHit[];
        neighborhood?: { dependencies: string[]; dependents: string[] };
    }>;
    note: string;
}

/**
 * resolve_context — the Aura equivalent of a task → context query.
 * Each top file is enriched with metrics, path:line anchors and a 1-hop
 * neighborhood so an AI agent gets ready-to-work context in one call.
 */
export function resolveContext(db: GraphDB, task: string, limit: number = 10): ResolveContextResult {
    const tokens = tokenizeTask(task);
    if (tokens.length === 0) {
        return {
            task,
            files: [],
            note: 'Could not extract meaningful keywords from the task. Try a more specific description (e.g. "add oauth login").',
        };
    }

    const allNodes = db.getAllNodes();
    const totalNodes = Math.max(allNodes.length, 1);

    interface Acc {
        score: number;
        symbols: Map<string, ContextAnchor>;
        docHits: ContextDocHit[];
    }
    const accs = new Map<string, Acc>();
    const acc = (fileId: string): Acc => {
        let a = accs.get(fileId);
        if (!a) {
            a = { score: 0, symbols: new Map(), docHits: [] };
            accs.set(fileId, a);
        }
        return a;
    };

    // Document frequency per token → IDF weight (rare tokens count more).
    const df = new Map<string, number>();
    for (const token of tokens) {
        const matched = new Set<string>();
        for (const s of db.searchSymbols(token)) matched.add(s.nodeId);
        for (const n of allNodes) {
            if (n.name.toLowerCase().includes(token) || n.id.toLowerCase().includes(token)) matched.add(n.id);
        }
        for (const d of db.searchDocs(token, 50)) matched.add(d.fileId);
        df.set(token, matched.size);
    }
    const idf = (token: string): number => {
        const d = df.get(token) || 0;
        return 1 + Math.log(totalNodes / (1 + d));
    };

    // 1. Symbol matches (strongest signal — carries exact line anchors)
    for (const token of tokens) {
        const w = idf(token);
        for (const s of db.searchSymbols(token)) {
            const exact = s.name.toLowerCase() === token;
            const a = acc(s.nodeId);
            a.score += (exact ? 10 : 5) * w;
            if (!a.symbols.has(s.name)) {
                a.symbols.set(s.name, { symbol: s.name, kind: s.kind, line: s.line, visibility: s.visibility });
            }
        }
    }

    // 2. File name / path matches
    for (const token of tokens) {
        const w = idf(token);
        for (const n of allNodes) {
            const base = n.name.toLowerCase();
            const path = n.id.toLowerCase();
            if (base === token) acc(n.id).score += 8 * w;
            else if (base.includes(token)) acc(n.id).score += 6 * w;
            else if (path.includes(token)) acc(n.id).score += 4 * w;
        }
    }

    // 3. Documentation matches
    for (const token of tokens) {
        const w = idf(token);
        for (const d of db.searchDocs(token, 20)) {
            const a = acc(d.fileId);
            a.score += 3 * w;
            if (a.docHits.length < 5) {
                a.docHits.push({ section: d.section, line: d.lineStart, excerpt: d.content.slice(0, 200) });
            }
        }
    }

    // 4. Structural centrality (fan_in) + recency (last_modified) — PageRank/churn substitutes
    let maxFanIn = 1;
    let maxLastModified = 1;
    for (const n of allNodes) {
        if (n.fan_in > maxFanIn) maxFanIn = n.fan_in;
        if (n.last_modified > maxLastModified) maxLastModified = n.last_modified;
    }
    const nodeById = new Map(allNodes.map(n => [n.id, n]));
    for (const [id, a] of accs) {
        const n = nodeById.get(id);
        if (!n) continue;
        a.score += 5 * (n.fan_in / maxFanIn);
        a.score += 2 * (n.last_modified / maxLastModified);
    }

    // Rank deterministically (score desc, then path asc)
    const ranked = [...accs.entries()]
        .map(([file, a]) => ({ file, a }))
        .sort((x, y) => y.a.score - x.a.score || x.file.localeCompare(y.file))
        .slice(0, limit);

    const files = ranked.map(({ file, a }) => {
        const detail = db.getNodeDetail(file);
        return {
            file,
            score: Math.round(a.score * 100) / 100,
            metrics: detail
                ? {
                    language: detail.language,
                    lines: detail.lines,
                    complexity: detail.complexity,
                    fan_in: detail.fan_in,
                    fan_out: detail.fan_out,
                }
                : undefined,
            anchors: [...a.symbols.values()],
            doc_hits: a.docHits,
            neighborhood: detail
                ? {
                    dependencies: detail.dependencies.slice(0, 12),
                    dependents: detail.dependents.slice(0, 12),
                }
                : undefined,
        };
    });

    return {
        task,
        files,
        note: 'Deterministic ranking: symbol matches (×10 exact / ×5 substring), filename (×8/×6/×4), docs (×3), weighted by token frequency (IDF), plus fan_in and recency. No LLM involved.',
    };
}
