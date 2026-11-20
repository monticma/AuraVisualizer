/**
 * Imported metrics — external columns Aura does not compute itself.
 *
 * Three rules govern this module, and they are the whole point of the lot:
 *
 *  1. **The file survives the analysis.** The document lives in
 *     `.aura/metrics.json`, never in `.aura/graph.db`: the database is
 *     rewritten by every run, the file is not — the same reasoning that put
 *     notes in `.aura/annotations.json`.
 *  2. **Absent is unknown, never zero.** A file with no coverage entry is not
 *     "0 % covered". Surfaces must paint it grey, the query must not match it
 *     (`undefined` comparisons are already false), and the summary counts it
 *     as `missing`.
 *  3. **A number without provenance is a rumour.** Every column carries the
 *     adapter, the source file, the generation date, the import date and the
 *     git HEAD at import time — that is what lets a human (or an agent) tell
 *     "this file really is at 12 %" from "this number is three sprints old".
 *
 * Merging follows CodeCharta's `ccsh merge`: importing again replaces the
 * columns that file provides and leaves the others untouched, so coverage and
 * lint findings coexist on the same nodes.
 */

/** Where the document lives, relative to the workspace root. */
export const METRICS_FILE = '.aura/metrics.json';

/** Document schema version. A newer file is refused rather than misread. */
export const METRICS_VERSION = 1;

/** What a column's numbers mean. Only `percent` and `count` get a visual channel. */
export type MetricUnit = 'percent' | 'count' | 'rating';

/** One imported column, with everything needed to defend the number. */
export interface ImportedMetricColumn {
    /** Query name, e.g. `coverage`. Unique in the document. */
    key: string;
    /** Human label; defaults to the key. */
    label?: string;
    unit: MetricUnit;
    /** Adapter that produced the column: `lcov`, `istanbul`, `eslint`, `csv`, `json`. */
    source: string;
    /** Name of the file the numbers came from. */
    sourceFile?: string;
    /** When the numbers were produced (ISO), when the format says so. */
    generatedAt?: string;
    /** When the numbers entered Aura (ISO). */
    importedAt: string;
    /** git HEAD at import time, so a stale import is obvious. */
    head?: string;
}

/** `node id → column key → value`. A node absent here has no value at all. */
export type ImportedMetricRows = Record<string, Record<string, number>>;

export interface ImportedMetricsDocument {
    version: number;
    columns: ImportedMetricColumn[];
    rows: ImportedMetricRows;
    /**
     * Function-level values (`node id → function → percent`). lcov's `FNDA`
     * records land here: kept so nothing is lost, not surfaced yet — Aura's
     * visual channels and query columns are file-level.
     */
    functions?: Record<string, Record<string, number>>;
}

/** What an adapter produces, before paths are matched to node ids. */
export interface ParsedMetrics {
    source: string;
    columns: { key: string; unit: MetricUnit; label?: string }[];
    /** Raw paths exactly as the file wrote them. */
    rows: ImportedMetricRows;
    generatedAt?: string;
    functions?: Record<string, Record<string, number>>;
}

/** One column as the UI / MCP sees it: value plus where it came from. */
export interface MetricValue {
    value: number;
    unit: MetricUnit;
    source: string;
    generatedAt?: string;
    importedAt: string;
    /** The file changed after the numbers were generated. */
    stale: boolean;
}

export interface ImportedMetricSummary {
    key: string;
    label?: string;
    unit: MetricUnit;
    source: string;
    generatedAt?: string;
    importedAt: string;
    head?: string;
    /** Nodes carrying a value for this column. */
    covered: number;
    /** Nodes in the graph with no value for this column (unknown, not zero). */
    missing: number;
    /** Nodes whose value predates their last modification. */
    stale: number;
    min?: number;
    max?: number;
}

export interface ImportedMetricsSummary {
    columns: ImportedMetricSummary[];
    /** Nodes carrying at least one imported value. */
    nodesWithValues: number;
    nodesTotal: number;
}

/** Result of matching one import against the graph. */
export interface ImportReport {
    source: string;
    columns: string[];
    /** Distinct paths found in the input. */
    inputPaths: number;
    /** Paths that resolved to a node. */
    mappedPaths: number;
    /** Matched on the exact node id. */
    exact: number;
    /** Matched after a suffix or basename guess. */
    remapped: number;
    /** Mapped paths that had to be normalised first (absolute, backslashes…). */
    normalized: number;
    /** Paths that live outside what the analyser scans. */
    outOfScope: number;
    /** Paths nobody could match; capped sample plus the real total. */
    unknownPaths: string[];
    unknownTotal: number;
    /** Columns this import overwrote. */
    replaced: string[];
    /** Nodes that received at least one value. */
    nodes: number;
    /** Nodes in the analysed graph — the denominator of "how much is unknown". */
    nodesInGraph: number;
}

export interface MergeOptions {
    /** Workspace root, stripped from absolute paths. */
    root?: string;
    /** Node ids of the analysed graph. Without them, nothing is matched. */
    knownIds?: Iterable<string>;
    /** Import timestamp (ISO). Defaults to now. */
    now?: string;
    /** git HEAD at import time. */
    head?: string;
    /** File the numbers came from. */
    sourceFile?: string;
}

/** Suffixes we never try to match: the analyser does not put them in the graph. */
const OUT_OF_SCOPE_SEGMENTS = [
    'node_modules/',
    'bower_components/',
    '.git/',
    '.svn/',
    'coverage/',
    '__pycache__/',
    '.venv/',
    'venv/',
    'dist/',
    'out/',
    'build/',
    'target/',
    '.next/',
    '.nuxt/',
    'vendor/bundle/',
];

/** How many unmapped paths the report keeps as examples. */
const UNKNOWN_SAMPLE_LIMIT = 20;

/** ISO → milliseconds. Accepts epoch numbers, epoch seconds and date strings. */
export function toMillis(value: string | number | Date | null | undefined): number | undefined {
    if (value === null || value === undefined) return undefined;
    if (value instanceof Date) {
        const time = value.getTime();
        return Number.isFinite(time) ? time : undefined;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return undefined;
        return value < 1e11 ? value * 1000 : value;
    }
    const direct = Date.parse(value);
    if (Number.isFinite(direct)) return direct;
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? toMillis(asNumber) : undefined;
}

/**
 * A value is stale when it was generated before the file was last modified.
 * Same rule as `isNoteStale` for annotations: we never pretend an old number
 * describes the current file.
 */
export function isMetricStale(
    generatedAt: string | number | Date | null | undefined,
    lastModified: string | number | Date | null | undefined,
): boolean {
    const generated = toMillis(generatedAt);
    const modified = toMillis(lastModified);
    if (generated === undefined || modified === undefined) return false;
    return generated < modified;
}

/**
 * Path → node id shape. Strips quotes, backslashes, Sonar component keys
 * (`project:src/a.ts`), the workspace prefix and any leading separator.
 */
export function normalizeMetricPath(raw: string, root?: string): string {
    let value = String(raw ?? '').trim();
    if (!value) return '';
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
    }
    value = value.replace(/\\/g, '/');

    // `project-key:src/a.ts` — a colon before the first slash, and not a drive.
    const hasDrive = /^[A-Za-z]:\//.test(value);
    if (!hasDrive) {
        const colon = value.indexOf(':');
        if (colon > 0 && value.lastIndexOf('/', colon) === -1) {
            value = value.slice(colon + 1);
        }
    }

    if (root) {
        const base = root.replace(/\\/g, '/').replace(/\/+$/, '');
        if (base && value.toLowerCase().startsWith(base.toLowerCase() + '/')) {
            value = value.slice(base.length + 1);
        }
    }

    value = value.replace(/\/{2,}/g, '/');
    while (value.startsWith('./')) value = value.slice(2);
    value = value.replace(/^\/+/, '');

    // Windows absolute path from another machine: keep the tail. The resolver's
    // suffix match gives it a chance; a mismatch stays visible in the report.
    if (hasDrive) { /* keep as-is minus drive, already absolute → tail used by suffix match */ }
    return value;
}

export function isOutOfMetricScope(path: string): boolean {
    const lower = String(path ?? '').toLowerCase();
    if (!lower) return false;
    return OUT_OF_SCOPE_SEGMENTS.some(segment => lower.includes(segment) || lower.startsWith(segment));
}

/**
 * Basename → node ids. Built once per import so 20 000 rows do not each walk
 * 20 000 nodes.
 */
export interface NodePathIndex {
    ids: Set<string>;
    byBasename: Map<string, string[]>;
}

export function buildPathIndex(ids: Iterable<string>): NodePathIndex {
    const set = new Set<string>();
    const byBasename = new Map<string, string[]>();
    for (const id of ids) {
        set.add(id);
        const base = id.slice(id.lastIndexOf('/') + 1).toLowerCase();
        const list = byBasename.get(base);
        if (list) list.push(id);
        else byBasename.set(base, [id]);
    }
    return { ids: set, byBasename };
}

export type PathMatch = 'exact' | 'suffix' | 'basename';

/**
 * Node id for an import path, or `null` when the match would be a guess.
 * Ambiguous basenames are refused on purpose: a wrong match is worse than a
 * visible "unmatched" line in the report.
 */
export function resolveNodeId(
    path: string,
    index: NodePathIndex,
): { id: string; match: PathMatch } | null {
    if (!path) return null;
    if (index.ids.has(path)) return { id: path, match: 'exact' };

    const base = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
    const candidates = index.byBasename.get(base);
    if (!candidates || candidates.length === 0) return null;

    let hit: string | undefined;
    let hits = 0;
    for (const id of candidates) {
        // The input path must *end with* the node id: lcov writes absolute
        // paths from another machine, so `work/other/project/src/deep/a.ts`
        // has to match the node `src/deep/a.ts`.
        if (path.endsWith('/' + id)) {
            hit = id;
            hits++;
            if (hits > 1) break;
        }
    }
    if (hit && hits === 1) return { id: hit, match: 'suffix' };
    if (candidates.length === 1) return { id: candidates[0], match: 'basename' };
    return null;
}

/** Empty document. */
export function emptyMetricsDocument(): ImportedMetricsDocument {
    return { version: METRICS_VERSION, columns: [], rows: {} };
}

/**
 * Read an `ImportedMetricsDocument` from raw JSON. Never throws: a corrupt or
 * future file is reported as "nothing imported" rather than breaking a view.
 */
export function parseMetricsDocument(raw: string | null | undefined): ImportedMetricsDocument | null {
    if (!raw) return null;
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const doc = parsed as Partial<ImportedMetricsDocument>;
    if (typeof doc.version === 'number' && doc.version > METRICS_VERSION) return null;

    const columns: ImportedMetricColumn[] = [];
    for (const column of Array.isArray(doc.columns) ? doc.columns : []) {
        if (!column || typeof column !== 'object') continue;
        const key = String(column.key || '').trim();
        if (!key) continue;
        const unit: MetricUnit = column.unit === 'percent' || column.unit === 'rating' ? column.unit : 'count';
        columns.push({
            key,
            ...(typeof column.label === 'string' && column.label ? { label: column.label } : {}),
            unit,
            source: String(column.source || 'unknown'),
            ...(typeof column.sourceFile === 'string' && column.sourceFile ? { sourceFile: column.sourceFile } : {}),
            ...(typeof column.generatedAt === 'string' && column.generatedAt ? { generatedAt: column.generatedAt } : {}),
            importedAt: typeof column.importedAt === 'string' && column.importedAt
                ? column.importedAt
                : new Date(0).toISOString(),
            ...(typeof column.head === 'string' && column.head ? { head: column.head } : {}),
        });
    }
    if (columns.length === 0) return null;

    const known = new Set(columns.map(column => column.key));
    const rows: ImportedMetricRows = {};
    const rawRows = doc.rows && typeof doc.rows === 'object' ? doc.rows : {};
    for (const [id, values] of Object.entries(rawRows)) {
        if (!id || !values || typeof values !== 'object') continue;
        const clean: Record<string, number> = {};
        for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
            if (!known.has(key)) continue;
            const numeric = typeof value === 'number' ? value : Number(value);
            if (!Number.isFinite(numeric)) continue;
            clean[key] = numeric;
        }
        if (Object.keys(clean).length > 0) rows[id] = clean;
    }

    const functions: Record<string, Record<string, number>> = {};
    if (doc.functions && typeof doc.functions === 'object') {
        for (const [id, values] of Object.entries(doc.functions)) {
            if (!id || !values || typeof values !== 'object') continue;
            const clean: Record<string, number> = {};
            for (const [name, value] of Object.entries(values as Record<string, unknown>)) {
                const numeric = typeof value === 'number' ? value : Number(value);
                if (name && Number.isFinite(numeric)) clean[name] = numeric;
            }
            if (Object.keys(clean).length > 0) functions[id] = clean;
        }
    }

    return {
        version: METRICS_VERSION,
        columns,
        rows,
        ...(Object.keys(functions).length > 0 ? { functions } : {}),
    };
}

export function serializeMetricsDocument(doc: ImportedMetricsDocument): string {
    const columns = [...doc.columns].sort((a, b) => a.key.localeCompare(b.key));
    const rows: ImportedMetricRows = {};
    for (const id of Object.keys(doc.rows).sort()) rows[id] = doc.rows[id];
    const functions = doc.functions
        ? Object.fromEntries(Object.keys(doc.functions).sort().map(id => [id, doc.functions![id]]))
        : undefined;
    return `${JSON.stringify({
        version: METRICS_VERSION,
        columns,
        rows,
        ...(functions ? { functions } : {}),
    }, null, 2)}\n`;
}

/**
 * Unit inferred from a column name. Generic CSV/JSON files rarely say what a
 * number means, so the name is the only evidence — and a wrong unit only costs
 * a colour ramp, never a value.
 */
export function inferMetricUnit(key: string, fallback: MetricUnit = 'count'): MetricUnit {
    const lower = key.toLowerCase();
    if (lower.includes('cov') || lower.includes('pct') || lower.includes('percent') || lower.includes('%')) {
        return 'percent';
    }
    if (lower.includes('rating') || lower.includes('grade')) return 'rating';
    return fallback;
}

/**
 * Fold one parsed import into the document.
 *
 * Replacement is per column, never per file: importing coverage again refreshes
 * `coverage` and leaves `eslintErrors` alone.
 */
export function mergeImport(
    existing: ImportedMetricsDocument | null,
    parsed: ParsedMetrics,
    options: MergeOptions = {},
): { document: ImportedMetricsDocument; report: ImportReport } {
    const now = options.now || new Date().toISOString();
    const base = existing ? parseMetricsDocument(serializeMetricsDocument(existing)) : emptyMetricsDocument();
    const doc: ImportedMetricsDocument = base || emptyMetricsDocument();
    const index = buildPathIndex(options.knownIds || []);
    const knownIdsProvided = index.ids.size > 0;

    const keys = parsed.columns.map(column => column.key).filter(Boolean);
    const replaced = keys.filter(key => doc.columns.some(column => column.key === key));

    // Drop the previous values of the columns this import refreshes, then the
    // rows left empty.
    for (const values of Object.values(doc.rows)) {
        for (const key of keys) delete values[key];
    }
    for (const id of Object.keys(doc.rows)) {
        if (Object.keys(doc.rows[id]).length === 0) delete doc.rows[id];
    }
    doc.columns = doc.columns.filter(column => !keys.includes(column.key));

    const matched: Record<string, number> = {};
    const exactPaths = new Set<string>();
    const remappedPaths = new Set<string>();
    const normalizedPaths = new Set<string>();
    const unknown = new Set<string>();
    let outOfScope = 0;
    const inputPaths = new Set<string>();

    for (const [rawPath, values] of Object.entries(parsed.rows)) {
        inputPaths.add(rawPath);
        const normalized = normalizeMetricPath(rawPath, options.root);
        const resolved = knownIdsProvided ? resolveNodeId(normalized, index) : null;
        if (!resolved) {
            // Only a path that is *not* in the graph can be out of scope: a file
            // the analyser did scan stays importable even under `out/`.
            if (isOutOfMetricScope(normalized)) outOfScope++;
            else unknown.add(rawPath);
            continue;
        }
        if (resolved.match === 'exact') exactPaths.add(rawPath);
        else remappedPaths.add(rawPath);
        if (normalized !== rawPath) normalizedPaths.add(rawPath);

        const target = doc.rows[resolved.id] || (doc.rows[resolved.id] = {});
        for (const key of keys) {
            const value = values[key];
            if (typeof value !== 'number' || !Number.isFinite(value)) continue;
            target[key] = value;
            matched[resolved.id] = (matched[resolved.id] || 0) + 1;
        }
    }

    for (const column of parsed.columns) {
        if (!column.key) continue;
        doc.columns.push({
            key: column.key,
            ...(column.label ? { label: column.label } : {}),
            unit: column.unit || inferMetricUnit(column.key),
            source: parsed.source,
            ...(options.sourceFile ? { sourceFile: options.sourceFile } : {}),
            ...(parsed.generatedAt ? { generatedAt: parsed.generatedAt } : {}),
            importedAt: now,
            ...(options.head ? { head: options.head } : {}),
        });
    }

    if (parsed.functions) {
        const functions = doc.functions || (doc.functions = {});
        for (const [rawPath, values] of Object.entries(parsed.functions)) {
            const normalized = normalizeMetricPath(rawPath, options.root);
            if (isOutOfMetricScope(normalized)) continue;
            const resolved = knownIdsProvided ? resolveNodeId(normalized, index) : null;
            if (!resolved) continue;
            functions[resolved.id] = { ...(functions[resolved.id] || {}), ...values };
        }
    }

    const unknownList = [...unknown].sort();
    const report: ImportReport = {
        source: parsed.source,
        columns: keys,
        inputPaths: inputPaths.size,
        mappedPaths: exactPaths.size + remappedPaths.size,
        exact: exactPaths.size,
        remapped: remappedPaths.size,
        normalized: normalizedPaths.size,
        outOfScope,
        unknownPaths: unknownList.slice(0, UNKNOWN_SAMPLE_LIMIT),
        unknownTotal: unknownList.length,
        replaced,
        nodes: Object.keys(matched).length,
        nodesInGraph: index.ids.size,
    };

    return { document: doc, report };
}

/** Values plus provenance for one node. Empty when the node has no value. */
export function metricsForNode(
    doc: ImportedMetricsDocument | null,
    nodeId: string,
    lastModified?: number,
): Record<string, MetricValue> {
    const out: Record<string, MetricValue> = {};
    if (!doc) return out;
    const row = doc.rows[nodeId];
    if (!row) return out;
    for (const column of doc.columns) {
        const value = row[column.key];
        if (typeof value !== 'number' || !Number.isFinite(value)) continue;
        out[column.key] = {
            value,
            unit: column.unit,
            source: column.source,
            ...(column.generatedAt ? { generatedAt: column.generatedAt } : {}),
            importedAt: column.importedAt,
            stale: isMetricStale(column.generatedAt, lastModified),
        };
    }
    return out;
}

/** Node shape this module needs — keeps it usable from the db, the webview and tests. */
export interface MetricNodeLike {
    id: string;
    lastModified?: number;
    metrics?: Record<string, number>;
}

/**
 * Attach the document to graph nodes and build the summary every surface shows.
 *
 * Clears `node.metrics` when a node has no row, so removing an import really
 * removes the column instead of leaving yesterday's numbers behind.
 */
export function applyImportedMetrics<N extends MetricNodeLike>(
    nodes: N[],
    doc: ImportedMetricsDocument | null,
): ImportedMetricsSummary {
    const summary: ImportedMetricsSummary = { columns: [], nodesWithValues: 0, nodesTotal: nodes.length };
    if (!doc || doc.columns.length === 0) {
        for (const node of nodes) delete node.metrics;
        return summary;
    }

    const stats = new Map<string, { covered: number; missing: number; stale: number; min: number; max: number }>();
    for (const column of doc.columns) {
        stats.set(column.key, { covered: 0, missing: 0, stale: 0, min: Infinity, max: -Infinity });
    }

    let nodesWithValues = 0;
    for (const node of nodes) {
        const row = doc.rows[node.id];
        if (!row) {
            delete node.metrics;
            for (const column of doc.columns) stats.get(column.key)!.missing++;
            continue;
        }
        node.metrics = { ...row };
        nodesWithValues++;
        for (const column of doc.columns) {
            const bucket = stats.get(column.key)!;
            const value = row[column.key];
            if (typeof value !== 'number' || !Number.isFinite(value)) {
                bucket.missing++;
                continue;
            }
            bucket.covered++;
            if (value < bucket.min) bucket.min = value;
            if (value > bucket.max) bucket.max = value;
            if (isMetricStale(column.generatedAt, node.lastModified)) bucket.stale++;
        }
    }

    summary.nodesWithValues = nodesWithValues;
    summary.columns = doc.columns.map(column => {
        const bucket = stats.get(column.key)!;
        const empty = bucket.covered === 0;
        return {
            key: column.key,
            ...(column.label ? { label: column.label } : {}),
            unit: column.unit,
            source: column.source,
            ...(column.generatedAt ? { generatedAt: column.generatedAt } : {}),
            importedAt: column.importedAt,
            ...(column.head ? { head: column.head } : {}),
            covered: bucket.covered,
            missing: bucket.missing,
            stale: bucket.stale,
            ...(empty ? {} : { min: bucket.min, max: bucket.max }),
        };
    });
    return summary;
}

/** `lcov · generated 2 days ago · 3 files changed since` — compact provenance. */
export function columnProvenance(column: ImportedMetricSummary, now: number = Date.now()): string {
    const parts = [column.source];
    const generated = toMillis(column.generatedAt);
    if (generated !== undefined) parts.push(`generated ${formatAge(generated, now)}`);
    else parts.push(`imported ${formatAge(toMillis(column.importedAt) ?? now, now)}`);
    if (column.stale > 0) parts.push(`${column.stale} file${column.stale > 1 ? 's' : ''} changed since`);
    if (column.missing > 0) parts.push(`${column.missing} unknown`);
    return parts.join(' · ');
}

/** "just now", "3 h ago", "2 d ago" — deterministic for a given pair of times. */
export function formatAge(then: number, now: number = Date.now()): string {
    const delta = Math.max(0, now - then);
    const minutes = Math.floor(delta / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.floor(hours / 24);
    return `${days} d ago`;
}

/** The Markdown report shown after an import — the mapping is never silent. */
export function metricsMarkdown(
    report: ImportReport,
    doc: ImportedMetricsDocument,
    now: number = Date.now(),
): string {
    const lines: string[] = [];
    lines.push('# Aura — imported metrics');
    lines.push('');
    lines.push(`**Source:** \`${report.source}\`  `);
    lines.push(`**Columns:** ${report.columns.map(key => `\`${key}\``).join(', ') || '—'}  `);
    lines.push(`**Paths:** ${report.inputPaths} read · ${report.mappedPaths} mapped `
        + `(${report.exact} exact, ${report.remapped} remapped) · ${report.outOfScope} out of scope · `
        + `${report.unknownTotal} unknown  `);
    if (report.normalized > 0) {
        lines.push(`**Normalised before matching:** ${report.normalized} paths `
            + '(absolute paths, backslashes, another workspace root or a Sonar component key)  ');
    }
    lines.push(`**Nodes:** ${report.nodes} of ${report.nodesInGraph} received a value`
        + `${report.nodesInGraph > report.nodes
            ? ` · the other ${report.nodesInGraph - report.nodes} have none (unknown, not zero)`
            : ''}`);
    if (report.replaced.length > 0) {
        lines.push(`**Replaced:** ${report.replaced.map(key => `\`${key}\``).join(', ')}`);
    }
    lines.push('');

    const columns = doc.columns.filter(column => report.columns.includes(column.key));
    if (columns.length > 0) {
        lines.push('| Column | Unit | With a value | Unknown | Provenance |');
        lines.push('|---|---|---|---|---|');
        for (const column of columns) {
            let values = 0;
            for (const row of Object.values(doc.rows)) {
                const value = row[column.key];
                if (typeof value === 'number' && Number.isFinite(value)) values++;
            }
            // Unknown is counted against the graph, not against the file: a node
            // that is simply absent from the export is unmeasured, not zero.
            const unknown = Math.max(0, report.nodesInGraph - values);
            const generated = toMillis(column.generatedAt);
            const provenance = `${column.source}${generated !== undefined ? ` · generated ${formatAge(generated, now)}` : ''}`
                + `${column.head ? ` · ${column.head.slice(0, 7)}` : ''}`;
            lines.push(`| \`${column.key}\` | ${column.unit} | ${values} | ${unknown} | ${provenance} |`);
        }
        lines.push('');
    }

    if (report.unknownTotal > 0) {
        lines.push(`## Unmatched paths (${report.unknownTotal})`);
        lines.push('');
        lines.push('These paths are in the file but not in the graph. Usually a stale');
        lines.push('coverage run, a different workspace root, or a file the analyser skips.');
        lines.push('');
        for (const path of report.unknownPaths) lines.push(`- \`${path}\``);
        if (report.unknownTotal > report.unknownPaths.length) {
            lines.push(`- … and ${report.unknownTotal - report.unknownPaths.length} more`);
        }
        lines.push('');
    }

    lines.push('## How to use it');
    lines.push('');
    lines.push('```');
    lines.push(`query: ${report.columns[0] || 'metric'} < 80 and cognitive > 40`);
    lines.push('```');
    lines.push('');
    lines.push('The column also appears in the heatmap selector (grey = no value,');
    lines.push('which is **not** zero) and in `aura_explain_file`.');
    return lines.join('\n');
}
