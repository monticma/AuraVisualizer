/**
 * css-parser.ts — Extracts @import and url() references from CSS files.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation } from '../types';

const CSS_IMPORT_RE = /@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"]\s*\)?/g;
const CSS_URL_RE = /url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/g;

export class CSSParser extends BaseParser {
    constructor() {
        super('css');
    }

    parse(fileInfo: FileInfo, options: Record<string, unknown> = {}): Relation[] {
        const { content, id } = fileInfo;
        const relations: Relation[] = [];

        relations.push(...this.extractMatches(
            content,
            new RegExp(CSS_IMPORT_RE.source, 'g'),
            'css-import',
            id,
            (m) => `@import "${m[1]}"`
        ));

        if (options.includeUrls) {
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
