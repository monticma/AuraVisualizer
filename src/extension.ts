/**
 * extension.ts — Main entry point for the AuraVisualizer extension.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { Worker } from 'worker_threads';
import { WebviewProvider } from './webview/WebviewProvider';
import { AuraTreeProvider } from './AuraTreeProvider';
import { analyzeCodebase, scanSingleFile, scanFileSignatures, buildGraph, preParseFiles, rebuildSingleFile, buildIncrementalContext, restoreIncrementalContext, type GraphData, type GraphNode, type GraphLink, type FileInfo, type IncrementalContext, type ParseFailure } from './analyzer/index';
import { isGitRepo, getGitRoot, getGitHead, getWorkingTreeFiles, type GitFileState } from './analyzer/git-history';
import { computeFingerprint, fingerprintFromMeta, fingerprintMetaEntries, hashAnalysisConfig, planAnalysis, type AnalysisFingerprint } from './analyzer/fingerprint';
import type { CommitIndex, CommitDelta } from './analyzer/types';
import { normalizeRiskWindow } from './risk/risk-core';
import { buildRiskSnapshot, type RiskSnapshot, type RiskFileEntry } from './risk/risk-service';
import { GraphDB } from './graph-db';
import { registerAuraLmTools } from './lm-tools';
import { registerAuraChatParticipant } from './chat/participant';
import { registerNavigationCommands } from './commands/navigation';
import { collectBlastTargets } from './commands/blast-targets';
import { registerPaletteCommands } from './commands/palette';
import { AuraHoverProvider } from './hover';
import { AuraCodeLensProvider, registerSymbolCommands } from './codelens';
import { registerAskAuraCommands } from './commands/ask-aura';
import { buildArchReportInput, generateArchReport, withAiNarrative, type ArchReportExtras, type ArchReportModule } from './report/arch-report';
import { generateArchitectureNarrative } from './report/ai-summary';
import { metricsToCsv, metricsToJson, type MetricsRow } from './report/metrics-export';
import { buildAiExportInput, generateAiExport, type AiExportSection } from './export/ai-export';
import { saveOrCopyText, saveText } from './export/save';
import { chunkDocument, type DocChunk } from './analyzer/parsers/doc-parser';
import { computeCochange } from './analysis/cochange';
import { computeSymbolCycles } from './analysis/symbol-cycles';
import { buildParseFailureReport } from './analysis/parse-failures';
import { computePageRank } from './analysis/pagerank';
import { documentationIdsOf, isStructuralLink } from './analysis/architecture';
import { parseDeadCodeRules, type DeadCodeRule } from './analysis/dead-code';
import {
    ARCH_BASELINE_FILE,
    ARCH_RULES_FILE,
    EMPTY_ARCH_RULES,
    applyArchitecture,
    buildArchBaseline,
    buildArchRulesTemplate,
    evaluateArchitecture,
    parseArchBaseline,
    parseArchRules,
    serializeArchBaseline,
    type ArchBaseline,
    type ArchEvaluation,
    type ArchRules,
} from './arch/arch-core';
import { buildArchitectureToolPayload } from './arch/arch-tool';

let webviewProvider: WebviewProvider | undefined;
let cachedGraphData: GraphData | undefined;
let codeLensProvider: AuraCodeLensProvider | undefined;
let hoverProvider: AuraHoverProvider | undefined;
let cachedFiles: FileInfo[] = [];
let historyWorker: Worker | undefined;
let commitIndex: CommitIndex | undefined;
let cachedDeltas: CommitDelta[] = [];
let fileWatcher: vscode.FileSystemWatcher | undefined;
let riskStatusBarItem: vscode.StatusBarItem | undefined;
let riskSnapshot: RiskSnapshot | undefined;
let riskSnapshotDirty = true;
let archStatusBarItem: vscode.StatusBarItem | undefined;
let archRules: ArchRules | undefined;
let archBaseline: ArchBaseline = { version: 1, entries: [] };
let archEvaluation: ArchEvaluation | undefined;
let archRulesError: string | undefined;
let workingTreeFiles: Map<string, GitFileState> = new Map();
let workingTreeTimer: ReturnType<typeof setTimeout> | undefined;
let startupWorkingTreeTimer: ReturnType<typeof setTimeout> | undefined;
/** '' = checked, not a git repo (avoids re-probing on every save). */
let gitRepoRoot: string | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let refreshTimeout: ReturnType<typeof setTimeout> | undefined;
let treeProvider: AuraTreeProvider | undefined;
let isAnalyzing = false;
let graphDb: GraphDB | undefined;
let incrementalCtx: IncrementalContext | undefined;
/**
 * Files that failed to parse cleanly (V2-17), keyed by node id. The full index
 * is kept in memory for incremental edits; `meta.parseFailures` only carries a
 * capped sample for the UI.
 */
let parseFailureIndex = new Map<string, string>();

/** Rebuild `meta.parseFailures` from the live index (undefined when clean). */
function refreshParseFailureMeta(data: GraphData | undefined = cachedGraphData): void {
    if (!data) return;
    const report = buildParseFailureReport(parseFailureIndex);
    if (report) data.meta.parseFailures = report;
    else delete data.meta.parseFailures;
}

/** Seed the in-memory index from a cached graph (sample-only, best effort). */
function seedParseFailureIndex(data: GraphData | undefined): void {
    parseFailureIndex = new Map((data?.meta.parseFailures?.samples || []).map(sample => [sample.path, sample.reason]));
}

/** Apply one file's parse result to the index + meta (incremental edits). */
function applyParseFailure(path: string, reason?: string): void {
    const before = parseFailureIndex.get(path);
    if (reason) parseFailureIndex.set(path, reason);
    else parseFailureIndex.delete(path);
    if ((before || reason) && cachedGraphData) {
        refreshParseFailureMeta(cachedGraphData);
    }
}

/**
 * `aura_get_architecture_violations` provider: evaluate the current rules and
 * baseline against the cached graph, then shape the result for the model.
 * Rules and baseline are workspace files, so this always reflects the latest
 * saved state (no DB round-trip needed).
 */
function architectureToolPayload(input: Record<string, unknown> = {}): unknown {
    if (!cachedGraphData) {
        return { error: 'Aura has not analyzed this workspace yet. Run the "Aura: Visualize Codebase" command first, then retry.' };
    }
    if (!archRules) {
        if (archRulesError) return { configured: false, error: archRulesError };
        return buildArchitectureToolPayload(undefined, input);
    }
    const evaluation = evaluateArchitecture(cachedGraphData, archRules, { baseline: archBaseline });
    return buildArchitectureToolPayload(evaluation, input);
}

/** Recompute PageRank in place and return the nodes whose score changed. */
function recomputePageRank(data: GraphData): GraphNode[] {
    const before = new Map(data.nodes.map(node => [node.id, node.pagerank]));
    const docIds = documentationIdsOf(data.nodes);
    const structuralNodes = data.nodes.filter(node => !docIds.has(node.id));
    const structuralLinks = data.links.filter(link => isStructuralLink(link, docIds));
    const scores = computePageRank(structuralNodes.map(node => node.id), structuralLinks);
    const changed: GraphNode[] = [];
    for (const node of data.nodes) {
        node.pagerank = scores[node.id] ?? 0;
        if (before.get(node.id) !== node.pagerank) changed.push(node);
    }
    return changed;
}

// ============================================================
// Architecture rules (V2-20) — host-side configuration and evaluation
// ============================================================

function archRulesFilePath(rootPath: string): string {
    return path.join(rootPath, ARCH_RULES_FILE);
}

function archBaselineFilePath(rootPath: string): string {
    return path.join(rootPath, ARCH_BASELINE_FILE);
}

/** Read `.aura/arch-rules.json` + `.aura/arch-baseline.json`. Never throws. */
function loadArchConfiguration(rootPath: string): void {
    archRules = undefined;
    archRulesError = undefined;
    archBaseline = { version: 1, entries: [] };

    const rulesFile = archRulesFilePath(rootPath);
    if (existsSync(rulesFile)) {
        try {
            archRules = parseArchRules(readFileSync(rulesFile, 'utf-8'));
        } catch (err) {
            archRulesError = err instanceof Error ? err.message : String(err);
            console.warn('[aura] Invalid .aura/arch-rules.json:', err);
        }
    }

    const baselineFile = archBaselineFilePath(rootPath);
    if (existsSync(baselineFile)) {
        try {
            archBaseline = parseArchBaseline(readFileSync(baselineFile, 'utf-8'));
        } catch (err) {
            console.warn('[aura] Invalid .aura/arch-baseline.json — ignored:', err);
        }
    }
}

/**
 * Evaluate the architecture rules against the current graph, annotate every
 * node/link in place, and expose the evaluation through `meta.arch`.
 * Removes stale annotations when the rules file is absent or invalid.
 */
function applyArchitectureToGraph(data: GraphData): ArchEvaluation | undefined {
    if (!archRules) {
        const empty = evaluateArchitecture({ nodes: [], links: [] }, EMPTY_ARCH_RULES);
        applyArchitecture(data.nodes, data.links, empty, EMPTY_ARCH_RULES);
        delete data.meta.arch;
        archEvaluation = undefined;
    } else {
        archEvaluation = evaluateArchitecture(data, archRules, { baseline: archBaseline });
        applyArchitecture(data.nodes, data.links, archEvaluation, archRules);
        data.meta.arch = archEvaluation;
    }
    if (archRulesError) data.meta.archError = archRulesError;
    else delete data.meta.archError;
    return archEvaluation;
}

/** Top-level source folders used to seed a rules template. */
function topLevelSourceFolders(rootPath: string): string[] {
    const skip = new Set([
        'node_modules', '.git', '.aura', '.vscode', '.github', 'out', 'dist', 'build',
        'coverage', '__pycache__', 'docs', 'doc', 'test', 'tests', 'resources',
    ]);
    const srcPath = path.join(rootPath, 'src');
    for (const base of [srcPath, rootPath]) {
        try {
            const folders = readdirSync(base, { withFileTypes: true })
                .filter(entry => entry.isDirectory() && !entry.name.startsWith('.') && !skip.has(entry.name))
                .map(entry => entry.name)
                .sort();
            if (folders.length > 0) return folders;
        } catch {
            // Try the next base directory.
        }
    }
    return [];
}

/** Re-read rules + baseline, re-evaluate and refresh every surface (no re-parse). */
function reloadArchitecture(): void {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) return;
    loadArchConfiguration(ws.uri.fsPath);
    if (cachedGraphData) {
        applyArchitectureToGraph(cachedGraphData);
        // Annotation-only message: keeps the live graph instance (camera framing,
        // settled node layout) instead of re-sending the whole dataset.
        webviewProvider?.sendArchUpdate(cachedGraphData);
        treeProvider?.update(cachedGraphData);
        codeLensProvider?.refresh();
    }
    updateStatusBar();
}

/** Create (from source folders) or open the rules file. */
async function createOrOpenArchRules(): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
        void vscode.window.showWarningMessage('Aura: open a workspace folder first.');
        return;
    }
    const file = archRulesFilePath(ws.uri.fsPath);
    try {
        if (!existsSync(file)) {
            await fs.mkdir(path.dirname(file), { recursive: true });
            await fs.writeFile(file, buildArchRulesTemplate(topLevelSourceFolders(ws.uri.fsPath)), 'utf-8');
        }
        const doc = await vscode.workspace.openTextDocument(file);
        await vscode.window.showTextDocument(doc);
    } catch (err) {
        void vscode.window.showErrorMessage(
            'Aura: could not create architecture rules — ' + (err instanceof Error ? err.message : String(err))
        );
    }
}

/** Freeze every current violation so only new ones alert. */
async function baselineArchitecture(): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) return;
    if (!cachedGraphData || !archRules) {
        void vscode.window.showWarningMessage('Aura: create .aura/arch-rules.json before baselining violations.');
        return;
    }
    applyArchitectureToGraph(cachedGraphData);
    if (!archEvaluation) return;
    const baseline = buildArchBaseline(archEvaluation);
    try {
        await fs.mkdir(path.dirname(archBaselineFilePath(ws.uri.fsPath)), { recursive: true });
        await fs.writeFile(archBaselineFilePath(ws.uri.fsPath), serializeArchBaseline(baseline), 'utf-8');
        reloadArchitecture();
        void vscode.window.showInformationMessage(
            `Aura: ${baseline.entries.length} architecture violation${baseline.entries.length === 1 ? '' : 's'} baselined — only new ones will alert.`
        );
    } catch (err) {
        void vscode.window.showErrorMessage(
            'Aura: could not write the architecture baseline — ' + (err instanceof Error ? err.message : String(err))
        );
    }
}

/** Clear the baseline: every violation alerts again. */
async function resetArchitectureBaseline(): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) return;
    const file = archBaselineFilePath(ws.uri.fsPath);
    try {
        if (existsSync(file)) await fs.unlink(file);
        reloadArchitecture();
        void vscode.window.showInformationMessage('Aura: architecture baseline cleared.');
    } catch (err) {
        void vscode.window.showErrorMessage(
            'Aura: could not delete the baseline — ' + (err instanceof Error ? err.message : String(err))
        );
    }
}

/** Refresh the dead-code metadata counters after an incremental node change. */
function recomputeDeadCodeMeta(data: GraphData): void {
    data.meta.deadCodeFiles = data.nodes.filter(n => n.deadExports && n.deadExports.length > 0).length;
    data.meta.deadExportsTotal = data.nodes.reduce((sum, n) => sum + (n.deadExports ? n.deadExports.length : 0), 0);
    data.meta.deadCodeExemptions = data.nodes.reduce((sum, n) => sum + (n.exemptedExports ? n.exemptedExports.length : 0), 0);
    if (graphDb) {
        try {
            graphDb.setMeta('deadCodeFiles', String(data.meta.deadCodeFiles));
            graphDb.setMeta('deadExportsTotal', String(data.meta.deadExportsTotal));
            graphDb.setMeta('deadCodeExemptions', String(data.meta.deadCodeExemptions));
            graphDb.save();
        } catch (err) {
            console.warn('[aura] dead-code meta update failed:', err);
        }
    }
}

export function activate(context: vscode.ExtensionContext): void {
    // Tree View in Activity Bar
    treeProvider = new AuraTreeProvider();
    const treeView = vscode.window.createTreeView('auraVisualizer.statsView', {
        treeDataProvider: treeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    // Status bar — shows file & link count
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    statusBarItem.command = 'auraVisualizer.open';
    statusBarItem.text = '$(eye) Aura';
    statusBarItem.tooltip = 'Open Aura 3D Visualizer';
    context.subscriptions.push(statusBarItem);

    // Status bar (right) — risk score of the edited file; switches to an alert when
    // the files being changed right now are high-risk ("hotspots in your changes").
    riskStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
    riskStatusBarItem.command = 'auraVisualizer.open';
    riskStatusBarItem.tooltip = 'Aura risk map';
    context.subscriptions.push(riskStatusBarItem);

    // Status bar (right) — layer + new architecture violations of the edited file.
    archStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 49);
    archStatusBarItem.command = 'auraVisualizer.statusBarArch';
    archStatusBarItem.tooltip = 'Aura architecture rules';
    context.subscriptions.push(archStatusBarItem);

    // Language Model tools — exposes Aura's codebase graph to VS Code AI agents (Copilot Chat, etc.)
    registerAuraLmTools(context, () => graphDb, () => ensureRiskSnapshot(), architectureToolPayload);
    registerAuraChatParticipant(context, () => graphDb, () => ensureRiskSnapshot(), () => webviewProvider?.isOpen ?? false, architectureToolPayload);

    // Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('auraVisualizer.open', () => openVisualizer(context)),
        vscode.commands.registerCommand('auraVisualizer.refresh', () => refreshAnalysis(context, true)),
        vscode.commands.registerCommand('auraVisualizer.focusFile', () => focusCurrentFile()),
        vscode.commands.registerCommand('auraVisualizer.openFileFromTree', (relativePath: string) => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) return;
            const fullPath = path.join(workspaceFolder.uri.fsPath, relativePath);
            vscode.window.showTextDocument(vscode.Uri.file(fullPath), { preview: true });
        }),
        vscode.commands.registerCommand('auraVisualizer.exportGraph', () => exportGraph()),
        vscode.commands.registerCommand('auraVisualizer.exportImage', () => exportGraphImage(context)),
        vscode.commands.registerCommand('auraVisualizer.exportArchReport', () => exportArchReport()),
        vscode.commands.registerCommand('auraVisualizer.exportArchReportAI', () => exportArchReport(true)),
        vscode.commands.registerCommand('auraVisualizer.exportMetrics', () => exportMetrics()),
        vscode.commands.registerCommand('auraVisualizer.blastRadius', (uri?: unknown, selection?: unknown) =>
            blastRadiusFromResources(context, uri, selection)),
        vscode.commands.registerCommand('auraVisualizer.statusBarRisk', (nodeId?: string) => focusRiskFromStatusBar(context, nodeId)),
        vscode.commands.registerCommand('auraVisualizer.statusBarArch', (nodeId?: string) => focusArchFromStatusBar(context, nodeId)),
        vscode.commands.registerCommand('auraVisualizer.archRules', () => createOrOpenArchRules()),
        vscode.commands.registerCommand('auraVisualizer.deadCodeRules', () => createOrOpenDeadCodeRules()),
        vscode.commands.registerCommand('auraVisualizer.reloadArchRules', () => reloadArchitecture()),
        vscode.commands.registerCommand('auraVisualizer.baselineArch', () => baselineArchitecture()),
        vscode.commands.registerCommand('auraVisualizer.resetArchBaseline', () => resetArchitectureBaseline()),
        vscode.commands.registerCommand('auraVisualizer.applyQuery', async (expr?: string, mode: 'highlight' | 'filter' | 'select' = 'filter') => {
            if (!expr) return;
            await openVisualizer(context);
            webviewProvider?.applyQueryFromHost(expr, mode);
        })
    );

    // Import hover (V3-04): metrics of the imported file on the specifier.
    // Metrics come from the in-memory graph — a hover never queries SQLite.
    hoverProvider = new AuraHoverProvider(
        () => (cachedGraphData ? { nodes: cachedGraphData.nodes } : undefined),
        () => ensureRiskSnapshot(),
        () => vscode.workspace.getConfiguration('auraVisualizer').get<boolean>('hover', true),
    );
    context.subscriptions.push(
        vscode.languages.registerHoverProvider({ scheme: 'file' }, hoverProvider),
    );

    context.subscriptions.push(...registerNavigationCommands({
        revealGraph: () => openVisualizer(context),
        focusInGraph: (relativePath: string) => webviewProvider?.focusNode(relativePath, true),
        blastRadiusInGraph: (relativePath: string) => webviewProvider?.sendBlastRadius(relativePath),
    }));

    // Symbol CodeLens (V3-01): `⟡ focus · flow · impact` above the symbols of
    // analyzed files. Symbols come from GraphDB, so an unanalyzed file shows
    // no lens at all; the setting turns the whole feature off.
    codeLensProvider = new AuraCodeLensProvider(
        () => graphDb,
        () => vscode.workspace.getConfiguration('auraVisualizer').get<boolean>('codeLens', true),
    );
    context.subscriptions.push(
        codeLensProvider,
        vscode.languages.registerCodeLensProvider({ scheme: 'file' }, codeLensProvider),
        ...registerSymbolCommands({
            revealGraph: () => openVisualizer(context),
            focusInGraph: (relativePath: string) => webviewProvider?.focusNode(relativePath, true),
            blastRadiusInGraph: (relativePath: string) => webviewProvider?.sendBlastRadius(relativePath),
            openFlow: (relativePath: string, line: number, language: string, name?: string) =>
                webviewProvider?.openFlow(relativePath, line, language, name),
        }),
    );
    context.subscriptions.push(...registerAskAuraCommands());

    // Enriched palette (V3-03): focus a file by name, replay a saved query, add
    // a warp on the current camera pose.
    context.subscriptions.push(...registerPaletteCommands({
        revealGraph: () => openVisualizer(context),
        focusInGraph: (relativePath: string) => webviewProvider?.focusNode(relativePath, true),
        applyQuery: (expr: string, mode: 'highlight' | 'filter' | 'select') => webviewProvider?.applyQueryFromHost(expr, mode),
        captureWarp: () => webviewProvider?.captureWarpHere(),
    }, {
        files: () => cachedGraphData?.nodes ?? [],
        queries: () => {
            try {
                return graphDb && graphDb.isOpen ? graphDb.listSavedQueries() : [];
            } catch {
                return [];
            }
        },
    }));

    // Watch for file changes (incremental)
    setupFileWatcher(context);

    // Rules and baseline are side files: editing them only requires a
    // re-evaluation (no re-parse, no DB write).
    setupArchitectureWatcher(context);

    // Watch .git for state changes (commit, stage, checkout, stash, branch
    // switch) so the dirty overlay stays fresh — none of those touch a source
    // file, so the workspace watcher above never fires for them.
    setupGitStateWatcher(context);

    // Watch for config changes (bloom, link style, risk window, etc.)
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('auraVisualizer') && webviewProvider) {
                webviewProvider.sendSettings({});
            }
            if (e.affectsConfiguration('auraVisualizer.riskWindow')) {
                invalidateRisk();
            }
            if (e.affectsConfiguration('auraVisualizer.codeLens')) {
                codeLensProvider?.refresh();
            }
            if (e.affectsConfiguration('auraVisualizer.excludePaths')) {
                void refreshAnalysis(context, true);
            }
        })
    );

    // Working-tree changes — refresh the dirty-hotspots alert (debounced)
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(() => {
            scheduleWorkingTreeRefresh();
        })
    );

    // Sync active editor
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            updateRiskStatusBar();
            updateArchStatusBar();
            if (!editor || !webviewProvider?.isVisible) return;
            if (editor.document.uri.scheme !== 'file') return;
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) return;
            const relativePath = path.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath)
                .split(path.sep).join('/');
            if (!relativePath || relativePath === '..' || relativePath.startsWith('../') || path.isAbsolute(relativePath)) return;
            // Files outside the analyzed graph cannot be followed.
            if (cachedGraphData &&
                !cachedGraphData.nodes.some(node => node.id.replace(/\\/g, '/') === relativePath)) return;
            webviewProvider.followEditorFile(relativePath);
        })
    );

    // Theme change
    context.subscriptions.push(
        vscode.window.onDidChangeActiveColorTheme(theme => {
            webviewProvider?.sendTheme(theme.kind);
        })
    );

    // Register serializer to restore panel on VSCode restart
    vscode.window.registerWebviewPanelSerializer(WebviewProvider.viewType, {
        async deserializeWebviewPanel(panel: vscode.WebviewPanel): Promise<void> {
            if (!webviewProvider) {
                webviewProvider = new WebviewProvider(context.extensionUri, context.workspaceState, () => graphDb, hostDataAccessors());
                registerOpenFileHandler();
            }
            webviewProvider.restore(panel);
            // If analysis already completed, send cached data immediately
            if (cachedGraphData) {
                webviewProvider.sendGraphData(cachedGraphData);
                if (commitIndex) {
                    webviewProvider.sendHistoryIndex(commitIndex);
                    for (const delta of cachedDeltas) {
                        webviewProvider.sendHistoryDelta(delta);
                    }
                }
            }
        }
    });

    // Run initial analysis in background (populates tree + sends data to restored panel when ready)
    if (vscode.workspace.workspaceFolders?.length) {
        loadFromDbThenRefresh(context);
    }

    // Prime the working-tree status (dirty files) for the risk status bar.
    // Deferred ~2.5 s: `git status --untracked-files=all` is CPU-heavy on big
    // repos and used to compete with the initial analysis / first graph render.
    startupWorkingTreeTimer = setTimeout(() => {
        startupWorkingTreeTimer = undefined;
        void refreshWorkingTree();
    }, 2500);
}

/**
 * Try to load graph data from the cached SQLite DB for instant startup.
 * Then run a full analysis in the background to pick up any changes since last run.
 */
async function loadFromDbThenRefresh(context: vscode.ExtensionContext): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) { refreshAnalysis(context); return; }

    const rootPath = workspaceFolder.uri.fsPath;
    const dbPath = path.join(rootPath, '.aura', 'graph.db');
    loadArchConfiguration(rootPath);

    if (existsSync(dbPath)) {
        try {
            if (!graphDb) {
                graphDb = new GraphDB();
                await graphDb.open(dbPath);
            }
            // Repair metrics written by older versions: fan-in now ignores
            // documentation, and PageRank is recomputed on the code-only graph.
            graphDb.updateFanCounts();
            const cached = graphDb.exportGraphData();
            if (cached && cached.nodes.length > 0) {
                cachedGraphData = cached;
                seedParseFailureIndex(cachedGraphData);
                applyArchitectureToGraph(cachedGraphData);
                const rankChanges = recomputePageRank(cachedGraphData);
                if (rankChanges.length > 0) {
                    graphDb.updatePageRanks(cachedGraphData.nodes);
                }
                graphDb.save();
                if (webviewProvider) {
                    webviewProvider.sendGraphData(cachedGraphData);
                }
                treeProvider?.update(cachedGraphData);
                updateStatusBar();
                console.log(`[aura] Loaded ${cached.nodes.length} files from cache in DB`);
            }
        } catch (err) {
            console.error('[aura] Failed to load from DB cache:', err);
        }
    }

    // Load cached history so the timeline appears instantly
    const historyDir = path.join(rootPath, '.aura', 'history');
    const indexPath = path.join(historyDir, 'index.json');
    if (existsSync(indexPath)) {
        try {
            const idx = JSON.parse(readFileSync(indexPath, 'utf-8')) as CommitIndex;
            commitIndex = idx;
            invalidateRisk();
            if (webviewProvider) {
                webviewProvider.sendHistoryIndex(commitIndex);
            }
            // Load cached deltas
            for (const commit of idx.commits) {
                const deltaPath = path.join(historyDir, `${commit.hash}.json`);
                if (!existsSync(deltaPath)) { continue; }
                try {
                    const delta = JSON.parse(readFileSync(deltaPath, 'utf-8')) as CommitDelta;
                    cachedDeltas.push(delta);
                    if (webviewProvider) {
                        webviewProvider.sendHistoryDelta(delta);
                    }
                } catch { /* skip corrupted delta */ }
            }
            console.log(`[aura] Loaded ${cachedDeltas.length} cached history deltas`);
        } catch (err) {
            console.error('[aura] Failed to load cached history:', err);
        }
    }

    // Refresh in the background. The fingerprint cache skips parsing entirely
    // when nothing changed, and otherwise re-parses only the changed files.
    refreshAnalysis(context);
}

function registerOpenFileHandler(): void {
    if (!webviewProvider) return;
    webviewProvider.onOpenFile(async ({ path: filePath, line }) => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) return;

        const fullPath = path.join(workspaceFolder.uri.fsPath, filePath);
        const uri = vscode.Uri.file(fullPath);

        try {
            const doc = await vscode.workspace.openTextDocument(uri);
            const editor = await vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.Beside,
                preserveFocus: false
            });

            if (line && line > 0) {
                const position = new vscode.Position(line - 1, 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(
                    new vscode.Range(position, position),
                    vscode.TextEditorRevealType.InCenter
                );
            }
        } catch {
            // File may not exist
        }
    });
}

async function openVisualizer(context: vscode.ExtensionContext): Promise<void> {
    const wasOpen = webviewProvider?.isOpen ?? false;
    if (!webviewProvider) {
        webviewProvider = new WebviewProvider(context.extensionUri, context.workspaceState, () => graphDb, hostDataAccessors());
        registerOpenFileHandler();
    }

    webviewProvider.show();

    // Already open: reveal only. Re-sending the whole graph would reset
    // the camera, selection and panels for no reason.
    if (wasOpen) return;

    if (cachedGraphData) {
        webviewProvider.sendGraphData(cachedGraphData);
        // Re-send cached history so timeline bar + navigation reappears
        if (commitIndex) {
            webviewProvider.sendHistoryIndex(commitIndex);
            for (const delta of cachedDeltas) {
                webviewProvider.sendHistoryDelta(delta);
            }
        }
    } else {
        await refreshAnalysis(context);
    }
}

/** Create (empty) or open `.aura/dead-code.json`. */
async function createOrOpenDeadCodeRules(): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
        void vscode.window.showWarningMessage('Aura: open a workspace folder first.');
        return;
    }
    const file = path.join(ws.uri.fsPath, '.aura', 'dead-code.json');
    try {
        if (!existsSync(file)) {
            await fs.mkdir(path.dirname(file), { recursive: true });
            await fs.writeFile(file, '{\n  "version": 1,\n  "rules": []\n}\n', 'utf-8');
        }
        const doc = await vscode.workspace.openTextDocument(file);
        await vscode.window.showTextDocument(doc);
    } catch (err) {
        void vscode.window.showErrorMessage(
            'Aura: could not create dead-code rules — ' + (err instanceof Error ? err.message : String(err))
        );
    }
}

/** Load optional workspace dead-code exemptions; invalid files fall back to defaults. */
function loadDeadCodeRules(rootPath: string): DeadCodeRule[] {
    const file = path.join(rootPath, '.aura', 'dead-code.json');
    try {
        return parseDeadCodeRules(readFileSync(file, 'utf-8'));
    } catch (err) {
        console.warn('[aura] Invalid .aura/dead-code.json — using default exemptions:', err);
        return [];
    }
}

/** Cheap global fingerprint: HEAD + settings + parser version + file signatures. */
async function currentAnalysisFingerprint(
    rootPath: string,
    excludePaths: string[],
    projectName: string,
): Promise<AnalysisFingerprint> {
    const signatures = await scanFileSignatures(rootPath, { skipDirs: new Set(excludePaths) });
    const head = await getGitHead(rootPath);
    const configHash = hashAnalysisConfig({
        excludePaths: [...excludePaths].sort(),
        projectName,
        deadCodeRules: (() => {
            try { return readFileSync(path.join(rootPath, '.aura', 'dead-code.json'), 'utf-8'); }
            catch { return ''; }
        })(),
    });
    return computeFingerprint({ head, configHash, files: signatures });
}

/** Rebuild FileInfo metadata for unchanged files from the cached graph (no reads). */
function filesFromGraphData(data: GraphData, rootPath: string): FileInfo[] {
    return data.nodes.map((node) => ({
        id: node.id,
        name: node.name,
        path: node.path || node.id,
        fullPath: path.join(rootPath, node.id),
        language: node.language,
        extension: node.extension,
        size: node.size,
        linesOfCode: node.linesOfCode,
        lastModified: node.lastModified,
        group: node.group,
        content: '',
    }));
}

/** Rebuild the in-memory incremental context after a cache hit. */
function hydrateCachedGraphState(rootPath: string): void {
    if (!cachedGraphData) return;
    loadArchConfiguration(rootPath);
    applyArchitectureToGraph(cachedGraphData);
    if (cachedFiles.length === 0) {
        cachedFiles = filesFromGraphData(cachedGraphData, rootPath);
    }
    if (cachedFiles.length > 0) {
        incrementalCtx = restoreIncrementalContext(cachedFiles, cachedGraphData);
    }
}

function persistFingerprint(fp: AnalysisFingerprint): void {
    if (!graphDb) return;
    try {
        for (const [key, value] of fingerprintMetaEntries(fp)) graphDb.setMeta(key, value);
        graphDb.save();
    } catch (err) {
        console.error('[aura] Fingerprint persistence failed:', err);
    }
}

async function refreshAnalysis(context: vscode.ExtensionContext, force = false): Promise<void> {
    if (isAnalyzing) return;
    isAnalyzing = true;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        isAnalyzing = false;
        vscode.window.showWarningMessage('Aura: No workspace folder open.');
        return;
    }

    const rootPath = workspaceFolder.uri.fsPath;
    const dbPath = path.join(rootPath, '.aura', 'graph.db');
    const config = vscode.workspace.getConfiguration('auraVisualizer');
    const excludePaths = config.get<string[]>('excludePaths', [
        'node_modules', '.git', 'dist', 'build', 'out', '__pycache__'
    ]);

    // Open the cache DB before scanning so a matching fingerprint can short-circuit
    // the worker entirely (V2-14). A missing/unwritable DB simply falls back to a
    // full analysis.
    if (!graphDb) {
        try {
            graphDb = new GraphDB();
            await fs.mkdir(path.join(rootPath, '.aura'), { recursive: true });
            await graphDb.open(dbPath);
        } catch (err) {
            graphDb = undefined;
            console.error('[aura] GraphDB open failed:', err);
        }
    }

    let currentFingerprint: AnalysisFingerprint | undefined;
    try {
        currentFingerprint = await currentAnalysisFingerprint(rootPath, excludePaths, workspaceFolder.name);
    } catch (err) {
        console.error('[aura] Fingerprint computation failed:', err);
    }

    const hadCachedGraphAtStart = !!cachedGraphData;
    const finishCacheRefresh = (): void => {
        if (!hadCachedGraphAtStart && cachedGraphData) {
            webviewProvider?.sendGraphData(cachedGraphData);
        } else {
            webviewProvider?.sendRefreshComplete();
        }
    };

    try {
        if (currentFingerprint && graphDb) {
            if (!cachedGraphData) {
                cachedGraphData = graphDb.exportGraphData() ?? undefined;
                seedParseFailureIndex(cachedGraphData);
            }
            const previous = fingerprintFromMeta(graphDb.getAllMeta());
            const plan = planAnalysis(previous, currentFingerprint, {
                force,
                hasCachedGraph: !!cachedGraphData,
            });

            if (plan.mode === 'skip') {
                hydrateCachedGraphState(rootPath);
                finishCacheRefresh();
                updateStatusBar();
                console.log(`[aura] Fingerprint unchanged (${currentFingerprint.files.length} files) — analysis skipped`);
                void startHistoryScan(context, rootPath, excludePaths);
                isAnalyzing = false;
                return;
            }

            if (plan.mode === 'head-only') {
                persistFingerprint(currentFingerprint);
                hydrateCachedGraphState(rootPath);
                finishCacheRefresh();
                updateStatusBar();
                console.log(`[aura] Fingerprint refreshed (HEAD only, ${currentFingerprint.files.length} files) — analysis skipped`);
                void startHistoryScan(context, rootPath, excludePaths);
                isAnalyzing = false;
                return;
            }

            if (plan.mode === 'incremental') {
                hydrateCachedGraphState(rootPath);
                for (const deleted of plan.diff.deleted) {
                    await incrementalUpdate(vscode.Uri.file(path.join(rootPath, deleted)), true);
                }
                for (const file of [...plan.diff.added, ...plan.diff.modified]) {
                    await incrementalUpdate(vscode.Uri.file(path.join(rootPath, file)), false);
                }
                persistFingerprint(currentFingerprint);
                finishCacheRefresh();
                updateStatusBar();
                console.log(`[aura] Incremental analysis: ${plan.diff.added.length + plan.diff.modified.length + plan.diff.deleted.length} file(s) changed (${plan.diff.added.length} added, ${plan.diff.modified.length} modified, ${plan.diff.deleted.length} deleted)`);
                void startHistoryScan(context, rootPath, excludePaths);
                isAnalyzing = false;
                return;
            }

            console.log(`[aura] Full analysis (${plan.reason})`);
        }
    } catch (cacheErr) {
        // A broken cache must never block the user: fall through to a full scan.
        console.error('[aura] Fingerprint cache path failed, falling back to a full scan:', cacheErr);
    }

    if (statusBarItem) {
        statusBarItem.text = '$(loading~spin) Aura: Analyzing...';
        statusBarItem.show();
    }

    try {
        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Window,
                title: 'Aura: Analyzing codebase...'
            },
            () => runAnalysisInWorker(context.extensionUri, rootPath, excludePaths, workspaceFolder.name, loadDeadCodeRules(rootPath))
        );

        const oldGraphData = cachedGraphData;

        cachedGraphData = result.graphData;
        cachedFiles = result.files;
        // V2-17: the worker sends the full failure list; keep it for incremental
        // edits and rebuild the capped report carried by meta.
        parseFailureIndex = new Map((result.parseFailures || []).map(failure => [failure.path, failure.reason]));
        refreshParseFailureMeta(cachedGraphData);
        loadArchConfiguration(rootPath);
        applyArchitectureToGraph(cachedGraphData);
        // Restore incremental context from already-computed graph data (no re-parsing)
        incrementalCtx = restoreIncrementalContext(cachedFiles, cachedGraphData);

        // Persist BEFORE notifying the webview: the provider reads the shared
        // community snapshot from GraphDB when it sends graphData / deltas.
        try {
            if (!graphDb) {
                graphDb = new GraphDB();
                const dbDir = path.join(rootPath, '.aura');
                await fs.mkdir(dbDir, { recursive: true });
                await graphDb.open(path.join(dbDir, 'graph.db'));
            }
            graphDb.importGraphData(cachedGraphData);
            graphDb.importDocChunks(result.docChunks);
            if (currentFingerprint) persistFingerprint(currentFingerprint);
        } catch (dbErr) {
            // Non-critical — log and continue
            console.error('[aura] GraphDB import error:', dbErr);
        }

        if (webviewProvider) {
            if (oldGraphData && oldGraphData.nodes.length > 0) {
                // Already showing data from DB cache — send only the delta
                const delta = computeGraphDelta(oldGraphData, cachedGraphData, '', false);
                const oldCallCount = oldGraphData.functionCalls?.length || 0;
                const newCallCount = cachedGraphData.functionCalls?.length || 0;
                const hasChanges = delta.changedNodes.length > 0 ||
                    delta.removedNodeIds.length > 0 ||
                    delta.addedLinks.length > 0 ||
                    delta.removedLinks.length > 0 ||
                    oldCallCount !== newCallCount;
                if (hasChanges) {
                    webviewProvider.sendGraphDelta(delta as unknown as Record<string, unknown>);
                } else {
                    // Nothing changed — tell webview to dismiss loading overlay
                    webviewProvider.sendRefreshComplete();
                }
            } else {
                webviewProvider.sendGraphData(cachedGraphData);
            }
        }

        treeProvider?.update(cachedGraphData);
        codeLensProvider?.refresh();
        updateStatusBar();
        void notifyScanComplete(context);
        // Persist graph to SQLite — already imported before the webview update so
        // the shared community snapshot is consistent with the graph on screen.
        try {
            // History may already be cached — recompute temporal coupling now that
            // the current graph (allowed paths + structural links) is available.
            refreshCochangeFromHistory();

            // Auto-register MCP server config
            await registerMcpServer(context, rootPath);
        } catch (dbErr) {
            // Non-critical — log and continue
            console.error('[aura] GraphDB post-import error:', dbErr);
        }

        // Launch Time Travel history scan in background
        startHistoryScan(context, rootPath, excludePaths);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Aura: Analysis failed — ${message}`);
        updateStatusBar();
    } finally {
        isAnalyzing = false;
    }
}

/**
 * Create or update .vscode/mcp.json so AI assistants can discover the Aura MCP server.
 * Only writes once per workspace (skips if "aura" key already exists).
 */
async function registerMcpServer(context: vscode.ExtensionContext, rootPath: string): Promise<void> {
    const vscodeDir = path.join(rootPath, '.vscode');
    const mcpPath = path.join(vscodeDir, 'mcp.json');
    const mcpServerPath = path.join(context.extensionUri.fsPath, 'out', 'mcp-server.js');
    const dbPath = path.join(rootPath, '.aura', 'graph.db');

    let config: { servers?: Record<string, unknown> } = {};

    try {
        const existing = await fs.readFile(mcpPath, 'utf-8');
        config = JSON.parse(existing);
    } catch {
        // File doesn't exist or is invalid — start fresh
    }

    if (config.servers && config.servers['aura']) {
        return; // Already registered
    }

    config.servers = config.servers || {};
    config.servers['aura'] = {
        command: 'node',
        args: [mcpServerPath],
        env: {
            AURA_DB_PATH: dbPath,
        },
    };

    await fs.mkdir(vscodeDir, { recursive: true });
    await fs.writeFile(mcpPath, JSON.stringify(config, null, 4) + '\n', 'utf-8');
    console.log('[aura] MCP server registered in .vscode/mcp.json');
}

function runAnalysisInWorker(
    extensionUri: vscode.Uri,
    rootPath: string,
    excludePaths: string[],
    projectName: string,
    deadCodeRules: DeadCodeRule[],
): Promise<{ graphData: GraphData; files: FileInfo[]; docChunks: DocChunk[]; parseFailures: ParseFailure[] }> {
    return new Promise((resolve, reject) => {
        const workerPath = path.join(extensionUri.fsPath, 'out', 'analyzer-worker.js');
        const worker = new Worker(workerPath, {
            // Don't inherit the debugger's --inspect flag: worker_threads copy
            // process.execArgv by default, so under the VS Code extension debugger
            // they try to attach to the inspector and hang the extension host.
            execArgv: [],
            workerData: {
                rootPath,
                skipDirs: excludePaths,
                projectName,
                deadCodeRules,
            },
        });

        worker.on('message', (msg: { graphData?: GraphData; files?: FileInfo[]; docChunks?: DocChunk[]; parseFailures?: ParseFailure[]; error?: string; progress?: { phase: string; message: string } }) => {
            if (msg.progress) {
                webviewProvider?.sendProgress(msg.progress.phase, msg.progress.message);
                return;
            }
            if (msg.error) {
                reject(new Error(msg.error));
            } else {
                resolve({ graphData: msg.graphData!, files: msg.files!, docChunks: msg.docChunks || [], parseFailures: msg.parseFailures || [] });
            }
            worker.terminate();
        });

        worker.on('error', (err) => {
            reject(err);
            worker.terminate();
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                reject(new Error(`Worker exited with code ${code}`));
            }
        });
    });
}

/**
 * Incrementally update a single file without re-scanning the entire workspace.
 * Uses rebuildSingleFile() + granular DB methods for O(1) instead of O(N).
 */
async function incrementalUpdate(fileUri: vscode.Uri, deleted: boolean): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder || cachedFiles.length === 0) return;

    const rootPath = workspaceFolder.uri.fsPath;
    const relativePath = path.relative(rootPath, fileUri.fsPath);
    if (relativePath.startsWith('..')) return;

    if (deleted) {
        cachedFiles = cachedFiles.filter(f => f.id !== relativePath);
        if (incrementalCtx) {
            incrementalCtx.fileMap.delete(relativePath);
            incrementalCtx.fileSymbols.delete(relativePath);
        }
        // A deleted file can no longer fail to parse (V2-17).
        applyParseFailure(relativePath, undefined);
        if (graphDb) {
            graphDb.deleteNode(relativePath);
            if (cachedGraphData) graphDb.setMeta('parseFailures', JSON.stringify(cachedGraphData.meta.parseFailures || null));
            graphDb.save();
        }
        // Update cached graph + send delta
        if (cachedGraphData) {
            const removedLinks = cachedGraphData.links
                .filter(l => l.source === relativePath || l.target === relativePath)
                .map(l => ({ source: l.source, target: l.target, type: l.type }));
            cachedGraphData.nodes = cachedGraphData.nodes.filter(n => n.id !== relativePath);
            cachedGraphData.links = cachedGraphData.links.filter(l => l.source !== relativePath && l.target !== relativePath);
            cachedGraphData.functionCalls = (cachedGraphData.functionCalls || []).filter(fc =>
                fc.callerFile !== relativePath && fc.calleeFile !== relativePath
            );
            const rankChanges = recomputePageRank(cachedGraphData);
            cachedGraphData.meta.symbolCycles = computeSymbolCycles(cachedGraphData.functionCalls);
            if (graphDb) {
                graphDb.updatePageRanks(cachedGraphData.nodes);
                graphDb.replaceSymbolCycles(cachedGraphData.meta.symbolCycles);
                graphDb.save();
            }
            cachedGraphData.meta.totalFiles = cachedGraphData.nodes.length;
            cachedGraphData.meta.totalLinks = cachedGraphData.links.length;
            recomputeDeadCodeMeta(cachedGraphData);
            applyArchitectureToGraph(cachedGraphData);

            if (webviewProvider?.isVisible) {
                const delta: GraphDelta = {
                    changedNodes: rankChanges,
                    removedNodeIds: [relativePath],
                    addedLinks: [],
                    removedLinks,
                    meta: cachedGraphData.meta,
                    functionCalls: cachedGraphData.functionCalls || [],
                };
                webviewProvider.sendGraphDelta(delta as unknown as Record<string, unknown>);
            }
        }
        if (cachedGraphData) {
            treeProvider?.update(cachedGraphData);
            codeLensProvider?.refresh();
        }
        updateStatusBar();
        return;
    }

    // -- File changed or created --
    const newInfo = await scanSingleFile(fileUri.fsPath, rootPath);
    if (!newInfo) return;

    const idx = cachedFiles.findIndex(f => f.id === relativePath);
    if (idx >= 0) cachedFiles[idx] = newInfo;
    else cachedFiles.push(newInfo);

    // Documentation files: re-chunk for RAG, refresh node metadata, no graph rebuild
    if (newInfo.language === 'documentation') {
        if (graphDb) {
            const docNode: GraphNode = {
                id: newInfo.id,
                name: newInfo.name,
                path: newInfo.path,
                language: newInfo.language,
                extension: newInfo.extension,
                group: newInfo.id.split('/').slice(0, -1).join('/') || newInfo.name,
                size: newInfo.size,
                linesOfCode: newInfo.content.split('\n').length,
                complexity: 1,
                complexityDetails: {},
                fanIn: 0,
                fanOut: 0,
                lastModified: newInfo.lastModified,
            };
            graphDb.upsertNode(docNode);
            try {
                const chunks = chunkDocument(newInfo.content, newInfo.id);
                graphDb.replaceDocChunks(newInfo.id, chunks);
            } catch {
                // Non-fatal — keep stale chunks rather than crash on a broken file
            }
            graphDb.save();
        }
        updateStatusBar();
        return;
    }

    // Build incremental context if missing (shouldn't happen — refreshAnalysis builds it)
    if (!incrementalCtx) {
        incrementalCtx = restoreIncrementalContext(cachedFiles, cachedGraphData!);
    }

    // Pre-parse single file (a syntax-error file keeps its node — V2-17)
    const fileFailures = new Map<string, string>();
    const trees = await preParseFiles([newInfo], fileFailures);
    const tree = trees.get(newInfo.id);

    // Get old outgoing edge targets (for fan-count recalculation)
    const oldOutEdges = cachedGraphData
        ? cachedGraphData.links.filter(l => l.source === newInfo.id)
        : [];
    const oldTargets = oldOutEdges.map(e => e.target);

    // Rebuild single file
    const result = rebuildSingleFile(newInfo, incrementalCtx, tree, {
        deadCodeRules: loadDeadCodeRules(rootPath),
    });
    // Tree-sitter errors or a throwing parser both feed the same report.
    applyParseFailure(newInfo.id, fileFailures.get(newInfo.id) || result.parseFailureReason);
    // On a cache-only context we cannot rescan all source contents; keep the
    // previous classification rather than clearing it on every save.
    if (!incrementalCtx.hasFileContents && cachedGraphData) {
        const previousNode = cachedGraphData.nodes.find(n => n.id === newInfo.id);
        if (previousNode) {
            if (previousNode.deadExports) result.node.deadExports = previousNode.deadExports;
            if (previousNode.exemptedExports) result.node.exemptedExports = previousNode.exemptedExports;
        }
    }
    const newTargets = result.outEdges.map(e => e.target);
    const affectedIds = [...new Set([newInfo.id, ...oldTargets, ...newTargets])];

    // Update DB
    if (graphDb) {
        graphDb.replaceFileData(newInfo.id, result.node, result.outEdges, result.callSites);
        graphDb.updateFanCounts(affectedIds);
        if (cachedGraphData) graphDb.setMeta('parseFailures', JSON.stringify(cachedGraphData.meta.parseFailures || null));
        graphDb.save();
    }

    // Build delta BEFORE modifying cachedGraphData
    const delta: GraphDelta = {
        changedNodes: [result.node],
        removedNodeIds: [],
        addedLinks: [],
        removedLinks: [],
        meta: cachedGraphData?.meta ?? {} as GraphData['meta'],
        functionCalls: cachedGraphData?.functionCalls ?? [],
    };

    // Compute link diff
    const oldLinkKeys = new Set(oldOutEdges.map(l => `${l.source}|${l.target}|${l.type}`));
    const newLinkKeys = new Set(result.outEdges.map(e => `${e.source}|${e.target}|${e.type}`));
    for (const e of result.outEdges) {
        if (!oldLinkKeys.has(`${e.source}|${e.target}|${e.type}`)) {
            delta.addedLinks.push(e);
        }
    }
    for (const l of oldOutEdges) {
        if (!newLinkKeys.has(`${l.source}|${l.target}|${l.type}`)) {
            delta.removedLinks.push({ source: l.source, target: l.target, type: l.type });
        }
    }

    // Update cached graph data in-place
    if (cachedGraphData) {
        const nodeIdx = cachedGraphData.nodes.findIndex(n => n.id === newInfo.id);
        if (nodeIdx >= 0) cachedGraphData.nodes[nodeIdx] = result.node;
        else cachedGraphData.nodes.push(result.node);

        cachedGraphData.links = cachedGraphData.links.filter(l => l.source !== newInfo.id);
        cachedGraphData.links.push(...result.outEdges);

        const rankChanges = recomputePageRank(cachedGraphData);
        const existingCalls = cachedGraphData.functionCalls || [];
        cachedGraphData.functionCalls = existingCalls
            .filter(fc => fc.callerFile !== newInfo.id)
            .concat(result.callSites);
        cachedGraphData.meta.symbolCycles = computeSymbolCycles(cachedGraphData.functionCalls);
        if (graphDb) {
            graphDb.updatePageRanks(cachedGraphData.nodes);
            graphDb.replaceSymbolCycles(cachedGraphData.meta.symbolCycles);
            graphDb.save();
        }

        // Sync fan counts from DB for affected nodes
        if (graphDb) {
            for (const id of affectedIds) {
                const dbNode = graphDb.getNodeDetail(id);
                const cachedNode = cachedGraphData.nodes.find(n => n.id === id);
                if (dbNode && cachedNode) {
                    if (cachedNode.fanIn !== dbNode.fan_in || cachedNode.fanOut !== dbNode.fan_out) {
                        cachedNode.fanIn = dbNode.fan_in;
                        cachedNode.fanOut = dbNode.fan_out;
                        if (id !== newInfo.id) {
                            delta.changedNodes.push(cachedNode);
                        }
                    }
                }
            }
        }

        cachedGraphData.meta.totalFiles = cachedGraphData.nodes.length;
        cachedGraphData.meta.totalLinks = cachedGraphData.links.length;
        recomputeDeadCodeMeta(cachedGraphData);
        applyArchitectureToGraph(cachedGraphData);
        delta.meta = cachedGraphData.meta;
        delta.functionCalls = cachedGraphData.functionCalls || [];
        for (const node of rankChanges) {
            if (node.id !== result.node.id && delta.changedNodes.indexOf(node) === -1) {
                delta.changedNodes.push(node);
            }
        }
    }

    if (webviewProvider?.isVisible) {
        webviewProvider.sendGraphDelta(delta as unknown as Record<string, unknown>);
    }

    if (cachedGraphData) {
        treeProvider?.update(cachedGraphData);
        codeLensProvider?.refresh();
    }
    updateStatusBar();
}

interface GraphDelta {
    changedNodes: GraphNode[];
    removedNodeIds: string[];
    addedLinks: GraphLink[];
    removedLinks: { source: string; target: string; type: string }[];
    meta: GraphData['meta'];
    functionCalls?: NonNullable<GraphData['functionCalls']>;
}

function computeGraphDelta(
    oldGraph: GraphData,
    newGraph: GraphData,
    changedFileId: string,
    deleted: boolean
): GraphDelta {
    const delta: GraphDelta = {
        changedNodes: [],
        removedNodeIds: [],
        addedLinks: [],
        removedLinks: [],
        meta: newGraph.meta,
        functionCalls: newGraph.functionCalls || [],
    };

    if (deleted) {
        delta.removedNodeIds.push(changedFileId);
    }

    // Build lookup maps
    const oldNodeMap = new Map(oldGraph.nodes.map(n => [n.id, n]));
    const newNodeMap = new Map(newGraph.nodes.map(n => [n.id, n]));

    // Find changed/added nodes (the changed file itself + any node whose metrics changed)
    for (const node of newGraph.nodes) {
        const oldNode = oldNodeMap.get(node.id);
        if (!oldNode ||
            node.fanIn !== oldNode.fanIn ||
            node.fanOut !== oldNode.fanOut ||
            node.complexity !== oldNode.complexity ||
            node.linesOfCode !== oldNode.linesOfCode ||
            node.size !== oldNode.size) {
            delta.changedNodes.push(node);
        }
    }

    // Find removed nodes (not just the deleted file — could be others if somehow missing)
    for (const node of oldGraph.nodes) {
        if (!newNodeMap.has(node.id)) {
            if (!delta.removedNodeIds.includes(node.id)) {
                delta.removedNodeIds.push(node.id);
            }
        }
    }

    // Compare links
    const linkKey = (l: GraphLink | { source: string; target: string; type: string }) =>
        `${typeof l.source === 'object' ? (l.source as { id: string }).id : l.source}|${typeof l.target === 'object' ? (l.target as { id: string }).id : l.target}|${l.type}`;

    const oldLinkSet = new Set(oldGraph.links.map(linkKey));
    const newLinkSet = new Set(newGraph.links.map(linkKey));

    for (const link of newGraph.links) {
        if (!oldLinkSet.has(linkKey(link))) {
            delta.addedLinks.push(link);
        }
    }

    for (const link of oldGraph.links) {
        if (!newLinkSet.has(linkKey(link))) {
            delta.removedLinks.push({
                source: typeof link.source === 'object' ? (link.source as { id: string }).id : link.source,
                target: typeof link.target === 'object' ? (link.target as { id: string }).id : link.target,
                type: link.type
            });
        }
    }

    return delta;
}

function updateStatusBar(): void {
    invalidateRisk();
    updateArchStatusBar();
    if (!statusBarItem) return;
    if (!cachedGraphData || cachedGraphData.nodes.length === 0) {
        statusBarItem.text = '$(eye) Aura';
        statusBarItem.hide();
        return;
    }
    const { totalFiles, totalLinks } = cachedGraphData.meta;
    statusBarItem.text = `$(eye) Aura: ${totalFiles} files, ${totalLinks} links`;
    statusBarItem.tooltip = `Aura — ${totalFiles} files, ${totalLinks} dependencies\nClick to open 3D visualizer`;
    statusBarItem.show();
}

/**
 * Post-scan summary notification (one per full analysis). Shows the same
 * high-level health figures as the Risk tab and opens it on demand.
 */
async function notifyScanComplete(context: vscode.ExtensionContext): Promise<void> {
    const config = vscode.workspace.getConfiguration('auraVisualizer');
    if (!config.get<boolean>('notifyOnScan', true)) return;
    if (!cachedGraphData || cachedGraphData.nodes.length === 0) return;

    const meta = cachedGraphData.meta;
    const snapshot = ensureRiskSnapshot();
    const hotspots = snapshot ? snapshot.highIds.size : 0;
    const cycles = meta.cycles?.length ?? 0;
    const deadExports = meta.deadExportsTotal ?? 0;
    const exemptions = meta.deadCodeExemptions ?? 0;
    const exemptText = exemptions > 0 ? ` · ${exemptions} exempted` : '';
    const archViolations = meta.arch?.counts.newTotal ?? 0;
    const archText = meta.arch?.configured
        ? ` · ${archViolations} arch violation${archViolations === 1 ? '' : 's'}`
        : '';
    const message = `Aura: ${meta.totalFiles} files · ${cycles} cycles · ${deadExports} dead exports${exemptText} · ${hotspots} hotspots${archText}`;

    const choices = meta.arch?.configured ? ['View Risk', 'View Architecture'] : ['View Risk'];
    const choice = await vscode.window.showInformationMessage(message, ...choices);
    if (choice === 'View Architecture') {
        await focusArchFromStatusBar(context);
        return;
    }
    if (choice !== 'View Risk') return;

    const top = snapshot
        ? Array.from(snapshot.byId.values()).sort((a, b) => b.score - a.score)[0]
        : undefined;
    await focusRiskFromStatusBar(context, top?.id);
}

// ============================================================
// Risk status bar — score of the active file + dirty-hotspots alert
// ============================================================

function invalidateRisk(): void {
    riskSnapshotDirty = true;
    updateRiskStatusBar();
}

/**
 * Recompute temporal coupling from the current commit index and graph.
 * Persists to the DB (MCP tools) and `.aura/history/cochange.json` (portable
 * snapshot for external agents). Non-critical: failures are logged only.
 */
function refreshCochangeFromHistory(): void {
    if (!commitIndex || !cachedGraphData) return;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    try {
        const linkedPairs: [string, string][] = [];
        for (const link of cachedGraphData.links) {
            const source = typeof link.source === 'object' ? (link.source as GraphNode).id : link.source;
            const target = typeof link.target === 'object' ? (link.target as GraphNode).id : link.target;
            if (source && target) linkedPairs.push([source, target]);
        }
        const result = computeCochange(commitIndex.commits, {
            windowDays: 365,
            minCochanges: 2,
            minJaccard: 0.2,
            maxFilesPerCommit: 50,
            maxPairs: 500,
            linkedPairs,
            allowedPaths: cachedGraphData.nodes.map(node => node.id),
        });
        if (graphDb) graphDb.replaceCochange(result.pairs, result.windowDays);

        const payload = {
            windowDays: result.windowDays,
            generatedAt: new Date().toISOString(),
            commitsConsidered: result.commitsConsidered,
            totalCommitsInWindow: result.totalCommitsInWindow,
            maxJaccard: result.maxJaccard,
            pairs: result.pairs,
        };
        const historyDir = path.join(workspaceFolder.uri.fsPath, '.aura', 'history');
        void fs.mkdir(historyDir, { recursive: true })
            .then(() => fs.writeFile(path.join(historyDir, 'cochange.json'), JSON.stringify(payload, null, 2), 'utf-8'))
            .catch(err => console.warn('[aura] cochange snapshot write failed:', err));
    } catch (err) {
        console.warn('[aura] cochange computation failed:', err);
    }
}

function ensureRiskSnapshot(): RiskSnapshot | undefined {
    if (!cachedGraphData || cachedGraphData.nodes.length === 0) return undefined;
    if (!riskSnapshotDirty && riskSnapshot) return riskSnapshot;
    const days = normalizeRiskWindow(
        vscode.workspace.getConfiguration('auraVisualizer').get<number>('riskWindow', 90)
    );
    riskSnapshot = buildRiskSnapshot(
        cachedGraphData.nodes.filter(node => node.language !== 'documentation'),
        commitIndex?.commits ?? [],
        days,
        Date.now(),
        vscode.workspace.getConfiguration('auraVisualizer').get<boolean>('riskCentrality', false) === true,
    );
    riskSnapshotDirty = false;
    return riskSnapshot;
}

function updateRiskStatusBar(): void {
    if (!riskStatusBarItem) return;
    const snapshot = ensureRiskSnapshot();
    if (!snapshot || snapshot.byId.size === 0) {
        riskStatusBarItem.hide();
        return;
    }

    // 1. Working-tree alert — the changes in flight touch high-risk files
    const hotspots = dirtyHotspotIds(snapshot);
    if (hotspots.length > 0) {
        riskStatusBarItem.text = `$(warning) ${hotspots.length} hotspot${hotspots.length > 1 ? 's' : ''} in your changes`;
        const md = new vscode.MarkdownString();
        md.appendMarkdown(`**${hotspots.length} high-risk file${hotspots.length > 1 ? 's' : ''} in your current changes**\n\n`);
        const shown = hotspots.slice(0, 5);
        for (const h of shown) {
            const entry = snapshot.byId.get(h);
            md.appendMarkdown(`- \`${h}\`${entry ? ` — risk ${Math.round(entry.score)}/100` : ''}\n`);
        }
        if (hotspots.length > shown.length) {
            md.appendMarkdown(`\n… and ${hotspots.length - shown.length} more`);
        }
        riskStatusBarItem.tooltip = md;
        riskStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        riskStatusBarItem.command = { command: 'auraVisualizer.statusBarRisk', title: 'Reveal in Risk tab', arguments: [hotspots[0]] };
        riskStatusBarItem.show();
        return;
    }
    riskStatusBarItem.backgroundColor = undefined;

    // 2. Resting state — rank of the file currently being edited
    const ws = vscode.workspace.workspaceFolders?.[0];
    const editor = vscode.window.activeTextEditor;
    if (!ws || !editor) {
        riskStatusBarItem.hide();
        return;
    }
    const rel = path.relative(ws.uri.fsPath, editor.document.uri.fsPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        riskStatusBarItem.hide();
        return;
    }
    const relNorm = rel.split(path.sep).join('/');
    const entry = snapshot.byId.get(relNorm) || snapshot.byId.get(rel);
    if (!entry) {
        riskStatusBarItem.hide();
        return;
    }
    riskStatusBarItem.text = `$(shield) Risk ${Math.round(entry.score)}${entry.topLabel ? ' · ' + entry.topLabel : ''}`;
    riskStatusBarItem.tooltip = buildRiskTooltip(entry, relNorm);
    riskStatusBarItem.command = { command: 'auraVisualizer.statusBarRisk', title: 'Reveal in Risk tab', arguments: [entry.id] };
    riskStatusBarItem.show();
}

function buildRiskTooltip(entry: RiskFileEntry, relPath: string): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**Risk ${Math.round(entry.score)}/100**`);
    if (entry.topLabel) md.appendMarkdown(` — ${entry.topLabel} of this repository`);
    md.appendMarkdown('\n\n');
    for (const r of entry.reasons.slice(0, 5)) {
        md.appendMarkdown(`- ${r.text}\n`);
    }
    md.appendMarkdown(`\n\`${relPath}\` — click to reveal in the Risk tab`);
    return md;
}

// ============================================================
// Architecture status bar — layer + violations of the active file
// ============================================================

function updateArchStatusBar(): void {
    if (!archStatusBarItem) return;
    const ws = vscode.workspace.workspaceFolders?.[0];
    const editor = vscode.window.activeTextEditor;
    if (!ws || !editor || !cachedGraphData || !archRules || editor.document.uri.scheme !== 'file') {
        archStatusBarItem.hide();
        return;
    }
    const rel = path.relative(ws.uri.fsPath, editor.document.uri.fsPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
        archStatusBarItem.hide();
        return;
    }
    const relNorm = rel.split(path.sep).join('/');
    const node = cachedGraphData.nodes.find(n => (n.path || n.id).replace(/\\/g, '/') === relNorm);
    if (!node || node.language === 'documentation') {
        archStatusBarItem.hide();
        return;
    }
    const violations = archEvaluation
        ? archEvaluation.violations.filter(v => !v.baselined && v.source === relNorm)
        : [];
    const baselined = archEvaluation
        ? archEvaluation.violations.filter(v => v.baselined && v.source === relNorm).length
        : 0;
    if (!node.layer && violations.length === 0) {
        if (archRules.strict) {
            archStatusBarItem.text = '$(symbol-structure) unlayered';
            archStatusBarItem.tooltip = 'Strict mode: this file matches no layer in .aura/arch-rules.json.';
            archStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            archStatusBarItem.command = {
                command: 'auraVisualizer.statusBarArch',
                title: 'Reveal in Architecture tab',
                arguments: [relNorm],
            };
            archStatusBarItem.show();
            return;
        }
        archStatusBarItem.hide();
        return;
    }

    const errors = violations.filter(v => v.severity === 'error').length;
    if (violations.length > 0) {
        archStatusBarItem.text = `$(symbol-structure) ${violations.length} arch violation${violations.length === 1 ? '' : 's'}`;
    } else {
        archStatusBarItem.text = `$(symbol-structure) ${node.layer}`;
    }

    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**Layer: ${node.layer || 'unlayered'}**\n\n`);
    if (violations.length > 0) {
        for (const violation of violations.slice(0, 6)) {
            md.appendMarkdown(`- \`${violation.ruleId}\`: ${violation.sourceGroup || '?'} → ${violation.targetGroup || '?'} \`${violation.linkTypes.join(', ')}\`\n`);
            md.appendMarkdown(`  ${violation.target}\n`);
        }
        if (violations.length > 6) md.appendMarkdown(`\n… and ${violations.length - 6} more`);
    } else {
        md.appendMarkdown('No violation where this file is the source.\n');
    }
    if (baselined > 0) {
        md.appendMarkdown(`\n${baselined} baselined violation${baselined === 1 ? '' : 's'} (not alerting).`);
    }
    md.appendMarkdown('\n\nClick to reveal in the Architecture tab.');
    archStatusBarItem.tooltip = md;
    archStatusBarItem.backgroundColor = errors > 0
        ? new vscode.ThemeColor('statusBarItem.errorBackground')
        : (violations.length > 0 ? new vscode.ThemeColor('statusBarItem.warningBackground') : undefined);
    archStatusBarItem.command = {
        command: 'auraVisualizer.statusBarArch',
        title: 'Reveal in Architecture tab',
        arguments: [relNorm],
    };
    archStatusBarItem.show();
}

/** Map a git (repo-relative) path to a workspace-relative, slash-separated path. */
function toWorkspaceRelative(repoRelative: string): string | undefined {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws || !gitRepoRoot) return undefined;
    const rel = path.relative(ws.uri.fsPath, path.join(gitRepoRoot, repoRelative));
    if (rel.startsWith('..') || path.isAbsolute(rel)) return undefined;
    return rel.split(path.sep).join('/');
}

/** High-risk files that appear in the working tree right now, most risky first. */
function dirtyHotspotIds(snapshot: RiskSnapshot): string[] {
    if (workingTreeFiles.size === 0) return [];
    const ids: string[] = [];
    for (const repoRel of workingTreeFiles.keys()) {
        const wsRel = toWorkspaceRelative(repoRel);
        if (wsRel && snapshot.highIds.has(wsRel)) ids.push(wsRel);
    }
    ids.sort((a, b) => (snapshot.byId.get(b)?.score ?? 0) - (snapshot.byId.get(a)?.score ?? 0));
    return ids;
}

/** Working-tree state keyed by workspace-relative path (the ids used by the graph). */
function buildWorkingTreePayload(): Record<string, GitFileState> {
    const files: Record<string, GitFileState> = {};
    for (const [repoRel, state] of workingTreeFiles) {
        const wsRel = toWorkspaceRelative(repoRel);
        if (wsRel) files[wsRel] = state;
    }
    return files;
}

let lastWorkingTreeJson: string | undefined;

function pushWorkingTreeToWebview(): void {
    const payload = buildWorkingTreePayload();
    const json = JSON.stringify(payload);
    // Git operations fire several watcher events (index, HEAD, refs) — skip
    // the webview round-trip and ring rebuild when nothing actually changed.
    if (json === lastWorkingTreeJson) return;
    lastWorkingTreeJson = json;
    webviewProvider?.sendWorkingTree(payload);
}

/** Host data the webview pulls on ready / for chat tool calls. */
function hostDataAccessors() {
    return {
        riskSnapshot: () => ensureRiskSnapshot(),
        workingTree: () => buildWorkingTreePayload() as Record<string, string>,
    };
}

async function refreshWorkingTree(): Promise<void> {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
        workingTreeFiles = new Map();
        pushWorkingTreeToWebview();
        updateRiskStatusBar();
        return;
    }
    try {
        if (gitRepoRoot === undefined) {
            try {
                gitRepoRoot = await getGitRoot(ws.uri.fsPath);
            } catch {
                gitRepoRoot = ''; // not a git repo — don't probe again
            }
        }
        workingTreeFiles = gitRepoRoot ? await getWorkingTreeFiles(ws.uri.fsPath) : new Map();
    } catch {
        workingTreeFiles = new Map();
    }
    pushWorkingTreeToWebview();
    updateRiskStatusBar();
}

function scheduleWorkingTreeRefresh(): void {
    if (workingTreeTimer) clearTimeout(workingTreeTimer);
    workingTreeTimer = setTimeout(() => { void refreshWorkingTree(); }, 300);
}

async function focusRiskFromStatusBar(context: vscode.ExtensionContext, nodeId?: string): Promise<void> {
    const wasOpen = webviewProvider?.isOpen ?? false;
    if (!webviewProvider) {
        webviewProvider = new WebviewProvider(context.extensionUri, context.workspaceState, () => graphDb, hostDataAccessors());
        registerOpenFileHandler();
    }
    webviewProvider.show();
    if (!wasOpen && cachedGraphData) {
        webviewProvider.sendGraphData(cachedGraphData);
        if (commitIndex) {
            webviewProvider.sendHistoryIndex(commitIndex);
            for (const delta of cachedDeltas) {
                webviewProvider.sendHistoryDelta(delta);
            }
        }
    }
    if (nodeId) {
        webviewProvider.focusRiskFile(nodeId);
    } else {
        webviewProvider.showRiskTab();
    }
}

async function focusArchFromStatusBar(context: vscode.ExtensionContext, nodeId?: string): Promise<void> {
    const wasOpen = webviewProvider?.isOpen ?? false;
    if (!webviewProvider) {
        webviewProvider = new WebviewProvider(context.extensionUri, context.workspaceState, () => graphDb, hostDataAccessors());
        registerOpenFileHandler();
    }
    webviewProvider.show();
    if (!wasOpen && cachedGraphData) {
        webviewProvider.sendGraphData(cachedGraphData);
        if (commitIndex) {
            webviewProvider.sendHistoryIndex(commitIndex);
            for (const delta of cachedDeltas) {
                webviewProvider.sendHistoryDelta(delta);
            }
        }
    }
    if (nodeId) {
        webviewProvider.focusArchFile(nodeId);
    } else {
        webviewProvider.showArchTab();
    }
}

// ============================================================
// Time Travel — Git History Scan
// ============================================================
async function startHistoryScan(
    context: vscode.ExtensionContext,
    rootPath: string,
    excludePaths: string[]
): Promise<void> {
    // Only scan if it's a git repo
    const isGit = await isGitRepo(rootPath);
    if (!isGit) return;

    // Kill previous worker if running
    if (historyWorker) {
        historyWorker.terminate();
        historyWorker = undefined;
    }
    cachedDeltas = [];

    const historyDir = path.join(rootPath, '.aura', 'history');
    const workerPath = path.join(context.extensionUri.fsPath, 'out', 'history-worker.js');

    historyWorker = new Worker(workerPath, {
        execArgv: [],
        workerData: {
            rootPath,
            skipDirs: excludePaths,
            historyDir
        }
    });

    historyWorker.on('message', (msg: {
        type: string;
        payload?: CommitIndex | CommitDelta | { scanned: number; total: number };
        message?: string;
    }) => {
        switch (msg.type) {
            case 'index':
                commitIndex = msg.payload as CommitIndex;
                invalidateRisk();
                refreshCochangeFromHistory();
                // Send to webview so it can show the timeline
                if (webviewProvider) {
                    webviewProvider.sendHistoryIndex(commitIndex);
                }
                break;

            case 'progress': {
                const progress = msg.payload as { scanned: number; total: number };
                if (webviewProvider) {
                    webviewProvider.sendHistoryProgress(progress.scanned, progress.total);
                }
                break;
            }

            case 'delta': {
                const delta = msg.payload as CommitDelta;
                cachedDeltas.push(delta);
                if (webviewProvider) {
                    webviewProvider.sendHistoryDelta(delta);
                }
                break;
            }

            case 'done':
                // Scan complete
                break;

            case 'error':
                // Silently ignore — not all workspaces are git repos
                break;
        }
    });

    historyWorker.on('error', () => {
        // Worker crashed — non-critical feature, just log
    });

    historyWorker.on('exit', () => {
        historyWorker = undefined;
    });
}

function focusCurrentFile(): void {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !webviewProvider?.isVisible) return;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const relativePath = path.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);
    if (!relativePath.startsWith('..')) {
        webviewProvider.focusNode(relativePath, true);
    }
}

/** Short, log-safe description of what a menu handed the command (support aid). */
function describeCommandArgument(value: unknown): unknown {
    if (value === undefined || value === null) return value;
    if (typeof value === 'string') return value.length > 120 ? value.slice(0, 120) + '…' : value;
    if (Array.isArray(value)) return value.slice(0, 3).map(describeCommandArgument);
    if (typeof value !== 'object') return typeof value;
    const record = value as Record<string, unknown>;
    const resourceUri = record.resourceUri as { fsPath?: string; scheme?: string } | undefined;
    return {
        keys: Object.keys(record).slice(0, 8),
        fsPath: typeof record.fsPath === 'string' ? record.fsPath : undefined,
        scheme: typeof record.scheme === 'string' ? record.scheme : undefined,
        resourceUri: resourceUri && typeof resourceUri === 'object'
            ? { fsPath: resourceUri.fsPath, scheme: resourceUri.scheme }
            : undefined,
    };
}

/**
 * Blast radius for one or several resources (V3-02).
 *
 * Called by the Source Control / editor title / editor / explorer menus (they
 * pass a `Uri` or a `SourceControlResourceState`, SCM also passes the whole
 * selection as a second argument) and by the command palette without an
 * argument, where it falls back to the active editor. Files outside the
 * workspace or outside the analyzed graph are ignored; when nothing matches,
 * the panel is not opened at all.
 */
async function blastRadiusFromResources(
    context: vscode.ExtensionContext,
    argument?: unknown,
    selection?: unknown,
): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const targets = collectBlastTargets(
        argument,
        selection,
        vscode.window.activeTextEditor?.document.uri,
        workspaceFolder?.uri.fsPath,
        cachedGraphData?.nodes.map(node => node.id),
    );

    if (!targets.ids.length) {
        if (!workspaceFolder) return;
        console.log('[aura] blastRadius: nothing to blast', JSON.stringify({
            argument: describeCommandArgument(argument),
            selection: Array.isArray(selection) ? selection.length : typeof selection,
            targets,
        }));
        if (cachedGraphData) {
            void vscode.window.showInformationMessage(
                'Aura: no analyzed file in the selection — open the graph once so the file is part of the analysis.',
            );
        }
        return;
    }

    await openVisualizer(context);
    // The provider queues the message until the webview has rendered a graph
    // (cold start: the panel is created before the analysis finishes).
    webviewProvider?.sendBlastRadius(targets.ids);
}

async function exportMetrics(): Promise<void> {
    if (!cachedGraphData) {
        vscode.window.showWarningMessage('Aura: No graph data. Run analysis first (Ctrl+Shift+A).');
        return;
    }
    const snapshot = ensureRiskSnapshot();
    const rows: MetricsRow[] = cachedGraphData.nodes.map(node => {
        const risk = snapshot?.byId.get(node.id);
        return {
            file: node.id,
            name: node.name,
            language: node.language,
            group: node.group,
            lines: node.linesOfCode,
            complexity: node.complexity,
            cognitive: node.cognitive,
            fanIn: node.fanIn,
            fanOut: node.fanOut,
            churn: risk?.churn ?? 0,
            authors: risk?.authorCount ?? 0,
            riskScore: risk?.score ?? null,
            riskBucket: risk?.bucket ?? null,
        };
    });
    const format = await vscode.window.showQuickPick(
        [
            { label: 'CSV', description: 'Spreadsheet-friendly, stable columns', value: 'csv' as const },
            { label: 'JSON', description: 'Versioned envelope with rows and columns', value: 'json' as const },
        ],
        { placeHolder: 'Aura: metrics export format' },
    );
    if (!format) return;
    if (format.value === 'csv') {
        await saveOrCopyText('Metrics CSV', metricsToCsv(rows), 'metrics.csv', { CSV: ['csv'] });
    } else {
        await saveOrCopyText('Metrics JSON', metricsToJson(rows), 'metrics.json', { JSON: ['json'] });
    }
}

async function exportArchReport(includeAiNarrative = false): Promise<void> {
    if (!cachedGraphData) {
        vscode.window.showWarningMessage('Aura: No graph data. Run analysis first (Ctrl+Shift+A).');
        return;
    }
    const report = generateArchReport(buildArchReportInput(cachedGraphData, archReportExtras()), {
        maxLines: 400,
        includePaths: true,
    });
    const narrative = includeAiNarrative
        ? await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Aura: generating AI architecture narrative…',
                cancellable: true,
            },
            (_progress, token) => generateArchitectureNarrative(report, token),
        )
        : undefined;
    if (includeAiNarrative && !narrative) {
        void vscode.window.showWarningMessage('Aura: AI narrative unavailable — exporting the deterministic report only.');
    }
    const finalReport = narrative ? withAiNarrative(report, narrative) : report;
    if (includeAiNarrative) {
        await saveText('Architecture report', finalReport, {
            fileName: 'architecture.md',
            askLocation: true,
            filters: { Markdown: ['md'] },
        });
    } else {
        await saveOrCopyText('Architecture report', finalReport, 'architecture.md', { Markdown: ['md'] });
    }
}

function archReportExtras(): ArchReportExtras {
    if (!graphDb) return {};
    try {
        const groups = new Map<number, string[]>();
        for (const community of graphDb.getCommunities()) {
            const files = groups.get(community.community) || [];
            files.push(community.nodeId);
            groups.set(community.community, files);
        }
        const modules: ArchReportModule[] = Array.from(groups.entries())
            .map(([id, files]) => ({
                id,
                name: files.reduce((best, file) => {
                    const name = file.replace(/.*\//, '');
                    return name.length < best.length ? name : best;
                }, files[0] || '?').replace(/\.[^.]+$/, ''),
                files,
                size: files.length,
            }))
            .sort((a, b) => b.size - a.size);
        return {
            modules,
            cycles: graphDb.getCycles(),
            deadCode: graphDb.getDeadCode().map(d => ({ file: d.nodeId, symbol: d.symbol, kind: d.kind })),
            hotspots: graphDb.getHotspots(20, 'impact').map(h => ({
                file: h.id,
                lines: h.lines,
                complexity: h.complexity,
                fanIn: h.fan_in,
                fanOut: h.fan_out,
                impact: h.impact_score,
            })),
        };
    } catch (err) {
        console.warn('[aura] architecture report data unavailable:', err);
        return {};
    }
}

async function exportGraphImage(context: vscode.ExtensionContext): Promise<void> {
    if (!cachedGraphData) {
        vscode.window.showWarningMessage('Aura: No graph data. Run analysis first (Ctrl+Shift+A).');
        return;
    }
    if (!webviewProvider) await openVisualizer(context);
    if (!webviewProvider) return;

    const resolution = await vscode.window.showQuickPick(
        [
            { label: 'PNG ×2', description: 'Recommended — sharp and reasonably small', value: 2 },
            { label: 'PNG ×4', description: 'Maximum detail — larger file', value: 4 },
            { label: 'PNG ×1', description: 'Screen resolution', value: 1 },
        ],
        { placeHolder: 'Aura: PNG resolution' },
    );
    if (!resolution) return;
    const background = await vscode.window.showQuickPick(
        [
            { label: 'Current background', value: 'current' as const },
            { label: 'Transparent background', value: 'transparent' as const },
        ],
        { placeHolder: 'Aura: PNG background' },
    );
    if (!background) return;
    const watermark = await vscode.window.showQuickPick(
        [
            { label: 'No watermark', value: false },
            { label: 'Aura watermark', value: true },
        ],
        { placeHolder: 'Aura: watermark' },
    );
    if (!watermark) return;

    webviewProvider.captureGraphImage({
        scale: resolution.value,
        background: background.value,
        watermark: watermark.value,
    });
}

async function exportGraph(): Promise<void> {
    if (!cachedGraphData) {
        vscode.window.showWarningMessage('Aura: No graph data. Run analysis first (Ctrl+Shift+A).');
        return;
    }

    const format = await vscode.window.showQuickPick(
        [
            { label: 'Markdown', description: 'Readable architecture briefing for a chat prompt', value: 'markdown' as const },
            { label: 'JSON', description: 'Structured sections for tools and agents', value: 'json' as const },
        ],
        { placeHolder: 'Aura: AI context format' },
    );
    if (!format) return;

    const sectionChoices: Array<vscode.QuickPickItem & { id: AiExportSection }> = [
        { id: 'modules', label: 'Modules', description: 'Modules, key files and inter-module dependencies', picked: true },
        { id: 'contracts', label: 'Contracts', description: 'Public symbols, exported APIs and header declarations', picked: true },
        { id: 'hotspots', label: 'Hotspots', description: 'Highest-impact files with metrics and reasons', picked: true },
        { id: 'cycles', label: 'Cycles', description: 'Circular dependencies', picked: true },
        { id: 'deadCode', label: 'Dead code', description: 'Unused exports and symbols', picked: true },
    ];
    const selected = await vscode.window.showQuickPick(sectionChoices, {
        canPickMany: true,
        placeHolder: 'Aura: sections to include in the AI context',
    });
    if (!selected || selected.length === 0) {
        vscode.window.showWarningMessage('Aura: Select at least one section to export.');
        return;
    }

    const budget = await vscode.window.showQuickPick(
        [
            { label: '4,000 tokens', description: 'Recommended — enough context for most prompts', value: 4000 },
            { label: '2,000 tokens', description: 'Compact — quick architecture summary', value: 2000 },
            { label: '8,000 tokens', description: 'Detailed — more modules, contracts and hotspots', value: 8000 },
            { label: '16,000 tokens', description: 'Large context window', value: 16000 },
            { label: 'No limit', description: 'Everything (may exceed a model context window)', value: 0 },
        ],
        { placeHolder: 'Aura: token budget' },
    );
    if (!budget) return;

    const input = buildAiExportInput(cachedGraphData, archReportExtras());
    const content = generateAiExport(input, {
        format: format.value,
        sections: selected.map(item => item.id),
        tokenBudget: budget.value,
        generatedAt: new Date().toISOString(),
    });
    const isMarkdown = format.value === 'markdown';
    await saveOrCopyText(
        isMarkdown ? 'AI context (Markdown)' : 'AI context (JSON)',
        content,
        isMarkdown ? 'ai-context.md' : 'ai-context.json',
        isMarkdown ? { Markdown: ['md'] } : { JSON: ['json'] },
    );
}

function setupFileWatcher(context: vscode.ExtensionContext): void {
    const config = vscode.workspace.getConfiguration('auraVisualizer');
    const autoRefresh = config.get<boolean>('autoRefresh', true);
    if (!autoRefresh) return;

    fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{c,h,js,ts,py,css,html}');

    let pendingUpdates = new Map<string, { uri: vscode.Uri; deleted: boolean }>();

    const flushUpdates = () => {
        if (refreshTimeout) clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(async () => {
            const updates = new Map(pendingUpdates);
            pendingUpdates.clear();

            if (cachedFiles.length === 0) {
                // No cached files yet — do a full analysis
                if (webviewProvider?.isVisible) {
                    refreshAnalysis(context);
                } else {
                    cachedGraphData = undefined;
                }
                return;
            }

            // Apply incremental updates
            for (const [, update] of updates) {
                await incrementalUpdate(update.uri, update.deleted);
            }
        }, 500);
    };

    fileWatcher.onDidChange(uri => {
        pendingUpdates.set(uri.fsPath, { uri, deleted: false });
        flushUpdates();
    });
    fileWatcher.onDidCreate(uri => {
        pendingUpdates.set(uri.fsPath, { uri, deleted: false });
        flushUpdates();
    });
    fileWatcher.onDidDelete(uri => {
        pendingUpdates.set(uri.fsPath, { uri, deleted: true });
        flushUpdates();
    });

    context.subscriptions.push(fileWatcher);
}

/**
 * Rules and baseline are configuration side files. Re-evaluate them on save
 * without re-parsing the project: evaluation is O(nodes + edges).
 */
function setupArchitectureWatcher(context: vscode.ExtensionContext): void {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = undefined;
            reloadArchitecture();
        }, 250);
    };
    for (const glob of ['**/.aura/arch-rules.json', '**/.aura/arch-baseline.json']) {
        const watcher = vscode.workspace.createFileSystemWatcher(glob);
        watcher.onDidChange(schedule);
        watcher.onDidCreate(schedule);
        watcher.onDidDelete(schedule);
        context.subscriptions.push(watcher);
    }
    context.subscriptions.push({ dispose: () => { if (timer) clearTimeout(timer); } });
}

/**
 * Watch `.git` for state changes and refresh the working-tree overlay. A commit
 * or a `git add` leaves every source file untouched, so the workspace watcher
 * never fires for them — without this, dirty rings stayed stale until the next
 * file save. The default `files.watcherExclude` keeps the churny parts
 * (.git/objects, subtree-cache) out, so only index/HEAD/refs events arrive.
 */
function setupGitStateWatcher(context: vscode.ExtensionContext): void {
    const gitWatcher = vscode.workspace.createFileSystemWatcher('**/.git/**');
    const schedule = () => scheduleWorkingTreeRefresh();
    gitWatcher.onDidChange(schedule);
    gitWatcher.onDidCreate(schedule);
    gitWatcher.onDidDelete(schedule);
    context.subscriptions.push(gitWatcher);
}

export function deactivate(): void {
    webviewProvider?.dispose();
    fileWatcher?.dispose();
    codeLensProvider?.dispose();
    codeLensProvider = undefined;
    hoverProvider?.dispose();
    hoverProvider = undefined;
    if (refreshTimeout) clearTimeout(refreshTimeout);
    if (workingTreeTimer) clearTimeout(workingTreeTimer);
    if (startupWorkingTreeTimer) clearTimeout(startupWorkingTreeTimer);
    if (historyWorker) {
        historyWorker.terminate();
        historyWorker = undefined;
    }
    if (graphDb) {
        graphDb.close();
        graphDb = undefined;
    }
}
