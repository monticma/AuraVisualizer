/**
 * ts-bash-parser.test.ts — Tests for Tree-sitter based Bash parser.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { TreeSitterBashParser } from '../analyzer/parsers/ts-bash-parser';
import { initTreeSitter, parseSource } from '../analyzer/tree-sitter-loader';
import { makeFileInfo } from './helpers';
import type Parser from 'web-tree-sitter';

const parser = new TreeSitterBashParser();

beforeAll(async () => {
    await initTreeSitter();
});

async function tree(content: string): Promise<Parser.Tree> {
    return parseSource('bash', content);
}

describe('TreeSitterBashParser.parseAST', () => {
    it('extracts source / dot relations', async () => {
        const content = '#!/bin/bash\nsource ./lib/utils.sh\n. ./lib/other.sh\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'main.sh', content, language: 'bash', extension: '.sh' });
        const rels = parser.parseAST(t, file);
        expect(rels).toContainEqual(expect.objectContaining({ target: './lib/utils.sh', type: 'source' }));
        expect(rels).toContainEqual(expect.objectContaining({ target: './lib/other.sh', type: 'source' }));
    });

    it('extracts script executions (runner and direct call)', async () => {
        const content = '#!/bin/bash\nbash ./scripts/deploy.sh\n./build.sh\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'main.sh', content, language: 'bash', extension: '.sh' });
        const rels = parser.parseAST(t, file);
        expect(rels).toContainEqual(expect.objectContaining({ target: './scripts/deploy.sh', type: 'script' }));
        expect(rels).toContainEqual(expect.objectContaining({ target: './build.sh', type: 'script' }));
    });

    it('ignores dynamic targets with variables', async () => {
        const content = '#!/bin/bash\nsource "$DIR/utils.sh"\nbash "$HOME/x.sh"\n';
        const t = await tree(content);
        const file = makeFileInfo({ id: 'main.sh', content, language: 'bash', extension: '.sh' });
        expect(parser.parseAST(t, file)).toHaveLength(0);
    });
});

describe('TreeSitterBashParser.extractSymbolsAST', () => {
    it('extracts functions with and without the function keyword', async () => {
        const content = [
            '#!/bin/bash',
            'function build() {',
            '    echo "building"',
            '}',
            'main() {',
            '    build',
            '}',
        ].join('\n');
        const t = await tree(content);
        const file = makeFileInfo({ id: 'main.sh', content, language: 'bash', extension: '.sh' });
        const symbols = parser.extractSymbolsAST(t, file);
        expect(symbols.functions.map(f => f.name)).toEqual(['build', 'main']);
    });
});
