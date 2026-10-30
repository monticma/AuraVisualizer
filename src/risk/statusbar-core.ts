/**
 * statusbar-core.ts — Pure helpers behind Aura's status bar badges.
 *
 * The badges themselves live in `extension.ts` (they need `vscode`), but
 * everything that can actually be wrong lives here so vitest can cover it:
 * mapping a git repo-relative path to a graph id, deciding which working-tree
 * files are hotspots, and wording the badge / tooltip.
 *
 * No `vscode` import — the module is unit-testable in plain Node.
 */

import * as path from 'path';
import type { GitFileState } from '../analyzer/git-history';

/** The slice of a risk entry the badges need (`RiskFileEntry` is assignable). */
export interface StatusBarRiskEntry {
    score: number;
    topLabel?: string | null;
}

/** The slice of `RiskSnapshot` the badges need (`RiskSnapshot` is assignable). */
export interface StatusBarRiskSnapshot {
    byId: ReadonlyMap<string, StatusBarRiskEntry>;
    highIds: ReadonlySet<string>;
}

export interface DirtyHotspot {
    id: string;
    /** Risk score (0–100) of the file in the current snapshot. */
    score: number;
}

export const RISK_ICON = '$(shield)';
export const HOTSPOT_ICON = '$(warning)';

/** How many hotspots the tooltip spells out before "… and N more". */
export const TOOLTIP_HOTSPOTS = 5;

/**
 * Map a git (repo-relative) path to a workspace-relative, slash-separated path
 * — the id shape used by the graph and by `RiskSnapshot.byId`.
 *
 * Returns `undefined` when the file lives outside the workspace root (or the
 * workspace *is* the file), which is the normal answer in a multi-root window:
 * Aura analyses the first folder only (documented limitation).
 */
export function toWorkspaceRelative(
    repoRelative: string,
    workspaceRoot: string,
    repoRoot: string,
): string | undefined {
    if (!repoRelative || !workspaceRoot || !repoRoot) return undefined;
    const absolute = path.resolve(repoRoot, repoRelative);
    const rel = path.relative(path.resolve(workspaceRoot), absolute);
    if (!rel || rel === '.') return undefined;
    if (rel.startsWith('..') || path.isAbsolute(rel)) return undefined;
    return rel.split(path.sep).join('/');
}

/**
 * Git states worth alerting on. A deleted file cannot be high-risk any more —
 * it is gone — so it is excluded from the "hotspots in your changes" count.
 */
export function isHotspotEligibleState(state: GitFileState): boolean {
    return state !== 'deleted';
}

/**
 * High-risk files touched by the working tree, most risky first.
 *
 * `workingTree` is git's repo-relative map (`getWorkingTreeFiles`). Entries are
 * dropped when they are deleted, outside the workspace, not in
 * `snapshot.highIds`, or duplicated; the rest is sorted by descending score
 * with the id as a deterministic tie-break.
 */
export function selectDirtyHotspots(
    workingTree: Iterable<readonly [string, GitFileState]>,
    snapshot: StatusBarRiskSnapshot,
    workspaceRoot: string,
    repoRoot: string,
): DirtyHotspot[] {
    const seen = new Set<string>();
    const hotspots: DirtyHotspot[] = [];
    for (const [repoRelative, state] of workingTree) {
        if (!isHotspotEligibleState(state)) continue;
        const id = toWorkspaceRelative(repoRelative, workspaceRoot, repoRoot);
        if (!id || seen.has(id)) continue;
        if (!snapshot.highIds.has(id)) continue;
        seen.add(id);
        hotspots.push({ id, score: snapshot.byId.get(id)?.score ?? 0 });
    }
    hotspots.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
    return hotspots;
}

/** Badge text for the file being edited: `$(shield) Risk 72 · top 8%`. */
export function riskBadgeText(entry: StatusBarRiskEntry): string {
    const score = Math.round(entry.score);
    return entry.topLabel ? `${RISK_ICON} Risk ${score} · ${entry.topLabel}` : `${RISK_ICON} Risk ${score}`;
}

/** Badge text for the working-tree alert; empty for an empty change set. */
export function hotspotBadgeText(count: number): string {
    if (count <= 0) return '';
    return `${HOTSPOT_ICON} ${count} hotspot${count === 1 ? '' : 's'} in your changes`;
}

/** Bold first line of the alert tooltip. */
export function hotspotTooltipTitle(count: number): string {
    return `**${count} high-risk file${count === 1 ? '' : 's'} in your current changes**`;
}

/**
 * Alert tooltip body: the riskiest `max` files as bullet lines, plus how many
 * are left out. `hidden` is 0 when everything fits.
 */
export function hotspotTooltipSummary(
    hotspots: readonly DirtyHotspot[],
    max: number = TOOLTIP_HOTSPOTS,
): { lines: string[]; hidden: number } {
    const limit = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : hotspots.length;
    const shown = hotspots.slice(0, limit);
    return {
        lines: shown.map(hotspot => `- \`${hotspot.id}\` — risk ${Math.round(hotspot.score)}/100`),
        hidden: Math.max(0, hotspots.length - shown.length),
    };
}
