/**
 * cochange.ts — Temporal coupling ("co-change") analysis.
 *
 * Pure, deterministic logic shared by:
 * - the webview Coupling view and virtual graph links;
 * - the extension host persistence / MCP tool.
 *
 * A pair is interesting when two files keep changing in the same commits
 * without a direct structural dependency: an implicit contract (shared config,
 * API + client, test + implementation, etc.).
 */

import { buildRenameResolver, type CommitLike } from '../risk/risk-core';

export interface CochangeCommit extends CommitLike {
    date?: string | number;
}

export interface CochangePair {
    a: string;
    b: string;
    /** Number of commits touching both files. */
    cochanges: number;
    /** Number of commits touching each file. */
    aCommits: number;
    bCommits: number;
    /** Jaccard = cochanges / (aCommits + bCommits - cochanges). */
    jaccard: number;
    /** Fraction of the considered commits that touch both files. */
    support: number;
    /** True when a structural edge already connects the pair. */
    linked: boolean;
}

export interface CochangeOptions {
    /** Only commits newer than this many days are considered (default 365). */
    windowDays?: number;
    /** Reference timestamp in ms (default: Date.now(); tests pass a fixed value). */
    now?: number;
    /** Minimum co-change count (default 2). */
    minCochanges?: number;
    /** Minimum Jaccard score (default 0.2). */
    minJaccard?: number;
    /** Ignore giant commits that touch more files (default 50). */
    maxFilesPerCommit?: number;
    /** Maximum number of pairs returned (default 200). */
    maxPairs?: number;
    /** Exclude pairs already connected by a structural edge (default true). */
    excludeLinked?: boolean;
    /** Existing structural pairs — order does not matter. */
    linkedPairs?: Iterable<[string, string]>;
    /** Restrict results to these current file paths (usually graph nodes). */
    allowedPaths?: Iterable<string>;
}

export interface CochangeResult {
    pairs: CochangePair[];
    windowDays: number;
    /** Commits in the window with at least two relevant files. */
    commitsConsidered: number;
    /** Commits in the window, including single-file commits. */
    totalCommitsInWindow: number;
    maxJaccard: number;
}

function pairKey(a: string, b: string): string {
    return a < b ? a + '\u0000' + b : b + '\u0000' + a;
}

function commitTime(commit: CochangeCommit): number | undefined {
    if (typeof commit.date === 'number' && isFinite(commit.date)) return commit.date;
    if (typeof commit.date === 'string') {
        const parsed = Date.parse(commit.date);
        return isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

/**
 * Compute co-change pairs from a newest-first commit list.
 *
 * Renames are resolved through the shared `buildRenameResolver`, so a moved
 * file keeps its history. Deletions and giant commits are ignored.
 */
export function computeCochange(commits: CochangeCommit[], options: CochangeOptions = {}): CochangeResult {
    const windowDays = typeof options.windowDays === 'number' && options.windowDays > 0
        ? options.windowDays
        : 365;
    const now = typeof options.now === 'number' && isFinite(options.now)
        ? options.now
        : Date.now();
    const minCochanges = Math.max(0, options.minCochanges ?? 2);
    const minJaccard = Math.min(1, Math.max(0, options.minJaccard ?? 0.2));
    const maxFilesPerCommit = Math.max(2, options.maxFilesPerCommit ?? 50);
    const maxPairs = Math.max(0, options.maxPairs ?? 200);
    const excludeLinked = options.excludeLinked !== false;
    const linked = new Set<string>();
    for (const pair of options.linkedPairs || []) linked.add(pairKey(pair[0], pair[1]));
    const allowed = options.allowedPaths ? new Set(options.allowedPaths) : undefined;

    const cutoff = now - windowDays * 24 * 60 * 60 * 1000;
    const resolvePath = buildRenameResolver(commits);
    const pairCounts = new Map<string, { a: string; b: string; cochanges: number }>();
    const fileCounts = new Map<string, number>();
    let commitsConsidered = 0;
    let totalCommitsInWindow = 0;

    for (const commit of commits) {
        const when = commitTime(commit);
        if (when === undefined || when < cutoff || when > now) continue;

        const files = new Set<string>();
        for (const file of commit.files || []) {
            if (!file.path || file.status === 'D') continue;
            const resolved = resolvePath(file.status === 'R' && file.oldPath ? file.oldPath : file.path);
            if (!resolved) continue;
            if (allowed && !allowed.has(resolved)) continue;
            files.add(resolved);
        }
        if (files.size === 0) continue;
        totalCommitsInWindow++;
        const list = Array.from(files).sort();
        for (const file of list) fileCounts.set(file, (fileCounts.get(file) || 0) + 1);
        if (files.size < 2 || files.size > maxFilesPerCommit) continue;
        commitsConsidered++;

        for (let i = 0; i < list.length; i++) {
            for (let j = i + 1; j < list.length; j++) {
                const a = list[i];
                const b = list[j];
                const key = pairKey(a, b);
                if (excludeLinked && linked.has(key)) continue;
                const entry = pairCounts.get(key);
                if (entry) entry.cochanges++;
                else pairCounts.set(key, { a, b, cochanges: 1 });
            }
        }
    }

    const pairs: CochangePair[] = [];
    for (const entry of pairCounts.values()) {
        if (entry.cochanges < minCochanges) continue;
        const aCommits = fileCounts.get(entry.a) || 0;
        const bCommits = fileCounts.get(entry.b) || 0;
        const union = aCommits + bCommits - entry.cochanges;
        if (union <= 0) continue;
        const jaccard = entry.cochanges / union;
        if (jaccard < minJaccard) continue;
        pairs.push({
            a: entry.a,
            b: entry.b,
            cochanges: entry.cochanges,
            aCommits,
            bCommits,
            jaccard,
            support: commitsConsidered > 0 ? entry.cochanges / commitsConsidered : 0,
            linked: linked.has(pairKey(entry.a, entry.b)),
        });
    }

    pairs.sort((left, right) =>
        right.jaccard - left.jaccard ||
        right.cochanges - left.cochanges ||
        left.a.localeCompare(right.a) ||
        left.b.localeCompare(right.b));

    return {
        pairs: pairs.slice(0, maxPairs),
        windowDays,
        commitsConsidered,
        totalCommitsInWindow,
        maxJaccard: pairs.length > 0 ? pairs[0].jaccard : 0,
    };
}
