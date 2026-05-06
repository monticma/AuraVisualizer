/**
 * ts-ruby-parser.ts — Tree-sitter based Ruby parser.
 *
 * Handles: require/require_relative/load calls, method/singleton_method,
 * class/module declarations, and call expressions.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation, FileSymbols, SymbolInfo, CallSite } from '../types';
import type Parser from 'web-tree-sitter';

const RUBY_BUILTINS = new Set([
    'puts', 'print', 'p', 'pp', 'gets', 'readline', 'sprintf', 'format',
    'require', 'require_relative', 'load', 'autoload', 'include', 'extend',
    'attr_accessor', 'attr_reader', 'attr_writer', 'private', 'public',
    'protected', 'module_function', 'lambda', 'proc', 'raise', 'fail',
    'catch', 'throw', 'loop', 'sleep', 'exit', 'abort', 'caller',
    'block_given?', 'yield', 'binding',
    'String', 'Integer', 'Float', 'Array', 'Hash', 'Symbol', 'Range',
    'Object', 'Class', 'Module', 'NilClass', 'TrueClass', 'FalseClass',
    'Numeric', 'Comparable', 'Enumerable', 'Kernel', 'BasicObject',
    'new', 'inspect', 'to_s', 'to_a', 'to_h', 'to_i', 'to_f', 'to_sym',
    'is_a?', 'kind_of?', 'instance_of?', 'respond_to?', 'send', '__send__',
    'dup', 'clone', 'freeze', 'frozen?', 'tap', 'then', 'yield_self',
    'each', 'map', 'collect', 'select', 'filter', 'reject', 'reduce', 'inject',
    'find', 'detect', 'any?', 'all?', 'none?', 'one?', 'count', 'size',
    'length', 'empty?', 'first', 'last', 'min', 'max', 'sort', 'sort_by',
    'group_by', 'zip', 'flatten', 'compact', 'uniq', 'reverse', 'include?',
    'push', 'pop', 'shift', 'unshift', 'concat', 'join', 'split', 'gsub',
    'sub', 'match', 'scan', 'strip', 'chomp', 'chop', 'upcase', 'downcase',
    'capitalize', 'reverse', 'replace', 'slice',
]);

const RUBY_KEYWORDS = new Set([
    'BEGIN', 'END', 'alias', 'and', 'begin', 'break', 'case', 'class',
    'def', 'defined?', 'do', 'else', 'elsif', 'end', 'ensure', 'false',
    'for', 'if', 'in', 'module', 'next', 'nil', 'not', 'or', 'redo',
    'rescue', 'retry', 'return', 'self', 'super', 'then', 'true',
    'undef', 'unless', 'until', 'when', 'while', 'yield', '__FILE__',
    '__LINE__', '__ENCODING__',
]);

export class TreeSitterRubyParser extends BaseParser {
    constructor() {
        super('ruby');
    }

    override get usesTreeSitter(): boolean {
        return true;
    }

    // ── Imports (require / require_relative / load) ────────────

    override parseAST(tree: Parser.Tree, fileInfo: FileInfo, _options: Record<string, unknown> = {}): Relation[] {
        const relations: Relation[] = [];
        this.walkRequires(tree.rootNode, fileInfo.id, relations);
        return relations;
    }

    private walkRequires(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        // require 'x' is parsed as a call: identifier('require') + argument_list(string('x'))
        if (node.type === 'call' || node.type === 'method_call') {
            const method = node.childForFieldName('method') || node.child(0);
            const methodText = method?.text;
            if (methodText === 'require' || methodText === 'require_relative' || methodText === 'load' || methodText === 'autoload') {
                const args = node.childForFieldName('arguments') || this.findChild(node, 'argument_list');
                if (args) {
                    const str = this.findStringInArgs(args);
                    if (str) {
                        relations.push({
                            source: sourceId, target: str, type: 'import',
                            label: `${methodText} '${str}'`,
                        });
                    }
                }
            }
        }
        for (let i = 0; i < node.childCount; i++) {
            this.walkRequires(node.child(i)!, sourceId, relations);
        }
    }

    private findStringInArgs(args: Parser.SyntaxNode): string | null {
        for (let i = 0; i < args.childCount; i++) {
            const c = args.child(i)!;
            if (c.type === 'string') {
                // Inside string node: string_content
                const content = this.findChild(c, 'string_content');
                if (content) return content.text;
                // fallback strip quotes
                const t = c.text;
                if (t.length >= 2) return t.slice(1, -1);
            } else if (c.type === 'string_array' || c.type === 'simple_symbol') {
                // skip
            }
        }
        return null;
    }

    // ── Symbols ────────────────────────────────────────────────

    override extractSymbolsAST(tree: Parser.Tree, _fileInfo: FileInfo): FileSymbols {
        const symbols: FileSymbols = {
            functions: [], externs: [], structs: [], enums: [],
            macros: [], classes: [], exports: [],
            interfaces: [], traits: [], typeAliases: [], methods: [],
        };
        this.walkSymbols(tree.rootNode, symbols, false);
        return symbols;
    }

    private walkSymbols(node: Parser.SyntaxNode, symbols: FileSymbols, insideClass: boolean): void {
        switch (node.type) {
            case 'method': {
                const name = this.getMethodName(node);
                if (name) {
                    const sym: SymbolInfo = {
                        name, type: insideClass ? 'method' : 'function',
                        line: node.startPosition.row + 1,
                    };
                    if (insideClass) symbols.methods.push(sym);
                    else symbols.functions.push(sym);
                }
                return;
            }
            case 'singleton_method': {
                const name = this.getMethodName(node);
                if (name) {
                    symbols.methods.push({
                        name, type: 'singleton-method',
                        line: node.startPosition.row + 1,
                    });
                }
                return;
            }
            case 'class': {
                const name = this.getClassName(node);
                if (name) {
                    symbols.classes.push({
                        name, type: 'class', line: node.startPosition.row + 1,
                    });
                }
                for (let i = 0; i < node.childCount; i++) {
                    this.walkSymbols(node.child(i)!, symbols, true);
                }
                return;
            }
            case 'module': {
                const name = this.getClassName(node);
                if (name) {
                    symbols.classes.push({
                        name, type: 'module', line: node.startPosition.row + 1,
                    });
                }
                for (let i = 0; i < node.childCount; i++) {
                    this.walkSymbols(node.child(i)!, symbols, true);
                }
                return;
            }
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkSymbols(node.child(i)!, symbols, insideClass);
        }
    }

    private getMethodName(node: Parser.SyntaxNode): string | null {
        const named = node.childForFieldName('name');
        if (named && named.text) return named.text;
        for (let i = 0; i < node.childCount; i++) {
            const c = node.child(i)!;
            if (c.type === 'identifier' || c.type === 'constant' || c.type === 'operator') {
                return c.text;
            }
        }
        return null;
    }

    private getClassName(node: Parser.SyntaxNode): string | null {
        const named = node.childForFieldName('name');
        if (named && named.text) return named.text;
        for (let i = 0; i < node.childCount; i++) {
            const c = node.child(i)!;
            if (c.type === 'constant' || c.type === 'scope_resolution') {
                return c.text;
            }
        }
        return null;
    }

    // ── Calls ──────────────────────────────────────────────────

    override extractCallsAST(tree: Parser.Tree, fileInfo: FileInfo, globalFunctions: Set<string>): Relation[] {
        const definedHere = new Set<string>();
        const calls = new Set<string>();
        this.collectDefinedMethods(tree.rootNode, definedHere);
        this.collectCalls(tree.rootNode, calls, definedHere);

        const relations: Relation[] = [];
        for (const name of calls) {
            if (globalFunctions.has(name)) {
                relations.push({
                    source: fileInfo.id, target: name, type: 'function-call',
                    label: `${name}`,
                });
            }
        }
        return relations;
    }

    private collectDefinedMethods(node: Parser.SyntaxNode, defined: Set<string>): void {
        if (node.type === 'method' || node.type === 'singleton_method') {
            const name = this.getMethodName(node);
            if (name) defined.add(name);
        }
        for (let i = 0; i < node.childCount; i++) {
            this.collectDefinedMethods(node.child(i)!, defined);
        }
    }

    private collectCalls(node: Parser.SyntaxNode, calls: Set<string>, definedHere: Set<string>): void {
        // Bare identifier call: just `foo` at expression position is a method call in Ruby
        // but tree-sitter-ruby uses `identifier` and `call` nodes
        if (node.type === 'call' || node.type === 'method_call') {
            const method = node.childForFieldName('method');
            if (method && (method.type === 'identifier' || method.type === 'constant')) {
                const name = method.text;
                if (name && !RUBY_BUILTINS.has(name) && !RUBY_KEYWORDS.has(name) && !definedHere.has(name)) {
                    calls.add(name);
                }
            }
        }
        for (let i = 0; i < node.childCount; i++) {
            this.collectCalls(node.child(i)!, calls, definedHere);
        }
    }

    // ── Call sites (function-level) ────────────────────────────

    override extractCallSitesAST(tree: Parser.Tree, _fileInfo: FileInfo): CallSite[] {
        const definedHere = new Set<string>();
        this.collectDefinedMethods(tree.rootNode, definedHere);
        const sites: CallSite[] = [];
        this.collectCallSites(tree.rootNode, sites, definedHere, '<module>');
        return sites;
    }

    private collectCallSites(node: Parser.SyntaxNode, sites: CallSite[], definedHere: Set<string>, currentFunc: string): void {
        if (node.type === 'method' || node.type === 'singleton_method') {
            const name = this.getMethodName(node) || currentFunc;
            for (let i = 0; i < node.childCount; i++) {
                this.collectCallSites(node.child(i)!, sites, definedHere, name);
            }
            return;
        }

        if (node.type === 'call' || node.type === 'method_call') {
            const method = node.childForFieldName('method');
            if (method && (method.type === 'identifier' || method.type === 'constant')) {
                const name = method.text;
                if (name && !RUBY_BUILTINS.has(name) && !RUBY_KEYWORDS.has(name)) {
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

    private findChild(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
        for (let i = 0; i < node.childCount; i++) {
            if (node.child(i)!.type === type) return node.child(i)!;
        }
        return null;
    }
}
