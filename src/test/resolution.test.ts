import { describe, it, expect } from 'vitest';
import {
    classifyUnresolved,
    createFileResolution,
    emptyScanCounters,
    isGuessed,
    recordAttempt,
    recordResolved,
    recordUnresolved,
    resolutionMarkdown,
    resolutionSummaryLine,
    sumResolution,
    SAMPLES_PER_CODE,
    type FileResolution,
} from '../analysis/resolution';

function classify(target: string, patch: Partial<Parameters<typeof classifyUnresolved>[0]> = {}) {
    return classifyUnresolved({
        target,
        type: 'import',
        aliasPrefix: false,
        unparsedIds: new Set<string>(),
        topLevelDirs: new Set(['src', 'webview']),
        sourceDir: 'src/nested',
        ...patch,
    });
}

describe('classifyUnresolved', () => {
    it('names an external dependency as a bare specifier', () => {
        expect(classify('fastify')).toBe('bare-specifier');
        expect(classify('@scope/pkg')).toBe('bare-specifier');
        expect(classify('react-dom/client')).toBe('bare-specifier');
    });

    it('treats a root-relative path into a real folder as a missing file', () => {
        // `src/foo` has no leading dot, but `src` exists in the project.
        expect(classify('src/foo')).toBe('missing-file');
    });

    it('reports a relative import that is not there as a missing file', () => {
        expect(classify('./thing')).toBe('missing-file');
        expect(classify('../thing')).toBe('missing-file');
    });

    it('reports a path that climbs out of the scanned root', () => {
        expect(classify('../../../etc/passwd')).toBe('outside-root');
        expect(classify('../../shared/x', { sourceDir: 'src' })).toBe('outside-root');
        // Two levels up from `src/nested` is still inside the root.
        expect(classify('../x')).toBe('missing-file');
    });

    it('blames the configuration when an alias is not mapped', () => {
        expect(classify('@/components/Button', { aliasPrefix: true })).toBe('no-tsconfig');
    });

    it('recognises a target that exists but failed to parse', () => {
        expect(classify('./broken', { unparsedIds: new Set(['src/nested/broken.ts']) }))
            .toBe('unparsed-file');
    });

    it('never calls a C include a bare specifier', () => {
        expect(classify('foo.h', { type: 'include' })).toBe('missing-file');
        expect(classify('sub/foo.h', { type: 'include' })).toBe('missing-file');
    });
});

describe('per-file counters', () => {
    it('counts attempts, resolutions and the method that found them', () => {
        const entry = createFileResolution();
        recordAttempt(entry, 'import');
        recordResolved(entry, 'import', 'exact');
        recordAttempt(entry, 'import');
        recordResolved(entry, 'import', 'suffix');

        expect(entry.attempts).toEqual({ import: 2 });
        expect(entry.resolved).toEqual({ import: 2 });
        expect(entry.methods).toEqual({ exact: 1, suffix: 1 });
    });

    it('keeps a bounded sample per code', () => {
        const entry = createFileResolution();
        for (let index = 0; index < SAMPLES_PER_CODE + 4; index++) {
            recordUnresolved(entry, 'bare-specifier', { from: 'src/a.ts', ref: `pkg-${index}` });
        }
        expect(entry.codes['bare-specifier']).toBe(SAMPLES_PER_CODE + 4);
        expect(entry.samples).toHaveLength(SAMPLES_PER_CODE);
        // A second code gets its own budget.
        recordUnresolved(entry, 'missing-file', { from: 'src/a.ts', ref: './gone' });
        expect(entry.samples).toHaveLength(SAMPLES_PER_CODE + 1);
    });

    it('knows which methods are guesses', () => {
        expect(isGuessed('exact')).toBe(false);
        expect(isGuessed('relative')).toBe(false);
        expect(isGuessed('alias')).toBe(false);
        expect(isGuessed('suffix')).toBe(true);
        expect(isGuessed('basename')).toBe(true);
        expect(isGuessed('ambiguous')).toBe(true);
    });
});

describe('sumResolution', () => {
    const entries: FileResolution[] = [
        {
            attempts: { import: 4, 'system-include': 30 },
            resolved: { import: 3 },
            methods: { exact: 2, suffix: 1 },
            codes: { 'bare-specifier': 1 },
            samples: [{ from: 'src/a.ts', ref: 'fastify', code: 'bare-specifier' }],
        },
        {
            attempts: { import: 2, call: 5 },
            resolved: { import: 1, call: 5 },
            methods: { relative: 1, 'call-site': 5 },
            codes: { 'missing-file': 1, 'bare-specifier': 2 },
            samples: [{ from: 'src/b.ts', ref: './gone', code: 'missing-file' }],
        },
    ];

    const report = sumResolution({
        entries,
        scan: { ...emptyScanCounters(), scanned: 2, skippedDirs: ['node_modules'], skippedDirHits: 3, unsupported: 7 },
        parsedTotal: 42,
        parsedFailed: 2,
    });

    it('adds up per type, in a stable order', () => {
        expect(report.types).toEqual([
            { type: 'import', attempts: 6, resolved: 4 },
            { type: 'system-include', attempts: 30, resolved: 0 },
            { type: 'call', attempts: 5, resolved: 5 },
        ]);
    });

    it('separates certain resolutions from guesses', () => {
        expect(report.totals).toEqual({ attempts: 41, resolved: 9, guessed: 1, unresolved: 4 });
        expect(report.methods.find(method => method.method === 'suffix')!.guessed).toBe(true);
        expect(report.methods.find(method => method.method === 'exact')!.guessed).toBe(false);
    });

    it('orders the codes and keeps their samples', () => {
        expect(report.codes.map(code => code.code)).toEqual(['bare-specifier', 'missing-file']);
        expect(report.codes[0].count).toBe(3);
        expect(report.codes[0].samples).toEqual([{ from: 'src/a.ts', ref: 'fastify' }]);
        expect(report.codes[1].label).toContain('not found');
    });

    it('carries the scan counters, the parse failures and the blind spots', () => {
        expect(report.scan.scanned).toBe(2);
        expect(report.scan.skippedDirs).toEqual(['node_modules']);
        expect(report.parsed).toEqual({ total: 42, failed: 2 });
        expect(report.blindSpots.length).toBeGreaterThan(2);
    });

    it('summarises in one line', () => {
        expect(resolutionSummaryLine(report))
            .toBe('9/41 relations resolved · 1 guessed · 4 unresolved · 2 unparsed files');
    });
});

describe('resolutionMarkdown', () => {
    const report = sumResolution({
        entries: [{
            attempts: { import: 2 },
            resolved: { import: 1 },
            methods: { exact: 1, suffix: 1 },
            codes: { 'bare-specifier': 1 },
            samples: [{ from: 'src/a.ts', ref: 'fastify', code: 'bare-specifier' }],
        }],
        scan: { ...emptyScanCounters(), scanned: 10, skippedDirs: ['out'], skippedDirHits: 1, unsupported: 3 },
        parsedTotal: 10,
        parsedFailed: 1,
    });

    const markdown = resolutionMarkdown(report);

    it('has the six rubrics', () => {
        for (const heading of ['## Read', '## Parsed', '## Resolved', '## Guessed', '## Not resolved, and why', '## What this report cannot say']) {
            expect(markdown).toContain(heading);
        }
    });

    it('states the numbers instead of hiding them', () => {
        expect(markdown).toContain('**10** files analysed');
        expect(markdown).toContain('`out`');
        expect(markdown).toContain('**3** files with an extension Aura does not analyse');
        expect(markdown).toContain('**9/10** files parsed cleanly (90 %)');
        expect(markdown).toContain('| `import` | 1 | 2 | 50 % |');
        expect(markdown).toContain('`suffix` — 1');
        expect(markdown).toContain('**bare-specifier** — 1');
        expect(markdown).toContain('`fastify` in `src/a.ts`');
    });

    it('says so when nothing is wrong', () => {
        const clean = resolutionMarkdown(sumResolution({
            entries: [{
                attempts: { import: 1 }, resolved: { import: 1 }, methods: { exact: 1 },
                codes: {}, samples: [],
            }],
            scan: { ...emptyScanCounters(), scanned: 1 },
            parsedTotal: 1,
            parsedFailed: 0,
        }));
        expect(clean).toContain('every resolved relation was matched exactly');
        expect(clean).toContain('nothing was left unresolved');
    });
});
