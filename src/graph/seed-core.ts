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
}

/** Radius used when nothing is positioned yet (empty or fully hidden graph). */
const FALLBACK_EXTENT = 40;

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
    const result: SeedResult = { seeded: 0, fromNeighbours: 0, fromSphere: 0, radius: 0, extent: 0 };
    if (!Array.isArray(nodes) || nodes.length === 0) return result;

    const stats = layoutStats(nodes);
    const extent = typeof options.extent === 'number' && options.extent > 0 ? options.extent : stats.extent;
    const radius = extent * 0.5;
    result.extent = extent;
    result.radius = radius;

    const missing = nodes.filter(node => node && !isPositioned(node)).sort((a, b) => a.id.localeCompare(b.id));
    if (missing.length === 0) return result;

    const adjacency = buildAdjacency(links);
    const byId = new Map<string, SeedNode>();
    for (const node of nodes) byId.set(node.id, node);
    /** How many nodes were already seeded around one anchor (spreads the cloud). */
    const perHub = new Map<string, number>();

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
            // Grow the cloud around a busy hub instead of stacking every node
            // on the same point: 10 % of the layout, up to ~40 %.
            distance = extent * (0.1 + 0.06 * Math.min(seen, 5));
            result.fromNeighbours++;
        } else {
            distance = radius;
            result.fromSphere++;
        }

        node.x = baseX + direction.x * distance;
        node.y = baseY + direction.y * distance;
        node.z = baseZ + direction.z * distance;
        result.seeded++;
    }

    return result;
}
