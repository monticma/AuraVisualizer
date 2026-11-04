import { describe, it, expect, beforeAll } from 'vitest';
import { preParseFiles } from '../analyzer/graph-builder';
import { initTreeSitter } from '../analyzer/tree-sitter-loader';
import {
    collectNamespaceDefs,
    collectNamespaceUses,
    globalUseLabel,
    namespaceFromLabel,
    GLOBAL_USE_CONFIDENCE,
} from '../analyzer/global-refs';
import { buildGraph, buildIncrementalContext, rebuildSingleFile, restoreIncrementalContext } from '../analyzer/graph-builder';
import { makeFileInfo } from './helpers';
import type { FileInfo } from '../analyzer/types';

beforeAll(async () => {
    await initTreeSitter();
});

async function treeOf(id: string, content: string) {
    const files = [makeFileInfo({ id, content, language: 'javascript', extension: '.js' })];
    const trees = await preParseFiles(files);
    return trees.get(id)!;
}

describe('collectNamespaceDefs', () => {
    it('finds window / globalThis / self assignments', async () => {
        const tree = await treeOf('a.js', [
            'window.AuraSprites = { ripple: function () {} };',
            'globalThis.AuraWarps = {};',
            'self.AuraViews = {};',
        ].join('\n'));
        const defs = collectNamespaceDefs(tree.rootNode as never);
        expect(defs.map(d => d.name)).toEqual(['AuraSprites', 'AuraWarps', 'AuraViews']);
        expect(defs[0].line).toBe(1);
        expect(defs[2].line).toBe(3);
    });

    it('ignores plain locals, short names and properties of other objects', async () => {
        const tree = await treeOf('b.js', [
            'var AuraSprites = {};',
            'window.x = 1;',
            'app.AuraDetail = {};',
            'window.AuraDetail = {};',
        ].join('\n'));
        expect(collectNamespaceDefs(tree.rootNode as never).map(d => d.name)).toEqual(['AuraDetail']);
    });

    it('keeps one definition per name', async () => {
        const tree = await treeOf('c.js', [
            'window.AuraFlowView = window.AuraFlowView || {};',
            'window.AuraFlowView.version = 2;',
        ].join('\n'));
        const defs = collectNamespaceDefs(tree.rootNode as never);
        expect(defs).toHaveLength(1);
        expect(defs[0].line).toBe(1);
    });
});

describe('collectNamespaceUses', () => {
    it('collects one entry per namespace.member pair, with its line', async () => {
        const tree = await treeOf('a.js', [
            'AuraSprites.ripple(1);',
            'AuraSprites.ripple(2);',
            'AuraSprites.dirtyRing();',
        ].join('\n'));
        const uses = collectNamespaceUses(tree.rootNode as never, new Set(['AuraSprites']));
        expect(uses.map(u => `${u.name}.${u.member}`)).toEqual(['AuraSprites.ripple', 'AuraSprites.dirtyRing']);
        expect(uses[0].line).toBe(1);
        expect(uses[1].line).toBe(3);
    });

    it('never reports the definition as a use', async () => {
        const tree = await treeOf('b.js', 'window.AuraSprites = {};\n');
        expect(collectNamespaceUses(tree.rootNode as never, new Set(['AuraSprites']))).toEqual([]);
    });

    it('sees guarded accesses through window', async () => {
        const tree = await treeOf('d.js', [
            'if (window.AuraTimeline) window.AuraTimeline.setup();',
            'var s = window.AuraTimeline && window.AuraTimeline.state();',
            'window.AuraSprites = {};',
        ].join('\n'));
        const uses = collectNamespaceUses(tree.rootNode as never, new Set(['AuraTimeline', 'AuraSprites']));
        expect(uses.map(u => `${u.name}.${u.member}`)).toEqual(['AuraTimeline.setup', 'AuraTimeline.state']);
    });

    it('ignores names that are not registered and comment text', async () => {
        const tree = await treeOf('c.js', [
            '// AuraSprites.ripple() does nothing',
            '/* AuraSprites.ripple() */',
            'Other.thing();',
        ].join('\n'));
        expect(collectNamespaceUses(tree.rootNode as never, new Set(['AuraSprites']))).toEqual([]);
    });
});

describe('labels', () => {
    it('formats and parses the edge label', () => {
        expect(globalUseLabel({ name: 'AuraSprites', member: 'ripple' })).toBe('AuraSprites.ripple');
        expect(namespaceFromLabel('AuraSprites.ripple')).toBe('AuraSprites');
        expect(namespaceFromLabel('')).toBe('');
    });

    it('exposes the confidence used on the edge', () => {
        expect(GLOBAL_USE_CONFIDENCE).toBe(0.6);
    });
});

describe('buildGraph — global-use edges', () => {
    const files: FileInfo[] = [
        makeFileInfo({
            id: 'webview/js/sprites.js',
            content: [
                '(function () {',
                "    'use strict';",
                '    window.AuraSprites = {',
                '        ripple: function () { return 1; },',
                '        dirtyRing: function () { return 2; },',
                '    };',
                '})();',
            ].join('\n'),
            language: 'javascript',
            extension: '.js',
            group: 'webview',
        }),
        makeFileInfo({
            id: 'webview/js/app.js',
            content: [
                'AuraSprites.ripple(3);',
                'AuraSprites.dirtyRing();',
                'Unrelated.thing();',
            ].join('\n'),
            language: 'javascript',
            extension: '.js',
            group: 'webview',
        }),
        makeFileInfo({
            id: 'webview/js/lonely.js',
            content: 'var x = 1;\n',
            language: 'javascript',
            extension: '.js',
            group: 'webview',
        }),
    ];

    it('links the user to the file defining the namespace', async () => {
        const trees = await preParseFiles(files);
        const graph = buildGraph(files, 'Project', {}, trees);
        const globalUses = graph.links.filter(l => l.type === 'global-use');
        expect(globalUses).toHaveLength(1);
        expect(globalUses[0]).toMatchObject({
            source: 'webview/js/app.js',
            target: 'webview/js/sprites.js',
            confidence: GLOBAL_USE_CONFIDENCE,
        });
        expect(globalUses[0].label).toMatch(/^AuraSprites\.(ripple|dirtyRing)$/);
    });

    it('counts in fan-in/fan-out like any other edge', async () => {
        const trees = await preParseFiles(files);
        const graph = buildGraph(files, 'Project', {}, trees);
        expect(graph.nodes.find(n => n.id === 'webview/js/sprites.js')!.fanIn).toBe(1);
        expect(graph.nodes.find(n => n.id === 'webview/js/app.js')!.fanOut).toBe(1);
        expect(graph.nodes.find(n => n.id === 'webview/js/lonely.js')!.fanIn).toBe(0);
    });

    it('never links a file to itself', async () => {
        const selfUser = makeFileInfo({
            id: 'self.js',
            content: 'window.AuraSelf = {};\nAuraSelf.run();\n',
            language: 'javascript',
            extension: '.js',
        });
        const trees = await preParseFiles([selfUser]);
        const graph = buildGraph([selfUser], 'Project', {}, trees);
        expect(graph.links.filter(l => l.type === 'global-use')).toHaveLength(0);
    });
});

describe('incremental global-use edges', () => {
    const provider = makeFileInfo({
        id: 'sprites.js',
        content: 'window.AuraSprites = { ripple: function () {} };\n',
        language: 'javascript',
        extension: '.js',
    });
    const user = makeFileInfo({
        id: 'app.js',
        content: 'AuraSprites.ripple(1);\n',
        language: 'javascript',
        extension: '.js',
    });

    it('keeps the namespace index in the context', async () => {
        const trees = await preParseFiles([provider, user]);
        const ctx = buildIncrementalContext([provider, user], trees);
        expect(ctx.globalNamespaces?.get('AuraSprites')).toBe('sprites.js');
        expect(ctx.fileNamespaces?.get('sprites.js')).toEqual(['AuraSprites']);
    });

    it('emits the edge for a changed caller', async () => {
        const trees = await preParseFiles([provider, user]);
        const ctx = buildIncrementalContext([provider, user], trees);
        const edited = makeFileInfo({
            id: 'app.js',
            content: 'AuraSprites.ripple(1);\nAuraSprites.dirtyRing();\n',
            language: 'javascript',
            extension: '.js',
        });
        const editTrees = await preParseFiles([edited]);
        const result = rebuildSingleFile(edited, ctx, editTrees.get('app.js'));
        const globalUse = result.outEdges.filter(l => l.type === 'global-use');
        expect(globalUse).toHaveLength(1);
        expect(globalUse[0]).toMatchObject({ source: 'app.js', target: 'sprites.js' });
    });

    it('re-registers a provider that gains a namespace, and drops a removed one', async () => {
        const trees = await preParseFiles([provider, user]);
        const ctx = buildIncrementalContext([provider, user], trees);

        const renamed = makeFileInfo({
            id: 'sprites.js',
            content: 'window.AuraArt = {};\n',
            language: 'javascript',
            extension: '.js',
        });
        const trees2 = await preParseFiles([renamed]);
        rebuildSingleFile(renamed, ctx, trees2.get('sprites.js'));
        expect(ctx.globalNamespaces?.has('AuraSprites')).toBe(false);
        expect(ctx.globalNamespaces?.get('AuraArt')).toBe('sprites.js');
        expect(ctx.fileNamespaces?.get('sprites.js')).toEqual(['AuraArt']);
    });

    it('restores the namespace index from cached graph data', async () => {
        const trees = await preParseFiles([provider, user]);
        const graph = buildGraph([provider, user], 'Project', {}, trees);
        const ctx = restoreIncrementalContext([provider, user], graph);
        expect(ctx.globalNamespaces?.get('AuraSprites')).toBe('sprites.js');

        const edited = makeFileInfo({
            id: 'app.js',
            content: 'AuraSprites.ripple(2);\n',
            language: 'javascript',
            extension: '.js',
        });
        const editTrees = await preParseFiles([edited]);
        const result = rebuildSingleFile(edited, ctx, editTrees.get('app.js'));
        expect(result.outEdges.some(l => l.type === 'global-use' && l.target === 'sprites.js')).toBe(true);
    });
});
