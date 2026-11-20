import { describe, it, expect } from 'vitest';
import {
    applyImportedMetrics,
    buildPathIndex,
    columnProvenance,
    emptyMetricsDocument,
    formatAge,
    isMetricStale,
    isOutOfMetricScope,
    mergeImport,
    metricsForNode,
    metricsMarkdown,
    normalizeMetricPath,
    parseMetricsDocument,
    resolveNodeId,
    serializeMetricsDocument,
    type ImportedMetricsDocument,
    type ParsedMetrics,
} from '../metrics/metrics-core';

const ROOT = '/home/dev/project';

const IDS = [
    'src/a.ts',
    'src/deep/a.ts',
    'src/b.ts',
    'webview/js/query.js',
    'src/index.ts',
    'lib/index.ts',
];

function parsed(rows: Record<string, Record<string, number>>, source = 'csv'): ParsedMetrics {
    return {
        source,
        columns: [{ key: 'coverage', unit: 'percent' }],
        rows,
    };
}

describe('normalizeMetricPath', () => {
    it('turns backslashes into slashes and strips quotes', () => {
        expect(normalizeMetricPath('"src\\a.ts"')).toBe('src/a.ts');
        expect(normalizeMetricPath("'src\\deep\\a.ts'")).toBe('src/deep/a.ts');
    });

    it('strips the workspace root, case-insensitively', () => {
        expect(normalizeMetricPath(`${ROOT}/src/a.ts`, ROOT)).toBe('src/a.ts');
        expect(normalizeMetricPath('/HOME/DEV/PROJECT/src/a.ts', ROOT)).toBe('src/a.ts');
    });

    it('strips ./ and a leading separator', () => {
        expect(normalizeMetricPath('./src/a.ts')).toBe('src/a.ts');
        expect(normalizeMetricPath('/src/a.ts')).toBe('src/a.ts');
        expect(normalizeMetricPath('//src///a.ts')).toBe('src/a.ts');
    });

    it('strips a Sonar component key', () => {
        expect(normalizeMetricPath('my-project:src/a.ts')).toBe('src/a.ts');
    });

    it('keeps a Windows drive path recognisable', () => {
        // The drive itself is not a component key; the tail is what the suffix
        // match will use.
        expect(normalizeMetricPath('C:\\work\\project\\src\\a.ts')).toBe('C:/work/project/src/a.ts');
    });

    it('returns an empty string for junk', () => {
        expect(normalizeMetricPath('')).toBe('');
        expect(normalizeMetricPath('   ')).toBe('');
    });
});

describe('isOutOfMetricScope', () => {
    it('flags the folders the analyser never scans', () => {
        expect(isOutOfMetricScope('node_modules/react/index.js')).toBe(true);
        expect(isOutOfMetricScope('out/extension.js')).toBe(true);
        expect(isOutOfMetricScope('packages/app/dist/bundle.js')).toBe(true);
        expect(isOutOfMetricScope('coverage/lcov-report/index.html')).toBe(true);
    });

    it('leaves real sources alone', () => {
        expect(isOutOfMetricScope('src/a.ts')).toBe(false);
        expect(isOutOfMetricScope('webview/js/app.js')).toBe(false);
        expect(isOutOfMetricScope('src/distribution/x.ts')).toBe(false);
    });
});

describe('resolveNodeId', () => {
    const index = buildPathIndex(IDS);

    it('matches an exact node id', () => {
        expect(resolveNodeId('src/a.ts', index)).toEqual({ id: 'src/a.ts', match: 'exact' });
    });

    it('matches on a path suffix when the prefix comes from another machine', () => {
        expect(resolveNodeId('work/other/project/src/deep/a.ts', index)).toEqual({
            id: 'src/deep/a.ts',
            match: 'suffix',
        });
    });

    it('matches a unique basename', () => {
        expect(resolveNodeId('query.js', index)).toEqual({ id: 'webview/js/query.js', match: 'basename' });
    });

    it('refuses an ambiguous basename instead of guessing', () => {
        expect(resolveNodeId('index.ts', index)).toBeNull();
        expect(resolveNodeId('a.ts', index)).toBeNull();
    });

    it('returns null for an unknown file', () => {
        expect(resolveNodeId('src/nope.ts', index)).toBeNull();
    });
});

describe('mergeImport', () => {
    it('maps paths, counts them, and keeps every value', () => {
        const { document, report } = mergeImport(null, parsed({
            [`${ROOT}/src/a.ts`]: { coverage: 81.25 },
            'src/deep/a.ts': { coverage: 12 },
            'src/nope.ts': { coverage: 50 },
            'node_modules/x/index.js': { coverage: 0 },
        }), { root: ROOT, knownIds: IDS, now: '2026-11-20T10:00:00Z', head: 'abc1234' });

        expect(document.rows['src/a.ts']).toEqual({ coverage: 81.25 });
        expect(document.rows['src/deep/a.ts']).toEqual({ coverage: 12 });
        expect(report).toMatchObject({
            inputPaths: 4,
            mappedPaths: 2,
            exact: 2,
            remapped: 0,
            // The absolute path had to lose its workspace prefix first.
            normalized: 1,
            outOfScope: 1,
            unknownTotal: 1,
            nodes: 2,
        });
        expect(report.unknownPaths).toEqual(['src/nope.ts']);
        expect(document.columns[0]).toMatchObject({
            key: 'coverage',
            unit: 'percent',
            source: 'csv',
            importedAt: '2026-11-20T10:00:00Z',
            head: 'abc1234',
        });
    });

    it('matches nothing (and says so) when the graph ids are missing', () => {
        const { document, report } = mergeImport(null, parsed({ 'src/a.ts': { coverage: 10 } }));
        expect(Object.keys(document.rows)).toHaveLength(0);
        expect(report.mappedPaths).toBe(0);
        expect(report.unknownTotal).toBe(1);
    });

    it('replaces the same column and leaves the others alone', () => {
        const first = mergeImport(null, {
            source: 'eslint',
            columns: [{ key: 'eslintErrors', unit: 'count' }],
            rows: { 'src/a.ts': { eslintErrors: 3 } },
        }, { knownIds: IDS }).document;

        const second = mergeImport(first, parsed({ 'src/a.ts': { coverage: 90 } }), { knownIds: IDS });

        expect(second.document.rows['src/a.ts']).toEqual({ eslintErrors: 3, coverage: 90 });
        expect(second.document.columns.map(column => column.key).sort()).toEqual(['coverage', 'eslintErrors']);
    });

    it('overwrites the same column on re-import instead of accumulating columns', () => {
        const first = mergeImport(null, parsed({ 'src/a.ts': { coverage: 90 } }), { knownIds: IDS }).document;
        const second = mergeImport(first, parsed({ 'src/b.ts': { coverage: 40 } }), { knownIds: IDS });

        expect(second.document.columns).toHaveLength(1);
        expect(second.report.replaced).toEqual(['coverage']);
        // The old value is gone: this import is the truth for `coverage`.
        expect(second.document.rows['src/a.ts']).toBeUndefined();
        expect(second.document.rows['src/b.ts']).toEqual({ coverage: 40 });
    });

    it('keeps function-level values when the adapter produced some', () => {
        const { document } = mergeImport(null, {
            source: 'lcov',
            columns: [{ key: 'coverage', unit: 'percent' }],
            rows: { 'src/a.ts': { coverage: 50 } },
            functions: { 'src/a.ts': { parse: 100, dump: 0 } },
        }, { knownIds: IDS });
        expect(document.functions).toEqual({ 'src/a.ts': { parse: 100, dump: 0 } });
    });

    it('caps the unknown sample but keeps the real total', () => {
        const rows: Record<string, Record<string, number>> = {};
        for (let i = 0; i < 40; i++) rows[`unknown/file${i}.ts`] = { coverage: i };
        const { report } = mergeImport(null, parsed(rows), { knownIds: IDS });
        expect(report.unknownPaths).toHaveLength(20);
        expect(report.unknownTotal).toBe(40);
    });

    it('does not mutate the document it was given', () => {
        const first = mergeImport(null, parsed({ 'src/a.ts': { coverage: 10 } }), { knownIds: IDS }).document;
        const snapshot = JSON.stringify(first);
        mergeImport(first, parsed({ 'src/a.ts': { coverage: 99 } }), { knownIds: IDS });
        expect(JSON.stringify(first)).toBe(snapshot);
    });
});

describe('applyImportedMetrics', () => {
    const document: ImportedMetricsDocument = {
        version: 1,
        columns: [
            { key: 'coverage', unit: 'percent', source: 'lcov', importedAt: '2026-11-20T10:00:00Z', generatedAt: '2026-11-19T10:00:00Z' },
        ],
        rows: { 'src/a.ts': { coverage: 80 }, 'src/b.ts': { coverage: 20 } },
    };

    const newNode = (id: string, lastModified: number) => ({ id, lastModified }) as {
        id: string;
        lastModified: number;
        metrics?: Record<string, number>;
    };

    it('attaches values and counts covered / missing / stale', () => {
        const nodes = [
            newNode('src/a.ts', Date.parse('2026-11-18T00:00:00Z')),
            newNode('src/b.ts', Date.parse('2026-11-20T00:00:00Z')), // modified after generation
            newNode('src/c.ts', 0),
        ];
        const summary = applyImportedMetrics(nodes, document);

        expect(nodes[0].metrics).toEqual({ coverage: 80 });
        expect(nodes[2].metrics).toBeUndefined();
        expect(summary).toMatchObject({ nodesWithValues: 2, nodesTotal: 3 });
        expect(summary.columns[0]).toMatchObject({
            key: 'coverage',
            covered: 2,
            missing: 1,
            stale: 1,
            min: 20,
            max: 80,
        });
    });

    it('removes stale values when the document disappears', () => {
        const nodes = [newNode('src/a.ts', 0)];
        applyImportedMetrics(nodes, document);
        expect(nodes[0].metrics).toEqual({ coverage: 80 });

        const summary = applyImportedMetrics(nodes, null);
        expect(nodes[0].metrics).toBeUndefined();
        expect(summary.columns).toEqual([]);
    });

    it('removes a value that the current document no longer carries', () => {
        const nodes = [newNode('src/a.ts', 0)];
        applyImportedMetrics(nodes, document);
        applyImportedMetrics(nodes, { ...document, rows: {} });
        expect(nodes[0].metrics).toBeUndefined();
    });
});

describe('isMetricStale', () => {
    it('is stale when generated before the file was modified', () => {
        expect(isMetricStale('2026-11-19T00:00:00Z', Date.parse('2026-11-20T00:00:00Z'))).toBe(true);
    });

    it('is fresh when generated after', () => {
        expect(isMetricStale('2026-11-21T00:00:00Z', Date.parse('2026-11-20T00:00:00Z'))).toBe(false);
    });

    it('cannot tell without a generation date', () => {
        expect(isMetricStale(undefined, Date.now())).toBe(false);
    });

    it('accepts epoch seconds and milliseconds', () => {
        expect(isMetricStale(1_700_000_000, 1_700_000_001_000)).toBe(true);
    });
});

describe('parse / serialize', () => {
    it('round-trips a document deterministically', () => {
        const document: ImportedMetricsDocument = {
            version: 1,
            columns: [
                { key: 'coverage', unit: 'percent', source: 'lcov', importedAt: '2026-11-20T10:00:00Z' },
                { key: 'eslintErrors', unit: 'count', source: 'eslint', importedAt: '2026-11-20T10:00:00Z' },
            ],
            rows: { 'src/b.ts': { coverage: 1 }, 'src/a.ts': { eslintErrors: 2 } },
        };
        const text = serializeMetricsDocument(document);
        expect(text.indexOf('src/a.ts')).toBeLessThan(text.indexOf('src/b.ts'));
        expect(parseMetricsDocument(text)).toEqual(document);
    });

    it('refuses a newer schema instead of misreading it', () => {
        expect(parseMetricsDocument(JSON.stringify({ version: 99, columns: [], rows: {} }))).toBeNull();
    });

    it('returns null on corrupt input', () => {
        expect(parseMetricsDocument('{oops')).toBeNull();
        expect(parseMetricsDocument('')).toBeNull();
        expect(parseMetricsDocument(null)).toBeNull();
    });

    it('drops unknown columns and non-finite values', () => {
        const text = JSON.stringify({
            version: 1,
            columns: [{ key: 'coverage', unit: 'percent', source: 'lcov', importedAt: '2026-11-20T10:00:00Z' }],
            rows: {
                'src/a.ts': { coverage: 80, ghost: 4 },
                'src/b.ts': { coverage: 'nope' },
            },
        });
        const doc = parseMetricsDocument(text);
        expect(doc!.rows).toEqual({ 'src/a.ts': { coverage: 80 } });
    });

    it('starts from a versioned empty document', () => {
        expect(emptyMetricsDocument()).toEqual({ version: 1, columns: [], rows: {} });
    });
});

describe('metricsForNode', () => {
    const document: ImportedMetricsDocument = {
        version: 1,
        columns: [
            { key: 'coverage', unit: 'percent', source: 'lcov', importedAt: '2026-11-20T10:00:00Z', generatedAt: '2026-11-19T00:00:00Z' },
        ],
        rows: { 'src/a.ts': { coverage: 42 } },
    };

    it('returns value plus provenance', () => {
        const values = metricsForNode(document, 'src/a.ts', Date.parse('2026-11-20T00:00:00Z'));
        expect(values.coverage).toMatchObject({ value: 42, unit: 'percent', source: 'lcov', stale: true });
    });

    it('returns nothing for a node with no value', () => {
        expect(metricsForNode(document, 'src/z.ts')).toEqual({});
        expect(metricsForNode(null, 'src/a.ts')).toEqual({});
    });
});

describe('provenance text', () => {
    it('formats ages deterministically', () => {
        const now = Date.parse('2026-11-20T12:00:00Z');
        expect(formatAge(now - 30_000, now)).toBe('just now');
        expect(formatAge(now - 5 * 60_000, now)).toBe('5 min ago');
        expect(formatAge(now - 3 * 3_600_000, now)).toBe('3 h ago');
        expect(formatAge(now - 4 * 86_400_000, now)).toBe('4 d ago');
    });

    it('names the source, the age and the unknowns', () => {
        const text = columnProvenance({
            key: 'coverage',
            unit: 'percent',
            source: 'lcov',
            generatedAt: '2026-11-18T12:00:00Z',
            importedAt: '2026-11-19T12:00:00Z',
            covered: 10,
            missing: 3,
            stale: 2,
        }, Date.parse('2026-11-20T12:00:00Z'));
        expect(text).toBe('lcov · generated 2 d ago · 2 files changed since · 3 unknown');
    });
});

describe('metricsMarkdown', () => {
    it('shows the mapping and lists the unmatched paths', () => {
        const { document, report } = mergeImport(null, parsed({
            'src/a.ts': { coverage: 80 },
            'src/nope.ts': { coverage: 10 },
        }), { knownIds: IDS, now: '2026-11-20T10:00:00Z' });

        const markdown = metricsMarkdown(report, document, Date.parse('2026-11-20T12:00:00Z'));
        expect(markdown).toContain('# Aura — imported metrics');
        expect(markdown).toContain('**Paths:** 2 read · 1 mapped (1 exact, 0 remapped)');
        expect(markdown).toContain('1 unknown');
        // The denominator is the graph, not the file: 6 known ids, 1 value.
        expect(markdown).toContain('**Nodes:** 1 of 6 received a value');
        expect(markdown).toContain('the other 5 have none (unknown, not zero)');
        expect(markdown).toContain('## Unmatched paths (1)');
        expect(markdown).toContain('`src/nope.ts`');
        expect(markdown).toContain('| `coverage` | percent | 1 | 5 |');
    });
});
