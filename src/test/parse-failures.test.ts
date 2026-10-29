import { describe, it, expect } from 'vitest';
import {
    MAX_PARSE_FAILURE_SAMPLES,
    buildParseFailureReport,
    clearParseFailure,
    isBenignSyntaxError,
    normalizeFailurePath,
    parseFailureReason,
    parseFailuresToMarkdown,
    recordParseFailure,
    updateParseFailureReport,
} from '../analysis/parse-failures';

describe('parse failures (V2-17)', () => {
    it('normalizes thrown values into short single-line reasons', () => {
        expect(parseFailureReason(new Error('  boom\n  at line 3 '))).toBe('boom at line 3');
        expect(parseFailureReason('bad token')).toBe('bad token');
        expect(parseFailureReason(undefined)).toBe('unknown parse error');
        expect(parseFailureReason({ message: 'typed failure' })).toBe('typed failure');
        expect(parseFailureReason('x'.repeat(500)).length).toBeLessThanOrEqual(200);
    });

    it('normalizes paths before keying the index', () => {
        expect(normalizeFailurePath('./src\\a.ts')).toBe('src/a.ts');
        expect(normalizeFailurePath('  src/a.ts ')).toBe('src/a.ts');
    });

    it('ignores known grammar gaps instead of reporting false positives', () => {
        // Valid TypeScript the bundled grammar predates.
        expect(isBenignSyntaxError('typescript', "import('web-tree-sitter').Tree")).toBe(true);
        expect(isBenignSyntaxError('tsx', "import(\"react\").ComponentType<Props>")).toBe(true);
        expect(isBenignSyntaxError('javascript', "import('x').Y")).toBe(true);
        // Valid CSS the bundled grammar predates.
        expect(isBenignSyntaxError('css', '0%,')).toBe(true);
        expect(isBenignSyntaxError('css', '0%, 100%')).toBe(true);
        expect(isBenignSyntaxError('css', '#', 'arguments')).toBe(true);
        // Real syntax errors stay reportable.
        expect(isBenignSyntaxError('typescript', '=')).toBe(false);
        expect(isBenignSyntaxError('typescript', 'import x from')).toBe(false);
        expect(isBenignSyntaxError('css', 'color')).toBe(false);
        expect(isBenignSyntaxError('css', '#', 'declaration')).toBe(false);
        expect(isBenignSyntaxError('python', "import('x').Y")).toBe(false);
        expect(isBenignSyntaxError('typescript', '')).toBe(false);
    });

    it('records, dedupes and clears failures by path', () => {
        const index = new Map<string, string>();
        recordParseFailure(index, './src/a.ts', new Error('one'));
        recordParseFailure(index, 'src\\a.ts', new Error('two'));
        expect(index.size).toBe(1);
        expect(index.get('src/a.ts')).toBe('two');

        clearParseFailure(index, 'src/a.ts');
        expect(index.size).toBe(0);

        recordParseFailure(index, '', new Error('ignored'));
        expect(index.size).toBe(0);
    });

    it('builds a deterministic, capped report', () => {
        const index = new Map<string, string>();
        for (let i = 0; i < MAX_PARSE_FAILURE_SAMPLES + 5; i++) {
            index.set('src/f' + String(i).padStart(2, '0') + '.ts', 'err');
        }
        const report = buildParseFailureReport(index)!;
        expect(report.total).toBe(MAX_PARSE_FAILURE_SAMPLES + 5);
        expect(report.samples).toHaveLength(MAX_PARSE_FAILURE_SAMPLES);
        expect(report.samples[0].path).toBe('src/f00.ts');

        const paths = report.samples.map(sample => sample.path);
        expect(paths).toEqual([...paths].sort());
    });

    it('returns undefined when every file parses cleanly', () => {
        expect(buildParseFailureReport(new Map())).toBeUndefined();
    });

    it('updates a report incrementally (add, replace, clear)', () => {
        let report = updateParseFailureReport(undefined, 'src/a.ts', 'syntax errors');
        expect(report).toEqual({ total: 1, samples: [{ path: 'src/a.ts', reason: 'syntax errors' }] });

        report = updateParseFailureReport(report, 'src/b.ts', 'bad token');
        expect(report?.total).toBe(2);

        report = updateParseFailureReport(report, 'src/a.ts', 'other error');
        expect(report?.total).toBe(2);
        expect(report?.samples.find(sample => sample.path === 'src/a.ts')?.reason).toBe('other error');

        report = updateParseFailureReport(report, 'src/a.ts', undefined);
        expect(report).toEqual({ total: 1, samples: [{ path: 'src/b.ts', reason: 'bad token' }] });

        report = updateParseFailureReport(report, 'src/b.ts', undefined);
        expect(report).toBeUndefined();
    });

    it('keeps an existing report when an unseen file parses cleanly', () => {
        const report = { total: 1, samples: [{ path: 'src/a.ts', reason: 'syntax errors' }] };
        expect(updateParseFailureReport(report, 'src/other.ts', undefined)).toBe(report);
    });

    it('renders a Markdown report with escaped cells', () => {
        const markdown = parseFailuresToMarkdown(
            { total: 2, samples: [{ path: 'a|b.ts', reason: 'bad | token' }] },
            'Proj',
            '2026-01-01T00:00:00.000Z',
        );
        expect(markdown).toContain('# Parse failures — Proj');
        expect(markdown).toContain('Generated 2026-01-01T00:00:00.000Z');
        expect(markdown).toContain('a\\|b.ts');
        expect(markdown).toContain('bad \\| token');
        expect(markdown).toContain('Showing 1 of 2 failures');
        expect(parseFailuresToMarkdown(undefined)).toBe('');
    });
});
