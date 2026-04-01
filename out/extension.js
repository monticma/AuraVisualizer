"use strict";var Be=Object.create;var Z=Object.defineProperty;var He=Object.getOwnPropertyDescriptor;var Ve=Object.getOwnPropertyNames;var Xe=Object.getPrototypeOf,Ye=Object.prototype.hasOwnProperty;var Je=(a,s)=>{for(var t in s)Z(a,t,{get:s[t],enumerable:!0})},ve=(a,s,t,i)=>{if(s&&typeof s=="object"||typeof s=="function")for(let e of Ve(s))!Ye.call(a,e)&&e!==t&&Z(a,e,{get:()=>s[e],enumerable:!(i=He(s,e))||i.enumerable});return a};var P=(a,s,t)=>(t=a!=null?Be(Xe(a)):{},ve(s||!a||!a.__esModule?Z(t,"default",{value:a,enumerable:!0}):t,a)),qe=a=>ve(Z({},"__esModule",{value:!0}),a);var Yt={};Je(Yt,{activate:()=>Mt,deactivate:()=>Xt});module.exports=qe(Yt);var u=P(require("vscode")),x=P(require("path")),k=P(require("fs/promises")),fe=require("worker_threads");var R=P(require("vscode")),be=P(require("path")),z=class a{static viewType="auraVisualizer.graphView";panel;extensionUri;disposables=[];onOpenFileEmitter=new R.EventEmitter;onOpenFile=this.onOpenFileEmitter.event;onDisposeEmitter=new R.EventEmitter;onDidDispose=this.onDisposeEmitter.event;pendingData;webviewReady=!1;constructor(s){this.extensionUri=s}show(){return this.panel?(this.panel.reveal(R.ViewColumn.One),this.panel):(this.panel=R.window.createWebviewPanel(a.viewType,"Aura \u2014 3D Visualizer",R.ViewColumn.One,{enableScripts:!0,retainContextWhenHidden:!0,localResourceRoots:[R.Uri.joinPath(this.extensionUri,"out","webview")]}),this.initPanel(),this.panel)}restore(s){this.panel=s,s.webview.options={enableScripts:!0,localResourceRoots:[R.Uri.joinPath(this.extensionUri,"out","webview")]},this.initPanel()}initPanel(){this.panel&&(this.panel.iconPath=R.Uri.joinPath(this.extensionUri,"resources","icon.png"),this.panel.webview.html=this.getHtmlContent(this.panel.webview),this.setupMessageHandler(),this.panel.onDidDispose(()=>{this.panel=void 0,this.webviewReady=!1,this.disposables.forEach(s=>s.dispose()),this.disposables=[],this.onDisposeEmitter.fire()}))}setupMessageHandler(){this.panel&&this.panel.webview.onDidReceiveMessage(s=>{switch(s.type){case"ready":this.webviewReady=!0,this.pendingData&&this.panel?.webview.postMessage({type:"graphData",payload:this.pendingData});break;case"openFile":s.payload&&this.onOpenFileEmitter.fire({path:s.payload.path,line:s.payload.line});break;case"requestRefresh":R.commands.executeCommand("auraVisualizer.refresh");break;case"requestExport":R.commands.executeCommand("auraVisualizer.exportGraph");break}},null,this.disposables)}sendGraphData(s){this.pendingData=s,this.webviewReady&&this.panel?.webview.postMessage({type:"graphData",payload:s})}sendGraphDelta(s){this.webviewReady&&this.panel?.webview.postMessage({type:"updateGraph",payload:s})}focusNode(s){this.panel?.webview.postMessage({type:"focusNode",payload:{nodeId:s}})}sendTheme(s){this.panel?.webview.postMessage({type:"themeChanged",payload:{kind:s}})}sendHistoryIndex(s){this.webviewReady&&this.panel?.webview.postMessage({type:"historyIndex",payload:s})}sendHistoryProgress(s,t){this.webviewReady&&this.panel?.webview.postMessage({type:"historyProgress",payload:{scanned:s,total:t}})}sendHistoryDelta(s){this.webviewReady&&this.panel?.webview.postMessage({type:"historyDelta",payload:s})}get isVisible(){return this.panel?.visible??!1}dispose(){this.panel?.dispose()}getHtmlContent(s){let t=be.join("out","webview"),i=s.asWebviewUri(R.Uri.joinPath(this.extensionUri,t,"css","style.css")),e=s.asWebviewUri(R.Uri.joinPath(this.extensionUri,t,"js","app.js")),n=s.asWebviewUri(R.Uri.joinPath(this.extensionUri,t,"js","graph-config.js")),o=s.asWebviewUri(R.Uri.joinPath(this.extensionUri,t,"lib","3d-force-graph.min.js")),p=s.asWebviewUri(R.Uri.joinPath(this.extensionUri,t,"lib","three.global.js")),d=Ke();return`<!DOCTYPE html>
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
</html>`}};function Ke(){let a=new Uint8Array(16);return require("crypto").randomFillSync(a),Array.from(a,s=>s.toString(16).padStart(2,"0")).join("")}var T=P(require("vscode")),D=class extends T.TreeItem{constructor(t,i){let e=t.kind==="file"?t.node.name:t.kind==="stat"?`${t.label}: ${t.value}`:t.label;super(e,i);this.entry=t;t.kind==="header"?this.iconPath=new T.ThemeIcon(t.icon):t.kind==="stat"?this.iconPath=new T.ThemeIcon(t.icon):t.kind==="file"&&(this.description=t.metric,this.iconPath=new T.ThemeIcon("file"),this.command={command:"auraVisualizer.openFileFromTree",title:"Open File",arguments:[t.node.path]},this.tooltip=`${t.node.path}
Complexity: ${t.node.complexity}
Lines: ${t.node.linesOfCode}
Fan-in: ${t.node.fanIn} / Fan-out: ${t.node.fanOut}`)}},Q=class{_onDidChangeTreeData=new T.EventEmitter;onDidChangeTreeData=this._onDidChangeTreeData.event;data;update(s){this.data=s,this._onDidChangeTreeData.fire(void 0)}getTreeItem(s){return s}getChildren(s){if(!this.data)return[new D({kind:"stat",label:"No data",value:"Open a workspace and run Aura",icon:"info"},T.TreeItemCollapsibleState.None)];if(!s)return[new D({kind:"header",label:"Stats",icon:"graph"},T.TreeItemCollapsibleState.Expanded),new D({kind:"header",label:"Most Complex",icon:"flame"},T.TreeItemCollapsibleState.Collapsed),new D({kind:"header",label:"Largest Files",icon:"file-binary"},T.TreeItemCollapsibleState.Collapsed),new D({kind:"header",label:"Orphan Files",icon:"warning"},T.TreeItemCollapsibleState.Collapsed)];if(s.entry.kind!=="header")return[];let t=this.data;switch(s.entry.label){case"Stats":{let i=Object.entries(t.meta.languageStats).map(([e,n])=>`${e}: ${n.count}`).join(", ");return[this.stat("Files",String(t.meta.totalFiles),"file"),this.stat("Links",String(t.meta.totalLinks),"link"),this.stat("Function Calls",String(t.meta.functionCallLinks),"symbol-method"),this.stat("Groups",String(t.meta.groups.length),"folder"),this.stat("Languages",i,"symbol-color")]}case"Most Complex":return[...t.nodes].sort((i,e)=>e.complexity-i.complexity).slice(0,10).map(i=>new D({kind:"file",node:i,metric:`complexity: ${i.complexity}`},T.TreeItemCollapsibleState.None));case"Largest Files":return[...t.nodes].sort((i,e)=>e.linesOfCode-i.linesOfCode).slice(0,10).map(i=>new D({kind:"file",node:i,metric:`${i.linesOfCode} lines`},T.TreeItemCollapsibleState.None));case"Orphan Files":return t.nodes.filter(i=>i.fanIn===0&&i.fanOut===0).map(i=>new D({kind:"file",node:i,metric:i.language},T.TreeItemCollapsibleState.None));default:return[]}}stat(s,t,i){return new D({kind:"stat",label:s,value:t,icon:i},T.TreeItemCollapsibleState.None)}};var Y=require("fs/promises"),J=require("path"),Ze=new Set([".c",".h",".js",".ts",".py",".css",".html",".htm"]),Qe={".c":"c",".h":"c",".js":"javascript",".ts":"typescript",".py":"python",".css":"css",".html":"html",".htm":"html"};async function de(a,s){let t=(0,J.extname)(a).toLowerCase();if(!Ze.has(t))return null;try{let i=await(0,Y.stat)(a),e=await(0,Y.readFile)(a,"utf-8"),n=e.split(`
`).filter(l=>l.trim().length>0).length,o=(0,J.relative)(s,a),p=o.split("/"),d=p.length>1?p[0]:"/",m=p[p.length-1];return{id:o,name:m,path:o,fullPath:a,language:Qe[t]||"unknown",extension:t,size:i.size,linesOfCode:n,lastModified:Math.floor(i.mtimeMs),group:d,content:e}}catch{return null}}var A=require("path");var _=class{language;constructor(s){this.language=s}parse(s,t){return[]}extractMatches(s,t,i,e,n){let o=[],p;for(;(p=t.exec(s))!==null;){let d=p[1];d&&o.push({source:e,target:d,type:i,label:n?n(p):`${i}: ${d}`})}return o}};var et=/#include\s*"([^"]+)"/g,tt=/#include\s*<([^>]+)>/g,st=/^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?((?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+)([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/gm,nt=/extern\s+[\w\s*]+\s+(\w+)\s*\([^)]*\)\s*;/g,it=/(?:typedef\s+)?struct\s+(\w+)\s*\{/g,ot=/typedef\s+struct\s*(?:\w+\s*)?\{[^}]*\}\s*(\w+)\s*;/gs,at=/(?:typedef\s+)?enum\s+(\w+)\s*\{/g,rt=/^[ \t]*#define\s+(\w+)(?:\(([^)]*)\))?/gm,Ee=new Set(["if","else","for","while","do","switch","case","return","break","continue","goto","sizeof","typeof","typedef","struct","union","enum","static","extern","inline","const","volatile","register","auto","void","int","char","float","double","long","short","unsigned","signed","bool","BOOL","printf","fprintf","sprintf","snprintf","scanf","sscanf","malloc","calloc","realloc","free","memcpy","memset","memmove","strlen","strcpy","strncpy","strcmp","strncmp","strcat","fopen","fclose","fread","fwrite","fseek","ftell","exit","abort","assert","NULL","true","false","defined","offsetof","va_start","va_end","va_arg","__attribute__","__declspec","visibility","__extension__"]),ee=class extends _{constructor(){super("c")}parse(s,t={}){let{content:i,id:e}=s,n=[];return n.push(...this.extractMatches(i,new RegExp(et.source,"g"),"include",e,o=>`#include "${o[1]}"`)),t.includeSystemHeaders&&n.push(...this.extractMatches(i,new RegExp(tt.source,"g"),"system-include",e,o=>`#include <${o[1]}>`)),n}extractSymbols(s){let{content:t}=s,i={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[]},e=this.stripComments(t),n,o=new RegExp(st.source,"gm");for(;(n=o.exec(e))!==null;){let h=(n[1]||"").trim(),c=n[2],w=(n[3]||"").trim();if(!Ee.has(c)){let C=e.substring(0,n.index).split(`
`).length;i.functions.push({name:c,returnType:h,params:w,line:C,type:"function"})}}let p=new RegExp(nt.source,"g");for(;(n=p.exec(e))!==null;)i.externs.push({name:n[1],type:"extern"});let d=new RegExp(it.source,"g");for(;(n=d.exec(e))!==null;)i.structs.push({name:n[1],type:"struct"});let m=new RegExp(ot.source,"gs");for(;(n=m.exec(e))!==null;)i.structs.push({name:n[1],type:"typedef-struct"});let l=new RegExp(at.source,"g");for(;(n=l.exec(e))!==null;)i.enums.push({name:n[1],type:"enum"});let f=new RegExp(rt.source,"gm");for(;(n=f.exec(e))!==null;){let h=n[1],c=n[2]!==void 0;i.macros.push({name:h,type:c?"function-macro":"constant-macro"})}return i}extractCalls(s){let{content:t}=s,i=this.stripComments(t),e=new Set,n=/^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?(?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+([a-zA-Z_]\w*)\s*\([^)]*\)\s*\{/gm,o;for(;(o=n.exec(i))!==null;)e.add(o[1]);let p=new Set,d=/\b(\w+)\s*\(/g,m;for(;(m=d.exec(i))!==null;){let l=m[1];!Ee.has(l)&&!/^[A-Z_]+$/.test(l)&&!e.has(l)&&p.add(l)}return[...p]}stripComments(s){let t=s.replace(/\/\/.*$/gm,"");return t=t.replace(/\/\*[\s\S]*?\*\//g,""),t=t.replace(/"(?:[^"\\]|\\.)*"/g,'""'),t}};var lt=/import\s+(?:[\w{}\s,*]+\s+from\s+)?['"]([^'"]+)['"]/g,ct=/(?:^|[=(\s,])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,pt=/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,dt=/import\s*\(\s*`([^`$]+)/g,Re=/(?:^|[\s;{}])(?:async\s+)?function\s*\*?\s+(\w+)\s*\(/gm,xe=/(?:^|[\s;])(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*=>/gm;var ut=/(?:^|[\s;])class\s+(\w+)/gm,mt=/export\s+(?:(?:async\s+)?function\s*\*?\s+(\w+)|class\s+(\w+)|(?:const|let|var)\s+(\w+))/gm,gt=/export\s+default\s+(?:(?:async\s+)?function\s*\*?\s+(\w+)|class\s+(\w+)|(\w+))/gm,ft=/export\s*\{([^}]+)\}/g,W=new Set(["if","else","for","while","do","switch","case","return","break","continue","throw","try","catch","finally","new","delete","typeof","instanceof","void","in","of","this","super","with","yield","await","debugger","constructor","get","set","static","async","true","false","null","undefined","NaN","Infinity","console","window","document","global","process","require","module","exports","import","export","default","from"]),ht=new Set([...W,"parseInt","parseFloat","isNaN","isFinite","encodeURI","decodeURI","encodeURIComponent","decodeURIComponent","eval","JSON","Math","Object","Array","String","Number","Boolean","Date","RegExp","Error","TypeError","RangeError","SyntaxError","ReferenceError","Map","Set","WeakMap","WeakSet","Promise","Proxy","Reflect","Symbol","BigInt","ArrayBuffer","SharedArrayBuffer","DataView","Float32Array","Float64Array","Int8Array","Int16Array","Int32Array","Uint8Array","Uint16Array","Uint32Array","URL","URLSearchParams","setTimeout","setInterval","clearTimeout","clearInterval","requestAnimationFrame","cancelAnimationFrame","fetch","alert","confirm","prompt","addEventListener","removeEventListener","dispatchEvent","createElement","getElementById","querySelector","querySelectorAll","log","warn","error","info","debug","trace","dir","push","pop","shift","unshift","splice","slice","concat","map","filter","reduce","forEach","find","findIndex","some","every","includes","indexOf","join","sort","reverse","flat","flatMap","keys","values","entries","assign","freeze","seal","defineProperty","getOwnPropertyNames","hasOwnProperty","toString","valueOf","toJSON","then","catch","resolve","reject","all","allSettled","race","any","stringify","parse","replace","match","search","split","trim","startsWith","endsWith","charAt","charCodeAt","substring","repeat","padStart","padEnd","bind","call","apply","next","done","emit","on","once","off"]),B=class extends _{constructor(){super("javascript")}parse(s){let{content:t,id:i}=s,e=[];return e.push(...this.extractMatches(t,new RegExp(lt.source,"g"),"import",i,n=>`import from '${n[1]}'`)),e.push(...this.extractMatches(t,new RegExp(ct.source,"g"),"require",i,n=>`require('${n[1]}')`)),e.push(...this.extractMatches(t,new RegExp(pt.source,"g"),"dynamic-import",i,n=>`import('${n[1]}')`)),e.push(...this.extractMatches(t,new RegExp(dt.source,"g"),"dynamic-import",i,n=>`import('${n[1].split("?")[0]}')`).map(n=>({...n,target:n.target.split("?")[0]}))),e}extractSymbols(s){let{content:t}=s,i={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[]},e=this.stripCommentsAndStrings(t),n,o=new RegExp(Re.source,"gm");for(;(n=o.exec(e))!==null;){let h=n[1];if(!W.has(h)){let c=e.substring(0,n.index).split(`
`).length;i.functions.push({name:h,type:"function",line:c})}}let p=new RegExp(xe.source,"gm");for(;(n=p.exec(e))!==null;){let h=n[1];if(!W.has(h)){let c=e.substring(0,n.index).split(`
`).length;i.functions.some(w=>w.name===h)||i.functions.push({name:h,type:"arrow",line:c})}}let d=new RegExp(ut.source,"gm");for(;(n=d.exec(e))!==null;){let h=n[1],c=e.substring(0,n.index).split(`
`).length;i.classes.push({name:h,type:"class",line:c})}let m=new RegExp(mt.source,"gm");for(;(n=m.exec(e))!==null;){let h=n[1]||n[2]||n[3];if(h){let c=n[1]?"function":n[2]?"class":"variable";i.exports.push({name:h,type:`export-${c}`})}}let l=new RegExp(gt.source,"gm");for(;(n=l.exec(e))!==null;){let h=n[1]||n[2]||n[3];h&&!W.has(h)&&i.exports.push({name:h,type:"export-default"})}let f=new RegExp(ft.source,"g");for(;(n=f.exec(e))!==null;){let h=n[1].split(",");for(let c of h){let C=c.trim().match(/^(\w+)(?:\s+as\s+\w+)?$/);C&&!W.has(C[1])&&i.exports.push({name:C[1],type:"export-named"})}}return i}extractCalls(s){let{content:t}=s,i=this.stripCommentsAndStrings(t),e=new Set,n,o=new RegExp(Re.source,"gm");for(;(n=o.exec(i))!==null;)e.add(n[1]);let p=new RegExp(xe.source,"gm");for(;(n=p.exec(i))!==null;)e.add(n[1]);let d=new Set,m=/(?:^|[^.\w])(\w+)\s*\(/g;for(;(n=m.exec(i))!==null;){let l=n[1];!ht.has(l)&&!W.has(l)&&!e.has(l)&&!/^[A-Z_]+$/.test(l)&&d.add(l)}return[...d]}stripCommentsAndStrings(s){let t=s.replace(/\/\/.*$/gm,"");return t=t.replace(/\/\*[\s\S]*?\*\//g,""),t=t.replace(/"(?:[^"\\]|\\.)*"/g,'""'),t=t.replace(/'(?:[^'\\]|\\.)*'/g,"''"),t=t.replace(/`(?:[^`\\]|\\.)*`/gs,"``"),t}};var yt=/<script[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,wt=/<link[^>]+href\s*=\s*['"]([^'"]+)['"]/gi,vt=/<img[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,te=class extends _{constructor(){super("html")}parse(s,t={}){let{content:i,id:e}=s,n=[];return n.push(...this.extractMatches(i,new RegExp(yt.source,"gi"),"script",e,o=>`<script src="${o[1]}">`)),n.push(...this.extractMatches(i,new RegExp(wt.source,"gi"),"stylesheet",e,o=>`<link href="${o[1]}">`)),t.includeAssets&&n.push(...this.extractMatches(i,new RegExp(vt.source,"gi"),"asset",e,o=>`<img src="${o[1]}">`)),n}};var bt=/@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"]\s*\)?/g,Et=/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/g,se=class extends _{constructor(){super("css")}parse(s,t={}){let{content:i,id:e}=s,n=[];if(n.push(...this.extractMatches(i,new RegExp(bt.source,"g"),"css-import",e,o=>`@import "${o[1]}"`)),t.includeUrls){let o=this.extractMatches(i,new RegExp(Et.source,"g"),"css-url",e,p=>`url("${p[1]}")`);n.push(...o.filter(p=>!p.target.startsWith("data:")&&!p.target.startsWith("http:")&&!p.target.startsWith("https:")&&!p.target.startsWith("#")))}return n}};var ne=class extends B{constructor(){super(),this.language="typescript"}};var Rt=/^import\s+([\w.]+)/gm,xt=/^from\s+([\w.]+)\s+import/gm,Se=/^[ \t]*def\s+(\w+)\s*\(/gm,Te=/^[ \t]*class\s+(\w+)\s*[:(]/gm,St=/__all__\s*=\s*\[([^\]]*)\]/gs,Tt=/^[ \t]*@(\w+)/gm,Ce=new Set(["print","len","range","int","str","float","list","dict","set","tuple","bool","type","isinstance","issubclass","hasattr","getattr","setattr","delattr","callable","super","property","staticmethod","classmethod","abs","all","any","bin","chr","dir","divmod","enumerate","eval","exec","filter","format","frozenset","globals","hash","hex","id","input","iter","locals","map","max","min","next","object","oct","open","ord","pow","repr","reversed","round","slice","sorted","sum","vars","zip","breakpoint","compile","complex","memoryview","bytearray","bytes","__import__","__name__","__file__","__doc__"]),ie=class extends _{constructor(){super("python")}parse(s){let{content:t,id:i}=s,e=[];return e.push(...this.extractMatches(t,new RegExp(Rt.source,"gm"),"import",i,n=>`import ${n[1]}`)),e.push(...this.extractMatches(t,new RegExp(xt.source,"gm"),"from-import",i,n=>`from ${n[1]} import`)),e}extractSymbols(s){let{content:t}=s,i={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[]},e=this.stripCommentsAndStrings(t),n,o=new RegExp(Se.source,"gm");for(;(n=o.exec(e))!==null;){let f=n[1],h=e.substring(0,n.index).split(`
`).length,c=f.startsWith("__")&&f.endsWith("__");i.functions.push({name:f,type:c?"dunder":"function",line:h})}let p=new RegExp(Te.source,"gm");for(;(n=p.exec(e))!==null;){let f=n[1],h=e.substring(0,n.index).split(`
`).length;i.classes.push({name:f,type:"class",line:h})}let d=new RegExp(St.source,"gs");for(;(n=d.exec(e))!==null;){let f=n[1].split(",");for(let h of f){let c=h.trim().match(/['"](\w+)['"]/);c&&i.exports.push({name:c[1],type:"export-all"})}}let m=new RegExp(Tt.source,"gm"),l=new Set;for(;(n=m.exec(e))!==null;){let f=n[1];if(!l.has(f)&&!Ce.has(f)){l.add(f);let h=e.substring(0,n.index).split(`
`).length;i.macros.push({name:f,type:"decorator",line:h})}}return i}extractCalls(s){let{content:t}=s,i=this.stripCommentsAndStrings(t),e=new Set,n,o=new RegExp(Se.source,"gm");for(;(n=o.exec(i))!==null;)e.add(n[1]);let p=new RegExp(Te.source,"gm");for(;(n=p.exec(i))!==null;)e.add(n[1]);let d=new Set,m=/(?:^|[^.\w])(\w+)\s*\(/g;for(;(n=m.exec(i))!==null;){let l=n[1];!Ce.has(l)&&!e.has(l)&&!/^[A-Z_]+$/.test(l)&&l!=="def"&&l!=="class"&&l!=="if"&&l!=="for"&&l!=="while"&&l!=="return"&&l!=="elif"&&l!=="assert"&&l!=="raise"&&l!=="yield"&&l!=="lambda"&&l!=="not"&&l!=="and"&&l!=="or"&&d.add(l)}return[...d]}stripCommentsAndStrings(s){let t=s.replace(/"""[\s\S]*?"""/g,'""');return t=t.replace(/'''[\s\S]*?'''/g,"''"),t=t.replace(/"(?:[^"\\]|\\.)*"/g,'""'),t=t.replace(/'(?:[^'\\]|\\.)*'/g,"''"),t=t.replace(/#.*$/gm,""),t}};var Ct=/\b(if|else\s+if|for|while|do|switch|case|catch)\b/g,It=/(\|\||&&)/g,Ot=/[^?]\?[^?:]/g,_t=/[^{}]+(?=\s*\{)/g,Dt=/@media\b/g;function Ie(a){let{content:s,language:t}=a;switch(t){case"c":case"javascript":case"typescript":return Oe(s);case"css":return Nt(s);case"html":return Ft(s);default:return{complexity:1,details:{}}}}function Oe(a){let s=a.replace(/\/\/.*$/gm,"").replace(/\/\*[\s\S]*?\*\//g,"").replace(/"(?:[^"\\]|\\.)*"/g,'""').replace(/'(?:[^'\\]|\\.)*'/g,"''"),t=1,i={},e={},n=new RegExp(Ct.source,"g"),o;for(;(o=n.exec(s))!==null;){let f=o[1].replace(/\s+/g," ");e[f]=(e[f]||0)+1,t++}i.keywords=e;let p=new RegExp(It.source,"g"),d=0;for(;(o=p.exec(s))!==null;)d++,t++;i.logicalOperators=d;let m=new RegExp(Ot.source,"g"),l=0;for(;(o=m.exec(s))!==null;)l++,t++;return i.ternaryOperators=l,{complexity:t,details:i}}function Nt(a){let s=a.replace(/\/\*[\s\S]*?\*\//g,""),t=0,i=new RegExp(_t.source,"g"),e;for(;(e=i.exec(s))!==null;){let d=e[0].split(",").filter(m=>m.trim().length>0);t+=d.length}let n=0,o=new RegExp(Dt.source,"g");for(;(e=o.exec(s))!==null;)n++;return{complexity:Math.max(1,Math.round(1+t/10+n)),details:{selectors:t,mediaQueries:n}}}function Ft(a){let s=/\bon\w+\s*=/gi,t=0,i;for(;(i=s.exec(a))!==null;)t++;let e=/<script\b[^>]*>[\s\S]*?<\/script>/gi,n=0,o=0;for(;(i=e.exec(a))!==null;){n++;let d=Oe(i[0]);o+=d.complexity-1}return{complexity:Math.max(1,1+t+o),details:{eventHandlers:t,scriptBlocks:n,inlineJSComplexity:o}}}var ue={c:new ee,javascript:new B,typescript:new ne,python:new ie,html:new te,css:new se};function kt(a,s,t){if(t.has(a))return a;let i=(0,A.dirname)(s),e=(0,A.normalize)((0,A.join)(i,a));if(t.has(e))return e;let n=[".js",".ts",".py",".c",".h",".css",".html"];for(let d of n){if(t.has(e+d))return e+d;if(t.has(a+d))return a+d}let o=(0,A.join)(e,"index.js");if(t.has(o))return o;let p=(0,A.basename)(a);for(let[d,m]of t)if(m.name===p)return d;for(let d of n){let m=p+d;for(let[l,f]of t)if(f.name===m)return l}return null}function Lt(a){let s=new Map;for(let m of a)s.has(m.source)||s.set(m.source,[]),s.get(m.source).push(m.target);let t=[],i=new Set,e=new Set,n=[];function o(m){i.add(m),e.add(m),n.push(m);let l=s.get(m)||[];for(let f of l)if(e.has(f)){let h=n.indexOf(f);if(h>=0){let c=n.slice(h);c.length>=2&&t.push(c)}}else i.has(f)||o(f);n.pop(),e.delete(m)}for(let m of s.keys())i.has(m)||o(m);let p=[],d=new Set;for(let m of t){let f=[...m].sort().join("|");d.has(f)||(d.add(f),p.push(m))}return p}function me(a,s="Project",t={}){let i=new Map;for(let r of a)i.set(r.id,r);let e=[];for(let r of a){let g=ue[r.language];if(g){let v=g.parse(r,t);e.push(...v)}}let n=new Map,o={c:"c",javascript:"js",typescript:"js",python:"py"},p=new Map,d=new Set(["c","javascript","typescript","python"]);for(let r of a){if(!d.has(r.language))continue;let g=ue[r.language];if(!g.extractSymbols)continue;let v=g.extractSymbols(r);n.set(r.id,v);let E=o[r.language]||r.language;for(let G of v.functions){let b=`${E}:${G.name}`;p.has(b)||p.set(b,[]),p.get(b).push(r.id)}}let m=[],l=new Set([".h",".hpp",".d.ts"]);for(let r of a){if(!d.has(r.language)||l.has(r.extension))continue;let g=ue[r.language];if(!g.extractCalls)continue;let v=g.extractCalls(r),E=n.get(r.id),G=new Set(E?E.functions.map(X=>X.name):[]),b=o[r.language]||r.language;for(let X of v){if(G.has(X))continue;let We=`${b}:${X}`,ye=p.get(We);if(ye)for(let we of ye)we!==r.id&&m.push({source:r.id,target:we,type:"function-call",label:`${X}()`})}}let f=new Map;for(let r of a){let g=Ie(r);f.set(r.id,g)}let h=[],c={count:0,targets:[]};for(let r of e){let g=kt(r.target,r.source,i);g?g!==r.source&&h.push({source:r.source,target:g,type:r.type,label:r.label}):(c.count++,c.targets.length<20&&c.targets.push({from:r.source,ref:r.target}))}h.push(...m);let w=new Set,C=h.filter(r=>{let g=`${r.source}|${r.target}|${r.type}`;return w.has(g)?!1:(w.add(g),!0)}),L=new Map,V=new Map;for(let r of C)L.set(r.source,(L.get(r.source)||0)+1),V.set(r.target,(V.get(r.target)||0)+1);let K=new Set,Pe=/(?:^|[^.\w])(\w+)\s*\(/gm;for(let r of a){let g,v=new RegExp(Pe.source,"gm");for(;(g=v.exec(r.content))!==null;)K.add(g[1])}let he=new Map;for(let r of a){let g=n.get(r.id);if(!g)continue;let v=[];for(let E of g.functions)E.name!=="main"&&E.type!=="dunder"&&(K.has(E.name)||v.push(E.name));for(let E of g.classes)K.has(E.name)||v.push(E.name);for(let E of g.exports)!K.has(E.name)&&!v.includes(E.name)&&v.push(E.name);v.length>0&&he.set(r.id,v)}let $=a.map(r=>{let g=n.get(r.id),v=f.get(r.id)||{complexity:1,details:{}},E={id:r.id,name:r.name,path:r.path,language:r.language,extension:r.extension,size:r.size,linesOfCode:r.linesOfCode,lastModified:r.lastModified||0,group:r.group,fanOut:L.get(r.id)||0,fanIn:V.get(r.id)||0,complexity:v.complexity,complexityDetails:v.details};g&&(E.symbols={functions:g.functions.map(b=>({name:b.name,returnType:b.returnType||"",params:b.params||"",line:b.line||0,type:b.type})),structs:g.structs.map(b=>({name:b.name,type:b.type})),enums:g.enums.map(b=>({name:b.name,type:b.type})),macros:g.macros.slice(0,30),classes:g.classes.map(b=>({name:b.name,type:b.type})),exports:g.exports.map(b=>({name:b.name,type:b.type})),totalSymbols:g.functions.length+g.structs.length+g.enums.length+g.macros.length+g.classes.length+g.exports.length});let G=he.get(r.id);return G&&G.length>0&&(E.deadExports=G),E}),F={};for(let r of $)F[r.language]||(F[r.language]={count:0,totalLOC:0,avgComplexity:0}),F[r.language].count++,F[r.language].totalLOC+=r.linesOfCode,F[r.language].avgComplexity+=r.complexity;for(let r in F)F[r].avgComplexity=Math.round(F[r].avgComplexity/F[r].count*10)/10;let Ue=new Set($.map(r=>r.group)),$e=C.filter(r=>r.type==="function-call").length,Ge=$.filter(r=>r.deadExports&&r.deadExports.length>0).length,je=$.reduce((r,g)=>r+(g.deadExports?g.deadExports.length:0),0),pe=Lt(C),ze=new Map($.map(r=>[r.id,r]));for(let r=0;r<pe.length;r++)for(let g of pe[r]){let v=ze.get(g);v&&(v.cycleIds||(v.cycleIds=[]),v.cycleIds.push(r))}return{meta:{projectName:s,analyzedAt:new Date().toISOString(),totalFiles:$.length,totalLinks:C.length,totalRelationsFound:e.length,functionCallLinks:$e,unresolvedReferences:c.count,unresolvedSamples:c.targets,deadCodeFiles:Ge,deadExportsTotal:je,cycles:pe,languageStats:F,groups:[...Ue].sort()},nodes:$,links:C}}var _e=require("child_process"),De=require("util"),At=(0,De.promisify)(_e.execFile),Es=50*1024*1024;async function ge(a){try{return await At("git",["rev-parse","--is-inside-work-tree"],{cwd:a}),!0}catch{return!1}}var ke=P(require("sql.js")),U=require("fs"),ae=require("path"),Ne=`
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
`;function I(a,s,t=[]){let i=a.prepare(s);i.bind(t);let e=[];for(;i.step();)e.push(i.getAsObject());return i.free(),e}function Fe(a,s,t=[]){let i=a.prepare(s);i.bind(t);let e;return i.step()&&(e=i.getAsObject()),i.free(),e}var oe=class{db=null;dbPath="";async open(s){let t=(0,ae.join)((0,ae.dirname)(require.resolve("sql.js")),"sql-wasm.wasm"),i=await(0,ke.default)({locateFile:()=>t});if(this.dbPath=s,(0,U.existsSync)(s)){let e=(0,U.readFileSync)(s);this.db=new i.Database(e)}else this.db=new i.Database;this.db.run(Ne)}openSync(s,t){if(this.dbPath=t,(0,U.existsSync)(t)){let i=(0,U.readFileSync)(t);this.db=new s.Database(i)}else this.db=new s.Database;this.db.run(Ne)}close(){this.db?.close(),this.db=null}get isOpen(){return this.db!==null}save(){if(!this.db||!this.dbPath)return;let s=this.db.export();(0,U.writeFileSync)(this.dbPath,Buffer.from(s))}importGraphData(s){let t=this.ensureDb();t.run("BEGIN TRANSACTION");try{t.run("DELETE FROM symbols"),t.run("DELETE FROM edges"),t.run("DELETE FROM cycles"),t.run("DELETE FROM nodes"),t.run("DELETE FROM meta");for(let e of s.nodes)t.run("INSERT INTO nodes (id, name, language, extension, group_name, size, lines, complexity, fan_in, fan_out, last_modified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",[e.id,e.name,e.language,e.extension,e.group,e.size,e.linesOfCode,e.complexity,e.fanIn,e.fanOut,e.lastModified]);for(let e of s.links){let n=typeof e.source=="object"?e.source.id:e.source,o=typeof e.target=="object"?e.target.id:e.target;t.run("INSERT OR IGNORE INTO edges (source, target, type, label) VALUES (?, ?, ?, ?)",[n,o,e.type,e.label||""])}for(let e of s.nodes){if(!e.symbols)continue;let n=new Set(e.deadExports||[]);for(let o of e.symbols.functions)t.run("INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead) VALUES (?, ?, ?, ?, ?, ?, ?)",[e.id,o.name,o.type||"function",o.returnType||"",o.params||"",o.line||0,n.has(o.name)?1:0]);for(let o of e.symbols.structs)t.run("INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead) VALUES (?, ?, ?, ?, ?, ?, ?)",[e.id,o.name,o.type||"struct","","",0,0]);for(let o of e.symbols.enums)t.run("INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead) VALUES (?, ?, ?, ?, ?, ?, ?)",[e.id,o.name,o.type||"enum","","",0,0]);for(let o of e.symbols.macros)t.run("INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead) VALUES (?, ?, ?, ?, ?, ?, ?)",[e.id,o.name,o.type||"macro","","",0,0]);for(let o of e.symbols.classes)t.run("INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead) VALUES (?, ?, ?, ?, ?, ?, ?)",[e.id,o.name,o.type||"class","","",0,n.has(o.name)?1:0]);for(let o of e.symbols.exports)t.run("INSERT OR IGNORE INTO symbols (node_id, name, kind, return_type, params, line, is_dead) VALUES (?, ?, ?, ?, ?, ?, ?)",[e.id,o.name,o.type||"export","","",0,n.has(o.name)?1:0])}if(s.meta.cycles)for(let e=0;e<s.meta.cycles.length;e++){let n=s.meta.cycles[e];for(let o=0;o<n.length;o++)t.run("INSERT INTO cycles (cycle_id, node_id, position) VALUES (?, ?, ?)",[e,n[o],o])}let i=[["projectName",s.meta.projectName],["analyzedAt",s.meta.analyzedAt],["totalFiles",String(s.meta.totalFiles)],["totalLinks",String(s.meta.totalLinks)],["totalRelationsFound",String(s.meta.totalRelationsFound)],["functionCallLinks",String(s.meta.functionCallLinks)],["unresolvedReferences",String(s.meta.unresolvedReferences)],["deadCodeFiles",String(s.meta.deadCodeFiles)],["deadExportsTotal",String(s.meta.deadExportsTotal)],["languageStats",JSON.stringify(s.meta.languageStats)],["groups",JSON.stringify(s.meta.groups)]];for(let[e,n]of i)t.run("INSERT INTO meta (key, value) VALUES (?, ?)",[e,n]);t.run("COMMIT")}catch(i){throw t.run("ROLLBACK"),i}this.save()}getDependencies(s,t=5){return I(this.ensureDb(),`
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
        `,[s,s,i,t]);return e.length===0?null:e[0].route.split("|")}getHotspots(s=20,t="impact"){let i=t==="complexity"?"complexity DESC":t==="fan_in"?"fan_in DESC":t==="lines"?"lines DESC":"(complexity * (fan_in + 1)) DESC";return I(this.ensureDb(),`SELECT *, (complexity * (fan_in + 1)) AS impact_score FROM nodes ORDER BY ${i} LIMIT ?`,[s])}getDeadCode(){return I(this.ensureDb(),"SELECT node_id AS nodeId, name AS symbol, kind FROM symbols WHERE is_dead = 1 ORDER BY node_id")}getCycles(){let s=I(this.ensureDb(),"SELECT cycle_id, node_id FROM cycles ORDER BY cycle_id, position"),t=[],i=[],e=-1;for(let n of s)n.cycle_id!==e&&(i.length>0&&t.push(i),i=[],e=n.cycle_id),i.push(n.node_id);return i.length>0&&t.push(i),t}getNodeDetail(s){let t=this.ensureDb(),i=Fe(t,"SELECT * FROM nodes WHERE id = ?",[s]);if(!i)return null;let e=I(t,"SELECT * FROM symbols WHERE node_id = ?",[s]),n=I(t,"SELECT target FROM edges WHERE source = ?",[s]),o=I(t,"SELECT source FROM edges WHERE target = ?",[s]);return{...i,symbols:e,dependencies:n.map(p=>p.target),dependents:o.map(p=>p.source)}}getArchitectureOverview(){return I(this.ensureDb(),`
            SELECT language,
                   COUNT(*) AS count,
                   SUM(lines) AS total_loc,
                   ROUND(AVG(complexity), 1) AS avg_complexity
            FROM nodes GROUP BY language ORDER BY count DESC
        `)}searchSymbols(s,t){let i=this.ensureDb();return t?I(i,"SELECT node_id AS nodeId, name, kind, line FROM symbols WHERE name LIKE ? AND kind = ? ORDER BY name LIMIT 100",[`%${s}%`,t]):I(i,"SELECT node_id AS nodeId, name, kind, line FROM symbols WHERE name LIKE ? ORDER BY name LIMIT 100",[`%${s}%`])}getAllNodes(){return I(this.ensureDb(),"SELECT * FROM nodes ORDER BY id")}getAllEdges(){return I(this.ensureDb(),"SELECT * FROM edges ORDER BY source, target")}getMeta(s){return Fe(this.ensureDb(),"SELECT value FROM meta WHERE key = ?",[s])?.value??null}getAllMeta(){let s=I(this.ensureDb(),"SELECT key, value FROM meta"),t={};for(let i of s)t[i.key]=i.value;return t}ensureDb(){if(!this.db)throw new Error("GraphDB is not open");return this.db}};var y,S,M=[],N,Le,H,O,q,le,re=!1,j;function Mt(a){le=new Q;let s=u.window.createTreeView("auraVisualizer.statsView",{treeDataProvider:le,showCollapseAll:!0});a.subscriptions.push(s),O=u.window.createStatusBarItem(u.StatusBarAlignment.Left,50),O.command="auraVisualizer.open",O.text="$(eye) Aura",O.tooltip="Open Aura 3D Visualizer",O.show(),a.subscriptions.push(O),a.subscriptions.push(u.commands.registerCommand("auraVisualizer.open",()=>Pt(a)),u.commands.registerCommand("auraVisualizer.refresh",()=>ce(a)),u.commands.registerCommand("auraVisualizer.focusFile",()=>Wt()),u.commands.registerCommand("auraVisualizer.openFileFromTree",t=>{let i=u.workspace.workspaceFolders?.[0];if(!i)return;let e=x.join(i.uri.fsPath,t);u.window.showTextDocument(u.Uri.file(e),{preview:!0})}),u.commands.registerCommand("auraVisualizer.exportGraph",()=>Bt())),Vt(a),a.subscriptions.push(u.window.onDidChangeActiveTextEditor(t=>{if(t&&y?.isVisible){let i=u.workspace.workspaceFolders?.[0];if(i){let e=x.relative(i.uri.fsPath,t.document.uri.fsPath);e.startsWith("..")||y.focusNode(e)}}})),a.subscriptions.push(u.window.onDidChangeActiveColorTheme(t=>{y?.sendTheme(t.kind)})),u.window.registerWebviewPanelSerializer(z.viewType,{async deserializeWebviewPanel(t){y||(y=new z(a.extensionUri),Ae()),y.restore(t),S&&y.sendGraphData(S)}}),u.workspace.workspaceFolders?.length&&ce(a)}function Ae(){y&&y.onOpenFile(async({path:a,line:s})=>{let t=u.workspace.workspaceFolders?.[0];if(!t)return;let i=x.join(t.uri.fsPath,a),e=u.Uri.file(i);try{let n=await u.workspace.openTextDocument(e),o=await u.window.showTextDocument(n,{preserveFocus:!1});if(s&&s>0){let p=new u.Position(s-1,0);o.selection=new u.Selection(p,p),o.revealRange(new u.Range(p,p),u.TextEditorRevealType.InCenter)}}catch{}})}async function Pt(a){y||(y=new z(a.extensionUri),Ae()),y.show(),S?y.sendGraphData(S):await ce(a)}async function ce(a){if(re)return;re=!0;let s=u.workspace.workspaceFolders?.[0];if(!s){re=!1,u.window.showWarningMessage("Aura: No workspace folder open.");return}let t=s.uri.fsPath,e=u.workspace.getConfiguration("auraVisualizer").get("excludePaths",["node_modules",".git","dist","build","out","__pycache__"]);O&&(O.text="$(loading~spin) Aura: Analyzing...");try{let n=await u.window.withProgress({location:u.ProgressLocation.Window,title:"Aura: Analyzing codebase..."},()=>$t(a.extensionUri,t,e,s.name));S=n.graphData,M=n.files,y&&y.sendGraphData(S),le?.update(S),Me();try{if(!j){j=new oe;let o=x.join(t,".aura");await k.mkdir(o,{recursive:!0}),await j.open(x.join(o,"graph.db"))}j.importGraphData(S),await Ut(a,t)}catch(o){console.error("[aura] GraphDB import error:",o)}zt(a,t,e)}catch(n){let o=n instanceof Error?n.message:String(n);u.window.showErrorMessage(`Aura: Analysis failed \u2014 ${o}`),O&&(O.text="$(eye) Aura")}finally{re=!1}}async function Ut(a,s){let t=x.join(s,".vscode"),i=x.join(t,"mcp.json"),e=x.join(a.extensionUri.fsPath,"out","mcp-server.js"),n=x.join(s,".aura","graph.db"),o={};try{let p=await k.readFile(i,"utf-8");o=JSON.parse(p)}catch{}o.servers&&o.servers.aura||(o.servers=o.servers||{},o.servers.aura={command:"node",args:[e],env:{AURA_DB_PATH:n}},await k.mkdir(t,{recursive:!0}),await k.writeFile(i,JSON.stringify(o,null,4)+`
`,"utf-8"),console.log("[aura] MCP server registered in .vscode/mcp.json"))}function $t(a,s,t,i){return new Promise((e,n)=>{let o=x.join(a.fsPath,"out","analyzer-worker.js"),p=new fe.Worker(o,{workerData:{rootPath:s,skipDirs:t,projectName:i}});p.on("message",d=>{d.error?n(new Error(d.error)):e({graphData:d.graphData,files:d.files}),p.terminate()}),p.on("error",d=>{n(d),p.terminate()}),p.on("exit",d=>{d!==0&&n(new Error(`Worker exited with code ${d}`))})})}async function Gt(a,s){let t=u.workspace.workspaceFolders?.[0];if(!t||M.length===0)return;let i=t.uri.fsPath,e=x.relative(i,a.fsPath);if(e.startsWith(".."))return;if(s)M=M.filter(p=>p.id!==e);else{let p=await de(a.fsPath,i);if(!p)return;let d=M.findIndex(m=>m.id===e);d>=0?M[d]=p:M.push(p)}let n=S,o=t.name;if(S=me(M,o),y?.isVisible&&S)if(n){let p=jt(n,S,e,s);y.sendGraphDelta(p)}else y.sendGraphData(S);le?.update(S),Me()}function jt(a,s,t,i){let e={changedNodes:[],removedNodeIds:[],addedLinks:[],removedLinks:[],meta:s.meta};i&&e.removedNodeIds.push(t);let n=new Map(a.nodes.map(l=>[l.id,l])),o=new Map(s.nodes.map(l=>[l.id,l]));for(let l of s.nodes){let f=n.get(l.id);(!f||l.fanIn!==f.fanIn||l.fanOut!==f.fanOut||l.complexity!==f.complexity||l.linesOfCode!==f.linesOfCode||l.size!==f.size)&&e.changedNodes.push(l)}for(let l of a.nodes)o.has(l.id)||e.removedNodeIds.includes(l.id)||e.removedNodeIds.push(l.id);let p=l=>`${typeof l.source=="object"?l.source.id:l.source}|${typeof l.target=="object"?l.target.id:l.target}|${l.type}`,d=new Set(a.links.map(p)),m=new Set(s.links.map(p));for(let l of s.links)d.has(p(l))||e.addedLinks.push(l);for(let l of a.links)m.has(p(l))||e.removedLinks.push({source:typeof l.source=="object"?l.source.id:l.source,target:typeof l.target=="object"?l.target.id:l.target,type:l.type});return e}function Me(){if(!O||!S)return;let{totalFiles:a,totalLinks:s}=S.meta;O.text=`$(eye) Aura: ${a} files, ${s} links`,O.tooltip=`Aura \u2014 ${a} files, ${s} dependencies
Click to open 3D visualizer`}async function zt(a,s,t){if(!await ge(s))return;N&&(N.terminate(),N=void 0);let e=x.join(s,".aura","history"),n=x.join(a.extensionUri.fsPath,"out","history-worker.js");N=new fe.Worker(n,{workerData:{rootPath:s,skipDirs:t,historyDir:e}}),N.on("message",o=>{switch(o.type){case"index":Le=o.payload,y&&y.sendHistoryIndex(Le);break;case"progress":{let p=o.payload;y&&y.sendHistoryProgress(p.scanned,p.total);break}case"delta":{let p=o.payload;y&&y.sendHistoryDelta(p);break}case"done":break;case"error":break}}),N.on("error",()=>{}),N.on("exit",()=>{N=void 0})}function Wt(){let a=u.window.activeTextEditor;if(!a||!y?.isVisible)return;let s=u.workspace.workspaceFolders?.[0];if(!s)return;let t=x.relative(s.uri.fsPath,a.document.uri.fsPath);t.startsWith("..")||y.focusNode(t)}async function Bt(){let a=u.workspace.workspaceFolders?.[0];if(!a){u.window.showWarningMessage("Aura: No workspace folder open.");return}if(!S){u.window.showWarningMessage("Aura: No graph data. Run analysis first (Ctrl+Shift+A).");return}let s=x.join(a.uri.fsPath,".aura");await k.mkdir(s,{recursive:!0});let t=S,i={meta:t.meta,nodes:t.nodes.map(n=>({id:n.id,name:n.name,path:n.path,language:n.language,extension:n.extension,size:n.size,linesOfCode:n.linesOfCode,group:n.group,fanIn:n.fanIn,fanOut:n.fanOut,complexity:n.complexity})),links:t.links.map(n=>({source:n.source,target:n.target,type:n.type,label:n.label}))};await k.writeFile(x.join(s,"graph.json"),JSON.stringify(i,null,2),"utf-8");let e=Ht(t);await k.writeFile(x.join(s,"summary.md"),e,"utf-8"),u.window.showInformationMessage("Aura: Exported to .aura/ \u2014 graph.json + summary.md","Open summary").then(n=>{n==="Open summary"&&u.window.showTextDocument(u.Uri.file(x.join(s,"summary.md")),{preview:!0})})}function Ht(a){let{meta:s,nodes:t,links:i}=a,e=[];e.push(`# Aura Graph \u2014 ${s.projectName}`),e.push(`> Auto-generated by Aura Visualizer on ${s.analyzedAt}`),e.push("> This file describes the codebase architecture for AI-assisted development."),e.push(""),e.push("## Overview"),e.push(`- **${s.totalFiles}** files, **${s.totalLinks}** dependencies`);let n=Object.entries(s.languageStats).sort((c,w)=>w[1].count-c[1].count).map(([c,w])=>`${c} (${w.count} files, ${w.totalLOC} LOC)`);if(e.push(`- Languages: ${n.join(", ")}`),s.unresolvedReferences>0&&e.push(`- Unresolved references: ${s.unresolvedReferences}`),e.push(""),s.groups.length>0){e.push("## Directory Structure");for(let c of s.groups){let w=t.filter(L=>L.group===c),C=w.reduce((L,V)=>L+V.linesOfCode,0);e.push(`- \`${c}/\` \u2014 ${w.length} files, ${C} LOC`)}e.push("")}let o=[...t].sort((c,w)=>w.fanIn-c.fanIn).slice(0,15).filter(c=>c.fanIn>0);if(o.length>0){e.push("## Hotspots (most depended-on files)"),e.push("| File | Fan-in | Fan-out | Complexity | LOC |"),e.push("|------|--------|---------|------------|-----|");for(let c of o)e.push(`| \`${c.id}\` | ${c.fanIn} | ${c.fanOut} | ${c.complexity} | ${c.linesOfCode} |`);e.push("")}let p=[...t].sort((c,w)=>w.complexity-c.complexity).slice(0,10).filter(c=>c.complexity>1);if(p.length>0){e.push("## Most Complex Files"),e.push("| File | Complexity | LOC | Fan-in | Fan-out |"),e.push("|------|------------|-----|--------|---------|");for(let c of p)e.push(`| \`${c.id}\` | ${c.complexity} | ${c.linesOfCode} | ${c.fanIn} | ${c.fanOut} |`);e.push("")}let d=[...t].sort((c,w)=>w.linesOfCode-c.linesOfCode).slice(0,10);if(d.length>0){e.push("## Largest Files"),e.push("| File | LOC | Complexity | Language |"),e.push("|------|-----|------------|----------|");for(let c of d)e.push(`| \`${c.id}\` | ${c.linesOfCode} | ${c.complexity} | ${c.language} |`);e.push("")}let m=t.filter(c=>c.fanIn===0&&c.fanOut===0);if(m.length>0){e.push("## Orphan Files (no dependencies)");for(let c of m)e.push(`- \`${c.id}\` (${c.language}, ${c.linesOfCode} LOC)`);e.push("")}let l=[],f=new Set(i.map(c=>`${c.source}\u2192${c.target}`));for(let c of i){let w=`${c.target}\u2192${c.source}`;f.has(w)&&c.source<c.target&&l.push(`\`${c.source}\` \u2194 \`${c.target}\``)}if(l.length>0){e.push("## Circular Dependencies");for(let c of l)e.push(`- ${c}`);e.push("")}let h={};for(let c of i)h[c.type]=(h[c.type]||0)+1;if(Object.keys(h).length>0){e.push("## Dependency Types");for(let[c,w]of Object.entries(h).sort((C,L)=>L[1]-C[1]))e.push(`- **${c}**: ${w}`);e.push("")}return e.push("## Usage Notes for AI Agents"),e.push("- Files with high fan-in are **critical hubs** \u2014 changes impact many dependents."),e.push("- Check circular dependencies before refactoring \u2014 break cycles where possible."),e.push("- Orphan files may be dead code candidates for cleanup."),e.push("- Use `graph.json` for programmatic queries (e.g., find all dependents of a file)."),e.push("- High complexity files (>15) are prime candidates for decomposition."),e.push(""),e.join(`
`)}function Vt(a){if(!u.workspace.getConfiguration("auraVisualizer").get("autoRefresh",!0))return;H=u.workspace.createFileSystemWatcher("**/*.{c,h,js,ts,py,css,html}");let i=new Map,e=()=>{q&&clearTimeout(q),q=setTimeout(async()=>{let n=new Map(i);if(i.clear(),M.length===0){y?.isVisible?ce(a):S=void 0;return}for(let[,o]of n)await Gt(o.uri,o.deleted)},500)};H.onDidChange(n=>{i.set(n.fsPath,{uri:n,deleted:!1}),e()}),H.onDidCreate(n=>{i.set(n.fsPath,{uri:n,deleted:!1}),e()}),H.onDidDelete(n=>{i.set(n.fsPath,{uri:n,deleted:!0}),e()}),a.subscriptions.push(H)}function Xt(){y?.dispose(),H?.dispose(),q&&clearTimeout(q),N&&(N.terminate(),N=void 0),j&&(j.close(),j=void 0)}0&&(module.exports={activate,deactivate});
