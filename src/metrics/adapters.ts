/**
 * Adapters — one per file format the import command accepts.
 *
 * They are pure (string in, `ParsedMetrics` out): no file system, no git, no
 * VS Code. Paths come out exactly as the file wrote them; matching them to node
 * ids is `metrics-core`'s job, so the same adapter can be tested against the
 * fixtures of every tool.
 *
 * | Adapter    | Input                        | Columns                    |
 * |------------|------------------------------|----------------------------|
 * | `lcov`     | `lcov.info`                  | `coverage` (+ functions)   |
 * | `istanbul` | `coverage-summary.json` / `coverage-final.json` | `coverage` |
 * | `eslint`   | `eslint.json` (`-f json`)    | `eslintErrors`, `eslintWarnings` |
 * | `csv`      | `path,coverage,...` or `path,metric,value` | as named      |
 * | `json`     | `{ "path": { "metric": n } }` or an array of rows | as named |
 */
import { inferMetricUnit, type MetricUnit, type ParsedMetrics } from './metrics-core';

export interface MetricAdapter {
    /** Stable id, stored on every column this adapter produces. */
    id: string;
    /** Human name for the file dialog / report. */
    label: string;
    /** Extensions this adapter can read, for the open dialog. */
    extensions: string[];
    parse(content: string): ParsedMetrics;
}

/** Percent with at most two decimals — 72.111…% is noise, not precision. */
function roundPercent(value: number): number {
    return Math.round(value * 100) / 100;
}

// ============================================================
// lcov
// ============================================================

/**
 * lcov / geninfo records:
 *
 * ```
 * SF:src/a.ts
 * FN:12,parseThing
 * FNDA:3,parseThing
 * DA:12,3
 * LF:40
 * LH:31
 * end_of_record
 * ```
 *
 * File coverage prefers the explicit `LF`/`LH` pair; when a producer omits it,
 * the `DA` hits are counted instead. `FN`/`FNDA` are kept as function-level
 * values (`100` hit, `0` not) — Aura surfaces file columns today, but throwing
 * the data away would make the next lot impossible without re-parsing.
 */
export function parseLcov(content: string): ParsedMetrics {
    const rows: ParsedMetrics['rows'] = {};
    const functions: Record<string, Record<string, number>> = {};
    const functionHits = new Map<string, Map<string, number>>();

    let path = '';
    let found = 0;
    let hit = 0;
    let daTotal = 0;
    let daHit = 0;
    let fnFound = 0;
    let fnHit = 0;

    const flush = () => {
        if (!path) return;
        let percent: number | undefined;
        if (found > 0) percent = (hit / found) * 100;
        else if (daTotal > 0) percent = (daHit / daTotal) * 100;
        else if (fnFound > 0) percent = (fnHit / fnFound) * 100;
        if (percent !== undefined) {
            rows[path] = { coverage: roundPercent(Math.max(0, Math.min(100, percent))) };
        }
        path = '';
        found = 0;
        hit = 0;
        daTotal = 0;
        daHit = 0;
        fnFound = 0;
        fnHit = 0;
    };

    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;
        if (line === 'end_of_record') {
            flush();
            continue;
        }
        const colon = line.indexOf(':');
        if (colon === -1) continue;
        const tag = line.slice(0, colon);
        const rest = line.slice(colon + 1);

        switch (tag) {
            case 'SF':
                flush();
                path = rest.trim();
                functionHits.set(path, new Map());
                break;
            case 'LF':
                found = Number(rest) || 0;
                break;
            case 'LH':
                hit = Number(rest) || 0;
                break;
            case 'FNF':
                fnFound = Number(rest) || 0;
                break;
            case 'FNH':
                fnHit = Number(rest) || 0;
                break;
            case 'DA': {
                const comma = rest.indexOf(',');
                if (comma === -1) break;
                const count = Number(rest.slice(comma + 1).split(',')[0]);
                daTotal++;
                if (Number.isFinite(count) && count > 0) daHit++;
                break;
            }
            case 'FNDA': {
                const comma = rest.indexOf(',');
                if (comma === -1) break;
                const count = Number(rest.slice(0, comma));
                const name = rest.slice(comma + 1).trim();
                if (!name) break;
                const target = functionHits.get(path) || new Map<string, number>();
                target.set(name, Number.isFinite(count) && count > 0 ? 100 : 0);
                functionHits.set(path, target);
                break;
            }
            default:
                break;
        }
    }
    flush();

    for (const [file, map] of functionHits) {
        if (map.size === 0) continue;
        functions[file] = Object.fromEntries(map);
    }

    return {
        source: 'lcov',
        columns: [{ key: 'coverage', unit: 'percent' as MetricUnit, label: 'Coverage' }],
        rows,
        ...(Object.keys(functions).length > 0 ? { functions } : {}),
    };
}

// ============================================================
// istanbul
// ============================================================

interface IstanbulSummaryEntry {
    lines?: { pct?: number };
    statements?: { pct?: number };
}

interface IstanbulFinalEntry {
    path?: string;
    s?: Record<string, number>;
    statementMap?: Record<string, unknown>;
}

/**
 * Two files wear the "istanbul" name:
 *  - `coverage-summary.json` — `{ "/abs/a.ts": { lines: { pct: 82.5 }, … }, total: … }`
 *  - `coverage-final.json`   — `{ "/abs/a.ts": { statementMap, s, … } }` (no pct)
 * Both are accepted; the second one counts hit statements.
 */
export function parseIstanbul(content: string): ParsedMetrics {
    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch {
        return { source: 'istanbul', columns: [{ key: 'coverage', unit: 'percent', label: 'Coverage' }], rows: {} };
    }
    const rows: ParsedMetrics['rows'] = {};
    const record = (path: string, percent: number) => {
        if (!path) return;
        rows[path] = { coverage: roundPercent(Math.max(0, Math.min(100, percent))) };
    };

    if (Array.isArray(parsed)) {
        // `coverage-final.json` from some reporters is an array of file objects.
        for (const entry of parsed as IstanbulFinalEntry[]) {
            const path = String(entry?.path || '');
            if (!path) continue;
            const percent = istanbulPercent(entry);
            if (percent !== undefined) record(path, percent);
        }
        return { source: 'istanbul', columns: [{ key: 'coverage', unit: 'percent', label: 'Coverage' }], rows };
    }

    if (parsed && typeof parsed === 'object') {
        for (const [path, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (path === 'total') continue;
            if (!value || typeof value !== 'object') continue;
            const entry = value as IstanbulSummaryEntry & IstanbulFinalEntry;
            const percent = istanbulPercent(entry);
            if (percent !== undefined) record(path, percent);
        }
    }

    return { source: 'istanbul', columns: [{ key: 'coverage', unit: 'percent', label: 'Coverage' }], rows };
}

function istanbulPercent(entry: IstanbulSummaryEntry & IstanbulFinalEntry): number | undefined {
    const pct = entry.lines?.pct;
    if (typeof pct === 'number' && Number.isFinite(pct)) return pct;
    const spct = entry.statements?.pct;
    if (typeof spct === 'number' && Number.isFinite(spct)) return spct;
    if (entry.s && typeof entry.s === 'object') {
        const values = Object.values(entry.s).filter(value => typeof value === 'number') as number[];
        if (values.length > 0) {
            const covered = values.filter(value => value > 0).length;
            return (covered / values.length) * 100;
        }
    }
    return undefined;
}

// ============================================================
// ESLint
// ============================================================

interface EslintResult {
    filePath?: string;
    errorCount?: number;
    warningCount?: number;
    messages?: { severity?: number }[];
}

/**
 * `eslint -f json` output. A file listed with zero messages is a **real zero**;
 * a file absent from the report is unknown. Columns: `eslintErrors`,
 * `eslintWarnings`.
 */
export function parseEslint(content: string): ParsedMetrics {
    const columns = [
        { key: 'eslintErrors', unit: 'count' as MetricUnit, label: 'ESLint errors' },
        { key: 'eslintWarnings', unit: 'count' as MetricUnit, label: 'ESLint warnings' },
    ];
    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch {
        return { source: 'eslint', columns, rows: {} };
    }
    if (!Array.isArray(parsed)) return { source: 'eslint', columns, rows: {} };

    const rows: ParsedMetrics['rows'] = {};
    for (const entry of parsed as EslintResult[]) {
        const path = String(entry?.filePath || '');
        if (!path) continue;
        let errors = typeof entry.errorCount === 'number' ? entry.errorCount : undefined;
        let warnings = typeof entry.warningCount === 'number' ? entry.warningCount : undefined;
        if ((errors === undefined || warnings === undefined) && Array.isArray(entry.messages)) {
            let e = 0;
            let w = 0;
            for (const message of entry.messages) {
                if (message?.severity === 2) e++;
                else if (message?.severity === 1) w++;
            }
            errors = errors ?? e;
            warnings = warnings ?? w;
        }
        rows[path] = { eslintErrors: errors ?? 0, eslintWarnings: warnings ?? 0 };
    }
    return { source: 'eslint', columns, rows };
}

// ============================================================
// Generic CSV / JSON
// ============================================================

/** RFC4180-ish: commas, double quotes, doubled quotes inside a field. */
export function parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (quoted) {
            if (char === '"') {
                if (line[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    quoted = false;
                }
            } else {
                field += char;
            }
            continue;
        }
        if (char === '"') {
            quoted = true;
            continue;
        }
        if (char === ',' || char === ';' || char === '\t') {
            out.push(field);
            field = '';
            continue;
        }
        field += char;
    }
    out.push(field);
    return out;
}

const PATH_HEADERS = ['path', 'file', 'filename', 'filepath', 'component'];

/**
 * Two shapes, both common in exports:
 *  - **wide**: `path,coverage,eslintErrors`
 *  - **long**: `path,metric,value` (one line per value)
 */
export function parseGenericCsv(content: string): ParsedMetrics {
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return { source: 'csv', columns: [], rows: {} };

    const header = parseCsvLine(lines[0]).map(cell => cell.trim());
    const pathIndex = header.findIndex(cell => PATH_HEADERS.includes(cell.toLowerCase()));
    if (pathIndex === -1) return { source: 'csv', columns: [], rows: {} };

    const metricIndex = header.findIndex(cell => ['metric', 'key', 'name'].includes(cell.toLowerCase()));
    const valueIndex = header.findIndex(cell => ['value', 'val', 'number'].includes(cell.toLowerCase()));
    const long = metricIndex !== -1 && valueIndex !== -1 && metricIndex !== pathIndex && valueIndex !== pathIndex;

    if (long) {
        const rows: ParsedMetrics['rows'] = {};
        const keys = new Set<string>();
        for (const line of lines.slice(1)) {
            const cells = parseCsvLine(line);
            const path = (cells[pathIndex] || '').trim();
            const key = (cells[metricIndex] || '').trim();
            const value = Number((cells[valueIndex] || '').trim());
            if (!path || !key || !Number.isFinite(value)) continue;
            keys.add(key);
            (rows[path] || (rows[path] = {}))[key] = value;
        }
        return {
            source: 'csv',
            columns: [...keys].sort().map(key => ({ key, unit: inferMetricUnit(key) })),
            rows,
        };
    }

    const keys = header
        .map((cell, index) => ({ cell, index }))
        .filter(({ cell, index }) => index !== pathIndex && cell.length > 0)
        .map(({ cell }) => cell);
    const rows: ParsedMetrics['rows'] = {};
    if (keys.length === 0) return { source: 'csv', columns: [], rows: {} };

    for (const line of lines.slice(1)) {
        const cells = parseCsvLine(line);
        const path = (cells[pathIndex] || '').trim();
        if (!path) continue;
        const values: Record<string, number> = {};
        for (const key of keys) {
            const index = header.indexOf(key);
            const raw = (cells[index] || '').trim();
            if (!raw) continue;
            const value = Number(raw);
            if (Number.isFinite(value)) values[key] = value;
        }
        if (Object.keys(values).length > 0) rows[path] = values;
    }

    return {
        source: 'csv',
        columns: keys.map(key => ({ key, unit: inferMetricUnit(key) })),
        rows,
    };
}

interface GenericRow {
    path?: unknown;
    file?: unknown;
    filename?: unknown;
    metric?: unknown;
    key?: unknown;
    value?: unknown;
    [extra: string]: unknown;
}

/**
 * JSON input, three shapes:
 *  - `{ "src/a.ts": { "coverage": 82 } }`
 *  - `[ { "path": "src/a.ts", "coverage": 82 } ]`
 *  - `[ { "path": "src/a.ts", "metric": "coverage", "value": 82 } ]`
 */
export function parseGenericJson(content: string): ParsedMetrics {
    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch {
        return { source: 'json', columns: [], rows: {} };
    }

    const rows: ParsedMetrics['rows'] = {};
    const keys = new Set<string>();
    const push = (path: string, values: Record<string, number>) => {
        if (!path) return;
        const signifiant = Object.keys(values);
        if (signifiant.length === 0) return;
        for (const key of signifiant) keys.add(key);
        rows[path] = { ...(rows[path] || {}), ...values };
    };

    if (Array.isArray(parsed)) {
        for (const raw of parsed as GenericRow[]) {
            if (!raw || typeof raw !== 'object') continue;
            const path = String(raw.path ?? raw.file ?? raw.filename ?? '');
            const metric = typeof raw.metric === 'string' ? raw.metric : typeof raw.key === 'string' ? raw.key : '';
            if (metric && raw.value !== undefined) {
                const value = Number(raw.value);
                if (Number.isFinite(value)) push(path, { [metric]: value });
                continue;
            }
            const values: Record<string, number> = {};
            for (const [key, value] of Object.entries(raw)) {
                if (['path', 'file', 'filename', 'metric', 'key', 'value'].includes(key)) continue;
                const numeric = typeof value === 'number' ? value : Number(value);
                if (Number.isFinite(numeric)) values[key] = numeric;
            }
            push(path, values);
        }
    } else if (parsed && typeof parsed === 'object') {
        for (const [path, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
            const values: Record<string, number> = {};
            for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
                const numeric = typeof raw === 'number' ? raw : Number(raw);
                if (Number.isFinite(numeric)) values[key] = numeric;
            }
            push(path, values);
        }
    }

    return {
        source: 'json',
        columns: [...keys].sort().map(key => ({ key, unit: inferMetricUnit(key) })),
        rows,
    };
}

// ============================================================
// Detection
// ============================================================

export const METRIC_ADAPTERS: MetricAdapter[] = [
    {
        id: 'lcov',
        label: 'lcov / geninfo (lcov.info)',
        extensions: ['info', 'lcov'],
        parse: parseLcov,
    },
    {
        id: 'istanbul',
        label: 'Istanbul (coverage-summary.json, coverage-final.json)',
        extensions: ['json'],
        parse: parseIstanbul,
    },
    {
        id: 'eslint',
        label: 'ESLint JSON (eslint -f json)',
        extensions: ['json'],
        parse: parseEslint,
    },
    {
        id: 'csv',
        label: 'CSV (path,metric,value or path,<columns>)',
        extensions: ['csv', 'tsv'],
        parse: parseGenericCsv,
    },
    {
        id: 'json',
        label: 'JSON generique ({ path: { metric: n } })',
        extensions: ['json'],
        parse: parseGenericJson,
    },
];

export function adapterById(id: string): MetricAdapter | undefined {
    return METRIC_ADAPTERS.find(adapter => adapter.id === id);
}

export function extensionOf(fileName: string): string {
    const dot = fileName.lastIndexOf('.');
    return dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/**
 * Which adapter reads this file? Filename first (the useful signal), then the
 * content, so `coverage/lcov.info` and a renamed `report.json` both work.
 * Returns every plausible adapter for JSON — the caller must ask.
 */
export function detectAdapters(fileName: string, content: string): MetricAdapter[] {
    const base = fileName.toLowerCase();
    const ext = extensionOf(base);

    if (ext === 'info' || ext === 'lcov' || base.endsWith('.info') || /(^|\/)lcov[^/]*$/.test(base)) {
        if (/^\s*SF:/m.test(content)) return [adapterById('lcov')!];
        if (ext === 'lcov' || ext === 'info') return [adapterById('lcov')!];
    }
    if (base.includes('coverage-summary') || base.includes('coverage-final')) {
        return [adapterById('istanbul')!];
    }
    if (base.includes('eslint')) {
        return [adapterById('eslint')!];
    }
    if (ext === 'csv' || ext === 'tsv') {
        return [adapterById('csv')!];
    }
    if (ext === 'json') {
        if (/^\s*SF:/m.test(content)) return [adapterById('lcov')!];
        const candidates: MetricAdapter[] = [];
        if (/"total"\s*:/.test(content) && /"lines"\s*:\s*\{/.test(content)) candidates.push(adapterById('istanbul')!);
        if (/"filePath"\s*:/.test(content)) candidates.push(adapterById('eslint')!);
        if (/"statementMap"\s*:/.test(content)) candidates.push(adapterById('istanbul')!);
        candidates.push(adapterById('json')!);
        return candidates.filter((candidate, index) => candidates.indexOf(candidate) === index);
    }
    // Last resort: sniff lcov anywhere.
    if (/^\s*SF:/m.test(content)) return [adapterById('lcov')!];
    return [adapterById('json')!];
}
