/**
 * symbol-palette-core.ts — Pure list building for "Aura: Find Symbol…" (V3-09).
 *
 * The QuickPick itself lives in `symbol-palette.ts`; everything that can be
 * wrong (kind filter, dedupe, relevance order, caps, wording) is pure and
 * unit-tested here.
 */

export interface SymbolRow {
    nodeId: string;
    name: string;
    kind: string;
    line: number;
    visibility?: string;
    isStatic?: boolean;
    isAsync?: boolean;
    cognitive?: number | null;
    maintainability?: number | null;
}

export interface SymbolQuickPickEntry {
    label: string;
    description: string;
    detail: string;
    symbol: SymbolRow;
}

export interface SymbolQuickPick {
    items: SymbolQuickPickEntry[];
    total: number;
    truncated: boolean;
}

export interface SymbolKindCount {
    kind: string;
    count: number;
}

export interface SymbolKindChip {
    /** `undefined` = all kinds. */
    kind: string | undefined;
    label: string;
    description: string;
}

/** Kinds the parser produces, in the order the chips are shown. */
export const SYMBOL_KIND_ORDER = [
    'function', 'method', 'class', 'interface', 'struct', 'enum', 'trait', 'type_alias', 'macro',
] as const;

const KIND_ICONS: Record<string, string> = {
    function: '$(symbol-function)',
    method: '$(symbol-method)',
    class: '$(symbol-class)',
    interface: '$(symbol-interface)',
    struct: '$(symbol-struct)',
    enum: '$(symbol-enum)',
    trait: '$(symbol-interface)',
    type_alias: '$(symbol-type-parameter)',
    macro: '$(symbol-constant)',
};

export const MAX_SYMBOL_ITEMS = 200;

export interface BuildSymbolOptions {
    query?: string;
    kind?: string;
    limit?: number;
}

/**
 * Build the symbol rows of the picker: kind filter, dedupe on
 * `(file, name, kind)`, prefix matches first then alphabetical, capped.
 */
export function buildSymbolQuickPick(
    rows: readonly SymbolRow[],
    options: BuildSymbolOptions = {},
): SymbolQuickPick {
    const needle = (options.query ?? '').trim().toLowerCase();
    const limit = Math.max(1, options.limit ?? MAX_SYMBOL_ITEMS);

    const seen = new Set<string>();
    const filtered: SymbolRow[] = [];
    for (const row of rows) {
        if (!row || !row.name || !row.nodeId) continue;
        if (options.kind && row.kind !== options.kind) continue;
        const key = `${row.nodeId}|${row.name}|${row.kind}`;
        if (seen.has(key)) continue;
        seen.add(key);
        filtered.push(row);
    }

    filtered.sort((a, b) => {
        const aPrefix = needle && a.name.toLowerCase().startsWith(needle) ? 0 : 1;
        const bPrefix = needle && b.name.toLowerCase().startsWith(needle) ? 0 : 1;
        if (aPrefix !== bPrefix) return aPrefix - bPrefix;
        return a.name.localeCompare(b.name) || a.nodeId.localeCompare(b.nodeId);
    });

    const items = filtered.slice(0, limit).map(row => ({
        label: row.name,
        description: `${row.kind} · ${row.nodeId}:${row.line}`,
        detail: symbolDetail(row),
        symbol: row,
    }));

    return { items, total: filtered.length, truncated: filtered.length > items.length };
}

/** `cognitive 7 · MI 82 · async` — only what the row actually carries. */
export function symbolDetail(row: SymbolRow): string {
    const parts: string[] = [];
    if (typeof row.cognitive === 'number' && Number.isFinite(row.cognitive)) parts.push(`cognitive ${row.cognitive}`);
    if (typeof row.maintainability === 'number' && Number.isFinite(row.maintainability)) {
        parts.push(`MI ${Math.round(row.maintainability)}`);
    }
    if (row.isAsync) parts.push('async');
    if (row.visibility && row.visibility !== 'public') parts.push(row.visibility);
    return parts.join(' · ');
}

/**
 * One chip per kind actually present (plus "All kinds"), ordered like the
 * parser's kinds then alphabetically for anything unknown.
 */
export function buildKindChips(
    counts: readonly SymbolKindCount[],
    activeKind?: string,
): SymbolKindChip[] {
    const rank = (kind: string): number => {
        const index = (SYMBOL_KIND_ORDER as readonly string[]).indexOf(kind);
        return index < 0 ? SYMBOL_KIND_ORDER.length : index;
    };
    const sorted = [...counts]
        .filter(entry => entry && entry.kind && entry.count > 0)
        .sort((a, b) => rank(a.kind) - rank(b.kind) || a.kind.localeCompare(b.kind));

    const chips: SymbolKindChip[] = [{
        kind: undefined,
        label: '$(list-flat) All kinds',
        description: activeKind === undefined ? 'active filter' : 'show every kind',
    }];

    for (const entry of sorted) {
        chips.push({
            kind: entry.kind,
            label: `${KIND_ICONS[entry.kind] || '$(symbol-misc)'} ${entry.kind} (${entry.count})`,
            description: activeKind === entry.kind ? 'active filter' : 'filter by kind',
        });
    }
    return chips;
}
