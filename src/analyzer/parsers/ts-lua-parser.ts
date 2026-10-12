/**
 * ts-lua-parser.ts — Tree-sitter based Lua parser.
 *
 * Handles: require / dofile imports (with a regex supplement — the bundled Lua
 * grammar mis-parses some no-parentheses forms into ERROR nodes), function
 * definitions, and standalone calls.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation, FileSymbols, SymbolInfo, CallSite } from '../types';
import type Parser from 'web-tree-sitter';

const LUA_BUILTINS = new Set([
    'print', 'pairs', 'ipairs', 'tostring', 'tonumber', 'type', 'next', 'select',
    'setmetatable', 'getmetatable', 'rawget', 'rawset', 'rawequal', 'rawlen',
    'pcall', 'xpcall', 'error', 'assert', 'collectgarbage', 'unpack',
    'require', 'dofile', 'load', 'loadfile',
]);

const LUA_KEYWORDS = new Set([
    'if', 'then', 'else', 'elseif', 'end', 'for', 'while', 'repeat', 'until',
    'do', 'return', 'break', 'goto', 'in', 'local', 'function', 'and', 'or',
    'not', 'nil', 'true', 'false',
]);

/** Matches require / dofile calls with or without parentheses. */
const REQUIRE_RE = /\b(require|dofile)\s*\(?\s*['"]([^'"]+)['"]/g;

export class TreeSitterLuaParser extends BaseParser {
    constructor() {
        super('lua');
    }

    override get usesTreeSitter(): boolean {
        return true;
    }

    // ── Imports (require / dofile) ─────────────────────────────

    override parseAST(tree: Parser.Tree, fileInfo: FileInfo, _options: Record<string, unknown> = {}): Relation[] {
        const relations: Relation[] = [];
        const seen = new Set<string>();

        const push = (target: string): void => {
            if (seen.has(target)) { return; }
            seen.add(target);
            relations.push({
                source: fileInfo.id,
                target,
                type: 'require',
                label: `require('${target}')`,
            });
        };

        // AST pass
        this.walkCalls(tree.rootNode, push);

        // Regex supplement — the grammar turns some no-parens forms into ERROR
        // nodes, losing the string argument.
        const content = fileInfo.content || '';
        let m: RegExpExecArray | null;
        REQUIRE_RE.lastIndex = 0;
        while ((m = REQUIRE_RE.exec(content)) !== null) {
            push(m[2]);
        }

        return relations;
    }

    private walkCalls(node: Parser.SyntaxNode, push: (target: string) => void): void {
        if (node.type === 'call') {
            const fn = node.childForFieldName('function');
            if (fn && fn.type === 'variable') {
                const nameNode = fn.childForFieldName('name');
                const name = nameNode?.text;
                if (name === 'require' || name === 'dofile') {
                    const args = node.childForFieldName('arguments');
                    const str = args ? this.findStringArg(args) : null;
                    if (str) { push(str); }
                }
            }
        }
        for (let i = 0; i < node.childCount; i++) {
            this.walkCalls(node.child(i)!, push);
        }
    }

    private findStringArg(node: Parser.SyntaxNode): string | null {
        if (node.type === 'string') {
            const content = this.findChild(node, 'string_content');
            const raw = content ? content.text : node.text.replace(/^['"]|['"]$/g, '');
            return raw.length > 0 ? raw : null;
        }
        for (let i = 0; i < node.childCount; i++) {
            const found = this.findStringArg(node.child(i)!);
            if (found) { return found; }
        }
        return null;
    }

    // ── Symbols (functions) ────────────────────────────────────

    override extractSymbolsAST(tree: Parser.Tree, _fileInfo: FileInfo): FileSymbols {
        const symbols: FileSymbols = {
            functions: [], externs: [], structs: [], enums: [],
            macros: [], classes: [], exports: [],
            interfaces: [], traits: [], typeAliases: [], methods: [],
        };
        this.walkForFunctions(tree.rootNode, symbols, false);
        return symbols;
    }

    private walkForFunctions(node: Parser.SyntaxNode, symbols: FileSymbols, insideFunc: boolean): void {
        if (node.type === 'function_definition_statement' || node.type === 'local_function_definition_statement') {
            if (!insideFunc) {
                const name = node.childForFieldName('name')?.text;
                if (name) {
                    symbols.functions.push({ name, type: 'function', line: node.startPosition.row + 1 });
                }
            }
            // Still descend: nested functions are separate local definitions,
            // but only the outermost is reported as a file symbol.
            for (let i = 0; i < node.childCount; i++) {
                this.walkForFunctions(node.child(i)!, symbols, true);
            }
            return;
        }
        for (let i = 0; i < node.childCount; i++) {
            this.walkForFunctions(node.child(i)!, symbols, insideFunc);
        }
    }

    // ── Calls ──────────────────────────────────────────────────

    override extractCallsAST(tree: Parser.Tree, fileInfo: FileInfo, globalFunctions: Set<string>): Relation[] {
        const definedHere = new Set<string>();
        const calls = new Set<string>();
        this.collectDefinedFunctions(tree.rootNode, definedHere);
        this.collectCalls(tree.rootNode, calls, definedHere);

        const relations: Relation[] = [];
        for (const name of calls) {
            if (globalFunctions.has(name)) {
                relations.push({
                    source: fileInfo.id, target: name, type: 'function-call',
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

    private collectDefinedFunctions(node: Parser.SyntaxNode, defined: Set<string>): void {
        if (node.type === 'function_definition_statement' || node.type === 'local_function_definition_statement') {
            const name = node.childForFieldName('name')?.text;
            if (name) {
                defined.add(name);
                // `function M.greet()` — also remember the plain field name.
                const short = name.split('.').pop();
                if (short) { defined.add(short); }
            }
        }
        for (let i = 0; i < node.childCount; i++) {
            this.collectDefinedFunctions(node.child(i)!, defined);
        }
    }

    private collectCalls(node: Parser.SyntaxNode, calls: Set<string>, definedHere: Set<string>): void {
        if (node.type === 'call') {
            const fn = node.childForFieldName('function');
            // Standalone calls only: `foo()` (variable) — member calls (`M.foo()`)
            // resolve through the table and cannot be linked by name.
            if (fn && fn.type === 'variable' && !fn.childForFieldName('table')) {
                const name = fn.childForFieldName('name')?.text;
                if (name && !LUA_BUILTINS.has(name) && !LUA_KEYWORDS.has(name) && !definedHere.has(name)) {
                    calls.add(name);
                }
            }
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
        if (node.type === 'function_definition_statement' || node.type === 'local_function_definition_statement') {
            const name = node.childForFieldName('name')?.text || currentFunc;
            for (let i = 0; i < node.childCount; i++) {
                this.collectCallSites(node.child(i)!, sites, definedHere, name);
            }
            return;
        }

        if (node.type === 'call') {
            const fn = node.childForFieldName('function');
            if (fn && fn.type === 'variable' && !fn.childForFieldName('table')) {
                const name = fn.childForFieldName('name')?.text;
                if (name && !LUA_BUILTINS.has(name) && !LUA_KEYWORDS.has(name)) {
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

    // ── Utilities ──────────────────────────────────────────────

    private findChild(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
        for (let i = 0; i < node.childCount; i++) {
            if (node.child(i)!.type === type) { return node.child(i)!; }
        }
        return null;
    }
}
