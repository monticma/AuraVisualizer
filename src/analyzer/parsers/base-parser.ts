/**
 * base-parser.ts — Base class for language-specific parsers.
 */

import type { FileInfo, Relation, FileSymbols } from '../types';
import type Parser from 'web-tree-sitter';

export class BaseParser {
    language: string;

    constructor(language: string) {
        this.language = language;
    }

    /** Whether this parser uses Tree-sitter AST (override in subclass). */
    get usesTreeSitter(): boolean {
        return false;
    }

    parse(_fileInfo: FileInfo, _options?: Record<string, unknown>): Relation[] {
        return [];
    }

    /** Parse using a Tree-sitter syntax tree (override in TS-based parsers). */
    parseAST(_tree: Parser.Tree, _fileInfo: FileInfo, _options?: Record<string, unknown>): Relation[] {
        return this.parse(_fileInfo, _options);
    }

    /** Extract symbols using a Tree-sitter syntax tree (override in TS-based parsers). */
    extractSymbolsAST(_tree: Parser.Tree, _fileInfo: FileInfo): FileSymbols {
        return { functions: [], externs: [], structs: [], enums: [], macros: [], classes: [], exports: [], interfaces: [], traits: [], typeAliases: [], methods: [] };
    }

    /** Extract cross-file function calls using AST (override in TS-based parsers). */
    extractCallsAST(_tree: Parser.Tree, _fileInfo: FileInfo, _globalFunctions: Set<string>): Relation[] {
        return [];
    }

    extractMatches(
        content: string,
        regex: RegExp,
        type: string,
        sourceId: string,
        labelFn?: (match: RegExpExecArray) => string
    ): Relation[] {
        const relations: Relation[] = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            const target = match[1];
            if (target) {
                relations.push({
                    source: sourceId,
                    target,
                    type,
                    label: labelFn ? labelFn(match) : `${type}: ${target}`
                });
            }
        }
        return relations;
    }
}
