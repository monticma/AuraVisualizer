/**
 * ts-swift-parser.ts — Tree-sitter based Swift parser.
 *
 * Handles: import_declaration, function_declaration, class_declaration,
 * struct_declaration, protocol_declaration, enum_declaration, and call_expression.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation, FileSymbols, SymbolInfo, CallSite } from '../types';
import type Parser from 'web-tree-sitter';

const SWIFT_BUILTINS = new Set([
    'print', 'debugPrint', 'dump', 'precondition', 'preconditionFailure',
    'assert', 'assertionFailure', 'fatalError', 'abort', 'exit',
    'String', 'Int', 'Int8', 'Int16', 'Int32', 'Int64',
    'UInt', 'UInt8', 'UInt16', 'UInt32', 'UInt64',
    'Double', 'Float', 'Bool', 'Character', 'Array', 'Dictionary',
    'Set', 'Optional', 'Result', 'Range', 'ClosedRange',
    'Any', 'AnyObject', 'Self', 'Void', 'Never',
    'min', 'max', 'abs', 'sqrt', 'pow', 'sin', 'cos', 'tan',
    'map', 'filter', 'reduce', 'compactMap', 'flatMap', 'sorted',
    'forEach', 'first', 'last', 'count', 'isEmpty', 'contains',
    'append', 'insert', 'remove', 'removeAll', 'removeFirst', 'removeLast',
    'description', 'debugDescription', 'hashValue',
    'lazy', 'mutating', 'nonmutating', 'unowned', 'weak',
]);

const SWIFT_KEYWORDS = new Set([
    'associatedtype', 'class', 'deinit', 'enum', 'extension', 'fileprivate',
    'func', 'import', 'init', 'inout', 'internal', 'let', 'open', 'operator',
    'private', 'protocol', 'public', 'rethrows', 'static', 'struct',
    'subscript', 'typealias', 'var', 'break', 'case', 'continue', 'default',
    'defer', 'do', 'else', 'fallthrough', 'for', 'guard', 'if', 'in',
    'repeat', 'return', 'switch', 'where', 'while', 'as', 'Any', 'catch',
    'false', 'is', 'nil', 'super', 'self', 'Self', 'throw', 'throws',
    'true', 'try', 'async', 'await', 'final', 'override', 'required',
    'convenience', 'lazy', 'optional', 'weak', 'unowned',
]);

export class TreeSitterSwiftParser extends BaseParser {
    constructor() {
        super('swift');
    }

    override get usesTreeSitter(): boolean {
        return true;
    }

    // ── Imports ────────────────────────────────────────────────

    override parseAST(tree: Parser.Tree, fileInfo: FileInfo, _options: Record<string, unknown> = {}): Relation[] {
        const relations: Relation[] = [];
        const root = tree.rootNode;
        // Imports must be top-level
        for (let i = 0; i < root.childCount; i++) {
            const node = root.child(i)!;
            if (node.type === 'import_declaration') {
                const target = this.extractImportTarget(node);
                if (target) {
                    relations.push({
                        source: fileInfo.id, target, type: 'import',
                        label: `import ${target}`,
                    });
                }
            }
        }
        return relations;
    }

    private extractImportTarget(node: Parser.SyntaxNode): string | null {
        // import Foundation / import struct Foundation.URL
        // We want the module name (first identifier-like child after `import`)
        const parts: string[] = [];
        for (let i = 0; i < node.childCount; i++) {
            const c = node.child(i)!;
            if (c.type === 'identifier' || c.type === 'simple_identifier' || c.type === 'type_identifier') {
                parts.push(c.text);
            } else if (c.type === '.') {
                parts.push('.');
            }
        }
        if (parts.length === 0) {
            // Fallback: take whole text minus 'import '
            const t = node.text.replace(/^import\s+/, '').trim();
            return t || null;
        }
        return parts.join('');
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

    private walkSymbols(node: Parser.SyntaxNode, symbols: FileSymbols, insideType: boolean): void {
        switch (node.type) {
            case 'function_declaration':
            case 'init_declaration':
            case 'deinit_declaration': {
                const name = this.getDeclName(node) || (node.type === 'init_declaration' ? 'init' : node.type === 'deinit_declaration' ? 'deinit' : null);
                if (name) {
                    const sym: SymbolInfo = {
                        name, type: insideType ? 'method' : 'function',
                        line: node.startPosition.row + 1,
                    };
                    if (insideType) symbols.methods.push(sym);
                    else symbols.functions.push(sym);
                }
                return;
            }
            case 'class_declaration': {
                const name = this.getDeclName(node);
                if (name) {
                    symbols.classes.push({ name, type: 'class', line: node.startPosition.row + 1 });
                }
                for (let i = 0; i < node.childCount; i++) {
                    this.walkSymbols(node.child(i)!, symbols, true);
                }
                return;
            }
            case 'struct_declaration': {
                const name = this.getDeclName(node);
                if (name) {
                    symbols.structs.push({ name, type: 'struct', line: node.startPosition.row + 1 });
                }
                for (let i = 0; i < node.childCount; i++) {
                    this.walkSymbols(node.child(i)!, symbols, true);
                }
                return;
            }
            case 'protocol_declaration': {
                const name = this.getDeclName(node);
                if (name) {
                    symbols.interfaces.push({ name, type: 'protocol', line: node.startPosition.row + 1 });
                }
                for (let i = 0; i < node.childCount; i++) {
                    this.walkSymbols(node.child(i)!, symbols, true);
                }
                return;
            }
            case 'enum_declaration': {
                const name = this.getDeclName(node);
                if (name) {
                    symbols.enums.push({ name, type: 'enum', line: node.startPosition.row + 1 });
                }
                for (let i = 0; i < node.childCount; i++) {
                    this.walkSymbols(node.child(i)!, symbols, true);
                }
                return;
            }
            case 'extension_declaration': {
                // extension Foo { ... } — recurse with insideType=true
                for (let i = 0; i < node.childCount; i++) {
                    this.walkSymbols(node.child(i)!, symbols, true);
                }
                return;
            }
            case 'typealias_declaration': {
                const name = this.getDeclName(node);
                if (name) {
                    symbols.typeAliases.push({ name, type: 'type-alias', line: node.startPosition.row + 1 });
                }
                return;
            }
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkSymbols(node.child(i)!, symbols, insideType);
        }
    }

    private getDeclName(node: Parser.SyntaxNode): string | null {
        const named = node.childForFieldName('name');
        if (named && named.text) return named.text;
        for (let i = 0; i < node.childCount; i++) {
            const c = node.child(i)!;
            if (c.type === 'simple_identifier' || c.type === 'type_identifier' || c.type === 'identifier') {
                return c.text;
            }
        }
        return null;
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

    private collectDefinedFunctions(node: Parser.SyntaxNode, defined: Set<string>): void {
        if (node.type === 'function_declaration') {
            const name = this.getDeclName(node);
            if (name) defined.add(name);
        }
        for (let i = 0; i < node.childCount; i++) {
            this.collectDefinedFunctions(node.child(i)!, defined);
        }
    }

    private collectCalls(node: Parser.SyntaxNode, calls: Set<string>, definedHere: Set<string>): void {
        if (node.type === 'call_expression') {
            const first = node.child(0);
            if (first && (first.type === 'simple_identifier' || first.type === 'identifier' || first.type === 'type_identifier')) {
                const name = first.text;
                if (name && !SWIFT_BUILTINS.has(name) && !SWIFT_KEYWORDS.has(name)
                    && !definedHere.has(name) && /^[a-zA-Z_]/.test(name)) {
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
        this.collectDefinedFunctions(tree.rootNode, definedHere);
        const sites: CallSite[] = [];
        this.collectCallSites(tree.rootNode, sites, definedHere, '<module>');
        return sites;
    }

    private collectCallSites(node: Parser.SyntaxNode, sites: CallSite[], definedHere: Set<string>, currentFunc: string): void {
        if (node.type === 'function_declaration') {
            const name = this.getDeclName(node) || currentFunc;
            for (let i = 0; i < node.childCount; i++) {
                this.collectCallSites(node.child(i)!, sites, definedHere, name);
            }
            return;
        }

        if (node.type === 'call_expression') {
            const first = node.child(0);
            if (first && (first.type === 'simple_identifier' || first.type === 'identifier' || first.type === 'type_identifier')) {
                const name = first.text;
                if (name && !SWIFT_BUILTINS.has(name) && !SWIFT_KEYWORDS.has(name)
                    && /^[a-zA-Z_]/.test(name)) {
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
}
