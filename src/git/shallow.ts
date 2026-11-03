/**
 * shallow.ts — Git probes behind the shallow-clone warning (V3-14).
 *
 * A shallow checkout (`git clone --depth 1`, `actions/checkout` in CI) makes
 * `git log` return a single commit: churn, co-change and complexity trends are
 * then silently wrong. Detection is two cheap `git` calls per analysis, and the
 * wording lives in the pure `shallow-core` module.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import * as path from 'path';
import {
    buildGitHistoryInfo,
    parseCommitCount,
    parseShallowFlag,
    type GitHistoryInfo,
} from './shallow-core';

const execFileAsync = promisify(execFile);

/** Argument-array git call (never a shell string), 5 s guard. */
async function git(cwd: string, args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, { cwd, timeout: 5000, maxBuffer: 1024 * 1024 });
    return String(stdout || '');
}

/**
 * Is this checkout shallow?
 *
 * `rev-parse --is-shallow-repository` needs git ≥ 2.15; when it fails (old git
 * or an unexpected output) we fall back to the presence of the `shallow` file
 * inside the git directory, which is what the flag is derived from anyway.
 */
export async function isShallowRepository(cwd: string): Promise<boolean | undefined> {
    try {
        const parsed = parseShallowFlag(await git(cwd, ['rev-parse', '--is-shallow-repository']));
        if (parsed !== undefined) return parsed;
    } catch {
        // Older git or not a repository — try the file probe below.
    }
    try {
        const gitDir = (await git(cwd, ['rev-parse', '--git-dir'])).trim();
        if (!gitDir) return undefined;
        const shallowFile = path.isAbsolute(gitDir)
            ? path.join(gitDir, 'shallow')
            : path.join(cwd, gitDir, 'shallow');
        return existsSync(shallowFile);
    } catch {
        return undefined;
    }
}

/** How many commits `git log` can see (`rev-list --count HEAD`), 0 when unknown. */
export async function countVisibleCommits(cwd: string): Promise<number> {
    try {
        return parseCommitCount(await git(cwd, ['rev-list', '--count', 'HEAD'])) ?? 0;
    } catch {
        return 0;
    }
}

/**
 * `{ shallow, commits }` when the checkout is shallow, `undefined` otherwise
 * (complete history, no repository, or git unavailable — never a false alarm).
 */
export async function readGitHistoryInfo(cwd: string): Promise<GitHistoryInfo | undefined> {
    const shallow = await isShallowRepository(cwd);
    if (shallow !== true) return undefined;
    return buildGitHistoryInfo(shallow, await countVisibleCommits(cwd));
}
