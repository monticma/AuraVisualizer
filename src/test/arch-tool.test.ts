import { describe, it, expect } from 'vitest';
import { buildArchitectureToolPayload } from '../arch/arch-tool';
import type { ArchEvaluation, ArchViolation } from '../arch/arch-core';

function violation(source: string, target: string, baselined: boolean, sourceLayer: string, targetLayer: string): ArchViolation {
    return {
        ruleId: 'domain-pure',
        kind: 'deny',
        severity: 'error',
        source,
        target,
        linkType: 'import',
        linkTypes: ['import'],
        sourceGroup: sourceLayer,
        targetGroup: targetLayer,
        sourceLayer,
        targetLayer,
        baselined,
    };
}

function evaluation(): ArchEvaluation {
    const newViolation = violation('src/domain/a.ts', 'src/ui/b.ts', false, 'domain', 'ui');
    const frozen = violation('src/ui/c.ts', 'src/domain/d.ts', true, 'ui', 'domain');
    return {
        configured: true,
        rules: {
            layerNames: ['ui', 'domain'],
            ruleCount: 2,
            denyCount: 1,
            slicesCount: 0,
            noCyclesCount: 1,
            exceptionCount: 0,
            strict: false,
            edgeTypes: ['import'],
        },
        layers: [
            { name: 'ui', paths: ['src/ui/**'], files: 2, ca: 0, ce: 1, instability: 1, violations: 0, newViolations: 0, baselined: 0, errors: 0, warnings: 0 },
            { name: 'domain', paths: ['src/domain/**', 'src/core/**'], files: 1, ca: 1, ce: 1, instability: 0.5, violations: 1, newViolations: 1, baselined: 0, errors: 1, warnings: 0 },
        ],
        violations: [newViolation, frozen],
        newViolations: [newViolation],
        counts: { errors: 2, warnings: 0, total: 2, baselined: 1, newTotal: 1, newErrors: 1, newWarnings: 0 },
        layerCycles: [{ ruleId: 'no-cycles', severity: 'error', layers: ['domain', 'ui'] }],
        unlayeredFiles: ['src/scripts/tool.ts'],
        unlayeredTotal: 1,
    };
}

describe('architecture AI tool payload (V2-20)', () => {
    it('returns the MCP-parity hint when no rules are configured', () => {
        const payload = buildArchitectureToolPayload(undefined);
        expect(payload.configured).toBe(false);
        expect(payload.hint).toContain('.aura/arch-rules.json');
    });

    it('exposes layer globs, metrics and new violations by default', () => {
        const payload = buildArchitectureToolPayload(evaluation());
        expect(payload.configured).toBe(true);
        expect(payload.layers?.map(layer => layer.paths)).toEqual([
            ['src/ui/**'],
            ['src/domain/**', 'src/core/**'],
        ]);
        expect(payload.violations_total).toBe(1);
        expect(payload.violations?.[0]).toMatchObject({
            rule: 'domain-pure',
            source: 'src/domain/a.ts',
            target: 'src/ui/b.ts',
            from_layer: 'domain',
            to_layer: 'ui',
            baselined: false,
        });
        expect(payload.cycles).toHaveLength(1);
        expect(payload.unlayered_total).toBe(1);
    });

    it('includes baselined violations on demand', () => {
        const payload = buildArchitectureToolPayload(evaluation(), { include_baselined: true });
        expect(payload.violations_total).toBe(2);
        expect(payload.violations?.some(item => item.baselined)).toBe(true);
    });

    it('restricts violations, metrics and cycles to one layer', () => {
        const payload = buildArchitectureToolPayload(evaluation(), { layer: 'domain' });
        expect(payload.layer).toBe('domain');
        expect(payload.layers?.map(layer => layer.name)).toEqual(['domain']);
        expect(payload.violations_total).toBe(1);
        expect(payload.violations?.[0].to_layer).toBe('ui');
        expect(payload.cycles?.[0].layers).toEqual(['domain', 'ui']);
        expect(payload.unlayered_files).toBeUndefined();
        expect(payload.unlayered_total).toBeUndefined();

        const uiOnly = buildArchitectureToolPayload(evaluation(), { layer: 'ui' });
        expect(uiOnly.violations_total).toBe(1);
        expect(uiOnly.violations?.[0].from_layer).toBe('domain');
    });

    it('rejects unknown layers with the available list', () => {
        const payload = buildArchitectureToolPayload(evaluation(), { layer: 'nope' });
        expect(payload.error).toContain('nope');
        expect(payload.available_layers).toEqual(['ui', 'domain']);
    });

    it('caps the violation list and reports truncation', () => {
        const payload = buildArchitectureToolPayload(evaluation(), { include_baselined: true, limit: 1 });
        expect(payload.violations).toHaveLength(1);
        expect(payload.violations_total).toBe(2);
        expect(payload.truncated).toBe(true);
    });
});
