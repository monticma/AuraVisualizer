/**
 * ts-py-parser.test.ts — Tests for Tree-sitter based Python parser.
 *
 * Covers: imports (import, from…import), symbols (functions, async,
 * decorated, classes, methods, __all__), heritage, and calls.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TreeSitterPyParser } from '../analyzer/parsers/ts-py-parser';
import { initTreeSitter, parseSource } from '../analyzer/tree-sitter-loader';
import { makeFileInfo } from './helpers';
import type Parser from 'web-tree-sitter';

const parser = new TreeSitterPyParser();

beforeAll(async () => {
    await initTreeSitter();
});

async function tree(content: string): Promise<Parser.Tree> {
    return parseSource('python', content);
}

// ============================================================
// parseAST() — import extraction
// ============================================================
describe('TreeSitterPyParser.parseAST', () => {
    it('extracts import statements', async () => {
        const content = 'import os\nimport sys\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'main.py', content, language: 'python', extension: '.py' });
        const rels = parser.parseAST(t, file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ source: 'main.py', target: 'os', type: 'import' });
        expect(rels[1]).toMatchObject({ source: 'main.py', target: 'sys', type: 'import' });
    });

    it('extracts from…import statements', async () => {
        const content = 'from pathlib import Path\nfrom collections import OrderedDict\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'utils.py', content, language: 'python', extension: '.py' });
        const rels = parser.parseAST(t, file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ target: 'pathlib', type: 'from-import' });
        expect(rels[1]).toMatchObject({ target: 'collections', type: 'from-import' });
    });

    it('extracts dotted module imports', async () => {
        const content = 'import os.path\nfrom xml.etree import ElementTree\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'parser.py', content, language: 'python', extension: '.py' });
        const rels = parser.parseAST(t, file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ target: 'os.path', type: 'import' });
        expect(rels[1]).toMatchObject({ target: 'xml.etree', type: 'from-import' });
    });

    it('returns empty for no imports', async () => {
        const content = 'x = 42\nprint(x)\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'simple.py', content, language: 'python', extension: '.py' });
        expect(parser.parseAST(t, file)).toHaveLength(0);
    });
});

// ============================================================
// extractSymbolsAST() — symbol extraction
// ============================================================
describe('TreeSitterPyParser.extractSymbolsAST', () => {
    it('extracts function definitions', async () => {
        const content = 'def add(a, b):\n    return a + b\n\ndef greet(name):\n    print(name)\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'utils.py', content, language: 'python', extension: '.py' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.functions).toHaveLength(2);
        expect(symbols.functions[0]).toMatchObject({ name: 'add', type: 'function' });
        expect(symbols.functions[1]).toMatchObject({ name: 'greet', type: 'function' });
    });

    it('extracts async functions', async () => {
        const content = 'async def fetch_data(url):\n    pass\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'net.py', content, language: 'python', extension: '.py' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.functions).toHaveLength(1);
        expect(symbols.functions[0]).toMatchObject({ name: 'fetch_data', type: 'function', isAsync: true });
    });

    it('extracts dunder functions', async () => {
        const content = 'def __init__(self):\n    pass\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'mod.py', content, language: 'python', extension: '.py' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.functions).toHaveLength(1);
        expect(symbols.functions[0].type).toBe('dunder');
    });

    it('extracts classes with methods', async () => {
        const content = [
            'class Animal:',
            '    def __init__(self, name):',
            '        self.name = name',
            '    def speak(self):',
            '        return "..."',
            '    @staticmethod',
            '    def create(name):',
            '        return Animal(name)',
            '    @classmethod',
            '    def from_dict(cls, data):',
            '        return cls(data)',
        ].join('\n') + '\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'animal.py', content, language: 'python', extension: '.py' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.classes).toHaveLength(1);
        expect(symbols.classes[0].name).toBe('Animal');
        // Methods: __init__ (dunder), speak, create (static), from_dict (classmethod)
        expect(symbols.methods).toHaveLength(4);
        expect(symbols.methods.find(m => m.name === '__init__')?.type).toBe('dunder');
        expect(symbols.methods.find(m => m.name === 'speak')?.type).toBe('method');
        expect(symbols.methods.find(m => m.name === 'create')?.isStatic).toBe(true);
    });

    it('extracts class heritage (single)', async () => {
        const content = 'class Dog(Animal):\n    pass\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'dog.py', content, language: 'python', extension: '.py' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.classes).toHaveLength(1);
        const dog = symbols.classes[0] as any;
        expect(dog.extends).toBe('Animal');
    });

    it('extracts class heritage (multiple)', async () => {
        const content = 'class MultiChild(Base, Mixin):\n    pass\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'multi.py', content, language: 'python', extension: '.py' });
        const symbols = parser.extractSymbolsAST(t, file);
        const cls = symbols.classes[0] as any;
        expect(cls.extends).toBe('Base');
        expect(cls.implements).toContain('Mixin');
    });

    it('extracts __all__ exports', async () => {
        const content = "__all__ = ['Foo', 'Bar', 'baz']\n";
        const t = await tree(content);
        const file = makeFileInfo({ id: 'mod.py', content, language: 'python', extension: '.py' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.exports).toHaveLength(3);
        expect(symbols.exports[0]).toMatchObject({ name: 'Foo', type: 'export-all' });
        expect(symbols.exports[1]).toMatchObject({ name: 'Bar', type: 'export-all' });
        expect(symbols.exports[2]).toMatchObject({ name: 'baz', type: 'export-all' });
    });

    it('extracts decorated functions as top-level', async () => {
        const content = '@app.route("/")\ndef index():\n    return "hello"\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'views.py', content, language: 'python', extension: '.py' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.functions).toHaveLength(1);
        expect(symbols.functions[0].name).toBe('index');
        // app.route stored as decorator-macro
        expect(symbols.macros.length).toBeGreaterThanOrEqual(1);
    });
});

// ============================================================
// Heritage relations
// ============================================================
describe('TreeSitterPyParser.extractHeritageRelations', () => {
    it('extracts extends edges for single inheritance', async () => {
        const content = 'class Base:\n    pass\nclass Child(Base):\n    pass\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'hier.py', content, language: 'python', extension: '.py' });
        const rels = parser.extractHeritageRelations(t, file);
        expect(rels).toHaveLength(1);
        expect(rels[0]).toMatchObject({ source: 'hier.py', target: 'Base', type: 'extends' });
    });

    it('extracts extends edges for multiple inheritance', async () => {
        const content = 'class Multi(Base, Mixin, Serializable):\n    pass\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'multi.py', content, language: 'python', extension: '.py' });
        const rels = parser.extractHeritageRelations(t, file);
        expect(rels).toHaveLength(3);
        expect(rels.map(r => r.target)).toEqual(['Base', 'Mixin', 'Serializable']);
    });
});

// ============================================================
// extractCallsAST / extractCallsFromAST
// ============================================================
describe('TreeSitterPyParser.extractCallsAST', () => {
    it('extracts cross-file function calls', async () => {
        const content = [
            'def local_func():',
            '    pass',
            '',
            'result = external_func()',
            'another_call(result)',
            'print(result)',
        ].join('\n') + '\n';
        const t = await tree(content);
        const calls = parser.extractCallsFromAST(t);
        expect(calls).toContain('external_func');
        expect(calls).toContain('another_call');
        expect(calls).not.toContain('local_func');
        expect(calls).not.toContain('print');
    });

    it('excludes ALL_CAPS and builtins', async () => {
        const content = 'MAX_SIZE()\nlen([1,2])\ncustom_func()\n';
        const t = await tree(content);
        const calls = parser.extractCallsFromAST(t);
        expect(calls).not.toContain('MAX_SIZE');
        expect(calls).not.toContain('len');
        expect(calls).toContain('custom_func');
    });

    it('builds relations against globalFunctions', async () => {
        const content = 'x = helper()\ny = unknown()\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'app.py', content, language: 'python', extension: '.py' });
        const globals = new Set(['helper']);
        const rels = parser.extractCallsAST(t, file, globals);
        expect(rels).toHaveLength(1);
        expect(rels[0]).toMatchObject({ source: 'app.py', target: 'helper', type: 'function-call' });
    });

    it('excludes class instantiations defined locally', async () => {
        const content = [
            'class MyClass:',
            '    pass',
            '',
            'obj = MyClass()',
            'result = external()',
        ].join('\n') + '\n';
        const t = await tree(content);
        const calls = parser.extractCallsFromAST(t);
        expect(calls).not.toContain('MyClass');
        expect(calls).toContain('external');
    });
});

// ============================================================
// extractCallSitesAST — function-level call site extraction
// ============================================================
describe('TreeSitterPyParser.extractCallSitesAST', () => {
    it('tracks caller function for each call site', async () => {
        const content = [
            'def main():',
            '    helper()',
            '    process()',
            '',
            'def setup():',
            '    init()',
        ].join('\n') + '\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'app.py', content, language: 'python', extension: '.py' });
        const sites = parser.extractCallSitesAST(t, file);
        const mainCalls = sites.filter(s => s.callerName === 'main');
        expect(mainCalls).toHaveLength(2);
        expect(mainCalls.map(s => s.calleeName).sort()).toEqual(['helper', 'process']);
        const setupCalls = sites.filter(s => s.callerName === 'setup');
        expect(setupCalls).toHaveLength(1);
        expect(setupCalls[0].calleeName).toBe('init');
    });

    it('marks local calls', async () => {
        const content = [
            'def helper():',
            '    pass',
            '',
            'def main():',
            '    helper()',
            '    external()',
        ].join('\n') + '\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'app.py', content, language: 'python', extension: '.py' });
        const sites = parser.extractCallSitesAST(t, file);
        const helperCall = sites.find(s => s.calleeName === 'helper');
        const extCall = sites.find(s => s.calleeName === 'external');
        expect(helperCall?.isLocal).toBe(true);
        expect(extCall?.isLocal).toBe(false);
    });

    it('uses <module> for top-level calls', async () => {
        const content = 'setup()\n\ndef run():\n    execute()\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'app.py', content, language: 'python', extension: '.py' });
        const sites = parser.extractCallSitesAST(t, file);
        const topLevel = sites.find(s => s.calleeName === 'setup');
        expect(topLevel?.callerName).toBe('<module>');
        const nested = sites.find(s => s.calleeName === 'execute');
        expect(nested?.callerName).toBe('run');
    });
});
