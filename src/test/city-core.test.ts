import { describe, it, expect } from 'vitest';
import {
    squarify,
    tierEdges,
    tierOf,
    heightFor,
    layoutCity,
    districtKeyOf,
    districtDepth,
    metricValue,
    functionNodes,
    cityScaleFor,
    BASE_CITY_SCALE,
    REFERENCE_BUILDINGS,
    MIN_CITY_SCALE,
    MAX_CITY_SCALE,
    MIN_HEIGHT_RATIO,
    DEFAULT_HEIGHT_COUNT,
    type CityNodeLike,
    type CityFileNodeLike,
} from '../graph/city-core';

function node(id: string, patch: Partial<CityNodeLike> = {}): CityNodeLike {
    return { id, group: 'src', linesOfCode: 100, complexity: 10, cognitive: 8, ...patch };
}

function overlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
    const epsilon = 1e-9;
    return a.x < b.x + b.w - epsilon && b.x < a.x + a.w - epsilon
        && a.y < b.y + b.h - epsilon && b.y < a.y + a.h - epsilon;
}

describe('city-core · squarify', () => {
    const rect = { x: 0, y: 0, w: 1, h: 1 };
    const items = [
        { id: 'a', value: 40 }, { id: 'b', value: 30 }, { id: 'c', value: 20 }, { id: 'd', value: 10 },
    ];

    it('places every item exactly once', () => {
        const placed = squarify(items, rect);
        expect(placed).toHaveLength(items.length);
        expect(new Set(placed.map(p => p.id)).size).toBe(items.length);
    });

    it('conserves the area within 0.5 %', () => {
        const placed = squarify(items, rect);
        const area = placed.reduce((sum, p) => sum + p.w * p.h, 0);
        expect(Math.abs(area - 1)).toBeLessThan(0.005);
    });

    it('never overlaps two rectangles', () => {
        const placed = squarify(items, rect);
        for (let i = 0; i < placed.length; i++) {
            for (let j = i + 1; j < placed.length; j++) {
                expect(overlap(placed[i], placed[j])).toBe(false);
            }
        }
    });

    it('is deterministic, including for equal values (id tie-break)', () => {
        const tied = [{ id: 'z', value: 5 }, { id: 'a', value: 5 }];
        expect(squarify(tied, rect)).toEqual(squarify([...tied].reverse(), rect));
    });

    it('ignores zero/negative values and degenerate rectangles', () => {
        expect(squarify([{ id: 'a', value: 0 }], rect)).toEqual([]);
        expect(squarify(items, { x: 0, y: 0, w: 0, h: 1 })).toEqual([]);
        expect(squarify([], rect)).toEqual([]);
    });

    it('does not mutate its input', () => {
        const frozen = JSON.parse(JSON.stringify(items)) as typeof items;
        squarify(items, rect);
        expect(items).toEqual(frozen);
    });
});

describe('city-core · tiers and heights', () => {
    it('produces heightCount + 1 ascending boundaries', () => {
        const values = Array.from({ length: 100 }, (_, i) => i);
        const edges = tierEdges(values, DEFAULT_HEIGHT_COUNT);
        expect(edges).toHaveLength(DEFAULT_HEIGHT_COUNT + 1);
        for (let i = 1; i < edges.length; i++) expect(edges[i]).toBeGreaterThanOrEqual(edges[i - 1]);
    });

    it('buckets values into the right tier', () => {
        const edges = tierEdges([0, 10, 20, 30, 40], 4);
        expect(tierOf(-5, edges)).toBe(1);
        expect(tierOf(40, edges)).toBe(4);
        expect(tierOf(11, edges)).toBeGreaterThan(tierOf(9, edges));
    });

    it('collapses to a single tier when every value is equal', () => {
        const edges = tierEdges([7, 7, 7, 7], 5);
        expect(new Set(edges).size).toBe(1);
        expect(heightFor(7, { min: 7, max: 7, median: 7 }, 'quantiles', edges)).toBe(1);
    });

    it('quantiles yield exactly 5 distinct heights on a spread', () => {
        const values = Array.from({ length: 50 }, (_, i) => i + 1);
        const edges = tierEdges(values, 5);
        const reference = { min: 1, max: 50, median: 25 };
        const heights = new Set(values.map(v => heightFor(v, reference, 'quantiles', edges)));
        expect(heights.size).toBe(5);
    });

    it('linear is monotonic and stays above the minimum ratio', () => {
        const reference = { min: 2, max: 100, median: 50 };
        const low = heightFor(2, reference, 'linear');
        const mid = heightFor(50, reference, 'linear');
        const high = heightFor(100, reference, 'linear');
        expect(low).toBeCloseTo(MIN_HEIGHT_RATIO, 5);
        expect(low).toBeLessThan(mid);
        expect(mid).toBeLessThan(high);
        expect(high).toBeCloseTo(1, 5);
    });

    it('threshold yields two levels split at the median', () => {
        const reference = { min: 0, max: 100, median: 50 };
        expect(heightFor(10, reference, 'threshold')).toBeLessThan(heightFor(90, reference, 'threshold'));
        expect(heightFor(49, reference, 'threshold')).toBe(heightFor(1, reference, 'threshold'));
    });

    it('clamps linear heights outside the observed range', () => {
        const reference = { min: 10, max: 20, median: 15 };
        expect(heightFor(-100, reference, 'linear')).toBeCloseTo(MIN_HEIGHT_RATIO, 5);
        expect(heightFor(1000, reference, 'linear')).toBeCloseTo(1, 5);
    });
});

describe('city-core · districts', () => {
    it('derives the key from group, layer or community', () => {
        const n = node('a', { group: 'src/ui', layer: 'web', community: 'C3' });
        expect(districtKeyOf(n, 'group')).toBe('src/ui');
        expect(districtKeyOf(n, 'layer')).toBe('web');
        expect(districtKeyOf(n, 'community')).toBe('C3');
        expect(districtKeyOf(node('b', { layer: undefined }), 'layer')).toBe('(unlayered)');
        expect(districtKeyOf(node('c', { community: undefined, group: 'src/core' }), 'community')).toBe('src/core');
    });

    it('normalizes separators and falls back to the path', () => {
        expect(districtKeyOf({ id: 'x', group: 'src\\ui\\' }, 'group')).toBe('src/ui');
        expect(districtKeyOf({ id: 'y', path: 'lib/a.ts' }, 'group')).toBe('lib/a.ts');
        expect(districtKeyOf({ id: 'z' }, 'group')).toBe('.');
    });

    it('computes nesting depth', () => {
        expect(districtDepth('.')).toBe(0);
        expect(districtDepth('src')).toBe(0);
        expect(districtDepth('src/ui/widgets')).toBe(2);
    });
});

describe('city-core · layoutCity', () => {
    const nodes: CityNodeLike[] = [
        node('src/a.ts', { group: 'src', linesOfCode: 400, cognitive: 40 }),
        node('src/b.ts', { group: 'src', linesOfCode: 100, cognitive: 10 }),
        node('src/ui/c.ts', { group: 'src/ui', linesOfCode: 200, cognitive: 20 }),
        node('src/ui/d.ts', { group: 'src/ui', linesOfCode: 50, cognitive: 5 }),
        node('lib/e.ts', { group: 'lib', linesOfCode: 300, cognitive: 30 }),
    ];

    it('returns one building per node, inside the unit square', () => {
        const plan = layoutCity(nodes);
        expect(plan.rects).toHaveLength(nodes.length);
        for (const rect of plan.rects) {
            expect(rect.x).toBeGreaterThanOrEqual(0);
            expect(rect.z).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.w).toBeLessThanOrEqual(1 + 1e-9);
            expect(rect.z + rect.d).toBeLessThanOrEqual(1 + 1e-9);
            expect(rect.h).toBeGreaterThanOrEqual(MIN_HEIGHT_RATIO);
            expect(rect.h).toBeLessThanOrEqual(1 + 1e-9);
        }
    });

    it('is deterministic', () => {
        expect(layoutCity(nodes)).toEqual(layoutCity(nodes.slice().reverse()));
    });

    it('groups nodes into districts with their nesting depth', () => {
        const plan = layoutCity(nodes);
        const keys = plan.districts.map(d => d.key).sort();
        expect(keys).toEqual(['lib', 'src', 'src/ui']);
        expect(plan.districts.find(d => d.key === 'src/ui')?.depth).toBe(1);
        expect(plan.districts.find(d => d.key === 'lib')?.depth).toBe(0);
        expect(plan.districts.reduce((sum, d) => sum + d.count, 0)).toBe(nodes.length);
    });

    it('keeps buildings inside their own district block', () => {
        const plan = layoutCity(nodes);
        for (const rect of plan.rects) {
            const district = plan.districts.find(d => d.key === rect.district);
            expect(district).toBeDefined();
            if (!district) continue;
            expect(rect.x).toBeGreaterThanOrEqual(district.x - 1e-9);
            expect(rect.z).toBeGreaterThanOrEqual(district.z - 1e-9);
            expect(rect.x + rect.w).toBeLessThanOrEqual(district.x + district.w + 1e-9);
            expect(rect.z + rect.d).toBeLessThanOrEqual(district.z + district.d + 1e-9);
        }
    });

    it('gives bigger files a bigger footprint by default', () => {
        const plan = layoutCity(nodes);
        const big = plan.rects.find(r => r.id === 'src/a.ts');
        const small = plan.rects.find(r => r.id === 'src/ui/d.ts');
        expect(big && small).toBeTruthy();
        if (!big || !small) return;
        expect(big.w * big.d).toBeGreaterThan(small.w * small.d);
    });

    it('falls back to complexity when no node reports cognitive complexity', () => {
        const plain = nodes.map(n => ({ ...n, cognitive: undefined }));
        const plan = layoutCity(plain, { height: 'cognitive' });
        expect(plan.heightMetric).toBe('complexity');
    });

    it('honours an explicit height metric and mapping', () => {
        const plan = layoutCity(nodes, { height: 'linesOfCode', mapping: 'linear' });
        expect(plan.heightMetric).toBe('linesOfCode');
        const tallest = plan.rects.slice().sort((a, b) => b.h - a.h)[0];
        expect(tallest.id).toBe('src/a.ts');
        const shortest = plan.rects.slice().sort((a, b) => a.h - b.h)[0];
        expect(shortest.id).toBe('src/ui/d.ts');
    });

    it('threshold mode only produces two heights', () => {
        const plan = layoutCity(nodes, { height: 'linesOfCode', mapping: 'threshold' });
        expect(new Set(plan.rects.map(r => r.h)).size).toBe(2);
    });

    it('exposes a positive median edge for sizing', () => {
        const plan = layoutCity(nodes);
        expect(plan.medianEdge).toBeGreaterThan(0);
        expect(plan.medianEdge).toBeLessThan(1);
    });

    it('leaves a street between two buildings of the same district', () => {
        const pair = [
            node('p/a.ts', { group: 'src', linesOfCode: 100 }),
            node('p/b.ts', { group: 'src', linesOfCode: 100 }),
        ];
        const plan = layoutCity(pair);
        const [a, b] = plan.rects;
        const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
        const gapZ = Math.max(b.z - (a.z + a.d), a.z - (b.z + b.d));
        expect(Math.max(gapX, gapZ)).toBeGreaterThan(0);
    });

    it('lets blocks share a wall when buildingGap is 0', () => {
        const pair = [
            node('p/a.ts', { group: 'src', linesOfCode: 100 }),
            node('p/b.ts', { group: 'src', linesOfCode: 100 }),
        ];
        const plan = layoutCity(pair, { buildingGap: 0 });
        const [a, b] = plan.rects;
        const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
        const gapZ = Math.max(b.z - (a.z + a.d), a.z - (b.z + b.d));
        expect(Math.max(gapX, gapZ)).toBeLessThan(1e-9);
    });

    it('never collapses a building, even with a wide street', () => {
        const many = Array.from({ length: 40 }, (_, i) => node('q/' + i + '.ts', { group: 'src', linesOfCode: 10 }));
        const plan = layoutCity(many, { buildingGap: 0.6 });
        expect(plan.rects).toHaveLength(40);
        for (const rect of plan.rects) {
            expect(rect.w).toBeGreaterThan(0);
            expect(rect.d).toBeGreaterThan(0);
        }
    });

    it('compresses the footprint so the tail of a skewed repository stays visible', () => {
        // LOC 1 → 23 028 is the real ThorV2 spread: a linear footprint gives one
        // file 6 % of the city and leaves the tail with sub-pixel cells.
        const real = [
            node('big.ts', { linesOfCode: 23028 }),
            ...Array.from({ length: 60 }, (_, i) => node('tail/' + i + '.ts', { linesOfCode: 20 + i })),
        ];
        const linear = layoutCity(real, { footprintScale: 'linear' });
        const sqrt = layoutCity(real, { footprintScale: 'sqrt' });
        const areaOf = (plan: typeof linear, id: string) => {
            const rect = plan.rects.find(r => r.id === id);
            return rect ? rect.w * rect.d : 0;
        };
        expect(areaOf(sqrt, 'big.ts')).toBeLessThan(areaOf(linear, 'big.ts') * 0.5);
        const smallest = 'tail/0.ts';
        expect(areaOf(sqrt, smallest)).toBeGreaterThan(areaOf(linear, smallest));
    });

    it('exposes the raw metric, not the compressed weight', () => {
        const plan = layoutCity([node('a.ts', { linesOfCode: 400 })], {});
        expect(plan.rects[0].footprintValue).toBe(400);
    });

    it('gives every building a street, even in a very dense district', () => {
        const many = Array.from({ length: 200 }, (_, i) => node('d/' + i + '.ts', { group: 'src', linesOfCode: 1 + i }));
        const plan = layoutCity(many, {});
        for (const rect of plan.rects) {
            expect(rect.w).toBeGreaterThan(0);
            expect(rect.d).toBeGreaterThan(0);
        }
        const total = plan.rects.reduce((sum, r) => sum + r.w * r.d, 0);
        const district = plan.districts[0];
        // Streets must eat a real share of the district, not 0.1 %.
        expect(total).toBeLessThan(district.w * district.d * 0.85);
    });

    it('survives empty and single-node inputs', () => {
        expect(layoutCity([]).rects).toEqual([]);
        const single = layoutCity([node('only.ts')]);
        expect(single.rects).toHaveLength(1);
        expect(single.rects[0].h).toBe(1);
    });

    it('treats missing metrics as zero without producing NaN', () => {
        const plan = layoutCity([{ id: 'a' }, { id: 'b', linesOfCode: 10 }]);
        for (const rect of plan.rects) {
            expect(Number.isFinite(rect.x)).toBe(true);
            expect(Number.isFinite(rect.z)).toBe(true);
            expect(Number.isFinite(rect.w)).toBe(true);
            expect(Number.isFinite(rect.d)).toBe(true);
            expect(Number.isFinite(rect.h)).toBe(true);
        }
        expect(metricValue({ id: 'c' }, 'cognitive')).toBe(0);
    });
});

describe('city-core · function granularity', () => {
    function file(id: string, symbols: CityFileNodeLike['symbols'], patch: Partial<CityFileNodeLike> = {}): CityFileNodeLike {
        return { id, path: id, group: 'src', linesOfCode: 500, complexity: 30, ...patch, symbols };
    }

    it('turns every function and method into its own building', () => {
        const out = functionNodes([file('src/a.c', {
            functions: [{ name: 'init', line: 3, cyclomatic: 4, cognitive: 6, functionLines: 20 }],
            methods: [{ name: 'run', line: 40, cyclomatic: 2, cognitive: 1, functionLines: 9 }],
        })]);
        expect(out.map(n => n.id)).toEqual(['src/a.c#init', 'src/a.c#run']);
        expect(out.map(n => n.name)).toEqual(['init', 'run']);
    });

    it('uses the file as the district, so functions nest in their file', () => {
        const out = functionNodes([file('src/deep/a.c', {
            functions: [{ name: 'f' }, { name: 'g' }],
        })]);
        for (const building of out) {
            expect(building.group).toBe('src/deep/a.c');
            expect(districtKeyOf(building, 'group')).toBe('src/deep/a.c');
            expect(districtDepth(districtKeyOf(building, 'group'))).toBe(2);
        }
    });

    it('reads the function metrics, not the file ones', () => {
        const out = functionNodes([file('src/a.c', {
            functions: [{ name: 'big', cyclomatic: 40, cognitive: 55, functionLines: 300 }],
        }, { linesOfCode: 9999, complexity: 1, cognitive: 1 })]);
        expect(out[0].linesOfCode).toBe(300);
        expect(out[0].complexity).toBe(40);
        expect(out[0].cognitive).toBe(55);
    });

    it('falls back on sane values when the analyzer gave no metrics', () => {
        const out = functionNodes([file('src/a.c', { functions: [{ name: 'bare' }] })]);
        expect(out[0].linesOfCode).toBe(1);
        expect(out[0].complexity).toBe(1);
        expect(out[0].cognitive).toBe(1);
        expect(out[0].fanIn).toBe(0);
        expect(out[0].pagerank).toBe(0);
    });

    it('keeps the cognitive → cyclomatic fallback per function', () => {
        const out = functionNodes([file('src/a.c', {
            functions: [{ name: 'nocyclo', cyclomatic: undefined, cognitive: undefined }],
        })]);
        expect(out[0].cognitive).toBe(1);
    });

    it('disambiguates same-named symbols deterministically', () => {
        const out = functionNodes([file('src/a.c', {
            functions: [{ name: 'parse', line: 5 }, { name: 'parse', line: 60 }],
        })]);
        expect(out.map(n => n.id)).toEqual(['src/a.c#parse', 'src/a.c#parse#2']);
        // Same input, same ids, same order.
        const again = functionNodes([file('src/a.c', {
            functions: [{ name: 'parse', line: 5 }, { name: 'parse', line: 60 }],
        })]);
        expect(again.map(n => n.id)).toEqual(out.map(n => n.id));
    });

    it('keeps the source line for the "open file" action', () => {
        const out = functionNodes([file('src/a.c', { functions: [{ name: 'go', line: 42 }] })]);
        expect(out[0].line).toBe(42);
    });

    it('skips files without symbols and symbols without a name', () => {
        expect(functionNodes([{ id: 'empty.c', path: 'empty.c' }])).toEqual([]);
        const out = functionNodes([file('src/a.c', {
            functions: [{ name: '' }, { line: 3 } as { name?: string }, { name: 'ok' }],
        })]);
        expect(out).toHaveLength(1);
    });

    it('caps a single file at limitPerFile', () => {
        const many = Array.from({ length: 40 }, (_, i) => ({ name: 'f' + i }));
        const out = functionNodes([file('src/a.c', { functions: many })], { limitPerFile: 10 });
        expect(out).toHaveLength(10);
        expect(out[0].id).toBe('src/a.c#f0');
    });

    it('lays out a city of functions with the file as the district', () => {
        const nodes = functionNodes([
            file('src/a.c', { functions: [{ name: 'f', functionLines: 10, cyclomatic: 10 }] }),
            file('src/b.c', { functions: [{ name: 'g', functionLines: 10, cyclomatic: 2 }] }),
        ]);
        const plan = layoutCity(nodes, {});
        expect(plan.rects).toHaveLength(2);
        expect(plan.districts.map(d => d.key).sort()).toEqual(['src/a.c', 'src/b.c']);
        expect(plan.rects[0].heightValue).toBeGreaterThan(plan.rects[1].heightValue);
    });
});

describe('city-core · city scale', () => {
    it('renders the reference count at the base size', () => {
        expect(cityScaleFor(REFERENCE_BUILDINGS)).toBeCloseTo(BASE_CITY_SCALE, 6);
    });

    it('grows with the square root of the building count', () => {
        const quarter = cityScaleFor(REFERENCE_BUILDINGS / 4);
        const quadruple = cityScaleFor(REFERENCE_BUILDINGS * 4);
        expect(quadruple / BASE_CITY_SCALE).toBeCloseTo(2, 6);
        expect(quarter).toBe(MIN_CITY_SCALE);           // clamped, not 260.0 by luck
        expect(cityScaleFor(3048)).toBeGreaterThan(cityScaleFor(1524));
    });

    it('clamps both ends so a village and a monster stay on the ground', () => {
        expect(cityScaleFor(1)).toBe(MIN_CITY_SCALE);
        expect(cityScaleFor(20)).toBe(MIN_CITY_SCALE);
        expect(cityScaleFor(1_000_000)).toBe(MAX_CITY_SCALE);
    });

    it('never returns NaN for empty or broken counts', () => {
        expect(cityScaleFor(0)).toBe(BASE_CITY_SCALE);
        expect(cityScaleFor(NaN)).toBe(BASE_CITY_SCALE);
        expect(cityScaleFor(-12)).toBe(BASE_CITY_SCALE);
    });

    it('is monotonic, so two cities are always ordered by size', () => {
        const sizes = [4, 20, 200, 762, 1_500, 4_993, 20_000].map(cityScaleFor);
        for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
    });
});
