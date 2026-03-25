/**
 * c-parser.js — Extracts #include relations, function definitions,
 * extern declarations, and cross-file function calls from C/H files.
 * 
 * V2: Enhanced with symbol extraction for inter-file relation detection
 *     and file-explosion mode.
 */

import { BaseParser } from './base-parser.js';

// Match #include "local_file.h" (local includes)
const INCLUDE_LOCAL_RE = /#include\s*"([^"]+)"/g;

// Match #include <system_header.h> (system includes — optional tracking)
const INCLUDE_SYSTEM_RE = /#include\s*<([^>]+)>/g;

// Match function definitions:
// return_type function_name(params) {
// Supports: static, inline, const, pointer returns, multiline
// Group 1: return type and modifiers (must end with space or asterisks)
// Group 2: function name
const FUNC_DEF_RE = /^[ \t]*((?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+)([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/gm;

// Match extern declarations: extern return_type function_name(params);
const EXTERN_RE = /extern\s+[\w\s*]+\s+(\w+)\s*\([^)]*\)\s*;/g;

// Match struct definitions: struct name { ... } or typedef struct { ... } name;
const STRUCT_DEF_RE = /(?:typedef\s+)?struct\s+(\w+)\s*\{/g;
const TYPEDEF_STRUCT_RE = /typedef\s+struct\s*(?:\w+\s*)?\{[^}]*\}\s*(\w+)\s*;/gs;

// Match enum definitions
const ENUM_DEF_RE = /(?:typedef\s+)?enum\s+(\w+)\s*\{/g;

// Match #define macros (function-like or constant)
const DEFINE_RE = /^[ \t]*#define\s+(\w+)(?:\(([^)]*)\))?/gm;

// C keywords/builtins to exclude from function call detection
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
    'defined', 'offsetof', 'va_start', 'va_end', 'va_arg'
]);

export class CParser extends BaseParser {
    constructor() {
        super('c');
    }

    /**
     * @param {Object} fileInfo
     * @param {Object} options
     * @param {boolean} options.includeSystemHeaders
     * @param {boolean} options.extractSymbols - Whether to extract function defs and calls
     * @returns {Array<import('./base-parser.js').Relation>}
     */
    parse(fileInfo, options = {}) {
        const { content, id } = fileInfo;
        const relations = [];

        // Local includes — always tracked
        relations.push(...this.extractMatches(
            content,
            new RegExp(INCLUDE_LOCAL_RE.source, 'g'),
            'include',
            id,
            (m) => `#include "${m[1]}"`
        ));

        // System includes — optionally tracked
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

    /**
     * Extract all symbols (functions, structs, enums, macros) from a C/H file.
     * Used for file-explosion mode and cross-file call detection.
     * 
     * @param {Object} fileInfo
     * @returns {Object} { functions, externs, structs, enums, macros }
     */
    extractSymbols(fileInfo) {
        const { content } = fileInfo;
        const symbols = {
            functions: [],
            externs: [],
            structs: [],
            enums: [],
            macros: []
        };

        // Strip comments to avoid false positives
        const stripped = this.stripComments(content);

        // Function definitions
        let match;
        const funcRe = new RegExp(FUNC_DEF_RE.source, 'gm');
        while ((match = funcRe.exec(stripped)) !== null) {
            const returnType = (match[1] || '').trim();
            const name = match[2];
            const params = (match[3] || '').trim();
            if (!C_BUILTINS.has(name)) {
                // Calculate line number
                const line = stripped.substring(0, match.index).split('\n').length;
                symbols.functions.push({
                    name,
                    returnType,
                    params,
                    line,
                    type: 'function'
                });
            }
        }

        // Extern declarations
        const externRe = new RegExp(EXTERN_RE.source, 'g');
        while ((match = externRe.exec(stripped)) !== null) {
            symbols.externs.push({ name: match[1], type: 'extern' });
        }

        // Struct definitions
        const structRe = new RegExp(STRUCT_DEF_RE.source, 'g');
        while ((match = structRe.exec(stripped)) !== null) {
            symbols.structs.push({ name: match[1], type: 'struct' });
        }
        const typedefStructRe = new RegExp(TYPEDEF_STRUCT_RE.source, 'gs');
        while ((match = typedefStructRe.exec(stripped)) !== null) {
            symbols.structs.push({ name: match[1], type: 'typedef-struct' });
        }

        // Enum definitions
        const enumRe = new RegExp(ENUM_DEF_RE.source, 'g');
        while ((match = enumRe.exec(stripped)) !== null) {
            symbols.enums.push({ name: match[1], type: 'enum' });
        }

        // Macro definitions
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

    /**
     * Extract function calls from a C file's body content.
     * Returns a list of called function names.
     * 
     * @param {Object} fileInfo
     * @returns {string[]} Array of function names called in this file
     */
    extractCalls(fileInfo) {
        const { content } = fileInfo;
        const stripped = this.stripComments(content);
        const calls = new Set();

        // Match function calls: identifier(
        // Exclude definitions (preceded by type keywords)
        const callRe = /\b(\w+)\s*\(/g;
        let match;
        while ((match = callRe.exec(stripped)) !== null) {
            const name = match[1];
            if (!C_BUILTINS.has(name) && !/^[A-Z_]+$/.test(name)) {
                // Exclude all-caps (likely macros) unless they look like function macros
                calls.add(name);
            }
        }

        return [...calls];
    }

    /**
     * Strip C-style comments from source content.
     * @param {string} content
     * @returns {string}
     */
    stripComments(content) {
        // Remove single-line comments
        let result = content.replace(/\/\/.*$/gm, '');
        // Remove multi-line comments
        result = result.replace(/\/\*[\s\S]*?\*\//g, '');
        // Remove string literals to avoid false matches
        result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
        return result;
    }
}
