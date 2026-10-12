/**
 * ts-php-parser.ts — Tree-sitter based PHP parser.
 *
 * Handles: namespace_use_declaration (use), require / include expressions,
 * class / interface / trait declarations, function and method declarations,
 * base_clause / class_interface_clause heritage, and function calls.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation, FileSymbols, SymbolInfo, CallSite } from '../types';
import type Parser from 'web-tree-sitter';

const PHP_BUILTINS = new Set([
    'trim', 'ltrim', 'rtrim', 'strlen', 'str_replace', 'strpos', 'strrpos', 'substr',
    'strtolower', 'strtoupper', 'ucfirst', 'sprintf', 'printf', 'print_r', 'var_dump',
    'count', 'array_map', 'array_filter', 'array_merge', 'array_keys', 'array_values',
    'array_push', 'array_pop', 'in_array', 'array_key_exists', 'implode', 'explode',
    'json_encode', 'json_decode', 'isset', 'empty', 'is_array', 'is_string', 'is_null',
    'is_numeric', 'is_object', 'is_bool', 'is_int', 'htmlspecialchars', 'urlencode',
    'preg_match', 'preg_match_all', 'preg_replace', 'preg_split', 'method_exists',
    'class_exists', 'function_exists', 'file_exists', 'file_get_contents',
    'file_put_contents', 'date', 'time', 'uniqid', 'md5', 'sha1', 'base64_encode',
    'base64_decode', 'round', 'floor', 'ceil', 'abs', 'min', 'max', 'intval', 'floatval',
    'strval', 'nl2br', 'number_format', 'ucwords', 'str_pad', 'str_repeat', 'str_contains',
    'str_starts_with', 'str_ends_with', 'mb_strlen', 'mb_substr',
]);

const PHP_KEYWORDS = new Set([
    'if', 'else', 'elseif', 'endif', 'for', 'foreach', 'while', 'do', 'switch',
    'case', 'default', 'break', 'continue', 'return', 'throw', 'try', 'catch',
    'finally', 'new', 'instanceof', 'clone', 'echo', 'print', 'include',
    'include_once', 'require', 'require_once', 'namespace', 'use', 'class',
    'interface', 'trait', 'enum', 'extends', 'implements', 'public', 'private',
    'protected', 'static', 'abstract', 'final', 'function', 'fn', 'match', 'yield',
    'list', 'array', 'isset', 'unset', 'empty', 'true', 'false', 'null', 'this',
    'parent', 'self', 'as', 'and', 'or', 'xor', 'global', 'insteadof',
]);

export class TreeSitterPhpParser extends BaseParser {
    constructor() {
        super('php');
    }

    override get usesTreeSitter(): boolean {
        return true;
    }

    // ── Imports (use / require / include) ──────────────────────

    override parseAST(tree: Parser.Tree, fileInfo: FileInfo, _options: Record<string, unknown> = {}): Relation[] {
        const relations: Relation[] = [];
        this.walkImports(tree.rootNode, fileInfo.id, relations);
        return relations;
    }

    private walkImports(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        // use App\Contracts\Jsonable; → namespace_use_declaration > namespace_use_clause
        if (node.type === 'namespace_use_declaration') {
            this.collectUseClauses(node, sourceId, relations);
        }

        // require / require_once / include / include_once with a plain string path
        if (node.type === 'require_expression' || node.type === 'require_once_expression'
            || node.type === 'include_expression' || node.type === 'include_once_expression') {
            const target = this.extractStringTarget(node);
            if (target) {
                const isRequire = node.type.startsWith('require');
                relations.push({
                    source: sourceId,
                    target,
                    type: isRequire ? 'require' : 'include',
                    label: `${node.type.replace('_expression', '').replace('_', ' ')} ${target}`,
                });
            }
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkImports(node.child(i)!, sourceId, relations);
        }
    }

    private collectUseClauses(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        const walk = (n: Parser.SyntaxNode): void => {
            if (n.type === 'namespace_use_clause') {
                // Trait / static use inside classes also parses as use clauses nested in
                // a different parent — the qualified_name text works for both.
                const qualified = this.findChild(n, 'qualified_name') || this.findChild(n, 'name');
                if (qualified) {
                    const target = qualified.text.replace(/^\\/, '');
                    relations.push({
                        source: sourceId,
                        target,
                        type: 'import',
                        label: `use ${target}`,
                    });
                }
                return;
            }
            for (let i = 0; i < n.childCount; i++) {
                walk(n.child(i)!);
            }
        };
        // Only walk the direct clause children (avoid re-walking nested declarations)
        for (let i = 0; i < node.childCount; i++) {
            walk(node.child(i)!);
        }
    }

    private extractStringTarget(node: Parser.SyntaxNode): string | null {
        const str = this.findChild(node, 'string');
        if (!str) { return null; }
        const content = this.findChild(str, 'string_content');
        const raw = content ? content.text : str.text.replace(/^['"]|['"]$/g, '');
        return raw.length > 0 ? raw : null;
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
            case 'class_declaration': {
                const name = node.childForFieldName('name')?.text;
                if (name) {
                    symbols.classes.push(this.buildTypeSymbol(node, name, 'class'));
                }
                this.walkBody(node, symbols);
                return;
            }

            case 'interface_declaration': {
                const name = node.childForFieldName('name')?.text;
                if (name) {
                    symbols.interfaces.push(this.buildTypeSymbol(node, name, 'interface'));
                }
                this.walkBody(node, symbols);
                return;
            }

            case 'trait_declaration': {
                const name = node.childForFieldName('name')?.text;
                if (name) {
                    symbols.traits.push(this.buildTypeSymbol(node, name, 'trait'));
                }
                this.walkBody(node, symbols);
                return;
            }

            case 'enum_declaration': {
                const name = node.childForFieldName('name')?.text;
                if (name) {
                    symbols.enums.push({ name, type: 'enum', line: node.startPosition.row + 1 });
                }
                return;
            }

            case 'function_definition': {
                if (!insideType) {
                    const name = node.childForFieldName('name')?.text;
                    if (name) {
                        symbols.functions.push({ name, type: 'function', line: node.startPosition.row + 1 });
                    }
                }
                return;
            }

            case 'method_declaration': {
                if (insideType) {
                    const name = node.childForFieldName('name')?.text;
                    if (name) {
                        const sym: SymbolInfo = { name, type: 'method', line: node.startPosition.row + 1 };
                        const vis = this.findChild(node, 'visibility_modifier')?.text;
                        if (vis === 'public' || vis === 'private' || vis === 'protected') {
                            sym.visibility = vis;
                        }
                        symbols.methods.push(sym);
                    }
                }
                return;
            }
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkForSymbols(node.child(i)!, symbols, insideType);
        }
    }

    private buildTypeSymbol(node: Parser.SyntaxNode, name: string, type: string): SymbolInfo {
        return { name, type, line: node.startPosition.row + 1 };
    }

    private walkBody(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        const body = node.childForFieldName('body');
        if (!body) { return; }
        for (let i = 0; i < body.childCount; i++) {
            this.walkForSymbols(body.child(i)!, symbols, true);
        }
    }

    // ── Heritage relations ─────────────────────────────────────

    override extractHeritageRelations(tree: Parser.Tree, fileInfo: FileInfo): Relation[] {
        const relations: Relation[] = [];
        this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
        return relations;
    }

    private walkForHeritage(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        if (node.type === 'class_declaration' || node.type === 'interface_declaration') {
            const typeName = node.childForFieldName('name')?.text;
            if (typeName) {
                const baseClause = this.findChild(node, 'base_clause');
                if (baseClause) {
                    for (const base of this.extractClauseNames(baseClause)) {
                        relations.push({
                            source: sourceId, target: base, type: 'extends',
                            label: `${typeName} extends ${base}`,
                        });
                    }
                }
                const ifaceClause = this.findChild(node, 'class_interface_clause');
                if (ifaceClause) {
                    for (const iface of this.extractClauseNames(ifaceClause)) {
                        relations.push({
                            source: sourceId, target: iface, type: 'implements',
                            label: `${typeName} implements ${iface}`,
                        });
                    }
                }
            }
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkForHeritage(node.child(i)!, sourceId, relations);
        }
    }

    private extractClauseNames(clause: Parser.SyntaxNode): string[] {
        const names: string[] = [];
        for (let i = 0; i < clause.childCount; i++) {
            const child = clause.child(i)!;
            if (child.type === 'name' || child.type === 'qualified_name') {
                // Keep the plain class name (strip namespace qualifiers).
                const plain = child.text.replace(/^\\/, '').split('\\').pop();
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
        if (node.type === 'function_definition' || node.type === 'method_declaration') {
            const name = node.childForFieldName('name')?.text;
            if (name) { defined.add(name); }
        }
        for (let i = 0; i < node.childCount; i++) {
            this.collectDefinedFunctions(node.child(i)!, defined);
        }
    }

    private collectCalls(node: Parser.SyntaxNode, calls: Set<string>, definedHere: Set<string>): void {
        if (node.type === 'function_call_expression') {
            const fn = node.childForFieldName('function');
            if (fn && (fn.type === 'name' || fn.type === 'qualified_name')) {
                const raw = fn.text.replace(/^\\/, '');
                const name = raw.split('\\').pop()!;
                if (!PHP_BUILTINS.has(name) && !PHP_KEYWORDS.has(name) && !definedHere.has(name)) {
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
        if (node.type === 'function_definition' || node.type === 'method_declaration') {
            const name = node.childForFieldName('name')?.text || currentFunc;
            for (let i = 0; i < node.childCount; i++) {
                this.collectCallSites(node.child(i)!, sites, definedHere, name);
            }
            return;
        }

        if (node.type === 'function_call_expression') {
            const fn = node.childForFieldName('function');
            if (fn && (fn.type === 'name' || fn.type === 'qualified_name')) {
                const raw = fn.text.replace(/^\\/, '');
                const name = raw.split('\\').pop()!;
                if (!PHP_BUILTINS.has(name) && !PHP_KEYWORDS.has(name)) {
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

    private findChild(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode | null {
        for (let i = 0; i < node.childCount; i++) {
            if (node.child(i)!.type === type) { return node.child(i)!; }
        }
        return null;
    }
}
