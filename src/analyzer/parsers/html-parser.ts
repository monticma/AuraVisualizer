/**
 * html-parser.ts — Extracts <script src>, <link href> references from HTML.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation } from '../types';

const SCRIPT_SRC_RE = /<script[^>]+src\s*=\s*['"]([^'"]+)['"]/gi;
const LINK_HREF_RE = /<link[^>]+href\s*=\s*['"]([^'"]+)['"]/gi;
const IMG_SRC_RE = /<img[^>]+src\s*=\s*['"]([^'"]+)['"]/gi;

export class HTMLParser extends BaseParser {
    constructor() {
        super('html');
    }

    parse(fileInfo: FileInfo, options: Record<string, unknown> = {}): Relation[] {
        const { content, id } = fileInfo;
        const relations: Relation[] = [];

        relations.push(...this.extractMatches(
            content,
            new RegExp(SCRIPT_SRC_RE.source, 'gi'),
            'script',
            id,
            (m) => `<script src="${m[1]}">`
        ));

        relations.push(...this.extractMatches(
            content,
            new RegExp(LINK_HREF_RE.source, 'gi'),
            'stylesheet',
            id,
            (m) => `<link href="${m[1]}">`
        ));

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
