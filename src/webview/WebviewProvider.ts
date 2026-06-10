/**
 * WebviewProvider.ts — Manages the 3D visualization webview panel.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import type { GraphData } from '../analyzer/index';

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
    private webviewReady = false;

    private static readonly VIEW_STATE_KEY = 'aura.viewState';

    constructor(extensionUri: vscode.Uri, workspaceState: vscode.Memento) {
        this.extensionUri = extensionUri;
        this.workspaceState = workspaceState;
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
                        if (this.pendingData) {
                            this.panel?.webview.postMessage({ type: 'graphData', payload: this.pendingData });
                        }
                        if (this.pendingHistoryIndex) {
                            this.panel?.webview.postMessage({ type: 'historyIndex', payload: this.pendingHistoryIndex });
                        }
                        for (const delta of this.pendingDeltas) {
                            this.panel?.webview.postMessage({ type: 'historyDelta', payload: delta });
                        }
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
                }
            },
            null,
            this.disposables
        );
    }

    public sendGraphData(data: GraphData): void {
        this.pendingData = data;
        if (this.webviewReady) {
            // Inject current VS Code settings into meta so the webview
            // applies them on first render (no async timing issue).
            if (!data.meta) { (data as Record<string, unknown>).meta = {}; }
            const meta = data.meta as Record<string, unknown>;
            try {
                const config = vscode.workspace.getConfiguration('auraVisualizer');
                meta._settings = {
                    linkStyle: config.get<string>('linkStyle', 'straight'),
                    linkCurvature: config.get<number>('linkCurvature', 0.25),
                    selectedNodeEffect: config.get<string>('selectedNodeEffect', 'glow'),
                    bloomStrength: config.get<number>('bloomStrength', 1.2),
                    bloomRadius: config.get<number>('bloomRadius', 0.6),
                    bloomThreshold: config.get<number>('bloomThreshold', 0.0),
                };
            } catch { /* ignore */ }
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
                type: 'graphSettings',
                payload: {
                    linkStyle: config.get<string>('linkStyle', 'straight'),
                    linkCurvature: config.get<number>('linkCurvature', 0.25),
                    selectedNodeEffect: config.get<string>('selectedNodeEffect', 'glow'),
                    bloomStrength: config.get<number>('bloomStrength', 1.2),
                    bloomRadius: config.get<number>('bloomRadius', 0.6),
                    bloomThreshold: config.get<number>('bloomThreshold', 0.0),
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
        const forceGraphUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'lib', '3d-force-graph.min.js')
        );
        const threeUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, webviewPath, 'lib', 'three.global.js')
        );

        const nonce = getNonce();

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
        </nav>

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
    </div><!-- /middle-row -->

    <!-- Metrics View -->
    <div id="metrics-view" class="tab-content" data-tab="metrics"></div>

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
            <button class="filter-btn" id="btn-group-dirs" title="Group by directory">📁 Groups</button>
            <button class="filter-btn" id="btn-path-mode" title="Find path between 2 nodes">🔗 Path</button>
            <button class="filter-btn" id="btn-labels" title="Show file names">🏷️ Names</button>
            <button class="filter-btn" id="btn-recenter" title="Recenter view">🎯 Center</button>
        </div>
        <div class="filter-separator graph-only"></div>
        <div class="filter-group graph-only">
            <select id="heatmap-select" class="filter-select" title="Coloring mode">
                <option value="off">🎨 By language</option>
                <option value="complexity">🔥 Complexity</option>
                <option value="fanIn">📥 Fan-in</option>
                <option value="fanOut">📤 Fan-out</option>
                <option value="loc">📏 Lines of code</option>
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
                    <tr><td><kbd>Background click</kbd></td><td>Clear all selections</td></tr>
                </table>

                <h3>🎹 Keyboard Shortcuts</h3>
                <table class="help-table">
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
                    <tr><td><kbd>Escape</kbd></td><td>Reset all selections and modes</td></tr>
                </table>

                <h3>🌡️ Heatmap Modes</h3>
                <table class="help-table">
                    <tr><td><strong>Off</strong></td><td>Color by programming language</td></tr>
                    <tr><td><strong>Complexity</strong></td><td>Cyclomatic complexity (branching, loops)</td></tr>
                    <tr><td><strong>Fan-in</strong></td><td>How many files depend on this file</td></tr>
                    <tr><td><strong>Fan-out</strong></td><td>How many files this file depends on</td></tr>
                    <tr><td><strong>Lines of Code</strong></td><td>File size</td></tr>
                    <tr><td><strong>Last Modified</strong></td><td>Git commit recency</td></tr>
                    <tr><td><strong>Communities</strong></td><td>Architectural modules (Louvain algorithm)</td></tr>
                </table>

                <h3>🧩 Community Detection</h3>
                <p>The Louvain algorithm detects architectural modules by dependency coupling. Each community is named after its hub file (highest fan-in). Use the floating palette to toggle communities on/off.</p>

                <h3>💥 Blast Radius</h3>
                <p><kbd>Shift+Right-click</kbd> on a file to see all files that transitively depend on it. Nodes are colored by depth of impact: White (source) → Red → Orange → Yellow → Green.</p>

                <h3>▶ Flow Trace</h3>
                <p>In the detail panel, click the <strong>▶</strong> button next to a function to trace its outgoing call chain across files. Files light up progressively by call depth.</p>

                <h3>⏳ Time Travel</h3>
                <p>Navigate git history commit by commit. Changed files are color-coded: <span style="color:#00ff88">● green</span> = added, <span style="color:#ff2080">● pink</span> = removed, <span style="color:#ffff00">● yellow</span> = modified. Edges follow the same scheme. Press <kbd>V</kbd> or click <strong>⇄</strong> to enter <strong>Compare mode</strong> with a dual slider to diff any two commits.</p>

                <h3>📂 Directory Filtering</h3>
                <p>In the <strong>File Explorer</strong> panel, each directory has a checkbox to show/hide its files in the graph. Use the <strong>All</strong> / <strong>None</strong> buttons for batch selection. Directories are checked by default.</p>

                <h3>🔗 Function Call Labels</h3>
                <p>In the detail panel, <code>function-call</code> links display the actual function name (e.g. <code>helper()</code>). For C/C++, function-call links are only created between files connected via <code>#include</code> — no false positives.</p>

                <h3>⚡ Instant Startup</h3>
                <p>The graph is cached in a local SQLite database (<code>.aura/graph.db</code>). On next launch, the cached graph loads instantly while a background re-scan picks up changes and sends a delta update. File saves trigger incremental O(1) updates.</p>

                <h3>📤 Export for AI</h3>
                <p>Export the graph as JSON for AI assistants. Aura also includes a built-in MCP server for direct AI integration.</p>

                <h3>🗺️ Minimap</h3>
                <p>Toggle with the <strong>🗺️ Map</strong> button. Shows a top-down overview of all nodes. The white rectangle indicates the camera viewport. Click on the minimap to navigate. Drag the header to reposition.</p>

                <h3>📑 Tabbed Views</h3>
                <p>Switch between <strong>7 tabs</strong> in the tab bar for different perspectives:</p>
                <table class="help-table">
                    <tr><td><strong>✦ 3D Graph</strong></td><td>Interactive 3D force-directed dependency graph</td></tr>
                    <tr><td><strong>🗺️ Treemap</strong></td><td>Files nested by directory, sized by LOC/complexity</td></tr>
                    <tr><td><strong>🗑️ Matrix</strong></td><td>N×N Dependency Structure Matrix (DSM)</td></tr>
                    <tr><td><strong>🎵 Chord</strong></td><td>Dependency flows between groups (directories/languages/communities)</td></tr>
                    <tr><td><strong>📊 Metrics</strong></td><td>Bar charts of LOC, complexity, fan-in/out</td></tr>
                    <tr><td><strong>📈 Timeline</strong></td><td>Metric evolution over git history</td></tr>
                    <tr><td><strong>📋 Table</strong></td><td>Sortable, filterable file spreadsheet</td></tr>
                </table>

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
    <script nonce="${nonce}" src="${threeUri}"></script>
    <script nonce="${nonce}" src="${forceGraphUri}"></script>
    <!-- App Logic -->
    <script nonce="${nonce}" src="${configUri}"></script>
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
