/**
 * ts-csharp-parser.test.ts — Tests for Tree-sitter based C# parser.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TreeSitterCSharpParser } from '../analyzer/parsers/ts-csharp-parser';
import { initTreeSitter, parseSource } from '../analyzer/tree-sitter-loader';
import { makeFileInfo } from './helpers';
import type Parser from 'web-tree-sitter';

const parser = new TreeSitterCSharpParser();

beforeAll(async () => {
    await initTreeSitter();
});

async function tree(content: string): Promise<Parser.Tree> {
    return parseSource('csharp', content);
}

// ============================================================
// parseAST — using directives
// ============================================================
describe('TreeSitterCSharpParser.parseAST', () => {
    it('extracts using directives (plain, nested and static)', async () => {
        const content = [
            'using System;',
            'using System.Collections.Generic;',
            'using static System.Math;',
            'namespace App {',
            '    using System.Text;',
            '}',
        ].join('\n');
        const t = await tree(content);
        const file = makeFileInfo({ id: 'A.cs', content, language: 'csharp', extension: '.cs' });
        const rels = parser.parseAST(t, file);
        const targets = rels.map(r => r.target);
        expect(targets).toContain('System');
        expect(targets).toContain('System.Collections.Generic');
        expect(targets).toContain('System.Text');
        expect(rels.every(r => r.type === 'import')).toBe(true);
    });

    it('returns empty for no usings', async () => {
        const content = 'public class A { }';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'A.cs', content, language: 'csharp', extension: '.cs' });
        expect(parser.parseAST(t, file)).toHaveLength(0);
    });
});

// ============================================================
// extractSymbolsAST
// ============================================================
describe('TreeSitterCSharpParser.extractSymbolsAST', () => {
    it('extracts classes, interfaces, structs and enums', async () => {
        const content = [
            'namespace App {',
            '    public class Animal {',
            '        private string name;',
            '        public void Speak() { }',
            '        public static int Count() { return 0; }',
            '    }',
            '    public interface IWalk { void Walk(); }',
            '    public struct Point { public int X; }',
            '    public enum Color { Red, Green }',
            '}',
        ].join('\n');
        const t = await tree(content);
        const file = makeFileInfo({ id: 'A.cs', content, language: 'csharp', extension: '.cs' });
        const symbols = parser.extractSymbolsAST(t, file);

        expect(symbols.classes.map(c => c.name)).toEqual(['Animal']);
        expect(symbols.classes[0].visibility).toBe('public');
        expect(symbols.interfaces.map(i => i.name)).toEqual(['IWalk']);
        expect(symbols.structs.map(s => s.name)).toEqual(['Point']);
        expect(symbols.enums.map(e => e.name)).toEqual(['Color']);
        expect(symbols.methods.map(m => m.name)).toEqual(['Speak', 'Count', 'Walk']);
        expect(symbols.methods[0].visibility).toBe('public');
        expect(symbols.methods[1].isStatic).toBe(true);
    });

    it('extracts records as classes', async () => {
        const content = 'public record UserDto(string Name, int Age);';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'A.cs', content, language: 'csharp', extension: '.cs' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.classes.map(c => c.name)).toEqual(['UserDto']);
    });
});

// ============================================================
// extractHeritageRelations
// ============================================================
describe('TreeSitterCSharpParser.extractHeritageRelations', () => {
    it('maps first base to extends and the rest to implements', async () => {
        const content = 'public class Dog : Animal, IWalkable, ISerializable { }';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'A.cs', content, language: 'csharp', extension: '.cs' });
        const rels = parser.extractHeritageRelations(t, file);
        expect(rels).toContainEqual(expect.objectContaining({ target: 'Animal', type: 'extends' }));
        expect(rels).toContainEqual(expect.objectContaining({ target: 'IWalkable', type: 'implements' }));
        expect(rels).toContainEqual(expect.objectContaining({ target: 'ISerializable', type: 'implements' }));
    });

    it('interfaces extend their bases', async () => {
        const content = 'public interface IAnimal : IWalk, ISwim { }';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'A.cs', content, language: 'csharp', extension: '.cs' });
        const rels = parser.extractHeritageRelations(t, file);
        expect(rels).toContainEqual(expect.objectContaining({ target: 'IWalk', type: 'extends' }));
        expect(rels).toContainEqual(expect.objectContaining({ target: 'ISwim', type: 'extends' }));
    });
});

// ============================================================
// Calls
// ============================================================
describe('TreeSitterCSharpParser calls', () => {
    it('extracts standalone calls but not member calls or own methods', async () => {
        const content = [
            'class A {',
            '    void Run() {',
            '        HelperGo();',
            '        other.Run();',
            '        Run();',
            '    }',
            '    void HelperGo() { }',
            '}',
        ].join('\n');
        const t = await tree(content);
        const calls = parser.extractCallsFromAST(t);
        expect(calls).not.toContain('Run');
        expect(calls.length).toBe(0); // HelperGo is defined here, other.Run is a member call
    });

    it('flags cross-file calls via global functions', async () => {
        const content = 'class A { void Run() { HelperGo(); } }';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'A.cs', content, language: 'csharp', extension: '.cs' });
        const rels = parser.extractCallsAST(t, file, new Set(['HelperGo']));
        expect(rels).toContainEqual(expect.objectContaining({ target: 'HelperGo', type: 'function-call' }));
    });

    it('extracts call sites with caller scope', async () => {
        const content = 'class A { void Run() { HelperGo(); } }';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'A.cs', content, language: 'csharp', extension: '.cs' });
        const sites = parser.extractCallSitesAST(t, file);
        expect(sites).toContainEqual(expect.objectContaining({ callerName: 'Run', calleeName: 'HelperGo', isLocal: false }));
    });
});
