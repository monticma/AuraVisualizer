/**
 * WebviewProvider.ts — Manages the 3D visualization webview panel.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Worker } from 'worker_threads';
import type { GraphData } from '../analyzer/index';
import type { GraphDB } from '../graph-db';
import { runChatStream } from '../chat';
import { normalizeRiskWindow } from '../risk/risk-core';
import type { RiskSnapshot } from '../risk/risk-service';
import { parseAnnotations, serializeAnnotations, withNote, withoutNote, type AnnotationMap } from '../annotations';
import { makeWarp, parseWarps, removeWarp, serializeWarps, upsertWarp, type WarpList } from '../warps';
import type { FunctionFlow } from '../flow/flow-core';

/** Whitelist of webview-editable settings, with per-key validation. */
const SETTING_NORMALIZERS: Record<string, (v: unknown) => unknown> = {
    linkStyle: (v) => (v === 'curved' ? 'curved' : 'straight'),
    linkCurvature: (v) => clampNumber(v, 0, 1, 0.25),
    selectedNodeEffect: (v) => (v === 'bloom' ? 'bloom' : 'glow'),
    bloomStrength: (v) => clampNumber(v, 0, 5, 1.2),
    bloomRadius: (v) => clampNumber(v, 0, 2, 0.6),
    bloomThreshold: (v) => clampNumber(v, 0, 1, 0),
    riskWindow: (v) => normalizeRiskWindow(v),
    rotateSpeed: (v) => clampNumber(v, 1, 5, 1),
    flightSpeed: (v) => clampNumber(v, 0.25, 4, 1),
    flightSmoothing: (v) => clampNumber(v, 0.02, 0.5, 0.12),
    mouseSensitivity: (v) => clampNumber(v, 0.0005, 0.01, 0.0022),
    invertY: (v) => v === true,
    autoRefresh: (v) => v === true,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
    return typeof value === 'number' && isFinite(value)
        ? Math.min(max, Math.max(min, value))
        : fallback;
}

/** Sanity-check the rotation-speed setting (1 = default, 5 = fastest). */
function normalizeRotateSpeed(value: unknown): number {
    return typeof value === 'number' && isFinite(value)
        ? Math.min(5, Math.max(1, value))
        : 1;
}

export class WebviewProvider {
    public static readonly viewType = 'auraVisualizer.graphView';
    private panel: vscode.WebviewPanel | undefined;
    private readonly extensionUri: vscode.Uri;
    private readonly workspaceState: vscode.Memento;
    private disposables: vscode.Disposable[] = [];
    private onOpenFileEmitter = new vscode.EventEmitter<{ path: string; line?: number }>();
    public readonly onOpenFile = this.onOpenFileEmitter.event;
    private onDisposeEmitter = new vscode.EventEmitter<void>();
    public readonly onDidDispose = this.onDisposeEmitter.event;
    private pendingData: GraphData | undefined;
    private pendingHistoryIndex: unknown | undefined;
    private pendingDeltas: unknown[] = [];
    private pendingFocus: string | undefined;
    private webviewReady = false;

    private static readonly VIEW_STATE_KEY = 'aura.viewState';

    private getGraphDB: () => GraphDB | undefined;
    private getHostData: {
        riskSnapshot?: () => RiskSnapshot | undefined;
        workingTree?: () => Record<string, string>;
    };

    constructor(
        extensionUri: vscode.Uri,
        workspaceState: vscode.Memento,
        getGraphDB: () => GraphDB | undefined = () => undefined,
        getHostData: { riskSnapshot?: () => RiskSnapshot | undefined; workingTree?: () => Record<string, string> } = {},
    ) {
        this.extensionUri = extensionUri;
        this.workspaceState = workspaceState;
        this.getGraphDB = getGraphDB;
        this.getHostData = getHostData;
    }

    public show(): vscode.WebviewPanel {
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.One);
            return this.panel;
        }

        this.panel = vscode.window.createWebviewPanel(
            WebviewProvider.viewType,
            'Aura — 3D Visualizer',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.extensionUri, 'out', 'webview')
                ]
            }
        );

        this.initPanel();
        return this.panel;
    }

    public restore(panel: vscode.WebviewPanel): void {
        this.panel = panel;
        panel.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.joinPath(this.extensionUri, 'out', 'webview')
            ]
        };
        this.initPanel();
    }

    private initPanel(): void {
        if (!this.panel) return;

        this.panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'resources', 'aura-star-icon.png');
        this.panel.webview.html = this.getHtmlContent(this.panel.webview);

        this.setupMessageHandler();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.webviewReady = false;
            this.pendingDeltas = [];
            this.disposables.forEach(d => d.dispose());
            this.disposables = [];
            this.onDisposeEmitter.fire();
        });
    }

    private setupMessageHandler(): void {
        if (!this.panel) return;
        this.panel.webview.onDidReceiveMessage(
            (message: { type: string; payload?: Record<string, unknown> }) => {
                switch (message.type) {
                    case 'ready':
                        this.webviewReady = true;
                        // Refresh settings from the workspace: the HTML embedded a
                        // snapshot at panel creation, which can be stale.
                        this.sendSettings();
                        if (this.pendingData) {
                            this.panel?.webview.postMessage({ type: 'graphData', payload: this.pendingData });
                        }
                        if (this.pendingHistoryIndex) {
                            this.panel?.webview.postMessage({ type: 'historyIndex', payload: this.pendingHistoryIndex });
                        }
                        for (const delta of this.pendingDeltas) {
                            this.panel?.webview.postMessage({ type: 'historyDelta', payload: delta });
                        }
                        if (this.pendingFocus) {
                            this.panel?.webview.postMessage({ type: 'riskFocusFile', payload: { nodeId: this.pendingFocus } });
                            this.pendingFocus = undefined;
                        }
                        const workingTree = this.getHostData.workingTree?.();
                        if (workingTree) {
                            this.panel?.webview.postMessage({ type: 'workingTree', payload: { files: workingTree } });
                        }
                        void this.sendAnnotations();
                        void this.sendWarps();
                        break;
                    case 'openFile':
                        if (message.payload) {
                            this.onOpenFileEmitter.fire({
                                path: message.payload.path as string,
                                line: message.payload.line as number | undefined
                            });
                        }
                        break;
                    case 'requestRefresh':
                        vscode.commands.executeCommand('auraVisualizer.refresh');
                        break;
                    case 'requestExport':
                        vscode.commands.executeCommand('auraVisualizer.exportGraph');
                        break;
                    case 'saveViewState':
                        if (message.payload) {
                            this.workspaceState.update(WebviewProvider.VIEW_STATE_KEY, message.payload);
                        }
                        break;
                    case 'requestViewState':
                        this.sendSavedViewState();
                        break;
                    case 'requestSavedQueries': {
                        const db = this.getGraphDB();
                        let queries: Array<{ id: string; name: string; expr: string; mode: string; createdAt: number }> = [];
                        if (db) {
                            try { queries = db.listSavedQueries().map(q => ({ id: q.id, name: q.name, expr: q.expr, mode: q.mode, createdAt: q.createdAt })); }
                            catch (err) { console.error('[aura] listSavedQueries failed:', err); }
                        }
                        this.panel?.webview.postMessage({ type: 'savedQueries', payload: { queries } });
                        break;
                    }
                    case 'addSavedQuery': {
                        const db = this.getGraphDB();
                        const p = (message.payload || {}) as { id?: string; name?: string; expr?: string; mode?: string };
                        if (db && p.expr) {
                            const name = p.name || (p.expr.length > 50 ? p.expr.slice(0, 47) + '...' : p.expr);
                            const id = p.id || 'q_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
                            db.addSavedQuery({ id, name, expr: p.expr, mode: p.mode || 'highlight' });
                            const queries = db.listSavedQueries().map(q => ({ id: q.id, name: q.name, expr: q.expr, mode: q.mode, createdAt: q.createdAt }));
                            this.panel?.webview.postMessage({ type: 'savedQueries', payload: { queries } });
                        }
                        break;
                    }
                    case 'deleteSavedQuery': {
                        const db = this.getGraphDB();
                        const p = (message.payload || {}) as { id?: string };
                        if (db && p.id) {
                            db.deleteSavedQuery(p.id);
                            const queries = db.listSavedQueries().map(q => ({ id: q.id, name: q.name, expr: q.expr, mode: q.mode, createdAt: q.createdAt }));
                            this.panel?.webview.postMessage({ type: 'savedQueries', payload: { queries } });
                        }
                        break;
                    }
                    case 'chatRequest': {
                        const p = (message.payload || {}) as { id?: string; prompt?: string };
                        if (p.id && p.prompt) {
                            this.handleChatRequest(p.id, p.prompt);
                        }
                        break;
                    }
                    case 'exportRiskReport': {
                        const p = (message.payload || {}) as { markdown?: string };
                        if (p.markdown) {
                            void this.handleExportRiskReport(p.markdown);
                        }
                        break;
                    }
                    case 'updateSetting': {
                        const p = (message.payload || {}) as { key?: string; value?: unknown };
                        const normalize = p.key ? SETTING_NORMALIZERS[p.key] : undefined;
                        if (p.key && normalize) {
                            const config = vscode.workspace.getConfiguration('auraVisualizer');
                            void config.update(p.key, normalize(p.value), vscode.ConfigurationTarget.Workspace).then(
                                undefined,
                                () => { /* no workspace folder open — nothing to persist */ }
                            );
                        }
                        break;
                    }
                    case 'openSettings':
                        void vscode.commands.executeCommand('workbench.action.openSettings', '@ext:monticma-aura.aura-visualizer-3D');
                        break;
                    case 'saveNote': {
                        const p = (message.payload || {}) as { path?: string; text?: string; color?: string };
                        if (p.path) {
                            void this.handleSaveNote(p.path, p.text || '', p.color);
                        }
                        break;
                    }
                    case 'deleteNote': {
                        const p = (message.payload || {}) as { path?: string };
                        if (p.path) {
                            void this.handleDeleteNote(p.path);
                        }
                        break;
                    }
                    case 'saveWarp': {
                        const p = (message.payload || {}) as { warp?: unknown };
                        if (p.warp) {
                            void this.handleSaveWarp(p.warp);
                        }
                        break;
                    }
                    case 'deleteWarp': {
                        const p = (message.payload || {}) as { id?: string };
                        if (p.id) {
                            void this.handleDeleteWarp(p.id);
                        }
                        break;
                    }
                    case 'requestFlow': {
                        const p = (message.payload || {}) as { fileId?: string; line?: number; language?: string };
                        if (p.fileId && typeof p.line === 'number' && p.language) {
                            void this.handleFlowRequest(p.fileId, p.line, p.language);
                        }
                        break;
                    }
                }
            },
            null,
            this.disposables
        );
    }

    private handleChatRequest(id: string, prompt: string): void {
        const post = (type: string, payload: Record<string, unknown>) =>
            this.panel?.webview.postMessage({ type, payload });
        void runChatStream(() => this.getGraphDB(), prompt, {
            onChunk: (text) => post('chatChunk', { id, text }),
            onDone: (fullText) => post('chatDone', { id, fullText }),
            onError: (message) => post('chatError', { id, message }),
            onToolCall: (name) => post('chatTool', { id, name }),
        }, this.getHostData.riskSnapshot);
    }

    private async handleExportRiskReport(markdown: string): Promise<void> {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) {
            vscode.window.showWarningMessage('Aura: No workspace folder open.');
            return;
        }
        const dir = vscode.Uri.joinPath(ws.uri, '.aura');
        const file = vscode.Uri.joinPath(dir, 'risk-report.md');
        try {
            await vscode.workspace.fs.createDirectory(dir);
            await vscode.workspace.fs.writeFile(file, Buffer.from(markdown, 'utf-8'));
            const choice = await vscode.window.showInformationMessage(
                'Aura: Risk report exported to .aura/risk-report.md',
                'Open'
            );
            if (choice === 'Open') {
                vscode.window.showTextDocument(file, { preview: true });
            }
        } catch (err) {
            vscode.window.showErrorMessage(
                'Aura: Failed to export risk report: ' + (err instanceof Error ? err.message : String(err))
            );
        }
    }

    // ============================================================
    // Node notes (annotations) — .aura/annotations.json
    // ============================================================

    /** Push the current note map to the webview (safe when not ready yet). */
    public async sendAnnotations(): Promise<void> {
        const notes = await this.loadAnnotations();
        this.panel?.webview.postMessage({ type: 'annotations', payload: { notes } });
    }

    private annotationsFileUri(): vscode.Uri | undefined {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) return undefined;
        return vscode.Uri.joinPath(ws.uri, '.aura', 'annotations.json');
    }

    private async loadAnnotations(): Promise<AnnotationMap> {
        const file = this.annotationsFileUri();
        if (!file) return {};
        try {
            const buf = await vscode.workspace.fs.readFile(file);
            return parseAnnotations(Buffer.from(buf).toString('utf-8'));
        } catch {
            return {}; // File not created yet — no notes.
        }
    }

    private async persistAnnotations(map: AnnotationMap): Promise<void> {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) return;
        const dir = vscode.Uri.joinPath(ws.uri, '.aura');
        await vscode.workspace.fs.createDirectory(dir);
        await vscode.workspace.fs.writeFile(
            vscode.Uri.joinPath(dir, 'annotations.json'),
            Buffer.from(serializeAnnotations(map), 'utf-8')
        );
    }

    private async handleSaveNote(path: string, text: string, color?: string): Promise<void> {
        try {
            const map = withNote(await this.loadAnnotations(), path, text, color);
            await this.persistAnnotations(map);
            await this.sendAnnotations();
        } catch (err) {
            console.error('[aura] saveNote failed:', err);
        }
    }

    private async handleDeleteNote(path: string): Promise<void> {
        try {
            const map = withoutNote(await this.loadAnnotations(), path);
            await this.persistAnnotations(map);
            await this.sendAnnotations();
        } catch (err) {
            console.error('[aura] deleteNote failed:', err);
        }
    }

    // ============================================================
    // Warp points (camera bookmarks) — .aura/warps.json
    // ============================================================

    /** Push the current warp list to the webview (safe when not ready yet). */
    public async sendWarps(): Promise<void> {
        const warps = await this.loadWarps();
        this.panel?.webview.postMessage({ type: 'warps', payload: { warps } });
    }

    private warpsFileUri(): vscode.Uri | undefined {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) return undefined;
        return vscode.Uri.joinPath(ws.uri, '.aura', 'warps.json');
    }

    private async loadWarps(): Promise<WarpList> {
        const file = this.warpsFileUri();
        if (!file) return [];
        try {
            const buf = await vscode.workspace.fs.readFile(file);
            return parseWarps(Buffer.from(buf).toString('utf-8'));
        } catch {
            return []; // File not created yet — no warps.
        }
    }

    private async persistWarps(list: WarpList): Promise<void> {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) return;
        const dir = vscode.Uri.joinPath(ws.uri, '.aura');
        await vscode.workspace.fs.createDirectory(dir);
        await vscode.workspace.fs.writeFile(
            vscode.Uri.joinPath(dir, 'warps.json'),
            Buffer.from(serializeWarps(list), 'utf-8')
        );
    }

    private async handleSaveWarp(payload: unknown): Promise<void> {
        try {
            const warp = makeWarp(payload);
            if (!warp) return; // Unusable pose (missing coordinates) — ignore.
            const list = upsertWarp(await this.loadWarps(), warp);
            await this.persistWarps(list);
            await this.sendWarps();
        } catch (err) {
            console.error('[aura] saveWarp failed:', err);
        }
    }

    private async handleDeleteWarp(id: string): Promise<void> {
        try {
            const list = removeWarp(await this.loadWarps(), id);
            await this.persistWarps(list);
            await this.sendWarps();
        } catch (err) {
            console.error('[aura] deleteWarp failed:', err);
        }
    }

    // ============================================================
    // Function flowcharts — on-demand, computed in the analyzer worker
    // ============================================================

    /** mtime-aware cache — a flowchart is only recomputed when the file changed. */
    private flowCache = new Map<string, { mtimeMs: number; flow: FunctionFlow | null }>();

    private async handleFlowRequest(fileId: string, line: number, language: string): Promise<void> {
        let flow: FunctionFlow | null = null;
        let error: string | undefined;
        try {
            flow = await this.runFlowRequest(fileId, line, language);
        } catch (err) {
            error = err instanceof Error ? err.message : String(err);
            console.error('[aura] requestFlow failed:', err);
        }
        this.panel?.webview.postMessage({ type: 'flowData', payload: { fileId, line, flow, error } });
    }

    private async runFlowRequest(fileId: string, line: number, language: string): Promise<FunctionFlow | null> {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws || fileId.includes('..')) return null;
        const filePath = path.join(ws.uri.fsPath, fileId);

        let mtimeMs = 0;
        try {
            mtimeMs = (await vscode.workspace.fs.stat(vscode.Uri.file(filePath))).mtime;
        } catch {
            return null; // file gone
        }

        const key = filePath + '\u0000' + line;
        const cached = this.flowCache.get(key);
        if (cached && cached.mtimeMs === mtimeMs) return cached.flow;

        const flow = await this.runFlowInWorker(filePath, language, line);

        if (this.flowCache.size >= 200) {
            const oldest = this.flowCache.keys().next().value;
            if (oldest !== undefined) this.flowCache.delete(oldest);
        }
        this.flowCache.set(key, { mtimeMs, flow });
        return flow;
    }

    private runFlowInWorker(filePath: string, language: string, line: number): Promise<FunctionFlow | null> {
        return new Promise((resolve, reject) => {
            const workerPath = path.join(this.extensionUri.fsPath, 'out', 'analyzer-worker.js');
            const worker = new Worker(workerPath, {
                // Don't inherit the debugger's --inspect flag: worker_threads copy
                // process.execArgv, so under the extension debugger they try to
                // attach to the inspector and hang the extension host.
                execArgv: [],
                workerData: { flowRequest: { filePath, language, line } },
            });
            worker.on('message', (msg: { flow?: FunctionFlow | null; error?: string }) => {
                if (msg.error) reject(new Error(msg.error));
                else resolve(msg.flow ?? null);
                worker.terminate();
            });
            worker.on('error', (err) => {
                reject(err);
                worker.terminate();
            });
            worker.on('exit', (code) => {
                if (code !== 0) reject(new Error(`Flow worker exited with code ${code}`));
            });
        });
    }

    public sendGraphData(data: GraphData): void {
        this.pendingData = data;
        if (this.webviewReady) {
            this.panel?.webview.postMessage({ type: 'graphData', payload: data });
        }
    }

    private sendSavedViewState(): void {
        const state = this.workspaceState.get(WebviewProvider.VIEW_STATE_KEY);
        if (state) {
            this.panel?.webview.postMessage({ type: 'restoreViewState', payload: state });
        }
    }

    public sendGraphDelta(delta: Record<string, unknown>): void {
        if (this.webviewReady) {
            this.panel?.webview.postMessage({ type: 'updateGraph', payload: delta });
        }
    }

    public sendProgress(phase: string, message: string): void {
        this.panel?.webview.postMessage({ type: 'progress', payload: { phase, message } });
    }

    public focusNode(nodeId: string): void {
        this.panel?.webview.postMessage({ type: 'focusNode', payload: { nodeId } });
    }

    /** Reveal a file in the Risk tab (expand its bucket, scroll to the row, flash it). */
    public focusRiskFile(nodeId: string): void {
        if (this.webviewReady) {
            this.panel?.webview.postMessage({ type: 'riskFocusFile', payload: { nodeId } });
        } else {
            this.pendingFocus = nodeId;
        }
    }

    /**
     * Push fresh working-tree state. No-op when the webview is not ready yet —
     * the ready handler pulls the current state through the host accessors.
     */
    public sendWorkingTree(files: Record<string, string>): void {
        if (this.webviewReady) {
            this.panel?.webview.postMessage({ type: 'workingTree', payload: { files } });
        }
    }

    public sendBlastRadius(nodeId: string): void {
        this.panel?.webview.postMessage({ type: 'blastRadius', payload: { nodeId } });
    }

    public sendFilterDirs(dirs: string[]): void {
        this.panel?.webview.postMessage({ type: 'filterDirs', payload: { dirs } });
    }

    public sendRefreshComplete(): void {
        this.panel?.webview.postMessage({ type: 'refreshComplete' });
    }

    public sendSettings(_settings?: Record<string, unknown>): void {
        try {
            const config = vscode.workspace.getConfiguration('auraVisualizer');
            this.panel?.webview.postMessage({
                type: 'graphConfig',
                payload: {
                    linkStyle: config.get<string>('linkStyle', 'straight'),
                    linkCurvature: config.get<number>('linkCurvature', 0.25),
                    selectedNodeEffect: config.get<string>('selectedNodeEffect', 'glow'),
                    bloomStrength: config.get<number>('bloomStrength', 1.2),
                    bloomRadius: config.get<number>('bloomRadius', 0.6),
                    bloomThreshold: config.get<number>('bloomThreshold', 0.0),
                    riskWindow: normalizeRiskWindow(config.get<number>('riskWindow', 90)),
                    rotateSpeed: normalizeRotateSpeed(config.get<number>('rotateSpeed', 1)),
                    flightSpeed: clampNumber(config.get<number>('flightSpeed', 1), 0.25, 4, 1),
                    flightSmoothing: clampNumber(config.get<number>('flightSmoothing', 0.12), 0.02, 0.5, 0.12),
                    mouseSensitivity: clampNumber(config.get<number>('mouseSensitivity', 0.0022), 0.0005, 0.01, 0.0022),
                    invertY: config.get<boolean>('invertY', false) === true,
                    autoRefresh: config.get<boolean>('autoRefresh', true),
                }
            });
        } catch { /* ignore */ }
    }

    public sendTheme(kind: vscode.ColorThemeKind): void {
        this.panel?.webview.postMessage({
            type: 'themeChanged',
            payload: { kind }
        });
    }

    public sendHistoryIndex(index: unknown): void {
        this.pendingHistoryIndex = index;
        if (this.webviewReady) {
            this.panel?.webview.postMessage({ type: 'historyIndex', payload: index });
        }
    }

    public sendHistoryProgress(scanned: number, total: number): void {
        if (this.webviewReady) {
            this.panel?.webview.postMessage({ type: 'historyProgress', payload: { scanned, total } });
        }
    }

    public sendHistoryDelta(delta: unknown): void {
        if (this.webviewReady) {
            this.panel?.webview.postMessage({ type: 'historyDelta', payload: delta });
        } else {
            this.pendingDeltas.push(delta);
        }
    }

    public get isVisible(): boolean {
        return this.panel?.visible ?? false;
    }

    public dispose(): void {
        this.panel?.dispose();
    }

    private buildAuraConfig(): string {
        try {
            const config = vscode.workspace.getConfiguration('auraVisualizer');
            return JSON.stringify({
                linkStyle: config.get<string>('linkStyle', 'straight'),
                linkCurvature: config.get<number>('linkCurvature', 0.25),
                selectedNodeEffect: config.get<string>('selectedNodeEffect', 'glow'),
                bloomStrength: config.get<number>('bloomStrength', 1.2),
                bloomRadius: config.get<number>('bloomRadius', 0.6),
                bloomThreshold: config.get<number>('bloomThreshold', 0.0),
                riskWindow: normalizeRiskWindow(config.get<number>('riskWindow', 90)),
                rotateSpeed: normalizeRotateSpeed(config.get<number>('rotateSpeed', 1)),
                flightSpeed: clampNumber(config.get<number>('flightSpeed', 1), 0.25, 4, 1),
                flightSmoothing: clampNumber(config.get<number>('flightSmoothing', 0.12), 0.02, 0.5, 0.12),
                mouseSensitivity: clampNumber(config.get<number>('mouseSensitivity', 0.0022), 0.0005, 0.01, 0.0022),
                invertY: config.get<boolean>('invertY', false) === true,
                autoRefresh: config.get<boolean>('autoRefresh', true),
            });
        } catch { return '{}'; }
    }

    private getHtmlContent(webview: vscode.Webview): string {
        const webviewPath = path.join('out', 'webview');

        // Read version from package.json
        const pkgPath = path.join(this.extensionUri.fsPath, 'package.json');
        let version = '1.0.0';
        try {
            const pkg = require(pkgPath);
            version = pkg.version || version;
        } catch { /* fallback */ }

        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'css', 'style.css')
        );
        const appUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'js', 'app.js')
        );
        const configUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'js', 'graph-config.js')
        );
        const queryUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'js', 'query.js')
        );
        const riskUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'js', 'risk-core.js')
        );
        const flightCoreUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'js', 'flight-core.js')
        );
        const flightUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'js', 'flight.js')
        );
        const flowUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'js', 'flow.js')
        );
        const viewsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'js', 'views.js')
        );
        const warpsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'js', 'warps.js')
        );
        const timelineUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'js', 'timeline.js')
        );
        const riskMapUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'js', 'risk.js')
        );
        const detailUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'js', 'detail.js')
        );
        const queryUiUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'js', 'query-ui.js')
        );
        const panelsUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'js', 'panels.js')
        );
        const chatUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'js', 'chat.js')
        );
        const forceGraphUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'lib', '3d-force-graph.min.js')
        );
        const threeUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'lib', 'three.global.js')
        );

        const nonce = getNonce();

        // Build AURA_CONFIG injected before any script runs
        const auraConfig = this.buildAuraConfig();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval' ${webview.cspSource}; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
    <link rel="stylesheet" href="${styleUri}">
    <title>Aura — 3D Visualizer</title>
</head>
<body>
    <div id="app-layout">
        <!-- Top Bar -->
        <header id="top-bar">
            <div class="top-bar-left">
                <button id="btn-toggle-explorer" class="top-btn icon-btn" title="Toggle explorer (☰)">☰</button>
                <div id="logo">
                    <span class="logo-icon">✦</span>
                    <span class="logo-text">AURA</span>
                    <span class="logo-version">v${version}</span>
                </div>
            </div>
            <div class="top-bar-center">
                <div id="search-container">
                    <span class="search-icon">⌕</span>
                    <input type="text" id="search-input" placeholder="Search file..." autocomplete="off">
                    <div id="search-results" class="hidden"></div>
                </div>
            </div>
            <div class="top-bar-right">
                <div id="stats-bar">
                    <span class="stat" id="stat-files">0 files</span>
                    <span class="stat-separator">·</span>
                    <span class="stat" id="stat-links">0 links</span>
                    <span class="stat-separator">·</span>
                    <span class="stat" id="stat-time">—</span>
                </div>
                <button id="btn-export" class="top-btn" title="Export graph for AI">📤 Export</button>
                <button id="btn-minimap" class="top-btn" title="Toggle minimap">🗺️ Map</button>
                <button id="btn-refresh" class="top-btn" title="Refresh analysis">🔄 Refresh</button>
                <button id="btn-help" class="top-btn" title="Help & shortcuts">❓ Help</button>
            </div>
        </header>

        <!-- Tab Bar -->
        <nav id="tab-bar">
            <button class="tab-btn active" data-tab="graph">✦ 3D Graph</button>
            <button class="tab-btn" data-tab="treemap">🗺️ Treemap</button>
            <button class="tab-btn" data-tab="dsm">🗑️ Matrix</button>
            <button class="tab-btn" data-tab="chord">🎵 Chord</button>
            <button class="tab-btn" data-tab="metrics">📊 Metrics</button>
            <button class="tab-btn" data-tab="timeline">📈 Timeline</button>
            <button class="tab-btn" data-tab="table">📋 Table</button>
            <button class="tab-btn" data-tab="risk">🛡️ Risk</button>
            <button id="qb-toggle" class="qb-toggle" title="Toggle query bar (Ctrl+K)">🔍</button>
            <button id="settings-toggle" type="button" class="qb-toggle" title="Aura settings">⚙️</button>
            <button id="chat-toggle" type="button" class="qb-toggle chat-toggle" title="Toggle Aura Assistant (AI chat)" hidden>✨</button>
        </nav>

        <!-- Query Bar (collapsible) -->
        <section id="query-bar" class="collapsed" aria-label="Query filter">
            <div class="qb-row qb-main">
                <div class="qb-input-wrap">
                    <input type="text" id="qb-input" class="qb-input"
                        placeholder='complexity > 20 AND fanIn > 5'
                        spellcheck="false" autocomplete="off" />
                    <div id="qb-suggest" class="qb-suggest hidden"></div>
                </div>
                <select id="qb-mode" class="qb-mode" title="How matches are applied">
                    <option value="highlight" selected>Highlight</option>
                    <option value="filter">Filter</option>
                    <option value="select">Select</option>
                </select>
                <span id="qb-status" class="qb-status">—</span>
                <button id="qb-clear" class="qb-btn" title="Clear query (Esc)">✕</button>
                <button id="qb-save" class="qb-btn" title="Save current query as favorite">⭐</button>
                <button id="qb-open-list" class="qb-btn" title="Open saved queries">📚</button>
            </div>
            <div class="qb-row qb-error-row">
                <span id="qb-error" class="qb-error hidden"></span>
            </div>
        </section>

        <!-- Middle Row: Explorer + Graph + Detail -->
        <div id="middle-row" class="tab-content active" data-tab="graph">
            <!-- Explorer Panel -->
            <aside id="explorer-panel" class="collapsed">
                <div class="explorer-header"><h3>Files</h3><span class="explorer-btns"><button id="explorer-all" title="Check all">All</button><button id="explorer-none" title="Uncheck all">None</button></span></div>
                <div id="explorer-tree" class="explorer-tree"></div>
            </aside>

            <!-- 3D Graph Container -->
            <div id="graph-container"></div>

            <!-- Loading Overlay (outside graph-container so it survives graph init) -->
            <div id="loading-overlay">
                <div class="loading-content">
                    <div class="loading-logo">
                        <span class="loading-logo-icon">✦</span>
                        <span class="loading-logo-text">AURA</span>
                    </div>
                    <div class="loading-progress-bar">
                        <div class="loading-progress-fill" id="loading-progress-fill"></div>
                    </div>
                    <p class="loading-status" id="loading-status">Analyzing codebase...</p>
                </div>
            </div>

            <!-- Detail Panel -->
            <aside id="detail-panel" class="collapsed">
        <div class="panel-header">
            <div class="panel-file-icon" id="panel-icon">📄</div>
            <div class="panel-file-info">
                <h2 id="panel-filename">—</h2>
                <span id="panel-path" class="panel-path">—</span>
            </div>
            <button id="panel-close" class="panel-close">✕</button>
        </div>
        <div class="panel-section">
            <div class="panel-grid">
                <div class="panel-metric">
                    <span class="metric-label">Language</span>
                    <span class="metric-value" id="panel-language">—</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Folder</span>
                    <span class="metric-value" id="panel-group">—</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Community</span>
                    <span class="metric-value" id="panel-community">—</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Lines</span>
                    <span class="metric-value" id="panel-loc">—</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Size</span>
                    <span class="metric-value" id="panel-size">—</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Modified</span>
                    <span class="metric-value" id="panel-mtime">—</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Git</span>
                    <span class="metric-value" id="panel-git">—</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Fan-out</span>
                    <span class="metric-value" id="panel-fanout">—</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Fan-in</span>
                    <span class="metric-value" id="panel-fanin">—</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Complexity</span>
                    <span class="metric-value" id="panel-complexity">—</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Symbols</span>
                    <span class="metric-value" id="panel-symbols-count">—</span>
                </div>
            </div>
        </div>
        <div class="panel-section" id="note-section">
            <h3>📝 Note</h3>
            <textarea id="note-input" rows="2" placeholder="Add a note for this file…" maxlength="2000"></textarea>
            <div class="note-actions">
                <span id="note-colors" class="note-colors"></span>
                <span class="note-buttons">
                    <button id="note-save" class="note-btn">Save</button>
                    <button id="note-delete" class="note-btn note-btn-delete" style="display:none">🗑 Delete</button>
                </span>
            </div>
        </div>
        <div class="panel-section" id="symbols-section" style="display:none">
            <h3>Symbols <span id="symbols-total" class="count-badge">0</span></h3>
            <div id="symbols-list" class="symbols-list"></div>
        </div>
        <div class="panel-section">
            <h3>Dependencies <span id="deps-count" class="count-badge">0</span></h3>
            <ul id="panel-deps" class="panel-list"></ul>
        </div>
        <div class="panel-section">
            <h3>Dependents <span id="dependents-count" class="count-badge">0</span></h3>
            <ul id="panel-dependents" class="panel-list"></ul>
        </div>
    </aside>

    <!-- Chat Panel (Aura Assistant) -->
    <aside id="chat-panel" class="collapsed" aria-label="Aura Assistant">
        <div class="chat-header">
            <h3>✨ Aura Assistant</h3>
            <button id="chat-clear" type="button" class="chat-btn" title="Clear conversation">🗑️</button>
            <button id="chat-close" type="button" class="chat-btn" title="Close">✕</button>
        </div>
        <div id="chat-messages" class="chat-messages"></div>
        <div class="chat-input-row">
            <textarea id="chat-input" rows="2" placeholder="Ask about your codebase…" spellcheck="false"></textarea>
            <button id="chat-send" type="button" class="chat-send" title="Send (Enter)">➤</button>
        </div>
    </aside>
    </div><!-- /middle-row -->

    <!-- Metrics View -->
    <div id="metrics-view" class="tab-content" data-tab="metrics"></div>

    <!-- Risk View -->
    <div id="risk-view" class="tab-content" data-tab="risk">
        <div class="risk-toolbar">
            <h2>🛡️ Codebase Risk Map</h2>
            <div class="risk-toolbar-actions">
                <label class="risk-window-label" for="risk-window" title="How much git history is used for churn and scoring">
                    History window
                    <select id="risk-window" class="risk-window-select">
                        <option value="30">30 days</option>
                        <option value="90" selected>90 days</option>
                        <option value="365">365 days</option>
                    </select>
                </label>
                <button id="risk-export" type="button" class="risk-export-btn" title="Export a Markdown report to .aura/risk-report.md">📤 Export Report</button>
            </div>
        </div>
        <div id="risk-content">
            <div class="risk-section" id="risk-health">
                <h3>Codebase Health</h3>
                <div class="risk-health-grid">
                    <div class="risk-health-metric">
                        <div class="risk-health-score" id="risk-health-score">—</div>
                        <div class="risk-health-label">Health score</div>
                    </div>
                    <div class="risk-health-metric">
                        <div class="risk-health-value" id="risk-total-files">—</div>
                        <div class="risk-health-label">Total files</div>
                    </div>
                    <div class="risk-health-metric">
                        <div class="risk-health-value" id="risk-avg-risk">—</div>
                        <div class="risk-health-label">Average risk / 100</div>
                    </div>
                </div>
                <div class="risk-highlights">
                    <div class="risk-highlight">
                        <span class="risk-highlight-label">🔥 Most risky</span>
                        <span id="risk-most-risky" class="risk-highlight-value">—</span>
                    </div>
                    <div class="risk-highlight">
                        <span class="risk-highlight-label">🔗 Most connected</span>
                        <span id="risk-most-connected" class="risk-highlight-value">—</span>
                    </div>
                </div>
            </div>

            <div class="risk-section" id="risk-distribution">
                <h3>Risk Distribution</h3>
                <div class="risk-bar">
                    <div class="risk-bar-high" id="risk-bar-high"></div>
                    <div class="risk-bar-medium" id="risk-bar-medium"></div>
                    <div class="risk-bar-low" id="risk-bar-low"></div>
                </div>
                <div class="risk-legend">
                    <span class="risk-legend-item"><span class="risk-dot high"></span> High: <span id="risk-high-count">0</span> files (<span id="risk-high-pct">0%</span>)</span>
                    <span class="risk-legend-item"><span class="risk-dot medium"></span> Medium: <span id="risk-medium-count">0</span> files (<span id="risk-medium-pct">0%</span>)</span>
                    <span class="risk-legend-item"><span class="risk-dot low"></span> Low: <span id="risk-low-count">0</span> files (<span id="risk-low-pct">0%</span>)</span>
                </div>
            </div>

            <div class="risk-section" id="risk-trend">
                <h3>📈 Risk Trend <span class="risk-trend-caption">avg complexity over time</span></h3>
                <div id="risk-trend-chart" class="risk-trend-chart"></div>
            </div>

            <div class="risk-section" id="risk-scatter">
                <h3>📊 Churn × Complexity <span class="risk-trend-caption">log scale · click a point to focus</span></h3>
                <div id="risk-scatter-chart" class="risk-scatter-chart"></div>
            </div>

            <div class="risk-section risk-collapsible" id="risk-rising">
                <button type="button" class="risk-section-header risk-collapsed" id="risk-toggle-rising">
                    <span class="risk-arrow" aria-hidden="true"></span>
                    <span class="risk-header-label">🔥 RECENTLY HOT</span>
                    <span class="risk-count-badge" id="risk-rising-badge">0</span>
                </button>
                <div id="risk-list-rising" class="risk-files-list risk-collapsed"></div>
            </div>

            <div class="risk-section risk-collapsible" id="risk-bus">
                <button type="button" class="risk-section-header risk-collapsed" id="risk-toggle-bus">
                    <span class="risk-arrow" aria-hidden="true"></span>
                    <span class="risk-header-label">👤 BUS FACTOR RISK</span>
                    <span class="risk-count-badge" id="risk-bus-badge">0</span>
                </button>
                <div id="risk-list-bus" class="risk-files-list risk-collapsed"></div>
            </div>

            <div class="risk-section risk-collapsible" id="risk-section-high">
                <button type="button" class="risk-section-header risk-collapsed" id="risk-toggle-high">
                    <span class="risk-arrow" aria-hidden="true"></span>
                    <span class="risk-header-label">🔴 HIGH RISK FILES</span>
                    <span class="risk-count-badge" id="risk-high-badge">0</span>
                </button>
                <div class="risk-files-list risk-collapsed" id="risk-list-high"></div>
            </div>

            <div class="risk-section risk-collapsible" id="risk-section-medium">
                <button type="button" class="risk-section-header risk-collapsed" id="risk-toggle-medium">
                    <span class="risk-arrow" aria-hidden="true"></span>
                    <span class="risk-header-label">🟡 MEDIUM RISK FILES</span>
                    <span class="risk-count-badge" id="risk-medium-badge">0</span>
                </button>
                <div class="risk-files-list risk-collapsed" id="risk-list-medium"></div>
            </div>

            <div class="risk-section risk-collapsible" id="risk-section-low">
                <button type="button" class="risk-section-header risk-collapsed" id="risk-toggle-low">
                    <span class="risk-arrow" aria-hidden="true"></span>
                    <span class="risk-header-label">🟢 LOW RISK FILES</span>
                    <span class="risk-count-badge" id="risk-low-badge">0</span>
                </button>
                <div class="risk-files-list risk-collapsed" id="risk-list-low"></div>
            </div>
        </div>
    </div>

    <!-- Treemap View -->
    <div id="treemap-view" class="tab-content" data-tab="treemap">
        <div class="treemap-toolbar">
            <div id="treemap-breadcrumb"><span class="treemap-crumb treemap-crumb-root" data-path="">root</span></div>
            <div class="treemap-controls">
                <label>Size: <select id="treemap-size-metric">
                    <option value="linesOfCode" selected>LOC</option>
                    <option value="complexity">Complexity</option>
                    <option value="size">File size</option>
                </select></label>
                <label>Color: <select id="treemap-color-metric">
                    <option value="complexity" selected>Complexity</option>
                    <option value="fanIn">Fan-in</option>
                    <option value="fanOut">Fan-out</option>
                    <option value="language">Language</option>
                </select></label>
            </div>
        </div>
        <div id="treemap-container"></div>
    </div>

    <!-- Chord Diagram View -->
    <div id="chord-view" class="tab-content" data-tab="chord">
        <div class="chord-toolbar">
            <div class="chord-controls">
                <label>Group by: <select id="chord-group-by">
                    <option value="directory" selected>Directory</option>
                    <option value="language">Language</option>
                    <option value="community">Community</option>
                </select></label>
                <span class="chord-stats" id="chord-stats"></span>
            </div>
        </div>
        <div id="chord-container"></div>
    </div>

    <!-- Timeline Chart View -->
    <div id="timeline-view" class="tab-content" data-tab="timeline">
        <div class="tchart-toolbar">
            <div class="tchart-controls">
                <label>Metric: <select id="tchart-metric">
                    <option value="loc" selected>Lines of Code</option>
                    <option value="files">File Count</option>
                    <option value="complexity">Avg Complexity</option>
                    <option value="totalComplexity">Total Complexity</option>
                </select></label>
                <span class="tchart-stats" id="tchart-stats"></span>
            </div>
        </div>
        <div id="tchart-container"></div>
    </div>

    <!-- DSM View -->
    <div id="dsm-view" class="tab-content" data-tab="dsm">
        <div class="dsm-toolbar">
            <div class="dsm-controls">
                <label>Group by: <select id="dsm-group-by">
                    <option value="directory" selected>Directory</option>
                    <option value="language">Language</option>
                    <option value="community">Community</option>
                </select></label>
                <label>Sort: <select id="dsm-sort">
                    <option value="group" selected>Group</option>
                    <option value="name">Name</option>
                    <option value="fanIn">Fan-in</option>
                    <option value="fanOut">Fan-out</option>
                </select></label>
                <span class="dsm-stats" id="dsm-stats"></span>
            </div>
        </div>
        <div id="dsm-container"></div>
    </div>

    <!-- Table View -->
    <div id="table-view" class="tab-content" data-tab="table">
        <div class="table-toolbar">
            <span class="search-icon">⌕</span>
            <input type="text" id="table-search" placeholder="Filter files..." autocomplete="off">
        </div>
        <div class="table-scroll">
            <table class="aura-table">
                <thead>
                    <tr>
                        <th data-col="name">File</th>
                        <th data-col="language">Lang</th>
                        <th data-col="loc" class="num">LOC</th>
                        <th data-col="complexity" class="num">Complexity</th>
                        <th data-col="fanIn" class="num">Fan-in</th>
                        <th data-col="fanOut" class="num">Fan-out</th>
                        <th data-col="symbols" class="num">Symbols</th>
                        <th data-col="group">Folder</th>
                    </tr>
                </thead>
                <tbody id="table-body"></tbody>
            </table>
        </div>
    </div>

    <!-- Timeline Bar (Time Travel) -->
    <div id="timeline-bar" class="hidden">
        <div id="timeline-from-controls" class="hidden">
            <button id="timeline-from-prev" class="timeline-btn from-btn" title="From: previous commit">◀</button>
            <button id="timeline-from-next" class="timeline-btn from-btn" title="From: next commit">▶</button>
        </div>
        <div id="timeline-slider-wrap">
            <input type="range" id="timeline-from-slider" class="hidden" min="0" max="0" value="0" step="1">
            <input type="range" id="timeline-slider" min="0" max="0" value="0" step="1">
        </div>
        <div id="timeline-info">
            <span id="timeline-hash">—</span>
            <span id="timeline-message">—</span>
            <span id="timeline-date">—</span>
        </div>
        <div id="timeline-progress" class="hidden">
            <span id="timeline-progress-text">⏳ 0/0</span>
        </div>
        <div id="timeline-right-controls">
            <button id="timeline-prev" class="timeline-btn" title="Previous commit (←)">◀</button>
            <button id="timeline-next" class="timeline-btn" title="Next commit (→)">▶</button>
            <button id="timeline-impact" class="timeline-btn impact-btn" title="Show impact cascade (I)">💥</button>
            <button id="timeline-compare" class="timeline-btn compare-btn" title="Compare two commits (V)">⇄</button>
        </div>
    </div>

    <!-- Bottom Filter Bar -->
    <footer id="filter-bar">
        <div class="filter-group graph-only" id="language-filters">
            <button class="filter-btn active" data-lang="c-source" data-color="#4fc3f7">
                <span class="filter-dot" style="background:#4fc3f7"></span> .c
            </button>
            <button class="filter-btn active" data-lang="c-header" data-color="#81d4fa">
                <span class="filter-dot" style="background:#81d4fa"></span> .h
            </button>
            <button class="filter-btn active" data-lang="cpp-source" data-color="#0288d1">
                <span class="filter-dot" style="background:#0288d1"></span> .cpp
            </button>
            <button class="filter-btn active" data-lang="cpp-header" data-color="#4fc3f7">
                <span class="filter-dot" style="background:#4fc3f7"></span> .hpp
            </button>
            <button class="filter-btn active" data-lang="javascript" data-color="#ffd54f">
                <span class="filter-dot" style="background:#ffd54f"></span> JS
            </button>
            <button class="filter-btn active" data-lang="typescript" data-color="#64b5f6">
                <span class="filter-dot" style="background:#64b5f6"></span> TS
            </button>
            <button class="filter-btn active" data-lang="python" data-color="#81c784">
                <span class="filter-dot" style="background:#81c784"></span> PY
            </button>
            <button class="filter-btn active" data-lang="css" data-color="#ce93d8">
                <span class="filter-dot" style="background:#ce93d8"></span> CSS
            </button>
            <button class="filter-btn active" data-lang="html" data-color="#ff8a65">
                <span class="filter-dot" style="background:#ff8a65"></span> HTML
            </button>
            <button class="filter-btn active" data-lang="java" data-color="#e57373">
                <span class="filter-dot" style="background:#e57373"></span> Java
            </button>
            <button class="filter-btn active" data-lang="go" data-color="#4dd0e1">
                <span class="filter-dot" style="background:#4dd0e1"></span> Go
            </button>
            <button class="filter-btn active" data-lang="rust" data-color="#ffb74d">
                <span class="filter-dot" style="background:#ffb74d"></span> Rust
            </button>
            <button class="filter-btn active" data-lang="csharp" data-color="#9c6ade">
                <span class="filter-dot" style="background:#9c6ade"></span> C#
            </button>
            <button class="filter-btn active" data-lang="php" data-color="#8892bf">
                <span class="filter-dot" style="background:#8892bf"></span> PHP
            </button>
            <button class="filter-btn active" data-lang="vue" data-color="#42b883">
                <span class="filter-dot" style="background:#42b883"></span> Vue
            </button>
            <button class="filter-btn active" data-lang="bash" data-color="#89e051">
                <span class="filter-dot" style="background:#89e051"></span> SH
            </button>
            <button class="filter-btn active" data-lang="lua" data-color="#536dfe">
                <span class="filter-dot" style="background:#536dfe"></span> Lua
            </button>
            <button class="filter-btn" data-lang="documentation" data-color="#b0bec5" style="display:none">
                <span class="filter-dot" style="background:#b0bec5"></span> 📄 Docs
            </button>
        </div>
        <div class="filter-separator graph-only"></div>
        <div class="filter-group graph-only">
            <button class="filter-btn" id="btn-dag-mode" title="Hierarchical mode">⊞ DAG</button>
            <button class="filter-btn" id="btn-highlight-orphans" title="Orphan nodes">◎ Orphans</button>
            <button class="filter-btn" id="btn-dead-code" title="Dead code detection">☠️ Dead</button>
            <button class="filter-btn" id="btn-cycles" title="Circular dependencies">🔄 Cycles</button>
            <button class="filter-btn" id="btn-dirty-only" title="Only files with uncommitted changes (git working tree)">✏️ Dirty</button>
            <button class="filter-btn active" id="btn-notes" title="Show note indicators on annotated files">📝 Notes</button>
            <button class="filter-btn" id="btn-warps-panel" title="Warp points — named camera bookmarks">🌀 Warps</button>
            <button class="filter-btn" id="btn-group-dirs" title="Group by directory">📁 Groups</button>
            <button class="filter-btn" id="btn-path-mode" title="Find path between 2 nodes">🔗 Path</button>
            <button class="filter-btn" id="btn-labels" title="Show file names">🏷️ Names</button>
            <button class="filter-btn" id="btn-recenter" title="Recenter view">🎯 Center</button>
            <button class="filter-btn" id="btn-pilot" title="Pilot mode — free flight (WASD, mouse look, Esc to exit)">🚀 Pilot</button>
        </div>
        <div class="filter-separator graph-only"></div>
        <div class="filter-group graph-only">
            <select id="heatmap-select" class="filter-select" title="Coloring mode">
                <option value="off">🎨 By language</option>
                <option value="complexity">🔥 Complexity</option>
                <option value="fanIn">📥 Fan-in</option>
                <option value="fanOut">📤 Fan-out</option>
                <option value="loc">📏 Lines of code</option>
                <option value="churn">⏱ Churn (commits)</option>
                <option value="lastModified">📆 Last update</option>
                <option value="community">🧩 Communities</option>
            </select>
        </div>
        <div class="filter-separator graph-only"></div>
        <div class="filter-group graph-only">
            <label class="filter-label">
                Node size
                <input type="range" id="node-size-slider" min="1" max="10" value="4" step="0.5">
            </label>
        </div>
        <div class="filter-separator graph-only"></div>
        <div class="filter-group graph-only">
            <label class="filter-label">
                Spread
                <input type="range" id="spread-slider" min="1" max="5" value="1" step="0.5">
            </label>
        </div>
        <div class="filter-separator graph-only"></div>
        <div class="filter-group graph-only">
            <label class="filter-label">
                Depth
                <input type="range" id="depth-slider" min="1" max="5" value="1" step="1">
                <span id="depth-value">1</span>
            </label>
        </div>


    </footer>
    </div><!-- /app-layout -->

    <!-- Heatmap Legend (overlay, outside grid) -->
    <div id="heatmap-legend" class="hidden">
        <span class="legend-label" id="legend-low">Low</span>
        <div class="legend-gradient" id="legend-gradient"></div>
        <span class="legend-label" id="legend-high">High</span>
        <span class="legend-mode" id="legend-mode">—</span>
    </div>

    <!-- Community Palette (overlay) -->
    <div id="community-palette" class="hidden">
        <div class="community-palette-header">
            <span>🧩 Communities</span>
            <div class="community-palette-actions">
                <button id="community-select-all" title="Select all">All</button>
                <button id="community-select-none" title="Unselect all">None</button>
                <button id="community-palette-close" title="Close">✕</button>
            </div>
        </div>
        <div id="community-list"></div>
    </div>

    <!-- Warps Panel (overlay) -->
    <div id="warps-panel" class="hidden">
        <div class="warps-panel-header">
            <span>🌀 Warps</span>
            <div class="warps-panel-actions">
                <button id="warps-capture" title="Capture the current view">📌</button>
                <button id="warps-panel-close" title="Close">✕</button>
            </div>
        </div>
        <div id="warps-list"></div>
    </div>

    <!-- Warp Modal (name + quick slot) -->
    <div id="warp-modal" class="hidden">
        <div class="warp-modal-header">
            <span id="warp-modal-title">📌 New Warp</span>
            <button id="warp-modal-close" title="Close">✕</button>
        </div>
        <div class="warp-modal-body">
            <label class="warp-field">
                <span>Name</span>
                <input id="warp-name-input" type="text" maxlength="60" placeholder="Warp name…" />
            </label>
            <label class="warp-field">
                <span>Quick slot</span>
                <select id="warp-slot-select">
                    <option value="">—</option>
                    <option value="1">Alt+Shift+1</option>
                    <option value="2">Alt+Shift+2</option>
                    <option value="3">Alt+Shift+3</option>
                    <option value="4">Alt+Shift+4</option>
                    <option value="5">Alt+Shift+5</option>
                    <option value="6">Alt+Shift+6</option>
                    <option value="7">Alt+Shift+7</option>
                    <option value="8">Alt+Shift+8</option>
                    <option value="9">Alt+Shift+9</option>
                </select>
            </label>
            <p class="warp-hint">The current camera pose (position + view target) is captured — fly back with a click, or <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>1–9</kbd> in orbit mode.</p>
        </div>
        <div class="warp-modal-footer">
            <button id="warp-save" class="qm-btn qm-primary">Save</button>
            <button id="warp-cancel" class="qm-btn">Cancel</button>
        </div>
    </div>

    <!-- Saved Queries Modal (overlay) -->
    <div id="queries-modal" class="hidden">
        <div class="queries-modal-header">
            <span>⭐ Saved Queries</span>
            <div class="queries-modal-actions">
                <button id="queries-modal-close" title="Close">✕</button>
            </div>
        </div>
        <div id="queries-modal-list"></div>
        <div class="queries-modal-footer">
            <button id="queries-modal-select" class="qm-btn qm-primary" title="Apply selected query">Select</button>
            <button id="queries-modal-delete" class="qm-btn qm-danger" title="Delete selected query">Delete</button>
        </div>
    </div>

    <!-- Tooltip (overlay, outside grid) -->
    <div id="tooltip" class="hidden">
        <div class="tooltip-name" id="tooltip-name">—</div>
        <div class="tooltip-meta" id="tooltip-meta">—</div>
    </div>

    <!-- Minimap (overlay) -->
    <div id="minimap" class="hidden">
        <div class="minimap-header">
            <span>🗺️ Minimap</span>
            <button id="minimap-close" title="Close">✕</button>
        </div>
        <canvas id="minimap-canvas" width="200" height="200"></canvas>
    </div>

    <!-- Pilot HUD (overlay) -->
    <div id="pilot-hud" class="hidden">
        <span class="pilot-title">🚀 PILOT</span>
        <span class="pilot-speed">speed <span id="pilot-speed-mult">×1</span></span>
        <span class="pilot-keys"><kbd>W A S D</kbd> move · <kbd>Q</kbd>/<kbd>E</kbd> down/up · hold <kbd>LMB</kbd>/<kbd>RMB</kbd> fwd/back · wheel = speed · <kbd>Shift</kbd> boost · <kbd>Esc</kbd>/<kbd>Space</kbd> exit</span>
    </div>

    <!-- Flowchart Modal (overlay) -->
    <div id="flow-modal" class="hidden">
        <div class="flow-modal-header">
            <span id="flow-crumbs">⑂ Flow</span>
            <div class="flow-modal-actions">
                <span id="flow-badge" class="flow-badge">—</span>
                <button id="flow-export" title="Export as SVG">⤓ SVG</button>
                <button id="flow-modal-close" title="Close">✕</button>
            </div>
        </div>
        <div id="flow-body"></div>
    </div>

    <!-- Settings Modal (overlay) -->
    <div id="settings-modal" class="hidden">
        <div class="help-modal-content">
            <div class="help-modal-header">
                <span>⚙️ Aura Settings</span>
                <button id="settings-modal-close" title="Close">✕</button>
            </div>
            <div class="help-modal-body">
                <div class="settings-row">
                    <label for="set-riskWindow">Risk history window<span class="settings-hint">Git history used for churn, scoring and explanations</span></label>
                    <select id="set-riskWindow" data-setting="riskWindow">
                        <option value="30">30 days</option>
                        <option value="90">90 days</option>
                        <option value="365">365 days</option>
                    </select>
                </div>
                <div class="settings-row">
                    <label for="set-rotateSpeed">Mouse rotation speed<span class="settings-hint">Speed when dragging the 3D graph (1 = default)</span></label>
                    <span class="settings-slider-wrap">
                        <input type="range" id="set-rotateSpeed" data-setting="rotateSpeed" min="1" max="5" step="0.1" value="1">
                        <span id="set-rotateSpeed-value">1.0</span>
                    </span>
                </div>
                <div class="settings-row">
                    <label for="set-linkStyle">Link style<span class="settings-hint">Straight or curved dependency edges</span></label>
                    <select id="set-linkStyle" data-setting="linkStyle">
                        <option value="straight">Straight</option>
                        <option value="curved">Curved</option>
                    </select>
                </div>
                <div class="settings-row">
                    <label for="set-linkCurvature">Link curvature<span class="settings-hint">0 = straight, 1 = highly curved (when style is curved)</span></label>
                    <input id="set-linkCurvature" data-setting="linkCurvature" type="number" min="0" max="1" step="0.05" />
                </div>
                <div class="settings-row">
                    <label for="set-selectedNodeEffect">Selected node effect<span class="settings-hint">Soft halo (Glow) or real bloom post-processing</span></label>
                    <select id="set-selectedNodeEffect" data-setting="selectedNodeEffect">
                        <option value="glow">Glow</option>
                        <option value="bloom">Bloom</option>
                    </select>
                </div>
                <div class="settings-row">
                    <label for="set-bloomStrength">Bloom intensity<span class="settings-hint">Used when the effect is Bloom</span></label>
                    <input id="set-bloomStrength" data-setting="bloomStrength" type="number" min="0" max="5" step="0.1" />
                </div>
                <div class="settings-row">
                    <label for="set-bloomRadius">Bloom radius</label>
                    <input id="set-bloomRadius" data-setting="bloomRadius" type="number" min="0" max="2" step="0.1" />
                </div>
                <div class="settings-row">
                    <label for="set-bloomThreshold">Bloom threshold</label>
                    <input id="set-bloomThreshold" data-setting="bloomThreshold" type="number" min="0" max="1" step="0.05" />
                </div>
                <div class="settings-row">
                    <label for="set-autoRefresh">Auto-refresh on save<span class="settings-hint">Re-analyze changed files automatically</span></label>
                    <input id="set-autoRefresh" data-setting="autoRefresh" type="checkbox" />
                </div>
                <div class="settings-row">
                    <label for="set-flightSpeed">Flight speed<span class="settings-hint">Pilot mode base speed (×, scene-scaled)</span></label>
                    <input id="set-flightSpeed" data-setting="flightSpeed" type="number" min="0.25" max="4" step="0.05" />
                </div>
                <div class="settings-row">
                    <label for="set-flightSmoothing">Flight smoothing<span class="settings-hint">Acceleration / damping time constant (s) — low = snappy</span></label>
                    <input id="set-flightSmoothing" data-setting="flightSmoothing" type="number" min="0.02" max="0.5" step="0.01" />
                </div>
                <div class="settings-row">
                    <label for="set-mouseSensitivity">Mouse look sensitivity<span class="settings-hint">Radians per pixel while flying</span></label>
                    <input id="set-mouseSensitivity" data-setting="mouseSensitivity" type="number" min="0.0005" max="0.01" step="0.0005" />
                </div>
                <div class="settings-row">
                    <label for="set-invertY">Invert mouse Y (flight)<span class="settings-hint">Flight look: moving up looks down</span></label>
                    <input id="set-invertY" data-setting="invertY" type="checkbox" />
                </div>
                <div class="settings-footer">
                    <span id="settings-open-vscode">Open VS Code Settings →</span>
                    <span class="settings-hint">All settings: Extensions → Aura Visualizer</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Help Modal -->
    <div id="help-modal" class="hidden">
        <div class="help-modal-content">
            <div class="help-modal-header">
                <span>✦ Aura Help — v${version}</span>
                <button id="help-modal-close" title="Close">✕</button>
            </div>
            <div class="help-modal-body">

                <h3>🖱️ Interactive Exploration</h3>
                <table class="help-table">
                    <tr><td><kbd>Click</kbd></td><td>Select node, show detail panel, focus camera</td></tr>
                    <tr><td><kbd>Double-click</kbd></td><td>Open file in VS Code editor</td></tr>
                    <tr><td><kbd>Right-click</kbd></td><td>Pin focus — isolate file + neighbors up to N depth</td></tr>
                    <tr><td><kbd>Shift+Right-click</kbd></td><td>Blast radius — show impact (all dependents) with depth coloring</td></tr>
                    <tr><td><kbd>Shift+Click</kbd></td><td>Multi-select — aggregate stats for multiple files</td></tr>
                    <tr><td><kbd>Scroll</kbd></td><td>Zoom in / out</td></tr>
                    <tr><td><kbd>Drag</kbd></td><td>Rotate the 3D view</td></tr>
                    <tr><td><kbd>Hold LMB / RMB</kbd></td><td>Pilot mode — fly forward / backward while looking around</td></tr>
                    <tr><td><kbd>Background click</kbd></td><td>Clear all selections</td></tr>
                </table>

                <h3>🎹 Keyboard Shortcuts</h3>
                <table class="help-table">
                    <tr><td><kbd>Ctrl+K</kbd></td><td>Open the query filter bar</td></tr>
                    <tr><td><kbd>F</kbd></td><td>Fit to view / recenter</td></tr>
                    <tr><td><kbd>L</kbd></td><td>Toggle node labels</td></tr>
                    <tr><td><kbd>G</kbd></td><td>Toggle directory groups</td></tr>
                    <tr><td><kbd>H</kbd></td><td>Cycle heatmap modes</td></tr>
                    <tr><td><kbd>P</kbd></td><td>Toggle path-finding mode</td></tr>
                    <tr><td><kbd>D</kbd></td><td>Toggle DAG layout</td></tr>
                    <tr><td><kbd>O</kbd></td><td>Highlight orphan files</td></tr>
                    <tr><td><kbd>X</kbd></td><td>Toggle dead code visualization</td></tr>
                    <tr><td><kbd>C</kbd></td><td>Toggle circular dependencies</td></tr>
                    <tr><td><kbd>1</kbd>–<kbd>5</kbd></td><td>Set pinned focus / blast depth</td></tr>
                    <tr><td><kbd>V</kbd></td><td>Toggle timeline compare mode (dual slider)</td></tr>
                    <tr><td><kbd>I</kbd></td><td>Toggle timeline impact cascade</td></tr>
                    <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>Timeline: previous / next commit</td></tr>
                    <tr><td><kbd>Space</kbd></td><td>Toggle pilot mode (free flight)</td></tr>
                    <tr><td><kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>1</kbd>–<kbd>9</kbd></td><td>Fly to the warp point on that quick slot</td></tr>
                    <tr><td><kbd>Escape</kbd></td><td>Reset all selections and modes (in pilot: exit the flight)</td></tr>
                </table>

                <h3>🌡️ Heatmap Modes</h3>
                <table class="help-table">
                    <tr><td><strong>Off</strong></td><td>Color by programming language</td></tr>
                    <tr><td><strong>Complexity</strong></td><td>Cyclomatic complexity (branching, loops)</td></tr>
                    <tr><td><strong>Fan-in</strong></td><td>How many files depend on this file</td></tr>
                    <tr><td><strong>Fan-out</strong></td><td>How many files this file depends on</td></tr>
                    <tr><td><strong>Lines of Code</strong></td><td>File size</td></tr>
                    <tr><td><strong>Churn (commits)</strong></td><td>Git commit count per file (needs Time Travel scan)</td></tr>
                    <tr><td><strong>Last Modified</strong></td><td>File modification time</td></tr>
                    <tr><td><strong>Communities</strong></td><td>Architectural modules (Louvain algorithm)</td></tr>
                </table>

                <h3>🧩 Community Detection</h3>
                <p>The Louvain algorithm detects architectural modules by dependency coupling. Each community is named after its hub file (highest fan-in). Use the floating palette to toggle communities on/off.</p>

                <h3>💥 Blast Radius</h3>
                <p><kbd>Shift+Right-click</kbd> on a file to see all files that transitively depend on it. Nodes are colored by depth of impact: White (source) → Red → Orange → Yellow → Green.</p>

                <h3>▶ Flow Trace</h3>
                <p>In the detail panel, click the <strong>▶</strong> button next to a function to trace its outgoing call chain across files. Files light up progressively by call depth.</p>

                <h3>⑂ Function Flowcharts</h3>
                <p>Click the <strong>⑂</strong> button next to a function to open its <strong>flowchart</strong> — built on demand from the source AST (JS/TS/TSX, Python, C, C++). Conditions fork into <strong>T</strong>/<strong>F</strong> branches that re-join, loops get a framed body with a <strong>back edge</strong>, <code>switch</code> cases line up as columns, and <code>try</code>/<code>catch</code>/<code>finally</code> stack as labelled frames. <strong>Red dashed</strong> boxes are <strong>dead code</strong> (unreachable after a return/throw); the badge shows the function's <strong>complexity</strong> (decision points).</p>
                <p><strong>Click a step</strong> to open the file at its line, and click an underlined <strong>call chip</strong> (<code>↳ fn()</code>) to drill into the called function — the breadcrumb at the top walks back. <strong>⤓ SVG</strong> exports a standalone vector file, the window drags by its header and resizes from any edge or corner, and <kbd>Esc</kbd> closes it.</p>

                <h3>⏳ Time Travel</h3>
                <p>Navigate git history commit by commit. Changed files are color-coded: <span style="color:#00ff88">● green</span> = added, <span style="color:#ff2080">● pink</span> = removed, <span style="color:#ffff00">● yellow</span> = modified. Edges follow the same scheme. Press <kbd>V</kbd> or click <strong>⇄</strong> to enter <strong>Compare mode</strong> with a dual slider to diff any two commits.</p>

                <h3>✏️ Git Working Tree</h3>
                <p>Files with uncommitted changes wear a thin <span style="color:#ffb300">● amber ring</span> in the graph — read straight from <code>git status</code> (modified, staged, untracked, renamed, conflicts). The detail panel shows the exact state on its <strong>Git</strong> line.</p>
                <p>The <strong>✏️ Dirty</strong> toolbar button filters the graph down to those files (nodes and links); the <code>dirty</code> flag does the same in queries. The VS Code status bar shows the risk of the file you are editing and switches to <strong>⚠ N hotspots in your changes</strong> when your changes touch high-risk files — click it to reveal them in the Risk tab.</p>

                <h3>📝 Notes</h3>
                <p>Click a file node to annotate it: the detail panel's <strong>📝 Note</strong> section takes free text (up to 2 000 chars) plus one of five colors. Annotated files wear a <strong>pulsing note-colored ring + dot</strong> in the graph — animated, so they stay visible at any zoom.</p>
                <p>The <strong>📝 Notes</strong> toolbar button (next to ✏️ Dirty) shows / hides the indicators; the <code>hasnote</code> query flag finds annotated files. Notes are stored in <code>.aura/annotations.json</code> — local to your workspace, never committed.</p>

                <h3>🌀 Warp Points</h3>
                <p>Save named camera bookmarks of the 3D view: the <strong>🌀 Warps</strong> toolbar button opens the floating panel; its <strong>📌</strong> button captures the current pose (camera position + view target + orientation). Click a warp to fly there (smooth 800 ms tween), re-capture or rename it, and assign quick slots — <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>1–9</kbd> flies back from anywhere (plain <kbd>Alt</kbd>+<kbd>digit</kbd> is captured by VS Code). The <strong>🏠 Home</strong> row returns to the default fit-to-view pose.</p>
                <p>Warps are stored in <code>.aura/warps.json</code> — local to your workspace, never committed.</p>

                <h3>🚀 Pilot Mode (free flight)</h3>
                <p>The <strong>🚀 Pilot</strong> toolbar button switches to free-flight navigation: <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move (camera-relative — physical key layout, so AZERTY gets ZQSD), <kbd>Q</kbd>/<kbd>E</kbd> down/up, mouse look (click locks the pointer), mouse wheel adjusts the speed, <kbd>Shift</kbd> boosts. Hold the <strong>left mouse button</strong> to fly forward and the <strong>right button</strong> to fly backward — steer by looking; keys keep working in parallel. Press <kbd>Esc</kbd> to exit — or simply hit <kbd>Space</kbd> to toggle pilot mode on/off. The orbit controls take over seamlessly at the exact same view. Flight speed, smoothing, mouse sensitivity and Y-inversion live in <strong>⚙️ Settings</strong>.</p>

                <h3>📂 Directory Filtering</h3>
                <p>In the <strong>File Explorer</strong> panel, each directory has a checkbox to show/hide its files in the graph. Use the <strong>All</strong> / <strong>None</strong> buttons for batch selection. Directories are checked by default.</p>

                <h3>🔍 Query Filter</h3>
                <p>Open the query bar with the <strong>🔍 button</strong> (far right of the tab bar) or <kbd>Ctrl+K</kbd> / <kbd>Cmd+K</kbd> — it stays hidden until you need it. Type a boolean expression over node metrics, e.g. <code>complexity &gt; 20 AND fanIn &gt; 5</code>.</p>
                <p><strong>Fields:</strong> <code>complexity</code>, <code>loc</code>, <code>fanin</code> / <code>fanout</code>, <code>size</code>, <code>mtime</code> / <code>lastmodified</code>, <code>symbols</code>, <code>deadexports</code>, <code>language</code>, <code>name</code>, <code>path</code>, <code>group</code>, <code>extension</code>, <code>community</code>, and flags <code>isorphan</code> / <code>isdead</code> / <code>incycle</code> / <code>ispinned</code> / <code>dirty</code> / <code>hasnote</code>.</p>
                <p><strong>Operators:</strong> <code>==</code>, <code>!=</code>, <code>&gt;</code>, <code>&lt;</code>, <code>&gt;=</code>, <code>&lt;=</code>, <code>~</code> (regex), <code>!~</code>, <code>in [ ... ]</code>, plus <code>AND</code> / <code>OR</code> / <code>NOT</code>.</p>
                <p><strong>Modes:</strong> <strong>Highlight</strong> (dim non-matching), <strong>Filter</strong> (hide non-matching), <strong>Select</strong> (multi-select). Press <strong>⭐</strong> to save a query and <strong>📚</strong> to reopen saved ones.</p>

                <h3>⚙️ In-App Settings</h3>
                <p>The <strong>⚙️ button</strong> in the tab bar (next to 🔍 Query) opens a settings modal — changes apply instantly and are saved to your workspace settings:</p>
                <table class="help-table">
                    <tr><td><strong>Risk history window</strong></td><td>30 / 90 / 365 days — drives the Risk Map, the status bar and hotspots</td></tr>
                    <tr><td><strong>Mouse rotation speed</strong></td><td>Slider 1–5 — speed when dragging the 3D graph</td></tr>
                    <tr><td><strong>Link style</strong></td><td>Straight or curved dependency edges (+ curvature)</td></tr>
                    <tr><td><strong>Selected node effect</strong></td><td>Glow halo or bloom post-processing (+ intensity / radius / threshold)</td></tr>
                    <tr><td><strong>Flight speed / smoothing</strong></td><td>Pilot mode base speed (scene-scaled) and acceleration damping</td></tr>
                    <tr><td><strong>Mouse look sensitivity / invert Y</strong></td><td>Pilot mode mouse-look feel</td></tr>
                    <tr><td><strong>Auto-refresh on save</strong></td><td>Re-analyze changed files automatically</td></tr>
                </table>
                <p>The footer link opens the full <code>auraVisualizer.*</code> settings list in VS Code.</p>

                <h3>🔗 Function Call Labels</h3>
                <p>In the detail panel, <code>function-call</code> links display the actual function name (e.g. <code>helper()</code>). For C/C++, function-call links are only created between files connected via <code>#include</code> — no false positives.</p>

                <h3>⚡ Instant Startup</h3>
                <p>The graph is cached in a local SQLite database (<code>.aura/graph.db</code>). On next launch, the cached graph loads instantly while a background re-scan picks up changes and sends a delta update. File saves trigger incremental O(1) updates.</p>

                <h3>📤 Export for AI</h3>
                <p>Export the graph as JSON for AI assistants. Aura also includes a built-in MCP server for direct AI integration.</p>

                <h3>🗺️ Minimap</h3>
                <p>Toggle with the <strong>🗺️ Map</strong> button. Shows a top-down overview of all nodes. The white rectangle indicates the camera viewport. Click on the minimap to navigate. Drag the header to reposition.</p>

                <h3>📑 Tabbed Views</h3>
                <p>Switch between <strong>8 tabs</strong> in the tab bar for different perspectives:</p>
                <table class="help-table">
                    <tr><td><strong>✦ 3D Graph</strong></td><td>Interactive 3D force-directed dependency graph</td></tr>
                    <tr><td><strong>🗺️ Treemap</strong></td><td>Files nested by directory, sized by LOC/complexity</td></tr>
                    <tr><td><strong>🗑️ Matrix</strong></td><td>N×N Dependency Structure Matrix (DSM)</td></tr>
                    <tr><td><strong>🎵 Chord</strong></td><td>Dependency flows between groups (directories/languages/communities)</td></tr>
                    <tr><td><strong>📊 Metrics</strong></td><td>Bar charts of LOC, complexity, fan-in/out</td></tr>
                    <tr><td><strong>📈 Timeline</strong></td><td>Metric evolution over git history</td></tr>
                    <tr><td><strong>📋 Table</strong></td><td>Sortable, filterable file spreadsheet</td></tr>
                    <tr><td><strong>🛡️ Risk</strong></td><td>Codebase risk dashboard (health score, churn, bus factor)</td></tr>
                </table>

                <h3>🛡️ Risk Map</h3>
                <p>Open the <strong>🛡️ Risk</strong> tab for a codebase health dashboard. It uses a transparent risk score: <code>100 × (0.30·complexity + 0.20·fan-in + 0.10·fan-out + 0.15·cycle + 0.15·dead-code + 0.10·churn)</code>.</p>
                <p>Complexity, fan-in, fan-out and churn are <strong>percentile ranks inside your repository</strong> (0 = lowest file, 1 = highest), so the score is a standing relative to this codebase. A <strong>History window</strong> selector (30 / 90 / 365 days) drives churn, scoring and explanations. Churn is <strong>rename-aware</strong>: files moved with <code>git mv</code> keep their history across the rename.</p>
                <p>High / Medium / Low file lists are collapsible, each row explains <em>why</em> a file scores that way, and clicking a file selects it in the 3D graph. Also included: <strong>📈 Risk Trend</strong>, <strong>🔥 Recently Hot</strong> (last 30 days), <strong>📊 Churn × Complexity</strong> scatter (log scale), and <strong>👤 Bus Factor</strong> (files with a single author). Use <strong>📤 Export Report</strong> to write <code>.aura/risk-report.md</code>.</p>

                <h3>🔗 Edge Colors</h3>
                <table class="help-table">
                    <tr><td><span style="color:#4fc3f7">━━</span> <strong>include</strong></td><td>C <code>#include "file.h"</code></td></tr>
                    <tr><td><span style="color:#4fc3f755">━━</span> <strong>system-include</strong></td><td>C <code>#include &lt;stdlib.h&gt;</code></td></tr>
                    <tr><td><span style="color:#ffd54f">━━</span> <strong>import</strong></td><td>JS/TS <code>import</code></td></tr>
                    <tr><td><span style="color:#ffd54f88">━━</span> <strong>require</strong></td><td>CommonJS <code>require()</code></td></tr>
                    <tr><td><span style="color:#ffd54f66">━━</span> <strong>dynamic-import</strong></td><td><code>import()</code> expressions</td></tr>
                    <tr><td><span style="color:#81c784">━━</span> <strong>function-call</strong></td><td>Cross-file function calls</td></tr>
                    <tr><td><span style="color:#f06292">━━</span> <strong>extends</strong></td><td>Class / struct inheritance</td></tr>
                    <tr><td><span style="color:#ba68c8">━━</span> <strong>implements</strong></td><td>Interface / trait implementation</td></tr>
                    <tr><td><span style="color:#ff8a65">━━</span> <strong>script</strong></td><td>HTML <code>&lt;script src&gt;</code></td></tr>
                    <tr><td><span style="color:#ce93d8">━━</span> <strong>stylesheet</strong></td><td>HTML <code>&lt;link rel="stylesheet"&gt;</code> / CSS <code>@import</code></td></tr>
                    <tr><td><span style="color:#b0bec5">┈┈</span> <strong>doc-reference</strong></td><td>Symbol / filename mention inside a <code>.md</code> / <code>.txt</code> / <code>.rst</code> file</td></tr>
                </table>

                <h3>📄 Documentation in the Graph</h3>
                <p>Markdown, plain-text and reStructuredText files (<code>.md</code>, <code>.markdown</code>, <code>.txt</code>, <code>.rst</code>) are first-class nodes. They are <strong>hidden by default</strong> — toggle the <strong>📄 Docs</strong> button in the toolbar to show them.</p>
                <p>Thin dotted <code>doc-reference</code> edges automatically link each doc file to the code files it mentions — detected from symbol names (functions, classes, methods, exports) and basenames like <code>extension.ts</code>. These edges do <em>not</em> count toward fan-in / fan-out, so hotspot metrics stay clean.</p>
                <p>Doc content is chunked by heading and indexed in a full-text search index. AI assistants can query it through the <code>search_docs</code> MCP tool.</p>
            </div>
        </div>
    </div>

    <!-- Libraries: THREE must load before 3d-force-graph (it checks window.THREE) -->
    <script nonce="${nonce}">window.AURA_CONFIG = ${auraConfig};</script>
    <script nonce="${nonce}" src="${threeUri}"></script>
    <script nonce="${nonce}" src="${forceGraphUri}"></script>
    <!-- App Logic -->
    <script nonce="${nonce}" src="${configUri}"></script>
    <script nonce="${nonce}" src="${queryUri}"></script>
    <script nonce="${nonce}" src="${riskUri}"></script>
    <script nonce="${nonce}" src="${flightCoreUri}"></script>
    <script nonce="${nonce}" src="${flightUri}"></script>
    <script nonce="${nonce}" src="${flowUri}"></script>
    <script nonce="${nonce}" src="${viewsUri}"></script>
    <script nonce="${nonce}" src="${warpsUri}"></script>
    <script nonce="${nonce}" src="${timelineUri}"></script>
    <script nonce="${nonce}" src="${riskMapUri}"></script>
    <script nonce="${nonce}" src="${detailUri}"></script>
    <script nonce="${nonce}" src="${queryUiUri}"></script>
    <script nonce="${nonce}" src="${panelsUri}"></script>
    <script nonce="${nonce}" src="${chatUri}"></script>
    <script nonce="${nonce}" src="${appUri}"></script>
</body>
</html>`;
    }
}

function getNonce(): string {
    const array = new Uint8Array(16);
    require('crypto').randomFillSync(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}
