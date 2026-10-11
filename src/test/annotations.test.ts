import { describe, it, expect } from 'vitest';
import {
    parseAnnotations,
    serializeAnnotations,
    withNote,
    withoutNote,
    normalizeNoteColor,
    MAX_NOTE_LENGTH,
    type AnnotationMap,
} from '../annotations';

describe('annotations — parseAnnotations', () => {
    it('returns an empty map for missing or corrupt input', () => {
        expect(parseAnnotations(undefined)).toEqual({});
        expect(parseAnnotations(null)).toEqual({});
        expect(parseAnnotations('')).toEqual({});
        expect(parseAnnotations('not json')).toEqual({});
        expect(parseAnnotations('{"notes": 42}')).toEqual({});
    });

    it('parses valid notes and normalizes colors', () => {
        const raw = JSON.stringify({
            version: 1,
            notes: {
                'src/a.ts': { text: 'Refactor this', color: 'red', updatedAt: '2026-10-01T00:00:00.000Z' },
                'src/b.ts': { text: 'Keep', color: 'nope' },
            },
        });
        const map = parseAnnotations(raw);
        expect(Object.keys(map).sort()).toEqual(['src/a.ts', 'src/b.ts']);
        expect(map['src/a.ts']).toEqual({ text: 'Refactor this', color: 'red', updatedAt: '2026-10-01T00:00:00.000Z' });
        expect(map['src/b.ts'].color).toBe('yellow');
        expect(map['src/b.ts'].updatedAt).toBe('');
    });

    it('drops blank notes and trims text', () => {
        const raw = JSON.stringify({ notes: { 'a.ts': { text: '   ' }, 'b.ts': { text: '  keep me  ', color: 'blue' } } });
        const map = parseAnnotations(raw);
        expect(map['a.ts']).toBeUndefined();
        expect(map['b.ts'].text).toBe('keep me');
    });

    it('caps the note length', () => {
        const long = 'x'.repeat(MAX_NOTE_LENGTH + 500);
        const map = parseAnnotations(JSON.stringify({ notes: { 'a.ts': { text: long } } }));
        expect(map['a.ts'].text.length).toBe(MAX_NOTE_LENGTH);
    });
});

describe('annotations — serializeAnnotations', () => {
    it('round-trips through parse → serialize → parse', () => {
        const map: AnnotationMap = {
            'src/a.ts': { text: 'hello', color: 'green', updatedAt: '2026-10-11T00:00:00.000Z' },
        };
        expect(parseAnnotations(serializeAnnotations(map))).toEqual(map);
    });
});

describe('annotations — withNote / withoutNote', () => {
    const now = new Date('2026-10-11T12:00:00.000Z');

    it('adds a note without mutating the input map', () => {
        const before: AnnotationMap = {};
        const after = withNote(before, 'src/a.ts', 'To review', 'purple', now);
        expect(before).toEqual({});
        expect(after['src/a.ts']).toEqual({ text: 'To review', color: 'purple', updatedAt: '2026-10-11T12:00:00.000Z' });
    });

    it('replaces an existing note for the same path', () => {
        const map = withNote({}, 'src/a.ts', 'one', 'yellow', now);
        const updated = withNote(map, 'src/a.ts', 'two', 'red', now);
        expect(Object.keys(updated)).toEqual(['src/a.ts']);
        expect(updated['src/a.ts'].text).toBe('two');
        expect(updated['src/a.ts'].color).toBe('red');
    });

    it('removes the note when the text is blank', () => {
        const map = withNote({}, 'src/a.ts', 'one', 'yellow', now);
        expect(withNote(map, 'src/a.ts', '   ', 'yellow', now)).toEqual({});
    });

    it('withoutNote removes the entry and is a no-op when absent', () => {
        const map = withNote({}, 'src/a.ts', 'one', 'yellow', now);
        const removed = withoutNote(map, 'src/a.ts');
        expect(removed).toEqual({});
        expect(withoutNote(removed, 'not-there.ts')).toBe(removed);
    });
});

describe('annotations — normalizeNoteColor', () => {
    it('keeps known colors and falls back to yellow', () => {
        expect(normalizeNoteColor('red')).toBe('red');
        expect(normalizeNoteColor('purple')).toBe('purple');
        expect(normalizeNoteColor('crimson')).toBe('yellow');
        expect(normalizeNoteColor(3)).toBe('yellow');
        expect(normalizeNoteColor(undefined)).toBe('yellow');
    });
});
