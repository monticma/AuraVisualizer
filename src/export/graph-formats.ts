/**
 * graph-formats.ts — « sortir le graphe » : DOT, GraphML et Mermaid.
 *
 * Three serialisers, one shape in, one shape out. Everything here is pure and
 * **deterministic** — nodes sorted by id, edges by `(source, target, type)`,
 * clusters by name — so two exports of the same graph are byte-identical: a
 * golden test can hold them, and a pull-request diff stays readable.
 *
 * The formats intentionally carry different things:
 *  - DOT is the one a human reads in a PR: clusters by folder, node width from
 *    the file size, edges narrowed to their type, and the `unflatten` tip in a
 *    comment because a thin graph draws as a hairball otherwise.
 *  - GraphML is the one a tool reads: typed `<key>`s, synthetic node ids, and
 *    the path in a `<data>` (a path with `/` is not a safe XML id).
 *  - Mermaid is the one that fits in a README — and the one that dies past a few
 *    hundred boxes, so it is capped by a setting (`0` = no cap).
 */

export type GraphFormat = 'dot' | 'graphml' | 'mermaid';

export type ClusterMode = 'first-level' | 'full';
export type GraphMlGrouping = 'attribute' | 'nested';

export interface GraphNodeLike {
    id: string;
    name?: string;
    group?: string;
    language?: string;
    linesOfCode?: number;
    fanIn?: number;
    fanOut?: number;
}

export interface GraphLinkLike {
    /** A path, or an already-expanded node object (3d-force-graph mutates). */
    source: string | { id?: string };
    target: string | { id?: string };
    type?: string;
    confidence?: number;
}

export interface GraphInput {
    nodes: readonly GraphNodeLike[];
    links: readonly GraphLinkLike[];
    projectName?: string;
}

export interface GraphFormatOptions {
    /** Nodes kept in the Mermaid export; `0` means no cap. */
    mermaidNodeLimit: number;
    /** DOT and Mermaid: group files by first path segment or by full folder. */
    clusters: ClusterMode;
    /** GraphML: a `group` attribute per node, or nested `<graph>` elements. */
    graphmlGroups: GraphMlGrouping;
}

export const DEFAULT_GRAPH_FORMAT_OPTIONS: GraphFormatOptions = {
    mermaidNodeLimit: 300,
    clusters: 'first-level',
    graphmlGroups: 'attribute',
};

export interface GraphFormatResult {
    text: string;
    extension: string;
    /** Save-dialog filters, in the shape `saveOrCopyText` expects. */
    filters: Record<string, string[]>;
    /** Human label for the notification / quick pick. */
    label: string;
}

// ── Shared normalisation ───────────────────────────────────────

interface NormalizedGraph {
    nodes: GraphNodeLike[];
    links: { source: string; target: string; type: string; confidence: number }[];
    projectName: string;
}

function endpointId(value: string | { id?: string } | undefined): string {
    if (typeof value === 'string') return value;
    return value && typeof value.id === 'string' ? value.id : '';
}

function normalize(input: GraphInput): NormalizedGraph {
    const nodes = [...input.nodes]
        .filter(node => node && typeof node.id === 'string' && node.id.length > 0)
        .sort((a, b) => a.id.localeCompare(b.id));
    const known = new Set(nodes.map(node => node.id));

    const links = input.links
        .map(link => ({
            source: endpointId(link.source),
            target: endpointId(link.target),
            type: link.type || 'import',
            confidence: typeof link.confidence === 'number' ? link.confidence : 1,
        }))
        // An edge to a node that is not in the export is not an edge: it would
        // make Graphviz and NetworkX invent a node.
        .filter(link => link.source && link.target && known.has(link.source) && known.has(link.target))
        .sort((a, b) =>
            a.source.localeCompare(b.source)
            || a.target.localeCompare(b.target)
            || a.type.localeCompare(b.type));

    return { nodes, links, projectName: input.projectName || 'Aura' };
}

function baseName(id: string): string {
    const parts = id.split('/');
    return parts[parts.length - 1] || id;
}

function dirOf(id: string): string {
    const cut = id.lastIndexOf('/');
    return cut > 0 ? id.slice(0, cut) : '';
}

/** The bucket a node is drawn in: its first segment, or its full folder. */
export function clusterOf(node: GraphNodeLike, mode: ClusterMode): string {
    if (mode === 'full') return dirOf(node.id) || '.';
    const group = node.group || node.id.split('/')[0];
    return group && group !== node.id ? group : '.';
}

function clusterNames(nodes: readonly GraphNodeLike[], mode: ClusterMode): string[] {
    const seen = new Set<string>();
    for (const node of nodes) seen.add(clusterOf(node, mode));
    return [...seen].sort((a, b) => a.localeCompare(b));
}

// ── DOT ────────────────────────────────────────────────────────

/** DOT quoted-string escaping: `\` and `"` are the only ones that matter. */
function dotText(value: string): string {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

const LANGUAGE_FILL: Record<string, string> = {
    typescript: '#dbeafe', tsx: '#dbeafe', javascript: '#fef3c7', python: '#dcfce7',
    java: '#fde68a', go: '#cffafe', rust: '#fee2e2', kotlin: '#ede9fe',
    ruby: '#ffe4e6', swift: '#ffedd5', csharp: '#e0e7ff', php: '#f3e8ff',
    c: '#f1f5f9', cpp: '#e2e8f0', css: '#e0f2fe', html: '#fed7aa', vue: '#d1fae5',
    bash: '#f5f5f4', lua: '#eef2ff', documentation: '#f3f4f6',
};

function fillFor(language: string | undefined): string {
    return LANGUAGE_FILL[(language || '').toLowerCase()] || '#f9fafb';
}

/** Node width from the file size — four bands, so the eye ranks them. */
function penWidthFor(lines: number | undefined): string {
    const value = typeof lines === 'number' && isFinite(lines) ? lines : 0;
    if (value >= 4000) return '4.0';
    if (value >= 1500) return '3.2';
    if (value >= 500) return '2.2';
    if (value >= 100) return '1.4';
    return '1.0';
}

/**
 * Graphviz. Clusters by folder (setting), node width from the file size, fill
 * colour from the language, dashed edges for documentation references.
 */
export function toDot(input: GraphInput, options: GraphFormatOptions = DEFAULT_GRAPH_FORMAT_OPTIONS): string {
    const graph = normalize(input);
    const clusters = clusterNames(graph.nodes, options.clusters);
    const clusterId = new Map<string, string>();
    clusters.forEach((name, index) => clusterId.set(name, `cluster_${index}`));

    const lines: string[] = [];
    lines.push(`// ${graph.projectName} — ${graph.nodes.length} nodes, ${graph.links.length} edges, generated by Aura Visualizer.`);
    lines.push('// Thin graphs draw as a hairball: pipe this through');
    lines.push('//   unflatten -l 3 -c 5 aura-graph.dot | dot -Tsvg > aura-graph.svg');
    lines.push('digraph aura {');
    lines.push('  graph [rankdir=LR, overlap=false, splines=true, fontname="Helvetica", fontsize=10];');
    lines.push('  node [shape=box, style="rounded,filled", fontsize=9, penwidth=1.2, color="#4b5563"];');
    lines.push('  edge [color="#8899a6", arrowsize=0.6, fontsize=8];');
    lines.push('');

    for (const cluster of clusters) {
        const members = graph.nodes.filter(node => clusterOf(node, options.clusters) === cluster);
        if (members.length === 0) continue;
        lines.push(`  subgraph ${clusterId.get(cluster)} {`);
        lines.push(`    label="${dotText(cluster)}";`);
        lines.push('    style="rounded,dashed";');
        lines.push('    color="#374151";');
        lines.push('    fontsize=11;');
        for (const node of members) {
            const attributes = [
                `label="${dotText(node.name || baseName(node.id))}"`,
                `tooltip="${dotText(node.id)}"`,
                `fillcolor="${fillFor(node.language)}"`,
                `penwidth=${penWidthFor(node.linesOfCode)}`,
            ];
            lines.push(`    "${dotText(node.id)}" [${attributes.join(', ')}];`);
        }
        lines.push('  }');
        lines.push('');
    }

    for (const link of graph.links) {
        const attributes: string[] = [];
        if (link.type === 'doc-reference') {
            attributes.push('label="doc-ref"', 'style=dashed');
        } else {
            attributes.push(`label="${dotText(link.type)}"`);
            if (link.confidence < 0.9) attributes.push('style=dotted');
        }
        lines.push(`  "${dotText(link.source)}" -> "${dotText(link.target)}" [${attributes.join(', ')}];`);
    }

    lines.push('}');
    lines.push('');
    return lines.join('\n');
}

// ── GraphML ────────────────────────────────────────────────────

function xmlText(value: unknown): string {
    return String(value === undefined || value === null ? '' : value)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const GRAPHML_KEYS: { id: string; for: 'node' | 'edge'; name: string; type: string }[] = [
    { id: 'path', for: 'node', name: 'path', type: 'string' },
    { id: 'name', for: 'node', name: 'name', type: 'string' },
    { id: 'language', for: 'node', name: 'language', type: 'string' },
    { id: 'group', for: 'node', name: 'group', type: 'string' },
    { id: 'lines', for: 'node', name: 'lines', type: 'int' },
    { id: 'fan_in', for: 'node', name: 'fan_in', type: 'int' },
    { id: 'fan_out', for: 'node', name: 'fan_out', type: 'int' },
    { id: 'edge_type', for: 'edge', name: 'type', type: 'string' },
    { id: 'confidence', for: 'edge', name: 'confidence', type: 'double' },
];

/**
 * GraphML for Gephi / yEd / NetworkX. Node ids are synthetic (`n0`…): a path is
 * not a safe XML id. The grouping is a **setting** — a flat `group` attribute
 * (what Gephi partitions and NetworkX reads without code) or nested `<graph>`
 * elements for tools that understand hierarchy.
 */
export function toGraphMl(input: GraphInput, options: GraphFormatOptions = DEFAULT_GRAPH_FORMAT_OPTIONS): string {
    const graph = normalize(input);
    const idOf = new Map<string, string>();
    graph.nodes.forEach((node, index) => idOf.set(node.id, `n${index}`));

    const lines: string[] = [];
    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push(`<!-- ${xmlText(graph.projectName)} — ${graph.nodes.length} nodes, ${graph.links.length} edges, generated by Aura Visualizer -->`);
    lines.push('<graphml xmlns="http://graphml.graphdrawing.org/xmlns"');
    lines.push('         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
    lines.push('         xsi:schemaLocation="http://graphml.graphdrawing.org/xmlns http://graphml.graphdrawing.org/xmlns/1.0/graphml.xsd">');
    for (const key of GRAPHML_KEYS) {
        lines.push(`  <key id="${key.id}" for="${key.for}" attr.name="${key.name}" attr.type="${key.type}"/>`);
    }

    const nodeLines = (node: GraphNodeLike): string[] => {
        const out: string[] = [];
        const id = idOf.get(node.id)!;
        out.push(`      <node id="${id}">`);
        out.push(`        <data key="path">${xmlText(node.id)}</data>`);
        out.push(`        <data key="name">${xmlText(node.name || baseName(node.id))}</data>`);
        out.push(`        <data key="language">${xmlText(node.language || 'unknown')}</data>`);
        out.push(`        <data key="group">${xmlText(clusterOf(node, options.clusters))}</data>`);
        if (typeof node.linesOfCode === 'number') out.push(`        <data key="lines">${Math.round(node.linesOfCode)}</data>`);
        if (typeof node.fanIn === 'number') out.push(`        <data key="fan_in">${Math.round(node.fanIn)}</data>`);
        if (typeof node.fanOut === 'number') out.push(`        <data key="fan_out">${Math.round(node.fanOut)}</data>`);
        out.push('      </node>');
        return out;
    };

    if (options.graphmlGroups === 'nested') {
        lines.push(`  <graph id="${xmlText(graph.projectName)}" edgedefault="directed">`);
        const clusters = clusterNames(graph.nodes, options.clusters);
        clusters.forEach((cluster, index) => {
            lines.push(`    <node id="g${index}">`);
            lines.push(`      <data key="name">${xmlText(cluster)}</data>`);
            lines.push(`      <graph id="cluster_${index}" edgedefault="directed">`);
            for (const node of graph.nodes.filter(candidate => clusterOf(candidate, options.clusters) === cluster)) {
                lines.push(...nodeLines(node));
            }
            lines.push('      </graph>');
            lines.push('    </node>');
        });
        lines.push(...edgeLines(graph.links, idOf, '    '));
        lines.push('  </graph>');
    } else {
        lines.push(`  <graph id="${xmlText(graph.projectName)}" edgedefault="directed">`);
        for (const node of graph.nodes) lines.push(...nodeLines(node));
        lines.push(...edgeLines(graph.links, idOf, '    '));
        lines.push('  </graph>');
    }

    lines.push('</graphml>');
    lines.push('');
    return lines.join('\n');
}

function edgeLines(
    links: readonly { source: string; target: string; type: string; confidence: number }[],
    idOf: ReadonlyMap<string, string>,
    indent: string,
): string[] {
    const lines: string[] = [];
    links.forEach((link, index) => {
        lines.push(`${indent}<edge id="e${index}" source="${idOf.get(link.source)}" target="${idOf.get(link.target)}">`);
        lines.push(`${indent}  <data key="edge_type">${xmlText(link.type)}</data>`);
        lines.push(`${indent}  <data key="confidence">${link.confidence}</data>`);
        lines.push(`${indent}</edge>`);
    });
    return lines;
}

// ── Mermaid ────────────────────────────────────────────────────

/** Mermaid labels live inside `["…"]`: a quote ends the label. */
function mermaidLabel(value: string): string {
    return String(value || '').replace(/"/g, '#quot;').replace(/</g, '#lt;').replace(/>/g, '#gt;');
}

function mermaidEdgeLabel(value: string): string {
    return String(value || '').replace(/\|/g, '#124;').replace(/"/g, '#quot;');
}

/**
 * Mermaid for a README. Deliberately capped: the renderer gives up past a few
 * hundred boxes, and a blank diagram is worse than a note saying what was left
 * out. `mermaidNodeLimit = 0` lifts the cap for people who know what they want.
 */
export function toMermaid(input: GraphInput, options: GraphFormatOptions = DEFAULT_GRAPH_FORMAT_OPTIONS): string {
    const graph = normalize(input);
    const limit = Math.max(0, Math.floor(options.mermaidNodeLimit || 0));
    const truncated = limit > 0 && graph.nodes.length > limit;
    const nodes = truncated
        ? [...graph.nodes]
            .sort((a, b) => (b.fanIn || 0) - (a.fanIn || 0) || a.id.localeCompare(b.id))
            .slice(0, limit)
            .sort((a, b) => a.id.localeCompare(b.id))
        : graph.nodes;
    const kept = new Set(nodes.map(node => node.id));
    const idOf = new Map<string, string>();
    nodes.forEach((node, index) => idOf.set(node.id, `n${index}`));

    const lines: string[] = [];
    lines.push(`%% ${graph.projectName} — ${nodes.length} of ${graph.nodes.length} nodes, generated by Aura Visualizer`);
    lines.push('graph LR');
    let clusterIndex = 0;
    for (const cluster of clusterNames(nodes, options.clusters)) {
        const members = nodes.filter(node => clusterOf(node, options.clusters) === cluster);
        if (members.length === 0) continue;
        // Synthetic ids: a folder name may contain spaces, dashes or a dot, and
        // Mermaid only tolerates some of those in a bare id.
        lines.push(`  subgraph c${clusterIndex}["${mermaidLabel(cluster)}"]`);
        clusterIndex++;
        for (const node of members) {
            lines.push(`    ${idOf.get(node.id)}["${mermaidLabel(node.name || baseName(node.id))}"]`);
        }
        lines.push('  end');
    }
    for (const link of graph.links) {
        if (!kept.has(link.source) || !kept.has(link.target)) continue;
        const from = idOf.get(link.source)!;
        const to = idOf.get(link.target)!;
        lines.push(link.type === 'doc-reference'
            ? `  ${from} -.-> ${to}`
            : `  ${from} -->|${mermaidEdgeLabel(link.type)}| ${to}`);
    }
    if (truncated) {
        lines.push(`  %% ${graph.nodes.length - nodes.length} more files omitted (mermaidNodeLimit = ${limit}); use DOT or GraphML for the full graph.`);
    }
    lines.push('');
    return lines.join('\n');
}

// ── Entry point ────────────────────────────────────────────────

const FORMAT_META: Record<GraphFormat, { extension: string; filters: Record<string, string[]>; label: string }> = {
    dot: { extension: 'dot', filters: { Graphviz: ['dot', 'gv'] }, label: 'DOT (Graphviz)' },
    graphml: { extension: 'graphml', filters: { GraphML: ['graphml', 'xml'] }, label: 'GraphML (Gephi, yEd, NetworkX)' },
    mermaid: { extension: 'md', filters: { Markdown: ['md'] }, label: 'Mermaid (README)' },
};

export const GRAPH_FORMATS: GraphFormat[] = ['dot', 'graphml', 'mermaid'];

export function buildGraphFormat(
    format: GraphFormat,
    input: GraphInput,
    options: GraphFormatOptions = DEFAULT_GRAPH_FORMAT_OPTIONS,
): GraphFormatResult {
    const meta = FORMAT_META[format];
    if (!meta) throw new Error(`Unknown graph format: ${format}`);
    const text = format === 'dot'
        ? toDot(input, options)
        : format === 'graphml'
            ? toGraphMl(input, options)
            : toMermaid(input, options);
    return { text, extension: meta.extension, filters: meta.filters, label: meta.label };
}

// ── View payload ───────────────────────────────────────────────

export interface FormatExportPayload {
    format?: GraphFormat;
    nodes?: GraphNodeLike[];
    links?: GraphLinkLike[];
}

function validNodes(value: unknown): GraphNodeLike[] | undefined {
    if (!Array.isArray(value)) return undefined;
    return value.filter((node): node is GraphNodeLike =>
        !!node && typeof node === 'object' && typeof (node as GraphNodeLike).id === 'string');
}

/**
 * Normalise what the view sent with `exportGraphFormat`.
 *
 * A command argument is not a trusted object: it can be the palette (nothing),
 * a menu contribution (a `Uri`) or a webview message (whatever the page built).
 * Only a real payload with a known `format` skips the format picker — that was
 * the bug behind "I pick DOT and VS Code asks me to pick DOT again".
 */
export function readFormatPayload(raw: unknown): FormatExportPayload {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const candidate = raw as { format?: unknown; nodes?: unknown; links?: unknown };
    const nodes = validNodes(candidate.nodes);
    const links = Array.isArray(candidate.links) ? [...candidate.links] : undefined;
    return {
        format: GRAPH_FORMATS.find(format => format === candidate.format),
        ...(nodes ? { nodes } : {}),
        ...(links ? { links } : {}),
    };
}
