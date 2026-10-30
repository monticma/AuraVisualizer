import { describe, it, expect } from 'vitest';
import {
    LENS_TITLE,
    MAX_LENSES_PER_FILE,
    documentSymbolAnchors,
    lensArguments,
    lensLine,
    selectLensSymbols,
    symbolKindName,
} from '../codelens-core';

/** Rows as GraphDB stores them for a small TypeScript file. */
const TS_SYMBOLS = [
    { name: 'loadConfig', kind: 'function', line: 4 },
    { name: 'Config', kind: 'class', line: 12 },
    { name: 'defaults', kind: 'arrow', line: 18 },
    { name: 'Config', kind: 'class', line: 12 },        // duplicate row
    { name: 'loadConfig', kind: 'export-named', line: 4 }, // export mirror
    { name: 'fs', kind: 'import', line: 1 },
    { name: 'DEFAULTS', kind: 'constant', line: 6 },
    { name: 'LineOptions', kind: 'interface', line: 30 },
    { name: 'Mode', kind: 'enum', line: 40 },
    { name: 'NoLine', kind: 'function', line: 0 },
    { name: '', kind: 'function', line: 8 },
];

describe('codelens: symbol selection', () => {
    it('keeps callable/type symbols and drops exports, imports, constants and rows without a line', () => {
        const picked = selectLensSymbols(TS_SYMBOLS);
        expect(picked.map((s) => s.name)).toEqual([
            'loadConfig',
            'Config',
            'defaults',
            'LineOptions',
            'Mode',
        ]);
        expect(picked.map((s) => s.line)).toEqual([4, 12, 18, 30, 40]);
    });

    it('deduplicates identical symbol rows', () => {
        const picked = selectLensSymbols([
            { name: 'run', kind: 'function', line: 5 },
            { name: 'run', kind: 'function', line: 5 },
        ]);
        expect(picked).toHaveLength(1);
    });

    it('sorts by line, then by name', () => {
        const picked = selectLensSymbols([
            { name: 'zeta', kind: 'function', line: 9 },
            { name: 'alpha', kind: 'function', line: 9 },
            { name: 'first', kind: 'function', line: 2 },
        ]);
        expect(picked.map((s) => s.name)).toEqual(['first', 'alpha', 'zeta']);
    });

    it('normalizes kinds and truncates fractional lines', () => {
        const picked = selectLensSymbols([{ name: 'f', kind: 'Function', line: 7.9 }]);
        expect(picked).toEqual([{ name: 'f', kind: 'function', line: 7 }]);
    });

    it('is robust to junk input and caps the list', () => {
        expect(selectLensSymbols(undefined)).toEqual([]);
        expect(selectLensSymbols([])).toEqual([]);
        expect(selectLensSymbols([{ name: 42, kind: 'function', line: 3 }])).toEqual([]);
        expect(selectLensSymbols([{ name: 'f', kind: 'function', line: 'x' }])).toEqual([]);

        const many = Array.from({ length: MAX_LENSES_PER_FILE + 25 }, (_, i) => ({
            name: `fn${i}`,
            kind: 'function',
            line: i + 1,
        }));
        expect(selectLensSymbols(many)).toHaveLength(MAX_LENSES_PER_FILE);
        expect(selectLensSymbols(many, 10)).toHaveLength(10);
    });
});

describe('codelens: placement', () => {
    it('converts 1-based symbol lines to 0-based lens lines and clamps', () => {
        expect(lensLine(1)).toBe(0);
        expect(lensLine(5)).toBe(4);
        expect(lensLine(2.9)).toBe(1);
        expect(lensLine(0)).toBe(0);
        expect(lensLine(-4)).toBe(0);
        expect(lensLine(Number.NaN)).toBe(0);
    });

    it('exposes a stable title with the three actions', () => {
        expect(LENS_TITLE).toContain('focus');
        expect(LENS_TITLE).toContain('flow');
        expect(LENS_TITLE).toContain('impact');
    });

    it('keeps the lens command arguments in a stable order', () => {
        const args = lensArguments('src/a.ts', { name: 'run', kind: 'function', line: 12 }, 'typescript');
        expect(args).toEqual(['src/a.ts', 'run', 12, 'typescript']);
    });
});

describe('codelens: document-symbol fallback', () => {
    const symbol = (name: string, kind: number, line: number, children?: unknown[]) => ({
        name,
        kind,
        range: { start: { line } },
        children: children as never,
    });

    it('maps the VS Code symbol kinds Aura can use', () => {
        expect(symbolKindName(12)).toBe('function');
        expect(symbolKindName(6)).toBe('method');
        expect(symbolKindName(5)).toBe('class');
        expect(symbolKindName(11)).toBe('interface');
        expect(symbolKindName(10)).toBe('enum');
        expect(symbolKindName(23)).toBe('struct');
        expect(symbolKindName(13)).toBeNull(); // variable
        expect(symbolKindName(3)).toBeNull();  // namespace
    });

    it('flattens the tree, walks into containers and skips unusable kinds', () => {
        const anchors = documentSymbolAnchors([
            symbol('run', 12, 4),                       // function → line 5
            symbol('Config', 5, 11, [                   // class
                symbol('load', 6, 14),                  // method → walked
            ]),
            symbol('fs', 13, 0),                        // variable → skipped
            symbol('ns', 3, 2),                         // namespace → skipped
        ]);
        expect(anchors).toEqual([
            { name: 'run', kind: 'function', line: 5 },
            { name: 'Config', kind: 'class', line: 12 },
            { name: 'load', kind: 'method', line: 15 },
        ]);
    });

    it('ignores deeper nesting and respects the limit', () => {
        const deep = [symbol('outer', 5, 0, [symbol('mid', 5, 1, [symbol('inner', 12, 2)])])];
        expect(documentSymbolAnchors(deep).map((s) => s.name)).toEqual(['outer', 'mid']);

        const many = Array.from({ length: 20 }, (_, i) => symbol(`fn${i}`, 12, i));
        expect(documentSymbolAnchors(many, 5)).toHaveLength(5);
    });

    it('returns nothing for an empty or missing tree', () => {
        expect(documentSymbolAnchors(undefined)).toEqual([]);
        expect(documentSymbolAnchors([])).toEqual([]);
    });
});
