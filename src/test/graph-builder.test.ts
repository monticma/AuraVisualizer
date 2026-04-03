import { describe, it, expect, beforeAll } from 'vitest';
import { buildGraph, preParseFiles } from '../analyzer/graph-builder';
import { initTreeSitter } from '../analyzer/tree-sitter-loader';
import { makeFileInfo } from './helpers';

beforeAll(async () => {
    await initTreeSitter();
});

describe('buildGraph', () => {
    it('builds a graph with nodes and meta from file list', async () => {
        const files = [
            makeFileInfo({ id: 'main.c', content: '#include "utils.h"\nint main() { return 0; }\n', language: 'c', extension: '.c' }),
            makeFileInfo({ id: 'utils.h', content: 'int add(int, int);\n', language: 'c', extension: '.h' }),
        ];
        const trees = await preParseFiles(files);
        const graph = buildGraph(files, 'TestProject', {}, trees);
        expect(graph.meta.projectName).toBe('TestProject');
        expect(graph.meta.totalFiles).toBe(2);
        expect(graph.nodes).toHaveLength(2);
    });

    it('resolves include relations to links', async () => {
        const files = [
            makeFileInfo({ id: 'main.c', content: '#include "utils.h"\n', language: 'c', extension: '.c' }),
            makeFileInfo({ id: 'utils.h', content: 'void init(void);\n', language: 'c', extension: '.h' }),
        ];
        const trees = await preParseFiles(files);
        const graph = buildGraph(files, 'Project', {}, trees);
        expect(graph.links.length).toBeGreaterThanOrEqual(1);
        expect(graph.links[0]).toMatchObject({ source: 'main.c', target: 'utils.h', type: 'include' });
    });

    it('computes fan-in and fan-out correctly', async () => {
        const files = [
            makeFileInfo({ id: 'a.c', content: '#include "common.h"\n', language: 'c', extension: '.c' }),
            makeFileInfo({ id: 'b.c', content: '#include "common.h"\n', language: 'c', extension: '.c' }),
            makeFileInfo({ id: 'common.h', content: 'void shared(void);\n', language: 'c', extension: '.h' }),
        ];
        const trees = await preParseFiles(files);
        const graph = buildGraph(files, 'Project', {}, trees);
        const common = graph.nodes.find(n => n.id === 'common.h')!;
        expect(common.fanIn).toBe(2);
        expect(common.fanOut).toBe(0);
        const a = graph.nodes.find(n => n.id === 'a.c')!;
        expect(a.fanOut).toBe(1);
    });

    it('extracts C symbols and attaches to nodes', async () => {
        const files = [
            makeFileInfo({
                id: 'lib.c',
                content: 'int add(int a, int b) {\n    return a + b;\n}\n\nvoid init(void) {\n}\n',
                language: 'c', extension: '.c',
            }),
        ];
        const trees = await preParseFiles(files);
        const graph = buildGraph(files, 'Project', {}, trees);
        const node = graph.nodes[0];
        expect(node.symbols).toBeDefined();
        expect(node.symbols!.functions).toHaveLength(2);
        expect(node.symbols!.totalSymbols).toBeGreaterThanOrEqual(2);
    });

    it('detects cross-file function calls', async () => {
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
        const trees = await preParseFiles(files);
        const graph = buildGraph(files, 'Project', {}, trees);
        const callLink = graph.links.find(l => l.type === 'function-call');
        expect(callLink).toBeDefined();
        expect(callLink!.source).toBe('main.c');
        expect(callLink!.target).toBe('utils.c');
        expect(callLink!.label).toContain('helper');
    });

    it('resolves relative imports for JS files', async () => {
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
        const trees = await preParseFiles(files);
        const graph = buildGraph(files, 'Project', {}, trees);
        expect(graph.links).toHaveLength(1);
        expect(graph.links[0]).toMatchObject({ source: 'src/app.js', target: 'src/utils.js' });
    });

    it('tracks unresolved references', async () => {
        const files = [
            makeFileInfo({
                id: 'app.js',
                content: "import { x } from 'nonexistent-package';\n",
                language: 'javascript', extension: '.js',
            }),
        ];
        const trees = await preParseFiles(files);
        const graph = buildGraph(files, 'Project', {}, trees);
        expect(graph.meta.unresolvedReferences).toBeGreaterThanOrEqual(1);
    });

    it('deduplicates links', async () => {
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
        const trees = await preParseFiles(files);
        const graph = buildGraph(files, 'Project', {}, trees);
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

    it('resolves .h to .h include links with tree-sitter', async () => {
        const files = [
            makeFileInfo({
                id: 'Include/Agent/Kinematics/DHKinematics.h',
                content: '#include "Core/Types.h"\n#include "Agent/Kinematics/Matrix4x4.h"\nvoid dh_solve(void);\n',
                language: 'c', extension: '.h',
            }),
            makeFileInfo({ id: 'Include/Core/Types.h', content: 'typedef int TypeId;\n', language: 'c', extension: '.h' }),
            makeFileInfo({ id: 'Include/Agent/Kinematics/Matrix4x4.h', content: 'typedef struct { float m[16]; } Matrix4x4;\n', language: 'c', extension: '.h' }),
        ];
        const trees = await preParseFiles(files);
        const graph = buildGraph(files, 'Test', {}, trees);
        const dhLinks = graph.links.filter(l => l.source === 'Include/Agent/Kinematics/DHKinematics.h');
        expect(dhLinks).toHaveLength(2);
        expect(dhLinks.find(l => l.target === 'Include/Core/Types.h')).toBeDefined();
        expect(dhLinks.find(l => l.target === 'Include/Agent/Kinematics/Matrix4x4.h')).toBeDefined();
    });

    it('produces extends edges from TS class heritage', async () => {
        const files = [
            makeFileInfo({ id: 'base.ts', content: 'export class Base {\n  foo() {}\n}\n', language: 'typescript', extension: '.ts' }),
            makeFileInfo({ id: 'child.ts', content: 'import { Base } from "./base";\nexport class Child extends Base {\n  bar() {}\n}\n', language: 'typescript', extension: '.ts' }),
        ];
        const trees = await preParseFiles(files);
        const graph = buildGraph(files, 'Test', {}, trees);
        const extendsLink = graph.links.find(l => l.type === 'extends');
        expect(extendsLink).toBeDefined();
        expect(extendsLink!.source).toBe('child.ts');
        expect(extendsLink!.target).toBe('base.ts');
        expect(graph.meta.heritageLinks).toBeGreaterThanOrEqual(1);
    });

    it('produces implements edges from TS interface', async () => {
        const files = [
            makeFileInfo({ id: 'iface.ts', content: 'export interface ILogger {\n  log(msg: string): void;\n}\n', language: 'typescript', extension: '.ts' }),
            makeFileInfo({ id: 'impl.ts', content: 'import { ILogger } from "./iface";\nexport class ConsoleLogger implements ILogger {\n  log(msg: string) { console.log(msg); }\n}\n', language: 'typescript', extension: '.ts' }),
        ];
        const trees = await preParseFiles(files);
        const graph = buildGraph(files, 'Test', {}, trees);
        const implLink = graph.links.find(l => l.type === 'implements');
        expect(implLink).toBeDefined();
        expect(implLink!.source).toBe('impl.ts');
        expect(implLink!.target).toBe('iface.ts');
    });

    it('produces heritage edges for Python class inheritance', async () => {
        const files = [
            makeFileInfo({ id: 'animal.py', content: 'class Animal:\n    def speak(self):\n        pass\n', language: 'python', extension: '.py' }),
            makeFileInfo({ id: 'dog.py', content: 'from animal import Animal\nclass Dog(Animal):\n    def speak(self):\n        return "Woof"\n', language: 'python', extension: '.py' }),
        ];
        const trees = await preParseFiles(files);
        const graph = buildGraph(files, 'Test', {}, trees);
        const extendsLink = graph.links.find(l => l.type === 'extends');
        expect(extendsLink).toBeDefined();
        expect(extendsLink!.source).toBe('dog.py');
        expect(extendsLink!.target).toBe('animal.py');
    });

    it('populates functionCalls with caller/callee info', async () => {
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
        const trees = await preParseFiles(files);
        const graph = buildGraph(files, 'Project', {}, trees);
        expect(graph.functionCalls).toBeDefined();
        expect(graph.functionCalls!.length).toBeGreaterThan(0);
        const call = graph.functionCalls!.find(fc => fc.calleeName === 'helper');
        expect(call).toBeDefined();
        expect(call!.callerFile).toBe('main.c');
        expect(call!.callerName).toBe('main');
        expect(call!.calleeFile).toBe('utils.c');
        expect(call!.calleeName).toBe('helper');
    });

    it('includes intra-file function calls in functionCalls', async () => {
        const files = [
            makeFileInfo({
                id: 'app.js',
                content: [
                    'function validate() {}',
                    'function process() {',
                    '    validate();',
                    '}',
                ].join('\n'),
                language: 'javascript', extension: '.js',
            }),
        ];
        const trees = await preParseFiles(files);
        const graph = buildGraph(files, 'Project', {}, trees);
        const localCall = graph.functionCalls!.find(fc => fc.calleeName === 'validate');
        expect(localCall).toBeDefined();
        expect(localCall!.callerFile).toBe('app.js');
        expect(localCall!.calleeFile).toBe('app.js');
        expect(localCall!.callerName).toBe('process');
    });
});
