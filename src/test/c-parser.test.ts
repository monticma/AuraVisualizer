import { describe, it, expect } from 'vitest';
import { CParser } from '../analyzer/parsers/c-parser';
import { makeFileInfo } from './helpers';

const parser = new CParser();

// ============================================================
// parse() — #include extraction
// ============================================================
describe('CParser.parse', () => {
    it('extracts local includes', () => {
        const file = makeFileInfo({
            id: 'src/main.c', content: '#include "utils.h"\n#include "config.h"\n',
            language: 'c', extension: '.c',
        });
        const rels = parser.parse(file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ source: 'src/main.c', target: 'utils.h', type: 'include' });
        expect(rels[1]).toMatchObject({ source: 'src/main.c', target: 'config.h', type: 'include' });
    });

    it('ignores system includes by default', () => {
        const file = makeFileInfo({
            id: 'src/main.c', content: '#include <stdio.h>\n#include "local.h"\n',
            language: 'c', extension: '.c',
        });
        const rels = parser.parse(file);
        expect(rels).toHaveLength(1);
        expect(rels[0].target).toBe('local.h');
    });

    it('includes system headers when option set', () => {
        const file = makeFileInfo({
            id: 'src/main.c', content: '#include <stdio.h>\n#include <stdlib.h>\n',
            language: 'c', extension: '.c',
        });
        const rels = parser.parse(file, { includeSystemHeaders: true });
        expect(rels).toHaveLength(2);
        expect(rels[0].type).toBe('system-include');
    });

    it('returns empty for file with no includes', () => {
        const file = makeFileInfo({
            id: 'src/main.c', content: 'int main() { return 0; }\n',
            language: 'c', extension: '.c',
        });
        expect(parser.parse(file)).toHaveLength(0);
    });
});

// ============================================================
// extractSymbols()
// ============================================================
describe('CParser.extractSymbols', () => {
    it('extracts function definitions', () => {
        const file = makeFileInfo({
            id: 'utils.c', content: 'int add(int a, int b) {\n    return a + b;\n}\n\nvoid init(void) {\n}\n',
            language: 'c', extension: '.c',
        });
        const symbols = parser.extractSymbols(file);
        expect(symbols.functions).toHaveLength(2);
        expect(symbols.functions[0].name).toBe('add');
        expect(symbols.functions[0].returnType).toBe('int');
        expect(symbols.functions[1].name).toBe('init');
    });

    it('extracts functions with __attribute__', () => {
        const file = makeFileInfo({
            id: 'lib.c',
            content: '__attribute__((visibility("default")))\nint exported_func(int x) {\n    return x;\n}\n',
            language: 'c', extension: '.c',
        });
        const symbols = parser.extractSymbols(file);
        expect(symbols.functions).toHaveLength(1);
        expect(symbols.functions[0].name).toBe('exported_func');
    });

    it('extracts structs', () => {
        const file = makeFileInfo({
            id: 'types.h', content: 'struct Point {\n    int x;\n    int y;\n};\n',
            language: 'c', extension: '.h',
        });
        const symbols = parser.extractSymbols(file);
        expect(symbols.structs.some(s => s.name === 'Point')).toBe(true);
    });

    it('extracts typedef structs', () => {
        const file = makeFileInfo({
            id: 'types.h',
            content: 'typedef struct {\n    float x;\n    float y;\n} Vec2;\n',
            language: 'c', extension: '.h',
        });
        const symbols = parser.extractSymbols(file);
        expect(symbols.structs.some(s => s.name === 'Vec2' && s.type === 'typedef-struct')).toBe(true);
    });

    it('extracts enums', () => {
        const file = makeFileInfo({
            id: 'defs.h', content: 'enum Color {\n    RED,\n    GREEN,\n    BLUE\n};\n',
            language: 'c', extension: '.h',
        });
        const symbols = parser.extractSymbols(file);
        expect(symbols.enums).toHaveLength(1);
        expect(symbols.enums[0].name).toBe('Color');
    });

    it('extracts macros (constant and function-like)', () => {
        const file = makeFileInfo({
            id: 'defs.h',
            content: '#define MAX_SIZE 1024\n#define MIN(a, b) ((a) < (b) ? (a) : (b))\n',
            language: 'c', extension: '.h',
        });
        const symbols = parser.extractSymbols(file);
        expect(symbols.macros).toHaveLength(2);
        const constant = symbols.macros.find(m => m.name === 'MAX_SIZE');
        const funcMacro = symbols.macros.find(m => m.name === 'MIN');
        expect(constant?.type).toBe('constant-macro');
        expect(funcMacro?.type).toBe('function-macro');
    });

    it('extracts extern declarations', () => {
        const file = makeFileInfo({
            id: 'extern.h', content: 'extern int getVersion(void);\n',
            language: 'c', extension: '.h',
        });
        const symbols = parser.extractSymbols(file);
        expect(symbols.externs).toHaveLength(1);
        expect(symbols.externs[0].name).toBe('getVersion');
    });

    it('ignores functions inside comments', () => {
        const file = makeFileInfo({
            id: 'test.c',
            content: '/* int commented_func(void) { } */\nint real_func(void) {\n}\n',
            language: 'c', extension: '.c',
        });
        const symbols = parser.extractSymbols(file);
        expect(symbols.functions).toHaveLength(1);
        expect(symbols.functions[0].name).toBe('real_func');
    });
});

// ============================================================
// extractCalls()
// ============================================================
describe('CParser.extractCalls', () => {
    it('extracts function calls', () => {
        const file = makeFileInfo({
            id: 'main.c',
            content: 'void main() {\n    init();\n    process();\n}\n',
            language: 'c', extension: '.c',
        });
        const calls = parser.extractCalls(file);
        expect(calls).toContain('init');
        expect(calls).toContain('process');
    });

    it('excludes C builtins', () => {
        const file = makeFileInfo({
            id: 'main.c',
            content: 'void main() {\n    printf("hello");\n    malloc(10);\n    myFunc();\n}\n',
            language: 'c', extension: '.c',
        });
        const calls = parser.extractCalls(file);
        expect(calls).not.toContain('printf');
        expect(calls).not.toContain('malloc');
        expect(calls).toContain('myFunc');
    });

    it('excludes functions defined in the same file', () => {
        const file = makeFileInfo({
            id: 'self.c',
            content: 'void helper(void) {\n}\n\nvoid main() {\n    helper();\n    external();\n}\n',
            language: 'c', extension: '.c',
        });
        const calls = parser.extractCalls(file);
        expect(calls).not.toContain('helper');
        expect(calls).not.toContain('main');
        expect(calls).toContain('external');
    });

    it('excludes ALL_CAPS identifiers (likely macros)', () => {
        const file = makeFileInfo({
            id: 'main.c',
            content: 'void main() {\n    MY_MACRO(x);\n    normalFunc();\n}\n',
            language: 'c', extension: '.c',
        });
        const calls = parser.extractCalls(file);
        expect(calls).not.toContain('MY_MACRO');
        expect(calls).toContain('normalFunc');
    });

    it('excludes __attribute__ decorated local definitions from calls', () => {
        const file = makeFileInfo({
            id: 'plugin.c',
            content: [
                '__attribute__((visibility("default")))',
                'void plugin_init(void) {',
                '    setup();',
                '}',
                'void run() {',
                '    plugin_init();',
                '    external_call();',
                '}',
            ].join('\n'),
            language: 'c', extension: '.c',
        });
        const calls = parser.extractCalls(file);
        expect(calls).not.toContain('plugin_init');
        expect(calls).toContain('external_call');
    });
});
