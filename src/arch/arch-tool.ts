/**
 * arch-tool.ts — deterministic payload for the `aura_get_architecture_violations`
 * AI tool.
 *
 * Pure: it only shapes an existing evaluation, so the @aura participant, the LM
 * tools and tests share the exact same output. The evaluation itself stays in
 * the host (rules + baseline are files, not DB state).
 */

import type { ArchEvaluation, ArchViolation } from './arch-core';

export interface ArchitectureToolInput {
    /** Optional layer name to restrict violations, metrics and cycles. */
    layer?: string;
    /** Include violations frozen in the baseline (default false). */
    include_baselined?: boolean;
    /** Maximum violations to return (default 100). */
    limit?: number;
}

/** Shape returned to the model (JSON-serializable). */
export interface ArchitectureToolPayload {
    configured: boolean;
    hint?: string;
    error?: string;
    available_layers?: string[];
    layer?: string;
    counts?: ArchEvaluation['counts'];
    rules?: ArchEvaluation['rules'];
    layers?: ArchEvaluation['layers'];
    cycles?: ArchEvaluation['layerCycles'];
    unlayered_files?: string[];
    unlayered_total?: number;
    violations?: Array<{
        rule: string;
        kind: ArchViolation['kind'];
        severity: ArchViolation['severity'];
        source: string;
        target: string;
        types: string[];
        from?: string;
        to?: string;
        from_layer?: string;
        to_layer?: string;
        baselined: boolean;
    }>;
    violations_total?: number;
    truncated?: boolean;
}

/**
 * Format an architecture evaluation for the AI tool.
 *
 * `evaluation` is undefined when the workspace has no rules file (the host then
 * returns the MCP-parity hint instead of failing the tool call).
 */
export function buildArchitectureToolPayload(
    evaluation: ArchEvaluation | undefined,
    input: ArchitectureToolInput = {},
): ArchitectureToolPayload {
    if (!evaluation || !evaluation.configured) {
        return {
            configured: false,
            hint: 'No .aura/arch-rules.json in this workspace. Create it in the Aura Architecture tab or add layers/deny rules manually.',
        };
    }

    const layer = typeof input.layer === 'string' ? input.layer.trim() : '';
    if (layer && !evaluation.layers.some(stat => stat.name === layer)) {
        return {
            configured: true,
            error: 'Unknown layer "' + layer + '".',
            available_layers: evaluation.layers.map(stat => stat.name),
        };
    }

    const includeBaselined = input.include_baselined === true;
    const limit = typeof input.limit === 'number' && input.limit > 0 ? Math.round(input.limit) : 100;
    const source = includeBaselined ? evaluation.violations : evaluation.newViolations;

    const involvesLayer = (violation: ArchViolation): boolean =>
        !layer ||
        violation.sourceLayer === layer ||
        violation.targetLayer === layer ||
        violation.sourceGroup === layer ||
        violation.targetGroup === layer;

    const list = source.filter(involvesLayer);

    return {
        configured: true,
        ...(layer ? { layer } : {}),
        counts: evaluation.counts,
        rules: evaluation.rules,
        layers: layer ? evaluation.layers.filter(stat => stat.name === layer) : evaluation.layers,
        cycles: layer ? evaluation.layerCycles.filter(cycle => cycle.layers.includes(layer)) : evaluation.layerCycles,
        ...(layer
            ? {}
            : {
                unlayered_files: evaluation.unlayeredFiles.slice(0, 50),
                unlayered_total: evaluation.unlayeredTotal,
            }),
        violations: list.slice(0, limit).map(violation => ({
            rule: violation.ruleId,
            kind: violation.kind,
            severity: violation.severity,
            source: violation.source,
            target: violation.target,
            types: violation.linkTypes,
            from: violation.sourceGroup,
            to: violation.targetGroup,
            from_layer: violation.sourceLayer,
            to_layer: violation.targetLayer,
            baselined: violation.baselined,
        })),
        violations_total: list.length,
        truncated: list.length > limit,
    };
}
