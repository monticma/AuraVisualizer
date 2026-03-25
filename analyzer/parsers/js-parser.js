/**
 * js-parser.js — Extracts import/require relations from JavaScript files.
 * 
 * V1: Regex-based import/require detection
 * Future: AST parsing for dynamic imports, re-exports, function calls across modules
 */

import { BaseParser } from './base-parser.js';

// ES6 import: import X from './file', import './file', import { X } from './file'
const IMPORT_RE = /import\s+(?:[\w{}\s,*]+\s+from\s+)?['"]([^'"]+)['"]/g;

// CommonJS require: require('./file'), require('module')
const REQUIRE_RE = /(?:^|[=(\s,])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// Dynamic import: import('./file')
const DYNAMIC_IMPORT_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

export class JSParser extends BaseParser {
    constructor() {
        super('javascript');
    }

    /**
     * @param {Object} fileInfo
     * @returns {Array<import('./base-parser.js').Relation>}
     */
    parse(fileInfo) {
        const { content, id } = fileInfo;
        const relations = [];

        // ES6 static imports
        relations.push(...this.extractMatches(
            content,
            new RegExp(IMPORT_RE.source, 'g'),
            'import',
            id,
            (m) => `import from '${m[1]}'`
        ));

        // CommonJS require
        relations.push(...this.extractMatches(
            content,
            new RegExp(REQUIRE_RE.source, 'g'),
            'require',
            id,
            (m) => `require('${m[1]}')`
        ));

        // Dynamic imports
        relations.push(...this.extractMatches(
            content,
            new RegExp(DYNAMIC_IMPORT_RE.source, 'g'),
            'dynamic-import',
            id,
            (m) => `import('${m[1]}')`
        ));

        return relations;
    }
}
