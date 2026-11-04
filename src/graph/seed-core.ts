/**
 * seed-core.ts — Give a starting position to nodes that join the simulation late.
 *
 * The force layout keeps no coordinates in `.aura/graph.db`: every position is
 * created by d3-force inside the webview. Nodes that were filtered out (hidden
 * language, folder filter, orphans/dead-code/cycles toggle…) have **never**
 * entered the simulation, so when a filter re-admits them they arrive without
 * `x/y/z`. d3 drops them on its tiny phyllotaxis spiral around the origin and —
 * because a visibility change feeds the engine with a 0-tick budget so the
 * settled layout does not drift — they stay piled in the middle until the user
 * moves the Spread slider.
 *
 * This module seeds those nodes deterministically:
 *   - next to the centroid of their **already positioned neighbours** (so a file
 *     appears inside its dependency cluster), or
 *   - on a sphere around the layout centroid when it has no positioned neighbour.
 *
 * Already positioned nodes are never touched: the frozen feed keeps its promise.
 * Pure module: no DOM, no `vscode`, unit-testable.
 */

export interface SeedNode {
    id: string;
    x?: number;
    y?: number;
    z?: number;
}

export interface SeedLink {
    source: string | { id: string };
    target: string | { id: string };
}

export interface SeedResult {
    /** Nodes that received a seed position. */
    seeded: number;
    /** …of which placed next to positioned neighbours. */
    fromNeighbours: number;
    /** …of which placed on the layout-wide sphere (no neighbour to anchor to). */
    fromSphere: number;
    /** Radius used for the layout-wide sphere. */
    radius: number;
    /** Extent of the settled layout (max distance from its centroid). */
    extent: number;
    /** Spacing of the seed cloud (median edge length × factor, clamped). */
    unit: number;
    /** Median settled edge length; null when no edge had both ends placed. */
    medianEdge: number | null;
}

/** Radius used when nothing is positioned yet (empty or fully hidden graph). */
const FALLBACK_EXTENT = 40;

/**
 * Scale of the seed cloud against the graph's own spacing. Measured on a real
 * 762-node repository: seeding at a share of the whole scene extent (10-40 %)
 * stretched the 90th-percentile edge from 228 to 436 units — the "spaghetti"
 * every re-shown batch produced. Anchoring the radius to the **median edge
 * length** of the settled layout keeps the percentiles at their baseline
 * (p50 133 vs 138, p90 225 vs 228).
 */
const LOCAL_EDGE_FACTOR = 0.6;
/** Never smaller than a few units, never wider than 5 % of the scene. */
const MIN_SEED_UNIT = 3;
const MAX_SEED_UNIT_SHARE = 0.05;
/** Each extra node arriving on the same hub widens the cloud a little. */
const HUB_GROWTH = 0.3;
const HUB_GROWTH_CAP = 6;
/** Depth of a neighbourhood-less group inside the scene (share of the extent). */
const GROUP_DEPTH_MIN = 0.35;
const GROUP_DEPTH_SPAN = 0.35;

/** Deterministic 32-bit hash (FNV-1a) — same id always yields the same seed. */
export function hashString(value: string): number {
    let hash = 0x811c9dc5;
    const text = String(value == null ? '' : value);
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

/** A node known to carry a usable 3D position. */
export type PositionedNode = SeedNode & { x: number; y: number; z: number };

/** True when a node already has a usable 3D position (type guard). */
export function isPositioned(node: SeedNode | null | undefined): node is PositionedNode {
    return !!node &&
        typeof node.x === 'number' && isFinite(node.x) &&
        typeof node.y === 'number' && isFinite(node.y) &&
        typeof node.z === 'number' && isFinite(node.z);
}

/**
 * Unit vector derived from an id. Two independent hashes give a longitude and a
 * latitude, so strings hash to a well-distributed point on the sphere instead
 * of lining up on a circle.
 */
export function seedDirection(id: string): { x: number; y: number; z: number } {
    const lon = (hashString(id) / 0xffffffff) * Math.PI * 2;
    const lat = (hashString(id + '\u0001seed') / 0xffffffff) * 2 - 1;
    const ring = Math.sqrt(Math.max(0, 1 - lat * lat));
    return { x: ring * Math.cos(lon), y: lat, z: ring * Math.sin(lon) };
}

/** Centroid and extent (max distance from it) of the positioned nodes. */
export function layoutStats(nodes: readonly SeedNode[]): { centroid: { x: number; y: number; z: number }; extent: number; placed: number } {
    let sx = 0, sy = 0, sz = 0, placed = 0;
    for (const node of nodes) {
        if (!isPositioned(node)) continue;
        sx += node.x as number;
        sy += node.y as number;
        sz += node.z as number;
        placed++;
    }
    if (placed === 0) return { centroid: { x: 0, y: 0, z: 0 }, extent: FALLBACK_EXTENT, placed: 0 };
    const centroid = { x: sx / placed, y: sy / placed, z: sz / placed };
    let extent = 0;
    for (const node of nodes) {
        if (!isPositioned(node)) continue;
        const dx = (node.x as number) - centroid.x;
        const dy = (node.y as number) - centroid.y;
        const dz = (node.z as number) - centroid.z;
        extent = Math.max(extent, Math.hypot(dx, dy, dz));
    }
    return { centroid, extent: extent > 0 ? extent : FALLBACK_EXTENT, placed };
}

function endpointId(end: SeedLink['source']): string {
    return typeof end === 'object' && end ? String(end.id) : String(end);
}

/** Top-level folder of a path — the grouping hint for neighbourhood-less nodes. */
export function groupKeyOf(id: string): string {
    const text = String(id == null ? '' : id).replace(/\\/g, '/');
    const slash = text.indexOf('/');
    return slash > 0 ? text.slice(0, slash) : '';
}

/**
 * Median length of the edges whose **two ends are already placed** — the graph's
 * own spacing, which is what a new node has to match.
 */
export function medianEdgeLength(nodes: readonly SeedNode[], links: readonly SeedLink[]): number | null {
    if (!links || links.length === 0) return null;
    const byId = new Map<string, SeedNode>();
    for (const node of nodes) byId.set(node.id, node);
    const lengths: number[] = [];
    for (const link of links) {
        const source = byId.get(endpointId(link.source));
        const target = byId.get(endpointId(link.target));
        if (!isPositioned(source) || !isPositioned(target)) continue;
        const distance = Math.hypot(source.x - target.x, source.y - target.y, source.z - target.z);
        if (isFinite(distance) && distance > 0) lengths.push(distance);
    }
    if (lengths.length === 0) return null;
    lengths.sort((a, b) => a - b);
    return lengths[Math.floor(lengths.length / 2)];
}

/** id → neighbour ids, built once per feed from the visible links. */
function buildAdjacency(links: readonly SeedLink[]): Map<string, string[]> {
    const adjacency = new Map<string, string[]>();
    const push = (from: string, to: string): void => {
        if (!from || !to || from === to) return;
        const list = adjacency.get(from);
        if (list) list.push(to);
        else adjacency.set(from, [to]);
    };
    for (const link of links || []) {
        const source = endpointId(link.source);
        const target = endpointId(link.target);
        push(source, target);
        push(target, source);
    }
    return adjacency;
}

/**
 * Seed every node of `nodes` that has no finite position.
 *
 * Deterministic: nodes are processed by id, so the same graph always produces
 * the same seeds (reproducible screenshots, stable warps). Mutates `nodes`.
 */
export function seedMissingNodes(
    nodes: SeedNode[],
    links: readonly SeedLink[] = [],
    options: { extent?: number } = {},
): SeedResult {
    const result: SeedResult = {
        seeded: 0,
        fromNeighbours: 0,
        fromSphere: 0,
        radius: 0,
        extent: 0,
        unit: 0,
        medianEdge: null,
    };
    if (!Array.isArray(nodes) || nodes.length === 0) return result;

    const stats = layoutStats(nodes);
    const extent = typeof options.extent === 'number' && options.extent > 0 ? options.extent : stats.extent;
    const radius = extent * 0.5;
    const medianEdge = medianEdgeLength(nodes, links);
    // Match the graph's own spacing, not the scene size: a share of the extent
    // flings nodes of a big repository far from their hub (measured spaghetti).
    const unit = Math.min(
        extent * MAX_SEED_UNIT_SHARE,
        Math.max(MIN_SEED_UNIT, (medianEdge === null ? extent * 0.12 : medianEdge) * LOCAL_EDGE_FACTOR),
    );
    result.extent = extent;
    result.radius = radius;
    result.unit = unit;
    result.medianEdge = medianEdge;

    const missing = nodes.filter(node => node && !isPositioned(node)).sort((a, b) => a.id.localeCompare(b.id));
    if (missing.length === 0) return result;

    const adjacency = buildAdjacency(links);
    const byId = new Map<string, SeedNode>();
    for (const node of nodes) byId.set(node.id, node);
    /** How many nodes were already seeded around one anchor (spreads the cloud). */
    const perHub = new Map<string, number>();
    /** Centre of the region given to each folder that has no placed neighbour. */
    const groupCentres = new Map<string, { x: number; y: number; z: number }>();

    function groupCentre(key: string): { x: number; y: number; z: number } {
        const cached = groupCentres.get(key);
        if (cached) return cached;
        const direction = seedDirection('@group:' + key);
        // Different folders get different depths, so a whole language coming back
        // fills the volume instead of forming one ball in the middle.
        const depthHash = hashString('@depth:' + key) / 0xffffffff;
        const depth = extent * (GROUP_DEPTH_MIN + GROUP_DEPTH_SPAN * depthHash);
        const centre = {
            x: stats.centroid.x + direction.x * depth,
            y: stats.centroid.y + direction.y * depth,
            z: stats.centroid.z + direction.z * depth,
        };
        groupCentres.set(key, centre);
        return centre;
    }

    for (const node of missing) {
        const neighbours = adjacency.get(node.id) || [];
        let baseX = stats.centroid.x;
        let baseY = stats.centroid.y;
        let baseZ = stats.centroid.z;
        let anchorId = '';
        let sumX = 0, sumY = 0, sumZ = 0, count = 0;
        for (const neighbourId of neighbours) {
            const neighbour = byId.get(neighbourId);
            if (!isPositioned(neighbour)) continue;
            sumX += neighbour.x;
            sumY += neighbour.y;
            sumZ += neighbour.z;
            count++;
            if (!anchorId) anchorId = neighbourId;
        }

        const direction = seedDirection(node.id);
        let distance: number;
        if (count > 0) {
            baseX = sumX / count;
            baseY = sumY / count;
            baseZ = sumZ / count;
            const seen = perHub.get(anchorId) || 0;
            perHub.set(anchorId, seen + 1);
            // Widen the cloud around a busy hub instead of stacking every node
            // on the same point.
            distance = unit * (1 + HUB_GROWTH * Math.min(seen, HUB_GROWTH_CAP));
            result.fromNeighbours++;
        } else {
            // No placed neighbour (a whole language coming back): gather them per
            // folder, at a depth of their own — a single shell around the centroid
            // reads as one dense ball in the middle of the scene.
            const key = groupKeyOf(node.id);
            const centre = groupCentre(key);
            baseX = centre.x;
            baseY = centre.y;
            baseZ = centre.z;
            const seen = perHub.get('@group:' + key) || 0;
            perHub.set('@group:' + key, seen + 1);
            distance = unit * (1 + HUB_GROWTH * Math.min(seen, HUB_GROWTH_CAP));
            result.fromSphere++;
        }

        node.x = baseX + direction.x * distance;
        node.y = baseY + direction.y * distance;
        node.z = baseZ + direction.z * distance;
        result.seeded++;
    }

    return result;
}
