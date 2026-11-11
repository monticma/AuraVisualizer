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

/** Current HEAD commit hash, or '' when the folder is not a git repository. */
export async function getGitHead(cwd: string): Promise<string> {
    try {
        const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd });
        return stdout.trim();
    } catch {
        return '';
    }
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
 * Get the full commit index using `git log --raw --numstat`.
 *
 * `--raw` gives the status letter and, for renames, both paths; `--numstat`
 * gives the lines added/removed. Git accepts both at once but emits them as two
 * consecutive blocks for the same commit — hence the two-phase parse below, with
 * an index-based zip guarded by an equal-count check (a commit whose blocks
 * disagree keeps its files but loses its line counts, never the reverse).
 *
 * Line volumes are what turns "changed 30 times" into "rewritten 2×".
 * Returns commits from newest to oldest.
 */
export async function getCommitIndex(cwd: string): Promise<CommitInfo[]> {
    const { stdout } = await execFileAsync('git', [
        'log',
        // NUL starts a record: subjects can contain anything but NUL, so the
        // split is unambiguous whatever the commit messages look like.
        '--pretty=format:%x00%H%n%aI%n%an%n%s',
        '--raw',
        '--numstat',
        '-M',              // rename detection, independent of the user's diff.renames config
        '--diff-filter=ADMR',
        '--no-merges',
    ], { cwd, maxBuffer: MAX_BUFFER });

    const commits: CommitInfo[] = [];
    for (const record of stdout.split('\0')) {
        const lines = record.split('\n');
        let i = 0;
        while (i < lines.length && lines[i].trim() === '') i++;
        if (i + 3 >= lines.length) continue;

        const hash = lines[i].trim();
        const date = lines[i + 1].trim();
        const author = lines[i + 2];
        const message = lines[i + 3];
        if (!hash || !date) continue;

        const files: CommitFileChange[] = [];
        const volumes: { additions: number; deletions: number }[] = [];
        for (i = i + 4; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;

            if (line[0] === ':') {
                // :100644 100644 <oldsha> <newsha> M\tpath[\tnewpath]
                const tab = line.indexOf('\t');
                if (tab < 0) continue;
                const meta = line.slice(0, tab).trim().split(/\s+/);
                const letter = (meta[meta.length - 1] || '')[0];
                const parts = line.slice(tab + 1).split('\t');
                if (letter === 'R') {
                    if (parts.length >= 2 && parts[1]) {
                        files.push({ status: 'R', path: parts[1], oldPath: parts[0] });
                    }
                } else if (letter === 'A' || letter === 'M' || letter === 'D') {
                    if (parts[0]) files.push({ status: letter, path: parts[0] });
                }
                continue;
            }

            // 12\t34\tpath — or "-\t-\tpath" for binary files
            const volume = /^(\d+|-)\t(\d+|-)\t/.exec(line);
            if (volume) {
                volumes.push({
                    additions: volume[1] === '-' ? 0 : parseInt(volume[1], 10),
                    deletions: volume[2] === '-' ? 0 : parseInt(volume[2], 10),
                });
            }
        }

        if (files.length > 0) {
            if (volumes.length === files.length) {
                for (let f = 0; f < files.length; f++) {
                    files[f].additions = volumes[f].additions;
                    files[f].deletions = volumes[f].deletions;
                }
            }
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
