/**
 * context.ts — View context passed from Aura panels to @aura.
 *
 * The store is updated by commands/actions (V1-04) before opening VS Code Chat;
 * the participant reads it to ground answers in what the user is looking at.
 */

export interface AuraCommunityViewContext {
    /** Palette community id in the current webview run (not stable across recomputes). */
    id?: number;
    /** Stable content hash of the member files. */
    key?: string;
    /** Display label (custom user label or hub path). */
    name: string;
    /** Automatic hub path, even when the user renamed the group. */
    autoName?: string;
    /** Hub file path (highest structural fan-in). */
    hub?: string;
    /** Number of code files in the full palette group. */
    fileCount?: number;
    /** Authoritative member files from the palette's shared Louvain snapshot. */
    files: string[];
    /** True when `files` is a capped subset of the group. */
    truncated?: boolean;
}

/** One violation sample carried by a layer context. */
export interface AuraLayerViolationSample {
    rule: string;
    severity: string;
    kind?: string;
    source: string;
    target: string;
    baselined?: boolean;
}

/** Layer selected from the Layers palette — membership is evaluated by Aura. */
export interface AuraLayerViewContext {
    /** Layer name from `.aura/arch-rules.json`. */
    name: string;
    /** Globs that define the layer, in rule order (first match wins). */
    paths?: string[];
    /** Number of code files in the layer (documentation excluded). */
    fileCount?: number;
    /** Authoritative member files, capped. */
    files: string[];
    /** True when `files` is a capped subset of the layer. */
    truncated?: boolean;
    /** Martin coupling metrics. */
    ca?: number;
    ce?: number;
    instability?: number | null;
    /** Violation counters for this layer (as source). */
    violations?: number;
    newViolations?: number;
    baselined?: number;
    /** Rule ids that involve this layer. */
    rules?: string[];
    /** Sample of violations touching the layer. */
    violationSamples?: AuraLayerViolationSample[];
    /** Aggregated layer cycles this layer participates in. */
    cycles?: string[][];
    /** Synthetic "files outside every layer" bucket (ask not offered). */
    unlayered?: boolean;
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
    /** Layer selected from the Layers palette — membership comes from the rules. */
    layer?: AuraLayerViewContext;
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
        const auto = group.autoName && group.autoName !== group.name ? `, auto hub path: ${group.autoName}` : '';
        lines.push(`- Communities palette group: "${group.name}"${id} — ${total} code files${auto}`);
        if (group.hub) lines.push(`  hub file: \`${group.hub}\``);
        lines.push('  The palette file list below is the authoritative code-only Louvain membership shared by the webview, @aura and MCP. Documentation is excluded from communities, fan-in and centrality. Its label may be a user rename; do not substitute another community.');
        const listed = group.files.map(file => `\`${file}\``).join(', ');
        const omitted = group.truncated ? ` … (+${Math.max(0, total - group.files.length)} not listed)` : '';
        lines.push(`  palette files: ${listed}${omitted}`);
    }
    if (ctx.layer) {
        const layer = ctx.layer;
        const total = layer.fileCount ?? layer.files.length;
        const globs = layer.paths && layer.paths.length > 0
            ? `, globs: ${layer.paths.map(path => `\`${path}\``).join(', ')}`
            : '';
        lines.push(`- Architecture layer: "${layer.name}" — ${total} code files${globs}`);
        if (typeof layer.ca === 'number' || typeof layer.ce === 'number') {
            const instability = typeof layer.instability === 'number' ? layer.instability.toFixed(2) : 'n/a';
            lines.push(`  coupling: Ca ${layer.ca ?? 0} · Ce ${layer.ce ?? 0} · instability ${instability}`);
        }
        if (typeof layer.violations === 'number') {
            const rules = layer.rules && layer.rules.length > 0 ? ` (rules: ${layer.rules.join(', ')})` : '';
            lines.push(`  violations: ${layer.newViolations ?? 0} new, ${layer.baselined ?? 0} baselined${rules}`);
        }
        lines.push('  Membership is evaluated by Aura from `.aura/arch-rules.json` (first matching glob wins) and is authoritative. Documentation is excluded. Distinguish code fixes from rule changes, and never present a baselined violation as new.');
        if (layer.cycles && layer.cycles.length > 0) {
            lines.push('  layer cycles: ' + layer.cycles.map(cycle => cycle.join(' ↔ ')).join('; '));
        }
        if (layer.violationSamples && layer.violationSamples.length > 0) {
            lines.push('  violation sample: ' + layer.violationSamples.map(sample =>
                `\`${sample.source}\` → \`${sample.target}\` (${sample.rule}, ${sample.severity}${sample.baselined ? ', baselined' : ''})`,
            ).join('; '));
        }
        const listed = layer.files.map(file => `\`${file}\``).join(', ');
        const omitted = layer.truncated ? ` … (+${Math.max(0, total - layer.files.length)} not listed)` : '';
        lines.push(`  layer files: ${listed}${omitted}`);
    }
    if (ctx.filters && Object.keys(ctx.filters).length > 0) {
        lines.push(`- filters: ${JSON.stringify(ctx.filters)}`);
    }
    return lines.join('\n');
}
