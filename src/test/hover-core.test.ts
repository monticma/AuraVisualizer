import { describe, it, expect } from 'vitest';
import {
    CANDIDATE_EXTENSIONS,
    allowsBasenameFallback,
    findImportSpecifier,
    formatHover,
    resolveSpecifier,
    supportsLanguage,
} from '../hover-core';

describe('hover: specifier detection', () => {
    const cursorIn = (line: string, needle: string, language: string) =>
        findImportSpecifier(line, language, line.indexOf(needle) + 1);

    it('finds the specifier of a JS/TS import and exposes its range', () => {
        const line = `import { helper } from './utils/helper';`;
        const match = cursorIn(line, './utils/helper', 'typescript');
        expect(match).toEqual({ value: './utils/helper', start: 24, end: 38 });
    });

    it('ignores the rest of the line', () => {
        const line = `import { helper } from './utils/helper';`;
        expect(findImportSpecifier(line, 'typescript', 0)).toBeUndefined();
        expect(findImportSpecifier(line, 'typescript', 10)).toBeUndefined();
        expect(findImportSpecifier(line, 'typescript', line.length - 1)).toBeUndefined();
    });

    it('handles require, dynamic import and side-effect imports', () => {
        expect(cursorIn(`const a = require('./a');`, './a', 'javascript')?.value).toBe('./a');
        expect(cursorIn(`const b = await import('./b.ts');`, './b.ts', 'javascript')?.value).toBe('./b.ts');
        expect(cursorIn(`import './side-effects';`, './side-effects', 'typescriptreact')?.value).toBe('./side-effects');
    });

    it('supports the other languages it advertises', () => {
        expect(cursorIn(`from pkg.mod import thing`, 'pkg.mod', 'python')?.value).toBe('pkg.mod');
        expect(cursorIn(`import os`, 'os', 'python')?.value).toBe('os');
        expect(cursorIn(`#include "core/util.h"`, 'core/util.h', 'c')?.value).toBe('core/util.h');
        expect(cursorIn(`import java.util.List;`, 'java.util.List', 'java')?.value).toBe('java.util.List');
        expect(cursorIn(`import "github.com/x/y"`, 'github.com/x/y', 'go')?.value).toBe('github.com/x/y');
        expect(cursorIn(`use crate::analysis::graph;`, 'crate::analysis::graph', 'rust')?.value).toBe('crate::analysis::graph');
        expect(cursorIn(`using Aura.Core;`, 'Aura.Core', 'csharp')?.value).toBe('Aura.Core');
        expect(cursorIn(`require 'json'`, 'json', 'ruby')?.value).toBe('json');
        expect(cursorIn(`const x = require('socket')`, 'socket', 'lua')?.value).toBe('socket');
        expect(cursorIn(`source ./lib.sh`, './lib.sh', 'shellscript')?.value).toBe('./lib.sh');
    });

    it('reports unsupported languages and non-import lines', () => {
        expect(supportsLanguage('markdown')).toBe(false);
        expect(supportsLanguage('typescript')).toBe(true);
        expect(findImportSpecifier(`const a = 1;`, 'typescript', 8)).toBeUndefined();
        expect(findImportSpecifier('', 'typescript', 0)).toBeUndefined();
        expect(findImportSpecifier(`import x from 'y'`, 'markdown', 16)).toBeUndefined();
    });
});

describe('hover: specifier resolution', () => {
    const graph = [
        'src/app.ts',
        'src/utils/helper.ts',
        'src/utils/index.ts',
        'src/domain/model.ts',
        'src/domain/index.ts',
        'lib/legacy.js',
        'pkg/mod.py',
        'a/b/C.java',
        'src/only.ts',
        'src/analyzer/types.ts', // same basename as the package specifier below
    ];
    const known = new Set(graph);

    it('resolves relative imports exactly, with extension and with index files', () => {
        expect(resolveSpecifier('./utils/helper', 'src/app.ts', known)).toEqual({ nodeId: 'src/utils/helper.ts', confidence: 0.9 });
        expect(resolveSpecifier('./utils/helper.ts', 'src/app.ts', known)).toEqual({ nodeId: 'src/utils/helper.ts', confidence: 1 });
        expect(resolveSpecifier('./domain', 'src/app.ts', known)).toEqual({ nodeId: 'src/domain/index.ts', confidence: 0.85 });
        expect(resolveSpecifier('../lib/legacy', 'src/app.ts', known)).toEqual({ nodeId: 'lib/legacy.js', confidence: 0.9 });
    });

    it('resolves workspace-relative and suffix imports', () => {
        expect(resolveSpecifier('src/utils/helper', 'src/app.ts', known)?.nodeId).toBe('src/utils/helper.ts');
        expect(resolveSpecifier('utils/helper', 'src/app.ts', known)).toEqual({ nodeId: 'src/utils/helper.ts', confidence: 0.6 });
    });

    it('translates dotted module paths (Python, Java, C#, Rust)', () => {
        expect(resolveSpecifier('pkg.mod', 'src/app.ts', known)).toEqual({ nodeId: 'pkg/mod.py', confidence: 0.9 });
        expect(resolveSpecifier('a.b.C', 'src/app.ts', known)).toEqual({ nodeId: 'a/b/C.java', confidence: 0.9 });
        expect(resolveSpecifier('crate::analysis::graph', 'src/app.ts', new Set(['src/analysis/graph.rs']))).toEqual({
            nodeId: 'src/analysis/graph.rs',
            confidence: 0.6,
        });
    });

    it('falls back to a path suffix, then to a unique basename', () => {
        expect(resolveSpecifier('only', 'src/app.ts', known)).toEqual({ nodeId: 'src/only.ts', confidence: 0.6 });
        // Two `index.ts` files: the suffix is ambiguous, the shortest path wins
        // (deterministic, documented in hover-core).
        expect(resolveSpecifier('index', 'src/app.ts', known)).toEqual({ nodeId: 'src/utils/index.ts', confidence: 0.6 });
        // A basename that only exists once resolves at the lowest confidence.
        expect(resolveSpecifier('legacy', 'src/app.ts', known)).toEqual({ nodeId: 'lib/legacy.js', confidence: 0.6 });
    });

    it('never resolves a package specifier through its basename', () => {
        // Regression: `@modelcontextprotocol/sdk/types.js` used to point at
        // src/analyzer/types.ts because `types.js` shares a basename.
        expect(resolveSpecifier('@modelcontextprotocol/sdk/types.js', 'src/app.ts', known)).toBeUndefined();
        expect(resolveSpecifier('lib/types.js', 'src/app.ts', known)).toBeUndefined();
        expect(resolveSpecifier('types.js', 'src/app.ts', known)).toBeUndefined();
        expect(resolveSpecifier('@scope/pkg', 'src/app.ts', known)).toBeUndefined();
        expect(allowsBasenameFallback('@scope/pkg')).toBe(false);
        expect(allowsBasenameFallback('lib/types.js')).toBe(false);
        expect(allowsBasenameFallback('helper')).toBe(true);
    });

    it('returns undefined for unknown or empty specifiers', () => {
        expect(resolveSpecifier('./nope', 'src/app.ts', known)).toBeUndefined();
        expect(resolveSpecifier('', 'src/app.ts', known)).toBeUndefined();
        expect(resolveSpecifier('./utils/helper', '', known)).toBeUndefined();
    });

    it('accepts an array of ids too', () => {
        expect(resolveSpecifier('./utils/helper', 'src/app.ts', graph)?.nodeId).toBe('src/utils/helper.ts');
    });

    it('tries the extension list in a stable order', () => {
        expect(CANDIDATE_EXTENSIONS[0]).toBe('.ts');
        expect(CANDIDATE_EXTENSIONS).toContain('.py');
    });
});

describe('hover: card formatting', () => {
    const links = { focus: 'command:auraVisualizer.focusPath?%5B%22src%2Fa.ts%22%5D', blast: 'command:x', open: 'command:y' };

    it('lists metrics, degrees, layer and violations', () => {
        const text = formatHover({
            id: 'src/a.ts', language: 'typescript', linesOfCode: 214, complexity: 37, cognitive: 18,
            fanIn: 11, fanOut: 4, layer: 'domain', archViolations: 2, riskBucket: 'high', riskScore: 72.4,
        }, links);
        expect(text).toContain('**`src/a.ts`** · typescript');
        expect(text).toContain('214 LOC · complexity 37 · cognitive 18');
        expect(text).toContain('↘ 4 dependencies · ↗ 11 dependents');
        expect(text).toContain('🏛️ domain · ⚠ 2 violations');
        expect(text).toContain('🛡️ risk: high (72)');
        expect(text).toContain('[⟡ Focus in Aura]');
        expect(text).toContain('[💥 Blast radius]');
    });

    it('singularises the violation count and shows a clean layer', () => {
        const text = formatHover({ id: 'x.ts', layer: 'ui', archViolations: 1 }, links);
        expect(text).toContain('⚠ 1 violation');
        expect(formatHover({ id: 'x.ts', archViolations: 0 }, links)).toContain('✓ no violation');
    });

    it('mentions a low-confidence resolution and omits empty sections', () => {
        const text = formatHover({ id: 'x.ts', confidence: 0.6 }, links);
        expect(text).toContain('resolved with confidence 0.60');
        expect(text).not.toContain('LOC');
        expect(text.split('\n').filter(Boolean)).toHaveLength(3); // title + confidence + links
    });
});
