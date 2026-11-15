import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * The centrality orbit (tilted dashed ring + orbiting moon) lives in
 * `webview/js/sprites.js` as a browser IIFE that publishes `window.AuraSprites`.
 * It is evaluated here the way the webview loads it — no bundler, no module
 * system — against a minimal THREE stub, so the shipped file is what runs.
 *
 * The point of these tests is the geometry contract the visual design rests on:
 * the orbit must sit OUTSIDE the dirty/note rings, live in its own (tilted)
 * plane, and actually move.
 */

// ---------- minimal THREE stub ----------
class Vec3 {
    x = 0;
    y = 0;
    z = 0;
    set(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }
    setScalar(v: number) {
        return this.set(v, v, v);
    }
}

class Object3D {
    position = new Vec3();
    scale = new Vec3();
    children: any[] = [];
    parent: any = null;
    matrixWorldUpdates = 0;
    add(child: any) {
        child.parent = this;
        this.children.push(child);
        return this;
    }
    updateMatrixWorld(_force?: boolean) {
        this.matrixWorldUpdates++;
    }
}

class Group extends Object3D {}

class Mesh extends Object3D {
    frustumCulled = true;
    onBeforeRender: null | (() => void) = null;
    constructor(public geometry: any, public material: any) {
        super();
    }
}

class LineLoop extends Object3D {
    distanceComputations = 0;
    constructor(public geometry: any, public material: any) {
        super();
    }
    computeLineDistances() {
        this.distanceComputations++;
        this.geometry.setAttribute('lineDistance', new Float32BufferAttribute(new Float32Array(1), 1));
    }
}

class BufferGeometry {
    attributes: Record<string, any> = {};
    setAttribute(name: string, attr: any) {
        this.attributes[name] = attr;
    }
    getAttribute(name: string) {
        return this.attributes[name];
    }
}

class Float32BufferAttribute {
    constructor(
        public array: Float32Array,
        public itemSize: number
    ) {}
}

class SphereGeometry {
    constructor(
        public radius: number,
        public widthSegments: number,
        public heightSegments: number
    ) {}
}

class LineDashedMaterial {
    constructor(public params: any) {
        Object.assign(this, params);
    }
}

class MeshBasicMaterial {
    constructor(public params: any) {
        Object.assign(this, params);
    }
}

const THREE = {
    Group,
    Mesh,
    LineLoop,
    BufferGeometry,
    Float32BufferAttribute,
    SphereGeometry,
    LineDashedMaterial,
    MeshBasicMaterial
};

// ---------- load the shipped webview file ----------
type OrbitOptions = { moon?: boolean; phase?: number; animate?: boolean };
type SpritesApi = {
    centralityOrbit: (nodeRadius: number, opacityFactor?: number, opts?: OrbitOptions) => any;
    ORBIT: {
        RADIUS: number;
        TILT: number;
        PERIOD_MS: number;
        MOON_RADIUS: number;
        RING_OPACITY: number;
        motionAllowed: () => boolean;
    };
};

let S: SpritesApi;
let now = 0;
let reducedMotion = false;

/** Fresh module instance: the caches must not leak between tests. */
function load() {
    const src = readFileSync(join(__dirname, '..', '..', 'webview', 'js', 'sprites.js'), 'utf8');
    const win: any = {
        THREE,
        matchMedia: (query: string) => ({ matches: reducedMotion && query.includes('reduce') })
    };
    const doc = { createElement: () => ({ getContext: () => ({}) }) };
    const perf = { now: () => now };
    new Function('window', 'document', 'performance', src)(win, doc, perf);
    return win.AuraSprites as SpritesApi;
}

const orbit = (nodeRadius = 1, dim = 1, opts?: OrbitOptions) => S.centralityOrbit(nodeRadius, dim, opts);
const ringOf = (group: any) => group.children[0];
const moonOf = (group: any) => group.children[1];

beforeEach(() => {
    now = 0;
    reducedMotion = false;
    S = load();
});

describe('centrality orbit — placement', () => {
    it('sits outside the billboard rings it has to stay clear of', () => {
        // Dirty/note rings: sprite scale 8 × node radius, ring stroke at 0.60 of
        // the half-canvas → 2.4 × radius. The halo glow peaks at 2.4 as well.
        // That coincidence is the whole bug: three circular glows, one plane.
        const billboardRingRadius = 0.6 * (8 / 2);
        expect(billboardRingRadius).toBeCloseTo(2.4, 5);
        expect(S.ORBIT.RADIUS).toBeGreaterThan(billboardRingRadius + 0.5);
    });

    it('scales with the node radius', () => {
        expect(orbit(2).scale.x).toBeCloseTo(2 * S.ORBIT.RADIUS, 5);
        expect(orbit(0.5).scale.x).toBeCloseTo(0.5 * S.ORBIT.RADIUS, 5);
    });

    it('refuses a degenerate radius instead of drawing a zero-size ring', () => {
        expect(orbit(0)).toBeNull();
        expect(orbit(-1)).toBeNull();
        expect(S.centralityOrbit(undefined as unknown as number, 1)).toBeNull();
        expect(S.centralityOrbit(NaN, 1)).toBeNull();
    });
});

describe('centrality orbit — the ring', () => {
    it('is a closed circle of unit radius lying in a tilted plane', () => {
        const geometry = ringOf(orbit(1)).geometry;
        const pos: Float32Array = geometry.getAttribute('position').array;
        const points = pos.length / 3;
        expect(points).toBe(128);

        let maxAbsY = 0;
        for (let i = 0; i < points; i++) {
            const x = pos[i * 3];
            const y = pos[i * 3 + 1];
            const z = pos[i * 3 + 2];
            expect(Math.sqrt(x * x + y * y + z * z)).toBeCloseTo(1, 5);
            // Every point is on the tilted plane y·cosT − z·sinT = 0.
            expect(y * Math.cos(S.ORBIT.TILT) - z * Math.sin(S.ORBIT.TILT)).toBeCloseTo(0, 5);
            maxAbsY = Math.max(maxAbsY, Math.abs(y));
        }
        // The tilt is real, not a level circle pretending to be one.
        expect(maxAbsY).toBeCloseTo(Math.sin(S.ORBIT.TILT), 5);
        expect(maxAbsY).toBeGreaterThan(0.2);
    });

    it('is dashed, and the dash distances are computed once for the session', () => {
        const a = orbit(1);
        const b = orbit(3);
        const ringA = ringOf(a);
        const ringB = ringOf(b);

        expect(ringA.material.dashSize).toBeGreaterThan(0);
        expect(ringA.material.gapSize).toBeGreaterThan(0);
        // Both rings share one geometry, and computeLineDistances() writes onto
        // that geometry — running it per node would be wasted work on rebuild.
        expect(ringB.geometry).toBe(ringA.geometry);
        expect(ringA.distanceComputations + ringB.distanceComputations).toBe(1);
    });

    it('dims with the node', () => {
        expect(ringOf(orbit(1, 1)).material.opacity).toBeCloseTo(S.ORBIT.RING_OPACITY, 5);
        expect(ringOf(orbit(1, 0.5)).material.opacity).toBeCloseTo(S.ORBIT.RING_OPACITY * 0.5, 5);
    });
});

describe('centrality orbit — the moon', () => {
    it('actually travels along the orbit', () => {
        const moon = moonOf(orbit(1));
        expect(typeof moon.onBeforeRender).toBe('function');

        moon.onBeforeRender();
        const start = { ...moon.position };
        expect(Math.hypot(start.x, start.y, start.z)).toBeCloseTo(1, 5);

        now = S.ORBIT.PERIOD_MS / 4;
        moon.onBeforeRender();
        const later = { ...moon.position };

        expect(Math.hypot(later.x - start.x, later.y - start.y, later.z - start.z)).toBeGreaterThan(0.5);
        // Refreshing matrixWorld is what makes the new position visible on the
        // very frame it is computed — the sprite pulse does the same.
        expect(moon.matrixWorldUpdates).toBeGreaterThan(1);
    });

    it('stays on the tilted plane and never leaves the circle', () => {
        const moon = moonOf(orbit(1));
        for (const t of [0, 700, 1400, 2100, 2800, 3500]) {
            now = t;
            moon.onBeforeRender();
            const { x, y, z } = moon.position;
            expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5);
            expect(y * Math.cos(S.ORBIT.TILT) - z * Math.sin(S.ORBIT.TILT)).toBeCloseTo(0, 5);
        }
    });

    it('is not culled while it moves', () => {
        // Its bounding sphere is computed once from the geometry: half the orbit
        // would fall outside it and the moon would pop out of existence.
        expect(moonOf(orbit(1)).frustumCulled).toBe(false);
    });

    it('dims with the node', () => {
        expect(moonOf(orbit(1, 0.4)).material.opacity).toBeCloseTo(0.4, 5);
    });

    it('can be omitted — the ring alone is the large-graph fallback', () => {
        const group = orbit(1, 1, { moon: false });
        expect(group.children).toHaveLength(1);
        expect(ringOf(group).material.opacity).toBeGreaterThan(0);
    });

    it('desynchronises neighbours through the phase offset', () => {
        const a = moonOf(orbit(1, 1, { phase: 0 }));
        const b = moonOf(orbit(1, 1, { phase: Math.PI }));
        a.onBeforeRender();
        b.onBeforeRender();
        expect(Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y, a.position.z - b.position.z)).toBeGreaterThan(1);
    });
});

describe('centrality orbit — motion preferences', () => {
    it('freezes the moon when animation is off, keeping it on the orbit', () => {
        const moon = moonOf(orbit(1, 1, { animate: false, phase: Math.PI / 2 }));
        expect(moon.onBeforeRender).toBeNull();
        expect(Math.hypot(moon.position.x, moon.position.y, moon.position.z)).toBeCloseTo(1, 5);
    });

    it('honours prefers-reduced-motion', () => {
        reducedMotion = true;
        expect(S.ORBIT.motionAllowed()).toBe(false);
        expect(moonOf(orbit(1)).onBeforeRender).toBeNull();
        expect(moonOf(orbit(1)).material).toBeDefined();
    });

    it('animates when the query is unsupported (jsdom, old webviews)', () => {
        const src = readFileSync(join(__dirname, '..', '..', 'webview', 'js', 'sprites.js'), 'utf8');
        const win: any = { THREE }; // no matchMedia at all
        new Function('window', 'document', 'performance', src)(win, { createElement: () => ({}) }, { now: () => 0 });
        expect(win.AuraSprites.ORBIT.motionAllowed()).toBe(true);
        expect(win.AuraSprites.centralityOrbit(1, 1).children[1].onBeforeRender).not.toBeNull();
    });
});
