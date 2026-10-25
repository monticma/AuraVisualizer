import { describe, it, expect } from 'vitest';
import { buildUserPrompt, extractAql, extractFileAnchors, extractFileReferences } from '../chat/prompt';
import { buildFileFacts } from '../chat/file-facts';
import { AURA_TOOLS } from '../ai/tools';
import { AURA_SYSTEM_PROMPT, buildAuraSystemPrompt } from '../ai/prompts';
import { describeAuraViewContext } from '../chat/context';
import type { GraphDB } from '../graph-db';

describe('chat prompt helpers', () => {
    it('routes slash commands to focused prompts', () => {
        expect(buildUserPrompt('explain', 'src/a.ts')).toContain('src/a.ts');
        expect(buildUserPrompt('impact', 'src/a.ts')).toContain('blast radius');
        expect(buildUserPrompt('path', 'src/a.ts src/b.ts')).toContain('aura_find_path');
        expect(buildUserPrompt('hotspots', '')).toContain('aura_get_hotspots');
        expect(buildUserPrompt('query', 'complex files')).toContain('AQL');
        expect(buildUserPrompt(undefined, 'hello')).toBe('hello');
        expect(buildUserPrompt('explain', '', 'src/b.ts')).toContain('src/b.ts');
        expect(buildUserPrompt('impact', '', 'src/b.ts')).toContain('src/b.ts');
        expect(buildUserPrompt('path', '', 'src/b.ts')).toContain('src/b.ts');
        expect(buildUserPrompt('explain', '')).toContain('which file');
    });

    it('extracts unique file references from an answer', () => {
        expect(extractFileReferences('See src/a.ts:10 and src/a.ts, then docs/x.md.'))
            .toEqual(['src/a.ts', 'docs/x.md']);
        expect(extractFileReferences('No files here, just words.')).toEqual([]);
        expect(extractFileReferences('Scores: 69.0, v1.2 and 3.14.')).toEqual([]);
        expect(extractFileReferences('Compare 69.0 with src/a.ts.')).toEqual(['src/a.ts']);
    });

    it('keeps the first line number for each file anchor', () => {
        expect(extractFileAnchors('See src/a.ts:10 and src/a.ts:20, then src/b.ts.')).toEqual([
            { file: 'src/a.ts', line: 10 },
            { file: 'src/b.ts', line: undefined },
        ]);
        expect(extractFileAnchors('src/a.ts then src/a.ts:42')).toEqual([
            { file: 'src/a.ts', line: 42 },
        ]);
    });

    it('extracts a single-line AQL expression from a fenced block', () => {
        expect(extractAql('```\ncomplexity > 20 AND fanIn > 5\n```'))
            .toBe('complexity > 20 AND fanIn > 5');
        expect(extractAql('```aql\nfanIn > 5```')).toBe('fanIn > 5');
        expect(extractAql('There is no query in this answer.')).toBeUndefined();
    });

    it('exposes a unique shared tool registry for MCP, LM tools and @aura', () => {
        const names = AURA_TOOLS.map(t => t.name);
        expect(names.length).toBeGreaterThanOrEqual(15);
        expect(new Set(names).size).toBe(names.length);
        expect(names).toContain('aura_generate_documentation');
        for (const tool of AURA_TOOLS) {
            expect(tool.inputSchema).toMatchObject({ type: 'object' });
        }
    });

    it('appends the current Aura view context to the system prompt', () => {
        expect(AURA_SYSTEM_PROMPT).toContain('never end on a tool call');
        expect(buildAuraSystemPrompt()).toBe(AURA_SYSTEM_PROMPT);
        const grounded = buildAuraSystemPrompt('- selected file: src/a.ts');
        expect(grounded).toContain('CURRENT AURA VIEW CONTEXT');
        expect(grounded).toContain('src/a.ts');
    });

    it('marks palette community membership as authoritative', () => {
        const text = describeAuraViewContext({
            tab: 'graph',
            community: {
                id: 3,
                name: 'risk',
                fileCount: 3,
                files: ['webview/js/risk.js', 'src/risk/risk-core.ts', 'src/risk/risk-service.ts'],
            },
        });
        expect(text).toContain('Communities palette group: "risk" (palette id 3) — 3 code files');
        expect(text).toContain('authoritative code-only Louvain membership');
        expect(text).toContain('Documentation is excluded');
        expect(text).toContain('do not substitute another community');
        expect(text).toContain('`webview/js/risk.js`');
        expect(text).not.toContain('filters:');
    });

    it('builds deterministic file facts for /explain', () => {
        const db = {
            getAllNodes: () => [{ id: 'src/a.ts', name: 'a.ts' }],
            getNodeDetail: () => ({
                id: 'src/a.ts', language: 'typescript', lines: 42, complexity: 7, fan_in: 3, fan_out: 2,
                dependencies: ['src/b.ts'], dependents: ['src/main.ts'],
                symbols: [{ name: 'run', kind: 'function', line: 10 }],
            }),
        } as unknown as GraphDB;
        const facts = buildFileFacts(db, 'src/a.ts');
        expect(facts?.file).toBe('src/a.ts');
        expect(facts?.markdown).toContain('42 lines');
        expect(facts?.markdown).toContain('src/b.ts');
        expect(facts?.markdown).toContain('run');
        expect(buildFileFacts(db, 'missing.ts')).toBeUndefined();
    });
});
