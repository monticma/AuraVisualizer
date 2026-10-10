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

export interface RiskNode {
    complexity?: number;
    fanIn?: number;
    fanOut?: number;
    cycleIds?: string[];
    deadExports?: unknown[];
    symbols?: { totalSymbols?: number };
}

export interface RiskPercentiles {
    complexity: (v: number) => number;
    fanIn: (v: number) => number;
    fanOut: (v: number) => number;
    churn: (v: number) => number;
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

/** Rank every structural metric against the files of *this* repository. */
export function buildRiskPercentiles(
    nodes: RiskNode[],
    churnOf: (node: RiskNode) => number
): RiskPercentiles {
    const complexity: number[] = [], fanIn: number[] = [], fanOut: number[] = [], churn: number[] = [];
    for (const n of nodes) {
        complexity.push(n.complexity || 0);
        fanIn.push(n.fanIn || 0);
        fanOut.push(n.fanOut || 0);
        churn.push(churnOf(n) || 0);
    }
    return {
        complexity: percentileLookup(complexity),
        fanIn: percentileLookup(fanIn),
        fanOut: percentileLookup(fanOut),
        churn: percentileLookup(churn),
    };
}

/** 0.94 → "top 6%". Returns null when the rank carries no information. */
export function topPercentLabel(p: number): string | null {
    const pc = Math.round((1 - p) * 100);
    if (pc <= 0) return 'the highest';
    if (pc >= 100) return null;
    return 'top ' + pc + '%';
}

/**
 * Risk score. Complexity, fan-in, fan-out and churn are **percentile ranks inside
 * this repository**, so a score of 72 means the same thing in a 50-file project
 * and in a 5 000-file one — it is a standing relative to the codebase rather than
 * an absolute threshold. Cycle and dead-code are already 0..1 by nature.
 */
export function computeRiskScore(
    node: RiskNode,
    pct: RiskPercentiles | null | undefined,
    churn: number
): number {
    const complexity = node.complexity || 0;
    const fanIn = node.fanIn || 0;
    const fanOut = node.fanOut || 0;
    const complexityP = pct ? pct.complexity(complexity) : Math.min(complexity / 50, 1);
    const fanInP = pct ? pct.fanIn(fanIn) : Math.min(fanIn / 20, 1);
    const fanOutP = pct ? pct.fanOut(fanOut) : Math.min(fanOut / 30, 1);
    const churnP = pct ? pct.churn(churn) : Math.min(churn / CHURN_CAP, 1);
    const inCycle = (node.cycleIds && node.cycleIds.length > 0) ? 1 : 0;
    const totalSymbols = (node.symbols && node.symbols.totalSymbols) || 0;
    const deadCount = (node.deadExports && node.deadExports.length) || 0;
    const deadRatio = totalSymbols > 0 ? Math.min(deadCount / totalSymbols, 1) : 0;
    return 100 * (
        0.30 * complexityP +
        0.20 * fanInP +
        0.10 * fanOutP +
        0.15 * inCycle +
        0.15 * deadRatio +
        0.10 * churnP
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
    const complexity = node.complexity || 0;
    const fanIn = node.fanIn || 0;
    const fanOut = node.fanOut || 0;
    const churn = ctx.churn || 0;
    const totalSymbols = (node.symbols && node.symbols.totalSymbols) || 0;
    const deadCount = (node.deadExports && node.deadExports.length) || 0;
    const authorCount = ctx.authorCount || 0;
    let lbl: string | null;

    if (complexity > 0) {
        const pC = pct ? pct.complexity(complexity) : 0;
        lbl = topPercentLabel(pC);
        reasons.push({ weight: 0.30 * pC, text: 'complexity ' + complexity + (lbl ? ' (' + lbl + ' of the repo)' : '') });
    }
    if (fanIn > 0) {
        const pI = pct ? pct.fanIn(fanIn) : 0;
        lbl = topPercentLabel(pI);
        reasons.push({ weight: 0.20 * pI, text: fanIn + (fanIn === 1 ? ' file depends on it' : ' files depend on it') + (lbl ? ' (' + lbl + ')' : '') });
    }
    if (churn > 0) {
        const pCh = pct ? pct.churn(churn) : 0;
        lbl = topPercentLabel(pCh);
        reasons.push({ weight: 0.10 * pCh, text: 'changed ' + churn + ' time' + (churn === 1 ? '' : 's') + ' in ' + ctx.windowDays + ' days' + (lbl ? ' (' + lbl + ')' : '') });
    }
    if (fanOut > 0) {
        const pO = pct ? pct.fanOut(fanOut) : 0;
        reasons.push({ weight: 0.10 * pO, text: 'depends on ' + fanOut + ' file' + (fanOut === 1 ? '' : 's') });
    }
    if (node.cycleIds && node.cycleIds.length > 0) {
        reasons.push({ weight: 0.15, text: 'in a dependency cycle' });
    }
    if (deadCount > 0) {
        const ratio = totalSymbols > 0 ? deadCount / totalSymbols : 0;
        reasons.push({ weight: 0.15 * ratio, text: deadCount + ' unused symbol' + (deadCount === 1 ? '' : 's') + ' of ' + totalSymbols });
    }
    if (authorCount === 1) {
        reasons.push({ weight: 0, text: 'single author' });
    } else if (authorCount > 1) {
        reasons.push({ weight: 0, text: authorCount + ' authors' });
    }
    reasons.sort((a, b) => b.weight - a.weight);
    return reasons;
}

export function riskReasonsText(reasons: RiskReason[], separator: string): string {
    const parts: string[] = [];
    for (const r of reasons) parts.push(r.text);
    return parts.join(separator);
}
