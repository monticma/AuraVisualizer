import { describe, it, expect } from 'vitest';
import { buildArchReportInput, generateArchReport, type ArchReportModule } from '../report/arch-report';
import type { GraphData } from '../analyzer/types';

const graph = {
    meta: {
        projectName: 'Demo',
        analyzedAt: '2026-10-01T12:00:00.000Z',
        cycles: [['src/a.ts', 'src/b.ts']],
    },
    nodes: [
        { id: 'src/a.ts', name: 'a.ts', language: 'typescript', linesOfCode: 10, complexity: 3, fanIn: 1, fanOut: 1, group: 'src' },
        { id: 'src/b.ts', name: 'b.ts', language: 'typescript', linesOfCode: 20, complexity: 5, fanIn: 2, fanOut: 1, group: 'src' },
        { id: 'lib/c.ts', name: 'c.ts', language: 'typescript', linesOfCode: 30, complexity: 2, fanIn: 1, fanOut: 0, group: 'lib' },
    ],
    links: [
        { source: 'src/a.ts', target: 'src/b.ts', type: 'import', label: '' },
        { source: 'src/b.ts', target: 'lib/c.ts', type: 'import', label: '' },
        { source: 'src/a.ts', target: 'lib/c.ts', type: 'import', label: '' },
    ],
} as unknown as GraphData;

const modules: ArchReportModule[] = [
    { id: 1, name: 'src', files: ['src/a.ts', 'src/b.ts'], size: 2 },
    { id: 2, name: 'lib', files: ['lib/c.ts'], size: 1 },
];

describe('architecture report', () => {
    it('generates Mermaid modules and stable sections', () => {
        const input = buildArchReportInput(graph, {
            modules,
            deadCode: [{ file: 'src/a.ts', symbol: 'oldThing', kind: 'export' }],
            hotspots: [{ file: 'src/b.ts', impact: 10, complexity: 5, fanIn: 2, fanOut: 1 }],
        });
        const report = generateArchReport(input);
        expect(report).toContain('# Architecture — Demo');
        expect(report).toContain('```mermaid');
        expect(report).toContain('M0["src (2)"]');
        expect(report).toContain('M1["lib (1)"]');
        expect(report).toContain('M0 -->|2| M1');
        expect(report).toContain('| src | 2 |');
        expect(report).toContain('oldThing');
        expect(report).toContain('src/b.ts');
        expect(generateArchReport(input)).toBe(report);
    });

    it('falls back to directory modules and keeps the HTML-free Mermaid block', () => {
        const input = buildArchReportInput(graph);
        const report = generateArchReport(input);
        expect(input.modules.map(m => m.name).sort()).toEqual(['lib', 'src']);
        expect(report).toContain('graph TD');
        expect(report).toContain('M0 -->|2| M1');
    });

    it('caps the report and can hide file paths', () => {
        const input = buildArchReportInput(graph, { modules });
        const capped = generateArchReport(input, { maxLines: 12 });
        expect(capped.trimEnd().split('\n').length).toBeLessThanOrEqual(12);
        expect(capped).toContain('truncated');

        const noPaths = generateArchReport(input, { includePaths: false });
        expect(noPaths).not.toContain('src/a.ts');
        expect(noPaths).toContain('| src | 2 |');
    });
});
