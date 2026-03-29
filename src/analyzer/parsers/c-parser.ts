/**
 * c-parser.ts — Extracts #include relations, function definitions,
 * extern declarations, and cross-file function calls from C/H files.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation, FileSymbols } from '../types';

const INCLUDE_LOCAL_RE = /#include\s*"([^"]+)"/g;
const INCLUDE_SYSTEM_RE = /#include\s*<([^>]+)>/g;
// Matches function definitions, optionally preceded by __attribute__((...)) or GCC visibility
const FUNC_DEF_RE = /^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?((?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+)([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/gm;
const EXTERN_RE = /extern\s+[\w\s*]+\s+(\w+)\s*\([^)]*\)\s*;/g;
const STRUCT_DEF_RE = /(?:typedef\s+)?struct\s+(\w+)\s*\{/g;
const TYPEDEF_STRUCT_RE = /typedef\s+struct\s*(?:\w+\s*)?\{[^}]*\}\s*(\w+)\s*;/gs;
const ENUM_DEF_RE = /(?:typedef\s+)?enum\s+(\w+)\s*\{/g;
const DEFINE_RE = /^[ \t]*#define\s+(\w+)(?:\(([^)]*)\))?/gm;

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

export class CParser extends BaseParser {
    constructor() {
        super('c');
    }

    parse(fileInfo: FileInfo, options: Record<string, unknown> = {}): Relation[] {
        const { content, id } = fileInfo;
        const relations: Relation[] = [];

        relations.push(...this.extractMatches(
            content,
            new RegExp(INCLUDE_LOCAL_RE.source, 'g'),
            'include',
            id,
            (m) => `#include "${m[1]}"`
        ));

        if (options.includeSystemHeaders) {
            relations.push(...this.extractMatches(
                content,
                new RegExp(INCLUDE_SYSTEM_RE.source, 'g'),
                'system-include',
                id,
                (m) => `#include <${m[1]}>`
            ));
        }

        return relations;
    }

    extractSymbols(fileInfo: FileInfo): FileSymbols {
        const { content } = fileInfo;
        const symbols: FileSymbols = {
            functions: [],
            externs: [],
            structs: [],
            enums: [],
            macros: []
        };

        const stripped = this.stripComments(content);
        let match;

        const funcRe = new RegExp(FUNC_DEF_RE.source, 'gm');
        while ((match = funcRe.exec(stripped)) !== null) {
            const returnType = (match[1] || '').trim();
            const name = match[2];
            const params = (match[3] || '').trim();
            if (!C_BUILTINS.has(name)) {
                const line = stripped.substring(0, match.index).split('\n').length;
                symbols.functions.push({ name, returnType, params, line, type: 'function' });
            }
        }

        const externRe = new RegExp(EXTERN_RE.source, 'g');
        while ((match = externRe.exec(stripped)) !== null) {
            symbols.externs.push({ name: match[1], type: 'extern' });
        }

        const structRe = new RegExp(STRUCT_DEF_RE.source, 'g');
        while ((match = structRe.exec(stripped)) !== null) {
            symbols.structs.push({ name: match[1], type: 'struct' });
        }
        const typedefStructRe = new RegExp(TYPEDEF_STRUCT_RE.source, 'gs');
        while ((match = typedefStructRe.exec(stripped)) !== null) {
            symbols.structs.push({ name: match[1], type: 'typedef-struct' });
        }

        const enumRe = new RegExp(ENUM_DEF_RE.source, 'g');
        while ((match = enumRe.exec(stripped)) !== null) {
            symbols.enums.push({ name: match[1], type: 'enum' });
        }

        const defineRe = new RegExp(DEFINE_RE.source, 'gm');
        while ((match = defineRe.exec(stripped)) !== null) {
            const name = match[1];
            const isFunctionLike = match[2] !== undefined;
            symbols.macros.push({
                name,
                type: isFunctionLike ? 'function-macro' : 'constant-macro'
            });
        }

        return symbols;
    }

    extractCalls(fileInfo: FileInfo): string[] {
        const { content } = fileInfo;
        const stripped = this.stripComments(content);

        // First, collect all function names DEFINED in this file (including __attribute__ decorated ones)
        const definedHere = new Set<string>();
        const defRe = /^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?(?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+([a-zA-Z_]\w*)\s*\([^)]*\)\s*\{/gm;
        let m;
        while ((m = defRe.exec(stripped)) !== null) {
            definedHere.add(m[1]);
        }

        const calls = new Set<string>();
        const callRe = /\b(\w+)\s*\(/g;
        let match;
        while ((match = callRe.exec(stripped)) !== null) {
            const name = match[1];
            if (!C_BUILTINS.has(name) && !/^[A-Z_]+$/.test(name) && !definedHere.has(name)) {
                calls.add(name);
            }
        }

        return [...calls];
    }

    private stripComments(content: string): string {
        let result = content.replace(/\/\/.*$/gm, '');
        result = result.replace(/\/\*[\s\S]*?\*\//g, '');
        result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
        return result;
    }
}
