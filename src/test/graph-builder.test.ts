import { describe, it, expect } from 'vitest';
import { buildGraph } from '../analyzer/graph-builder';
import { makeFileInfo } from './helpers';

describe('buildGraph', () => {
    it('builds a graph with nodes and meta from file list', () => {
        const files = [
            makeFileInfo({ id: 'main.c', content: '#include "utils.h"\nint main() { return 0; }\n', language: 'c', extension: '.c' }),
            makeFileInfo({ id: 'utils.h', content: 'int add(int, int);\n', language: 'c', extension: '.h' }),
        ];
        const graph = buildGraph(files, 'TestProject');
        expect(graph.meta.projectName).toBe('TestProject');
        expect(graph.meta.totalFiles).toBe(2);
        expect(graph.nodes).toHaveLength(2);
    });

    it('resolves include relations to links', () => {
        const files = [
            makeFileInfo({ id: 'main.c', content: '#include "utils.h"\n', language: 'c', extension: '.c' }),
            makeFileInfo({ id: 'utils.h', content: 'void init(void);\n', language: 'c', extension: '.h' }),
        ];
        const graph = buildGraph(files);
        expect(graph.links.length).toBeGreaterThanOrEqual(1);
        expect(graph.links[0]).toMatchObject({ source: 'main.c', target: 'utils.h', type: 'include' });
    });

    it('computes fan-in and fan-out correctly', () => {
        const files = [
            makeFileInfo({ id: 'a.c', content: '#include "common.h"\n', language: 'c', extension: '.c' }),
            makeFileInfo({ id: 'b.c', content: '#include "common.h"\n', language: 'c', extension: '.c' }),
            makeFileInfo({ id: 'common.h', content: 'void shared(void);\n', language: 'c', extension: '.h' }),
        ];
        const graph = buildGraph(files);
        const common = graph.nodes.find(n => n.id === 'common.h')!;
        expect(common.fanIn).toBe(2);
        expect(common.fanOut).toBe(0);
        const a = graph.nodes.find(n => n.id === 'a.c')!;
        expect(a.fanOut).toBe(1);
    });

    it('extracts C symbols and attaches to nodes', () => {
        const files = [
            makeFileInfo({
                id: 'lib.c',
                content: 'int add(int a, int b) {\n    return a + b;\n}\n\nvoid init(void) {\n}\n',
                language: 'c', extension: '.c',
            }),
        ];
        const graph = buildGraph(files);
        const node = graph.nodes[0];
        expect(node.symbols).toBeDefined();
        expect(node.symbols!.functions).toHaveLength(2);
        expect(node.symbols!.totalSymbols).toBeGreaterThanOrEqual(2);
    });

    it('detects cross-file function calls', () => {
        const files = [
            makeFileInfo({
                id: 'utils.c',
                content: 'void helper(void) {\n}\n',
                language: 'c', extension: '.c',
            }),
            makeFileInfo({
                id: 'main.c',
                content: 'void main() {\n    helper();\n}\n',
                language: 'c', extension: '.c',
            }),
        ];
        const graph = buildGraph(files);
        const callLink = graph.links.find(l => l.type === 'function-call');
        expect(callLink).toBeDefined();
        expect(callLink!.source).toBe('main.c');
        expect(callLink!.target).toBe('utils.c');
        expect(callLink!.label).toContain('helper');
    });

    it('resolves relative imports for JS files', () => {
        const files = [
            makeFileInfo({
                id: 'src/app.js',
                content: "import { x } from './utils';\n",
                language: 'javascript', extension: '.js',
            }),
            makeFileInfo({
                id: 'src/utils.js',
                content: 'export const x = 1;\n',
                language: 'javascript', extension: '.js',
            }),
        ];
        const graph = buildGraph(files);
        expect(graph.links).toHaveLength(1);
        expect(graph.links[0]).toMatchObject({ source: 'src/app.js', target: 'src/utils.js' });
    });

    it('tracks unresolved references', () => {
        const files = [
            makeFileInfo({
                id: 'app.js',
                content: "import { x } from 'nonexistent-package';\n",
                language: 'javascript', extension: '.js',
            }),
        ];
        const graph = buildGraph(files);
        expect(graph.meta.unresolvedReferences).toBeGreaterThanOrEqual(1);
    });

    it('deduplicates links', () => {
        const files = [
            makeFileInfo({
                id: 'a.c',
                content: '#include "b.h"\n#include "b.h"\n',
                language: 'c', extension: '.c',
            }),
            makeFileInfo({
                id: 'b.h',
                content: 'void foo(void);\n',
                language: 'c', extension: '.h',
            }),
        ];
        const graph = buildGraph(files);
        const includeLinks = graph.links.filter(l => l.source === 'a.c' && l.target === 'b.h' && l.type === 'include');
        expect(includeLinks).toHaveLength(1);
    });

    it('computes language stats', () => {
        const files = [
            makeFileInfo({ id: 'a.c', content: 'int main() {}\n', language: 'c', extension: '.c' }),
            makeFileInfo({ id: 'b.c', content: 'void f() {}\n', language: 'c', extension: '.c' }),
            makeFileInfo({ id: 'app.js', content: 'const x = 1;\n', language: 'javascript', extension: '.js' }),
        ];
        const graph = buildGraph(files);
        expect(graph.meta.languageStats['c']).toBeDefined();
        expect(graph.meta.languageStats['c'].count).toBe(2);
        expect(graph.meta.languageStats['javascript']).toBeDefined();
        expect(graph.meta.languageStats['javascript'].count).toBe(1);
    });

    it('computes complexity for each node', () => {
        const files = [
            makeFileInfo({
                id: 'complex.js',
                content: 'if (a) {} for (;;) {} while (true) {} switch(x) { case 1: break; }\n',
                language: 'javascript', extension: '.js',
            }),
        ];
        const graph = buildGraph(files);
        expect(graph.nodes[0].complexity).toBeGreaterThan(1);
    });

    it('builds groups from file paths', () => {
        const files = [
            makeFileInfo({ id: 'src/a.c', content: '\n', language: 'c', extension: '.c', group: 'src' }),
            makeFileInfo({ id: 'lib/b.c', content: '\n', language: 'c', extension: '.c', group: 'lib' }),
        ];
        const graph = buildGraph(files);
        expect(graph.meta.groups).toContain('src');
        expect(graph.meta.groups).toContain('lib');
    });

    it('handles empty file list', () => {
        const graph = buildGraph([]);
        expect(graph.nodes).toHaveLength(0);
        expect(graph.links).toHaveLength(0);
        expect(graph.meta.totalFiles).toBe(0);
    });
});
