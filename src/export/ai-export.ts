/**
 * ai-export.ts — Pure, deterministic AI context export.
 *
 * Two formats share the same selected sections:
 * - `markdown`: a compact briefing for pasting into a chat.
 * - `json`: a structured payload for tools/agents.
 *
 * A token budget (estimated at ~4 chars/token by default) is enforced with
 * explicit truncation metadata — never a silently cut file.
 */

import type { GraphData, GraphNode } from '../analyzer/types';
import {
    buildArchReportInput,
    type ArchReportDeadSymbol,
    type ArchReportExtras,
    type ArchReportHotspot,
    type ArchReportInput,
    type ArchReportModule,
} from '../report/arch-report';

export type AiExportFormat = 'markdown' | 'json';
export type AiExportSection = 'modules' | 'contracts' | 'hotspots' | 'cycles' | 'deadCode';

export const AI_EXPORT_SECTIONS: AiExportSection[] = [
    'modules',
    'contracts',
    'hotspots',
    'cycles',
    'deadCode',
];

export const DEFAULT_CHARS_PER_TOKEN = 4;

export interface AiExportContract {
    file: string;
    symbol: string;
    kind: string;
    line?: number;
    fanIn: number;
}

export interface AiExportInput extends ArchReportInput {
    contracts: AiExportContract[];
}

export interface AiExportOptions {
    format?: AiExportFormat;
    /** Sections to include; defaults to all. */
    sections?: AiExportSection[];
    /** Optional token budget. 0 / undefined means unlimited. */
    tokenBudget?: number;
    /** Estimation ratio (default 4 chars/token). */
    charsPerToken?: number;
    /** Timestamp for the JSON envelope; defaults to the graph analysis time. */
    generatedAt?: string;
}

/** Estimate tokens from characters — deliberately simple and deterministic. */
export function estimateAiTokens(text: string, charsPerToken = DEFAULT_CHARS_PER_TOKEN): number {
    return Math.ceil(text.length / Math.max(1, charsPerToken));
}

function escapeCell(value: string): string {
    return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function isPublicSymbol(symbol: { visibility?: string }): boolean {
    return symbol.visibility === 'public';
}

/**
 * Public surface of a file: exported/type-level declarations, public methods,
 * C-family header declarations, and top-level Python/Ruby functions.
 */
function collectContracts(graph: GraphData, includedIds: Set<string>): AiExportContract[] {
    const contracts = new Map<string, AiExportContract>();
    const add = (node: GraphNode, symbol: { name: string; type?: string; line?: number; visibility?: string }, kind: string) => {
        if (!symbol.name) return;
        const key = `${node.id}|${symbol.name}`;
        if (contracts.has(key)) return;
        contracts.set(key, {
            file: node.id,
            symbol: symbol.name,
            kind: symbol.type || kind,
            line: symbol.line,
            fanIn: node.fanIn || 0,
        });
    };

    for (const node of graph.nodes) {
        if (!includedIds.has(node.id) || !node.symbols) continue;
        const syms = node.symbols;
        const list = <T>(value: T[] | undefined): T[] => value || [];

        // Explicit type-level contracts first, then exported symbols. A symbol
        // that appears in both arrays is kept once, with the more precise kind.
        for (const symbol of list(syms.interfaces)) add(node, symbol, 'interface');
        for (const symbol of list(syms.traits)) add(node, symbol, 'trait');
        for (const symbol of list(syms.classes)) add(node, symbol, 'class');
        for (const symbol of list(syms.typeAliases)) add(node, symbol, 'type_alias');
        for (const symbol of list(syms.exports)) add(node, symbol, 'export');

        for (const symbol of list(syms.functions)) {
            if (isPublicSymbol(symbol)) add(node, symbol, 'function');
        }
        for (const symbol of list(syms.methods)) {
            if (isPublicSymbol(symbol)) add(node, symbol, 'method');
        }

        const isHeader = /\.(h|hh|hpp|hxx)$/i.test(node.extension || '');
        if (isHeader) {
            for (const symbol of list(syms.functions)) add(node, symbol, 'function');
            for (const symbol of list(syms.structs)) add(node, symbol, 'struct');
            for (const symbol of list(syms.enums)) add(node, symbol, 'enum');
            for (const symbol of list(syms.macros)) add(node, symbol, 'macro');
        }
        if (node.language === 'python' || node.language === 'ruby') {
            for (const symbol of list(syms.functions)) {
                if (!symbol.name.startsWith('_')) add(node, symbol, 'function');
            }
        }
    }

    return Array.from(contracts.values()).sort((a, b) =>
        b.fanIn - a.fanIn ||
        a.file.localeCompare(b.file) ||
        a.symbol.localeCompare(b.symbol) ||
        a.kind.localeCompare(b.kind));
}

/** Build the pure export input from the graph plus optional DB enrichments. */
export function buildAiExportInput(graph: GraphData, extras: ArchReportExtras = {}): AiExportInput {
    const report = buildArchReportInput(graph, extras);
    const includedIds = new Set(report.nodes.map(node => node.id));
    return {
        ...report,
        contracts: collectContracts(graph, includedIds),
    };
}

interface ModuleDependency {
    from: number;
    to: number;
    count: number;
}

function moduleDependencies(input: AiExportInput): ModuleDependency[] {
    const moduleOf = new Map<string, number>();
    input.modules.forEach((mod, index) => {
        for (const file of mod.files) moduleOf.set(file, index);
    });
    const counts = new Map<string, ModuleDependency>();
    for (const link of input.links) {
        const from = moduleOf.get(link.source);
        const to = moduleOf.get(link.target);
        if (from === undefined || to === undefined || from === to) continue;
        const key = `${from}->${to}`;
        const existing = counts.get(key);
        if (existing) existing.count++;
        else counts.set(key, { from, to, count: 1 });
    }
    return Array.from(counts.values()).sort((a, b) =>
        b.count - a.count || a.from - b.from || a.to - b.to);
}

function normalizedSections(options: AiExportOptions): AiExportSection[] {
    if (options.sections === undefined) return [...AI_EXPORT_SECTIONS];
    const requested = new Set(options.sections);
    return AI_EXPORT_SECTIONS.filter(section => requested.has(section));
}

function budgetChars(options: AiExportOptions): number | undefined {
    const budget = options.tokenBudget;
    if (typeof budget !== 'number' || !isFinite(budget) || budget <= 0) return undefined;
    const charsPerToken = typeof options.charsPerToken === 'number' && options.charsPerToken > 0
        ? options.charsPerToken
        : DEFAULT_CHARS_PER_TOKEN;
    return Math.max(1, Math.floor(budget * charsPerToken));
}

function sortedUniqueCycles(input: AiExportInput): string[][] {
    const seen = new Set<string>();
    const cycles: string[][] = [];
    for (const cycle of input.cycles) {
        const key = cycle.join(' -> ');
        if (seen.has(key)) continue;
        seen.add(key);
        cycles.push(cycle);
    }
    return cycles;
}

function groupedDeadCode(input: AiExportInput): Array<{ file: string; symbols: ArchReportDeadSymbol[] }> {
    const byFile = new Map<string, ArchReportDeadSymbol[]>();
    for (const dead of input.deadCode) {
        const symbols = byFile.get(dead.file) || [];
        symbols.push(dead);
        byFile.set(dead.file, symbols);
    }
    return Array.from(byFile.entries())
        .map(([file, symbols]) => ({ file, symbols }))
        .sort((a, b) => b.symbols.length - a.symbols.length || a.file.localeCompare(b.file));
}

function hotspotScore(hotspot: ArchReportHotspot): number {
    return hotspot.score ?? hotspot.impact ?? 0;
}

function hotspotReason(hotspot: ArchReportHotspot): string {
    return (hotspot.reasons || []).slice(0, 3).join('; ').replace(/\r?\n/g, ' ');
}

function truncateMarkdown(text: string, maxChars: number, tokenBudget: number): string {
    if (text.length <= maxChars) return text;
    const reserve = 160;
    let head = text.slice(0, Math.max(0, maxChars - reserve));
    let cut = head.lastIndexOf('\n');
    if (cut <= 0) cut = head.length;
    let omittedLines = text.slice(cut).split('\n').length - 1;
    let note = `\n\n_… ${omittedLines} line(s) omitted to fit ~${tokenBudget} tokens._\n`;
    while (cut + note.length > maxChars && cut > 0) {
        cut = Math.max(0, Math.min(cut - 1, maxChars - note.length - 1));
        cut = text.lastIndexOf('\n', cut);
        if (cut <= 0) cut = 0;
        omittedLines = text.slice(cut).split('\n').length - 1;
        note = `\n\n_… ${omittedLines} line(s) omitted to fit ~${tokenBudget} tokens._\n`;
    }
    const output = text.slice(0, cut) + note;
    return output.length <= maxChars ? output : output.slice(0, maxChars);
}

function markdown(input: AiExportInput, sections: Set<AiExportSection>, budget?: { chars: number; tokens: number }): string {
    const lines: string[] = [];
    const deps = moduleDependencies(input);
    const hotspots = [...input.hotspots].sort((a, b) =>
        hotspotScore(b) - hotspotScore(a) || a.file.localeCompare(b.file));
    const cycles = sortedUniqueCycles(input);
    const deadFiles = groupedDeadCode(input);
    const languageCounts = new Map<string, number>();
    for (const node of input.nodes) {
        languageCounts.set(node.language || 'unknown', (languageCounts.get(node.language || 'unknown') || 0) + 1);
    }
    const languages = Array.from(languageCounts.entries())
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([language, count]) => `${language} (${count})`)
        .join(', ');

    lines.push(`# AI context — ${input.projectName}`);
    lines.push('');
    lines.push(`_Generated from the Aura graph analyzed at ${input.analyzedAt}._`);
    lines.push('');
    lines.push('## Overview');
    lines.push('');
    lines.push(`- **Files:** ${input.nodes.length}`);
    lines.push(`- **Links:** ${input.links.length}`);
    lines.push(`- **Modules:** ${input.modules.length}`);
    lines.push(`- **Cycles:** ${cycles.length}`);
    lines.push(`- **Dead exports:** ${input.deadCode.length}`);
    lines.push(`- **Languages:** ${languages || '—'}`);
    lines.push('');

    if (sections.has('modules')) {
        lines.push('## Modules');
        lines.push('');
        const modulesByIndex = input.modules;
        const modules = [...input.modules].sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
        if (modules.length === 0) {
            lines.push('_No modules detected._');
        } else {
            lines.push('| Module | Files | Key files |');
            lines.push('|---|---:|---|');
            for (const mod of modules) {
                const keyFiles = mod.files.slice(0, 4).map(file => `\`${escapeCell(file)}\``).join(', ');
                lines.push(`| ${escapeCell(mod.name)} | ${mod.size} | ${keyFiles || '—'} |`);
            }
            lines.push('');
            lines.push('**Module dependencies**');
            lines.push('');
            if (deps.length === 0) {
                lines.push('_No inter-module dependencies._');
            } else {
                for (const dep of deps) {
                    const from = modulesByIndex[dep.from]?.name ?? `M${dep.from}`;
                    const to = modulesByIndex[dep.to]?.name ?? `M${dep.to}`;
                    lines.push(`- \`${escapeCell(from)}\` → \`${escapeCell(to)}\` (${dep.count})`);
                }
            }
        }
        lines.push('');
    }

    if (sections.has('contracts')) {
        lines.push('## Contracts (public surface)');
        lines.push('');
        const byFile = new Map<string, AiExportContract[]>();
        for (const contract of input.contracts) {
            const list = byFile.get(contract.file) || [];
            list.push(contract);
            byFile.set(contract.file, list);
        }
        const rows = Array.from(byFile.entries())
            .sort((a, b) => (b[1][0]?.fanIn ?? 0) - (a[1][0]?.fanIn ?? 0) || a[0].localeCompare(b[0]));
        if (rows.length === 0) {
            lines.push('_No public contracts detected._');
        } else {
            lines.push('| File | Fan-in | Public surface |');
            lines.push('|---|---:|---|');
            for (const [file, symbols] of rows) {
                const shown = symbols.slice(0, 10).map(s => `\`${escapeCell(s.symbol)}\` (${escapeCell(s.kind)})`).join(', ');
                const rest = symbols.length > 10 ? ` +${symbols.length - 10} more` : '';
                lines.push(`| \`${escapeCell(file)}\` | ${symbols[0]?.fanIn ?? 0} | ${shown}${rest} |`);
            }
        }
        lines.push('');
    }

    if (sections.has('hotspots')) {
        lines.push('## Hotspots');
        lines.push('');
        if (hotspots.length === 0) {
            lines.push('_No hotspot data._');
        } else {
            lines.push('| File | Score | Complexity | Fan-in | Fan-out | Why |');
            lines.push('|---|---:|---:|---:|---:|---|');
            for (const hotspot of hotspots.slice(0, 20)) {
                lines.push(`| \`${escapeCell(hotspot.file)}\` | ${Math.round(hotspotScore(hotspot))} | ${hotspot.complexity ?? '—'} | ${hotspot.fanIn ?? '—'} | ${hotspot.fanOut ?? '—'} | ${escapeCell(hotspotReason(hotspot)) || '—'} |`);
            }
        }
        lines.push('');
    }

    if (sections.has('cycles')) {
        lines.push('## Cycles');
        lines.push('');
        if (cycles.length === 0) {
            lines.push('_No circular dependencies._');
        } else {
            for (const cycle of cycles) {
                lines.push(`- ${cycle.map(file => `\`${escapeCell(file)}\``).join(' → ')}`);
            }
        }
        lines.push('');
    }

    if (sections.has('deadCode')) {
        lines.push('## Dead exports');
        lines.push('');
        if (deadFiles.length === 0) {
            lines.push('_No dead exports._');
        } else {
            for (const group of deadFiles.slice(0, 30)) {
                const symbols = group.symbols.slice(0, 10).map(s => `${s.symbol} (${s.kind})`).join(', ');
                const rest = group.symbols.length > 10 ? ` +${group.symbols.length - 10} more` : '';
                lines.push(`- \`${escapeCell(group.file)}\` — ${escapeCell(symbols)}${rest}`);
            }
        }
        lines.push('');
    }

    if (sections.size > 0) {
        lines.push('## Usage notes');
        lines.push('');
        lines.push('- High fan-in files are critical hubs; change them carefully.');
        lines.push('- Module dependencies summarize the architecture; use the MCP tools for exact paths or impact analysis.');
        lines.push('- Empty sections are explicit, not missing data.');
        lines.push('');
    }

    const text = lines.join('\n');
    return budget ? truncateMarkdown(text, budget.chars, budget.tokens) : text;
}

function json(input: AiExportInput, sections: Set<AiExportSection>, generatedAt: string, budget?: { chars: number; tokens: number }): string {
    const moduleDeps = moduleDependencies(input);
    const moduleIndexByRef = new Map(input.modules.map((mod, index) => [mod, index] as const));
    const depByModule = new Map<number, Array<{ module: string; count: number }>>();
    for (const dep of moduleDeps) {
        const target = input.modules[dep.to]?.name ?? `M${dep.to}`;
        const list = depByModule.get(dep.from) || [];
        list.push({ module: target, count: dep.count });
        depByModule.set(dep.from, list);
    }

    const payload: Record<string, unknown> = {
        version: 1,
        generatedAt,
        project: {
            name: input.projectName,
            analyzedAt: input.analyzedAt,
        },
        overview: {
            files: input.nodes.length,
            links: input.links.length,
            modules: input.modules.length,
            cycles: input.cycles.length,
            deadExports: input.deadCode.length,
            languages: (() => {
                const counts = new Map<string, number>();
                for (const node of input.nodes) counts.set(node.language || 'unknown', (counts.get(node.language || 'unknown') || 0) + 1);
                return Object.fromEntries(Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
            })(),
        },
    };

    if (sections.has('modules')) {
        payload.modules = [...input.modules]
            .sort((a, b) => b.size - a.size || a.name.localeCompare(b.name))
            .map(mod => ({
                name: mod.name,
                fileCount: mod.size,
                files: mod.files.slice(0, 10),
                filesTruncated: mod.size > 10,
                dependsOn: (depByModule.get(moduleIndexByRef.get(mod) ?? -1) || [])
                    .sort((a, b) => b.count - a.count || a.module.localeCompare(b.module)),
            }));
    }
    if (sections.has('contracts')) {
        payload.contracts = input.contracts.map(contract => ({
            file: contract.file,
            symbol: contract.symbol,
            kind: contract.kind,
            line: contract.line,
            fanIn: contract.fanIn,
        }));
    }
    if (sections.has('hotspots')) {
        payload.hotspots = [...input.hotspots]
            .sort((a, b) => hotspotScore(b) - hotspotScore(a) || a.file.localeCompare(b.file))
            .map(hotspot => ({
                file: hotspot.file,
                score: Math.round(hotspotScore(hotspot)),
                complexity: hotspot.complexity,
                fanIn: hotspot.fanIn,
                fanOut: hotspot.fanOut,
                lines: hotspot.lines,
                reasons: hotspot.reasons || [],
            }));
    }
    if (sections.has('cycles')) {
        payload.cycles = sortedUniqueCycles(input);
    }
    if (sections.has('deadCode')) {
        payload.deadCode = [...input.deadCode]
            .sort((a, b) => a.file.localeCompare(b.file) || a.symbol.localeCompare(b.symbol) || a.kind.localeCompare(b.kind));
    }

    if (!budget) return JSON.stringify(payload, null, 2) + '\n';

    const sectionKeys = (['modules', 'contracts', 'hotspots', 'cycles', 'deadCode'] as AiExportSection[])
        .filter(key => Array.isArray(payload[key]));
    const omittedItems: Partial<Record<AiExportSection, number>> = {};
    const omittedSections: AiExportSection[] = [];
    const refreshTruncation = () => {
        if (Object.keys(omittedItems).length === 0 && omittedSections.length === 0) return;
        payload.truncation = {
            tokenBudget: budget.tokens,
            omittedItems,
            omittedSections,
        };
    };

    while (JSON.stringify(payload, null, 2).length + 1 > budget.chars) {
        let largest: AiExportSection | undefined;
        for (const key of sectionKeys) {
            const arr = payload[key];
            if (!Array.isArray(arr) || arr.length <= 1) continue;
            if (!largest || arr.length > (payload[largest] as unknown[]).length) largest = key;
        }
        if (largest) {
            (payload[largest] as unknown[]).pop();
            omittedItems[largest] = (omittedItems[largest] || 0) + 1;
            refreshTruncation();
            continue;
        }
        const removable = [...sectionKeys].reverse().find(key => {
            const arr = payload[key];
            return Array.isArray(arr) && arr.length > 0;
        });
        if (removable) {
            delete payload[removable];
            omittedSections.push(removable);
            refreshTruncation();
            continue;
        }
        // Extremely small budgets: keep a valid, honest envelope rather than
        // returning malformed JSON.
        const minimal = { version: 1, generatedAt, truncated: true, tokenBudget: budget.tokens };
        const text = JSON.stringify(minimal, null, 2) + '\n';
        return text.length <= budget.chars ? text : '{"version":1,"truncated":true}';
    }
    return JSON.stringify(payload, null, 2) + '\n';
}

/** Generate a deterministic Markdown or JSON AI context export. */
export function generateAiExport(input: AiExportInput, options: AiExportOptions = {}): string {
    const sections = new Set(normalizedSections(options));
    const chars = budgetChars(options);
    const budget = chars
        ? { chars, tokens: Math.floor(chars / Math.max(1, options.charsPerToken || DEFAULT_CHARS_PER_TOKEN)) }
        : undefined;
    const generatedAt = options.generatedAt ?? input.analyzedAt ?? 'unknown';
    return options.format === 'json'
        ? json(input, sections, generatedAt, budget)
        : markdown(input, sections, budget);
}
