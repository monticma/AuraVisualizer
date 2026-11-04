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
        expect(result).toEqual(expect.objectContaining({ seeded: 1, fromNeighbours: 1, fromSphere: 0 }));
        expect(isPositioned(fresh)).toBe(true);
        // Within 40 % of the layout extent (extent here is 0 → fallback 40 → max 16).
        expect(Math.abs((fresh.x as number) - 100)).toBeLessThanOrEqual(16);
        expect(Math.abs(fresh.y as number)).toBeLessThanOrEqual(16);
    });

    it('places orphans on a sphere around the layout centroid', () => {
        const nodes = [node('a', 0, 0, 0), node('b', 20, 0, 0), node('orphan')];
        const result = seedMissingNodes(nodes, [{ source: 'a', target: 'b' }]);
        expect(result).toEqual(expect.objectContaining({ seeded: 1, fromSphere: 1, fromNeighbours: 0 }));
        const orphan = nodes[2];
        // Extent = 10 around centroid (10,0,0) → radius 5.
        expect(Math.hypot((orphan.x as number) - 10, orphan.y as number, orphan.z as number)).toBeCloseTo(5, 5);
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
        expect(seedMissingNodes([], [])).toEqual({ seeded: 0, fromNeighbours: 0, fromSphere: 0, radius: 0, extent: 0 });
    });
});
