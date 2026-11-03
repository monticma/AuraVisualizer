/**
 * anchors.ts — One way to build `path:line` anchors for every Aura tool (V3-15).
 *
 * An agent that gets a file path alone cannot cite anything verifiable; a line
 * makes the answer checkable. Every tool that *knows* a line now exposes it
 * twice: `line` (the number) and `anchor` (`"src/a.ts:42"`, ready to paste into
 * a chat or a commit message). Tools that only know a file simply omit both.
 *
 * No `vscode` / DOM import — unit-testable in plain Node.
 */

/** A usable line: a positive, finite integer (`git`/Tree-sitter never emit 0). */
export function normalizeLine(value: unknown): number | undefined {
    if (typeof value !== 'number' || !isFinite(value)) return undefined;
    const line = Math.floor(value);
    return line > 0 ? line : undefined;
}

/** `"src/a.ts:42"` — `undefined` when there is no usable line. */
export function formatAnchor(file: string | undefined, line: unknown): string | undefined {
    const normalized = normalizeLine(line);
    if (!normalized) return undefined;
    const path = String(file == null ? '' : file).trim().replace(/\\/g, '/');
    if (!path) return undefined;
    return `${path}:${normalized}`;
}

/**
 * Add `anchor` to a payload entry, next to the existing `file` / `line` fields
 * (never instead of them: prompts written against the old shape keep working).
 */
export function withAnchor<T extends object>(
    entry: T,
    file: string | undefined,
    line: unknown,
): T & { anchor?: string } {
    const anchor = formatAnchor(file, line);
    return anchor ? { ...entry, anchor } : { ...entry };
}

/** `withAnchor` over a list, keeping the same order. */
export function withAnchors<T extends object>(
    entries: readonly T[],
    file: (entry: T) => string | undefined,
    line: (entry: T) => unknown,
): (T & { anchor?: string })[] {
    return entries.map(entry => withAnchor(entry, file(entry), line(entry)));
}
