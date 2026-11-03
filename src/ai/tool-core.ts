/**
 * tool-core.ts — Pure payload builders for the MCP hotspot tools (V3-16).
 *
 * The four tools added by V3-16 (`build`, `explain_file`,
 * `hotspots_in_changes`, `list_repositories`) mix database rows, git output and
 * the risk snapshot. Everything that can actually be wrong — staleness rules,
 * worktree parsing, the diff × risk merge and its ordering — lives here so it is
 * unit-testable without a database or a repository.
 *
 * No `vscode` / Node I/O.
 */

/** A changed file, already read from git (working tree or branch diff). */
export interface ChangedFile {
    file: string;
    /** `A` | `M` | `D` | `R` | `U` (untracked). */
    status: string;
    additions: number;
    deletions: number;
}

/** The slice of a risk entry the tools need (`RiskFileEntry` is assignable). */
export interface RiskView {
    score: number;
    bucket: string;
    reasons: string[];
}

export interface BuildStatusPayload {
    analyzed_at: string | null;
    /** Minutes since the analysis, when the timestamp parses. */
    age_minutes: number | null;
    files: number;
    links: number;
    head_at_analysis: string | null;
    head_now: string | null;
    /** `null` when it cannot be decided (no fingerprint / no git). */
    stale: boolean | null;
    reason: string;
}

export interface WorktreeInfo {
    path: string;
    head: string | null;
    /** Short branch name (`main`), or `null` when detached / bare. */
    branch: string | null;
    bare: boolean;
}

export interface HotspotInChange {
    file: string;
    status: string;
    additions: number;
    deletions: number;
    risk_score: number | null;
    bucket: string | null;
    reasons: string[];
}

function asInt(value: string | null | undefined): number {
    const parsed = parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : 0;
}

function shortHead(head: string | null): string {
    return head ? head.slice(0, 7) : 'unknown';
}

/**
 * `build` — is the analysed graph still in sync with the checkout?
 *
 * The fingerprint persisted by the host stores the commit the analysis ran on
 * (`meta.head`), so a single comparison with the live HEAD answers it. When
 * either side is missing the answer is `stale: null` — never a guess.
 */
export function buildStatusPayload(input: {
    meta: Record<string, string | null | undefined>;
    currentHead: string | null;
    now?: number;
}): BuildStatusPayload {
    const analyzedAt = input.meta['analyzedAt'] || null;
    const analyzedHead = input.meta['head'] || null;
    const headNow = input.currentHead || null;

    let ageMinutes: number | null = null;
    if (analyzedAt) {
        const stamp = new Date(analyzedAt).getTime();
        if (Number.isFinite(stamp)) {
            const now = typeof input.now === 'number' ? input.now : Date.now();
            ageMinutes = Math.max(0, Math.round((now - stamp) / 60000));
        }
    }

    let stale: boolean | null = null;
    let reason: string;
    if (!analyzedAt) {
        reason = 'no analysis yet — run "Aura: Visualize Codebase" first';
    } else if (!analyzedHead) {
        reason = 'fingerprint missing — run a full analysis to enable staleness checks';
    } else if (!headNow) {
        reason = 'git unavailable — cannot compare with the current commit';
    } else if (analyzedHead !== headNow) {
        stale = true;
        reason = `the repository moved from ${shortHead(analyzedHead)} to ${shortHead(headNow)} since the last analysis`;
    } else {
        stale = false;
        reason = `analysed at the current commit (${shortHead(headNow)})`;
    }

    return {
        analyzed_at: analyzedAt,
        age_minutes: ageMinutes,
        files: asInt(input.meta['totalFiles']),
        links: asInt(input.meta['totalLinks']),
        head_at_analysis: analyzedHead,
        head_now: headNow,
        stale,
        reason,
    };
}

/**
 * `git worktree list --porcelain` → one entry per worktree. Records are
 * separated by blank lines; keys are `worktree`, `HEAD`, `branch`, `bare`,
 * `detached`.
 */
export function formatWorktrees(porcelain: string | undefined): WorktreeInfo[] {
    const text = String(porcelain || '').replace(/\r\n/g, '\n');
    const out: WorktreeInfo[] = [];
    for (const block of text.split('\n\n')) {
        const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
        if (lines.length === 0) continue;
        let wtPath = '';
        let head: string | null = null;
        let branch: string | null = null;
        let bare = false;
        for (const line of lines) {
            if (line.startsWith('worktree ')) wtPath = line.slice('worktree '.length).trim();
            else if (line.startsWith('HEAD ')) head = line.slice('HEAD '.length).trim() || null;
            else if (line.startsWith('branch ')) {
                const ref = line.slice('branch '.length).trim();
                branch = ref.replace(/^refs\/heads\//, '') || null;
            } else if (line === 'bare' || line.startsWith('bare ')) bare = true;
        }
        if (wtPath) out.push({ path: wtPath, head, branch, bare });
    }
    return out;
}

/**
 * Join the changed files with the risk snapshot: riskiest first, then the
 * biggest diff, then alphabetically — so the first row is always the one to
 * look at. Unscored files (docs, new files not in the graph yet) come last.
 */
export function mergeChangesWithRisk(
    changed: readonly ChangedFile[],
    riskOf: (file: string) => RiskView | null,
    limit = 50,
): { changes: HotspotInChange[]; total: number; additions: number; deletions: number; risky: number } {
    const rows: HotspotInChange[] = [];
    let additions = 0;
    let deletions = 0;
    for (const change of changed) {
        const risk = riskOf(change.file);
        additions += Math.max(0, change.additions || 0);
        deletions += Math.max(0, change.deletions || 0);
        rows.push({
            file: change.file,
            status: change.status || 'M',
            additions: Math.max(0, change.additions || 0),
            deletions: Math.max(0, change.deletions || 0),
            risk_score: risk ? Math.round(risk.score * 10) / 10 : null,
            bucket: risk ? risk.bucket : null,
            reasons: risk ? risk.reasons.slice(0, 3) : [],
        });
    }
    rows.sort((a, b) => {
        const ra = a.risk_score == null ? -1 : a.risk_score;
        const rb = b.risk_score == null ? -1 : b.risk_score;
        if (rb !== ra) return rb - ra;
        const da = a.additions + a.deletions;
        const db = b.additions + b.deletions;
        if (db !== da) return db - da;
        return a.file.localeCompare(b.file);
    });
    const risky = rows.filter(row => (row.risk_score ?? 0) >= 66).length;
    const capped = Math.max(1, Math.floor(limit) || 50);
    return {
        changes: rows.slice(0, capped),
        total: rows.length,
        additions,
        deletions,
        risky,
    };
}
