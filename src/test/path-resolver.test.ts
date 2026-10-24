import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initTreeSitter } from '../analyzer/tree-sitter-loader';
import { buildGraph, preParseFiles } from '../analyzer/graph-builder';
import { createImportResolver, loadImportAliases } from '../analyzer/path-resolver';
import { makeFileInfo } from './helpers';

let root: string;

beforeAll(async () => {
    await initTreeSitter();
    root = mkdtempSync(join(tmpdir(), 'aura-alias-'));
    mkdirSync(join(root, 'src/components'), { recursive: true });
    mkdirSync(join(root, 'src/lib'), { recursive: true });
    mkdirSync(join(root, 'src/app/models'), { recursive: true });
    mkdirSync(join(root, 'vendor/sol2/sol'), { recursive: true });
    writeFileSync(join(root, 'src/components/Button.tsx'), 'export const Button = 1;\n');
    writeFileSync(join(root, 'src/lib/utils.ts'), 'export const util = 1;\n');
    writeFileSync(join(root, 'src/app/models/user.py'), 'class User: pass\n');
    writeFileSync(join(root, 'vendor/sol2/sol/sol.hpp'), '#pragma once\n');
    writeFileSync(join(root, 'tsconfig.json'), `{
  // aliases used by a React app
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@app/*": ["src/app/*"],
      "~lib/*": ["src/lib/*"],
    },
  },
}`);
    writeFileSync(join(root, 'vite.config.ts'), `
import { defineConfig } from 'vite';
export default defineConfig({
  resolve: { alias: { '@ui': path.resolve(__dirname, './src/components') } }
});
`);
});

afterAll(() => {
    rmSync(root, { recursive: true, force: true });
});

describe('import alias resolver (V2-12)', () => {
    const ids = [
        'src/components/Button.tsx',
        'src/lib/utils.ts',
        'src/app/models/user.py',
        'vendor/sol2/sol/sol.hpp',
    ];

    it('reads tsconfig paths with comments/trailing commas and static Vite aliases', () => {
        const aliases = loadImportAliases(root);
        expect(aliases.paths['@/*']).toEqual(['src/*']);
        expect(aliases.aliases['@ui']).toBe('src/components');
    });

    it('resolves @/ and ~lib aliases to real files', () => {
        const resolver = createImportResolver(root, ids);
        expect(resolver.resolve('@/components/Button', 'src/main.tsx')).toEqual({
            id: 'src/components/Button.tsx', confidence: 'medium', method: 'extension',
        });
        expect(resolver.resolve('~lib/utils', 'src/main.tsx')?.id).toBe('src/lib/utils.ts');
        expect(resolver.resolve('@ui/Button', 'src/main.tsx')?.id).toBe('src/components/Button.tsx');
    });

    it('keeps relative, suffix and Python src-layout resolution', () => {
        const resolver = createImportResolver(root, ids);
        expect(resolver.resolve('./utils', 'src/lib/main.ts')?.id).toBe('src/lib/utils.ts');
        expect(resolver.resolve('sol/sol.hpp', 'src/main.cpp')?.id).toBe('vendor/sol2/sol/sol.hpp');
        expect(resolver.resolve('app.models.user', 'src/main.py')?.id).toBe('src/app/models/user.py');
    });

    it('links an aliased import in the real graph builder', async () => {
        const main = makeFileInfo({
            id: 'src/main.tsx',
            path: 'src/main.tsx',
            fullPath: join(root, 'src/main.tsx'),
            language: 'tsx',
            extension: '.tsx',
            content: `import { Button } from '@/components/Button';\nexport function App() { return <Button />; }\n`,
        });
        const button = makeFileInfo({
            id: 'src/components/Button.tsx',
            path: 'src/components/Button.tsx',
            fullPath: join(root, 'src/components/Button.tsx'),
            language: 'tsx',
            extension: '.tsx',
            content: 'export function Button() { return <button />; }\n',
        });
        const trees = await preParseFiles([main, button]);
        const graph = buildGraph([main, button], 'AliasFixture', {}, trees);
        expect(graph.links.some((l) => l.source === 'src/main.tsx' && l.target === 'src/components/Button.tsx' && l.type === 'import')).toBe(true);
    });
});
