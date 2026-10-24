/**
 * symbol-cycles.ts — Pure function→function cycle detection (V2-03).
 *
 * The graph builder already records every resolved call site
 * (`functionCalls`: callerFile/callerName → calleeFile/calleeName + line).
 * This module turns those call sites into a directed function graph and
 * enumerates simple cycles (recursion / mutual recursion) with the call line
 * for every step.
 *
 * Design choices:
 *   - Function identity is `file + function name`; overloads with the same
 *     name in the same file share an identity (the analyzer stores names only).
 *   - Calls to `<module>` (top-level statements) are ignored: they are not
 *     functions and would create meaningless cycles.
 *   - A call that resolves to several candidate files (same name in multiple
 *     files) is marked `ambiguous` with confidence 0.5. Local calls score 1.0,
 *     unique cross-file calls 0.8.
 *   - Cycles are canonicalized (smallest rotation first) so the same loop is
 *     reported once regardless of the starting function.
 */

import type { FunctionCallSite, SymbolCycle, SymbolCycleStep } from '../analyzer/types';

const SEP = '\u0000';
const MAX_DEFAULT_CYCLES = 200;
const MAX_DEFAULT_LENGTH = 20;

interface SymbolEdge {
    callerFile: string;
    callerName: string;
    calleeFile: string;
    calleeName: string;
    callLines: number[];
    confidence: number;
}

export interface ComputeSymbolCyclesOptions {
    /** Maximum number of cycles returned (default 200). */
    maxCycles?: number;
    /** Maximum number of functions in one cycle (default 20). */
    maxLength?: number;
}

function nodeKey(file: string, name: string): string {
    return file + SEP + name;
}

function callGroupKey(call: FunctionCallSite): string {
    return [call.callerFile, call.callerName, call.callLine, call.calleeName].join(SEP);
}

function edgeKey(callerFile: string, callerName: string, calleeFile: string, calleeName: string): string {
    return nodeKey(callerFile, callerName) + '\u0001' + nodeKey(calleeFile, calleeName);
}

/**
 * Compute simple function-level cycles from resolved call sites.
 * Pure and deterministic: no filesystem, DB or VS Code dependency.
 */
export function computeSymbolCycles(
    callSites: readonly FunctionCallSite[],
    options: ComputeSymbolCyclesOptions = {},
): SymbolCycle[] {
    const maxCycles = Math.max(1, options.maxCycles ?? MAX_DEFAULT_CYCLES);
    const maxLength = Math.max(1, options.maxLength ?? MAX_DEFAULT_LENGTH);

    // Group candidate call sites by call expression so a single ambiguous call
    // (same function name resolved to several files) is scored once.
    const groups = new Map<string, FunctionCallSite[]>();
    for (const call of callSites) {
        if (!call || !call.callerFile || !call.callerName || !call.calleeFile || !call.calleeName) continue;
        if (call.callerName === '<module>' || call.calleeName === '<module>') continue;
        const key = callGroupKey(call);
        const list = groups.get(key);
        if (list) list.push(call);
        else groups.set(key, [call]);
    }

    const edges = new Map<string, SymbolEdge>();
    const adjacency = new Map<string, Set<string>>();

    for (const group of groups.values()) {
        const calleeFiles = new Set(group.map(c => c.calleeFile));
        const ambiguous = calleeFiles.size > 1;
        for (const call of group) {
            const local = call.callerFile === call.calleeFile;
            const confidence = local ? 1 : (ambiguous ? 0.5 : 0.8);
            const callerKey = nodeKey(call.callerFile, call.callerName);
            const calleeKey = nodeKey(call.calleeFile, call.calleeName);
            const key = edgeKey(call.callerFile, call.callerName, call.calleeFile, call.calleeName);

            let edge = edges.get(key);
            if (!edge) {
                edge = {
                    callerFile: call.callerFile,
                    callerName: call.callerName,
                    calleeFile: call.calleeFile,
                    calleeName: call.calleeName,
                    callLines: [],
                    confidence,
                };
                edges.set(key, edge);
                let targets = adjacency.get(callerKey);
                if (!targets) {
                    targets = new Set<string>();
                    adjacency.set(callerKey, targets);
                }
                targets.add(calleeKey);
            }
            if (!edge.callLines.includes(call.callLine)) edge.callLines.push(call.callLine);
            edge.confidence = Math.min(edge.confidence, confidence);
        }
    }

    if (adjacency.size === 0) return [];

    const nodes = [...adjacency.keys()].sort();
    for (const node of nodes) adjacency.get(node)!.forEach(t => {
        if (!adjacency.has(t)) adjacency.set(t, new Set<string>());
    });

    const { componentOf, componentSize } = stronglyConnectedComponents(adjacency);
    const cycleNodes = new Set<string>();
    for (const node of adjacency.keys()) {
        const component = componentOf.get(node);
        if (component === undefined) continue;
        const selfLoop = adjacency.get(node)!.has(node);
        if (selfLoop || (componentSize.get(component) ?? 0) > 1) cycleNodes.add(node);
    }
    if (cycleNodes.size === 0) return [];

    const found = new Map<string, { nodes: string[]; edges: SymbolEdge[] }>();

    for (const start of [...cycleNodes].sort()) {
        const component = componentOf.get(start);
        const visited = new Set<string>([start]);
        dfs(start, start, [start], [], visited, component);
    }

    function dfs(
        start: string,
        current: string,
        path: string[],
        pathEdges: SymbolEdge[],
        visited: Set<string>,
        component: number | undefined,
    ): void {
        if (found.size >= maxCycles) return;
        const targets = adjacency.get(current);
        if (!targets) return;

        for (const next of [...targets].sort()) {
            if (componentOf.get(next) !== component) continue;
            const edge = edges.get(current + '\u0001' + next);
            if (!edge) continue;

            if (next === start) {
                const cycle = canonicalize(path, [...pathEdges, edge]);
                if (!found.has(cycle.key)) found.set(cycle.key, { nodes: cycle.nodes, edges: cycle.edges });
                continue;
            }
            if (visited.has(next) || path.length >= maxLength) continue;

            visited.add(next);
            path.push(next);
            pathEdges.push(edge);
            dfs(start, next, path, pathEdges, visited, component);
            pathEdges.pop();
            path.pop();
            visited.delete(next);
        }
    }

    function canonicalize(path: string[], pathEdges: SymbolEdge[]): { key: string; nodes: string[]; edges: SymbolEdge[] } {
        let best = 0;
        for (let i = 1; i < path.length; i++) {
            if (path[i] < path[best]) best = i;
        }
        const rotatedNodes = best === 0 ? path.slice() : path.slice(best).concat(path.slice(0, best));
        const rotatedEdges = best === 0 ? pathEdges.slice() : pathEdges.slice(best).concat(pathEdges.slice(0, best));
        return { key: rotatedNodes.join('\u0001'), nodes: rotatedNodes, edges: rotatedEdges };
    }

    const cycles: SymbolCycle[] = [];
    for (const entry of found.values()) {
        const stepEdges = entry.edges.map(edge => ({
            callerFile: edge.callerFile,
            callerName: edge.callerName,
            calleeFile: edge.calleeFile,
            calleeName: edge.calleeName,
            callLine: edge.callLines[0],
            confidence: edge.confidence,
        } as SymbolCycleStep));
        const confidence = stepEdges.reduce((min, edge) => Math.min(min, edge.confidence), 1);
        cycles.push({
            id: 0,
            kind: entry.nodes.length === 1 ? 'recursive' : 'mutual',
            nodes: entry.nodes.map(key => {
                const split = key.indexOf(SEP);
                return { file: key.slice(0, split), name: key.slice(split + 1) };
            }),
            edges: stepEdges,
            confidence,
            ambiguous: stepEdges.some(edge => edge.confidence <= 0.5),
        });
    }

    cycles.sort((a, b) => {
        if (a.nodes.length !== b.nodes.length) return a.nodes.length - b.nodes.length;
        if (a.confidence !== b.confidence) return a.confidence - b.confidence;
        return cycleKey(a).localeCompare(cycleKey(b));
    });
    for (let i = 0; i < cycles.length; i++) cycles[i].id = i;
    return cycles;

    function cycleKey(cycle: SymbolCycle): string {
        return cycle.nodes.map(n => n.file + SEP + n.name).join('\u0001');
    }
}

/** Tarjan SCC; only nodes belonging to a non-trivial component can be in a cycle. */
function stronglyConnectedComponents(adjacency: Map<string, Set<string>>): {
    componentOf: Map<string, number>;
    componentSize: Map<number, number>;
} {
    let index = 0;
    let component = 0;
    const indices = new Map<string, number>();
    const lowlinks = new Map<string, number>();
    const stack: string[] = [];
    const onStack = new Set<string>();
    const componentOf = new Map<string, number>();
    const componentSize = new Map<number, number>();

    function connect(node: string): void {
        indices.set(node, index);
        lowlinks.set(node, index);
        index++;
        stack.push(node);
        onStack.add(node);

        for (const next of adjacency.get(node) ?? []) {
            if (!indices.has(next)) {
                connect(next);
                lowlinks.set(node, Math.min(lowlinks.get(node)!, lowlinks.get(next)!));
            } else if (onStack.has(next)) {
                lowlinks.set(node, Math.min(lowlinks.get(node)!, indices.get(next)!));
            }
        }

        if (lowlinks.get(node) !== indices.get(node)) return;
        let member: string | undefined;
        let size = 0;
        do {
            member = stack.pop();
            if (member === undefined) break;
            onStack.delete(member);
            componentOf.set(member, component);
            size++;
        } while (member !== node);
        componentSize.set(component, size);
        component++;
    }

    for (const node of adjacency.keys()) {
        if (!indices.has(node)) connect(node);
    }
    return { componentOf, componentSize };
}
