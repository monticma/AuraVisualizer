/**
 * arch-core.ts — Architecture rules engine (V2-20).
 *
 * Declarative layer constraints over the dependency graph:
 *
 *   - `layers`     : file → layer assignment by glob (first match wins)
 *   - deny rules   : edges from a layer to forbidden layers are violations
 *   - slices       : sibling feature folders may not import each other
 *   - no-cycles    : cycles in the aggregated layer graph
 *   - exceptions   : source globs exempted from every rule
 *   - baseline     : freeze legacy violations; only new ones alert
 *   - Martin       : Ca / Ce / instability per layer
 *
 * This module is deliberately dependency-free (no `vscode`, no DOM, no `fs`):
 * it runs in the extension host, in the webview bundle (`window.AuraArch`) and
 * in the standalone MCP server, and is unit-tested in vitest.
 *
 * Documentation is not architecture: nodes with `language === 'documentation'`
 * and `doc-reference` edges never participate, whatever `edgeTypes` says.
 */

/** Rules file format version. */
export const ARCH_RULES_VERSION = 1;

/** Workspace-relative path of the rules file. */
export const ARCH_RULES_FILE = '.aura/arch-rules.json';

/** Workspace-relative path of the adoption baseline. */
export const ARCH_BASELINE_FILE = '.aura/arch-baseline.json';

/** Pseudo-layer used by deny rules for files matched by no layer. */
export const UNLAYERED = 'unlayered';

/** Edge types evaluated by default. `doc-reference` is never included. */
export const DEFAULT_ARCH_EDGE_TYPES = [
    'import',
    'import-type',
    'require',
    'dynamic-import',
    'include',
    'system-include',
    'script',
    'stylesheet',
    'css-import',
    'css-url',
    'asset',
    'extends',
    'implements',
    'function-call',
    'source',
];

export type ArchSeverity = 'error' | 'warn';

export interface ArchLayer {
    name: string;
    paths: string[];
}

export interface ArchDenyRule {
    id: string;
    kind: 'deny';
    from: string;
    deny: string[];
    severity: ArchSeverity;
}

export interface ArchSlicesRule {
    id: string;
    kind: 'slices';
    pattern: string;
    shared: string[];
    severity: ArchSeverity;
}

export interface ArchNoCyclesRule {
    id: string;
    kind: 'no-cycles';
    severity: ArchSeverity;
}

export type ArchRule = ArchDenyRule | ArchSlicesRule | ArchNoCyclesRule;

export interface ArchRules {
    version: number;
    edgeTypes: string[];
    layers: ArchLayer[];
    rules: ArchRule[];
    exceptions: string[];
    /** Report files matched by no layer (`unlayered`) as warnings. */
    strict: boolean;
}

/** Rules with no layer and no rule — the feature stays off until configured. */
export const EMPTY_ARCH_RULES: ArchRules = {
    version: ARCH_RULES_VERSION,
    edgeTypes: DEFAULT_ARCH_EDGE_TYPES.slice(),
    layers: [],
    rules: [],
    exceptions: [],
    strict: false,
};

// ============================================================
// Minimal graph shapes (host GraphData, webview graph, MCP rows)
// ============================================================

export interface ArchNodeLike {
    id: string;
    path?: string;
    language?: string;
    /** Filled by `applyArchitecture`. */
    layer?: string;
    /** Number of *new* (non-baselined) violations where this file is the source. */
    archViolations?: number;
}

export interface ArchLinkLike {
    source: string | { id: string };
    target: string | { id: string };
    type?: string;
    /** Filled by `applyArchitecture`. */
    archViolation?: ArchLinkViolation;
}

export interface ArchLinkViolation {
    ruleId: string;
    severity: ArchSeverity;
    baselined: boolean;
    /** Edge types the rule actually evaluated for this file pair. */
    linkTypes?: string[];
}

export interface ArchGraphLike {
    nodes: ArchNodeLike[];
    links: ArchLinkLike[];
}

export interface ArchBaselineEntry {
    ruleId: string;
    source: string;
    target: string;
}

export interface ArchBaseline {
    version: number;
    entries: ArchBaselineEntry[];
}

export const EMPTY_ARCH_BASELINE: ArchBaseline = { version: ARCH_RULES_VERSION, entries: [] };

export type ArchViolationKind = 'deny' | 'slices';

export interface ArchViolation {
    ruleId: string;
    kind: ArchViolationKind;
    severity: ArchSeverity;
    source: string;
    target: string;
    /** First matching edge type (stable: links are processed in input order). */
    linkType: string;
    /** Every edge type connecting the pair inside the configured set. */
    linkTypes: string[];
    sourceGroup?: string;
    targetGroup?: string;
    /** Real architectural layer (deny rules only; slices have no layer group). */
    sourceLayer?: string;
    targetLayer?: string;
    /** Present in the baseline — kept visible but not counted as new. */
    baselined: boolean;
}

export interface ArchLayerStat {
    name: string;
    files: number;
    /** Afferent coupling: distinct external files depending on this layer. */
    ca: number;
    /** Efferent coupling: distinct external files this layer depends on. */
    ce: number;
    /** Martin instability I = Ce / (Ca + Ce); null when the layer is isolated. */
    instability: number | null;
    violations: number;
    newViolations: number;
    baselined: number;
    errors: number;
    warnings: number;
}

export interface ArchCycle {
    ruleId: string;
    severity: ArchSeverity;
    /** Layers in the cycle, sorted for determinism. */
    layers: string[];
}

export interface ArchRuleSummary {
    layerNames: string[];
    ruleCount: number;
    denyCount: number;
    slicesCount: number;
    noCyclesCount: number;
    exceptionCount: number;
    strict: boolean;
    edgeTypes: string[];
}

export interface ArchEvaluation {
    rules: ArchRuleSummary;
    layers: ArchLayerStat[];
    /** All violations (baselined included), in deterministic order. */
    violations: ArchViolation[];
    /** Violations not present in the baseline — the only ones that alert. */
    newViolations: ArchViolation[];
    counts: {
        errors: number;
        warnings: number;
        total: number;
        baselined: number;
        newTotal: number;
        newErrors: number;
        newWarnings: number;
    };
    layerCycles: ArchCycle[];
    /** Sample of files outside every layer (capped for payload size). */
    unlayeredFiles: string[];
    /** Exact number of files outside every layer. */
    unlayeredTotal: number;
    /** Evaluation skipped because no layer/rule is configured. */
    configured: boolean;
}

export interface ArchEvaluateOptions {
    baseline?: ArchBaseline | null;
}

// ============================================================
// Glob matching (no dependency)
// ============================================================

/** Normalize workspace-relative paths: slash-separated, no leading `./`. */
export function normalizeArchPath(input: string): string {
    let value = String(input == null ? '' : input).replace(/\\/g, '/').trim();
    while (value.startsWith('./')) value = value.slice(2);
    value = value.replace(/\/{2,}/g, '/');
    if (value.length > 1 && value.endsWith('/')) value = value.slice(0, -1);
    return value;
}

function escapeRegExpChar(char: string): string {
    return /[.*+?^${}()|[\]\\]/.test(char) ? '\\' + char : char;
}

/** Glob source (no anchors): `*` inside a segment, `**` across segments. */
function globSource(pattern: string): string {
    // Unlike repository paths, a glob kept as a prefix (`src/features/`) must
    // keep its trailing slash: `globSource(prefix) + capture` relies on it.
    let normalized = String(pattern == null ? '' : pattern).replace(/\\/g, '/').trim();
    while (normalized.startsWith('./')) normalized = normalized.slice(2);
    normalized = normalized.replace(/\/{2,}/g, '/');
    let out = '';
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized[i];
        if (char === '*') {
            if (normalized[i + 1] === '*') {
                while (normalized[i + 1] === '*') i++;
                if (normalized[i + 1] === '/') {
                    i++;
                    out += '(?:.*/)?';
                } else {
                    out += '.*';
                }
            } else {
                out += '[^/]*';
            }
        } else if (char === '?') {
            out += '[^/]';
        } else {
            out += escapeRegExpChar(char);
        }
    }
    return out;
}

/**
 * Compile a workspace glob into an anchored RegExp.
 *   `*`  → any run of characters inside one path segment
 *   `**` → any run including `/`; `**\/` also matches zero directories
 *   `?`  → one character inside a segment
 */
export function globToRegExp(pattern: string): RegExp {
    return new RegExp('^' + globSource(pattern) + '$');
}

/** True when a workspace-relative path matches the glob. */
export function globMatch(path: string, pattern: string): boolean {
    return globToRegExp(pattern).test(normalizeArchPath(path));
}

function compileGlobs(patterns: string[]): RegExp[] {
    return patterns.map(globToRegExp);
}

function matchesAny(path: string, regexps: RegExp[]): boolean {
    for (const re of regexps) if (re.test(path)) return true;
    return false;
}

/**
 * Compile a slices pattern (`src/features/*`) into a capture regex.
 * Exactly one `*` is required; it captures one path segment (the slice name).
 * The rest of the pattern keeps normal glob semantics (`**`, `?`).
 */
export function slicesPatternToRegExp(pattern: string): RegExp {
    const normalized = normalizeArchPath(pattern);
    // Runs of `*`: exactly one single-star run is the slice capture; double
    // stars (`**`) are allowed anywhere else.
    const runs: { start: number; length: number }[] = [];
    for (let i = 0; i < normalized.length; i++) {
        if (normalized[i] !== '*') continue;
        let length = 1;
        while (normalized[i + length] === '*') length++;
        runs.push({ start: i, length });
        i += length - 1;
    }
    const singles = runs.filter(run => run.length === 1);
    if (singles.length !== 1) {
        throw new Error(`Slices pattern "${pattern}" must contain exactly one "*" for the slice name`);
    }
    const star = singles[0].start;
    const prefix = normalized.slice(0, star);
    const suffix = normalized.slice(star + 1);
    // `src/features/*` names the slice folder itself: every file beneath it
    // belongs to that slice. A pattern with a suffix (`.../*/src/**`) already
    // describes the files, and is used as-is.
    const tail = suffix ? globSource(suffix) : '(?:/.*)?';
    return new RegExp('^' + globSource(prefix) + '([^/]+)' + tail + '$');
}

// ============================================================
// Rules parsing / normalization
// ============================================================

function asStringArray(value: unknown, field: string, where: string): string[] {
    if (typeof value === 'string' && value.trim()) return [value.trim()];
    if (!Array.isArray(value)) throw new Error(`${where}: "${field}" must be an array of strings`);
    const out: string[] = [];
    for (const item of value) {
        if (typeof item !== 'string' || !item.trim()) {
            throw new Error(`${where}: "${field}" must contain non-empty strings`);
        }
        out.push(item.trim());
    }
    return out;
}

function normalizeSeverity(value: unknown, where: string): ArchSeverity {
    if (value === undefined) return 'warn';
    if (value === 'error' || value === 'warn') return value;
    throw new Error(`${where}: "severity" must be "error" or "warn"`);
}

/**
 * Parse `.aura/arch-rules.json`. Throws a readable error on invalid input so
 * the settings UI can show exactly what to fix (never a stack trace).
 */
export function parseArchRules(raw: string): ArchRules {
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch (err) {
        throw new Error(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('The rules file must contain a JSON object');
    }
    const obj = data as Record<string, unknown>;

    if (obj.version !== undefined && obj.version !== ARCH_RULES_VERSION) {
        throw new Error(`Unsupported rules version ${String(obj.version)} (expected ${ARCH_RULES_VERSION})`);
    }

    const edgeTypes = obj.edgeTypes === undefined
        ? DEFAULT_ARCH_EDGE_TYPES.slice()
        : asStringArray(obj.edgeTypes, 'edgeTypes', 'rules').map(t => t.toLowerCase());
    if (edgeTypes.indexOf('doc-reference') !== -1) {
        // Documentation is not architecture — silently drop instead of failing.
        const idx = edgeTypes.indexOf('doc-reference');
        edgeTypes.splice(idx, 1);
    }

    const rawLayers = obj.layers === undefined ? [] : obj.layers;
    if (!Array.isArray(rawLayers)) throw new Error('"layers" must be an array');
    const layers: ArchLayer[] = [];
    const layerNames = new Set<string>();
    for (let i = 0; i < rawLayers.length; i++) {
        const entry = rawLayers[i] as Record<string, unknown>;
        if (!entry || typeof entry !== 'object') throw new Error(`Layer #${i} must be an object`);
        if (typeof entry.name !== 'string' || !entry.name.trim()) {
            throw new Error(`Layer #${i} needs a non-empty "name"`);
        }
        const name = entry.name.trim();
        if (name === UNLAYERED) throw new Error(`Layer name "${UNLAYERED}" is reserved`);
        if (layerNames.has(name)) throw new Error(`Duplicate layer name "${name}"`);
        layerNames.add(name);
        const paths = asStringArray(entry.paths, 'paths', `Layer "${name}"`);
        if (paths.length === 0) throw new Error(`Layer "${name}" needs at least one glob in "paths"`);
        layers.push({ name, paths });
    }

    const rawRules = obj.rules === undefined ? [] : obj.rules;
    if (!Array.isArray(rawRules)) throw new Error('"rules" must be an array');
    const rules: ArchRule[] = [];
    const ruleIds = new Set<string>();
    for (let i = 0; i < rawRules.length; i++) {
        const entry = rawRules[i] as Record<string, unknown>;
        if (!entry || typeof entry !== 'object') throw new Error(`Rule #${i} must be an object`);
        if (typeof entry.id !== 'string' || !entry.id.trim()) {
            throw new Error(`Rule #${i} needs a non-empty "id"`);
        }
        const id = entry.id.trim();
        if (ruleIds.has(id)) throw new Error(`Duplicate rule id "${id}"`);
        ruleIds.add(id);
        const where = `Rule "${id}"`;
        const kind = entry.type === undefined ? 'deny' : entry.type;
        if (kind === 'deny') {
            if (typeof entry.from !== 'string' || !entry.from.trim()) {
                throw new Error(`${where}: "from" is required`);
            }
            const from = entry.from.trim();
            if (from !== UNLAYERED && !layerNames.has(from)) {
                throw new Error(`${where}: unknown source layer "${from}"`);
            }
            const deny = asStringArray(entry.deny, 'deny', where);
            if (deny.length === 0) throw new Error(`${where}: "deny" must not be empty`);
            for (const target of deny) {
                if (target !== '*' && target !== UNLAYERED && !layerNames.has(target)) {
                    throw new Error(`${where}: unknown denied layer "${target}"`);
                }
                if (target === from) throw new Error(`${where}: a layer cannot deny itself`);
            }
            rules.push({ id, kind: 'deny', from, deny, severity: normalizeSeverity(entry.severity, where) });
        } else if (kind === 'slices') {
            if (typeof entry.pattern !== 'string' || !entry.pattern.trim()) {
                throw new Error(`${where}: "pattern" is required for a slices rule`);
            }
            const pattern = entry.pattern.trim();
            slicesPatternToRegExp(pattern); // validates shape
            const shared = entry.shared === undefined ? [] : asStringArray(entry.shared, 'shared', where);
            rules.push({ id, kind: 'slices', pattern, shared, severity: normalizeSeverity(entry.severity, where) });
        } else if (kind === 'no-cycles') {
            if (entry.scope !== undefined && entry.scope !== 'layers') {
                throw new Error(`${where}: only "scope": "layers" is supported`);
            }
            rules.push({ id, kind: 'no-cycles', severity: normalizeSeverity(entry.severity, where) });
        } else {
            throw new Error(`${where}: unknown rule type "${String(kind)}"`);
        }
    }

    const exceptions = obj.exceptions === undefined ? [] : asStringArray(obj.exceptions, 'exceptions', 'rules');
    const strict = obj.strict === undefined ? false : obj.strict;
    if (typeof strict !== 'boolean') throw new Error('"strict" must be a boolean');

    return {
        version: ARCH_RULES_VERSION,
        edgeTypes,
        layers,
        rules,
        exceptions,
        strict,
    };
}

/**
 * Canonical serialization used by the structured editor and the template.
 * Round-trips through `parseArchRules` without losing information; `type` is
 * emitted only for slices/no-cycles (deny is the default rule kind).
 */
export function serializeArchRules(rules: ArchRules): string {
    const out = {
        version: ARCH_RULES_VERSION,
        edgeTypes: rules.edgeTypes.slice(),
        layers: rules.layers.map(layer => ({ name: layer.name, paths: layer.paths.slice() })),
        rules: rules.rules.map(rule => {
            if (rule.kind === 'deny') {
                return { id: rule.id, from: rule.from, deny: rule.deny.slice(), severity: rule.severity };
            }
            if (rule.kind === 'slices') {
                return {
                    id: rule.id,
                    type: 'slices',
                    pattern: rule.pattern,
                    shared: rule.shared.slice(),
                    severity: rule.severity,
                };
            }
            return { id: rule.id, type: 'no-cycles', severity: rule.severity };
        }),
        exceptions: rules.exceptions.slice(),
        strict: rules.strict,
    };
    return JSON.stringify(out, null, 2) + '\n';
}

/** A starter rules file inferred from top-level source folders (no rules). */
export function buildArchRulesTemplate(topFolders: string[]): string {
    const seen = new Set<string>();
    const layers: ArchLayer[] = [];
    for (const raw of topFolders) {
        const folder = normalizeArchPath(raw);
        if (!folder || folder.indexOf('/') !== -1 || seen.has(folder)) continue;
        seen.add(folder);
        layers.push({ name: folder, paths: [`src/${folder}/**`] });
        if (layers.length >= 8) break;
    }
    return serializeArchRules({
        version: ARCH_RULES_VERSION,
        edgeTypes: DEFAULT_ARCH_EDGE_TYPES.slice(),
        layers,
        rules: [],
        exceptions: [],
        strict: false,
    });
}

// ============================================================
// Baseline
// ============================================================

function baselineKey(ruleId: string, source: string, target: string): string {
    return ruleId + '\u0000' + source + '\u0000' + target;
}

/** Tolerant parse: a corrupt or missing baseline reads as empty, never throws. */
export function parseArchBaseline(raw: string | undefined | null): ArchBaseline {
    if (!raw) return { version: ARCH_RULES_VERSION, entries: [] };
    try {
        const data = JSON.parse(raw) as { entries?: unknown };
        const entriesRaw = Array.isArray(data?.entries) ? data.entries : [];
        const entries: ArchBaselineEntry[] = [];
        const seen = new Set<string>();
        for (const item of entriesRaw) {
            const rec = item as { ruleId?: unknown; source?: unknown; target?: unknown };
            if (typeof rec.ruleId !== 'string' || typeof rec.source !== 'string' || typeof rec.target !== 'string') continue;
            const key = baselineKey(rec.ruleId, rec.source, rec.target);
            if (seen.has(key)) continue;
            seen.add(key);
            entries.push({ ruleId: rec.ruleId, source: rec.source, target: rec.target });
        }
        entries.sort((a, b) => baselineKey(a.ruleId, a.source, a.target).localeCompare(baselineKey(b.ruleId, b.source, b.target)));
        return { version: ARCH_RULES_VERSION, entries };
    } catch {
        return { version: ARCH_RULES_VERSION, entries: [] };
    }
}

/** Freeze the current violations as the baseline (deterministic ordering). */
export function buildArchBaseline(evaluation: ArchEvaluation): ArchBaseline {
    const entries: ArchBaselineEntry[] = [];
    const seen = new Set<string>();
    for (const violation of evaluation.violations) {
        const key = baselineKey(violation.ruleId, violation.source, violation.target);
        if (seen.has(key)) continue;
        seen.add(key);
        entries.push({ ruleId: violation.ruleId, source: violation.source, target: violation.target });
    }
    entries.sort((a, b) => baselineKey(a.ruleId, a.source, a.target).localeCompare(baselineKey(b.ruleId, b.source, b.target)));
    return { version: ARCH_RULES_VERSION, entries };
}

export function serializeArchBaseline(baseline: ArchBaseline): string {
    return JSON.stringify({ version: ARCH_RULES_VERSION, entries: baseline.entries }, null, 2) + '\n';
}

// ============================================================
// Evaluation
// ============================================================

interface LayerMatcher {
    layer: ArchLayer;
    regexps: RegExp[];
}

interface SlicesMatcher {
    rule: ArchSlicesRule;
    regexp: RegExp;
    shared: RegExp[];
}

function linkEnds(link: ArchLinkLike): { source: string; target: string } {
    return {
        source: typeof link.source === 'string' ? link.source : link.source.id,
        target: typeof link.target === 'string' ? link.target : link.target.id,
    };
}

/** Strongly connected components (Tarjan) over the aggregated layer graph. */
function layerCycleComponents(
    adjacency: Map<string, Set<string>>,
): string[][] {
    let index = 0;
    const indices = new Map<string, number>();
    const low = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    const components: string[][] = [];

    const strongConnect = (node: string): void => {
        indices.set(node, index);
        low.set(node, index);
        index++;
        stack.push(node);
        onStack.add(node);

        for (const next of adjacency.get(node) || []) {
            if (!indices.has(next)) {
                strongConnect(next);
                low.set(node, Math.min(low.get(node)!, low.get(next)!));
            } else if (onStack.has(next)) {
                low.set(node, Math.min(low.get(node)!, indices.get(next)!));
            }
        }

        if (low.get(node) === indices.get(node)) {
            const component: string[] = [];
            let current: string;
            do {
                current = stack.pop()!;
                onStack.delete(current);
                component.push(current);
            } while (current !== node);
            if (component.length > 1) components.push(component.sort());
        }
    };

    for (const node of Array.from(adjacency.keys()).sort()) {
        if (!indices.has(node)) strongConnect(node);
    }
    return components.sort((a, b) => a.join('\u0000').localeCompare(b.join('\u0000')));
}

/**
 * Evaluate the graph against the rules. Pure: the input graph is never mutated
 * (see `applyArchitecture` for the annotations).
 */
export function evaluateArchitecture(
    graph: ArchGraphLike,
    rules: ArchRules,
    options: ArchEvaluateOptions = {},
): ArchEvaluation {
    const baseline = options.baseline || EMPTY_ARCH_BASELINE;
    const baselineKeys = new Set(
        baseline.entries.map(e => baselineKey(e.ruleId, e.source, e.target)),
    );

    const layerMatchers: LayerMatcher[] = rules.layers.map(layer => ({
        layer,
        regexps: compileGlobs(layer.paths),
    }));
    const exceptionMatchers = compileGlobs(rules.exceptions);
    const slicesMatchers: SlicesMatcher[] = [];
    for (const rule of rules.rules) {
        if (rule.kind !== 'slices') continue;
        slicesMatchers.push({
            rule,
            regexp: slicesPatternToRegExp(rule.pattern),
            shared: compileGlobs(rule.shared),
        });
    }

    const nodeById = new Map<string, ArchNodeLike>();
    const codePaths: string[] = [];
    for (const node of graph.nodes) {
        nodeById.set(node.id, node);
        if (node.language !== 'documentation') codePaths.push(normalizeArchPath(node.path || node.id));
    }
    const codePathSet = new Set(codePaths);

    const pathOfNode = (id: string): string | undefined => {
        const node = nodeById.get(id);
        if (!node || node.language === 'documentation') return undefined;
        return normalizeArchPath(node.path || node.id);
    };

    // File → layer, first match wins. Exceptions keep a file out of the model.
    const fileLayer = new Map<string, string>();
    const exempt = new Set<string>();
    for (const path of codePaths) {
        if (matchesAny(path, exceptionMatchers)) {
            exempt.add(path);
            continue;
        }
        for (const matcher of layerMatchers) {
            if (matchesAny(path, matcher.regexps)) {
                fileLayer.set(path, matcher.layer.name);
                break;
            }
        }
    }

    const allUnlayeredFiles = codePaths
        .filter(path => !exempt.has(path) && !fileLayer.has(path))
        .sort();

    const denyRules = rules.rules.filter((rule): rule is ArchDenyRule => rule.kind === 'deny');
    const edgeTypeSet = new Set(rules.edgeTypes.map(t => t.toLowerCase()));
    edgeTypeSet.delete('doc-reference');

    interface MutableViolation {
        ruleId: string;
        kind: ArchViolationKind;
        severity: ArchSeverity;
        source: string;
        target: string;
        linkType: string;
        linkTypes: string[];
        sourceGroup?: string;
        targetGroup?: string;
        sourceLayer?: string;
        targetLayer?: string;
    }
    const violationMap = new Map<string, MutableViolation>();

    const addViolation = (
        ruleId: string,
        kind: ArchViolationKind,
        severity: ArchSeverity,
        source: string,
        target: string,
        linkType: string,
        sourceGroup?: string,
        targetGroup?: string,
        sourceLayer?: string,
        targetLayer?: string,
    ): void => {
        const key = ruleId + '\u0000' + source + '\u0000' + target;
        const existing = violationMap.get(key);
        if (existing) {
            if (existing.linkTypes.indexOf(linkType) === -1) existing.linkTypes.push(linkType);
            return;
        }
        violationMap.set(key, {
            ruleId, kind, severity, source, target, linkType,
            linkTypes: [linkType], sourceGroup, targetGroup, sourceLayer, targetLayer,
        });
    };

    // Coupling counters (distinct external files) and layer adjacency.
    const caFiles = new Map<string, Set<string>>();
    const ceFiles = new Map<string, Set<string>>();
    for (const layer of rules.layers) {
        caFiles.set(layer.name, new Set());
        ceFiles.set(layer.name, new Set());
    }
    const adjacency = new Map<string, Set<string>>();
    for (const name of rules.layers.map(l => l.name)) adjacency.set(name, new Set());

    for (const link of graph.links) {
        const type = (link.type || '').toLowerCase();
        if (!edgeTypeSet.has(type)) continue;
        const { source, target } = linkEnds(link);
        if (source === target) continue;
        const sourcePath = pathOfNode(source);
        const targetPath = pathOfNode(target);
        if (!sourcePath || !targetPath || !codePathSet.has(sourcePath)) continue;
        if (exempt.has(sourcePath)) continue;

        const sourceLayer = fileLayer.get(sourcePath);
        const targetLayer = fileLayer.get(targetPath);
        const sourceGroupForRule = sourceLayer || UNLAYERED;

        if (sourceLayer && targetLayer && sourceLayer !== targetLayer) {
            const ca = caFiles.get(targetLayer);
            if (ca) {
                // Distinct external files: the source file itself.
                if (sourceLayer !== targetLayer) ca.add(sourcePath);
            }
            const ce = ceFiles.get(sourceLayer);
            if (ce) ce.add(targetPath);
            const out = adjacency.get(sourceLayer);
            if (out) out.add(targetLayer);
        }

        for (const rule of denyRules) {
            if (rule.from !== sourceGroupForRule) continue;
            const targetGroup = targetLayer || UNLAYERED;
            // `*` means any other *layer*; unlayered files stay out of the
            // model unless a rule names them explicitly.
            const denied = rule.deny.some(entry => entry === targetGroup || (entry === '*' && !!targetLayer));
            if (!denied) continue;
            if (targetLayer === sourceLayer) continue;
            addViolation(rule.id, 'deny', rule.severity, sourcePath, targetPath, type,
                sourceLayer || UNLAYERED, targetGroup, sourceLayer, targetLayer);
        }

        for (const matcher of slicesMatchers) {
            const sourceMatch = matcher.regexp.exec(sourcePath);
            const targetMatch = matcher.regexp.exec(targetPath);
            if (!sourceMatch || !targetMatch) continue;
            const sourceSlice = sourceMatch[1];
            const targetSlice = targetMatch[1];
            if (sourceSlice === targetSlice) continue;
            if (matchesAny(targetPath, matcher.shared)) continue;
            addViolation(matcher.rule.id, 'slices', matcher.rule.severity,
                sourcePath, targetPath, type, sourceSlice, targetSlice);
        }
    }

    const violations: ArchViolation[] = Array.from(violationMap.values())
        .map(v => ({
            ...v,
            linkTypes: v.linkTypes.slice().sort(),
            baselined: baselineKeys.has(baselineKey(v.ruleId, v.source, v.target)),
        }))
        .sort((a, b) => {
            const keyA = a.ruleId + '\u0000' + a.source + '\u0000' + a.target;
            const keyB = b.ruleId + '\u0000' + b.source + '\u0000' + b.target;
            return keyA.localeCompare(keyB);
        });

    const newViolations = violations.filter(v => !v.baselined);

    // Per-layer stats.
    const filesByLayer = new Map<string, number>();
    for (const layer of fileLayer.values()) {
        filesByLayer.set(layer, (filesByLayer.get(layer) || 0) + 1);
    }
    const layerStats: ArchLayerStat[] = rules.layers.map(layer => {
        const violationsForLayer = violations.filter(v => v.sourceLayer === layer.name);
        const newForLayer = violationsForLayer.filter(v => !v.baselined);
        const ca = caFiles.get(layer.name)?.size || 0;
        const ce = ceFiles.get(layer.name)?.size || 0;
        const total = ca + ce;
        return {
            name: layer.name,
            files: filesByLayer.get(layer.name) || 0,
            ca,
            ce,
            instability: total > 0 ? ce / total : null,
            violations: violationsForLayer.length,
            newViolations: newForLayer.length,
            baselined: violationsForLayer.length - newForLayer.length,
            errors: newForLayer.filter(v => v.severity === 'error').length,
            warnings: newForLayer.filter(v => v.severity === 'warn').length,
        };
    });

    // Aggregated cycles (one per no-cycles rule).
    const layerCycles: ArchCycle[] = [];
    for (const rule of rules.rules) {
        if (rule.kind !== 'no-cycles') continue;
        for (const component of layerCycleComponents(adjacency)) {
            layerCycles.push({ ruleId: rule.id, severity: rule.severity, layers: component });
        }
    }

    const baselinedCount = violations.length - newViolations.length;
    const evaluation: ArchEvaluation = {
        rules: {
            layerNames: rules.layers.map(l => l.name),
            ruleCount: rules.rules.length,
            denyCount: denyRules.length,
            slicesCount: rules.rules.filter(r => r.kind === 'slices').length,
            noCyclesCount: rules.rules.filter(r => r.kind === 'no-cycles').length,
            exceptionCount: rules.exceptions.length,
            strict: rules.strict,
            edgeTypes: rules.edgeTypes.slice(),
        },
        layers: layerStats,
        violations,
        newViolations,
        counts: {
            errors: newViolations.filter(v => v.severity === 'error').length,
            warnings: newViolations.filter(v => v.severity === 'warn').length,
            total: violations.length,
            baselined: baselinedCount,
            newTotal: newViolations.length,
            newErrors: newViolations.filter(v => v.severity === 'error').length,
            newWarnings: newViolations.filter(v => v.severity === 'warn').length,
        },
        layerCycles,
        unlayeredFiles: allUnlayeredFiles.slice(0, 500),
        unlayeredTotal: allUnlayeredFiles.length,
        configured: rules.layers.length > 0 && rules.rules.length > 0,
    };

    return evaluation;
}

/**
 * Copy the evaluation onto the graph nodes and links:
 *   - `node.layer`
 *   - `node.archViolations` = number of NEW violations where the file is the source
 *   - `link.archViolation` = strongest violation between the pair (if any)
 *
 * Stale annotations are cleared first, so removing a rule or a layer from the
 * config never leaves red edges behind.
 */
export function applyArchitecture(
    nodes: ArchNodeLike[],
    links: ArchLinkLike[],
    evaluation: ArchEvaluation,
    rules?: ArchRules,
): void {
    if (rules) applyLayerAssignments(nodes, rules);

    const newCountByPath = new Map<string, number>();
    for (const violation of evaluation.newViolations) {
        newCountByPath.set(violation.source, (newCountByPath.get(violation.source) || 0) + 1);
    }

    for (const node of nodes) {
        if (node.language === 'documentation') {
            delete node.layer;
            delete node.archViolations;
            continue;
        }
        const path = normalizeArchPath(node.path || node.id);
        const count = newCountByPath.get(path);
        if (count) node.archViolations = count;
        else delete node.archViolations;
    }

    const bestByPair = new Map<string, ArchLinkViolation>();
    const severityRank: Record<ArchSeverity, number> = { warn: 1, error: 2 };
    for (const violation of evaluation.violations) {
        const key = violation.source + '\u0000' + violation.target;
        const candidate: ArchLinkViolation = {
            ruleId: violation.ruleId,
            severity: violation.severity,
            baselined: violation.baselined,
            linkTypes: violation.linkTypes,
        };
        const previous = bestByPair.get(key);
        if (!previous) {
            bestByPair.set(key, candidate);
            continue;
        }
        // Prefer a non-baselined violation, then the highest severity.
        if (previous.baselined && !candidate.baselined) {
            bestByPair.set(key, candidate);
        } else if (previous.baselined === candidate.baselined &&
            severityRank[candidate.severity] > severityRank[previous.severity]) {
            bestByPair.set(key, candidate);
        }
    }

    for (const link of links) {
        const { source, target } = linkEnds(link);
        const best = bestByPair.get(source + '\u0000' + target);
        const type = (link.type || '').toLowerCase();
        // Only the edge types the rule evaluated turn red: a doc-reference
        // link between the same pair must stay outside the model.
        const applies = !!best && (!type || !best.linkTypes || best.linkTypes.indexOf(type) !== -1);
        if (applies && best) link.archViolation = { ...best };
        else delete link.archViolation;
    }
}

/**
 * Assign `node.layer` from the rules. Kept separate from `applyArchitecture`
 * because the evaluation does not carry the full file → layer map.
 */
export function applyLayerAssignments(
    nodes: ArchNodeLike[],
    rules: ArchRules,
): void {
    const exceptionMatchers = compileGlobs(rules.exceptions);
    const layerMatchers: LayerMatcher[] = rules.layers.map(layer => ({
        layer,
        regexps: compileGlobs(layer.paths),
    }));
    for (const node of nodes) {
        if (node.language === 'documentation') {
            delete node.layer;
            continue;
        }
        const path = normalizeArchPath(node.path || node.id);
        if (matchesAny(path, exceptionMatchers)) {
            delete node.layer;
            continue;
        }
        let assigned: string | undefined;
        for (const matcher of layerMatchers) {
            if (matchesAny(path, matcher.regexps)) {
                assigned = matcher.layer.name;
                break;
            }
        }
        if (assigned) node.layer = assigned;
        else delete node.layer;
    }
}
