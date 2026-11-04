import { describe, it, expect } from 'vitest';
import {
    hashString,
    isPositioned,
    layoutStats,
    seedDirection,
    seedMissingNodes,
    type SeedNode,
} from '../graph/seed-core';

function node(id: string, x?: number, y?: number, z?: number): SeedNode {
    const out: SeedNode = { id };
    if (x !== undefined) { out.x = x; out.y = y; out.z = z; }
    return out;
}

describe('hashString / seedDirection', () => {
    it('is stable and well spread', () => {
        expect(hashString('a.js')).toBe(hashString('a.js'));
        expect(hashString('a.js')).not.toBe(hashString('b.js'));
        expect(hashString('')).toBeGreaterThanOrEqual(0);
    });

    it('returns unit vectors', () => {
        for (const id of ['src/a.ts', 'src/b.ts', 'x', 'a-much-longer-identifier.ts']) {
            const dir = seedDirection(id);
            expect(Math.hypot(dir.x, dir.y, dir.z)).toBeCloseTo(1, 6);
        }
        expect(seedDirection('src/a.ts')).toEqual(seedDirection('src/a.ts'));
        expect(seedDirection('src/a.ts')).not.toEqual(seedDirection('src/b.ts'));
    });
});

describe('isPositioned', () => {
    it('rejects missing and non-finite coordinates', () => {
        expect(isPositioned(node('a'))).toBe(false);
        expect(isPositioned(node('a', NaN, 0, 0))).toBe(false);
        expect(isPositioned(node('a', 0, 0, Infinity))).toBe(false);
        expect(isPositioned(node('a', 0, 0, 0))).toBe(true);
        expect(isPositioned(null)).toBe(false);
    });
});

describe('layoutStats', () => {
    it('computes the centroid and the extent of the settled nodes', () => {
        const nodes = [node('a', 0, 0, 0), node('b', 10, 0, 0), node('c')];
        const stats = layoutStats(nodes);
        expect(stats.placed).toBe(2);
        expect(stats.centroid).toEqual({ x: 5, y: 0, z: 0 });
        expect(stats.extent).toBeCloseTo(5, 6);
    });

    it('falls back to a sane extent when nothing is placed', () => {
        const stats = layoutStats([node('a'), node('b')]);
        expect(stats.placed).toBe(0);
        expect(stats.centroid).toEqual({ x: 0, y: 0, z: 0 });
        expect(stats.extent).toBe(40);
    });
});

describe('seedMissingNodes', () => {
    it('does nothing when every node is already positioned', () => {
        const nodes = [node('a', 1, 2, 3), node('b', 4, 5, 6)];
        const before = JSON.stringify(nodes);
        const result = seedMissingNodes(nodes, [{ source: 'a', target: 'b' }]);
        expect(result.seeded).toBe(0);
        expect(JSON.stringify(nodes)).toBe(before);
    });

    it('seeds a node next to its positioned neighbours', () => {
        const hub = node('hub', 100, 0, 0);
        const fresh = node('fresh');
        const result = seedMissingNodes([hub, fresh], [{ source: 'hub', target: 'fresh' }]);
        expect(result).toEqual(expect.objectContaining({ seeded: 1, fromNeighbours: 1, fromSphere: 0, medianEdge: null }));
        expect(isPositioned(fresh)).toBe(true);
        // No settled edge to measure → fallback spacing, capped at 5 % of the
        // (fallback) extent of 40, i.e. 2 units.
        expect(result.unit).toBe(2);
        expect(Math.abs((fresh.x as number) - 100)).toBeLessThanOrEqual(2.001);
        expect(Math.abs(fresh.y as number)).toBeLessThanOrEqual(2.001);
    });

    it('scales the seed cloud on the median settled edge length', () => {
        // Two placed nodes 200 units apart give a median edge of 200 → 0.6 × 200
        // = 120, capped at 5 % of the extent (extent = 100 here → 5).
        const left = node('left', 0, 0, 0);
        const right = node('right', 200, 0, 0);
        const fresh = node('fresh');
        const result = seedMissingNodes([left, right, fresh], [
            { source: 'left', target: 'right' },
            { source: 'left', target: 'fresh' },
        ]);
        expect(result.medianEdge).toBe(200);
        expect(result.extent).toBe(100);
        expect(result.unit).toBe(5);   // 5 % of the extent wins over 0.6 × 200
        expect(result.fromNeighbours).toBe(1);
        const dist = Math.hypot((fresh.x as number) - 0, fresh.y as number, fresh.z as number);
        expect(dist).toBeCloseTo(5, 4);
    });

    it('gathers neighbourhood-less nodes by folder, away from the centroid', () => {
        const nodes = [
            node('a', 0, 0, 0),
            node('b', 20, 0, 0),
            node('webview/js/orphan.js'),
            node('webview/js/other.js'),
        ];
        const result = seedMissingNodes(nodes, [{ source: 'a', target: 'b' }]);
        expect(result).toEqual(expect.objectContaining({ seeded: 2, fromSphere: 2, fromNeighbours: 0 }));
        // The centroid is (10,0,0) and the extent 10: the folder lands 3.5–7
        // units away from it, never on top of it, and its members stay clustered
        // around that centre.
        const one = nodes[2];
        const two = nodes[3];
        const d1 = Math.hypot((one.x as number) - 10, one.y as number, one.z as number);
        const d2 = Math.hypot((two.x as number) - 10, two.y as number, two.z as number);
        expect(d1).toBeGreaterThanOrEqual(3.5);
        expect(d1).toBeLessThanOrEqual(7.5);
        expect(d2).toBeGreaterThanOrEqual(3.5);
        const between = Math.hypot((one.x as number) - (two.x as number), (one.y as number) - (two.y as number), (one.z as number) - (two.z as number));
        expect(between).toBeLessThanOrEqual(result.unit * 2);
    });

    it('spreads different folders apart', () => {
        const nodes = [
            node('a', 0, 0, 0), node('b', 100, 0, 0),
            node('src/one.js'), node('vendor/two.js'),
        ];
        seedMissingNodes(nodes, [{ source: 'a', target: 'b' }]);
        const d = Math.hypot((nodes[2].x as number) - (nodes[3].x as number), (nodes[2].y as number) - (nodes[3].y as number), (nodes[2].z as number) - (nodes[3].z as number));
        expect(d).toBeGreaterThan(5);   // two regions, not one shared ball
    });

    it('spreads several nodes arriving on the same hub', () => {
        const hub = node('hub', 0, 0, 0);
        const arrivals = [node('a'), node('b'), node('c'), node('d')];
        const links = arrivals.map(n => ({ source: 'hub', target: n.id }));
        const result = seedMissingNodes([hub, ...arrivals], links);
        expect(result.seeded).toBe(4);
        expect(result.fromNeighbours).toBe(4);
        const positions = arrivals.map(n => `${(n.x as number).toFixed(2)},${(n.y as number).toFixed(2)},${(n.z as number).toFixed(2)}`);
        expect(new Set(positions).size).toBe(4);   // no two nodes stacked on one point
    });

    it('is deterministic for the same input', () => {
        const build = () => {
            const nodes = [node('hub', 5, 5, 5), node('a'), node('b'), node('orphan')];
            seedMissingNodes(nodes, [{ source: 'hub', target: 'a' }, { source: 'hub', target: 'b' }]);
            return nodes.map(n => [n.x, n.y, n.z]);
        };
        expect(build()).toEqual(build());
    });

    it('accepts link endpoints given as objects', () => {
        const hub = node('hub', 0, 0, 0);
        const fresh = node('fresh');
        const result = seedMissingNodes([hub, fresh], [{ source: { id: 'hub' }, target: { id: 'fresh' } }]);
        expect(result.fromNeighbours).toBe(1);
        expect(isPositioned(fresh)).toBe(true);
    });

    it('handles an empty dataset', () => {
        expect(seedMissingNodes([], [])).toEqual({
            seeded: 0, fromNeighbours: 0, fromSphere: 0, radius: 0, extent: 0, unit: 0, medianEdge: null,
        });
    });
});
