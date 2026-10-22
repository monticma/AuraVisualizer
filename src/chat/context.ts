/**
 * context.ts — View context passed from Aura panels to @aura.
 *
 * The store is updated by commands/actions (V1-04) before opening VS Code Chat;
 * the participant reads it to ground answers in what the user is looking at.
 */

export interface AuraViewContext {
    /** Workspace-relative file currently selected in Aura. */
    selection?: string;
    /** Active Aura tab (graph, risk, timeline, …). */
    tab?: string;
    /** Active heatmap mode. */
    heatmap?: string;
    /** Active language/dirty/query filters. */
    filters?: Record<string, unknown>;
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
    if (ctx.filters && Object.keys(ctx.filters).length > 0) {
        lines.push(`- filters: ${JSON.stringify(ctx.filters)}`);
    }
    return lines.join('\n');
}
