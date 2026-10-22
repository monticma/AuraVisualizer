/**
 * ts-js-parser.test.ts — Tests for Tree-sitter based JS/TS parsers.
 *
 * Covers: imports (ES, require, dynamic), symbols (functions, arrows,
 * classes, methods, exports), calls, and TS-specific features
 * (interfaces, type aliases, heritage, visibility).
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TreeSitterJSParser } from '../analyzer/parsers/ts-js-parser';
import { TreeSitterTSParser } from '../analyzer/parsers/ts-ts-parser';
import { initTreeSitter, parseSource } from '../analyzer/tree-sitter-loader';
import { makeFileInfo } from './helpers';
import type Parser from 'web-tree-sitter';

const jsParser = new TreeSitterJSParser();
const tsParser = new TreeSitterTSParser();

beforeAll(async () => {
    await initTreeSitter();
});

async function jsTree(content: string): Promise<Parser.Tree> {
    return parseSource('javascript', content);
}

async function tsTree(content: string): Promise<Parser.Tree> {
    return parseSource('typescript', content);
}

// ============================================================
// TreeSitterJSParser.parseAST — import extraction
// ============================================================
describe('TreeSitterJSParser.parseAST', () => {
    it('extracts ES import statements', async () => {
        const content = "import { foo } from './utils';\nimport bar from 'lodash';\n";
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'app.js', content, language: 'javascript', extension: '.js' });
        const rels = jsParser.parseAST(t, file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ source: 'app.js', target: './utils', type: 'import' });
        expect(rels[1]).toMatchObject({ source: 'app.js', target: 'lodash', type: 'import' });
    });

    it('extracts require() calls', async () => {
        const content = "const fs = require('fs');\nconst path = require('path');\n";
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'index.js', content, language: 'javascript', extension: '.js' });
        const rels = jsParser.parseAST(t, file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ target: 'fs', type: 'require' });
        expect(rels[1]).toMatchObject({ target: 'path', type: 'require' });
    });

    it('extracts dynamic import()', async () => {
        const content = "const mod = await import('./views/home.js');\n";
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'router.js', content, language: 'javascript', extension: '.js' });
        const rels = jsParser.parseAST(t, file);
        expect(rels).toHaveLength(1);
        expect(rels[0]).toMatchObject({ target: './views/home.js', type: 'dynamic-import' });
    });

    it('extracts script/stylesheet references from joinPath() literals', async () => {
        const content = [
            "const app = vscode.Uri.joinPath(root, 'js', 'app.js');",
            "const css = path.join(__dirname, 'css', 'style.css');",
            "const fixture = makeFileInfo({ id: 'fixture.js' });",
            "const notAPath = 'hello.js';",
            '',
        ].join('\n');
        const t = await tsTree(content);
        const file = makeFileInfo({ id: 'provider.ts', content, language: 'typescript', extension: '.ts' });
        const rels = tsParser.parseAST(t, file);
        expect(rels).toEqual(expect.arrayContaining([
            expect.objectContaining({ target: 'app.js', type: 'script' }),
            expect.objectContaining({ target: 'style.css', type: 'stylesheet' }),
        ]));
        expect(rels.find(r => r.target === 'fixture.js')).toBeUndefined();
        expect(rels.find(r => r.target === 'hello.js')).toBeUndefined();
    });

    it('handles mixed import styles', async () => {
        const content = [
            "import { a } from './a';",
            "const b = require('./b');",
            "import('./c');",
            "",
        ].join('\n');
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'mixed.js', content, language: 'javascript', extension: '.js' });
        const rels = jsParser.parseAST(t, file);
        expect(rels).toHaveLength(3);
    });

    it('returns empty for no imports', async () => {
        const content = 'const x = 42;\nconsole.log(x);\n';
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'pure.js', content, language: 'javascript', extension: '.js' });
        expect(jsParser.parseAST(t, file)).toHaveLength(0);
    });
});

// ============================================================
// TreeSitterJSParser.extractSymbolsAST — symbol extraction
// ============================================================
describe('TreeSitterJSParser.extractSymbolsAST', () => {
    it('extracts function declarations', async () => {
        const content = 'function add(a, b) { return a + b; }\nasync function fetchData() {}\n';
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'utils.js', content, language: 'javascript', extension: '.js' });
        const symbols = jsParser.extractSymbolsAST(t, file);
        expect(symbols.functions).toHaveLength(2);
        expect(symbols.functions[0]).toMatchObject({ name: 'add', type: 'function' });
        expect(symbols.functions[1]).toMatchObject({ name: 'fetchData', type: 'function', isAsync: true });
    });

    it('extracts arrow functions', async () => {
        const content = 'const greet = (name) => `Hello ${name}`;\nconst run = async () => {};\n';
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'helpers.js', content, language: 'javascript', extension: '.js' });
        const symbols = jsParser.extractSymbolsAST(t, file);
        expect(symbols.functions).toHaveLength(2);
        expect(symbols.functions[0]).toMatchObject({ name: 'greet', type: 'arrow' });
        expect(symbols.functions[1]).toMatchObject({ name: 'run', type: 'arrow', isAsync: true });
    });

    it('extracts classes and methods', async () => {
        const content = [
            'class Animal {',
            '    constructor(name) { this.name = name; }',
            '    speak() { return "..."; }',
            '    static create(name) { return new Animal(name); }',
            '}',
        ].join('\n');
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'animal.js', content, language: 'javascript', extension: '.js' });
        const symbols = jsParser.extractSymbolsAST(t, file);
        expect(symbols.classes).toHaveLength(1);
        expect(symbols.classes[0].name).toBe('Animal');
        // constructor excluded, speak + create
        expect(symbols.methods).toHaveLength(2);
        expect(symbols.methods.find(m => m.name === 'speak')).toBeDefined();
        expect(symbols.methods.find(m => m.name === 'create')?.isStatic).toBe(true);
    });

    it('extracts named exports', async () => {
        const content = [
            "export function serve() {}",
            "export class Server {}",
            "export const PORT = 3000;",
        ].join('\n');
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'server.js', content, language: 'javascript', extension: '.js' });
        const symbols = jsParser.extractSymbolsAST(t, file);
        expect(symbols.exports.length).toBeGreaterThanOrEqual(3);
        expect(symbols.exports.find(e => e.name === 'serve')?.type).toBe('export-function');
        expect(symbols.exports.find(e => e.name === 'Server')?.type).toBe('export-class');
        expect(symbols.exports.find(e => e.name === 'PORT')?.type).toBe('export-variable');
    });

    it('extracts export default', async () => {
        const content = 'export default function main() {}\n';
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'main.js', content, language: 'javascript', extension: '.js' });
        const symbols = jsParser.extractSymbolsAST(t, file);
        expect(symbols.exports.find(e => e.type === 'export-default')).toBeDefined();
    });

    it('extracts export list', async () => {
        const content = "const a = 1;\nconst b = 2;\nexport { a, b };\n";
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'lib.js', content, language: 'javascript', extension: '.js' });
        const symbols = jsParser.extractSymbolsAST(t, file);
        expect(symbols.exports).toHaveLength(2);
        expect(symbols.exports[0]).toMatchObject({ name: 'a', type: 'export-named' });
        expect(symbols.exports[1]).toMatchObject({ name: 'b', type: 'export-named' });
    });

    it('extracts generator functions', async () => {
        const content = 'function* range(start, end) { for (let i = start; i < end; i++) yield i; }\n';
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'gen.js', content, language: 'javascript', extension: '.js' });
        const symbols = jsParser.extractSymbolsAST(t, file);
        expect(symbols.functions).toHaveLength(1);
        expect(symbols.functions[0]).toMatchObject({ name: 'range', type: 'generator' });
    });
});

// ============================================================
// TreeSitterJSParser.extractCallsAST
// ============================================================
describe('TreeSitterJSParser.extractCallsAST / extractCallsFromAST', () => {
    it('extracts cross-file function calls', async () => {
        const content = [
            'function localFn() {}',
            'const result = externalFn();',
            'anotherFn(42);',
            'console.log(result);',
        ].join('\n');
        const t = await jsTree(content);
        const calls = jsParser.extractCallsFromAST(t);
        // localFn is defined locally, console/log are builtins
        expect(calls).toContain('externalFn');
        expect(calls).toContain('anotherFn');
        expect(calls).not.toContain('localFn');
        expect(calls).not.toContain('log');
    });

    it('excludes ALL_CAPS and builtins', async () => {
        const content = 'MAX_SIZE();\nparseInt("42");\ncustomFunc();\n';
        const t = await jsTree(content);
        const calls = jsParser.extractCallsFromAST(t);
        expect(calls).not.toContain('MAX_SIZE');
        expect(calls).not.toContain('parseInt');
        expect(calls).toContain('customFunc');
    });

    it('builds relations against globalFunctions', async () => {
        const content = 'const x = helper();\nconst y = unknown();\n';
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'app.js', content, language: 'javascript', extension: '.js' });
        const globals = new Set(['helper']);
        const rels = jsParser.extractCallsAST(t, file, globals);
        expect(rels).toHaveLength(1);
        expect(rels[0]).toMatchObject({ source: 'app.js', target: 'helper', type: 'function-call' });
    });
});

// ============================================================
// TreeSitterTSParser — TypeScript-specific features
// ============================================================
describe('TreeSitterTSParser.parseAST', () => {
    it('extracts TypeScript imports including import type', async () => {
        const content = "import type { Config } from './types';\nimport { serve } from './server';\n";
        const t = await tsTree(content);
        const file = makeFileInfo({ id: 'app.ts', content, language: 'typescript', extension: '.ts' });
        const rels = tsParser.parseAST(t, file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ target: './types', type: 'import-type' });
        expect(rels[1]).toMatchObject({ target: './server', type: 'import' });
    });
});

describe('TreeSitterTSParser.extractSymbolsAST', () => {
    it('extracts interfaces', async () => {
        const content = [
            'interface IService {',
            '    start(port: number): Promise<void>;',
            '    stop(): void;',
            '}',
        ].join('\n');
        const t = await tsTree(content);
        const file = makeFileInfo({ id: 'types.ts', content, language: 'typescript', extension: '.ts' });
        const symbols = tsParser.extractSymbolsAST(t, file);
        expect(symbols.interfaces).toHaveLength(1);
        expect(symbols.interfaces[0]).toMatchObject({ name: 'IService', type: 'interface' });
    });

    it('extracts type aliases', async () => {
        const content = 'type Config = { host: string; port: number };\n';
        const t = await tsTree(content);
        const file = makeFileInfo({ id: 'types.ts', content, language: 'typescript', extension: '.ts' });
        const symbols = tsParser.extractSymbolsAST(t, file);
        expect(symbols.typeAliases).toHaveLength(1);
        expect(symbols.typeAliases[0]).toMatchObject({ name: 'Config', type: 'type-alias' });
    });

    it('extracts class with visibility modifiers', async () => {
        const content = [
            'class Service {',
            '    private config: any;',
            '    public async start(): Promise<void> {}',
            '    protected configure(): void {}',
            '}',
        ].join('\n');
        const t = await tsTree(content);
        const file = makeFileInfo({ id: 'service.ts', content, language: 'typescript', extension: '.ts' });
        const symbols = tsParser.extractSymbolsAST(t, file);
        expect(symbols.classes).toHaveLength(1);
        expect(symbols.methods).toHaveLength(2); // start + configure (constructor excluded)
        const startMethod = symbols.methods.find(m => m.name === 'start');
        expect(startMethod?.visibility).toBe('public');
        expect(startMethod?.isAsync).toBe(true);
        const configureMethod = symbols.methods.find(m => m.name === 'configure');
        expect(configureMethod?.visibility).toBe('protected');
    });

    it('extracts class heritage (extends)', async () => {
        const content = [
            'class Base { run() {} }',
            'class Child extends Base { override run() {} }',
        ].join('\n');
        const t = await tsTree(content);
        const file = makeFileInfo({ id: 'child.ts', content, language: 'typescript', extension: '.ts' });
        const symbols = tsParser.extractSymbolsAST(t, file);
        expect(symbols.classes).toHaveLength(2);
        const child = symbols.classes.find(c => c.name === 'Child') as any;
        expect(child.extends).toBe('Base');
    });

    it('extracts class heritage (implements)', async () => {
        const content = [
            'interface IService { start(): void; }',
            'class Service implements IService { start() {} }',
        ].join('\n');
        const t = await tsTree(content);
        const file = makeFileInfo({ id: 'svc.ts', content, language: 'typescript', extension: '.ts' });
        const symbols = tsParser.extractSymbolsAST(t, file);
        const svc = symbols.classes.find(c => c.name === 'Service') as any;
        expect(svc.implements).toContain('IService');
    });

    it('extracts heritage relations as edges', async () => {
        const content = [
            'interface ILogger { log(msg: string): void; }',
            'class Base {}',
            'class Logger extends Base implements ILogger {',
            '    log(msg: string) { console.log(msg); }',
            '}',
        ].join('\n');
        const t = await tsTree(content);
        const file = makeFileInfo({ id: 'logger.ts', content, language: 'typescript', extension: '.ts' });
        const rels = tsParser.extractHeritageRelations(t, file);
        expect(rels.find(r => r.type === 'extends')).toMatchObject({
            source: 'logger.ts',
            target: 'Base',
            type: 'extends',
        });
        expect(rels.find(r => r.type === 'implements')).toMatchObject({
            source: 'logger.ts',
            target: 'ILogger',
            type: 'implements',
        });
    });

    it('extracts exported interfaces and type aliases', async () => {
        const content = [
            'export interface IPlugin { init(): void; }',
            'export type PluginConfig = { name: string };',
        ].join('\n');
        const t = await tsTree(content);
        const file = makeFileInfo({ id: 'plugin.ts', content, language: 'typescript', extension: '.ts' });
        const symbols = tsParser.extractSymbolsAST(t, file);
        expect(symbols.interfaces).toHaveLength(1);
        expect(symbols.typeAliases).toHaveLength(1);
        expect(symbols.exports.find(e => e.type === 'export-interface')).toBeDefined();
        expect(symbols.exports.find(e => e.type === 'export-type-alias')).toBeDefined();
    });

    it('extracts export type { ... }', async () => {
        const content = "export type { IService, Config };\n";
        const t = await tsTree(content);
        const file = makeFileInfo({ id: 'index.ts', content, language: 'typescript', extension: '.ts' });
        const symbols = tsParser.extractSymbolsAST(t, file);
        expect(symbols.exports).toHaveLength(2);
        expect(symbols.exports[0].type).toBe('export-type');
        expect(symbols.exports[1].type).toBe('export-type');
    });
});

describe('TreeSitterTSParser.extractCallsAST', () => {
    it('extracts calls from TypeScript code', async () => {
        const content = [
            'function localHelper(): void {}',
            'const result = externalService();',
            'doSomething(result);',
        ].join('\n');
        const t = await tsTree(content);
        const calls = tsParser.extractCallsFromAST(t);
        expect(calls).toContain('externalService');
        expect(calls).toContain('doSomething');
        expect(calls).not.toContain('localHelper');
    });
});

// ============================================================
// extractCallSitesAST — function-level call site extraction
// ============================================================
describe('TreeSitterJSParser.extractCallSitesAST', () => {
    it('tracks caller function for each call site', async () => {
        const content = [
            'function foo() {',
            '    bar();',
            '    baz();',
            '}',
            'function qux() {',
            '    bar();',
            '}',
        ].join('\n');
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'test.js', content, language: 'javascript', extension: '.js' });
        const sites = jsParser.extractCallSitesAST(t, file);
        expect(sites.length).toBe(3);
        // foo calls bar and baz
        const fooCalls = sites.filter(s => s.callerName === 'foo');
        expect(fooCalls).toHaveLength(2);
        expect(fooCalls.map(s => s.calleeName).sort()).toEqual(['bar', 'baz']);
        // qux calls bar
        const quxCalls = sites.filter(s => s.callerName === 'qux');
        expect(quxCalls).toHaveLength(1);
        expect(quxCalls[0].calleeName).toBe('bar');
    });

    it('marks local calls with isLocal=true', async () => {
        const content = [
            'function helper() {}',
            'function main() {',
            '    helper();',
            '    externalFn();',
            '}',
        ].join('\n');
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'test.js', content, language: 'javascript', extension: '.js' });
        const sites = jsParser.extractCallSitesAST(t, file);
        const helperCall = sites.find(s => s.calleeName === 'helper');
        const extCall = sites.find(s => s.calleeName === 'externalFn');
        expect(helperCall?.isLocal).toBe(true);
        expect(extCall?.isLocal).toBe(false);
    });

    it('uses <module> for top-level calls', async () => {
        const content = 'initApp();\nfunction setup() { configure(); }\n';
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'test.js', content, language: 'javascript', extension: '.js' });
        const sites = jsParser.extractCallSitesAST(t, file);
        const topLevel = sites.find(s => s.calleeName === 'initApp');
        expect(topLevel?.callerName).toBe('<module>');
        const nested = sites.find(s => s.calleeName === 'configure');
        expect(nested?.callerName).toBe('setup');
    });

    it('tracks arrow function scope', async () => {
        const content = [
            'const process = () => {',
            '    transform();',
            '};',
        ].join('\n');
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'test.js', content, language: 'javascript', extension: '.js' });
        const sites = jsParser.extractCallSitesAST(t, file);
        expect(sites).toHaveLength(1);
        expect(sites[0].callerName).toBe('process');
        expect(sites[0].calleeName).toBe('transform');
    });

    it('includes line numbers', async () => {
        const content = [
            'function main() {',
            '    foo();',
            '    bar();',
            '}',
        ].join('\n');
        const t = await jsTree(content);
        const file = makeFileInfo({ id: 'test.js', content, language: 'javascript', extension: '.js' });
        const sites = jsParser.extractCallSitesAST(t, file);
        const fooCall = sites.find(s => s.calleeName === 'foo');
        const barCall = sites.find(s => s.calleeName === 'bar');
        expect(fooCall?.line).toBe(2);
        expect(barCall?.line).toBe(3);
    });
});

describe('TreeSitterTSParser.extractCallSitesAST', () => {
    it('inherits call site extraction from JS parser', async () => {
        const content = [
            'function handler(): void {',
            '    validate();',
            '    transform();',
            '}',
        ].join('\n');
        const t = await tsTree(content);
        const file = makeFileInfo({ id: 'test.ts', content, language: 'typescript', extension: '.ts' });
        const sites = tsParser.extractCallSitesAST(t, file);
        expect(sites).toHaveLength(2);
        expect(sites.every(s => s.callerName === 'handler')).toBe(true);
    });
});
