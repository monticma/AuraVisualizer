/**
 * ts-kotlin-parser.ts — Tree-sitter based Kotlin parser.
 *
 * Handles: import_header, function_declaration, class_declaration,
 * object_declaration, and call_expression.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation, FileSymbols, SymbolInfo, CallSite } from '../types';
import type Parser from 'web-tree-sitter';

const KOTLIN_BUILTINS = new Set([
    'println', 'print', 'readLine', 'require', 'requireNotNull',
    'check', 'checkNotNull', 'error', 'TODO', 'run', 'let', 'apply',
    'also', 'with', 'use', 'lazy', 'arrayOf', 'listOf', 'mutableListOf',
    'setOf', 'mutableSetOf', 'mapOf', 'mutableMapOf', 'emptyList',
    'emptySet', 'emptyMap', 'arrayOfNulls', 'intArrayOf', 'longArrayOf',
    'doubleArrayOf', 'floatArrayOf', 'booleanArrayOf', 'byteArrayOf',
    'shortArrayOf', 'charArrayOf', 'String', 'Int', 'Long', 'Double',
    'Float', 'Boolean', 'Char', 'Byte', 'Short', 'Any', 'Unit', 'Nothing',
    'List', 'Set', 'Map', 'Array', 'IntArray', 'LongArray',
    'maxOf', 'minOf', 'compareValues', 'hashCode', 'toString',
]);

const KOTLIN_KEYWORDS = new Set([
    'as', 'break', 'class', 'continue', 'do', 'else', 'false', 'for',
    'fun', 'if', 'in', 'interface', 'is', 'null', 'object', 'package',
    'return', 'super', 'this', 'throw', 'true', 'try', 'typealias',
    'val', 'var', 'when', 'while', 'by', 'catch', 'constructor',
    'delegate', 'dynamic', 'field', 'file', 'finally', 'get',
    'import', 'init', 'param', 'property', 'receiver', 'set',
    'setparam', 'where', 'private', 'public', 'protected', 'internal',
    'open', 'final', 'abstract', 'sealed', 'data', 'enum', 'inner',
    'override', 'lateinit', 'companion', 'inline', 'noinline',
    'crossinline', 'reified', 'tailrec', 'operator', 'infix',
    'external', 'suspend',
]);

export class TreeSitterKotlinParser extends BaseParser {
    constructor() {
        super('kotlin');
    }

    override get usesTreeSitter(): boolean {
        return true;
    }

    // ── Imports ────────────────────────────────────────────────

    override parseAST(tree: Parser.Tree, fileInfo: FileInfo, _options: Record<string, unknown> = {}): Relation[] {
        const relations: Relation[] = [];
        this.walkImports(tree.rootNode, fileInfo.id, relations);
        return relations;
    }

    private walkImports(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        if (node.type === 'import_header' || node.type === 'import_directive') {
            const id = this.findFirstByType(node, 'identifier');
            if (id) {
                const target = id.text;
                if (target) {
                    relations.push({
                        source: sourceId, target, type: 'import',
                        label: `import ${target}`,
                    });
                }
            }
            return;
        }
        // Imports live near the top — limit depth
        if (node.type === 'source_file' || node.type === 'file_annotation' || node.type === 'package_header') {
            for (let i = 0; i < node.childCount; i++) {
                this.walkImports(node.child(i)!, sourceId, relations);
            }
            return;
        }
        // Recurse only at top of file
        for (let i = 0; i < Math.min(node.childCount, 50); i++) {
            const c = node.child(i)!;
            if (c.type === 'import_list' || c.type === 'import_header' || c.type === 'import_directive') {
                this.walkImports(c, sourceId, relations);
            }
        }
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
            case 'function_declaration': {
                const name = this.getDeclName(node);
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
            case 'class_declaration': {
                const name = this.getDeclName(node);
                if (name) {
                    symbols.classes.push({ name, type: 'class', line: node.startPosition.row + 1 });
                }
                // Recurse into class body so methods are tagged
                for (let i = 0; i < node.childCount; i++) {
                    this.walkSymbols(node.child(i)!, symbols, true);
                }
                return;
            }
            case 'object_declaration': {
                const name = this.getDeclName(node);
                if (name) {
                    symbols.classes.push({ name, type: 'object', line: node.startPosition.row + 1 });
                }
                for (let i = 0; i < node.childCount; i++) {
                    this.walkSymbols(node.child(i)!, symbols, true);
                }
                return;
            }
            case 'interface_declaration': {
                const name = this.getDeclName(node);
                if (name) {
                    symbols.interfaces.push({ name, type: 'interface', line: node.startPosition.row + 1 });
                }
                for (let i = 0; i < node.childCount; i++) {
                    this.walkSymbols(node.child(i)!, symbols, true);
                }
                return;
            }
            case 'type_alias': {
                const name = this.getDeclName(node);
                if (name) {
                    symbols.typeAliases.push({ name, type: 'type-alias', line: node.startPosition.row + 1 });
                }
                return;
            }
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkSymbols(node.child(i)!, symbols, insideClass);
        }
    }

    private getDeclName(node: Parser.SyntaxNode): string | null {
        const named = node.childForFieldName('name');
        if (named && named.text) return named.text;
        // Fallback: first simple_identifier or type_identifier child
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
            // First child is usually a simple_identifier or navigation_expression
            const first = node.child(0);
            if (first && (first.type === 'simple_identifier' || first.type === 'identifier')) {
                const name = first.text;
                if (name && !KOTLIN_BUILTINS.has(name) && !KOTLIN_KEYWORDS.has(name)
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
            if (first && (first.type === 'simple_identifier' || first.type === 'identifier')) {
                const name = first.text;
                if (name && !KOTLIN_BUILTINS.has(name) && !KOTLIN_KEYWORDS.has(name)
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

    private findFirstByType(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
        if (node.type === type) return node;
        for (let i = 0; i < node.childCount; i++) {
            const found = this.findFirstByType(node.child(i)!, type);
            if (found) return found;
        }
        return null;
    }
}
