/**
 * ts-c-parser.test.ts — Tests for Tree-sitter based C parser.
 *
 * Mirrors c-parser.test.ts but uses AST-based extraction.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TreeSitterCParser } from '../analyzer/parsers/ts-c-parser';
import { initTreeSitter, parseSource } from '../analyzer/tree-sitter-loader';
import { makeFileInfo } from './helpers';
import type Parser from 'web-tree-sitter';

const parser = new TreeSitterCParser();

beforeAll(async () => {
    await initTreeSitter();
});

async function tree(content: string): Promise<Parser.Tree> {
    return parseSource('c', content);
}

// ============================================================
// parseAST() — #include extraction
// ============================================================
describe('TreeSitterCParser.parseAST', () => {
    it('extracts local includes', async () => {
        const content = '#include "utils.h"\n#include "config.h"\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'src/main.c', content, language: 'c', extension: '.c' });
        const rels = parser.parseAST(t, file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ source: 'src/main.c', target: 'utils.h', type: 'include' });
        expect(rels[1]).toMatchObject({ source: 'src/main.c', target: 'config.h', type: 'include' });
    });

    it('always emits system includes with system-include type', async () => {
        const content = '#include <stdio.h>\n#include "local.h"\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'src/main.c', content, language: 'c', extension: '.c' });
        const rels = parser.parseAST(t, file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ target: 'stdio.h', type: 'system-include' });
        expect(rels[1]).toMatchObject({ target: 'local.h', type: 'include' });
    });

    it('includes system headers when option set', async () => {
        const content = '#include <stdio.h>\n#include <stdlib.h>\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'src/main.c', content, language: 'c', extension: '.c' });
        const rels = parser.parseAST(t, file, { includeSystemHeaders: true });
        expect(rels).toHaveLength(2);
        expect(rels[0].type).toBe('system-include');
    });

    it('returns empty for file with no includes', async () => {
        const content = 'int main() { return 0; }\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'src/main.c', content, language: 'c', extension: '.c' });
        expect(parser.parseAST(t, file)).toHaveLength(0);
    });

    it('extracts includes inside #ifndef header guards', async () => {
        const content = '#ifndef DH_H\n#define DH_H\n#include "Core/Types.h"\n#include "Matrix4x4.h"\nvoid dh_solve(void);\n#endif\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'DHKinematics.h', content, language: 'c', extension: '.h' });
        const rels = parser.parseAST(t, file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ target: 'Core/Types.h', type: 'include' });
        expect(rels[1]).toMatchObject({ target: 'Matrix4x4.h', type: 'include' });
    });
});

// ============================================================
// extractSymbolsAST()
// ============================================================
describe('TreeSitterCParser.extractSymbolsAST', () => {
    it('extracts function definitions', async () => {
        const content = 'int add(int a, int b) {\n    return a + b;\n}\n\nvoid init(void) {\n}\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'utils.c', content, language: 'c', extension: '.c' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.functions).toHaveLength(2);
        expect(symbols.functions[0].name).toBe('add');
        expect(symbols.functions[0].returnType).toBe('int');
        expect(symbols.functions[0].params).toContain('int a');
        expect(symbols.functions[1].name).toBe('init');
    });

    it('extracts functions with __attribute__', async () => {
        const content = '__attribute__((visibility("default")))\nint exported_func(int x) {\n    return x;\n}\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'lib.c', content, language: 'c', extension: '.c' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.functions).toHaveLength(1);
        expect(symbols.functions[0].name).toBe('exported_func');
    });

    it('extracts named structs', async () => {
        const content = 'struct Point {\n    int x;\n    int y;\n};\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'types.h', content, language: 'c', extension: '.h' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.structs.some(s => s.name === 'Point')).toBe(true);
    });

    it('extracts typedef structs', async () => {
        const content = 'typedef struct {\n    float x;\n    float y;\n} Vec2;\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'types.h', content, language: 'c', extension: '.h' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.structs.some(s => s.name === 'Vec2' && s.type === 'typedef-struct')).toBe(true);
    });

    it('extracts enums', async () => {
        const content = 'enum Color {\n    RED,\n    GREEN,\n    BLUE\n};\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'defs.h', content, language: 'c', extension: '.h' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.enums).toHaveLength(1);
        expect(symbols.enums[0].name).toBe('Color');
    });

    it('extracts macros (constant and function-like)', async () => {
        const content = '#define MAX_SIZE 1024\n#define MIN(a, b) ((a) < (b) ? (a) : (b))\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'defs.h', content, language: 'c', extension: '.h' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.macros).toHaveLength(2);
        const constant = symbols.macros.find(m => m.name === 'MAX_SIZE');
        const funcMacro = symbols.macros.find(m => m.name === 'MIN');
        expect(constant?.type).toBe('constant-macro');
        expect(funcMacro?.type).toBe('function-macro');
    });

    it('extracts extern declarations', async () => {
        const content = 'extern int getVersion(void);\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'extern.h', content, language: 'c', extension: '.h' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.externs).toHaveLength(1);
        expect(symbols.externs[0].name).toBe('getVersion');
    });

    it('extracts line numbers correctly', async () => {
        const content = '// header\n\nint first(void) {\n}\n\nint second(void) {\n}\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'test.c', content, language: 'c', extension: '.c' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.functions[0].line).toBe(3);
        expect(symbols.functions[1].line).toBe(6);
    });

    it('extracts pointer return types', async () => {
        const content = 'char *getString(void) {\n    return "hello";\n}\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'str.c', content, language: 'c', extension: '.c' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.functions).toHaveLength(1);
        expect(symbols.functions[0].returnType).toContain('char');
    });
});

// ============================================================
// extractCallsFromAST()
// ============================================================
describe('TreeSitterCParser.extractCallsFromAST', () => {
    it('extracts function calls', async () => {
        const content = 'void main() {\n    init();\n    process();\n}\n';
        const t = await tree(content);
        const calls = parser.extractCallsFromAST(t);
        expect(calls).toContain('init');
        expect(calls).toContain('process');
    });

    it('excludes C builtins', async () => {
        const content = 'void main() {\n    printf("hello");\n    malloc(10);\n    myFunc();\n}\n';
        const t = await tree(content);
        const calls = parser.extractCallsFromAST(t);
        expect(calls).not.toContain('printf');
        expect(calls).not.toContain('malloc');
        expect(calls).toContain('myFunc');
    });

    it('excludes functions defined in the same file', async () => {
        const content = 'void helper(void) {\n}\n\nvoid main() {\n    helper();\n    external();\n}\n';
        const t = await tree(content);
        const calls = parser.extractCallsFromAST(t);
        expect(calls).not.toContain('helper');
        expect(calls).not.toContain('main');
        expect(calls).toContain('external');
    });

    it('excludes ALL_CAPS identifiers (likely macros)', async () => {
        const content = 'void main() {\n    MY_MACRO(x);\n    normalFunc();\n}\n';
        const t = await tree(content);
        const calls = parser.extractCallsFromAST(t);
        expect(calls).not.toContain('MY_MACRO');
        expect(calls).toContain('normalFunc');
    });

    it('excludes __attribute__ decorated local definitions from calls', async () => {
        const content = [
            '__attribute__((visibility("default")))',
            'void plugin_init(void) {',
            '    setup();',
            '}',
            'void run() {',
            '    plugin_init();',
            '    external_call();',
            '}',
        ].join('\n');
        const t = await tree(content);
        const calls = parser.extractCallsFromAST(t);
        expect(calls).not.toContain('plugin_init');
        expect(calls).toContain('external_call');
    });
});

// ============================================================
// usesTreeSitter flag
// ============================================================
describe('TreeSitterCParser metadata', () => {
    it('reports usesTreeSitter = true', () => {
        expect(parser.usesTreeSitter).toBe(true);
    });

    it('has language set to c', () => {
        expect(parser.language).toBe('c');
    });
});

// ============================================================
// extractCallSitesAST — function-level call site extraction
// ============================================================
describe('TreeSitterCParser.extractCallSitesAST', () => {
    it('tracks caller function for each call site', async () => {
        const content = [
            'void helper() {}',
            'void main() {',
            '    helper();',
            '    process_data();',
            '}',
        ].join('\n');
        const t = await tree(content);
        const file = makeFileInfo({ id: 'main.c', content, language: 'c', extension: '.c' });
        const sites = parser.extractCallSitesAST(t, file);
        const mainCalls = sites.filter(s => s.callerName === 'main');
        expect(mainCalls).toHaveLength(2);
        expect(mainCalls.map(s => s.calleeName).sort()).toEqual(['helper', 'process_data']);
        const helperCall = mainCalls.find(s => s.calleeName === 'helper');
        expect(helperCall?.isLocal).toBe(true);
        const extCall = mainCalls.find(s => s.calleeName === 'process_data');
        expect(extCall?.isLocal).toBe(false);
    });
});
