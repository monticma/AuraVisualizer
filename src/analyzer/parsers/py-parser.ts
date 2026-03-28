/**
 * py-parser.ts — Extracts import relations from Python files.
 */

import { BaseParser } from './base-parser';
import type { FileInfo, Relation } from '../types';

const IMPORT_RE = /^import\s+([\w.]+)/gm;
const FROM_IMPORT_RE = /^from\s+([\w.]+)\s+import/gm;

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
}
