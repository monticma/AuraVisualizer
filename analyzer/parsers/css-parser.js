/**
 * css-parser.js — Extracts @import and url() references from CSS files.
 * 
 * V1: Regex-based @import and url() detection
 * Future: PostCSS parsing for deeper analysis (unused selectors, variable references)
 */

import { BaseParser } from './base-parser.js';

// @import url("file.css") or @import "file.css"
const CSS_IMPORT_RE = /@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"]\s*\)?/g;

// url(...) references (fonts, images) — optional
const CSS_URL_RE = /url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/g;

export class CSSParser extends BaseParser {
    constructor() {
        super('css');
    }

    /**
     * @param {Object} fileInfo
     * @param {Object} options
     * @param {boolean} options.includeUrls - Whether to track url() references
     * @returns {Array<import('./base-parser.js').Relation>}
     */
    parse(fileInfo, options = {}) {
        const { content, id } = fileInfo;
        const relations = [];

        // @import
        relations.push(...this.extractMatches(
            content,
            new RegExp(CSS_IMPORT_RE.source, 'g'),
            'css-import',
            id,
            (m) => `@import "${m[1]}"`
        ));

        // url() references (optional)
        if (options.includeUrls) {
            // Filter out data: URIs and http(s): URLs
            const urlMatches = this.extractMatches(
                content,
                new RegExp(CSS_URL_RE.source, 'g'),
                'css-url',
                id,
                (m) => `url("${m[1]}")`
            );
            relations.push(...urlMatches.filter(r =>
                !r.target.startsWith('data:') &&
                !r.target.startsWith('http:') &&
                !r.target.startsWith('https:') &&
                !r.target.startsWith('#')
            ));
        }

        return relations;
    }
}
