/**
 * gate-run.ts — le gate appliqué à une base réelle.
 *
 * Une seule implémentation : la CLI (`out/gate.js`), l'outil MCP `gate` et la
 * commande VS Code réunissent le même `GateInput` et appellent le même
 * `evaluateGate`. Ce module fait la collecte — c'est lui qui touche au disque,
 * à la base et à git — et rien de plus.
 */

import fs from 'fs';
import path from 'path';
import type { GraphDB } from '../graph-db';
import { evaluateArchitecture, parseArchBaseline, parseArchRules, ARCH_BASELINE_FILE, ARCH_RULES_FILE } from '../arch/arch-core';
import { buildStatusPayload } from '../ai/tool-core';
import { readBranchDiff } from '../git/branch-diff';
import { readCurrentHead } from '../git/git-info';
import type { ResolutionReport } from '../analysis/resolution';
import {
    EMPTY_GATE_BASELINE,
    GATE_BASELINE_FILE,
    GATE_CONFIG_FILE,
    evaluateGate,
    freezeBaseline,
    parseGateBaseline,
    parseGateConfig,
    type GateBaseline,
    type GateInput,
    type GateVerdict,
} from './gate-core';

export interface GateRunOptions {
    /** Racine du dépôt (là où vit `.aura/`). */
    root: string;
    /** Référence à comparer : ne juger que les fichiers modifiés depuis. */
    base?: string;
    /** Juge même si l'analyse ne correspond plus au checkout. */
    allowStale?: boolean;
    /** Horodatage injectable (tests). */
    now?: number;
}

function readTextFile(file: string): string | undefined {
    try { return fs.readFileSync(file, 'utf8'); } catch { return undefined; }
}

/** Ce qui a été lu sur disque — utile pour expliquer un code de sortie 2. */
export interface GateContext {
    verdict: GateVerdict;
    configMissing: boolean;
    changedFiles: string[] | null;
}

/**
 * Collecte l'entrée du gate depuis `graph.db`, puis rend le verdict.
 *
 * Deux précautions qui viennent de la mesure :
 *  - la base peut être **périmée** (elle datait de deux jours) ou **en cours de
 *    réécriture** par l'éditeur : la fraîcheur est vérifiée avant tout, et un
 *    verdict non fiable sort en code 2 ;
 *  - les fichiers touchés viennent du diff git, jamais d'une supposition.
 */
export async function runGate(db: GraphDB, options: GateRunOptions): Promise<GateContext> {
    const root = path.resolve(options.root);
    const configText = readTextFile(path.join(root, GATE_CONFIG_FILE));
    const parsedConfig = parseGateConfig(configText);
    if (parsedConfig.errors.length > 0) {
        return {
            verdict: {
                ok: false,
                code: 2,
                failures: parsedConfig.errors.map(error => ({
                    kind: 'stale' as const,
                    value: 1,
                    limit: 0,
                    rule: 'configuration invalide',
                    detail: error,
                })),
                baselined: [],
                summary: `Gate refusé : configuration invalide — ${parsedConfig.errors[0]}`,
                scope: options.base ? 'changed' : 'all',
                checked: { files: 0, budgets: 0, counts: 0, architecture: false },
                totals: { fileCycles: 0, symbolCycles: 0, deadExports: 0, unresolvedRatio: 0 },
            },
            configMissing: false,
            changedFiles: null,
        };
    }
    const config = parsedConfig.config;
    if (options.allowStale) config.failOnStale = false;
    const baselineText = readTextFile(path.join(root, GATE_BASELINE_FILE));
    const baseline: GateBaseline = parseGateBaseline(baselineText);

    const graph = db.exportGraphData();
    if (!graph) {
        return {
            verdict: {
                ok: false,
                code: 2,
                failures: [{ kind: 'stale', value: 1, limit: 0, rule: 'aucune analyse', detail: 'la base ne contient aucun graphe — lancez « Aura: Visualize Codebase »' }],
                baselined: [],
                summary: 'Gate refusé : aucune analyse dans .aura/graph.db.',
                scope: options.base ? 'changed' : 'all',
                checked: { files: 0, budgets: 0, counts: 0, architecture: false },
                totals: { fileCycles: 0, symbolCycles: 0, deadExports: 0, unresolvedRatio: 0 },
            },
            configMissing: parsedConfig.missing,
            changedFiles: null,
        };
    }

    // Fraîcheur : `build` compare le commit analysé au HEAD courant.
    let currentHead: string | null = null;
    try { currentHead = await readCurrentHead(root); } catch { currentHead = null; }
    const status = buildStatusPayload({
        meta: {
            analyzedAt: db.getMeta('analyzedAt'),
            head: db.getMeta('head'),
            totalFiles: db.getMeta('totalFiles'),
            totalLinks: db.getMeta('totalLinks'),
        },
        currentHead,
        ...(typeof options.now === 'number' ? { now: options.now } : {}),
    });

    // Compteurs : cycles, exports morts par fichier, résolution.
    const fileCycles = db.getCycles();
    const symbolCycles = db.getSymbolCycles();
    const deadByFile: Record<string, number> = {};
    for (const dead of db.getDeadCode()) {
        deadByFile[dead.nodeId] = (deadByFile[dead.nodeId] ?? 0) + 1;
    }
    let resolution: { attempts: number; unresolved: number } | undefined;
    const resolutionMeta = db.getMeta('resolution');
    if (resolutionMeta) {
        try {
            const report = JSON.parse(resolutionMeta) as ResolutionReport;
            if (report && report.totals) {
                resolution = { attempts: report.totals.attempts, unresolved: report.totals.unresolved };
            }
        } catch { /* rapport illisible : on n'invente pas de ratio */ }
    }

    // Architecture : règles + baseline de couche (mécanisme existant).
    let architecture: GateInput['architecture'];
    const rulesText = readTextFile(path.join(root, ARCH_RULES_FILE));
    if (rulesText) {
        try {
            const rules = parseArchRules(rulesText);
            const archBaseline = parseArchBaseline(readTextFile(path.join(root, ARCH_BASELINE_FILE)));
            const evaluation = evaluateArchitecture(graph, rules, { baseline: archBaseline });
            architecture = {
                configured: evaluation.configured,
                newViolations: evaluation.newViolations.map(violation => ({
                    ruleId: violation.ruleId,
                    kind: violation.kind,
                    source: violation.source,
                    target: violation.target,
                    severity: violation.severity,
                })),
            };
        } catch {
            // Règles illisibles : on ne fait pas échouer le gate pour autant,
            // mais l'appelant verra `architecture: false` dans `checked`.
            architecture = { configured: false, newViolations: [] };
        }
    }

    // Périmètre delta : les fichiers du diff, quand une base est demandée.
    let changedFiles: string[] | null = null;
    if (options.base) {
        try {
            const diff = await readBranchDiff(root, options.base);
            changedFiles = diff.files
                .filter(file => file.status !== 'deleted')
                .flatMap(file => (file.oldPath ? [file.path, file.oldPath] : [file.path]));
        } catch {
            changedFiles = [];
        }
    }

    const input: GateInput = {
        nodes: graph.nodes.map(node => ({
            id: node.id,
            language: node.language,
            complexity: node.complexity,
            cognitive: node.cognitive ?? 0,
            fanIn: node.fanIn,
            fanOut: node.fanOut,
            linesOfCode: node.linesOfCode,
        })),
        deadExportsByFile: deadByFile,
        fileCycles,
        symbolCycles: symbolCycles.length,
        ...(resolution ? { resolution } : {}),
        ...(architecture ? { architecture } : {}),
        status: { stale: status.stale, reason: status.reason },
        ...(changedFiles ? { changedFiles } : {}),
    };

    return {
        verdict: evaluateGate(input, config, baseline),
        configMissing: parsedConfig.missing,
        changedFiles,
    };
}

/**
 * Écrit la baseline : gèle la dette courante. Seulement sur demande explicite
 * (`--update-baseline`) — geler est une décision, pas un effet de bord.
 */
export async function writeGateBaseline(db: GraphDB, options: GateRunOptions): Promise<{ file: string; baseline: GateBaseline } | null> {
    const root = path.resolve(options.root);
    const config = parseGateConfig(readTextFile(path.join(root, GATE_CONFIG_FILE))).config;
    const graph = db.exportGraphData();
    if (!graph) return null;
    const deadByFile: Record<string, number> = {};
    for (const dead of db.getDeadCode()) deadByFile[dead.nodeId] = (deadByFile[dead.nodeId] ?? 0) + 1;
    const resolutionMeta = db.getMeta('resolution');
    let resolution: { attempts: number; unresolved: number } | undefined;
    if (resolutionMeta) {
        try {
            const report = JSON.parse(resolutionMeta) as ResolutionReport;
            if (report?.totals) resolution = { attempts: report.totals.attempts, unresolved: report.totals.unresolved };
        } catch { /* ignore */ }
    }
    const baseline = freezeBaseline({
        nodes: graph.nodes.map(node => ({
            id: node.id,
            language: node.language,
            complexity: node.complexity,
            cognitive: node.cognitive ?? 0,
            fanIn: node.fanIn,
            fanOut: node.fanOut,
            linesOfCode: node.linesOfCode,
        })),
        deadExportsByFile: deadByFile,
        fileCycles: db.getCycles(),
        symbolCycles: db.getSymbolCycles().length,
        ...(resolution ? { resolution } : {}),
    }, config);
    const file = path.join(root, GATE_BASELINE_FILE);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
    return { file, baseline };
}
