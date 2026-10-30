/**
 * blast-targets.ts — pure resolution of "blast radius" targets (V3-02).
 *
 * The Source Control / editor / explorer context menus hand a command one or
 * several `Uri`s (SCM also passes the whole selection as a second argument).
 * Turning that into graph node ids — dropping anything outside the workspace,
 * deduplicating and filtering to analyzed files — is plain data work, so it
 * lives here (no `vscode` import) and is unit-tested.
 */

/** Minimal shape of a `vscode.Uri` — structurally compatible, easy to fake. */
export interface UriLike {
    fsPath: string;
    scheme?: string;
}

export interface BlastTargets {
    /** Workspace-relative, POSIX-separated node ids, in input order. */
    ids: string[];
    /** Files that were dropped because they are not in the analyzed graph. */
    skipped: number;
    /** Files that were dropped because they live outside the workspace. */
    outsideWorkspace: number;
}

/** Hard cap — a 5 000-file SCM selection must not freeze the webview. */
export const MAX_BLAST_TARGETS = 50;

/** Collect URIs from a command argument, the SCM selection and the active editor. */
export function collectUris(
    argument: UriLike | UriLike[] | undefined,
    selection: UriLike[] | undefined,
    fallback: UriLike | undefined,
): UriLike[] {
    const out: UriLike[] = [];
    const push = (uri: UriLike | undefined): void => {
        if (uri && typeof uri.fsPath === 'string' && uri.fsPath) out.push(uri);
    };
    if (Array.isArray(argument)) {
        for (const uri of argument) push(uri);
    } else {
        push(argument);
    }
    if (Array.isArray(selection)) {
        for (const uri of selection) push(uri);
    }
    // Only fall back to the active editor when the caller passed nothing at all:
    // a menu action always provides its resource.
    if (!out.length) push(fallback);
    return out;
}

/**
 * Workspace-relative node id of a file path, or undefined when it is outside.
 *
 * Mirrors `documentNodeId` in `codelens.ts`: forward slashes, no leading `./`.
 */
export function toNodeId(fsPath: string, workspaceRoot: string | undefined): string | undefined {
    if (typeof fsPath !== 'string' || !fsPath) return undefined;
    const normalizedPath = fsPath.replace(/\\/g, '/');
    if (!workspaceRoot) {
        return normalizedPath.replace(/^\.\//, '');
    }
    const root = workspaceRoot.replace(/\\/g, '/').replace(/\/+$/, '');
    if (!normalizedPath.startsWith(root + '/')) {
        return undefined; // outside the workspace (or the root itself)
    }
    const relativePath = normalizedPath.slice(root.length + 1);
    if (!relativePath || relativePath === '..' || relativePath.startsWith('../')) return undefined;
    return relativePath;
}

/**
 * Turn the clicked resource selection into blast seeds.
 *
 * @param analyzedIds Node ids of the current graph. When undefined the graph is
 *   not known yet — the paths are passed through and the webview ignores the
 *   unknown ones, so a cold start does not silently drop the request.
 */
export function collectBlastTargets(
    argument: UriLike | UriLike[] | undefined,
    selection: UriLike[] | undefined,
    fallback: UriLike | undefined,
    workspaceRoot: string | undefined,
    analyzedIds: readonly string[] | undefined,
    limit: number = MAX_BLAST_TARGETS,
): BlastTargets {
    const known = analyzedIds ? new Set(analyzedIds.map(id => id.replace(/\\/g, '/'))) : undefined;
    const targets: BlastTargets = { ids: [], skipped: 0, outsideWorkspace: 0 };
    const seen = new Set<string>();

    for (const uri of collectUris(argument, selection, fallback)) {
        const nodeId = toNodeId(uri.fsPath, workspaceRoot);
        if (!nodeId) {
            targets.outsideWorkspace++;
            continue;
        }
        if (known && !known.has(nodeId)) {
            targets.skipped++;
            continue;
        }
        if (seen.has(nodeId)) continue;
        seen.add(nodeId);
        if (targets.ids.length >= limit) continue;
        targets.ids.push(nodeId);
    }
    return targets;
}
