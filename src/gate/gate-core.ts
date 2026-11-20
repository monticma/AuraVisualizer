/**
 * gate-core.ts — transformer les règles en verdict (lot 4).
 *
 * Aura savait détecter : violations de couche, cycles, exports morts, budgets de
 * complexité. Il ne savait pas **refuser**. Ce module rend le verdict — et rien
 * d'autre : il est pur, sans disque ni base, pour que la CI, l'outil MCP et la
 * commande VS Code répondent tous la même chose.
 *
 * Trois principes, appris en mesurant sur Aura lui-même :
 *
 *  1. **Le ratchet, pas la barre absolue.** Aura porte 406 exports morts et 21
 *     cycles. Un gate à seuil fixe est rouge le premier jour, donc il est
 *     désactivé, donc il ne sert à rien. On gèle l'existant dans une baseline et
 *     on n'échoue que sur du **nouveau** : c'est le modèle du rapport de
 *     résolution — admettre la dette, refuser son augmentation.
 *  2. **La portée décide de tout.** `out/` est versionné dans ce dépôt et `docs/`
 *     contient des Markdown : un budget brut attrape des bundles générés. La
 *     portée par défaut est donc le code, la documentation exclue.
 *  3. **Un verdict périmé n'est pas un verdict.** Une base analysée il y a deux
 *     jours, ou réécrite pendant la lecture, ne peut pas fonder un refus : le
 *     gate refuse alors de conclure, avec un code de sortie distinct (2) de
 *     l'échec de règle (1).
 */

import { globToRegExp } from '../arch/arch-core';

export const GATE_CONFIG_FILE = '.aura/gate.json';
export const GATE_BASELINE_FILE = '.aura/gate-baseline.json';
export const GATE_CONFIG_VERSION = 1;

/** Métriques qu'un budget peut viser (celles qu'un nœud porte réellement). */
export const GATE_METRICS = ['complexity', 'cognitive', 'fanIn', 'fanOut', 'linesOfCode'] as const;
export type GateMetric = (typeof GATE_METRICS)[number];

/** Compteurs globaux qu'un gate peut plafonner. */
export const GATE_COUNTS = ['fileCycles', 'symbolCycles', 'deadExports', 'unresolvedRatio'] as const;
export type GateCount = (typeof GATE_COUNTS)[number];

export interface GateConfig {
    version: number;
    /** Globs inclus (défaut : tout le code analysé). */
    include: string[];
    /** Globs exclus (défaut : documentation, `out/`, `dist/`, `node_modules/`). */
    exclude: string[];
    /** Plafond par fichier, par métrique. */
    budgets: Partial<Record<GateMetric, number>>;
    /** Plafonds globaux (ratchet via la baseline). */
    counts: Partial<Record<GateCount, number>>;
    /** Évaluer les règles de couche (`.aura/arch-rules.json`). */
    architecture: boolean;
    /** Refuser de conclure sur une analyse périmée (défaut true). */
    failOnStale: boolean;
}

export const DEFAULT_GATE_CONFIG: GateConfig = {
    version: GATE_CONFIG_VERSION,
    include: [],
    exclude: ['docs/**', '**/*.md', 'out/**', 'dist/**', 'node_modules/**', '**/*.d.ts'],
    budgets: {},
    counts: {},
    architecture: true,
    failOnStale: true,
};

// ── Chargement ─────────────────────────────────────────────────

export interface GateConfigParseResult {
    config: GateConfig;
    /** Messages d'erreur : une config invalide est un code de sortie 2. */
    errors: string[];
    /** Le fichier était absent — on tourne avec les défauts, et on le dit. */
    missing: boolean;
}

function asIntLimit(value: unknown): number | undefined {
    if (typeof value !== 'number' || !isFinite(value)) return undefined;
    // Une limite négative n'est pas une limite : on refuse plutôt que de
    // corriger en silence (un gate qui adoucit sa propre config ment).
    if (value < 0) return undefined;
    return Math.floor(value);
}

/** Copie profonde des parties mutables : les défauts ne doivent jamais bouger. */
function cloneConfig(config: GateConfig): GateConfig {
    return {
        ...config,
        include: [...config.include],
        exclude: [...config.exclude],
        budgets: { ...config.budgets },
        counts: { ...config.counts },
    };
}

/**
 * Parse `.aura/gate.json`. Tolérant sur l'inconnu (une clé qu'on ne comprend pas
 * est ignorée), strict sur l'absurde (une limite négative, un type faux).
 */
export function parseGateConfig(text: string | undefined | null): GateConfigParseResult {
    const errors: string[] = [];
    if (!text || !text.trim()) {
        return { config: cloneConfig(DEFAULT_GATE_CONFIG), errors, missing: true };
    }
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch (err) {
        return {
            config: cloneConfig(DEFAULT_GATE_CONFIG),
            errors: [`${GATE_CONFIG_FILE}: JSON invalide — ${err instanceof Error ? err.message : String(err)}`],
            missing: false,
        };
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return { config: cloneConfig(DEFAULT_GATE_CONFIG), errors: [`${GATE_CONFIG_FILE}: un objet est attendu`], missing: false };
    }
    const source = raw as Record<string, unknown>;
    const config: GateConfig = cloneConfig(DEFAULT_GATE_CONFIG);

    if (source.version !== undefined) {
        const version = asIntLimit(source.version);
        if (version === undefined || version < 1) errors.push(`${GATE_CONFIG_FILE}: "version" doit être un entier ≥ 1`);
        else config.version = version;
    }

    const strings = (value: unknown, key: string): string[] => {
        if (value === undefined) return [];
        if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
            errors.push(`${GATE_CONFIG_FILE}: "${key}" doit être un tableau de chaînes`);
            return [];
        }
        return value as string[];
    };
    config.include = strings(source.include, 'include');
    if (source.exclude !== undefined) config.exclude = strings(source.exclude, 'exclude');

    if (source.budgets !== undefined) {
        if (!source.budgets || typeof source.budgets !== 'object' || Array.isArray(source.budgets)) {
            errors.push(`${GATE_CONFIG_FILE}: "budgets" doit être un objet`);
        } else {
            for (const [metric, value] of Object.entries(source.budgets as Record<string, unknown>)) {
                if (!(GATE_METRICS as readonly string[]).includes(metric)) {
                    errors.push(`${GATE_CONFIG_FILE}: budget inconnu "${metric}" (attendu : ${GATE_METRICS.join(', ')})`);
                    continue;
                }
                const limit = asIntLimit(value);
                if (limit === undefined) errors.push(`${GATE_CONFIG_FILE}: budget "${metric}" doit être un entier ≥ 0`);
                else config.budgets[metric as GateMetric] = limit;
            }
        }
    }

    if (source.counts !== undefined) {
        if (!source.counts || typeof source.counts !== 'object' || Array.isArray(source.counts)) {
            errors.push(`${GATE_CONFIG_FILE}: "counts" doit être un objet`);
        } else {
            for (const [key, value] of Object.entries(source.counts as Record<string, unknown>)) {
                if (!(GATE_COUNTS as readonly string[]).includes(key)) {
                    errors.push(`${GATE_CONFIG_FILE}: compteur inconnu "${key}" (attendu : ${GATE_COUNTS.join(', ')})`);
                    continue;
                }
                if (key === 'unresolvedRatio') {
                    if (typeof value !== 'number' || !isFinite(value) || value < 0 || value > 1) {
                        errors.push(`${GATE_CONFIG_FILE}: "unresolvedRatio" est un ratio entre 0 et 1`);
                        continue;
                    }
                    config.counts.unresolvedRatio = value;
                    continue;
                }
                const limit = asIntLimit(value);
                if (limit === undefined) errors.push(`${GATE_CONFIG_FILE}: compteur "${key}" doit être un entier ≥ 0`);
                else config.counts[key as GateCount] = limit;
            }
        }
    }

    if (source.architecture !== undefined) {
        if (typeof source.architecture !== 'boolean') errors.push(`${GATE_CONFIG_FILE}: "architecture" doit être un booléen`);
        else config.architecture = source.architecture;
    }
    if (source.failOnStale !== undefined) {
        if (typeof source.failOnStale !== 'boolean') errors.push(`${GATE_CONFIG_FILE}: "failOnStale" doit être un booléen`);
        else config.failOnStale = source.failOnStale;
    }

    return { config, errors, missing: false };
}

// ── Baseline (le ratchet) ──────────────────────────────────────

export interface GateBaseline {
    version: number;
    /** Valeur gelée de chaque compteur global au moment du gel. */
    counts: Partial<Record<GateCount, number>>;
    /** Valeur gelée des dépassements de budget, par fichier et par métrique. */
    budgets: Record<string, Partial<Record<GateMetric, number>>>;
    /** Horodatage du gel, pour savoir de quand date la dette acceptée. */
    frozenAt?: string;
}

export const EMPTY_GATE_BASELINE: GateBaseline = { version: GATE_CONFIG_VERSION, counts: {}, budgets: {} };

export function parseGateBaseline(text: string | undefined | null): GateBaseline {
    if (!text || !text.trim()) return { version: GATE_CONFIG_VERSION, counts: {}, budgets: {} };
    try {
        const raw = JSON.parse(text) as Partial<GateBaseline>;
        if (!raw || typeof raw !== 'object') return { version: GATE_CONFIG_VERSION, counts: {}, budgets: {} };
        const counts: Partial<Record<GateCount, number>> = {};
        for (const key of GATE_COUNTS) {
            const rawValue = (raw.counts || {})[key];
            if (key === 'unresolvedRatio') {
                // Un ratio n'est pas un entier : le floor à l'ancienne ramenait
                // 8,8 % à 0 et le ratchet ne gelait plus rien.
                if (typeof rawValue === 'number' && isFinite(rawValue) && rawValue >= 0 && rawValue <= 1) {
                    counts.unresolvedRatio = rawValue;
                }
                continue;
            }
            const value = asIntLimit(rawValue);
            if (value !== undefined) counts[key] = value;
        }
        const budgets: Record<string, Partial<Record<GateMetric, number>>> = {};
        if (raw.budgets && typeof raw.budgets === 'object') {
            for (const [file, metrics] of Object.entries(raw.budgets)) {
                if (!metrics || typeof metrics !== 'object') continue;
                const entry: Partial<Record<GateMetric, number>> = {};
                for (const metric of GATE_METRICS) {
                    const value = asIntLimit((metrics as Record<string, unknown>)[metric]);
                    if (value !== undefined) entry[metric] = value;
                }
                if (Object.keys(entry).length > 0) budgets[file] = entry;
            }
        }
        return {
            version: asIntLimit(raw.version) ?? GATE_CONFIG_VERSION,
            counts,
            budgets,
            ...(typeof raw.frozenAt === 'string' ? { frozenAt: raw.frozenAt } : {}),
        };
    } catch {
        return { version: GATE_CONFIG_VERSION, counts: {}, budgets: {} };
    }
}

// ── Verdict ────────────────────────────────────────────────────

export type GateFailureKind = 'budget' | 'count' | 'cycle' | 'dead-export' | 'architecture' | 'resolution' | 'stale';

export interface GateFailure {
    kind: GateFailureKind;
    /** Fichier concerné, quand il y en a un. */
    file?: string;
    metric?: string;
    value: number;
    limit: number;
    /** Règle lisible : `budget cognitive ≤ 40`, `fileCycles ≤ 0`… */
    rule: string;
    detail?: string;
    /** `fichier:ligne`, prêt à citer. */
    anchor?: string;
    /** Vrai quand la baseline a absorbé ce dépassement (informatif). */
    baselined?: boolean;
}

export interface GateNode {
    id: string;
    language: string;
    complexity?: number;
    cognitive?: number;
    fanIn?: number;
    fanOut?: number;
    linesOfCode?: number;
}

export interface GateInput {
    nodes: readonly GateNode[];
    /** Exports morts par fichier (pour cibler le fichier, pas seulement le total). */
    deadExportsByFile?: Record<string, number>;
    /** Cycles de fichiers — chaque cycle est une liste de chemins. */
    fileCycles?: readonly (readonly string[])[];
    symbolCycles?: number;
    /** Résolution : relations tentées et non résolues (rapport du lot 1). */
    resolution?: { attempts: number; unresolved: number };
    /** Nouvelles violations de couche (baseline d'architecture déjà appliquée). */
    architecture?: {
        configured: boolean;
        newViolations: readonly { ruleId: string; kind: string; source: string; target: string; severity: string }[];
    };
    /** Fraîcheur de l'analyse. `stale: null` = indécidable. */
    status?: { stale: boolean | null; reason: string };
    /** Fichiers touchés : le gate ne juge qu'eux. Absent = tout. */
    changedFiles?: readonly string[] | null;
}

export interface GateVerdict {
    ok: boolean;
    /** 0 = ok · 1 = échec de règle · 2 = configuration ou fraîcheur. */
    code: 0 | 1 | 2;
    failures: GateFailure[];
    /** Échecs absorbés par la baseline — visibles, mais ils ne bloquent pas. */
    baselined: GateFailure[];
    summary: string;
    scope: 'all' | 'changed';
    checked: { files: number; budgets: number; counts: number; architecture: boolean };
    /** Bilans utiles au rapport et à la baseline. */
    totals: { fileCycles: number; symbolCycles: number; deadExports: number; unresolvedRatio: number };
}

function metricValue(node: GateNode, metric: GateMetric): number {
    switch (metric) {
        case 'complexity': return node.complexity ?? 0;
        case 'cognitive': return node.cognitive ?? 0;
        case 'fanIn': return node.fanIn ?? 0;
        case 'fanOut': return node.fanOut ?? 0;
        case 'linesOfCode': return node.linesOfCode ?? 0;
    }
}

/** Portée : `include` (vide = tout) puis `exclude`, sur des globs. */
export function inGateScope(file: string, config: GateConfig): boolean {
    const normalized = String(file || '').replace(/\\/g, '/');
    if (config.include.length > 0 && !config.include.some(pattern => globToRegExp(pattern).test(normalized))) {
        return false;
    }
    return !config.exclude.some(pattern => globToRegExp(pattern).test(normalized));
}

function formatRatio(value: number): string {
    return `${Math.round(value * 1000) / 10}%`;
}

/**
 * Le verdict.
 *
 * Ordre : configuration/fraîcheur d'abord (code 2 — on ne juge pas), puis les
 * règles (code 1). Les dépassements déjà couverts par la baseline sont renvoyés
 * à part : un gate qui les masquerait mentirait sur ce qu'il voit.
 */
export function evaluateGate(input: GateInput, config: GateConfig, baseline: GateBaseline = EMPTY_GATE_BASELINE): GateVerdict {
    const changed = input.changedFiles ? new Set(input.changedFiles.map(f => f.replace(/\\/g, '/'))) : null;
    const scope: 'all' | 'changed' = changed ? 'changed' : 'all';
    const inScope = (file: string): boolean =>
        inGateScope(file, config) && (!changed || changed.has(file));

    const files = input.nodes.filter(node => inScope(node.id));
    const deadByFile = input.deadExportsByFile || {};
    const deadExports = files.reduce((sum, node) => sum + (deadByFile[node.id] ?? 0), 0);
    const fileCyclesInScope = (input.fileCycles ?? []).filter(cycle => cycle.some(file => inScope(file)));
    const symbolCycles = input.symbolCycles ?? 0;
    const attempts = input.resolution?.attempts ?? 0;
    const unresolved = input.resolution?.unresolved ?? 0;
    const unresolvedRatio = attempts > 0 ? unresolved / attempts : 0;

    const failures: GateFailure[] = [];
    const baselined: GateFailure[] = [];

    // 1. Fraîcheur — avant tout le reste : un verdict périmé n'est pas un verdict.
    if (config.failOnStale && input.status && input.status.stale !== false) {
        failures.push({
            kind: 'stale',
            value: input.status.stale === true ? 1 : 0,
            limit: 0,
            rule: 'analysis must be up to date',
            detail: input.status.reason,
        });
        return {
            ok: false,
            code: 2,
            failures,
            baselined,
            summary: `Gate refusé : ${input.status.reason}.`,
            scope,
            checked: { files: files.length, budgets: Object.keys(config.budgets).length, counts: Object.keys(config.counts).length, architecture: config.architecture },
            totals: { fileCycles: fileCyclesInScope.length, symbolCycles, deadExports, unresolvedRatio },
        };
    }

    // 2. Budgets par fichier — avec la valeur gelée comme plafond effectif.
    for (const [metricKey, limit] of Object.entries(config.budgets) as [GateMetric, number][]) {
        for (const node of files) {
            const value = metricValue(node, metricKey);
            if (value <= limit) continue;
            const frozen = baseline.budgets[node.id]?.[metricKey] ?? 0;
            const failure: GateFailure = {
                kind: 'budget',
                file: node.id,
                metric: metricKey,
                value,
                limit,
                rule: `budget ${metricKey} ≤ ${limit}`,
                ...(frozen > 0 ? { baselined: value <= frozen } : {}),
            };
            if (value <= frozen) baselined.push(failure);
            else failures.push(failure);
        }
    }

    // 3. Compteurs globaux — ratchet : on n'échoue qu'au-dessus du gel.
    const countRules: { key: GateCount; value: number; limit: number; rule: string }[] = [];
    const push = (key: GateCount, value: number, asRatio = false) => {
        const limit = config.counts[key];
        if (limit === undefined) return;
        countRules.push({
            key,
            value,
            limit,
            rule: asRatio ? `${key} ≤ ${formatRatio(limit)}` : `${key} ≤ ${limit}`,
        });
    };
    push('fileCycles', fileCyclesInScope.length);
    push('symbolCycles', symbolCycles);
    push('deadExports', deadExports);
    push('unresolvedRatio', unresolvedRatio, true);

    for (const entry of countRules) {
        const frozen = baseline.counts[entry.key];
        const effective = Math.max(entry.limit, frozen ?? 0);
        if (entry.value <= effective) continue;
        const shown = entry.key === 'unresolvedRatio' ? formatRatio(effective) : String(effective);
        const configured = entry.key === 'unresolvedRatio' ? formatRatio(entry.limit) : String(entry.limit);
        const failure: GateFailure = {
            kind: entry.key === 'unresolvedRatio' ? 'resolution' : (entry.key === 'deadExports' ? 'dead-export' : 'count'),
            metric: entry.key,
            value: entry.value,
            limit: effective,
            // La règle affiche la limite **effective** : celle qui bloque vraiment.
            rule: frozen !== undefined && frozen > entry.limit
                ? `${entry.key} ≤ ${shown} (baseline, config ${configured})`
                : entry.rule,
            ...(frozen !== undefined && frozen > entry.limit
                ? { detail: `baseline gelée à ${shown}` }
                : {}),
        };
        failures.push(failure);
    }

    // 4. Architecture — la baseline de couche est déjà appliquée par l'appelant.
    let architectureChecked = false;
    if (config.architecture && input.architecture?.configured) {
        architectureChecked = true;
        for (const violation of input.architecture.newViolations) {
            failures.push({
                kind: 'architecture',
                file: violation.source,
                metric: violation.kind,
                value: 1,
                limit: 0,
                rule: `${violation.ruleId} (${violation.severity})`,
                detail: `${violation.source} → ${violation.target}`,
                anchor: violation.source,
            });
        }
    }

    const ok = failures.length === 0;
    const summary = ok
        ? `Gate vert — ${files.length} fichier(s) dans le périmètre${baselined.length ? `, ${baselined.length} dépassement(s) absorbé(s) par la baseline` : ''}.`
        : `Gate rouge — ${failures.length} échec(s) : ${describeFailures(failures)}.`;

    return {
        ok,
        code: ok ? 0 : 1,
        failures,
        baselined,
        summary,
        scope,
        checked: {
            files: files.length,
            budgets: Object.keys(config.budgets).length,
            counts: Object.keys(config.counts).length,
            architecture: architectureChecked,
        },
        totals: { fileCycles: fileCyclesInScope.length, symbolCycles, deadExports, unresolvedRatio },
    };
}

function describeFailures(failures: readonly GateFailure[]): string {
    const byKind = new Map<string, number>();
    for (const failure of failures) byKind.set(failure.kind, (byKind.get(failure.kind) ?? 0) + 1);
    return [...byKind.entries()].map(([kind, count]) => `${count} ${kind}`).join(', ');
}

/**
 * Nouvelle baseline : les compteurs courants et les dépassements courants,
 * gelés. C'est ce que `--update-baseline` écrit — jamais automatique, parce que
 * geler la dette est une décision, pas un effet de bord.
 */
export function freezeBaseline(input: GateInput, config: GateConfig, now: string = new Date().toISOString()): GateBaseline {
    const files = input.nodes.filter(node => inGateScope(node.id, config));
    const deadByFile = input.deadExportsByFile || {};
    const budgets: Record<string, Partial<Record<GateMetric, number>>> = {};
    for (const [metricKey, limit] of Object.entries(config.budgets) as [GateMetric, number][]) {
        for (const node of files) {
            const value = metricValue(node, metricKey);
            if (value <= limit) continue;
            budgets[node.id] = { ...(budgets[node.id] ?? {}), [metricKey]: value };
        }
    }
    const fileCycles = (input.fileCycles ?? []).filter(cycle => cycle.some(file => inGateScope(file, config)));
    const attempts = input.resolution?.attempts ?? 0;
    const unresolved = input.resolution?.unresolved ?? 0;
    const counts: Partial<Record<GateCount, number>> = {
        fileCycles: fileCycles.length,
        symbolCycles: input.symbolCycles ?? 0,
        deadExports: files.reduce((sum, node) => sum + (deadByFile[node.id] ?? 0), 0),
        unresolvedRatio: attempts > 0 ? unresolved / attempts : 0,
    };
    // On ne gèle que ce que le fichier de config demande : une baseline qui
    // contient des clés non surveillées dérive sans que personne ne le voie.
    const kept: Partial<Record<GateCount, number>> = {};
    for (const key of GATE_COUNTS) {
        if (config.counts[key] !== undefined && counts[key] !== undefined) kept[key] = counts[key];
    }
    return { version: GATE_CONFIG_VERSION, counts: kept, budgets, frozenAt: now };
}

/** Rapport Markdown prêt pour une pull request. */
export function gateMarkdown(verdict: GateVerdict, title = 'Aura Gate'): string {
    const lines: string[] = [];
    lines.push(`## ${verdict.ok ? '✅' : '❌'} ${title}`);
    lines.push('');
    lines.push(verdict.summary);
    lines.push('');
    if (verdict.failures.length > 0) {
        lines.push('| Règle | Fichier | Valeur | Limite |');
        lines.push('|---|---|---|---|');
        for (const failure of verdict.failures.slice(0, 50)) {
            const target = failure.file ?? failure.metric ?? '—';
            lines.push(`| ${failure.rule} | ${failure.file ? `\`${failure.file}\`` : target} | ${failure.value} | ${failure.limit} |`);
        }
        if (verdict.failures.length > 50) lines.push(`| … ${verdict.failures.length - 50} de plus | | | |`);
        lines.push('');
    }
    if (verdict.baselined.length > 0) {
        lines.push(`_${verdict.baselined.length} dépassement(s) déjà gelé(s) dans la baseline — visibles, non bloquants._`);
        lines.push('');
    }
    lines.push(`Périmètre : ${verdict.scope === 'changed' ? 'fichiers modifiés' : 'tout le dépôt'} · ${verdict.checked.files} fichier(s) · cycles ${verdict.totals.fileCycles} · exports morts ${verdict.totals.deadExports} · non résolu ${formatRatio(verdict.totals.unresolvedRatio)}`);
    lines.push('');
    return lines.join('\n');
}
