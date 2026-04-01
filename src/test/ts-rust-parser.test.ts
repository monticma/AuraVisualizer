/**
 * ts-rust-parser.test.ts — Tests for Tree-sitter based Rust parser.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TreeSitterRustParser } from '../analyzer/parsers/ts-rust-parser';
import { initTreeSitter, parseSource } from '../analyzer/tree-sitter-loader';
import { makeFileInfo } from './helpers';
import type Parser from 'web-tree-sitter';

const parser = new TreeSitterRustParser();

beforeAll(async () => {
    await initTreeSitter();
});

async function tree(content: string): Promise<Parser.Tree> {
    return parseSource('rust', content);
}

// ============================================================
// parseAST — use/mod
// ============================================================
describe('TreeSitterRustParser.parseAST', () => {
    it('extracts use declarations', async () => {
        const content = 'use std::collections::HashMap;\nuse std::io::{self, Read};\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'main.rs', content, language: 'rust', extension: '.rs' });
        const rels = parser.parseAST(t, file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ target: 'std::collections::HashMap', type: 'use' });
        expect(rels[1]).toMatchObject({ target: 'std::io::{self, Read}', type: 'use' });
    });

    it('extracts mod declarations', async () => {
        const content = 'mod config;\nmod utils;\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'main.rs', content, language: 'rust', extension: '.rs' });
        const rels = parser.parseAST(t, file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ target: 'config', type: 'mod' });
        expect(rels[1]).toMatchObject({ target: 'utils', type: 'mod' });
    });

    it('returns empty for no imports', async () => {
        const content = 'fn main() {}\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'main.rs', content, language: 'rust', extension: '.rs' });
        expect(parser.parseAST(t, file)).toHaveLength(0);
    });
});

// ============================================================
// extractSymbolsAST
// ============================================================
describe('TreeSitterRustParser.extractSymbolsAST', () => {
    it('extracts functions with visibility', async () => {
        const content = 'pub fn public_func() {}\nfn private_func() {}\npub async fn async_func() {}\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'lib.rs', content, language: 'rust', extension: '.rs' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.functions).toHaveLength(3);
        expect(symbols.functions[0]).toMatchObject({ name: 'public_func', visibility: 'public' });
        expect(symbols.functions[1]).toMatchObject({ name: 'private_func' });
        expect(symbols.functions[1].visibility).toBeUndefined();
        expect(symbols.functions[2]).toMatchObject({ name: 'async_func', isAsync: true });
        expect(symbols.exports.find(e => e.name === 'public_func')).toBeDefined();
    });

    it('extracts structs', async () => {
        const content = 'pub struct Animal {\n    name: String,\n}\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'models.rs', content, language: 'rust', extension: '.rs' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.structs).toHaveLength(1);
        expect(symbols.structs[0].name).toBe('Animal');
        expect(symbols.exports.find(e => e.name === 'Animal')).toBeDefined();
    });

    it('extracts traits', async () => {
        const content = 'pub trait Speaker {\n    fn speak(&self) -> String;\n}\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'traits.rs', content, language: 'rust', extension: '.rs' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.traits).toHaveLength(1);
        expect(symbols.traits[0].name).toBe('Speaker');
    });

    it('extracts enums', async () => {
        const content = 'pub enum Color {\n    Red,\n    Green,\n    Blue,\n}\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'enums.rs', content, language: 'rust', extension: '.rs' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.enums).toHaveLength(1);
        expect(symbols.enums[0].name).toBe('Color');
    });

    it('extracts impl methods with receiver', async () => {
        const content = [
            'struct Animal { name: String }',
            'impl Animal {',
            '    pub fn new(name: String) -> Self { Animal { name } }',
            '    fn helper(&self) {}',
            '}',
        ].join('\n');
        const t = await tree(content);
        const file = makeFileInfo({ id: 'animal.rs', content, language: 'rust', extension: '.rs' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.methods).toHaveLength(2);
        expect(symbols.methods[0]).toMatchObject({ name: 'new', visibility: 'public' });
        expect((symbols.methods[0] as any).receiver).toBe('Animal');
        expect(symbols.methods[1].name).toBe('helper');
    });

    it('extracts trait impl methods', async () => {
        const content = [
            'pub trait Speaker { fn speak(&self) -> String; }',
            'struct Dog {}',
            'impl Speaker for Dog {',
            '    fn speak(&self) -> String { "Woof".to_string() }',
            '}',
        ].join('\n');
        const t = await tree(content);
        const file = makeFileInfo({ id: 'dog.rs', content, language: 'rust', extension: '.rs' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.methods.find(m => m.name === 'speak')).toBeDefined();
        expect((symbols.methods.find(m => m.name === 'speak') as any).receiver).toBe('Dog');
    });
});

// ============================================================
// Heritage (impl Trait for Struct)
// ============================================================
describe('TreeSitterRustParser.extractHeritageRelations', () => {
    it('extracts impl Trait for Struct edges', async () => {
        const content = [
            'trait Speaker { fn speak(&self); }',
            'struct Dog {}',
            'impl Speaker for Dog { fn speak(&self) {} }',
        ].join('\n');
        const t = await tree(content);
        const file = makeFileInfo({ id: 'dog.rs', content, language: 'rust', extension: '.rs' });
        const rels = parser.extractHeritageRelations(t, file);
        expect(rels).toHaveLength(1);
        expect(rels[0]).toMatchObject({
            source: 'dog.rs', target: 'Speaker', type: 'implements',
        });
    });
});

// ============================================================
// Calls
// ============================================================
describe('TreeSitterRustParser.extractCallsAST', () => {
    it('extracts standalone function calls', async () => {
        const content = [
            'fn local_fn() {}',
            'fn main() {',
            '    local_fn();',
            '    external_fn();',
            '    Animal::new();',
            '    println!("hi");',
            '}',
        ].join('\n');
        const t = await tree(content);
        const calls = parser.extractCallsFromAST(t);
        expect(calls).toContain('external_fn');
        expect(calls).not.toContain('local_fn');
        // Animal::new is scoped, println! is a macro — both excluded
        expect(calls).not.toContain('new');
        expect(calls).not.toContain('println');
    });
});
