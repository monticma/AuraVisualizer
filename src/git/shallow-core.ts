/**
 * shallow-core.ts — Pure parsing and wording for the shallow-clone warning (V3-14).
 *
 * A shallow checkout (`git clone --depth 1`, the default of `actions/checkout`
 * in CI) makes `git log` return a single commit, so the churn, the co-change
 * pairs and the complexity trends Aura derives from history are silently
 * wrong. This module owns the decision and the exact texts; the git calls live
 * in `shallow.ts`.
 *
 * No `vscode` / Node I/O — unit-testable in plain Node.
 */

/** The command that restores the full history. */
export const SHALLOW_FIX_COMMAND = 'git fetch --unshallow';

/** Persisted on `GraphMeta.git` — absent when the history is complete. */
export interface GitHistoryInfo {
    /** `git rev-parse --is-shallow-repository`. */
    shallow: boolean;
    /** Commits `git log` can actually see (0 when the count failed). */
    commits: number;
}

/** `true` / `false` from git, `undefined` for anything unexpected. */
export function parseShallowFlag(stdout: string | undefined): boolean | undefined {
    const value = String(stdout == null ? '' : stdout).trim().toLowerCase();
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
}

/** Digit-only output of `git rev-list --count HEAD` → number. */
export function parseCommitCount(stdout: string | undefined): number | undefined {
    const match = String(stdout == null ? '' : stdout).trim().match(/^(\d+)$/);
    if (!match) return undefined;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : undefined;
}

/**
 * Build the meta payload. `undefined` when the repository is not shallow (or
 * when git could not tell): "no repository" and "no history" are different
 * problems and must not produce a shallow-clone warning.
 */
export function buildGitHistoryInfo(
    shallow: boolean | undefined,
    commits: number | undefined,
): GitHistoryInfo | undefined {
    if (shallow !== true) return undefined;
    const count = Number.isFinite(commits) && (commits as number) > 0 ? Math.floor(commits as number) : 0;
    return { shallow: true, commits: count };
}

/** `1 commit visible` / `12 commits visible`. */
export function formatCommitCount(commits: number): string {
    const count = Math.max(0, Math.round(Number.isFinite(commits) ? commits : 0));
    return count === 1 ? '1 commit visible' : `${count} commits visible`;
}

/** Banner shown at the top of the Time Travel tab. */
export function shallowBannerText(info: GitHistoryInfo | undefined): string {
    if (!info || info.shallow !== true) return '';
    const seen = info.commits > 0 ? ` (${formatCommitCount(info.commits)})` : '';
    return `History incomplete — shallow clone${seen}. Churn, co-change and complexity trends are underestimated.`;
}

/** One-line caption for the Risk dashboard, where the score lies the most. */
export function shallowRiskCaption(info: GitHistoryInfo | undefined): string {
    if (!info || info.shallow !== true) return '';
    const seen = info.commits > 0 ? `, ${formatCommitCount(info.commits)}` : '';
    return `Churn is incomplete (shallow clone${seen}) — risk scores are underestimated.`;
}
