import { describe, it, expect } from 'vitest';
import {
    detectAdapters,
    parseCsvLine,
    parseEslint,
    parseGenericCsv,
    parseGenericJson,
    parseIstanbul,
    parseLcov,
} from '../metrics/adapters';

describe('parseLcov', () => {
    it('reads the LF/LH pair', () => {
        const result = parseLcov([
            'TN:',
            'SF:src/a.ts',
            'DA:1,1',
            'DA:2,0',
            'LF:8',
            'LH:6',
            'end_of_record',
        ].join('\n'));
        expect(result.rows['src/a.ts']).toEqual({ coverage: 75 });
        expect(result.columns[0]).toMatchObject({ key: 'coverage', unit: 'percent' });
        expect(result.source).toBe('lcov');
    });

    it('falls back to DA hits when the producer omits LF/LH', () => {
        const result = parseLcov([
            'SF:src/b.ts',
            'DA:1,3',
            'DA:2,0',
            'DA:3,0',
            'DA:4,1',
            'end_of_record',
        ].join('\n'));
        expect(result.rows['src/b.ts']).toEqual({ coverage: 50 });
    });

    it('handles several records and keeps absolute paths verbatim', () => {
        const result = parseLcov([
            'SF:/abs/one.ts', 'LF:2', 'LH:2', 'end_of_record',
            'SF:/abs/two.ts', 'LF:2', 'LH:0', 'end_of_record',
        ].join('\n'));
        expect(result.rows['/abs/one.ts']).toEqual({ coverage: 100 });
        expect(result.rows['/abs/two.ts']).toEqual({ coverage: 0 });
    });

    it('keeps FNDA as function-level values', () => {
        const result = parseLcov([
            'SF:src/c.ts',
            'FN:10,parse',
            'FN:20,dump',
            'FNDA:4,parse',
            'FNDA:0,dump',
            'LF:10',
            'LH:5',
            'end_of_record',
        ].join('\n'));
        expect(result.rows['src/c.ts']).toEqual({ coverage: 50 });
        expect(result.functions).toEqual({ 'src/c.ts': { parse: 100, dump: 0 } });
    });

    it('ignores a record with no coverage evidence instead of writing 0', () => {
        const result = parseLcov('SF:src/d.ts\nend_of_record\n');
        expect(result.rows['src/d.ts']).toBeUndefined();
    });

    it('tolerates CRLF and blank lines', () => {
        const result = parseLcov('SF:src/e.ts\r\nLF:4\r\nLH:4\r\nend_of_record\r\n');
        expect(result.rows['src/e.ts']).toEqual({ coverage: 100 });
    });

    it('returns an empty result for non-lcov input', () => {
        expect(parseLcov('hello world').rows).toEqual({});
    });
});

describe('parseIstanbul', () => {
    it('reads coverage-summary.json and skips the total row', () => {
        const json = JSON.stringify({
            total: { lines: { total: 10, covered: 5, pct: 50 } },
            '/abs/a.ts': { lines: { total: 4, covered: 3, pct: 75 } },
            '/abs/b.ts': { lines: { total: 2, covered: 0, pct: 0 } },
        });
        const result = parseIstanbul(json);
        expect(result.rows).toEqual({
            '/abs/a.ts': { coverage: 75 },
            '/abs/b.ts': { coverage: 0 },
        });
    });

    it('falls back to statements when lines are missing', () => {
        const json = JSON.stringify({ '/abs/a.ts': { statements: { pct: 33.333 } } });
        expect(parseIstanbul(json).rows['/abs/a.ts']).toEqual({ coverage: 33.33 });
    });

    it('counts hit statements in coverage-final.json', () => {
        const json = JSON.stringify({ '/abs/a.ts': { statementMap: { 0: {}, 1: {}, 2: {} }, s: { 0: 1, 1: 0, 2: 2 } } });
        expect(parseIstanbul(json).rows['/abs/a.ts']).toEqual({ coverage: 66.67 });
    });

    it('returns nothing on corrupt JSON', () => {
        expect(parseIstanbul('{nope').rows).toEqual({});
    });
});

describe('parseEslint', () => {
    it('reads errorCount / warningCount, zeros included', () => {
        const json = JSON.stringify([
            { filePath: '/abs/a.ts', errorCount: 2, warningCount: 1, messages: [] },
            { filePath: '/abs/b.ts', errorCount: 0, warningCount: 0, messages: [] },
        ]);
        const result = parseEslint(json);
        expect(result.rows).toEqual({
            '/abs/a.ts': { eslintErrors: 2, eslintWarnings: 1 },
            '/abs/b.ts': { eslintErrors: 0, eslintWarnings: 0 },
        });
        expect(result.columns.map(column => column.key)).toEqual(['eslintErrors', 'eslintWarnings']);
    });

    it('counts messages by severity when the counters are missing', () => {
        const json = JSON.stringify([
            { filePath: '/abs/a.ts', messages: [{ severity: 2 }, { severity: 2 }, { severity: 1 }] },
        ]);
        expect(parseEslint(json).rows['/abs/a.ts']).toEqual({ eslintErrors: 2, eslintWarnings: 1 });
    });

    it('returns nothing for a non-array payload', () => {
        expect(parseEslint('{"filePath":"x"}').rows).toEqual({});
    });
});

describe('parseCsvLine', () => {
    it('handles quotes, doubled quotes and separators', () => {
        expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
        expect(parseCsvLine('a,"say ""hi""",d')).toEqual(['a', 'say "hi"', 'd']);
        expect(parseCsvLine('a;b;c')).toEqual(['a', 'b', 'c']);
        expect(parseCsvLine('a\tb')).toEqual(['a', 'b']);
    });
});

describe('parseGenericCsv', () => {
    it('reads the wide shape', () => {
        const result = parseGenericCsv('path,coverage,eslintErrors\nsrc/a.ts,81.5,2\nsrc/b.ts,,0\n');
        expect(result.rows['src/a.ts']).toEqual({ coverage: 81.5, eslintErrors: 2 });
        expect(result.rows['src/b.ts']).toEqual({ eslintErrors: 0 });
        expect(result.columns).toEqual([
            { key: 'coverage', unit: 'percent' },
            { key: 'eslintErrors', unit: 'count' },
        ]);
    });

    it('reads the long shape', () => {
        const result = parseGenericCsv('file,metric,value\nsrc/a.ts,coverage,90\nsrc/a.ts,bugs,3\n');
        expect(result.rows['src/a.ts']).toEqual({ coverage: 90, bugs: 3 });
        expect(result.columns.map(column => column.key)).toEqual(['bugs', 'coverage']);
    });

    it('keeps quoted paths with commas', () => {
        const result = parseGenericCsv('path,coverage\n"src/a,b.ts",50\n');
        expect(result.rows['src/a,b.ts']).toEqual({ coverage: 50 });
    });

    it('returns nothing without a path column', () => {
        expect(parseGenericCsv('name,coverage\nx,1\n').rows).toEqual({});
    });

    it('returns nothing for a single line', () => {
        expect(parseGenericCsv('path,coverage').rows).toEqual({});
    });
});

describe('parseGenericJson', () => {
    it('reads the map shape', () => {
        const result = parseGenericJson(JSON.stringify({
            'src/a.ts': { coverage: 80, eslintErrors: 1 },
            'src/b.ts': { coverage: '55' },
        }));
        expect(result.rows).toEqual({
            'src/a.ts': { coverage: 80, eslintErrors: 1 },
            'src/b.ts': { coverage: 55 },
        });
    });

    it('reads an array of rows', () => {
        const result = parseGenericJson(JSON.stringify([
            { path: 'src/a.ts', coverage: 70 },
            { file: 'src/b.ts', sonarBugs: 4 },
        ]));
        expect(result.rows).toEqual({
            'src/a.ts': { coverage: 70 },
            'src/b.ts': { sonarBugs: 4 },
        });
    });

    it('reads the long array shape', () => {
        const result = parseGenericJson(JSON.stringify([
            { path: 'src/a.ts', metric: 'coverage', value: 60 },
        ]));
        expect(result.rows['src/a.ts']).toEqual({ coverage: 60 });
    });

    it('infers percent from the column name', () => {
        const result = parseGenericJson(JSON.stringify({ 'src/a.ts': { lineCoveragePct: 44 } }));
        expect(result.columns[0]).toMatchObject({ key: 'lineCoveragePct', unit: 'percent' });
    });

    it('returns nothing on corrupt JSON', () => {
        expect(parseGenericJson('[').rows).toEqual({});
    });
});

describe('detectAdapters', () => {
    it('recognises lcov by name and by content', () => {
        expect(detectAdapters('lcov.info', 'SF:src/a.ts\n')[0].id).toBe('lcov');
        expect(detectAdapters('whatever.txt', 'SF:src/a.ts\n')[0].id).toBe('lcov');
    });

    it('recognises istanbul and eslint by filename', () => {
        expect(detectAdapters('coverage-summary.json', '{}')[0].id).toBe('istanbul');
        expect(detectAdapters('eslint.json', '[]')[0].id).toBe('eslint');
        expect(detectAdapters('eslint-report.json', '[]')[0].id).toBe('eslint');
    });

    it('recognises csv', () => {
        expect(detectAdapters('metrics.csv', 'path,coverage\n')[0].id).toBe('csv');
    });

    it('offers several candidates for an anonymous JSON file', () => {
        const ids = detectAdapters('report.json', JSON.stringify({
            total: { lines: { pct: 10 } },
            '/abs/a.ts': { lines: { pct: 10 } },
        })).map(adapter => adapter.id);
        expect(ids[0]).toBe('istanbul');
        expect(ids).toContain('json');
    });

    it('always returns at least one adapter', () => {
        expect(detectAdapters('data.bin', 'nothing').length).toBeGreaterThan(0);
    });
});
