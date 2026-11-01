import { describe, it, expect } from 'vitest';
import {
    MAX_SYMBOL_ITEMS,
    buildKindChips,
    buildSymbolQuickPick,
    symbolDetail,
    type SymbolRow,
} from '../commands/symbol-palette-core';

const row = (name: string, kind: string, nodeId = 'src/a.ts', line = 10, extra: Partial<SymbolRow> = {}): SymbolRow => ({
    nodeId, name, kind, line, ...extra,
});

describe('symbol-palette-core — buildSymbolQuickPick', () => {
    it('builds label, description and detail for one row', () => {
        const { items } = buildSymbolQuickPick([row('parseSymbols', 'function', 'src/parser.ts', 42, { cognitive: 7, maintainability: 82.4 })]);
        expect(items).toHaveLength(1);
        expect(items[0].label).toBe('parseSymbols');
        expect(items[0].description).toBe('function · src/parser.ts:42');
        expect(items[0].detail).toBe('cognitive 7 · MI 82');
    });

    it('puts prefix matches before substring matches', () => {
        const { items } = buildSymbolQuickPick(
            [row('reparse', 'function'), row('parseSymbols', 'function'), row('parseAll', 'function')],
            { query: 'parse' },
        );
        expect(items.map(i => i.label)).toEqual(['parseAll', 'parseSymbols', 'reparse']);
    });

    it('sorts alphabetically without a query, then by file', () => {
        const { items } = buildSymbolQuickPick([row('b', 'function'), row('a', 'function', 'src/z.ts'), row('a', 'function', 'src/a.ts')]);
        expect(items.map(i => `${i.label}@${i.symbol.nodeId}`)).toEqual(['a@src/a.ts', 'a@src/z.ts', 'b@src/a.ts']);
    });

    it('filters by kind', () => {
        const { items } = buildSymbolQuickPick([row('A', 'class'), row('b', 'function'), row('C', 'class')], { kind: 'class' });
        expect(items.map(i => i.label)).toEqual(['A', 'C']);
    });

    it('deduplicates the same symbol reported twice', () => {
        const { items } = buildSymbolQuickPick([row('a', 'function'), row('a', 'function'), row('a', 'method')]);
        expect(items.map(i => i.symbol.kind)).toEqual(['function', 'method']);
    });

    it('caps the list and flags the truncation', () => {
        const rows = Array.from({ length: 250 }, (_, i) => row(`sym${String(i).padStart(3, '0')}`, 'function'));
        const result = buildSymbolQuickPick(rows);
        expect(result.items).toHaveLength(MAX_SYMBOL_ITEMS);
        expect(result.total).toBe(250);
        expect(result.truncated).toBe(true);
    });

    it('honours an explicit limit and stays untruncated when everything fits', () => {
        const rows = Array.from({ length: 5 }, (_, i) => row(`sym${i}`, 'function'));
        const result = buildSymbolQuickPick(rows, { limit: 10 });
        expect(result.items).toHaveLength(5);
        expect(result.truncated).toBe(false);
        expect(buildSymbolQuickPick(rows, { limit: 3 }).truncated).toBe(true);
    });

    it('ignores malformed rows', () => {
        const { items } = buildSymbolQuickPick([
            row('', 'function'),
            { nodeId: '', name: 'x', kind: 'function', line: 1 },
            row('ok', 'function'),
        ]);
        expect(items.map(i => i.label)).toEqual(['ok']);
    });
});

describe('symbol-palette-core — symbolDetail', () => {
    it('omits missing metrics and shows the flags that exist', () => {
        expect(symbolDetail(row('a', 'function'))).toBe('');
        expect(symbolDetail(row('a', 'function', 'src/a.ts', 1, { isAsync: true }))).toBe('async');
        expect(symbolDetail(row('a', 'function', 'src/a.ts', 1, { visibility: 'private' }))).toBe('private');
        expect(symbolDetail(row('a', 'function', 'src/a.ts', 1, { visibility: 'public', isAsync: true, cognitive: 3 }))).toBe('cognitive 3 · async');
    });
});

describe('symbol-palette-core — buildKindChips', () => {
    const counts = [
        { kind: 'method', count: 140 },
        { kind: 'function', count: 82 },
        { kind: 'weird', count: 2 },
        { kind: 'class', count: 0 },
    ];

    it('starts with an All kinds chip and orders the parser kinds first', () => {
        const chips = buildKindChips(counts);
        expect(chips[0].kind).toBeUndefined();
        expect(chips[0].label).toBe('$(list-flat) All kinds');
        expect(chips.slice(1).map(c => c.kind)).toEqual(['function', 'method', 'weird']);
    });

    it('shows the counts and flags the active kind', () => {
        const chips = buildKindChips(counts, 'method');
        const method = chips.find(c => c.kind === 'method');
        expect(method?.label).toBe('$(symbol-method) method (140)');
        expect(method?.description).toBe('active filter');
        expect(chips[0].description).toBe('show every kind');
    });

    it('skips kinds with no symbol and tolerates an empty aggregate', () => {
        expect(buildKindChips([{ kind: 'class', count: 0 }])).toHaveLength(1);
        expect(buildKindChips([])).toHaveLength(1);
    });
});
