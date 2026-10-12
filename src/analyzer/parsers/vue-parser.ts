/**
 * vue-parser.ts — Regex-based parser for Vue Single-File Components.
 *
 * The Vue tree-sitter grammar shipped with tree-sitter-wasms 0.1.13 is
 * ABI-incompatible with the bundled web-tree-sitter 0.20 runtime, so Vue is
 * handled with regexes like HTML/CSS: <script src>, inline <script> imports,
 * <style src> and @import inside the style blocks.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation } from '../types';

const SCRIPT_SRC_RE = /<script[^>]+src\s*=\s*['"]([^'"]+)['"]/gi;
const STYLE_SRC_RE = /<style[^>]+src\s*=\s*['"]([^'"]+)['"]/gi;
const SCRIPT_BLOCK_RE = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const IMPORT_FROM_RE = /\bimport\s+[^'"]*?from\s*['"]([^'"]+)['"]/g;
const IMPORT_BARE_RE = /\bimport\s*['"]([^'"]+)['"]/g;
const REQUIRE_RE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const CSS_IMPORT_RE = /@import\s+(?:url\()?\s*['"]([^'"]+)['"]/g;

export class VueParser extends BaseParser {
    constructor() {
        super('vue');
    }

    parse(fileInfo: FileInfo, _options: Record<string, unknown> = {}): Relation[] {
        const { content, id } = fileInfo;
        const relations: Relation[] = [];
        const seen = new Set<string>();

        const push = (target: string, type: string, label: string): void => {
            const key = type + '|' + target;
            if (seen.has(key)) { return; }
            seen.add(key);
            relations.push({ source: id, target, type, label });
        };

        // External script / style files
        for (const m of content.matchAll(new RegExp(SCRIPT_SRC_RE.source, 'gi'))) {
            push(m[1], 'script', `<script src="${m[1]}">`);
        }
        for (const m of content.matchAll(new RegExp(STYLE_SRC_RE.source, 'gi'))) {
            push(m[1], 'stylesheet', `<style src="${m[1]}">`);
        }

        // Inline <script> blocks — the SFC dependency surface
        for (const block of content.matchAll(new RegExp(SCRIPT_BLOCK_RE.source, 'gi'))) {
            const script = block[1];
            for (const m of script.matchAll(new RegExp(IMPORT_FROM_RE.source, 'g'))) {
                push(m[1], 'import', `import ${m[1]}`);
            }
            for (const m of script.matchAll(new RegExp(IMPORT_BARE_RE.source, 'g'))) {
                push(m[1], 'import', `import ${m[1]}`);
            }
            for (const m of script.matchAll(new RegExp(REQUIRE_RE.source, 'g'))) {
                push(m[1], 'require', `require('${m[1]}')`);
            }
        }

        // @import inside <style> blocks
        for (const block of content.matchAll(new RegExp(STYLE_BLOCK_RE.source, 'gi'))) {
            for (const m of block[1].matchAll(new RegExp(CSS_IMPORT_RE.source, 'g'))) {
                push(m[1], 'css-import', `@import '${m[1]}'`);
            }
        }

        return relations;
    }
}
