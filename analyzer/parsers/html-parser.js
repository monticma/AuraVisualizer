/**
 * html-parser.js — Extracts <script src>, <link href>, and other resource references from HTML.
 * 
 * V1: Regex-based attribute extraction
 * Future: Proper HTML parsing (e.g., cheerio) for inline scripts, template references
 */

import { BaseParser } from './base-parser.js';

// <script src="...">
const SCRIPT_SRC_RE = /<script[^>]+src\s*=\s*['"]([^'"]+)['"]/gi;

// <link href="..." rel="stylesheet"> or just <link href="..."> for CSS
const LINK_HREF_RE = /<link[^>]+href\s*=\s*['"]([^'"]+)['"]/gi;

// <img src="..."> — optional for assets  
const IMG_SRC_RE = /<img[^>]+src\s*=\s*['"]([^'"]+)['"]/gi;

export class HTMLParser extends BaseParser {
    constructor() {
        super('html');
    }

    /**
     * @param {Object} fileInfo
     * @param {Object} options
     * @param {boolean} options.includeAssets - Whether to track img/asset references
     * @returns {Array<import('./base-parser.js').Relation>}
     */
    parse(fileInfo, options = {}) {
        const { content, id } = fileInfo;
        const relations = [];

        // Script references
        relations.push(...this.extractMatches(
            content,
            new RegExp(SCRIPT_SRC_RE.source, 'gi'),
            'script',
            id,
            (m) => `<script src="${m[1]}">`
        ));

        // Stylesheet references
        relations.push(...this.extractMatches(
            content,
            new RegExp(LINK_HREF_RE.source, 'gi'),
            'stylesheet',
            id,
            (m) => `<link href="${m[1]}">`
        ));

        // Asset references (optional)
        if (options.includeAssets) {
            relations.push(...this.extractMatches(
                content,
                new RegExp(IMG_SRC_RE.source, 'gi'),
                'asset',
                id,
                (m) => `<img src="${m[1]}">`
            ));
        }

        return relations;
    }
}
