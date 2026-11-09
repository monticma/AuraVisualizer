/**
 * risk-service.ts — Host-side risk computation.
 *
 * Builds the exact same scores / buckets / reasons the Risk tab shows, so surfaces
 * without a webview (status bar today, MCP tools next) can reuse them. Pure module:
 * no `vscode` import, unit-testable.
 */

import {
    buildRenameResolver,
    buildRiskPercentiles,
    computeRiskScore,
    isFixCommit,
    percentileLookup,
    riskBucket,
    riskReasons,
    topPercentLabel,
    type RiskBucket,
    type RiskGitStats,
    type RiskNode,
    type RiskReason,
} from './risk-core';

export interface RiskServiceNode extends RiskNode {
    id: string;
    path?: string;
    language?: string;
}

export interface RiskServiceCommit {
    date: string;
    author?: string;
    /** Commit subject — scanned for the bug-fix signal. */
    message?: string;
    files?: {
        path?: string;
        oldPath?: string;
        status?: string;
        /** From `git --numstat` (undefined on older caches). */
        additions?: number;
        deletions?: number;
    }[];
}

export interface RiskSnapshotOptions {
    /** Use PageRank instead of fan-in in the structural half. */
    centrality?: boolean;
    /** Regex matched against commit messages to recognise bug fixes. */
    fixKeywords?: string;
}

export interface RiskFileEntry {
    id: string;
    score: number;
    /** Percentile of the score inside the repository (0 = lowest, 1 = highest). */
    scorePct: number;
    /** "top 8%" / "the highest" / null when the rank carries no information. */
    topLabel: string | null;
    bucket: RiskBucket;
    reasons: RiskReason[];
    /** Raw metrics, carried along for tool responses (MCP / LM tools / chat). */
    lines: number;
    complexity: number;
    fanIn: number;
    fanOut: number;
    /** Commits in the selected window. */
    churn: number;
    /** (lines added + removed) / current size, inside the window. */
    relChurn: number;
    /** Share of windowed commits whose message reads like a bug fix (0..1). */
    fixRatio: number;
    /** Distinct authors across the whole history. */
    authorCount: number;
}

export interface RiskSnapshot {
    windowDays: number;
    byId: Map<string, RiskFileEntry>;
    highIds: Set<string>;
    avgScore: number;
}

interface GitStats {
    /** Commits inside the selected window (mirrors the webview's computeChurnIndex). */
    commits: number;
    /** Distinct authors across ALL history, like the webview. */
    authors: Set<string>;
    /** Lines added + removed inside the window. */
    changedLines: number;
    /** Recency-weighted commit sum inside the window (1 = today). */
    recency: number;
    /** Commits inside the window whose message reads like a bug fix. */
    fixCommits: number;
}

/**
 * Compute the risk snapshot for a set of nodes and commits.
 *
 * The churn semantics deliberately mirror `computeChurnIndex` in the webview:
 * commit counts are windowed, author counts are not, and invalid commit dates
 * count as "outside the window" but still register their author. Git renames
 * are followed, so history under a previous path still counts for the file.
 */
export function buildRiskSnapshot(
    nodes: RiskServiceNode[],
    commits: RiskServiceCommit[],
    windowDays: number,
    now: number = Date.now(),
    options: RiskSnapshotOptions = {},
): RiskSnapshot {
    const centrality = options.centrality === true;
    const dayMs = 24 * 60 * 60 * 1000;
    const cutoff = now - windowDays * dayMs;
    const windowMs = Math.max(1, windowDays * dayMs);

    // Follow git renames so a moved file keeps its history (mirrors the webview).
    const resolvePath = buildRenameResolver(commits);

    const git = new Map<string, GitStats>();
    for (const commit of commits) {
        let when = new Date(commit.date).getTime();
        if (isNaN(when)) when = 0;
        const inWindow = when >= cutoff;
        const author = commit.author || 'unknown';
        const isFix = isFixCommit(commit.message || '', options.fixKeywords);
        // A commit made today weighs 1, one at the window's edge ~0.
        const recency = inWindow ? Math.max(0, 1 - (now - when) / windowMs) : 0;
        for (const file of commit.files || []) {
            const raw = file.path;
            if (!raw) continue;
            const p = resolvePath(raw);
            let entry = git.get(p);
            if (!entry) {
                entry = { commits: 0, authors: new Set(), changedLines: 0, recency: 0, fixCommits: 0 };
                git.set(p, entry);
            }
            if (inWindow) {
                entry.commits++;
                entry.changedLines += (file.additions || 0) + (file.deletions || 0);
                entry.recency += recency;
                if (isFix) entry.fixCommits++;
            }
            entry.authors.add(author);
        }
    }

    const statsOf = (node: RiskServiceNode): GitStats | undefined =>
        (node.id ? git.get(node.id) : undefined) || (node.path ? git.get(node.path) : undefined);

    /** Public, percentile-ready view of a file's history. */
    const gitStatsOf = (node: RiskNode): RiskGitStats => {
        const s = statsOf(node as RiskServiceNode);
        if (!s) return { commits: 0 };
        const lines = node.linesOfCode || 0;
        return {
            commits: s.commits,
            // Lines moved relative to the size today: "rewritten 2×" = 2.
            relChurn: lines > 0 ? s.changedLines / lines : 0,
            recency: s.recency,
            authors: s.authors.size,
            fixRatio: s.commits > 0 ? s.fixCommits / s.commits : 0,
        };
    };

    // Documentation is not architecture: keep it out of percentiles and rankings.
    const architecturalNodes = nodes.filter(node => node.language !== 'documentation');
    const pct = buildRiskPercentiles(architecturalNodes, gitStatsOf);

    const raw: { node: RiskServiceNode; score: number }[] = [];
    for (const n of architecturalNodes) {
        raw.push({ node: n, score: computeRiskScore(n, pct, gitStatsOf(n), { centrality }) });
    }

    const scorePct = percentileLookup(raw.map(r => r.score));
    const byId = new Map<string, RiskFileEntry>();
    const highIds = new Set<string>();
    let total = 0;

    for (const r of raw) {
        total += r.score;
        const stats = gitStatsOf(r.node);
        const lines = r.node.linesOfCode || 0;
        const p = scorePct(r.score);
        const entry: RiskFileEntry = {
            id: r.node.id,
            score: r.score,
            scorePct: p,
            topLabel: topPercentLabel(p),
            bucket: riskBucket(r.score),
            reasons: riskReasons(r.node, pct, {
                windowDays,
                churn: stats.commits || 0,
                authorCount: stats.authors || 0,
                centrality,
                relChurn: stats.relChurn,
                fixRatio: stats.fixRatio,
            }),
            lines,
            complexity: r.node.complexity || 0,
            fanIn: r.node.fanIn || 0,
            fanOut: r.node.fanOut || 0,
            churn: stats.commits || 0,
            relChurn: stats.relChurn || 0,
            fixRatio: stats.fixRatio || 0,
            authorCount: stats.authors || 0,
        };
        byId.set(r.node.id, entry);
        if (entry.bucket === 'high') highIds.add(r.node.id);
    }

    return { windowDays, byId, highIds, avgScore: raw.length ? total / raw.length : 0 };
}

export interface RiskHotspot {
    file: string;
    risk_score: number;
    bucket: RiskBucket;
    top: string | null;
    reasons: string[];
    lines: number;
    complexity: number;
    fan_in: number;
    fan_out: number;
}

export interface RiskHotspotsPayload {
    sort: 'risk';
    window_days: number;
    total: number;
    hotspots: RiskHotspot[];
}

/** Top-N by risk score — the shared response shape for MCP, LM tools and chat. */
export function topRiskHotspots(snapshot: RiskSnapshot, limit: number): RiskHotspotsPayload {
    const entries = Array.from(snapshot.byId.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, Math.max(1, Math.round(limit)));
    return {
        sort: 'risk',
        window_days: snapshot.windowDays,
        total: entries.length,
        hotspots: entries.map(e => ({
            file: e.id,
            risk_score: Math.round(e.score * 10) / 10,
            bucket: e.bucket,
            top: e.topLabel,
            reasons: e.reasons.map(r => r.text),
            lines: e.lines,
            complexity: e.complexity,
            fan_in: e.fanIn,
            fan_out: e.fanOut,
        })),
    };
}
