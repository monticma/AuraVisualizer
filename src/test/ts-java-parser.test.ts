/**
 * ts-java-parser.test.ts — Tests for Tree-sitter based Java parser.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TreeSitterJavaParser } from '../analyzer/parsers/ts-java-parser';
import { initTreeSitter, parseSource } from '../analyzer/tree-sitter-loader';
import { makeFileInfo } from './helpers';
import type Parser from 'web-tree-sitter';

const parser = new TreeSitterJavaParser();

beforeAll(async () => {
    await initTreeSitter();
});

async function tree(content: string): Promise<Parser.Tree> {
    return parseSource('java', content);
}

// ============================================================
// parseAST — imports
// ============================================================
describe('TreeSitterJavaParser.parseAST', () => {
    it('extracts import declarations', async () => {
        const content = 'import java.util.List;\nimport java.util.Map;\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'App.java', content, language: 'java', extension: '.java' });
        const rels = parser.parseAST(t, file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ target: 'java.util.List', type: 'import' });
        expect(rels[1]).toMatchObject({ target: 'java.util.Map', type: 'import' });
    });

    it('returns empty for no imports', async () => {
        const content = 'public class App { }';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'App.java', content, language: 'java', extension: '.java' });
        expect(parser.parseAST(t, file)).toHaveLength(0);
    });
});

// ============================================================
// extractSymbolsAST
// ============================================================
describe('TreeSitterJavaParser.extractSymbolsAST', () => {
    it('extracts classes with visibility', async () => {
        const content = 'public class UserService {\n    public void serve() {}\n}\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'UserService.java', content, language: 'java', extension: '.java' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.classes).toHaveLength(1);
        expect(symbols.classes[0]).toMatchObject({ name: 'UserService', type: 'class', visibility: 'public' });
    });

    it('extracts interfaces', async () => {
        const content = 'public interface Serializable {\n    String serialize();\n}\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'Serializable.java', content, language: 'java', extension: '.java' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.interfaces).toHaveLength(1);
        expect(symbols.interfaces[0].name).toBe('Serializable');
        expect(symbols.methods).toHaveLength(1);
        expect(symbols.methods[0].name).toBe('serialize');
    });

    it('extracts methods with modifiers', async () => {
        const content = [
            'public class Svc {',
            '    private void helper() {}',
            '    public static void main(String[] args) {}',
            '    protected int compute() { return 0; }',
            '}',
        ].join('\n');
        const t = await tree(content);
        const file = makeFileInfo({ id: 'Svc.java', content, language: 'java', extension: '.java' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.methods).toHaveLength(3);
        expect(symbols.methods.find(m => m.name === 'helper')?.visibility).toBe('private');
        expect(symbols.methods.find(m => m.name === 'main')?.isStatic).toBe(true);
        expect(symbols.methods.find(m => m.name === 'compute')?.visibility).toBe('protected');
    });

    it('extracts class heritage (extends + implements)', async () => {
        const content = 'public class Dog extends Animal implements Speaker, Serializable { }\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'Dog.java', content, language: 'java', extension: '.java' });
        const symbols = parser.extractSymbolsAST(t, file);
        const dog = symbols.classes[0] as any;
        expect(dog.extends).toBe('Animal');
        expect(dog.implements).toContain('Speaker');
        expect(dog.implements).toContain('Serializable');
    });

    it('extracts enums', async () => {
        const content = 'public enum Color { RED, GREEN, BLUE }\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'Color.java', content, language: 'java', extension: '.java' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.enums).toHaveLength(1);
        expect(symbols.enums[0].name).toBe('Color');
    });
});

// ============================================================
// Heritage relations
// ============================================================
describe('TreeSitterJavaParser.extractHeritageRelations', () => {
    it('extracts extends and implements edges', async () => {
        const content = 'class Child extends Base implements IService { }\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'Child.java', content, language: 'java', extension: '.java' });
        const rels = parser.extractHeritageRelations(t, file);
        expect(rels.find(r => r.type === 'extends')?.target).toBe('Base');
        expect(rels.find(r => r.type === 'implements')?.target).toBe('IService');
    });
});

// ============================================================
// Calls
// ============================================================
describe('TreeSitterJavaParser.extractCallsAST', () => {
    it('extracts standalone method calls', async () => {
        const content = [
            'class App {',
            '    void local() {}',
            '    void run() {',
            '        local();',
            '        externalCall();',
            '        System.out.println("hi");',
            '    }',
            '}',
        ].join('\n');
        const t = await tree(content);
        const calls = parser.extractCallsFromAST(t);
        expect(calls).toContain('externalCall');
        expect(calls).not.toContain('local');
        expect(calls).not.toContain('println');
    });
});
