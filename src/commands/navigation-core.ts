/**
 * navigation-core.ts — Pure path helpers for @aura navigation actions.
 *
 * Kept free of the `vscode` module so they can be unit-tested with vitest.
 */

import { isAbsolute, join, normalize, relative } from 'path';

export interface NavigationPath {
    /** Absolute path used to open the editor. */
    absolutePath: string;
    /** Workspace-relative path (POSIX separators), used to focus the graph. */
    relativePath: string;
    /** False when an absolute path points outside the workspace. */
    insideWorkspace: boolean;
}

function cleanInput(value: string): string {
    let cleaned = (value || '').trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
        cleaned = cleaned.slice(1, -1);
    }
    return cleaned.replace(/\\/g, '/');
}

function toPosix(value: string): string {
    return value.replace(/\\/g, '/');
}

/**
 * Resolve a user/AI-provided path against the workspace.
 * Supports relative paths, absolute paths, `./`, backslashes and spaces.
 */
export function resolveNavigationPath(input: string, workspaceRoot: string | undefined): NavigationPath | undefined {
    const cleaned = cleanInput(input);
    if (!cleaned) return undefined;

    if (isAbsolute(cleaned)) {
        const absolutePath = normalize(cleaned);
        if (!workspaceRoot) {
            return { absolutePath, relativePath: toPosix(absolutePath), insideWorkspace: true };
        }
        const rel = relative(workspaceRoot, absolutePath);
        const relativePath = toPosix(rel);
        return {
            absolutePath,
            relativePath,
            insideWorkspace: relativePath !== '..' && !relativePath.startsWith('../') && !isAbsolute(relativePath),
        };
    }

    if (!workspaceRoot) return undefined;
    const normalized = normalize(cleaned).replace(/^\.\//, '');
    if (normalized === '..' || normalized.startsWith('../')) {
        return {
            absolutePath: normalize(join(workspaceRoot, normalized)),
            relativePath: toPosix(normalized),
            insideWorkspace: false,
        };
    }
    return {
        absolutePath: normalize(join(workspaceRoot, normalized)),
        relativePath: toPosix(normalized),
        insideWorkspace: true,
    };
}

/** Workspace-relative path for graph focus, or undefined when outside the workspace. */
export function workspaceRelativePath(input: string, workspaceRoot: string | undefined): string | undefined {
    const resolved = resolveNavigationPath(input, workspaceRoot);
    return resolved && resolved.insideWorkspace ? resolved.relativePath : undefined;
}
