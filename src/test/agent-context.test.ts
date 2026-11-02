import { describe, it, expect } from 'vitest';
import {
    AGENT_BLOCK_BEGIN,
    AGENT_BLOCK_END,
    AGENT_CONTEXT_DEFAULT_TARGET,
    AGENT_CONTEXT_LIMIT,
    AGENT_REASONS_PER_ROW,
    agentContextMessage,
    hasAgentBlock,
    injectAgentBlock,
    isoDate,
    pickAgentContextTarget,
    reasonSummary,
    renderAgentBlock,
    renderHotspotsJson,
    renderHotspotsMarkdown,
    sortHotspots,
    type AgentContextInput,
    type AgentHotspot,
} from '../agent-context';

const GENERATED = '2026-11-02T10:15:00.000Z';

function hotspot(file: string, score: number, reasons: string[] = ['complexity 120']): AgentHotspot {
    return { file, risk_score: score, bucket: score >= 66 ? 'high' : 'medium', top: null, reasons };
}

function input(overrides: Partial<AgentContextInput> = {}): AgentContextInput {
    return {
        hotspots: [
            hotspot('src/extension.ts', 81.4, [
                'complexity 489 (top 1% of the repo)',
                '22 files depend on it (top 5%)',
                'changed 22 times in 90 days',
            ]),
            hotspot('src/webview/WebviewProvider.ts', 76.2, ['complexity 312']),
            hotspot('src/graph-db.ts', 64.1, ['16 files depend on it']),
        ],
        windowDays: 90,
        total: 48,
        generatedAt: GENERATED,
        cycles: 3,
        deadCode: 41,
        archViolations: 2,
        ...overrides,
    };
}

describe('agent-context — pickAgentContextTarget', () => {
    it('prefers AGENTS.md when several instruction files exist', () => {
        expect(pickAgentContextTarget(['CLAUDE.md', 'AGENTS.md', '.github/copilot-instructions.md']))
            .toEqual({ path: 'AGENTS.md', create: false });
    });

    it('falls back to the copilot instruction file, then to CLAUDE.md', () => {
        expect(pickAgentContextTarget(['.github/copilot-instructions.md', 'CLAUDE.md']))
            .toEqual({ path: '.github/copilot-instructions.md', create: false });
        expect(pickAgentContextTarget(['CLAUDE.md']))
            .toEqual({ path: 'CLAUDE.md', create: false });
    });

    it('creates AGENTS.md when nothing exists', () => {
        expect(pickAgentContextTarget([])).toEqual({ path: AGENT_CONTEXT_DEFAULT_TARGET, create: true });
        expect(pickAgentContextTarget(['README.md', 'src/app.ts']))
            .toEqual({ path: 'AGENTS.md', create: true });
    });

    it('matches case-insensitively and keeps the on-disk spelling', () => {
        expect(pickAgentContextTarget(['./agents.md'])).toEqual({ path: 'agents.md', create: false });
    });

    it('normalizes windows separators', () => {
        expect(pickAgentContextTarget(['.github\\copilot-instructions.md']))
            .toEqual({ path: '.github/copilot-instructions.md', create: false });
    });
});

describe('agent-context — renderAgentBlock', () => {
    it('wraps the table in the aura markers', () => {
        const block = renderAgentBlock(input());
        const lines = block.split('\n');
        expect(lines[0].startsWith(AGENT_BLOCK_BEGIN)).toBe(true);
        expect(lines[lines.length - 1]).toBe(AGENT_BLOCK_END);
        expect(block).toContain('## Aura risk hotspots · 90-day window · 2026-11-02');
    });

    it('lists hotspots by descending score', () => {
        const block = renderAgentBlock(input());
        const rows = block.split('\n').filter(line => line.startsWith('| `'));
        expect(rows[0]).toContain('`src/extension.ts`');
        expect(rows[1]).toContain('`src/webview/WebviewProvider.ts`');
        expect(rows[2]).toContain('`src/graph-db.ts`');
        expect(rows[0]).toContain('| 81.4 |');
    });

    it('is deterministic whatever the input order', () => {
        const forward = renderAgentBlock(input());
        const shuffled = renderAgentBlock(input({ hotspots: [...input().hotspots].reverse() }));
        expect(shuffled).toBe(forward);
    });

    it('breaks score ties on the path', () => {
        const block = renderAgentBlock(input({
            hotspots: [hotspot('src/b.ts', 50), hotspot('src/a.ts', 50)],
        }));
        const rows = block.split('\n').filter(line => line.startsWith('| `'));
        expect(rows[0]).toContain('`src/a.ts`');
        expect(rows[1]).toContain('`src/b.ts`');
    });

    it('caps the rows and admits it is a top-N', () => {
        const many = Array.from({ length: 15 }, (_unused, i) => hotspot(`src/f${i}.ts`, 50 + i));
        const block = renderAgentBlock(input({ hotspots: many, total: 15 }));
        const rows = block.split('\n').filter(line => line.startsWith('| `'));
        expect(rows).toHaveLength(AGENT_CONTEXT_LIMIT);
        expect(block).toContain('15 files scored over the last 90 days; these 10 carry most of the risk.');
    });

    it('honours an explicit limit', () => {
        const block = renderAgentBlock(input({ limit: 2 }));
        const rows = block.split('\n').filter(line => line.startsWith('| `'));
        expect(rows).toHaveLength(2);
    });

    it('says so when everything fits', () => {
        const block = renderAgentBlock(input({ hotspots: [hotspot('src/a.ts', 50)], total: 1 }));
        expect(block).toContain('1 file scored over the last 90 days — all of them listed below.');
    });

    it('keeps only the first reasons and escapes table pipes', () => {
        const block = renderAgentBlock(input({
            hotspots: [hotspot('src/a.ts', 50, ['one', 'two | pipes', 'three', 'four'])],
        }));
        const row = block.split('\n').find(line => line.startsWith('| `src/a.ts`'));
        expect(row).toBeDefined();
        expect(row).toContain('one · two / pipes · three');
        expect(row).not.toContain('four');
        expect(row!.split('|').length).toBe(5);
    });

    it('renders the repo health line only with counters', () => {
        expect(renderAgentBlock(input())).toContain('Repo health: 3 dependency cycles · 41 dead exports · 2 new architecture violations.');
        const bare = renderAgentBlock(input({ cycles: undefined, deadCode: undefined, archViolations: undefined }));
        expect(bare).not.toContain('Repo health');
        expect(renderAgentBlock(input({ cycles: 0, deadCode: 0, archViolations: 0 }))).not.toContain('Repo health');
    });

    it('never embeds source code, only paths and metrics', () => {
        const block = renderAgentBlock(input());
        expect(block).not.toContain('function ');
        expect(block).not.toContain('import ');
        expect(block).toContain('`src/extension.ts`');
    });
});

describe('agent-context — injectAgentBlock', () => {
    const block = renderAgentBlock(input());

    it('creates the file body when there is nothing to inject into', () => {
        const result = injectAgentBlock(undefined, block);
        expect(result.startsWith(AGENT_BLOCK_BEGIN)).toBe(true);
        expect(result.endsWith('\n')).toBe(true);
        expect(result.endsWith(`${AGENT_BLOCK_END}\n`)).toBe(true);
    });

    it('is idempotent', () => {
        const once = injectAgentBlock('# My agents\n\nSome prose.\n', block);
        const twice = injectAgentBlock(once, block);
        expect(twice).toBe(once);
        expect(once.split(AGENT_BLOCK_BEGIN)).toHaveLength(2);
    });

    it('keeps the prose before and after the block', () => {
        const existing = [
            '# AGENTS.md',
            '',
            'Project conventions.',
            '',
            renderAgentBlock(input({ hotspots: [hotspot('src/old.ts', 10)] })),
            '',
            'Footer prose.',
            '',
        ].join('\n');
        const result = injectAgentBlock(existing, block);
        expect(result.startsWith('# AGENTS.md\n\nProject conventions.\n')).toBe(true);
        expect(result).toContain('src/extension.ts');
        expect(result).not.toContain('src/old.ts');
        expect(result).toContain('Footer prose.');
        expect(result.split(AGENT_BLOCK_BEGIN)).toHaveLength(2);
    });

    it('replaces a block that was edited by hand', () => {
        const existing = 'Intro\n\n<!-- aura:begin -->\nstale\n<!-- aura:end -->\n\nOutro\n';
        const result = injectAgentBlock(existing, block);
        expect(result).not.toContain('stale');
        expect(result.startsWith('Intro\n\n' + AGENT_BLOCK_BEGIN)).toBe(true);
        expect(result).toContain('Outro');
    });

    it('repairs a block whose end marker went missing', () => {
        const existing = 'Intro\n\n<!-- aura:begin -->\nstale\n';
        const result = injectAgentBlock(existing, block);
        expect(result).not.toContain('stale');
        expect(result.split(AGENT_BLOCK_BEGIN)).toHaveLength(2);
        expect(result.trimEnd().endsWith(AGENT_BLOCK_END)).toBe(true);
    });

    it('preserves CRLF line endings', () => {
        const existing = '# AGENTS\r\n\r\nProse.\r\n';
        const result = injectAgentBlock(existing, block);
        expect(result).toContain('\r\n');
        expect(result.includes('\n\n') && !result.includes('\r\n\r\n')).toBe(false);
        expect(result.replace(/\r\n/g, '')).not.toContain('\n');
        expect(result).toContain('# AGENTS\r\n\r\nProse.\r\n\r\n' + AGENT_BLOCK_BEGIN);
    });

    it('appends after trailing blank lines without leaving a gap', () => {
        const result = injectAgentBlock('# Only a title\n\n\n\n', block);
        expect(result.startsWith('# Only a title\n\n' + AGENT_BLOCK_BEGIN)).toBe(true);
    });

    it('reports whether a block is already there', () => {
        expect(hasAgentBlock('# nothing yet')).toBe(false);
        expect(hasAgentBlock(injectAgentBlock('# x\n', block))).toBe(true);
    });
});

describe('agent-context — helpers', () => {
    it('formats scores without a useless .0', () => {
        expect(renderAgentBlock(input({ hotspots: [hotspot('src/a.ts', 80)] }))).toContain('| 80 |');
        expect(renderAgentBlock(input({ hotspots: [hotspot('src/a.ts', 80.04)] }))).toContain('| 80 |');
        expect(renderAgentBlock(input({ hotspots: [hotspot('src/a.ts', 80.06)] }))).toContain('| 80.1 |');
    });

    it('summarizes missing reasons as a dash', () => {
        expect(reasonSummary(undefined)).toBe('—');
        expect(reasonSummary([])).toBe('—');
        expect(reasonSummary(['  ', '\n'])).toBe('—');
        expect(reasonSummary(['a\n b'])).toBe('a b');
        expect(reasonSummary(['1', '2', '3', '4'], 2)).toBe('1 · 2');
        expect(AGENT_REASONS_PER_ROW).toBe(3);
    });

    it('sorts a copy, leaving the caller array untouched', () => {
        const list = [hotspot('b.ts', 10), hotspot('a.ts', 20)];
        const sorted = sortHotspots(list);
        expect(sorted.map(h => h.file)).toEqual(['a.ts', 'b.ts']);
        expect(list.map(h => h.file)).toEqual(['b.ts', 'a.ts']);
    });

    it('renders an ISO date and tolerates garbage', () => {
        expect(isoDate(GENERATED)).toBe('2026-11-02');
        expect(isoDate('not-a-date')).toBe('not-a-date');
    });

    it('words the notification', () => {
        expect(agentContextMessage('AGENTS.md', input()))
            .toBe('Aura: agent context updated in AGENTS.md (3 hotspots, 90-day window)');
        expect(agentContextMessage('CLAUDE.md', input({ hotspots: [hotspot('a.ts', 1)] })))
            .toBe('Aura: agent context updated in CLAUDE.md (1 hotspot, 90-day window)');
    });
});

describe('agent-context — renderHotspotsMarkdown / renderHotspotsJson', () => {
    it('renders the full local report with counters', () => {
        const markdown = renderHotspotsMarkdown(input());
        expect(markdown.startsWith('# Aura — risk hotspots\n')).toBe(true);
        expect(markdown).toContain('| 1 | `src/extension.ts` | 81.4 | high |');
        expect(markdown).toContain('## Repo health');
        expect(markdown).toContain('3 dependency cycles · 41 dead exports · 2 new architecture violations');
        expect(markdown.endsWith('\n')).toBe(true);
    });

    it('is deterministic and keeps every reason', () => {
        const first = renderHotspotsMarkdown(input());
        const second = renderHotspotsMarkdown(input({ hotspots: [...input().hotspots].reverse() }));
        expect(second).toBe(first);
        expect(first).toContain('complexity 489 (top 1% of the repo) · 22 files depend on it (top 5%) · changed 22 times in 90 days');
    });

    it('pretty-prints the JSON payload with a trailing newline', () => {
        const payload = { sort: 'risk', window_days: 90, total: 3, hotspots: [{ file: 'src/a.ts', risk_score: 1 }] };
        const json = renderHotspotsJson(payload);
        expect(json.endsWith('\n')).toBe(true);
        expect(JSON.parse(json)).toEqual(payload);
        expect(renderHotspotsJson(payload)).toBe(json);
    });
});
