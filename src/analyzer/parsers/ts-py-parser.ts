/**
 * ts-py-parser.ts — Tree-sitter based Python parser.
 *
 * Replaces regex-based PyParser with AST-based extraction.
 * Handles: import, from…import, function definitions (incl. async & decorated),
 * class definitions with heritage, methods, __all__ exports, decorators, and calls.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation, FileSymbols, SymbolInfo, CallSite } from '../types';
import type Parser from 'web-tree-sitter';

const PY_BUILTINS = new Set([
    'print', 'len', 'range', 'int', 'str', 'float', 'list', 'dict', 'set',
    'tuple', 'bool', 'type', 'isinstance', 'issubclass', 'hasattr', 'getattr',
    'setattr', 'delattr', 'callable', 'super', 'property', 'staticmethod',
    'classmethod', 'abs', 'all', 'any', 'bin', 'chr', 'dir', 'divmod',
    'enumerate', 'eval', 'exec', 'filter', 'format', 'frozenset', 'globals',
    'hash', 'hex', 'id', 'input', 'iter', 'locals', 'map', 'max', 'min',
    'next', 'object', 'oct', 'open', 'ord', 'pow', 'repr', 'reversed',
    'round', 'slice', 'sorted', 'sum', 'vars', 'zip', 'breakpoint',
    'compile', 'complex', 'memoryview', 'bytearray', 'bytes',
    '__import__', '__name__', '__file__', '__doc__',
]);

const PY_KEYWORDS = new Set([
    'def', 'class', 'if', 'elif', 'else', 'for', 'while', 'return',
    'yield', 'lambda', 'not', 'and', 'or', 'assert', 'raise', 'pass',
    'break', 'continue', 'try', 'except', 'finally', 'with', 'as',
    'import', 'from', 'global', 'nonlocal', 'del', 'in', 'is', 'async', 'await',
]);

export class TreeSitterPyParser extends BaseParser {
    constructor() {
        super('python');
    }

    override get usesTreeSitter(): boolean {
        return true;
    }

    // ── AST-based parse: extract import relations ──────────────

    override parseAST(tree: Parser.Tree, fileInfo: FileInfo, _options: Record<string, unknown> = {}): Relation[] {
        const relations: Relation[] = [];
        const root = tree.rootNode;

        for (let i = 0; i < root.childCount; i++) {
            const node = root.child(i)!;
            if (node.type === 'import_statement') {
                this.extractImport(node, fileInfo.id, relations);
            } else if (node.type === 'import_from_statement') {
                this.extractFromImport(node, fileInfo.id, relations);
            }
        }

        return relations;
    }

    private extractImport(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        // import os / import os, sys / import os.path
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)!;
            if (child.type === 'dotted_name' || child.type === 'aliased_import') {
                const name = child.type === 'aliased_import'
                    ? child.childForFieldName('name')?.text ?? child.text
                    : child.text;
                if (name) {
                    relations.push({
                        source: sourceId,
                        target: name,
                        type: 'import',
                        label: `import ${name}`,
                    });
                }
            }
        }
    }

    private extractFromImport(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        // from pathlib import Path  →  module = pathlib
        const moduleNode = node.childForFieldName('module_name');
        // tree-sitter-python uses child node directly: from + dotted_name + import + ...
        let moduleName: string | undefined;
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)!;
            if (child.type === 'dotted_name' || child.type === 'relative_import') {
                moduleName = child.text;
                break;
            }
        }
        if (!moduleName) { return; }

        relations.push({
            source: sourceId,
            target: moduleName,
            type: 'from-import',
            label: `from ${moduleName} import`,
        });
    }

    // ── AST-based symbol extraction ────────────────────────────

    override extractSymbolsAST(tree: Parser.Tree, _fileInfo: FileInfo): FileSymbols {
        const symbols: FileSymbols = {
            functions: [], externs: [], structs: [], enums: [],
            macros: [], classes: [], exports: [],
            interfaces: [], traits: [], typeAliases: [], methods: [],
        };

        this.walkForSymbols(tree.rootNode, symbols, false);
        return symbols;
    }

    private walkForSymbols(node: Parser.SyntaxNode, symbols: FileSymbols, insideClass: boolean): void {
        switch (node.type) {
            case 'function_definition':
                this.extractFunction(node, symbols, insideClass, []);
                return;

            case 'decorated_definition':
                this.extractDecorated(node, symbols, insideClass);
                return;

            case 'class_definition':
                this.extractClass(node, symbols);
                return;

            case 'expression_statement':
                this.extractAllExport(node, symbols);
                return;
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkForSymbols(node.child(i)!, symbols, insideClass);
        }
    }

    private extractFunction(
        node: Parser.SyntaxNode,
        symbols: FileSymbols,
        insideClass: boolean,
        decorators: string[]
    ): void {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text;
        if (!name) { return; }

        const line = node.startPosition.row + 1;
        const isAsync = this.hasDirectChild(node, 'async');
        const isDunder = name.startsWith('__') && name.endsWith('__');
        const isStaticMethod = decorators.includes('staticmethod');
        const isClassMethod = decorators.includes('classmethod');

        if (insideClass) {
            // Skip __init__ and other dunder methods as "methods" — keep them
            const sym: SymbolInfo = {
                name,
                type: isDunder ? 'dunder' : 'method',
                line,
            };
            if (isAsync) { sym.isAsync = true; }
            if (isStaticMethod) { sym.isStatic = true; }
            if (isClassMethod) { (sym as SymbolInfo & { isClassMethod?: boolean }).isClassMethod = true; }
            symbols.methods.push(sym);
        } else {
            const sym: SymbolInfo = {
                name,
                type: isDunder ? 'dunder' : 'function',
                line,
            };
            if (isAsync) { sym.isAsync = true; }
            symbols.functions.push(sym);
        }
    }

    private extractDecorated(node: Parser.SyntaxNode, symbols: FileSymbols, insideClass: boolean): void {
        const decorators: string[] = [];
        let funcDef: Parser.SyntaxNode | null = null;
        let classDef: Parser.SyntaxNode | null = null;

        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)!;
            if (child.type === 'decorator') {
                const decoName = this.getDecoratorName(child);
                if (decoName) {
                    decorators.push(decoName);
                    // Store unique decorators as macros
                    if (!PY_BUILTINS.has(decoName) && !PY_KEYWORDS.has(decoName)) {
                        if (!symbols.macros.some(m => m.name === decoName)) {
                            symbols.macros.push({
                                name: decoName,
                                type: 'decorator',
                                line: child.startPosition.row + 1,
                            });
                        }
                    }
                }
            } else if (child.type === 'function_definition') {
                funcDef = child;
            } else if (child.type === 'class_definition') {
                classDef = child;
            }
        }

        if (funcDef) {
            this.extractFunction(funcDef, symbols, insideClass, decorators);
        }
        if (classDef) {
            this.extractClass(classDef, symbols);
        }
    }

    private extractClass(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text;
        if (!name) { return; }

        const line = node.startPosition.row + 1;
        const classSym: SymbolInfo & { extends?: string; implements?: string[] } = {
            name, type: 'class', line,
        };

        // Heritage: class Foo(Bar, Baz): → argument_list contains identifiers
        const superclasses = this.extractSuperclasses(node);
        if (superclasses.length > 0) {
            classSym.extends = superclasses[0];
            if (superclasses.length > 1) {
                // In Python, multiple inheritance — store all as extends
                // Use first as primary, rest are also extends (no separate "implements" in Python)
                classSym.implements = superclasses.slice(1);
            }
        }
        symbols.classes.push(classSym);

        // Walk class body for methods
        const body = node.childForFieldName('body');
        if (body) {
            this.walkForSymbols(body, symbols, true);
        }
    }

    private extractSuperclasses(classNode: Parser.SyntaxNode): string[] {
        const superclasses: string[] = [];
        const argList = this.findChild(classNode, 'argument_list');
        if (!argList) { return superclasses; }

        for (let i = 0; i < argList.childCount; i++) {
            const child = argList.child(i)!;
            if (child.type === 'identifier' || child.type === 'dotted_name') {
                superclasses.push(child.text);
            }
        }
        return superclasses;
    }

    private extractAllExport(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        // __all__ = ['Foo', 'Bar']
        const assign = this.findChild(node, 'assignment');
        if (!assign) { return; }

        const left = assign.childForFieldName('left');
        if (!left || left.text !== '__all__') { return; }

        const right = assign.childForFieldName('right');
        if (!right || right.type !== 'list') { return; }

        for (let i = 0; i < right.childCount; i++) {
            const child = right.child(i)!;
            if (child.type === 'string') {
                const name = this.stripPyString(child.text);
                if (name) {
                    symbols.exports.push({ name, type: 'export-all', line: child.startPosition.row + 1 });
                }
            }
        }
    }

    // ── Heritage relations as edges ────────────────────────────

    extractHeritageRelations(tree: Parser.Tree, fileInfo: FileInfo): Relation[] {
        const relations: Relation[] = [];
        this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
        return relations;
    }

    private walkForHeritage(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        if (node.type === 'class_definition') {
            const nameNode = node.childForFieldName('name');
            const className = nameNode?.text;
            if (className) {
                const superclasses = this.extractSuperclasses(node);
                for (const base of superclasses) {
                    relations.push({
                        source: sourceId,
                        target: base,
                        type: 'extends',
                        label: `${className} extends ${base}`,
                    });
                }
            }
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkForHeritage(node.child(i)!, sourceId, relations);
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

    private collectDefinedFunctions(node: Parser.SyntaxNode, defined: Set<string>): void {
        if (node.type === 'function_definition') {
            const name = node.childForFieldName('name')?.text;
            if (name) { defined.add(name); }
        } else if (node.type === 'class_definition') {
            const name = node.childForFieldName('name')?.text;
            if (name) { defined.add(name); }
        } else if (node.type === 'decorated_definition') {
            // Find the function_definition or class_definition inside
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i)!;
                if (child.type === 'function_definition' || child.type === 'class_definition') {
                    const name = child.childForFieldName('name')?.text;
                    if (name) { defined.add(name); }
                }
            }
        }
        for (let i = 0; i < node.childCount; i++) {
            this.collectDefinedFunctions(node.child(i)!, defined);
        }
    }

    private collectCalls(node: Parser.SyntaxNode, calls: Set<string>, definedHere: Set<string>): void {
        if (node.type === 'call') {
            const funcNode = node.childForFieldName('function');
            if (funcNode?.type === 'identifier') {
                const name = funcNode.text;
                if (!PY_BUILTINS.has(name) && !PY_KEYWORDS.has(name)
                    && !definedHere.has(name) && !/^[A-Z_]+$/.test(name)) {
                    calls.add(name);
                }
            }
            // Skip method calls (attribute type) — same as regex parser
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
            const name = node.childForFieldName('name')?.text || currentFunc;
            for (let i = 0; i < node.childCount; i++) {
                this.collectCallSites(node.child(i)!, sites, definedHere, name);
            }
            return;
        }
        if (node.type === 'decorated_definition') {
            for (let i = 0; i < node.childCount; i++) {
                const child = node.child(i)!;
                if (child.type === 'function_definition') {
                    const name = child.childForFieldName('name')?.text || currentFunc;
                    this.collectCallSites(child, sites, definedHere, name);
                } else {
                    this.collectCallSites(child, sites, definedHere, currentFunc);
                }
            }
            return;
        }

        // Detect calls
        if (node.type === 'call') {
            const funcNode = node.childForFieldName('function');
            if (funcNode?.type === 'identifier') {
                const name = funcNode.text;
                if (!PY_BUILTINS.has(name) && !PY_KEYWORDS.has(name) && !/^[A-Z_]+$/.test(name)) {
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

    private getDecoratorName(decorator: Parser.SyntaxNode): string | null {
        for (let i = 0; i < decorator.childCount; i++) {
            const child = decorator.child(i)!;
            if (child.type === 'identifier') { return child.text; }
            if (child.type === 'dotted_name') { return child.text; }
            if (child.type === 'call') {
                const func = child.childForFieldName('function');
                return func?.text ?? null;
            }
        }
        return null;
    }

    private stripPyString(text: string): string {
        if ((text.startsWith("'") && text.endsWith("'"))
            || (text.startsWith('"') && text.endsWith('"'))) {
            return text.slice(1, -1);
        }
        return text;
    }

    private hasDirectChild(node: Parser.SyntaxNode, typeOrText: string): boolean {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)!;
            if (child.type === typeOrText || child.text === typeOrText) {
                return true;
            }
        }
        return false;
    }

    private findChild(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)!;
            if (child.type === type) { return child; }
        }
        return null;
    }
}
