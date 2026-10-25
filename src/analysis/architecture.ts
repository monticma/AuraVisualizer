/**
 * architecture.ts — boundary between the architectural code graph and the
 * documentation graph.
 *
 * Documentation files stay in the graph (and keep their doc-reference edges) so
 * users can still see what a document mentions. They must not influence
 * architectural communities, fan-in/out, PageRank centrality, risk or hub
 * labels: a markdown mention is not a code dependency.
 */

export const DOCUMENTATION_LANGUAGE = 'documentation';
export const DOC_REFERENCE_EDGE = 'doc-reference';

/** A node is architectural unless it is a documentation file. */
export function isArchitectureNode(node: { language?: string } | undefined | null): boolean {
    return !!node && node.language !== DOCUMENTATION_LANGUAGE;
}

/** Link types that participate in the architectural graph. */
export function isStructuralLinkType(type: string | undefined): boolean {
    return type !== DOC_REFERENCE_EDGE;
}

/** True when a link connects two architectural nodes with a structural type. */
export function isStructuralLink(
    link: { source: string | { id: string }; target: string | { id: string }; type?: string },
    documentationIds: Set<string>,
): boolean {
    if (!isStructuralLinkType(link.type)) return false;
    const source = typeof link.source === 'string' ? link.source : link.source.id;
    const target = typeof link.target === 'string' ? link.target : link.target.id;
    return !documentationIds.has(source) && !documentationIds.has(target);
}

/** IDs of every documentation node in a node list. */
export function documentationIdsOf(nodes: Array<{ id: string; language?: string }>): Set<string> {
    return new Set(nodes.filter(node => !isArchitectureNode(node)).map(node => node.id));
}
