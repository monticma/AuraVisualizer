/**
 * palette-core.ts — pure builders behind the enriched command palette (V3-03).
 *
 * Three palette commands need a list to pick from: analyzed files, saved queries
 * and (for warps) nothing at all. Building those lists — which nodes count, what
 * the QuickPick labels/descriptions say, sorting and the truncation cap — is
 * plain data work, so it lives here (no `vscode` import) and is unit-tested.
 */

/** Minimal node shape read by the file picker (a `GraphNode` is compatible). */
export interface PaletteNode {
    id: string;
    language?: string;
    group?: string;
    linesOfCode?: number;
    layer?: string;
    archViolations?: number;
    fanIn?: number;
    fanOut?: number;
}

export interface FileQuickPickItem {
    label: string;
    description: string;
    detail: string;
    nodeId: string;
}

export interface FilePickResult {
    items: FileQuickPickItem[];
    /** Total number of eligible nodes, before the cap. */
    total: number;
    truncated: boolean;
}

/** Upper bound for the file picker — VS Code stays smooth well beyond this. */
export const MAX_FILE_ITEMS = 5000;

/** Documentation nodes are not code: they never appear in the file picker. */
const DOCUMENTATION = 'documentation';

/**
 * Build the QuickPick items for "Aura: Focus File…".
 *
 * Code nodes only (documentation is excluded, like every other structural
 * surface), sorted by path so the result is stable and the QuickPick's fuzzy
 * matcher does the rest. `description` carries language + directory and
 * `detail` the metrics that make two same-named files distinguishable.
 */
export function buildFileQuickPick(
    nodes: ReadonlyArray<PaletteNode> | null | undefined,
    limit: number = MAX_FILE_ITEMS,
): FilePickResult {
    if (!nodes || !nodes.length) return { items: [], total: 0, truncated: false };

    const eligible: PaletteNode[] = [];
    const seen = new Set<string>();
    for (const node of nodes) {
        if (!node || typeof node.id !== 'string') continue;
        const id = node.id.replace(/\\/g, '/');
        if (!id || id.startsWith('..') || id === '') continue;
        if ((node.language || '').toLowerCase() === DOCUMENTATION) continue;
        if (seen.has(id)) continue;
        seen.add(id);
        eligible.push({ ...node, id });
    }

    eligible.sort((a, b) => a.id.localeCompare(b.id));

    const cap = limit > 0 ? limit : eligible.length;
    const items = eligible.slice(0, cap).map(node => ({
        label: node.id,
        description: fileDescription(node),
        detail: fileDetail(node),
        nodeId: node.id,
    }));
    return { items, total: eligible.length, truncated: eligible.length > items.length };
}

function fileDescription(node: PaletteNode): string {
    const parts: string[] = [];
    if (node.language) parts.push(node.language);
    if (node.group && node.group !== node.id) parts.push(node.group);
    return parts.join(' · ');
}

function fileDetail(node: PaletteNode): string {
    const parts: string[] = [];
    if (typeof node.linesOfCode === 'number' && node.linesOfCode > 0) parts.push(`${node.linesOfCode} LOC`);
    if (typeof node.fanIn === 'number' || typeof node.fanOut === 'number') {
        parts.push(`↘ ${node.fanOut || 0} · ↗ ${node.fanIn || 0}`);
    }
    if (node.layer) parts.push(`🏛️ ${node.layer}`);
    if (typeof node.archViolations === 'number' && node.archViolations > 0) {
        parts.push(`⚠ ${node.archViolations} violation${node.archViolations > 1 ? 's' : ''}`);
    }
    return parts.join(' · ');
}

/** Row shape of `GraphDB.listSavedQueries()`. */
export interface SavedQueryRow {
    id?: string;
    name?: string;
    expr?: string;
    mode?: string;
    createdAt?: number;
}

export interface QueryQuickPickItem {
    label: string;
    description: string;
    detail: string;
    expr: string;
    mode: 'highlight' | 'filter' | 'select';
}

export const QUERY_MODES = ['filter', 'highlight', 'select'] as const;

/** Normalize a stored mode to the three the webview understands. */
export function normalizeQueryMode(mode: unknown): 'highlight' | 'filter' | 'select' {
    return mode === 'highlight' || mode === 'select' ? mode : 'filter';
}

/**
 * Build the QuickPick items for "Aura: Apply Saved Query…".
 *
 * Queries without an expression are dropped (an empty query would clear the
 * whole filter), and the most recent ones come first — that is almost always
 * the one you want to replay.
 */
export function buildQueryQuickPick(queries: ReadonlyArray<SavedQueryRow> | null | undefined): QueryQuickPickItem[] {
    if (!queries || !queries.length) return [];
    const items: Array<QueryQuickPickItem & { createdAt: number; order: number }> = [];
    queries.forEach((query, index) => {
        const expr = typeof query?.expr === 'string' ? query.expr.trim() : '';
        if (!expr) return;
        const name = typeof query.name === 'string' ? query.name.trim() : '';
        items.push({
            label: name || expr,
            description: expr,
            detail: `${normalizeQueryMode(query.mode)}${query.createdAt ? ' · ' + formatDate(query.createdAt) : ''}`,
            expr,
            mode: normalizeQueryMode(query.mode),
            createdAt: typeof query.createdAt === 'number' ? query.createdAt : 0,
            order: index,
        });
    });
    items.sort((a, b) => b.createdAt - a.createdAt || a.order - b.order);
    return items.map(({ createdAt: _createdAt, order: _order, ...item }) => item);
}

/** Short local date for the picker detail line. */
function formatDate(epochMs: number): string {
    if (!Number.isFinite(epochMs) || epochMs <= 0) return '';
    try {
        return new Date(epochMs).toISOString().slice(0, 10);
    } catch {
        return '';
    }
}
