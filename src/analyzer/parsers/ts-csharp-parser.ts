/**
 * ts-csharp-parser.ts — Tree-sitter based C# parser.
 *
 * Handles: using_directive, class / interface / struct / enum / record
 * declarations, method declarations, base_list heritage, and standalone
 * invocation calls.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation, FileSymbols, SymbolInfo, CallSite } from '../types';
import type Parser from 'web-tree-sitter';

const CSHARP_BUILTINS = new Set([
    'Console', 'WriteLine', 'Write', 'ReadLine', 'ReadAllText', 'ReadAllLines', 'WriteAllText',
    'String', 'Int32', 'Int64', 'Double', 'Boolean', 'Object', 'Math', 'Array', 'List',
    'Dictionary', 'HashSet', 'Enumerable', 'Linq',
    'Exception', 'ArgumentException', 'InvalidOperationException', 'NotImplementedException',
    'Task', 'Thread', 'StringBuilder', 'Guid', 'DateTime', 'TimeSpan',
    'ToString', 'Equals', 'GetHashCode', 'GetType', 'Add', 'Remove', 'Contains', 'Clear',
    'Count', 'Length', 'TryGetValue', 'TryParse', 'Parse', 'Concat', 'Join', 'Format',
    'NameOf', 'TypeOf',
]);

const CSHARP_KEYWORDS = new Set([
    'if', 'else', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'return',
    'break', 'continue', 'throw', 'try', 'catch', 'finally', 'new', 'is', 'as',
    'this', 'base', 'null', 'true', 'false', 'void', 'var', 'nameof', 'typeof',
    'sizeof', 'default', 'checked', 'unchecked', 'when', 'await', 'yield',
    'public', 'private', 'protected', 'internal', 'static', 'readonly', 'sealed',
    'abstract', 'virtual', 'override', 'partial', 'async', 'class', 'interface',
    'struct', 'enum', 'record', 'namespace', 'using', 'get', 'set', 'value',
    'in', 'out', 'ref', 'params', 'where', 'select', 'from', 'let', 'orderby',
]);

export class TreeSitterCSharpParser extends BaseParser {
    constructor() {
        super('csharp');
    }

    override get usesTreeSitter(): boolean {
        return true;
    }

    // ── Imports (using directives) ─────────────────────────────

    override parseAST(tree: Parser.Tree, fileInfo: FileInfo, _options: Record<string, unknown> = {}): Relation[] {
        const relations: Relation[] = [];
        this.walkUsings(tree.rootNode, fileInfo.id, relations);
        return relations;
    }

    private walkUsings(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        if (node.type === 'using_directive' || node.type === 'global_using_directive') {
            // Plain directive: `using System.Text;` → identifier / qualified_name.
            // Alias directive: `using F = System.IO;` → the qualified_name is the target.
            const qualified = this.findChild(node, 'qualified_name');
            const simple = this.findChild(node, 'identifier');
            const target = qualified?.text || simple?.text;
            if (target) {
                relations.push({
                    source: sourceId,
                    target,
                    type: 'import',
                    label: `using ${target}`,
                });
            }
        }
        for (let i = 0; i < node.childCount; i++) {
            this.walkUsings(node.child(i)!, sourceId, relations);
        }
    }

    // ── Symbols ────────────────────────────────────────────────

    override extractSymbolsAST(tree: Parser.Tree, _fileInfo: FileInfo): FileSymbols {
        const symbols: FileSymbols = {
            functions: [], externs: [], structs: [], enums: [],
            macros: [], classes: [], exports: [],
            interfaces: [], traits: [], typeAliases: [], methods: [],
        };
        this.walkForSymbols(tree.rootNode, symbols, false);
        return symbols;
    }

    private walkForSymbols(node: Parser.SyntaxNode, symbols: FileSymbols, insideType: boolean): void {
        switch (node.type) {
            case 'class_declaration':
            case 'record_declaration':
                this.extractClassLike(node, symbols, 'class');
                return;

            case 'interface_declaration':
                this.extractClassLike(node, symbols, 'interface');
                return;

            case 'struct_declaration':
                this.extractClassLike(node, symbols, 'struct');
                return;

            case 'enum_declaration': {
                const name = node.childForFieldName('name')?.text;
                if (name) {
                    symbols.enums.push({ name, type: 'enum', line: node.startPosition.row + 1 });
                }
                return;
            }

            case 'method_declaration':
            case 'constructor_declaration':
                if (insideType) { this.extractMethod(node, symbols); }
                return;

            case 'local_function_statement':
                // Local functions live inside a method — walk as a function scope
                // for calls, but they are not class members.
                return;
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkForSymbols(node.child(i)!, symbols, insideType);
        }
    }

    private extractClassLike(node: Parser.SyntaxNode, symbols: FileSymbols, kind: 'class' | 'interface' | 'struct'): void {
        const name = node.childForFieldName('name')?.text;
        if (!name) { return; }

        const line = node.startPosition.row + 1;
        const mods = this.getModifiers(node);
        const sym: SymbolInfo & { extends?: string; implements?: string[] } = { name, type: kind, line };
        if (mods.visibility) { sym.visibility = mods.visibility; }
        if (mods.isStatic) { sym.isStatic = true; }

        if (kind === 'interface') { symbols.interfaces.push(sym); }
        else if (kind === 'struct') { symbols.structs.push(sym); }
        else { symbols.classes.push(sym); }

        // Walk the body for methods
        const body = node.childForFieldName('body');
        if (body) {
            for (let i = 0; i < body.childCount; i++) {
                this.walkForSymbols(body.child(i)!, symbols, true);
            }
        }
    }

    private extractMethod(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const name = node.childForFieldName('name')?.text;
        if (!name) { return; }

        const mods = this.getModifiers(node);
        const sym: SymbolInfo = { name, type: 'method', line: node.startPosition.row + 1 };
        if (mods.visibility) { sym.visibility = mods.visibility; }
        if (mods.isStatic) { sym.isStatic = true; }
        if (mods.isAsync) { sym.isAsync = true; }
        symbols.methods.push(sym);
    }

    // ── Heritage relations ─────────────────────────────────────

    override extractHeritageRelations(tree: Parser.Tree, fileInfo: FileInfo): Relation[] {
        const relations: Relation[] = [];
        this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
        return relations;
    }

    private walkForHeritage(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        const typed = node.type === 'class_declaration' || node.type === 'record_declaration'
            || node.type === 'struct_declaration' || node.type === 'interface_declaration';

        if (typed) {
            const typeName = node.childForFieldName('name')?.text;
            const bases = node.childForFieldName('bases');
            if (typeName && bases) {
                const baseNames = this.extractBaseNames(bases);
                // C# has no marker separating base class from interfaces: the first
                // entry is conventionally the base class (interfaces for interface
                // declarations and structs, which can only implement).
                if (node.type === 'interface_declaration' || node.type === 'struct_declaration') {
                    for (const base of baseNames) {
                        relations.push({
                            source: sourceId, target: base, type: 'extends',
                            label: `${typeName} : ${base}`,
                        });
                    }
                } else {
                    baseNames.forEach((base, idx) => {
                        relations.push({
                            source: sourceId, target: base,
                            type: idx === 0 ? 'extends' : 'implements',
                            label: `${typeName} : ${base}`,
                        });
                    });
                }
            }
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkForHeritage(node.child(i)!, sourceId, relations);
        }
    }

    private extractBaseNames(baseList: Parser.SyntaxNode): string[] {
        const names: string[] = [];
        for (let i = 0; i < baseList.childCount; i++) {
            const child = baseList.child(i)!;
            if (child.type === 'identifier' || child.type === 'generic_name' || child.type === 'qualified_name') {
                // Strip generic parameters and namespace qualifiers: keep the plain type name.
                const plain = child.text.replace(/<[^>]*>/g, '').split('.').pop();
                if (plain) { names.push(plain); }
            }
        }
        return names;
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
        if (node.type === 'method_declaration' || node.type === 'constructor_declaration'
            || node.type === 'local_function_statement') {
            const name = node.childForFieldName('name')?.text;
            if (name) { defined.add(name); }
        }
        for (let i = 0; i < node.childCount; i++) {
            this.collectDefinedFunctions(node.child(i)!, defined);
        }
    }

    private collectCalls(node: Parser.SyntaxNode, calls: Set<string>, definedHere: Set<string>): void {
        if (node.type === 'invocation_expression') {
            // Only standalone calls (no object receiver) — `Foo()` but not `a.Foo()`.
            const fn = node.childForFieldName('function');
            if (fn && (fn.type === 'identifier' || fn.type === 'generic_name')) {
                const name = fn.type === 'identifier' ? fn.text : this.findChild(fn, 'identifier')?.text;
                if (name && !CSHARP_BUILTINS.has(name) && !CSHARP_KEYWORDS.has(name)
                    && !definedHere.has(name)) {
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
        if (node.type === 'method_declaration' || node.type === 'constructor_declaration'
            || node.type === 'local_function_statement') {
            const name = node.childForFieldName('name')?.text || currentFunc;
            for (let i = 0; i < node.childCount; i++) {
                this.collectCallSites(node.child(i)!, sites, definedHere, name);
            }
            return;
        }

        if (node.type === 'invocation_expression') {
            const fn = node.childForFieldName('function');
            if (fn && (fn.type === 'identifier' || fn.type === 'generic_name')) {
                const name = fn.type === 'identifier' ? fn.text : this.findChild(fn, 'identifier')?.text;
                if (name && !CSHARP_BUILTINS.has(name) && !CSHARP_KEYWORDS.has(name)) {
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

    private getModifiers(node: Parser.SyntaxNode): {
        visibility?: 'public' | 'private' | 'protected';
        isStatic?: boolean;
        isAsync?: boolean;
    } {
        // C# grammar emits individual `modifier` children (not a wrapper node).
        let text = '';
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)!;
            if (child.type === 'modifier') { text += ' ' + child.text; }
        }
        if (!text) { return {}; }

        const result: ReturnType<typeof this.getModifiers> = {};
        if (text.includes('public')) { result.visibility = 'public'; }
        else if (text.includes('private')) { result.visibility = 'private'; }
        else if (text.includes('protected')) { result.visibility = 'protected'; }
        if (text.includes('static')) { result.isStatic = true; }
        if (text.includes('async')) { result.isAsync = true; }
        return result;
    }

    private findChild(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
        for (let i = 0; i < node.childCount; i++) {
            if (node.child(i)!.type === type) { return node.child(i)!; }
        }
        return null;
    }
}
