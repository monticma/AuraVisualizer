/**
 * codelens-core.ts — pure logic behind the Aura CodeLens provider (V3-01).
 *
 * Kept free of the `vscode` module (same split as `commands/navigation-core`)
 * so vitest can cover the selection, placement and fallback rules without an
 * extension host; `codelens.ts` holds the provider and the commands.
 */

/** One anchor: a symbol that deserves a lens. `line` is 1-based (parser/DB). */
export interface LensSymbol {
    name: string;
    kind: string;
    line: number;
}

/** A row as stored in the `symbols` table (only the fields we read). */
export interface LensSymbolRow {
    name?: unknown;
    kind?: unknown;
    line?: unknown;
}

/**
 * Symbol kinds that must never get a lens.
 *
 * A **denylist** on purpose: the 12 parsers emit a wide range of `type`
 * values (`function`, `generator`, `arrow`, `method`, `class`, `struct`,
 * `enum`, `macro`, `interface`, `trait`, `type_alias`…). Anything new should
 * get a lens by default rather than silently disappear; only rows that
 * describe *edges*, *imports* or *references* are filtered out.
 */
export const NON_LENS_KINDS = new Set([
    'import',
    'from-import',
    'export',
    'export-named',
    'export-default',
    'export-all',
    'export-namespace',
    'variable',
    'constant',
    'field',
    'property',
    'decorator',
    'function-call',
    'call',
    'extends',
    'implements',
    'reference',
]);

/** Hard cap — a 5 000-function bundle must never freeze the editor. */
export const MAX_LENSES_PER_FILE = 300;

/** Lens label. A single click opens the action picker (focus / flow / impact). */
export const LENS_TITLE = '⟡ focus · flow · impact';

/**
 * GraphDB symbol rows → lens anchors, sorted by line.
 *
 * Drops rows without a usable name/line, reference-ish kinds and duplicates
 * (some parsers emit the same symbol twice, e.g. a class and its constructor).
 */
export function selectLensSymbols(
    rows: ReadonlyArray<LensSymbolRow> | null | undefined,
    limit: number = MAX_LENSES_PER_FILE,
): LensSymbol[] {
    if (!rows || !rows.length) return [];
    const seen = new Set<string>();
    const out: LensSymbol[] = [];
    for (const row of rows) {
        if (!row) continue;
        const name = typeof row.name === 'string' ? row.name.trim() : '';
        const kind = typeof row.kind === 'string' ? row.kind.trim().toLowerCase() : '';
        const rawLine = typeof row.line === 'number' ? row.line : Number(row.line);
        if (!name || !kind || !Number.isFinite(rawLine) || rawLine < 1) continue;
        if (NON_LENS_KINDS.has(kind)) continue;
        const line = Math.floor(rawLine);
        const key = `${line}\u0000${name}\u0000${kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ name, kind, line });
    }
    out.sort((a, b) => a.line - b.line || a.name.localeCompare(b.name));
    return limit > 0 ? out.slice(0, limit) : out;
}

/** 1-based symbol line → 0-based CodeLens line (clamped, never negative). */
export function lensLine(symbolLine: number): number {
    if (!Number.isFinite(symbolLine) || symbolLine <= 1) return 0;
    return Math.floor(symbolLine) - 1;
}

/** Shape of a `vscode.DocumentSymbol` (plain data — no vscode import). */
export interface DocumentSymbolLike {
    name: string;
    kind: number;
    range?: { start?: { line?: number } };
    children?: ReadonlyArray<DocumentSymbolLike>;
}

/**
 * VS Code `SymbolKind` number → Aura symbol kind.
 *
 * Only the kinds that make sense for an Aura lens map to a string; everything
 * else returns `null` (the symbol is skipped by the fallback).
 */
export function symbolKindName(kind: number): string | null {
    switch (kind) {
        case 5: return 'class';      // SymbolKind.Class
        case 6: return 'method';     // SymbolKind.Method
        case 10: return 'enum';      // SymbolKind.Enum
        case 11: return 'interface'; // SymbolKind.Interface
        case 12: return 'function';  // SymbolKind.Function
        case 23: return 'struct';    // SymbolKind.Struct
        default: return null;
    }
}

/**
 * Document-symbol fallback: flatten the tree (top two levels) into anchors.
 *
 * Used when a file *is* analyzed but GraphDB has no symbol rows for it (a
 * language whose parser does not extract symbols). Container symbols are
 * walked into so methods of an exported class are still reachable.
 */
export function documentSymbolAnchors(
    symbols: ReadonlyArray<DocumentSymbolLike> | null | undefined,
    limit: number = MAX_LENSES_PER_FILE,
): LensSymbol[] {
    const out: LensSymbol[] = [];
    const walk = (list: ReadonlyArray<DocumentSymbolLike> | null | undefined, depth: number): void => {
        if (!list || depth > 1 || out.length >= limit) return;
        for (const symbol of list) {
            if (!symbol || typeof symbol.name !== 'string') continue;
            const kind = symbolKindName(symbol.kind);
            const line = symbol.range?.start?.line;
            if (kind && typeof line === 'number' && Number.isFinite(line)) {
                out.push({ name: symbol.name, kind, line: Math.floor(line) + 1 });
            }
            if (symbol.children && symbol.children.length) walk(symbol.children, depth + 1);
            if (out.length >= limit) return;
        }
    };
    walk(symbols, 0);
    return out;
}

/** Command arguments produced by a lens (kept as a tuple so tests pin the order). */
export type LensArguments = [fileId: string, name: string, line: number, language: string];

export function lensArguments(fileId: string, symbol: LensSymbol, language: string): LensArguments {
    return [fileId, symbol.name, symbol.line, language];
}
