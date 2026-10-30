import { describe, it, expect } from 'vitest';
import {
    MAX_FILE_ITEMS,
    buildFileQuickPick,
    buildQueryQuickPick,
    normalizeQueryMode,
} from '../commands/palette-core';

const node = (id: string, extra: Record<string, unknown> = {}) => ({ id, ...extra });

describe('palette: file picker', () => {
    it('excludes documentation nodes and duplicate ids', () => {
        const { items, total } = buildFileQuickPick([
            node('src/a.ts', { language: 'typescript' }),
            node('docs/readme.md', { language: 'documentation' }),
            node('src/a.ts', { language: 'typescript' }),
            node('src/b.py', { language: 'python' }),
        ]);
        expect(items.map(i => i.label)).toEqual(['src/a.ts', 'src/b.py']);
        expect(total).toBe(2);
    });

    it('sorts by path and exposes language, directory and metrics', () => {
        const { items } = buildFileQuickPick([
            node('src/z.ts', { language: 'typescript', group: 'src', linesOfCode: 120, fanIn: 7, fanOut: 2 }),
            node('src/a.ts', { language: 'typescript', group: 'src', layer: 'domain', archViolations: 3 }),
        ]);
        expect(items.map(i => i.nodeId)).toEqual(['src/a.ts', 'src/z.ts']);
        expect(items[0].description).toBe('typescript · src');
        expect(items[0].detail).toContain('🏛️ domain');
        expect(items[0].detail).toContain('3 violations');
        expect(items[1].detail).toContain('120 LOC');
        expect(items[1].detail).toContain('↗ 7');
    });

    it('normalizes backslashes and skips unusable ids', () => {
        const { items } = buildFileQuickPick([
            node('src\\win\\a.ts'),
            node('../outside.ts'),
            node(''),
            { id: 42 } as unknown as { id: string },
        ]);
        expect(items.map(i => i.label)).toEqual(['src/win/a.ts']);
    });

    it('caps the list and reports truncation', () => {
        const many = Array.from({ length: MAX_FILE_ITEMS + 5 }, (_, i) => node(`src/f${i}.ts`));
        const result = buildFileQuickPick(many);
        expect(result.items).toHaveLength(MAX_FILE_ITEMS);
        expect(result.truncated).toBe(true);
        expect(result.total).toBe(MAX_FILE_ITEMS + 5);

        const small = buildFileQuickPick(many.slice(0, 3), 2);
        expect(small.items).toHaveLength(2);
        expect(small.truncated).toBe(true);
    });

    it('handles empty input', () => {
        expect(buildFileQuickPick(undefined)).toEqual({ items: [], total: 0, truncated: false });
        expect(buildFileQuickPick([])).toEqual({ items: [], total: 0, truncated: false });
    });
});

describe('palette: saved queries', () => {
    it('drops empty expressions', () => {
        const items = buildQueryQuickPick([
            { id: '1', name: 'Complex', expr: 'complexity > 20', mode: 'filter', createdAt: 10 },
            { id: '2', name: 'Empty', expr: '   ', mode: 'filter', createdAt: 20 },
        ]);
        expect(items.map(i => i.label)).toEqual(['Complex']);
    });

    it('sorts the most recent first and keeps a stable order on ties', () => {
        const items = buildQueryQuickPick([
            { name: 'old', expr: 'loc > 10', mode: 'filter', createdAt: 100 },
            { name: 'new', expr: 'fanIn > 3', mode: 'highlight', createdAt: 300 },
            { name: 'mid-a', expr: 'a', mode: 'select', createdAt: 200 },
            { name: 'mid-b', expr: 'b', mode: 'select', createdAt: 200 },
        ]);
        expect(items.map(i => i.label)).toEqual(['new', 'mid-a', 'mid-b', 'old']);
    });

    it('normalizes the mode and falls back to the expression as label', () => {
        const items = buildQueryQuickPick([
            { name: '', expr: 'deadExports > 0', mode: 'nope' },
            { name: 'Sel', expr: 'layer == domain', mode: 'select' },
        ]);
        expect(items[0].label).toBe('deadExports > 0');
        expect(items[0].mode).toBe('filter');
        expect(items.some(i => i.mode === 'select')).toBe(true);
        expect(normalizeQueryMode('highlight')).toBe('highlight');
        expect(normalizeQueryMode(undefined)).toBe('filter');
    });

    it('returns nothing for missing input', () => {
        expect(buildQueryQuickPick(undefined)).toEqual([]);
        expect(buildQueryQuickPick([{ expr: '' }])).toEqual([]);
    });
});
