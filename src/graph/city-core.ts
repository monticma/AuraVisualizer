/**
 * city-core.ts — pure layout for the 2.5D City view (V5-07).
 *
 * The city is an *encoding of the graph*, not another graph: every file keeps its
 * id, and only its geometry changes. All coordinates produced here are **normalized
 * to a unit square** (`w = d = 1`); the webview scales them once, so the plan is
 * resolution-independent and strictly deterministic (same input → same city).
 *
 * Bundled for the webview as `window.AuraCity` (IIFE, same pattern as `AuraSeed`),
 * and imported directly by the unit tests.
 *
 * Layout = squarified treemap (Bruls, Huizing & van Wijk, 2000) applied twice:
 *   1. districts (file group / architecture layer / community) on the ground;
 *   2. files inside their district, with a gutter so blocks stay readable.
 * Height = the chosen magnitude, discretised by the mapping mode.
 */

export type CityMetric =
    | 'linesOfCode'
    | 'complexity'
    | 'cognitive'
    | 'fanIn'
    | 'fanOut'
    | 'pagerank'
    | 'size';

export type CityMapping = 'quantiles' | 'linear' | 'threshold';

export type CityDistrictBy = 'group' | 'layer' | 'community';

/**
 * How a raw metric becomes a footprint weight.
 * `sqrt` (default) is the only one that keeps a real repository legible: LOC on
 * ThorV2 spans 1 → 23 028, so a linear footprint gives one file 6 % of the whole
 * city and starves the tail (36 files below 2 scene units — invisible at 762
 * nodes). Square-root compresses that ratio to 1 → 152.
 */
export type CityFootprintScale = 'sqrt' | 'linear' | 'log';

export interface CityNodeLike {
    id: string;
    name?: string;
    path?: string;
    /** Source line of the symbol, when the node is a function building. */
    line?: number;
    linesOfCode?: number;
    complexity?: number;
    cognitive?: number;
    fanIn?: number;
    fanOut?: number;
    pagerank?: number;
    size?: number;
    group?: string;
    layer?: string;
    community?: string;
    language?: string;
    extension?: string;
}

/** One function or method, as the analyzer attaches it to its file node. */
export interface CitySymbolLike {
    name?: string;
    line?: number;
    cognitive?: number;
    cyclomatic?: number;
    functionLines?: number;
}

/** A file node with the symbols the granularity switch reads. */
export interface CityFileNodeLike extends CityNodeLike {
    symbols?: {
        functions?: CitySymbolLike[];
        methods?: CitySymbolLike[];
    };
}

export interface FunctionGranularityOptions {
    /** Hard cap per file — one generated file must not own the whole city. */
    limitPerFile?: number;
}

export interface CityOptions {
    /** Magnitude encoded by the building height (default `cognitive`, fallback `complexity`). */
    height?: CityMetric;
    /** Magnitude encoded by the footprint (default `linesOfCode`). */
    footprint?: CityMetric;
    /** How the height metric becomes a building height. */
    mapping?: CityMapping;
    /** How the footprint metric becomes an area share (default `sqrt`). */
    footprintScale?: CityFootprintScale;
    /** What groups files into districts. */
    districtBy?: CityDistrictBy;
    /** Number of tiers for `quantiles` (default 5, like CodeCity's "boxplot (5 sizes)"). */
    heightCount?: number;
    /** Gutter between districts, as a fraction of the district's smallest side. */
    gap?: number;
    /**
     * Gutter between two buildings, as a fraction of the smaller side of their
     * cell. Without it the blocks share a wall and the plan reads as one solid
     * mass instead of a city with streets (CodeCity keeps ~15-20 %).
     */
    buildingGap?: number;
}

export interface CityRect {
    id: string;
    /** Ground coordinates, in the unit square. */
    x: number;
    z: number;
    w: number;
    d: number;
    /** Normalized height, `MIN_HEIGHT_RATIO..1`. */
    h: number;
    district: string;
    /** Nesting depth of the district key — drives the plinth altitude. */
    depth: number;
    /** Raw metric values, kept for tooltips and legends. */
    footprintValue: number;
    heightValue: number;
}

export interface CityDistrict {
    key: string;
    x: number;
    z: number;
    w: number;
    d: number;
    depth: number;
    count: number;
}

export interface CityPlan {
    rects: CityRect[];
    districts: CityDistrict[];
    /** Tier boundaries used by `quantiles`, ascending (length = heightCount + 1). */
    tiers: number[];
    /** Metric actually used for heights (after the `cognitive → complexity` fallback). */
    heightMetric: CityMetric;
    footprintMetric: CityMetric;
    mapping: CityMapping;
    /** Median footprint edge length, in unit-square units — handy for label/plinth sizing. */
    medianEdge: number;
}

/** Shortest building still visible, as a fraction of the tallest. */
export const MIN_HEIGHT_RATIO = 0.12;

/** What a file *is*, for the "ranked / not ranked" distinction in the city. */
export type FileKind = 'code' | 'docs' | 'data' | 'config' | 'asset';

const CODE_LANGUAGES = new Set([
    'c', 'cpp', 'javascript', 'typescript', 'tsx', 'python', 'java', 'go', 'rust',
    'kotlin', 'ruby', 'swift', 'csharp', 'php', 'vue', 'bash', 'lua', 'css', 'html',
]);

const KIND_BY_LANGUAGE: Record<string, FileKind> = {
    documentation: 'docs', markdown: 'docs',
    json: 'data', yaml: 'data', csv: 'data', sql: 'data', xml: 'data',
    toml: 'config', ini: 'config',
};

const KIND_BY_EXTENSION: Record<string, FileKind> = {
    '.md': 'docs', '.markdown': 'docs', '.rst': 'docs', '.txt': 'docs', '.adoc': 'docs',
    '.json': 'data', '.yaml': 'data', '.yml': 'data', '.csv': 'data', '.tsv': 'data',
    '.sql': 'data', '.xml': 'data',
    '.toml': 'config', '.ini': 'config', '.cfg': 'config', '.conf': 'config',
    '.env': 'config', '.properties': 'config',
    '.png': 'asset', '.jpg': 'asset', '.jpeg': 'asset', '.gif': 'asset', '.svg': 'asset',
    '.ico': 'asset', '.webp': 'asset', '.woff': 'asset', '.woff2': 'asset', '.ttf': 'asset',
    '.otf': 'asset', '.wasm': 'asset', '.zip': 'asset', '.pdf': 'asset',
};

/**
 * Code, documentation, data, configuration or asset? The city paints every file
 * with the same ramp today, so 242 of ThorV2's 762 buildings are documentation
 * dressed as skyscrapers. Anything that is not code is drawn as "not ranked".
 */
export function fileKind(node: { language?: string; extension?: string; id?: string }): FileKind {
    if (!node) return 'code';
    const language = (node.language || '').toLowerCase();
    const known = KIND_BY_LANGUAGE[language];
    if (known) return known;
    if (language && CODE_LANGUAGES.has(language)) return 'code';

    let ext = (node.extension || '').toLowerCase();
    if (!ext && node.id) {
        const dot = node.id.lastIndexOf('.');
        if (dot > 0) ext = node.id.slice(dot).toLowerCase();
    }
    if (ext && KIND_BY_EXTENSION[ext]) return KIND_BY_EXTENSION[ext];

    // A language we do not know still looks like code; an unknown extension with
    // no language at all is an asset. Nothing known: never grey a file out.
    if (language && language !== 'unknown') return 'code';
    if (ext) return 'asset';
    return 'code';
}

/** The three kinds that are not code, in legend order. */
export const NON_CODE_KINDS: FileKind[] = ['docs', 'data', 'config'];

/**
 * Size of the "hottest" band: 5 % of the buildings, but never fewer than 3 (a
 * 6-file project still has a top) and never more than 20 (5 % of 5 000 is 250,
 * which is a third of the city, not a band).
 */
export function topBandSize(total: number, ratio = 0.05, min = 3, max = 20): number {
    const n = typeof total === 'number' && isFinite(total) && total > 0 ? Math.floor(total) : 0;
    if (n === 0) return 0;
    const wanted = Math.ceil(n * ratio);
    return Math.max(Math.min(min, n), Math.min(wanted, max));
}

/**
 * World width of the plan at the reference building count. The plan itself is
 * normalized to a unit square, so this is the only place a building count turns
 * into metres.
 */
export const BASE_CITY_SCALE = 520;

/** Building count that renders at `BASE_CITY_SCALE` (this repo, 762 files). */
export const REFERENCE_BUILDINGS = 762;

/** A village still has to be visible: 20 buildings would be a 40-unit speck. */
export const MIN_CITY_SCALE = 260;

/** …and a generated 50 000-building city must not leave the ground plane. */
export const MAX_CITY_SCALE = 1800;

/**
 * World size of the plan for a given building count. The ground and its 130-unit
 * grid are fixed in world units, so growing the city with √n turns that grid into
 * a ruler: 20 buildings → 2 cells, 762 → 4, 4 993 → 10. The camera follows, so
 * the composition stays usable at every size.
 */
export function cityScaleFor(count: number): number {
    const n = typeof count === 'number' && isFinite(count) && count > 0 ? count : 0;
    if (n === 0) return BASE_CITY_SCALE;
    return Math.max(MIN_CITY_SCALE, Math.min(MAX_CITY_SCALE, BASE_CITY_SCALE * Math.sqrt(n / REFERENCE_BUILDINGS)));
}

/**
 * Default cap on the functions turned into buildings, per file. High enough to
 * keep every real file whole (the largest amalgamation seen — mongoose.c — holds
 * 875 functions), low enough to stop a generated file from owning the city.
 */
export const DEFAULT_FUNCTION_LIMIT = 2000;

/** A count that must stay positive: `undefined`, `NaN` and `0` fall back. */
function positiveOr(value: number | undefined, fallback: number): number {
    return typeof value === 'number' && isFinite(value) && value > 0 ? value : fallback;
}

/**
 * One building per **function** instead of one per file — the granularity of
 * CodeCity's "City of C" metaphor. Files become the districts (`group` is set to
 * the file path, so the treemap nests each file's functions in their own block),
 * which is exactly the C/C++ mapping: functions are buildings, files are blocks.
 *
 * Heights read the function's own metrics (`functionLines`, `cyclomatic`,
 * `cognitive`); fan-in/out and PageRank stay at 0 because the payload only
 * carries file-level dependency data. Ids are `file#name` (then `#2`, `#3`… for
 * same-named symbols), deterministic in source order.
 */
export function functionNodes(nodes: CityFileNodeLike[], options: FunctionGranularityOptions = {}): CityNodeLike[] {
    const limit = Math.max(1, Math.floor(options.limitPerFile || DEFAULT_FUNCTION_LIMIT));
    const out: CityNodeLike[] = [];
    const taken = new Set<string>();

    for (const node of nodes) {
        if (!node || typeof node.id !== 'string' || node.id.length === 0) continue;
        const symbols = node.symbols;
        if (!symbols) continue;
        const file = node.path && node.path.length > 0 ? node.path : node.id;
        const list = [...(symbols.functions || []), ...(symbols.methods || [])];
        let kept = 0;
        for (const fn of list) {
            if (kept >= limit) break;
            const name = fn && typeof fn.name === 'string' ? fn.name.trim() : '';
            if (!name) continue;
            kept += 1;
            let id = file + '#' + name;
            let duplicate = 2;
            while (taken.has(id)) id = file + '#' + name + '#' + duplicate++;
            taken.add(id);

            const cyclomatic = positiveOr(fn.cyclomatic, 1);
            out.push({
                id,
                name,
                path: file,
                line: typeof fn.line === 'number' && fn.line > 0 ? fn.line : undefined,
                linesOfCode: positiveOr(fn.functionLines, 1),
                complexity: cyclomatic,
                cognitive: typeof fn.cognitive === 'number' && isFinite(fn.cognitive)
                    ? Math.max(0, fn.cognitive)
                    : cyclomatic,
                fanIn: 0,
                fanOut: 0,
                pagerank: 0,
                group: file,
                layer: node.layer,
                community: node.community,
                language: node.language,
                extension: node.extension,
            });
        }
    }
    return out;
}

/** Default tier count — CodeCity's "boxplot (5 sizes)". */
export const DEFAULT_HEIGHT_COUNT = 5;

/** Default district gutter (fraction of the district's smallest side). */
export const DEFAULT_GAP = 0.06;

/** Default street width between two buildings (fraction of the cell's smaller side). */
export const DEFAULT_BUILDING_GAP = 0.3;

/** Absolute floor for a street, in unit-square units (≈ 1.6 scene units at scale 520). */
export const MIN_STREET = 0.003;

/** Absolute value of a metric on a node, with the cognitive → complexity fallback. */export function metricValue(node: CityNodeLike, metric: CityMetric): number {
    let raw: number | undefined;
    switch (metric) {
        case 'linesOfCode': raw = node.linesOfCode; break;
        case 'complexity': raw = node.complexity; break;
        case 'cognitive': raw = node.cognitive !== undefined ? node.cognitive : node.complexity; break;        case 'fanIn': raw = node.fanIn; break;
        case 'fanOut': raw = node.fanOut; break;
        case 'pagerank': raw = node.pagerank; break;
        case 'size': raw = node.size; break;
    }
    if (raw === undefined || raw === null || !isFinite(raw)) return 0;
    return raw > 0 ? raw : 0;
}

/** District key of a node for the requested grouping. */
export function districtKeyOf(node: CityNodeLike, by: CityDistrictBy): string {
    if (by === 'layer') {
        const layer = node.layer && node.layer.length > 0 ? node.layer : '(unlayered)';
        return layer;
    }
    if (by === 'community') {
        if (node.community && node.community.length > 0) return node.community;
    }
    const group = node.group && node.group.length > 0 ? node.group : node.path;
    if (!group) return '.';
    const normalized = group.replace(/\\/g, '/').replace(/\/+$/, '');
    return normalized.length > 0 ? normalized : '.';
}

/** Nesting depth of a district key (`a/b/c` → 2, `a` → 0). */
export function districtDepth(key: string): number {
    if (!key || key === '.') return 0;
    return key.split('/').length - 1;
}

interface Placed { id: string; x: number; y: number; w: number; h: number; }

/**
 * Squarified treemap (Bruls et al., 2000). Items are sorted by decreasing value
 * then by id, so the output is deterministic. Returns one rectangle per item,
 * covering `rect` exactly when no item has a zero value.
 */
export function squarify(
    items: Array<{ id: string; value: number }>,
    rect: { x: number; y: number; w: number; h: number },
): Placed[] {
    const positive = items.filter(item => item.value > 0);
    if (positive.length === 0 || rect.w <= 0 || rect.h <= 0) return [];

    const total = positive.reduce((sum, item) => sum + item.value, 0);
    const scale = (rect.w * rect.h) / total;
    const sorted = positive
        .map(item => ({ id: item.id, area: Math.max(item.value * scale, 1e-12) }))
        .sort((a, b) => (b.area - a.area) || a.id.localeCompare(b.id));

    const out: Placed[] = [];
    let free = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    let index = 0;

    while (index < sorted.length) {
        const side = Math.min(free.w, free.h);
        const row = [sorted[index]];
        let next = index + 1;
        while (next < sorted.length && worst([...row, sorted[next]], side) <= worst(row, side)) {
            row.push(sorted[next]);
            next++;
        }

        const rowArea = row.reduce((sum, item) => sum + item.area, 0);
        if (rowArea <= 0) break;

        if (free.w >= free.h) {
            const width = Math.min(rowArea / free.h, free.w);
            let cursor = free.y;
            for (const item of row) {
                const height = (item.area / rowArea) * free.h;
                out.push({ id: item.id, x: free.x, y: cursor, w: width, h: height });
                cursor += height;
            }
            free = { x: free.x + width, y: free.y, w: free.w - width, h: free.h };
        } else {
            const height = Math.min(rowArea / free.w, free.h);
            let cursor = free.x;
            for (const item of row) {
                const width = (item.area / rowArea) * free.w;
                out.push({ id: item.id, x: cursor, y: free.y, w: width, h: height });
                cursor += width;
            }
            free = { x: free.x, y: free.y + height, w: free.w, h: free.h - height };
        }

        index = next;
    }

    return out;
}

function worst(row: Array<{ area: number }>, side: number): number {
    let sum = 0;
    let max = -Infinity;
    let min = Infinity;
    for (const item of row) {
        sum += item.area;
        if (item.area > max) max = item.area;
        if (item.area < min) min = item.area;
    }
    if (sum <= 0 || side <= 0) return Infinity;
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

/** Ascending tier boundaries (`count + 1` values) computed on quantiles. */
export function tierEdges(values: number[], count: number = DEFAULT_HEIGHT_COUNT): number[] {
    const sorted = values.filter(value => isFinite(value)).slice().sort((a, b) => a - b);
    if (sorted.length === 0) return [];
    const tiers = Math.max(1, Math.floor(count));
    const edges: number[] = [];
    for (let i = 0; i <= tiers; i++) {
        const position = (sorted.length - 1) * (i / tiers);
        const low = Math.floor(position);
        const high = Math.ceil(position);
        const weight = position - low;
        const value = low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * weight;
        edges.push(value);
    }
    return edges;
}

/** Tier index (1..edges.length-1) of a value. Values below the first edge land in tier 1. */
export function tierOf(value: number, edges: number[]): number {
    if (edges.length < 2) return 1;
    for (let i = 1; i < edges.length; i++) {
        if (value <= edges[i]) return i;
    }
    return edges.length - 1;
}

/**
 * Height in `MIN_HEIGHT_RATIO..1` for a metric value.
 * - `quantiles` : discrete tiers (5 by default) — the skyline stays readable;
 * - `linear`    : continuous, normalized on the observed range;
 * - `threshold` : two levels, split at the median — answers "where are the big ones?".
 */
export function heightFor(
    value: number,
    reference: { min: number; max: number; median: number },
    mapping: CityMapping,
    edges: number[] = [],
): number {
    const span = reference.max - reference.min;
    // A degenerate distribution (one file, or every file identical) has no
    // ranking to express: give the whole city the same, full-height profile
    // instead of collapsing it to the minimum ratio.
    if (span <= 0) return 1;
    if (mapping === 'threshold') {
        return value > reference.median ? 1 : MIN_HEIGHT_RATIO + (1 - MIN_HEIGHT_RATIO) * 0.35;
    }
    if (mapping === 'linear') {
        const ratio = (value - reference.min) / span;
        return MIN_HEIGHT_RATIO + (1 - MIN_HEIGHT_RATIO) * Math.max(0, Math.min(1, ratio));
    }
    const tiers = Math.max(1, edges.length - 1);
    if (tiers <= 1) return 1;
    // Quantile boundaries can all be equal on a flat distribution — that is one
    // tier wearing five names.
    if (edges.every(edge => edge === edges[0])) return 1;
    const tier = tierOf(value, edges);
    return MIN_HEIGHT_RATIO + ((1 - MIN_HEIGHT_RATIO) * (tier - 1)) / (tiers - 1);
}

function medianOf(sorted: number[]): number {
    if (sorted.length === 0) return 0;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

/**
 * Shrink a cell around its centre to leave a street on every side. The result
 * never collapses: a tiny cell keeps at least 30 % of its extent, so a dense
 * district still shows one visible block per file.
 */
function streetInset(slot: Placed, gap: number): Placed {
    if (gap <= 0) return slot;
    // A ratio alone vanishes on tiny cells; the absolute floor keeps a street
    // visible even when a district holds a hundred slivers. The 35 % ceiling
    // guarantees a street on every cell, however small it is.
    const shortest = Math.min(slot.w, slot.h);
    const inset = Math.min(Math.max(shortest * gap * 0.5, MIN_STREET * 0.5), shortest * 0.35);
    const w = Math.max(slot.w - inset * 2, 1e-9);
    const h = Math.max(slot.h - inset * 2, 1e-9);
    return { id: slot.id, x: slot.x + (slot.w - w) / 2, y: slot.y + (slot.h - h) / 2, w, h };
}

/** Footprint weight of one file, after the chosen compression. */
export function footprintWeight(value: number, scale: CityFootprintScale = 'sqrt'): number {
    const raw = value > 0 ? value : 0;
    if (scale === 'linear') return Math.max(raw, 1);
    if (scale === 'log') return Math.max(Math.log10(raw + 1), 0.25);
    return Math.max(Math.sqrt(raw), 1);
}

/**
 * Full city plan: districts on the ground, one building per node inside its
 * district. Deterministic; returns normalized coordinates in the unit square.
 */
export function layoutCity(nodes: CityNodeLike[], options: CityOptions = {}): CityPlan {
    const footprintMetric = options.footprint || 'linesOfCode';
    let heightMetric = options.height || 'cognitive';
    const mapping = options.mapping || 'quantiles';
    const districtBy = options.districtBy || 'group';
    const heightCount = Math.max(1, options.heightCount || DEFAULT_HEIGHT_COUNT);
    const gap = options.gap === undefined ? DEFAULT_GAP : Math.max(0, Math.min(0.4, options.gap));
    const buildingGap = options.buildingGap === undefined
        ? DEFAULT_BUILDING_GAP
        : Math.max(0, Math.min(0.6, options.buildingGap));
    const footprintScale = options.footprintScale || 'sqrt';

    // `cognitive` may be absent from a whole repository (unsupported languages):
    // fall back to `complexity` so the skyline keeps its meaning. The check reads
    // the raw field, not `metricValue()`, which already falls back per node.
    if (heightMetric === 'cognitive' && !nodes.some(node => typeof node.cognitive === 'number' && isFinite(node.cognitive))) {
        heightMetric = 'complexity';
    }

    const usable = nodes.filter(node => node && typeof node.id === 'string' && node.id.length > 0);
    const empty: CityPlan = {
        rects: [], districts: [], tiers: [], heightMetric, footprintMetric, mapping, medianEdge: 0,
    };
    if (usable.length === 0) return empty;

    // ── Heights ─────────────────────────────────────────────────
    const heights = usable.map(node => metricValue(node, heightMetric));
    const sortedHeights = heights.slice().sort((a, b) => a - b);
    const reference = {
        min: sortedHeights[0],
        max: sortedHeights[sortedHeights.length - 1],
        median: medianOf(sortedHeights),
    };
    const edges = mapping === 'quantiles' ? tierEdges(heights, heightCount) : [];

    // ── Districts ───────────────────────────────────────────────
    const byDistrict = new Map<string, CityNodeLike[]>();
    for (const node of usable) {
        const key = districtKeyOf(node, districtBy);
        const bucket = byDistrict.get(key);
        if (bucket) bucket.push(node);
        else byDistrict.set(key, [node]);
    }

    const footprints = new Map<string, number>();
    const rawFootprints = new Map<string, number>();
    for (const node of usable) {
        const raw = metricValue(node, footprintMetric);
        rawFootprints.set(node.id, raw);
        footprints.set(node.id, footprintWeight(raw, footprintScale));
    }

    const districtItems = [...byDistrict.entries()].map(([key, members]) => ({
        id: key,
        value: Math.max(1, members.reduce((sum, node) => sum + Math.max(footprints.get(node.id) || 0, 1), 0)),
    }));

    const districtRects = squarify(districtItems, { x: 0, y: 0, w: 1, h: 1 });
    const rects: CityRect[] = [];
    const districts: CityDistrict[] = [];

    for (const placed of districtRects) {
        const members = byDistrict.get(placed.id) || [];
        const depth = districtDepth(placed.id);
        districts.push({
            key: placed.id, x: placed.x, z: placed.y, w: placed.w, d: placed.h, depth, count: members.length,
        });

        // Gutter keeps the blocks apart; a single-member district keeps a visible slab.
        const insetX = placed.w * gap;
        const insetZ = placed.h * gap;
        const inner = {
            x: placed.x + insetX,
            y: placed.y + insetZ,
            w: Math.max(placed.w - insetX * 2, 1e-6),
            h: Math.max(placed.h - insetZ * 2, 1e-6),
        };

        const items = members.map(node => ({ id: node.id, value: Math.max(footprints.get(node.id) || 0, 1) }));
        const placedMembers = squarify(items, inner);
        const byId = new Map(members.map(node => [node.id, node]));

        for (const slot of placedMembers) {
            const node = byId.get(slot.id);
            if (!node) continue;
            const heightValue = metricValue(node, heightMetric);
            const block = streetInset(slot, buildingGap);
            rects.push({
                id: node.id,
                x: block.x,
                z: block.y,
                w: block.w,
                d: block.h,
                h: heightFor(heightValue, reference, mapping, edges),
                district: placed.id,
                depth,
                footprintValue: rawFootprints.get(node.id) || 0,
                heightValue,
            });
        }
    }

    const edgesSides: number[] = [];
    for (const rect of rects) edgesSides.push(Math.min(rect.w, rect.d));
    edgesSides.sort((a, b) => a - b);

    return {
        rects,
        districts,
        tiers: edges,
        heightMetric,
        footprintMetric,
        mapping,
        medianEdge: medianOf(edgesSides),
    };
}
