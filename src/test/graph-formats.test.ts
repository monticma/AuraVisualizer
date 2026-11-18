import { describe, expect, it } from 'vitest';
import {
    DEFAULT_GRAPH_FORMAT_OPTIONS,
    buildGraphFormat,
    clusterOf,
    readFormatPayload,
    toDot,
    toGraphMl,
    toMermaid,
} from '../export/graph-formats';

/** Five files, two folders, one doc-reference, one guessed (global-use) edge. */
const GRAPH = {
    projectName: 'fixture',
    nodes: [
        { id: 'src/a.ts', name: 'a.ts', group: 'src', language: 'typescript', linesOfCode: 40, fanIn: 2, fanOut: 1 },
        { id: 'src/b.ts', name: 'b.ts', group: 'src', language: 'typescript', linesOfCode: 900, fanIn: 1, fanOut: 1 },
        { id: 'src/deep/c.ts', name: 'c.ts', group: 'src', language: 'typescript', linesOfCode: 1600, fanIn: 0, fanOut: 1 },
        { id: 'docs/readme.md', name: 'readme.md', group: 'docs', language: 'documentation', linesOfCode: 10, fanIn: 0, fanOut: 1 },
        { id: 'pkg.json', name: 'pkg.json', language: 'json', linesOfCode: 5, fanIn: 1, fanOut: 0 },
    ],
    links: [
        { source: 'src/b.ts', target: 'src/a.ts', type: 'import', confidence: 1 },
        { source: 'src/a.ts', target: 'src/deep/c.ts', type: 'import', confidence: 1 },
        { source: 'docs/readme.md', target: 'src/a.ts', type: 'doc-reference', confidence: 1 },
        { source: 'src/b.ts', target: 'pkg.json', type: 'global-use', confidence: 0.6 },
    ],
};

describe('clusterOf', () => {
    it('groups by first segment in first-level mode', () => {
        expect(clusterOf(GRAPH.nodes[2], 'first-level')).toBe('src');
    });

    it('groups by full folder in full mode', () => {
        expect(clusterOf(GRAPH.nodes[2], 'full')).toBe('src/deep');
        expect(clusterOf(GRAPH.nodes[0], 'full')).toBe('src');
    });

    it('puts a root file in the "." bucket', () => {
        expect(clusterOf(GRAPH.nodes[4], 'first-level')).toBe('.');
        expect(clusterOf(GRAPH.nodes[4], 'full')).toBe('.');
    });
});

describe('toDot', () => {
    const dot = toDot(GRAPH);

    it('declares one cluster per folder', () => {
        expect(dot).toContain('subgraph cluster_0 {\n    label=".";');
        expect(dot).toContain('label="docs";');
        expect(dot).toContain('label="src";');
    });

    it('widths nodes from their size', () => {
        expect(dot).toMatch(/"src\/a\.ts" \[label="a\.ts", tooltip="src\/a\.ts", fillcolor="#dbeafe", penwidth=1\.0\]/);
        expect(dot).toMatch(/"src\/b\.ts" \[[^\]]*penwidth=2\.2\]/);
        expect(dot).toMatch(/"src\/deep\/c\.ts" \[[^\]]*penwidth=3\.2\]/);
    });

    it('colours documentation differently from code', () => {
        expect(dot).toMatch(/"docs\/readme\.md" \[[^\]]*fillcolor="#f3f4f6"/);
    });

    it('dashes documentation edges and dots guessed ones', () => {
        expect(dot).toContain('"docs/readme.md" -> "src/a.ts" [label="doc-ref", style=dashed];');
        expect(dot).toContain('"src/b.ts" -> "pkg.json" [label="global-use", style=dotted];');
        expect(dot).toContain('"src/b.ts" -> "src/a.ts" [label="import"];');
    });

    it('carries the unflatten tip', () => {
        expect(dot).toContain('unflatten -l 3 -c 5');
    });

    it('switches to per-folder clusters in full mode', () => {
        const full = toDot(GRAPH, { ...DEFAULT_GRAPH_FORMAT_OPTIONS, clusters: 'full' });
        expect(full).toContain('label="src/deep";');
        // Nested folders get their own cluster; "src" still holds a.ts and b.ts.
        expect(full.match(/^ {2}subgraph /gm)).toHaveLength(4);
        expect(toDot(GRAPH).match(/^ {2}subgraph /gm)).toHaveLength(3);
    });

    it('escapes quotes and backslashes', () => {
        const dot2 = toDot({
            nodes: [{ id: 'weird"name\\x.ts', name: 'weird"name\\x.ts' }],
            links: [],
        });
        expect(dot2).toContain('"weird\\"name\\\\x.ts" [label="weird\\"name\\\\x.ts"');
    });

    it('drops edges pointing outside the export', () => {
        const cut = toDot({
            nodes: [{ id: 'a.ts' }],
            links: [{ source: 'a.ts', target: 'gone.ts', type: 'import' }],
        });
        expect(cut).not.toContain('gone.ts');
    });

    it('accepts an already-expanded endpoint object', () => {
        const expanded = toDot({
            nodes: [{ id: 'a.ts' }, { id: 'b.ts' }],
            links: [{ source: { id: 'a.ts' }, target: { id: 'b.ts' }, type: 'import' }],
        });
        expect(expanded).toContain('"a.ts" -> "b.ts" [label="import"];');
    });
});

describe('toGraphMl', () => {
    const xml = toGraphMl(GRAPH);

    it('declares typed keys', () => {
        expect(xml).toContain('<key id="lines" for="node" attr.name="lines" attr.type="int"/>');
        expect(xml).toContain('<key id="confidence" for="edge" attr.name="confidence" attr.type="double"/>');
    });

    it('uses synthetic ids with the path in a data', () => {
        expect(xml).toContain('<node id="n0">');
        expect(xml).toContain('<data key="path">docs/readme.md</data>');
    });

    it('writes numbers as numbers', () => {
        expect(xml).toContain('<data key="lines">1600</data>');
        expect(xml).toContain('<data key="confidence">0.6</data>');
    });

    it('groups with an attribute by default', () => {
        expect(xml).toContain('<data key="group">src</data>');
        expect(xml).not.toContain('<graph id="cluster_0"');
    });

    it('nests subgraphs in nested mode', () => {
        const nested = toGraphMl(GRAPH, { ...DEFAULT_GRAPH_FORMAT_OPTIONS, graphmlGroups: 'nested' });
        expect(nested).toContain('<graph id="cluster_0" edgedefault="directed">');
        expect(nested).toContain('<data key="name">docs</data>');
        // Edges stay at the top level: GraphML forbids cross-graph edges.
        expect(nested).toMatch(/^ {4}<edge id="e0" source="n\d+" target="n\d+">$/m);
    });

    it('escapes XML metacharacters', () => {
        const escaped = toGraphMl({
            nodes: [{ id: 'a&b<c>.ts', name: 'a&b<c>.ts' }],
            links: [],
        });
        expect(escaped).toContain('a&amp;b&lt;c&gt;.ts');
        expect(escaped).not.toContain('<data key="path">a&b');
    });
});

describe('toMermaid', () => {
    it('draws subgraphs and typed edges', () => {
        // Synthetic ids follow the sorted path order: docs/readme.md = n0,
        // pkg.json = n1, src/a.ts = n2, src/b.ts = n3, src/deep/c.ts = n4.
        const mermaid = toMermaid(GRAPH);
        expect(mermaid).toContain('graph LR');
        expect(mermaid).toContain('subgraph c0["."]');
        expect(mermaid).toContain('n3 -->|import| n2');
        expect(mermaid).toContain('n0 -.-> n2');
        expect(mermaid).toContain('n3 -->|global-use| n1');
    });

    it('caps the node count and says what it left out', () => {
        const mermaid = toMermaid(GRAPH, { ...DEFAULT_GRAPH_FORMAT_OPTIONS, mermaidNodeLimit: 3 });
        const declared = mermaid.split('\n').filter(line => /^ {4}n\d+\[/.test(line));
        expect(declared).toHaveLength(3);
        expect(mermaid).toContain('2 more files omitted (mermaidNodeLimit = 3); use DOT or GraphML');
        // Keep the most-mentioned files: b.ts has fan-in 1 but is the source of 2 edges…
        expect(mermaid).toContain('a.ts');
    });

    it('treats 0 as no cap', () => {
        const mermaid = toMermaid(GRAPH, { ...DEFAULT_GRAPH_FORMAT_OPTIONS, mermaidNodeLimit: 0 });
        expect(mermaid.split('\n').filter(line => /^ {4}n\d+\[/.test(line))).toHaveLength(5);
        expect(mermaid).not.toContain('omitted');
    });

    it('omits edges whose endpoints were capped away', () => {
        const mermaid = toMermaid({
            nodes: [{ id: 'a.ts', fanIn: 5 }, { id: 'b.ts', fanIn: 1 }],
            links: [{ source: 'b.ts', target: 'b.ts', type: 'import' }],
        }, { ...DEFAULT_GRAPH_FORMAT_OPTIONS, mermaidNodeLimit: 1 });
        expect(mermaid).not.toContain('-->');
    });

    it('escapes a quote in a label', () => {
        const mermaid = toMermaid({ nodes: [{ id: 'a.ts', name: 'say "hi".ts' }], links: [] });
        expect(mermaid).toContain('["say #quot;hi#quot;.ts"]');
    });
});

describe('determinism', () => {
    it('returns byte-identical text whatever the input order', () => {
        const shuffled = {
            projectName: GRAPH.projectName,
            nodes: [...GRAPH.nodes].reverse(),
            links: [...GRAPH.links].reverse(),
        };
        for (const format of ['dot', 'graphml', 'mermaid'] as const) {
            expect(buildGraphFormat(format, shuffled).text).toBe(buildGraphFormat(format, GRAPH).text);
        }
    });
});

describe('buildGraphFormat', () => {
    it('reports the extension and filters per format', () => {
        expect(buildGraphFormat('dot', GRAPH).extension).toBe('dot');
        expect(buildGraphFormat('graphml', GRAPH).filters).toHaveProperty('GraphML');
        expect(buildGraphFormat('mermaid', GRAPH).filters).toHaveProperty('Markdown');
    });

    it('rejects an unknown format', () => {
        expect(() => buildGraphFormat('pdf' as never, GRAPH)).toThrow(/Unknown graph format/);
    });
});

describe('readFormatPayload', () => {
    // The regression this guards: the command used to drop the payload, so
    // picking DOT in the 📤 menu opened the format picker a second time.
    it('keeps a palette request asking for a format', () => {
        expect(readFormatPayload(undefined)).toEqual({});
        expect(readFormatPayload(null)).toEqual({});
    });

    it('honours the format the view already chose', () => {
        expect(readFormatPayload({ format: 'dot' }).format).toBe('dot');
        expect(readFormatPayload({ format: 'graphml' }).format).toBe('graphml');
        expect(readFormatPayload({ format: 'mermaid' }).format).toBe('mermaid');
    });

    it('drops an unknown format so the picker can ask', () => {
        expect(readFormatPayload({ format: 'pdf' }).format).toBeUndefined();
        expect(readFormatPayload({ format: 42 }).format).toBeUndefined();
    });

    it('keeps the filtered node set and its links', () => {
        const payload = readFormatPayload({ format: 'dot', nodes: [{ id: 'a.ts' }], links: [] });
        expect(payload.nodes).toEqual([{ id: 'a.ts' }]);
        expect(payload.links).toEqual([]);
    });

    it('ignores junk nodes but keeps the format', () => {
        const payload = readFormatPayload({
            format: 'dot',
            nodes: [{ id: 'a.ts' }, { name: 'no id' }, null, 'nope'],
        });
        expect(payload.nodes).toEqual([{ id: 'a.ts' }]);
        expect(payload.format).toBe('dot');
    });

    it('rejects a non-object argument (a Uri from a menu contribution)', () => {
        expect(readFormatPayload('file:///tmp/x.ts')).toEqual({});
        expect(readFormatPayload([{ id: 'a.ts' }])).toEqual({});
    });
});
