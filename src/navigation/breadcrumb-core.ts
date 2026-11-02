/**
 * breadcrumb-core.ts — Pure navigation trail for the graph (V3-12).
 *
 * The webview records "places" — a focus, a pin, a blast, a query, a warp — and
 * this module owns everything that can be wrong with a history: the cap, the
 * consecutive-duplicate filter, the back / truncate semantics and the short chip
 * labels.
 *
 * Entries only ever hold **ids and plain numbers** (never live node objects or
 * Three.js instances), so a dataset rebuild can never leave a dead reference
 * behind in the pile.
 *
 * No `vscode` / DOM import — unit-testable in plain Node and bundled into the
 * webview as `window.AuraBreadcrumbCore`.
 */

/** How many places the trail keeps (oldest entries fall off the front). */
export const BREADCRUMB_LIMIT = 20;

/** What kind of navigation created the place. */
export type BreadcrumbFocusKind = 'none' | 'pin' | 'blast' | 'multi';

export interface BreadcrumbQuery {
    expr: string;
    mode: string;
}

export interface BreadcrumbEntry {
    /** Short chip label — a file name, `Pinned: x.ts (d2)`, `layer=web`. */
    label: string;
    /** Leading emoji of the chip. */
    icon?: string;
    /** Longer text for the tooltip (full path, counts). */
    detail?: string;
    /** Active tab when the place was recorded. */
    tab?: string;
    focusKind?: BreadcrumbFocusKind;
    /** Selected / pinned / impacted node ids. */
    nodeIds?: string[];
    /** Pin depth for `focusKind: 'pin'`. */
    depth?: number;
    /** Active query, when one was applied. */
    query?: BreadcrumbQuery | null;
    /** Opaque camera pose (`AuraWarps.capturePose`) — compared by nobody. */
    pose?: unknown;
}

export interface BreadcrumbBackResult {
    stack: BreadcrumbEntry[];
    /** The place to restore (the new top), absent when there is nothing left. */
    entry?: BreadcrumbEntry;
}

/** Last segment of a path, for chip labels (`src/a/b.ts` → `b.ts`). */
export function fileName(filePath: string): string {
    if (!filePath) return '';
    const clean = String(filePath).replace(/\\/g, '/').replace(/\/+$/, '');
    const parts = clean.split('/');
    return parts[parts.length - 1] || clean;
}

/** One-line, length-capped text for a chip label. */
export function truncateText(text: string, max = 28): string {
    const value = String(text == null ? '' : text).replace(/\s+/g, ' ').trim();
    const limit = Math.max(1, Math.floor(max) || 28);
    if (value.length <= limit) return value;
    return `${value.slice(0, limit - 1).trimEnd()}…`;
}

function queryKey(entry: BreadcrumbEntry | undefined): string {
    if (!entry || !entry.query || !entry.query.expr) return '';
    return `${entry.query.expr}:${entry.query.mode || ''}`;
}

/**
 * Two places are the same when they lead to the same spot — the camera pose and
 * the tooltip are deliberately ignored (the camera moves on every frame).
 */
export function sameEntry(a?: BreadcrumbEntry | null, b?: BreadcrumbEntry | null): boolean {
    if (!a || !b) return false;
    if ((a.label || '') !== (b.label || '')) return false;
    if ((a.focusKind || 'none') !== (b.focusKind || 'none')) return false;
    if ((a.tab || '') !== (b.tab || '')) return false;
    if ((a.depth || 0) !== (b.depth || 0)) return false;
    if ((a.nodeIds || []).join('|') !== (b.nodeIds || []).join('|')) return false;
    return queryKey(a) === queryKey(b);
}

function normalizeEntry(entry: BreadcrumbEntry): BreadcrumbEntry {
    const copy: BreadcrumbEntry = {
        label: entry.label,
        focusKind: entry.focusKind || 'none',
        nodeIds: Array.isArray(entry.nodeIds) ? entry.nodeIds.filter(id => typeof id === 'string') : [],
    };
    if (entry.icon) copy.icon = entry.icon;
    if (entry.detail) copy.detail = entry.detail;
    if (entry.tab) copy.tab = entry.tab;
    if (typeof entry.depth === 'number' && isFinite(entry.depth)) copy.depth = entry.depth;
    if (entry.query && entry.query.expr) {
        copy.query = { expr: entry.query.expr, mode: entry.query.mode || 'filter' };
    }
    // The pose is copied by reference on purpose: it is opaque, immutable and
    // dropped with the entry.
    if (entry.pose) copy.pose = entry.pose;
    return copy;
}

/**
 * Append a place. A pending duplicate (same spot as the current top) is dropped
 * so clicking the same file five times does not fill the trail, and the stack
 * never grows past `limit`.
 */
export function pushEntry(
    stack: readonly BreadcrumbEntry[] | undefined,
    entry: BreadcrumbEntry | undefined,
    limit = BREADCRUMB_LIMIT,
): BreadcrumbEntry[] {
    const current = Array.isArray(stack) ? [...stack] : [];
    if (!entry || typeof entry.label !== 'string' || !entry.label.trim()) return current;
    if (sameEntry(current[current.length - 1], entry)) return current;

    const cap = Math.max(1, Math.floor(limit) || BREADCRUMB_LIMIT);
    const next = [...current, normalizeEntry(entry)];
    return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Step back one place: the returned entry is the new top to restore. */
export function back(stack: readonly BreadcrumbEntry[] | undefined): BreadcrumbBackResult {
    const current = Array.isArray(stack) ? [...stack] : [];
    if (current.length < 2) return { stack: current };
    const next = current.slice(0, -1);
    return { stack: next, entry: next[next.length - 1] };
}

/** Click a chip: keep it and everything before it, drop the rest. */
export function truncateTo(
    stack: readonly BreadcrumbEntry[] | undefined,
    index: number,
): BreadcrumbEntry[] {
    const current = Array.isArray(stack) ? [...stack] : [];
    if (!Number.isInteger(index) || index < 0 || index >= current.length) return current;
    return current.slice(0, index + 1);
}

/** Tooltip text for a chip: label, detail, then how many files it covers. */
export function entryTooltip(entry: BreadcrumbEntry | undefined): string {
    if (!entry) return '';
    const parts: string[] = [entry.label];
    if (entry.detail && entry.detail !== entry.label) parts.push(entry.detail);
    const count = entry.nodeIds ? entry.nodeIds.length : 0;
    if (count > 1) parts.push(`${count} files`);
    return parts.join(' — ');
}
