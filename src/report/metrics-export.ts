/**
 * metrics-export.ts — Pure CSV / JSON metrics export.
 *
 * Stable column order, RFC 4180-style escaping, versioned JSON envelope.
 * The host enriches rows with risk/churn data before calling these helpers.
 */

export interface MetricsRow {
    file: string;
    name: string;
    language: string;
    group: string;
    lines: number;
    complexity: number;
    fanIn: number;
    fanOut: number;
    churn: number;
    authors: number;
    riskScore: number | null;
    riskBucket: string | null;
    /** Optional columns, emitted only when at least one row provides them. */
    tested?: boolean;
    cold?: boolean;
    duplication?: number;
    cognitive?: number;
}

export interface MetricsExportOptions {
    /** JSON schema version (default 1). */
    version?: number;
    /** ISO timestamp; pass it for deterministic tests/exports. */
    generatedAt?: string;
}

interface Column {
    key: string;
    label: string;
    value: (row: MetricsRow) => string | number | boolean | null;
}

const BASE_COLUMNS: Column[] = [
    { key: 'file', label: 'file', value: r => r.file },
    { key: 'name', label: 'name', value: r => r.name },
    { key: 'language', label: 'language', value: r => r.language },
    { key: 'group', label: 'group', value: r => r.group },
    { key: 'lines', label: 'lines', value: r => r.lines },
    { key: 'complexity', label: 'complexity', value: r => r.complexity },
    { key: 'fanIn', label: 'fan_in', value: r => r.fanIn },
    { key: 'fanOut', label: 'fan_out', value: r => r.fanOut },
    { key: 'churn', label: 'churn', value: r => r.churn },
    { key: 'authors', label: 'authors', value: r => r.authors },
    { key: 'riskScore', label: 'risk_score', value: r => r.riskScore === null ? null : Math.round(r.riskScore * 10) / 10 },
    { key: 'riskBucket', label: 'risk_bucket', value: r => r.riskBucket },
];

const OPTIONAL_COLUMNS: Column[] = [
    { key: 'tested', label: 'tested', value: r => r.tested === undefined ? null : r.tested },
    { key: 'cold', label: 'cold', value: r => r.cold === undefined ? null : r.cold },
    { key: 'duplication', label: 'duplication', value: r => r.duplication ?? null },
    { key: 'cognitive', label: 'cognitive', value: r => r.cognitive ?? null },
];

function columnsFor(rows: MetricsRow[]): Column[] {
    const optional = OPTIONAL_COLUMNS.filter(col => rows.some(row => {
        if (col.key === 'tested') return row.tested !== undefined;
        if (col.key === 'cold') return row.cold !== undefined;
        if (col.key === 'duplication') return row.duplication !== undefined;
        return row.cognitive !== undefined;
    }));
    return [...BASE_COLUMNS, ...optional];
}

function csvCell(value: string | number | boolean | null): string {
    const text = value === null || value === undefined ? '' : String(value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

/** Serialize rows to CSV with a stable header. */
export function metricsToCsv(rows: MetricsRow[]): string {
    const columns = columnsFor(rows);
    const lines = [columns.map(col => col.label).join(',')];
    for (const row of rows) {
        lines.push(columns.map(col => csvCell(col.value(row))).join(','));
    }
    return lines.join('\n') + '\n';
}

/** Serialize rows to a versioned JSON envelope. */
export function metricsToJson(rows: MetricsRow[], options: MetricsExportOptions = {}): string {
    const columns = columnsFor(rows);
    const payload = {
        version: options.version ?? 1,
        generatedAt: options.generatedAt ?? new Date().toISOString(),
        columns: columns.map(col => col.label),
        rows: rows.map(row => {
            const out: Record<string, string | number | boolean | null> = {};
            for (const col of columns) out[col.key] = col.value(row);
            return out;
        }),
    };
    return JSON.stringify(payload, null, 2) + '\n';
}
