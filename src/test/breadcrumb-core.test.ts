import { describe, it, expect } from 'vitest';
import {
    BREADCRUMB_LIMIT,
    back,
    entryTooltip,
    fileName,
    pushEntry,
    sameEntry,
    truncateText,
    truncateTo,
    type BreadcrumbEntry,
} from '../navigation/breadcrumb-core';

function place(label: string, overrides: Partial<BreadcrumbEntry> = {}): BreadcrumbEntry {
    return { label, focusKind: 'none', nodeIds: [], ...overrides };
}

function trail(count: number): BreadcrumbEntry[] {
    const stack: BreadcrumbEntry[] = [];
    for (let i = 0; i < count; i++) {
        stack.push(place(`src/f${i}.ts`, { nodeIds: [`src/f${i}.ts`] }));
    }
    return stack;
}

describe('breadcrumb-core — pushEntry', () => {
    it('appends a place', () => {
        const stack = pushEntry([], place('a.ts', { nodeIds: ['src/a.ts'] }));
        expect(stack).toHaveLength(1);
        expect(stack[0].label).toBe('a.ts');
        expect(stack[0].focusKind).toBe('none');
    });

    it('drops a consecutive duplicate (same spot, different camera)', () => {
        const first = pushEntry([], place('a.ts', { nodeIds: ['src/a.ts'], pose: { pos: { x: 1 } } }));
        const again = pushEntry(first, place('a.ts', { nodeIds: ['src/a.ts'], pose: { pos: { x: 9 } }, detail: 'other' }));
        expect(again).toHaveLength(1);
        expect(again[0].pose).toEqual({ pos: { x: 1 } });
    });

    it('keeps a real return to an earlier place', () => {
        let stack = pushEntry([], place('a.ts', { nodeIds: ['src/a.ts'] }));
        stack = pushEntry(stack, place('b.ts', { nodeIds: ['src/b.ts'] }));
        stack = pushEntry(stack, place('a.ts', { nodeIds: ['src/a.ts'] }));
        expect(stack.map(entry => entry.label)).toEqual(['a.ts', 'b.ts', 'a.ts']);
    });

    it('distinguishes the same file reached in another mode', () => {
        let stack = pushEntry([], place('a.ts', { nodeIds: ['src/a.ts'], focusKind: 'none' }));
        stack = pushEntry(stack, place('Pinned: a.ts', { nodeIds: ['src/a.ts'], focusKind: 'pin', depth: 2 }));
        stack = pushEntry(stack, place('Blast: a.ts', { nodeIds: ['src/a.ts'], focusKind: 'blast' }));
        expect(stack).toHaveLength(3);
    });

    it('caps the trail and drops the oldest entries', () => {
        const stack = pushEntry(trail(BREADCRUMB_LIMIT + 5), place('new.ts'));
        expect(stack).toHaveLength(BREADCRUMB_LIMIT);
        expect(stack[0].label).toBe('src/f6.ts');
        expect(stack[stack.length - 1].label).toBe('new.ts');
    });

    it('honours an explicit limit', () => {
        const stack = pushEntry(trail(10), place('x.ts'), 3);
        expect(stack.map(entry => entry.label)).toEqual(['src/f8.ts', 'src/f9.ts', 'x.ts']);
    });

    it('ignores an empty entry and never mutates the input', () => {
        const before = trail(2);
        const snapshot = JSON.parse(JSON.stringify(before));
        expect(pushEntry(before, undefined)).toHaveLength(2);
        expect(pushEntry(before, place('   '))).toHaveLength(2);
        expect(before).toEqual(snapshot);
    });

    it('normalizes the copy it stores', () => {
        const ids = ['src/a.ts', 42 as unknown as string];
        const stack = pushEntry([], { label: 'a.ts', nodeIds: ids, focusKind: undefined });
        ids.push('src/late.ts');
        expect(stack[0].nodeIds).toEqual(['src/a.ts']);
        expect(stack[0].focusKind).toBe('none');
    });

    it('keeps the query and the tab', () => {
        const stack = pushEntry([], place('layer=web', { query: { expr: 'layer=web', mode: 'filter' }, tab: 'table' }));
        expect(stack[0].query).toEqual({ expr: 'layer=web', mode: 'filter' });
        expect(stack[0].tab).toBe('table');
    });

    it('defaults a missing query mode', () => {
        const stack = pushEntry([], place('q', { query: { expr: 'x', mode: '' } }));
        expect(stack[0].query).toEqual({ expr: 'x', mode: 'filter' });
    });
});

describe('breadcrumb-core — back / truncateTo', () => {
    it('does nothing on an empty or single-entry trail', () => {
        expect(back([])).toEqual({ stack: [] });
        const single = back(trail(1));
        expect(single.stack).toHaveLength(1);
        expect(single.entry).toBeUndefined();
    });

    it('returns the new top to restore', () => {
        const result = back(trail(3));
        expect(result.stack.map(entry => entry.label)).toEqual(['src/f0.ts', 'src/f1.ts']);
        expect(result.entry?.label).toBe('src/f1.ts');
    });

    it('walks the whole trail down to the first place', () => {
        let stack = trail(3);
        const visited: string[] = [];
        for (let i = 0; i < 3; i++) {
            const step = back(stack);
            stack = step.stack;
            if (step.entry) visited.push(step.entry.label);
        }
        expect(visited).toEqual(['src/f1.ts', 'src/f0.ts']);
        expect(stack).toHaveLength(1);
    });

    it('truncates to a clicked chip', () => {
        expect(truncateTo(trail(4), 1).map(entry => entry.label)).toEqual(['src/f0.ts', 'src/f1.ts']);
        expect(truncateTo(trail(4), 3)).toHaveLength(4);
    });

    it('ignores an out-of-range index', () => {
        const stack = trail(3);
        expect(truncateTo(stack, -1)).toHaveLength(3);
        expect(truncateTo(stack, 3)).toHaveLength(3);
        expect(truncateTo(stack, 1.5)).toHaveLength(3);
    });
});

describe('breadcrumb-core — labels', () => {
    it('takes the last path segment', () => {
        expect(fileName('src/webview/WebviewProvider.ts')).toBe('WebviewProvider.ts');
        expect(fileName('src\\win\\app.js')).toBe('app.js');
        expect(fileName('README.md')).toBe('README.md');
        expect(fileName('')).toBe('');
    });

    it('caps a long label', () => {
        expect(truncateText('short')).toBe('short');
        expect(truncateText('  a   b  ')).toBe('a b');
        expect(truncateText('x'.repeat(40), 10)).toBe('xxxxxxxxx…');
        expect(truncateText('', 10)).toBe('');
    });

    it('builds a tooltip from label, detail and count', () => {
        expect(entryTooltip(place('a.ts', { detail: 'src/a.ts', nodeIds: ['src/a.ts'] }))).toBe('a.ts — src/a.ts');
        const pair = place('a.ts ↔ b.ts', { nodeIds: ['a', 'b'] });
        expect(entryTooltip(pair)).toBe('a.ts ↔ b.ts — 2 files');
        expect(entryTooltip(undefined)).toBe('');
    });
});

describe('breadcrumb-core — sameEntry', () => {
    it('compares the destination, not the presentation', () => {
        const a = place('a.ts', { nodeIds: ['src/a.ts'], pose: { pos: { x: 1 } } });
        const b = place('a.ts', { nodeIds: ['src/a.ts'], pose: { pos: { x: 2 } }, detail: 'elsewhere' });
        expect(sameEntry(a, b)).toBe(true);
    });

    it('sees a different query as a different place', () => {
        const a = place('q', { query: { expr: 'layer=web', mode: 'filter' } });
        const b = place('q', { query: { expr: 'layer=web', mode: 'highlight' } });
        const c = place('q', { query: null });
        expect(sameEntry(a, b)).toBe(false);
        expect(sameEntry(a, c)).toBe(false);
    });

    it('sees depth and tab changes', () => {
        expect(sameEntry(place('a', { focusKind: 'pin', depth: 1 }), place('a', { focusKind: 'pin', depth: 2 }))).toBe(false);
        expect(sameEntry(place('a', { tab: 'graph' }), place('a', { tab: 'risk' }))).toBe(false);
    });

    it('handles missing entries', () => {
        expect(sameEntry(undefined, place('a'))).toBe(false);
        expect(sameEntry(place('a'), null)).toBe(false);
    });
});
