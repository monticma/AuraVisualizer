/**
 * git-history.ts — Git history utilities for Time Travel.
 * Uses child_process to call git (no external dependency needed).
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import type { CommitInfo, CommitFileChange } from './types';

const execFileAsync = promisify(execFile);

const MAX_BUFFER = 50 * 1024 * 1024; // 50 MB for large repos

/**
 * Check if a directory is inside a git repository.
 */
export async function isGitRepo(cwd: string): Promise<boolean> {
    try {
        await execFileAsync('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
        return true;
    } catch {
        return false;
    }
}

/**
 * Get the root of the git repository.
 */
export async function getGitRoot(cwd: string): Promise<string> {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], { cwd });
    return stdout.trim();
}

/** Working-tree state of a single file, as reported by `git status`. */
export type GitFileState = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted';

/**
 * List the files with uncommitted changes (working tree + index).
 * Returns repo-relative paths mapped to their state. Never throws — returns an
 * empty map when the folder is not a git repository.
 */
export async function getWorkingTreeFiles(cwd: string): Promise<Map<string, GitFileState>> {
    const result = new Map<string, GitFileState>();
    try {
        const { stdout } = await execFileAsync('git', [
            '--no-optional-locks',
            'status', '--porcelain=v1', '-z', '--untracked-files=all',
        ], { cwd, maxBuffer: MAX_BUFFER });

        const parts = stdout.split('\0');
        for (let i = 0; i < parts.length; i++) {
            const entry = parts[i];
            if (!entry || entry.length < 4) continue;
            const xy = entry.slice(0, 2);
            const filePath = entry.slice(3);
            if (!filePath) continue;

            if (xy === '??') { result.set(filePath, 'untracked'); continue; }
            if (xy === '!!') continue; // ignored (not listed by default)
            if (xy[0] === 'U' || xy[1] === 'U' || xy === 'AA' || xy === 'DD') {
                result.set(filePath, 'conflicted');
                continue;
            }

            let state: GitFileState = 'modified';
            if (xy[0] === 'A' || xy[1] === 'A') state = 'added';
            else if (xy[0] === 'D' || xy[1] === 'D') state = 'deleted';
            else if (xy[0] === 'R' || xy[1] === 'R' || xy[0] === 'C' || xy[1] === 'C') {
                state = 'renamed';
                i++; // in -z mode, the next NUL record is the original path
            }
            result.set(filePath, state);
        }
    } catch {
        // Not a git repo, or git is unavailable — no working-tree info.
    }
    return result;
}

/**
 * Get the full commit index using git log --name-status.
 * Returns commits from newest to oldest.
 */
export async function getCommitIndex(cwd: string): Promise<CommitInfo[]> {
    const { stdout } = await execFileAsync('git', [
        'log',
        '--pretty=format:%H%n%aI%n%an%n%s',
        '--name-status',
        '--diff-filter=ADMR',
        '--no-merges',
    ], { cwd, maxBuffer: MAX_BUFFER });

    const commits: CommitInfo[] = [];
    const blocks = stdout.split('\n\n');

    for (const block of blocks) {
        const lines = block.split('\n').filter(l => l.length > 0);
        if (lines.length < 4) continue;

        const hash = lines[0];
        const date = lines[1];
        const author = lines[2];
        const message = lines[3];

        const files: CommitFileChange[] = [];
        for (let i = 4; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(/^([ADMR])\d*\t(.+?)(?:\t(.+))?$/);
            if (!match) continue;

            const status = match[1] as CommitFileChange['status'];
            if (status === 'R') {
                files.push({ status, path: match[3] || match[2], oldPath: match[2] });
            } else {
                files.push({ status, path: match[2] });
            }
        }

        if (files.length > 0) {
            commits.push({ hash, date, author, message, files });
        }
    }

    return commits;
}

/**
 * Get file content at a specific commit.
 * Returns null if the file doesn't exist at that commit.
 */
export async function getFileAtCommit(
    cwd: string,
    commitHash: string,
    filePath: string
): Promise<string | null> {
    try {
        const { stdout } = await execFileAsync(
            'git', ['show', `${commitHash}:${filePath}`],
            { cwd, maxBuffer: MAX_BUFFER }
        );
        return stdout;
    } catch {
        return null;
    }
}

/**
 * Get the list of files existing at a specific commit.
 */
export async function getFileListAtCommit(
    cwd: string,
    commitHash: string
): Promise<string[]> {
    try {
        const { stdout } = await execFileAsync(
            'git', ['ls-tree', '-r', '--name-only', commitHash],
            { cwd, maxBuffer: MAX_BUFFER }
        );
        return stdout.trim().split('\n').filter(l => l.length > 0);
    } catch {
        return [];
    }
}
