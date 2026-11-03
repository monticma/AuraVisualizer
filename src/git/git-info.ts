/**
 * git-info.ts — Git reads for the MCP hotspot tools (V3-16).
 *
 * `build`, `hotspots_in_changes` and `list_repositories` need three small pieces
 * of repository state: the current commit, the working-tree diff, and the list
 * of worktrees. Each helper degrades to an empty answer instead of throwing:
 * the tools must stay usable outside a repository or when git is absent.
 */

import { execFile } from 'child_process';
import { parseNumstatZ } from './branch-diff-core';
import type { ChangedFile, WorktreeInfo } from '../ai/tool-core';
import { formatWorktrees } from '../ai/tool-core';

const GIT_TIMEOUT_MS = 5000;

function git(cwd: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        execFile('git', args, { cwd, timeout: GIT_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 }, (error, stdout) => {
            if (error) reject(error);
            else resolve(String(stdout));
        });
    });
}

/** `git rev-parse HEAD`, or `null` outside a repository. */
export async function readCurrentHead(cwd: string): Promise<string | null> {
    try {
        const head = (await git(cwd, ['rev-parse', 'HEAD'])).trim();
        return head || null;
    } catch {
        return null;
    }
}

interface StatusEntry {
    status: string;
    path: string;
}

/** `git status --porcelain -z`, renames resolved to their new path. */
function parseStatusZ(raw: string): StatusEntry[] {
    const fields = String(raw || '').split('\0');
    const out: StatusEntry[] = [];
    let i = 0;
    while (i < fields.length) {
        const entry = fields[i];
        i++;
        if (!entry || entry.length < 4) continue;
        const code = entry.slice(0, 2);
        const path = entry.slice(3);
        if (code[0] === 'R' || code[0] === 'C') i++; // skip the old path
        out.push({ status: normaliseStatus(code), path });
    }
    return out;
}

function normaliseStatus(code: string): string {
    if (code.includes('?')) return 'U';
    if (code.includes('D')) return 'D';
    if (code.includes('A')) return 'A';
    if (code.includes('R')) return 'R';
    if (code.includes('C')) return 'C';
    return 'M';
}

/**
 * Tracked changes against HEAD (staged + unstaged) with their line counts, plus
 * untracked files (`U`, no line count). `D` entries keep the deleted lines.
 */
export async function readWorkingTreeChanges(cwd: string): Promise<ChangedFile[]> {
    const byPath = new Map<string, ChangedFile>();

    try {
        const numstat = await git(cwd, ['diff', '--numstat', '-z', 'HEAD']);
        for (const entry of parseNumstatZ(numstat)) {
            byPath.set(entry.path, {
                file: entry.path,
                status: 'M',
                additions: entry.additions,
                deletions: entry.deletions,
            });
        }
    } catch {
        /* no HEAD yet (fresh repository) — status still tells us what changed */
    }

    try {
        const status = await git(cwd, ['status', '--porcelain', '-z']);
        for (const entry of parseStatusZ(status)) {
            const existing = byPath.get(entry.path);
            if (existing) {
                existing.status = entry.status;
                continue;
            }
            byPath.set(entry.path, {
                file: entry.path,
                status: entry.status,
                additions: 0,
                deletions: 0,
            });
        }
    } catch {
        return Array.from(byPath.values());
    }

    return Array.from(byPath.values()).sort((a, b) => a.file.localeCompare(b.file));
}

/** `git worktree list --porcelain`, parsed; empty outside a repository. */
export async function readWorktrees(cwd: string): Promise<WorktreeInfo[]> {
    try {
        const raw = await git(cwd, ['worktree', 'list', '--porcelain']);
        return formatWorktrees(raw);
    } catch {
        return [];
    }
}
