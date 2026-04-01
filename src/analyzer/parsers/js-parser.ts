/**
 * js-parser.ts — Extracts import/require relations from JavaScript files.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation, FileSymbols } from '../types';

const IMPORT_RE = /import\s+(?:[\w{}\s,*]+\s+from\s+)?['"]([^'"]+)['"]/g;
const REQUIRE_RE = /(?:^|[=(\s,])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const DYNAMIC_IMPORT_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const DYNAMIC_IMPORT_TEMPLATE_RE = /import\s*\(\s*`([^`$]+)/g;

// Symbol extraction regexes
const FUNC_DECL_RE = /(?:^|[\s;{}])(?:async\s+)?function\s*\*?\s+(\w+)\s*\(/gm;
const ARROW_NAMED_RE = /(?:^|[\s;])(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*=>/gm;
const METHOD_RE = /(?:^|[\s;])(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/gm;
const CLASS_RE = /(?:^|[\s;])class\s+(\w+)/gm;
const EXPORT_NAMED_RE = /export\s+(?:(?:async\s+)?function\s*\*?\s+(\w+)|class\s+(\w+)|(?:const|let|var)\s+(\w+))/gm;
const EXPORT_DEFAULT_RE = /export\s+default\s+(?:(?:async\s+)?function\s*\*?\s+(\w+)|class\s+(\w+)|(\w+))/gm;
const EXPORT_LIST_RE = /export\s*\{([^}]+)\}/g;

const JS_KEYWORDS = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'return',
    'break', 'continue', 'throw', 'try', 'catch', 'finally',
    'new', 'delete', 'typeof', 'instanceof', 'void', 'in', 'of',
    'this', 'super', 'with', 'yield', 'await', 'debugger',
    'constructor', 'get', 'set', 'static', 'async',
    'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
    'console', 'window', 'document', 'global', 'process',
    'require', 'module', 'exports', 'import', 'export', 'default', 'from'
]);

// Common built-in functions to exclude from call detection
const JS_BUILTINS = new Set([
    ...JS_KEYWORDS,
    'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURI', 'decodeURI',
    'encodeURIComponent', 'decodeURIComponent', 'eval', 'JSON', 'Math',
    'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
    'Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError',
    'Map', 'Set', 'WeakMap', 'WeakSet', 'Promise', 'Proxy', 'Reflect',
    'Symbol', 'BigInt', 'ArrayBuffer', 'SharedArrayBuffer', 'DataView',
    'Float32Array', 'Float64Array', 'Int8Array', 'Int16Array', 'Int32Array',
    'Uint8Array', 'Uint16Array', 'Uint32Array', 'URL', 'URLSearchParams',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'requestAnimationFrame', 'cancelAnimationFrame', 'fetch',
    'alert', 'confirm', 'prompt',
    'addEventListener', 'removeEventListener', 'dispatchEvent',
    'createElement', 'getElementById', 'querySelector', 'querySelectorAll',
    'log', 'warn', 'error', 'info', 'debug', 'trace', 'dir',
    'push', 'pop', 'shift', 'unshift', 'splice', 'slice', 'concat',
    'map', 'filter', 'reduce', 'forEach', 'find', 'findIndex', 'some', 'every',
    'includes', 'indexOf', 'join', 'sort', 'reverse', 'flat', 'flatMap',
    'keys', 'values', 'entries', 'assign', 'freeze', 'seal',
    'defineProperty', 'getOwnPropertyNames', 'hasOwnProperty',
    'toString', 'valueOf', 'toJSON', 'then', 'catch', 'resolve', 'reject',
    'all', 'allSettled', 'race', 'any', 'stringify', 'parse',
    'replace', 'match', 'search', 'split', 'trim', 'startsWith', 'endsWith',
    'charAt', 'charCodeAt', 'substring', 'repeat', 'padStart', 'padEnd',
    'bind', 'call', 'apply', 'next', 'done', 'emit', 'on', 'once', 'off'
]);

export class JSParser extends BaseParser {
    constructor() {
        super('javascript');
    }

    parse(fileInfo: FileInfo): Relation[] {
        const { content, id } = fileInfo;
        const relations: Relation[] = [];

        relations.push(...this.extractMatches(
            content,
            new RegExp(IMPORT_RE.source, 'g'),
            'import',
            id,
            (m) => `import from '${m[1]}'`
        ));

        relations.push(...this.extractMatches(
            content,
            new RegExp(REQUIRE_RE.source, 'g'),
            'require',
            id,
            (m) => `require('${m[1]}')`
        ));

        relations.push(...this.extractMatches(
            content,
            new RegExp(DYNAMIC_IMPORT_RE.source, 'g'),
            'dynamic-import',
            id,
            (m) => `import('${m[1]}')`
        ));

        // Dynamic imports with template literals: import(`./file.js?v=${x}`)
        relations.push(...this.extractMatches(
            content,
            new RegExp(DYNAMIC_IMPORT_TEMPLATE_RE.source, 'g'),
            'dynamic-import',
            id,
            (m) => {
                // Strip query string if present
                const clean = m[1].split('?')[0];
                return `import('${clean}')`;
            }
        ).map(r => ({ ...r, target: r.target.split('?')[0] })));

        return relations;
    }

    extractSymbols(fileInfo: FileInfo): FileSymbols {
        const { content } = fileInfo;
        const symbols: FileSymbols = {
            functions: [], externs: [], structs: [], enums: [],
            macros: [], classes: [], exports: [],
            interfaces: [], traits: [], typeAliases: [], methods: []
        };

        const stripped = this.stripCommentsAndStrings(content);
        let match;

        // Named functions: function foo(...)
        const funcRe = new RegExp(FUNC_DECL_RE.source, 'gm');
        while ((match = funcRe.exec(stripped)) !== null) {
            const name = match[1];
            if (!JS_KEYWORDS.has(name)) {
                const line = stripped.substring(0, match.index).split('\n').length;
                symbols.functions.push({ name, type: 'function', line });
            }
        }

        // Arrow functions: const foo = (...) =>
        const arrowRe = new RegExp(ARROW_NAMED_RE.source, 'gm');
        while ((match = arrowRe.exec(stripped)) !== null) {
            const name = match[1];
            if (!JS_KEYWORDS.has(name)) {
                const line = stripped.substring(0, match.index).split('\n').length;
                // Avoid duplicates with function declarations
                if (!symbols.functions.some(f => f.name === name)) {
                    symbols.functions.push({ name, type: 'arrow', line });
                }
            }
        }

        // Classes: class Foo
        const classRe = new RegExp(CLASS_RE.source, 'gm');
        while ((match = classRe.exec(stripped)) !== null) {
            const name = match[1];
            const line = stripped.substring(0, match.index).split('\n').length;
            symbols.classes.push({ name, type: 'class', line });
        }

        // Named exports: export function/class/const
        const exportNamedRe = new RegExp(EXPORT_NAMED_RE.source, 'gm');
        while ((match = exportNamedRe.exec(stripped)) !== null) {
            const name = match[1] || match[2] || match[3];
            if (name) {
                const type = match[1] ? 'function' : match[2] ? 'class' : 'variable';
                symbols.exports.push({ name, type: `export-${type}` });
            }
        }

        // Default exports: export default function/class/name
        const exportDefaultRe = new RegExp(EXPORT_DEFAULT_RE.source, 'gm');
        while ((match = exportDefaultRe.exec(stripped)) !== null) {
            const name = match[1] || match[2] || match[3];
            if (name && !JS_KEYWORDS.has(name)) {
                symbols.exports.push({ name, type: 'export-default' });
            }
        }

        // Export lists: export { foo, bar as baz }
        const exportListRe = new RegExp(EXPORT_LIST_RE.source, 'g');
        while ((match = exportListRe.exec(stripped)) !== null) {
            const items = match[1].split(',');
            for (const item of items) {
                const trimmed = item.trim();
                const asMatch = trimmed.match(/^(\w+)(?:\s+as\s+\w+)?$/);
                if (asMatch && !JS_KEYWORDS.has(asMatch[1])) {
                    symbols.exports.push({ name: asMatch[1], type: 'export-named' });
                }
            }
        }

        return symbols;
    }

    extractCalls(fileInfo: FileInfo): string[] {
        const { content } = fileInfo;
        const stripped = this.stripCommentsAndStrings(content);

        // Collect functions defined in this file
        const definedHere = new Set<string>();
        let match;

        const funcRe = new RegExp(FUNC_DECL_RE.source, 'gm');
        while ((match = funcRe.exec(stripped)) !== null) {
            definedHere.add(match[1]);
        }
        const arrowRe = new RegExp(ARROW_NAMED_RE.source, 'gm');
        while ((match = arrowRe.exec(stripped)) !== null) {
            definedHere.add(match[1]);
        }

        // Find all standalone function calls (not method calls like obj.method())
        const calls = new Set<string>();
        const callRe = /(?:^|[^.\w])(\w+)\s*\(/g;
        while ((match = callRe.exec(stripped)) !== null) {
            const name = match[1];
            if (!JS_BUILTINS.has(name) && !JS_KEYWORDS.has(name)
                && !definedHere.has(name) && !/^[A-Z_]+$/.test(name)) {
                calls.add(name);
            }
        }

        return [...calls];
    }

    protected stripCommentsAndStrings(content: string): string {
        let result = content.replace(/\/\/.*$/gm, '');
        result = result.replace(/\/\*[\s\S]*?\*\//g, '');
        result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
        result = result.replace(/'(?:[^'\\]|\\.)*'/g, "''");
        result = result.replace(/`(?:[^`\\]|\\.)*`/gs, '``');
        return result;
    }
}
