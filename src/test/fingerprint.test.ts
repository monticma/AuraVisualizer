import { describe, it, expect } from 'vitest';
import {
    computeFingerprint,
    diffFileSignatures,
    fingerprintFromMeta,
    fingerprintMetaEntries,
    hashAnalysisConfig,
    planAnalysis,
    PARSER_VERSION,
    type FileSignature,
} from '../analyzer/fingerprint';

const files: FileSignature[] = [
    { path: 'src/a.ts', size: 10, mtimeMs: 1000 },
    { path: 'src/b.ts', size: 20, mtimeMs: 2000 },
];

describe('analysis fingerprint (V2-14)', () => {
    it('is stable across file enumeration order and config key order', () => {
        const a = computeFingerprint({
            head: 'abc', configHash: hashAnalysisConfig({ excludePaths: ['out', 'node_modules'], projectName: 'p' }), files,
        });
        const b = computeFingerprint({
            head: 'abc',
            configHash: hashAnalysisConfig({ projectName: 'p', excludePaths: ['out', 'node_modules'] }),
            files: [...files].reverse(),
        });
        expect(b.hash).toBe(a.hash);
        expect(a.parserVersion).toBe(PARSER_VERSION);
    });

    it('changes when HEAD, settings or a file signature changes', () => {
        const base = computeFingerprint({ head: 'abc', configHash: hashAnalysisConfig({ excludePaths: [] }), files });
        expect(computeFingerprint({ head: 'def', configHash: hashAnalysisConfig({ excludePaths: [] }), files }).hash).not.toBe(base.hash);
        expect(computeFingerprint({ head: 'abc', configHash: hashAnalysisConfig({ excludePaths: ['out'] }), files }).hash).not.toBe(base.hash);
        expect(computeFingerprint({ head: 'abc', configHash: hashAnalysisConfig({ excludePaths: [] }), files: [{ ...files[0], mtimeMs: 1001 }, files[1]] }).hash).not.toBe(base.hash);
    });

    it('reports the exact added / modified / deleted set', () => {
        const next: FileSignature[] = [
            { path: 'src/a.ts', size: 10, mtimeMs: 1000 },
            { path: 'src/b.ts', size: 21, mtimeMs: 2000 },
            { path: 'src/c.ts', size: 30, mtimeMs: 3000 },
        ];
        expect(diffFileSignatures(files, next)).toEqual({
            added: ['src/c.ts'],
            modified: ['src/b.ts'],
            deleted: [],
            unchanged: ['src/a.ts'],
        });
        expect(diffFileSignatures(files, [])).toEqual({
            added: [], modified: [], deleted: ['src/a.ts', 'src/b.ts'], unchanged: [],
        });
    });

    it('round-trips through graph.db meta and tolerates empty HEAD', () => {
        const fp = computeFingerprint({ head: '', configHash: hashAnalysisConfig({}), files });
        const meta = Object.fromEntries(fingerprintMetaEntries(fp));
        expect(fingerprintFromMeta(meta)).toEqual(fp);
        expect(fingerprintFromMeta({})).toBeNull();
        expect(fingerprintFromMeta({ ...meta, fileSignatures: 'not json' })).toBeNull();
    });

    it('plans skip / head-only / incremental / full without parsing', () => {
        const configHash = hashAnalysisConfig({ excludePaths: [] });
        const base = computeFingerprint({ head: 'abc', configHash, files });
        expect(planAnalysis(base, base, { hasCachedGraph: true }).mode).toBe('skip');
        expect(planAnalysis(base, base, { hasCachedGraph: true, force: true })).toMatchObject({ mode: 'full' });
        expect(planAnalysis(null, base, { hasCachedGraph: true }).mode).toBe('full');
        expect(planAnalysis(base, base, { hasCachedGraph: false }).mode).toBe('full');

        const headOnly = computeFingerprint({ head: 'def', configHash, files });
        expect(planAnalysis(base, headOnly, { hasCachedGraph: true }).mode).toBe('head-only');

        const modified = computeFingerprint({ head: 'def', configHash, files: [{ ...files[0], mtimeMs: 1001 }, files[1]] });
        const plan = planAnalysis(base, modified, { hasCachedGraph: true });
        expect(plan.mode).toBe('incremental');
        if (plan.mode === 'incremental') expect(plan.diff.modified).toEqual(['src/a.ts']);

        expect(planAnalysis(base, modified, { hasCachedGraph: true, maxIncrementalFiles: 0 }).mode).toBe('full');
        const parserChanged = computeFingerprint({ head: 'def', configHash, parserVersion: 'other', files });
        expect(planAnalysis(base, parserChanged, { hasCachedGraph: true })).toMatchObject({ mode: 'full', reason: 'parser version changed' });
    });
});
