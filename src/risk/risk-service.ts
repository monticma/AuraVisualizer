/**
 * risk-service.ts — Host-side risk computation.
 *
 * Builds the exact same scores / buckets / reasons the Risk tab shows, so surfaces
 * without a webview (status bar today, MCP tools next) can reuse them. Pure module:
 * no `vscode` import, unit-testable.
 */

import {
    buildRiskPercentiles,
    computeRiskScore,
    percentileLookup,
    riskBucket,
    riskReasons,
    topPercentLabel,
    type RiskBucket,
    type RiskNode,
    type RiskReason,
} from './risk-core';

export interface RiskServiceNode extends RiskNode {
    id: string;
    path?: string;
}

export interface RiskServiceCommit {
    date: string;
    author?: string;
    files?: { path?: string }[];
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
}

export interface RiskSnapshot {
    windowDays: number;
    byId: Map<string, RiskFileEntry>;
    highIds: Set<string>;
    avgScore: number;
}

interface ChurnStats {
    /** Commits inside the selected window (mirrors the webview's computeChurnIndex). */
    commits: number;
    /** Distinct authors across ALL history, like the webview. */
    authors: Set<string>;
}

/**
 * Compute the risk snapshot for a set of nodes and commits.
 *
 * The churn semantics deliberately mirror `computeChurnIndex` in the webview:
 * commit counts are windowed, author counts are not, and invalid commit dates
 * count as "outside the window" but still register their author.
 */
export function buildRiskSnapshot(
    nodes: RiskServiceNode[],
    commits: RiskServiceCommit[],
    windowDays: number,
    now: number = Date.now()
): RiskSnapshot {
    const dayMs = 24 * 60 * 60 * 1000;
    const cutoff = now - windowDays * dayMs;

    const churn = new Map<string, ChurnStats>();
    for (const commit of commits) {
        let when = new Date(commit.date).getTime();
        if (isNaN(when)) when = 0;
        const inWindow = when >= cutoff;
        const author = commit.author || 'unknown';
        for (const file of commit.files || []) {
            const p = file.path;
            if (!p) continue;
            let entry = churn.get(p);
            if (!entry) { entry = { commits: 0, authors: new Set() }; churn.set(p, entry); }
            if (inWindow) entry.commits++;
            entry.authors.add(author);
        }
    }

    const churnOf = (node: RiskServiceNode): number => {
        const a = node.id ? churn.get(node.id) : undefined;
        const b = node.path ? churn.get(node.path) : undefined;
        return (a ? a.commits : 0) || (b ? b.commits : 0);
    };
    const statsOf = (node: RiskServiceNode): ChurnStats | undefined =>
        (node.id ? churn.get(node.id) : undefined) || (node.path ? churn.get(node.path) : undefined);

    const pct = buildRiskPercentiles(nodes, churnOf);

    const raw: { node: RiskServiceNode; score: number }[] = [];
    for (const n of nodes) {
        raw.push({ node: n, score: computeRiskScore(n, pct, churnOf(n)) });
    }

    const scorePct = percentileLookup(raw.map(r => r.score));
    const byId = new Map<string, RiskFileEntry>();
    const highIds = new Set<string>();
    let total = 0;

    for (const r of raw) {
        total += r.score;
        const stats = statsOf(r.node);
        const p = scorePct(r.score);
        const entry: RiskFileEntry = {
            id: r.node.id,
            score: r.score,
            scorePct: p,
            topLabel: topPercentLabel(p),
            bucket: riskBucket(r.score),
            reasons: riskReasons(r.node, pct, {
                windowDays,
                churn: churnOf(r.node),
                authorCount: stats ? stats.authors.size : 0,
            }),
        };
        byId.set(r.node.id, entry);
        if (entry.bucket === 'high') highIds.add(r.node.id);
    }

    return { windowDays, byId, highIds, avgScore: raw.length ? total / raw.length : 0 };
}
