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
import { analyzeCodebase, scanSingleFile, buildGraph, preParseFiles, rebuildSingleFile, buildIncrementalContext, restoreIncrementalContext, type GraphData, type GraphNode, type GraphLink, type FileInfo, type IncrementalContext } from './analyzer/index';
import { isGitRepo } from './analyzer/git-history';
import type { CommitIndex, CommitDelta } from './analyzer/types';
import { GraphDB } from './graph-db';

let webviewProvider: WebviewProvider | undefined;
let cachedGraphData: GraphData | undefined;
let cachedFiles: FileInfo[] = [];
let historyWorker: Worker | undefined;
let commitIndex: CommitIndex | undefined;
let cachedDeltas: CommitDelta[] = [];
let fileWatcher: vscode.FileSystemWatcher | undefined;
let statusBarItem: vscode.StatusBarItem | undefined;
let refreshTimeout: ReturnType<typeof setTimeout> | undefined;
let treeProvider: AuraTreeProvider | undefined;
let isAnalyzing = false;
let graphDb: GraphDB | undefined;
let incrementalCtx: IncrementalContext | undefined;

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
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('auraVisualizer.open', () => openVisualizer(context)),
        vscode.commands.registerCommand('auraVisualizer.refresh', () => refreshAnalysis(context)),
        vscode.commands.registerCommand('auraVisualizer.focusFile', () => focusCurrentFile()),
        vscode.commands.registerCommand('auraVisualizer.openFileFromTree', (relativePath: string) => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) return;
            const fullPath = path.join(workspaceFolder.uri.fsPath, relativePath);
            vscode.window.showTextDocument(vscode.Uri.file(fullPath), { preview: true });
        }),
        vscode.commands.registerCommand('auraVisualizer.exportGraph', () => exportGraph()),
        vscode.commands.registerCommand('auraVisualizer.blastRadius', () => blastRadiusCurrentFile(context))
    );

    // Watch for file changes (incremental)
    setupFileWatcher(context);

    // Sync active editor
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && webviewProvider?.isVisible) {
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                if (workspaceFolder) {
                    const relativePath = path.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);
                    if (!relativePath.startsWith('..')) {
                        webviewProvider.focusNode(relativePath);
                    }
                }
            }
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
                webviewProvider = new WebviewProvider(context.extensionUri, context.workspaceState);
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

    if (existsSync(dbPath)) {
        try {
            if (!graphDb) {
                graphDb = new GraphDB();
                await graphDb.open(dbPath);
            }
            const cached = graphDb.exportGraphData();
            if (cached && cached.nodes.length > 0) {
                cachedGraphData = cached;
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

    // Always run full analysis in background to pick up changes
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
    if (!webviewProvider) {
        webviewProvider = new WebviewProvider(context.extensionUri, context.workspaceState);
        registerOpenFileHandler();


    }

    webviewProvider.show();

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

async function refreshAnalysis(context: vscode.ExtensionContext): Promise<void> {
    if (isAnalyzing) return;
    isAnalyzing = true;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        isAnalyzing = false;
        vscode.window.showWarningMessage('Aura: No workspace folder open.');
        return;
    }

    const rootPath = workspaceFolder.uri.fsPath;
    const config = vscode.workspace.getConfiguration('auraVisualizer');
    const excludePaths = config.get<string[]>('excludePaths', [
        'node_modules', '.git', 'dist', 'build', 'out', '__pycache__'
    ]);

    if (statusBarItem) {
        statusBarItem.text = '$(loading~spin) Aura: Analyzing...';
    }

    try {
        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Window,
                title: 'Aura: Analyzing codebase...'
            },
            () => runAnalysisInWorker(context.extensionUri, rootPath, excludePaths, workspaceFolder.name)
        );

        const oldGraphData = cachedGraphData;

        cachedGraphData = result.graphData;
        cachedFiles = result.files;
        // Restore incremental context from already-computed graph data (no re-parsing)
        incrementalCtx = restoreIncrementalContext(cachedFiles, cachedGraphData);

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
        updateStatusBar();

        // Persist graph to SQLite
        try {
            if (!graphDb) {
                graphDb = new GraphDB();
                const dbDir = path.join(rootPath, '.aura');
                await fs.mkdir(dbDir, { recursive: true });
                await graphDb.open(path.join(dbDir, 'graph.db'));
            }
            graphDb.importGraphData(cachedGraphData);

            // Auto-register MCP server config
            await registerMcpServer(context, rootPath);
        } catch (dbErr) {
            // Non-critical — log and continue
            console.error('[aura] GraphDB import error:', dbErr);
        }

        // Launch Time Travel history scan in background
        startHistoryScan(context, rootPath, excludePaths);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Aura: Analysis failed — ${message}`);
        if (statusBarItem) {
            statusBarItem.text = '$(eye) Aura';
        }
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
    projectName: string
): Promise<{ graphData: GraphData; files: FileInfo[] }> {
    return new Promise((resolve, reject) => {
        const workerPath = path.join(extensionUri.fsPath, 'out', 'analyzer-worker.js');
        const worker = new Worker(workerPath, {
            workerData: {
                rootPath,
                skipDirs: excludePaths,
                projectName,
            },
        });

        worker.on('message', (msg: { graphData?: GraphData; files?: FileInfo[]; error?: string; progress?: { phase: string; message: string } }) => {
            if (msg.progress) {
                webviewProvider?.sendProgress(msg.progress.phase, msg.progress.message);
                return;
            }
            if (msg.error) {
                reject(new Error(msg.error));
            } else {
                resolve({ graphData: msg.graphData!, files: msg.files! });
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
        if (graphDb) {
            graphDb.deleteNode(relativePath);
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
            cachedGraphData.meta.totalFiles = cachedGraphData.nodes.length;
            cachedGraphData.meta.totalLinks = cachedGraphData.links.length;

            if (webviewProvider?.isVisible) {
                const delta: GraphDelta = {
                    changedNodes: [],
                    removedNodeIds: [relativePath],
                    addedLinks: [],
                    removedLinks,
                    meta: cachedGraphData.meta,
                    functionCalls: cachedGraphData.functionCalls || [],
                };
                webviewProvider.sendGraphDelta(delta as unknown as Record<string, unknown>);
            }
        }
        treeProvider?.update(cachedGraphData);
        updateStatusBar();
        return;
    }

    // -- File changed or created --
    const newInfo = await scanSingleFile(fileUri.fsPath, rootPath);
    if (!newInfo) return;

    const idx = cachedFiles.findIndex(f => f.id === relativePath);
    if (idx >= 0) cachedFiles[idx] = newInfo;
    else cachedFiles.push(newInfo);

    // Build incremental context if missing (shouldn't happen — refreshAnalysis builds it)
    if (!incrementalCtx) {
        incrementalCtx = restoreIncrementalContext(cachedFiles, cachedGraphData!);
    }

    // Pre-parse single file
    const trees = await preParseFiles([newInfo]);
    const tree = trees.get(newInfo.id);

    // Get old outgoing edge targets (for fan-count recalculation)
    const oldOutEdges = cachedGraphData
        ? cachedGraphData.links.filter(l => l.source === newInfo.id)
        : [];
    const oldTargets = oldOutEdges.map(e => e.target);

    // Rebuild single file
    const result = rebuildSingleFile(newInfo, incrementalCtx, tree);
    const newTargets = result.outEdges.map(e => e.target);
    const affectedIds = [...new Set([newInfo.id, ...oldTargets, ...newTargets])];

    // Update DB
    if (graphDb) {
        graphDb.replaceFileData(newInfo.id, result.node, result.outEdges, result.callSites);
        graphDb.updateFanCounts(affectedIds);
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

        const existingCalls = cachedGraphData.functionCalls || [];
        cachedGraphData.functionCalls = existingCalls
            .filter(fc => fc.callerFile !== newInfo.id)
            .concat(result.callSites);

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
        delta.meta = cachedGraphData.meta;
        delta.functionCalls = cachedGraphData.functionCalls || [];
    }

    if (webviewProvider?.isVisible) {
        webviewProvider.sendGraphDelta(delta as unknown as Record<string, unknown>);
    }

    treeProvider?.update(cachedGraphData);
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
    if (!statusBarItem || !cachedGraphData) return;
    const { totalFiles, totalLinks } = cachedGraphData.meta;
    statusBarItem.text = `$(eye) Aura: ${totalFiles} files, ${totalLinks} links`;
    statusBarItem.tooltip = `Aura — ${totalFiles} files, ${totalLinks} dependencies\nClick to open 3D visualizer`;
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
        webviewProvider.focusNode(relativePath);
    }
}

async function blastRadiusCurrentFile(context: vscode.ExtensionContext): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!editor || !workspaceFolder) return;

    const relativePath = path.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);
    if (relativePath.startsWith('..')) return;

    if (!webviewProvider) {
        webviewProvider = new WebviewProvider(context.extensionUri, context.workspaceState);
        registerOpenFileHandler();
    }
    webviewProvider.show();
    if (cachedGraphData) {
        webviewProvider.sendGraphData(cachedGraphData);
        if (commitIndex) {
            webviewProvider.sendHistoryIndex(commitIndex);
            for (const delta of cachedDeltas) {
                webviewProvider.sendHistoryDelta(delta);
            }
        }
    }
    // Small delay to ensure graph is initialized before blast
    setTimeout(() => webviewProvider?.sendBlastRadius(relativePath), 300);
}

async function exportGraph(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('Aura: No workspace folder open.');
        return;
    }
    if (!cachedGraphData) {
        vscode.window.showWarningMessage('Aura: No graph data. Run analysis first (Ctrl+Shift+A).');
        return;
    }

    const auraDir = path.join(workspaceFolder.uri.fsPath, '.aura');
    await fs.mkdir(auraDir, { recursive: true });

    const graph = cachedGraphData;

    // 1. Export graph.json (nodes without heavy content, + links + meta)
    const graphJson = {
        meta: graph.meta,
        nodes: graph.nodes.map(n => ({
            id: n.id,
            name: n.name,
            path: n.path,
            language: n.language,
            extension: n.extension,
            size: n.size,
            linesOfCode: n.linesOfCode,
            group: n.group,
            fanIn: n.fanIn,
            fanOut: n.fanOut,
            complexity: n.complexity
        })),
        links: graph.links.map(l => ({
            source: l.source,
            target: l.target,
            type: l.type,
            label: l.label
        }))
    };
    await fs.writeFile(
        path.join(auraDir, 'graph.json'),
        JSON.stringify(graphJson, null, 2),
        'utf-8'
    );

    // 2. Generate summary.md
    const summary = generateSummary(graph);
    await fs.writeFile(path.join(auraDir, 'summary.md'), summary, 'utf-8');

    vscode.window.showInformationMessage(
        `Aura: Exported to .aura/ — graph.json + summary.md`,
        'Open summary'
    ).then(choice => {
        if (choice === 'Open summary') {
            vscode.window.showTextDocument(
                vscode.Uri.file(path.join(auraDir, 'summary.md')),
                { preview: true }
            );
        }
    });
}

function generateSummary(graph: GraphData): string {
    const { meta, nodes, links } = graph;
    const lines: string[] = [];

    lines.push(`# Aura Graph — ${meta.projectName}`);
    lines.push(`> Auto-generated by Aura Visualizer on ${meta.analyzedAt}`);
    lines.push(`> This file describes the codebase architecture for AI-assisted development.`);
    lines.push('');

    // Overview
    lines.push('## Overview');
    lines.push(`- **${meta.totalFiles}** files, **${meta.totalLinks}** dependencies`);
    const langs = Object.entries(meta.languageStats)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([lang, s]) => `${lang} (${s.count} files, ${s.totalLOC} LOC)`);
    lines.push(`- Languages: ${langs.join(', ')}`);
    if (meta.unresolvedReferences > 0) {
        lines.push(`- Unresolved references: ${meta.unresolvedReferences}`);
    }
    lines.push('');

    // Groups / directories
    if (meta.groups.length > 0) {
        lines.push('## Directory Structure');
        for (const g of meta.groups) {
            const groupFiles = nodes.filter(n => n.group === g);
            const totalLOC = groupFiles.reduce((s, n) => s + n.linesOfCode, 0);
            lines.push(`- \`${g}/\` — ${groupFiles.length} files, ${totalLOC} LOC`);
        }
        lines.push('');
    }

    // Hotspots — high fan-in
    const highFanIn = [...nodes].sort((a, b) => b.fanIn - a.fanIn).slice(0, 15).filter(n => n.fanIn > 0);
    if (highFanIn.length > 0) {
        lines.push('## Hotspots (most depended-on files)');
        lines.push('| File | Fan-in | Fan-out | Complexity | LOC |');
        lines.push('|------|--------|---------|------------|-----|');
        for (const n of highFanIn) {
            lines.push(`| \`${n.id}\` | ${n.fanIn} | ${n.fanOut} | ${n.complexity} | ${n.linesOfCode} |`);
        }
        lines.push('');
    }

    // Most complex files
    const complex = [...nodes].sort((a, b) => b.complexity - a.complexity).slice(0, 10).filter(n => n.complexity > 1);
    if (complex.length > 0) {
        lines.push('## Most Complex Files');
        lines.push('| File | Complexity | LOC | Fan-in | Fan-out |');
        lines.push('|------|------------|-----|--------|---------|');
        for (const n of complex) {
            lines.push(`| \`${n.id}\` | ${n.complexity} | ${n.linesOfCode} | ${n.fanIn} | ${n.fanOut} |`);
        }
        lines.push('');
    }

    // Largest files
    const largest = [...nodes].sort((a, b) => b.linesOfCode - a.linesOfCode).slice(0, 10);
    if (largest.length > 0) {
        lines.push('## Largest Files');
        lines.push('| File | LOC | Complexity | Language |');
        lines.push('|------|-----|------------|----------|');
        for (const n of largest) {
            lines.push(`| \`${n.id}\` | ${n.linesOfCode} | ${n.complexity} | ${n.language} |`);
        }
        lines.push('');
    }

    // Orphan files (no dependencies in or out)
    const orphans = nodes.filter(n => n.fanIn === 0 && n.fanOut === 0);
    if (orphans.length > 0) {
        lines.push('## Orphan Files (no dependencies)');
        for (const n of orphans) {
            lines.push(`- \`${n.id}\` (${n.language}, ${n.linesOfCode} LOC)`);
        }
        lines.push('');
    }

    // Circular dependencies detection
    const circularPairs: string[] = [];
    const linkSet = new Set(links.map(l => `${l.source}→${l.target}`));
    for (const l of links) {
        const reverse = `${l.target}→${l.source}`;
        if (linkSet.has(reverse) && l.source < l.target) {
            circularPairs.push(`\`${l.source}\` ↔ \`${l.target}\``);
        }
    }
    if (circularPairs.length > 0) {
        lines.push('## Circular Dependencies');
        for (const pair of circularPairs) {
            lines.push(`- ${pair}`);
        }
        lines.push('');
    }

    // Dependency types breakdown
    const typeCounts: Record<string, number> = {};
    for (const l of links) {
        typeCounts[l.type] = (typeCounts[l.type] || 0) + 1;
    }
    if (Object.keys(typeCounts).length > 0) {
        lines.push('## Dependency Types');
        for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
            lines.push(`- **${type}**: ${count}`);
        }
        lines.push('');
    }

    // AI instructions
    lines.push('## Usage Notes for AI Agents');
    lines.push('- Files with high fan-in are **critical hubs** — changes impact many dependents.');
    lines.push('- Check circular dependencies before refactoring — break cycles where possible.');
    lines.push('- Orphan files may be dead code candidates for cleanup.');
    lines.push('- Use `graph.json` for programmatic queries (e.g., find all dependents of a file).');
    lines.push('- High complexity files (>15) are prime candidates for decomposition.');
    lines.push('');

    return lines.join('\n');
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

export function deactivate(): void {
    webviewProvider?.dispose();
    fileWatcher?.dispose();
    if (refreshTimeout) clearTimeout(refreshTimeout);
    if (historyWorker) {
        historyWorker.terminate();
        historyWorker = undefined;
    }
    if (graphDb) {
        graphDb.close();
        graphDb = undefined;
    }
}
