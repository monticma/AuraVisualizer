/**
 * aura-card.ts — what the **Aura** sidebar section says about the active file.
 *
 * The card is a deliberate blend of two surfaces that already exist: the 3D
 * detail panel (identity + metrics + connections) and the City inspector (risk
 * score, its written reasons, the complexity sparkline and the relation map).
 * Everything it needs is **already computed** on the host — the graph carries
 * fan-in/out, complexity, cycles, dead exports and arch violations, the risk
 * snapshot carries the score and its reasons, and `.aura/history` carries the
 * trend points. So this module is pure: nodes, links and caches in, a card out.
 */
import type { GraphData, GraphNode } from '../analyzer/types';
import { sparklinePoints, type FileTrend } from '../analysis/trend';
import type { GitFileState } from '../analyzer/git-history';
import type { RiskFileEntry } from '../risk/risk-service';

/** One satellite of the relation map. */
export interface AuraRelation {
    id: string;
    /** Last path segment — the fallback label. */
    name: string;
    /** What the map prints: `name`, or a disambiguated prefix when it collides. */
    label: string;
    /** `import` | `call` | `script` | `global-use` | … — shown on hover. */
    type: string;
    /** Below 1 when the target matched by extension, suffix or basename. */
    confidence: number;
}

/** A chip under the metrics: something is wrong, or worth knowing. */
export interface AuraFlag {
    icon: string;
    label: string;
    tone: 'bad' | 'warn' | 'info';
}

export interface AuraFileView {
    id: string;
    name: string;
    /** Everything before the last slash, `''` at the repository root. */
    dir: string;
    language: string;
    lines: number;
    complexity: number;
    cognitive: number;
    fanIn: number;
    fanOut: number;
    pagerank: number | null;
    sizeKb: number;
}

export interface AuraRiskView {
    score: number;
    bucket: string;
    topLabel: string | null;
    reasons: string[];
    /** `14 commits · 38 % rewritten · 4 authors` */
    stats: string;
    /** Polyline points for a `84 × 20` sparkline, or `null` without history. */
    spark: string | null;
    /** `up` | `down` | `flat` | `unknown`. */
    direction: string;
    windowDays: number;
}

export interface AuraCard {
    file: AuraFileView;
    risk: AuraRiskView | null;
    flags: AuraFlag[];
    /** Dependencies (the file imports them), capped. */
    out: AuraRelation[];
    /** Dependents (they import it), capped. */
    in: AuraRelation[];
    outTotal: number;
    inTotal: number;
    /** Pages that merely mention the file — not dependencies. */
    docs: number;
}

export interface AuraRepoView {
    files: number;
    links: number;
    /** Files in the `high` risk bucket. */
    highRisk: number;
    cycles: number;
    dead: number;
    violations: number;
    dirty: number;
    /** Riskiest files, already sorted — click to open. */
    hotspots: { id: string; name: string; score: number }[];
}

export interface AuraCardInput {
    fileId: string;
    data: Pick<GraphData, 'nodes' | 'links'>;
    /** `ensureRiskSnapshot().byId` — absent before any git history is read. */
    risk?: Map<string, RiskFileEntry>;
    /** The file's trend, when `.aura/history` has been scanned. */
    trend?: FileTrend;
    dirty?: Map<string, GitFileState>;
    parseFailures?: Map<string, string>;
    /** Risk window in days, for the block's caption. */
    riskWindowDays?: number;
}

export interface AuraRepoInput {
    data: Pick<GraphData, 'nodes' | 'links'>;
    risk?: Map<string, RiskFileEntry>;
    dirty?: Map<string, GitFileState>;
}

/** Satellites per side. Past this the map says `+N more`. */
export const AURA_MAX_RELATIONS = 8;
/** The sparkline's drawing surface, in user units. */
export const AURA_SPARK_WIDTH = 84;
export const AURA_SPARK_HEIGHT = 20;

function baseName(id: string): string {
    const parts = String(id || '').split('/');
    return parts[parts.length - 1] || id;
}

function dirName(id: string): string {
    const cut = String(id || '').lastIndexOf('/');
    return cut > 0 ? id.slice(0, cut) : '';
}

function plural(count: number, one: string, many: string): string {
    return `${count} ${count === 1 ? one : many}`;
}

/**
 * Deduplicate by id, keep the strongest confidence, and **keep the graph order**:
 * the City inspector lists the same links in the same sequence, and two surfaces
 * that show the same file must not rank its neighbours differently.
 */
function relationsFor(
    links: readonly { source: string; target: string; type: string; confidence?: number }[],
    fileId: string,
): { out: AuraRelation[]; in: AuraRelation[]; docs: number } {
    const out = new Map<string, AuraRelation>();
    const inbound = new Map<string, AuraRelation>();
    let docs = 0;

    for (const link of links) {
        const isOut = link.source === fileId;
        const isIn = link.target === fileId;
        if (!isOut && !isIn) continue;
        const other = isOut ? link.target : link.source;
        if (!other || other === fileId) continue;
        if (link.type === 'doc-reference') {
            docs++;
            continue;
        }
        const bucket = isOut ? out : inbound;
        const confidence = typeof link.confidence === 'number' ? link.confidence : 1;
        const previous = bucket.get(other);
        if (!previous) {
            const name = baseName(other);
            bucket.set(other, { id: other, name, label: name, type: link.type, confidence });
        } else if (confidence > previous.confidence) {
            // Same satellite reached by two edges: keep its position, keep the
            // strongest one's type and confidence.
            previous.type = link.type;
            previous.confidence = confidence;
        }
    }

    const outList = [...out.values()];
    const inList = [...inbound.values()];
    disambiguate(outList);
    disambiguate(inList);
    return { out: outList, in: inList, docs };
}

/**
 * This repository keeps its build output beside its sources — `webview/js/city.js`
 * and `out/webview/js/city.js` are two nodes — so two satellites can share a base
 * name and the map used to print `city.js` twice. Colliding names get the
 * shortest leading path segment that tells them apart (`out/city.js` versus
 * `webview/city.js`); the full path stays in the tooltip.
 */
function disambiguate(relations: AuraRelation[]): void {
    const groups = new Map<string, AuraRelation[]>();
    for (const relation of relations) {
        const group = groups.get(relation.name);
        if (group) group.push(relation);
        else groups.set(relation.name, [relation]);
    }

    for (const [base, group] of groups) {
        if (group.length < 2) continue;
        const segments = group.map(relation => relation.id.split('/'));
        const depthLimit = Math.min(...segments.map(parts => parts.length - 1));
        for (let depth = 1; depth <= depthLimit; depth++) {
            const labels = segments.map(parts => parts.slice(0, depth).join('/') + '/' + base);
            if (new Set(labels).size === labels.length) {
                group.forEach((relation, index) => { relation.label = labels[index]; });
                break;
            }
        }
    }
}

function flagsFor(
    node: GraphNode,
    dirty: Map<string, GitFileState> | undefined,
    parseFailures: Map<string, string> | undefined,
): AuraFlag[] {
    const flags: AuraFlag[] = [];

    const dirtyState = dirty?.get(node.id);
    if (dirtyState) {
        const label = dirtyState === 'untracked' ? 'new file' : dirtyState;
        flags.push({ icon: '✏', label, tone: 'info' });
    }
    if (parseFailures?.has(node.id)) {
        flags.push({ icon: '⚠', label: 'parse error', tone: 'bad' });
    }
    if (node.cycleIds && node.cycleIds.length > 0) {
        flags.push({ icon: '⟳', label: plural(node.cycleIds.length, 'cycle', 'cycles'), tone: 'bad' });
    }
    const dead = node.deadExports?.length ?? 0;
    if (dead > 0) {
        flags.push({ icon: '☠', label: plural(dead, 'dead export', 'dead exports'), tone: 'warn' });
    }
    const violations = node.archViolations ?? 0;
    if (violations > 0) {
        flags.push({ icon: '🏛', label: plural(violations, 'violation', 'violations'), tone: 'warn' });
    }
    return flags;
}

function riskFor(entry: RiskFileEntry, trend: FileTrend | undefined, windowDays: number): AuraRiskView {
    const stats: string[] = [];
    if (entry.churn) stats.push(plural(entry.churn, 'commit', 'commits'));
    if (entry.relChurn) stats.push(Math.round(entry.relChurn * 100) + ' % rewritten');
    if (entry.fixRatio) stats.push(Math.round(entry.fixRatio * 100) + ' % fixes');
    if (entry.authorCount) stats.push(plural(entry.authorCount, 'author', 'authors'));

    return {
        score: Math.round(entry.score),
        bucket: entry.bucket,
        topLabel: entry.topLabel,
        reasons: (entry.reasons || []).map(reason => String(reason.text || '')).filter(Boolean).slice(0, 4),
        stats: stats.join(' · '),
        spark: trend && trend.points.length > 1
            ? sparklinePoints(trend.points, AURA_SPARK_WIDTH, AURA_SPARK_HEIGHT)
            : null,
        direction: trend ? trend.direction : 'unknown',
        windowDays,
    };
}

/** The card for one file, or `null` when the file is not in the graph. */
export function buildAuraCard(input: AuraCardInput): AuraCard | null {
    const { fileId, data, risk, trend, dirty, parseFailures } = input;
    const windowDays = input.riskWindowDays ?? 90;
    if (!fileId) return null;
    const node = data.nodes.find(candidate => candidate.id === fileId);
    if (!node) return null;

    const { out, in: inbound, docs } = relationsFor(data.links, fileId);
    const entry = risk?.get(node.id);

    return {
        file: {
            id: node.id,
            name: node.name || baseName(node.id),
            dir: dirName(node.id),
            language: node.language || '',
            lines: node.linesOfCode || 0,
            complexity: node.complexity || 0,
            cognitive: node.cognitive ?? 0,
            fanIn: node.fanIn || 0,
            fanOut: node.fanOut || 0,
            pagerank: typeof node.pagerank === 'number' ? node.pagerank : null,
            sizeKb: Math.max(0, Math.round((node.size || 0) / 102) / 10),
        },
        // Documentation is outside architectural risk: no score, and saying "0"
        // would read as "safe" when the truth is "not measured".
        risk: entry && node.language !== 'documentation'
            ? riskFor(entry, trend, windowDays)
            : null,
        flags: flagsFor(node, dirty, parseFailures),
        out: out.slice(0, AURA_MAX_RELATIONS),
        in: inbound.slice(0, AURA_MAX_RELATIONS),
        outTotal: out.length,
        inTotal: inbound.length,
        docs,
    };
}

/** The fallback shown when no analyzed file is open. */
export function buildAuraRepo(input: AuraRepoInput): AuraRepoView | null {
    const { data, risk, dirty } = input;
    if (!data.nodes || data.nodes.length === 0) return null;

    let cycles = 0;
    let dead = 0;
    let violations = 0;
    for (const node of data.nodes) {
        if (node.cycleIds && node.cycleIds.length > 0) cycles++;
        if (node.deadExports && node.deadExports.length > 0) dead++;
        if (node.archViolations && node.archViolations > 0) violations++;
    }

    const hotspots = risk
        ? [...risk.values()]
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map(entry => ({ id: entry.id, name: baseName(entry.id), score: Math.round(entry.score) }))
        : [];

    return {
        files: data.nodes.length,
        links: data.links.length,
        highRisk: risk ? risk.size > 0 ? [...risk.values()].filter(entry => entry.bucket === 'high').length : 0 : 0,
        cycles,
        dead,
        violations,
        dirty: dirty ? dirty.size : 0,
        hotspots,
    };
}
