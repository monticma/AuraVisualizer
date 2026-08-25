/**
 * ts-ts-parser.ts — Tree-sitter based TypeScript parser.
 *
 * Extends TreeSitterJSParser with TypeScript-specific extractions:
 * interface_declaration, type_alias_declaration, class heritage
 * (extends/implements), visibility modifiers, and import type.
 */

import { TreeSitterJSParser } from './ts-js-parser';
import type { FileInfo, Relation, FileSymbols, SymbolInfo } from '../types';
import type Parser from 'web-tree-sitter';

export class TreeSitterTSParser extends TreeSitterJSParser {
    constructor() {
        super();
        this.language = 'typescript';
    }

    // ── Override symbol extraction to add TS-specific nodes ────

    override extractSymbolsAST(tree: Parser.Tree, fileInfo: FileInfo): FileSymbols {
        const symbols = super.extractSymbolsAST(tree, fileInfo);
        // Second pass for TS-specific nodes (interfaces, type aliases, heritage)
        this.walkForTSSymbols(tree.rootNode, symbols);
        return symbols;
    }

    private walkForTSSymbols(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        switch (node.type) {
            case 'interface_declaration':
                this.extractInterface(node, symbols);
                return;

            case 'type_alias_declaration':
                this.extractTypeAlias(node, symbols);
                return;

            case 'export_statement':
                // Handle TS-specific exports like `export type { ... }` or `export interface`
                this.extractTSExport(node, symbols);
                return;
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkForTSSymbols(node.child(i)!, symbols);
        }
    }

    private extractInterface(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text;
        if (!name) { return; }

        const line = node.startPosition.row + 1;
        symbols.interfaces.push({ name, type: 'interface', line });
    }

    private extractTypeAlias(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text;
        if (!name) { return; }

        const line = node.startPosition.row + 1;
        symbols.typeAliases.push({ name, type: 'type-alias', line });
    }

    private extractTSExport(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        // export type { Foo, Bar } — type keyword present
        const isTypeExport = this.hasDirectChild(node, 'type');

        // Handle exported interfaces: export interface Foo { ... }
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)!;
            if (child.type === 'interface_declaration') {
                const name = child.childForFieldName('name')?.text;
                if (name) {
                    symbols.exports.push({ name, type: 'export-interface', line: child.startPosition.row + 1 });
                    this.extractInterface(child, symbols);
                }
                return;
            }
            if (child.type === 'type_alias_declaration') {
                const name = child.childForFieldName('name')?.text;
                if (name) {
                    symbols.exports.push({ name, type: 'export-type-alias', line: child.startPosition.row + 1 });
                    this.extractTypeAlias(child, symbols);
                }
                return;
            }
        }

        // export type { Foo, Bar } — tag as type exports
        if (isTypeExport) {
            const exportClause = this.findChild(node, 'export_clause');
            if (exportClause) {
                for (let i = 0; i < exportClause.childCount; i++) {
                    const spec = exportClause.child(i)!;
                    if (spec.type === 'export_specifier') {
                        const nameNode = spec.childForFieldName('name');
                        if (nameNode) {
                            symbols.exports.push({ name: nameNode.text, type: 'export-type', line: nameNode.startPosition.row + 1 });
                        }
                    }
                }
            }
        }
    }

    // ── Class heritage: extends/implements ─────────────────────

    override extractClass(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        super.extractClass(node, symbols);

        // Extract extends/implements from class_heritage
        const heritage = this.findChild(node, 'class_heritage');
        if (!heritage) { return; }

        const nameNode = node.childForFieldName('name');
        const className = nameNode?.text;
        if (!className) { return; }

        // Heritage can contain "extends BaseClass" and/or "implements IFoo, IBar"
        // In TS AST: class_heritage contains extends_clause and/or implements_clause
        // But in tree-sitter-typescript, heritage is simpler: children are keywords + type identifiers
        const text = heritage.text;
        const extendsMatch = text.match(/extends\s+(\w+)/);
        if (extendsMatch) {
            // Store on the class symbol so graph-builder can create edges
            const classSym = symbols.classes.find(c => c.name === className);
            if (classSym) {
                (classSym as SymbolInfo & { extends?: string }).extends = extendsMatch[1];
            }
        }

        const implementsMatch = text.match(/implements\s+(.+)/);
        if (implementsMatch) {
            const interfaces = implementsMatch[1].split(',').map(s => s.trim().split(/\s/)[0]);
            const classSym = symbols.classes.find(c => c.name === className);
            if (classSym) {
                (classSym as SymbolInfo & { implements?: string[] }).implements = interfaces;
            }
        }
    }

    // ── Override methods to capture visibility/static/async ────

    override extractMethods(classBody: Parser.SyntaxNode, symbols: FileSymbols): void {
        for (let i = 0; i < classBody.childCount; i++) {
            const member = classBody.child(i)!;
            if (member.type !== 'method_definition') { continue; }

            const nameNode = member.childForFieldName('name');
            const name = nameNode?.text;
            if (!name || name === 'constructor') { continue; }

            const isAsync = this.hasDirectChild(member, 'async');
            const isStatic = this.hasDirectChild(member, 'static');
            const visibility = this.getVisibility(member);
            const isOverride = this.hasDirectChild(member, 'override');

            const sym: SymbolInfo = { name, type: 'method' };
            if (isAsync) { sym.isAsync = true; }
            if (isStatic) { sym.isStatic = true; }
            if (visibility) { sym.visibility = visibility; }
            if (isOverride) { (sym as SymbolInfo & { isOverride?: boolean }).isOverride = true; }
            symbols.methods.push(sym);
        }
    }

    /** Extract heritage relations (extends/implements) as Relation edges. */
    extractHeritageRelations(tree: Parser.Tree, fileInfo: FileInfo): Relation[] {
        const relations: Relation[] = [];
        this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
        return relations;
    }

    private walkForHeritage(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        if (node.type === 'class_declaration') {
            const nameNode = node.childForFieldName('name');
            const className = nameNode?.text;
            const heritage = this.findChild(node, 'class_heritage');

            if (className && heritage) {
                const text = heritage.text;
                const extendsMatch = text.match(/extends\s+(\w+)/);
                if (extendsMatch) {
                    relations.push({
                        source: sourceId,
                        target: extendsMatch[1],
                        type: 'extends',
                        label: `${className} extends ${extendsMatch[1]}`,
                    });
                }

                const implementsMatch = text.match(/implements\s+(.+)/);
                if (implementsMatch) {
                    const raw = implementsMatch[1].replace(/\{[\s\S]*$/, ''); // strip class body
                    const interfaces = raw.split(',').map(s => s.trim().split(/\s/)[0]).filter(Boolean);
                    for (const iface of interfaces) {
                        relations.push({
                            source: sourceId,
                            target: iface,
                            type: 'implements',
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

    private getVisibility(node: Parser.SyntaxNode): 'public' | 'private' | 'protected' | undefined {
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)!;
            if (child.type === 'accessibility_modifier') {
                const text = child.text as 'public' | 'private' | 'protected';
                return text;
            }
        }
        return undefined;
    }
}
