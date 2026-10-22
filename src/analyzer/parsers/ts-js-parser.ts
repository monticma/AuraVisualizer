/**
 * ts-js-parser.ts — Tree-sitter based JavaScript parser.
 *
 * Replaces regex-based JSParser with AST-based extraction.
 * Handles: ES imports, require(), dynamic import(), function declarations,
 * arrow functions, classes, methods, exports, and cross-file calls.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation, FileSymbols, SymbolInfo, CallSite } from '../types';
import type Parser from 'web-tree-sitter';

const JS_KEYWORDS = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'return',
    'break', 'continue', 'throw', 'try', 'catch', 'finally',
    'new', 'delete', 'typeof', 'instanceof', 'void', 'in', 'of',
    'this', 'super', 'with', 'yield', 'await', 'debugger',
    'constructor', 'get', 'set', 'static', 'async',
    'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
    'console', 'window', 'document', 'global', 'process',
    'require', 'module', 'exports', 'import', 'export', 'default', 'from'
]);

const JS_BUILTINS = new Set([
    ...JS_KEYWORDS,
    'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'decodeURI',
    'encodeURIComponent', 'decodeURIComponent', 'eval', 'JSON', 'Math',
    'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
    'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError',
    'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Proxy', 'Reflect',
    'Symbol', 'BigInt', 'ArrayBuffer', 'SharedArrayBuffer', 'DataView',
    'Float32Array', 'Float64Array', 'Int8Array', 'Int16Array', 'Int32Array',
    'Uint8Array', 'Uint16Array', 'Uint32Array', 'URL', 'URLSearchParams',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'requestAnimationFrame', 'cancelAnimationFrame', 'fetch',
    'alert', 'confirm', 'prompt',
    'addEventListener', 'removeEventListener', 'dispatchEvent',
    'createElement', 'getElementById', 'querySelector', 'querySelectorAll',
    'log', 'warn', 'error', 'info', 'debug', 'trace', 'dir',
    'push', 'pop', 'shift', 'unshift', 'splice', 'slice', 'concat',
    'map', 'filter', 'reduce', 'forEach', 'find', 'findIndex', 'some', 'every',
    'includes', 'indexOf', 'join', 'sort', 'reverse', 'flat', 'flatMap',
    'keys', 'values', 'entries', 'assign', 'freeze', 'seal',
    'defineProperty', 'getOwnPropertyNames', 'hasOwnProperty',
    'toString', 'valueOf', 'toJSON', 'then', 'catch', 'resolve', 'reject',
    'all', 'allSettled', 'race', 'any', 'stringify', 'parse',
    'replace', 'match', 'search', 'split', 'trim', 'startsWith', 'endsWith',
    'charAt', 'charCodeAt', 'substring', 'repeat', 'padStart', 'padEnd',
    'bind', 'call', 'apply', 'next', 'done', 'emit', 'on', 'once', 'off'
]);

/** Asset paths built with path.join()/joinPath() (webview scripts, styles). */
const ASSET_REF_RE = /^(?:\.{0,2}\/)?(?:[\w.-]+\/)*[\w.-]+\.(?:js|mjs|cjs|css)$/i;
const PATH_JOIN_FN_RE = /(?:^|\.)(?:join|joinPath)$/;

export class TreeSitterJSParser extends BaseParser {
    constructor() {
        super('javascript');
    }

    override get usesTreeSitter(): boolean {
        return true;
    }

    // ── AST-based parse: extract import/require relations ──────

    override parseAST(tree: Parser.Tree, fileInfo: FileInfo, _options: Record<string, unknown> = {}): Relation[] {
        const relations: Relation[] = [];
        this.walkForImports(tree.rootNode, fileInfo.id, relations);
        const seen = new Set(relations.map(r => r.target));
        this.walkForAssetRefs(tree.rootNode, fileInfo.id, relations, seen);
        return relations;
    }

    /**
     * Emit `script` / `stylesheet` relations for asset paths built with
     * path.join() or vscode.Uri.joinPath(). Those files are loaded at runtime
     * (webview scripts, stylesheets) but never imported, so they would
     * otherwise appear isolated in the graph.
     */
    protected walkForAssetRefs(
        node: Parser.SyntaxNode,
        sourceId: string,
        relations: Relation[],
        seen: Set<string>,
    ): void {
        if (node.type === 'string' || node.type === 'template_string') {
            if (this.isJoinPathArgument(node)) {
                const target = this.stripQuotes(node.text);
                if (ASSET_REF_RE.test(target) && !seen.has(target)) {
                    const type = /\.css$/i.test(target) ? 'stylesheet' : 'script';
                    relations.push({ source: sourceId, target, type, label: `${type} '${target}'` });
                    seen.add(target);
                }
            }
            return;
        }
        for (let i = 0; i < node.childCount; i++) {
            this.walkForAssetRefs(node.child(i)!, sourceId, relations, seen);
        }
    }

    /** True when the string node is a direct argument of join()/joinPath(). */
    private isJoinPathArgument(node: Parser.SyntaxNode): boolean {
        const args = node.parent;
        if (!args || args.type !== 'arguments') { return false; }
        const call = args.parent;
        if (!call || call.type !== 'call_expression') { return false; }
        const fn = call.childForFieldName('function');
        return !!fn && PATH_JOIN_FN_RE.test(fn.text);
    }

    protected walkForImports(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        switch (node.type) {
            case 'import_statement':
                this.extractImport(node, sourceId, relations);
                return;

            case 'call_expression': {
                // require('...') or import('...')
                const funcNode = node.childForFieldName('function');
                if (funcNode) {
                    if (funcNode.type === 'identifier' && funcNode.text === 'require') {
                        this.extractCallImport(node, sourceId, relations, 'require');
                    } else if (funcNode.type === 'import') {
                        this.extractCallImport(node, sourceId, relations, 'dynamic-import');
                    }
                }
                break;
            }
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkForImports(node.child(i)!, sourceId, relations);
        }
    }

    private extractImport(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        const source = node.childForFieldName('source');
        if (!source) { return; }
        const target = this.stripQuotes(source.text);
        if (!target) { return; }

        // Check if it's an "import type" (TS — skip for JS parser)
        const isTypeImport = this.hasDirectChild(node, 'type');
        relations.push({
            source: sourceId,
            target,
            type: isTypeImport ? 'import-type' : 'import',
            label: isTypeImport ? `import type from '${target}'` : `import from '${target}'`,
        });
    }

    private extractCallImport(
        node: Parser.SyntaxNode, sourceId: string,
        relations: Relation[], type: string
    ): void {
        const args = node.childForFieldName('arguments');
        if (!args) { return; }
        // First argument should be a string
        const firstArg = args.child(1); // (0 = "(", 1 = first arg)
        if (!firstArg) { return; }

        let target: string;
        if (firstArg.type === 'string' || firstArg.type === 'string_fragment') {
            target = this.stripQuotes(firstArg.text);
        } else if (firstArg.type === 'template_string') {
            // import(`./path/file.js?v=${x}`) → extract static prefix
            const raw = firstArg.text.slice(1, -1); // strip backticks
            target = raw.split('$')[0].split('?')[0];
        } else {
            return;
        }

        if (!target) { return; }
        relations.push({
            source: sourceId,
            target,
            type,
            label: type === 'require' ? `require('${target}')` : `import('${target}')`,
        });
    }

    // ── AST-based symbol extraction ────────────────────────────

    override extractSymbolsAST(tree: Parser.Tree, _fileInfo: FileInfo): FileSymbols {
        const symbols: FileSymbols = {
            functions: [], externs: [], structs: [], enums: [],
            macros: [], classes: [], exports: [],
            interfaces: [], traits: [], typeAliases: [], methods: [],
        };

        this.walkForSymbols(tree.rootNode, symbols);
        return symbols;
    }

    protected walkForSymbols(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        switch (node.type) {
            case 'function_declaration':
            case 'generator_function_declaration':
                this.extractFunctionDecl(node, symbols);
                return;

            case 'lexical_declaration':
            case 'variable_declaration':
                this.extractVariableDecl(node, symbols);
                return;

            case 'class_declaration':
                this.extractClass(node, symbols);
                return;

            case 'export_statement':
                this.extractExport(node, symbols);
                return;
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkForSymbols(node.child(i)!, symbols);
        }
    }

    private extractFunctionDecl(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text;
        if (!name || JS_KEYWORDS.has(name)) { return; }

        const line = node.startPosition.row + 1;
        const isAsync = this.hasDirectChild(node, 'async');
        const isGenerator = node.type === 'generator_function_declaration';
        const sym: SymbolInfo = {
            name,
            type: isGenerator ? 'generator' : 'function',
            line,
        };
        if (isAsync) { sym.isAsync = true; }
        symbols.functions.push(sym);
    }

    private extractVariableDecl(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        // const foo = (...) => ... or const foo = async (...) => ...
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)!;
            if (child.type !== 'variable_declarator') { continue; }

            const nameNode = child.childForFieldName('name');
            const valueNode = child.childForFieldName('value');
            if (!nameNode || !valueNode) { continue; }

            const name = nameNode.text;
            if (JS_KEYWORDS.has(name)) { continue; }

            if (valueNode.type === 'arrow_function') {
                const line = node.startPosition.row + 1;
                const isAsync = this.hasDirectChild(valueNode, 'async');
                const sym: SymbolInfo = { name, type: 'arrow', line };
                if (isAsync) { sym.isAsync = true; }
                // Avoid duplicates with function declarations
                if (!symbols.functions.some(f => f.name === name)) {
                    symbols.functions.push(sym);
                }
            }
        }
    }

    protected extractClass(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text;
        if (!name) { return; }

        const line = node.startPosition.row + 1;
        symbols.classes.push({ name, type: 'class', line });

        // Extract methods from class body
        const body = node.childForFieldName('body');
        if (body) {
            this.extractMethods(body, symbols);
        }
    }

    protected extractMethods(classBody: Parser.SyntaxNode, symbols: FileSymbols): void {
        for (let i = 0; i < classBody.childCount; i++) {
            const member = classBody.child(i)!;
            if (member.type !== 'method_definition') { continue; }

            const nameNode = member.childForFieldName('name');
            const name = nameNode?.text;
            if (!name || name === 'constructor') { continue; }

            const isAsync = this.hasDirectChild(member, 'async');
            const isStatic = this.hasDirectChild(member, 'static');
            const isGetter = this.findChildByText(member, 'get') !== null
                && member.childForFieldName('parameters')?.text === '()';
            const isSetter = this.findChildByText(member, 'set') !== null
                && !isGetter;

            const sym: SymbolInfo = {
                name,
                type: isGetter ? 'getter' : isSetter ? 'setter' : 'method',
            };
            if (isAsync) { sym.isAsync = true; }
            if (isStatic) { sym.isStatic = true; }
            symbols.methods.push(sym);
        }
    }

    protected extractExport(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const isDefault = this.hasDirectChild(node, 'default');

        // Skip "export type { ... }" — handled by TS parser
        const isTypeExport = this.hasDirectChild(node, 'type');

        // export { foo, bar }
        const exportClause = this.findChild(node, 'export_clause');
        if (exportClause) {
            if (isTypeExport) { return; } // TS type re-exports, not plain JS
            for (let i = 0; i < exportClause.childCount; i++) {
                const spec = exportClause.child(i)!;
                if (spec.type === 'export_specifier') {
                    const nameNode = spec.childForFieldName('name');
                    if (nameNode && !JS_KEYWORDS.has(nameNode.text)) {
                        symbols.exports.push({ name: nameNode.text, type: 'export-named', line: nameNode.startPosition.row + 1 });
                    }
                }
            }
            return;
        }

        // export function foo / export class Foo / export const foo
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)!;
            switch (child.type) {
                case 'function_declaration':
                case 'generator_function_declaration': {
                    const name = child.childForFieldName('name')?.text;
                    if (name) {
                        symbols.exports.push({
                            name,
                            line: child.startPosition.row + 1,
                            type: isDefault ? 'export-default' : 'export-function',
                        });
                        // Also add as function
                        this.extractFunctionDecl(child, symbols);
                    }
                    break;
                }
                case 'class_declaration': {
                    const name = child.childForFieldName('name')?.text;
                    if (name) {
                        symbols.exports.push({
                            name,
                            line: child.startPosition.row + 1,
                            type: isDefault ? 'export-default' : 'export-class',
                        });
                        this.extractClass(child, symbols);
                    }
                    break;
                }
                case 'lexical_declaration':
                case 'variable_declaration': {
                    // export const foo = ...
                    for (let j = 0; j < child.childCount; j++) {
                        const decl = child.child(j)!;
                        if (decl.type === 'variable_declarator') {
                            const name = decl.childForFieldName('name')?.text;
                            if (name && !JS_KEYWORDS.has(name)) {
                                symbols.exports.push({
                                    name,
                                    line: decl.startPosition.row + 1,
                                    type: isDefault ? 'export-default' : 'export-variable',
                                });
                            }
                        }
                    }
                    this.extractVariableDecl(child, symbols);
                    break;
                }
            }
        }

        // export default name (plain identifier)
        if (isDefault && symbols.exports.length === 0) {
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i)!;
                if (child.type === 'identifier' && !JS_KEYWORDS.has(child.text)) {
                    symbols.exports.push({ name: child.text, type: 'export-default', line: child.startPosition.row + 1 });
                    break;
                }
            }
        }
    }

    // ── AST-based call extraction ──────────────────────────────

    override extractCallsAST(tree: Parser.Tree, fileInfo: FileInfo, globalFunctions: Set<string>): Relation[] {
        const definedHere = new Set<string>();
        const calls = new Set<string>();

        this.collectDefinedFunctions(tree.rootNode, definedHere);
        this.collectCalls(tree.rootNode, calls, definedHere);

        const relations: Relation[] = [];
        for (const name of calls) {
            if (globalFunctions.has(name)) {
                relations.push({
                    source: fileInfo.id,
                    target: name,
                    type: 'function-call',
                    label: `${name}()`,
                });
            }
        }
        return relations;
    }

    extractCallsFromAST(tree: Parser.Tree): string[] {
        const definedHere = new Set<string>();
        const calls = new Set<string>();
        this.collectDefinedFunctions(tree.rootNode, definedHere);
        this.collectCalls(tree.rootNode, calls, definedHere);
        return [...calls];
    }

    protected collectDefinedFunctions(node: Parser.SyntaxNode, defined: Set<string>): void {
        if (node.type === 'function_declaration' || node.type === 'generator_function_declaration') {
            const name = node.childForFieldName('name')?.text;
            if (name) { defined.add(name); }
        } else if (node.type === 'variable_declarator') {
            const value = node.childForFieldName('value');
            if (value?.type === 'arrow_function') {
                const name = node.childForFieldName('name')?.text;
                if (name) { defined.add(name); }
            }
        }
        for (let i = 0; i < node.childCount; i++) {
            this.collectDefinedFunctions(node.child(i)!, defined);
        }
    }

    private collectCalls(node: Parser.SyntaxNode, calls: Set<string>, definedHere: Set<string>): void {
        if (node.type === 'call_expression') {
            const funcNode = node.childForFieldName('function');
            if (funcNode?.type === 'identifier') {
                const name = funcNode.text;
                if (!JS_BUILTINS.has(name) && !/^[A-Z_]+$/.test(name) && !definedHere.has(name)) {
                    calls.add(name);
                }
            }
            // Skip method calls (member_expression) — same as regex parser
        }
        for (let i = 0; i < node.childCount; i++) {
            this.collectCalls(node.child(i)!, calls, definedHere);
        }
    }

    // ── AST-based call site extraction (function-level) ────────

    override extractCallSitesAST(tree: Parser.Tree, _fileInfo: FileInfo): CallSite[] {
        const definedHere = new Set<string>();
        this.collectDefinedFunctions(tree.rootNode, definedHere);
        const sites: CallSite[] = [];
        this.collectCallSites(tree.rootNode, sites, definedHere, '<module>');
        return sites;
    }

    private collectCallSites(node: Parser.SyntaxNode, sites: CallSite[], definedHere: Set<string>, currentFunc: string): void {
        // Track function scope changes
        if (node.type === 'function_declaration' || node.type === 'generator_function_declaration') {
            const name = node.childForFieldName('name')?.text || currentFunc;
            for (let i = 0; i < node.childCount; i++) {
                this.collectCallSites(node.child(i)!, sites, definedHere, name);
            }
            return;
        }
        if (node.type === 'variable_declarator') {
            const value = node.childForFieldName('value');
            if (value?.type === 'arrow_function') {
                const name = node.childForFieldName('name')?.text || currentFunc;
                for (let i = 0; i < node.childCount; i++) {
                    this.collectCallSites(node.child(i)!, sites, definedHere, name);
                }
                return;
            }
        }
        if (node.type === 'method_definition') {
            const name = node.childForFieldName('name')?.text || currentFunc;
            for (let i = 0; i < node.childCount; i++) {
                this.collectCallSites(node.child(i)!, sites, definedHere, name);
            }
            return;
        }

        // Detect call expressions
        if (node.type === 'call_expression') {
            const funcNode = node.childForFieldName('function');
            if (funcNode?.type === 'identifier') {
                const name = funcNode.text;
                if (!JS_BUILTINS.has(name) && !/^[A-Z_]+$/.test(name)) {
                    sites.push({
                        callerName: currentFunc,
                        calleeName: name,
                        line: node.startPosition.row + 1,
                        isLocal: definedHere.has(name),
                    });
                }
            }
        }

        for (let i = 0; i < node.childCount; i++) {
            this.collectCallSites(node.child(i)!, sites, definedHere, currentFunc);
        }
    }

    // ── AST utilities ──────────────────────────────────────────

    protected stripQuotes(text: string): string {
        if ((text.startsWith("'") && text.endsWith("'"))
            || (text.startsWith('"') && text.endsWith('"'))
            || (text.startsWith('`') && text.endsWith('`'))) {
            return text.slice(1, -1);
        }
        return text;
    }

    protected hasDirectChild(node: Parser.SyntaxNode, typeOrText: string): boolean {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)!;
            if (child.type === typeOrText || child.text === typeOrText) {
                return true;
            }
        }
        return false;
    }

    protected findChild(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)!;
            if (child.type === type) { return child; }
        }
        return null;
    }

    private findChildByText(node: Parser.SyntaxNode, text: string): Parser.SyntaxNode | null {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)!;
            if (child.text === text && child.type !== 'statement_block'
                && child.type !== 'formal_parameters') {
                return child;
            }
        }
        return null;
    }

    protected findDescendant(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
        if (node.type === type) { return node; }
        for (let i = 0; i < node.childCount; i++) {
            const result = this.findDescendant(node.child(i)!, type);
            if (result) { return result; }
        }
        return null;
    }
}
