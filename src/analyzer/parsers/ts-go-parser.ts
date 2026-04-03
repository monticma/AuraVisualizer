/**
 * ts-go-parser.ts — Tree-sitter based Go parser.
 *
 * Handles: import_declaration, function_declaration, method_declaration
 * (with receivers), type_declaration (struct, interface), and calls.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation, FileSymbols, SymbolInfo, CallSite } from '../types';
import type Parser from 'web-tree-sitter';

const GO_BUILTINS = new Set([
    'append', 'cap', 'close', 'complex', 'copy', 'delete',
    'imag', 'len', 'make', 'new', 'panic', 'print', 'println',
    'real', 'recover',
    'error', 'string', 'bool', 'byte', 'rune',
    'int', 'int8', 'int16', 'int32', 'int64',
    'uint', 'uint8', 'uint16', 'uint32', 'uint64', 'uintptr',
    'float32', 'float64', 'complex64', 'complex128',
    'nil', 'true', 'false', 'iota',
]);

const GO_KEYWORDS = new Set([
    'break', 'case', 'chan', 'const', 'continue', 'default', 'defer',
    'else', 'fallthrough', 'for', 'func', 'go', 'goto', 'if',
    'import', 'interface', 'map', 'package', 'range', 'return',
    'select', 'struct', 'switch', 'type', 'var',
]);

export class TreeSitterGoParser extends BaseParser {
    constructor() {
        super('go');
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

            // Single import: import "fmt"
            const singleSpec = this.findChild(node, 'import_spec');
            if (singleSpec) {
                const target = this.extractImportPath(singleSpec);
                if (target) {
                    relations.push({
                        source: fileInfo.id, target, type: 'import',
                        label: `import "${target}"`,
                    });
                }
            }

            // Grouped: import ( "fmt" \n "os" )
            const specList = this.findChild(node, 'import_spec_list');
            if (specList) {
                for (let j = 0; j < specList.childCount; j++) {
                    const spec = specList.child(j)!;
                    if (spec.type === 'import_spec') {
                        const target = this.extractImportPath(spec);
                        if (target) {
                            relations.push({
                                source: fileInfo.id, target, type: 'import',
                                label: `import "${target}"`,
                            });
                        }
                    }
                }
            }
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

        const root = tree.rootNode;
        for (let i = 0; i < root.childCount; i++) {
            const node = root.child(i)!;
            switch (node.type) {
                case 'function_declaration':
                    this.extractFunction(node, symbols);
                    break;

                case 'method_declaration':
                    this.extractMethod(node, symbols);
                    break;

                case 'type_declaration':
                    this.extractTypeDecl(node, symbols);
                    break;
            }
        }

        return symbols;
    }

    private extractFunction(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text;
        if (!name || GO_KEYWORDS.has(name)) { return; }

        const line = node.startPosition.row + 1;
        const isExported = /^[A-Z]/.test(name);
        const sym: SymbolInfo = { name, type: 'function', line };
        symbols.functions.push(sym);

        if (isExported) {
            symbols.exports.push({ name, type: 'export-function' });
        }
    }

    private extractMethod(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        // func (r *Receiver) MethodName() ...
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text;
        if (!name) { return; }

        // Get receiver type
        const receiverList = node.child(1); // first parameter_list is receiver
        let receiverType: string | undefined;
        if (receiverList?.type === 'parameter_list') {
            // Extract type from (r *Type) or (r Type)
            const text = receiverList.text;
            const match = text.match(/\*?(\w+)\s*\)/);
            if (match) { receiverType = match[1]; }
        }

        const isExported = /^[A-Z]/.test(name);
        const sym: SymbolInfo & { receiver?: string } = { name, type: 'method' };
        if (receiverType) { sym.receiver = receiverType; }
        symbols.methods.push(sym);

        if (isExported) {
            symbols.exports.push({ name, type: 'export-method' });
        }
    }

    private extractTypeDecl(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const typeSpec = this.findChild(node, 'type_spec');
        if (!typeSpec) { return; }

        const nameNode = typeSpec.child(0); // type_identifier
        const defNode = typeSpec.child(1); // struct_type, interface_type, etc.
        if (!nameNode || !defNode) { return; }

        const name = nameNode.text;
        const line = node.startPosition.row + 1;
        const isExported = /^[A-Z]/.test(name);

        if (defNode.type === 'struct_type') {
            symbols.structs.push({ name, type: 'struct', line });
            if (isExported) {
                symbols.exports.push({ name, type: 'export-struct' });
            }
        } else if (defNode.type === 'interface_type') {
            symbols.interfaces.push({ name, type: 'interface', line });
            if (isExported) {
                symbols.exports.push({ name, type: 'export-interface' });
            }
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
        if (node.type === 'function_declaration') {
            const name = node.childForFieldName('name')?.text;
            if (name) { defined.add(name); }
        }
        for (let i = 0; i < node.childCount; i++) {
            this.collectDefinedFunctions(node.child(i)!, defined);
        }
    }

    private collectCalls(node: Parser.SyntaxNode, calls: Set<string>, definedHere: Set<string>): void {
        if (node.type === 'call_expression') {
            const funcNode = node.childForFieldName('function');
            // Only standalone calls (identifier), not pkg.Func (selector_expression)
            if (funcNode?.type === 'identifier') {
                const name = funcNode.text;
                if (!GO_BUILTINS.has(name) && !GO_KEYWORDS.has(name)
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
        // Track function/method scope
        if (node.type === 'function_declaration') {
            const name = node.childForFieldName('name')?.text || currentFunc;
            for (let i = 0; i < node.childCount; i++) {
                this.collectCallSites(node.child(i)!, sites, definedHere, name);
            }
            return;
        }
        if (node.type === 'method_declaration') {
            const name = node.childForFieldName('name')?.text || currentFunc;
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
                if (!GO_BUILTINS.has(name) && !GO_KEYWORDS.has(name)) {
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

    private extractImportPath(spec: Parser.SyntaxNode): string | null {
        // import_spec → [name] interpreted_string_literal
        for (let i = 0; i < spec.childCount; i++) {
            const child = spec.child(i)!;
            if (child.type === 'interpreted_string_literal') {
                return child.text.slice(1, -1); // strip quotes
            }
        }
        return null;
    }

    private findChild(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
        for (let i = 0; i < node.childCount; i++) {
            if (node.child(i)!.type === type) { return node.child(i)!; }
        }
        return null;
    }
}
