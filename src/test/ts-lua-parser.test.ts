/**
 * ts-lua-parser.test.ts — Tests for Tree-sitter based Lua parser.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TreeSitterLuaParser } from '../analyzer/parsers/ts-lua-parser';
import { initTreeSitter, parseSource } from '../analyzer/tree-sitter-loader';
import { makeFileInfo } from './helpers';
import type Parser from 'web-tree-sitter';

const parser = new TreeSitterLuaParser();

beforeAll(async () => {
    await initTreeSitter();
});

async function tree(content: string): Promise<Parser.Tree> {
    return parseSource('lua', content);
}

describe('TreeSitterLuaParser.parseAST', () => {
    it('extracts require and dofile relations', async () => {
        const content = [
            "local utils = require('lib.utils')",
            'local core = require "core"',
            "local json = dofile('vendor/json.lua')",
        ].join('\n');
        const t = await tree(content);
        const file = makeFileInfo({ id: 'main.lua', content, language: 'lua', extension: '.lua' });
        const rels = parser.parseAST(t, file);
        const targets = rels.map(r => r.target);
        expect(targets).toContain('lib.utils');
        expect(targets).toContain('core');
        expect(targets).toContain('vendor/json.lua');
        expect(rels.every(r => r.type === 'require')).toBe(true);
    });

    it('deduplicates repeated requires', async () => {
        const content = "local a = require('same')\nlocal b = require('same')\n";
        const t = await tree(content);
        const file = makeFileInfo({ id: 'main.lua', content, language: 'lua', extension: '.lua' });
        expect(parser.parseAST(t, file).filter(r => r.target === 'same')).toHaveLength(1);
    });
});

describe('TreeSitterLuaParser.extractSymbolsAST', () => {
    it('extracts functions (table methods and local functions)', async () => {
        const content = [
            'local M = {}',
            'function M.greet(name)',
            '    return name',
            'end',
            'local function helper()',
            '    return 1',
            'end',
            'function top_level()',
            '    return helper()',
            'end',
            'return M',
        ].join('\n');
        const t = await tree(content);
        const file = makeFileInfo({ id: 'main.lua', content, language: 'lua', extension: '.lua' });
        const symbols = parser.extractSymbolsAST(t, file);
        const names = symbols.functions.map(f => f.name);
        expect(names).toContain('M.greet');
        expect(names).toContain('helper');
        expect(names).toContain('top_level');
    });
});

describe('TreeSitterLuaParser calls', () => {
    it('collects standalone calls, skips builtins and local functions', async () => {
        const content = [
            'local function run()',
            '    helper()',
            '    externalThing()',
            '    print("x")',
            'end',
            'local function helper() end',
        ].join('\n');
        const t = await tree(content);
        const calls = parser.extractCallsFromAST(t);
        expect(calls).toContain('externalThing');
        expect(calls).not.toContain('helper');
        expect(calls).not.toContain('print');
    });

    it('extracts call sites with caller scope', async () => {
        const content = 'local function run()\n    externalThing()\nend\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'main.lua', content, language: 'lua', extension: '.lua' });
        const sites = parser.extractCallSitesAST(t, file);
        expect(sites).toContainEqual(expect.objectContaining({ callerName: 'run', calleeName: 'externalThing', isLocal: false }));
    });
});
