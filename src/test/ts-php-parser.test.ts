/**
 * ts-php-parser.test.ts — Tests for Tree-sitter based PHP parser.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TreeSitterPhpParser } from '../analyzer/parsers/ts-php-parser';
import { initTreeSitter, parseSource } from '../analyzer/tree-sitter-loader';
import { makeFileInfo } from './helpers';
import type Parser from 'web-tree-sitter';

const parser = new TreeSitterPhpParser();

beforeAll(async () => {
    await initTreeSitter();
});

async function tree(content: string): Promise<Parser.Tree> {
    return parseSource('php', content);
}

// ============================================================
// parseAST — use / require / include
// ============================================================
describe('TreeSitterPhpParser.parseAST', () => {
    it('extracts use statements', async () => {
        const content = "<?php\nnamespace App\\Models;\nuse App\\Contracts\\Jsonable;\nuse App\\Support\\Str;\n";
        const t = await tree(content);
        const file = makeFileInfo({ id: 'User.php', content, language: 'php', extension: '.php' });
        const rels = parser.parseAST(t, file);
        const imports = rels.filter(r => r.type === 'import').map(r => r.target);
        expect(imports).toContain('App\\Contracts\\Jsonable');
        expect(imports).toContain('App\\Support\\Str');
    });

    it('extracts require and include expressions', async () => {
        const content = "<?php\nrequire_once 'BaseModel.php';\ninclude 'helpers.php';\nrequire __DIR__ . '/x.php';\n";
        const t = await tree(content);
        const file = makeFileInfo({ id: 'User.php', content, language: 'php', extension: '.php' });
        const rels = parser.parseAST(t, file);
        expect(rels).toContainEqual(expect.objectContaining({ target: 'BaseModel.php', type: 'require' }));
        expect(rels).toContainEqual(expect.objectContaining({ target: 'helpers.php', type: 'include' }));
    });
});

// ============================================================
// extractSymbolsAST
// ============================================================
describe('TreeSitterPhpParser.extractSymbolsAST', () => {
    it('extracts classes, interfaces, functions and methods', async () => {
        const content = [
            '<?php',
            'class User {',
            '    private $name;',
            '    public function __construct($name) { $this->name = $name; }',
            '    private function hashName() { return md5($this->name); }',
            '}',
            'interface Jsonable { public function toJson(): string; }',
            'trait HasId { }',
            'function formatName($n) { return trim($n); }',
        ].join('\n');
        const t = await tree(content);
        const file = makeFileInfo({ id: 'User.php', content, language: 'php', extension: '.php' });
        const symbols = parser.extractSymbolsAST(t, file);

        expect(symbols.classes.map(c => c.name)).toEqual(['User']);
        expect(symbols.interfaces.map(i => i.name)).toEqual(['Jsonable']);
        expect(symbols.traits.map(tr => tr.name)).toEqual(['HasId']);
        expect(symbols.functions.map(f => f.name)).toEqual(['formatName']);
        expect(symbols.methods.map(m => m.name)).toEqual(['__construct', 'hashName', 'toJson']);
        expect(symbols.methods.find(m => m.name === 'hashName')?.visibility).toBe('private');
    });
});

// ============================================================
// extractHeritageRelations
// ============================================================
describe('TreeSitterPhpParser.extractHeritageRelations', () => {
    it('maps extends and implements', async () => {
        const content = '<?php\nclass User extends BaseModel implements Jsonable, Countable { }\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'User.php', content, language: 'php', extension: '.php' });
        const rels = parser.extractHeritageRelations(t, file);
        expect(rels).toContainEqual(expect.objectContaining({ target: 'BaseModel', type: 'extends' }));
        expect(rels).toContainEqual(expect.objectContaining({ target: 'Jsonable', type: 'implements' }));
        expect(rels).toContainEqual(expect.objectContaining({ target: 'Countable', type: 'implements' }));
    });
});

// ============================================================
// Calls
// ============================================================
describe('TreeSitterPhpParser calls', () => {
    it('finds standalone calls, skips builtins and own functions', async () => {
        const content = [
            '<?php',
            'function greet($name) { return formatName(trim($name)); }',
        ].join('\n');
        const t = await tree(content);
        const calls = parser.extractCallsFromAST(t);
        expect(calls).toContain('formatName');
        expect(calls).not.toContain('trim');
        expect(calls).not.toContain('greet');
    });

    it('extracts call sites with caller scope', async () => {
        const content = '<?php\nfunction greet($n) { return formatName($n); }\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'a.php', content, language: 'php', extension: '.php' });
        const sites = parser.extractCallSitesAST(t, file);
        expect(sites).toContainEqual(expect.objectContaining({ callerName: 'greet', calleeName: 'formatName', isLocal: false }));
    });

    it('flags cross-file calls via global functions', async () => {
        const content = '<?php\nfunction greet($n) { return formatName($n); }\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'a.php', content, language: 'php', extension: '.php' });
        const rels = parser.extractCallsAST(t, file, new Set(['formatName']));
        expect(rels).toContainEqual(expect.objectContaining({ target: 'formatName', type: 'function-call' }));
    });
});
