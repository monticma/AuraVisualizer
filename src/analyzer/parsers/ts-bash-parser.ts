/**
 * ts-bash-parser.ts — Tree-sitter based Bash / shell parser.
 *
 * Handles: `source` / `.` file sourcing, script execution (`bash x.sh`,
 * `./x.sh`), and function definitions.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation, FileSymbols } from '../types';
import type Parser from 'web-tree-sitter';

const SOURCE_COMMANDS = new Set(['source', '.']);
const SCRIPT_RUNNERS = new Set(['bash', 'sh', 'zsh', 'dash']);
const SCRIPT_EXT_RE = /\.(sh|bash)$/i;

export class TreeSitterBashParser extends BaseParser {
    constructor() {
        super('bash');
    }

    override get usesTreeSitter(): boolean {
        return true;
    }

    // ── Imports (source / script execution) ────────────────────

    override parseAST(tree: Parser.Tree, fileInfo: FileInfo, _options: Record<string, unknown> = {}): Relation[] {
        const relations: Relation[] = [];
        this.walkCommands(tree.rootNode, fileInfo.id, relations);
        return relations;
    }

    private walkCommands(node: Parser.SyntaxNode, sourceId: string, relations: Relation[]): void {
        if (node.type === 'command') {
            const nameNode = node.childForFieldName('name');
            const name = nameNode?.text ?? '';

            if (SOURCE_COMMANDS.has(name)) {
                const target = this.extractArgumentTarget(node);
                if (target) {
                    relations.push({
                        source: sourceId,
                        target,
                        type: 'source',
                        label: `source ${target}`,
                    });
                }
            } else if (SCRIPT_RUNNERS.has(name)) {
                const target = this.extractArgumentTarget(node);
                if (target && SCRIPT_EXT_RE.test(target)) {
                    relations.push({
                        source: sourceId,
                        target,
                        type: 'script',
                        label: `${name} ${target}`,
                    });
                }
            } else if (SCRIPT_EXT_RE.test(name) && (name.includes('/') || name.startsWith('.'))) {
                // Direct execution: `./scripts/deploy.sh`
                relations.push({
                    source: sourceId,
                    target: name,
                    type: 'script',
                    label: `run ${name}`,
                });
            }
        }

        for (let i = 0; i < node.childCount; i++) {
            this.walkCommands(node.child(i)!, sourceId, relations);
        }
    }

    private extractArgumentTarget(command: Parser.SyntaxNode): string | null {
        const arg = command.childForFieldName('argument');
        if (!arg) { return null; }
        if (arg.type === 'string' || arg.type === 'raw_string' || arg.type === 'concatenation') {
            const text = arg.text.replace(/^['"]|['"]$/g, '');
            return text.length > 0 && !text.includes('$') ? text : null;
        }
        if (arg.type === 'word' || arg.type === 'number') {
            const text = arg.text;
            return text.length > 0 && !text.includes('$') ? text : null;
        }
        return null;
    }

    // ── Symbols (functions) ────────────────────────────────────

    override extractSymbolsAST(tree: Parser.Tree, _fileInfo: FileInfo): FileSymbols {
        const symbols: FileSymbols = {
            functions: [], externs: [], structs: [], enums: [],
            macros: [], classes: [], exports: [],
            interfaces: [], traits: [], typeAliases: [], methods: [],
        };
        this.walkForFunctions(tree.rootNode, symbols);
        return symbols;
    }

    private walkForFunctions(node: Parser.SyntaxNode, symbols: FileSymbols): void {
        if (node.type === 'function_definition') {
            const name = node.childForFieldName('name')?.text;
            if (name) {
                symbols.functions.push({ name, type: 'function', line: node.startPosition.row + 1 });
            }
            return;
        }
        for (let i = 0; i < node.childCount; i++) {
            this.walkForFunctions(node.child(i)!, symbols);
        }
    }

    // Shell scripts have no cross-file function calls — sourcing is the only
    // cross-file dependency (see parseAST).
    extractCallsFromAST(_tree: Parser.Tree): string[] {
        return [];
    }
}
