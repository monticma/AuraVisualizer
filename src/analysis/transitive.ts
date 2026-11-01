/**
 * transitive.ts — Transitive import / dependent closure (V3-08).
 *
 * Plain BFS over a plain edge list: cycle-safe (`visited`), bounded by depth
 * *and* by node count, deterministic (depth, then id) and it keeps the BFS
 * parent so the UI can show the deepest chain instead of only a count.
 *
 * Pure module: no `vscode`, no SQLite — the detail panel and the MCP tools both
 * feed it the edges they already have.
 */

export type TransitiveDirection = 'out' | 'in';

export interface TransitiveEdge {
    source: string;
    target: string;
}

export interface TransitiveNode {
    id: string;
    /** 1 = direct import (or direct dependent). */
    depth: number;
    /** BFS parent inside the closure — `root` for depth 1. */
    parent: string;
}

export interface TransitiveResult {
    root: string;
    direction: TransitiveDirection;
    nodes: TransitiveNode[];
    maxDepth: number;
    /** Number of files found at each depth — index 0 = depth 1. */
    byDepth: number[];
    /** `root → … → deepest`; empty when nothing is reachable. */
    longestChain: string[];
    /** The node cap stopped the walk before the closure was exhausted. */
    truncated: boolean;
    depthLimit: number;
    nodeLimit: number;
}

export const DEFAULT_TRANSITIVE_DEPTH = 5;
/** The setting allows 1..10 — beyond that the closure is not useful in a panel. */
export const MAX_TRANSITIVE_DEPTH = 10;
export const DEFAULT_TRANSITIVE_NODES = 500;

export interface TransitiveOptions {
    direction?: TransitiveDirection;
    maxDepth?: number;
    maxNodes?: number;
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(value)));
}

export function transitiveClosure(
    edges: readonly TransitiveEdge[],
    root: string,
    options: TransitiveOptions = {},
): TransitiveResult {
    const direction: TransitiveDirection = options.direction === 'in' ? 'in' : 'out';
    const depthLimit = clampInt(options.maxDepth, 1, MAX_TRANSITIVE_DEPTH, DEFAULT_TRANSITIVE_DEPTH);
    const nodeLimit = clampInt(options.maxNodes, 1, 100_000, DEFAULT_TRANSITIVE_NODES);

    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
        const from = direction === 'out' ? edge.source : edge.target;
        const to = direction === 'out' ? edge.target : edge.source;
        if (!from || !to || from === to) continue;
        const list = adjacency.get(from);
        if (list) list.push(to);
        else adjacency.set(from, [to]);
    }
    // Deterministic neighbour order regardless of the input order.
    for (const list of adjacency.values()) list.sort();

    const visited = new Set<string>([root]);
    const nodes: TransitiveNode[] = [];
    let truncated = false;

    let frontier: TransitiveNode[] = [{ id: root, depth: 0, parent: '' }];
    for (let depth = 1; depth <= depthLimit && frontier.length > 0; depth++) {
        const next: TransitiveNode[] = [];
        for (const current of frontier) {
            for (const neighbour of adjacency.get(current.id) ?? []) {
                if (visited.has(neighbour)) continue;
                if (nodes.length >= nodeLimit) {
                    truncated = true;
                    break;
                }
                visited.add(neighbour);
                const node: TransitiveNode = { id: neighbour, depth, parent: current.id };
                nodes.push(node);
                next.push(node);
            }
            if (truncated) break;
        }
        if (truncated) break;
        frontier = next;
    }

    nodes.sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id));

    const byDepth: number[] = [];
    for (const node of nodes) byDepth[node.depth - 1] = (byDepth[node.depth - 1] ?? 0) + 1;

    const byId = new Map(nodes.map(node => [node.id, node]));
    const deepest = nodes.reduce<TransitiveNode | undefined>((best, node) => {
        if (!best) return node;
        if (node.depth !== best.depth) return node.depth > best.depth ? node : best;
        return node.id < best.id ? node : best;
    }, undefined);

    const longestChain: string[] = [];
    let cursor = deepest;
    while (cursor) {
        longestChain.unshift(cursor.id);
        cursor = cursor.parent && cursor.parent !== root ? byId.get(cursor.parent) : undefined;
    }
    if (longestChain.length > 0) longestChain.unshift(root);

    return {
        root,
        direction,
        nodes,
        maxDepth: deepest ? deepest.depth : 0,
        byDepth,
        longestChain,
        truncated,
        depthLimit,
        nodeLimit,
    };
}

/** One-line summary for the panel header, e.g. `42 files · depth 4`. */
export function summarizeTransitive(result: TransitiveResult): string {
    const count = result.nodes.length;
    if (count === 0) return result.direction === 'out' ? 'no indirect import' : 'no indirect dependent';
    const files = `${count} file${count === 1 ? '' : 's'}`;
    const truncated = result.truncated ? ` · truncated at ${result.nodeLimit}` : '';
    return `${files} · depth ${result.maxDepth}${truncated}`;
}
