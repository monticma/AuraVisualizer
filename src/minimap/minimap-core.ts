/**
 * minimap-core.ts — the payload the Explorer minimap draws.
 *
 * Pure, and deliberately so. `layoutCity()` already runs on the host (it is the
 * same TypeScript the City tab bundles), so the minimap is **not** a second
 * renderer of the 3D scene: it is a **top-down plan of the same city**, computed
 * from the graph, with no camera, no WebGL, and no dependency on the Aura panel
 * being open.
 *
 * Everything here is a pure function of the nodes, so it is unit-tested without
 * VS Code and without a browser (see `src/test/minimap.test.ts`).
 */
import { CityNodeLike, fileKind, layoutCity, tierOf } from '../graph/city-core';

export interface MinimapBuilding {
    /** File id, exactly as the graph and the editor know it. */
    id: string;
    /** Unit-square rect (0..1), straight from `layoutCity`. */
    x: number;
    y: number;
    w: number;
    h: number;
    /** Height tier as returned by `tierOf` (1..tiers-1) — drives the fill. */
    tier: number;
    /** `code` | `docs` | `data` | `config` | `asset` — non-code is drawn muted. */
    kind: string;
}

export interface MinimapDistrict {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface MinimapPayload {
    buildings: MinimapBuilding[];
    districts: MinimapDistrict[];
    /** Buildings the plan holds, before any cap. */
    total: number;
    /** True when the cap dropped buildings — the caption says so. */
    truncated: boolean;
}

/** Above this the canvas still draws fine, but the message grows for nothing. */
export const MINIMAP_MAX_BUILDINGS = 4000;

export const EMPTY_MINIMAP: MinimapPayload = {
    buildings: [],
    districts: [],
    total: 0,
    truncated: false,
};

/** Four decimals are half a canvas pixel on a 4000 px map. */
function round(value: number): number {
    return Math.round(value * 1e4) / 1e4;
}

/**
 * The plan the sidebar draws: the same city as the City tab, flattened to the
 * ground plane. `complexity` for height and `linesOfCode` for footprint are the
 * City's own defaults, so the two views agree on the shape.
 */
export function buildMinimapPlan(
    nodes: CityNodeLike[] | undefined,
    options: { maxBuildings?: number } = {},
): MinimapPayload {
    if (!nodes || nodes.length === 0) return EMPTY_MINIMAP;

    const plan = layoutCity(nodes, {
        height: 'complexity',
        footprint: 'linesOfCode',
        districtBy: 'group',
        footprintScale: 'sqrt',
    });
    if (plan.rects.length === 0) return EMPTY_MINIMAP;

    const kindById = new Map<string, string>();
    for (const node of nodes) kindById.set(node.id, fileKind(node));

    let rects = plan.rects;
    let truncated = false;
    const max = Math.max(1, options.maxBuildings ?? MINIMAP_MAX_BUILDINGS);
    if (rects.length > max) {
        // Keep the largest footprints: they are the ones that carry the shape of
        // the city. The original order is preserved so the drawing is stable.
        const keep = new Set(
            rects
                .slice()
                .sort((a, b) => b.w * b.d - a.w * a.d)
                .slice(0, max)
                .map(rect => rect.id),
        );
        rects = rects.filter(rect => keep.has(rect.id));
        truncated = true;
    }

    const buildings: MinimapBuilding[] = rects.map(rect => ({
        id: rect.id,
        x: round(rect.x),
        y: round(rect.z),
        w: round(rect.w),
        h: round(rect.d),
        tier: tierOf(rect.heightValue, plan.tiers),
        kind: kindById.get(rect.id) ?? 'code',
    }));

    return {
        buildings,
        districts: plan.districts.map(district => ({
            x: round(district.x),
            y: round(district.z),
            w: round(district.w),
            h: round(district.d),
        })),
        total: plan.rects.length,
        truncated,
    };
}
