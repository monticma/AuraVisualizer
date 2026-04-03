/**
 * ts-c-parser.ts — Tree-sitter based C/H parser.
 *
 * Replaces regex-based CParser with AST-based extraction.
 * Handles: #include, function definitions, extern declarations,
 * structs, typedef structs, enums, macros, and cross-file function calls.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation, FileSymbols, SymbolInfo, CallSite } from '../types';
import type Parser from 'web-tree-sitter';

const C_BUILTINS = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'return',
    'break', 'continue', 'goto', 'sizeof', 'typeof', 'typedef',
    'struct', 'union', 'enum', 'static', 'extern', 'inline', 'const',
    'volatile', 'register', 'auto', 'void', 'int', 'char', 'float',
    'double', 'long', 'short', 'unsigned', 'signed', 'bool', 'BOOL',
    'printf', 'fprintf', 'sprintf', 'snprintf', 'scanf', 'sscanf',
    'malloc', 'calloc', 'realloc', 'free', 'memcpy', 'memset', 'memmove',
    'strlen', 'strcpy', 'strncpy', 'strcmp', 'strncmp', 'strcat',
    'fopen', 'fclose', 'fread', 'fwrite', 'fseek', 'ftell',
    'exit', 'abort', 'assert', 'NULL', 'true', 'false',
    'defined', 'offsetof', 'va_start', 'va_end', 'va_arg',
    '__attribute__', '__declspec', 'visibility', '__extension__'
]);

export class TreeSitterCParser extends BaseParser {
    constructor() {
        super('c');
    }

    override get usesTreeSitter(): boolean {
        return true;
    }

    // ── AST-based parse: extract #include relations ────────────

    override parseAST(tree: Parser.Tree, fileInfo: FileInfo, options: Record<string, unknown> = {}): Relation[] {
        const relations: Relation[] = [];
        this.walkForIncludes(tree.rootNode, fileInfo.id, relations, !!options.includeSystemHeaders);
        return relations;
    }

    private walkForIncludes(node: Parser.SyntaxNode, sourceId: string, relations: Relation[], includeSystem: boolean): void {
        if (node.type === 'preproc_include') {
            const pathNode = node.childForFieldName('path');
            if (pathNode) {
                const raw = pathNode.text;

                if (pathNode.type === 'string_literal') {
                    // #include "file.h"
                    const target = raw.slice(1, -1); // remove quotes
                    relations.push({
                        source: sourceId,
                        target,
                        type: 'include',
                        label: `#include "${target}"`,
                    });
                } else if (pathNode.type === 'system_lib_string' && includeSystem) {
                    // #include <stdio.h>
                    const target = raw.slice(1, -1); // remove angle brackets
                    relations.push({
                        source: sourceId,
                        target,
                        type: 'system-include',
                        label: `#include <${target}>`,
                    });
                }
            }
            return; // no need to recurse inside preproc_include
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkForIncludes(node.child(i)!, sourceId, relations, includeSystem);
        }

        return relations;
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

    private walkForSymbols(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        switch (node.type) {
            case 'function_definition':
                this.extractFunction(node, symbols);
                return; // don't recurse into function bodies for top-level symbols

            case 'declaration':
                this.extractDeclaration(node, symbols);
                return;

            case 'type_definition':
                this.extractTypedef(node, symbols);
                return;

            case 'preproc_def':
                this.extractMacro(node, symbols, false);
                return;

            case 'preproc_function_def':
                this.extractMacro(node, symbols, true);
                return;

            case 'struct_specifier':
                // Extract named structs, but not those inside typedefs (handled by extractTypedef)
                if (node.parent?.type !== 'type_definition' && node.childForFieldName('body')) {
                    this.extractStruct(node, symbols, 'struct');
                }
                break;

            case 'enum_specifier':
                // Top-level standalone enum (not inside a typedef)
                if (node.parent?.type !== 'type_definition' && node.childForFieldName('body')) {
                    this.extractEnum(node, symbols);
                }
                break;
        }

        // Recurse into children
        for (let i = 0; i < node.childCount; i++) {
            this.walkForSymbols(node.child(i)!, symbols);
        }
    }

    private extractFunction(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const declarator = this.findDescendant(node, 'function_declarator');
        if (!declarator) { return; }

        const nameNode = declarator.childForFieldName('declarator');
        const name = nameNode?.text;
        if (!name || C_BUILTINS.has(name)) { return; }

        // Return type: everything before the declarator
        const returnType = this.getReturnType(node, declarator);
        const params = this.getParams(declarator);
        const line = node.startPosition.row + 1;

        symbols.functions.push({ name, returnType, params, line, type: 'function' });
    }

    private extractDeclaration(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        // Check for extern function declarations
        const text = node.text;
        if (text.startsWith('extern')) {
            const declarator = this.findDescendant(node, 'function_declarator');
            if (declarator) {
                const nameNode = declarator.childForFieldName('declarator');
                const name = nameNode?.text;
                if (name) {
                    symbols.externs.push({ name, type: 'extern' });
                    return;
                }
            }
        }

        // Structs and enums inside declarations are handled by their own
        // 'struct_specifier' / 'enum_specifier' cases in walkForSymbols,
        // so we don't need to re-extract them here.
    }

    private extractTypedef(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        // typedef struct { ... } Name;
        const structSpec = this.findDescendant(node, 'struct_specifier');
        if (structSpec) {
            // The typedef name is the last identifier child of type_definition
            const typeId = this.findChild(node, 'type_identifier');
            if (typeId) {
                symbols.structs.push({ name: typeId.text, type: 'typedef-struct' });
            } else {
                // Named struct inside typedef: typedef struct X { } X;
                this.extractStruct(structSpec, symbols, 'struct');
            }
            return;
        }

        // typedef enum { ... } Name;
        const enumSpec = this.findDescendant(node, 'enum_specifier');
        if (enumSpec) {
            const typeId = this.findChild(node, 'type_identifier');
            if (typeId) {
                symbols.enums.push({ name: typeId.text, type: 'enum' });
            } else {
                this.extractEnum(enumSpec, symbols);
            }
        }
    }

    private extractStruct(node: Parser.SyntaxNode, symbols: FileSymbols, kind: string): void {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
            symbols.structs.push({ name: nameNode.text, type: kind });
        }
    }

    private extractEnum(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
            symbols.enums.push({ name: nameNode.text, type: 'enum' });
        }
    }

    private extractMacro(node: Parser.SyntaxNode, symbols: FileSymbols, isFunctionLike: boolean): void {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
            symbols.macros.push({
                name: nameNode.text,
                type: isFunctionLike ? 'function-macro' : 'constant-macro',
            });
        }
    }

    // ── AST-based call extraction ──────────────────────────────

    override extractCallsAST(tree: Parser.Tree, _fileInfo: FileInfo, globalFunctions: Set<string>): Relation[] {
        const definedHere = new Set<string>();
        const calls = new Set<string>();

        // Collect function definitions in this file
        this.collectDefinedFunctions(tree.rootNode, definedHere);

        // Walk for call_expression nodes
        this.collectCalls(tree.rootNode, calls, definedHere);

        // Build relations only for calls that match globalFunctions
        const relations: Relation[] = [];
        for (const name of calls) {
            if (globalFunctions.has(name)) {
                relations.push({
                    source: _fileInfo.id,
                    target: name,
                    type: 'function-call',
                    label: `${name}()`,
                });
            }
        }
        return relations;
    }

    /** Get raw list of external calls (for backward compat with extractCalls). */
    extractCallsFromAST(tree: Parser.Tree): string[] {
        const definedHere = new Set<string>();
        const calls = new Set<string>();
        this.collectDefinedFunctions(tree.rootNode, definedHere);
        this.collectCalls(tree.rootNode, calls, definedHere);
        return [...calls];
    }

    private collectDefinedFunctions(node: Parser.SyntaxNode, defined: Set<string>): void {
        if (node.type === 'function_definition') {
            const declarator = this.findDescendant(node, 'function_declarator');
            const nameNode = declarator?.childForFieldName('declarator');
            if (nameNode) {
                defined.add(nameNode.text);
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
                if (!C_BUILTINS.has(name) && !/^[A-Z_]+$/.test(name) && !definedHere.has(name)) {
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
        // Track function scope
        if (node.type === 'function_definition') {
            const declarator = this.findDescendant(node, 'function_declarator');
            const nameNode = declarator?.childForFieldName('declarator');
            const name = nameNode?.text || currentFunc;
            for (let i = 0; i < node.childCount; i++) {
                this.collectCallSites(node.child(i)!, sites, definedHere, name);
            }
            return;
        }

        // Detect calls
        if (node.type === 'call_expression') {
            const funcNode = node.childForFieldName('function');
            if (funcNode?.type === 'identifier') {
                const name = funcNode.text;
                if (!C_BUILTINS.has(name) && !/^[A-Z_]+$/.test(name)) {
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

    private getReturnType(funcDef: Parser.SyntaxNode, declarator: Parser.SyntaxNode): string {
        const typeNode = funcDef.childForFieldName('type');
        if (typeNode) {
            // Check for pointer declarator wrapping
            const directDecl = funcDef.childForFieldName('declarator');
            if (directDecl?.type === 'pointer_declarator') {
                return typeNode.text + '*';
            }
            return typeNode.text;
        }
        // Fallback: text before the declarator
        const before = funcDef.text.substring(0, declarator.startIndex - funcDef.startIndex).trim();
        return before || 'int';
    }

    private getParams(declarator: Parser.SyntaxNode): string {
        const paramList = declarator.childForFieldName('parameters');
        if (!paramList) { return ''; }
        // Remove outer parens
        const text = paramList.text;
        return text.startsWith('(') ? text.slice(1, -1).trim() : text.trim();
    }

    private findDescendant(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
        if (node.type === type) { return node; }
        for (let i = 0; i < node.childCount; i++) {
            const result = this.findDescendant(node.child(i)!, type);
            if (result) { return result; }
        }
        return null;
    }

    private findChild(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)!;
            if (child.type === type) { return child; }
        }
        return null;
    }
}
