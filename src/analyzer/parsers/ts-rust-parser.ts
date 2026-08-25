/**
 * ts-rust-parser.ts — Tree-sitter based Rust parser.
 *
 * Handles: use_declaration, mod_item, function_item, struct_item,
 * trait_item, impl_item, and call_expression.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation, FileSymbols, SymbolInfo, CallSite } from '../types';
import type Parser from 'web-tree-sitter';

const RUST_BUILTINS = new Set([
    'println', 'print', 'eprintln', 'eprint', 'format', 'write', 'writeln',
    'panic', 'todo', 'unimplemented', 'unreachable', 'assert', 'assert_eq',
    'assert_ne', 'debug_assert', 'debug_assert_eq', 'debug_assert_ne',
    'vec', 'cfg', 'include', 'include_str', 'include_bytes',
    'env', 'option_env', 'concat', 'stringify', 'line', 'column', 'file',
    'Box', 'Vec', 'String', 'Option', 'Result', 'Some', 'None', 'Ok', 'Err',
    'HashMap', 'HashSet', 'BTreeMap', 'BTreeSet', 'VecDeque', 'LinkedList',
    'Rc', 'Arc', 'Mutex', 'RwLock', 'Cell', 'RefCell',
    'Into', 'From', 'TryInto', 'TryFrom', 'AsRef', 'AsMut',
    'Default', 'Clone', 'Copy', 'Debug', 'Display', 'PartialEq', 'Eq',
    'PartialOrd', 'Ord', 'Hash', 'Iterator', 'IntoIterator',
    'Send', 'Sync', 'Sized', 'Unpin', 'Drop',
    'drop', 'swap', 'replace', 'take',
    'unwrap', 'expect', 'map', 'and_then', 'or_else', 'unwrap_or',
    'is_some', 'is_none', 'is_ok', 'is_err',
    'iter', 'into_iter', 'collect', 'filter', 'fold', 'for_each',
    'push', 'pop', 'len', 'is_empty', 'contains', 'get', 'insert', 'remove',
    'clone', 'to_string', 'to_owned', 'as_str', 'as_ref', 'as_mut',
]);

const RUST_KEYWORDS = new Set([
    'as', 'async', 'await', 'break', 'const', 'continue', 'crate',
    'dyn', 'else', 'enum', 'extern', 'fn', 'for', 'if', 'impl',
    'in', 'let', 'loop', 'match', 'mod', 'move', 'mut', 'pub',
    'ref', 'return', 'self', 'Self', 'static', 'struct', 'super',
    'trait', 'type', 'unsafe', 'use', 'where', 'while', 'yield',
    'true', 'false',
]);

export class TreeSitterRustParser extends BaseParser {
    constructor() {
        super('rust');
    }

    override get usesTreeSitter(): boolean {
        return true;
    }

    // ── Imports (use/mod) ──────────────────────────────────────

    override parseAST(tree: Parser.Tree, fileInfo: FileInfo, _options: Record<string, unknown> = {}): Relation[] {
        const relations: Relation[] = [];
        const root = tree.rootNode;

        for (let i = 0; i < root.childCount; i++) {
            const node = root.child(i)!;

            if (node.type === 'use_declaration') {
                this.extractUse(node, fileInfo.id, relations);
            } else if (node.type === 'mod_item') {
                this.extractMod(node, fileInfo.id, relations);
            }
        }

        return relations;
    }

    private extractUse(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        // use std::collections::HashMap;
        // use std::io::{self, Read};
        for (let i = 0; i < node.childCount; i++) {
            const child = node.child(i)!;
            if (child.type === 'scoped_identifier' || child.type === 'identifier'
                || child.type === 'scoped_use_list' || child.type === 'use_wildcard') {
                const target = child.text;
                relations.push({
                    source: sourceId, target, type: 'use',
                    label: `use ${target}`,
                });
                return;
            }
        }
    }

    private extractMod(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        // mod config; (external mod, no body)
        const nameNode = node.childForFieldName('name');
        if (!nameNode) { return; }

        // If there's a body { ... }, it's an inline module — skip import relation
        if (this.findChild(node, 'declaration_list')) { return; }

        const target = nameNode.text;
        relations.push({
            source: sourceId, target, type: 'mod',
            label: `mod ${target}`,
        });
    }

    // ── Symbols ────────────────────────────────────────────────

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
            case 'function_item':
                this.extractFunction(node, symbols);
                return;

            case 'struct_item':
                this.extractStruct(node, symbols);
                return;

            case 'enum_item':
                this.extractEnum(node, symbols);
                return;

            case 'trait_item':
                this.extractTrait(node, symbols);
                return;

            case 'impl_item':
                this.extractImpl(node, symbols);
                return;

            case 'type_item':
                this.extractTypeAlias(node, symbols);
                return;
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkForSymbols(node.child(i)!, symbols);
        }
    }

    private extractFunction(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text;
        if (!name || RUST_KEYWORDS.has(name)) { return; }

        const line = node.startPosition.row + 1;
        const isPub = this.hasDirectChild(node, 'visibility_modifier');
        const isAsync = this.hasChildType(node, 'function_modifiers');

        const sym: SymbolInfo = { name, type: 'function', line };
        if (isAsync) { sym.isAsync = true; }
        if (isPub) { sym.visibility = 'public'; }
        symbols.functions.push(sym);

        if (isPub) {
            symbols.exports.push({ name, type: 'export-function', line });
        }
    }

    private extractStruct(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text;
        if (!name) { return; }

        const line = node.startPosition.row + 1;
        const isPub = this.hasDirectChild(node, 'visibility_modifier');
        symbols.structs.push({ name, type: 'struct', line });

        if (isPub) {
            symbols.exports.push({ name, type: 'export-struct', line });
        }
    }

    private extractEnum(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text;
        if (!name) { return; }

        const line = node.startPosition.row + 1;
        const isPub = this.hasDirectChild(node, 'visibility_modifier');
        symbols.enums.push({ name, type: 'enum', line });

        if (isPub) {
            symbols.exports.push({ name, type: 'export-enum', line });
        }
    }

    private extractTrait(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text;
        if (!name) { return; }

        const line = node.startPosition.row + 1;
        const isPub = this.hasDirectChild(node, 'visibility_modifier');
        symbols.traits.push({ name, type: 'trait', line });

        if (isPub) {
            symbols.exports.push({ name, type: 'export-trait', line });
        }
    }

    private extractImpl(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        // impl Trait for Type { ... }  or  impl Type { ... }
        const body = this.findChild(node, 'declaration_list');
        if (!body) { return; }

        // Get the type being implemented
        const typeIds = this.findAllChildren(node, 'type_identifier');

        // Determine if this is a trait impl (has "for" keyword)
        const hasTrait = this.hasDirectChild(node, 'for');

        // Get struct name (last type_identifier before body, or after "for")
        let structName: string | undefined;
        let traitName: string | undefined;

        if (hasTrait && typeIds.length >= 2) {
            traitName = typeIds[0].text;
            structName = typeIds[1].text;
        } else if (typeIds.length >= 1) {
            structName = typeIds[0].text;
        }

        // Extract methods inside impl block
        for (let i = 0; i < body.childCount; i++) {
            const child = body.child(i)!;
            if (child.type === 'function_item') {
                const nameNode = child.childForFieldName('name');
                const name = nameNode?.text;
                if (!name) { continue; }

                const isPub = this.hasDirectChild(child, 'visibility_modifier');
                const isAsync = this.hasChildType(child, 'function_modifiers');
                const sym: SymbolInfo & { receiver?: string } = { name, type: 'method' };
                if (isPub) { sym.visibility = 'public'; }
                if (isAsync) { sym.isAsync = true; }
                if (structName) { sym.receiver = structName; }
                symbols.methods.push(sym);
            }
        }
    }

    private extractTypeAlias(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const nameNode = node.childForFieldName('name');
        const name = nameNode?.text;
        if (!name) { return; }

        const line = node.startPosition.row + 1;
        symbols.typeAliases.push({ name, type: 'type-alias', line });
    }

    // ── Heritage (impl Trait for Struct) ───────────────────────

    extractHeritageRelations(tree: Parser.Tree, fileInfo: FileInfo): Relation[] {
        const relations: Relation[] = [];
        this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
        return relations;
    }

    private walkForHeritage(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        if (node.type === 'impl_item') {
            const hasTrait = this.hasDirectChild(node, 'for');
            if (hasTrait) {
                const typeIds = this.findAllChildren(node, 'type_identifier');
                if (typeIds.length >= 2) {
                    const traitName = typeIds[0].text;
                    const structName = typeIds[1].text;
                    relations.push({
                        source: sourceId, target: traitName, type: 'implements',
                        label: `${structName} implements ${traitName}`,
                    });
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
        if (node.type === 'function_item') {
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
            // Only standalone calls (identifier), not Type::method or obj.method
            if (funcNode?.type === 'identifier') {
                const name = funcNode.text;
                if (!RUST_BUILTINS.has(name) && !RUST_KEYWORDS.has(name)
                    && !definedHere.has(name) && !/^[A-Z_]+$/.test(name)) {
                    calls.add(name);
                }
            }
        }
        // Also check macro_invocation for macro calls
        if (node.type === 'macro_invocation') {
            const macroNode = node.child(0);
            if (macroNode?.type === 'identifier') {
                const name = macroNode.text;
                if (!RUST_BUILTINS.has(name) && !RUST_KEYWORDS.has(name)) {
                    // macro calls are generally not cross-file function calls, skip
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
        if (node.type === 'function_item') {
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
                if (!RUST_BUILTINS.has(name) && !RUST_KEYWORDS.has(name) && !/^[A-Z_]+$/.test(name)) {
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

    private hasDirectChild(node: Parser.SyntaxNode, type: string): boolean {
        for (let i = 0; i < node.childCount; i++) {
            if (node.child(i)!.type === type) { return true; }
        }
        return false;
    }

    private hasChildType(node: Parser.SyntaxNode, type: string): boolean {
        for (let i = 0; i < node.childCount; i++) {
            if (node.child(i)!.type === type) { return true; }
        }
        return false;
    }

    private findChild(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
        for (let i = 0; i < node.childCount; i++) {
            if (node.child(i)!.type === type) { return node.child(i)!; }
        }
        return null;
    }

    private findAllChildren(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
        const results: Parser.SyntaxNode[] = [];
        for (let i = 0; i < node.childCount; i++) {
            if (node.child(i)!.type === type) { results.push(node.child(i)!); }
        }
        return results;
    }
}
