"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode3 = __toESM(require("vscode"));
var path2 = __toESM(require("path"));
var fs = __toESM(require("fs/promises"));
var import_worker_threads = require("worker_threads");

// src/webview/WebviewProvider.ts
var vscode = __toESM(require("vscode"));
var path = __toESM(require("path"));
var WebviewProvider = class _WebviewProvider {
  static viewType = "auraVisualizer.graphView";
  panel;
  extensionUri;
  workspaceState;
  disposables = [];
  onOpenFileEmitter = new vscode.EventEmitter();
  onOpenFile = this.onOpenFileEmitter.event;
  onDisposeEmitter = new vscode.EventEmitter();
  onDidDispose = this.onDisposeEmitter.event;
  pendingData;
  pendingHistoryIndex;
  pendingDeltas = [];
  webviewReady = false;
  static VIEW_STATE_KEY = "aura.viewState";
  constructor(extensionUri, workspaceState) {
    this.extensionUri = extensionUri;
    this.workspaceState = workspaceState;
  }
  show() {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return this.panel;
    }
    this.panel = vscode.window.createWebviewPanel(
      _WebviewProvider.viewType,
      "Aura \u2014 3D Visualizer",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, "out", "webview")
        ]
      }
    );
    this.initPanel();
    return this.panel;
  }
  restore(panel) {
    this.panel = panel;
    panel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, "out", "webview")
      ]
    };
    this.initPanel();
  }
  initPanel() {
    if (!this.panel)
      return;
    this.panel.iconPath = vscode.Uri.joinPath(this.extensionUri, "resources", "icon.png");
    this.panel.webview.html = this.getHtmlContent(this.panel.webview);
    this.setupMessageHandler();
    this.panel.onDidDispose(() => {
      this.panel = void 0;
      this.webviewReady = false;
      this.pendingDeltas = [];
      this.disposables.forEach((d) => d.dispose());
      this.disposables = [];
      this.onDisposeEmitter.fire();
    });
  }
  setupMessageHandler() {
    if (!this.panel)
      return;
    this.panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.type) {
          case "ready":
            this.webviewReady = true;
            if (this.pendingData) {
              this.panel?.webview.postMessage({ type: "graphData", payload: this.pendingData });
            }
            if (this.pendingHistoryIndex) {
              this.panel?.webview.postMessage({ type: "historyIndex", payload: this.pendingHistoryIndex });
            }
            for (const delta of this.pendingDeltas) {
              this.panel?.webview.postMessage({ type: "historyDelta", payload: delta });
            }
            break;
          case "openFile":
            if (message.payload) {
              this.onOpenFileEmitter.fire({
                path: message.payload.path,
                line: message.payload.line
              });
            }
            break;
          case "requestRefresh":
            vscode.commands.executeCommand("auraVisualizer.refresh");
            break;
          case "requestExport":
            vscode.commands.executeCommand("auraVisualizer.exportGraph");
            break;
          case "saveViewState":
            if (message.payload) {
              this.workspaceState.update(_WebviewProvider.VIEW_STATE_KEY, message.payload);
            }
            break;
          case "requestViewState":
            this.sendSavedViewState();
            break;
        }
      },
      null,
      this.disposables
    );
  }
  sendGraphData(data) {
    this.pendingData = data;
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "graphData", payload: data });
    }
  }
  sendSavedViewState() {
    const state = this.workspaceState.get(_WebviewProvider.VIEW_STATE_KEY);
    if (state) {
      this.panel?.webview.postMessage({ type: "restoreViewState", payload: state });
    }
  }
  sendGraphDelta(delta) {
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "updateGraph", payload: delta });
    }
  }
  sendProgress(phase, message) {
    this.panel?.webview.postMessage({ type: "progress", payload: { phase, message } });
  }
  focusNode(nodeId) {
    this.panel?.webview.postMessage({ type: "focusNode", payload: { nodeId } });
  }
  sendBlastRadius(nodeId) {
    this.panel?.webview.postMessage({ type: "blastRadius", payload: { nodeId } });
  }
  sendTheme(kind) {
    this.panel?.webview.postMessage({
      type: "themeChanged",
      payload: { kind }
    });
  }
  sendHistoryIndex(index) {
    this.pendingHistoryIndex = index;
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "historyIndex", payload: index });
    }
  }
  sendHistoryProgress(scanned, total) {
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "historyProgress", payload: { scanned, total } });
    }
  }
  sendHistoryDelta(delta) {
    if (this.webviewReady) {
      this.panel?.webview.postMessage({ type: "historyDelta", payload: delta });
    } else {
      this.pendingDeltas.push(delta);
    }
  }
  get isVisible() {
    return this.panel?.visible ?? false;
  }
  dispose() {
    this.panel?.dispose();
  }
  getHtmlContent(webview) {
    const webviewPath = path.join("out", "webview");
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, webviewPath, "css", "style.css")
    );
    const appUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, webviewPath, "js", "app.js")
    );
    const configUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, webviewPath, "js", "graph-config.js")
    );
    const forceGraphUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, webviewPath, "lib", "3d-force-graph.min.js")
    );
    const threeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, webviewPath, "lib", "three.global.js")
    );
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-eval' ${webview.cspSource}; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
    <link rel="stylesheet" href="${styleUri}">
    <title>Aura \u2014 3D Visualizer</title>
</head>
<body>
    <div id="app-layout">
        <!-- Top Bar -->
        <header id="top-bar">
            <div class="top-bar-left">
                <button id="btn-toggle-explorer" class="top-btn icon-btn" title="Toggle explorer (\u2630)">\u2630</button>
                <div id="logo">
                    <span class="logo-icon">\u2726</span>
                    <span class="logo-text">AURA</span>
                </div>
                <div id="project-info">
                    <span id="project-name">\u2014</span>
                </div>
            </div>
            <div class="top-bar-center">
                <div id="search-container">
                    <span class="search-icon">\u2315</span>
                    <input type="text" id="search-input" placeholder="Search file..." autocomplete="off">
                    <div id="search-results" class="hidden"></div>
                </div>
            </div>
            <div class="top-bar-right">
                <div id="stats-bar">
                    <span class="stat" id="stat-files">0 files</span>
                    <span class="stat-separator">\xB7</span>
                    <span class="stat" id="stat-links">0 links</span>
                    <span class="stat-separator">\xB7</span>
                    <span class="stat" id="stat-time">\u2014</span>
                </div>
                <button id="btn-export" class="top-btn" title="Export graph for AI">\u{1F4E4} Export</button>
                <button id="btn-refresh" class="top-btn" title="Refresh analysis">\u{1F504} Refresh</button>
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
                            <span class="loading-logo-icon">\u2726</span>
                            <span class="loading-logo-text">AURA</span>
                        </div>
                        <div class="loading-progress-bar">
                            <div class="loading-progress-fill" id="loading-progress-fill"></div>
                        </div>
                        <p class="loading-status" id="loading-status">Analyzing codebase...</p>
                    </div>
                </div>
            </div>

            <!-- Detail Panel -->
            <aside id="detail-panel" class="collapsed">
        <div class="panel-header">
            <div class="panel-file-icon" id="panel-icon">\u{1F4C4}</div>
            <div class="panel-file-info">
                <h2 id="panel-filename">\u2014</h2>
                <span id="panel-path" class="panel-path">\u2014</span>
            </div>
            <button id="panel-close" class="panel-close">\u2715</button>
        </div>
        <div class="panel-section">
            <div class="panel-grid">
                <div class="panel-metric">
                    <span class="metric-label">Language</span>
                    <span class="metric-value" id="panel-language">\u2014</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Folder</span>
                    <span class="metric-value" id="panel-group">\u2014</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Lines</span>
                    <span class="metric-value" id="panel-loc">\u2014</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Size</span>
                    <span class="metric-value" id="panel-size">\u2014</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Modified</span>
                    <span class="metric-value" id="panel-mtime">\u2014</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Fan-out</span>
                    <span class="metric-value" id="panel-fanout">\u2014</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Fan-in</span>
                    <span class="metric-value" id="panel-fanin">\u2014</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Complexity</span>
                    <span class="metric-value" id="panel-complexity">\u2014</span>
                </div>
                <div class="panel-metric">
                    <span class="metric-label">Symbols</span>
                    <span class="metric-value" id="panel-symbols-count">\u2014</span>
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

    <!-- Timeline Bar (Time Travel) -->
    <div id="timeline-bar" class="hidden">
        <button id="timeline-prev" class="timeline-btn" title="Previous commit (\u2190)">\u25C0</button>
        <button id="timeline-next" class="timeline-btn" title="Next commit (\u2192)">\u25B6</button>
        <input type="range" id="timeline-slider" min="0" max="0" value="0" step="1">
        <div id="timeline-info">
            <span id="timeline-hash">\u2014</span>
            <span id="timeline-message">\u2014</span>
            <span id="timeline-date">\u2014</span>
        </div>
        <div id="timeline-progress" class="hidden">
            <span id="timeline-progress-text">\u23F3 0/0</span>
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
            <button class="filter-btn" id="btn-dag-mode" title="Hierarchical mode">\u229E DAG</button>
            <button class="filter-btn" id="btn-highlight-orphans" title="Orphan nodes">\u25CE Orphans</button>
            <button class="filter-btn" id="btn-dead-code" title="Dead code detection">\u2620\uFE0F Dead</button>
            <button class="filter-btn" id="btn-cycles" title="Circular dependencies">\u{1F504} Cycles</button>
            <button class="filter-btn" id="btn-group-dirs" title="Group by directory">\u{1F4C1} Groups</button>
            <button class="filter-btn" id="btn-path-mode" title="Find path between 2 nodes">\u{1F517} Path</button>
            <button class="filter-btn" id="btn-labels" title="Show file names">\u{1F3F7}\uFE0F Names</button>
            <button class="filter-btn" id="btn-recenter" title="Recenter view">\u{1F3AF} Center</button>
        </div>
        <div class="filter-separator"></div>
        <div class="filter-group">
            <select id="heatmap-select" class="filter-select" title="Coloring mode">
                <option value="off">\u{1F3A8} By language</option>
                <option value="complexity">\u{1F525} Complexity</option>
                <option value="fanIn">\u{1F4E5} Fan-in</option>
                <option value="fanOut">\u{1F4E4} Fan-out</option>
                <option value="loc">\u{1F4CF} Lines of code</option>
                <option value="lastModified">\u{1F4C6} Last update</option>
                <option value="community">\u{1F9E9} Communities</option>
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
        <span class="legend-mode" id="legend-mode">\u2014</span>
    </div>

    <!-- Community Palette (overlay) -->
    <div id="community-palette" class="hidden">
        <div class="community-palette-header">
            <span>\u{1F9E9} Communities</span>
            <div class="community-palette-actions">
                <button id="community-select-all" title="Select all">All</button>
                <button id="community-select-none" title="Unselect all">None</button>
                <button id="community-palette-close" title="Close">\u2715</button>
            </div>
        </div>
        <div id="community-list"></div>
    </div>

    <!-- Tooltip (overlay, outside grid) -->
    <div id="tooltip" class="hidden">
        <div class="tooltip-name" id="tooltip-name">\u2014</div>
        <div class="tooltip-meta" id="tooltip-meta">\u2014</div>
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
};
function getNonce() {
  const array = new Uint8Array(16);
  require("crypto").randomFillSync(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

// src/AuraTreeProvider.ts
var vscode2 = __toESM(require("vscode"));
var AuraTreeItem = class extends vscode2.TreeItem {
  constructor(entry, collapsible) {
    const label = entry.kind === "file" ? entry.node.name : entry.kind === "stat" ? `${entry.label}: ${entry.value}` : entry.label;
    super(label, collapsible);
    this.entry = entry;
    if (entry.kind === "header") {
      this.iconPath = new vscode2.ThemeIcon(entry.icon);
    } else if (entry.kind === "stat") {
      this.iconPath = new vscode2.ThemeIcon(entry.icon);
    } else if (entry.kind === "file") {
      this.description = entry.metric;
      this.iconPath = new vscode2.ThemeIcon("file");
      this.command = {
        command: "auraVisualizer.openFileFromTree",
        title: "Open File",
        arguments: [entry.node.path]
      };
      this.tooltip = `${entry.node.path}
Complexity: ${entry.node.complexity}
Lines: ${entry.node.linesOfCode}
Fan-in: ${entry.node.fanIn} / Fan-out: ${entry.node.fanOut}`;
    }
  }
};
var AuraTreeProvider = class {
  _onDidChangeTreeData = new vscode2.EventEmitter();
  onDidChangeTreeData = this._onDidChangeTreeData.event;
  data;
  update(data) {
    this.data = data;
    this._onDidChangeTreeData.fire(void 0);
  }
  getTreeItem(element) {
    return element;
  }
  getChildren(element) {
    if (!this.data) {
      return [new AuraTreeItem(
        { kind: "stat", label: "No data", value: "Open a workspace and run Aura", icon: "info" },
        vscode2.TreeItemCollapsibleState.None
      )];
    }
    if (!element) {
      return [
        new AuraTreeItem({ kind: "header", label: "Stats", icon: "graph" }, vscode2.TreeItemCollapsibleState.Expanded),
        new AuraTreeItem({ kind: "header", label: "Most Complex", icon: "flame" }, vscode2.TreeItemCollapsibleState.Collapsed),
        new AuraTreeItem({ kind: "header", label: "Largest Files", icon: "file-binary" }, vscode2.TreeItemCollapsibleState.Collapsed),
        new AuraTreeItem({ kind: "header", label: "Orphan Files", icon: "warning" }, vscode2.TreeItemCollapsibleState.Collapsed)
      ];
    }
    if (element.entry.kind !== "header")
      return [];
    const d = this.data;
    switch (element.entry.label) {
      case "Stats": {
        const langs = Object.entries(d.meta.languageStats).map(([lang, s]) => `${lang}: ${s.count}`).join(", ");
        return [
          this.stat("Files", String(d.meta.totalFiles), "file"),
          this.stat("Links", String(d.meta.totalLinks), "link"),
          this.stat("Function Calls", String(d.meta.functionCallLinks), "symbol-method"),
          this.stat("Groups", String(d.meta.groups.length), "folder"),
          this.stat("Languages", langs, "symbol-color")
        ];
      }
      case "Most Complex": {
        return [...d.nodes].sort((a, b) => b.complexity - a.complexity).slice(0, 10).map((n) => new AuraTreeItem(
          { kind: "file", node: n, metric: `complexity: ${n.complexity}` },
          vscode2.TreeItemCollapsibleState.None
        ));
      }
      case "Largest Files": {
        return [...d.nodes].sort((a, b) => b.linesOfCode - a.linesOfCode).slice(0, 10).map((n) => new AuraTreeItem(
          { kind: "file", node: n, metric: `${n.linesOfCode} lines` },
          vscode2.TreeItemCollapsibleState.None
        ));
      }
      case "Orphan Files": {
        return d.nodes.filter((n) => n.fanIn === 0 && n.fanOut === 0).map((n) => new AuraTreeItem(
          { kind: "file", node: n, metric: n.language },
          vscode2.TreeItemCollapsibleState.None
        ));
      }
      default:
        return [];
    }
  }
  stat(label, value, icon) {
    return new AuraTreeItem(
      { kind: "stat", label, value, icon },
      vscode2.TreeItemCollapsibleState.None
    );
  }
};

// src/analyzer/scanner.ts
var import_promises = require("fs/promises");
var import_path = require("path");
var SUPPORTED_EXTENSIONS = /* @__PURE__ */ new Set([".c", ".h", ".js", ".ts", ".py", ".css", ".html", ".htm", ".java", ".go", ".rs"]);
var LANGUAGE_MAP = {
  ".c": "c",
  ".h": "c",
  ".js": "javascript",
  ".ts": "typescript",
  ".py": "python",
  ".css": "css",
  ".html": "html",
  ".htm": "html",
  ".java": "java",
  ".go": "go",
  ".rs": "rust"
};
async function scanSingleFile(fullPath, rootDir) {
  const ext = (0, import_path.extname)(fullPath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(ext))
    return null;
  try {
    const fileStat = await (0, import_promises.stat)(fullPath);
    const content = await (0, import_promises.readFile)(fullPath, "utf-8");
    const linesOfCode = content.split("\n").filter((l) => l.trim().length > 0).length;
    const relativePath = (0, import_path.relative)(rootDir, fullPath);
    const parts = relativePath.split("/");
    const group = parts.length > 1 ? parts[0] : "/";
    const name = parts[parts.length - 1];
    return {
      id: relativePath,
      name,
      path: relativePath,
      fullPath,
      language: LANGUAGE_MAP[ext] || "unknown",
      extension: ext,
      size: fileStat.size,
      linesOfCode,
      lastModified: Math.floor(fileStat.mtimeMs),
      group,
      content
    };
  } catch {
    return null;
  }
}

// src/analyzer/graph-builder.ts
var import_path3 = require("path");

// src/analyzer/parsers/base-parser.ts
var BaseParser = class {
  language;
  constructor(language) {
    this.language = language;
  }
  /** Whether this parser uses Tree-sitter AST (override in subclass). */
  get usesTreeSitter() {
    return false;
  }
  parse(_fileInfo, _options) {
    return [];
  }
  /** Parse using a Tree-sitter syntax tree (override in TS-based parsers). */
  parseAST(_tree, _fileInfo, _options) {
    return this.parse(_fileInfo, _options);
  }
  /** Extract symbols using a Tree-sitter syntax tree (override in TS-based parsers). */
  extractSymbolsAST(_tree, _fileInfo) {
    return { functions: [], externs: [], structs: [], enums: [], macros: [], classes: [], exports: [], interfaces: [], traits: [], typeAliases: [], methods: [] };
  }
  /** Extract cross-file function calls using AST (override in TS-based parsers). */
  extractCallsAST(_tree, _fileInfo, _globalFunctions) {
    return [];
  }
  /** Extract heritage relations (extends/implements) from AST. */
  extractHeritageRelations(_tree, _fileInfo) {
    return [];
  }
  extractMatches(content, regex, type, sourceId, labelFn) {
    const relations = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      const target = match[1];
      if (target) {
        relations.push({
          source: sourceId,
          target,
          type,
          label: labelFn ? labelFn(match) : `${type}: ${target}`
        });
      }
    }
    return relations;
  }
};

// src/analyzer/parsers/ts-c-parser.ts
var C_BUILTINS = /* @__PURE__ */ new Set([
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "return",
  "break",
  "continue",
  "goto",
  "sizeof",
  "typeof",
  "typedef",
  "struct",
  "union",
  "enum",
  "static",
  "extern",
  "inline",
  "const",
  "volatile",
  "register",
  "auto",
  "void",
  "int",
  "char",
  "float",
  "double",
  "long",
  "short",
  "unsigned",
  "signed",
  "bool",
  "BOOL",
  "printf",
  "fprintf",
  "sprintf",
  "snprintf",
  "scanf",
  "sscanf",
  "malloc",
  "calloc",
  "realloc",
  "free",
  "memcpy",
  "memset",
  "memmove",
  "strlen",
  "strcpy",
  "strncpy",
  "strcmp",
  "strncmp",
  "strcat",
  "fopen",
  "fclose",
  "fread",
  "fwrite",
  "fseek",
  "ftell",
  "exit",
  "abort",
  "assert",
  "NULL",
  "true",
  "false",
  "defined",
  "offsetof",
  "va_start",
  "va_end",
  "va_arg",
  "__attribute__",
  "__declspec",
  "visibility",
  "__extension__"
]);
var TreeSitterCParser = class extends BaseParser {
  constructor() {
    super("c");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── AST-based parse: extract #include relations ────────────
  parseAST(tree, fileInfo, options = {}) {
    const relations = [];
    this.walkForIncludes(tree.rootNode, fileInfo.id, relations, !!options.includeSystemHeaders);
    return relations;
  }
  walkForIncludes(node, sourceId, relations, includeSystem) {
    if (node.type === "preproc_include") {
      const pathNode = node.childForFieldName("path");
      if (pathNode) {
        const raw = pathNode.text;
        if (pathNode.type === "string_literal") {
          const target = raw.slice(1, -1);
          relations.push({
            source: sourceId,
            target,
            type: "include",
            label: `#include "${target}"`
          });
        } else if (pathNode.type === "system_lib_string" && includeSystem) {
          const target = raw.slice(1, -1);
          relations.push({
            source: sourceId,
            target,
            type: "system-include",
            label: `#include <${target}>`
          });
        }
      }
      return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForIncludes(node.child(i), sourceId, relations, includeSystem);
    }
    return relations;
  }
  // ── AST-based symbol extraction ────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForSymbols(tree.rootNode, symbols);
    return symbols;
  }
  walkForSymbols(node, symbols) {
    switch (node.type) {
      case "function_definition":
        this.extractFunction(node, symbols);
        return;
      case "declaration":
        this.extractDeclaration(node, symbols);
        return;
      case "type_definition":
        this.extractTypedef(node, symbols);
        return;
      case "preproc_def":
        this.extractMacro(node, symbols, false);
        return;
      case "preproc_function_def":
        this.extractMacro(node, symbols, true);
        return;
      case "struct_specifier":
        if (node.parent?.type !== "type_definition" && node.childForFieldName("body")) {
          this.extractStruct(node, symbols, "struct");
        }
        break;
      case "enum_specifier":
        if (node.parent?.type !== "type_definition" && node.childForFieldName("body")) {
          this.extractEnum(node, symbols);
        }
        break;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForSymbols(node.child(i), symbols);
    }
  }
  extractFunction(node, symbols) {
    const declarator = this.findDescendant(node, "function_declarator");
    if (!declarator) {
      return;
    }
    const nameNode = declarator.childForFieldName("declarator");
    const name = nameNode?.text;
    if (!name || C_BUILTINS.has(name)) {
      return;
    }
    const returnType = this.getReturnType(node, declarator);
    const params = this.getParams(declarator);
    const line = node.startPosition.row + 1;
    symbols.functions.push({ name, returnType, params, line, type: "function" });
  }
  extractDeclaration(node, symbols) {
    const text = node.text;
    if (text.startsWith("extern")) {
      const declarator = this.findDescendant(node, "function_declarator");
      if (declarator) {
        const nameNode = declarator.childForFieldName("declarator");
        const name = nameNode?.text;
        if (name) {
          symbols.externs.push({ name, type: "extern" });
          return;
        }
      }
    }
  }
  extractTypedef(node, symbols) {
    const structSpec = this.findDescendant(node, "struct_specifier");
    if (structSpec) {
      const typeId = this.findChild(node, "type_identifier");
      if (typeId) {
        symbols.structs.push({ name: typeId.text, type: "typedef-struct" });
      } else {
        this.extractStruct(structSpec, symbols, "struct");
      }
      return;
    }
    const enumSpec = this.findDescendant(node, "enum_specifier");
    if (enumSpec) {
      const typeId = this.findChild(node, "type_identifier");
      if (typeId) {
        symbols.enums.push({ name: typeId.text, type: "enum" });
      } else {
        this.extractEnum(enumSpec, symbols);
      }
    }
  }
  extractStruct(node, symbols, kind) {
    const nameNode = node.childForFieldName("name");
    if (nameNode) {
      symbols.structs.push({ name: nameNode.text, type: kind });
    }
  }
  extractEnum(node, symbols) {
    const nameNode = node.childForFieldName("name");
    if (nameNode) {
      symbols.enums.push({ name: nameNode.text, type: "enum" });
    }
  }
  extractMacro(node, symbols, isFunctionLike) {
    const nameNode = node.childForFieldName("name");
    if (nameNode) {
      symbols.macros.push({
        name: nameNode.text,
        type: isFunctionLike ? "function-macro" : "constant-macro"
      });
    }
  }
  // ── AST-based call extraction ──────────────────────────────
  extractCallsAST(tree, _fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: _fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  /** Get raw list of external calls (for backward compat with extractCalls). */
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_definition") {
      const declarator = this.findDescendant(node, "function_declarator");
      const nameNode = declarator?.childForFieldName("declarator");
      if (nameNode) {
        defined.add(nameNode.text);
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call_expression") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!C_BUILTINS.has(name) && !/^[A-Z_]+$/.test(name) && !definedHere.has(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── AST utilities ──────────────────────────────────────────
  getReturnType(funcDef, declarator) {
    const typeNode = funcDef.childForFieldName("type");
    if (typeNode) {
      const directDecl = funcDef.childForFieldName("declarator");
      if (directDecl?.type === "pointer_declarator") {
        return typeNode.text + "*";
      }
      return typeNode.text;
    }
    const before = funcDef.text.substring(0, declarator.startIndex - funcDef.startIndex).trim();
    return before || "int";
  }
  getParams(declarator) {
    const paramList = declarator.childForFieldName("parameters");
    if (!paramList) {
      return "";
    }
    const text = paramList.text;
    return text.startsWith("(") ? text.slice(1, -1).trim() : text.trim();
  }
  findDescendant(node, type) {
    if (node.type === type) {
      return node;
    }
    for (let i = 0; i < node.childCount; i++) {
      const result = this.findDescendant(node.child(i), type);
      if (result) {
        return result;
      }
    }
    return null;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === type) {
        return child;
      }
    }
    return null;
  }
};

// src/analyzer/parsers/ts-js-parser.ts
var JS_KEYWORDS = /* @__PURE__ */ new Set([
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "return",
  "break",
  "continue",
  "throw",
  "try",
  "catch",
  "finally",
  "new",
  "delete",
  "typeof",
  "instanceof",
  "void",
  "in",
  "of",
  "this",
  "super",
  "with",
  "yield",
  "await",
  "debugger",
  "constructor",
  "get",
  "set",
  "static",
  "async",
  "true",
  "false",
  "null",
  "undefined",
  "NaN",
  "Infinity",
  "console",
  "window",
  "document",
  "global",
  "process",
  "require",
  "module",
  "exports",
  "import",
  "export",
  "default",
  "from"
]);
var JS_BUILTINS = /* @__PURE__ */ new Set([
  ...JS_KEYWORDS,
  "parseInt",
  "parseFloat",
  "isNaN",
  "isFinite",
  "encodeURI",
  "decodeURI",
  "encodeURIComponent",
  "decodeURIComponent",
  "eval",
  "JSON",
  "Math",
  "Object",
  "Array",
  "String",
  "Number",
  "Boolean",
  "Date",
  "RegExp",
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Promise",
  "Proxy",
  "Reflect",
  "Symbol",
  "BigInt",
  "ArrayBuffer",
  "SharedArrayBuffer",
  "DataView",
  "Float32Array",
  "Float64Array",
  "Int8Array",
  "Int16Array",
  "Int32Array",
  "Uint8Array",
  "Uint16Array",
  "Uint32Array",
  "URL",
  "URLSearchParams",
  "setTimeout",
  "setInterval",
  "clearTimeout",
  "clearInterval",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "fetch",
  "alert",
  "confirm",
  "prompt",
  "addEventListener",
  "removeEventListener",
  "dispatchEvent",
  "createElement",
  "getElementById",
  "querySelector",
  "querySelectorAll",
  "log",
  "warn",
  "error",
  "info",
  "debug",
  "trace",
  "dir",
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "slice",
  "concat",
  "map",
  "filter",
  "reduce",
  "forEach",
  "find",
  "findIndex",
  "some",
  "every",
  "includes",
  "indexOf",
  "join",
  "sort",
  "reverse",
  "flat",
  "flatMap",
  "keys",
  "values",
  "entries",
  "assign",
  "freeze",
  "seal",
  "defineProperty",
  "getOwnPropertyNames",
  "hasOwnProperty",
  "toString",
  "valueOf",
  "toJSON",
  "then",
  "catch",
  "resolve",
  "reject",
  "all",
  "allSettled",
  "race",
  "any",
  "stringify",
  "parse",
  "replace",
  "match",
  "search",
  "split",
  "trim",
  "startsWith",
  "endsWith",
  "charAt",
  "charCodeAt",
  "substring",
  "repeat",
  "padStart",
  "padEnd",
  "bind",
  "call",
  "apply",
  "next",
  "done",
  "emit",
  "on",
  "once",
  "off"
]);
var TreeSitterJSParser = class extends BaseParser {
  constructor() {
    super("javascript");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── AST-based parse: extract import/require relations ──────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    this.walkForImports(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkForImports(node, sourceId, relations) {
    switch (node.type) {
      case "import_statement":
        this.extractImport(node, sourceId, relations);
        return;
      case "call_expression": {
        const funcNode = node.childForFieldName("function");
        if (funcNode) {
          if (funcNode.type === "identifier" && funcNode.text === "require") {
            this.extractCallImport(node, sourceId, relations, "require");
          } else if (funcNode.type === "import") {
            this.extractCallImport(node, sourceId, relations, "dynamic-import");
          }
        }
        break;
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForImports(node.child(i), sourceId, relations);
    }
  }
  extractImport(node, sourceId, relations) {
    const source = node.childForFieldName("source");
    if (!source) {
      return;
    }
    const target = this.stripQuotes(source.text);
    if (!target) {
      return;
    }
    const isTypeImport = this.hasDirectChild(node, "type");
    relations.push({
      source: sourceId,
      target,
      type: isTypeImport ? "import-type" : "import",
      label: isTypeImport ? `import type from '${target}'` : `import from '${target}'`
    });
  }
  extractCallImport(node, sourceId, relations, type) {
    const args = node.childForFieldName("arguments");
    if (!args) {
      return;
    }
    const firstArg = args.child(1);
    if (!firstArg) {
      return;
    }
    let target;
    if (firstArg.type === "string" || firstArg.type === "string_fragment") {
      target = this.stripQuotes(firstArg.text);
    } else if (firstArg.type === "template_string") {
      const raw = firstArg.text.slice(1, -1);
      target = raw.split("$")[0].split("?")[0];
    } else {
      return;
    }
    if (!target) {
      return;
    }
    relations.push({
      source: sourceId,
      target,
      type,
      label: type === "require" ? `require('${target}')` : `import('${target}')`
    });
  }
  // ── AST-based symbol extraction ────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForSymbols(tree.rootNode, symbols);
    return symbols;
  }
  walkForSymbols(node, symbols) {
    switch (node.type) {
      case "function_declaration":
      case "generator_function_declaration":
        this.extractFunctionDecl(node, symbols);
        return;
      case "lexical_declaration":
      case "variable_declaration":
        this.extractVariableDecl(node, symbols);
        return;
      case "class_declaration":
        this.extractClass(node, symbols);
        return;
      case "export_statement":
        this.extractExport(node, symbols);
        return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForSymbols(node.child(i), symbols);
    }
  }
  extractFunctionDecl(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name || JS_KEYWORDS.has(name)) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isAsync = this.hasDirectChild(node, "async");
    const isGenerator = node.type === "generator_function_declaration";
    const sym = {
      name,
      type: isGenerator ? "generator" : "function",
      line
    };
    if (isAsync) {
      sym.isAsync = true;
    }
    symbols.functions.push(sym);
  }
  extractVariableDecl(node, symbols) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type !== "variable_declarator") {
        continue;
      }
      const nameNode = child.childForFieldName("name");
      const valueNode = child.childForFieldName("value");
      if (!nameNode || !valueNode) {
        continue;
      }
      const name = nameNode.text;
      if (JS_KEYWORDS.has(name)) {
        continue;
      }
      if (valueNode.type === "arrow_function") {
        const line = node.startPosition.row + 1;
        const isAsync = this.hasDirectChild(valueNode, "async");
        const sym = { name, type: "arrow", line };
        if (isAsync) {
          sym.isAsync = true;
        }
        if (!symbols.functions.some((f) => f.name === name)) {
          symbols.functions.push(sym);
        }
      }
    }
  }
  extractClass(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.classes.push({ name, type: "class", line });
    const body = node.childForFieldName("body");
    if (body) {
      this.extractMethods(body, symbols);
    }
  }
  extractMethods(classBody, symbols) {
    for (let i = 0; i < classBody.childCount; i++) {
      const member = classBody.child(i);
      if (member.type !== "method_definition") {
        continue;
      }
      const nameNode = member.childForFieldName("name");
      const name = nameNode?.text;
      if (!name || name === "constructor") {
        continue;
      }
      const isAsync = this.hasDirectChild(member, "async");
      const isStatic = this.hasDirectChild(member, "static");
      const isGetter = this.findChildByText(member, "get") !== null && member.childForFieldName("parameters")?.text === "()";
      const isSetter = this.findChildByText(member, "set") !== null && !isGetter;
      const sym = {
        name,
        type: isGetter ? "getter" : isSetter ? "setter" : "method"
      };
      if (isAsync) {
        sym.isAsync = true;
      }
      if (isStatic) {
        sym.isStatic = true;
      }
      symbols.methods.push(sym);
    }
  }
  extractExport(node, symbols) {
    const isDefault = this.hasDirectChild(node, "default");
    const isTypeExport = this.hasDirectChild(node, "type");
    const exportClause = this.findChild(node, "export_clause");
    if (exportClause) {
      if (isTypeExport) {
        return;
      }
      for (let i = 0; i < exportClause.childCount; i++) {
        const spec = exportClause.child(i);
        if (spec.type === "export_specifier") {
          const nameNode = spec.childForFieldName("name");
          if (nameNode && !JS_KEYWORDS.has(nameNode.text)) {
            symbols.exports.push({ name: nameNode.text, type: "export-named" });
          }
        }
      }
      return;
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      switch (child.type) {
        case "function_declaration":
        case "generator_function_declaration": {
          const name = child.childForFieldName("name")?.text;
          if (name) {
            symbols.exports.push({
              name,
              type: isDefault ? "export-default" : "export-function"
            });
            this.extractFunctionDecl(child, symbols);
          }
          break;
        }
        case "class_declaration": {
          const name = child.childForFieldName("name")?.text;
          if (name) {
            symbols.exports.push({
              name,
              type: isDefault ? "export-default" : "export-class"
            });
            this.extractClass(child, symbols);
          }
          break;
        }
        case "lexical_declaration":
        case "variable_declaration": {
          for (let j = 0; j < child.childCount; j++) {
            const decl = child.child(j);
            if (decl.type === "variable_declarator") {
              const name = decl.childForFieldName("name")?.text;
              if (name && !JS_KEYWORDS.has(name)) {
                symbols.exports.push({
                  name,
                  type: isDefault ? "export-default" : "export-variable"
                });
              }
            }
          }
          this.extractVariableDecl(child, symbols);
          break;
        }
      }
    }
    if (isDefault && symbols.exports.length === 0) {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child.type === "identifier" && !JS_KEYWORDS.has(child.text)) {
          symbols.exports.push({ name: child.text, type: "export-default" });
          break;
        }
      }
    }
  }
  // ── AST-based call extraction ──────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_declaration" || node.type === "generator_function_declaration") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    } else if (node.type === "variable_declarator") {
      const value = node.childForFieldName("value");
      if (value?.type === "arrow_function") {
        const name = node.childForFieldName("name")?.text;
        if (name) {
          defined.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call_expression") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!JS_BUILTINS.has(name) && !/^[A-Z_]+$/.test(name) && !definedHere.has(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── AST utilities ──────────────────────────────────────────
  stripQuotes(text) {
    if (text.startsWith("'") && text.endsWith("'") || text.startsWith('"') && text.endsWith('"')) {
      return text.slice(1, -1);
    }
    return text;
  }
  hasDirectChild(node, typeOrText) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === typeOrText || child.text === typeOrText) {
        return true;
      }
    }
    return false;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === type) {
        return child;
      }
    }
    return null;
  }
  findChildByText(node, text) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.text === text && child.type !== "statement_block" && child.type !== "formal_parameters") {
        return child;
      }
    }
    return null;
  }
  findDescendant(node, type) {
    if (node.type === type) {
      return node;
    }
    for (let i = 0; i < node.childCount; i++) {
      const result = this.findDescendant(node.child(i), type);
      if (result) {
        return result;
      }
    }
    return null;
  }
};

// src/analyzer/parsers/ts-ts-parser.ts
var TreeSitterTSParser = class extends TreeSitterJSParser {
  constructor() {
    super();
    this.language = "typescript";
  }
  // ── Override symbol extraction to add TS-specific nodes ────
  extractSymbolsAST(tree, fileInfo) {
    const symbols = super.extractSymbolsAST(tree, fileInfo);
    this.walkForTSSymbols(tree.rootNode, symbols);
    return symbols;
  }
  walkForTSSymbols(node, symbols) {
    switch (node.type) {
      case "interface_declaration":
        this.extractInterface(node, symbols);
        return;
      case "type_alias_declaration":
        this.extractTypeAlias(node, symbols);
        return;
      case "export_statement":
        this.extractTSExport(node, symbols);
        return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForTSSymbols(node.child(i), symbols);
    }
  }
  extractInterface(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.interfaces.push({ name, type: "interface", line });
  }
  extractTypeAlias(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.typeAliases.push({ name, type: "type-alias", line });
  }
  extractTSExport(node, symbols) {
    const isTypeExport = this.hasDirectChild(node, "type");
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "interface_declaration") {
        const name = child.childForFieldName("name")?.text;
        if (name) {
          symbols.exports.push({ name, type: "export-interface" });
          this.extractInterface(child, symbols);
        }
        return;
      }
      if (child.type === "type_alias_declaration") {
        const name = child.childForFieldName("name")?.text;
        if (name) {
          symbols.exports.push({ name, type: "export-type-alias" });
          this.extractTypeAlias(child, symbols);
        }
        return;
      }
    }
    if (isTypeExport) {
      const exportClause = this.findChild(node, "export_clause");
      if (exportClause) {
        for (let i = 0; i < exportClause.childCount; i++) {
          const spec = exportClause.child(i);
          if (spec.type === "export_specifier") {
            const nameNode = spec.childForFieldName("name");
            if (nameNode) {
              symbols.exports.push({ name: nameNode.text, type: "export-type" });
            }
          }
        }
      }
    }
  }
  // ── Class heritage: extends/implements ─────────────────────
  extractClass(node, symbols) {
    super.extractClass(node, symbols);
    const heritage = this.findChild(node, "class_heritage");
    if (!heritage) {
      return;
    }
    const nameNode = node.childForFieldName("name");
    const className = nameNode?.text;
    if (!className) {
      return;
    }
    const text = heritage.text;
    const extendsMatch = text.match(/extends\s+(\w+)/);
    if (extendsMatch) {
      const classSym = symbols.classes.find((c) => c.name === className);
      if (classSym) {
        classSym.extends = extendsMatch[1];
      }
    }
    const implementsMatch = text.match(/implements\s+(.+)/);
    if (implementsMatch) {
      const interfaces = implementsMatch[1].split(",").map((s) => s.trim().split(/\s/)[0]);
      const classSym = symbols.classes.find((c) => c.name === className);
      if (classSym) {
        classSym.implements = interfaces;
      }
    }
  }
  // ── Override methods to capture visibility/static/async ────
  extractMethods(classBody, symbols) {
    for (let i = 0; i < classBody.childCount; i++) {
      const member = classBody.child(i);
      if (member.type !== "method_definition") {
        continue;
      }
      const nameNode = member.childForFieldName("name");
      const name = nameNode?.text;
      if (!name || name === "constructor") {
        continue;
      }
      const isAsync = this.hasDirectChild(member, "async");
      const isStatic = this.hasDirectChild(member, "static");
      const visibility = this.getVisibility(member);
      const isOverride = this.hasDirectChild(member, "override");
      const sym = { name, type: "method" };
      if (isAsync) {
        sym.isAsync = true;
      }
      if (isStatic) {
        sym.isStatic = true;
      }
      if (visibility) {
        sym.visibility = visibility;
      }
      if (isOverride) {
        sym.isOverride = true;
      }
      symbols.methods.push(sym);
    }
  }
  /** Extract heritage relations (extends/implements) as Relation edges. */
  extractHeritageRelations(tree, fileInfo) {
    const relations = [];
    this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkForHeritage(node, sourceId, relations) {
    if (node.type === "class_declaration") {
      const nameNode = node.childForFieldName("name");
      const className = nameNode?.text;
      const heritage = this.findChild(node, "class_heritage");
      if (className && heritage) {
        const text = heritage.text;
        const extendsMatch = text.match(/extends\s+(\w+)/);
        if (extendsMatch) {
          relations.push({
            source: sourceId,
            target: extendsMatch[1],
            type: "extends",
            label: `${className} extends ${extendsMatch[1]}`
          });
        }
        const implementsMatch = text.match(/implements\s+(.+)/);
        if (implementsMatch) {
          const raw = implementsMatch[1].replace(/\{[\s\S]*$/, "");
          const interfaces = raw.split(",").map((s) => s.trim().split(/\s/)[0]).filter(Boolean);
          for (const iface of interfaces) {
            relations.push({
              source: sourceId,
              target: iface,
              type: "implements",
              label: `${className} implements ${iface}`
            });
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForHeritage(node.child(i), sourceId, relations);
    }
  }
  getVisibility(node) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "accessibility_modifier") {
        const text = child.text;
        return text;
      }
    }
    return void 0;
  }
};

// src/analyzer/parsers/ts-py-parser.ts
var PY_BUILTINS = /* @__PURE__ */ new Set([
  "print",
  "len",
  "range",
  "int",
  "str",
  "float",
  "list",
  "dict",
  "set",
  "tuple",
  "bool",
  "type",
  "isinstance",
  "issubclass",
  "hasattr",
  "getattr",
  "setattr",
  "delattr",
  "callable",
  "super",
  "property",
  "staticmethod",
  "classmethod",
  "abs",
  "all",
  "any",
  "bin",
  "chr",
  "dir",
  "divmod",
  "enumerate",
  "eval",
  "exec",
  "filter",
  "format",
  "frozenset",
  "globals",
  "hash",
  "hex",
  "id",
  "input",
  "iter",
  "locals",
  "map",
  "max",
  "min",
  "next",
  "object",
  "oct",
  "open",
  "ord",
  "pow",
  "repr",
  "reversed",
  "round",
  "slice",
  "sorted",
  "sum",
  "vars",
  "zip",
  "breakpoint",
  "compile",
  "complex",
  "memoryview",
  "bytearray",
  "bytes",
  "__import__",
  "__name__",
  "__file__",
  "__doc__"
]);
var PY_KEYWORDS = /* @__PURE__ */ new Set([
  "def",
  "class",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "return",
  "yield",
  "lambda",
  "not",
  "and",
  "or",
  "assert",
  "raise",
  "pass",
  "break",
  "continue",
  "try",
  "except",
  "finally",
  "with",
  "as",
  "import",
  "from",
  "global",
  "nonlocal",
  "del",
  "in",
  "is",
  "async",
  "await"
]);
var TreeSitterPyParser = class extends BaseParser {
  constructor() {
    super("python");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── AST-based parse: extract import relations ──────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    const root = tree.rootNode;
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type === "import_statement") {
        this.extractImport(node, fileInfo.id, relations);
      } else if (node.type === "import_from_statement") {
        this.extractFromImport(node, fileInfo.id, relations);
      }
    }
    return relations;
  }
  extractImport(node, sourceId, relations) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "dotted_name" || child.type === "aliased_import") {
        const name = child.type === "aliased_import" ? child.childForFieldName("name")?.text ?? child.text : child.text;
        if (name) {
          relations.push({
            source: sourceId,
            target: name,
            type: "import",
            label: `import ${name}`
          });
        }
      }
    }
  }
  extractFromImport(node, sourceId, relations) {
    const moduleNode = node.childForFieldName("module_name");
    let moduleName;
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "dotted_name" || child.type === "relative_import") {
        moduleName = child.text;
        break;
      }
    }
    if (!moduleName) {
      return;
    }
    relations.push({
      source: sourceId,
      target: moduleName,
      type: "from-import",
      label: `from ${moduleName} import`
    });
  }
  // ── AST-based symbol extraction ────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForSymbols(tree.rootNode, symbols, false);
    return symbols;
  }
  walkForSymbols(node, symbols, insideClass) {
    switch (node.type) {
      case "function_definition":
        this.extractFunction(node, symbols, insideClass, []);
        return;
      case "decorated_definition":
        this.extractDecorated(node, symbols, insideClass);
        return;
      case "class_definition":
        this.extractClass(node, symbols);
        return;
      case "expression_statement":
        this.extractAllExport(node, symbols);
        return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForSymbols(node.child(i), symbols, insideClass);
    }
  }
  extractFunction(node, symbols, insideClass, decorators) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isAsync = this.hasDirectChild(node, "async");
    const isDunder = name.startsWith("__") && name.endsWith("__");
    const isStaticMethod = decorators.includes("staticmethod");
    const isClassMethod = decorators.includes("classmethod");
    if (insideClass) {
      const sym = {
        name,
        type: isDunder ? "dunder" : "method",
        line
      };
      if (isAsync) {
        sym.isAsync = true;
      }
      if (isStaticMethod) {
        sym.isStatic = true;
      }
      if (isClassMethod) {
        sym.isClassMethod = true;
      }
      symbols.methods.push(sym);
    } else {
      const sym = {
        name,
        type: isDunder ? "dunder" : "function",
        line
      };
      if (isAsync) {
        sym.isAsync = true;
      }
      symbols.functions.push(sym);
    }
  }
  extractDecorated(node, symbols, insideClass) {
    const decorators = [];
    let funcDef = null;
    let classDef = null;
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "decorator") {
        const decoName = this.getDecoratorName(child);
        if (decoName) {
          decorators.push(decoName);
          if (!PY_BUILTINS.has(decoName) && !PY_KEYWORDS.has(decoName)) {
            if (!symbols.macros.some((m) => m.name === decoName)) {
              symbols.macros.push({
                name: decoName,
                type: "decorator",
                line: child.startPosition.row + 1
              });
            }
          }
        }
      } else if (child.type === "function_definition") {
        funcDef = child;
      } else if (child.type === "class_definition") {
        classDef = child;
      }
    }
    if (funcDef) {
      this.extractFunction(funcDef, symbols, insideClass, decorators);
    }
    if (classDef) {
      this.extractClass(classDef, symbols);
    }
  }
  extractClass(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const classSym = {
      name,
      type: "class",
      line
    };
    const superclasses = this.extractSuperclasses(node);
    if (superclasses.length > 0) {
      classSym.extends = superclasses[0];
      if (superclasses.length > 1) {
        classSym.implements = superclasses.slice(1);
      }
    }
    symbols.classes.push(classSym);
    const body = node.childForFieldName("body");
    if (body) {
      this.walkForSymbols(body, symbols, true);
    }
  }
  extractSuperclasses(classNode) {
    const superclasses = [];
    const argList = this.findChild(classNode, "argument_list");
    if (!argList) {
      return superclasses;
    }
    for (let i = 0; i < argList.childCount; i++) {
      const child = argList.child(i);
      if (child.type === "identifier" || child.type === "dotted_name") {
        superclasses.push(child.text);
      }
    }
    return superclasses;
  }
  extractAllExport(node, symbols) {
    const assign = this.findChild(node, "assignment");
    if (!assign) {
      return;
    }
    const left = assign.childForFieldName("left");
    if (!left || left.text !== "__all__") {
      return;
    }
    const right = assign.childForFieldName("right");
    if (!right || right.type !== "list") {
      return;
    }
    for (let i = 0; i < right.childCount; i++) {
      const child = right.child(i);
      if (child.type === "string") {
        const name = this.stripPyString(child.text);
        if (name) {
          symbols.exports.push({ name, type: "export-all" });
        }
      }
    }
  }
  // ── Heritage relations as edges ────────────────────────────
  extractHeritageRelations(tree, fileInfo) {
    const relations = [];
    this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkForHeritage(node, sourceId, relations) {
    if (node.type === "class_definition") {
      const nameNode = node.childForFieldName("name");
      const className = nameNode?.text;
      if (className) {
        const superclasses = this.extractSuperclasses(node);
        for (const base of superclasses) {
          relations.push({
            source: sourceId,
            target: base,
            type: "extends",
            label: `${className} extends ${base}`
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForHeritage(node.child(i), sourceId, relations);
    }
  }
  // ── AST-based call extraction ──────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_definition") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    } else if (node.type === "class_definition") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    } else if (node.type === "decorated_definition") {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child.type === "function_definition" || child.type === "class_definition") {
          const name = child.childForFieldName("name")?.text;
          if (name) {
            defined.add(name);
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!PY_BUILTINS.has(name) && !PY_KEYWORDS.has(name) && !definedHere.has(name) && !/^[A-Z_]+$/.test(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── Utilities ──────────────────────────────────────────────
  getDecoratorName(decorator) {
    for (let i = 0; i < decorator.childCount; i++) {
      const child = decorator.child(i);
      if (child.type === "identifier") {
        return child.text;
      }
      if (child.type === "dotted_name") {
        return child.text;
      }
      if (child.type === "call") {
        const func = child.childForFieldName("function");
        return func?.text ?? null;
      }
    }
    return null;
  }
  stripPyString(text) {
    if (text.startsWith("'") && text.endsWith("'") || text.startsWith('"') && text.endsWith('"')) {
      return text.slice(1, -1);
    }
    return text;
  }
  hasDirectChild(node, typeOrText) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === typeOrText || child.text === typeOrText) {
        return true;
      }
    }
    return false;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === type) {
        return child;
      }
    }
    return null;
  }
};

// src/analyzer/parsers/ts-java-parser.ts
var JAVA_BUILTINS = /* @__PURE__ */ new Set([
  "System",
  "String",
  "Integer",
  "Long",
  "Double",
  "Float",
  "Boolean",
  "Object",
  "Class",
  "Math",
  "Arrays",
  "Collections",
  "List",
  "Map",
  "Set",
  "HashMap",
  "ArrayList",
  "HashSet",
  "LinkedList",
  "TreeMap",
  "TreeSet",
  "Optional",
  "Stream",
  "Collectors",
  "Iterator",
  "Iterable",
  "Exception",
  "RuntimeException",
  "IOException",
  "NullPointerException",
  "Thread",
  "Runnable",
  "Comparable",
  "Serializable",
  "Cloneable",
  "StringBuilder",
  "StringBuffer",
  "Throwable",
  "Error",
  "println",
  "printf",
  "print",
  "format",
  "toString",
  "equals",
  "hashCode",
  "clone",
  "getClass",
  "notify",
  "wait",
  "valueOf",
  "parseInt",
  "parseDouble",
  "parseLong",
  "parseFloat",
  "length",
  "size",
  "get",
  "put",
  "add",
  "remove",
  "contains",
  "isEmpty",
  "toArray",
  "iterator",
  "stream",
  "forEach",
  "map",
  "filter",
  "reduce",
  "collect",
  "of",
  "asList",
  "sort",
  "reverse",
  "min",
  "max",
  "close",
  "read",
  "write",
  "flush",
  "append"
]);
var JAVA_KEYWORDS = /* @__PURE__ */ new Set([
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "return",
  "break",
  "continue",
  "throw",
  "try",
  "catch",
  "finally",
  "new",
  "instanceof",
  "this",
  "super",
  "void",
  "null",
  "true",
  "false",
  "public",
  "private",
  "protected",
  "static",
  "final",
  "abstract",
  "synchronized",
  "volatile",
  "transient",
  "native",
  "strictfp",
  "class",
  "interface",
  "enum",
  "extends",
  "implements",
  "import",
  "package",
  "default",
  "assert",
  "var"
]);
var TreeSitterJavaParser = class extends BaseParser {
  constructor() {
    super("java");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── Imports ────────────────────────────────────────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    const root = tree.rootNode;
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type !== "import_declaration") {
        continue;
      }
      const pathNode = this.findChild(node, "scoped_identifier");
      if (!pathNode) {
        continue;
      }
      const target = pathNode.text;
      const isStatic = this.hasDirectChild(node, "static");
      relations.push({
        source: fileInfo.id,
        target,
        type: isStatic ? "static-import" : "import",
        label: isStatic ? `import static ${target}` : `import ${target}`
      });
    }
    return relations;
  }
  // ── Symbols ────────────────────────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForSymbols(tree.rootNode, symbols, false);
    return symbols;
  }
  walkForSymbols(node, symbols, insideClass) {
    switch (node.type) {
      case "class_declaration":
        this.extractClass(node, symbols);
        return;
      case "interface_declaration":
        this.extractInterface(node, symbols);
        return;
      case "enum_declaration":
        this.extractEnum(node, symbols);
        return;
      case "method_declaration":
        if (insideClass) {
          this.extractMethod(node, symbols);
        }
        return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForSymbols(node.child(i), symbols, insideClass);
    }
  }
  extractClass(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const mods = this.getModifiers(node);
    const classSym = {
      name,
      type: "class",
      line
    };
    if (mods.visibility) {
      classSym.visibility = mods.visibility;
    }
    if (mods.isStatic) {
      classSym.isStatic = true;
    }
    const superclass = this.findChild(node, "superclass");
    if (superclass) {
      const superName = this.findChild(superclass, "type_identifier");
      if (superName) {
        classSym.extends = superName.text;
      }
    }
    const superInterfaces = this.findChild(node, "super_interfaces");
    if (superInterfaces) {
      classSym.implements = this.extractTypeList(superInterfaces);
    }
    symbols.classes.push(classSym);
    const body = node.childForFieldName("body");
    if (body) {
      for (let i = 0; i < body.childCount; i++) {
        this.walkForSymbols(body.child(i), symbols, true);
      }
    }
  }
  extractInterface(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.interfaces.push({ name, type: "interface", line });
    const body = this.findChild(node, "interface_body");
    if (body) {
      for (let i = 0; i < body.childCount; i++) {
        const child = body.child(i);
        if (child.type === "method_declaration") {
          this.extractMethod(child, symbols);
        }
      }
    }
  }
  extractEnum(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.enums.push({ name, type: "enum", line });
  }
  extractMethod(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const mods = this.getModifiers(node);
    const sym = { name, type: "method" };
    if (mods.visibility) {
      sym.visibility = mods.visibility;
    }
    if (mods.isStatic) {
      sym.isStatic = true;
    }
    if (mods.isAsync) {
      sym.isAsync = true;
    }
    symbols.methods.push(sym);
  }
  // ── Heritage relations ─────────────────────────────────────
  extractHeritageRelations(tree, fileInfo) {
    const relations = [];
    this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkForHeritage(node, sourceId, relations) {
    if (node.type === "class_declaration") {
      const className = node.childForFieldName("name")?.text;
      if (className) {
        const superclass = this.findChild(node, "superclass");
        if (superclass) {
          const name = this.findChild(superclass, "type_identifier")?.text;
          if (name) {
            relations.push({
              source: sourceId,
              target: name,
              type: "extends",
              label: `${className} extends ${name}`
            });
          }
        }
        const superIfaces = this.findChild(node, "super_interfaces");
        if (superIfaces) {
          for (const iface of this.extractTypeList(superIfaces)) {
            relations.push({
              source: sourceId,
              target: iface,
              type: "implements",
              label: `${className} implements ${iface}`
            });
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForHeritage(node.child(i), sourceId, relations);
    }
  }
  // ── Calls ──────────────────────────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "method_declaration") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "method_invocation") {
      const obj = node.childForFieldName("object");
      if (!obj) {
        const name = node.childForFieldName("name")?.text;
        if (name && !JAVA_BUILTINS.has(name) && !JAVA_KEYWORDS.has(name) && !definedHere.has(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── Utilities ──────────────────────────────────────────────
  getModifiers(node) {
    const mods = this.findChild(node, "modifiers");
    if (!mods) {
      return {};
    }
    const text = mods.text;
    const result = {};
    if (text.includes("public")) {
      result.visibility = "public";
    } else if (text.includes("private")) {
      result.visibility = "private";
    } else if (text.includes("protected")) {
      result.visibility = "protected";
    }
    if (text.includes("static")) {
      result.isStatic = true;
    }
    if (text.includes("synchronized")) {
      result.isAsync = false;
    }
    return result;
  }
  extractTypeList(node) {
    const types = [];
    const typeList = this.findChild(node, "type_list");
    const target = typeList || node;
    for (let i = 0; i < target.childCount; i++) {
      const child = target.child(i);
      if (child.type === "type_identifier") {
        types.push(child.text);
      }
    }
    return types;
  }
  hasDirectChild(node, typeOrText) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === typeOrText || child.text === typeOrText) {
        return true;
      }
    }
    return false;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return node.child(i);
      }
    }
    return null;
  }
};

// src/analyzer/parsers/ts-go-parser.ts
var GO_BUILTINS = /* @__PURE__ */ new Set([
  "append",
  "cap",
  "close",
  "complex",
  "copy",
  "delete",
  "imag",
  "len",
  "make",
  "new",
  "panic",
  "print",
  "println",
  "real",
  "recover",
  "error",
  "string",
  "bool",
  "byte",
  "rune",
  "int",
  "int8",
  "int16",
  "int32",
  "int64",
  "uint",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "uintptr",
  "float32",
  "float64",
  "complex64",
  "complex128",
  "nil",
  "true",
  "false",
  "iota"
]);
var GO_KEYWORDS = /* @__PURE__ */ new Set([
  "break",
  "case",
  "chan",
  "const",
  "continue",
  "default",
  "defer",
  "else",
  "fallthrough",
  "for",
  "func",
  "go",
  "goto",
  "if",
  "import",
  "interface",
  "map",
  "package",
  "range",
  "return",
  "select",
  "struct",
  "switch",
  "type",
  "var"
]);
var TreeSitterGoParser = class extends BaseParser {
  constructor() {
    super("go");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── Imports ────────────────────────────────────────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    const root = tree.rootNode;
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type !== "import_declaration") {
        continue;
      }
      const singleSpec = this.findChild(node, "import_spec");
      if (singleSpec) {
        const target = this.extractImportPath(singleSpec);
        if (target) {
          relations.push({
            source: fileInfo.id,
            target,
            type: "import",
            label: `import "${target}"`
          });
        }
      }
      const specList = this.findChild(node, "import_spec_list");
      if (specList) {
        for (let j = 0; j < specList.childCount; j++) {
          const spec = specList.child(j);
          if (spec.type === "import_spec") {
            const target = this.extractImportPath(spec);
            if (target) {
              relations.push({
                source: fileInfo.id,
                target,
                type: "import",
                label: `import "${target}"`
              });
            }
          }
        }
      }
    }
    return relations;
  }
  // ── Symbols ────────────────────────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    const root = tree.rootNode;
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      switch (node.type) {
        case "function_declaration":
          this.extractFunction(node, symbols);
          break;
        case "method_declaration":
          this.extractMethod(node, symbols);
          break;
        case "type_declaration":
          this.extractTypeDecl(node, symbols);
          break;
      }
    }
    return symbols;
  }
  extractFunction(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name || GO_KEYWORDS.has(name)) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isExported = /^[A-Z]/.test(name);
    const sym = { name, type: "function", line };
    symbols.functions.push(sym);
    if (isExported) {
      symbols.exports.push({ name, type: "export-function" });
    }
  }
  extractMethod(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const receiverList = node.child(1);
    let receiverType;
    if (receiverList?.type === "parameter_list") {
      const text = receiverList.text;
      const match = text.match(/\*?(\w+)\s*\)/);
      if (match) {
        receiverType = match[1];
      }
    }
    const isExported = /^[A-Z]/.test(name);
    const sym = { name, type: "method" };
    if (receiverType) {
      sym.receiver = receiverType;
    }
    symbols.methods.push(sym);
    if (isExported) {
      symbols.exports.push({ name, type: "export-method" });
    }
  }
  extractTypeDecl(node, symbols) {
    const typeSpec = this.findChild(node, "type_spec");
    if (!typeSpec) {
      return;
    }
    const nameNode = typeSpec.child(0);
    const defNode = typeSpec.child(1);
    if (!nameNode || !defNode) {
      return;
    }
    const name = nameNode.text;
    const line = node.startPosition.row + 1;
    const isExported = /^[A-Z]/.test(name);
    if (defNode.type === "struct_type") {
      symbols.structs.push({ name, type: "struct", line });
      if (isExported) {
        symbols.exports.push({ name, type: "export-struct" });
      }
    } else if (defNode.type === "interface_type") {
      symbols.interfaces.push({ name, type: "interface", line });
      if (isExported) {
        symbols.exports.push({ name, type: "export-interface" });
      }
    }
  }
  // ── Calls ──────────────────────────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_declaration") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call_expression") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!GO_BUILTINS.has(name) && !GO_KEYWORDS.has(name) && !definedHere.has(name)) {
          calls.add(name);
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── Utilities ──────────────────────────────────────────────
  extractImportPath(spec) {
    for (let i = 0; i < spec.childCount; i++) {
      const child = spec.child(i);
      if (child.type === "interpreted_string_literal") {
        return child.text.slice(1, -1);
      }
    }
    return null;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return node.child(i);
      }
    }
    return null;
  }
};

// src/analyzer/parsers/ts-rust-parser.ts
var RUST_BUILTINS = /* @__PURE__ */ new Set([
  "println",
  "print",
  "eprintln",
  "eprint",
  "format",
  "write",
  "writeln",
  "panic",
  "todo",
  "unimplemented",
  "unreachable",
  "assert",
  "assert_eq",
  "assert_ne",
  "debug_assert",
  "debug_assert_eq",
  "debug_assert_ne",
  "vec",
  "cfg",
  "include",
  "include_str",
  "include_bytes",
  "env",
  "option_env",
  "concat",
  "stringify",
  "line",
  "column",
  "file",
  "Box",
  "Vec",
  "String",
  "Option",
  "Result",
  "Some",
  "None",
  "Ok",
  "Err",
  "HashMap",
  "HashSet",
  "BTreeMap",
  "BTreeSet",
  "VecDeque",
  "LinkedList",
  "Rc",
  "Arc",
  "Mutex",
  "RwLock",
  "Cell",
  "RefCell",
  "Into",
  "From",
  "TryInto",
  "TryFrom",
  "AsRef",
  "AsMut",
  "Default",
  "Clone",
  "Copy",
  "Debug",
  "Display",
  "PartialEq",
  "Eq",
  "PartialOrd",
  "Ord",
  "Hash",
  "Iterator",
  "IntoIterator",
  "Send",
  "Sync",
  "Sized",
  "Unpin",
  "Drop",
  "drop",
  "swap",
  "replace",
  "take",
  "unwrap",
  "expect",
  "map",
  "and_then",
  "or_else",
  "unwrap_or",
  "is_some",
  "is_none",
  "is_ok",
  "is_err",
  "iter",
  "into_iter",
  "collect",
  "filter",
  "fold",
  "for_each",
  "push",
  "pop",
  "len",
  "is_empty",
  "contains",
  "get",
  "insert",
  "remove",
  "clone",
  "to_string",
  "to_owned",
  "as_str",
  "as_ref",
  "as_mut"
]);
var RUST_KEYWORDS = /* @__PURE__ */ new Set([
  "as",
  "async",
  "await",
  "break",
  "const",
  "continue",
  "crate",
  "dyn",
  "else",
  "enum",
  "extern",
  "fn",
  "for",
  "if",
  "impl",
  "in",
  "let",
  "loop",
  "match",
  "mod",
  "move",
  "mut",
  "pub",
  "ref",
  "return",
  "self",
  "Self",
  "static",
  "struct",
  "super",
  "trait",
  "type",
  "unsafe",
  "use",
  "where",
  "while",
  "yield",
  "true",
  "false"
]);
var TreeSitterRustParser = class extends BaseParser {
  constructor() {
    super("rust");
  }
  get usesTreeSitter() {
    return true;
  }
  // ── Imports (use/mod) ──────────────────────────────────────
  parseAST(tree, fileInfo, _options = {}) {
    const relations = [];
    const root = tree.rootNode;
    for (let i = 0; i < root.childCount; i++) {
      const node = root.child(i);
      if (node.type === "use_declaration") {
        this.extractUse(node, fileInfo.id, relations);
      } else if (node.type === "mod_item") {
        this.extractMod(node, fileInfo.id, relations);
      }
    }
    return relations;
  }
  extractUse(node, sourceId, relations) {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child.type === "scoped_identifier" || child.type === "identifier" || child.type === "scoped_use_list" || child.type === "use_wildcard") {
        const target = child.text;
        relations.push({
          source: sourceId,
          target,
          type: "use",
          label: `use ${target}`
        });
        return;
      }
    }
  }
  extractMod(node, sourceId, relations) {
    const nameNode = node.childForFieldName("name");
    if (!nameNode) {
      return;
    }
    if (this.findChild(node, "declaration_list")) {
      return;
    }
    const target = nameNode.text;
    relations.push({
      source: sourceId,
      target,
      type: "mod",
      label: `mod ${target}`
    });
  }
  // ── Symbols ────────────────────────────────────────────────
  extractSymbolsAST(tree, _fileInfo) {
    const symbols = {
      functions: [],
      externs: [],
      structs: [],
      enums: [],
      macros: [],
      classes: [],
      exports: [],
      interfaces: [],
      traits: [],
      typeAliases: [],
      methods: []
    };
    this.walkForSymbols(tree.rootNode, symbols);
    return symbols;
  }
  walkForSymbols(node, symbols) {
    switch (node.type) {
      case "function_item":
        this.extractFunction(node, symbols);
        return;
      case "struct_item":
        this.extractStruct(node, symbols);
        return;
      case "enum_item":
        this.extractEnum(node, symbols);
        return;
      case "trait_item":
        this.extractTrait(node, symbols);
        return;
      case "impl_item":
        this.extractImpl(node, symbols);
        return;
      case "type_item":
        this.extractTypeAlias(node, symbols);
        return;
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForSymbols(node.child(i), symbols);
    }
  }
  extractFunction(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name || RUST_KEYWORDS.has(name)) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isPub = this.hasDirectChild(node, "visibility_modifier");
    const isAsync = this.hasChildType(node, "function_modifiers");
    const sym = { name, type: "function", line };
    if (isAsync) {
      sym.isAsync = true;
    }
    if (isPub) {
      sym.visibility = "public";
    }
    symbols.functions.push(sym);
    if (isPub) {
      symbols.exports.push({ name, type: "export-function" });
    }
  }
  extractStruct(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isPub = this.hasDirectChild(node, "visibility_modifier");
    symbols.structs.push({ name, type: "struct", line });
    if (isPub) {
      symbols.exports.push({ name, type: "export-struct" });
    }
  }
  extractEnum(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isPub = this.hasDirectChild(node, "visibility_modifier");
    symbols.enums.push({ name, type: "enum", line });
    if (isPub) {
      symbols.exports.push({ name, type: "export-enum" });
    }
  }
  extractTrait(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    const isPub = this.hasDirectChild(node, "visibility_modifier");
    symbols.traits.push({ name, type: "trait", line });
    if (isPub) {
      symbols.exports.push({ name, type: "export-trait" });
    }
  }
  extractImpl(node, symbols) {
    const body = this.findChild(node, "declaration_list");
    if (!body) {
      return;
    }
    const typeIds = this.findAllChildren(node, "type_identifier");
    const hasTrait = this.hasDirectChild(node, "for");
    let structName;
    let traitName;
    if (hasTrait && typeIds.length >= 2) {
      traitName = typeIds[0].text;
      structName = typeIds[1].text;
    } else if (typeIds.length >= 1) {
      structName = typeIds[0].text;
    }
    for (let i = 0; i < body.childCount; i++) {
      const child = body.child(i);
      if (child.type === "function_item") {
        const nameNode = child.childForFieldName("name");
        const name = nameNode?.text;
        if (!name) {
          continue;
        }
        const isPub = this.hasDirectChild(child, "visibility_modifier");
        const isAsync = this.hasChildType(child, "function_modifiers");
        const sym = { name, type: "method" };
        if (isPub) {
          sym.visibility = "public";
        }
        if (isAsync) {
          sym.isAsync = true;
        }
        if (structName) {
          sym.receiver = structName;
        }
        symbols.methods.push(sym);
      }
    }
  }
  extractTypeAlias(node, symbols) {
    const nameNode = node.childForFieldName("name");
    const name = nameNode?.text;
    if (!name) {
      return;
    }
    const line = node.startPosition.row + 1;
    symbols.typeAliases.push({ name, type: "type-alias", line });
  }
  // ── Heritage (impl Trait for Struct) ───────────────────────
  extractHeritageRelations(tree, fileInfo) {
    const relations = [];
    this.walkForHeritage(tree.rootNode, fileInfo.id, relations);
    return relations;
  }
  walkForHeritage(node, sourceId, relations) {
    if (node.type === "impl_item") {
      const hasTrait = this.hasDirectChild(node, "for");
      if (hasTrait) {
        const typeIds = this.findAllChildren(node, "type_identifier");
        if (typeIds.length >= 2) {
          const traitName = typeIds[0].text;
          const structName = typeIds[1].text;
          relations.push({
            source: sourceId,
            target: traitName,
            type: "implements",
            label: `${structName} implements ${traitName}`
          });
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.walkForHeritage(node.child(i), sourceId, relations);
    }
  }
  // ── Calls ──────────────────────────────────────────────────
  extractCallsAST(tree, fileInfo, globalFunctions) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    const relations = [];
    for (const name of calls) {
      if (globalFunctions.has(name)) {
        relations.push({
          source: fileInfo.id,
          target: name,
          type: "function-call",
          label: `${name}()`
        });
      }
    }
    return relations;
  }
  extractCallsFromAST(tree) {
    const definedHere = /* @__PURE__ */ new Set();
    const calls = /* @__PURE__ */ new Set();
    this.collectDefinedFunctions(tree.rootNode, definedHere);
    this.collectCalls(tree.rootNode, calls, definedHere);
    return [...calls];
  }
  collectDefinedFunctions(node, defined) {
    if (node.type === "function_item") {
      const name = node.childForFieldName("name")?.text;
      if (name) {
        defined.add(name);
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectDefinedFunctions(node.child(i), defined);
    }
  }
  collectCalls(node, calls, definedHere) {
    if (node.type === "call_expression") {
      const funcNode = node.childForFieldName("function");
      if (funcNode?.type === "identifier") {
        const name = funcNode.text;
        if (!RUST_BUILTINS.has(name) && !RUST_KEYWORDS.has(name) && !definedHere.has(name) && !/^[A-Z_]+$/.test(name)) {
          calls.add(name);
        }
      }
    }
    if (node.type === "macro_invocation") {
      const macroNode = node.child(0);
      if (macroNode?.type === "identifier") {
        const name = macroNode.text;
        if (!RUST_BUILTINS.has(name) && !RUST_KEYWORDS.has(name)) {
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      this.collectCalls(node.child(i), calls, definedHere);
    }
  }
  // ── Utilities ──────────────────────────────────────────────
  hasDirectChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return true;
      }
    }
    return false;
  }
  hasChildType(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return true;
      }
    }
    return false;
  }
  findChild(node, type) {
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        return node.child(i);
      }
    }
    return null;
  }
  findAllChildren(node, type) {
    const results = [];
    for (let i = 0; i < node.childCount; i++) {
      if (node.child(i).type === type) {
        results.push(node.child(i));
      }
    }
    return results;
  }
};

// src/analyzer/parsers/html-parser.ts
var SCRIPT_SRC_RE = /<script[^>]+src\s*=\s*['"]([^'"]+)['"]/gi;
var LINK_HREF_RE = /<link[^>]+href\s*=\s*['"]([^'"]+)['"]/gi;
var IMG_SRC_RE = /<img[^>]+src\s*=\s*['"]([^'"]+)['"]/gi;
var HTMLParser = class extends BaseParser {
  constructor() {
    super("html");
  }
  parse(fileInfo, options = {}) {
    const { content, id } = fileInfo;
    const relations = [];
    relations.push(...this.extractMatches(
      content,
      new RegExp(SCRIPT_SRC_RE.source, "gi"),
      "script",
      id,
      (m) => `<script src="${m[1]}">`
    ));
    relations.push(...this.extractMatches(
      content,
      new RegExp(LINK_HREF_RE.source, "gi"),
      "stylesheet",
      id,
      (m) => `<link href="${m[1]}">`
    ));
    if (options.includeAssets) {
      relations.push(...this.extractMatches(
        content,
        new RegExp(IMG_SRC_RE.source, "gi"),
        "asset",
        id,
        (m) => `<img src="${m[1]}">`
      ));
    }
    return relations;
  }
};

// src/analyzer/parsers/css-parser.ts
var CSS_IMPORT_RE = /@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"]\s*\)?/g;
var CSS_URL_RE = /url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/g;
var CSSParser = class extends BaseParser {
  constructor() {
    super("css");
  }
  parse(fileInfo, options = {}) {
    const { content, id } = fileInfo;
    const relations = [];
    relations.push(...this.extractMatches(
      content,
      new RegExp(CSS_IMPORT_RE.source, "g"),
      "css-import",
      id,
      (m) => `@import "${m[1]}"`
    ));
    if (options.includeUrls) {
      const urlMatches = this.extractMatches(
        content,
        new RegExp(CSS_URL_RE.source, "g"),
        "css-url",
        id,
        (m) => `url("${m[1]}")`
      );
      relations.push(...urlMatches.filter(
        (r) => !r.target.startsWith("data:") && !r.target.startsWith("http:") && !r.target.startsWith("https:") && !r.target.startsWith("#")
      ));
    }
    return relations;
  }
};

// src/analyzer/complexity.ts
var C_JS_DECISION_RE = /\b(if|else\s+if|for|while|do|switch|case|catch)\b/g;
var LOGICAL_OPERATORS_RE = /(\|\||&&)/g;
var TERNARY_RE = /[^?]\?[^?:]/g;
var CSS_SELECTOR_RE = /[^{}]+(?=\s*\{)/g;
var CSS_MEDIA_RE = /@media\b/g;
function computeComplexity(fileInfo) {
  const { content, language } = fileInfo;
  switch (language) {
    case "c":
    case "javascript":
    case "typescript":
      return computeCJSComplexity(content);
    case "css":
      return computeCSSComplexity(content);
    case "html":
      return computeHTMLComplexity(content);
    default:
      return { complexity: 1, details: {} };
  }
}
function computeCJSComplexity(content) {
  const stripped = content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
  let complexity = 1;
  const details = {};
  const keywords = {};
  const decisionRe = new RegExp(C_JS_DECISION_RE.source, "g");
  let match;
  while ((match = decisionRe.exec(stripped)) !== null) {
    const kw = match[1].replace(/\s+/g, " ");
    keywords[kw] = (keywords[kw] || 0) + 1;
    complexity++;
  }
  details.keywords = keywords;
  const logicalRe = new RegExp(LOGICAL_OPERATORS_RE.source, "g");
  let logicalCount = 0;
  while ((match = logicalRe.exec(stripped)) !== null) {
    logicalCount++;
    complexity++;
  }
  details.logicalOperators = logicalCount;
  const ternaryRe = new RegExp(TERNARY_RE.source, "g");
  let ternaryCount = 0;
  while ((match = ternaryRe.exec(stripped)) !== null) {
    ternaryCount++;
    complexity++;
  }
  details.ternaryOperators = ternaryCount;
  return { complexity, details };
}
function computeCSSComplexity(content) {
  const stripped = content.replace(/\/\*[\s\S]*?\*\//g, "");
  let selectorCount = 0;
  const selectorRe = new RegExp(CSS_SELECTOR_RE.source, "g");
  let match;
  while ((match = selectorRe.exec(stripped)) !== null) {
    const selectors = match[0].split(",").filter((s) => s.trim().length > 0);
    selectorCount += selectors.length;
  }
  let mediaCount = 0;
  const mediaRe = new RegExp(CSS_MEDIA_RE.source, "g");
  while ((match = mediaRe.exec(stripped)) !== null) {
    mediaCount++;
  }
  const complexity = Math.max(1, Math.round(1 + selectorCount / 10 + mediaCount));
  return {
    complexity,
    details: { selectors: selectorCount, mediaQueries: mediaCount }
  };
}
function computeHTMLComplexity(content) {
  const eventHandlerRe = /\bon\w+\s*=/gi;
  let eventCount = 0;
  let match;
  while ((match = eventHandlerRe.exec(content)) !== null) {
    eventCount++;
  }
  const scriptRe = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
  let scriptCount = 0;
  let inlineJSComplexity = 0;
  while ((match = scriptRe.exec(content)) !== null) {
    scriptCount++;
    const jsResult = computeCJSComplexity(match[0]);
    inlineJSComplexity += jsResult.complexity - 1;
  }
  const complexity = Math.max(1, 1 + eventCount + inlineJSComplexity);
  return {
    complexity,
    details: { eventHandlers: eventCount, scriptBlocks: scriptCount, inlineJSComplexity }
  };
}

// src/analyzer/tree-sitter-loader.ts
var import_path2 = require("path");
var TSParser = require("web-tree-sitter");
var GRAMMAR_FILES = {
  "c": "tree-sitter-c.wasm",
  "cpp": "tree-sitter-cpp.wasm",
  "javascript": "tree-sitter-javascript.wasm",
  "typescript": "tree-sitter-typescript.wasm",
  "tsx": "tree-sitter-tsx.wasm",
  "python": "tree-sitter-python.wasm",
  "java": "tree-sitter-java.wasm",
  "go": "tree-sitter-go.wasm",
  "rust": "tree-sitter-rust.wasm",
  "csharp": "tree-sitter-c_sharp.wasm",
  "css": "tree-sitter-css.wasm",
  "html": "tree-sitter-html.wasm"
};
var initialized = false;
var loadedLanguages = /* @__PURE__ */ new Map();
function getWasmDir() {
  const fs2 = require("fs");
  const { resolve } = require("path");
  const candidates = [
    (0, import_path2.join)(__dirname, "tree-sitter-wasms"),
    // bundled (.vsix)
    (0, import_path2.join)(__dirname, "..", "node_modules", "tree-sitter-wasms", "out"),
    // dev from out/
    resolve("node_modules", "tree-sitter-wasms", "out")
    // dev from project root (vitest)
  ];
  return candidates.find((p) => fs2.existsSync(p)) || candidates[0];
}
async function initTreeSitter() {
  if (initialized) {
    return;
  }
  const fs2 = require("fs");
  const { resolve } = require("path");
  const candidates = [
    (0, import_path2.join)(__dirname, "tree-sitter-wasms", "tree-sitter.wasm"),
    // bundled (.vsix)
    (0, import_path2.join)(__dirname, "..", "node_modules", "web-tree-sitter", "tree-sitter.wasm"),
    // dev from out/
    resolve("node_modules", "web-tree-sitter", "tree-sitter.wasm")
    // dev from project root (vitest)
  ];
  const wasmFile = candidates.find((p) => fs2.existsSync(p));
  if (!wasmFile) {
    throw new Error("web-tree-sitter.wasm not found. Searched:\n" + candidates.join("\n"));
  }
  await TSParser.init({
    locateFile: () => wasmFile
  });
  initialized = true;
}
async function loadLanguage(languageId) {
  const cached = loadedLanguages.get(languageId);
  if (cached) {
    return cached;
  }
  const file = GRAMMAR_FILES[languageId];
  if (!file) {
    throw new Error(`No Tree-sitter grammar available for language: ${languageId}`);
  }
  const wasmDir = getWasmDir();
  const wasmPath = (0, import_path2.join)(wasmDir, file);
  const language = await TSParser.Language.load(wasmPath);
  loadedLanguages.set(languageId, language);
  return language;
}
async function createParser(languageId) {
  await initTreeSitter();
  const language = await loadLanguage(languageId);
  const parser = new TSParser();
  parser.setLanguage(language);
  return parser;
}
async function parseSource(languageId, source) {
  const parser = await createParser(languageId);
  const tree = parser.parse(source);
  if (!tree) {
    throw new Error(`Tree-sitter failed to parse source for language: ${languageId}`);
  }
  return tree;
}
function hasGrammar(languageId) {
  return languageId in GRAMMAR_FILES;
}

// src/analyzer/graph-builder.ts
var PARSERS = {
  "c": new TreeSitterCParser(),
  "javascript": new TreeSitterJSParser(),
  "typescript": new TreeSitterTSParser(),
  "python": new TreeSitterPyParser(),
  "java": new TreeSitterJavaParser(),
  "go": new TreeSitterGoParser(),
  "rust": new TreeSitterRustParser(),
  "html": new HTMLParser(),
  "css": new CSSParser()
};
function getParser(language) {
  return PARSERS[language];
}
async function preParseFiles(files) {
  const trees = /* @__PURE__ */ new Map();
  for (const file of files) {
    if (hasGrammar(file.language)) {
      try {
        const tree = await parseSource(file.language, file.content);
        trees.set(file.id, tree);
      } catch {
      }
    }
  }
  return trees;
}
function resolveTarget(target, sourceId, fileMap) {
  if (fileMap.has(target))
    return target;
  const sourceDir = (0, import_path3.dirname)(sourceId);
  const relativePath = (0, import_path3.normalize)((0, import_path3.join)(sourceDir, target));
  if (fileMap.has(relativePath))
    return relativePath;
  const extensions = [".js", ".ts", ".py", ".c", ".h", ".css", ".html"];
  for (const ext of extensions) {
    if (fileMap.has(relativePath + ext))
      return relativePath + ext;
    if (fileMap.has(target + ext))
      return target + ext;
  }
  const indexPath = (0, import_path3.join)(relativePath, "index.js");
  if (fileMap.has(indexPath))
    return indexPath;
  const targetBasename = (0, import_path3.basename)(target);
  for (const [id, file] of fileMap) {
    if (file.name === targetBasename)
      return id;
  }
  for (const ext of extensions) {
    const nameWithExt = targetBasename + ext;
    for (const [id, file] of fileMap) {
      if (file.name === nameWithExt)
        return id;
    }
  }
  return null;
}
function findCycles(links) {
  const adj = /* @__PURE__ */ new Map();
  for (const link of links) {
    if (!adj.has(link.source))
      adj.set(link.source, []);
    adj.get(link.source).push(link.target);
  }
  const cycles = [];
  const visited = /* @__PURE__ */ new Set();
  const inStack = /* @__PURE__ */ new Set();
  const stack = [];
  function dfs(node) {
    visited.add(node);
    inStack.add(node);
    stack.push(node);
    const neighbors = adj.get(node) || [];
    for (const next of neighbors) {
      if (inStack.has(next)) {
        const cycleStart = stack.indexOf(next);
        if (cycleStart >= 0) {
          const cycle = stack.slice(cycleStart);
          if (cycle.length >= 2) {
            cycles.push(cycle);
          }
        }
      } else if (!visited.has(next)) {
        dfs(next);
      }
    }
    stack.pop();
    inStack.delete(node);
  }
  for (const node of adj.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }
  const unique = [];
  const seen = /* @__PURE__ */ new Set();
  for (const cycle of cycles) {
    const sorted = [...cycle].sort();
    const key = sorted.join("|");
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(cycle);
    }
  }
  return unique;
}
function buildGraph(files, projectName = "Project", options = {}, astTrees) {
  const fileMap = /* @__PURE__ */ new Map();
  for (const file of files) {
    fileMap.set(file.id, file);
  }
  const allRelations = [];
  for (const file of files) {
    const tree = astTrees?.get(file.id);
    const parser = getParser(file.language);
    if (parser) {
      const relations = tree && parser.usesTreeSitter ? parser.parseAST(tree, file, options) : parser.parse(file, options);
      allRelations.push(...relations);
    }
  }
  const fileSymbols = /* @__PURE__ */ new Map();
  const LANG_FAMILY = {
    "c": "c",
    "javascript": "js",
    "typescript": "js",
    "python": "py",
    "java": "java",
    "go": "go",
    "rust": "rust"
  };
  const globalFunctionIndex = /* @__PURE__ */ new Map();
  const SYMBOL_LANGUAGES = /* @__PURE__ */ new Set(["c", "javascript", "typescript", "python", "java", "go", "rust"]);
  for (const file of files) {
    if (!SYMBOL_LANGUAGES.has(file.language))
      continue;
    const tree = astTrees?.get(file.id);
    const parser = getParser(file.language);
    if (!parser)
      continue;
    const symbols = tree && parser.usesTreeSitter ? parser.extractSymbolsAST(tree, file) : parser.extractSymbols?.(file);
    if (!symbols)
      continue;
    fileSymbols.set(file.id, symbols);
    const family = LANG_FAMILY[file.language] || file.language;
    for (const func of symbols.functions) {
      const key = `${family}:${func.name}`;
      if (!globalFunctionIndex.has(key)) {
        globalFunctionIndex.set(key, []);
      }
      globalFunctionIndex.get(key).push(file.id);
    }
  }
  const functionCallLinks = [];
  const HEADER_EXTS = /* @__PURE__ */ new Set([".h", ".hpp", ".d.ts"]);
  for (const file of files) {
    if (!SYMBOL_LANGUAGES.has(file.language))
      continue;
    if (HEADER_EXTS.has(file.extension))
      continue;
    const tree = astTrees?.get(file.id);
    const parser = getParser(file.language);
    if (!parser)
      continue;
    let calls;
    if (tree && parser.usesTreeSitter) {
      const tsParser = parser;
      calls = tsParser.extractCallsFromAST?.(tree) || [];
    } else {
      const regexParser = parser;
      calls = regexParser.extractCalls?.(file) || [];
    }
    const ownSymbols = fileSymbols.get(file.id);
    const ownFunctions = new Set(
      ownSymbols ? ownSymbols.functions.map((f) => f.name) : []
    );
    const family = LANG_FAMILY[file.language] || file.language;
    for (const callName of calls) {
      if (ownFunctions.has(callName))
        continue;
      const key = `${family}:${callName}`;
      const definedIn = globalFunctionIndex.get(key);
      if (definedIn) {
        for (const defFileId of definedIn) {
          if (defFileId !== file.id) {
            functionCallLinks.push({
              source: file.id,
              target: defFileId,
              type: "function-call",
              label: `${callName}()`
            });
          }
        }
      }
    }
  }
  const heritageLinks = [];
  const symbolFileIndex = /* @__PURE__ */ new Map();
  for (const [fileId, symbols] of fileSymbols) {
    for (const cls of symbols.classes) {
      symbolFileIndex.set(cls.name, fileId);
    }
    for (const iface of symbols.interfaces || []) {
      symbolFileIndex.set(iface.name, fileId);
    }
    for (const trait of symbols.traits || []) {
      symbolFileIndex.set(trait.name, fileId);
    }
    for (const struct of symbols.structs) {
      symbolFileIndex.set(struct.name, fileId);
    }
  }
  for (const file of files) {
    const tree = astTrees?.get(file.id);
    if (!tree)
      continue;
    const parser = getParser(file.language);
    if (!parser)
      continue;
    const heritageRels = parser.extractHeritageRelations(tree, file);
    for (const rel of heritageRels) {
      const targetFileId = symbolFileIndex.get(rel.target);
      if (targetFileId && targetFileId !== file.id) {
        heritageLinks.push({
          source: file.id,
          target: targetFileId,
          type: rel.type,
          label: rel.label
        });
      }
    }
  }
  const complexityMap = /* @__PURE__ */ new Map();
  for (const file of files) {
    const result = computeComplexity(file);
    complexityMap.set(file.id, result);
  }
  const links = [];
  const unresolvedCount = { count: 0, targets: [] };
  for (const relation of allRelations) {
    const resolvedTarget = resolveTarget(relation.target, relation.source, fileMap);
    if (resolvedTarget) {
      if (resolvedTarget !== relation.source) {
        links.push({
          source: relation.source,
          target: resolvedTarget,
          type: relation.type,
          label: relation.label
        });
      }
    } else {
      unresolvedCount.count++;
      if (unresolvedCount.targets.length < 20) {
        unresolvedCount.targets.push({ from: relation.source, ref: relation.target });
      }
    }
  }
  links.push(...functionCallLinks);
  links.push(...heritageLinks);
  const linkSet = /* @__PURE__ */ new Set();
  const uniqueLinks = links.filter((link) => {
    const key = `${link.source}|${link.target}|${link.type}`;
    if (linkSet.has(key))
      return false;
    linkSet.add(key);
    return true;
  });
  const fanOut = /* @__PURE__ */ new Map();
  const fanIn = /* @__PURE__ */ new Map();
  for (const link of uniqueLinks) {
    fanOut.set(link.source, (fanOut.get(link.source) || 0) + 1);
    fanIn.set(link.target, (fanIn.get(link.target) || 0) + 1);
  }
  const allCalledNames = /* @__PURE__ */ new Set();
  const CALL_SCAN_RE = /(?:^|[^.\w])(\w+)\s*\(/gm;
  for (const file of files) {
    let m;
    const re = new RegExp(CALL_SCAN_RE.source, "gm");
    while ((m = re.exec(file.content)) !== null) {
      allCalledNames.add(m[1]);
    }
  }
  const deadExportsMap = /* @__PURE__ */ new Map();
  for (const file of files) {
    const symbols = fileSymbols.get(file.id);
    if (!symbols)
      continue;
    const dead = [];
    for (const func of symbols.functions) {
      if (func.name === "main")
        continue;
      if (func.type === "dunder")
        continue;
      if (!allCalledNames.has(func.name)) {
        dead.push(func.name);
      }
    }
    for (const cls of symbols.classes) {
      if (!allCalledNames.has(cls.name)) {
        dead.push(cls.name);
      }
    }
    for (const exp of symbols.exports) {
      if (!allCalledNames.has(exp.name) && !dead.includes(exp.name)) {
        dead.push(exp.name);
      }
    }
    if (dead.length > 0) {
      deadExportsMap.set(file.id, dead);
    }
  }
  const nodes = files.map((f) => {
    const symbols = fileSymbols.get(f.id);
    const cmplx = complexityMap.get(f.id) || { complexity: 1, details: {} };
    const node = {
      id: f.id,
      name: f.name,
      path: f.path,
      language: f.language,
      extension: f.extension,
      size: f.size,
      linesOfCode: f.linesOfCode,
      lastModified: f.lastModified || 0,
      group: f.group,
      fanOut: fanOut.get(f.id) || 0,
      fanIn: fanIn.get(f.id) || 0,
      complexity: cmplx.complexity,
      complexityDetails: cmplx.details
    };
    if (symbols) {
      node.symbols = {
        functions: symbols.functions.map((fn) => ({
          name: fn.name,
          returnType: fn.returnType || "",
          params: fn.params || "",
          line: fn.line || 0,
          type: fn.type,
          visibility: fn.visibility,
          isStatic: fn.isStatic,
          isAsync: fn.isAsync
        })),
        structs: symbols.structs.map((s) => ({ name: s.name, type: s.type })),
        enums: symbols.enums.map((e) => ({ name: e.name, type: e.type })),
        macros: symbols.macros.slice(0, 30),
        classes: symbols.classes.map((c) => ({ name: c.name, type: c.type })),
        exports: symbols.exports.map((e) => ({ name: e.name, type: e.type })),
        interfaces: (symbols.interfaces || []).map((i) => ({ name: i.name, type: i.type })),
        traits: (symbols.traits || []).map((t) => ({ name: t.name, type: t.type })),
        typeAliases: (symbols.typeAliases || []).map((ta) => ({ name: ta.name, type: ta.type })),
        methods: (symbols.methods || []).map((m) => ({
          name: m.name,
          returnType: m.returnType || "",
          params: m.params || "",
          line: m.line || 0,
          type: m.type,
          visibility: m.visibility,
          isStatic: m.isStatic,
          isAsync: m.isAsync
        })),
        totalSymbols: symbols.functions.length + symbols.structs.length + symbols.enums.length + symbols.macros.length + symbols.classes.length + symbols.exports.length + (symbols.interfaces || []).length + (symbols.traits || []).length + (symbols.typeAliases || []).length + (symbols.methods || []).length
      };
    }
    const dead = deadExportsMap.get(f.id);
    if (dead && dead.length > 0) {
      node.deadExports = dead;
    }
    return node;
  });
  const langStats = {};
  for (const node of nodes) {
    if (!langStats[node.language]) {
      langStats[node.language] = { count: 0, totalLOC: 0, avgComplexity: 0 };
    }
    langStats[node.language].count++;
    langStats[node.language].totalLOC += node.linesOfCode;
    langStats[node.language].avgComplexity += node.complexity;
  }
  for (const lang in langStats) {
    langStats[lang].avgComplexity = Math.round(
      langStats[lang].avgComplexity / langStats[lang].count * 10
    ) / 10;
  }
  const groupSet = new Set(nodes.map((n) => n.group));
  const funcCallCount = uniqueLinks.filter((l) => l.type === "function-call").length;
  const heritageCount = uniqueLinks.filter((l) => l.type === "extends" || l.type === "implements").length;
  const deadCodeFiles = nodes.filter((n) => n.deadExports && n.deadExports.length > 0).length;
  const deadExportsTotal = nodes.reduce((sum, n) => sum + (n.deadExports ? n.deadExports.length : 0), 0);
  const cycles = findCycles(uniqueLinks);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  for (let i = 0; i < cycles.length; i++) {
    for (const nodeId of cycles[i]) {
      const node = nodeMap.get(nodeId);
      if (node) {
        if (!node.cycleIds)
          node.cycleIds = [];
        node.cycleIds.push(i);
      }
    }
  }
  return {
    meta: {
      projectName,
      analyzedAt: (/* @__PURE__ */ new Date()).toISOString(),
      totalFiles: nodes.length,
      totalLinks: uniqueLinks.length,
      totalRelationsFound: allRelations.length,
      functionCallLinks: funcCallCount,
      heritageLinks: heritageCount,
      unresolvedReferences: unresolvedCount.count,
      unresolvedSamples: unresolvedCount.targets,
      deadCodeFiles,
      deadExportsTotal,
      cycles,
      languageStats: langStats,
      groups: [...groupSet].sort()
    },
    nodes,
    links: uniqueLinks
  };
}

// src/analyzer/git-history.ts
var import_child_process = require("child_process");
var import_util = require("util");
var execFileAsync = (0, import_util.promisify)(import_child_process.execFile);
var MAX_BUFFER = 50 * 1024 * 1024;
async function isGitRepo(cwd) {
  try {
    await execFileAsync("git", ["rev-parse", "--is-inside-work-tree"], { cwd });
    return true;
  } catch {
    return false;
  }
}

// src/graph-db.ts
var import_sql = __toESM(require("sql.js"));
var import_fs = require("fs");
var import_path4 = require("path");
var SCHEMA = `
CREATE TABLE IF NOT EXISTS nodes (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    language      TEXT NOT NULL,
    extension     TEXT NOT NULL,
    group_name    TEXT NOT NULL,
    size          INTEGER NOT NULL,
    lines         INTEGER NOT NULL,
    complexity    INTEGER NOT NULL,
    fan_in        INTEGER NOT NULL DEFAULT 0,
    fan_out       INTEGER NOT NULL DEFAULT 0,
    last_modified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS edges (
    source  TEXT NOT NULL,
    target  TEXT NOT NULL,
    type    TEXT NOT NULL,
    label   TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (source, target, type)
);

CREATE TABLE IF NOT EXISTS symbols (
    node_id     TEXT NOT NULL,
    name        TEXT NOT NULL,
    kind        TEXT NOT NULL,
    return_type TEXT DEFAULT '',
    params      TEXT DEFAULT '',
    line        INTEGER DEFAULT 0,
    is_dead     INTEGER DEFAULT 0,
    visibility  TEXT DEFAULT 'public',
    is_static   INTEGER DEFAULT 0,
    is_async    INTEGER DEFAULT 0,
    PRIMARY KEY (node_id, name, kind)
);

CREATE TABLE IF NOT EXISTS cycles (
    cycle_id  INTEGER NOT NULL,
    node_id   TEXT NOT NULL,
    position  INTEGER NOT NULL,
    PRIMARY KEY (cycle_id, position)
);

CREATE TABLE IF NOT EXISTS meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target);
CREATE INDEX IF NOT EXISTS idx_symbols_node ON symbols(node_id);
CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name);
CREATE INDEX IF NOT EXISTS idx_nodes_language ON nodes(language);
CREATE INDEX IF NOT EXISTS idx_nodes_group ON nodes(group_name);
`;
function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}
function queryOne(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let result;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}
var GraphDB = class {
  db = null;
  dbPath = "";
  // ── Lifecycle ──────────────────────────────────────────────
  async open(dbPath) {
    const wasmPath = (0, import_path4.join)((0, import_path4.dirname)(require.resolve("sql.js")), "sql-wasm.wasm");
    const SQL = await (0, import_sql.default)({
      locateFile: () => wasmPath
    });
    this.dbPath = dbPath;
    if ((0, import_fs.existsSync)(dbPath)) {
      const fileBuffer = (0, import_fs.readFileSync)(dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }
    this.db.run(SCHEMA);
    this.migrateSchema();
  }
  /** Open synchronously from an already-initialized SQL module. For MCP server use. */
  openSync(SQL, dbPath) {
    this.dbPath = dbPath;
    if ((0, import_fs.existsSync)(dbPath)) {
      const fileBuffer = (0, import_fs.readFileSync)(dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }
    this.db.run(SCHEMA);
    this.migrateSchema();
  }
  close() {
    this.db?.close();
    this.db = null;
  }
  get isOpen() {
    return this.db !== null;
  }
  /** Write current DB state to disk. */
  save() {
    if (!this.db || !this.dbPath)
      return;
    const data = this.db.export();
    (0, import_fs.writeFileSync)(this.dbPath, Buffer.from(data));
  }
  // ── Import (full replace after each analysis) ──────────────
  importGraphData(data) {
    const db = this.ensureDb();
    db.run("BEGIN TRANSACTION");
    try {
      db.run("DELETE FROM symbols");
      db.run("DELETE FROM edges");
      db.run("DELETE FROM cycles");
      db.run("DELETE FROM nodes");
      db.run("DELETE FROM meta");
      for (const n of data.nodes) {
        db.run(
          "INSERT INTO nodes (id, name, language, extension, group_name, size, lines, complexity, fan_in, fan_out, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [n.id, n.name, n.language, n.extension, n.group, n.size, n.linesOfCode, n.complexity, n.fanIn, n.fanOut, n.lastModified]
        );
      }
      for (const e of data.links) {
        const src = typeof e.source === "object" ? e.source.id : e.source;
        const tgt = typeof e.target === "object" ? e.target.id : e.target;
        db.run(
          "INSERT OR IGNORE INTO edges (source, target, type, label) VALUES (?, ?, ?, ?)",
          [src, tgt, e.type, e.label || ""]
        );
      }
      const insertSymbol = "INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead, visibility, is_static, is_async) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
      for (const n of data.nodes) {
        if (!n.symbols)
          continue;
        const deadSet = new Set(n.deadExports || []);
        for (const fn of n.symbols.functions) {
          db.run(
            insertSymbol,
            [n.id, fn.name, fn.type || "function", fn.returnType || "", fn.params || "", fn.line || 0, deadSet.has(fn.name) ? 1 : 0, fn.visibility || "public", fn.isStatic ? 1 : 0, fn.isAsync ? 1 : 0]
          );
        }
        for (const m of n.symbols.methods || []) {
          db.run(
            insertSymbol,
            [n.id, m.name, m.type || "method", m.returnType || "", m.params || "", m.line || 0, deadSet.has(m.name) ? 1 : 0, m.visibility || "public", m.isStatic ? 1 : 0, m.isAsync ? 1 : 0]
          );
        }
        for (const s of n.symbols.structs)
          db.run(insertSymbol, [n.id, s.name, s.type || "struct", "", "", 0, 0, "public", 0, 0]);
        for (const e of n.symbols.enums)
          db.run(insertSymbol, [n.id, e.name, e.type || "enum", "", "", 0, 0, "public", 0, 0]);
        for (const m of n.symbols.macros)
          db.run(insertSymbol, [n.id, m.name, m.type || "macro", "", "", 0, 0, "public", 0, 0]);
        for (const c of n.symbols.classes)
          db.run(insertSymbol, [n.id, c.name, c.type || "class", "", "", 0, deadSet.has(c.name) ? 1 : 0, "public", 0, 0]);
        for (const ex of n.symbols.exports)
          db.run(insertSymbol, [n.id, ex.name, ex.type || "export", "", "", 0, deadSet.has(ex.name) ? 1 : 0, "public", 0, 0]);
        for (const i of n.symbols.interfaces || [])
          db.run(insertSymbol, [n.id, i.name, i.type || "interface", "", "", i.line || 0, 0, i.visibility || "public", 0, 0]);
        for (const t of n.symbols.traits || [])
          db.run(insertSymbol, [n.id, t.name, t.type || "trait", "", "", t.line || 0, 0, t.visibility || "public", 0, 0]);
        for (const ta of n.symbols.typeAliases || [])
          db.run(insertSymbol, [n.id, ta.name, ta.type || "type_alias", "", "", ta.line || 0, 0, ta.visibility || "public", 0, 0]);
      }
      if (data.meta.cycles) {
        for (let ci = 0; ci < data.meta.cycles.length; ci++) {
          const cycle = data.meta.cycles[ci];
          for (let pos = 0; pos < cycle.length; pos++) {
            db.run("INSERT INTO cycles (cycle_id, node_id, position) VALUES (?, ?, ?)", [ci, cycle[pos], pos]);
          }
        }
      }
      const metaEntries = [
        ["projectName", data.meta.projectName],
        ["analyzedAt", data.meta.analyzedAt],
        ["totalFiles", String(data.meta.totalFiles)],
        ["totalLinks", String(data.meta.totalLinks)],
        ["totalRelationsFound", String(data.meta.totalRelationsFound)],
        ["functionCallLinks", String(data.meta.functionCallLinks)],
        ["unresolvedReferences", String(data.meta.unresolvedReferences)],
        ["deadCodeFiles", String(data.meta.deadCodeFiles)],
        ["deadExportsTotal", String(data.meta.deadExportsTotal)],
        ["languageStats", JSON.stringify(data.meta.languageStats)],
        ["groups", JSON.stringify(data.meta.groups)]
      ];
      for (const [key, value] of metaEntries) {
        db.run("INSERT INTO meta (key, value) VALUES (?, ?)", [key, value]);
      }
      db.run("COMMIT");
    } catch (err) {
      db.run("ROLLBACK");
      throw err;
    }
    this.save();
  }
  // ── Queries ────────────────────────────────────────────────
  /** Transitive dependencies of a file (what it depends on). */
  getDependencies(fileId, maxDepth = 5) {
    return queryAll(this.ensureDb(), `
            WITH RECURSIVE deps(id, depth) AS (
                SELECT target, 1 FROM edges WHERE source = ?
                UNION
                SELECT e.target, d.depth + 1
                FROM edges e JOIN deps d ON e.source = d.id
                WHERE d.depth < ?
            )
            SELECT id, MIN(depth) AS depth FROM deps GROUP BY id ORDER BY depth
        `, [fileId, maxDepth]);
  }
  /** Transitive dependents of a file (what depends on it — impact analysis). */
  getDependents(fileId, maxDepth = 5) {
    return queryAll(this.ensureDb(), `
            WITH RECURSIVE deps(id, depth) AS (
                SELECT source, 1 FROM edges WHERE target = ?
                UNION
                SELECT e.source, d.depth + 1
                FROM edges e JOIN deps d ON e.target = d.id
                WHERE d.depth < ?
            )
            SELECT id, MIN(depth) AS depth FROM deps GROUP BY id ORDER BY depth
        `, [fileId, maxDepth]);
  }
  /** Blast radius — directional dependents with risk level. */
  getBlastRadius(fileId, maxDepth = 5) {
    const deps = this.getDependents(fileId, maxDepth);
    return deps.map((d) => ({
      ...d,
      risk: d.depth === 1 ? "high" : d.depth === 2 ? "medium" : "low"
    }));
  }
  /** Shortest path between two files. Returns null if no path exists. */
  findPath(from, to, maxDepth = 20) {
    const rows = queryAll(this.ensureDb(), `
            WITH RECURSIVE path(id, route, depth) AS (
                SELECT ?, ?, 0
                UNION
                SELECT e.target, p.route || '|' || e.target, p.depth + 1
                FROM edges e JOIN path p ON e.source = p.id
                WHERE p.depth < ? AND INSTR(p.route, e.target) = 0
            )
            SELECT route FROM path WHERE id = ? ORDER BY depth LIMIT 1
        `, [from, from, maxDepth, to]);
    if (rows.length === 0)
      return null;
    return rows[0].route.split("|");
  }
  /** Top N hotspots sorted by impact score (complexity × fan_in). */
  getHotspots(limit = 20, sortBy = "impact") {
    const orderClause = sortBy === "complexity" ? "complexity DESC" : sortBy === "fan_in" ? "fan_in DESC" : sortBy === "lines" ? "lines DESC" : "(complexity * (fan_in + 1)) DESC";
    return queryAll(
      this.ensureDb(),
      `SELECT *, (complexity * (fan_in + 1)) AS impact_score FROM nodes ORDER BY ${orderClause} LIMIT ?`,
      [limit]
    );
  }
  /** All dead code (uncalled exports). */
  getDeadCode() {
    return queryAll(
      this.ensureDb(),
      "SELECT node_id AS nodeId, name AS symbol, kind FROM symbols WHERE is_dead = 1 ORDER BY node_id"
    );
  }
  /** All cycles. */
  getCycles() {
    const rows = queryAll(
      this.ensureDb(),
      "SELECT cycle_id, node_id FROM cycles ORDER BY cycle_id, position"
    );
    const cycles = [];
    let current = [];
    let currentId = -1;
    for (const row of rows) {
      if (row.cycle_id !== currentId) {
        if (current.length > 0)
          cycles.push(current);
        current = [];
        currentId = row.cycle_id;
      }
      current.push(row.node_id);
    }
    if (current.length > 0)
      cycles.push(current);
    return cycles;
  }
  /** Full detail for a single node. */
  getNodeDetail(fileId) {
    const db = this.ensureDb();
    const node = queryOne(db, "SELECT * FROM nodes WHERE id = ?", [fileId]);
    if (!node)
      return null;
    const symbols = queryAll(db, "SELECT * FROM symbols WHERE node_id = ?", [fileId]);
    const deps = queryAll(db, "SELECT target FROM edges WHERE source = ?", [fileId]);
    const revDeps = queryAll(db, "SELECT source FROM edges WHERE target = ?", [fileId]);
    return {
      ...node,
      symbols,
      dependencies: deps.map((d) => d.target),
      dependents: revDeps.map((d) => d.source)
    };
  }
  /** Architecture overview by language. */
  getArchitectureOverview() {
    return queryAll(this.ensureDb(), `
            SELECT language,
                   COUNT(*) AS count,
                   SUM(lines) AS total_loc,
                   ROUND(AVG(complexity), 1) AS avg_complexity
            FROM nodes GROUP BY language ORDER BY count DESC
        `);
  }
  /** Search symbols by name (LIKE match). */
  searchSymbols(query, kind) {
    const db = this.ensureDb();
    const sql = "SELECT node_id AS nodeId, name, kind, line, visibility, is_static AS isStatic, is_async AS isAsync FROM symbols WHERE name LIKE ?" + (kind ? " AND kind = ?" : "") + " ORDER BY name LIMIT 100";
    const params = kind ? [`%${query}%`, kind] : [`%${query}%`];
    const rows = queryAll(db, sql, params);
    return rows.map((r) => ({ ...r, isStatic: !!r.isStatic, isAsync: !!r.isAsync, visibility: r.visibility || "public" }));
  }
  /** Get heritage edges (extends, implements). */
  getHeritage(fileId) {
    const db = this.ensureDb();
    if (fileId) {
      return queryAll(
        db,
        "SELECT * FROM edges WHERE type IN ('extends', 'implements') AND (source = ? OR target = ?) ORDER BY source, type",
        [fileId, fileId]
      );
    }
    return queryAll(
      db,
      "SELECT * FROM edges WHERE type IN ('extends', 'implements') ORDER BY source, type"
    );
  }
  /** Get all nodes. */
  getAllNodes() {
    return queryAll(this.ensureDb(), "SELECT * FROM nodes ORDER BY id");
  }
  /** Get all edges. */
  getAllEdges() {
    return queryAll(this.ensureDb(), "SELECT * FROM edges ORDER BY source, target");
  }
  /**
   * Community detection using Louvain algorithm.
   * Returns nodeId → communityId mapping.
   */
  getCommunities() {
    const db = this.ensureDb();
    const nodes = queryAll(db, "SELECT id FROM nodes");
    const edges = queryAll(db, "SELECT source, target FROM edges");
    if (nodes.length === 0)
      return [];
    const nodeIndex = /* @__PURE__ */ new Map();
    nodes.forEach((n2, i) => nodeIndex.set(n2.id, i));
    const n = nodes.length;
    const adj = Array.from({ length: n }, () => /* @__PURE__ */ new Map());
    let totalWeight = 0;
    for (const e of edges) {
      const si = nodeIndex.get(e.source);
      const ti = nodeIndex.get(e.target);
      if (si === void 0 || ti === void 0 || si === ti)
        continue;
      adj[si].set(ti, (adj[si].get(ti) || 0) + 1);
      adj[ti].set(si, (adj[ti].get(si) || 0) + 1);
      totalWeight += 1;
    }
    if (totalWeight === 0) {
      return nodes.map((nd, i) => ({ nodeId: nd.id, community: i }));
    }
    const m2 = totalWeight * 2;
    const deg = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let d = 0;
      for (const w of adj[i].values())
        d += w;
      deg[i] = d;
    }
    const community = new Int32Array(n);
    for (let i = 0; i < n; i++)
      community[i] = i;
    let improved = true;
    let iterations = 0;
    while (improved && iterations < 20) {
      improved = false;
      iterations++;
      for (let i = 0; i < n; i++) {
        const ci = community[i];
        const commWeights = /* @__PURE__ */ new Map();
        for (const [j, w] of adj[i]) {
          const cj = community[j];
          commWeights.set(cj, (commWeights.get(cj) || 0) + w);
        }
        const commDeg = /* @__PURE__ */ new Map();
        for (let j = 0; j < n; j++) {
          if (j === i)
            continue;
          const cj = community[j];
          if (commWeights.has(cj) || cj === ci) {
            commDeg.set(cj, (commDeg.get(cj) || 0) + deg[j]);
          }
        }
        const ki = deg[i];
        const wIn = commWeights.get(ci) || 0;
        const sumCi = commDeg.get(ci) || 0;
        const removeCost = wIn / totalWeight - ki * sumCi / (m2 * m2) * 2;
        let bestGain = 0;
        let bestComm = ci;
        for (const [cj, wj] of commWeights) {
          if (cj === ci)
            continue;
          const sumCj = commDeg.get(cj) || 0;
          const gain = wj / totalWeight - ki * sumCj / (m2 * m2) * 2 - removeCost;
          if (gain > bestGain) {
            bestGain = gain;
            bestComm = cj;
          }
        }
        if (bestComm !== ci) {
          community[i] = bestComm;
          improved = true;
        }
      }
    }
    const idMap = /* @__PURE__ */ new Map();
    let nextId = 0;
    const result = [];
    for (let i = 0; i < n; i++) {
      let cid = community[i];
      if (!idMap.has(cid))
        idMap.set(cid, nextId++);
      result.push({ nodeId: nodes[i].id, community: idMap.get(cid) });
    }
    return result;
  }
  /** Get meta value by key. */
  getMeta(key) {
    const row = queryOne(this.ensureDb(), "SELECT value FROM meta WHERE key = ?", [key]);
    return row?.value ?? null;
  }
  /** Get all meta as a map. */
  getAllMeta() {
    const rows = queryAll(this.ensureDb(), "SELECT key, value FROM meta");
    const map = {};
    for (const r of rows)
      map[r.key] = r.value;
    return map;
  }
  // ── Private ────────────────────────────────────────────────
  /** Add columns that may be missing in older databases. */
  migrateSchema() {
    const db = this.ensureDb();
    const cols = queryAll(db, "PRAGMA table_info('symbols')").map((c) => c.name);
    const migrations = [
      ["visibility", "ALTER TABLE symbols ADD COLUMN visibility TEXT DEFAULT 'public'"],
      ["is_static", "ALTER TABLE symbols ADD COLUMN is_static INTEGER DEFAULT 0"],
      ["is_async", "ALTER TABLE symbols ADD COLUMN is_async INTEGER DEFAULT 0"]
    ];
    for (const [col, sql] of migrations) {
      if (!cols.includes(col)) {
        db.run(sql);
      }
    }
  }
  ensureDb() {
    if (!this.db)
      throw new Error("GraphDB is not open");
    return this.db;
  }
};

// src/extension.ts
var webviewProvider;
var cachedGraphData;
var cachedFiles = [];
var historyWorker;
var commitIndex;
var cachedDeltas = [];
var fileWatcher;
var statusBarItem;
var refreshTimeout;
var treeProvider;
var isAnalyzing = false;
var graphDb;
function activate(context) {
  treeProvider = new AuraTreeProvider();
  const treeView = vscode3.window.createTreeView("auraVisualizer.statsView", {
    treeDataProvider: treeProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(treeView);
  statusBarItem = vscode3.window.createStatusBarItem(vscode3.StatusBarAlignment.Left, 50);
  statusBarItem.command = "auraVisualizer.open";
  statusBarItem.text = "$(eye) Aura";
  statusBarItem.tooltip = "Open Aura 3D Visualizer";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
  context.subscriptions.push(
    vscode3.commands.registerCommand("auraVisualizer.open", () => openVisualizer(context)),
    vscode3.commands.registerCommand("auraVisualizer.refresh", () => refreshAnalysis(context)),
    vscode3.commands.registerCommand("auraVisualizer.focusFile", () => focusCurrentFile()),
    vscode3.commands.registerCommand("auraVisualizer.openFileFromTree", (relativePath) => {
      const workspaceFolder = vscode3.workspace.workspaceFolders?.[0];
      if (!workspaceFolder)
        return;
      const fullPath = path2.join(workspaceFolder.uri.fsPath, relativePath);
      vscode3.window.showTextDocument(vscode3.Uri.file(fullPath), { preview: true });
    }),
    vscode3.commands.registerCommand("auraVisualizer.exportGraph", () => exportGraph()),
    vscode3.commands.registerCommand("auraVisualizer.blastRadius", () => blastRadiusCurrentFile(context))
  );
  setupFileWatcher(context);
  context.subscriptions.push(
    vscode3.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && webviewProvider?.isVisible) {
        const workspaceFolder = vscode3.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
          const relativePath = path2.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);
          if (!relativePath.startsWith("..")) {
            webviewProvider.focusNode(relativePath);
          }
        }
      }
    })
  );
  context.subscriptions.push(
    vscode3.window.onDidChangeActiveColorTheme((theme) => {
      webviewProvider?.sendTheme(theme.kind);
    })
  );
  vscode3.window.registerWebviewPanelSerializer(WebviewProvider.viewType, {
    async deserializeWebviewPanel(panel) {
      if (!webviewProvider) {
        webviewProvider = new WebviewProvider(context.extensionUri, context.workspaceState);
        registerOpenFileHandler();
      }
      webviewProvider.restore(panel);
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
  if (vscode3.workspace.workspaceFolders?.length) {
    refreshAnalysis(context);
  }
}
function registerOpenFileHandler() {
  if (!webviewProvider)
    return;
  webviewProvider.onOpenFile(async ({ path: filePath, line }) => {
    const workspaceFolder = vscode3.workspace.workspaceFolders?.[0];
    if (!workspaceFolder)
      return;
    const fullPath = path2.join(workspaceFolder.uri.fsPath, filePath);
    const uri = vscode3.Uri.file(fullPath);
    try {
      const doc = await vscode3.workspace.openTextDocument(uri);
      const editor = await vscode3.window.showTextDocument(doc, {
        viewColumn: vscode3.ViewColumn.Beside,
        preserveFocus: false
      });
      if (line && line > 0) {
        const position = new vscode3.Position(line - 1, 0);
        editor.selection = new vscode3.Selection(position, position);
        editor.revealRange(
          new vscode3.Range(position, position),
          vscode3.TextEditorRevealType.InCenter
        );
      }
    } catch {
    }
  });
}
async function openVisualizer(context) {
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
  } else {
    await refreshAnalysis(context);
  }
}
async function refreshAnalysis(context) {
  if (isAnalyzing)
    return;
  isAnalyzing = true;
  const workspaceFolder = vscode3.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    isAnalyzing = false;
    vscode3.window.showWarningMessage("Aura: No workspace folder open.");
    return;
  }
  const rootPath = workspaceFolder.uri.fsPath;
  const config = vscode3.workspace.getConfiguration("auraVisualizer");
  const excludePaths = config.get("excludePaths", [
    "node_modules",
    ".git",
    "dist",
    "build",
    "out",
    "__pycache__"
  ]);
  if (statusBarItem) {
    statusBarItem.text = "$(loading~spin) Aura: Analyzing...";
  }
  try {
    const result = await vscode3.window.withProgress(
      {
        location: vscode3.ProgressLocation.Window,
        title: "Aura: Analyzing codebase..."
      },
      () => runAnalysisInWorker(context.extensionUri, rootPath, excludePaths, workspaceFolder.name)
    );
    cachedGraphData = result.graphData;
    cachedFiles = result.files;
    if (webviewProvider) {
      webviewProvider.sendGraphData(cachedGraphData);
    }
    treeProvider?.update(cachedGraphData);
    updateStatusBar();
    try {
      if (!graphDb) {
        graphDb = new GraphDB();
        const dbDir = path2.join(rootPath, ".aura");
        await fs.mkdir(dbDir, { recursive: true });
        await graphDb.open(path2.join(dbDir, "graph.db"));
      }
      graphDb.importGraphData(cachedGraphData);
      await registerMcpServer(context, rootPath);
    } catch (dbErr) {
      console.error("[aura] GraphDB import error:", dbErr);
    }
    startHistoryScan(context, rootPath, excludePaths);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    vscode3.window.showErrorMessage(`Aura: Analysis failed \u2014 ${message}`);
    if (statusBarItem) {
      statusBarItem.text = "$(eye) Aura";
    }
  } finally {
    isAnalyzing = false;
  }
}
async function registerMcpServer(context, rootPath) {
  const vscodeDir = path2.join(rootPath, ".vscode");
  const mcpPath = path2.join(vscodeDir, "mcp.json");
  const mcpServerPath = path2.join(context.extensionUri.fsPath, "out", "mcp-server.js");
  const dbPath = path2.join(rootPath, ".aura", "graph.db");
  let config = {};
  try {
    const existing = await fs.readFile(mcpPath, "utf-8");
    config = JSON.parse(existing);
  } catch {
  }
  if (config.servers && config.servers["aura"]) {
    return;
  }
  config.servers = config.servers || {};
  config.servers["aura"] = {
    command: "node",
    args: [mcpServerPath],
    env: {
      AURA_DB_PATH: dbPath
    }
  };
  await fs.mkdir(vscodeDir, { recursive: true });
  await fs.writeFile(mcpPath, JSON.stringify(config, null, 4) + "\n", "utf-8");
  console.log("[aura] MCP server registered in .vscode/mcp.json");
}
function runAnalysisInWorker(extensionUri, rootPath, excludePaths, projectName) {
  return new Promise((resolve, reject) => {
    const workerPath = path2.join(extensionUri.fsPath, "out", "analyzer-worker.js");
    const worker = new import_worker_threads.Worker(workerPath, {
      workerData: {
        rootPath,
        skipDirs: excludePaths,
        projectName
      }
    });
    worker.on("message", (msg) => {
      if (msg.progress) {
        webviewProvider?.sendProgress(msg.progress.phase, msg.progress.message);
        return;
      }
      if (msg.error) {
        reject(new Error(msg.error));
      } else {
        resolve({ graphData: msg.graphData, files: msg.files });
      }
      worker.terminate();
    });
    worker.on("error", (err) => {
      reject(err);
      worker.terminate();
    });
    worker.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}
async function incrementalUpdate(fileUri, deleted) {
  const workspaceFolder = vscode3.workspace.workspaceFolders?.[0];
  if (!workspaceFolder || cachedFiles.length === 0)
    return;
  const rootPath = workspaceFolder.uri.fsPath;
  const relativePath = path2.relative(rootPath, fileUri.fsPath);
  if (relativePath.startsWith(".."))
    return;
  if (deleted) {
    cachedFiles = cachedFiles.filter((f) => f.id !== relativePath);
  } else {
    const newInfo = await scanSingleFile(fileUri.fsPath, rootPath);
    if (!newInfo)
      return;
    const idx = cachedFiles.findIndex((f) => f.id === relativePath);
    if (idx >= 0) {
      cachedFiles[idx] = newInfo;
    } else {
      cachedFiles.push(newInfo);
    }
  }
  const oldGraphData = cachedGraphData;
  const projectName = workspaceFolder.name;
  const astTrees = await preParseFiles(cachedFiles);
  cachedGraphData = buildGraph(cachedFiles, projectName, {}, astTrees);
  if (webviewProvider?.isVisible && cachedGraphData) {
    if (oldGraphData) {
      const delta = computeGraphDelta(oldGraphData, cachedGraphData, relativePath, deleted);
      webviewProvider.sendGraphDelta(delta);
    } else {
      webviewProvider.sendGraphData(cachedGraphData);
    }
  }
  treeProvider?.update(cachedGraphData);
  updateStatusBar();
}
function computeGraphDelta(oldGraph, newGraph, changedFileId, deleted) {
  const delta = {
    changedNodes: [],
    removedNodeIds: [],
    addedLinks: [],
    removedLinks: [],
    meta: newGraph.meta
  };
  if (deleted) {
    delta.removedNodeIds.push(changedFileId);
  }
  const oldNodeMap = new Map(oldGraph.nodes.map((n) => [n.id, n]));
  const newNodeMap = new Map(newGraph.nodes.map((n) => [n.id, n]));
  for (const node of newGraph.nodes) {
    const oldNode = oldNodeMap.get(node.id);
    if (!oldNode || node.fanIn !== oldNode.fanIn || node.fanOut !== oldNode.fanOut || node.complexity !== oldNode.complexity || node.linesOfCode !== oldNode.linesOfCode || node.size !== oldNode.size) {
      delta.changedNodes.push(node);
    }
  }
  for (const node of oldGraph.nodes) {
    if (!newNodeMap.has(node.id)) {
      if (!delta.removedNodeIds.includes(node.id)) {
        delta.removedNodeIds.push(node.id);
      }
    }
  }
  const linkKey = (l) => `${typeof l.source === "object" ? l.source.id : l.source}|${typeof l.target === "object" ? l.target.id : l.target}|${l.type}`;
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
        source: typeof link.source === "object" ? link.source.id : link.source,
        target: typeof link.target === "object" ? link.target.id : link.target,
        type: link.type
      });
    }
  }
  return delta;
}
function updateStatusBar() {
  if (!statusBarItem || !cachedGraphData)
    return;
  const { totalFiles, totalLinks } = cachedGraphData.meta;
  statusBarItem.text = `$(eye) Aura: ${totalFiles} files, ${totalLinks} links`;
  statusBarItem.tooltip = `Aura \u2014 ${totalFiles} files, ${totalLinks} dependencies
Click to open 3D visualizer`;
}
async function startHistoryScan(context, rootPath, excludePaths) {
  const isGit = await isGitRepo(rootPath);
  if (!isGit)
    return;
  if (historyWorker) {
    historyWorker.terminate();
    historyWorker = void 0;
  }
  cachedDeltas = [];
  const historyDir = path2.join(rootPath, ".aura", "history");
  const workerPath = path2.join(context.extensionUri.fsPath, "out", "history-worker.js");
  historyWorker = new import_worker_threads.Worker(workerPath, {
    workerData: {
      rootPath,
      skipDirs: excludePaths,
      historyDir
    }
  });
  historyWorker.on("message", (msg) => {
    switch (msg.type) {
      case "index":
        commitIndex = msg.payload;
        if (webviewProvider) {
          webviewProvider.sendHistoryIndex(commitIndex);
        }
        break;
      case "progress": {
        const progress = msg.payload;
        if (webviewProvider) {
          webviewProvider.sendHistoryProgress(progress.scanned, progress.total);
        }
        break;
      }
      case "delta": {
        const delta = msg.payload;
        cachedDeltas.push(delta);
        if (webviewProvider) {
          webviewProvider.sendHistoryDelta(delta);
        }
        break;
      }
      case "done":
        break;
      case "error":
        break;
    }
  });
  historyWorker.on("error", () => {
  });
  historyWorker.on("exit", () => {
    historyWorker = void 0;
  });
}
function focusCurrentFile() {
  const editor = vscode3.window.activeTextEditor;
  if (!editor || !webviewProvider?.isVisible)
    return;
  const workspaceFolder = vscode3.workspace.workspaceFolders?.[0];
  if (!workspaceFolder)
    return;
  const relativePath = path2.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);
  if (!relativePath.startsWith("..")) {
    webviewProvider.focusNode(relativePath);
  }
}
async function blastRadiusCurrentFile(context) {
  const editor = vscode3.window.activeTextEditor;
  const workspaceFolder = vscode3.workspace.workspaceFolders?.[0];
  if (!editor || !workspaceFolder)
    return;
  const relativePath = path2.relative(workspaceFolder.uri.fsPath, editor.document.uri.fsPath);
  if (relativePath.startsWith(".."))
    return;
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
  setTimeout(() => webviewProvider?.sendBlastRadius(relativePath), 300);
}
async function exportGraph() {
  const workspaceFolder = vscode3.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode3.window.showWarningMessage("Aura: No workspace folder open.");
    return;
  }
  if (!cachedGraphData) {
    vscode3.window.showWarningMessage("Aura: No graph data. Run analysis first (Ctrl+Shift+A).");
    return;
  }
  const auraDir = path2.join(workspaceFolder.uri.fsPath, ".aura");
  await fs.mkdir(auraDir, { recursive: true });
  const graph = cachedGraphData;
  const graphJson = {
    meta: graph.meta,
    nodes: graph.nodes.map((n) => ({
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
    links: graph.links.map((l) => ({
      source: l.source,
      target: l.target,
      type: l.type,
      label: l.label
    }))
  };
  await fs.writeFile(
    path2.join(auraDir, "graph.json"),
    JSON.stringify(graphJson, null, 2),
    "utf-8"
  );
  const summary = generateSummary(graph);
  await fs.writeFile(path2.join(auraDir, "summary.md"), summary, "utf-8");
  vscode3.window.showInformationMessage(
    `Aura: Exported to .aura/ \u2014 graph.json + summary.md`,
    "Open summary"
  ).then((choice) => {
    if (choice === "Open summary") {
      vscode3.window.showTextDocument(
        vscode3.Uri.file(path2.join(auraDir, "summary.md")),
        { preview: true }
      );
    }
  });
}
function generateSummary(graph) {
  const { meta, nodes, links } = graph;
  const lines = [];
  lines.push(`# Aura Graph \u2014 ${meta.projectName}`);
  lines.push(`> Auto-generated by Aura Visualizer on ${meta.analyzedAt}`);
  lines.push(`> This file describes the codebase architecture for AI-assisted development.`);
  lines.push("");
  lines.push("## Overview");
  lines.push(`- **${meta.totalFiles}** files, **${meta.totalLinks}** dependencies`);
  const langs = Object.entries(meta.languageStats).sort((a, b) => b[1].count - a[1].count).map(([lang, s]) => `${lang} (${s.count} files, ${s.totalLOC} LOC)`);
  lines.push(`- Languages: ${langs.join(", ")}`);
  if (meta.unresolvedReferences > 0) {
    lines.push(`- Unresolved references: ${meta.unresolvedReferences}`);
  }
  lines.push("");
  if (meta.groups.length > 0) {
    lines.push("## Directory Structure");
    for (const g of meta.groups) {
      const groupFiles = nodes.filter((n) => n.group === g);
      const totalLOC = groupFiles.reduce((s, n) => s + n.linesOfCode, 0);
      lines.push(`- \`${g}/\` \u2014 ${groupFiles.length} files, ${totalLOC} LOC`);
    }
    lines.push("");
  }
  const highFanIn = [...nodes].sort((a, b) => b.fanIn - a.fanIn).slice(0, 15).filter((n) => n.fanIn > 0);
  if (highFanIn.length > 0) {
    lines.push("## Hotspots (most depended-on files)");
    lines.push("| File | Fan-in | Fan-out | Complexity | LOC |");
    lines.push("|------|--------|---------|------------|-----|");
    for (const n of highFanIn) {
      lines.push(`| \`${n.id}\` | ${n.fanIn} | ${n.fanOut} | ${n.complexity} | ${n.linesOfCode} |`);
    }
    lines.push("");
  }
  const complex = [...nodes].sort((a, b) => b.complexity - a.complexity).slice(0, 10).filter((n) => n.complexity > 1);
  if (complex.length > 0) {
    lines.push("## Most Complex Files");
    lines.push("| File | Complexity | LOC | Fan-in | Fan-out |");
    lines.push("|------|------------|-----|--------|---------|");
    for (const n of complex) {
      lines.push(`| \`${n.id}\` | ${n.complexity} | ${n.linesOfCode} | ${n.fanIn} | ${n.fanOut} |`);
    }
    lines.push("");
  }
  const largest = [...nodes].sort((a, b) => b.linesOfCode - a.linesOfCode).slice(0, 10);
  if (largest.length > 0) {
    lines.push("## Largest Files");
    lines.push("| File | LOC | Complexity | Language |");
    lines.push("|------|-----|------------|----------|");
    for (const n of largest) {
      lines.push(`| \`${n.id}\` | ${n.linesOfCode} | ${n.complexity} | ${n.language} |`);
    }
    lines.push("");
  }
  const orphans = nodes.filter((n) => n.fanIn === 0 && n.fanOut === 0);
  if (orphans.length > 0) {
    lines.push("## Orphan Files (no dependencies)");
    for (const n of orphans) {
      lines.push(`- \`${n.id}\` (${n.language}, ${n.linesOfCode} LOC)`);
    }
    lines.push("");
  }
  const circularPairs = [];
  const linkSet = new Set(links.map((l) => `${l.source}\u2192${l.target}`));
  for (const l of links) {
    const reverse = `${l.target}\u2192${l.source}`;
    if (linkSet.has(reverse) && l.source < l.target) {
      circularPairs.push(`\`${l.source}\` \u2194 \`${l.target}\``);
    }
  }
  if (circularPairs.length > 0) {
    lines.push("## Circular Dependencies");
    for (const pair of circularPairs) {
      lines.push(`- ${pair}`);
    }
    lines.push("");
  }
  const typeCounts = {};
  for (const l of links) {
    typeCounts[l.type] = (typeCounts[l.type] || 0) + 1;
  }
  if (Object.keys(typeCounts).length > 0) {
    lines.push("## Dependency Types");
    for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
      lines.push(`- **${type}**: ${count}`);
    }
    lines.push("");
  }
  lines.push("## Usage Notes for AI Agents");
  lines.push("- Files with high fan-in are **critical hubs** \u2014 changes impact many dependents.");
  lines.push("- Check circular dependencies before refactoring \u2014 break cycles where possible.");
  lines.push("- Orphan files may be dead code candidates for cleanup.");
  lines.push("- Use `graph.json` for programmatic queries (e.g., find all dependents of a file).");
  lines.push("- High complexity files (>15) are prime candidates for decomposition.");
  lines.push("");
  return lines.join("\n");
}
function setupFileWatcher(context) {
  const config = vscode3.workspace.getConfiguration("auraVisualizer");
  const autoRefresh = config.get("autoRefresh", true);
  if (!autoRefresh)
    return;
  fileWatcher = vscode3.workspace.createFileSystemWatcher("**/*.{c,h,js,ts,py,css,html}");
  let pendingUpdates = /* @__PURE__ */ new Map();
  const flushUpdates = () => {
    if (refreshTimeout)
      clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(async () => {
      const updates = new Map(pendingUpdates);
      pendingUpdates.clear();
      if (cachedFiles.length === 0) {
        if (webviewProvider?.isVisible) {
          refreshAnalysis(context);
        } else {
          cachedGraphData = void 0;
        }
        return;
      }
      for (const [, update] of updates) {
        await incrementalUpdate(update.uri, update.deleted);
      }
    }, 500);
  };
  fileWatcher.onDidChange((uri) => {
    pendingUpdates.set(uri.fsPath, { uri, deleted: false });
    flushUpdates();
  });
  fileWatcher.onDidCreate((uri) => {
    pendingUpdates.set(uri.fsPath, { uri, deleted: false });
    flushUpdates();
  });
  fileWatcher.onDidDelete((uri) => {
    pendingUpdates.set(uri.fsPath, { uri, deleted: true });
    flushUpdates();
  });
  context.subscriptions.push(fileWatcher);
}
function deactivate() {
  webviewProvider?.dispose();
  fileWatcher?.dispose();
  if (refreshTimeout)
    clearTimeout(refreshTimeout);
  if (historyWorker) {
    historyWorker.terminate();
    historyWorker = void 0;
  }
  if (graphDb) {
    graphDb.close();
    graphDb = void 0;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map
