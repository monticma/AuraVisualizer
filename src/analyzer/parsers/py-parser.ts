/**
 * py-parser.ts — Extracts import relations from Python files.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, FileSymbols, Relation } from '../types';

const IMPORT_RE = /^import\s+([\w.]+)/gm;
const FROM_IMPORT_RE = /^from\s+([\w.]+)\s+import/gm;

// Symbol extraction patterns
const PY_FUNC_RE = /^[ \t]*def\s+(\w+)\s*\(/gm;
const PY_CLASS_RE = /^[ \t]*class\s+(\w+)\s*[:(]/gm;
const PY_ALL_RE = /__all__\s*=\s*\[([^\]]*)\]/gs;
const PY_DECORATOR_RE = /^[ \t]*@(\w+)/gm;

const PY_BUILTINS = new Set([
    'print', 'len', 'range', 'int', 'str', 'float', 'list', 'dict', 'set',
    'tuple', 'bool', 'type', 'isinstance', 'issubclass', 'hasattr', 'getattr',
    'setattr', 'delattr', 'callable', 'super', 'property', 'staticmethod',
    'classmethod', 'abs', 'all', 'any', 'bin', 'chr', 'dir', 'divmod',
    'enumerate', 'eval', 'exec', 'filter', 'format', 'frozenset', 'globals',
    'hash', 'hex', 'id', 'input', 'iter', 'locals', 'map', 'max', 'min',
    'next', 'object', 'oct', 'open', 'ord', 'pow', 'repr', 'reversed',
    'round', 'slice', 'sorted', 'sum', 'vars', 'zip', 'breakpoint',
    'compile', 'complex', 'memoryview', 'bytearray', 'bytes',
    '__import__', '__name__', '__file__', '__doc__',
]);

export class PyParser extends BaseParser {
    constructor() {
        super('python');
    }

    parse(fileInfo: FileInfo): Relation[] {
        const { content, id } = fileInfo;
        const relations: Relation[] = [];

        relations.push(...this.extractMatches(
            content,
            new RegExp(IMPORT_RE.source, 'gm'),
            'import',
            id,
            (m) => `import ${m[1]}`
        ));

        relations.push(...this.extractMatches(
            content,
            new RegExp(FROM_IMPORT_RE.source, 'gm'),
            'from-import',
            id,
            (m) => `from ${m[1]} import`
        ));

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

        // Functions
        const funcRe = new RegExp(PY_FUNC_RE.source, 'gm');
        while ((match = funcRe.exec(stripped)) !== null) {
            const name = match[1];
            const line = stripped.substring(0, match.index).split('\n').length;
            const isDunder = name.startsWith('__') && name.endsWith('__');
            symbols.functions.push({ name, type: isDunder ? 'dunder' : 'function', line });
        }

        // Classes
        const classRe = new RegExp(PY_CLASS_RE.source, 'gm');
        while ((match = classRe.exec(stripped)) !== null) {
            const name = match[1];
            const line = stripped.substring(0, match.index).split('\n').length;
            symbols.classes.push({ name, type: 'class', line });
        }

        // Exports via __all__
        const allRe = new RegExp(PY_ALL_RE.source, 'gs');
        while ((match = allRe.exec(stripped)) !== null) {
            const items = match[1].split(',');
            for (const item of items) {
                const nameMatch = item.trim().match(/['"](\w+)['"]/);
                if (nameMatch) {
                    symbols.exports.push({ name: nameMatch[1], type: 'export-all' });
                }
            }
        }

        // Decorators as macros (useful metadata)
        const decoRe = new RegExp(PY_DECORATOR_RE.source, 'gm');
        const seenDecorators = new Set<string>();
        while ((match = decoRe.exec(stripped)) !== null) {
            const name = match[1];
            if (!seenDecorators.has(name) && !PY_BUILTINS.has(name)) {
                seenDecorators.add(name);
                const line = stripped.substring(0, match.index).split('\n').length;
                symbols.macros.push({ name, type: 'decorator', line });
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

        const funcRe = new RegExp(PY_FUNC_RE.source, 'gm');
        while ((match = funcRe.exec(stripped)) !== null) {
            definedHere.add(match[1]);
        }
        const classRe = new RegExp(PY_CLASS_RE.source, 'gm');
        while ((match = classRe.exec(stripped)) !== null) {
            definedHere.add(match[1]);
        }

        // Find all standalone function calls (not method calls like obj.method())
        const calls = new Set<string>();
        const callRe = /(?:^|[^.\w])(\w+)\s*\(/g;
        while ((match = callRe.exec(stripped)) !== null) {
            const name = match[1];
            if (!PY_BUILTINS.has(name) && !definedHere.has(name)
                && !/^[A-Z_]+$/.test(name) && name !== 'def' && name !== 'class'
                && name !== 'if' && name !== 'for' && name !== 'while'
                && name !== 'return' && name !== 'elif' && name !== 'assert'
                && name !== 'raise' && name !== 'yield' && name !== 'lambda'
                && name !== 'not' && name !== 'and' && name !== 'or') {
                calls.add(name);
            }
        }

        return [...calls];
    }

    private stripCommentsAndStrings(content: string): string {
        // Remove docstrings
        let result = content.replace(/"""[\s\S]*?"""/g, '""');
        result = result.replace(/'''[\s\S]*?'''/g, "''");
        // Remove single-line strings
        result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
        result = result.replace(/'(?:[^'\\]|\\.)*'/g, "''");
        // Remove comments
        result = result.replace(/#.*$/gm, '');
        return result;
    }
}
