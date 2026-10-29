import { describe, it, expect } from 'vitest';
import {
    applyArchitecture,
    buildArchBaseline,
    buildArchRulesTemplate,
    evaluateArchitecture,
    globMatch,
    parseArchBaseline,
    parseArchRules,
    serializeArchBaseline,
    serializeArchRules,
    slicesPatternToRegExp,
    type ArchGraphLike,
    type ArchRules,
} from '../arch/arch-core';

function parse(overrides: Record<string, unknown> = {}): ArchRules {
    return parseArchRules(JSON.stringify({
        version: 1,
        layers: [
            { name: 'ui', paths: ['src/ui/**'] },
            { name: 'application', paths: ['src/app/**', 'src/services/**'] },
            { name: 'domain', paths: ['src/domain/**'] },
            { name: 'infrastructure', paths: ['src/infra/**'] },
        ],
        rules: [
            { id: 'domain-pure', from: 'domain', deny: ['ui', 'application', 'infrastructure'], severity: 'error' },
            { id: 'app-no-ui', from: 'application', deny: ['ui'] },
        ],
        ...overrides,
    }));
}

function graph(
    files: string[],
    edges: [string, string, string?][],
): ArchGraphLike {
    return {
        nodes: files.map(id => ({ id, path: id })),
        links: edges.map(([source, target, type]) => ({ source, target, type: type || 'import' })),
    };
}

describe('architecture glob matching', () => {
    it('matches a directory subtree with **', () => {
        expect(globMatch('src/ui/Button.ts', 'src/ui/**')).toBe(true);
        expect(globMatch('src/ui/widgets/Button.tsx', 'src/ui/**')).toBe(true);
        expect(globMatch('src/app/main.ts', 'src/ui/**')).toBe(false);
    });

    it('keeps * inside a single segment and ** across segments', () => {
        expect(globMatch('src/a.ts', 'src/*.ts')).toBe(true);
        expect(globMatch('src/deep/a.ts', 'src/*.ts')).toBe(false);
        expect(globMatch('src/deep/a.ts', 'src/**/*.ts')).toBe(true);
        expect(globMatch('Button.tsx', '**/Button.tsx')).toBe(true);
        expect(globMatch('src/ui/Button.tsx', '**/Button.tsx')).toBe(true);
    });

    it('normalizes backslashes and leading ./', () => {
        expect(globMatch('.\\src\\ui\\A.ts', 'src/ui/**')).toBe(true);
        expect(globMatch('./src/ui/A.ts', 'src/ui/**')).toBe(true);
    });

    it('captures one slice segment', () => {
        const re = slicesPatternToRegExp('src/features/*');
        expect(re.exec('src/features/billing/index.ts')?.[1]).toBe('billing');
        expect(re.exec('src/features/auth/ui/Login.tsx')?.[1]).toBe('auth');
        expect(re.exec('src/features/auth')).not.toBeNull();
        expect(re.exec('src/components/X.ts')).toBeNull();
    });

    it('supports a suffix after the slice capture', () => {
        const re = slicesPatternToRegExp('src/features/*/src/**');
        expect(re.exec('src/features/billing/src/Charge.ts')?.[1]).toBe('billing');
        expect(re.exec('src/features/billing/lib/Charge.ts')).toBeNull();
    });
});

describe('architecture rules parsing', () => {
    it('normalizes defaults and strips doc-reference from edge types', () => {
        const rules = parseArchRules(JSON.stringify({
            version: 1,
            edgeTypes: ['import', 'doc-reference'],
            layers: [{ name: 'ui', paths: 'src/ui/**' }],
            rules: [{ id: 'no', from: 'ui', deny: ['*'] }],
        }));
        expect(rules.edgeTypes).toEqual(['import']);
        expect(rules.layers[0].paths).toEqual(['src/ui/**']);
    });

    it('rejects unknown layers and duplicate ids', () => {
        expect(() => parse({ rules: [{ id: 'x', from: 'domain', deny: ['nope'] }] }))
            .toThrow(/unknown denied layer/);
        expect(() => parse({ rules: [
            { id: 'x', from: 'domain', deny: ['ui'] },
            { id: 'x', from: 'domain', deny: ['application'] },
        ] })).toThrow(/Duplicate rule id/);
    });

    it('validates the slices pattern', () => {
        expect(() => parse({ rules: [{ id: 's', type: 'slices', pattern: 'src/features' }] }))
            .toThrow(/exactly one/);
        expect(() => parse({ rules: [{ id: 's', type: 'slices', pattern: 'src/features/**' }] }))
            .toThrow(/exactly one/);
    });

    it('rejects invalid JSON with a readable message', () => {
        expect(() => parseArchRules('{ nope')).toThrow(/Invalid JSON/);
    });

    it('round-trips rules through canonical serialization', () => {
        const rules = parse({
            rules: [
                { id: 'domain-pure', from: 'domain', deny: ['ui', 'application'], severity: 'error' },
                { id: 'slices', type: 'slices', pattern: 'src/features/*', shared: ['src/shared/**'] },
                { id: 'no-cycles', type: 'no-cycles', severity: 'error' },
            ],
            exceptions: ['src/domain/legacy/**'],
            strict: true,
        });
        const text = serializeArchRules(rules);
        expect(text).toContain('"type": "slices"');
        expect(text).toContain('"type": "no-cycles"');
        expect(parseArchRules(text)).toEqual(rules);
        expect(parseArchRules(serializeArchRules(parseArchRules(text)))).toEqual(rules);
    });

    it('builds a starter template from top-level source folders', () => {
        const template = buildArchRulesTemplate(['ui', 'domain', 'ui']);
        const rules = parseArchRules(template);
        expect(rules.layers).toEqual([
            { name: 'ui', paths: ['src/ui/**'] },
            { name: 'domain', paths: ['src/domain/**'] },
        ]);
        expect(rules.rules).toHaveLength(0);
    });
});

describe('architecture deny rules', () => {
    it('flags forbidden edges in the real dependency direction', () => {
        const result = evaluateArchitecture(
            graph(
                ['src/ui/Button.ts', 'src/domain/User.ts'],
                [
                    ['src/domain/User.ts', 'src/ui/Button.ts'],
                    ['src/ui/Button.ts', 'src/domain/User.ts'],
                ],
            ),
            parse(),
        );
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({
            ruleId: 'domain-pure',
            kind: 'deny',
            severity: 'error',
            source: 'src/domain/User.ts',
            target: 'src/ui/Button.ts',
            sourceGroup: 'domain',
            targetGroup: 'ui',
            baselined: false,
        });
        expect(result.counts.errors).toBe(1);
    });

    it('evaluates TypeScript type-only imports by default', () => {
        const result = evaluateArchitecture(
            graph(
                ['src/domain/User.ts', 'src/ui/Button.ts'],
                [['src/domain/User.ts', 'src/ui/Button.ts', 'import-type']],
            ),
            parse(),
        );
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].linkTypes).toEqual(['import-type']);
    });

    it('deduplicates a file pair across several edge types', () => {
        const result = evaluateArchitecture(
            graph(
                ['src/domain/User.ts', 'src/ui/Button.ts'],
                [
                    ['src/domain/User.ts', 'src/ui/Button.ts', 'import'],
                    ['src/domain/User.ts', 'src/ui/Button.ts', 'function-call'],
                ],
            ),
            parse(),
        );
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].linkTypes).toEqual(['function-call', 'import']);
    });

    it('ignores edge types outside the configured set', () => {
        const rules = parse({
            edgeTypes: ['import'],
            rules: [{ id: 'domain-pure', from: 'domain', deny: ['ui'], severity: 'error' }],
        });
        const result = evaluateArchitecture(
            graph(
                ['src/domain/User.ts', 'src/ui/Button.ts'],
                [['src/domain/User.ts', 'src/ui/Button.ts', 'function-call']],
            ),
            rules,
        );
        expect(result.violations).toHaveLength(0);
    });

    it('treats * as any other layer but not unlayered files', () => {
        const rules = parse({
            rules: [{ id: 'pure', from: 'domain', deny: ['*'] }],
        });
        const result = evaluateArchitecture(
            graph(
                ['src/domain/User.ts', 'src/ui/Button.ts', 'scripts/build.ts'],
                [
                    ['src/domain/User.ts', 'src/ui/Button.ts'],
                    ['src/domain/User.ts', 'scripts/build.ts'],
                ],
            ),
            rules,
        );
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0].targetGroup).toBe('ui');
        expect(result.unlayeredFiles).toContain('scripts/build.ts');
        expect(result.unlayeredTotal).toBe(1);
    });

    it('honors exceptions on the source file', () => {
        const rules = parse({ exceptions: ['src/domain/legacy/**'] });
        const result = evaluateArchitecture(
            graph(
                ['src/domain/legacy/Old.ts', 'src/ui/Button.ts'],
                [['src/domain/legacy/Old.ts', 'src/ui/Button.ts']],
            ),
            rules,
        );
        expect(result.violations).toHaveLength(0);
    });

    it('never evaluates documentation nodes or doc-reference edges', () => {
        const g: ArchGraphLike = {
            nodes: [
                { id: 'src/domain/User.ts', path: 'src/domain/User.ts' },
                { id: 'docs/arch.md', path: 'docs/arch.md', language: 'documentation' },
                { id: 'docs/other.md', path: 'docs/other.md', language: 'documentation' },
            ],
            links: [
                { source: 'src/domain/User.ts', target: 'docs/arch.md', type: 'import' },
                { source: 'docs/arch.md', target: 'docs/other.md', type: 'doc-reference' },
            ],
        };
        const result = evaluateArchitecture(g, parse());
        expect(result.violations).toHaveLength(0);
        expect(result.unlayeredFiles).not.toContain('docs/arch.md');
    });
});

describe('architecture slices', () => {
    const rules = parse({
        rules: [{
            id: 'slices',
            type: 'slices',
            pattern: 'src/features/*',
            shared: ['src/shared/**'],
            severity: 'warn',
        }],
    });
    const files = [
        'src/shared/http.ts',
        'src/features/billing/Charge.ts',
        'src/features/auth/Login.ts',
    ];

    it('forbids sibling slices from importing each other', () => {
        const result = evaluateArchitecture(
            graph(files, [['src/features/billing/Charge.ts', 'src/features/auth/Login.ts']]),
            rules,
        );
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toMatchObject({
            ruleId: 'slices',
            kind: 'slices',
            sourceGroup: 'billing',
            targetGroup: 'auth',
            severity: 'warn',
        });
    });

    it('allows intra-slice and shared imports', () => {
        const result = evaluateArchitecture(
            graph(files, [
                ['src/features/billing/Charge.ts', 'src/features/billing/Line.ts'],
                ['src/features/billing/Charge.ts', 'src/shared/http.ts'],
            ]),
            rules,
        );
        expect(result.violations).toHaveLength(0);
    });
});

describe('architecture metrics and cycles', () => {
    it('computes Ca / Ce / instability per layer', () => {
        const result = evaluateArchitecture(
            graph(
                [
                    'src/ui/App.ts',
                    'src/app/Service.ts',
                    'src/infra/Repo.ts',
                    'src/domain/User.ts',
                ],
                [
                    ['src/ui/App.ts', 'src/app/Service.ts'],
                    ['src/app/Service.ts', 'src/domain/User.ts'],
                    ['src/infra/Repo.ts', 'src/domain/User.ts'],
                ],
            ),
            parse(),
        );
        const domain = result.layers.find(l => l.name === 'domain')!;
        expect(domain.ca).toBe(2);
        expect(domain.ce).toBe(0);
        expect(domain.instability).toBe(0);

        const application = result.layers.find(l => l.name === 'application')!;
        expect(application.ca).toBe(1);
        expect(application.ce).toBe(1);
        expect(application.instability).toBe(0.5);

        const ui = result.layers.find(l => l.name === 'ui')!;
        expect(ui.ca).toBe(0);
        expect(ui.ce).toBe(1);
        expect(ui.instability).toBe(1);
    });

    it('reports aggregated layer cycles once per no-cycles rule', () => {
        const rules = parse({
            rules: [
                { id: 'layers-cycle', type: 'no-cycles', severity: 'error' },
            ],
        });
        const result = evaluateArchitecture(
            graph(
                ['src/ui/A.ts', 'src/app/B.ts', 'src/domain/C.ts'],
                [
                    ['src/ui/A.ts', 'src/app/B.ts'],
                    ['src/app/B.ts', 'src/domain/C.ts'],
                    ['src/domain/C.ts', 'src/ui/A.ts'],
                ],
            ),
            rules,
        );
        expect(result.layerCycles).toHaveLength(1);
        expect(result.layerCycles[0].layers).toEqual(['application', 'domain', 'ui']);
    });
});

describe('architecture baseline', () => {
    it('freezes existing violations and only alerts on new ones', () => {
        const initial = evaluateArchitecture(
            graph(
                ['src/domain/A.ts', 'src/ui/B.ts'],
                [['src/domain/A.ts', 'src/ui/B.ts']],
            ),
            parse(),
        );
        expect(initial.counts.newTotal).toBe(1);

        const baseline = buildArchBaseline(initial);
        const frozen = evaluateArchitecture(
            graph(
                ['src/domain/A.ts', 'src/ui/B.ts', 'src/domain/C.ts'],
                [
                    ['src/domain/A.ts', 'src/ui/B.ts'],
                    ['src/domain/C.ts', 'src/ui/B.ts'],
                ],
            ),
            parse(),
            { baseline },
        );
        expect(frozen.counts.total).toBe(2);
        expect(frozen.counts.baselined).toBe(1);
        expect(frozen.counts.newTotal).toBe(1);
        expect(frozen.newViolations[0].source).toBe('src/domain/C.ts');
    });

    it('round-trips a baseline and ignores corrupt files', () => {
        const baseline = parseArchBaseline(JSON.stringify({
            version: 1,
            entries: [
                { ruleId: 'domain-pure', source: 'b', target: 'a' },
                { ruleId: 'domain-pure', source: 'a', target: 'b' },
            ],
        }));
        expect(baseline.entries.map(e => e.source)).toEqual(['a', 'b']);
        const text = serializeArchBaseline(baseline);
        expect(parseArchBaseline(text)).toEqual(baseline);
        expect(parseArchBaseline('{ nope').entries).toEqual([]);
    });
});

describe('applyArchitecture', () => {
    it('annotates nodes and links and clears stale values', () => {
        const rules = parse();
        const g = graph(
            ['src/domain/User.ts', 'src/ui/Button.ts', 'src/app/Service.ts'],
            [
                ['src/domain/User.ts', 'src/ui/Button.ts'],
                ['src/domain/User.ts', 'src/ui/Button.ts', 'doc-reference'],
                ['src/app/Service.ts', 'src/domain/User.ts'],
            ],
        );
        const result = evaluateArchitecture(g, rules);
        applyArchitecture(g.nodes, g.links, result, rules);

        const user = g.nodes.find(n => n.id === 'src/domain/User.ts')!;
        expect(user.layer).toBe('domain');
        expect(user.archViolations).toBe(1);
        expect(g.links[0].archViolation).toMatchObject({
            ruleId: 'domain-pure',
            severity: 'error',
            baselined: false,
        });
        // A doc-reference edge between the same pair is not architecture.
        expect(g.links[1].archViolation).toBeUndefined();
        expect(g.links[2].archViolation).toBeUndefined();

        // Re-evaluate with no rule: stale annotations must disappear.
        const empty = parseArchRules(JSON.stringify({
            layers: [{ name: 'domain', paths: ['src/domain/**'] }],
            rules: [],
        }));
        const noViolations = evaluateArchitecture(g, empty);
        applyArchitecture(g.nodes, g.links, noViolations, empty);
        expect(user.layer).toBe('domain');
        expect(user.archViolations).toBeUndefined();
        expect(g.links[0].archViolation).toBeUndefined();
    });

    it('keeps baselined violations visible but not alerting', () => {
        const rules = parse();
        const g = graph(
            ['src/domain/User.ts', 'src/ui/Button.ts'],
            [['src/domain/User.ts', 'src/ui/Button.ts']],
        );
        const first = evaluateArchitecture(g, rules);
        const baseline = buildArchBaseline(first);
        const frozen = evaluateArchitecture(g, rules, { baseline });
        applyArchitecture(g.nodes, g.links, frozen, rules);
        expect(g.nodes.find(n => n.id === 'src/domain/User.ts')!.archViolations).toBeUndefined();
        expect(g.links[0].archViolation).toMatchObject({ baselined: true });
    });
});
