/**
 * c-parser.js — Extracts #include relations from C/H files.
 * 
 * V1: Regex-based #include detection
 * Future: AST parsing with tree-sitter for function calls, type usage, etc.
 */

import { BaseParser } from './base-parser.js';

// Match #include "local_file.h" (local includes)
const INCLUDE_LOCAL_RE = /#include\s*"([^"]+)"/g;

// Match #include <system_header.h> (system includes — optional tracking)
const INCLUDE_SYSTEM_RE = /#include\s*<([^>]+)>/g;

export class CParser extends BaseParser {
    constructor() {
        super('c');
    }

    /**
     * @param {Object} fileInfo
     * @param {Object} options
     * @param {boolean} options.includeSystemHeaders - Whether to track system #include <> 
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
}
