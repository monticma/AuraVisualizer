import { describe, it, expect } from 'vitest';
import {
    AI_EXPORT_SECTIONS,
    buildAiExportInput,
    estimateAiTokens,
    generateAiExport,
} from '../export/ai-export';
import type { ArchReportModule } from '../report/arch-report';
import type { GraphData } from '../analyzer/types';

const graph = {
    meta: {
        projectName: 'Demo',
        analyzedAt: '2026-10-01T12:00:00.000Z',
        cycles: [['src/a.ts', 'src/b.ts']],
        languageStats: {},
    },
    nodes: [
        {
            id: 'src/a.ts', name: 'a.ts', path: 'src/a.ts', language: 'typescript', extension: '.ts',
            linesOfCode: 10, complexity: 3, fanIn: 4, fanOut: 1, group: 'src',
            symbols: {
                interfaces: [{ name: 'Shape', type: 'interface', line: 3 }],
                exports: [{ name: 'build', type: 'export-function', line: 12 }],
                classes: [{ name: 'Builder', type: 'class', line: 20 }],
                functions: [{ name: 'hiddenHelper', type: 'function', line: 30 }],
                methods: [{ name: 'run', type: 'method', line: 40, visibility: 'private' }],
            },
        },
        {
            id: 'lib/c.h', name: 'c.h', path: 'lib/c.h', language: 'c', extension: '.h',
            linesOfCode: 40, complexity: 2, fanIn: 2, fanOut: 0, group: 'lib',
            symbols: {
                functions: [{ name: 'init', type: 'function', line: 7 }],
                structs: [{ name: 'Config', type: 'struct', line: 2 }],
                enums: [{ name: 'Mode', type: 'enum', line: 5 }],
                macros: [{ name: 'MAX_SIZE', type: 'macro', line: 1 }],
            },
        },
        {
            id: 'src/b.ts', name: 'b.ts', path: 'src/b.ts', language: 'typescript', extension: '.ts',
            linesOfCode: 20, complexity: 5, fanIn: 1, fanOut: 1, group: 'src',
        },
        {
            id: 'docs/README.md', name: 'README.md', path: 'docs/README.md', language: 'documentation', extension: '.md',
            linesOfCode: 5, complexity: 1, fanIn: 0, fanOut: 0, group: 'docs',
        },
    ],
    links: [
        { source: 'src/a.ts', target: 'src/b.ts', type: 'import', label: '' },
        { source: 'src/b.ts', target: 'lib/c.h', type: 'include', label: '' },
        { source: 'docs/README.md', target: 'src/a.ts', type: 'doc-reference', label: '' },
    ],
} as unknown as GraphData;

const modules: ArchReportModule[] = [
    { id: 1, name: 'src', files: ['src/a.ts', 'src/b.ts'], size: 2 },
    { id: 2, name: 'lib', files: ['lib/c.h'], size: 1 },
];

function input() {
    return buildAiExportInput(graph, {
        modules,
        deadCode: [
            { file: 'src/a.ts', symbol: 'oldThing', kind: 'export' },
            { file: 'src/b.ts', symbol: 'stale', kind: 'function' },
        ],
        hotspots: [
            { file: 'src/b.ts', impact: 10, complexity: 5, fanIn: 1, fanOut: 1 },
            { file: 'src/a.ts', impact: 8, complexity: 3, fanIn: 4, fanOut: 1, reasons: ['many callers'] },
        ],
    });
}

describe('AI export', () => {
    it('extracts public contracts and excludes documentation', () => {
        const data = input();
        expect(data.contracts.map(c => c.symbol)).toEqual(expect.arrayContaining([
            'Shape', 'build', 'Builder', 'init', 'Config', 'Mode', 'MAX_SIZE',
        ]));
        expect(data.contracts.some(c => c.symbol === 'hiddenHelper')).toBe(false);
        expect(data.contracts.some(c => c.symbol === 'run')).toBe(false);
        expect(data.contracts.some(c => c.file === 'docs/README.md')).toBe(false);
    });

    it('generates deterministic markdown for selected sections', () => {
        const data = input();
        const sections: ['modules', 'contracts'] = ['modules', 'contracts'];
        const first = generateAiExport(data, { sections });
        const second = generateAiExport(data, { sections });
        expect(first).toBe(second);
        expect(first).toContain('# AI context — Demo');
        expect(first).toContain('## Modules');
        expect(first).toContain('## Contracts (public surface)');
        expect(first).toContain('`src` → `lib`');
        expect(first).not.toContain('## Hotspots');
        expect(first).not.toContain('## Cycles');
        expect(first).not.toContain('## Dead exports');
    });

    it('generates a structured JSON envelope', () => {
        const data = input();
        const output = generateAiExport(data, {
            format: 'json',
            sections: [...AI_EXPORT_SECTIONS],
        });
        const payload = JSON.parse(output);
        expect(payload.version).toBe(1);
        expect(payload.generatedAt).toBe('2026-10-01T12:00:00.000Z');
        expect(payload.overview.files).toBe(3);
        expect(payload.modules).toHaveLength(2);
        expect(payload.modules[0].dependsOn.some((dep: { module: string }) => dep.module === 'lib')).toBe(true);
        expect(payload.contracts.some((contract: { symbol: string }) => contract.symbol === 'Shape')).toBe(true);
        expect(payload.deadCode).toHaveLength(2);
    });

    it('enforces the markdown token budget with an explicit note', () => {
        const data = input();
        const output = generateAiExport(data, {
            format: 'markdown',
            tokenBudget: 105,
        });
        expect(estimateAiTokens(output)).toBeLessThanOrEqual(105);
        expect(output).toContain('omitted');
        expect(output).toContain('tokens');
    });

    it('enforces the JSON token budget and stays valid JSON', () => {
        const data = input();
        const output = generateAiExport(data, {
            format: 'json',
            tokenBudget: 80,
        });
        expect(estimateAiTokens(output)).toBeLessThanOrEqual(80);
        const payload = JSON.parse(output);
        expect(payload.version).toBe(1);
        expect(payload.truncation || payload.truncated).toBeDefined();
    });
});
