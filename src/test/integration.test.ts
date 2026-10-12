import { describe, it, expect, beforeAll } from 'vitest';
import { buildGraph, preParseFiles } from '../analyzer/graph-builder';
import { initTreeSitter } from '../analyzer/tree-sitter-loader';
import { makeFileInfo } from './helpers';
import type { GraphData } from '../analyzer/types';

/**
 * Integration test — simulates a small multi-language project
 * going through the full analysis pipeline.
 */
describe('Integration: full analysis pipeline', () => {
    const files = [
        makeFileInfo({
            id: 'src/main.c',
            content: [
                '#include "utils.h"',
                '#include "config.h"',
                '',
                'int main(int argc, char** argv) {',
                '    init();',
                '    process(argc);',
                '    return 0;',
                '}',
            ].join('\n'),
            language: 'c', extension: '.c', group: 'src',
        }),
        makeFileInfo({
            id: 'src/utils.c',
            content: [
                '#include "utils.h"',
                '',
                'void init(void) {',
                '    setup_logger();',
                '}',
                '',
                'int process(int n) {',
                '    if (n > 0) return n;',
                '    return 0;',
                '}',
            ].join('\n'),
            language: 'c', extension: '.c', group: 'src',
        }),
        makeFileInfo({
            id: 'src/utils.h',
            content: [
                '#ifndef UTILS_H',
                '#define UTILS_H',
                '',
                'void init(void);',
                'int process(int n);',
                '',
                '#endif',
            ].join('\n'),
            language: 'c', extension: '.h', group: 'src',
        }),
        makeFileInfo({
            id: 'src/config.h',
            content: [
                '#ifndef CONFIG_H',
                '#define CONFIG_H',
                '',
                '#define MAX_SIZE 1024',
                '#define VERSION "1.0"',
                '',
                'typedef struct {',
                '    int width;',
                '    int height;',
                '} Config;',
                '',
                'enum LogLevel {',
                '    LOG_DEBUG,',
                '    LOG_INFO,',
                '    LOG_ERROR',
                '};',
                '',
                '#endif',
            ].join('\n'),
            language: 'c', extension: '.h', group: 'src',
        }),
        makeFileInfo({
            id: 'web/index.html',
            content: [
                '<!DOCTYPE html>',
                '<html>',
                '<head>',
                '    <link href="style.css" rel="stylesheet">',
                '</head>',
                '<body>',
                '    <script src="app.js"></script>',
                '</body>',
                '</html>',
            ].join('\n'),
            language: 'html', extension: '.html', group: 'web',
        }),
        makeFileInfo({
            id: 'web/style.css',
            content: [
                '@import "reset.css";',
                'body { color: #333; }',
                'h1 { font-size: 2em; }',
                '@media (max-width: 600px) { body { font-size: 14px; } }',
            ].join('\n'),
            language: 'css', extension: '.css', group: 'web',
        }),
        makeFileInfo({
            id: 'web/app.js',
            content: [
                "import { render } from './components';",
                '',
                'if (document.readyState === "loading") {',
                '    document.addEventListener("DOMContentLoaded", render);',
                '} else {',
                '    render();',
                '}',
            ].join('\n'),
            language: 'javascript', extension: '.js', group: 'web',
        }),
        makeFileInfo({
            id: 'scripts/deploy.py',
            content: [
                'import os',
                'import sys',
                'from pathlib import Path',
                '',
                'def deploy():',
                '    pass',
            ].join('\n'),
            language: 'python', extension: '.py', group: 'scripts',
        }),
    ];

    let graph: GraphData;

    beforeAll(async () => {
        await initTreeSitter();
        const trees = await preParseFiles(files);
        graph = buildGraph(files, 'TestProject', {}, trees);
    });

    it('produces correct number of nodes', () => {
        expect(graph.nodes).toHaveLength(8);
    });

    it('produces resolved links for C includes', () => {
        const mainToUtils = graph.links.find(
            l => l.source === 'src/main.c' && l.target === 'src/utils.h'
        );
        expect(mainToUtils).toBeDefined();
        expect(mainToUtils!.type).toBe('include');

        const mainToConfig = graph.links.find(
            l => l.source === 'src/main.c' && l.target === 'src/config.h'
        );
        expect(mainToConfig).toBeDefined();
    });

    it('detects cross-file function calls', () => {
        const callLinks = graph.links.filter(l => l.type === 'function-call');
        // main.c calls init() and process() defined in utils.c
        const initCall = callLinks.find(l => l.label.includes('init'));
        expect(initCall).toBeDefined();
        expect(initCall!.source).toBe('src/main.c');
        expect(initCall!.target).toBe('src/utils.c');
    });

    it('extracts symbols for C files', () => {
        const utilsNode = graph.nodes.find(n => n.id === 'src/utils.c')!;
        expect(utilsNode.symbols).toBeDefined();
        expect(utilsNode.symbols!.functions.length).toBeGreaterThanOrEqual(2);

        const configNode = graph.nodes.find(n => n.id === 'src/config.h')!;
        expect(configNode.symbols).toBeDefined();
        expect(configNode.symbols!.macros.length).toBeGreaterThanOrEqual(2);
        expect(configNode.symbols!.enums.length).toBeGreaterThanOrEqual(1);
    });

    it('resolves HTML references', () => {
        const htmlLinks = graph.links.filter(l => l.source === 'web/index.html');
        const scriptLink = htmlLinks.find(l => l.type === 'script');
        expect(scriptLink).toBeDefined();
        expect(scriptLink!.target).toBe('web/app.js');
    });

    it('computes complexity > 1 for branchy code', () => {
        const mainNode = graph.nodes.find(n => n.id === 'web/app.js')!;
        expect(mainNode.complexity).toBeGreaterThanOrEqual(2);
    });

    it('computes correct language stats', () => {
        const stats = graph.meta.languageStats;
        expect(stats['c'].count).toBe(4);
        expect(stats['javascript'].count).toBe(1);
        expect(stats['html'].count).toBe(1);
        expect(stats['css'].count).toBe(1);
        expect(stats['python'].count).toBe(1);
    });

    it('produces correct groups', () => {
        expect(graph.meta.groups).toContain('src');
        expect(graph.meta.groups).toContain('web');
        expect(graph.meta.groups).toContain('scripts');
    });

    it('has correct project metadata', () => {
        expect(graph.meta.projectName).toBe('TestProject');
        expect(graph.meta.totalFiles).toBe(8);
        expect(graph.meta.totalLinks).toBeGreaterThan(0);
    });

    it('tracks unresolved references', () => {
        // web/app.js imports './components' which doesn't exist,
        // web/style.css imports 'reset.css' which doesn't exist,
        // scripts/deploy.py imports 'os', 'sys', 'pathlib' which don't exist
        expect(graph.meta.unresolvedReferences).toBeGreaterThanOrEqual(2);
    });
});

/**
 * Integration test for the languages added later: C#, PHP, Vue, Bash and Lua
 * running through the full analysis pipeline (preParseFiles + buildGraph).
 */
describe('Integration: C#, PHP, Vue, Bash and Lua', () => {
    const files = [
        makeFileInfo({
            id: 'src/App.cs',
            content: 'class Dog : Animal {\n    void Speak() { }\n}\n',
            language: 'csharp', extension: '.cs', group: 'src',
        }),
        makeFileInfo({
            id: 'src/Animal.cs',
            content: 'public class Animal {\n    public void Breathe() { }\n}\n',
            language: 'csharp', extension: '.cs', group: 'src',
        }),
        makeFileInfo({
            id: 'src/User.php',
            content: "<?php\nrequire_once 'helpers.php';\nclass User extends BaseModel {\n    public function greet() { return formatName('x'); }\n}\n",
            language: 'php', extension: '.php', group: 'src',
        }),
        makeFileInfo({
            id: 'src/BaseModel.php',
            content: '<?php\nclass BaseModel { }\n',
            language: 'php', extension: '.php', group: 'src',
        }),
        makeFileInfo({
            id: 'src/helpers.php',
            content: "<?php\nfunction formatName($n) { return $n; }\n",
            language: 'php', extension: '.php', group: 'src',
        }),
        makeFileInfo({
            id: 'scripts/main.sh',
            content: '#!/bin/bash\nsource ./lib.sh\nmain() { echo ok; }\nmain\n',
            language: 'bash', extension: '.sh', group: 'scripts',
        }),
        makeFileInfo({
            id: 'scripts/lib.sh',
            content: '#!/bin/bash\nlib_fn() { echo lib; }\n',
            language: 'bash', extension: '.sh', group: 'scripts',
        }),
        makeFileInfo({
            id: 'web/MyComponent.vue',
            content: '<template><div>{{ msg }}</div></template>\n<script>\nimport { helper } from "./helper.js";\nexport default { name: "MyComponent" };\n</script>\n',
            language: 'vue', extension: '.vue', group: 'web',
        }),
        makeFileInfo({
            id: 'web/helper.js',
            content: 'export function helper() { return 1; }\n',
            language: 'javascript', extension: '.js', group: 'web',
        }),
        makeFileInfo({
            id: 'scripts/main.lua',
            content: "local utils = require('utils')\nutilsHelpers()\n",
            language: 'lua', extension: '.lua', group: 'scripts',
        }),
        makeFileInfo({
            id: 'scripts/utils.lua',
            content: 'function utilsHelpers()\n    return 1\nend\n',
            language: 'lua', extension: '.lua', group: 'scripts',
        }),
    ];

    let graph: GraphData;

    beforeAll(async () => {
        await initTreeSitter();
        const trees = await preParseFiles(files);
        graph = buildGraph(files, 'NewLangs', {}, trees);
    });

    it('creates one node per file', () => {
        expect(graph.nodes).toHaveLength(11);
    });

    it('links C# inheritance', () => {
        const link = graph.links.find(l => l.source === 'src/App.cs' && l.target === 'src/Animal.cs');
        expect(link).toBeDefined();
        expect(link!.type).toBe('extends');
    });

    it('links PHP extends, require and cross-file calls', () => {
        expect(graph.links).toContainEqual(expect.objectContaining({ source: 'src/User.php', target: 'src/BaseModel.php', type: 'extends' }));
        expect(graph.links).toContainEqual(expect.objectContaining({ source: 'src/User.php', target: 'src/helpers.php', type: 'require' }));
        expect(graph.links).toContainEqual(expect.objectContaining({ source: 'src/User.php', target: 'src/helpers.php', type: 'function-call' }));
    });

    it('links Bash sourcing', () => {
        expect(graph.links).toContainEqual(expect.objectContaining({ source: 'scripts/main.sh', target: 'scripts/lib.sh', type: 'source' }));
    });

    it('links Vue script imports', () => {
        expect(graph.links).toContainEqual(expect.objectContaining({ source: 'web/MyComponent.vue', target: 'web/helper.js', type: 'import' }));
    });

    it('links Lua requires and cross-file calls', () => {
        expect(graph.links).toContainEqual(expect.objectContaining({ source: 'scripts/main.lua', target: 'scripts/utils.lua', type: 'require' }));
        expect(graph.links).toContainEqual(expect.objectContaining({ source: 'scripts/main.lua', target: 'scripts/utils.lua', type: 'function-call' }));
    });

    it('extracts symbols for the new languages', () => {
        const animal = graph.nodes.find(n => n.id === 'src/Animal.cs')!;
        expect(animal.symbols!.classes.map(c => c.name)).toContain('Animal');
        const helpers = graph.nodes.find(n => n.id === 'src/helpers.php')!;
        expect(helpers.symbols!.functions.map(f => f.name)).toContain('formatName');
        const lib = graph.nodes.find(n => n.id === 'scripts/lib.sh')!;
        expect(lib.symbols!.functions.map(f => f.name)).toContain('lib_fn');
        const utilsLua = graph.nodes.find(n => n.id === 'scripts/utils.lua')!;
        expect(utilsLua.symbols!.functions.map(f => f.name)).toContain('utilsHelpers');
    });
});
