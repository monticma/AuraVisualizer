/**
 * js-parser.ts — Extracts import/require relations from JavaScript files.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation } from '../types';

const IMPORT_RE = /import\s+(?:[\w{}\s,*]+\s+from\s+)?['"]([^'"]+)['"]/g;
const REQUIRE_RE = /(?:^|[=(\s,])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const DYNAMIC_IMPORT_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

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

        return relations;
    }
}
