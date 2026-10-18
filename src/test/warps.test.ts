import { describe, it, expect } from 'vitest';
import {
    MAX_WARP_NAME,
    MAX_WARPS,
    generateWarpId,
    makeWarp,
    normalizeQuickSlot,
    normalizeWarpName,
    parseWarps,
    removeWarp,
    serializeWarps,
    upsertWarp,
    warpByQuickSlot,
    type WarpList,
} from '../warps';

/** Minimal valid capture payload; overrides per test. */
function pose(over: Record<string, unknown> = {}) {
    return {
        pos: { x: 1, y: 2, z: 3 },
        target: { x: 0, y: 0, z: 0 },
        name: 'Test warp',
        createdAt: 1000,
        ...over,
    };
}

describe('warps: parse / serialize', () => {
    it('reads missing or corrupt data as an empty list', () => {
        expect(parseWarps(undefined)).toEqual([]);
        expect(parseWarps(null)).toEqual([]);
        expect(parseWarps('')).toEqual([]);
        expect(parseWarps('{ not json')).toEqual([]);
        expect(parseWarps('{"warps": "nope"}')).toEqual([]);
        expect(parseWarps('42')).toEqual([]);
    });

    it('round-trips a list through serialize/parse', () => {
        const warp = makeWarp(pose(), 2000)!;
        const raw = serializeWarps([warp]);
        expect(raw.endsWith('\n')).toBe(true);
        expect(JSON.parse(raw).version).toBe(1);
        expect(parseWarps(raw)).toEqual([warp]);
    });

    it('accepts a bare array as well as { warps }', () => {
        expect(parseWarps(JSON.stringify([pose()]))).toHaveLength(1);
        expect(parseWarps(JSON.stringify({ version: 1, warps: [pose()] }))).toHaveLength(1);
    });

    it('skips entries with an invalid pose and numbers the fallback names by index', () => {
        const list = parseWarps(JSON.stringify({
            warps: [
                { name: 'broken', pos: { x: 1 } },                        // no target — skipped
                pose({ name: '' }),                                       // blank name → "Warp 2"
                pose({ id: 'bad', pos: { x: 'a', y: 0, z: 0 } }),         // non-finite — skipped
                pose({ id: 'ok' }),
            ],
        }));
        expect(list).toHaveLength(2);
        expect(list[0].name).toBe('Warp 2');
        expect(list[1].id).toBe('ok');
    });

    it('skips duplicate ids (first one wins)', () => {
        const list = parseWarps(JSON.stringify({
            warps: [
                pose({ id: 'dup', name: 'First' }),
                pose({ id: 'dup', name: 'Second' }),
            ],
        }));
        expect(list).toHaveLength(1);
        expect(list[0].name).toBe('First');
    });

    it('caps the list at MAX_WARPS entries', () => {
        const entries = [];
        for (let i = 0; i < MAX_WARPS + 20; i++) entries.push(pose({ id: 'w' + i }));
        expect(parseWarps(JSON.stringify({ warps: entries }))).toHaveLength(MAX_WARPS);
    });
});

describe('warps: names and quick slots', () => {
    it('trims, collapses and caps names, with a fallback when blank', () => {
        expect(normalizeWarpName('  engine   core  ')).toBe('engine core');
        expect(normalizeWarpName('')).toBe('Warp');
        expect(normalizeWarpName('   ')).toBe('Warp');
        expect(normalizeWarpName(42, 'fallback')).toBe('fallback');
        expect(normalizeWarpName('x'.repeat(100))).toHaveLength(MAX_WARP_NAME);
    });

    it('accepts only integer quick slots in 1..9', () => {
        expect(normalizeQuickSlot(1)).toBe(1);
        expect(normalizeQuickSlot(9)).toBe(9);
        expect(normalizeQuickSlot('3')).toBeUndefined();
        expect(normalizeQuickSlot(0)).toBeUndefined();
        expect(normalizeQuickSlot(10)).toBeUndefined();
        expect(normalizeQuickSlot(Number.NaN)).toBeUndefined();
        expect(normalizeQuickSlot(undefined)).toBeUndefined();
    });
});

describe('warps: quaternion', () => {
    const IDENTITY = { x: 0, y: 0, z: 0, w: 1 };

    it('round-trips a captured orientation', () => {
        const warp = makeWarp(pose({ quat: IDENTITY }), 1000)!;
        expect(warp.quat).toEqual(IDENTITY);
        const round = parseWarps(serializeWarps([warp]))[0];
        expect(round.quat).toEqual(IDENTITY);
    });

    it('drops invalid quaternions but keeps the warp', () => {
        expect(makeWarp(pose({ quat: { x: 1, y: 0, z: 0 } }), 1000)!.quat).toBeUndefined();
        expect(makeWarp(pose({ quat: { x: Number.NaN, y: 0, z: 0, w: 1 } }), 1000)!.quat).toBeUndefined();
        expect(makeWarp(pose({ quat: { x: 0, y: 0, z: 0, w: 0 } }), 1000)!.quat).toBeUndefined();
        expect(makeWarp(pose({ quat: 'nope' }), 1000)!.quat).toBeUndefined();
    });

    it('normalizes to unit length', () => {
        const warp = makeWarp(pose({ quat: { x: 0, y: 2, z: 0, w: 0 } }), 1000)!;
        expect(warp.quat).toEqual({ x: 0, y: 1, z: 0, w: 0 });
    });

    it('round-trips and normalizes the camera up vector', () => {
        const warp = makeWarp(pose({ up: { x: 0, y: 2, z: 0 } }), 1000)!;
        expect(warp.up).toEqual({ x: 0, y: 1, z: 0 });
        const round = parseWarps(serializeWarps([warp]))[0];
        expect(round.up).toEqual({ x: 0, y: 1, z: 0 });
    });

    it('drops invalid up vectors but keeps the warp', () => {
        expect(makeWarp(pose({ up: { x: 0, y: 0, z: 0 } }), 1000)!.up).toBeUndefined();
        expect(makeWarp(pose({ up: { x: 0, y: 1 } }), 1000)!.up).toBeUndefined();
        expect(makeWarp(pose({ up: { x: Number.NaN, y: 1, z: 0 } }), 1000)!.up).toBeUndefined();
        expect(makeWarp(pose({ up: 'nope' }), 1000)!.up).toBeUndefined();
    });
});

describe('warps: makeWarp', () => {
    it('builds a warp with a generated id and timestamps', () => {
        const warp = makeWarp(pose({ name: undefined, createdAt: undefined }), 5000)!;
        expect(warp.id).toMatch(/^w_[0-9a-z]+$/);
        expect(warp.name).toBe('Warp');
        expect(warp.createdAt).toBe(5000);
        expect(warp.updatedAt).toBe(5000);
    });

    it('rejects unusable poses', () => {
        expect(makeWarp(null)).toBeNull();
        expect(makeWarp('nope')).toBeNull();
        expect(makeWarp({ pos: { x: 1, y: 2, z: 3 } })).toBeNull();
        expect(makeWarp({ pos: { x: 1, y: 2, z: Infinity }, target: { x: 0, y: 0, z: 0 } })).toBeNull();
    });

    it('preserves id and createdAt on edits, clamps the fov, stamps updatedAt', () => {
        const warp = makeWarp(pose({ id: 'w-keep', fov: 5, quickSlot: 3 }), 9000)!;
        expect(warp.id).toBe('w-keep');
        expect(warp.createdAt).toBe(1000);
        expect(warp.updatedAt).toBe(9000);
        expect(warp.fov).toBe(15); // clamped to MIN_FOV
        expect(warp.quickSlot).toBe(3);
    });

    it('generateWarpId produces distinct-looking ids', () => {
        expect(generateWarpId(1000)).toMatch(/^w_[0-9a-z]+$/);
    });
});

describe('warps: upsert / remove', () => {
    it('appends new warps and replaces by id in place', () => {
        const a = makeWarp(pose({ id: 'a', name: 'A' }), 1)!;
        const b = makeWarp(pose({ id: 'b', name: 'B' }), 2)!;
        let list = upsertWarp(upsertWarp([], a), b);
        expect(list.map((w) => w.id)).toEqual(['a', 'b']);

        const edited = makeWarp(pose({ id: 'a', name: 'A2' }), 3)!;
        list = upsertWarp(list, edited);
        expect(list.map((w) => w.name)).toEqual(['A2', 'B']);
    });

    it('assigning a quick slot steals it from the previous holder', () => {
        const a = makeWarp(pose({ id: 'a', quickSlot: 3 }), 1)!;
        const b = makeWarp(pose({ id: 'b', quickSlot: 3 }), 2)!;
        const list = upsertWarp(upsertWarp([], a), b);
        expect(warpByQuickSlot(list, 3)!.id).toBe('b');
        expect(list.find((w) => w.id === 'a')!.quickSlot).toBeUndefined();
    });

    it('drops the oldest warp when the list is full', () => {
        let list: WarpList = [];
        for (let i = 0; i < MAX_WARPS; i++) {
            const warp = makeWarp(pose({ id: 'w' + i }), i);
            if (!warp) throw new Error('unexpected');
            list = upsertWarp(list, warp);
        }
        const extra = makeWarp(pose({ id: 'extra' }), 99999)!;
        const next = upsertWarp(list, extra);
        expect(next).toHaveLength(MAX_WARPS);
        expect(next.find((w) => w.id === 'w0')).toBeUndefined();
        expect(next[next.length - 1].id).toBe('extra');
    });

    it('removeWarp removes by id and is a no-op (same reference) otherwise', () => {
        const a = makeWarp(pose({ id: 'a' }), 1)!;
        const list = upsertWarp([], a);
        expect(removeWarp(list, 'missing')).toBe(list);
        expect(removeWarp(list, 'a')).toEqual([]);
    });
});

describe('warps: node anchor', () => {
    const anchor = {
        id: 'src/a.js',
        pos: { x: 10, y: 0, z: 0 },
        posOffset: { x: 0, y: 0, z: 50 },
        targetOffset: { x: 0, y: 1, z: 0 },
    };

    it('preserves a valid anchor (node position + camera offsets)', () => {
        const warp = makeWarp(pose({ anchor }), 1000)!;
        expect(warp.anchor).toEqual(anchor);
    });

    it('drops invalid anchors instead of failing the warp', () => {
        expect(makeWarp(pose({ anchor: undefined }), 1000)!.anchor).toBeUndefined();
        expect(makeWarp(pose({ anchor: 'nope' }), 1000)!.anchor).toBeUndefined();
        expect(makeWarp(pose({ anchor: { ...anchor, id: '  ' } }), 1000)!.anchor).toBeUndefined();
        expect(makeWarp(pose({ anchor: { ...anchor, posOffset: { x: Number.NaN, y: 0, z: 0 } } }), 1000)!.anchor).toBeUndefined();
        expect(makeWarp(pose({ anchor: { ...anchor, targetOffset: null } }), 1000)!.anchor).toBeUndefined();
    });

    it('round-trips the anchor through serialize/parse', () => {
        const warp = makeWarp(pose({ id: 'w1', anchor }), 1000)!;
        const parsed = parseWarps(serializeWarps([warp]));
        expect(parsed[0].anchor).toEqual(anchor);
    });

    it('keeps old warps (no anchor) valid', () => {
        const warp = makeWarp(pose({ id: 'old' }), 1000)!;
        expect(warp.anchor).toBeUndefined();
        expect(parseWarps(serializeWarps([warp]))[0].anchor).toBeUndefined();
    });
});
