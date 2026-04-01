/**
 * ts-java-parser.ts — Tree-sitter based Java parser.
 *
 * Handles: import_declaration, package_declaration, class_declaration,
 * interface_declaration, method_declaration, extends/implements, and calls.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation, FileSymbols, SymbolInfo } from '../types';
import type Parser from 'web-tree-sitter';

const JAVA_BUILTINS = new Set([
    'System', 'String', 'Integer', 'Long', 'Double', 'Float', 'Boolean',
    'Object', 'Class', 'Math', 'Arrays', 'Collections', 'List', 'Map', 'Set',
    'HashMap', 'ArrayList', 'HashSet', 'LinkedList', 'TreeMap', 'TreeSet',
    'Optional', 'Stream', 'Collectors', 'Iterator', 'Iterable',
    'Exception', 'RuntimeException', 'IOException', 'NullPointerException',
    'Thread', 'Runnable', 'Comparable', 'Serializable', 'Cloneable',
    'StringBuilder', 'StringBuffer', 'Throwable', 'Error',
    'println', 'printf', 'print', 'format',
    'toString', 'equals', 'hashCode', 'clone', 'getClass', 'notify', 'wait',
    'valueOf', 'parseInt', 'parseDouble', 'parseLong', 'parseFloat',
    'length', 'size', 'get', 'put', 'add', 'remove', 'contains', 'isEmpty',
    'toArray', 'iterator', 'stream', 'forEach', 'map', 'filter', 'reduce',
    'collect', 'of', 'asList', 'sort', 'reverse', 'min', 'max',
    'close', 'read', 'write', 'flush', 'append',
]);

const JAVA_KEYWORDS = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'return',
    'break', 'continue', 'throw', 'try', 'catch', 'finally',
    'new', 'instanceof', 'this', 'super', 'void', 'null', 'true', 'false',
    'public', 'private', 'protected', 'static', 'final', 'abstract',
    'synchronized', 'volatile', 'transient', 'native', 'strictfp',
    'class', 'interface', 'enum', 'extends', 'implements', 'import', 'package',
    'default', 'assert', 'var',
]);

export class TreeSitterJavaParser extends BaseParser {
    constructor() {
        super('java');
    }

    override get usesTreeSitter(): boolean {
        return true;
    }

    // ── Imports ────────────────────────────────────────────────

    override parseAST(tree: Parser.Tree, fileInfo: FileInfo, _options: Record<string, unknown> = {}): Relation[] {
        const relations: Relation[] = [];
        const root = tree.rootNode;

        for (let i = 0; i < root.childCount; i++) {
            const node = root.child(i)!;
            if (node.type !== 'import_declaration') { continue; }

            // import java.util.List; → scoped_identifier text
            const pathNode = this.findChild(node, 'scoped_identifier');
            if (!pathNode) { continue; }

            const target = pathNode.text;
            const isStatic = this.hasDirectChild(node, 'static');
            relations.push({
                source: fileInfo.id,
                target,
                type: isStatic ? 'static-import' : 'import',
                label: isStatic ? `import static ${target}` : `import ${target}`,
            });
        }

        return relations;
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

    private walkForSymbols(node: Parser.SyntaxNode, symbols: FileSymbols, insideClass: boolean): void {
        switch (node.type) {
            case 'class_declaration':
                this.extractClass(node, symbols);
                return;

            case 'interface_declaration':
                this.extractInterface(node, symbols);
                return;

            case 'enum_declaration':
                this.extractEnum(node, symbols);
                return;

            case 'method_declaration':
                if (insideClass) {
                    this.extractMethod(node, symbols);
                }
                return;
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkForSymbols(node.child(i)!, symbols, insideClass);
        }
    }

    private extractClass(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text;
        if (!name) { return; }

        const line = node.startPosition.row + 1;
        const mods = this.getModifiers(node);
        const classSym: SymbolInfo & { extends?: string; implements?: string[] } = {
            name, type: 'class', line,
        };
        if (mods.visibility) { classSym.visibility = mods.visibility; }
        if (mods.isStatic) { classSym.isStatic = true; }

        // Heritage
        const superclass = this.findChild(node, 'superclass');
        if (superclass) {
            const superName = this.findChild(superclass, 'type_identifier');
            if (superName) { classSym.extends = superName.text; }
        }

        const superInterfaces = this.findChild(node, 'super_interfaces');
        if (superInterfaces) {
            classSym.implements = this.extractTypeList(superInterfaces);
        }

        symbols.classes.push(classSym);

        // Walk class body for methods
        const body = node.childForFieldName('body');
        if (body) {
            for (let i = 0; i < body.childCount; i++) {
                this.walkForSymbols(body.child(i)!, symbols, true);
            }
        }
    }

    private extractInterface(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text;
        if (!name) { return; }

        const line = node.startPosition.row + 1;
        symbols.interfaces.push({ name, type: 'interface', line });

        // Interface methods
        const body = this.findChild(node, 'interface_body');
        if (body) {
            for (let i = 0; i < body.childCount; i++) {
                const child = body.child(i)!;
                if (child.type === 'method_declaration') {
                    this.extractMethod(child, symbols);
                }
            }
        }
    }

    private extractEnum(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text;
        if (!name) { return; }

        const line = node.startPosition.row + 1;
        symbols.enums.push({ name, type: 'enum', line });
    }

    private extractMethod(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text;
        if (!name) { return; }

        const mods = this.getModifiers(node);
        const sym: SymbolInfo = { name, type: 'method' };
        if (mods.visibility) { sym.visibility = mods.visibility; }
        if (mods.isStatic) { sym.isStatic = true; }
        if (mods.isAsync) { sym.isAsync = true; }
        symbols.methods.push(sym);
    }

    // ── Heritage relations ─────────────────────────────────────

    extractHeritageRelations(tree: Parser.Tree, fileInfo: FileInfo): Relation[] {
        const relations: Relation[] = [];
        this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
        return relations;
    }

    private walkForHeritage(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        if (node.type === 'class_declaration') {
            const className = node.childForFieldName('name')?.text;
            if (className) {
                const superclass = this.findChild(node, 'superclass');
                if (superclass) {
                    const name = this.findChild(superclass, 'type_identifier')?.text;
                    if (name) {
                        relations.push({
                            source: sourceId, target: name, type: 'extends',
                            label: `${className} extends ${name}`,
                        });
                    }
                }
                const superIfaces = this.findChild(node, 'super_interfaces');
                if (superIfaces) {
                    for (const iface of this.extractTypeList(superIfaces)) {
                        relations.push({
                            source: sourceId, target: iface, type: 'implements',
                            label: `${className} implements ${iface}`,
                        });
                    }
                }
            }
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkForHeritage(node.child(i)!, sourceId, relations);
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
        if (node.type === 'method_declaration') {
            const name = node.childForFieldName('name')?.text;
            if (name) { defined.add(name); }
        }
        for (let i = 0; i < node.childCount; i++) {
            this.collectDefinedFunctions(node.child(i)!, defined);
        }
    }

    private collectCalls(node: Parser.SyntaxNode, calls: Set<string>, definedHere: Set<string>): void {
        if (node.type === 'method_invocation') {
            // Only standalone calls (no object receiver)
            const obj = node.childForFieldName('object');
            if (!obj) {
                const name = node.childForFieldName('name')?.text;
                if (name && !JAVA_BUILTINS.has(name) && !JAVA_KEYWORDS.has(name)
                    && !definedHere.has(name)) {
                    calls.add(name);
                }
            }
        }
        for (let i = 0; i < node.childCount; i++) {
            this.collectCalls(node.child(i)!, calls, definedHere);
        }
    }

    // ── Utilities ──────────────────────────────────────────────

    private getModifiers(node: Parser.SyntaxNode): {
        visibility?: 'public' | 'private' | 'protected';
        isStatic?: boolean;
        isAsync?: boolean;
    } {
        const mods = this.findChild(node, 'modifiers');
        if (!mods) { return {}; }
        const text = mods.text;
        const result: ReturnType<typeof this.getModifiers> = {};
        if (text.includes('public')) { result.visibility = 'public'; }
        else if (text.includes('private')) { result.visibility = 'private'; }
        else if (text.includes('protected')) { result.visibility = 'protected'; }
        if (text.includes('static')) { result.isStatic = true; }
        if (text.includes('synchronized')) { result.isAsync = false; }
        return result;
    }

    private extractTypeList(node: Parser.SyntaxNode): string[] {
        const types: string[] = [];
        const typeList = this.findChild(node, 'type_list');
        const target = typeList || node;
        for (let i = 0; i < target.childCount; i++) {
            const child = target.child(i)!;
            if (child.type === 'type_identifier') {
                types.push(child.text);
            }
        }
        return types;
    }

    private hasDirectChild(node: Parser.SyntaxNode, typeOrText: string): boolean {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)!;
            if (child.type === typeOrText || child.text === typeOrText) { return true; }
        }
        return false;
    }

    private findChild(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
        for (let i = 0; i < node.childCount; i++) {
            if (node.child(i)!.type === type) { return node.child(i)!; }
        }
        return null;
    }
}
