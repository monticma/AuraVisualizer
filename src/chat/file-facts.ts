/**
 * file-facts.ts — Deterministic file summary used by @aura /explain.
 *
 * The model can fail to produce a final answer after several tool calls; these
 * facts are streamed first, so /explain always explains the requested file.
 */

import type { GraphDB } from '../graph-db';
import { resolveFileArg } from '../ai/tools';

export interface FileFacts {
    /** Resolved workspace-relative file id. */
    file: string;
    markdown: string;
}

/** Build a compact, factual markdown summary for a file, or undefined if unknown. */
export function buildFileFacts(db: GraphDB, fileArg: string): FileFacts | undefined {
    const resolved = resolveFileArg(db, fileArg);
    if (!resolved) return undefined;
    const detail = db.getNodeDetail(resolved);
    if (!detail) return undefined;

    const lines: string[] = [];
    lines.push(`**\`${detail.id}\`**`);
    lines.push('');
    lines.push(`- ${detail.language || 'unknown'} · ${detail.lines || 0} lines · complexity ${detail.complexity || 0}`);
    lines.push(`- fan-in ${detail.fan_in || 0} · fan-out ${detail.fan_out || 0}`);
    const measured = detail.symbols.filter(s => (s.kind === 'function' || s.kind === 'method') && typeof s.cognitive === 'number');
    if (measured.length > 0) {
        const worst = measured.reduce((a, b) => (b.cognitive! > a.cognitive! ? b : a));
        lines.push(`- highest cognitive complexity: \`${worst.name}\` (${worst.cognitive}${typeof worst.maintainability === 'number' ? `, MI ${worst.maintainability}` : ''})`);
    }

    if (detail.dependencies.length > 0) {
        lines.push('', `**Depends on (${detail.dependencies.length})**`);
        for (const dep of detail.dependencies.slice(0, 6)) lines.push(`- \`${dep}\``);
        if (detail.dependencies.length > 6) lines.push(`- … +${detail.dependencies.length - 6} more`);
    }

    if (detail.dependents.length > 0) {
        lines.push('', `**Used by (${detail.dependents.length})**`);
        for (const dep of detail.dependents.slice(0, 6)) lines.push(`- \`${dep}\``);
        if (detail.dependents.length > 6) lines.push(`- … +${detail.dependents.length - 6} more`);
    }

    if (detail.symbols.length > 0) {
        lines.push('', `**Symbols (${detail.symbols.length})**`);
        for (const sym of detail.symbols.slice(0, 8)) {
            lines.push(`- \`${sym.name}\` (${sym.kind}${sym.line ? `, line ${sym.line}` : ''})`);
        }
        if (detail.symbols.length > 8) lines.push(`- … +${detail.symbols.length - 8} more`);
    }

    return { file: detail.id, markdown: lines.join('\n') };
}
