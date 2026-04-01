/**
 * ts-go-parser.test.ts — Tests for Tree-sitter based Go parser.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TreeSitterGoParser } from '../analyzer/parsers/ts-go-parser';
import { initTreeSitter, parseSource } from '../analyzer/tree-sitter-loader';
import { makeFileInfo } from './helpers';
import type Parser from 'web-tree-sitter';

const parser = new TreeSitterGoParser();

beforeAll(async () => {
    await initTreeSitter();
});

async function tree(content: string): Promise<Parser.Tree> {
    return parseSource('go', content);
}

// ============================================================
// parseAST — imports
// ============================================================
describe('TreeSitterGoParser.parseAST', () => {
    it('extracts grouped imports', async () => {
        const content = 'package main\n\nimport (\n\t"fmt"\n\t"os"\n\t"github.com/example/utils"\n)\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'main.go', content, language: 'go', extension: '.go' });
        const rels = parser.parseAST(t, file);
        expect(rels).toHaveLength(3);
        expect(rels[0]).toMatchObject({ target: 'fmt', type: 'import' });
        expect(rels[1]).toMatchObject({ target: 'os', type: 'import' });
        expect(rels[2]).toMatchObject({ target: 'github.com/example/utils', type: 'import' });
    });

    it('returns empty for no imports', async () => {
        const content = 'package main\n\nfunc main() {}\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'main.go', content, language: 'go', extension: '.go' });
        expect(parser.parseAST(t, file)).toHaveLength(0);
    });
});

// ============================================================
// extractSymbolsAST
// ============================================================
describe('TreeSitterGoParser.extractSymbolsAST', () => {
    it('extracts functions', async () => {
        const content = 'package main\n\nfunc helper() string { return "" }\nfunc Main() {}\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'utils.go', content, language: 'go', extension: '.go' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.functions).toHaveLength(2);
        expect(symbols.functions[0].name).toBe('helper');
        // Main is exported (uppercase)
        expect(symbols.exports.find(e => e.name === 'Main')).toBeDefined();
    });

    it('extracts structs', async () => {
        const content = 'package main\n\ntype Animal struct {\n\tName string\n}\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'models.go', content, language: 'go', extension: '.go' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.structs).toHaveLength(1);
        expect(symbols.structs[0].name).toBe('Animal');
        expect(symbols.exports.find(e => e.name === 'Animal')).toBeDefined();
    });

    it('extracts interfaces', async () => {
        const content = 'package main\n\ntype Speaker interface {\n\tSpeak() string\n}\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'ifaces.go', content, language: 'go', extension: '.go' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.interfaces).toHaveLength(1);
        expect(symbols.interfaces[0].name).toBe('Speaker');
    });

    it('extracts methods with receiver', async () => {
        const content = 'package main\n\nfunc (a *Animal) Speak() string { return a.Sound }\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'animal.go', content, language: 'go', extension: '.go' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.methods).toHaveLength(1);
        expect(symbols.methods[0].name).toBe('Speak');
        expect((symbols.methods[0] as any).receiver).toBe('Animal');
    });
});

// ============================================================
// Calls
// ============================================================
describe('TreeSitterGoParser.extractCallsAST', () => {
    it('extracts standalone function calls', async () => {
        const content = [
            'package main',
            '',
            'func localFn() {}',
            'func main() {',
            '\tlocalFn()',
            '\texternalFn()',
            '\tfmt.Println("hi")',
            '}',
        ].join('\n');
        const t = await tree(content);
        const calls = parser.extractCallsFromAST(t);
        expect(calls).toContain('externalFn');
        expect(calls).not.toContain('localFn');
        // fmt.Println is a selector_expression, not captured
        expect(calls).not.toContain('Println');
    });
});
