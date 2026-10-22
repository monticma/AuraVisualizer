/**
 * tree-sitter.test.ts — Tests for Tree-sitter WASM infrastructure.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type Parser from 'web-tree-sitter';
import { initTreeSitter, loadLanguage, createParser, parseSource, hasGrammar, getSupportedLanguages } from '../analyzer/tree-sitter-loader';

describe('Tree-sitter infrastructure', () => {

    beforeAll(async () => {
        await initTreeSitter();
    });

    it('should initialize without error', async () => {
        // Double init should be idempotent
        await initTreeSitter();
    });

    it('should report supported languages', () => {
        const langs = getSupportedLanguages();
        expect(langs).toContain('c');
        expect(langs).toContain('javascript');
        expect(langs).toContain('typescript');
        expect(langs).toContain('python');
        expect(langs).toContain('java');
        expect(langs).toContain('go');
        expect(langs).toContain('rust');
    });

    it('should check grammar availability', () => {
        expect(hasGrammar('c')).toBe(true);
        expect(hasGrammar('python')).toBe(true);
        expect(hasGrammar('brainfuck')).toBe(false);
    });

    it('should load the C grammar', async () => {
        const lang = await loadLanguage('c');
        expect(lang).toBeDefined();
        // Language.name not available in web-tree-sitter@0.20.8
        expect(typeof lang.nodeTypeCount).toBe('number');
    });

    it('should create a C parser', async () => {
        const parser = await createParser('c');
        expect(parser).toBeDefined();
        expect(parser.getLanguage()).toBeDefined();
    });

    it('should parse a C source file', async () => {
        const source = `
#include <stdio.h>
#include "utils.h"

typedef struct {
    int x;
    int y;
} Point;

int add(int a, int b) {
    return a + b;
}

void greet(const char *name) {
    printf("Hello, %s\\n", name);
}

int main(void) {
    Point p = {1, 2};
    int result = add(p.x, p.y);
    greet("world");
    return 0;
}
`;
        const tree = await parseSource('c', source);
        expect(tree).toBeDefined();
        expect(tree.rootNode).toBeDefined();
        expect(tree.rootNode.type).toBe('translation_unit');
        expect(tree.rootNode.childCount).toBeGreaterThan(0);
    });

    it('should find function definitions in C AST', async () => {
        const source = `
int add(int a, int b) {
    return a + b;
}

void greet(const char *name) {
    printf("Hello %s", name);
}
`;
        const tree = await parseSource('c', source);
        const root = tree.rootNode;

        const funcDefs = root.children.filter(n => n.type === 'function_definition');
        expect(funcDefs.length).toBe(2);

        // Check function names via the declarator
        const names = funcDefs.map(fn => {
            const declarator = fn.childForFieldName('declarator');
            // function_declarator → first child is the identifier
            const nameNode = declarator?.childForFieldName('declarator');
            return nameNode?.text;
        });
        expect(names).toContain('add');
        expect(names).toContain('greet');
    });

    it('should find #include directives in C AST', async () => {
        const source = `
#include <stdio.h>
#include "myheader.h"

int main() { return 0; }
`;
        const tree = await parseSource('c', source);
        const root = tree.rootNode;

        const includes = root.children.filter(n => n.type === 'preproc_include');
        expect(includes.length).toBe(2);

        const paths = includes.map(inc => {
            const pathNode = inc.childForFieldName('path');
            return pathNode?.text;
        });
        expect(paths).toContain('<stdio.h>');
        expect(paths).toContain('"myheader.h"');
    });

    it('should find structs in C AST', async () => {
        const source = `
typedef struct {
    int x;
    int y;
} Point;

struct Node {
    int value;
    struct Node *next;
};
`;
        const tree = await parseSource('c', source);
        const root = tree.rootNode;

        // typedef → type_definition containing struct_specifier
        const typedefs = root.children.filter(n => n.type === 'type_definition');
        expect(typedefs.length).toBe(1);

        // standalone struct → also a type_definition or declaration
        // count all struct_specifier nodes anywhere in the tree
        const allNodes: Parser.SyntaxNode[] = [];
        const walk = (node: Parser.SyntaxNode) => { allNodes.push(node); node.children.forEach(walk); };
        walk(root);
        const structs = allNodes.filter(n => n.type === 'struct_specifier');
        expect(structs.length).toBeGreaterThanOrEqual(2);
    });

    it('should parse JavaScript source', async () => {
        const source = `
import { readFile } from 'fs';
import path from 'path';

export function processFile(filePath) {
    const data = readFile(filePath);
    return data;
}

export class FileProcessor {
    constructor(root) {
        this.root = root;
    }

    process() {
        return processFile(this.root);
    }
}

export default FileProcessor;
`;
        const tree = await parseSource('javascript', source);
        const root = tree.rootNode;
        expect(root.type).toBe('program');

        // Find imports
        const imports = root.children.filter(n => n.type === 'import_statement');
        expect(imports.length).toBe(2);

        // Find exports with functions/classes
        const exportStatements = root.children.filter(n => n.type === 'export_statement');
        expect(exportStatements.length).toBe(3); // function, class, default
    });

    it('should parse Python source', async () => {
        const source = `
import os
from pathlib import Path

def greet(name: str) -> str:
    return f"Hello, {name}"

class Greeter:
    def __init__(self, prefix: str):
        self.prefix = prefix

    def greet(self, name: str) -> str:
        return f"{self.prefix} {name}"
`;
        const tree = await parseSource('python', source);
        const root = tree.rootNode;
        expect(root.type).toBe('module');

        // Find imports
        const imports = root.children.filter(n =>
            n.type === 'import_statement' || n.type === 'import_from_statement'
        );
        expect(imports.length).toBe(2);

        // Find function and class
        const funcDefs = root.children.filter(n => n.type === 'function_definition');
        expect(funcDefs.length).toBe(1);

        const classDefs = root.children.filter(n => n.type === 'class_definition');
        expect(classDefs.length).toBe(1);
    });

    it('should throw for unsupported language', async () => {
        await expect(loadLanguage('brainfuck')).rejects.toThrow('No Tree-sitter grammar available');
    });

    it('should cache loaded languages', async () => {
        const lang1 = await loadLanguage('c');
        const lang2 = await loadLanguage('c');
        expect(lang1).toBe(lang2); // Same reference = cached
    });
});
