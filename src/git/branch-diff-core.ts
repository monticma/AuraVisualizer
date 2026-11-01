/**
 * branch-diff-core.ts — Pure parsing of `git diff base...HEAD` output.
 *
 * `git` speaks two formats we need for a branch review: `--name-status -z`
 * (A/M/D/R with paths) and `--numstat -z` (added/removed lines per file). Both
 * are NUL-separated, and renames take three fields instead of one, which is
 * exactly the part that goes wrong when it is parsed inline.
 *
 * Keeping the parsers here means the review can be tested without a git
 * repository. No `vscode`, no child process.
 */

export type BranchFileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export interface BranchFileChange {
    /** Workspace-relative-ish path (repo-relative, forward slashes). */
    path: string;
    /** Previous path for renames. */
    oldPath?: string;
    status: BranchFileStatus;
    additions: number;
    deletions: number;
    /** `--numstat` reports `-` for binary files. */
    binary?: boolean;
    /** Complexity at the branch base vs now, when the history index covers it. */
    complexityDelta?: number;
}

export interface BranchDiffTotals {
    files: number;
    additions: number;
    deletions: number;
    added: number;
    modified: number;
    deleted: number;
    renamed: number;
}

export interface BranchDiff {
    repoRoot: string;
    base: string;
    mergeBase: string;
    head: string;
    files: BranchFileChange[];
    totals: BranchDiffTotals;
}

/**
 * `git diff --name-status -z`: `M\0path\0`, `A\0path\0`, `D\0path\0`,
 * `R100\0old\0new\0`. Copy/status letters we do not model (`C`, `T`, `U`) are
 * folded onto the closest meaningful status.
 */
export function parseNameStatusZ(raw: string): { path: string; oldPath?: string; status: BranchFileStatus }[] {
    const fields = raw.split('\0');
    const out: { path: string; oldPath?: string; status: BranchFileStatus }[] = [];
    let i = 0;
    while (i < fields.length) {
        const code = fields[i];
        if (!code) {
            i++;
            continue;
        }
        const letter = code.charAt(0).toUpperCase();
        if (letter === 'R' || letter === 'C') {
            const oldPath = fields[i + 1];
            const newPath = fields[i + 2];
            i += 3;
            if (!oldPath || !newPath) continue;
            out.push({ path: normalizePath(newPath), oldPath: normalizePath(oldPath), status: 'renamed' });
            continue;
        }
        const path = fields[i + 1];
        i += 2;
        if (!path) continue;
        let status: BranchFileStatus;
        if (letter === 'A') status = 'added';
        else if (letter === 'D') status = 'deleted';
        else status = 'modified';
        out.push({ path: normalizePath(path), status });
    }
    return out;
}

/**
 * `git diff --numstat -z`: `12\t3\tsrc/a.ts\0` and, for a rename,
 * `12\t3\t\0old.ts\0new.ts\0` (the path field is empty, the two names follow).
 * Binary files report `-\t-\tpath`.
 */
export function parseNumstatZ(raw: string): { path: string; oldPath?: string; additions: number; deletions: number; binary?: boolean }[] {
    const fields = raw.split('\0');
    const out: { path: string; oldPath?: string; additions: number; deletions: number; binary?: boolean }[] = [];
    let i = 0;
    while (i < fields.length) {
        const entry = fields[i];
        if (!entry) {
            i++;
            continue;
        }
        const parts = entry.split('\t');
        if (parts.length < 3) {
            i++;
            continue;
        }
        const [rawAdd, rawDel, rawPath] = parts;
        const binary = rawAdd === '-' || rawDel === '-';
        const additions = binary ? 0 : toCount(rawAdd);
        const deletions = binary ? 0 : toCount(rawDel);
        if (!rawPath) {
            // Rename: the two paths are the next two NUL-separated fields.
            const oldPath = fields[i + 1];
            const newPath = fields[i + 2];
            i += 3;
            if (!oldPath || !newPath) continue;
            out.push({ path: normalizePath(newPath), oldPath: normalizePath(oldPath), additions, deletions, binary: binary || undefined });
            continue;
        }
        i++;
        out.push({ path: normalizePath(rawPath), additions, deletions, binary: binary || undefined });
    }
    return out;
}

function toCount(value: string): number {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function normalizePath(value: string): string {
    return value.replace(/\\/g, '/').replace(/^\.\//u, '');
}

/** Join both git outputs into one ordered, deduplicated file list. */
export function mergeDiffEntries(
    nameStatus: ReturnType<typeof parseNameStatusZ>,
    numstat: ReturnType<typeof parseNumstatZ>,
): BranchFileChange[] {
    const byPath = new Map<string, BranchFileChange>();

    for (const entry of nameStatus) {
        byPath.set(entry.path, {
            path: entry.path,
            oldPath: entry.oldPath,
            status: entry.status,
            additions: 0,
            deletions: 0,
        });
    }

    for (const entry of numstat) {
        const existing = byPath.get(entry.path);
        if (existing) {
            existing.additions = entry.additions;
            existing.deletions = entry.deletions;
            if (entry.binary) existing.binary = true;
            if (!existing.oldPath && entry.oldPath) existing.oldPath = entry.oldPath;
            continue;
        }
        // numstat can know about a file name-status skipped (type changes).
        byPath.set(entry.path, {
            path: entry.path,
            oldPath: entry.oldPath,
            status: 'modified',
            additions: entry.additions,
            deletions: entry.deletions,
            binary: entry.binary,
        });
    }

    return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function sumTotals(files: readonly BranchFileChange[]): BranchDiffTotals {
    const totals: BranchDiffTotals = { files: files.length, additions: 0, deletions: 0, added: 0, modified: 0, deleted: 0, renamed: 0 };
    for (const file of files) {
        totals.additions += file.additions;
        totals.deletions += file.deletions;
        if (file.status === 'added') totals.added++;
        else if (file.status === 'deleted') totals.deleted++;
        else if (file.status === 'renamed') totals.renamed++;
        else totals.modified++;
    }
    return totals;
}

/** What the host sends to the webview to display a branch review. */
export interface BranchReviewPayload {
    base: string;
    mergeBase: string;
    head: string;
    files: {
        /** Graph node id when the file is in the graph, repo path otherwise. */
        id: string;
        status: BranchFileStatus;
        additions: number;
        deletions: number;
        inGraph: boolean;
        complexityDelta?: number;
    }[];
    totals: BranchDiffTotals;
    /** Files present in the graph — seeds for a multi-source blast. */
    seeds: string[];
}

/**
 * Turn a git diff into the webview payload: map every path to a graph id, keep
 * the complexity delta when the history index covers the branch, and collect
 * the blast seeds. Files outside the graph keep their path so the summary stays
 * honest instead of silently dropping them.
 */
export function buildReviewPayload(
    diff: BranchDiff,
    toNodeId: (repoPath: string) => string | undefined,
    nodeIds: ReadonlySet<string>,
    complexityDeltas: ReadonlyMap<string, number>,
): BranchReviewPayload {
    const files: BranchReviewPayload['files'] = [];
    const seeds: string[] = [];
    for (const file of diff.files) {
        const nodeId = toNodeId(file.path);
        const inGraph = !!nodeId && nodeIds.has(nodeId);
        const delta = inGraph ? complexityDeltas.get(nodeId as string) : undefined;
        files.push({
            id: inGraph ? (nodeId as string) : file.path,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            inGraph,
            ...(delta !== undefined ? { complexityDelta: delta } : {}),
        });
        if (inGraph && file.status !== 'deleted') seeds.push(nodeId as string);
    }
    return { base: diff.base, mergeBase: diff.mergeBase, head: diff.head, files, totals: diff.totals, seeds };
}

/** Minimal shape of a commit delta the complexity delta needs. */
export interface DeltaLike {
    hash: string;
    date: string;
    added?: string[];
    removed?: string[];
    modified?: Record<string, { complexity?: number }>;
}

/**
 * Complexity of every touched file at the *oldest* indexed commit of the
 * branch range, so the review can show "what did this branch cost?".
 *
 * Returns a map id → Δ (current complexity minus the value at the base). Files
 * the index does not cover are absent: the caller shows nothing rather than a
 * made-up zero.
 */
export function computeComplexityDeltas(
    deltas: readonly DeltaLike[],
    rangeHashes: ReadonlySet<string>,
    currentComplexity: ReadonlyMap<string, number>,
): Map<string, number> {
    const earliest = new Map<string, { date: string; complexity: number }>();

    for (const delta of deltas) {
        if (!rangeHashes.has(delta.hash)) continue;
        const date = typeof delta.date === 'string' ? delta.date : '';
        const record = (id: string, complexity: number | undefined): void => {
            if (typeof complexity !== 'number' || !Number.isFinite(complexity)) return;
            const previous = earliest.get(id);
            if (!previous || date < previous.date) earliest.set(id, { date, complexity });
        };
        for (const id of delta.added ?? []) record(id, 0);
        for (const [id, state] of Object.entries(delta.modified ?? {})) record(id, state.complexity);
    }

    const out = new Map<string, number>();
    for (const [id, before] of earliest) {
        const now = currentComplexity.get(id);
        if (typeof now !== 'number' || !Number.isFinite(now)) continue;
        const delta = now - before.complexity;
        if (delta !== 0) out.set(id, delta);
    }
    return out;
}
