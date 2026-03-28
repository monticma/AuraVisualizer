/**
 * base-parser.ts — Base class for language-specific parsers.
 */

import type { FileInfo, Relation } from '../types';

export class BaseParser {
    language: string;

    constructor(language: string) {
        this.language = language;
    }

    parse(_fileInfo: FileInfo, _options?: Record<string, unknown>): Relation[] {
        return [];
    }

    extractMatches(
        content: string,
        regex: RegExp,
        type: string,
        sourceId: string,
        labelFn?: (match: RegExpExecArray) => string
    ): Relation[] {
        const relations: Relation[] = [];
        let match;
        while ((match = regex.exec(content)) !== null) {
            const target = match[1];
            if (target) {
                relations.push({
                    source: sourceId,
                    target,
                    type,
                    label: labelFn ? labelFn(match) : `${type}: ${target}`
                });
            }
        }
        return relations;
    }
}
