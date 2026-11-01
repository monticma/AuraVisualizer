/**
 * branch-diff.ts — Ask git what the current branch changed.
 *
 * `execFile` only (never a shell), like `analyzer/git-history.ts`: the base
 * branch name comes from a setting, so it must never be interpolated into a
 * command line. The parsing itself lives in `branch-diff-core.ts` and is
 * unit-tested; this module is the thin child-process layer.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import {
    mergeDiffEntries,
    parseNameStatusZ,
    parseNumstatZ,
    sumTotals,
    type BranchDiff,
} from './branch-diff-core';

const execFileAsync = promisify(execFile);

/** Tried in order when `auraVisualizer.reviewBase` is empty. */
export const DEFAULT_BASES = ['main', 'master'] as const;

async function git(cwd: string, args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, { cwd, maxBuffer: 16 * 1024 * 1024 });
    return stdout;
}

async function refExists(cwd: string, ref: string): Promise<boolean> {
    try {
        await git(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
        return true;
    } catch {
        return false;
    }
}

/** Branch to compare against: the configured one, else `main`, else `master`. */
export async function resolveReviewBase(cwd: string, configured?: string): Promise<string> {
    const preferred = (configured ?? '').trim();
    if (preferred) {
        if (!(await refExists(cwd, preferred))) {
            throw new Error(`branch "${preferred}" was not found (auraVisualizer.reviewBase)`);
        }
        return preferred;
    }
    for (const candidate of DEFAULT_BASES) {
        if (await refExists(cwd, candidate)) return candidate;
    }
    throw new Error('no "main" or "master" branch found — set auraVisualizer.reviewBase');
}

/**
 * Files the current branch touches, relative to its merge-base with `base`.
 * Renames are followed (`--find-renames`), so a moved file is one entry instead
 * of a delete + an add.
 */
export async function readBranchDiff(cwd: string, configuredBase?: string): Promise<BranchDiff> {
    const repoRoot = (await git(cwd, ['rev-parse', '--show-toplevel'])).trim();
    if (!repoRoot) throw new Error('not a git repository');

    const base = await resolveReviewBase(repoRoot, configuredBase);
    const head = (await git(repoRoot, ['rev-parse', 'HEAD'])).trim();

    let mergeBase = '';
    try {
        mergeBase = (await git(repoRoot, ['merge-base', base, 'HEAD'])).trim();
    } catch {
        mergeBase = '';
    }
    if (!mergeBase) throw new Error(`no common ancestor between ${base} and HEAD`);

    const range = `${base}...HEAD`;
    const common = ['-c', 'core.quotepath=false', 'diff', '--find-renames'];
    const nameStatus = await git(repoRoot, [...common, '--name-status', '-z', range]);
    const numstat = await git(repoRoot, [...common, '--numstat', '-z', range]);

    const files = mergeDiffEntries(parseNameStatusZ(nameStatus), parseNumstatZ(numstat));
    return { repoRoot, base, mergeBase, head, files, totals: sumTotals(files) };
}
