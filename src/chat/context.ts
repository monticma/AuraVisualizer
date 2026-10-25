/**
 * context.ts — View context passed from Aura panels to @aura.
 *
 * The store is updated by commands/actions (V1-04) before opening VS Code Chat;
 * the participant reads it to ground answers in what the user is looking at.
 */

export interface AuraCommunityViewContext {
    /** Palette community id in the current webview run (not stable across recomputes). */
    id?: number;
    /** Palette label, derived from the highest fan-in file. Not a canonical community id. */
    name: string;
    /** Number of files in the full palette group. */
    fileCount?: number;
    /** Authoritative member files from the palette's Louvain run. */
    files: string[];
    /** True when `files` is a capped subset of the group. */
    truncated?: boolean;
}

export interface AuraViewContext {
    /** Workspace-relative file currently selected in Aura. */
    selection?: string;
    /** Active Aura tab (graph, risk, timeline, …). */
    tab?: string;
    /** Active heatmap mode. */
    heatmap?: string;
    /** Active language/dirty/query filters. */
    filters?: Record<string, unknown>;
    /** Group selected from the Communities palette — membership is authoritative. */
    community?: AuraCommunityViewContext;
    /** Active AQL query. */
    query?: string;
    /** Timeline commit hash or label. */
    commit?: string;
    /** Active warp name. */
    warp?: string;
}

let current: AuraViewContext | undefined;

export function setAuraViewContext(ctx: AuraViewContext | undefined): void {
    current = ctx;
}

export function getAuraViewContext(): AuraViewContext | undefined {
    return current;
}

export function describeAuraViewContext(ctx: AuraViewContext | undefined = current): string {
    if (!ctx) return '';
    const lines: string[] = [];
    if (ctx.selection) lines.push(`- selected file: ${ctx.selection}`);
    if (ctx.tab) lines.push(`- active tab: ${ctx.tab}`);
    if (ctx.heatmap) lines.push(`- heatmap: ${ctx.heatmap}`);
    if (ctx.query) lines.push(`- active AQL query: ${ctx.query}`);
    if (ctx.commit) lines.push(`- timeline commit: ${ctx.commit}`);
    if (ctx.warp) lines.push(`- warp: ${ctx.warp}`);
    if (ctx.community) {
        const group = ctx.community;
        const total = group.fileCount ?? group.files.length;
        const id = typeof group.id === 'number' ? ` (palette id ${group.id})` : '';
        lines.push(`- Communities palette group: "${group.name}"${id} — ${total} files`);
        lines.push('  The palette file list below is the authoritative Louvain membership computed by the webview. Its label is derived from the highest fan-in file, not a canonical community id: `aura_get_communities` may label or order the same group differently, so do not substitute another community.');
        const listed = group.files.map(file => `\`${file}\``).join(', ');
        const omitted = group.truncated ? ` … (+${Math.max(0, total - group.files.length)} not listed)` : '';
        lines.push(`  palette files: ${listed}${omitted}`);
    }
    if (ctx.filters && Object.keys(ctx.filters).length > 0) {
        lines.push(`- filters: ${JSON.stringify(ctx.filters)}`);
    }
    return lines.join('\n');
}
