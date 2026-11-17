import { describe, it, expect } from 'vitest';
import {
    buildAuraCard,
    buildAuraRepo,
    AURA_MAX_RELATIONS,
    type AuraCard,
} from '../sidebar/aura-card';
import type { GraphData, GraphLink, GraphNode } from '../analyzer/types';
import type { RiskFileEntry } from '../risk/risk-service';
import type { FileTrend } from '../analysis/trend';

function node(id: string, patch: Partial<GraphNode> = {}): GraphNode {
    return {
        id,
        name: id.split('/').pop() || id,
        path: id,
        language: 'typescript',
        extension: '.ts',
        size: 2048,
        linesOfCode: 120,
        lastModified: 0,
        group: 'src',
        fanOut: 2,
        fanIn: 5,
        complexity: 30,
        complexityDetails: {},
        ...patch,
    };
}

function link(source: string, target: string, patch: Partial<GraphLink> = {}): GraphLink {
    return { source, target, type: 'import', label: '', ...patch };
}

function graph(nodes: GraphNode[], links: GraphLink[] = []): Pick<GraphData, 'nodes' | 'links'> {
    return { nodes, links };
}

function riskEntry(id: string, patch: Partial<RiskFileEntry> = {}): RiskFileEntry {
    return {
        id,
        score: 71.6,
        scorePct: 0.92,
        topLabel: 'top 8%',
        bucket: 'high',
        reasons: [{ weight: 0.3, text: 'high fan-in (23)' }, { weight: 0.2, text: '12 commits in 90 days' }],
        lines: 120,
        complexity: 30,
        fanIn: 23,
        fanOut: 2,
        churn: 12,
        relChurn: 0.38,
        fixRatio: 0.25,
        authorCount: 4,
        ...patch,
    };
}

function trend(directions: 'up' | 'down' | 'flat' = 'up'): FileTrend {
    return {
        file: 'src/a.ts',
        points: [
            { hash: 'a', date: 1, complexity: 10, lines: 10, symbols: 1 },
            { hash: 'b', date: 2, complexity: 20, lines: 20, symbols: 2 },
            { hash: 'c', date: 3, complexity: 30, lines: 30, symbols: 3 },
        ],
        samples: 3,
        start: 1,
        end: 3,
        delta: 20,
        slopePer30Days: 12,
        r2: 0.9,
        direction: directions,
        degrading: directions === 'up',
        improving: directions === 'down',
    };
}

describe('buildAuraCard', () => {
    const data = graph([node('src/a.ts', { cognitive: 8, pagerank: 0.0173 }), node('src/b.ts')]);

    it('returns null for a file that is not in the graph', () => {
        expect(buildAuraCard({ fileId: 'src/missing.ts', data })).toBeNull();
        expect(buildAuraCard({ fileId: '', data })).toBeNull();
    });

    it('carries the identity and the metrics the 3D panel shows', () => {
        const card = buildAuraCard({ fileId: 'src/a.ts', data })!;
        expect(card.file).toMatchObject({
            id: 'src/a.ts',
            name: 'a.ts',
            dir: 'src',
            language: 'typescript',
            lines: 120,
            complexity: 30,
            cognitive: 8,
            fanIn: 5,
            fanOut: 2,
        });
        // 2048 bytes → 2.0 kB, one decimal.
        expect(card.file.sizeKb).toBe(2);
        expect(card.file.pagerank).toBeCloseTo(0.0173, 4);
    });

    it('reports a missing PageRank as null rather than 0', () => {
        const card = buildAuraCard({ fileId: 'src/b.ts', data })!;
        expect(card.file.pagerank).toBeNull();
        expect(card.file.cognitive).toBe(0);
    });

    it('splits connections into dependencies and dependents', () => {
        const linked = graph(
            [node('src/a.ts'), node('src/b.ts'), node('src/c.ts')],
            [
                link('src/a.ts', 'src/b.ts'),
                link('src/c.ts', 'src/a.ts', { type: 'call' }),
                link('src/a.ts', 'docs/guide.md', { type: 'doc-reference' }),
            ],
        );
        const card = buildAuraCard({ fileId: 'src/a.ts', data: linked })!;
        expect(card.out.map(relation => relation.id)).toEqual(['src/b.ts']);
        expect(card.in.map(relation => relation.id)).toEqual(['src/c.ts']);
        expect(card.outTotal).toBe(1);
        expect(card.inTotal).toBe(1);
        // A page that mentions the file is not a dependency.
        expect(card.docs).toBe(1);
    });

    it('deduplicates a repeated target, keeping the strongest confidence', () => {
        const linked = graph(
            [node('src/a.ts'), node('src/b.ts')],
            [
                link('src/a.ts', 'src/b.ts', { confidence: 0.6 }),
                link('src/a.ts', 'src/b.ts', { type: 'global-use', confidence: 1 }),
            ],
        );
        const card = buildAuraCard({ fileId: 'src/a.ts', data: linked })!;
        expect(card.out).toHaveLength(1);
        expect(card.outTotal).toBe(1);
        expect(card.out[0].confidence).toBe(1);
        expect(card.out[0].type).toBe('global-use');
    });

    it('caps the map but keeps the real totals', () => {
        const nodes = [node('src/a.ts')];
        const links: GraphLink[] = [];
        for (let index = 0; index < 12; index++) {
            nodes.push(node(`src/dep-${index}.ts`));
            links.push(link('src/a.ts', `src/dep-${index}.ts`));
        }
        const card = buildAuraCard({ fileId: 'src/a.ts', data: graph(nodes, links) })!;
        expect(card.out).toHaveLength(AURA_MAX_RELATIONS);
        expect(card.outTotal).toBe(12);
        expect(card.in).toHaveLength(0);
    });

    it('turns cycles, dead exports, violations, dirty state and parse errors into flags', () => {
        const flagged = graph([
            node('src/a.ts', {
                cycleIds: [1, 2],
                deadExports: ['unused'],
                archViolations: 3,
            }),
        ]);
        const card = buildAuraCard({
            fileId: 'src/a.ts',
            data: flagged,
            dirty: new Map([['src/a.ts', 'modified']]),
            parseFailures: new Map([['src/a.ts', 'boom']]),
        })!;
        const labels = card.flags.map(flag => flag.label);
        expect(labels).toContain('modified');
        expect(labels).toContain('parse error');
        expect(labels).toContain('2 cycles');
        expect(labels).toContain('1 dead export');
        expect(labels).toContain('3 violations');
        expect(card.flags.find(flag => flag.label === 'parse error')!.tone).toBe('bad');
    });

    it('says nothing when nothing is wrong', () => {
        const card = buildAuraCard({ fileId: 'src/b.ts', data })!;
        expect(card.flags).toEqual([]);
    });

    it('builds the risk block the City inspector shows', () => {
        const withRisk = graph([node('src/a.ts')]);
        const card = buildAuraCard({
            fileId: 'src/a.ts',
            data: withRisk,
            risk: new Map([['src/a.ts', riskEntry('src/a.ts')]]),
            riskWindowDays: 90,
        })!;
        expect(card.risk).toMatchObject({
            score: 72,
            bucket: 'high',
            topLabel: 'top 8%',
            windowDays: 90,
            direction: 'unknown',
            spark: null,
        });
        expect(card.risk!.reasons).toEqual(['high fan-in (23)', '12 commits in 90 days']);
        expect(card.risk!.stats).toBe('12 commits · 38 % rewritten · 25 % fixes · 4 authors');
    });

    it('draws the sparkline when the history has been scanned', () => {
        const card = buildAuraCard({
            fileId: 'src/a.ts',
            data,
            risk: new Map([['src/a.ts', riskEntry('src/a.ts')]]),
            trend: trend('up'),
        })!;
        expect(card.risk!.direction).toBe('up');
        expect(card.risk!.spark).toBeTruthy();
        // Three points, first at x=0, last at x=84 (the shared sparkline width).
        expect(card.risk!.spark!.split(' ')).toHaveLength(3);
        expect(card.risk!.spark!.startsWith('0.0,')).toBe(true);
        expect(card.risk!.spark!.includes('84.0,')).toBe(true);
    });

    it('keeps at most four reasons', () => {
        const many = riskEntry('src/a.ts', {
            reasons: Array.from({ length: 9 }, (_, index) => ({ weight: 0.1, text: `reason ${index}` })),
        });
        const card = buildAuraCard({
            fileId: 'src/a.ts',
            data,
            risk: new Map([['src/a.ts', many]]),
        })!;
        expect(card.risk!.reasons).toHaveLength(4);
    });

    it('never scores a documentation node', () => {
        const docs = graph([node('README.md', { language: 'documentation' })]);
        const card = buildAuraCard({
            fileId: 'README.md',
            data: docs,
            risk: new Map([['README.md', riskEntry('README.md')]]),
        })!;
        expect(card.risk).toBeNull();
    });

    it('omits the block when no history has been read', () => {
        const card = buildAuraCard({ fileId: 'src/a.ts', data })!;
        expect(card.risk).toBeNull();
        // The card is still useful: metrics, flags and connections.
        expect(card.file.id).toBe('src/a.ts');
    });

    it('is deterministic', () => {
        const options = { fileId: 'src/a.ts', data, risk: new Map([['src/a.ts', riskEntry('src/a.ts')]]) };
        expect(buildAuraCard(options)).toEqual(buildAuraCard(options));
    });
});

describe('buildAuraRepo', () => {
    it('returns null when there is no graph', () => {
        expect(buildAuraRepo({ data: graph([]) })).toBeNull();
    });

    it('summarises the repository and lists the riskiest files first', () => {
        const data = graph(
            [
                node('src/a.ts', { cycleIds: [1], deadExports: ['x'] }),
                node('src/b.ts', { archViolations: 2 }),
                node('src/c.ts'),
            ],
            [link('src/a.ts', 'src/b.ts'), link('src/b.ts', 'src/c.ts')],
        );
        const repo = buildAuraRepo({
            data,
            risk: new Map([
                ['src/a.ts', riskEntry('src/a.ts', { score: 40, bucket: 'medium' })],
                ['src/b.ts', riskEntry('src/b.ts', { score: 88, bucket: 'high' })],
                ['src/c.ts', riskEntry('src/c.ts', { score: 12, bucket: 'low' })],
            ]),
            dirty: new Map([['src/a.ts', 'modified']]),
        })!;

        expect(repo.files).toBe(3);
        expect(repo.links).toBe(2);
        expect(repo.highRisk).toBe(1);
        expect(repo.cycles).toBe(1);
        expect(repo.dead).toBe(1);
        expect(repo.violations).toBe(1);
        expect(repo.dirty).toBe(1);
        expect(repo.hotspots.map(spot => spot.id)).toEqual(['src/b.ts', 'src/a.ts', 'src/c.ts']);
        expect(repo.hotspots[0].score).toBe(88);
        expect(repo.hotspots[0].name).toBe('b.ts');
    });

    it('works without a risk snapshot', () => {
        const repo = buildAuraRepo({ data: graph([node('src/a.ts')]) })!;
        expect(repo.hotspots).toEqual([]);
        expect(repo.highRisk).toBe(0);
        expect(repo.files).toBe(1);
    });
});
