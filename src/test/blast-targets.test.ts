import { describe, it, expect } from 'vitest';
import {
    MAX_BLAST_TARGETS,
    collectBlastTargets,
    collectUris,
    toNodeId,
} from '../commands/blast-targets';

const ROOT = '/work/aura';
const uri = (fsPath: string, scheme = 'file') => ({ fsPath, scheme });

describe('blast targets: node ids', () => {
    it('turns absolute paths into workspace-relative POSIX ids', () => {
        expect(toNodeId('/work/aura/src/a.ts', ROOT)).toBe('src/a.ts');
        expect(toNodeId('C:\\work\\aura\\src\\b.py', 'C:\\work\\aura')).toBe('src/b.py');
        expect(toNodeId('/work/aura/src/a.ts', '/work/aura/')).toBe('src/a.ts');
    });

    it('rejects files outside the workspace', () => {
        expect(toNodeId('/other/src/a.ts', ROOT)).toBeUndefined();
        expect(toNodeId('/work/aura-extra/src/a.ts', ROOT)).toBeUndefined();
        expect(toNodeId(ROOT, ROOT)).toBeUndefined();
        expect(toNodeId('', ROOT)).toBeUndefined();
    });

    it('falls back to the cleaned path when no workspace root is known', () => {
        expect(toNodeId('/work/aura/src/a.ts', undefined)).toBe('/work/aura/src/a.ts');
        expect(toNodeId('./src/a.ts', undefined)).toBe('src/a.ts');
    });
});

describe('blast targets: URI collection', () => {
    it('merges the clicked resource with the SCM selection', () => {
        const uris = collectUris(uri('/work/aura/src/a.ts'), [uri('/work/aura/src/a.ts'), uri('/work/aura/src/b.ts')], undefined);
        expect(uris.map(u => u.fsPath)).toEqual(['/work/aura/src/a.ts', '/work/aura/src/a.ts', '/work/aura/src/b.ts']);
    });

    it('accepts an array as the first argument (explorer multi-selection)', () => {
        const uris = collectUris([uri('/a.ts'), uri('/b.ts')], undefined, undefined);
        expect(uris).toHaveLength(2);
    });

    it('falls back to the active editor only when nothing was passed', () => {
        expect(collectUris(undefined, undefined, uri('/work/aura/src/a.ts')).map(u => u.fsPath)).toEqual(['/work/aura/src/a.ts']);
        expect(collectUris(uri('/work/aura/src/b.ts'), undefined, uri('/work/aura/src/a.ts')).map(u => u.fsPath)).toEqual(['/work/aura/src/b.ts']);
        expect(collectUris(undefined, [], undefined)).toEqual([]);
        expect(collectUris({ fsPath: '' }, undefined, undefined)).toEqual([]);
    });
});

describe('blast targets: resolution', () => {
    const analyzed = ['src/a.ts', 'src/b.ts', 'src/c.ts'];

    it('resolves a single modified file', () => {
        const targets = collectBlastTargets(uri('/work/aura/src/a.ts'), undefined, undefined, ROOT, analyzed);
        expect(targets).toMatchObject({ ids: ['src/a.ts'], skipped: 0, outsideWorkspace: 0 });
    });

    it('deduplicates the clicked file against the selection', () => {
        const targets = collectBlastTargets(
            uri('/work/aura/src/a.ts'),
            [uri('/work/aura/src/a.ts'), uri('/work/aura/src/b.ts')],
            undefined, ROOT, analyzed,
        );
        expect(targets.ids).toEqual(['src/a.ts', 'src/b.ts']);
    });

    it('drops files that are not part of the analyzed graph', () => {
        const targets = collectBlastTargets(
            [uri('/work/aura/src/a.ts'), uri('/work/aura/README.md')],
            undefined, undefined, ROOT, analyzed,
        );
        expect(targets.ids).toEqual(['src/a.ts']);
        expect(targets.skipped).toBe(1);
    });

    it('counts files outside the workspace separately', () => {
        const targets = collectBlastTargets(
            [uri('/elsewhere/x.ts'), uri('/work/aura/src/a.ts')],
            undefined, undefined, ROOT, analyzed,
        );
        expect(targets.ids).toEqual(['src/a.ts']);
        expect(targets.outsideWorkspace).toBe(1);
        expect(targets.skipped).toBe(0);
    });

    it('passes paths through when the graph is not known yet (cold start)', () => {
        const targets = collectBlastTargets(uri('/work/aura/src/z.ts'), undefined, undefined, ROOT, undefined);
        expect(targets.ids).toEqual(['src/z.ts']);
        expect(targets.skipped).toBe(0);
    });

    it('normalizes backslashes and caps the number of seeds', () => {
        const many = Array.from({ length: MAX_BLAST_TARGETS + 10 }, (_, i) => uri(`/work/aura/src/f${i}.ts`));
        const targets = collectBlastTargets(many, undefined, undefined, ROOT, undefined);
        expect(targets.ids).toHaveLength(MAX_BLAST_TARGETS);

        const windows = collectBlastTargets(uri('C:\\work\\aura\\src\\b.py'), undefined, undefined, 'C:\\work\\aura', undefined);
        expect(windows.ids).toEqual(['src/b.py']);
    });

    it('returns nothing when there is nothing to blast', () => {
        const targets = collectBlastTargets(undefined, undefined, undefined, ROOT, analyzed);
        expect(targets).toEqual({ ids: [], skipped: 0, outsideWorkspace: 0 });
    });
});
