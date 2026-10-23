import { describe, it, expect } from 'vitest';
import { resolveNavigationPath, workspaceRelativePath } from '../commands/navigation-core';

const ROOT = '/workspace';

describe('navigation path resolution', () => {
    it('resolves a relative path with spaces', () => {
        const target = resolveNavigationPath('./src/my file.ts', ROOT);
        expect(target).toEqual({
            absolutePath: '/workspace/src/my file.ts',
            relativePath: 'src/my file.ts',
            insideWorkspace: true,
        });
    });

    it('resolves an absolute path inside the workspace', () => {
        const target = resolveNavigationPath('/workspace/src/a.ts', ROOT);
        expect(target?.absolutePath).toBe('/workspace/src/a.ts');
        expect(target?.relativePath).toBe('src/a.ts');
        expect(target?.insideWorkspace).toBe(true);
    });

    it('marks an absolute path outside the workspace', () => {
        const target = resolveNavigationPath('/elsewhere/a.ts', ROOT);
        expect(target?.insideWorkspace).toBe(false);
        expect(workspaceRelativePath('/elsewhere/a.ts', ROOT)).toBeUndefined();
    });

    it('rejects parent-directory escapes for graph focus', () => {
        expect(resolveNavigationPath('../outside.ts', ROOT)?.insideWorkspace).toBe(false);
        expect(workspaceRelativePath('../outside.ts', ROOT)).toBeUndefined();
    });

    it('normalizes backslashes and surrounding quotes', () => {
        const target = resolveNavigationPath('"src\\nested\\my file.ts"', ROOT);
        expect(target?.relativePath).toBe('src/nested/my file.ts');
        expect(target?.absolutePath).toBe('/workspace/src/nested/my file.ts');
    });

    it('returns undefined for empty or root-less relative paths', () => {
        expect(resolveNavigationPath('   ', ROOT)).toBeUndefined();
        expect(resolveNavigationPath('src/a.ts', undefined)).toBeUndefined();
        expect(workspaceRelativePath('', ROOT)).toBeUndefined();
    });
});
