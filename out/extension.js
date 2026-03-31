"use strict";var Le=Object.create;var J=Object.defineProperty;var Me=Object.getOwnPropertyDescriptor;var Ne=Object.getOwnPropertyNames;var Ue=Object.getPrototypeOf,Ge=Object.prototype.hasOwnProperty;var je=(o,n)=>{for(var s in n)J(o,s,{get:n[s],enumerable:!0})},fe=(o,n,s,i)=>{if(n&&typeof n=="object"||typeof n=="function")for(let e of Ne(n))!Ge.call(o,e)&&e!==s&&J(o,e,{get:()=>n[e],enumerable:!(i=Me(n,e))||i.enumerable});return o};var M=(o,n,s)=>(s=o!=null?Le(Ue(o)):{},fe(n||!o||!o.__esModule?J(s,"default",{value:o,enumerable:!0}):s,o)),ze=o=>fe(J({},"__esModule",{value:!0}),o);var Ut={};je(Ut,{activate:()=>It,deactivate:()=>Nt});module.exports=ze(Ut);var u=M(require("vscode")),k=M(require("path")),Y=M(require("fs/promises")),pe=require("worker_threads");var R=M(require("vscode")),he=M(require("path")),N=class o{static viewType="auraVisualizer.graphView";panel;extensionUri;disposables=[];onOpenFileEmitter=new R.EventEmitter;onOpenFile=this.onOpenFileEmitter.event;onDisposeEmitter=new R.EventEmitter;onDidDispose=this.onDisposeEmitter.event;pendingData;webviewReady=!1;constructor(n){this.extensionUri=n}show(){return this.panel?(this.panel.reveal(R.ViewColumn.One),this.panel):(this.panel=R.window.createWebviewPanel(o.viewType,"Aura \u2014 3D Visualizer",R.ViewColumn.One,{enableScripts:!0,retainContextWhenHidden:!0,localResourceRoots:[R.Uri.joinPath(this.extensionUri,"out","webview")]}),this.initPanel(),this.panel)}restore(n){this.panel=n,n.webview.options={enableScripts:!0,localResourceRoots:[R.Uri.joinPath(this.extensionUri,"out","webview")]},this.initPanel()}initPanel(){this.panel&&(this.panel.iconPath=R.Uri.joinPath(this.extensionUri,"resources","icon.png"),this.panel.webview.html=this.getHtmlContent(this.panel.webview),this.setupMessageHandler(),this.panel.onDidDispose(()=>{this.panel=void 0,this.webviewReady=!1,this.disposables.forEach(n=>n.dispose()),this.disposables=[],this.onDisposeEmitter.fire()}))}setupMessageHandler(){this.panel&&this.panel.webview.onDidReceiveMessage(n=>{switch(n.type){case"ready":this.webviewReady=!0,this.pendingData&&this.panel?.webview.postMessage({type:"graphData",payload:this.pendingData});break;case"openFile":n.payload&&this.onOpenFileEmitter.fire({path:n.payload.path,line:n.payload.line});break;case"requestRefresh":R.commands.executeCommand("auraVisualizer.refresh");break;case"requestExport":R.commands.executeCommand("auraVisualizer.exportGraph");break}},null,this.disposables)}sendGraphData(n){this.pendingData=n,this.webviewReady&&this.panel?.webview.postMessage({type:"graphData",payload:n})}sendGraphDelta(n){this.webviewReady&&this.panel?.webview.postMessage({type:"updateGraph",payload:n})}focusNode(n){this.panel?.webview.postMessage({type:"focusNode",payload:{nodeId:n}})}sendTheme(n){this.panel?.webview.postMessage({type:"themeChanged",payload:{kind:n}})}sendHistoryIndex(n){this.webviewReady&&this.panel?.webview.postMessage({type:"historyIndex",payload:n})}sendHistoryProgress(n,s){this.webviewReady&&this.panel?.webview.postMessage({type:"historyProgress",payload:{scanned:n,total:s}})}sendHistoryDelta(n){this.webviewReady&&this.panel?.webview.postMessage({type:"historyDelta",payload:n})}get isVisible(){return this.panel?.visible??!1}dispose(){this.panel?.dispose()}getHtmlContent(n){let s=he.join("out","webview"),i=n.asWebviewUri(R.Uri.joinPath(this.extensionUri,s,"css","style.css")),e=n.asWebviewUri(R.Uri.joinPath(this.extensionUri,s,"js","app.js")),t=n.asWebviewUri(R.Uri.joinPath(this.extensionUri,s,"js","graph-config.js")),c=n.asWebviewUri(R.Uri.joinPath(this.extensionUri,s,"lib","3d-force-graph.min.js")),p=n.asWebviewUri(R.Uri.joinPath(this.extensionUri,s,"lib","three.global.js")),d=We();return`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${n.cspSource} 'unsafe-inline'; script-src 'nonce-${d}' 'unsafe-eval' ${n.cspSource}; img-src ${n.cspSource} data:; font-src ${n.cspSource};">
    <link rel="stylesheet" href="${i}">
    <title>Aura \u2014 3D Visualizer</title>
</head>
<body>
    <!-- Top Bar -->
    <header id="top-bar">
        <div class="top-bar-left">
            <button id="btn-toggle-explorer" class="top-btn icon-btn" title="Toggle explorer">\u2630</button>
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

    <!-- Explorer Panel -->
    <aside id="explorer-panel" class="hidden">
        <div class="explorer-header"><h3>Files</h3></div>
        <div id="explorer-tree" class="explorer-tree"></div>
    </aside>

    <!-- 3D Graph Container -->
    <div id="graph-container">
        <div id="loading-overlay">
            <div class="loading-content">
                <span class="loading-icon">\u2726</span>
                <p>Analyzing codebase...</p>
            </div>
        </div>
    </div>

    <!-- Detail Panel -->
    <aside id="detail-panel" class="hidden">
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

    <!-- Heatmap Legend -->
    <div id="heatmap-legend" class="hidden">
        <span class="legend-label" id="legend-low">Low</span>
        <div class="legend-gradient" id="legend-gradient"></div>
        <span class="legend-label" id="legend-high">High</span>
        <span class="legend-mode" id="legend-mode">\u2014</span>
    </div>

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

    <!-- Tooltip -->
    <div id="tooltip" class="hidden">
        <div class="tooltip-name" id="tooltip-name">\u2014</div>
        <div class="tooltip-meta" id="tooltip-meta">\u2014</div>
    </div>

    <!-- Libraries: THREE must load before 3d-force-graph (it checks window.THREE) -->
    <script nonce="${d}" src="${p}"></script>
    <script nonce="${d}" src="${c}"></script>
    <!-- App Logic -->
    <script nonce="${d}" src="${t}"></script>
    <script nonce="${d}" src="${e}"></script>
</body>
</html>`}};function We(){let o=new Uint8Array(16);return require("crypto").randomFillSync(o),Array.from(o,n=>n.toString(16).padStart(2,"0")).join("")}var C=M(require("vscode")),_=class extends C.TreeItem{constructor(s,i){let e=s.kind==="file"?s.node.name:s.kind==="stat"?`${s.label}: ${s.value}`:s.label;super(e,i);this.entry=s;s.kind==="header"?this.iconPath=new C.ThemeIcon(s.icon):s.kind==="stat"?this.iconPath=new C.ThemeIcon(s.icon):s.kind==="file"&&(this.description=s.metric,this.iconPath=new C.ThemeIcon("file"),this.command={command:"auraVisualizer.openFileFromTree",title:"Open File",arguments:[s.node.path]},this.tooltip=`${s.node.path}
Complexity: ${s.node.complexity}
Lines: ${s.node.linesOfCode}
Fan-in: ${s.node.fanIn} / Fan-out: ${s.node.fanOut}`)}},Z=class{_onDidChangeTreeData=new C.EventEmitter;onDidChangeTreeData=this._onDidChangeTreeData.event;data;update(n){this.data=n,this._onDidChangeTreeData.fire(void 0)}getTreeItem(n){return n}getChildren(n){if(!this.data)return[new _({kind:"stat",label:"No data",value:"Open a workspace and run Aura",icon:"info"},C.TreeItemCollapsibleState.None)];if(!n)return[new _({kind:"header",label:"Stats",icon:"graph"},C.TreeItemCollapsibleState.Expanded),new _({kind:"header",label:"Most Complex",icon:"flame"},C.TreeItemCollapsibleState.Collapsed),new _({kind:"header",label:"Largest Files",icon:"file-binary"},C.TreeItemCollapsibleState.Collapsed),new _({kind:"header",label:"Orphan Files",icon:"warning"},C.TreeItemCollapsibleState.Collapsed)];if(n.entry.kind!=="header")return[];let s=this.data;switch(n.entry.label){case"Stats":{let i=Object.entries(s.meta.languageStats).map(([e,t])=>`${e}: ${t.count}`).join(", ");return[this.stat("Files",String(s.meta.totalFiles),"file"),this.stat("Links",String(s.meta.totalLinks),"link"),this.stat("Function Calls",String(s.meta.functionCallLinks),"symbol-method"),this.stat("Groups",String(s.meta.groups.length),"folder"),this.stat("Languages",i,"symbol-color")]}case"Most Complex":return[...s.nodes].sort((i,e)=>e.complexity-i.complexity).slice(0,10).map(i=>new _({kind:"file",node:i,metric:`complexity: ${i.complexity}`},C.TreeItemCollapsibleState.None));case"Largest Files":return[...s.nodes].sort((i,e)=>e.linesOfCode-i.linesOfCode).slice(0,10).map(i=>new _({kind:"file",node:i,metric:`${i.linesOfCode} lines`},C.TreeItemCollapsibleState.None));case"Orphan Files":return s.nodes.filter(i=>i.fanIn===0&&i.fanOut===0).map(i=>new _({kind:"file",node:i,metric:i.language},C.TreeItemCollapsibleState.None));default:return[]}}stat(n,s,i){return new _({kind:"stat",label:n,value:s,icon:i},C.TreeItemCollapsibleState.None)}};var B=require("fs/promises"),H=require("path"),Be=new Set([".c",".h",".js",".ts",".py",".css",".html",".htm"]),He={".c":"c",".h":"c",".js":"javascript",".ts":"typescript",".py":"python",".css":"css",".html":"html",".htm":"html"};async function ae(o,n){let s=(0,H.extname)(o).toLowerCase();if(!Be.has(s))return null;try{let i=await(0,B.stat)(o),e=await(0,B.readFile)(o,"utf-8"),t=e.split(`
`).filter(r=>r.trim().length>0).length,c=(0,H.relative)(n,o),p=c.split("/"),d=p.length>1?p[0]:"/",m=p[p.length-1];return{id:c,name:m,path:c,fullPath:o,language:He[s]||"unknown",extension:s,size:i.size,linesOfCode:t,lastModified:Math.floor(i.mtimeMs),group:d,content:e}}catch{return null}}var $=require("path");var I=class{language;constructor(n){this.language=n}parse(n,s){return[]}extractMatches(n,s,i,e,t){let c=[],p;for(;(p=s.exec(n))!==null;){let d=p[1];d&&c.push({source:e,target:d,type:i,label:t?t(p):`${i}: ${d}`})}return c}};var Ve=/#include\s*"([^"]+)"/g,Ye=/#include\s*<([^>]+)>/g,qe=/^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?((?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+)([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/gm,Je=/extern\s+[\w\s*]+\s+(\w+)\s*\([^)]*\)\s*;/g,Ze=/(?:typedef\s+)?struct\s+(\w+)\s*\{/g,Xe=/typedef\s+struct\s*(?:\w+\s*)?\{[^}]*\}\s*(\w+)\s*;/gs,Ke=/(?:typedef\s+)?enum\s+(\w+)\s*\{/g,Qe=/^[ \t]*#define\s+(\w+)(?:\(([^)]*)\))?/gm,ge=new Set(["if","else","for","while","do","switch","case","return","break","continue","goto","sizeof","typeof","typedef","struct","union","enum","static","extern","inline","const","volatile","register","auto","void","int","char","float","double","long","short","unsigned","signed","bool","BOOL","printf","fprintf","sprintf","snprintf","scanf","sscanf","malloc","calloc","realloc","free","memcpy","memset","memmove","strlen","strcpy","strncpy","strcmp","strncmp","strcat","fopen","fclose","fread","fwrite","fseek","ftell","exit","abort","assert","NULL","true","false","defined","offsetof","va_start","va_end","va_arg","__attribute__","__declspec","visibility","__extension__"]),X=class extends I{constructor(){super("c")}parse(n,s={}){let{content:i,id:e}=n,t=[];return t.push(...this.extractMatches(i,new RegExp(Ve.source,"g"),"include",e,c=>`#include "${c[1]}"`)),s.includeSystemHeaders&&t.push(...this.extractMatches(i,new RegExp(Ye.source,"g"),"system-include",e,c=>`#include <${c[1]}>`)),t}extractSymbols(n){let{content:s}=n,i={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[]},e=this.stripComments(s),t,c=new RegExp(qe.source,"gm");for(;(t=c.exec(e))!==null;){let g=(t[1]||"").trim(),l=t[2],w=(t[3]||"").trim();if(!ge.has(l)){let E=e.substring(0,t.index).split(`
`).length;i.functions.push({name:l,returnType:g,params:w,line:E,type:"function"})}}let p=new RegExp(Je.source,"g");for(;(t=p.exec(e))!==null;)i.externs.push({name:t[1],type:"extern"});let d=new RegExp(Ze.source,"g");for(;(t=d.exec(e))!==null;)i.structs.push({name:t[1],type:"struct"});let m=new RegExp(Xe.source,"gs");for(;(t=m.exec(e))!==null;)i.structs.push({name:t[1],type:"typedef-struct"});let r=new RegExp(Ke.source,"g");for(;(t=r.exec(e))!==null;)i.enums.push({name:t[1],type:"enum"});let h=new RegExp(Qe.source,"gm");for(;(t=h.exec(e))!==null;){let g=t[1],l=t[2]!==void 0;i.macros.push({name:g,type:l?"function-macro":"constant-macro"})}return i}extractCalls(n){let{content:s}=n,i=this.stripComments(s),e=new Set,t=/^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?(?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+([a-zA-Z_]\w*)\s*\([^)]*\)\s*\{/gm,c;for(;(c=t.exec(i))!==null;)e.add(c[1]);let p=new Set,d=/\b(\w+)\s*\(/g,m;for(;(m=d.exec(i))!==null;){let r=m[1];!ge.has(r)&&!/^[A-Z_]+$/.test(r)&&!e.has(r)&&p.add(r)}return[...p]}stripComments(n){let s=n.replace(/\/\/.*$/gm,"");return s=s.replace(/\/\*[\s\S]*?\*\//g,""),s=s.replace(/"(?:[^"\\]|\\.)*"/g,'""'),s}};var et=/import\s+(?:[\w{}\s,*]+\s+from\s+)?['"]([^'"]+)['"]/g,tt=/(?:^|[=(\s,])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,st=/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,nt=/import\s*\(\s*`([^`$]+)/g,ye=/(?:^|[\s;{}])(?:async\s+)?function\s*\*?\s+(\w+)\s*\(/gm,we=/(?:^|[\s;])(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*=>/gm;var it=/(?:^|[\s;])class\s+(\w+)/gm,ot=/export\s+(?:(?:async\s+)?function\s*\*?\s+(\w+)|class\s+(\w+)|(?:const|let|var)\s+(\w+))/gm,at=/export\s+default\s+(?:(?:async\s+)?function\s*\*?\s+(\w+)|class\s+(\w+)|(\w+))/gm,rt=/export\s*\{([^}]+)\}/g,U=new Set(["if","else","for","while","do","switch","case","return","break","continue","throw","try","catch","finally","new","delete","typeof","instanceof","void","in","of","this","super","with","yield","await","debugger","constructor","get","set","static","async","true","false","null","undefined","NaN","Infinity","console","window","document","global","process","require","module","exports","import","export","default","from"]),lt=new Set([...U,"parseInt","parseFloat","isNaN","isFinite","encodeURI","decodeURI","encodeURIComponent","decodeURIComponent","eval","JSON","Math","Object","Array","String","Number","Boolean","Date","RegExp","Error","TypeError","RangeError","SyntaxError","ReferenceError","Map","Set","WeakMap","WeakSet","Promise","Proxy","Reflect","Symbol","BigInt","ArrayBuffer","SharedArrayBuffer","DataView","Float32Array","Float64Array","Int8Array","Int16Array","Int32Array","Uint8Array","Uint16Array","Uint32Array","URL","URLSearchParams","setTimeout","setInterval","clearTimeout","clearInterval","requestAnimationFrame","cancelAnimationFrame","fetch","alert","confirm","prompt","addEventListener","removeEventListener","dispatchEvent","createElement","getElementById","querySelector","querySelectorAll","log","warn","error","info","debug","trace","dir","push","pop","shift","unshift","splice","slice","concat","map","filter","reduce","forEach","find","findIndex","some","every","includes","indexOf","join","sort","reverse","flat","flatMap","keys","values","entries","assign","freeze","seal","defineProperty","getOwnPropertyNames","hasOwnProperty","toString","valueOf","toJSON","then","catch","resolve","reject","all","allSettled","race","any","stringify","parse","replace","match","search","split","trim","startsWith","endsWith","charAt","charCodeAt","substring","repeat","padStart","padEnd","bind","call","apply","next","done","emit","on","once","off"]),G=class extends I{constructor(){super("javascript")}parse(n){let{content:s,id:i}=n,e=[];return e.push(...this.extractMatches(s,new RegExp(et.source,"g"),"import",i,t=>`import from '${t[1]}'`)),e.push(...this.extractMatches(s,new RegExp(tt.source,"g"),"require",i,t=>`require('${t[1]}')`)),e.push(...this.extractMatches(s,new RegExp(st.source,"g"),"dynamic-import",i,t=>`import('${t[1]}')`)),e.push(...this.extractMatches(s,new RegExp(nt.source,"g"),"dynamic-import",i,t=>`import('${t[1].split("?")[0]}')`).map(t=>({...t,target:t.target.split("?")[0]}))),e}extractSymbols(n){let{content:s}=n,i={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[]},e=this.stripCommentsAndStrings(s),t,c=new RegExp(ye.source,"gm");for(;(t=c.exec(e))!==null;){let g=t[1];if(!U.has(g)){let l=e.substring(0,t.index).split(`
`).length;i.functions.push({name:g,type:"function",line:l})}}let p=new RegExp(we.source,"gm");for(;(t=p.exec(e))!==null;){let g=t[1];if(!U.has(g)){let l=e.substring(0,t.index).split(`
`).length;i.functions.some(w=>w.name===g)||i.functions.push({name:g,type:"arrow",line:l})}}let d=new RegExp(it.source,"gm");for(;(t=d.exec(e))!==null;){let g=t[1],l=e.substring(0,t.index).split(`
`).length;i.classes.push({name:g,type:"class",line:l})}let m=new RegExp(ot.source,"gm");for(;(t=m.exec(e))!==null;){let g=t[1]||t[2]||t[3];if(g){let l=t[1]?"function":t[2]?"class":"variable";i.exports.push({name:g,type:`export-${l}`})}}let r=new RegExp(at.source,"gm");for(;(t=r.exec(e))!==null;){let g=t[1]||t[2]||t[3];g&&!U.has(g)&&i.exports.push({name:g,type:"export-default"})}let h=new RegExp(rt.source,"g");for(;(t=h.exec(e))!==null;){let g=t[1].split(",");for(let l of g){let E=l.trim().match(/^(\w+)(?:\s+as\s+\w+)?$/);E&&!U.has(E[1])&&i.exports.push({name:E[1],type:"export-named"})}}return i}extractCalls(n){let{content:s}=n,i=this.stripCommentsAndStrings(s),e=new Set,t,c=new RegExp(ye.source,"gm");for(;(t=c.exec(i))!==null;)e.add(t[1]);let p=new RegExp(we.source,"gm");for(;(t=p.exec(i))!==null;)e.add(t[1]);let d=new Set,m=/(?:^|[^.\w])(\w+)\s*\(/g;for(;(t=m.exec(i))!==null;){let r=t[1];!lt.has(r)&&!U.has(r)&&!e.has(r)&&!/^[A-Z_]+$/.test(r)&&d.add(r)}return[...d]}stripCommentsAndStrings(n){let s=n.replace(/\/\/.*$/gm,"");return s=s.replace(/\/\*[\s\S]*?\*\//g,""),s=s.replace(/"(?:[^"\\]|\\.)*"/g,'""'),s=s.replace(/'(?:[^'\\]|\\.)*'/g,"''"),s=s.replace(/`(?:[^`\\]|\\.)*`/gs,"``"),s}};var ct=/<script[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,pt=/<link[^>]+href\s*=\s*['"]([^'"]+)['"]/gi,dt=/<img[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,K=class extends I{constructor(){super("html")}parse(n,s={}){let{content:i,id:e}=n,t=[];return t.push(...this.extractMatches(i,new RegExp(ct.source,"gi"),"script",e,c=>`<script src="${c[1]}">`)),t.push(...this.extractMatches(i,new RegExp(pt.source,"gi"),"stylesheet",e,c=>`<link href="${c[1]}">`)),s.includeAssets&&t.push(...this.extractMatches(i,new RegExp(dt.source,"gi"),"asset",e,c=>`<img src="${c[1]}">`)),t}};var ut=/@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"]\s*\)?/g,mt=/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/g,Q=class extends I{constructor(){super("css")}parse(n,s={}){let{content:i,id:e}=n,t=[];if(t.push(...this.extractMatches(i,new RegExp(ut.source,"g"),"css-import",e,c=>`@import "${c[1]}"`)),s.includeUrls){let c=this.extractMatches(i,new RegExp(mt.source,"g"),"css-url",e,p=>`url("${p[1]}")`);t.push(...c.filter(p=>!p.target.startsWith("data:")&&!p.target.startsWith("http:")&&!p.target.startsWith("https:")&&!p.target.startsWith("#")))}return t}};var ee=class extends G{constructor(){super(),this.language="typescript"}};var ft=/^import\s+([\w.]+)/gm,ht=/^from\s+([\w.]+)\s+import/gm,ve=/^[ \t]*def\s+(\w+)\s*\(/gm,be=/^[ \t]*class\s+(\w+)\s*[:(]/gm,gt=/__all__\s*=\s*\[([^\]]*)\]/gs,yt=/^[ \t]*@(\w+)/gm,xe=new Set(["print","len","range","int","str","float","list","dict","set","tuple","bool","type","isinstance","issubclass","hasattr","getattr","setattr","delattr","callable","super","property","staticmethod","classmethod","abs","all","any","bin","chr","dir","divmod","enumerate","eval","exec","filter","format","frozenset","globals","hash","hex","id","input","iter","locals","map","max","min","next","object","oct","open","ord","pow","repr","reversed","round","slice","sorted","sum","vars","zip","breakpoint","compile","complex","memoryview","bytearray","bytes","__import__","__name__","__file__","__doc__"]),te=class extends I{constructor(){super("python")}parse(n){let{content:s,id:i}=n,e=[];return e.push(...this.extractMatches(s,new RegExp(ft.source,"gm"),"import",i,t=>`import ${t[1]}`)),e.push(...this.extractMatches(s,new RegExp(ht.source,"gm"),"from-import",i,t=>`from ${t[1]} import`)),e}extractSymbols(n){let{content:s}=n,i={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[]},e=this.stripCommentsAndStrings(s),t,c=new RegExp(ve.source,"gm");for(;(t=c.exec(e))!==null;){let h=t[1],g=e.substring(0,t.index).split(`
`).length,l=h.startsWith("__")&&h.endsWith("__");i.functions.push({name:h,type:l?"dunder":"function",line:g})}let p=new RegExp(be.source,"gm");for(;(t=p.exec(e))!==null;){let h=t[1],g=e.substring(0,t.index).split(`
`).length;i.classes.push({name:h,type:"class",line:g})}let d=new RegExp(gt.source,"gs");for(;(t=d.exec(e))!==null;){let h=t[1].split(",");for(let g of h){let l=g.trim().match(/['"](\w+)['"]/);l&&i.exports.push({name:l[1],type:"export-all"})}}let m=new RegExp(yt.source,"gm"),r=new Set;for(;(t=m.exec(e))!==null;){let h=t[1];if(!r.has(h)&&!xe.has(h)){r.add(h);let g=e.substring(0,t.index).split(`
`).length;i.macros.push({name:h,type:"decorator",line:g})}}return i}extractCalls(n){let{content:s}=n,i=this.stripCommentsAndStrings(s),e=new Set,t,c=new RegExp(ve.source,"gm");for(;(t=c.exec(i))!==null;)e.add(t[1]);let p=new RegExp(be.source,"gm");for(;(t=p.exec(i))!==null;)e.add(t[1]);let d=new Set,m=/(?:^|[^.\w])(\w+)\s*\(/g;for(;(t=m.exec(i))!==null;){let r=t[1];!xe.has(r)&&!e.has(r)&&!/^[A-Z_]+$/.test(r)&&r!=="def"&&r!=="class"&&r!=="if"&&r!=="for"&&r!=="while"&&r!=="return"&&r!=="elif"&&r!=="assert"&&r!=="raise"&&r!=="yield"&&r!=="lambda"&&r!=="not"&&r!=="and"&&r!=="or"&&d.add(r)}return[...d]}stripCommentsAndStrings(n){let s=n.replace(/"""[\s\S]*?"""/g,'""');return s=s.replace(/'''[\s\S]*?'''/g,"''"),s=s.replace(/"(?:[^"\\]|\\.)*"/g,'""'),s=s.replace(/'(?:[^'\\]|\\.)*'/g,"''"),s=s.replace(/#.*$/gm,""),s}};var wt=/\b(if|else\s+if|for|while|do|switch|case|catch)\b/g,vt=/(\|\||&&)/g,bt=/[^?]\?[^?:]/g,xt=/[^{}]+(?=\s*\{)/g,Rt=/@media\b/g;function Re(o){let{content:n,language:s}=o;switch(s){case"c":case"javascript":case"typescript":return Ce(n);case"css":return Ct(n);case"html":return St(n);default:return{complexity:1,details:{}}}}function Ce(o){let n=o.replace(/\/\/.*$/gm,"").replace(/\/\*[\s\S]*?\*\//g,"").replace(/"(?:[^"\\]|\\.)*"/g,'""').replace(/'(?:[^'\\]|\\.)*'/g,"''"),s=1,i={},e={},t=new RegExp(wt.source,"g"),c;for(;(c=t.exec(n))!==null;){let h=c[1].replace(/\s+/g," ");e[h]=(e[h]||0)+1,s++}i.keywords=e;let p=new RegExp(vt.source,"g"),d=0;for(;(c=p.exec(n))!==null;)d++,s++;i.logicalOperators=d;let m=new RegExp(bt.source,"g"),r=0;for(;(c=m.exec(n))!==null;)r++,s++;return i.ternaryOperators=r,{complexity:s,details:i}}function Ct(o){let n=o.replace(/\/\*[\s\S]*?\*\//g,""),s=0,i=new RegExp(xt.source,"g"),e;for(;(e=i.exec(n))!==null;){let d=e[0].split(",").filter(m=>m.trim().length>0);s+=d.length}let t=0,c=new RegExp(Rt.source,"g");for(;(e=c.exec(n))!==null;)t++;return{complexity:Math.max(1,Math.round(1+s/10+t)),details:{selectors:s,mediaQueries:t}}}function St(o){let n=/\bon\w+\s*=/gi,s=0,i;for(;(i=n.exec(o))!==null;)s++;let e=/<script\b[^>]*>[\s\S]*?<\/script>/gi,t=0,c=0;for(;(i=e.exec(o))!==null;){t++;let d=Ce(i[0]);c+=d.complexity-1}return{complexity:Math.max(1,1+s+c),details:{eventHandlers:s,scriptBlocks:t,inlineJSComplexity:c}}}var re={c:new X,javascript:new G,typescript:new ee,python:new te,html:new K,css:new Q};function Et(o,n,s){if(s.has(o))return o;let i=(0,$.dirname)(n),e=(0,$.normalize)((0,$.join)(i,o));if(s.has(e))return e;let t=[".js",".ts",".py",".c",".h",".css",".html"];for(let d of t){if(s.has(e+d))return e+d;if(s.has(o+d))return o+d}let c=(0,$.join)(e,"index.js");if(s.has(c))return c;let p=(0,$.basename)(o);for(let[d,m]of s)if(m.name===p)return d;for(let d of t){let m=p+d;for(let[r,h]of s)if(h.name===m)return r}return null}function kt(o){let n=new Map;for(let m of o)n.has(m.source)||n.set(m.source,[]),n.get(m.source).push(m.target);let s=[],i=new Set,e=new Set,t=[];function c(m){i.add(m),e.add(m),t.push(m);let r=n.get(m)||[];for(let h of r)if(e.has(h)){let g=t.indexOf(h);if(g>=0){let l=t.slice(g);l.length>=2&&s.push(l)}}else i.has(h)||c(h);t.pop(),e.delete(m)}for(let m of n.keys())i.has(m)||c(m);let p=[],d=new Set;for(let m of s){let h=[...m].sort().join("|");d.has(h)||(d.add(h),p.push(m))}return p}function le(o,n="Project",s={}){let i=new Map;for(let a of o)i.set(a.id,a);let e=[];for(let a of o){let f=re[a.language];if(f){let v=f.parse(a,s);e.push(...v)}}let t=new Map,c={c:"c",javascript:"js",typescript:"js",python:"py"},p=new Map,d=new Set(["c","javascript","typescript","python"]);for(let a of o){if(!d.has(a.language))continue;let f=re[a.language];if(!f.extractSymbols)continue;let v=f.extractSymbols(a);t.set(a.id,v);let x=c[a.language]||a.language;for(let L of v.functions){let b=`${x}:${L.name}`;p.has(b)||p.set(b,[]),p.get(b).push(a.id)}}let m=[],r=new Set([".h",".hpp",".d.ts"]);for(let a of o){if(!d.has(a.language)||r.has(a.extension))continue;let f=re[a.language];if(!f.extractCalls)continue;let v=f.extractCalls(a),x=t.get(a.id),L=new Set(x?x.functions.map(W=>W.name):[]),b=c[a.language]||a.language;for(let W of v){if(L.has(W))continue;let Te=`${b}:${W}`,ue=p.get(Te);if(ue)for(let me of ue)me!==a.id&&m.push({source:a.id,target:me,type:"function-call",label:`${W}()`})}}let h=new Map;for(let a of o){let f=Re(a);h.set(a.id,f)}let g=[],l={count:0,targets:[]};for(let a of e){let f=Et(a.target,a.source,i);f?f!==a.source&&g.push({source:a.source,target:f,type:a.type,label:a.label}):(l.count++,l.targets.length<20&&l.targets.push({from:a.source,ref:a.target}))}g.push(...m);let w=new Set,E=g.filter(a=>{let f=`${a.source}|${a.target}|${a.type}`;return w.has(f)?!1:(w.add(f),!0)}),A=new Map,z=new Map;for(let a of E)A.set(a.source,(A.get(a.source)||0)+1),z.set(a.target,(z.get(a.target)||0)+1);let q=new Set,_e=/(?:^|[^.\w])(\w+)\s*\(/gm;for(let a of o){let f,v=new RegExp(_e.source,"gm");for(;(f=v.exec(a.content))!==null;)q.add(f[1])}let de=new Map;for(let a of o){let f=t.get(a.id);if(!f)continue;let v=[];for(let x of f.functions)x.name!=="main"&&x.type!=="dunder"&&(q.has(x.name)||v.push(x.name));for(let x of f.classes)q.has(x.name)||v.push(x.name);for(let x of f.exports)!q.has(x.name)&&!v.includes(x.name)&&v.push(x.name);v.length>0&&de.set(a.id,v)}let T=o.map(a=>{let f=t.get(a.id),v=h.get(a.id)||{complexity:1,details:{}},x={id:a.id,name:a.name,path:a.path,language:a.language,extension:a.extension,size:a.size,linesOfCode:a.linesOfCode,lastModified:a.lastModified||0,group:a.group,fanOut:A.get(a.id)||0,fanIn:z.get(a.id)||0,complexity:v.complexity,complexityDetails:v.details};f&&(x.symbols={functions:f.functions.map(b=>({name:b.name,returnType:b.returnType||"",params:b.params||"",line:b.line||0,type:b.type})),structs:f.structs.map(b=>({name:b.name,type:b.type})),enums:f.enums.map(b=>({name:b.name,type:b.type})),macros:f.macros.slice(0,30),classes:f.classes.map(b=>({name:b.name,type:b.type})),exports:f.exports.map(b=>({name:b.name,type:b.type})),totalSymbols:f.functions.length+f.structs.length+f.enums.length+f.macros.length+f.classes.length+f.exports.length});let L=de.get(a.id);return L&&L.length>0&&(x.deadExports=L),x}),P={};for(let a of T)P[a.language]||(P[a.language]={count:0,totalLOC:0,avgComplexity:0}),P[a.language].count++,P[a.language].totalLOC+=a.linesOfCode,P[a.language].avgComplexity+=a.complexity;for(let a in P)P[a].avgComplexity=Math.round(P[a].avgComplexity/P[a].count*10)/10;let De=new Set(T.map(a=>a.group)),Pe=E.filter(a=>a.type==="function-call").length,Ae=T.filter(a=>a.deadExports&&a.deadExports.length>0).length,$e=T.reduce((a,f)=>a+(f.deadExports?f.deadExports.length:0),0),oe=kt(E),Oe=new Map(T.map(a=>[a.id,a]));for(let a=0;a<oe.length;a++)for(let f of oe[a]){let v=Oe.get(f);v&&(v.cycleIds||(v.cycleIds=[]),v.cycleIds.push(a))}return{meta:{projectName:n,analyzedAt:new Date().toISOString(),totalFiles:T.length,totalLinks:E.length,totalRelationsFound:e.length,functionCallLinks:Pe,unresolvedReferences:l.count,unresolvedSamples:l.targets,deadCodeFiles:Ae,deadExportsTotal:$e,cycles:oe,languageStats:P,groups:[...De].sort()},nodes:T,links:E}}var Se=require("child_process"),Ee=require("util"),Ft=(0,Ee.promisify)(Se.execFile),us=50*1024*1024;async function ce(o){try{return await Ft("git",["rev-parse","--is-inside-work-tree"],{cwd:o}),!0}catch{return!1}}var y,S,O=[],D,ke,j,F,V,ne,se=!1;function It(o){ne=new Z;let n=u.window.createTreeView("auraVisualizer.statsView",{treeDataProvider:ne,showCollapseAll:!0});o.subscriptions.push(n),F=u.window.createStatusBarItem(u.StatusBarAlignment.Left,50),F.command="auraVisualizer.open",F.text="$(eye) Aura",F.tooltip="Open Aura 3D Visualizer",F.show(),o.subscriptions.push(F),o.subscriptions.push(u.commands.registerCommand("auraVisualizer.open",()=>_t(o)),u.commands.registerCommand("auraVisualizer.refresh",()=>ie(o)),u.commands.registerCommand("auraVisualizer.focusFile",()=>Ot()),u.commands.registerCommand("auraVisualizer.openFileFromTree",s=>{let i=u.workspace.workspaceFolders?.[0];if(!i)return;let e=k.join(i.uri.fsPath,s);u.window.showTextDocument(u.Uri.file(e),{preview:!0})}),u.commands.registerCommand("auraVisualizer.exportGraph",()=>Tt())),Mt(o),o.subscriptions.push(u.window.onDidChangeActiveTextEditor(s=>{if(s&&y?.isVisible){let i=u.workspace.workspaceFolders?.[0];if(i){let e=k.relative(i.uri.fsPath,s.document.uri.fsPath);e.startsWith("..")||y.focusNode(e)}}})),o.subscriptions.push(u.window.onDidChangeActiveColorTheme(s=>{y?.sendTheme(s.kind)})),u.window.registerWebviewPanelSerializer(N.viewType,{async deserializeWebviewPanel(s){y||(y=new N(o.extensionUri),Fe()),y.restore(s),S&&y.sendGraphData(S)}}),u.workspace.workspaceFolders?.length&&ie(o)}function Fe(){y&&y.onOpenFile(async({path:o,line:n})=>{let s=u.workspace.workspaceFolders?.[0];if(!s)return;let i=k.join(s.uri.fsPath,o),e=u.Uri.file(i);try{let t=await u.workspace.openTextDocument(e),c=await u.window.showTextDocument(t,{preserveFocus:!1});if(n&&n>0){let p=new u.Position(n-1,0);c.selection=new u.Selection(p,p),c.revealRange(new u.Range(p,p),u.TextEditorRevealType.InCenter)}}catch{}})}async function _t(o){y||(y=new N(o.extensionUri),Fe()),y.show(),S?y.sendGraphData(S):await ie(o)}async function ie(o){if(se)return;se=!0;let n=u.workspace.workspaceFolders?.[0];if(!n){se=!1,u.window.showWarningMessage("Aura: No workspace folder open.");return}let s=n.uri.fsPath,e=u.workspace.getConfiguration("auraVisualizer").get("excludePaths",["node_modules",".git","dist","build","out","__pycache__"]);F&&(F.text="$(loading~spin) Aura: Analyzing...");try{let t=await u.window.withProgress({location:u.ProgressLocation.Window,title:"Aura: Analyzing codebase..."},()=>Dt(o.extensionUri,s,e,n.name));S=t.graphData,O=t.files,y&&y.sendGraphData(S),ne?.update(S),Ie(),$t(o,s,e)}catch(t){let c=t instanceof Error?t.message:String(t);u.window.showErrorMessage(`Aura: Analysis failed \u2014 ${c}`),F&&(F.text="$(eye) Aura")}finally{se=!1}}function Dt(o,n,s,i){return new Promise((e,t)=>{let c=k.join(o.fsPath,"out","analyzer-worker.js"),p=new pe.Worker(c,{workerData:{rootPath:n,skipDirs:s,projectName:i}});p.on("message",d=>{d.error?t(new Error(d.error)):e({graphData:d.graphData,files:d.files}),p.terminate()}),p.on("error",d=>{t(d),p.terminate()}),p.on("exit",d=>{d!==0&&t(new Error(`Worker exited with code ${d}`))})})}async function Pt(o,n){let s=u.workspace.workspaceFolders?.[0];if(!s||O.length===0)return;let i=s.uri.fsPath,e=k.relative(i,o.fsPath);if(e.startsWith(".."))return;if(n)O=O.filter(p=>p.id!==e);else{let p=await ae(o.fsPath,i);if(!p)return;let d=O.findIndex(m=>m.id===e);d>=0?O[d]=p:O.push(p)}let t=S,c=s.name;if(S=le(O,c),y?.isVisible&&S)if(t){let p=At(t,S,e,n);y.sendGraphDelta(p)}else y.sendGraphData(S);ne?.update(S),Ie()}function At(o,n,s,i){let e={changedNodes:[],removedNodeIds:[],addedLinks:[],removedLinks:[],meta:n.meta};i&&e.removedNodeIds.push(s);let t=new Map(o.nodes.map(r=>[r.id,r])),c=new Map(n.nodes.map(r=>[r.id,r]));for(let r of n.nodes){let h=t.get(r.id);(!h||r.fanIn!==h.fanIn||r.fanOut!==h.fanOut||r.complexity!==h.complexity||r.linesOfCode!==h.linesOfCode||r.size!==h.size)&&e.changedNodes.push(r)}for(let r of o.nodes)c.has(r.id)||e.removedNodeIds.includes(r.id)||e.removedNodeIds.push(r.id);let p=r=>`${typeof r.source=="object"?r.source.id:r.source}|${typeof r.target=="object"?r.target.id:r.target}|${r.type}`,d=new Set(o.links.map(p)),m=new Set(n.links.map(p));for(let r of n.links)d.has(p(r))||e.addedLinks.push(r);for(let r of o.links)m.has(p(r))||e.removedLinks.push({source:typeof r.source=="object"?r.source.id:r.source,target:typeof r.target=="object"?r.target.id:r.target,type:r.type});return e}function Ie(){if(!F||!S)return;let{totalFiles:o,totalLinks:n}=S.meta;F.text=`$(eye) Aura: ${o} files, ${n} links`,F.tooltip=`Aura \u2014 ${o} files, ${n} dependencies
Click to open 3D visualizer`}async function $t(o,n,s){if(!await ce(n))return;D&&(D.terminate(),D=void 0);let e=k.join(n,".aura","history"),t=k.join(o.extensionUri.fsPath,"out","history-worker.js");D=new pe.Worker(t,{workerData:{rootPath:n,skipDirs:s,historyDir:e}}),D.on("message",c=>{switch(c.type){case"index":ke=c.payload,y&&y.sendHistoryIndex(ke);break;case"progress":{let p=c.payload;y&&y.sendHistoryProgress(p.scanned,p.total);break}case"delta":{let p=c.payload;y&&y.sendHistoryDelta(p);break}case"done":break;case"error":break}}),D.on("error",()=>{}),D.on("exit",()=>{D=void 0})}function Ot(){let o=u.window.activeTextEditor;if(!o||!y?.isVisible)return;let n=u.workspace.workspaceFolders?.[0];if(!n)return;let s=k.relative(n.uri.fsPath,o.document.uri.fsPath);s.startsWith("..")||y.focusNode(s)}async function Tt(){let o=u.workspace.workspaceFolders?.[0];if(!o){u.window.showWarningMessage("Aura: No workspace folder open.");return}if(!S){u.window.showWarningMessage("Aura: No graph data. Run analysis first (Ctrl+Shift+A).");return}let n=k.join(o.uri.fsPath,".aura");await Y.mkdir(n,{recursive:!0});let s=S,i={meta:s.meta,nodes:s.nodes.map(t=>({id:t.id,name:t.name,path:t.path,language:t.language,extension:t.extension,size:t.size,linesOfCode:t.linesOfCode,group:t.group,fanIn:t.fanIn,fanOut:t.fanOut,complexity:t.complexity})),links:s.links.map(t=>({source:t.source,target:t.target,type:t.type,label:t.label}))};await Y.writeFile(k.join(n,"graph.json"),JSON.stringify(i,null,2),"utf-8");let e=Lt(s);await Y.writeFile(k.join(n,"summary.md"),e,"utf-8"),u.window.showInformationMessage("Aura: Exported to .aura/ \u2014 graph.json + summary.md","Open summary").then(t=>{t==="Open summary"&&u.window.showTextDocument(u.Uri.file(k.join(n,"summary.md")),{preview:!0})})}function Lt(o){let{meta:n,nodes:s,links:i}=o,e=[];e.push(`# Aura Graph \u2014 ${n.projectName}`),e.push(`> Auto-generated by Aura Visualizer on ${n.analyzedAt}`),e.push("> This file describes the codebase architecture for AI-assisted development."),e.push(""),e.push("## Overview"),e.push(`- **${n.totalFiles}** files, **${n.totalLinks}** dependencies`);let t=Object.entries(n.languageStats).sort((l,w)=>w[1].count-l[1].count).map(([l,w])=>`${l} (${w.count} files, ${w.totalLOC} LOC)`);if(e.push(`- Languages: ${t.join(", ")}`),n.unresolvedReferences>0&&e.push(`- Unresolved references: ${n.unresolvedReferences}`),e.push(""),n.groups.length>0){e.push("## Directory Structure");for(let l of n.groups){let w=s.filter(A=>A.group===l),E=w.reduce((A,z)=>A+z.linesOfCode,0);e.push(`- \`${l}/\` \u2014 ${w.length} files, ${E} LOC`)}e.push("")}let c=[...s].sort((l,w)=>w.fanIn-l.fanIn).slice(0,15).filter(l=>l.fanIn>0);if(c.length>0){e.push("## Hotspots (most depended-on files)"),e.push("| File | Fan-in | Fan-out | Complexity | LOC |"),e.push("|------|--------|---------|------------|-----|");for(let l of c)e.push(`| \`${l.id}\` | ${l.fanIn} | ${l.fanOut} | ${l.complexity} | ${l.linesOfCode} |`);e.push("")}let p=[...s].sort((l,w)=>w.complexity-l.complexity).slice(0,10).filter(l=>l.complexity>1);if(p.length>0){e.push("## Most Complex Files"),e.push("| File | Complexity | LOC | Fan-in | Fan-out |"),e.push("|------|------------|-----|--------|---------|");for(let l of p)e.push(`| \`${l.id}\` | ${l.complexity} | ${l.linesOfCode} | ${l.fanIn} | ${l.fanOut} |`);e.push("")}let d=[...s].sort((l,w)=>w.linesOfCode-l.linesOfCode).slice(0,10);if(d.length>0){e.push("## Largest Files"),e.push("| File | LOC | Complexity | Language |"),e.push("|------|-----|------------|----------|");for(let l of d)e.push(`| \`${l.id}\` | ${l.linesOfCode} | ${l.complexity} | ${l.language} |`);e.push("")}let m=s.filter(l=>l.fanIn===0&&l.fanOut===0);if(m.length>0){e.push("## Orphan Files (no dependencies)");for(let l of m)e.push(`- \`${l.id}\` (${l.language}, ${l.linesOfCode} LOC)`);e.push("")}let r=[],h=new Set(i.map(l=>`${l.source}\u2192${l.target}`));for(let l of i){let w=`${l.target}\u2192${l.source}`;h.has(w)&&l.source<l.target&&r.push(`\`${l.source}\` \u2194 \`${l.target}\``)}if(r.length>0){e.push("## Circular Dependencies");for(let l of r)e.push(`- ${l}`);e.push("")}let g={};for(let l of i)g[l.type]=(g[l.type]||0)+1;if(Object.keys(g).length>0){e.push("## Dependency Types");for(let[l,w]of Object.entries(g).sort((E,A)=>A[1]-E[1]))e.push(`- **${l}**: ${w}`);e.push("")}return e.push("## Usage Notes for AI Agents"),e.push("- Files with high fan-in are **critical hubs** \u2014 changes impact many dependents."),e.push("- Check circular dependencies before refactoring \u2014 break cycles where possible."),e.push("- Orphan files may be dead code candidates for cleanup."),e.push("- Use `graph.json` for programmatic queries (e.g., find all dependents of a file)."),e.push("- High complexity files (>15) are prime candidates for decomposition."),e.push(""),e.join(`
`)}function Mt(o){if(!u.workspace.getConfiguration("auraVisualizer").get("autoRefresh",!0))return;j=u.workspace.createFileSystemWatcher("**/*.{c,h,js,ts,py,css,html}");let i=new Map,e=()=>{V&&clearTimeout(V),V=setTimeout(async()=>{let t=new Map(i);if(i.clear(),O.length===0){y?.isVisible?ie(o):S=void 0;return}for(let[,c]of t)await Pt(c.uri,c.deleted)},500)};j.onDidChange(t=>{i.set(t.fsPath,{uri:t,deleted:!1}),e()}),j.onDidCreate(t=>{i.set(t.fsPath,{uri:t,deleted:!1}),e()}),j.onDidDelete(t=>{i.set(t.fsPath,{uri:t,deleted:!0}),e()}),o.subscriptions.push(j)}function Nt(){y?.dispose(),j?.dispose(),V&&clearTimeout(V),D&&(D.terminate(),D=void 0)}0&&(module.exports={activate,deactivate});
