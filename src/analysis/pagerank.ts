/**
 * pagerank.ts — Pure PageRank over the file dependency graph (V2-16).
 *
 * `source → target` means "source depends on target", so a heavily-imported
 * file receives the votes of its dependents. The implementation is deliberately
 * small: unique directed edges, dangling-node mass redistribution, damping
 * 0.85, 40 iterations by default, and a normalized result.
 */

export interface PageRankEdge {
    source: string;
    target: string;
}

export interface PageRankOptions {
    /** Damping factor (default 0.85). */
    damping?: number;
    /** Maximum iterations (default 40). */
    iterations?: number;
    /** Stop when the L1 delta falls below this value (default 1e-9). */
    tolerance?: number;
}

/**
 * Compute PageRank for every node. Returns a plain object so the result is
 * JSON-friendly and deterministic for the UI/MCP layers.
 */
export function computePageRank(
    nodeIds: readonly string[],
    edges: readonly PageRankEdge[],
    options: PageRankOptions = {},
): Record<string, number> {
    const ids = [...new Set(nodeIds.filter(id => typeof id === 'string' && id.length > 0))];
    const n = ids.length;
    if (n === 0) return {};

    const damping = clamp(options.damping ?? 0.85, 0, 1);
    const iterations = Math.max(1, Math.floor(options.iterations ?? 40));
    const tolerance = Math.max(0, options.tolerance ?? 1e-9);

    // Deduplicate parallel edges (import + function-call between the same pair
    // should not vote twice) and drop self-loops/unknown endpoints.
    const outgoing = new Map<string, Set<string>>();
    for (const id of ids) outgoing.set(id, new Set());
    for (const edge of edges) {
        if (!edge || edge.source === edge.target) continue;
        const targets = outgoing.get(edge.source);
        if (!targets || !outgoing.has(edge.target)) continue;
        targets.add(edge.target);
    }

    const base = (1 - damping) / n;
    let rank = new Map<string, number>(ids.map(id => [id, 1 / n]));

    for (let iteration = 0; iteration < iterations; iteration++) {
        const next = new Map<string, number>(ids.map(id => [id, base]));
        let danglingMass = 0;

        for (const id of ids) {
            const targets = outgoing.get(id)!;
            const value = rank.get(id) ?? 0;
            if (targets.size === 0) {
                danglingMass += value;
                continue;
            }
            const share = damping * value / targets.size;
            for (const target of targets) {
                next.set(target, (next.get(target) ?? 0) + share);
            }
        }

        if (danglingMass > 0) {
            const share = damping * danglingMass / n;
            for (const id of ids) next.set(id, (next.get(id) ?? 0) + share);
        }

        // Keep the vector normalized even after floating-point accumulation.
        const sum = [...next.values()].reduce((acc, value) => acc + value, 0);
        if (sum > 0) {
            for (const id of ids) next.set(id, (next.get(id) ?? 0) / sum);
        }

        let delta = 0;
        for (const id of ids) delta += Math.abs((next.get(id) ?? 0) - (rank.get(id) ?? 0));
        rank = next;
        if (delta < tolerance) break;
    }

    const result: Record<string, number> = {};
    for (const id of ids) result[id] = rank.get(id) ?? 0;
    return result;
}

function clamp(value: number, min: number, max: number): number {
    if (!isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
}
