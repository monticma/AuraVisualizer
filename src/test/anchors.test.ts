import { describe, it, expect } from 'vitest';
import { formatAnchor, normalizeLine, withAnchor, withAnchors } from '../ai/anchors';

describe('anchors — normalizeLine', () => {
    it('accepts positive integers and floors decimals', () => {
        expect(normalizeLine(42)).toBe(42);
        expect(normalizeLine(42.9)).toBe(42);
    });

    it('rejects everything that cannot be a line', () => {
        expect(normalizeLine(0)).toBeUndefined();
        expect(normalizeLine(-3)).toBeUndefined();
        expect(normalizeLine(Number.NaN)).toBeUndefined();
        expect(normalizeLine(Number.POSITIVE_INFINITY)).toBeUndefined();
        expect(normalizeLine('42')).toBeUndefined();
        expect(normalizeLine(null)).toBeUndefined();
        expect(normalizeLine(undefined)).toBeUndefined();
    });
});

describe('anchors — formatAnchor', () => {
    it('builds path:line', () => {
        expect(formatAnchor('src/a.ts', 42)).toBe('src/a.ts:42');
        expect(formatAnchor('src/deep/nested/b.ts', 7)).toBe('src/deep/nested/b.ts:7');
    });

    it('normalizes Windows separators', () => {
        expect(formatAnchor('src\\win\\c.ts', 12)).toBe('src/win/c.ts:12');
    });

    it('refuses a file without a line, or a line without a file', () => {
        expect(formatAnchor('src/a.ts', undefined)).toBeUndefined();
        expect(formatAnchor('src/a.ts', 0)).toBeUndefined();
        expect(formatAnchor('', 42)).toBeUndefined();
        expect(formatAnchor(undefined, 42)).toBeUndefined();
        expect(formatAnchor('   ', 3)).toBeUndefined();
    });

    it('never emits :0 or :undefined', () => {
        for (const line of [0, -1, Number.NaN, undefined, null]) {
            const anchor = formatAnchor('src/a.ts', line);
            expect(anchor).toBeUndefined();
        }
    });
});

describe('anchors — withAnchor', () => {
    it('adds the anchor next to the existing fields', () => {
        const entry = { file: 'src/a.ts', symbol: 'parse', line: 42 };
        expect(withAnchor(entry, entry.file, entry.line)).toEqual({
            file: 'src/a.ts',
            symbol: 'parse',
            line: 42,
            anchor: 'src/a.ts:42',
        });
    });

    it('leaves a file-only entry untouched (no anchor key at all)', () => {
        const entry = { file: 'src/a.ts', fan_in: 3 };
        const result = withAnchor(entry, entry.file, undefined);
        expect(result).toEqual({ file: 'src/a.ts', fan_in: 3 });
        expect('anchor' in result).toBe(false);
    });

    it('does not mutate the input', () => {
        const entry = { file: 'src/a.ts', line: 5 };
        withAnchor(entry, entry.file, entry.line);
        expect(entry).toEqual({ file: 'src/a.ts', line: 5 });
    });

    it('works when the anchor field is not called "file"', () => {
        const edge = { source: 'src/a.ts', target: 'src/b.ts', type: 'extends' };
        expect(withAnchor(edge, edge.source, 12)).toEqual({
            source: 'src/a.ts',
            target: 'src/b.ts',
            type: 'extends',
            anchor: 'src/a.ts:12',
        });
    });
});

describe('anchors — withAnchors', () => {
    it('keeps the order and only anchors what has a line', () => {
        const rows = [
            { file: 'a.ts', line: 3 },
            { file: 'b.ts' },
            { file: 'c.ts', line: 0 },
        ];
        const result = withAnchors(rows, row => row.file, row => (row as { line?: number }).line);
        expect(result.map(row => row.anchor)).toEqual(['a.ts:3', undefined, undefined]);
        expect('anchor' in result[1]).toBe(false);
    });
});
