"use strict";var nt=Object.create;var ee=Object.defineProperty;var it=Object.getOwnPropertyDescriptor;var rt=Object.getOwnPropertyNames;var ot=Object.getPrototypeOf,at=Object.prototype.hasOwnProperty;var ct=(o,e)=>{for(var t in e)ee(o,t,{get:e[t],enumerable:!0})},Te=(o,e,t,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let i of rt(e))!at.call(o,i)&&i!==t&&ee(o,i,{get:()=>e[i],enumerable:!(n=it(e,i))||n.enumerable});return o};var U=(o,e,t)=>(t=o!=null?nt(ot(o)):{},Te(e||!o||!o.__esModule?ee(t,"default",{value:o,enumerable:!0}):t,o)),lt=o=>Te(ee({},"__esModule",{value:!0}),o);var us={};ct(us,{activate:()=>es,deactivate:()=>ds});module.exports=lt(us);var f=U(require("vscode")),R=U(require("path")),k=U(require("fs/promises")),xe=require("worker_threads");var E=U(require("vscode")),_e=U(require("path")),B=class o{static viewType="auraVisualizer.graphView";panel;extensionUri;disposables=[];onOpenFileEmitter=new E.EventEmitter;onOpenFile=this.onOpenFileEmitter.event;onDisposeEmitter=new E.EventEmitter;onDidDispose=this.onDisposeEmitter.event;pendingData;webviewReady=!1;constructor(e){this.extensionUri=e}show(){return this.panel?(this.panel.reveal(E.ViewColumn.One),this.panel):(this.panel=E.window.createWebviewPanel(o.viewType,"Aura \u2014 3D Visualizer",E.ViewColumn.One,{enableScripts:!0,retainContextWhenHidden:!0,localResourceRoots:[E.Uri.joinPath(this.extensionUri,"out","webview")]}),this.initPanel(),this.panel)}restore(e){this.panel=e,e.webview.options={enableScripts:!0,localResourceRoots:[E.Uri.joinPath(this.extensionUri,"out","webview")]},this.initPanel()}initPanel(){this.panel&&(this.panel.iconPath=E.Uri.joinPath(this.extensionUri,"resources","icon.png"),this.panel.webview.html=this.getHtmlContent(this.panel.webview),this.setupMessageHandler(),this.panel.onDidDispose(()=>{this.panel=void 0,this.webviewReady=!1,this.disposables.forEach(e=>e.dispose()),this.disposables=[],this.onDisposeEmitter.fire()}))}setupMessageHandler(){this.panel&&this.panel.webview.onDidReceiveMessage(e=>{switch(e.type){case"ready":this.webviewReady=!0,this.pendingData&&this.panel?.webview.postMessage({type:"graphData",payload:this.pendingData});break;case"openFile":e.payload&&this.onOpenFileEmitter.fire({path:e.payload.path,line:e.payload.line});break;case"requestRefresh":E.commands.executeCommand("auraVisualizer.refresh");break;case"requestExport":E.commands.executeCommand("auraVisualizer.exportGraph");break}},null,this.disposables)}sendGraphData(e){this.pendingData=e,this.webviewReady&&this.panel?.webview.postMessage({type:"graphData",payload:e})}sendGraphDelta(e){this.webviewReady&&this.panel?.webview.postMessage({type:"updateGraph",payload:e})}focusNode(e){this.panel?.webview.postMessage({type:"focusNode",payload:{nodeId:e}})}sendTheme(e){this.panel?.webview.postMessage({type:"themeChanged",payload:{kind:e}})}sendHistoryIndex(e){this.webviewReady&&this.panel?.webview.postMessage({type:"historyIndex",payload:e})}sendHistoryProgress(e,t){this.webviewReady&&this.panel?.webview.postMessage({type:"historyProgress",payload:{scanned:e,total:t}})}sendHistoryDelta(e){this.webviewReady&&this.panel?.webview.postMessage({type:"historyDelta",payload:e})}get isVisible(){return this.panel?.visible??!1}dispose(){this.panel?.dispose()}getHtmlContent(e){let t=_e.join("out","webview"),n=e.asWebviewUri(E.Uri.joinPath(this.extensionUri,t,"css","style.css")),i=e.asWebviewUri(E.Uri.joinPath(this.extensionUri,t,"js","app.js")),s=e.asWebviewUri(E.Uri.joinPath(this.extensionUri,t,"js","graph-config.js")),a=e.asWebviewUri(E.Uri.joinPath(this.extensionUri,t,"lib","3d-force-graph.min.js")),r=e.asWebviewUri(E.Uri.joinPath(this.extensionUri,t,"lib","three.global.js")),d=pt();return`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${e.cspSource} 'unsafe-inline'; script-src 'nonce-${d}' 'unsafe-eval' ${e.cspSource}; img-src ${e.cspSource} data:; font-src ${e.cspSource};">
    <link rel="stylesheet" href="${n}">
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
                        <p class="loading-status">Analyzing codebase...</p>
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

    <!-- Timeline Bar (Time Machine) -->
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

    <!-- Tooltip (overlay, outside grid) -->
    <div id="tooltip" class="hidden">
        <div class="tooltip-name" id="tooltip-name">\u2014</div>
        <div class="tooltip-meta" id="tooltip-meta">\u2014</div>
    </div>

    <!-- Libraries: THREE must load before 3d-force-graph (it checks window.THREE) -->
    <script nonce="${d}" src="${r}"></script>
    <script nonce="${d}" src="${a}"></script>
    <!-- App Logic -->
    <script nonce="${d}" src="${s}"></script>
    <script nonce="${d}" src="${i}"></script>
</body>
</html>`}};function pt(){let o=new Uint8Array(16);return require("crypto").randomFillSync(o),Array.from(o,e=>e.toString(16).padStart(2,"0")).join("")}var T=U(require("vscode")),D=class extends T.TreeItem{constructor(t,n){let i=t.kind==="file"?t.node.name:t.kind==="stat"?`${t.label}: ${t.value}`:t.label;super(i,n);this.entry=t;t.kind==="header"?this.iconPath=new T.ThemeIcon(t.icon):t.kind==="stat"?this.iconPath=new T.ThemeIcon(t.icon):t.kind==="file"&&(this.description=t.metric,this.iconPath=new T.ThemeIcon("file"),this.command={command:"auraVisualizer.openFileFromTree",title:"Open File",arguments:[t.node.path]},this.tooltip=`${t.node.path}
Complexity: ${t.node.complexity}
Lines: ${t.node.linesOfCode}
Fan-in: ${t.node.fanIn} / Fan-out: ${t.node.fanOut}`)}},te=class{_onDidChangeTreeData=new T.EventEmitter;onDidChangeTreeData=this._onDidChangeTreeData.event;data;update(e){this.data=e,this._onDidChangeTreeData.fire(void 0)}getTreeItem(e){return e}getChildren(e){if(!this.data)return[new D({kind:"stat",label:"No data",value:"Open a workspace and run Aura",icon:"info"},T.TreeItemCollapsibleState.None)];if(!e)return[new D({kind:"header",label:"Stats",icon:"graph"},T.TreeItemCollapsibleState.Expanded),new D({kind:"header",label:"Most Complex",icon:"flame"},T.TreeItemCollapsibleState.Collapsed),new D({kind:"header",label:"Largest Files",icon:"file-binary"},T.TreeItemCollapsibleState.Collapsed),new D({kind:"header",label:"Orphan Files",icon:"warning"},T.TreeItemCollapsibleState.Collapsed)];if(e.entry.kind!=="header")return[];let t=this.data;switch(e.entry.label){case"Stats":{let n=Object.entries(t.meta.languageStats).map(([i,s])=>`${i}: ${s.count}`).join(", ");return[this.stat("Files",String(t.meta.totalFiles),"file"),this.stat("Links",String(t.meta.totalLinks),"link"),this.stat("Function Calls",String(t.meta.functionCallLinks),"symbol-method"),this.stat("Groups",String(t.meta.groups.length),"folder"),this.stat("Languages",n,"symbol-color")]}case"Most Complex":return[...t.nodes].sort((n,i)=>i.complexity-n.complexity).slice(0,10).map(n=>new D({kind:"file",node:n,metric:`complexity: ${n.complexity}`},T.TreeItemCollapsibleState.None));case"Largest Files":return[...t.nodes].sort((n,i)=>i.linesOfCode-n.linesOfCode).slice(0,10).map(n=>new D({kind:"file",node:n,metric:`${n.linesOfCode} lines`},T.TreeItemCollapsibleState.None));case"Orphan Files":return t.nodes.filter(n=>n.fanIn===0&&n.fanOut===0).map(n=>new D({kind:"file",node:n,metric:n.language},T.TreeItemCollapsibleState.None));default:return[]}}stat(e,t,n){return new D({kind:"stat",label:e,value:t,icon:n},T.TreeItemCollapsibleState.None)}};var J=require("fs/promises"),K=require("path"),dt=new Set([".c",".h",".js",".ts",".py",".css",".html",".htm"]),ut={".c":"c",".h":"c",".js":"javascript",".ts":"typescript",".py":"python",".css":"css",".html":"html",".htm":"html"};async function ge(o,e){let t=(0,K.extname)(o).toLowerCase();if(!dt.has(t))return null;try{let n=await(0,J.stat)(o),i=await(0,J.readFile)(o,"utf-8"),s=i.split(`
`).filter(c=>c.trim().length>0).length,a=(0,K.relative)(e,o),r=a.split("/"),d=r.length>1?r[0]:"/",m=r[r.length-1];return{id:a,name:m,path:a,fullPath:o,language:ut[t]||"unknown",extension:t,size:n.size,linesOfCode:s,lastModified:Math.floor(n.mtimeMs),group:d,content:i}}catch{return null}}var P=require("path");var C=class{language;constructor(e){this.language=e}get usesTreeSitter(){return!1}parse(e,t){return[]}parseAST(e,t,n){return this.parse(t,n)}extractSymbolsAST(e,t){return{functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[],interfaces:[],traits:[],typeAliases:[],methods:[]}}extractCallsAST(e,t,n){return[]}extractMatches(e,t,n,i,s){let a=[],r;for(;(r=t.exec(e))!==null;){let d=r[1];d&&a.push({source:i,target:d,type:n,label:s?s(r):`${n}: ${d}`})}return a}};var mt=/#include\s*"([^"]+)"/g,ft=/#include\s*<([^>]+)>/g,gt=/^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?((?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+)([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/gm,ht=/extern\s+[\w\s*]+\s+(\w+)\s*\([^)]*\)\s*;/g,yt=/(?:typedef\s+)?struct\s+(\w+)\s*\{/g,wt=/typedef\s+struct\s*(?:\w+\s*)?\{[^}]*\}\s*(\w+)\s*;/gs,bt=/(?:typedef\s+)?enum\s+(\w+)\s*\{/g,vt=/^[ \t]*#define\s+(\w+)(?:\(([^)]*)\))?/gm,Ce=new Set(["if","else","for","while","do","switch","case","return","break","continue","goto","sizeof","typeof","typedef","struct","union","enum","static","extern","inline","const","volatile","register","auto","void","int","char","float","double","long","short","unsigned","signed","bool","BOOL","printf","fprintf","sprintf","snprintf","scanf","sscanf","malloc","calloc","realloc","free","memcpy","memset","memmove","strlen","strcpy","strncpy","strcmp","strncmp","strcat","fopen","fclose","fread","fwrite","fseek","ftell","exit","abort","assert","NULL","true","false","defined","offsetof","va_start","va_end","va_arg","__attribute__","__declspec","visibility","__extension__"]),se=class extends C{constructor(){super("c")}parse(e,t={}){let{content:n,id:i}=e,s=[];return s.push(...this.extractMatches(n,new RegExp(mt.source,"g"),"include",i,a=>`#include "${a[1]}"`)),t.includeSystemHeaders&&s.push(...this.extractMatches(n,new RegExp(ft.source,"g"),"system-include",i,a=>`#include <${a[1]}>`)),s}extractSymbols(e){let{content:t}=e,n={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[],interfaces:[],traits:[],typeAliases:[],methods:[]},i=this.stripComments(t),s,a=new RegExp(gt.source,"gm");for(;(s=a.exec(i))!==null;){let y=(s[1]||"").trim(),p=s[2],b=(s[3]||"").trim();if(!Ce.has(p)){let N=i.substring(0,s.index).split(`
`).length;n.functions.push({name:p,returnType:y,params:b,line:N,type:"function"})}}let r=new RegExp(ht.source,"g");for(;(s=r.exec(i))!==null;)n.externs.push({name:s[1],type:"extern"});let d=new RegExp(yt.source,"g");for(;(s=d.exec(i))!==null;)n.structs.push({name:s[1],type:"struct"});let m=new RegExp(wt.source,"gs");for(;(s=m.exec(i))!==null;)n.structs.push({name:s[1],type:"typedef-struct"});let c=new RegExp(bt.source,"g");for(;(s=c.exec(i))!==null;)n.enums.push({name:s[1],type:"enum"});let h=new RegExp(vt.source,"gm");for(;(s=h.exec(i))!==null;){let y=s[1],p=s[2]!==void 0;n.macros.push({name:y,type:p?"function-macro":"constant-macro"})}return n}extractCalls(e){let{content:t}=e,n=this.stripComments(t),i=new Set,s=/^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?(?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+([a-zA-Z_]\w*)\s*\([^)]*\)\s*\{/gm,a;for(;(a=s.exec(n))!==null;)i.add(a[1]);let r=new Set,d=/\b(\w+)\s*\(/g,m;for(;(m=d.exec(n))!==null;){let c=m[1];!Ce.has(c)&&!/^[A-Z_]+$/.test(c)&&!i.has(c)&&r.add(c)}return[...r]}stripComments(e){let t=e.replace(/\/\/.*$/gm,"");return t=t.replace(/\/\*[\s\S]*?\*\//g,""),t=t.replace(/"(?:[^"\\]|\\.)*"/g,'""'),t}};var Fe=new Set(["if","else","for","while","do","switch","case","return","break","continue","goto","sizeof","typeof","typedef","struct","union","enum","static","extern","inline","const","volatile","register","auto","void","int","char","float","double","long","short","unsigned","signed","bool","BOOL","printf","fprintf","sprintf","snprintf","scanf","sscanf","malloc","calloc","realloc","free","memcpy","memset","memmove","strlen","strcpy","strncpy","strcmp","strncmp","strcat","fopen","fclose","fread","fwrite","fseek","ftell","exit","abort","assert","NULL","true","false","defined","offsetof","va_start","va_end","va_arg","__attribute__","__declspec","visibility","__extension__"]),ne=class extends C{constructor(){super("c")}get usesTreeSitter(){return!0}parseAST(e,t,n={}){let i=[],s=e.rootNode;for(let a=0;a<s.childCount;a++){let r=s.child(a);if(r.type!=="preproc_include")continue;let d=r.childForFieldName("path");if(!d)continue;let m=d.text;if(d.type==="string_literal"){let c=m.slice(1,-1);i.push({source:t.id,target:c,type:"include",label:`#include "${c}"`})}else if(d.type==="system_lib_string"&&n.includeSystemHeaders){let c=m.slice(1,-1);i.push({source:t.id,target:c,type:"system-include",label:`#include <${c}>`})}}return i}extractSymbolsAST(e,t){let n={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[],interfaces:[],traits:[],typeAliases:[],methods:[]};return this.walkForSymbols(e.rootNode,n),n}walkForSymbols(e,t){switch(e.type){case"function_definition":this.extractFunction(e,t);return;case"declaration":this.extractDeclaration(e,t);return;case"type_definition":this.extractTypedef(e,t);return;case"preproc_def":this.extractMacro(e,t,!1);return;case"preproc_function_def":this.extractMacro(e,t,!0);return;case"struct_specifier":e.parent?.type!=="type_definition"&&e.childForFieldName("body")&&this.extractStruct(e,t,"struct");break;case"enum_specifier":e.parent?.type!=="type_definition"&&e.childForFieldName("body")&&this.extractEnum(e,t);break}for(let n=0;n<e.childCount;n++)this.walkForSymbols(e.child(n),t)}extractFunction(e,t){let n=this.findDescendant(e,"function_declarator");if(!n)return;let s=n.childForFieldName("declarator")?.text;if(!s||Fe.has(s))return;let a=this.getReturnType(e,n),r=this.getParams(n),d=e.startPosition.row+1;t.functions.push({name:s,returnType:a,params:r,line:d,type:"function"})}extractDeclaration(e,t){if(e.text.startsWith("extern")){let i=this.findDescendant(e,"function_declarator");if(i){let a=i.childForFieldName("declarator")?.text;if(a){t.externs.push({name:a,type:"extern"});return}}}}extractTypedef(e,t){let n=this.findDescendant(e,"struct_specifier");if(n){let s=this.findChild(e,"type_identifier");s?t.structs.push({name:s.text,type:"typedef-struct"}):this.extractStruct(n,t,"struct");return}let i=this.findDescendant(e,"enum_specifier");if(i){let s=this.findChild(e,"type_identifier");s?t.enums.push({name:s.text,type:"enum"}):this.extractEnum(i,t)}}extractStruct(e,t,n){let i=e.childForFieldName("name");i&&t.structs.push({name:i.text,type:n})}extractEnum(e,t){let n=e.childForFieldName("name");n&&t.enums.push({name:n.text,type:"enum"})}extractMacro(e,t,n){let i=e.childForFieldName("name");i&&t.macros.push({name:i.text,type:n?"function-macro":"constant-macro"})}extractCallsAST(e,t,n){let i=new Set,s=new Set;this.collectDefinedFunctions(e.rootNode,i),this.collectCalls(e.rootNode,s,i);let a=[];for(let r of s)n.has(r)&&a.push({source:t.id,target:r,type:"function-call",label:`${r}()`});return a}extractCallsFromAST(e){let t=new Set,n=new Set;return this.collectDefinedFunctions(e.rootNode,t),this.collectCalls(e.rootNode,n,t),[...n]}collectDefinedFunctions(e,t){if(e.type==="function_definition"){let i=this.findDescendant(e,"function_declarator")?.childForFieldName("declarator");i&&t.add(i.text)}for(let n=0;n<e.childCount;n++)this.collectDefinedFunctions(e.child(n),t)}collectCalls(e,t,n){if(e.type==="call_expression"){let i=e.childForFieldName("function");if(i?.type==="identifier"){let s=i.text;!Fe.has(s)&&!/^[A-Z_]+$/.test(s)&&!n.has(s)&&t.add(s)}}for(let i=0;i<e.childCount;i++)this.collectCalls(e.child(i),t,n)}getReturnType(e,t){let n=e.childForFieldName("type");return n?e.childForFieldName("declarator")?.type==="pointer_declarator"?n.text+"*":n.text:e.text.substring(0,t.startIndex-e.startIndex).trim()||"int"}getParams(e){let t=e.childForFieldName("parameters");if(!t)return"";let n=t.text;return n.startsWith("(")?n.slice(1,-1).trim():n.trim()}findDescendant(e,t){if(e.type===t)return e;for(let n=0;n<e.childCount;n++){let i=this.findDescendant(e.child(n),t);if(i)return i}return null}findChild(e,t){for(let n=0;n<e.childCount;n++){let i=e.child(n);if(i.type===t)return i}return null}};var xt=/import\s+(?:[\w{}\s,*]+\s+from\s+)?['"]([^'"]+)['"]/g,Et=/(?:^|[=(\s,])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,Rt=/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,St=/import\s*\(\s*`([^`$]+)/g,Ne=/(?:^|[\s;{}])(?:async\s+)?function\s*\*?\s+(\w+)\s*\(/gm,Ie=/(?:^|[\s;])(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*=>/gm;var Tt=/(?:^|[\s;])class\s+(\w+)/gm,_t=/export\s+(?:(?:async\s+)?function\s*\*?\s+(\w+)|class\s+(\w+)|(?:const|let|var)\s+(\w+))/gm,Ct=/export\s+default\s+(?:(?:async\s+)?function\s*\*?\s+(\w+)|class\s+(\w+)|(\w+))/gm,Ft=/export\s*\{([^}]+)\}/g,W=new Set(["if","else","for","while","do","switch","case","return","break","continue","throw","try","catch","finally","new","delete","typeof","instanceof","void","in","of","this","super","with","yield","await","debugger","constructor","get","set","static","async","true","false","null","undefined","NaN","Infinity","console","window","document","global","process","require","module","exports","import","export","default","from"]),Nt=new Set([...W,"parseInt","parseFloat","isNaN","isFinite","encodeURI","decodeURI","encodeURIComponent","decodeURIComponent","eval","JSON","Math","Object","Array","String","Number","Boolean","Date","RegExp","Error","TypeError","RangeError","SyntaxError","ReferenceError","Map","Set","WeakMap","WeakSet","Promise","Proxy","Reflect","Symbol","BigInt","ArrayBuffer","SharedArrayBuffer","DataView","Float32Array","Float64Array","Int8Array","Int16Array","Int32Array","Uint8Array","Uint16Array","Uint32Array","URL","URLSearchParams","setTimeout","setInterval","clearTimeout","clearInterval","requestAnimationFrame","cancelAnimationFrame","fetch","alert","confirm","prompt","addEventListener","removeEventListener","dispatchEvent","createElement","getElementById","querySelector","querySelectorAll","log","warn","error","info","debug","trace","dir","push","pop","shift","unshift","splice","slice","concat","map","filter","reduce","forEach","find","findIndex","some","every","includes","indexOf","join","sort","reverse","flat","flatMap","keys","values","entries","assign","freeze","seal","defineProperty","getOwnPropertyNames","hasOwnProperty","toString","valueOf","toJSON","then","catch","resolve","reject","all","allSettled","race","any","stringify","parse","replace","match","search","split","trim","startsWith","endsWith","charAt","charCodeAt","substring","repeat","padStart","padEnd","bind","call","apply","next","done","emit","on","once","off"]),H=class extends C{constructor(){super("javascript")}parse(e){let{content:t,id:n}=e,i=[];return i.push(...this.extractMatches(t,new RegExp(xt.source,"g"),"import",n,s=>`import from '${s[1]}'`)),i.push(...this.extractMatches(t,new RegExp(Et.source,"g"),"require",n,s=>`require('${s[1]}')`)),i.push(...this.extractMatches(t,new RegExp(Rt.source,"g"),"dynamic-import",n,s=>`import('${s[1]}')`)),i.push(...this.extractMatches(t,new RegExp(St.source,"g"),"dynamic-import",n,s=>`import('${s[1].split("?")[0]}')`).map(s=>({...s,target:s.target.split("?")[0]}))),i}extractSymbols(e){let{content:t}=e,n={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[],interfaces:[],traits:[],typeAliases:[],methods:[]},i=this.stripCommentsAndStrings(t),s,a=new RegExp(Ne.source,"gm");for(;(s=a.exec(i))!==null;){let y=s[1];if(!W.has(y)){let p=i.substring(0,s.index).split(`
`).length;n.functions.push({name:y,type:"function",line:p})}}let r=new RegExp(Ie.source,"gm");for(;(s=r.exec(i))!==null;){let y=s[1];if(!W.has(y)){let p=i.substring(0,s.index).split(`
`).length;n.functions.some(b=>b.name===y)||n.functions.push({name:y,type:"arrow",line:p})}}let d=new RegExp(Tt.source,"gm");for(;(s=d.exec(i))!==null;){let y=s[1],p=i.substring(0,s.index).split(`
`).length;n.classes.push({name:y,type:"class",line:p})}let m=new RegExp(_t.source,"gm");for(;(s=m.exec(i))!==null;){let y=s[1]||s[2]||s[3];if(y){let p=s[1]?"function":s[2]?"class":"variable";n.exports.push({name:y,type:`export-${p}`})}}let c=new RegExp(Ct.source,"gm");for(;(s=c.exec(i))!==null;){let y=s[1]||s[2]||s[3];y&&!W.has(y)&&n.exports.push({name:y,type:"export-default"})}let h=new RegExp(Ft.source,"g");for(;(s=h.exec(i))!==null;){let y=s[1].split(",");for(let p of y){let N=p.trim().match(/^(\w+)(?:\s+as\s+\w+)?$/);N&&!W.has(N[1])&&n.exports.push({name:N[1],type:"export-named"})}}return n}extractCalls(e){let{content:t}=e,n=this.stripCommentsAndStrings(t),i=new Set,s,a=new RegExp(Ne.source,"gm");for(;(s=a.exec(n))!==null;)i.add(s[1]);let r=new RegExp(Ie.source,"gm");for(;(s=r.exec(n))!==null;)i.add(s[1]);let d=new Set,m=/(?:^|[^.\w])(\w+)\s*\(/g;for(;(s=m.exec(n))!==null;){let c=s[1];!Nt.has(c)&&!W.has(c)&&!i.has(c)&&!/^[A-Z_]+$/.test(c)&&d.add(c)}return[...d]}stripCommentsAndStrings(e){let t=e.replace(/\/\/.*$/gm,"");return t=t.replace(/\/\*[\s\S]*?\*\//g,""),t=t.replace(/"(?:[^"\\]|\\.)*"/g,'""'),t=t.replace(/'(?:[^'\\]|\\.)*'/g,"''"),t=t.replace(/`(?:[^`\\]|\\.)*`/gs,"``"),t}};var It=/<script[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,Dt=/<link[^>]+href\s*=\s*['"]([^'"]+)['"]/gi,At=/<img[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,ie=class extends C{constructor(){super("html")}parse(e,t={}){let{content:n,id:i}=e,s=[];return s.push(...this.extractMatches(n,new RegExp(It.source,"gi"),"script",i,a=>`<script src="${a[1]}">`)),s.push(...this.extractMatches(n,new RegExp(Dt.source,"gi"),"stylesheet",i,a=>`<link href="${a[1]}">`)),t.includeAssets&&s.push(...this.extractMatches(n,new RegExp(At.source,"gi"),"asset",i,a=>`<img src="${a[1]}">`)),s}};var Ot=/@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"]\s*\)?/g,Lt=/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/g,re=class extends C{constructor(){super("css")}parse(e,t={}){let{content:n,id:i}=e,s=[];if(s.push(...this.extractMatches(n,new RegExp(Ot.source,"g"),"css-import",i,a=>`@import "${a[1]}"`)),t.includeUrls){let a=this.extractMatches(n,new RegExp(Lt.source,"g"),"css-url",i,r=>`url("${r[1]}")`);s.push(...a.filter(r=>!r.target.startsWith("data:")&&!r.target.startsWith("http:")&&!r.target.startsWith("https:")&&!r.target.startsWith("#")))}return s}};var oe=class extends H{constructor(){super(),this.language="typescript"}};var kt=/^import\s+([\w.]+)/gm,Pt=/^from\s+([\w.]+)\s+import/gm,De=/^[ \t]*def\s+(\w+)\s*\(/gm,Ae=/^[ \t]*class\s+(\w+)\s*[:(]/gm,Mt=/__all__\s*=\s*\[([^\]]*)\]/gs,Ut=/^[ \t]*@(\w+)/gm,Oe=new Set(["print","len","range","int","str","float","list","dict","set","tuple","bool","type","isinstance","issubclass","hasattr","getattr","setattr","delattr","callable","super","property","staticmethod","classmethod","abs","all","any","bin","chr","dir","divmod","enumerate","eval","exec","filter","format","frozenset","globals","hash","hex","id","input","iter","locals","map","max","min","next","object","oct","open","ord","pow","repr","reversed","round","slice","sorted","sum","vars","zip","breakpoint","compile","complex","memoryview","bytearray","bytes","__import__","__name__","__file__","__doc__"]),ae=class extends C{constructor(){super("python")}parse(e){let{content:t,id:n}=e,i=[];return i.push(...this.extractMatches(t,new RegExp(kt.source,"gm"),"import",n,s=>`import ${s[1]}`)),i.push(...this.extractMatches(t,new RegExp(Pt.source,"gm"),"from-import",n,s=>`from ${s[1]} import`)),i}extractSymbols(e){let{content:t}=e,n={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[],interfaces:[],traits:[],typeAliases:[],methods:[]},i=this.stripCommentsAndStrings(t),s,a=new RegExp(De.source,"gm");for(;(s=a.exec(i))!==null;){let h=s[1],y=i.substring(0,s.index).split(`
`).length,p=h.startsWith("__")&&h.endsWith("__");n.functions.push({name:h,type:p?"dunder":"function",line:y})}let r=new RegExp(Ae.source,"gm");for(;(s=r.exec(i))!==null;){let h=s[1],y=i.substring(0,s.index).split(`
`).length;n.classes.push({name:h,type:"class",line:y})}let d=new RegExp(Mt.source,"gs");for(;(s=d.exec(i))!==null;){let h=s[1].split(",");for(let y of h){let p=y.trim().match(/['"](\w+)['"]/);p&&n.exports.push({name:p[1],type:"export-all"})}}let m=new RegExp(Ut.source,"gm"),c=new Set;for(;(s=m.exec(i))!==null;){let h=s[1];if(!c.has(h)&&!Oe.has(h)){c.add(h);let y=i.substring(0,s.index).split(`
`).length;n.macros.push({name:h,type:"decorator",line:y})}}return n}extractCalls(e){let{content:t}=e,n=this.stripCommentsAndStrings(t),i=new Set,s,a=new RegExp(De.source,"gm");for(;(s=a.exec(n))!==null;)i.add(s[1]);let r=new RegExp(Ae.source,"gm");for(;(s=r.exec(n))!==null;)i.add(s[1]);let d=new Set,m=/(?:^|[^.\w])(\w+)\s*\(/g;for(;(s=m.exec(n))!==null;){let c=s[1];!Oe.has(c)&&!i.has(c)&&!/^[A-Z_]+$/.test(c)&&c!=="def"&&c!=="class"&&c!=="if"&&c!=="for"&&c!=="while"&&c!=="return"&&c!=="elif"&&c!=="assert"&&c!=="raise"&&c!=="yield"&&c!=="lambda"&&c!=="not"&&c!=="and"&&c!=="or"&&d.add(c)}return[...d]}stripCommentsAndStrings(e){let t=e.replace(/"""[\s\S]*?"""/g,'""');return t=t.replace(/'''[\s\S]*?'''/g,"''"),t=t.replace(/"(?:[^"\\]|\\.)*"/g,'""'),t=t.replace(/'(?:[^'\\]|\\.)*'/g,"''"),t=t.replace(/#.*$/gm,""),t}};var $t=/\b(if|else\s+if|for|while|do|switch|case|catch)\b/g,Gt=/(\|\||&&)/g,jt=/[^?]\?[^?:]/g,zt=/[^{}]+(?=\s*\{)/g,Bt=/@media\b/g;function Le(o){let{content:e,language:t}=o;switch(t){case"c":case"javascript":case"typescript":return ke(e);case"css":return Wt(e);case"html":return Ht(e);default:return{complexity:1,details:{}}}}function ke(o){let e=o.replace(/\/\/.*$/gm,"").replace(/\/\*[\s\S]*?\*\//g,"").replace(/"(?:[^"\\]|\\.)*"/g,'""').replace(/'(?:[^'\\]|\\.)*'/g,"''"),t=1,n={},i={},s=new RegExp($t.source,"g"),a;for(;(a=s.exec(e))!==null;){let h=a[1].replace(/\s+/g," ");i[h]=(i[h]||0)+1,t++}n.keywords=i;let r=new RegExp(Gt.source,"g"),d=0;for(;(a=r.exec(e))!==null;)d++,t++;n.logicalOperators=d;let m=new RegExp(jt.source,"g"),c=0;for(;(a=m.exec(e))!==null;)c++,t++;return n.ternaryOperators=c,{complexity:t,details:n}}function Wt(o){let e=o.replace(/\/\*[\s\S]*?\*\//g,""),t=0,n=new RegExp(zt.source,"g"),i;for(;(i=n.exec(e))!==null;){let d=i[0].split(",").filter(m=>m.trim().length>0);t+=d.length}let s=0,a=new RegExp(Bt.source,"g");for(;(i=a.exec(e))!==null;)s++;return{complexity:Math.max(1,Math.round(1+t/10+s)),details:{selectors:t,mediaQueries:s}}}function Ht(o){let e=/\bon\w+\s*=/gi,t=0,n;for(;(n=e.exec(o))!==null;)t++;let i=/<script\b[^>]*>[\s\S]*?<\/script>/gi,s=0,a=0;for(;(n=i.exec(o))!==null;){s++;let d=ke(n[0]);a+=d.complexity-1}return{complexity:Math.max(1,1+t+a),details:{eventHandlers:t,scriptBlocks:s,inlineJSComplexity:a}}}var X=require("path"),he=require("web-tree-sitter"),Ue={c:"tree-sitter-c.wasm",cpp:"tree-sitter-cpp.wasm",javascript:"tree-sitter-javascript.wasm",typescript:"tree-sitter-typescript.wasm",tsx:"tree-sitter-tsx.wasm",python:"tree-sitter-python.wasm",java:"tree-sitter-java.wasm",go:"tree-sitter-go.wasm",rust:"tree-sitter-rust.wasm",csharp:"tree-sitter-c_sharp.wasm",css:"tree-sitter-css.wasm",html:"tree-sitter-html.wasm"},Pe=!1,Me=new Map;function Xt(){let o=require("fs"),{resolve:e}=require("path"),t=[(0,X.join)(__dirname,"tree-sitter-wasms"),(0,X.join)(__dirname,"..","node_modules","tree-sitter-wasms","out"),e("node_modules","tree-sitter-wasms","out")];return t.find(n=>o.existsSync(n))||t[0]}async function Yt(){if(Pe)return;let o=require("fs"),{resolve:e}=require("path"),t=[(0,X.join)(__dirname,"tree-sitter-wasms","tree-sitter.wasm"),(0,X.join)(__dirname,"..","node_modules","web-tree-sitter","tree-sitter.wasm"),e("node_modules","web-tree-sitter","tree-sitter.wasm")],n=t.find(i=>o.existsSync(i));if(!n)throw new Error(`web-tree-sitter.wasm not found. Searched:
`+t.join(`
`));await he.init({locateFile:()=>n}),Pe=!0}async function Vt(o){let e=Me.get(o);if(e)return e;let t=Ue[o];if(!t)throw new Error(`No Tree-sitter grammar available for language: ${o}`);let n=Xt(),i=(0,X.join)(n,t),s=await he.Language.load(i);return Me.set(o,s),s}async function qt(o){await Yt();let e=await Vt(o),t=new he;return t.setLanguage(e),t}async function $e(o,e){let n=(await qt(o)).parse(e);if(!n)throw new Error(`Tree-sitter failed to parse source for language: ${o}`);return n}function Ge(o){return o in Ue}var Jt={c:new se,javascript:new H,typescript:new oe,python:new ae,html:new ie,css:new re},je={c:new ne};function ye(o,e){return e&&je[o]?je[o]:Jt[o]}async function we(o){let e=new Map;for(let t of o)if(Ge(t.language))try{let n=await $e(t.language,t.content);e.set(t.id,n)}catch{}return e}function Kt(o,e,t){if(t.has(o))return o;let n=(0,P.dirname)(e),i=(0,P.normalize)((0,P.join)(n,o));if(t.has(i))return i;let s=[".js",".ts",".py",".c",".h",".css",".html"];for(let d of s){if(t.has(i+d))return i+d;if(t.has(o+d))return o+d}let a=(0,P.join)(i,"index.js");if(t.has(a))return a;let r=(0,P.basename)(o);for(let[d,m]of t)if(m.name===r)return d;for(let d of s){let m=r+d;for(let[c,h]of t)if(h.name===m)return c}return null}function Zt(o){let e=new Map;for(let m of o)e.has(m.source)||e.set(m.source,[]),e.get(m.source).push(m.target);let t=[],n=new Set,i=new Set,s=[];function a(m){n.add(m),i.add(m),s.push(m);let c=e.get(m)||[];for(let h of c)if(i.has(h)){let y=s.indexOf(h);if(y>=0){let p=s.slice(y);p.length>=2&&t.push(p)}}else n.has(h)||a(h);s.pop(),i.delete(m)}for(let m of e.keys())n.has(m)||a(m);let r=[],d=new Set;for(let m of t){let h=[...m].sort().join("|");d.has(h)||(d.add(h),r.push(m))}return r}function be(o,e="Project",t={},n){let i=new Map;for(let l of o)i.set(l.id,l);let s=[];for(let l of o){let u=n?.get(l.id),w=ye(l.language,!!u);if(w){let x=u&&w.usesTreeSitter?w.parseAST(u,l,t):w.parse(l,t);s.push(...x)}}let a=new Map,r={c:"c",javascript:"js",typescript:"js",python:"py"},d=new Map,m=new Set(["c","javascript","typescript","python"]);for(let l of o){if(!m.has(l.language))continue;let u=n?.get(l.id),w=ye(l.language,!!u);if(!w)continue;let x=u&&w.usesTreeSitter?w.extractSymbolsAST(u,l):w.extractSymbols?.(l);if(!x)continue;a.set(l.id,x);let M=r[l.language]||l.language;for(let g of x.functions){let q=`${M}:${g.name}`;d.has(q)||d.set(q,[]),d.get(q).push(l.id)}}let c=[],h=new Set([".h",".hpp",".d.ts"]);for(let l of o){if(!m.has(l.language)||h.has(l.extension))continue;let u=n?.get(l.id),w=ye(l.language,!!u);if(!w)continue;let x;u&&w.usesTreeSitter?x=w.extractCallsFromAST?.(u)||[]:x=w.extractCalls?.(l)||[];let M=a.get(l.id),g=new Set(M?M.functions.map(j=>j.name):[]),q=r[l.language]||l.language;for(let j of x){if(g.has(j))continue;let st=`${q}:${j}`,Re=d.get(st);if(Re)for(let Se of Re)Se!==l.id&&c.push({source:l.id,target:Se,type:"function-call",label:`${j}()`})}}let y=new Map;for(let l of o){let u=Le(l);y.set(l.id,u)}let p=[],b={count:0,targets:[]};for(let l of s){let u=Kt(l.target,l.source,i);u?u!==l.source&&p.push({source:l.source,target:u,type:l.type,label:l.label}):(b.count++,b.targets.length<20&&b.targets.push({from:l.source,ref:l.target}))}p.push(...c);let N=new Set,I=p.filter(l=>{let u=`${l.source}|${l.target}|${l.type}`;return N.has(u)?!1:(N.add(u),!0)}),V=new Map,me=new Map;for(let l of I)V.set(l.source,(V.get(l.source)||0)+1),me.set(l.target,(me.get(l.target)||0)+1);let Q=new Set,Je=/(?:^|[^.\w])(\w+)\s*\(/gm;for(let l of o){let u,w=new RegExp(Je.source,"gm");for(;(u=w.exec(l.content))!==null;)Q.add(u[1])}let Ee=new Map;for(let l of o){let u=a.get(l.id);if(!u)continue;let w=[];for(let x of u.functions)x.name!=="main"&&x.type!=="dunder"&&(Q.has(x.name)||w.push(x.name));for(let x of u.classes)Q.has(x.name)||w.push(x.name);for(let x of u.exports)!Q.has(x.name)&&!w.includes(x.name)&&w.push(x.name);w.length>0&&Ee.set(l.id,w)}let G=o.map(l=>{let u=a.get(l.id),w=y.get(l.id)||{complexity:1,details:{}},x={id:l.id,name:l.name,path:l.path,language:l.language,extension:l.extension,size:l.size,linesOfCode:l.linesOfCode,lastModified:l.lastModified||0,group:l.group,fanOut:V.get(l.id)||0,fanIn:me.get(l.id)||0,complexity:w.complexity,complexityDetails:w.details};u&&(x.symbols={functions:u.functions.map(g=>({name:g.name,returnType:g.returnType||"",params:g.params||"",line:g.line||0,type:g.type,visibility:g.visibility,isStatic:g.isStatic,isAsync:g.isAsync})),structs:u.structs.map(g=>({name:g.name,type:g.type})),enums:u.enums.map(g=>({name:g.name,type:g.type})),macros:u.macros.slice(0,30),classes:u.classes.map(g=>({name:g.name,type:g.type})),exports:u.exports.map(g=>({name:g.name,type:g.type})),interfaces:(u.interfaces||[]).map(g=>({name:g.name,type:g.type})),traits:(u.traits||[]).map(g=>({name:g.name,type:g.type})),typeAliases:(u.typeAliases||[]).map(g=>({name:g.name,type:g.type})),methods:(u.methods||[]).map(g=>({name:g.name,returnType:g.returnType||"",params:g.params||"",line:g.line||0,type:g.type,visibility:g.visibility,isStatic:g.isStatic,isAsync:g.isAsync})),totalSymbols:u.functions.length+u.structs.length+u.enums.length+u.macros.length+u.classes.length+u.exports.length+(u.interfaces||[]).length+(u.traits||[]).length+(u.typeAliases||[]).length+(u.methods||[]).length});let M=Ee.get(l.id);return M&&M.length>0&&(x.deadExports=M),x}),O={};for(let l of G)O[l.language]||(O[l.language]={count:0,totalLOC:0,avgComplexity:0}),O[l.language].count++,O[l.language].totalLOC+=l.linesOfCode,O[l.language].avgComplexity+=l.complexity;for(let l in O)O[l].avgComplexity=Math.round(O[l].avgComplexity/O[l].count*10)/10;let Ke=new Set(G.map(l=>l.group)),Ze=I.filter(l=>l.type==="function-call").length,Qe=G.filter(l=>l.deadExports&&l.deadExports.length>0).length,et=G.reduce((l,u)=>l+(u.deadExports?u.deadExports.length:0),0),fe=Zt(I),tt=new Map(G.map(l=>[l.id,l]));for(let l=0;l<fe.length;l++)for(let u of fe[l]){let w=tt.get(u);w&&(w.cycleIds||(w.cycleIds=[]),w.cycleIds.push(l))}return{meta:{projectName:e,analyzedAt:new Date().toISOString(),totalFiles:G.length,totalLinks:I.length,totalRelationsFound:s.length,functionCallLinks:Ze,unresolvedReferences:b.count,unresolvedSamples:b.targets,deadCodeFiles:Qe,deadExportsTotal:et,cycles:fe,languageStats:O,groups:[...Ke].sort()},nodes:G,links:I}}var ze=require("child_process"),Be=require("util"),Qt=(0,Be.promisify)(ze.execFile),Ws=50*1024*1024;async function ve(o){try{return await Qt("git",["rev-parse","--is-inside-work-tree"],{cwd:o}),!0}catch{return!1}}var Xe=U(require("sql.js")),$=require("fs"),le=require("path"),We=`
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
`;function _(o,e,t=[]){let n=o.prepare(e);n.bind(t);let i=[];for(;n.step();)i.push(n.getAsObject());return n.free(),i}function He(o,e,t=[]){let n=o.prepare(e);n.bind(t);let i;return n.step()&&(i=n.getAsObject()),n.free(),i}var ce=class{db=null;dbPath="";async open(e){let t=(0,le.join)((0,le.dirname)(require.resolve("sql.js")),"sql-wasm.wasm"),n=await(0,Xe.default)({locateFile:()=>t});if(this.dbPath=e,(0,$.existsSync)(e)){let i=(0,$.readFileSync)(e);this.db=new n.Database(i)}else this.db=new n.Database;this.db.run(We),this.migrateSchema()}openSync(e,t){if(this.dbPath=t,(0,$.existsSync)(t)){let n=(0,$.readFileSync)(t);this.db=new e.Database(n)}else this.db=new e.Database;this.db.run(We),this.migrateSchema()}close(){this.db?.close(),this.db=null}get isOpen(){return this.db!==null}save(){if(!this.db||!this.dbPath)return;let e=this.db.export();(0,$.writeFileSync)(this.dbPath,Buffer.from(e))}importGraphData(e){let t=this.ensureDb();t.run("BEGIN TRANSACTION");try{t.run("DELETE FROM symbols"),t.run("DELETE FROM edges"),t.run("DELETE FROM cycles"),t.run("DELETE FROM nodes"),t.run("DELETE FROM meta");for(let s of e.nodes)t.run("INSERT INTO nodes (id, name, language, extension, group_name, size, lines, complexity, fan_in, fan_out, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",[s.id,s.name,s.language,s.extension,s.group,s.size,s.linesOfCode,s.complexity,s.fanIn,s.fanOut,s.lastModified]);for(let s of e.links){let a=typeof s.source=="object"?s.source.id:s.source,r=typeof s.target=="object"?s.target.id:s.target;t.run("INSERT OR IGNORE INTO edges (source, target, type, label) VALUES (?, ?, ?, ?)",[a,r,s.type,s.label||""])}let n="INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead, visibility, is_static, is_async) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";for(let s of e.nodes){if(!s.symbols)continue;let a=new Set(s.deadExports||[]);for(let r of s.symbols.functions)t.run(n,[s.id,r.name,r.type||"function",r.returnType||"",r.params||"",r.line||0,a.has(r.name)?1:0,r.visibility||"public",r.isStatic?1:0,r.isAsync?1:0]);for(let r of s.symbols.methods||[])t.run(n,[s.id,r.name,r.type||"method",r.returnType||"",r.params||"",r.line||0,a.has(r.name)?1:0,r.visibility||"public",r.isStatic?1:0,r.isAsync?1:0]);for(let r of s.symbols.structs)t.run(n,[s.id,r.name,r.type||"struct","","",0,0,"public",0,0]);for(let r of s.symbols.enums)t.run(n,[s.id,r.name,r.type||"enum","","",0,0,"public",0,0]);for(let r of s.symbols.macros)t.run(n,[s.id,r.name,r.type||"macro","","",0,0,"public",0,0]);for(let r of s.symbols.classes)t.run(n,[s.id,r.name,r.type||"class","","",0,a.has(r.name)?1:0,"public",0,0]);for(let r of s.symbols.exports)t.run(n,[s.id,r.name,r.type||"export","","",0,a.has(r.name)?1:0,"public",0,0]);for(let r of s.symbols.interfaces||[])t.run(n,[s.id,r.name,r.type||"interface","","",r.line||0,0,r.visibility||"public",0,0]);for(let r of s.symbols.traits||[])t.run(n,[s.id,r.name,r.type||"trait","","",r.line||0,0,r.visibility||"public",0,0]);for(let r of s.symbols.typeAliases||[])t.run(n,[s.id,r.name,r.type||"type_alias","","",r.line||0,0,r.visibility||"public",0,0])}if(e.meta.cycles)for(let s=0;s<e.meta.cycles.length;s++){let a=e.meta.cycles[s];for(let r=0;r<a.length;r++)t.run("INSERT INTO cycles (cycle_id, node_id, position) VALUES (?, ?, ?)",[s,a[r],r])}let i=[["projectName",e.meta.projectName],["analyzedAt",e.meta.analyzedAt],["totalFiles",String(e.meta.totalFiles)],["totalLinks",String(e.meta.totalLinks)],["totalRelationsFound",String(e.meta.totalRelationsFound)],["functionCallLinks",String(e.meta.functionCallLinks)],["unresolvedReferences",String(e.meta.unresolvedReferences)],["deadCodeFiles",String(e.meta.deadCodeFiles)],["deadExportsTotal",String(e.meta.deadExportsTotal)],["languageStats",JSON.stringify(e.meta.languageStats)],["groups",JSON.stringify(e.meta.groups)]];for(let[s,a]of i)t.run("INSERT INTO meta (key, value) VALUES (?, ?)",[s,a]);t.run("COMMIT")}catch(n){throw t.run("ROLLBACK"),n}this.save()}getDependencies(e,t=5){return _(this.ensureDb(),`
            WITH RECURSIVE deps(id, depth) AS (
                SELECT target, 1 FROM edges WHERE source = ?
                UNION
                SELECT e.target, d.depth + 1
                FROM edges e JOIN deps d ON e.source = d.id
                WHERE d.depth < ?
            )
            SELECT id, MIN(depth) AS depth FROM deps GROUP BY id ORDER BY depth
        `,[e,t])}getDependents(e,t=5){return _(this.ensureDb(),`
            WITH RECURSIVE deps(id, depth) AS (
                SELECT source, 1 FROM edges WHERE target = ?
                UNION
                SELECT e.source, d.depth + 1
                FROM edges e JOIN deps d ON e.target = d.id
                WHERE d.depth < ?
            )
            SELECT id, MIN(depth) AS depth FROM deps GROUP BY id ORDER BY depth
        `,[e,t])}findPath(e,t,n=20){let i=_(this.ensureDb(),`
            WITH RECURSIVE path(id, route, depth) AS (
                SELECT ?, ?, 0
                UNION
                SELECT e.target, p.route || '|' || e.target, p.depth + 1
                FROM edges e JOIN path p ON e.source = p.id
                WHERE p.depth < ? AND INSTR(p.route, e.target) = 0
            )
            SELECT route FROM path WHERE id = ? ORDER BY depth LIMIT 1
        `,[e,e,n,t]);return i.length===0?null:i[0].route.split("|")}getHotspots(e=20,t="impact"){let n=t==="complexity"?"complexity DESC":t==="fan_in"?"fan_in DESC":t==="lines"?"lines DESC":"(complexity * (fan_in + 1)) DESC";return _(this.ensureDb(),`SELECT *, (complexity * (fan_in + 1)) AS impact_score FROM nodes ORDER BY ${n} LIMIT ?`,[e])}getDeadCode(){return _(this.ensureDb(),"SELECT node_id AS nodeId, name AS symbol, kind FROM symbols WHERE is_dead = 1 ORDER BY node_id")}getCycles(){let e=_(this.ensureDb(),"SELECT cycle_id, node_id FROM cycles ORDER BY cycle_id, position"),t=[],n=[],i=-1;for(let s of e)s.cycle_id!==i&&(n.length>0&&t.push(n),n=[],i=s.cycle_id),n.push(s.node_id);return n.length>0&&t.push(n),t}getNodeDetail(e){let t=this.ensureDb(),n=He(t,"SELECT * FROM nodes WHERE id = ?",[e]);if(!n)return null;let i=_(t,"SELECT * FROM symbols WHERE node_id = ?",[e]),s=_(t,"SELECT target FROM edges WHERE source = ?",[e]),a=_(t,"SELECT source FROM edges WHERE target = ?",[e]);return{...n,symbols:i,dependencies:s.map(r=>r.target),dependents:a.map(r=>r.source)}}getArchitectureOverview(){return _(this.ensureDb(),`
            SELECT language,
                   COUNT(*) AS count,
                   SUM(lines) AS total_loc,
                   ROUND(AVG(complexity), 1) AS avg_complexity
            FROM nodes GROUP BY language ORDER BY count DESC
        `)}searchSymbols(e,t){let n=this.ensureDb(),i="SELECT node_id AS nodeId, name, kind, line, visibility, is_static AS isStatic, is_async AS isAsync FROM symbols WHERE name LIKE ?"+(t?" AND kind = ?":"")+" ORDER BY name LIMIT 100",s=t?[`%${e}%`,t]:[`%${e}%`];return _(n,i,s).map(r=>({...r,isStatic:!!r.isStatic,isAsync:!!r.isAsync,visibility:r.visibility||"public"}))}getHeritage(e){let t=this.ensureDb();return e?_(t,"SELECT * FROM edges WHERE type IN ('extends', 'implements') AND (source = ? OR target = ?) ORDER BY source, type",[e,e]):_(t,"SELECT * FROM edges WHERE type IN ('extends', 'implements') ORDER BY source, type")}getAllNodes(){return _(this.ensureDb(),"SELECT * FROM nodes ORDER BY id")}getAllEdges(){return _(this.ensureDb(),"SELECT * FROM edges ORDER BY source, target")}getMeta(e){return He(this.ensureDb(),"SELECT value FROM meta WHERE key = ?",[e])?.value??null}getAllMeta(){let e=_(this.ensureDb(),"SELECT key, value FROM meta"),t={};for(let n of e)t[n.key]=n.value;return t}migrateSchema(){let e=this.ensureDb(),t=_(e,"PRAGMA table_info('symbols')").map(i=>i.name),n=[["visibility","ALTER TABLE symbols ADD COLUMN visibility TEXT DEFAULT 'public'"],["is_static","ALTER TABLE symbols ADD COLUMN is_static INTEGER DEFAULT 0"],["is_async","ALTER TABLE symbols ADD COLUMN is_async INTEGER DEFAULT 0"]];for(let[i,s]of n)t.includes(i)||e.run(s)}ensureDb(){if(!this.db)throw new Error("GraphDB is not open");return this.db}};var v,S,L=[],A,Ye,Y,F,Z,de,pe=!1,z;function es(o){de=new te;let e=f.window.createTreeView("auraVisualizer.statsView",{treeDataProvider:de,showCollapseAll:!0});o.subscriptions.push(e),F=f.window.createStatusBarItem(f.StatusBarAlignment.Left,50),F.command="auraVisualizer.open",F.text="$(eye) Aura",F.tooltip="Open Aura 3D Visualizer",F.show(),o.subscriptions.push(F),o.subscriptions.push(f.commands.registerCommand("auraVisualizer.open",()=>ts(o)),f.commands.registerCommand("auraVisualizer.refresh",()=>ue(o)),f.commands.registerCommand("auraVisualizer.focusFile",()=>as()),f.commands.registerCommand("auraVisualizer.openFileFromTree",t=>{let n=f.workspace.workspaceFolders?.[0];if(!n)return;let i=R.join(n.uri.fsPath,t);f.window.showTextDocument(f.Uri.file(i),{preview:!0})}),f.commands.registerCommand("auraVisualizer.exportGraph",()=>cs())),ps(o),o.subscriptions.push(f.window.onDidChangeActiveTextEditor(t=>{if(t&&v?.isVisible){let n=f.workspace.workspaceFolders?.[0];if(n){let i=R.relative(n.uri.fsPath,t.document.uri.fsPath);i.startsWith("..")||v.focusNode(i)}}})),o.subscriptions.push(f.window.onDidChangeActiveColorTheme(t=>{v?.sendTheme(t.kind)})),f.window.registerWebviewPanelSerializer(B.viewType,{async deserializeWebviewPanel(t){v||(v=new B(o.extensionUri),Ve()),v.restore(t),S&&v.sendGraphData(S)}}),f.workspace.workspaceFolders?.length&&ue(o)}function Ve(){v&&v.onOpenFile(async({path:o,line:e})=>{let t=f.workspace.workspaceFolders?.[0];if(!t)return;let n=R.join(t.uri.fsPath,o),i=f.Uri.file(n);try{let s=await f.workspace.openTextDocument(i),a=await f.window.showTextDocument(s,{preserveFocus:!1});if(e&&e>0){let r=new f.Position(e-1,0);a.selection=new f.Selection(r,r),a.revealRange(new f.Range(r,r),f.TextEditorRevealType.InCenter)}}catch{}})}async function ts(o){v||(v=new B(o.extensionUri),Ve()),v.show(),S?v.sendGraphData(S):await ue(o)}async function ue(o){if(pe)return;pe=!0;let e=f.workspace.workspaceFolders?.[0];if(!e){pe=!1,f.window.showWarningMessage("Aura: No workspace folder open.");return}let t=e.uri.fsPath,i=f.workspace.getConfiguration("auraVisualizer").get("excludePaths",["node_modules",".git","dist","build","out","__pycache__"]);F&&(F.text="$(loading~spin) Aura: Analyzing...");try{let s=await f.window.withProgress({location:f.ProgressLocation.Window,title:"Aura: Analyzing codebase..."},()=>ns(o.extensionUri,t,i,e.name));S=s.graphData,L=s.files,v&&v.sendGraphData(S),de?.update(S),qe();try{if(!z){z=new ce;let a=R.join(t,".aura");await k.mkdir(a,{recursive:!0}),await z.open(R.join(a,"graph.db"))}z.importGraphData(S),await ss(o,t)}catch(a){console.error("[aura] GraphDB import error:",a)}os(o,t,i)}catch(s){let a=s instanceof Error?s.message:String(s);f.window.showErrorMessage(`Aura: Analysis failed \u2014 ${a}`),F&&(F.text="$(eye) Aura")}finally{pe=!1}}async function ss(o,e){let t=R.join(e,".vscode"),n=R.join(t,"mcp.json"),i=R.join(o.extensionUri.fsPath,"out","mcp-server.js"),s=R.join(e,".aura","graph.db"),a={};try{let r=await k.readFile(n,"utf-8");a=JSON.parse(r)}catch{}a.servers&&a.servers.aura||(a.servers=a.servers||{},a.servers.aura={command:"node",args:[i],env:{AURA_DB_PATH:s}},await k.mkdir(t,{recursive:!0}),await k.writeFile(n,JSON.stringify(a,null,4)+`
`,"utf-8"),console.log("[aura] MCP server registered in .vscode/mcp.json"))}function ns(o,e,t,n){return new Promise((i,s)=>{let a=R.join(o.fsPath,"out","analyzer-worker.js"),r=new xe.Worker(a,{workerData:{rootPath:e,skipDirs:t,projectName:n}});r.on("message",d=>{d.error?s(new Error(d.error)):i({graphData:d.graphData,files:d.files}),r.terminate()}),r.on("error",d=>{s(d),r.terminate()}),r.on("exit",d=>{d!==0&&s(new Error(`Worker exited with code ${d}`))})})}async function is(o,e){let t=f.workspace.workspaceFolders?.[0];if(!t||L.length===0)return;let n=t.uri.fsPath,i=R.relative(n,o.fsPath);if(i.startsWith(".."))return;if(e)L=L.filter(d=>d.id!==i);else{let d=await ge(o.fsPath,n);if(!d)return;let m=L.findIndex(c=>c.id===i);m>=0?L[m]=d:L.push(d)}let s=S,a=t.name,r=await we(L);if(S=be(L,a,{},r),v?.isVisible&&S)if(s){let d=rs(s,S,i,e);v.sendGraphDelta(d)}else v.sendGraphData(S);de?.update(S),qe()}function rs(o,e,t,n){let i={changedNodes:[],removedNodeIds:[],addedLinks:[],removedLinks:[],meta:e.meta};n&&i.removedNodeIds.push(t);let s=new Map(o.nodes.map(c=>[c.id,c])),a=new Map(e.nodes.map(c=>[c.id,c]));for(let c of e.nodes){let h=s.get(c.id);(!h||c.fanIn!==h.fanIn||c.fanOut!==h.fanOut||c.complexity!==h.complexity||c.linesOfCode!==h.linesOfCode||c.size!==h.size)&&i.changedNodes.push(c)}for(let c of o.nodes)a.has(c.id)||i.removedNodeIds.includes(c.id)||i.removedNodeIds.push(c.id);let r=c=>`${typeof c.source=="object"?c.source.id:c.source}|${typeof c.target=="object"?c.target.id:c.target}|${c.type}`,d=new Set(o.links.map(r)),m=new Set(e.links.map(r));for(let c of e.links)d.has(r(c))||i.addedLinks.push(c);for(let c of o.links)m.has(r(c))||i.removedLinks.push({source:typeof c.source=="object"?c.source.id:c.source,target:typeof c.target=="object"?c.target.id:c.target,type:c.type});return i}function qe(){if(!F||!S)return;let{totalFiles:o,totalLinks:e}=S.meta;F.text=`$(eye) Aura: ${o} files, ${e} links`,F.tooltip=`Aura \u2014 ${o} files, ${e} dependencies
Click to open 3D visualizer`}async function os(o,e,t){if(!await ve(e))return;A&&(A.terminate(),A=void 0);let i=R.join(e,".aura","history"),s=R.join(o.extensionUri.fsPath,"out","history-worker.js");A=new xe.Worker(s,{workerData:{rootPath:e,skipDirs:t,historyDir:i}}),A.on("message",a=>{switch(a.type){case"index":Ye=a.payload,v&&v.sendHistoryIndex(Ye);break;case"progress":{let r=a.payload;v&&v.sendHistoryProgress(r.scanned,r.total);break}case"delta":{let r=a.payload;v&&v.sendHistoryDelta(r);break}case"done":break;case"error":break}}),A.on("error",()=>{}),A.on("exit",()=>{A=void 0})}function as(){let o=f.window.activeTextEditor;if(!o||!v?.isVisible)return;let e=f.workspace.workspaceFolders?.[0];if(!e)return;let t=R.relative(e.uri.fsPath,o.document.uri.fsPath);t.startsWith("..")||v.focusNode(t)}async function cs(){let o=f.workspace.workspaceFolders?.[0];if(!o){f.window.showWarningMessage("Aura: No workspace folder open.");return}if(!S){f.window.showWarningMessage("Aura: No graph data. Run analysis first (Ctrl+Shift+A).");return}let e=R.join(o.uri.fsPath,".aura");await k.mkdir(e,{recursive:!0});let t=S,n={meta:t.meta,nodes:t.nodes.map(s=>({id:s.id,name:s.name,path:s.path,language:s.language,extension:s.extension,size:s.size,linesOfCode:s.linesOfCode,group:s.group,fanIn:s.fanIn,fanOut:s.fanOut,complexity:s.complexity})),links:t.links.map(s=>({source:s.source,target:s.target,type:s.type,label:s.label}))};await k.writeFile(R.join(e,"graph.json"),JSON.stringify(n,null,2),"utf-8");let i=ls(t);await k.writeFile(R.join(e,"summary.md"),i,"utf-8"),f.window.showInformationMessage("Aura: Exported to .aura/ \u2014 graph.json + summary.md","Open summary").then(s=>{s==="Open summary"&&f.window.showTextDocument(f.Uri.file(R.join(e,"summary.md")),{preview:!0})})}function ls(o){let{meta:e,nodes:t,links:n}=o,i=[];i.push(`# Aura Graph \u2014 ${e.projectName}`),i.push(`> Auto-generated by Aura Visualizer on ${e.analyzedAt}`),i.push("> This file describes the codebase architecture for AI-assisted development."),i.push(""),i.push("## Overview"),i.push(`- **${e.totalFiles}** files, **${e.totalLinks}** dependencies`);let s=Object.entries(e.languageStats).sort((p,b)=>b[1].count-p[1].count).map(([p,b])=>`${p} (${b.count} files, ${b.totalLOC} LOC)`);if(i.push(`- Languages: ${s.join(", ")}`),e.unresolvedReferences>0&&i.push(`- Unresolved references: ${e.unresolvedReferences}`),i.push(""),e.groups.length>0){i.push("## Directory Structure");for(let p of e.groups){let b=t.filter(I=>I.group===p),N=b.reduce((I,V)=>I+V.linesOfCode,0);i.push(`- \`${p}/\` \u2014 ${b.length} files, ${N} LOC`)}i.push("")}let a=[...t].sort((p,b)=>b.fanIn-p.fanIn).slice(0,15).filter(p=>p.fanIn>0);if(a.length>0){i.push("## Hotspots (most depended-on files)"),i.push("| File | Fan-in | Fan-out | Complexity | LOC |"),i.push("|------|--------|---------|------------|-----|");for(let p of a)i.push(`| \`${p.id}\` | ${p.fanIn} | ${p.fanOut} | ${p.complexity} | ${p.linesOfCode} |`);i.push("")}let r=[...t].sort((p,b)=>b.complexity-p.complexity).slice(0,10).filter(p=>p.complexity>1);if(r.length>0){i.push("## Most Complex Files"),i.push("| File | Complexity | LOC | Fan-in | Fan-out |"),i.push("|------|------------|-----|--------|---------|");for(let p of r)i.push(`| \`${p.id}\` | ${p.complexity} | ${p.linesOfCode} | ${p.fanIn} | ${p.fanOut} |`);i.push("")}let d=[...t].sort((p,b)=>b.linesOfCode-p.linesOfCode).slice(0,10);if(d.length>0){i.push("## Largest Files"),i.push("| File | LOC | Complexity | Language |"),i.push("|------|-----|------------|----------|");for(let p of d)i.push(`| \`${p.id}\` | ${p.linesOfCode} | ${p.complexity} | ${p.language} |`);i.push("")}let m=t.filter(p=>p.fanIn===0&&p.fanOut===0);if(m.length>0){i.push("## Orphan Files (no dependencies)");for(let p of m)i.push(`- \`${p.id}\` (${p.language}, ${p.linesOfCode} LOC)`);i.push("")}let c=[],h=new Set(n.map(p=>`${p.source}\u2192${p.target}`));for(let p of n){let b=`${p.target}\u2192${p.source}`;h.has(b)&&p.source<p.target&&c.push(`\`${p.source}\` \u2194 \`${p.target}\``)}if(c.length>0){i.push("## Circular Dependencies");for(let p of c)i.push(`- ${p}`);i.push("")}let y={};for(let p of n)y[p.type]=(y[p.type]||0)+1;if(Object.keys(y).length>0){i.push("## Dependency Types");for(let[p,b]of Object.entries(y).sort((N,I)=>I[1]-N[1]))i.push(`- **${p}**: ${b}`);i.push("")}return i.push("## Usage Notes for AI Agents"),i.push("- Files with high fan-in are **critical hubs** \u2014 changes impact many dependents."),i.push("- Check circular dependencies before refactoring \u2014 break cycles where possible."),i.push("- Orphan files may be dead code candidates for cleanup."),i.push("- Use `graph.json` for programmatic queries (e.g., find all dependents of a file)."),i.push("- High complexity files (>15) are prime candidates for decomposition."),i.push(""),i.join(`
`)}function ps(o){if(!f.workspace.getConfiguration("auraVisualizer").get("autoRefresh",!0))return;Y=f.workspace.createFileSystemWatcher("**/*.{c,h,js,ts,py,css,html}");let n=new Map,i=()=>{Z&&clearTimeout(Z),Z=setTimeout(async()=>{let s=new Map(n);if(n.clear(),L.length===0){v?.isVisible?ue(o):S=void 0;return}for(let[,a]of s)await is(a.uri,a.deleted)},500)};Y.onDidChange(s=>{n.set(s.fsPath,{uri:s,deleted:!1}),i()}),Y.onDidCreate(s=>{n.set(s.fsPath,{uri:s,deleted:!1}),i()}),Y.onDidDelete(s=>{n.set(s.fsPath,{uri:s,deleted:!0}),i()}),o.subscriptions.push(Y)}function ds(){v?.dispose(),Y?.dispose(),Z&&clearTimeout(Z),A&&(A.terminate(),A=void 0),z&&(z.close(),z=void 0)}0&&(module.exports={activate,deactivate});
