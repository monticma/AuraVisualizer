/**
 * ts-tsx-parser.ts — Tree-sitter based TSX parser.
 *
 * TSX is TypeScript + JSX: the TypeScript grammar cannot parse `<Component />`
 * syntax, so the scanner maps `.tsx` to the dedicated `tsx` grammar. Symbol,
 * call and heritage extraction are identical to TypeScript.
 */

import { TreeSitterTSParser } from './ts-ts-parser';

export class TreeSitterTsxParser extends TreeSitterTSParser {
    constructor() {
        super();
        this.language = 'tsx';
    }
}
