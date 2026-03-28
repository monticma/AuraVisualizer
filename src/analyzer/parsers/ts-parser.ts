/**
 * ts-parser.ts — Extracts import/require relations from TypeScript files.
 */

import { JSParser } from './js-parser';

export class TSParser extends JSParser {
    constructor() {
        super();
        this.language = 'typescript';
    }
}
