/**
 * arch-report.ts — Pure architecture report generator (Markdown + Mermaid).
 *
 * Consumed by `auraVisualizer.exportArchReport`; deliberately free of
 * `vscode` so the output can be golden-tested.
 */

import type { GraphData, GraphNode } from '../analyzer/types';

export interface ArchReportModule {
    id: number;
    name: string;
    files: string[];
    size: number;
}

export interface ArchReportHotspot {
    file: string;
    lines?: number;
    complexity?: number;
    fanIn?: number;
    fanOut?: number;
    impact?: number;
    score?: number;
    reasons?: string[];
}

export interface ArchReportDeadSymbol {
    file: string;
    symbol: string;
    kind: string;
}

export interface ArchReportInput {
    projectName: string;
    analyzedAt: string;
    nodes: Pick<GraphNode, 'id' | 'name' | 'language' | 'linesOfCode' | 'complexity' | 'fanIn' | 'fanOut' | 'group'>[];
    links: { source: string; target: string; type?: string }[];
    modules: ArchReportModule[];
    cycles: string[][];
    deadCode: ArchReportDeadSymbol[];
    hotspots: ArchReportHotspot[];
}

export interface ArchReportExtras {
    modules?: ArchReportModule[];
    cycles?: string[][];
    deadCode?: ArchReportDeadSymbol[];
    hotspots?: ArchReportHotspot[];
}

export interface ArchReportOptions {
    /** Hard cap on the number of Markdown lines (default 400). */
    maxLines?: number;
    /** Include example file paths in the module table (default true). */
    includePaths?: boolean;
    /** Maximum number of modules in the Mermaid graph/table (default 12). */
    maxModules?: number;
    /** Maximum number of inter-module Mermaid edges (default 30). */
    maxModuleEdges?: number;
}

function fallbackModules(nodes: ArchReportInput['nodes']): ArchReportModule[] {
    const groups = new Map<string, string[]>();
    for (const node of nodes) {
        const group = node.group || node.id.replace(/\/[^/]*$/, '') || 'root';
        const files = groups.get(group) || [];
        files.push(node.id);
        groups.set(group, files);
    }
    return Array.from(groups.entries())
        .map(([name, files], id) => ({ id, name, files, size: files.length }))
        .sort((a, b) => b.size - a.size);
}

/** Build the pure report input from graph data plus optional DB enrichments. */
export function buildArchReportInput(graph: GraphData, extras: ArchReportExtras = {}): ArchReportInput {
    const modules = extras.modules && extras.modules.length > 0
        ? extras.modules
        : fallbackModules(graph.nodes);
    const hotspots = extras.hotspots && extras.hotspots.length > 0
        ? extras.hotspots
        : graph.nodes
            .map(n => ({
                file: n.id,
                lines: n.linesOfCode,
                complexity: n.complexity,
                fanIn: n.fanIn,
                fanOut: n.fanOut,
                impact: n.complexity * (n.fanIn + 1),
            }))
            .sort((a, b) => (b.impact || 0) - (a.impact || 0));
    return {
        projectName: graph.meta.projectName || 'unknown',
        analyzedAt: graph.meta.analyzedAt || 'unknown',
        nodes: graph.nodes.map(n => ({
            id: n.id,
            name: n.name,
            language: n.language,
            linesOfCode: n.linesOfCode,
            complexity: n.complexity,
            fanIn: n.fanIn,
            fanOut: n.fanOut,
            group: n.group,
        })),
        links: graph.links.map(l => ({ source: l.source, target: l.target, type: l.type })),
        modules,
        cycles: extras.cycles || graph.meta.cycles || [],
        deadCode: extras.deadCode || [],
        hotspots,
    };
}

function escapeLabel(value: string): string {
    return value.replace(/\\/g, '/').replace(/"/g, "'").replace(/`/g, '').replace(/\s+/g, ' ').trim();
}

function cell(value: string): string {
    return escapeLabel(value).replace(/\|/g, '\\|');
}

function capLines(lines: string[], maxLines: number): string[] {
    if (lines.length <= maxLines) return lines;
    if (maxLines <= 1) return [`_Report truncated to ${maxLines} line._`];
    return [...lines.slice(0, maxLines - 1), `_Report truncated to ${maxLines} lines._`];
}

/** Generate a deterministic Markdown architecture report. */
export function generateArchReport(input: ArchReportInput, options: ArchReportOptions = {}): string {
    const maxLines = options.maxLines ?? 400;
    const includePaths = options.includePaths !== false;
    const maxModules = options.maxModules ?? 12;
    const maxModuleEdges = options.maxModuleEdges ?? 30;

    const modules = [...input.modules].sort((a, b) => b.size - a.size).slice(0, maxModules);
    const moduleOf = new Map<string, number>();
    modules.forEach((mod, index) => {
        for (const file of mod.files) moduleOf.set(file, index);
    });

    const edgeCounts = new Map<string, { from: number; to: number; count: number }>();
    for (const link of input.links) {
        const from = moduleOf.get(link.source);
        const to = moduleOf.get(link.target);
        if (from === undefined || to === undefined || from === to) continue;
        const key = `${from}->${to}`;
        const existing = edgeCounts.get(key);
        if (existing) existing.count++;
        else edgeCounts.set(key, { from, to, count: 1 });
    }
    const moduleEdges = Array.from(edgeCounts.values())
        .sort((a, b) => b.count - a.count || a.from - b.from || a.to - b.to)
        .slice(0, maxModuleEdges);

    const languages = new Map<string, number>();
    for (const node of input.nodes) languages.set(node.language || 'unknown', (languages.get(node.language || 'unknown') || 0) + 1);
    const languageSummary = Array.from(languages.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([language, count]) => `${language} (${count})`)
        .join(', ');

    const lines: string[] = [];
    lines.push(`# Architecture — ${escapeLabel(input.projectName)}`);
    lines.push('');
    lines.push(`_Generated from the Aura graph analyzed at ${escapeLabel(input.analyzedAt)}._`);
    lines.push('');
    lines.push('## Overview');
    lines.push('');
    lines.push(`- **Files:** ${input.nodes.length}`);
    lines.push(`- **Links:** ${input.links.length}`);
    lines.push(`- **Languages:** ${languageSummary || '—'}`);
    lines.push(`- **Modules:** ${input.modules.length}`);
    lines.push(`- **Cycles:** ${input.cycles.length}`);
    lines.push(`- **Dead exports:** ${input.deadCode.length}`);
    lines.push('');

    lines.push('## Modules');
    lines.push('');
    if (modules.length === 0) {
        lines.push('_No modules detected._');
    } else {
        lines.push('```mermaid');
        lines.push('graph TD');
        for (let i = 0; i < modules.length; i++) {
            const mod = modules[i];
            lines.push(`  M${i}["${escapeLabel(mod.name)} (${mod.size})"]`);
        }
        for (const edge of moduleEdges) {
            lines.push(`  M${edge.from} -->|${edge.count}| M${edge.to}`);
        }
        lines.push('```');
        if (input.modules.length > modules.length) {
            lines.push('');
            lines.push(`_${input.modules.length - modules.length} smaller module(s) omitted._`);
        }
        lines.push('');
        lines.push('| Module | Files | Example files |');
        lines.push('|---|---:|---|');
        for (const mod of modules) {
            const examples = mod.files.slice(0, 4).map(f => `\`${cell(f)}\``).join(', ');
            lines.push(`| ${cell(mod.name)} | ${mod.size} | ${examples || '—'} |`);
        }
    }
    lines.push('');

    lines.push('## Top dependencies');
    lines.push('');
    const topDeps = [...input.nodes]
        .sort((a, b) => b.fanIn - a.fanIn || b.fanOut - a.fanOut || a.id.localeCompare(b.id))
        .slice(0, 10);
    if (topDeps.length === 0) {
        lines.push('_No dependency data._');
    } else {
        lines.push('| File | Fan-in | Fan-out | LOC | Complexity |');
        lines.push('|---|---:|---:|---:|---:|');
        for (const node of topDeps) {
            lines.push(`| \`${cell(node.id)}\` | ${node.fanIn} | ${node.fanOut} | ${node.linesOfCode} | ${node.complexity} |`);
        }
    }
    lines.push('');

    lines.push('## Hotspots');
    lines.push('');
    const hotspots = [...input.hotspots]
        .sort((a, b) => (b.score ?? b.impact ?? 0) - (a.score ?? a.impact ?? 0) || a.file.localeCompare(b.file))
        .slice(0, 10);
    if (hotspots.length === 0) {
        lines.push('_No hotspot data._');
    } else {
        lines.push('| File | Impact | Complexity | Fan-in | Fan-out |');
        lines.push('|---|---:|---:|---:|---:|');
        for (const h of hotspots) {
            const impact = h.score ?? h.impact ?? 0;
            lines.push(`| \`${cell(h.file)}\` | ${Math.round(impact)} | ${h.complexity ?? '—'} | ${h.fanIn ?? '—'} | ${h.fanOut ?? '—'} |`);
        }
    }
    lines.push('');

    lines.push('## Cycles');
    lines.push('');
    if (input.cycles.length === 0) {
        lines.push('_No circular dependencies._');
    } else {
        const seen = new Set<string>();
        for (const cycle of input.cycles) {
            const key = cycle.join(' -> ');
            if (seen.has(key)) continue;
            seen.add(key);
            lines.push(`- ${cycle.map(f => `\`${cell(f)}\``).join(' → ')}`);
        }
    }
    lines.push('');

    lines.push('## Dead exports');
    lines.push('');
    if (input.deadCode.length === 0) {
        lines.push('_No dead exports._');
    } else {
        const byFile = new Map<string, string[]>();
        for (const dead of input.deadCode) {
            const symbols = byFile.get(dead.file) || [];
            symbols.push(`${dead.symbol} (${dead.kind})`);
            byFile.set(dead.file, symbols);
        }
        for (const [file, symbols] of Array.from(byFile.entries()).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).slice(0, 15)) {
            lines.push(`- \`${cell(file)}\` — ${symbols.slice(0, 8).join(', ')}`);
        }
    }

    const capped = capLines(lines, maxLines);
    if (!includePaths) {
        // Keep the option observable without changing the default output.
        return capped.map(line => line.replace(/`([^`]+\/[^`]+)`/g, '`…`')).join('\n') + '\n';
    }
    return capped.join('\n') + '\n';
}
