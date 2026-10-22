import { describe, it, expect } from 'vitest';
import { buildUserPrompt, extractAql, extractFileReferences } from '../chat/prompt';
import { AURA_TOOLS } from '../ai/tools';
import { AURA_SYSTEM_PROMPT, buildAuraSystemPrompt } from '../ai/prompts';

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
        expect(buildAuraSystemPrompt()).toBe(AURA_SYSTEM_PROMPT);
        const grounded = buildAuraSystemPrompt('- selected file: src/a.ts');
        expect(grounded).toContain('CURRENT AURA VIEW CONTEXT');
        expect(grounded).toContain('src/a.ts');
    });
});
