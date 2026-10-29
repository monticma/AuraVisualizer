/**
 * parse-failures.ts — pure helpers for the parse-failure report (V2-17).
 *
 * A parse failure never removes a node: the file stays in the graph so its
 * imports and dependents remain visible. The report is only a diagnostic:
 * an exact count plus a deterministic, capped sample (path + reason).
 */

import type { ParseFailure, ParseFailureReport } from '../analyzer/types';

/** Maximum number of detailed entries carried by the report. */
export const MAX_PARSE_FAILURE_SAMPLES = 25;

/** Reasons are shown in a tooltip/panel row: keep them short and single-line. */
const MAX_REASON_LENGTH = 200;

/** Normalize any thrown value into a short, single-line reason. */
export function parseFailureReason(err: unknown): string {
    let reason = '';
    if (err instanceof Error) {
        reason = err.message || err.name;
    } else if (typeof err === 'string') {
        reason = err;
    } else if (err && typeof err === 'object' && 'message' in err) {
        reason = String((err as { message: unknown }).message ?? '');
    }
    reason = reason.replace(/\s+/g, ' ').trim();
    if (!reason) reason = 'unknown parse error';
    if (reason.length > MAX_REASON_LENGTH) reason = reason.slice(0, MAX_REASON_LENGTH - 1) + '…';
    return reason;
}

/** Normalize a path key: workspace-relative, slash-separated. */
export function normalizeFailurePath(path: string): string {
    let value = String(path ?? '').replace(/\\/g, '/').trim();
    while (value.startsWith('./')) value = value.slice(2);
    return value;
}

/**
 * Valid syntax the bundled Tree-sitter grammars do not understand yet.
 *
 * These produce ERROR nodes in otherwise perfectly valid files, so they must
 * not surface as parse failures: reporting them would bury real breakage under
 * grammar-gap noise. The list is intentionally tiny and test-covered — extend
 * it only with a reproduction snippet.
 */
export function isBenignSyntaxError(language: string, errorText: string, parentType?: string): boolean {
    const text = String(errorText ?? '').replace(/\s+/g, ' ').trim();
    if (!text) return false;

    if (language === 'typescript' || language === 'tsx' || language === 'javascript') {
        // Import type expressions: `import('module').Type` (the bundled
        // tree-sitter-typescript grammar predates them).
        if (/^import\s*\(\s*(['"])[^'"]+\1\s*\)/.test(text)) return true;
    }

    if (language === 'css') {
        // Comma-separated keyframe selectors: `0%, 100% { … }`. The CSS
        // grammar only accepts one percentage per keyframe.
        if (/^\d+(?:\.\d+)?%(?:\s*,\s*\d+(?:\.\d+)?%)*\s*,?$/.test(text)) return true;
        // URL fragments: `url(#gradient)` — the CSS grammar expects a string
        // argument and flags the `#` inside the argument list.
        if (text === '#' && parentType === 'arguments') return true;
    }

    return false;
}

/** Record (or refresh) a failure. Empty paths are ignored. */
export function recordParseFailure(index: Map<string, string>, path: string, err: unknown): void {
    const key = normalizeFailurePath(path);
    if (!key) return;
    index.set(key, parseFailureReason(err));
}

/** Drop a file from the index (it parses cleanly again). */
export function clearParseFailure(index: Map<string, string>, path: string): void {
    const key = normalizeFailurePath(path);
    if (key) index.delete(key);
}

/**
 * Build the meta report: exact count over every failure, alphabetical sample
 * capped at {@link MAX_PARSE_FAILURE_SAMPLES}. Returns undefined when clean.
 */
export function buildParseFailureReport(index: Map<string, string>): ParseFailureReport | undefined {
    if (index.size === 0) return undefined;
    const samples: ParseFailure[] = [...index.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(0, MAX_PARSE_FAILURE_SAMPLES)
        .map(([path, reason]) => ({ path, reason }));
    return { total: index.size, samples };
}

/**
 * Best-effort update of a report for a single file (incremental edits).
 *
 * The full index is not persisted, so files outside the sample can only add a
 * new entry (their earlier state is unknown). A clean re-parse decrements the
 * count only when the file is part of the sample.
 */
export function updateParseFailureReport(
    report: ParseFailureReport | undefined,
    path: string,
    reason?: string,
): ParseFailureReport | undefined {
    const key = normalizeFailurePath(path);
    if (!key) return report;

    const samples = report ? report.samples.slice() : [];
    const index = samples.findIndex(sample => sample.path === key);
    let total = report ? report.total : 0;

    if (reason) {
        const normalized = parseFailureReason(reason);
        if (index >= 0) {
            samples[index] = { path: key, reason: normalized };
        } else {
            samples.push({ path: key, reason: normalized });
            total += 1;
            samples.sort((a, b) => a.path.localeCompare(b.path));
            if (samples.length > MAX_PARSE_FAILURE_SAMPLES) samples.length = MAX_PARSE_FAILURE_SAMPLES;
        }
    } else if (index >= 0) {
        samples.splice(index, 1);
        total = Math.max(0, total - 1);
    } else {
        return report;
    }

    if (total <= 0) return undefined;
    return { total, samples };
}

function escapeCell(value: string): string {
    return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

/** Deterministic Markdown report used by the export button. */
export function parseFailuresToMarkdown(
    report: ParseFailureReport | undefined,
    projectName?: string,
    generatedAt: string = new Date().toISOString(),
): string {
    if (!report || report.total <= 0) return '';
    const lines: string[] = [];
    lines.push('# Parse failures — ' + (projectName || 'project'));
    lines.push('');
    lines.push('Generated ' + generatedAt + ' by Aura Visualizer.');
    lines.push('');
    lines.push(
        report.total + ' file' + (report.total === 1 ? '' : 's') +
        ' could not be parsed cleanly. They are kept in the graph so their imports and ' +
        'dependents stay visible; cross-file relations may be incomplete for them.',
    );
    lines.push('');
    lines.push('| File | Reason |');
    lines.push('|------|--------|');
    for (const sample of report.samples) {
        lines.push('| `' + escapeCell(sample.path) + '` | ' + escapeCell(sample.reason) + ' |');
    }
    if (report.total > report.samples.length) {
        lines.push('');
        lines.push('_Showing ' + report.samples.length + ' of ' + report.total + ' failures (sample capped)._');
    }
    lines.push('');
    return lines.join('\n');
}
