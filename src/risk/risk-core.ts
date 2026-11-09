/**
 * AuraVisualizer — Risk core (shared).
 *
 * Single source of truth for the Risk Map scoring: percentile ranking inside the
 * repository, the weighted 0..100 score and the plain-language reasons.
 *
 * It is bundled twice by esbuild:
 *   - into the extension host (`out/extension.js`) — status bar, MCP/LM tools;
 *   - into the webview as `window.AuraRisk` (`out/webview/js/risk-core.js`) — Risk tab.
 *
 * Keep this module dependency-free (no `vscode`, no DOM): it runs in Node and in
 * the browser.
 */

export const RISK_WINDOWS = [30, 90, 365];

export const DEFAULT_RISK_WINDOW = 90;

/** Churn scale at which the score saturates when percentiles are unavailable. */
export const CHURN_CAP = 20;

/**
 * Everything git history knows about one file. The score used to take a bare
 * commit count; a hotspot is not "changed often" but "reworked", so the volume
 * of lines and the nature of the commits matter just as much.
 */
export interface RiskGitStats {
    /** Commits touching the file inside the window. */
    commits: number;
    /**
     * Sum of `(added + removed)` lines inside the window, relative to the file's
     * size today: 2 means the file was rewritten twice over.
     */
    relChurn?: number;
    /**
     * Recency-weighted commit sum inside the window: a commit made today counts
     * 1, one at the window's edge counts ~0. Distinguishes a file being hammered
     * now from one that was hot three months ago.
     */
    recency?: number;
    /** Distinct authors across the whole history. */
    authors?: number;
    /** Share of windowed commits whose message looks like a bug fix (0..1). */
    fixRatio?: number;
}

/** Accept the legacy "bare churn number" call shape or a full stats object. */
export function asGitStats(input: RiskGitStats | number | null | undefined): RiskGitStats {
    if (typeof input === 'number') return { commits: input };
    if (!input) return { commits: 0 };
    return input;
}

/**
 * Message patterns that make a commit a bug fix. Configurable (`fixKeywords`),
 * matched case-insensitively; an invalid user pattern falls back to the default
 * instead of throwing.
 */
export const DEFAULT_FIX_KEYWORDS = '\\b(fix|fixes|fixed|bug|bugs|hotfix|regress|regression|revert)\\b';

const fixRegexCache = new Map<string, RegExp | null>();

function compileFixPattern(pattern?: string): RegExp | null {
    const key = pattern || DEFAULT_FIX_KEYWORDS;
    if (fixRegexCache.has(key)) return fixRegexCache.get(key)!;
    let compiled: RegExp | null = null;
    try {
        compiled = new RegExp(key, 'i');
    } catch {
        compiled = null;
    }
    fixRegexCache.set(key, compiled);
    return compiled;
}

/** True when a commit message reads like a bug fix ("fix crash on save"). */
export function isFixCommit(message: string, pattern?: string): boolean {
    if (!message) return false;
    let re = compileFixPattern(pattern);
    if (!re) re = compileFixPattern(undefined); // invalid custom pattern → default
    return !!re && re.test(message);
}

/**
 * Score weights (v2). They sum to 1 and are exported so the tests, the reasons
 * and the documentation cannot drift apart. The structural half stays dominant
 * on purpose: Aura is an architecture tool, git history refines the ranking
 * rather than driving it.
 */
export const RISK_WEIGHTS = {
    complexity: 0.21,
    /** Fan-in, or PageRank when `riskCentrality` is on. */
    centrality: 0.18,
    fanOut: 0.08,
    cycle: 0.12,
    deadCode: 0.12,
    relChurn: 0.09,
    recency: 0.06,
    frequency: 0.06,
    authors: 0.05,
    fixRatio: 0.03,
} as const;

export interface RiskNode {
    complexity?: number;
    fanIn?: number;
    fanOut?: number;
    /** PageRank score when available (V2-16). */
    pagerank?: number;
    cycleIds?: unknown[];
    deadExports?: unknown[];
    symbols?: { totalSymbols?: number };
    linesOfCode?: number;
}

export interface RiskPercentiles {
    complexity: (v: number) => number;
    fanIn: (v: number) => number;
    fanOut: (v: number) => number;
    churn: (v: number) => number;
    /** PageRank percentile, available when nodes carry pagerank. */
    centrality?: (v: number) => number;
    /** Rewrite volume percentile (see `RiskGitStats.relChurn`). */
    relChurn?: (v: number) => number;
    /** Recency-weighted commits percentile. */
    recency?: (v: number) => number;
    /** Author-count percentile. */
    authors?: (v: number) => number;
    /** Bug-fix ratio percentile. */
    fixRatio?: (v: number) => number;
}

export interface RiskReason {
    weight: number;
    text: string;
}

export interface RiskReasonContext {
    /** Git history window (days) used for the churn wording. */
    windowDays: number;
    /** Commits touching the file inside the window. */
    churn: number;
    /** Distinct authors touching the file inside the window. */
    authorCount: number;
    /** Use PageRank percentile instead of fan-in (optional V2-16 factor). */
    centrality?: boolean;
    /** Rewrite volume: (added + removed) / current size, inside the window. */
    relChurn?: number;
    /** Share of windowed commits whose message reads like a bug fix (0..1). */
    fixRatio?: number;
}

/** Validate a risk window value against RISK_WINDOWS (settings can hold anything). */
export function normalizeRiskWindow(value: unknown): number {
    return typeof value === 'number' && RISK_WINDOWS.indexOf(value) !== -1
        ? value
        : DEFAULT_RISK_WINDOW;
}

/**
 * Turn a metric's values into a percentile lookup (0 = lowest, 1 = highest).
 * Ties are excluded from the denominator on purpose: a metric that is 0 for 90 %
 * of the files must stay at the 0th percentile for those files, instead of
 * jumping to the 90th just because most files are tied at zero.
 */
export function percentileLookup(values: number[]): (v: number) => number {
    const sorted = values.slice().sort((a, b) => a - b);
    return (v: number): number => {
        const n = sorted.length;
        if (n === 0) return 0;
        let lo = 0, hi = n;
        while (lo < hi) { // first index whose value is >= v
            const mid = (lo + hi) >> 1;
            if (sorted[mid] < v) lo = mid + 1; else hi = mid;
        }
        const less = lo;
        let lo2 = less, hi2 = n;
        while (lo2 < hi2) { // first index whose value is > v
            const mid2 = (lo2 + hi2) >> 1;
            if (sorted[mid2] <= v) lo2 = mid2 + 1; else hi2 = mid2;
        }
        const equal = lo2 - less;
        const denom = n - equal;
        if (denom <= 0) return 0;
        return Math.min(1, less / denom);
    };
}

/**
 * Rank every structural **and git** metric against the files of *this*
 * repository. `gitOf` may return a bare commit count (legacy call shape) or a
 * full `RiskGitStats`.
 */
export function buildRiskPercentiles(
    nodes: RiskNode[],
    gitOf: (node: RiskNode) => RiskGitStats | number
): RiskPercentiles {
    const complexity: number[] = [], fanIn: number[] = [], fanOut: number[] = [], churn: number[] = [];
    const pagerank: number[] = [];
    const relChurn: number[] = [], recency: number[] = [], authors: number[] = [], fixRatio: number[] = [];
    for (const n of nodes) {
        const git = asGitStats(gitOf(n));
        complexity.push(n.complexity || 0);
        fanIn.push(n.fanIn || 0);
        fanOut.push(n.fanOut || 0);
        churn.push(git.commits || 0);
        pagerank.push(typeof n.pagerank === 'number' ? n.pagerank : 0);
        relChurn.push(git.relChurn || 0);
        recency.push(git.recency || 0);
        authors.push(git.authors || 0);
        fixRatio.push(git.fixRatio || 0);
    }
    return {
        complexity: percentileLookup(complexity),
        fanIn: percentileLookup(fanIn),
        fanOut: percentileLookup(fanOut),
        churn: percentileLookup(churn),
        centrality: percentileLookup(pagerank),
        relChurn: percentileLookup(relChurn),
        recency: percentileLookup(recency),
        authors: percentileLookup(authors),
        fixRatio: percentileLookup(fixRatio),
    };
}

/** 0.94 → "top 6%". Returns null when the rank carries no information. */
export function topPercentLabel(p: number): string | null {
    const pc = Math.round((1 - p) * 100);
    if (pc <= 0) return 'the highest';
    if (pc >= 100) return null;
    return 'top ' + pc + '%';
}

/** Bucket thresholds on the 0..100 score — shared by the Risk tab, the status bar and reports. */
export const RISK_HIGH_THRESHOLD = 66;
export const RISK_MEDIUM_THRESHOLD = 33;

export type RiskBucket = 'high' | 'medium' | 'low';

export function riskBucket(score: number): RiskBucket {
    return score >= RISK_HIGH_THRESHOLD ? 'high' : (score >= RISK_MEDIUM_THRESHOLD ? 'medium' : 'low');
}

/**
 * Risk score (v2). Every component is a **percentile rank inside this
 * repository**, so a score of 72 means the same thing in a 50-file project and in
 * a 5 000-file one — it is a standing relative to the codebase rather than an
 * absolute threshold. Cycle and dead code are 0..1 by nature.
 *
 * Two halves: the structure (complexity, fan-in, fan-out, cycles, dead code) and
 * the history (rewrite volume, recency, frequency, authors, bug fixes). The
 * structural half dominates on purpose — Aura ranks *architecture*, git history
 * refines it.
 */
export function computeRiskScore(
    node: RiskNode,
    pct: RiskPercentiles | null | undefined,
    git: RiskGitStats | number | null | undefined,
    options: { centrality?: boolean } = {},
): number {
    const stats = asGitStats(git);
    const complexity = node.complexity || 0;
    const fanIn = node.fanIn || 0;
    const fanOut = node.fanOut || 0;
    const commits = stats.commits || 0;
    const relChurn = stats.relChurn || 0;
    const recency = stats.recency || 0;
    const authors = stats.authors || 0;
    const fixRatio = stats.fixRatio || 0;

    const complexityP = pct ? pct.complexity(complexity) : Math.min(complexity / 50, 1);
    const fanInP = pct ? pct.fanIn(fanIn) : Math.min(fanIn / 20, 1);
    const fanOutP = pct ? pct.fanOut(fanOut) : Math.min(fanOut / 30, 1);
    const churnP = pct ? pct.churn(commits) : Math.min(commits / CHURN_CAP, 1);
    const relChurnP = pct?.relChurn ? pct.relChurn(relChurn) : Math.min(relChurn, 1);
    const recencyP = pct?.recency ? pct.recency(recency) : 0;
    const authorsP = pct?.authors ? pct.authors(authors) : 0;
    const fixRatioP = pct?.fixRatio ? pct.fixRatio(fixRatio) : fixRatio;
    const centralityEnabled = options.centrality === true && !!pct?.centrality;
    const centralityP = centralityEnabled && pct?.centrality
        ? pct.centrality(node.pagerank || 0)
        : 0;
    const inCycle = (node.cycleIds && node.cycleIds.length > 0) ? 1 : 0;
    const totalSymbols = (node.symbols && node.symbols.totalSymbols) || 0;
    const deadCount = (node.deadExports && node.deadExports.length) || 0;
    const deadRatio = totalSymbols > 0 ? Math.min(deadCount / totalSymbols, 1) : 0;

    const w = RISK_WEIGHTS;
    return 100 * (
        w.complexity * complexityP +
        w.centrality * (centralityEnabled ? centralityP : fanInP) +
        w.fanOut * fanOutP +
        w.cycle * inCycle +
        w.deadCode * deadRatio +
        w.relChurn * relChurnP +
        w.recency * recencyP +
        w.frequency * churnP +
        w.authors * authorsP +
        w.fixRatio * fixRatioP
    );
}

/**
 * Plain-language reasons behind a file's score, with the real numbers
 * ("changed 29 times in 90 days (top 1% of the repo)"). Sorted by contribution,
 * so the most decisive factor comes first.
 */
export function riskReasons(
    node: RiskNode,
    pct: RiskPercentiles | null | undefined,
    ctx: RiskReasonContext
): RiskReason[] {
    const reasons: RiskReason[] = [];
    const w = RISK_WEIGHTS;
    const complexity = node.complexity || 0;
    const fanIn = node.fanIn || 0;
    const fanOut = node.fanOut || 0;
    const churn = ctx.churn || 0;
    const relChurn = ctx.relChurn || 0;
    const fixRatio = ctx.fixRatio || 0;
    const totalSymbols = (node.symbols && node.symbols.totalSymbols) || 0;
    const deadCount = (node.deadExports && node.deadExports.length) || 0;
    const authorCount = ctx.authorCount || 0;
    let lbl: string | null;

    if (complexity > 0) {
        const pC = pct ? pct.complexity(complexity) : 0;
        lbl = topPercentLabel(pC);
        reasons.push({ weight: w.complexity * pC, text: 'complexity ' + complexity + (lbl ? ' (' + lbl + ' of the repo)' : '') });
    }
    if (fanIn > 0 || (ctx.centrality && node.pagerank && pct?.centrality)) {
        if (ctx.centrality && pct?.centrality && node.pagerank) {
            const pCentrality = pct.centrality(node.pagerank);
            const centralityLabel = topPercentLabel(pCentrality);
            reasons.push({
                weight: w.centrality * pCentrality,
                text: 'centrality' + (centralityLabel ? ' ' + centralityLabel : '') +
                    ' (PageRank ' + node.pagerank.toFixed(4) + ')',
            });
        } else {
            const pI = pct ? pct.fanIn(fanIn) : 0;
            lbl = topPercentLabel(pI);
            reasons.push({ weight: w.centrality * pI, text: fanIn + (fanIn === 1 ? ' file depends on it' : ' files depend on it') + (lbl ? ' (' + lbl + ')' : '') });
        }
    }
    // Rewrite volume: the half of a hotspot that a commit count misses.
    if (relChurn >= 0.1) {
        const pRc = pct?.relChurn ? pct.relChurn(relChurn) : Math.min(relChurn, 1);
        lbl = topPercentLabel(pRc);
        const times = relChurn >= 10 ? String(Math.round(relChurn)) : relChurn.toFixed(1);
        reasons.push({
            weight: w.relChurn * pRc,
            text: 'rewritten ' + times + '\u00d7 in ' + ctx.windowDays + ' days' + (lbl ? ' (' + lbl + ')' : ''),
        });
    }
    if (churn > 0) {
        const pCh = pct ? pct.churn(churn) : 0;
        lbl = topPercentLabel(pCh);
        reasons.push({ weight: w.frequency * pCh, text: 'changed ' + churn + ' time' + (churn === 1 ? '' : 's') + ' in ' + ctx.windowDays + ' days' + (lbl ? ' (' + lbl + ')' : '') });
    }
    if (authorCount > 1) {
        const pA = pct?.authors ? pct.authors(authorCount) : 0;
        lbl = topPercentLabel(pA);
        reasons.push({
            weight: w.authors * pA,
            text: authorCount + ' authors' + (lbl ? ' (' + lbl + ')' : ''),
        });
    } else if (authorCount === 1) {
        reasons.push({ weight: 0, text: 'single author' });
    }
    if (fixRatio > 0) {
        const pF = pct?.fixRatio ? pct.fixRatio(fixRatio) : fixRatio;
        lbl = topPercentLabel(pF);
        reasons.push({
            weight: w.fixRatio * pF,
            text: Math.round(fixRatio * 100) + '% of its commits are fixes' + (lbl ? ' (' + lbl + ')' : ''),
        });
    }
    if (fanOut > 0) {
        const pO = pct ? pct.fanOut(fanOut) : 0;
        reasons.push({ weight: w.fanOut * pO, text: 'depends on ' + fanOut + ' file' + (fanOut === 1 ? '' : 's') });
    }
    if (node.cycleIds && node.cycleIds.length > 0) {
        reasons.push({ weight: w.cycle, text: 'in a dependency cycle' });
    }
    if (deadCount > 0) {
        const ratio = totalSymbols > 0 ? deadCount / totalSymbols : 0;
        reasons.push({ weight: w.deadCode * ratio, text: deadCount + ' unused symbol' + (deadCount === 1 ? '' : 's') + ' of ' + totalSymbols });
    }
    reasons.sort((a, b) => b.weight - a.weight);
    return reasons;
}

export function riskReasonsText(reasons: RiskReason[], separator: string): string {
    const parts: string[] = [];
    for (const r of reasons) parts.push(r.text);
    return parts.join(separator);
}

// ============================================================
// Rename resolution (git history → churn attribution)
// ============================================================

/** Minimal commit shape needed to follow renames (shared by host and webview). */
export interface CommitLike {
    files?: { status?: string; path?: string; oldPath?: string }[];
}

/**
 * Build a path resolver that follows git renames so a file's history survives
 * a move (`git mv`): churn, authors and "recently hot" stay attached to the
 * current path. Chains collapse (a→b then b→c ⇒ a⇒c) and cycles are broken
 * safely. Commits must be newest-first (git log order); when a historical path
 * was reused by several files, the most recent rename wins.
 */
export function buildRenameResolver(commits: CommitLike[]): (path: string) => string {
    const map = new Map<string, string>();
    for (const commit of commits) {
        for (const f of commit.files || []) {
            if (f.status === 'R' && f.oldPath && f.path && f.oldPath !== f.path && !map.has(f.oldPath)) {
                map.set(f.oldPath, f.path);
            }
        }
    }
    const cache = new Map<string, string>();
    return (path: string): string => {
        const hit = cache.get(path);
        if (hit !== undefined) return hit;
        let cur = path;
        const seen = new Set<string>([cur]);
        while (map.has(cur)) {
            const next = map.get(cur)!;
            if (seen.has(next)) break; // rename cycle — stop before looping
            seen.add(next);
            cur = next;
        }
        cache.set(path, cur);
        return cur;
    };
}
