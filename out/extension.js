"use strict";var We=Object.create;var Z=Object.defineProperty;var He=Object.getOwnPropertyDescriptor;var Xe=Object.getOwnPropertyNames;var Ye=Object.getPrototypeOf,Ve=Object.prototype.hasOwnProperty;var qe=(a,s)=>{for(var e in s)Z(a,e,{get:s[e],enumerable:!0})},we=(a,s,e,i)=>{if(s&&typeof s=="object"||typeof s=="function")for(let n of Xe(s))!Ve.call(a,n)&&n!==e&&Z(a,n,{get:()=>s[n],enumerable:!(i=He(s,n))||i.enumerable});return a};var P=(a,s,e)=>(e=a!=null?We(Ye(a)):{},we(s||!a||!a.__esModule?Z(e,"default",{value:a,enumerable:!0}):e,a)),Je=a=>we(Z({},"__esModule",{value:!0}),a);var Vt={};qe(Vt,{activate:()=>Mt,deactivate:()=>Yt});module.exports=Je(Vt);var m=P(require("vscode")),x=P(require("path")),N=P(require("fs/promises")),fe=require("worker_threads");var R=P(require("vscode")),ve=P(require("path")),z=class a{static viewType="auraVisualizer.graphView";panel;extensionUri;disposables=[];onOpenFileEmitter=new R.EventEmitter;onOpenFile=this.onOpenFileEmitter.event;onDisposeEmitter=new R.EventEmitter;onDidDispose=this.onDisposeEmitter.event;pendingData;webviewReady=!1;constructor(s){this.extensionUri=s}show(){return this.panel?(this.panel.reveal(R.ViewColumn.One),this.panel):(this.panel=R.window.createWebviewPanel(a.viewType,"Aura \u2014 3D Visualizer",R.ViewColumn.One,{enableScripts:!0,retainContextWhenHidden:!0,localResourceRoots:[R.Uri.joinPath(this.extensionUri,"out","webview")]}),this.initPanel(),this.panel)}restore(s){this.panel=s,s.webview.options={enableScripts:!0,localResourceRoots:[R.Uri.joinPath(this.extensionUri,"out","webview")]},this.initPanel()}initPanel(){this.panel&&(this.panel.iconPath=R.Uri.joinPath(this.extensionUri,"resources","icon.png"),this.panel.webview.html=this.getHtmlContent(this.panel.webview),this.setupMessageHandler(),this.panel.onDidDispose(()=>{this.panel=void 0,this.webviewReady=!1,this.disposables.forEach(s=>s.dispose()),this.disposables=[],this.onDisposeEmitter.fire()}))}setupMessageHandler(){this.panel&&this.panel.webview.onDidReceiveMessage(s=>{switch(s.type){case"ready":this.webviewReady=!0,this.pendingData&&this.panel?.webview.postMessage({type:"graphData",payload:this.pendingData});break;case"openFile":s.payload&&this.onOpenFileEmitter.fire({path:s.payload.path,line:s.payload.line});break;case"requestRefresh":R.commands.executeCommand("auraVisualizer.refresh");break;case"requestExport":R.commands.executeCommand("auraVisualizer.exportGraph");break}},null,this.disposables)}sendGraphData(s){this.pendingData=s,this.webviewReady&&this.panel?.webview.postMessage({type:"graphData",payload:s})}sendGraphDelta(s){this.webviewReady&&this.panel?.webview.postMessage({type:"updateGraph",payload:s})}focusNode(s){this.panel?.webview.postMessage({type:"focusNode",payload:{nodeId:s}})}sendTheme(s){this.panel?.webview.postMessage({type:"themeChanged",payload:{kind:s}})}sendHistoryIndex(s){this.webviewReady&&this.panel?.webview.postMessage({type:"historyIndex",payload:s})}sendHistoryProgress(s,e){this.webviewReady&&this.panel?.webview.postMessage({type:"historyProgress",payload:{scanned:s,total:e}})}sendHistoryDelta(s){this.webviewReady&&this.panel?.webview.postMessage({type:"historyDelta",payload:s})}get isVisible(){return this.panel?.visible??!1}dispose(){this.panel?.dispose()}getHtmlContent(s){let e=ve.join("out","webview"),i=s.asWebviewUri(R.Uri.joinPath(this.extensionUri,e,"css","style.css")),n=s.asWebviewUri(R.Uri.joinPath(this.extensionUri,e,"js","app.js")),t=s.asWebviewUri(R.Uri.joinPath(this.extensionUri,e,"js","graph-config.js")),r=s.asWebviewUri(R.Uri.joinPath(this.extensionUri,e,"lib","3d-force-graph.min.js")),o=s.asWebviewUri(R.Uri.joinPath(this.extensionUri,e,"lib","three.global.js")),d=Ke();return`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${s.cspSource} 'unsafe-inline'; script-src 'nonce-${d}' 'unsafe-eval' ${s.cspSource}; img-src ${s.cspSource} data:; font-src ${s.cspSource};">
    <link rel="stylesheet" href="${i}">
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
    <script nonce="${d}" src="${o}"></script>
    <script nonce="${d}" src="${r}"></script>
    <!-- App Logic -->
    <script nonce="${d}" src="${t}"></script>
    <script nonce="${d}" src="${n}"></script>
</body>
</html>`}};function Ke(){let a=new Uint8Array(16);return require("crypto").randomFillSync(a),Array.from(a,s=>s.toString(16).padStart(2,"0")).join("")}var T=P(require("vscode")),O=class extends T.TreeItem{constructor(e,i){let n=e.kind==="file"?e.node.name:e.kind==="stat"?`${e.label}: ${e.value}`:e.label;super(n,i);this.entry=e;e.kind==="header"?this.iconPath=new T.ThemeIcon(e.icon):e.kind==="stat"?this.iconPath=new T.ThemeIcon(e.icon):e.kind==="file"&&(this.description=e.metric,this.iconPath=new T.ThemeIcon("file"),this.command={command:"auraVisualizer.openFileFromTree",title:"Open File",arguments:[e.node.path]},this.tooltip=`${e.node.path}
Complexity: ${e.node.complexity}
Lines: ${e.node.linesOfCode}
Fan-in: ${e.node.fanIn} / Fan-out: ${e.node.fanOut}`)}},Q=class{_onDidChangeTreeData=new T.EventEmitter;onDidChangeTreeData=this._onDidChangeTreeData.event;data;update(s){this.data=s,this._onDidChangeTreeData.fire(void 0)}getTreeItem(s){return s}getChildren(s){if(!this.data)return[new O({kind:"stat",label:"No data",value:"Open a workspace and run Aura",icon:"info"},T.TreeItemCollapsibleState.None)];if(!s)return[new O({kind:"header",label:"Stats",icon:"graph"},T.TreeItemCollapsibleState.Expanded),new O({kind:"header",label:"Most Complex",icon:"flame"},T.TreeItemCollapsibleState.Collapsed),new O({kind:"header",label:"Largest Files",icon:"file-binary"},T.TreeItemCollapsibleState.Collapsed),new O({kind:"header",label:"Orphan Files",icon:"warning"},T.TreeItemCollapsibleState.Collapsed)];if(s.entry.kind!=="header")return[];let e=this.data;switch(s.entry.label){case"Stats":{let i=Object.entries(e.meta.languageStats).map(([n,t])=>`${n}: ${t.count}`).join(", ");return[this.stat("Files",String(e.meta.totalFiles),"file"),this.stat("Links",String(e.meta.totalLinks),"link"),this.stat("Function Calls",String(e.meta.functionCallLinks),"symbol-method"),this.stat("Groups",String(e.meta.groups.length),"folder"),this.stat("Languages",i,"symbol-color")]}case"Most Complex":return[...e.nodes].sort((i,n)=>n.complexity-i.complexity).slice(0,10).map(i=>new O({kind:"file",node:i,metric:`complexity: ${i.complexity}`},T.TreeItemCollapsibleState.None));case"Largest Files":return[...e.nodes].sort((i,n)=>n.linesOfCode-i.linesOfCode).slice(0,10).map(i=>new O({kind:"file",node:i,metric:`${i.linesOfCode} lines`},T.TreeItemCollapsibleState.None));case"Orphan Files":return e.nodes.filter(i=>i.fanIn===0&&i.fanOut===0).map(i=>new O({kind:"file",node:i,metric:i.language},T.TreeItemCollapsibleState.None));default:return[]}}stat(s,e,i){return new O({kind:"stat",label:s,value:e,icon:i},T.TreeItemCollapsibleState.None)}};var V=require("fs/promises"),q=require("path"),Ze=new Set([".c",".h",".js",".ts",".py",".css",".html",".htm"]),Qe={".c":"c",".h":"c",".js":"javascript",".ts":"typescript",".py":"python",".css":"css",".html":"html",".htm":"html"};async function de(a,s){let e=(0,q.extname)(a).toLowerCase();if(!Ze.has(e))return null;try{let i=await(0,V.stat)(a),n=await(0,V.readFile)(a,"utf-8"),t=n.split(`
`).filter(c=>c.trim().length>0).length,r=(0,q.relative)(s,a),o=r.split("/"),d=o.length>1?o[0]:"/",g=o[o.length-1];return{id:r,name:g,path:r,fullPath:a,language:Qe[e]||"unknown",extension:e,size:i.size,linesOfCode:t,lastModified:Math.floor(i.mtimeMs),group:d,content:n}}catch{return null}}var k=require("path");var _=class{language;constructor(s){this.language=s}get usesTreeSitter(){return!1}parse(s,e){return[]}parseAST(s,e,i){return this.parse(e,i)}extractSymbolsAST(s,e){return{functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[],interfaces:[],traits:[],typeAliases:[],methods:[]}}extractCallsAST(s,e,i){return[]}extractMatches(s,e,i,n,t){let r=[],o;for(;(o=e.exec(s))!==null;){let d=o[1];d&&r.push({source:n,target:d,type:i,label:t?t(o):`${i}: ${d}`})}return r}};var et=/#include\s*"([^"]+)"/g,tt=/#include\s*<([^>]+)>/g,st=/^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?((?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+)([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/gm,nt=/extern\s+[\w\s*]+\s+(\w+)\s*\([^)]*\)\s*;/g,it=/(?:typedef\s+)?struct\s+(\w+)\s*\{/g,ot=/typedef\s+struct\s*(?:\w+\s*)?\{[^}]*\}\s*(\w+)\s*;/gs,at=/(?:typedef\s+)?enum\s+(\w+)\s*\{/g,rt=/^[ \t]*#define\s+(\w+)(?:\(([^)]*)\))?/gm,Ee=new Set(["if","else","for","while","do","switch","case","return","break","continue","goto","sizeof","typeof","typedef","struct","union","enum","static","extern","inline","const","volatile","register","auto","void","int","char","float","double","long","short","unsigned","signed","bool","BOOL","printf","fprintf","sprintf","snprintf","scanf","sscanf","malloc","calloc","realloc","free","memcpy","memset","memmove","strlen","strcpy","strncpy","strcmp","strncmp","strcat","fopen","fclose","fread","fwrite","fseek","ftell","exit","abort","assert","NULL","true","false","defined","offsetof","va_start","va_end","va_arg","__attribute__","__declspec","visibility","__extension__"]),ee=class extends _{constructor(){super("c")}parse(s,e={}){let{content:i,id:n}=s,t=[];return t.push(...this.extractMatches(i,new RegExp(et.source,"g"),"include",n,r=>`#include "${r[1]}"`)),e.includeSystemHeaders&&t.push(...this.extractMatches(i,new RegExp(tt.source,"g"),"system-include",n,r=>`#include <${r[1]}>`)),t}extractSymbols(s){let{content:e}=s,i={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[],interfaces:[],traits:[],typeAliases:[],methods:[]},n=this.stripComments(e),t,r=new RegExp(st.source,"gm");for(;(t=r.exec(n))!==null;){let y=(t[1]||"").trim(),p=t[2],w=(t[3]||"").trim();if(!Ee.has(p)){let I=n.substring(0,t.index).split(`
`).length;i.functions.push({name:p,returnType:y,params:w,line:I,type:"function"})}}let o=new RegExp(nt.source,"g");for(;(t=o.exec(n))!==null;)i.externs.push({name:t[1],type:"extern"});let d=new RegExp(it.source,"g");for(;(t=d.exec(n))!==null;)i.structs.push({name:t[1],type:"struct"});let g=new RegExp(ot.source,"gs");for(;(t=g.exec(n))!==null;)i.structs.push({name:t[1],type:"typedef-struct"});let c=new RegExp(at.source,"g");for(;(t=c.exec(n))!==null;)i.enums.push({name:t[1],type:"enum"});let h=new RegExp(rt.source,"gm");for(;(t=h.exec(n))!==null;){let y=t[1],p=t[2]!==void 0;i.macros.push({name:y,type:p?"function-macro":"constant-macro"})}return i}extractCalls(s){let{content:e}=s,i=this.stripComments(e),n=new Set,t=/^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?(?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+([a-zA-Z_]\w*)\s*\([^)]*\)\s*\{/gm,r;for(;(r=t.exec(i))!==null;)n.add(r[1]);let o=new Set,d=/\b(\w+)\s*\(/g,g;for(;(g=d.exec(i))!==null;){let c=g[1];!Ee.has(c)&&!/^[A-Z_]+$/.test(c)&&!n.has(c)&&o.add(c)}return[...o]}stripComments(s){let e=s.replace(/\/\/.*$/gm,"");return e=e.replace(/\/\*[\s\S]*?\*\//g,""),e=e.replace(/"(?:[^"\\]|\\.)*"/g,'""'),e}};var lt=/import\s+(?:[\w{}\s,*]+\s+from\s+)?['"]([^'"]+)['"]/g,ct=/(?:^|[=(\s,])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,pt=/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,dt=/import\s*\(\s*`([^`$]+)/g,Re=/(?:^|[\s;{}])(?:async\s+)?function\s*\*?\s+(\w+)\s*\(/gm,xe=/(?:^|[\s;])(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*=>/gm;var ut=/(?:^|[\s;])class\s+(\w+)/gm,mt=/export\s+(?:(?:async\s+)?function\s*\*?\s+(\w+)|class\s+(\w+)|(?:const|let|var)\s+(\w+))/gm,gt=/export\s+default\s+(?:(?:async\s+)?function\s*\*?\s+(\w+)|class\s+(\w+)|(\w+))/gm,ft=/export\s*\{([^}]+)\}/g,B=new Set(["if","else","for","while","do","switch","case","return","break","continue","throw","try","catch","finally","new","delete","typeof","instanceof","void","in","of","this","super","with","yield","await","debugger","constructor","get","set","static","async","true","false","null","undefined","NaN","Infinity","console","window","document","global","process","require","module","exports","import","export","default","from"]),ht=new Set([...B,"parseInt","parseFloat","isNaN","isFinite","encodeURI","decodeURI","encodeURIComponent","decodeURIComponent","eval","JSON","Math","Object","Array","String","Number","Boolean","Date","RegExp","Error","TypeError","RangeError","SyntaxError","ReferenceError","Map","Set","WeakMap","WeakSet","Promise","Proxy","Reflect","Symbol","BigInt","ArrayBuffer","SharedArrayBuffer","DataView","Float32Array","Float64Array","Int8Array","Int16Array","Int32Array","Uint8Array","Uint16Array","Uint32Array","URL","URLSearchParams","setTimeout","setInterval","clearTimeout","clearInterval","requestAnimationFrame","cancelAnimationFrame","fetch","alert","confirm","prompt","addEventListener","removeEventListener","dispatchEvent","createElement","getElementById","querySelector","querySelectorAll","log","warn","error","info","debug","trace","dir","push","pop","shift","unshift","splice","slice","concat","map","filter","reduce","forEach","find","findIndex","some","every","includes","indexOf","join","sort","reverse","flat","flatMap","keys","values","entries","assign","freeze","seal","defineProperty","getOwnPropertyNames","hasOwnProperty","toString","valueOf","toJSON","then","catch","resolve","reject","all","allSettled","race","any","stringify","parse","replace","match","search","split","trim","startsWith","endsWith","charAt","charCodeAt","substring","repeat","padStart","padEnd","bind","call","apply","next","done","emit","on","once","off"]),W=class extends _{constructor(){super("javascript")}parse(s){let{content:e,id:i}=s,n=[];return n.push(...this.extractMatches(e,new RegExp(lt.source,"g"),"import",i,t=>`import from '${t[1]}'`)),n.push(...this.extractMatches(e,new RegExp(ct.source,"g"),"require",i,t=>`require('${t[1]}')`)),n.push(...this.extractMatches(e,new RegExp(pt.source,"g"),"dynamic-import",i,t=>`import('${t[1]}')`)),n.push(...this.extractMatches(e,new RegExp(dt.source,"g"),"dynamic-import",i,t=>`import('${t[1].split("?")[0]}')`).map(t=>({...t,target:t.target.split("?")[0]}))),n}extractSymbols(s){let{content:e}=s,i={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[],interfaces:[],traits:[],typeAliases:[],methods:[]},n=this.stripCommentsAndStrings(e),t,r=new RegExp(Re.source,"gm");for(;(t=r.exec(n))!==null;){let y=t[1];if(!B.has(y)){let p=n.substring(0,t.index).split(`
`).length;i.functions.push({name:y,type:"function",line:p})}}let o=new RegExp(xe.source,"gm");for(;(t=o.exec(n))!==null;){let y=t[1];if(!B.has(y)){let p=n.substring(0,t.index).split(`
`).length;i.functions.some(w=>w.name===y)||i.functions.push({name:y,type:"arrow",line:p})}}let d=new RegExp(ut.source,"gm");for(;(t=d.exec(n))!==null;){let y=t[1],p=n.substring(0,t.index).split(`
`).length;i.classes.push({name:y,type:"class",line:p})}let g=new RegExp(mt.source,"gm");for(;(t=g.exec(n))!==null;){let y=t[1]||t[2]||t[3];if(y){let p=t[1]?"function":t[2]?"class":"variable";i.exports.push({name:y,type:`export-${p}`})}}let c=new RegExp(gt.source,"gm");for(;(t=c.exec(n))!==null;){let y=t[1]||t[2]||t[3];y&&!B.has(y)&&i.exports.push({name:y,type:"export-default"})}let h=new RegExp(ft.source,"g");for(;(t=h.exec(n))!==null;){let y=t[1].split(",");for(let p of y){let I=p.trim().match(/^(\w+)(?:\s+as\s+\w+)?$/);I&&!B.has(I[1])&&i.exports.push({name:I[1],type:"export-named"})}}return i}extractCalls(s){let{content:e}=s,i=this.stripCommentsAndStrings(e),n=new Set,t,r=new RegExp(Re.source,"gm");for(;(t=r.exec(i))!==null;)n.add(t[1]);let o=new RegExp(xe.source,"gm");for(;(t=o.exec(i))!==null;)n.add(t[1]);let d=new Set,g=/(?:^|[^.\w])(\w+)\s*\(/g;for(;(t=g.exec(i))!==null;){let c=t[1];!ht.has(c)&&!B.has(c)&&!n.has(c)&&!/^[A-Z_]+$/.test(c)&&d.add(c)}return[...d]}stripCommentsAndStrings(s){let e=s.replace(/\/\/.*$/gm,"");return e=e.replace(/\/\*[\s\S]*?\*\//g,""),e=e.replace(/"(?:[^"\\]|\\.)*"/g,'""'),e=e.replace(/'(?:[^'\\]|\\.)*'/g,"''"),e=e.replace(/`(?:[^`\\]|\\.)*`/gs,"``"),e}};var yt=/<script[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,bt=/<link[^>]+href\s*=\s*['"]([^'"]+)['"]/gi,wt=/<img[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,te=class extends _{constructor(){super("html")}parse(s,e={}){let{content:i,id:n}=s,t=[];return t.push(...this.extractMatches(i,new RegExp(yt.source,"gi"),"script",n,r=>`<script src="${r[1]}">`)),t.push(...this.extractMatches(i,new RegExp(bt.source,"gi"),"stylesheet",n,r=>`<link href="${r[1]}">`)),e.includeAssets&&t.push(...this.extractMatches(i,new RegExp(wt.source,"gi"),"asset",n,r=>`<img src="${r[1]}">`)),t}};var vt=/@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"]\s*\)?/g,Et=/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/g,se=class extends _{constructor(){super("css")}parse(s,e={}){let{content:i,id:n}=s,t=[];if(t.push(...this.extractMatches(i,new RegExp(vt.source,"g"),"css-import",n,r=>`@import "${r[1]}"`)),e.includeUrls){let r=this.extractMatches(i,new RegExp(Et.source,"g"),"css-url",n,o=>`url("${o[1]}")`);t.push(...r.filter(o=>!o.target.startsWith("data:")&&!o.target.startsWith("http:")&&!o.target.startsWith("https:")&&!o.target.startsWith("#")))}return t}};var ne=class extends W{constructor(){super(),this.language="typescript"}};var Rt=/^import\s+([\w.]+)/gm,xt=/^from\s+([\w.]+)\s+import/gm,Se=/^[ \t]*def\s+(\w+)\s*\(/gm,Te=/^[ \t]*class\s+(\w+)\s*[:(]/gm,St=/__all__\s*=\s*\[([^\]]*)\]/gs,Tt=/^[ \t]*@(\w+)/gm,Ce=new Set(["print","len","range","int","str","float","list","dict","set","tuple","bool","type","isinstance","issubclass","hasattr","getattr","setattr","delattr","callable","super","property","staticmethod","classmethod","abs","all","any","bin","chr","dir","divmod","enumerate","eval","exec","filter","format","frozenset","globals","hash","hex","id","input","iter","locals","map","max","min","next","object","oct","open","ord","pow","repr","reversed","round","slice","sorted","sum","vars","zip","breakpoint","compile","complex","memoryview","bytearray","bytes","__import__","__name__","__file__","__doc__"]),ie=class extends _{constructor(){super("python")}parse(s){let{content:e,id:i}=s,n=[];return n.push(...this.extractMatches(e,new RegExp(Rt.source,"gm"),"import",i,t=>`import ${t[1]}`)),n.push(...this.extractMatches(e,new RegExp(xt.source,"gm"),"from-import",i,t=>`from ${t[1]} import`)),n}extractSymbols(s){let{content:e}=s,i={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[],interfaces:[],traits:[],typeAliases:[],methods:[]},n=this.stripCommentsAndStrings(e),t,r=new RegExp(Se.source,"gm");for(;(t=r.exec(n))!==null;){let h=t[1],y=n.substring(0,t.index).split(`
`).length,p=h.startsWith("__")&&h.endsWith("__");i.functions.push({name:h,type:p?"dunder":"function",line:y})}let o=new RegExp(Te.source,"gm");for(;(t=o.exec(n))!==null;){let h=t[1],y=n.substring(0,t.index).split(`
`).length;i.classes.push({name:h,type:"class",line:y})}let d=new RegExp(St.source,"gs");for(;(t=d.exec(n))!==null;){let h=t[1].split(",");for(let y of h){let p=y.trim().match(/['"](\w+)['"]/);p&&i.exports.push({name:p[1],type:"export-all"})}}let g=new RegExp(Tt.source,"gm"),c=new Set;for(;(t=g.exec(n))!==null;){let h=t[1];if(!c.has(h)&&!Ce.has(h)){c.add(h);let y=n.substring(0,t.index).split(`
`).length;i.macros.push({name:h,type:"decorator",line:y})}}return i}extractCalls(s){let{content:e}=s,i=this.stripCommentsAndStrings(e),n=new Set,t,r=new RegExp(Se.source,"gm");for(;(t=r.exec(i))!==null;)n.add(t[1]);let o=new RegExp(Te.source,"gm");for(;(t=o.exec(i))!==null;)n.add(t[1]);let d=new Set,g=/(?:^|[^.\w])(\w+)\s*\(/g;for(;(t=g.exec(i))!==null;){let c=t[1];!Ce.has(c)&&!n.has(c)&&!/^[A-Z_]+$/.test(c)&&c!=="def"&&c!=="class"&&c!=="if"&&c!=="for"&&c!=="while"&&c!=="return"&&c!=="elif"&&c!=="assert"&&c!=="raise"&&c!=="yield"&&c!=="lambda"&&c!=="not"&&c!=="and"&&c!=="or"&&d.add(c)}return[...d]}stripCommentsAndStrings(s){let e=s.replace(/"""[\s\S]*?"""/g,'""');return e=e.replace(/'''[\s\S]*?'''/g,"''"),e=e.replace(/"(?:[^"\\]|\\.)*"/g,'""'),e=e.replace(/'(?:[^'\\]|\\.)*'/g,"''"),e=e.replace(/#.*$/gm,""),e}};var Ct=/\b(if|else\s+if|for|while|do|switch|case|catch)\b/g,It=/(\|\||&&)/g,Dt=/[^?]\?[^?:]/g,_t=/[^{}]+(?=\s*\{)/g,Ot=/@media\b/g;function Ie(a){let{content:s,language:e}=a;switch(e){case"c":case"javascript":case"typescript":return De(s);case"css":return At(s);case"html":return Ft(s);default:return{complexity:1,details:{}}}}function De(a){let s=a.replace(/\/\/.*$/gm,"").replace(/\/\*[\s\S]*?\*\//g,"").replace(/"(?:[^"\\]|\\.)*"/g,'""').replace(/'(?:[^'\\]|\\.)*'/g,"''"),e=1,i={},n={},t=new RegExp(Ct.source,"g"),r;for(;(r=t.exec(s))!==null;){let h=r[1].replace(/\s+/g," ");n[h]=(n[h]||0)+1,e++}i.keywords=n;let o=new RegExp(It.source,"g"),d=0;for(;(r=o.exec(s))!==null;)d++,e++;i.logicalOperators=d;let g=new RegExp(Dt.source,"g"),c=0;for(;(r=g.exec(s))!==null;)c++,e++;return i.ternaryOperators=c,{complexity:e,details:i}}function At(a){let s=a.replace(/\/\*[\s\S]*?\*\//g,""),e=0,i=new RegExp(_t.source,"g"),n;for(;(n=i.exec(s))!==null;){let d=n[0].split(",").filter(g=>g.trim().length>0);e+=d.length}let t=0,r=new RegExp(Ot.source,"g");for(;(n=r.exec(s))!==null;)t++;return{complexity:Math.max(1,Math.round(1+e/10+t)),details:{selectors:e,mediaQueries:t}}}function Ft(a){let s=/\bon\w+\s*=/gi,e=0,i;for(;(i=s.exec(a))!==null;)e++;let n=/<script\b[^>]*>[\s\S]*?<\/script>/gi,t=0,r=0;for(;(i=n.exec(a))!==null;){t++;let d=De(i[0]);r+=d.complexity-1}return{complexity:Math.max(1,1+e+r),details:{eventHandlers:e,scriptBlocks:t,inlineJSComplexity:r}}}var ue={c:new ee,javascript:new W,typescript:new ne,python:new ie,html:new te,css:new se};function Nt(a,s,e){if(e.has(a))return a;let i=(0,k.dirname)(s),n=(0,k.normalize)((0,k.join)(i,a));if(e.has(n))return n;let t=[".js",".ts",".py",".c",".h",".css",".html"];for(let d of t){if(e.has(n+d))return n+d;if(e.has(a+d))return a+d}let r=(0,k.join)(n,"index.js");if(e.has(r))return r;let o=(0,k.basename)(a);for(let[d,g]of e)if(g.name===o)return d;for(let d of t){let g=o+d;for(let[c,h]of e)if(h.name===g)return c}return null}function Lt(a){let s=new Map;for(let g of a)s.has(g.source)||s.set(g.source,[]),s.get(g.source).push(g.target);let e=[],i=new Set,n=new Set,t=[];function r(g){i.add(g),n.add(g),t.push(g);let c=s.get(g)||[];for(let h of c)if(n.has(h)){let y=t.indexOf(h);if(y>=0){let p=t.slice(y);p.length>=2&&e.push(p)}}else i.has(h)||r(h);t.pop(),n.delete(g)}for(let g of s.keys())i.has(g)||r(g);let o=[],d=new Set;for(let g of e){let h=[...g].sort().join("|");d.has(h)||(d.add(h),o.push(g))}return o}function me(a,s="Project",e={}){let i=new Map;for(let l of a)i.set(l.id,l);let n=[];for(let l of a){let u=ue[l.language];if(u){let v=u.parse(l,e);n.push(...v)}}let t=new Map,r={c:"c",javascript:"js",typescript:"js",python:"py"},o=new Map,d=new Set(["c","javascript","typescript","python"]);for(let l of a){if(!d.has(l.language))continue;let u=ue[l.language];if(!u.extractSymbols)continue;let v=u.extractSymbols(l);t.set(l.id,v);let E=r[l.language]||l.language;for(let G of v.functions){let f=`${E}:${G.name}`;o.has(f)||o.set(f,[]),o.get(f).push(l.id)}}let g=[],c=new Set([".h",".hpp",".d.ts"]);for(let l of a){if(!d.has(l.language)||c.has(l.extension))continue;let u=ue[l.language];if(!u.extractCalls)continue;let v=u.extractCalls(l),E=t.get(l.id),G=new Set(E?E.functions.map(Y=>Y.name):[]),f=r[l.language]||l.language;for(let Y of v){if(G.has(Y))continue;let Be=`${f}:${Y}`,ye=o.get(Be);if(ye)for(let be of ye)be!==l.id&&g.push({source:l.id,target:be,type:"function-call",label:`${Y}()`})}}let h=new Map;for(let l of a){let u=Ie(l);h.set(l.id,u)}let y=[],p={count:0,targets:[]};for(let l of n){let u=Nt(l.target,l.source,i);u?u!==l.source&&y.push({source:l.source,target:u,type:l.type,label:l.label}):(p.count++,p.targets.length<20&&p.targets.push({from:l.source,ref:l.target}))}y.push(...g);let w=new Set,I=y.filter(l=>{let u=`${l.source}|${l.target}|${l.type}`;return w.has(u)?!1:(w.add(u),!0)}),L=new Map,X=new Map;for(let l of I)L.set(l.source,(L.get(l.source)||0)+1),X.set(l.target,(X.get(l.target)||0)+1);let K=new Set,Pe=/(?:^|[^.\w])(\w+)\s*\(/gm;for(let l of a){let u,v=new RegExp(Pe.source,"gm");for(;(u=v.exec(l.content))!==null;)K.add(u[1])}let he=new Map;for(let l of a){let u=t.get(l.id);if(!u)continue;let v=[];for(let E of u.functions)E.name!=="main"&&E.type!=="dunder"&&(K.has(E.name)||v.push(E.name));for(let E of u.classes)K.has(E.name)||v.push(E.name);for(let E of u.exports)!K.has(E.name)&&!v.includes(E.name)&&v.push(E.name);v.length>0&&he.set(l.id,v)}let $=a.map(l=>{let u=t.get(l.id),v=h.get(l.id)||{complexity:1,details:{}},E={id:l.id,name:l.name,path:l.path,language:l.language,extension:l.extension,size:l.size,linesOfCode:l.linesOfCode,lastModified:l.lastModified||0,group:l.group,fanOut:L.get(l.id)||0,fanIn:X.get(l.id)||0,complexity:v.complexity,complexityDetails:v.details};u&&(E.symbols={functions:u.functions.map(f=>({name:f.name,returnType:f.returnType||"",params:f.params||"",line:f.line||0,type:f.type,visibility:f.visibility,isStatic:f.isStatic,isAsync:f.isAsync})),structs:u.structs.map(f=>({name:f.name,type:f.type})),enums:u.enums.map(f=>({name:f.name,type:f.type})),macros:u.macros.slice(0,30),classes:u.classes.map(f=>({name:f.name,type:f.type})),exports:u.exports.map(f=>({name:f.name,type:f.type})),interfaces:(u.interfaces||[]).map(f=>({name:f.name,type:f.type})),traits:(u.traits||[]).map(f=>({name:f.name,type:f.type})),typeAliases:(u.typeAliases||[]).map(f=>({name:f.name,type:f.type})),methods:(u.methods||[]).map(f=>({name:f.name,returnType:f.returnType||"",params:f.params||"",line:f.line||0,type:f.type,visibility:f.visibility,isStatic:f.isStatic,isAsync:f.isAsync})),totalSymbols:u.functions.length+u.structs.length+u.enums.length+u.macros.length+u.classes.length+u.exports.length+(u.interfaces||[]).length+(u.traits||[]).length+(u.typeAliases||[]).length+(u.methods||[]).length});let G=he.get(l.id);return G&&G.length>0&&(E.deadExports=G),E}),F={};for(let l of $)F[l.language]||(F[l.language]={count:0,totalLOC:0,avgComplexity:0}),F[l.language].count++,F[l.language].totalLOC+=l.linesOfCode,F[l.language].avgComplexity+=l.complexity;for(let l in F)F[l].avgComplexity=Math.round(F[l].avgComplexity/F[l].count*10)/10;let Ue=new Set($.map(l=>l.group)),$e=I.filter(l=>l.type==="function-call").length,Ge=$.filter(l=>l.deadExports&&l.deadExports.length>0).length,je=$.reduce((l,u)=>l+(u.deadExports?u.deadExports.length:0),0),pe=Lt(I),ze=new Map($.map(l=>[l.id,l]));for(let l=0;l<pe.length;l++)for(let u of pe[l]){let v=ze.get(u);v&&(v.cycleIds||(v.cycleIds=[]),v.cycleIds.push(l))}return{meta:{projectName:s,analyzedAt:new Date().toISOString(),totalFiles:$.length,totalLinks:I.length,totalRelationsFound:n.length,functionCallLinks:$e,unresolvedReferences:p.count,unresolvedSamples:p.targets,deadCodeFiles:Ge,deadExportsTotal:je,cycles:pe,languageStats:F,groups:[...Ue].sort()},nodes:$,links:I}}var _e=require("child_process"),Oe=require("util"),kt=(0,Oe.promisify)(_e.execFile),Es=50*1024*1024;async function ge(a){try{return await kt("git",["rev-parse","--is-inside-work-tree"],{cwd:a}),!0}catch{return!1}}var Ne=P(require("sql.js")),U=require("fs"),ae=require("path"),Ae=`
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
`;function C(a,s,e=[]){let i=a.prepare(s);i.bind(e);let n=[];for(;i.step();)n.push(i.getAsObject());return i.free(),n}function Fe(a,s,e=[]){let i=a.prepare(s);i.bind(e);let n;return i.step()&&(n=i.getAsObject()),i.free(),n}var oe=class{db=null;dbPath="";async open(s){let e=(0,ae.join)((0,ae.dirname)(require.resolve("sql.js")),"sql-wasm.wasm"),i=await(0,Ne.default)({locateFile:()=>e});if(this.dbPath=s,(0,U.existsSync)(s)){let n=(0,U.readFileSync)(s);this.db=new i.Database(n)}else this.db=new i.Database;this.db.run(Ae),this.migrateSchema()}openSync(s,e){if(this.dbPath=e,(0,U.existsSync)(e)){let i=(0,U.readFileSync)(e);this.db=new s.Database(i)}else this.db=new s.Database;this.db.run(Ae),this.migrateSchema()}close(){this.db?.close(),this.db=null}get isOpen(){return this.db!==null}save(){if(!this.db||!this.dbPath)return;let s=this.db.export();(0,U.writeFileSync)(this.dbPath,Buffer.from(s))}importGraphData(s){let e=this.ensureDb();e.run("BEGIN TRANSACTION");try{e.run("DELETE FROM symbols"),e.run("DELETE FROM edges"),e.run("DELETE FROM cycles"),e.run("DELETE FROM nodes"),e.run("DELETE FROM meta");for(let t of s.nodes)e.run("INSERT INTO nodes (id, name, language, extension, group_name, size, lines, complexity, fan_in, fan_out, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",[t.id,t.name,t.language,t.extension,t.group,t.size,t.linesOfCode,t.complexity,t.fanIn,t.fanOut,t.lastModified]);for(let t of s.links){let r=typeof t.source=="object"?t.source.id:t.source,o=typeof t.target=="object"?t.target.id:t.target;e.run("INSERT OR IGNORE INTO edges (source, target, type, label) VALUES (?, ?, ?, ?)",[r,o,t.type,t.label||""])}let i="INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead, visibility, is_static, is_async) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";for(let t of s.nodes){if(!t.symbols)continue;let r=new Set(t.deadExports||[]);for(let o of t.symbols.functions)e.run(i,[t.id,o.name,o.type||"function",o.returnType||"",o.params||"",o.line||0,r.has(o.name)?1:0,o.visibility||"public",o.isStatic?1:0,o.isAsync?1:0]);for(let o of t.symbols.methods||[])e.run(i,[t.id,o.name,o.type||"method",o.returnType||"",o.params||"",o.line||0,r.has(o.name)?1:0,o.visibility||"public",o.isStatic?1:0,o.isAsync?1:0]);for(let o of t.symbols.structs)e.run(i,[t.id,o.name,o.type||"struct","","",0,0,"public",0,0]);for(let o of t.symbols.enums)e.run(i,[t.id,o.name,o.type||"enum","","",0,0,"public",0,0]);for(let o of t.symbols.macros)e.run(i,[t.id,o.name,o.type||"macro","","",0,0,"public",0,0]);for(let o of t.symbols.classes)e.run(i,[t.id,o.name,o.type||"class","","",0,r.has(o.name)?1:0,"public",0,0]);for(let o of t.symbols.exports)e.run(i,[t.id,o.name,o.type||"export","","",0,r.has(o.name)?1:0,"public",0,0]);for(let o of t.symbols.interfaces||[])e.run(i,[t.id,o.name,o.type||"interface","","",o.line||0,0,o.visibility||"public",0,0]);for(let o of t.symbols.traits||[])e.run(i,[t.id,o.name,o.type||"trait","","",o.line||0,0,o.visibility||"public",0,0]);for(let o of t.symbols.typeAliases||[])e.run(i,[t.id,o.name,o.type||"type_alias","","",o.line||0,0,o.visibility||"public",0,0])}if(s.meta.cycles)for(let t=0;t<s.meta.cycles.length;t++){let r=s.meta.cycles[t];for(let o=0;o<r.length;o++)e.run("INSERT INTO cycles (cycle_id, node_id, position) VALUES (?, ?, ?)",[t,r[o],o])}let n=[["projectName",s.meta.projectName],["analyzedAt",s.meta.analyzedAt],["totalFiles",String(s.meta.totalFiles)],["totalLinks",String(s.meta.totalLinks)],["totalRelationsFound",String(s.meta.totalRelationsFound)],["functionCallLinks",String(s.meta.functionCallLinks)],["unresolvedReferences",String(s.meta.unresolvedReferences)],["deadCodeFiles",String(s.meta.deadCodeFiles)],["deadExportsTotal",String(s.meta.deadExportsTotal)],["languageStats",JSON.stringify(s.meta.languageStats)],["groups",JSON.stringify(s.meta.groups)]];for(let[t,r]of n)e.run("INSERT INTO meta (key, value) VALUES (?, ?)",[t,r]);e.run("COMMIT")}catch(i){throw e.run("ROLLBACK"),i}this.save()}getDependencies(s,e=5){return C(this.ensureDb(),`
            WITH RECURSIVE deps(id, depth) AS (
                SELECT target, 1 FROM edges WHERE source = ?
                UNION
                SELECT e.target, d.depth + 1
                FROM edges e JOIN deps d ON e.source = d.id
                WHERE d.depth < ?
            )
            SELECT id, MIN(depth) AS depth FROM deps GROUP BY id ORDER BY depth
        `,[s,e])}getDependents(s,e=5){return C(this.ensureDb(),`
            WITH RECURSIVE deps(id, depth) AS (
                SELECT source, 1 FROM edges WHERE target = ?
                UNION
                SELECT e.source, d.depth + 1
                FROM edges e JOIN deps d ON e.target = d.id
                WHERE d.depth < ?
            )
            SELECT id, MIN(depth) AS depth FROM deps GROUP BY id ORDER BY depth
        `,[s,e])}findPath(s,e,i=20){let n=C(this.ensureDb(),`
            WITH RECURSIVE path(id, route, depth) AS (
                SELECT ?, ?, 0
                UNION
                SELECT e.target, p.route || '|' || e.target, p.depth + 1
                FROM edges e JOIN path p ON e.source = p.id
                WHERE p.depth < ? AND INSTR(p.route, e.target) = 0
            )
            SELECT route FROM path WHERE id = ? ORDER BY depth LIMIT 1
        `,[s,s,i,e]);return n.length===0?null:n[0].route.split("|")}getHotspots(s=20,e="impact"){let i=e==="complexity"?"complexity DESC":e==="fan_in"?"fan_in DESC":e==="lines"?"lines DESC":"(complexity * (fan_in + 1)) DESC";return C(this.ensureDb(),`SELECT *, (complexity * (fan_in + 1)) AS impact_score FROM nodes ORDER BY ${i} LIMIT ?`,[s])}getDeadCode(){return C(this.ensureDb(),"SELECT node_id AS nodeId, name AS symbol, kind FROM symbols WHERE is_dead = 1 ORDER BY node_id")}getCycles(){let s=C(this.ensureDb(),"SELECT cycle_id, node_id FROM cycles ORDER BY cycle_id, position"),e=[],i=[],n=-1;for(let t of s)t.cycle_id!==n&&(i.length>0&&e.push(i),i=[],n=t.cycle_id),i.push(t.node_id);return i.length>0&&e.push(i),e}getNodeDetail(s){let e=this.ensureDb(),i=Fe(e,"SELECT * FROM nodes WHERE id = ?",[s]);if(!i)return null;let n=C(e,"SELECT * FROM symbols WHERE node_id = ?",[s]),t=C(e,"SELECT target FROM edges WHERE source = ?",[s]),r=C(e,"SELECT source FROM edges WHERE target = ?",[s]);return{...i,symbols:n,dependencies:t.map(o=>o.target),dependents:r.map(o=>o.source)}}getArchitectureOverview(){return C(this.ensureDb(),`
            SELECT language,
                   COUNT(*) AS count,
                   SUM(lines) AS total_loc,
                   ROUND(AVG(complexity), 1) AS avg_complexity
            FROM nodes GROUP BY language ORDER BY count DESC
        `)}searchSymbols(s,e){let i=this.ensureDb(),n="SELECT node_id AS nodeId, name, kind, line, visibility, is_static AS isStatic, is_async AS isAsync FROM symbols WHERE name LIKE ?"+(e?" AND kind = ?":"")+" ORDER BY name LIMIT 100",t=e?[`%${s}%`,e]:[`%${s}%`];return C(i,n,t).map(o=>({...o,isStatic:!!o.isStatic,isAsync:!!o.isAsync,visibility:o.visibility||"public"}))}getHeritage(s){let e=this.ensureDb();return s?C(e,"SELECT * FROM edges WHERE type IN ('extends', 'implements') AND (source = ? OR target = ?) ORDER BY source, type",[s,s]):C(e,"SELECT * FROM edges WHERE type IN ('extends', 'implements') ORDER BY source, type")}getAllNodes(){return C(this.ensureDb(),"SELECT * FROM nodes ORDER BY id")}getAllEdges(){return C(this.ensureDb(),"SELECT * FROM edges ORDER BY source, target")}getMeta(s){return Fe(this.ensureDb(),"SELECT value FROM meta WHERE key = ?",[s])?.value??null}getAllMeta(){let s=C(this.ensureDb(),"SELECT key, value FROM meta"),e={};for(let i of s)e[i.key]=i.value;return e}migrateSchema(){let s=this.ensureDb(),e=C(s,"PRAGMA table_info('symbols')").map(n=>n.name),i=[["visibility","ALTER TABLE symbols ADD COLUMN visibility TEXT DEFAULT 'public'"],["is_static","ALTER TABLE symbols ADD COLUMN is_static INTEGER DEFAULT 0"],["is_async","ALTER TABLE symbols ADD COLUMN is_async INTEGER DEFAULT 0"]];for(let[n,t]of i)e.includes(n)||s.run(t)}ensureDb(){if(!this.db)throw new Error("GraphDB is not open");return this.db}};var b,S,M=[],A,Le,H,D,J,le,re=!1,j;function Mt(a){le=new Q;let s=m.window.createTreeView("auraVisualizer.statsView",{treeDataProvider:le,showCollapseAll:!0});a.subscriptions.push(s),D=m.window.createStatusBarItem(m.StatusBarAlignment.Left,50),D.command="auraVisualizer.open",D.text="$(eye) Aura",D.tooltip="Open Aura 3D Visualizer",D.show(),a.subscriptions.push(D),a.subscriptions.push(m.commands.registerCommand("auraVisualizer.open",()=>Pt(a)),m.commands.registerCommand("auraVisualizer.refresh",()=>ce(a)),m.commands.registerCommand("auraVisualizer.focusFile",()=>Bt()),m.commands.registerCommand("auraVisualizer.openFileFromTree",e=>{let i=m.workspace.workspaceFolders?.[0];if(!i)return;let n=x.join(i.uri.fsPath,e);m.window.showTextDocument(m.Uri.file(n),{preview:!0})}),m.commands.registerCommand("auraVisualizer.exportGraph",()=>Wt())),Xt(a),a.subscriptions.push(m.window.onDidChangeActiveTextEditor(e=>{if(e&&b?.isVisible){let i=m.workspace.workspaceFolders?.[0];if(i){let n=x.relative(i.uri.fsPath,e.document.uri.fsPath);n.startsWith("..")||b.focusNode(n)}}})),a.subscriptions.push(m.window.onDidChangeActiveColorTheme(e=>{b?.sendTheme(e.kind)})),m.window.registerWebviewPanelSerializer(z.viewType,{async deserializeWebviewPanel(e){b||(b=new z(a.extensionUri),ke()),b.restore(e),S&&b.sendGraphData(S)}}),m.workspace.workspaceFolders?.length&&ce(a)}function ke(){b&&b.onOpenFile(async({path:a,line:s})=>{let e=m.workspace.workspaceFolders?.[0];if(!e)return;let i=x.join(e.uri.fsPath,a),n=m.Uri.file(i);try{let t=await m.workspace.openTextDocument(n),r=await m.window.showTextDocument(t,{preserveFocus:!1});if(s&&s>0){let o=new m.Position(s-1,0);r.selection=new m.Selection(o,o),r.revealRange(new m.Range(o,o),m.TextEditorRevealType.InCenter)}}catch{}})}async function Pt(a){b||(b=new z(a.extensionUri),ke()),b.show(),S?b.sendGraphData(S):await ce(a)}async function ce(a){if(re)return;re=!0;let s=m.workspace.workspaceFolders?.[0];if(!s){re=!1,m.window.showWarningMessage("Aura: No workspace folder open.");return}let e=s.uri.fsPath,n=m.workspace.getConfiguration("auraVisualizer").get("excludePaths",["node_modules",".git","dist","build","out","__pycache__"]);D&&(D.text="$(loading~spin) Aura: Analyzing...");try{let t=await m.window.withProgress({location:m.ProgressLocation.Window,title:"Aura: Analyzing codebase..."},()=>$t(a.extensionUri,e,n,s.name));S=t.graphData,M=t.files,b&&b.sendGraphData(S),le?.update(S),Me();try{if(!j){j=new oe;let r=x.join(e,".aura");await N.mkdir(r,{recursive:!0}),await j.open(x.join(r,"graph.db"))}j.importGraphData(S),await Ut(a,e)}catch(r){console.error("[aura] GraphDB import error:",r)}zt(a,e,n)}catch(t){let r=t instanceof Error?t.message:String(t);m.window.showErrorMessage(`Aura: Analysis failed \u2014 ${r}`),D&&(D.text="$(eye) Aura")}finally{re=!1}}async function Ut(a,s){let e=x.join(s,".vscode"),i=x.join(e,"mcp.json"),n=x.join(a.extensionUri.fsPath,"out","mcp-server.js"),t=x.join(s,".aura","graph.db"),r={};try{let o=await N.readFile(i,"utf-8");r=JSON.parse(o)}catch{}r.servers&&r.servers.aura||(r.servers=r.servers||{},r.servers.aura={command:"node",args:[n],env:{AURA_DB_PATH:t}},await N.mkdir(e,{recursive:!0}),await N.writeFile(i,JSON.stringify(r,null,4)+`
`,"utf-8"),console.log("[aura] MCP server registered in .vscode/mcp.json"))}function $t(a,s,e,i){return new Promise((n,t)=>{let r=x.join(a.fsPath,"out","analyzer-worker.js"),o=new fe.Worker(r,{workerData:{rootPath:s,skipDirs:e,projectName:i}});o.on("message",d=>{d.error?t(new Error(d.error)):n({graphData:d.graphData,files:d.files}),o.terminate()}),o.on("error",d=>{t(d),o.terminate()}),o.on("exit",d=>{d!==0&&t(new Error(`Worker exited with code ${d}`))})})}async function Gt(a,s){let e=m.workspace.workspaceFolders?.[0];if(!e||M.length===0)return;let i=e.uri.fsPath,n=x.relative(i,a.fsPath);if(n.startsWith(".."))return;if(s)M=M.filter(o=>o.id!==n);else{let o=await de(a.fsPath,i);if(!o)return;let d=M.findIndex(g=>g.id===n);d>=0?M[d]=o:M.push(o)}let t=S,r=e.name;if(S=me(M,r),b?.isVisible&&S)if(t){let o=jt(t,S,n,s);b.sendGraphDelta(o)}else b.sendGraphData(S);le?.update(S),Me()}function jt(a,s,e,i){let n={changedNodes:[],removedNodeIds:[],addedLinks:[],removedLinks:[],meta:s.meta};i&&n.removedNodeIds.push(e);let t=new Map(a.nodes.map(c=>[c.id,c])),r=new Map(s.nodes.map(c=>[c.id,c]));for(let c of s.nodes){let h=t.get(c.id);(!h||c.fanIn!==h.fanIn||c.fanOut!==h.fanOut||c.complexity!==h.complexity||c.linesOfCode!==h.linesOfCode||c.size!==h.size)&&n.changedNodes.push(c)}for(let c of a.nodes)r.has(c.id)||n.removedNodeIds.includes(c.id)||n.removedNodeIds.push(c.id);let o=c=>`${typeof c.source=="object"?c.source.id:c.source}|${typeof c.target=="object"?c.target.id:c.target}|${c.type}`,d=new Set(a.links.map(o)),g=new Set(s.links.map(o));for(let c of s.links)d.has(o(c))||n.addedLinks.push(c);for(let c of a.links)g.has(o(c))||n.removedLinks.push({source:typeof c.source=="object"?c.source.id:c.source,target:typeof c.target=="object"?c.target.id:c.target,type:c.type});return n}function Me(){if(!D||!S)return;let{totalFiles:a,totalLinks:s}=S.meta;D.text=`$(eye) Aura: ${a} files, ${s} links`,D.tooltip=`Aura \u2014 ${a} files, ${s} dependencies
Click to open 3D visualizer`}async function zt(a,s,e){if(!await ge(s))return;A&&(A.terminate(),A=void 0);let n=x.join(s,".aura","history"),t=x.join(a.extensionUri.fsPath,"out","history-worker.js");A=new fe.Worker(t,{workerData:{rootPath:s,skipDirs:e,historyDir:n}}),A.on("message",r=>{switch(r.type){case"index":Le=r.payload,b&&b.sendHistoryIndex(Le);break;case"progress":{let o=r.payload;b&&b.sendHistoryProgress(o.scanned,o.total);break}case"delta":{let o=r.payload;b&&b.sendHistoryDelta(o);break}case"done":break;case"error":break}}),A.on("error",()=>{}),A.on("exit",()=>{A=void 0})}function Bt(){let a=m.window.activeTextEditor;if(!a||!b?.isVisible)return;let s=m.workspace.workspaceFolders?.[0];if(!s)return;let e=x.relative(s.uri.fsPath,a.document.uri.fsPath);e.startsWith("..")||b.focusNode(e)}async function Wt(){let a=m.workspace.workspaceFolders?.[0];if(!a){m.window.showWarningMessage("Aura: No workspace folder open.");return}if(!S){m.window.showWarningMessage("Aura: No graph data. Run analysis first (Ctrl+Shift+A).");return}let s=x.join(a.uri.fsPath,".aura");await N.mkdir(s,{recursive:!0});let e=S,i={meta:e.meta,nodes:e.nodes.map(t=>({id:t.id,name:t.name,path:t.path,language:t.language,extension:t.extension,size:t.size,linesOfCode:t.linesOfCode,group:t.group,fanIn:t.fanIn,fanOut:t.fanOut,complexity:t.complexity})),links:e.links.map(t=>({source:t.source,target:t.target,type:t.type,label:t.label}))};await N.writeFile(x.join(s,"graph.json"),JSON.stringify(i,null,2),"utf-8");let n=Ht(e);await N.writeFile(x.join(s,"summary.md"),n,"utf-8"),m.window.showInformationMessage("Aura: Exported to .aura/ \u2014 graph.json + summary.md","Open summary").then(t=>{t==="Open summary"&&m.window.showTextDocument(m.Uri.file(x.join(s,"summary.md")),{preview:!0})})}function Ht(a){let{meta:s,nodes:e,links:i}=a,n=[];n.push(`# Aura Graph \u2014 ${s.projectName}`),n.push(`> Auto-generated by Aura Visualizer on ${s.analyzedAt}`),n.push("> This file describes the codebase architecture for AI-assisted development."),n.push(""),n.push("## Overview"),n.push(`- **${s.totalFiles}** files, **${s.totalLinks}** dependencies`);let t=Object.entries(s.languageStats).sort((p,w)=>w[1].count-p[1].count).map(([p,w])=>`${p} (${w.count} files, ${w.totalLOC} LOC)`);if(n.push(`- Languages: ${t.join(", ")}`),s.unresolvedReferences>0&&n.push(`- Unresolved references: ${s.unresolvedReferences}`),n.push(""),s.groups.length>0){n.push("## Directory Structure");for(let p of s.groups){let w=e.filter(L=>L.group===p),I=w.reduce((L,X)=>L+X.linesOfCode,0);n.push(`- \`${p}/\` \u2014 ${w.length} files, ${I} LOC`)}n.push("")}let r=[...e].sort((p,w)=>w.fanIn-p.fanIn).slice(0,15).filter(p=>p.fanIn>0);if(r.length>0){n.push("## Hotspots (most depended-on files)"),n.push("| File | Fan-in | Fan-out | Complexity | LOC |"),n.push("|------|--------|---------|------------|-----|");for(let p of r)n.push(`| \`${p.id}\` | ${p.fanIn} | ${p.fanOut} | ${p.complexity} | ${p.linesOfCode} |`);n.push("")}let o=[...e].sort((p,w)=>w.complexity-p.complexity).slice(0,10).filter(p=>p.complexity>1);if(o.length>0){n.push("## Most Complex Files"),n.push("| File | Complexity | LOC | Fan-in | Fan-out |"),n.push("|------|------------|-----|--------|---------|");for(let p of o)n.push(`| \`${p.id}\` | ${p.complexity} | ${p.linesOfCode} | ${p.fanIn} | ${p.fanOut} |`);n.push("")}let d=[...e].sort((p,w)=>w.linesOfCode-p.linesOfCode).slice(0,10);if(d.length>0){n.push("## Largest Files"),n.push("| File | LOC | Complexity | Language |"),n.push("|------|-----|------------|----------|");for(let p of d)n.push(`| \`${p.id}\` | ${p.linesOfCode} | ${p.complexity} | ${p.language} |`);n.push("")}let g=e.filter(p=>p.fanIn===0&&p.fanOut===0);if(g.length>0){n.push("## Orphan Files (no dependencies)");for(let p of g)n.push(`- \`${p.id}\` (${p.language}, ${p.linesOfCode} LOC)`);n.push("")}let c=[],h=new Set(i.map(p=>`${p.source}\u2192${p.target}`));for(let p of i){let w=`${p.target}\u2192${p.source}`;h.has(w)&&p.source<p.target&&c.push(`\`${p.source}\` \u2194 \`${p.target}\``)}if(c.length>0){n.push("## Circular Dependencies");for(let p of c)n.push(`- ${p}`);n.push("")}let y={};for(let p of i)y[p.type]=(y[p.type]||0)+1;if(Object.keys(y).length>0){n.push("## Dependency Types");for(let[p,w]of Object.entries(y).sort((I,L)=>L[1]-I[1]))n.push(`- **${p}**: ${w}`);n.push("")}return n.push("## Usage Notes for AI Agents"),n.push("- Files with high fan-in are **critical hubs** \u2014 changes impact many dependents."),n.push("- Check circular dependencies before refactoring \u2014 break cycles where possible."),n.push("- Orphan files may be dead code candidates for cleanup."),n.push("- Use `graph.json` for programmatic queries (e.g., find all dependents of a file)."),n.push("- High complexity files (>15) are prime candidates for decomposition."),n.push(""),n.join(`
`)}function Xt(a){if(!m.workspace.getConfiguration("auraVisualizer").get("autoRefresh",!0))return;H=m.workspace.createFileSystemWatcher("**/*.{c,h,js,ts,py,css,html}");let i=new Map,n=()=>{J&&clearTimeout(J),J=setTimeout(async()=>{let t=new Map(i);if(i.clear(),M.length===0){b?.isVisible?ce(a):S=void 0;return}for(let[,r]of t)await Gt(r.uri,r.deleted)},500)};H.onDidChange(t=>{i.set(t.fsPath,{uri:t,deleted:!1}),n()}),H.onDidCreate(t=>{i.set(t.fsPath,{uri:t,deleted:!1}),n()}),H.onDidDelete(t=>{i.set(t.fsPath,{uri:t,deleted:!0}),n()}),a.subscriptions.push(H)}function Yt(){b?.dispose(),H?.dispose(),J&&clearTimeout(J),A&&(A.terminate(),A=void 0),j&&(j.close(),j=void 0)}0&&(module.exports={activate,deactivate});
