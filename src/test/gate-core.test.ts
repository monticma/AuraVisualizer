import { describe, expect, it } from 'vitest';
import {
    DEFAULT_GATE_CONFIG,
    EMPTY_GATE_BASELINE,
    evaluateGate,
    freezeBaseline,
    gateMarkdown,
    inGateScope,
    parseGateBaseline,
    parseGateConfig,
    type GateConfig,
    type GateInput,
} from '../gate/gate-core';

const config = (overrides: Partial<GateConfig> = {}): GateConfig => ({
    ...DEFAULT_GATE_CONFIG,
    budgets: { cognitive: 40 },
    counts: { fileCycles: 0, deadExports: 0 },
    ...overrides,
});

const stale = { stale: false as boolean | null, reason: 'analysé au commit courant' };

const input = (overrides: Partial<GateInput> = {}): GateInput => ({
    nodes: [
        { id: 'src/a.ts', language: 'typescript', cognitive: 10, fanIn: 1, linesOfCode: 100 },
        { id: 'src/b.ts', language: 'typescript', cognitive: 80, fanIn: 1, linesOfCode: 100 },
        { id: 'out/extension.js', language: 'javascript', cognitive: 900, fanIn: 0, linesOfCode: 9999 },
        { id: 'docs/readme.md', language: 'documentation', cognitive: 0, fanIn: 0, linesOfCode: 10 },
    ],
    deadExportsByFile: { 'src/a.ts': 1, 'src/b.ts': 2, 'out/extension.js': 50 },
    fileCycles: [['src/a.ts', 'src/b.ts']],
    symbolCycles: 3,
    resolution: { attempts: 100, unresolved: 4 },
    status: stale,
    ...overrides,
});

describe('parseGateConfig', () => {
    it('falls back to defaults when the file is missing', () => {
        const parsed = parseGateConfig(undefined);
        expect(parsed.missing).toBe(true);
        expect(parsed.errors).toEqual([]);
        expect(parsed.config.budgets).toEqual({});
    });

    it('reads budgets, counts and globs', () => {
        const parsed = parseGateConfig(JSON.stringify({
            version: 1,
            include: ['src/**'],
            exclude: ['src/legacy/**'],
            budgets: { cognitive: 40, fanIn: 20 },
            counts: { deadExports: 0, unresolvedRatio: 0.05 },
            architecture: false,
            failOnStale: false,
        }));
        expect(parsed.errors).toEqual([]);
        expect(parsed.config.budgets).toEqual({ cognitive: 40, fanIn: 20 });
        expect(parsed.config.counts).toEqual({ deadExports: 0, unresolvedRatio: 0.05 });
        expect(parsed.config.architecture).toBe(false);
        expect(parsed.config.failOnStale).toBe(false);
    });

    it('reports invalid JSON and unknown metrics instead of guessing', () => {
        expect(parseGateConfig('{ not json').errors[0]).toContain('JSON invalide');
        const parsed = parseGateConfig(JSON.stringify({ budgets: { cyclomatic: 10 } }));
        expect(parsed.errors[0]).toContain('budget inconnu "cyclomatic"');
        expect(parsed.config.budgets).toEqual({});
    });

    it('rejects a ratio outside 0..1 and a negative limit', () => {
        const ratio = parseGateConfig(JSON.stringify({ counts: { unresolvedRatio: 2 } }));
        expect(ratio.errors).toHaveLength(1);
        expect(ratio.config.counts.unresolvedRatio).toBeUndefined();
        const negative = parseGateConfig(JSON.stringify({ budgets: { cognitive: -3 } }));
        expect(negative.errors).toHaveLength(1);
        expect(negative.config.budgets.cognitive).toBeUndefined();
        // Et les défauts ne sont pas pollués par les parses précédents.
        expect(DEFAULT_GATE_CONFIG.budgets).toEqual({});
        expect(DEFAULT_GATE_CONFIG.counts).toEqual({});
    });
});

describe('inGateScope', () => {
    it('excludes documentation and generated output by default', () => {
        expect(inGateScope('src/a.ts', DEFAULT_GATE_CONFIG)).toBe(true);
        expect(inGateScope('docs/readme.md', DEFAULT_GATE_CONFIG)).toBe(false);
        expect(inGateScope('out/extension.js', DEFAULT_GATE_CONFIG)).toBe(false);
        expect(inGateScope('webview/js/app.js', DEFAULT_GATE_CONFIG)).toBe(true);
    });

    it('honours include before exclude', () => {
        const cfg = config({ include: ['src/**'], exclude: ['src/legacy/**'] });
        expect(inGateScope('src/a.ts', cfg)).toBe(true);
        expect(inGateScope('src/legacy/old.ts', cfg)).toBe(false);
        expect(inGateScope('webview/js/app.js', cfg)).toBe(false);
    });
});

describe('evaluateGate — budgets', () => {
    it('fails on a file above its budget, ignoring out-of-scope files', () => {
        const verdict = evaluateGate(input(), config(), EMPTY_GATE_BASELINE);
        expect(verdict.ok).toBe(false);
        expect(verdict.code).toBe(1);
        const budgets = verdict.failures.filter(f => f.kind === 'budget');
        expect(budgets.map(f => f.file)).toEqual(['src/b.ts']);
        expect(budgets[0].value).toBe(80);
        expect(budgets[0].limit).toBe(40);
    });

    it('is green when nothing exceeds', () => {
        const verdict = evaluateGate(input({ nodes: [{ id: 'src/a.ts', language: 'typescript', cognitive: 10 }] }),
            config({ counts: {} }), EMPTY_GATE_BASELINE);
        expect(verdict.ok).toBe(true);
        expect(verdict.code).toBe(0);
        expect(verdict.summary).toContain('Gate vert');
    });

    it('lets the baseline absorb a frozen overrun, and says so', () => {
        const verdict = evaluateGate(input(), config({ counts: {} }),
            { version: 1, counts: {}, budgets: { 'src/b.ts': { cognitive: 80 } } });
        expect(verdict.ok).toBe(true);
        expect(verdict.baselined).toHaveLength(1);
        expect(verdict.summary).toContain('absorbé');
    });

    it('still fails when the frozen file gets worse', () => {
        const verdict = evaluateGate(input(), config({ counts: {} }),
            { version: 1, counts: {}, budgets: { 'src/b.ts': { cognitive: 50 } } });
        expect(verdict.ok).toBe(false);
        expect(verdict.failures[0].value).toBe(80);
        expect(verdict.failures[0].limit).toBe(40);
    });
});

describe('evaluateGate — compteurs', () => {
    it('counts only what is in scope', () => {
        const verdict = evaluateGate(input(), config({ budgets: {} }), EMPTY_GATE_BASELINE);
        // 3 exports morts dans src/, les 50 de out/ sont hors périmètre
        expect(verdict.totals.deadExports).toBe(3);
        expect(verdict.totals.fileCycles).toBe(1);
        expect(verdict.failures.some(f => f.kind === 'dead-export')).toBe(true);
        expect(verdict.failures.some(f => f.kind === 'count')).toBe(true);
    });

    it('ratchets: the frozen count is the effective limit', () => {
        const verdict = evaluateGate(input(), config({ budgets: {} }),
            { version: 1, counts: { deadExports: 3, fileCycles: 1 }, budgets: {} });
        expect(verdict.ok).toBe(true);
    });

    it('fails as soon as the count grows past the freeze', () => {
        const more = input({ deadExportsByFile: { 'src/a.ts': 5 } });
        const verdict = evaluateGate(more, config({ budgets: {} }),
            { version: 1, counts: { deadExports: 3 }, budgets: {} });
        expect(verdict.ok).toBe(false);
        const failure = verdict.failures.find(f => f.metric === 'deadExports')!;
        expect(failure.value).toBe(5);
        expect(failure.limit).toBe(3);
        expect(failure.detail).toContain('baseline gelée à 3');
    });

    it('checks the unresolved ratio when asked', () => {
        const cfg = config({ budgets: {}, counts: { unresolvedRatio: 0.01 } });
        const verdict = evaluateGate(input(), cfg, EMPTY_GATE_BASELINE);
        const failure = verdict.failures.find(f => f.kind === 'resolution')!;
        expect(failure.value).toBeCloseTo(0.04, 5);
        // La règle dit la limite (1 %), la valeur est à part.
        expect(failure.rule).toBe('unresolvedRatio ≤ 1%');
    });
});

describe('evaluateGate — fraîcheur et architecture', () => {
    it('refuses to judge a stale analysis, with its own exit code', () => {
        const verdict = evaluateGate(input({ status: { stale: true, reason: 'le dépôt a bougé' } }), config(), EMPTY_GATE_BASELINE);
        expect(verdict.code).toBe(2);
        expect(verdict.failures[0].kind).toBe('stale');
        expect(verdict.summary).toContain('le dépôt a bougé');
    });

    it('refuses too when staleness is undecidable', () => {
        const verdict = evaluateGate(input({ status: { stale: null, reason: 'git indisponible' } }), config(), EMPTY_GATE_BASELINE);
        expect(verdict.code).toBe(2);
    });

    it('can be told to ignore staleness', () => {
        const verdict = evaluateGate(input({ status: { stale: true, reason: 'x' } }),
            config({ failOnStale: false, budgets: {}, counts: {} }), EMPTY_GATE_BASELINE);
        expect(verdict.code).toBe(0);
    });

    it('turns new architecture violations into failures', () => {
        const verdict = evaluateGate(input({
            architecture: {
                configured: true,
                newViolations: [{ ruleId: 'domain-pure', kind: 'deny', source: 'src/b.ts', target: 'src/ui.ts', severity: 'error' }],
            },
        }), config({ budgets: {}, counts: {} }), EMPTY_GATE_BASELINE);
        expect(verdict.failures[0].kind).toBe('architecture');
        expect(verdict.failures[0].rule).toBe('domain-pure (error)');
        expect(verdict.failures[0].detail).toBe('src/b.ts → src/ui.ts');
    });

    it('skips architecture when it is not configured', () => {
        const verdict = evaluateGate(input({ architecture: { configured: false, newViolations: [] } }),
            config({ budgets: {}, counts: {} }), EMPTY_GATE_BASELINE);
        expect(verdict.checked.architecture).toBe(false);
        expect(verdict.ok).toBe(true);
    });
});

describe('evaluateGate — mode delta', () => {
    it('judges only the changed files', () => {
        const verdict = evaluateGate(input({ changedFiles: ['src/a.ts'] }), config({ counts: {} }), EMPTY_GATE_BASELINE);
        expect(verdict.scope).toBe('changed');
        expect(verdict.checked.files).toBe(1);
        expect(verdict.ok).toBe(true);          // src/b.ts est au-dessus du budget mais non modifié
    });

    it('still fails when a changed file is over budget', () => {
        const verdict = evaluateGate(input({ changedFiles: ['src/b.ts'] }), config({ counts: {} }), EMPTY_GATE_BASELINE);
        expect(verdict.ok).toBe(false);
    });
});

describe('freezeBaseline / parseGateBaseline', () => {
    it('freezes the current overruns and counts', () => {
        const frozen = freezeBaseline(input(), config(), '2026-11-20T10:00:00.000Z');
        expect(frozen.budgets['src/b.ts']).toEqual({ cognitive: 80 });
        expect(frozen.budgets['out/extension.js']).toBeUndefined();
        expect(frozen.counts).toEqual({ fileCycles: 1, deadExports: 3 });
        expect(frozen.frozenAt).toBe('2026-11-20T10:00:00.000Z');
    });

    it('only freezes the counters the config watches', () => {
        const frozen = freezeBaseline(input(), config({ counts: { deadExports: 0 } }));
        expect(frozen.counts).toEqual({ deadExports: 3 });
    });

    it('round-trips through JSON', () => {
        const frozen = freezeBaseline(input(), config());
        const parsed = parseGateBaseline(JSON.stringify(frozen));
        expect(parsed).toEqual(frozen);
    });

    it('is empty on junk', () => {
        expect(parseGateBaseline('nope')).toEqual(EMPTY_GATE_BASELINE);
        expect(parseGateBaseline(undefined)).toEqual(EMPTY_GATE_BASELINE);
    });
});

describe('gateMarkdown', () => {
    it('lists the failures in a table and mentions the baseline', () => {
        const verdict = evaluateGate(input(), config(), { version: 1, counts: { deadExports: 3, fileCycles: 1 }, budgets: {} });
        const md = gateMarkdown(verdict);
        expect(md).toContain('## ❌ Aura Gate');
        expect(md).toContain('| budget cognitive ≤ 40 | `src/b.ts` | 80 | 40 |');
        expect(md).toContain('Périmètre');
    });

    it('says so when the gate is green', () => {
        const verdict = evaluateGate(input({ nodes: [{ id: 'src/a.ts', language: 'typescript', cognitive: 1 }] }),
            config({ counts: {} }), EMPTY_GATE_BASELINE);
        expect(gateMarkdown(verdict)).toContain('## ✅ Aura Gate');
    });
});

describe('baseline — ratio', () => {
    it('keeps a ratio as a ratio, not as a floored integer', () => {
        const parsed = parseGateBaseline(JSON.stringify({ version: 1, counts: { unresolvedRatio: 0.0884, deadExports: 406 }, budgets: {} }));
        expect(parsed.counts.unresolvedRatio).toBeCloseTo(0.0884, 6);
        expect(parsed.counts.deadExports).toBe(406);
    });

    it('ratchets a ratio against its frozen value', () => {
        const cfg = config({ budgets: {}, counts: { unresolvedRatio: 0.01 } });
        const frozen = { version: 1, counts: { unresolvedRatio: 0.04 }, budgets: {} };
        // 4 % courants = 4 % gelés : on passe.
        expect(evaluateGate(input(), cfg, frozen).ok).toBe(true);
        // 5 % > 4 % gelés : on échoue, avec la valeur gelée comme limite.
        const worse = input({ resolution: { attempts: 100, unresolved: 5 } });
        const verdict = evaluateGate(worse, cfg, frozen);
        expect(verdict.ok).toBe(false);
        expect(verdict.failures[0].limit).toBeCloseTo(0.04, 6);
    });
});
