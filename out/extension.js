"use strict";var Be=Object.create;var Z=Object.defineProperty;var He=Object.getOwnPropertyDescriptor;var Ve=Object.getOwnPropertyNames;var Xe=Object.getPrototypeOf,Ye=Object.prototype.hasOwnProperty;var Je=(r,s)=>{for(var t in s)Z(r,t,{get:s[t],enumerable:!0})},be=(r,s,t,i)=>{if(s&&typeof s=="object"||typeof s=="function")for(let e of Ve(s))!Ye.call(r,e)&&e!==t&&Z(r,e,{get:()=>s[e],enumerable:!(i=He(s,e))||i.enumerable});return r};var M=(r,s,t)=>(t=r!=null?Be(Xe(r)):{},be(s||!r||!r.__esModule?Z(t,"default",{value:r,enumerable:!0}):t,r)),qe=r=>be(Z({},"__esModule",{value:!0}),r);var Yt={};Je(Yt,{activate:()=>Pt,deactivate:()=>Xt});module.exports=qe(Yt);var u=M(require("vscode")),x=M(require("path")),k=M(require("fs/promises")),ge=require("worker_threads");var R=M(require("vscode")),ve=M(require("path")),z=class r{static viewType="auraVisualizer.graphView";panel;extensionUri;disposables=[];onOpenFileEmitter=new R.EventEmitter;onOpenFile=this.onOpenFileEmitter.event;onDisposeEmitter=new R.EventEmitter;onDidDispose=this.onDisposeEmitter.event;pendingData;webviewReady=!1;constructor(s){this.extensionUri=s}show(){return this.panel?(this.panel.reveal(R.ViewColumn.One),this.panel):(this.panel=R.window.createWebviewPanel(r.viewType,"Aura \u2014 3D Visualizer",R.ViewColumn.One,{enableScripts:!0,retainContextWhenHidden:!0,localResourceRoots:[R.Uri.joinPath(this.extensionUri,"out","webview")]}),this.initPanel(),this.panel)}restore(s){this.panel=s,s.webview.options={enableScripts:!0,localResourceRoots:[R.Uri.joinPath(this.extensionUri,"out","webview")]},this.initPanel()}initPanel(){this.panel&&(this.panel.iconPath=R.Uri.joinPath(this.extensionUri,"resources","icon.png"),this.panel.webview.html=this.getHtmlContent(this.panel.webview),this.setupMessageHandler(),this.panel.onDidDispose(()=>{this.panel=void 0,this.webviewReady=!1,this.disposables.forEach(s=>s.dispose()),this.disposables=[],this.onDisposeEmitter.fire()}))}setupMessageHandler(){this.panel&&this.panel.webview.onDidReceiveMessage(s=>{switch(s.type){case"ready":this.webviewReady=!0,this.pendingData&&this.panel?.webview.postMessage({type:"graphData",payload:this.pendingData});break;case"openFile":s.payload&&this.onOpenFileEmitter.fire({path:s.payload.path,line:s.payload.line});break;case"requestRefresh":R.commands.executeCommand("auraVisualizer.refresh");break;case"requestExport":R.commands.executeCommand("auraVisualizer.exportGraph");break}},null,this.disposables)}sendGraphData(s){this.pendingData=s,this.webviewReady&&this.panel?.webview.postMessage({type:"graphData",payload:s})}sendGraphDelta(s){this.webviewReady&&this.panel?.webview.postMessage({type:"updateGraph",payload:s})}focusNode(s){this.panel?.webview.postMessage({type:"focusNode",payload:{nodeId:s}})}sendTheme(s){this.panel?.webview.postMessage({type:"themeChanged",payload:{kind:s}})}sendHistoryIndex(s){this.webviewReady&&this.panel?.webview.postMessage({type:"historyIndex",payload:s})}sendHistoryProgress(s,t){this.webviewReady&&this.panel?.webview.postMessage({type:"historyProgress",payload:{scanned:s,total:t}})}sendHistoryDelta(s){this.webviewReady&&this.panel?.webview.postMessage({type:"historyDelta",payload:s})}get isVisible(){return this.panel?.visible??!1}dispose(){this.panel?.dispose()}getHtmlContent(s){let t=ve.join("out","webview"),i=s.asWebviewUri(R.Uri.joinPath(this.extensionUri,t,"css","style.css")),e=s.asWebviewUri(R.Uri.joinPath(this.extensionUri,t,"js","app.js")),n=s.asWebviewUri(R.Uri.joinPath(this.extensionUri,t,"js","graph-config.js")),o=s.asWebviewUri(R.Uri.joinPath(this.extensionUri,t,"lib","3d-force-graph.min.js")),p=s.asWebviewUri(R.Uri.joinPath(this.extensionUri,t,"lib","three.global.js")),d=Ke();return`<!DOCTYPE html>
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
    <script nonce="${d}" src="${p}"></script>
    <script nonce="${d}" src="${o}"></script>
    <!-- App Logic -->
    <script nonce="${d}" src="${n}"></script>
    <script nonce="${d}" src="${e}"></script>
</body>
</html>`}};function Ke(){let r=new Uint8Array(16);return require("crypto").randomFillSync(r),Array.from(r,s=>s.toString(16).padStart(2,"0")).join("")}var T=M(require("vscode")),D=class extends T.TreeItem{constructor(t,i){let e=t.kind==="file"?t.node.name:t.kind==="stat"?`${t.label}: ${t.value}`:t.label;super(e,i);this.entry=t;t.kind==="header"?this.iconPath=new T.ThemeIcon(t.icon):t.kind==="stat"?this.iconPath=new T.ThemeIcon(t.icon):t.kind==="file"&&(this.description=t.metric,this.iconPath=new T.ThemeIcon("file"),this.command={command:"auraVisualizer.openFileFromTree",title:"Open File",arguments:[t.node.path]},this.tooltip=`${t.node.path}
Complexity: ${t.node.complexity}
Lines: ${t.node.linesOfCode}
Fan-in: ${t.node.fanIn} / Fan-out: ${t.node.fanOut}`)}},Q=class{_onDidChangeTreeData=new T.EventEmitter;onDidChangeTreeData=this._onDidChangeTreeData.event;data;update(s){this.data=s,this._onDidChangeTreeData.fire(void 0)}getTreeItem(s){return s}getChildren(s){if(!this.data)return[new D({kind:"stat",label:"No data",value:"Open a workspace and run Aura",icon:"info"},T.TreeItemCollapsibleState.None)];if(!s)return[new D({kind:"header",label:"Stats",icon:"graph"},T.TreeItemCollapsibleState.Expanded),new D({kind:"header",label:"Most Complex",icon:"flame"},T.TreeItemCollapsibleState.Collapsed),new D({kind:"header",label:"Largest Files",icon:"file-binary"},T.TreeItemCollapsibleState.Collapsed),new D({kind:"header",label:"Orphan Files",icon:"warning"},T.TreeItemCollapsibleState.Collapsed)];if(s.entry.kind!=="header")return[];let t=this.data;switch(s.entry.label){case"Stats":{let i=Object.entries(t.meta.languageStats).map(([e,n])=>`${e}: ${n.count}`).join(", ");return[this.stat("Files",String(t.meta.totalFiles),"file"),this.stat("Links",String(t.meta.totalLinks),"link"),this.stat("Function Calls",String(t.meta.functionCallLinks),"symbol-method"),this.stat("Groups",String(t.meta.groups.length),"folder"),this.stat("Languages",i,"symbol-color")]}case"Most Complex":return[...t.nodes].sort((i,e)=>e.complexity-i.complexity).slice(0,10).map(i=>new D({kind:"file",node:i,metric:`complexity: ${i.complexity}`},T.TreeItemCollapsibleState.None));case"Largest Files":return[...t.nodes].sort((i,e)=>e.linesOfCode-i.linesOfCode).slice(0,10).map(i=>new D({kind:"file",node:i,metric:`${i.linesOfCode} lines`},T.TreeItemCollapsibleState.None));case"Orphan Files":return t.nodes.filter(i=>i.fanIn===0&&i.fanOut===0).map(i=>new D({kind:"file",node:i,metric:i.language},T.TreeItemCollapsibleState.None));default:return[]}}stat(s,t,i){return new D({kind:"stat",label:s,value:t,icon:i},T.TreeItemCollapsibleState.None)}};var Y=require("fs/promises"),J=require("path"),Ze=new Set([".c",".h",".js",".ts",".py",".css",".html",".htm"]),Qe={".c":"c",".h":"c",".js":"javascript",".ts":"typescript",".py":"python",".css":"css",".html":"html",".htm":"html"};async function de(r,s){let t=(0,J.extname)(r).toLowerCase();if(!Ze.has(t))return null;try{let i=await(0,Y.stat)(r),e=await(0,Y.readFile)(r,"utf-8"),n=e.split(`
`).filter(l=>l.trim().length>0).length,o=(0,J.relative)(s,r),p=o.split("/"),d=p.length>1?p[0]:"/",m=p[p.length-1];return{id:o,name:m,path:o,fullPath:r,language:Qe[t]||"unknown",extension:t,size:i.size,linesOfCode:n,lastModified:Math.floor(i.mtimeMs),group:d,content:e}}catch{return null}}var A=require("path");var _=class{language;constructor(s){this.language=s}get usesTreeSitter(){return!1}parse(s,t){return[]}parseAST(s,t,i){return this.parse(t,i)}extractSymbolsAST(s,t){return{functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[]}}extractCallsAST(s,t,i){return[]}extractMatches(s,t,i,e,n){let o=[],p;for(;(p=t.exec(s))!==null;){let d=p[1];d&&o.push({source:e,target:d,type:i,label:n?n(p):`${i}: ${d}`})}return o}};var et=/#include\s*"([^"]+)"/g,tt=/#include\s*<([^>]+)>/g,st=/^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?((?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+)([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/gm,nt=/extern\s+[\w\s*]+\s+(\w+)\s*\([^)]*\)\s*;/g,it=/(?:typedef\s+)?struct\s+(\w+)\s*\{/g,ot=/typedef\s+struct\s*(?:\w+\s*)?\{[^}]*\}\s*(\w+)\s*;/gs,rt=/(?:typedef\s+)?enum\s+(\w+)\s*\{/g,at=/^[ \t]*#define\s+(\w+)(?:\(([^)]*)\))?/gm,Ee=new Set(["if","else","for","while","do","switch","case","return","break","continue","goto","sizeof","typeof","typedef","struct","union","enum","static","extern","inline","const","volatile","register","auto","void","int","char","float","double","long","short","unsigned","signed","bool","BOOL","printf","fprintf","sprintf","snprintf","scanf","sscanf","malloc","calloc","realloc","free","memcpy","memset","memmove","strlen","strcpy","strncpy","strcmp","strncmp","strcat","fopen","fclose","fread","fwrite","fseek","ftell","exit","abort","assert","NULL","true","false","defined","offsetof","va_start","va_end","va_arg","__attribute__","__declspec","visibility","__extension__"]),ee=class extends _{constructor(){super("c")}parse(s,t={}){let{content:i,id:e}=s,n=[];return n.push(...this.extractMatches(i,new RegExp(et.source,"g"),"include",e,o=>`#include "${o[1]}"`)),t.includeSystemHeaders&&n.push(...this.extractMatches(i,new RegExp(tt.source,"g"),"system-include",e,o=>`#include <${o[1]}>`)),n}extractSymbols(s){let{content:t}=s,i={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[]},e=this.stripComments(t),n,o=new RegExp(st.source,"gm");for(;(n=o.exec(e))!==null;){let h=(n[1]||"").trim(),c=n[2],w=(n[3]||"").trim();if(!Ee.has(c)){let C=e.substring(0,n.index).split(`
`).length;i.functions.push({name:c,returnType:h,params:w,line:C,type:"function"})}}let p=new RegExp(nt.source,"g");for(;(n=p.exec(e))!==null;)i.externs.push({name:n[1],type:"extern"});let d=new RegExp(it.source,"g");for(;(n=d.exec(e))!==null;)i.structs.push({name:n[1],type:"struct"});let m=new RegExp(ot.source,"gs");for(;(n=m.exec(e))!==null;)i.structs.push({name:n[1],type:"typedef-struct"});let l=new RegExp(rt.source,"g");for(;(n=l.exec(e))!==null;)i.enums.push({name:n[1],type:"enum"});let g=new RegExp(at.source,"gm");for(;(n=g.exec(e))!==null;){let h=n[1],c=n[2]!==void 0;i.macros.push({name:h,type:c?"function-macro":"constant-macro"})}return i}extractCalls(s){let{content:t}=s,i=this.stripComments(t),e=new Set,n=/^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?(?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+([a-zA-Z_]\w*)\s*\([^)]*\)\s*\{/gm,o;for(;(o=n.exec(i))!==null;)e.add(o[1]);let p=new Set,d=/\b(\w+)\s*\(/g,m;for(;(m=d.exec(i))!==null;){let l=m[1];!Ee.has(l)&&!/^[A-Z_]+$/.test(l)&&!e.has(l)&&p.add(l)}return[...p]}stripComments(s){let t=s.replace(/\/\/.*$/gm,"");return t=t.replace(/\/\*[\s\S]*?\*\//g,""),t=t.replace(/"(?:[^"\\]|\\.)*"/g,'""'),t}};var lt=/import\s+(?:[\w{}\s,*]+\s+from\s+)?['"]([^'"]+)['"]/g,ct=/(?:^|[=(\s,])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,pt=/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,dt=/import\s*\(\s*`([^`$]+)/g,Re=/(?:^|[\s;{}])(?:async\s+)?function\s*\*?\s+(\w+)\s*\(/gm,xe=/(?:^|[\s;])(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*=>/gm;var ut=/(?:^|[\s;])class\s+(\w+)/gm,mt=/export\s+(?:(?:async\s+)?function\s*\*?\s+(\w+)|class\s+(\w+)|(?:const|let|var)\s+(\w+))/gm,ft=/export\s+default\s+(?:(?:async\s+)?function\s*\*?\s+(\w+)|class\s+(\w+)|(\w+))/gm,gt=/export\s*\{([^}]+)\}/g,W=new Set(["if","else","for","while","do","switch","case","return","break","continue","throw","try","catch","finally","new","delete","typeof","instanceof","void","in","of","this","super","with","yield","await","debugger","constructor","get","set","static","async","true","false","null","undefined","NaN","Infinity","console","window","document","global","process","require","module","exports","import","export","default","from"]),ht=new Set([...W,"parseInt","parseFloat","isNaN","isFinite","encodeURI","decodeURI","encodeURIComponent","decodeURIComponent","eval","JSON","Math","Object","Array","String","Number","Boolean","Date","RegExp","Error","TypeError","RangeError","SyntaxError","ReferenceError","Map","Set","WeakMap","WeakSet","Promise","Proxy","Reflect","Symbol","BigInt","ArrayBuffer","SharedArrayBuffer","DataView","Float32Array","Float64Array","Int8Array","Int16Array","Int32Array","Uint8Array","Uint16Array","Uint32Array","URL","URLSearchParams","setTimeout","setInterval","clearTimeout","clearInterval","requestAnimationFrame","cancelAnimationFrame","fetch","alert","confirm","prompt","addEventListener","removeEventListener","dispatchEvent","createElement","getElementById","querySelector","querySelectorAll","log","warn","error","info","debug","trace","dir","push","pop","shift","unshift","splice","slice","concat","map","filter","reduce","forEach","find","findIndex","some","every","includes","indexOf","join","sort","reverse","flat","flatMap","keys","values","entries","assign","freeze","seal","defineProperty","getOwnPropertyNames","hasOwnProperty","toString","valueOf","toJSON","then","catch","resolve","reject","all","allSettled","race","any","stringify","parse","replace","match","search","split","trim","startsWith","endsWith","charAt","charCodeAt","substring","repeat","padStart","padEnd","bind","call","apply","next","done","emit","on","once","off"]),B=class extends _{constructor(){super("javascript")}parse(s){let{content:t,id:i}=s,e=[];return e.push(...this.extractMatches(t,new RegExp(lt.source,"g"),"import",i,n=>`import from '${n[1]}'`)),e.push(...this.extractMatches(t,new RegExp(ct.source,"g"),"require",i,n=>`require('${n[1]}')`)),e.push(...this.extractMatches(t,new RegExp(pt.source,"g"),"dynamic-import",i,n=>`import('${n[1]}')`)),e.push(...this.extractMatches(t,new RegExp(dt.source,"g"),"dynamic-import",i,n=>`import('${n[1].split("?")[0]}')`).map(n=>({...n,target:n.target.split("?")[0]}))),e}extractSymbols(s){let{content:t}=s,i={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[]},e=this.stripCommentsAndStrings(t),n,o=new RegExp(Re.source,"gm");for(;(n=o.exec(e))!==null;){let h=n[1];if(!W.has(h)){let c=e.substring(0,n.index).split(`
`).length;i.functions.push({name:h,type:"function",line:c})}}let p=new RegExp(xe.source,"gm");for(;(n=p.exec(e))!==null;){let h=n[1];if(!W.has(h)){let c=e.substring(0,n.index).split(`
`).length;i.functions.some(w=>w.name===h)||i.functions.push({name:h,type:"arrow",line:c})}}let d=new RegExp(ut.source,"gm");for(;(n=d.exec(e))!==null;){let h=n[1],c=e.substring(0,n.index).split(`
`).length;i.classes.push({name:h,type:"class",line:c})}let m=new RegExp(mt.source,"gm");for(;(n=m.exec(e))!==null;){let h=n[1]||n[2]||n[3];if(h){let c=n[1]?"function":n[2]?"class":"variable";i.exports.push({name:h,type:`export-${c}`})}}let l=new RegExp(ft.source,"gm");for(;(n=l.exec(e))!==null;){let h=n[1]||n[2]||n[3];h&&!W.has(h)&&i.exports.push({name:h,type:"export-default"})}let g=new RegExp(gt.source,"g");for(;(n=g.exec(e))!==null;){let h=n[1].split(",");for(let c of h){let C=c.trim().match(/^(\w+)(?:\s+as\s+\w+)?$/);C&&!W.has(C[1])&&i.exports.push({name:C[1],type:"export-named"})}}return i}extractCalls(s){let{content:t}=s,i=this.stripCommentsAndStrings(t),e=new Set,n,o=new RegExp(Re.source,"gm");for(;(n=o.exec(i))!==null;)e.add(n[1]);let p=new RegExp(xe.source,"gm");for(;(n=p.exec(i))!==null;)e.add(n[1]);let d=new Set,m=/(?:^|[^.\w])(\w+)\s*\(/g;for(;(n=m.exec(i))!==null;){let l=n[1];!ht.has(l)&&!W.has(l)&&!e.has(l)&&!/^[A-Z_]+$/.test(l)&&d.add(l)}return[...d]}stripCommentsAndStrings(s){let t=s.replace(/\/\/.*$/gm,"");return t=t.replace(/\/\*[\s\S]*?\*\//g,""),t=t.replace(/"(?:[^"\\]|\\.)*"/g,'""'),t=t.replace(/'(?:[^'\\]|\\.)*'/g,"''"),t=t.replace(/`(?:[^`\\]|\\.)*`/gs,"``"),t}};var yt=/<script[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,wt=/<link[^>]+href\s*=\s*['"]([^'"]+)['"]/gi,bt=/<img[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,te=class extends _{constructor(){super("html")}parse(s,t={}){let{content:i,id:e}=s,n=[];return n.push(...this.extractMatches(i,new RegExp(yt.source,"gi"),"script",e,o=>`<script src="${o[1]}">`)),n.push(...this.extractMatches(i,new RegExp(wt.source,"gi"),"stylesheet",e,o=>`<link href="${o[1]}">`)),t.includeAssets&&n.push(...this.extractMatches(i,new RegExp(bt.source,"gi"),"asset",e,o=>`<img src="${o[1]}">`)),n}};var vt=/@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"]\s*\)?/g,Et=/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/g,se=class extends _{constructor(){super("css")}parse(s,t={}){let{content:i,id:e}=s,n=[];if(n.push(...this.extractMatches(i,new RegExp(vt.source,"g"),"css-import",e,o=>`@import "${o[1]}"`)),t.includeUrls){let o=this.extractMatches(i,new RegExp(Et.source,"g"),"css-url",e,p=>`url("${p[1]}")`);n.push(...o.filter(p=>!p.target.startsWith("data:")&&!p.target.startsWith("http:")&&!p.target.startsWith("https:")&&!p.target.startsWith("#")))}return n}};var ne=class extends B{constructor(){super(),this.language="typescript"}};var Rt=/^import\s+([\w.]+)/gm,xt=/^from\s+([\w.]+)\s+import/gm,Se=/^[ \t]*def\s+(\w+)\s*\(/gm,Te=/^[ \t]*class\s+(\w+)\s*[:(]/gm,St=/__all__\s*=\s*\[([^\]]*)\]/gs,Tt=/^[ \t]*@(\w+)/gm,Ce=new Set(["print","len","range","int","str","float","list","dict","set","tuple","bool","type","isinstance","issubclass","hasattr","getattr","setattr","delattr","callable","super","property","staticmethod","classmethod","abs","all","any","bin","chr","dir","divmod","enumerate","eval","exec","filter","format","frozenset","globals","hash","hex","id","input","iter","locals","map","max","min","next","object","oct","open","ord","pow","repr","reversed","round","slice","sorted","sum","vars","zip","breakpoint","compile","complex","memoryview","bytearray","bytes","__import__","__name__","__file__","__doc__"]),ie=class extends _{constructor(){super("python")}parse(s){let{content:t,id:i}=s,e=[];return e.push(...this.extractMatches(t,new RegExp(Rt.source,"gm"),"import",i,n=>`import ${n[1]}`)),e.push(...this.extractMatches(t,new RegExp(xt.source,"gm"),"from-import",i,n=>`from ${n[1]} import`)),e}extractSymbols(s){let{content:t}=s,i={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[]},e=this.stripCommentsAndStrings(t),n,o=new RegExp(Se.source,"gm");for(;(n=o.exec(e))!==null;){let g=n[1],h=e.substring(0,n.index).split(`
`).length,c=g.startsWith("__")&&g.endsWith("__");i.functions.push({name:g,type:c?"dunder":"function",line:h})}let p=new RegExp(Te.source,"gm");for(;(n=p.exec(e))!==null;){let g=n[1],h=e.substring(0,n.index).split(`
`).length;i.classes.push({name:g,type:"class",line:h})}let d=new RegExp(St.source,"gs");for(;(n=d.exec(e))!==null;){let g=n[1].split(",");for(let h of g){let c=h.trim().match(/['"](\w+)['"]/);c&&i.exports.push({name:c[1],type:"export-all"})}}let m=new RegExp(Tt.source,"gm"),l=new Set;for(;(n=m.exec(e))!==null;){let g=n[1];if(!l.has(g)&&!Ce.has(g)){l.add(g);let h=e.substring(0,n.index).split(`
`).length;i.macros.push({name:g,type:"decorator",line:h})}}return i}extractCalls(s){let{content:t}=s,i=this.stripCommentsAndStrings(t),e=new Set,n,o=new RegExp(Se.source,"gm");for(;(n=o.exec(i))!==null;)e.add(n[1]);let p=new RegExp(Te.source,"gm");for(;(n=p.exec(i))!==null;)e.add(n[1]);let d=new Set,m=/(?:^|[^.\w])(\w+)\s*\(/g;for(;(n=m.exec(i))!==null;){let l=n[1];!Ce.has(l)&&!e.has(l)&&!/^[A-Z_]+$/.test(l)&&l!=="def"&&l!=="class"&&l!=="if"&&l!=="for"&&l!=="while"&&l!=="return"&&l!=="elif"&&l!=="assert"&&l!=="raise"&&l!=="yield"&&l!=="lambda"&&l!=="not"&&l!=="and"&&l!=="or"&&d.add(l)}return[...d]}stripCommentsAndStrings(s){let t=s.replace(/"""[\s\S]*?"""/g,'""');return t=t.replace(/'''[\s\S]*?'''/g,"''"),t=t.replace(/"(?:[^"\\]|\\.)*"/g,'""'),t=t.replace(/'(?:[^'\\]|\\.)*'/g,"''"),t=t.replace(/#.*$/gm,""),t}};var Ct=/\b(if|else\s+if|for|while|do|switch|case|catch)\b/g,It=/(\|\||&&)/g,Ot=/[^?]\?[^?:]/g,_t=/[^{}]+(?=\s*\{)/g,Dt=/@media\b/g;function Ie(r){let{content:s,language:t}=r;switch(t){case"c":case"javascript":case"typescript":return Oe(s);case"css":return Ft(s);case"html":return Nt(s);default:return{complexity:1,details:{}}}}function Oe(r){let s=r.replace(/\/\/.*$/gm,"").replace(/\/\*[\s\S]*?\*\//g,"").replace(/"(?:[^"\\]|\\.)*"/g,'""').replace(/'(?:[^'\\]|\\.)*'/g,"''"),t=1,i={},e={},n=new RegExp(Ct.source,"g"),o;for(;(o=n.exec(s))!==null;){let g=o[1].replace(/\s+/g," ");e[g]=(e[g]||0)+1,t++}i.keywords=e;let p=new RegExp(It.source,"g"),d=0;for(;(o=p.exec(s))!==null;)d++,t++;i.logicalOperators=d;let m=new RegExp(Ot.source,"g"),l=0;for(;(o=m.exec(s))!==null;)l++,t++;return i.ternaryOperators=l,{complexity:t,details:i}}function Ft(r){let s=r.replace(/\/\*[\s\S]*?\*\//g,""),t=0,i=new RegExp(_t.source,"g"),e;for(;(e=i.exec(s))!==null;){let d=e[0].split(",").filter(m=>m.trim().length>0);t+=d.length}let n=0,o=new RegExp(Dt.source,"g");for(;(e=o.exec(s))!==null;)n++;return{complexity:Math.max(1,Math.round(1+t/10+n)),details:{selectors:t,mediaQueries:n}}}function Nt(r){let s=/\bon\w+\s*=/gi,t=0,i;for(;(i=s.exec(r))!==null;)t++;let e=/<script\b[^>]*>[\s\S]*?<\/script>/gi,n=0,o=0;for(;(i=e.exec(r))!==null;){n++;let d=Oe(i[0]);o+=d.complexity-1}return{complexity:Math.max(1,1+t+o),details:{eventHandlers:t,scriptBlocks:n,inlineJSComplexity:o}}}var ue={c:new ee,javascript:new B,typescript:new ne,python:new ie,html:new te,css:new se};function kt(r,s,t){if(t.has(r))return r;let i=(0,A.dirname)(s),e=(0,A.normalize)((0,A.join)(i,r));if(t.has(e))return e;let n=[".js",".ts",".py",".c",".h",".css",".html"];for(let d of n){if(t.has(e+d))return e+d;if(t.has(r+d))return r+d}let o=(0,A.join)(e,"index.js");if(t.has(o))return o;let p=(0,A.basename)(r);for(let[d,m]of t)if(m.name===p)return d;for(let d of n){let m=p+d;for(let[l,g]of t)if(g.name===m)return l}return null}function Lt(r){let s=new Map;for(let m of r)s.has(m.source)||s.set(m.source,[]),s.get(m.source).push(m.target);let t=[],i=new Set,e=new Set,n=[];function o(m){i.add(m),e.add(m),n.push(m);let l=s.get(m)||[];for(let g of l)if(e.has(g)){let h=n.indexOf(g);if(h>=0){let c=n.slice(h);c.length>=2&&t.push(c)}}else i.has(g)||o(g);n.pop(),e.delete(m)}for(let m of s.keys())i.has(m)||o(m);let p=[],d=new Set;for(let m of t){let g=[...m].sort().join("|");d.has(g)||(d.add(g),p.push(m))}return p}function me(r,s="Project",t={}){let i=new Map;for(let a of r)i.set(a.id,a);let e=[];for(let a of r){let f=ue[a.language];if(f){let b=f.parse(a,t);e.push(...b)}}let n=new Map,o={c:"c",javascript:"js",typescript:"js",python:"py"},p=new Map,d=new Set(["c","javascript","typescript","python"]);for(let a of r){if(!d.has(a.language))continue;let f=ue[a.language];if(!f.extractSymbols)continue;let b=f.extractSymbols(a);n.set(a.id,b);let E=o[a.language]||a.language;for(let G of b.functions){let v=`${E}:${G.name}`;p.has(v)||p.set(v,[]),p.get(v).push(a.id)}}let m=[],l=new Set([".h",".hpp",".d.ts"]);for(let a of r){if(!d.has(a.language)||l.has(a.extension))continue;let f=ue[a.language];if(!f.extractCalls)continue;let b=f.extractCalls(a),E=n.get(a.id),G=new Set(E?E.functions.map(X=>X.name):[]),v=o[a.language]||a.language;for(let X of b){if(G.has(X))continue;let We=`${v}:${X}`,ye=p.get(We);if(ye)for(let we of ye)we!==a.id&&m.push({source:a.id,target:we,type:"function-call",label:`${X}()`})}}let g=new Map;for(let a of r){let f=Ie(a);g.set(a.id,f)}let h=[],c={count:0,targets:[]};for(let a of e){let f=kt(a.target,a.source,i);f?f!==a.source&&h.push({source:a.source,target:f,type:a.type,label:a.label}):(c.count++,c.targets.length<20&&c.targets.push({from:a.source,ref:a.target}))}h.push(...m);let w=new Set,C=h.filter(a=>{let f=`${a.source}|${a.target}|${a.type}`;return w.has(f)?!1:(w.add(f),!0)}),L=new Map,V=new Map;for(let a of C)L.set(a.source,(L.get(a.source)||0)+1),V.set(a.target,(V.get(a.target)||0)+1);let K=new Set,Me=/(?:^|[^.\w])(\w+)\s*\(/gm;for(let a of r){let f,b=new RegExp(Me.source,"gm");for(;(f=b.exec(a.content))!==null;)K.add(f[1])}let he=new Map;for(let a of r){let f=n.get(a.id);if(!f)continue;let b=[];for(let E of f.functions)E.name!=="main"&&E.type!=="dunder"&&(K.has(E.name)||b.push(E.name));for(let E of f.classes)K.has(E.name)||b.push(E.name);for(let E of f.exports)!K.has(E.name)&&!b.includes(E.name)&&b.push(E.name);b.length>0&&he.set(a.id,b)}let $=r.map(a=>{let f=n.get(a.id),b=g.get(a.id)||{complexity:1,details:{}},E={id:a.id,name:a.name,path:a.path,language:a.language,extension:a.extension,size:a.size,linesOfCode:a.linesOfCode,lastModified:a.lastModified||0,group:a.group,fanOut:L.get(a.id)||0,fanIn:V.get(a.id)||0,complexity:b.complexity,complexityDetails:b.details};f&&(E.symbols={functions:f.functions.map(v=>({name:v.name,returnType:v.returnType||"",params:v.params||"",line:v.line||0,type:v.type})),structs:f.structs.map(v=>({name:v.name,type:v.type})),enums:f.enums.map(v=>({name:v.name,type:v.type})),macros:f.macros.slice(0,30),classes:f.classes.map(v=>({name:v.name,type:v.type})),exports:f.exports.map(v=>({name:v.name,type:v.type})),totalSymbols:f.functions.length+f.structs.length+f.enums.length+f.macros.length+f.classes.length+f.exports.length});let G=he.get(a.id);return G&&G.length>0&&(E.deadExports=G),E}),N={};for(let a of $)N[a.language]||(N[a.language]={count:0,totalLOC:0,avgComplexity:0}),N[a.language].count++,N[a.language].totalLOC+=a.linesOfCode,N[a.language].avgComplexity+=a.complexity;for(let a in N)N[a].avgComplexity=Math.round(N[a].avgComplexity/N[a].count*10)/10;let Ue=new Set($.map(a=>a.group)),$e=C.filter(a=>a.type==="function-call").length,Ge=$.filter(a=>a.deadExports&&a.deadExports.length>0).length,je=$.reduce((a,f)=>a+(f.deadExports?f.deadExports.length:0),0),pe=Lt(C),ze=new Map($.map(a=>[a.id,a]));for(let a=0;a<pe.length;a++)for(let f of pe[a]){let b=ze.get(f);b&&(b.cycleIds||(b.cycleIds=[]),b.cycleIds.push(a))}return{meta:{projectName:s,analyzedAt:new Date().toISOString(),totalFiles:$.length,totalLinks:C.length,totalRelationsFound:e.length,functionCallLinks:$e,unresolvedReferences:c.count,unresolvedSamples:c.targets,deadCodeFiles:Ge,deadExportsTotal:je,cycles:pe,languageStats:N,groups:[...Ue].sort()},nodes:$,links:C}}var _e=require("child_process"),De=require("util"),At=(0,De.promisify)(_e.execFile),Es=50*1024*1024;async function fe(r){try{return await At("git",["rev-parse","--is-inside-work-tree"],{cwd:r}),!0}catch{return!1}}var ke=M(require("sql.js")),U=require("fs"),re=require("path"),Fe=`
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
`;function I(r,s,t=[]){let i=r.prepare(s);i.bind(t);let e=[];for(;i.step();)e.push(i.getAsObject());return i.free(),e}function Ne(r,s,t=[]){let i=r.prepare(s);i.bind(t);let e;return i.step()&&(e=i.getAsObject()),i.free(),e}var oe=class{db=null;dbPath="";async open(s){let t=(0,re.join)((0,re.dirname)(require.resolve("sql.js")),"sql-wasm.wasm"),i=await(0,ke.default)({locateFile:()=>t});if(this.dbPath=s,(0,U.existsSync)(s)){let e=(0,U.readFileSync)(s);this.db=new i.Database(e)}else this.db=new i.Database;this.db.run(Fe)}openSync(s,t){if(this.dbPath=t,(0,U.existsSync)(t)){let i=(0,U.readFileSync)(t);this.db=new s.Database(i)}else this.db=new s.Database;this.db.run(Fe)}close(){this.db?.close(),this.db=null}get isOpen(){return this.db!==null}save(){if(!this.db||!this.dbPath)return;let s=this.db.export();(0,U.writeFileSync)(this.dbPath,Buffer.from(s))}importGraphData(s){let t=this.ensureDb();t.run("BEGIN TRANSACTION");try{t.run("DELETE FROM symbols"),t.run("DELETE FROM edges"),t.run("DELETE FROM cycles"),t.run("DELETE FROM nodes"),t.run("DELETE FROM meta");for(let e of s.nodes)t.run("INSERT INTO nodes (id, name, language, extension, group_name, size, lines, complexity, fan_in, fan_out, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",[e.id,e.name,e.language,e.extension,e.group,e.size,e.linesOfCode,e.complexity,e.fanIn,e.fanOut,e.lastModified]);for(let e of s.links){let n=typeof e.source=="object"?e.source.id:e.source,o=typeof e.target=="object"?e.target.id:e.target;t.run("INSERT OR IGNORE INTO edges (source, target, type, label) VALUES (?, ?, ?, ?)",[n,o,e.type,e.label||""])}for(let e of s.nodes){if(!e.symbols)continue;let n=new Set(e.deadExports||[]);for(let o of e.symbols.functions)t.run("INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead) VALUES (?, ?, ?, ?, ?, ?, ?)",[e.id,o.name,o.type||"function",o.returnType||"",o.params||"",o.line||0,n.has(o.name)?1:0]);for(let o of e.symbols.structs)t.run("INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead) VALUES (?, ?, ?, ?, ?, ?, ?)",[e.id,o.name,o.type||"struct","","",0,0]);for(let o of e.symbols.enums)t.run("INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead) VALUES (?, ?, ?, ?, ?, ?, ?)",[e.id,o.name,o.type||"enum","","",0,0]);for(let o of e.symbols.macros)t.run("INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead) VALUES (?, ?, ?, ?, ?, ?, ?)",[e.id,o.name,o.type||"macro","","",0,0]);for(let o of e.symbols.classes)t.run("INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead) VALUES (?, ?, ?, ?, ?, ?, ?)",[e.id,o.name,o.type||"class","","",0,n.has(o.name)?1:0]);for(let o of e.symbols.exports)t.run("INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead) VALUES (?, ?, ?, ?, ?, ?, ?)",[e.id,o.name,o.type||"export","","",0,n.has(o.name)?1:0])}if(s.meta.cycles)for(let e=0;e<s.meta.cycles.length;e++){let n=s.meta.cycles[e];for(let o=0;o<n.length;o++)t.run("INSERT INTO cycles (cycle_id, node_id, position) VALUES (?, ?, ?)",[e,n[o],o])}let i=[["projectName",s.meta.projectName],["analyzedAt",s.meta.analyzedAt],["totalFiles",String(s.meta.totalFiles)],["totalLinks",String(s.meta.totalLinks)],["totalRelationsFound",String(s.meta.totalRelationsFound)],["functionCallLinks",String(s.meta.functionCallLinks)],["unresolvedReferences",String(s.meta.unresolvedReferences)],["deadCodeFiles",String(s.meta.deadCodeFiles)],["deadExportsTotal",String(s.meta.deadExportsTotal)],["languageStats",JSON.stringify(s.meta.languageStats)],["groups",JSON.stringify(s.meta.groups)]];for(let[e,n]of i)t.run("INSERT INTO meta (key, value) VALUES (?, ?)",[e,n]);t.run("COMMIT")}catch(i){throw t.run("ROLLBACK"),i}this.save()}getDependencies(s,t=5){return I(this.ensureDb(),`
            WITH RECURSIVE deps(id, depth) AS (
                SELECT target, 1 FROM edges WHERE source = ?
                UNION
                SELECT e.target, d.depth + 1
                FROM edges e JOIN deps d ON e.source = d.id
                WHERE d.depth < ?
            )
            SELECT id, MIN(depth) AS depth FROM deps GROUP BY id ORDER BY depth
        `,[s,t])}getDependents(s,t=5){return I(this.ensureDb(),`
            WITH RECURSIVE deps(id, depth) AS (
                SELECT source, 1 FROM edges WHERE target = ?
                UNION
                SELECT e.source, d.depth + 1
                FROM edges e JOIN deps d ON e.target = d.id
                WHERE d.depth < ?
            )
            SELECT id, MIN(depth) AS depth FROM deps GROUP BY id ORDER BY depth
        `,[s,t])}findPath(s,t,i=20){let e=I(this.ensureDb(),`
            WITH RECURSIVE path(id, route, depth) AS (
                SELECT ?, ?, 0
                UNION
                SELECT e.target, p.route || '|' || e.target, p.depth + 1
                FROM edges e JOIN path p ON e.source = p.id
                WHERE p.depth < ? AND INSTR(p.route, e.target) = 0
            )
            SELECT route FROM path WHERE id = ? ORDER BY depth LIMIT 1
        `,[s,s,i,t]);return e.length===0?null:e[0].route.split("|")}getHotspots(s=20,t="impact"){let i=t==="complexity"?"complexity DESC":t==="fan_in"?"fan_in DESC":t==="lines"?"lines DESC":"(complexity * (fan_in + 1)) DESC";return I(this.ensureDb(),`SELECT *, (complexity * (fan_in + 1)) AS impact_score FROM nodes ORDER BY ${i} LIMIT ?`,[s])}getDeadCode(){return I(this.ensureDb(),"SELECT node_id AS nodeId, name AS symbol, kind FROM symbols WHERE is_dead = 1 ORDER BY node_id")}getCycles(){let s=I(this.ensureDb(),"SELECT cycle_id, node_id FROM cycles ORDER BY cycle_id, position"),t=[],i=[],e=-1;for(let n of s)n.cycle_id!==e&&(i.length>0&&t.push(i),i=[],e=n.cycle_id),i.push(n.node_id);return i.length>0&&t.push(i),t}getNodeDetail(s){let t=this.ensureDb(),i=Ne(t,"SELECT * FROM nodes WHERE id = ?",[s]);if(!i)return null;let e=I(t,"SELECT * FROM symbols WHERE node_id = ?",[s]),n=I(t,"SELECT target FROM edges WHERE source = ?",[s]),o=I(t,"SELECT source FROM edges WHERE target = ?",[s]);return{...i,symbols:e,dependencies:n.map(p=>p.target),dependents:o.map(p=>p.source)}}getArchitectureOverview(){return I(this.ensureDb(),`
            SELECT language,
                   COUNT(*) AS count,
                   SUM(lines) AS total_loc,
                   ROUND(AVG(complexity), 1) AS avg_complexity
            FROM nodes GROUP BY language ORDER BY count DESC
        `)}searchSymbols(s,t){let i=this.ensureDb();return t?I(i,"SELECT node_id AS nodeId, name, kind, line FROM symbols WHERE name LIKE ? AND kind = ? ORDER BY name LIMIT 100",[`%${s}%`,t]):I(i,"SELECT node_id AS nodeId, name, kind, line FROM symbols WHERE name LIKE ? ORDER BY name LIMIT 100",[`%${s}%`])}getAllNodes(){return I(this.ensureDb(),"SELECT * FROM nodes ORDER BY id")}getAllEdges(){return I(this.ensureDb(),"SELECT * FROM edges ORDER BY source, target")}getMeta(s){return Ne(this.ensureDb(),"SELECT value FROM meta WHERE key = ?",[s])?.value??null}getAllMeta(){let s=I(this.ensureDb(),"SELECT key, value FROM meta"),t={};for(let i of s)t[i.key]=i.value;return t}ensureDb(){if(!this.db)throw new Error("GraphDB is not open");return this.db}};var y,S,P=[],F,Le,H,O,q,le,ae=!1,j;function Pt(r){le=new Q;let s=u.window.createTreeView("auraVisualizer.statsView",{treeDataProvider:le,showCollapseAll:!0});r.subscriptions.push(s),O=u.window.createStatusBarItem(u.StatusBarAlignment.Left,50),O.command="auraVisualizer.open",O.text="$(eye) Aura",O.tooltip="Open Aura 3D Visualizer",O.show(),r.subscriptions.push(O),r.subscriptions.push(u.commands.registerCommand("auraVisualizer.open",()=>Mt(r)),u.commands.registerCommand("auraVisualizer.refresh",()=>ce(r)),u.commands.registerCommand("auraVisualizer.focusFile",()=>Wt()),u.commands.registerCommand("auraVisualizer.openFileFromTree",t=>{let i=u.workspace.workspaceFolders?.[0];if(!i)return;let e=x.join(i.uri.fsPath,t);u.window.showTextDocument(u.Uri.file(e),{preview:!0})}),u.commands.registerCommand("auraVisualizer.exportGraph",()=>Bt())),Vt(r),r.subscriptions.push(u.window.onDidChangeActiveTextEditor(t=>{if(t&&y?.isVisible){let i=u.workspace.workspaceFolders?.[0];if(i){let e=x.relative(i.uri.fsPath,t.document.uri.fsPath);e.startsWith("..")||y.focusNode(e)}}})),r.subscriptions.push(u.window.onDidChangeActiveColorTheme(t=>{y?.sendTheme(t.kind)})),u.window.registerWebviewPanelSerializer(z.viewType,{async deserializeWebviewPanel(t){y||(y=new z(r.extensionUri),Ae()),y.restore(t),S&&y.sendGraphData(S)}}),u.workspace.workspaceFolders?.length&&ce(r)}function Ae(){y&&y.onOpenFile(async({path:r,line:s})=>{let t=u.workspace.workspaceFolders?.[0];if(!t)return;let i=x.join(t.uri.fsPath,r),e=u.Uri.file(i);try{let n=await u.workspace.openTextDocument(e),o=await u.window.showTextDocument(n,{preserveFocus:!1});if(s&&s>0){let p=new u.Position(s-1,0);o.selection=new u.Selection(p,p),o.revealRange(new u.Range(p,p),u.TextEditorRevealType.InCenter)}}catch{}})}async function Mt(r){y||(y=new z(r.extensionUri),Ae()),y.show(),S?y.sendGraphData(S):await ce(r)}async function ce(r){if(ae)return;ae=!0;let s=u.workspace.workspaceFolders?.[0];if(!s){ae=!1,u.window.showWarningMessage("Aura: No workspace folder open.");return}let t=s.uri.fsPath,e=u.workspace.getConfiguration("auraVisualizer").get("excludePaths",["node_modules",".git","dist","build","out","__pycache__"]);O&&(O.text="$(loading~spin) Aura: Analyzing...");try{let n=await u.window.withProgress({location:u.ProgressLocation.Window,title:"Aura: Analyzing codebase..."},()=>$t(r.extensionUri,t,e,s.name));S=n.graphData,P=n.files,y&&y.sendGraphData(S),le?.update(S),Pe();try{if(!j){j=new oe;let o=x.join(t,".aura");await k.mkdir(o,{recursive:!0}),await j.open(x.join(o,"graph.db"))}j.importGraphData(S),await Ut(r,t)}catch(o){console.error("[aura] GraphDB import error:",o)}zt(r,t,e)}catch(n){let o=n instanceof Error?n.message:String(n);u.window.showErrorMessage(`Aura: Analysis failed \u2014 ${o}`),O&&(O.text="$(eye) Aura")}finally{ae=!1}}async function Ut(r,s){let t=x.join(s,".vscode"),i=x.join(t,"mcp.json"),e=x.join(r.extensionUri.fsPath,"out","mcp-server.js"),n=x.join(s,".aura","graph.db"),o={};try{let p=await k.readFile(i,"utf-8");o=JSON.parse(p)}catch{}o.servers&&o.servers.aura||(o.servers=o.servers||{},o.servers.aura={command:"node",args:[e],env:{AURA_DB_PATH:n}},await k.mkdir(t,{recursive:!0}),await k.writeFile(i,JSON.stringify(o,null,4)+`
`,"utf-8"),console.log("[aura] MCP server registered in .vscode/mcp.json"))}function $t(r,s,t,i){return new Promise((e,n)=>{let o=x.join(r.fsPath,"out","analyzer-worker.js"),p=new ge.Worker(o,{workerData:{rootPath:s,skipDirs:t,projectName:i}});p.on("message",d=>{d.error?n(new Error(d.error)):e({graphData:d.graphData,files:d.files}),p.terminate()}),p.on("error",d=>{n(d),p.terminate()}),p.on("exit",d=>{d!==0&&n(new Error(`Worker exited with code ${d}`))})})}async function Gt(r,s){let t=u.workspace.workspaceFolders?.[0];if(!t||P.length===0)return;let i=t.uri.fsPath,e=x.relative(i,r.fsPath);if(e.startsWith(".."))return;if(s)P=P.filter(p=>p.id!==e);else{let p=await de(r.fsPath,i);if(!p)return;let d=P.findIndex(m=>m.id===e);d>=0?P[d]=p:P.push(p)}let n=S,o=t.name;if(S=me(P,o),y?.isVisible&&S)if(n){let p=jt(n,S,e,s);y.sendGraphDelta(p)}else y.sendGraphData(S);le?.update(S),Pe()}function jt(r,s,t,i){let e={changedNodes:[],removedNodeIds:[],addedLinks:[],removedLinks:[],meta:s.meta};i&&e.removedNodeIds.push(t);let n=new Map(r.nodes.map(l=>[l.id,l])),o=new Map(s.nodes.map(l=>[l.id,l]));for(let l of s.nodes){let g=n.get(l.id);(!g||l.fanIn!==g.fanIn||l.fanOut!==g.fanOut||l.complexity!==g.complexity||l.linesOfCode!==g.linesOfCode||l.size!==g.size)&&e.changedNodes.push(l)}for(let l of r.nodes)o.has(l.id)||e.removedNodeIds.includes(l.id)||e.removedNodeIds.push(l.id);let p=l=>`${typeof l.source=="object"?l.source.id:l.source}|${typeof l.target=="object"?l.target.id:l.target}|${l.type}`,d=new Set(r.links.map(p)),m=new Set(s.links.map(p));for(let l of s.links)d.has(p(l))||e.addedLinks.push(l);for(let l of r.links)m.has(p(l))||e.removedLinks.push({source:typeof l.source=="object"?l.source.id:l.source,target:typeof l.target=="object"?l.target.id:l.target,type:l.type});return e}function Pe(){if(!O||!S)return;let{totalFiles:r,totalLinks:s}=S.meta;O.text=`$(eye) Aura: ${r} files, ${s} links`,O.tooltip=`Aura \u2014 ${r} files, ${s} dependencies
Click to open 3D visualizer`}async function zt(r,s,t){if(!await fe(s))return;F&&(F.terminate(),F=void 0);let e=x.join(s,".aura","history"),n=x.join(r.extensionUri.fsPath,"out","history-worker.js");F=new ge.Worker(n,{workerData:{rootPath:s,skipDirs:t,historyDir:e}}),F.on("message",o=>{switch(o.type){case"index":Le=o.payload,y&&y.sendHistoryIndex(Le);break;case"progress":{let p=o.payload;y&&y.sendHistoryProgress(p.scanned,p.total);break}case"delta":{let p=o.payload;y&&y.sendHistoryDelta(p);break}case"done":break;case"error":break}}),F.on("error",()=>{}),F.on("exit",()=>{F=void 0})}function Wt(){let r=u.window.activeTextEditor;if(!r||!y?.isVisible)return;let s=u.workspace.workspaceFolders?.[0];if(!s)return;let t=x.relative(s.uri.fsPath,r.document.uri.fsPath);t.startsWith("..")||y.focusNode(t)}async function Bt(){let r=u.workspace.workspaceFolders?.[0];if(!r){u.window.showWarningMessage("Aura: No workspace folder open.");return}if(!S){u.window.showWarningMessage("Aura: No graph data. Run analysis first (Ctrl+Shift+A).");return}let s=x.join(r.uri.fsPath,".aura");await k.mkdir(s,{recursive:!0});let t=S,i={meta:t.meta,nodes:t.nodes.map(n=>({id:n.id,name:n.name,path:n.path,language:n.language,extension:n.extension,size:n.size,linesOfCode:n.linesOfCode,group:n.group,fanIn:n.fanIn,fanOut:n.fanOut,complexity:n.complexity})),links:t.links.map(n=>({source:n.source,target:n.target,type:n.type,label:n.label}))};await k.writeFile(x.join(s,"graph.json"),JSON.stringify(i,null,2),"utf-8");let e=Ht(t);await k.writeFile(x.join(s,"summary.md"),e,"utf-8"),u.window.showInformationMessage("Aura: Exported to .aura/ \u2014 graph.json + summary.md","Open summary").then(n=>{n==="Open summary"&&u.window.showTextDocument(u.Uri.file(x.join(s,"summary.md")),{preview:!0})})}function Ht(r){let{meta:s,nodes:t,links:i}=r,e=[];e.push(`# Aura Graph \u2014 ${s.projectName}`),e.push(`> Auto-generated by Aura Visualizer on ${s.analyzedAt}`),e.push("> This file describes the codebase architecture for AI-assisted development."),e.push(""),e.push("## Overview"),e.push(`- **${s.totalFiles}** files, **${s.totalLinks}** dependencies`);let n=Object.entries(s.languageStats).sort((c,w)=>w[1].count-c[1].count).map(([c,w])=>`${c} (${w.count} files, ${w.totalLOC} LOC)`);if(e.push(`- Languages: ${n.join(", ")}`),s.unresolvedReferences>0&&e.push(`- Unresolved references: ${s.unresolvedReferences}`),e.push(""),s.groups.length>0){e.push("## Directory Structure");for(let c of s.groups){let w=t.filter(L=>L.group===c),C=w.reduce((L,V)=>L+V.linesOfCode,0);e.push(`- \`${c}/\` \u2014 ${w.length} files, ${C} LOC`)}e.push("")}let o=[...t].sort((c,w)=>w.fanIn-c.fanIn).slice(0,15).filter(c=>c.fanIn>0);if(o.length>0){e.push("## Hotspots (most depended-on files)"),e.push("| File | Fan-in | Fan-out | Complexity | LOC |"),e.push("|------|--------|---------|------------|-----|");for(let c of o)e.push(`| \`${c.id}\` | ${c.fanIn} | ${c.fanOut} | ${c.complexity} | ${c.linesOfCode} |`);e.push("")}let p=[...t].sort((c,w)=>w.complexity-c.complexity).slice(0,10).filter(c=>c.complexity>1);if(p.length>0){e.push("## Most Complex Files"),e.push("| File | Complexity | LOC | Fan-in | Fan-out |"),e.push("|------|------------|-----|--------|---------|");for(let c of p)e.push(`| \`${c.id}\` | ${c.complexity} | ${c.linesOfCode} | ${c.fanIn} | ${c.fanOut} |`);e.push("")}let d=[...t].sort((c,w)=>w.linesOfCode-c.linesOfCode).slice(0,10);if(d.length>0){e.push("## Largest Files"),e.push("| File | LOC | Complexity | Language |"),e.push("|------|-----|------------|----------|");for(let c of d)e.push(`| \`${c.id}\` | ${c.linesOfCode} | ${c.complexity} | ${c.language} |`);e.push("")}let m=t.filter(c=>c.fanIn===0&&c.fanOut===0);if(m.length>0){e.push("## Orphan Files (no dependencies)");for(let c of m)e.push(`- \`${c.id}\` (${c.language}, ${c.linesOfCode} LOC)`);e.push("")}let l=[],g=new Set(i.map(c=>`${c.source}\u2192${c.target}`));for(let c of i){let w=`${c.target}\u2192${c.source}`;g.has(w)&&c.source<c.target&&l.push(`\`${c.source}\` \u2194 \`${c.target}\``)}if(l.length>0){e.push("## Circular Dependencies");for(let c of l)e.push(`- ${c}`);e.push("")}let h={};for(let c of i)h[c.type]=(h[c.type]||0)+1;if(Object.keys(h).length>0){e.push("## Dependency Types");for(let[c,w]of Object.entries(h).sort((C,L)=>L[1]-C[1]))e.push(`- **${c}**: ${w}`);e.push("")}return e.push("## Usage Notes for AI Agents"),e.push("- Files with high fan-in are **critical hubs** \u2014 changes impact many dependents."),e.push("- Check circular dependencies before refactoring \u2014 break cycles where possible."),e.push("- Orphan files may be dead code candidates for cleanup."),e.push("- Use `graph.json` for programmatic queries (e.g., find all dependents of a file)."),e.push("- High complexity files (>15) are prime candidates for decomposition."),e.push(""),e.join(`
`)}function Vt(r){if(!u.workspace.getConfiguration("auraVisualizer").get("autoRefresh",!0))return;H=u.workspace.createFileSystemWatcher("**/*.{c,h,js,ts,py,css,html}");let i=new Map,e=()=>{q&&clearTimeout(q),q=setTimeout(async()=>{let n=new Map(i);if(i.clear(),P.length===0){y?.isVisible?ce(r):S=void 0;return}for(let[,o]of n)await Gt(o.uri,o.deleted)},500)};H.onDidChange(n=>{i.set(n.fsPath,{uri:n,deleted:!1}),e()}),H.onDidCreate(n=>{i.set(n.fsPath,{uri:n,deleted:!1}),e()}),H.onDidDelete(n=>{i.set(n.fsPath,{uri:n,deleted:!0}),e()}),r.subscriptions.push(H)}function Xt(){y?.dispose(),H?.dispose(),q&&clearTimeout(q),F&&(F.terminate(),F=void 0),j&&(j.close(),j=void 0)}0&&(module.exports={activate,deactivate});
