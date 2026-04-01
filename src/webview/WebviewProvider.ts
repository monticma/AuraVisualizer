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
    private disposables: vscode.Disposable[] = [];
    private onOpenFileEmitter = new vscode.EventEmitter<{ path: string; line?: number }>();
    public readonly onOpenFile = this.onOpenFileEmitter.event;
    private onDisposeEmitter = new vscode.EventEmitter<void>();
    public readonly onDidDispose = this.onDisposeEmitter.event;
    private pendingData: GraphData | undefined;
    private webviewReady = false;

    constructor(extensionUri: vscode.Uri) {
        this.extensionUri = extensionUri;
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

        this.panel.iconPath = vscode.Uri.joinPath(this.extensionUri, 'resources', 'icon.png');
        this.panel.webview.html = this.getHtmlContent(this.panel.webview);

        this.setupMessageHandler();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.webviewReady = false;
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
                }
            },
            null,
            this.disposables
        );
    }

    public sendGraphData(data: GraphData): void {
        this.pendingData = data;
        if (this.webviewReady) {
            this.panel?.webview.postMessage({ type: 'graphData', payload: data });
        }
    }

    public sendGraphDelta(delta: Record<string, unknown>): void {
        if (this.webviewReady) {
            this.panel?.webview.postMessage({ type: 'updateGraph', payload: delta });
        }
    }

    public focusNode(nodeId: string): void {
        this.panel?.webview.postMessage({ type: 'focusNode', payload: { nodeId } });
    }

    public sendBlastRadius(nodeId: string): void {
        this.panel?.webview.postMessage({ type: 'blastRadius', payload: { nodeId } });
    }

    public sendTheme(kind: vscode.ColorThemeKind): void {
        this.panel?.webview.postMessage({
            type: 'themeChanged',
            payload: { kind }
        });
    }

    public sendHistoryIndex(index: unknown): void {
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
                </div>
                <div id="project-info">
                    <span id="project-name">—</span>
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
                <button id="btn-refresh" class="top-btn" title="Refresh analysis">🔄 Refresh</button>
            </div>
        </header>

        <!-- Middle Row: Explorer + Graph + Detail -->
        <div id="middle-row">
            <!-- Explorer Panel -->
            <aside id="explorer-panel" class="collapsed">
                <div class="explorer-header"><h3>Files</h3></div>
                <div id="explorer-tree" class="explorer-tree"></div>
            </aside>

            <!-- 3D Graph Container -->
            <div id="graph-container">
                <div id="loading-overlay">
                    <div class="loading-content">
                        <div class="loading-logo">
                            <span class="loading-logo-icon">✦</span>
                            <span class="loading-logo-text">AURA</span>
                        </div>
                        <p class="loading-status">Analyzing codebase...</p>
                    </div>
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

    <!-- Timeline Bar (Time Machine) -->
    <div id="timeline-bar" class="hidden">
        <button id="timeline-prev" class="timeline-btn" title="Previous commit (←)">◀</button>
        <button id="timeline-next" class="timeline-btn" title="Next commit (→)">▶</button>
        <input type="range" id="timeline-slider" min="0" max="0" value="0" step="1">
        <div id="timeline-info">
            <span id="timeline-hash">—</span>
            <span id="timeline-message">—</span>
            <span id="timeline-date">—</span>
        </div>
        <div id="timeline-progress" class="hidden">
            <span id="timeline-progress-text">⏳ 0/0</span>
        </div>
    </div>

    <!-- Bottom Filter Bar -->
    <footer id="filter-bar">
        <div class="filter-group" id="language-filters">
            <button class="filter-btn active" data-lang="c-source" data-color="#4fc3f7">
                <span class="filter-dot" style="background:#4fc3f7"></span> .c
            </button>
            <button class="filter-btn active" data-lang="c-header" data-color="#81d4fa">
                <span class="filter-dot" style="background:#81d4fa"></span> .h
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
        </div>
        <div class="filter-separator"></div>
        <div class="filter-group">
            <button class="filter-btn" id="btn-dag-mode" title="Hierarchical mode">⊞ DAG</button>
            <button class="filter-btn" id="btn-highlight-orphans" title="Orphan nodes">◎ Orphans</button>
            <button class="filter-btn" id="btn-dead-code" title="Dead code detection">☠️ Dead</button>
            <button class="filter-btn" id="btn-cycles" title="Circular dependencies">🔄 Cycles</button>
            <button class="filter-btn" id="btn-group-dirs" title="Group by directory">📁 Groups</button>
            <button class="filter-btn" id="btn-path-mode" title="Find path between 2 nodes">🔗 Path</button>
            <button class="filter-btn" id="btn-labels" title="Show file names">🏷️ Names</button>
            <button class="filter-btn" id="btn-recenter" title="Recenter view">🎯 Center</button>
        </div>
        <div class="filter-separator"></div>
        <div class="filter-group">
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
        <div class="filter-separator"></div>
        <div class="filter-group">
            <label class="filter-label">
                Node size
                <input type="range" id="node-size-slider" min="1" max="10" value="4" step="0.5">
            </label>
        </div>
        <div class="filter-separator"></div>
        <div class="filter-group">
            <label class="filter-label">
                Spread
                <input type="range" id="spread-slider" min="1" max="5" value="1" step="0.5">
            </label>
        </div>
        <div class="filter-separator"></div>
        <div class="filter-group">
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
