/**
 * communities.ts — shared deterministic community detection.
 *
 * The same function feeds:
 *   - the extension host (the snapshot sent to the webview),
 *   - GraphDB tools used by @aura / LM tools / MCP.
 *
 * Documentation nodes and `doc-reference` edges are excluded: a markdown mention
 * is not an architectural dependency. The remaining graph is undirected and
 * weighted by the number of structural links between two files.
 *
 * This is the local-moving phase of Louvain (20 passes, no coarsening). It is
 * deliberately deterministic: nodes and links are sorted before the greedy
 * passes, so the extension and the tools cannot produce different partitions
 * just because SQLite returned rows in a different order.
 */

import type { GraphCommunity, GraphData } from '../analyzer/types';
import {
    DOCUMENTATION_LANGUAGE,
    isArchitectureNode,
    isStructuralLink,
    documentationIdsOf,
} from './architecture';

export interface CommunityNodeLike {
    id: string;
    language?: string;
}

export interface CommunityLinkLike {
    source: string | { id: string };
    target: string | { id: string };
    type?: string;
}

export interface CommunityDetectionOptions {
    /** Custom labels keyed by GraphCommunity.key. */
    labels?: Record<string, string>;
}

const LOUVAIN_MAX_PASSES = 20;

/** Stable 32-bit FNV-1a hash of the sorted member ids. */
export function communityKey(files: string[]): string {
    let hash = 0x811c9dc5;
    const sorted = files.slice().sort();
    for (const id of sorted) {
        for (let i = 0; i < id.length; i++) {
            hash ^= id.charCodeAt(i);
            hash = Math.imul(hash, 0x01000193) >>> 0;
        }
        // Include the separator so ["ab", "c"] and ["a", "bc"] differ.
        hash ^= 0x0a;
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

function endpoint(value: string | { id: string }): string {
    return typeof value === 'string' ? value : value.id;
}

/**
 * Detect communities from the architectural (code-only) graph.
 *
 * `nodes` and `links` may be the full graph; documentation is filtered here.
 * The returned array includes an `Others` bucket for singleton code files.
 */
export function detectCommunities(
    nodes: CommunityNodeLike[],
    links: CommunityLinkLike[],
    options: CommunityDetectionOptions = {},
): GraphCommunity[] {
    const docIds = documentationIdsOf(nodes);
    const codeNodes = nodes
        .filter(node => isArchitectureNode(node) && node.id)
        .slice()
        .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

    if (codeNodes.length === 0) return [];

    const codeIds = new Set(codeNodes.map(node => node.id));
    const structuralLinks = links.filter(link => {
        if (!isStructuralLink(link, docIds)) return false;
        const source = endpoint(link.source);
        const target = endpoint(link.target);
        return codeIds.has(source) && codeIds.has(target);
    });

    const index = new Map<string, number>();
    codeNodes.forEach((node, i) => index.set(node.id, i));
    const n = codeNodes.length;
    const adjacency: Record<number, Record<number, number>> = {};
    for (let i = 0; i < n; i++) adjacency[i] = {};

    let totalWeight = 0;
    const structuralFanIn = new Map<string, number>();
    for (const link of structuralLinks) {
        const source = endpoint(link.source);
        const target = endpoint(link.target);
        const s = index.get(source);
        const t = index.get(target);
        if (s === undefined || t === undefined || s === t) continue;
        adjacency[s][t] = (adjacency[s][t] || 0) + 1;
        adjacency[t][s] = (adjacency[t][s] || 0) + 1;
        structuralFanIn.set(target, (structuralFanIn.get(target) || 0) + 1);
        totalWeight += 1;
    }

    const groups = new Map<number, number[]>();
    if (totalWeight === 0) {
        // Every code node is a singleton; the caller still gets an Others bucket.
        for (let i = 0; i < n; i++) groups.set(i, [i]);
    } else {
        const m2 = totalWeight * 2;
        const degree = new Array<number>(n).fill(0);
        for (let i = 0; i < n; i++) {
            let d = 0;
            for (const weight of Object.values(adjacency[i])) d += weight;
            degree[i] = d;
        }

        const community = new Array<number>(n);
        for (let i = 0; i < n; i++) community[i] = i;

        let improved = true;
        let passes = 0;
        while (improved && passes < LOUVAIN_MAX_PASSES) {
            improved = false;
            passes++;
            for (let i = 0; i < n; i++) {
                const current = community[i];
                const neighbourWeights = new Map<number, number>();
                for (const [neighbour, weight] of Object.entries(adjacency[i])) {
                    const label = community[Number(neighbour)];
                    neighbourWeights.set(label, (neighbourWeights.get(label) || 0) + weight);
                }

                const communityDegrees = new Map<number, number>();
                for (let j = 0; j < n; j++) {
                    if (j === i) continue;
                    const label = community[j];
                    if (neighbourWeights.has(label) || label === current) {
                        communityDegrees.set(label, (communityDegrees.get(label) || 0) + degree[j]);
                    }
                }

                const ki = degree[i];
                const wIn = neighbourWeights.get(current) || 0;
                const sumCi = communityDegrees.get(current) || 0;
                const removeCost = wIn / totalWeight - (ki * sumCi) / (m2 * m2) * 2;

                let bestGain = 0;
                let bestCommunity = current;
                for (const [label, weight] of neighbourWeights) {
                    if (label === current) continue;
                    const sumCj = communityDegrees.get(label) || 0;
                    const gain = weight / totalWeight - (ki * sumCj) / (m2 * m2) * 2 - removeCost;
                    if (gain > bestGain) {
                        bestGain = gain;
                        bestCommunity = label;
                    }
                }
                if (bestCommunity !== current) {
                    community[i] = bestCommunity;
                    improved = true;
                }
            }
        }

        for (let i = 0; i < n; i++) {
            const label = community[i];
            if (!groups.has(label)) groups.set(label, []);
            groups.get(label)!.push(i);
        }
    }

    const members = new Map<number, string[]>();
    const singletons: string[] = [];
    for (const indices of groups.values()) {
        if (indices.length < 2) {
            for (const i of indices) singletons.push(codeNodes[i].id);
            continue;
        }
        members.set(
            Math.min(...indices),
            indices.map(i => codeNodes[i].id).sort(),
        );
    }

    const ordered = [...members.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, files]) => files);

    const labels = options.labels || {};
    const result: GraphCommunity[] = ordered.map((files, id) => {
        const hub = pickHub(files, structuralFanIn);
        const key = communityKey(files);
        const custom = typeof labels[key] === 'string' && labels[key].trim().length > 0;
        return {
            id,
            key,
            label: custom ? labels[key].trim() : hub,
            autoLabel: hub,
            hub,
            files,
            size: files.length,
            custom,
        };
    });

    if (singletons.length > 0) {
        const files = singletons.sort();
        const key = communityKey(files);
        const custom = typeof labels[key] === 'string' && labels[key].trim().length > 0;
        result.push({
            id: result.length,
            key,
            label: custom ? labels[key].trim() : 'Others',
            autoLabel: 'Others',
            hub: '',
            files,
            size: files.length,
            custom,
            isOthers: true,
        });
    }

    return result;
}

/** Highest structural fan-in; ties use the smallest path for determinism. */
export function pickHub(files: string[], fanIn: Map<string, number>): string {
    if (files.length === 0) return '';
    let hub = files[0];
    let hubScore = fanIn.get(hub) || 0;
    for (const file of files) {
        const score = fanIn.get(file) || 0;
        if (score > hubScore || (score === hubScore && file < hub)) {
            hub = file;
            hubScore = score;
        }
    }
    return hub;
}

/** Add the community snapshot to graph metadata (used before sending to the webview). */
export function attachCommunities(data: GraphData, labels?: Record<string, string>): GraphCommunity[] {
    const communities = detectCommunities(data.nodes, data.links, { labels });
    data.meta.communities = communities;
    return communities;
}

/** Documentation is kept in the graph but explicitly outside architecture. */
export function isDocumentationNode(node: { language?: string } | undefined | null): boolean {
    return !!node && node.language === DOCUMENTATION_LANGUAGE;
}
