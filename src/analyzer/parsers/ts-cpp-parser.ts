/**
 * ts-cpp-parser.ts — Tree-sitter based C++ parser.
 *
 * Reuses the C parser logic (which already handles preproc_include,
 * function_definition, declaration, struct/enum/typedef, macros and
 * cross-file calls) against the tree-sitter-cpp grammar. C++ nodes
 * not understood by the C walker (namespace_definition, class_specifier,
 * template_declaration, etc.) are simply skipped.
 */

import { TreeSitterCParser } from './ts-c-parser';

export class TreeSitterCppParser extends TreeSitterCParser {
    constructor() {
        super();
        this.language = 'cpp';
    }
}
