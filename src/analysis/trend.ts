/**
 * trend.ts — Pure complexity trend analysis (V2-05).
 *
 * Rebuilds a per-file complexity series from the commit deltas produced by the
 * history worker, then fits a linear regression (slope + R²) so the UI can
 * flag files whose complexity is growing. No DOM, Node or VS Code dependency:
 * the same module is bundled for the webview as `window.AuraTrend` and tested
 * directly by vitest.
 */

export interface TrendCommit {
    hash: string;
    date: string | number;
}

export interface TrendFileState {
    complexity: number;
    linesOfCode: number;
    symbols?: { totalSymbols?: number };
}

export interface TrendDelta {
    added?: string[];
    removed?: string[];
    modified?: Record<string, TrendFileState>;
}

export type TrendDeltas = Record<string, TrendDelta>;

export interface TrendPoint {
    hash: string;
    date: number;
    complexity: number;
    lines: number;
    symbols: number;
}

export type TrendDirection = 'up' | 'down' | 'flat' | 'unknown';

export interface FileTrend {
    file: string;
    points: TrendPoint[];
    samples: number;
    start: number;
    end: number;
    delta: number;
    /** Complexity points per 30 days. */
    slopePer30Days: number;
    r2: number;
    direction: TrendDirection;
    degrading: boolean;
    improving: boolean;
}

export interface TrendOptions {
    /** Complexity change per 30 days that counts as degradation (default 0.5). */
    threshold?: number;
    /** Minimum R² for a degrading/improving signal (default 0.3). */
    minR2?: number;
    /** Maximum points kept per sparkline (regression still uses all points). */
    maxPoints?: number;
}

export interface TrendSummary {
    files: number;
    degrading: number;
    improving: number;
    stable: number;
    averageSlopePer30Days: number;
}

const DAY = 24 * 60 * 60 * 1000;

function toTime(value: string | number): number {
    if (typeof value === 'number') return isFinite(value) ? value : 0;
    const parsed = Date.parse(value);
    return isFinite(parsed) ? parsed : 0;
}

/** Least-squares fit; returns a zero slope/R² when x has no variance. */
export function linearRegression(points: readonly { x: number; y: number }[]): {
    slope: number;
    intercept: number;
    r2: number;
} {
    if (points.length < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 };
    let sumX = 0, sumY = 0;
    for (const point of points) { sumX += point.x; sumY += point.y; }
    const meanX = sumX / points.length;
    const meanY = sumY / points.length;
    let cov = 0, varX = 0, varY = 0;
    for (const point of points) {
        const dx = point.x - meanX;
        const dy = point.y - meanY;
        cov += dx * dy;
        varX += dx * dx;
        varY += dy * dy;
    }
    if (varX === 0) return { slope: 0, intercept: meanY, r2: 0 };
    const slope = cov / varX;
    const r2 = varY === 0 ? 0 : (cov * cov) / (varX * varY);
    return { slope, intercept: meanY - slope * meanX, r2: Math.max(0, Math.min(1, r2)) };
}

/**
 * Build one trend per file from commit deltas. Files are keyed by their
 * repository-relative graph id. Removed files are dropped; a later re-add
 * starts a fresh series.
 */
export function buildFileTrends(
    commits: readonly TrendCommit[],
    deltas: TrendDeltas,
    options: TrendOptions = {},
): Record<string, FileTrend> {
    const threshold = Math.max(0, options.threshold ?? 0.5);
    const minR2 = Math.max(0, Math.min(1, options.minR2 ?? 0.3));
    const maxPoints = Math.max(2, options.maxPoints ?? 60);

    const ordered = commits
        .map((commit, index) => ({ ...commit, index, time: toTime(commit.date) }))
        .sort((a, b) => (a.time - b.time) || (a.index - b.index));

    const pointsByFile = new Map<string, TrendPoint[]>();

    for (const commit of ordered) {
        const delta = deltas[commit.hash];
        if (!delta) continue;

        for (const file of delta.removed || []) pointsByFile.delete(file);

        const modified = delta.modified || {};
        for (const file of Object.keys(modified)) {
            const state = modified[file];
            const rawComplexity = Number(state.complexity);
            const rawLines = Number(state.linesOfCode);
            if (!isFinite(rawComplexity) || !isFinite(rawLines)) continue;
            const symbols = state.symbols && isFinite(Number(state.symbols.totalSymbols))
                ? Number(state.symbols.totalSymbols)
                : 0;
            const point: TrendPoint = {
                hash: commit.hash,
                date: commit.time,
                complexity: rawComplexity,
                lines: rawLines,
                symbols,
            };
            const list = pointsByFile.get(file);
            if (list) list.push(point);
            else pointsByFile.set(file, [point]);
        }
    }

    const trends: Record<string, FileTrend> = {};
    for (const [file, allPoints] of pointsByFile) {
        if (allPoints.length === 0) continue;
        allPoints.sort((a, b) => a.date - b.date);
        const first = allPoints[0];
        const last = allPoints[allPoints.length - 1];
        const regression = linearRegression(allPoints.map(point => ({
            x: (point.date - first.date) / DAY,
            y: point.complexity,
        })));
        const slopePer30Days = regression.slope * 30;
        const samples = allPoints.length;
        const direction: TrendDirection = samples < 2
            ? 'unknown'
            : Math.abs(slopePer30Days) < threshold
                ? 'flat'
                : slopePer30Days > 0 ? 'up' : 'down';
        const significant = samples >= 2 && regression.r2 >= minR2;
        trends[file] = {
            file,
            points: allPoints.slice(-maxPoints),
            samples,
            start: first.date,
            end: last.date,
            delta: last.complexity - first.complexity,
            slopePer30Days,
            r2: regression.r2,
            direction,
            degrading: significant && slopePer30Days >= threshold,
            improving: significant && slopePer30Days <= -threshold,
        };
    }
    return trends;
}

/** Small aggregate used by the Risk dashboard header. */
export function summarizeTrends(trends: Record<string, FileTrend>): TrendSummary {
    const list = Object.values(trends);
    const degraded = list.filter(trend => trend.degrading).length;
    const improved = list.filter(trend => trend.improving).length;
    const average = list.length === 0
        ? 0
        : list.reduce((sum, trend) => sum + trend.slopePer30Days, 0) / list.length;
    return {
        files: list.length,
        degrading: degraded,
        improving: improved,
        stable: list.length - degraded - improved,
        averageSlopePer30Days: average,
    };
}

/** Return the points normalized to [0,1] for a tiny SVG sparkline. */
export function sparklinePoints(points: readonly TrendPoint[], width: number, height: number): string {
    if (points.length === 0) return '';
    if (points.length === 1) return '0,' + (height / 2).toFixed(1);
    const min = Math.min(...points.map(point => point.complexity));
    const max = Math.max(...points.map(point => point.complexity));
    const span = max - min || 1;
    return points.map((point, index) => {
        const x = (index / (points.length - 1)) * width;
        const y = height - ((point.complexity - min) / span) * height;
        return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
}
