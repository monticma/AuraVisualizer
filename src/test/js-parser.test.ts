import { describe, it, expect } from 'vitest';
import { JSParser } from '../analyzer/parsers/js-parser';
import { TSParser } from '../analyzer/parsers/ts-parser';
import { makeFileInfo } from './helpers';

const jsParser = new JSParser();
const tsParser = new TSParser();

describe('JSParser.parse', () => {
    it('extracts ES import statements', () => {
        const file = makeFileInfo({
            id: 'app.js',
            content: "import { foo } from './utils';\nimport bar from 'lodash';\n",
            language: 'javascript', extension: '.js',
        });
        const rels = jsParser.parse(file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ source: 'app.js', target: './utils', type: 'import' });
        expect(rels[1]).toMatchObject({ source: 'app.js', target: 'lodash', type: 'import' });
    });

    it('extracts require() calls', () => {
        const file = makeFileInfo({
            id: 'index.js',
            content: "const fs = require('fs');\nconst path = require('path');\n",
            language: 'javascript', extension: '.js',
        });
        const rels = jsParser.parse(file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ target: 'fs', type: 'require' });
        expect(rels[1]).toMatchObject({ target: 'path', type: 'require' });
    });

    it('extracts dynamic import()', () => {
        const file = makeFileInfo({
            id: 'router.js',
            content: "const mod = await import('./views/home.js');\n",
            language: 'javascript', extension: '.js',
        });
        const rels = jsParser.parse(file);
        expect(rels).toHaveLength(1);
        expect(rels[0]).toMatchObject({ target: './views/home.js', type: 'dynamic-import' });
    });

    it('extracts dynamic import with template literal and strips query string', () => {
        const file = makeFileInfo({
            id: 'loader.js',
            content: "const mod = await import(`./views/agents.js?v=${cacheBuster}`);\n",
            language: 'javascript', extension: '.js',
        });
        const rels = jsParser.parse(file);
        expect(rels.length).toBeGreaterThanOrEqual(1);
        const tplRel = rels.find(r => r.target.includes('agents'));
        expect(tplRel).toBeDefined();
        expect(tplRel!.target).toBe('./views/agents.js');
    });

    it('handles mixed import styles', () => {
        const file = makeFileInfo({
            id: 'mixed.js',
            content: [
                "import { a } from './a';",
                "const b = require('./b');",
                "import('./c');",
                "",
            ].join('\n'),
            language: 'javascript', extension: '.js',
        });
        const rels = jsParser.parse(file);
        expect(rels).toHaveLength(3);
    });

    it('returns empty for no imports', () => {
        const file = makeFileInfo({
            id: 'pure.js',
            content: 'const x = 42;\nconsole.log(x);\n',
            language: 'javascript', extension: '.js',
        });
        expect(jsParser.parse(file)).toHaveLength(0);
    });
});

describe('TSParser.parse', () => {
    it('inherits JS parsing and works with TypeScript imports', () => {
        const file = makeFileInfo({
            id: 'app.ts',
            content: "import type { Config } from './types';\nimport { serve } from './server';\n",
            language: 'typescript', extension: '.ts',
        });
        const rels = tsParser.parse(file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ target: './types', type: 'import' });
        expect(rels[1]).toMatchObject({ target: './server', type: 'import' });
    });
});
