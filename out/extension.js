"use strict";var xe=Object.create;var z=Object.defineProperty;var Re=Object.getOwnPropertyDescriptor;var Ce=Object.getOwnPropertyNames;var ke=Object.getPrototypeOf,Se=Object.prototype.hasOwnProperty;var Fe=(o,t)=>()=>(o&&(t=o(o=0)),t);var re=(o,t)=>{for(var s in t)z(o,s,{get:t[s],enumerable:!0})},le=(o,t,s,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let e of Ce(t))!Se.call(o,e)&&e!==s&&z(o,e,{get:()=>t[e],enumerable:!(i=Re(t,e))||i.enumerable});return o};var L=(o,t,s)=>(s=o!=null?xe(ke(o)):{},le(t||!o||!o.__esModule?z(s,"default",{value:o,enumerable:!0}):s,o)),Ee=o=>le(z({},"__esModule",{value:!0}),o);var de={};re(de,{LANGUAGE_MAP:()=>se,SKIP_DIRS:()=>pe,SUPPORTED_EXTENSIONS:()=>te,scanDirectory:()=>ne,scanSingleFile:()=>V});async function ne(o,t={}){let s=t.extensions||te,i=new Set([...pe,...t.skipDirs||[]]),e=new Set([...i].map(p=>p.toLowerCase())),n=[];async function l(p){let u;try{u=await(0,T.readdir)(p,{withFileTypes:!0})}catch{return}for(let m of u){let c=(0,_.join)(p,m.name);if(m.isDirectory())e.has(m.name.toLowerCase())||await l(c);else if(m.isFile()){let h=(0,_.extname)(m.name).toLowerCase();if(s.has(h))try{let R=await(0,T.stat)(c),a=await(0,T.readFile)(c,"utf-8"),g=a.split(`
`).filter(ee=>ee.trim().length>0).length,k=(0,_.relative)(o,c),S=k.split("/"),C=S.length>1?S[0]:"/";n.push({id:k,name:m.name,path:k,fullPath:c,language:se[h]||"unknown",extension:h,size:R.size,linesOfCode:g,lastModified:Math.floor(R.mtimeMs),group:C,content:a})}catch{}}}}return await l(o),n}async function V(o,t){let s=(0,_.extname)(o).toLowerCase();if(!te.has(s))return null;try{let i=await(0,T.stat)(o),e=await(0,T.readFile)(o,"utf-8"),n=e.split(`
`).filter(c=>c.trim().length>0).length,l=(0,_.relative)(t,o),p=l.split("/"),u=p.length>1?p[0]:"/",m=p[p.length-1];return{id:l,name:m,path:l,fullPath:o,language:se[s]||"unknown",extension:s,size:i.size,linesOfCode:n,lastModified:Math.floor(i.mtimeMs),group:u,content:e}}catch{return null}}var T,_,te,se,pe,ie=Fe(()=>{"use strict";T=require("fs/promises"),_=require("path"),te=new Set([".c",".h",".js",".ts",".py",".css",".html",".htm"]),se={".c":"c",".h":"c",".js":"javascript",".ts":"typescript",".py":"python",".css":"css",".html":"html",".htm":"html"},pe=new Set(["node_modules",".git",".svn",".hg","dist","build","out",".next","__pycache__",".vscode",".idea","Backup","Tests"])});var dt={};re(dt,{activate:()=>st,deactivate:()=>pt});module.exports=Ee(dt);var d=L(require("vscode")),$=L(require("path")),U=L(require("fs/promises"));var w=L(require("vscode")),ce=L(require("path")),A=class o{static viewType="auraVisualizer.graphView";panel;extensionUri;disposables=[];onOpenFileEmitter=new w.EventEmitter;onOpenFile=this.onOpenFileEmitter.event;onDisposeEmitter=new w.EventEmitter;onDidDispose=this.onDisposeEmitter.event;pendingData;webviewReady=!1;constructor(t){this.extensionUri=t}show(){return this.panel?(this.panel.reveal(w.ViewColumn.One),this.panel):(this.panel=w.window.createWebviewPanel(o.viewType,"Aura \u2014 3D Visualizer",w.ViewColumn.One,{enableScripts:!0,retainContextWhenHidden:!0,localResourceRoots:[w.Uri.joinPath(this.extensionUri,"out","webview")]}),this.initPanel(),this.panel)}restore(t){this.panel=t,t.webview.options={enableScripts:!0,localResourceRoots:[w.Uri.joinPath(this.extensionUri,"out","webview")]},this.initPanel()}initPanel(){this.panel&&(this.panel.iconPath=w.Uri.joinPath(this.extensionUri,"resources","icon.png"),this.panel.webview.html=this.getHtmlContent(this.panel.webview),this.setupMessageHandler(),this.panel.onDidDispose(()=>{this.panel=void 0,this.webviewReady=!1,this.disposables.forEach(t=>t.dispose()),this.disposables=[],this.onDisposeEmitter.fire()}))}setupMessageHandler(){this.panel&&this.panel.webview.onDidReceiveMessage(t=>{switch(t.type){case"ready":this.webviewReady=!0,this.pendingData&&this.panel?.webview.postMessage({type:"graphData",payload:this.pendingData});break;case"openFile":t.payload&&this.onOpenFileEmitter.fire({path:t.payload.path,line:t.payload.line});break;case"requestRefresh":w.commands.executeCommand("auraVisualizer.refresh");break;case"requestExport":w.commands.executeCommand("auraVisualizer.exportGraph");break}},null,this.disposables)}sendGraphData(t){this.pendingData=t,this.webviewReady&&this.panel?.webview.postMessage({type:"graphData",payload:t})}sendGraphDelta(t){this.webviewReady&&this.panel?.webview.postMessage({type:"updateGraph",payload:t})}focusNode(t){this.panel?.webview.postMessage({type:"focusNode",payload:{nodeId:t}})}sendTheme(t){this.panel?.webview.postMessage({type:"themeChanged",payload:{kind:t}})}get isVisible(){return this.panel?.visible??!1}dispose(){this.panel?.dispose()}getHtmlContent(t){let s=ce.join("out","webview"),i=t.asWebviewUri(w.Uri.joinPath(this.extensionUri,s,"css","style.css")),e=t.asWebviewUri(w.Uri.joinPath(this.extensionUri,s,"js","app.js")),n=t.asWebviewUri(w.Uri.joinPath(this.extensionUri,s,"js","graph-config.js")),l=t.asWebviewUri(w.Uri.joinPath(this.extensionUri,s,"lib","3d-force-graph.min.js")),p=t.asWebviewUri(w.Uri.joinPath(this.extensionUri,s,"lib","three.global.js")),u=Ie();return`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${t.cspSource} 'unsafe-inline'; script-src 'nonce-${u}' 'unsafe-eval' ${t.cspSource}; img-src ${t.cspSource} data:; font-src ${t.cspSource};">
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
    </footer>

    <!-- Tooltip -->
    <div id="tooltip" class="hidden">
        <div class="tooltip-name" id="tooltip-name">\u2014</div>
        <div class="tooltip-meta" id="tooltip-meta">\u2014</div>
    </div>

    <!-- Libraries: THREE must load before 3d-force-graph (it checks window.THREE) -->
    <script nonce="${u}" src="${p}"></script>
    <script nonce="${u}" src="${l}"></script>
    <!-- App Logic -->
    <script nonce="${u}" src="${n}"></script>
    <script nonce="${u}" src="${e}"></script>
</body>
</html>`}};function Ie(){let o=new Uint8Array(16);return require("crypto").randomFillSync(o),Array.from(o,t=>t.toString(16).padStart(2,"0")).join("")}var y=L(require("vscode")),D=class extends y.TreeItem{constructor(s,i){let e=s.kind==="file"?s.node.name:s.kind==="stat"?`${s.label}: ${s.value}`:s.label;super(e,i);this.entry=s;s.kind==="header"?this.iconPath=new y.ThemeIcon(s.icon):s.kind==="stat"?this.iconPath=new y.ThemeIcon(s.icon):s.kind==="file"&&(this.description=s.metric,this.iconPath=new y.ThemeIcon("file"),this.command={command:"auraVisualizer.openFileFromTree",title:"Open File",arguments:[s.node.path]},this.tooltip=`${s.node.path}
Complexity: ${s.node.complexity}
Lines: ${s.node.linesOfCode}
Fan-in: ${s.node.fanIn} / Fan-out: ${s.node.fanOut}`)}},W=class{_onDidChangeTreeData=new y.EventEmitter;onDidChangeTreeData=this._onDidChangeTreeData.event;data;update(t){this.data=t,this._onDidChangeTreeData.fire(void 0)}getTreeItem(t){return t}getChildren(t){if(!this.data)return[new D({kind:"stat",label:"No data",value:"Open a workspace and run Aura",icon:"info"},y.TreeItemCollapsibleState.None)];if(!t)return[new D({kind:"header",label:"Stats",icon:"graph"},y.TreeItemCollapsibleState.Expanded),new D({kind:"header",label:"Most Complex",icon:"flame"},y.TreeItemCollapsibleState.Collapsed),new D({kind:"header",label:"Largest Files",icon:"file-binary"},y.TreeItemCollapsibleState.Collapsed),new D({kind:"header",label:"Orphan Files",icon:"warning"},y.TreeItemCollapsibleState.Collapsed)];if(t.entry.kind!=="header")return[];let s=this.data;switch(t.entry.label){case"Stats":{let i=Object.entries(s.meta.languageStats).map(([e,n])=>`${e}: ${n.count}`).join(", ");return[this.stat("Files",String(s.meta.totalFiles),"file"),this.stat("Links",String(s.meta.totalLinks),"link"),this.stat("Function Calls",String(s.meta.functionCallLinks),"symbol-method"),this.stat("Groups",String(s.meta.groups.length),"folder"),this.stat("Languages",i,"symbol-color")]}case"Most Complex":return[...s.nodes].sort((i,e)=>e.complexity-i.complexity).slice(0,10).map(i=>new D({kind:"file",node:i,metric:`complexity: ${i.complexity}`},y.TreeItemCollapsibleState.None));case"Largest Files":return[...s.nodes].sort((i,e)=>e.linesOfCode-i.linesOfCode).slice(0,10).map(i=>new D({kind:"file",node:i,metric:`${i.linesOfCode} lines`},y.TreeItemCollapsibleState.None));case"Orphan Files":return s.nodes.filter(i=>i.fanIn===0&&i.fanOut===0).map(i=>new D({kind:"file",node:i,metric:i.language},y.TreeItemCollapsibleState.None));default:return[]}}stat(t,s,i){return new D({kind:"stat",label:t,value:s,icon:i},y.TreeItemCollapsibleState.None)}};ie();var P=require("path");var E=class{language;constructor(t){this.language=t}parse(t,s){return[]}extractMatches(t,s,i,e,n){let l=[],p;for(;(p=s.exec(t))!==null;){let u=p[1];u&&l.push({source:e,target:u,type:i,label:n?n(p):`${i}: ${u}`})}return l}};var De=/#include\s*"([^"]+)"/g,$e=/#include\s*<([^>]+)>/g,Pe=/^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?((?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+)([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/gm,Oe=/extern\s+[\w\s*]+\s+(\w+)\s*\([^)]*\)\s*;/g,Te=/(?:typedef\s+)?struct\s+(\w+)\s*\{/g,_e=/typedef\s+struct\s*(?:\w+\s*)?\{[^}]*\}\s*(\w+)\s*;/gs,Le=/(?:typedef\s+)?enum\s+(\w+)\s*\{/g,Ae=/^[ \t]*#define\s+(\w+)(?:\(([^)]*)\))?/gm,ue=new Set(["if","else","for","while","do","switch","case","return","break","continue","goto","sizeof","typeof","typedef","struct","union","enum","static","extern","inline","const","volatile","register","auto","void","int","char","float","double","long","short","unsigned","signed","bool","BOOL","printf","fprintf","sprintf","snprintf","scanf","sscanf","malloc","calloc","realloc","free","memcpy","memset","memmove","strlen","strcpy","strncpy","strcmp","strncmp","strcat","fopen","fclose","fread","fwrite","fseek","ftell","exit","abort","assert","NULL","true","false","defined","offsetof","va_start","va_end","va_arg","__attribute__","__declspec","visibility","__extension__"]),B=class extends E{constructor(){super("c")}parse(t,s={}){let{content:i,id:e}=t,n=[];return n.push(...this.extractMatches(i,new RegExp(De.source,"g"),"include",e,l=>`#include "${l[1]}"`)),s.includeSystemHeaders&&n.push(...this.extractMatches(i,new RegExp($e.source,"g"),"system-include",e,l=>`#include <${l[1]}>`)),n}extractSymbols(t){let{content:s}=t,i={functions:[],externs:[],structs:[],enums:[],macros:[]},e=this.stripComments(s),n,l=new RegExp(Pe.source,"gm");for(;(n=l.exec(e))!==null;){let R=(n[1]||"").trim(),a=n[2],g=(n[3]||"").trim();if(!ue.has(a)){let k=e.substring(0,n.index).split(`
`).length;i.functions.push({name:a,returnType:R,params:g,line:k,type:"function"})}}let p=new RegExp(Oe.source,"g");for(;(n=p.exec(e))!==null;)i.externs.push({name:n[1],type:"extern"});let u=new RegExp(Te.source,"g");for(;(n=u.exec(e))!==null;)i.structs.push({name:n[1],type:"struct"});let m=new RegExp(_e.source,"gs");for(;(n=m.exec(e))!==null;)i.structs.push({name:n[1],type:"typedef-struct"});let c=new RegExp(Le.source,"g");for(;(n=c.exec(e))!==null;)i.enums.push({name:n[1],type:"enum"});let h=new RegExp(Ae.source,"gm");for(;(n=h.exec(e))!==null;){let R=n[1],a=n[2]!==void 0;i.macros.push({name:R,type:a?"function-macro":"constant-macro"})}return i}extractCalls(t){let{content:s}=t,i=this.stripComments(s),e=new Set,n=/^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?(?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+([a-zA-Z_]\w*)\s*\([^)]*\)\s*\{/gm,l;for(;(l=n.exec(i))!==null;)e.add(l[1]);let p=new Set,u=/\b(\w+)\s*\(/g,m;for(;(m=u.exec(i))!==null;){let c=m[1];!ue.has(c)&&!/^[A-Z_]+$/.test(c)&&!e.has(c)&&p.add(c)}return[...p]}stripComments(t){let s=t.replace(/\/\/.*$/gm,"");return s=s.replace(/\/\*[\s\S]*?\*\//g,""),s=s.replace(/"(?:[^"\\]|\\.)*"/g,'""'),s}};var Me=/import\s+(?:[\w{}\s,*]+\s+from\s+)?['"]([^'"]+)['"]/g,Ne=/(?:^|[=(\s,])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,Ge=/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,Ue=/import\s*\(\s*`([^`$]+)/g,M=class extends E{constructor(){super("javascript")}parse(t){let{content:s,id:i}=t,e=[];return e.push(...this.extractMatches(s,new RegExp(Me.source,"g"),"import",i,n=>`import from '${n[1]}'`)),e.push(...this.extractMatches(s,new RegExp(Ne.source,"g"),"require",i,n=>`require('${n[1]}')`)),e.push(...this.extractMatches(s,new RegExp(Ge.source,"g"),"dynamic-import",i,n=>`import('${n[1]}')`)),e.push(...this.extractMatches(s,new RegExp(Ue.source,"g"),"dynamic-import",i,n=>`import('${n[1].split("?")[0]}')`).map(n=>({...n,target:n.target.split("?")[0]}))),e}};var je=/<script[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,ze=/<link[^>]+href\s*=\s*['"]([^'"]+)['"]/gi,We=/<img[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,H=class extends E{constructor(){super("html")}parse(t,s={}){let{content:i,id:e}=t,n=[];return n.push(...this.extractMatches(i,new RegExp(je.source,"gi"),"script",e,l=>`<script src="${l[1]}">`)),n.push(...this.extractMatches(i,new RegExp(ze.source,"gi"),"stylesheet",e,l=>`<link href="${l[1]}">`)),s.includeAssets&&n.push(...this.extractMatches(i,new RegExp(We.source,"gi"),"asset",e,l=>`<img src="${l[1]}">`)),n}};var Ve=/@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"]\s*\)?/g,Be=/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/g,q=class extends E{constructor(){super("css")}parse(t,s={}){let{content:i,id:e}=t,n=[];if(n.push(...this.extractMatches(i,new RegExp(Ve.source,"g"),"css-import",e,l=>`@import "${l[1]}"`)),s.includeUrls){let l=this.extractMatches(i,new RegExp(Be.source,"g"),"css-url",e,p=>`url("${p[1]}")`);n.push(...l.filter(p=>!p.target.startsWith("data:")&&!p.target.startsWith("http:")&&!p.target.startsWith("https:")&&!p.target.startsWith("#")))}return n}};var Y=class extends M{constructor(){super(),this.language="typescript"}};var He=/^import\s+([\w.]+)/gm,qe=/^from\s+([\w.]+)\s+import/gm,J=class extends E{constructor(){super("python")}parse(t){let{content:s,id:i}=t,e=[];return e.push(...this.extractMatches(s,new RegExp(He.source,"gm"),"import",i,n=>`import ${n[1]}`)),e.push(...this.extractMatches(s,new RegExp(qe.source,"gm"),"from-import",i,n=>`from ${n[1]} import`)),e}};var Ye=/\b(if|else\s+if|for|while|do|switch|case|catch)\b/g,Je=/(\|\||&&)/g,Ze=/[^?]\?[^?:]/g,Ke=/[^{}]+(?=\s*\{)/g,Qe=/@media\b/g;function me(o){let{content:t,language:s}=o;switch(s){case"c":case"javascript":case"typescript":return fe(t);case"css":return Xe(t);case"html":return et(t);default:return{complexity:1,details:{}}}}function fe(o){let t=o.replace(/\/\/.*$/gm,"").replace(/\/\*[\s\S]*?\*\//g,"").replace(/"(?:[^"\\]|\\.)*"/g,'""').replace(/'(?:[^'\\]|\\.)*'/g,"''"),s=1,i={},e={},n=new RegExp(Ye.source,"g"),l;for(;(l=n.exec(t))!==null;){let h=l[1].replace(/\s+/g," ");e[h]=(e[h]||0)+1,s++}i.keywords=e;let p=new RegExp(Je.source,"g"),u=0;for(;(l=p.exec(t))!==null;)u++,s++;i.logicalOperators=u;let m=new RegExp(Ze.source,"g"),c=0;for(;(l=m.exec(t))!==null;)c++,s++;return i.ternaryOperators=c,{complexity:s,details:i}}function Xe(o){let t=o.replace(/\/\*[\s\S]*?\*\//g,""),s=0,i=new RegExp(Ke.source,"g"),e;for(;(e=i.exec(t))!==null;){let u=e[0].split(",").filter(m=>m.trim().length>0);s+=u.length}let n=0,l=new RegExp(Qe.source,"g");for(;(e=l.exec(t))!==null;)n++;return{complexity:Math.max(1,Math.round(1+s/10+n)),details:{selectors:s,mediaQueries:n}}}function et(o){let t=/\bon\w+\s*=/gi,s=0,i;for(;(i=t.exec(o))!==null;)s++;let e=/<script\b[^>]*>[\s\S]*?<\/script>/gi,n=0,l=0;for(;(i=e.exec(o))!==null;){n++;let u=fe(i[0]);l+=u.complexity-1}return{complexity:Math.max(1,1+s+l),details:{eventHandlers:s,scriptBlocks:n,inlineJSComplexity:l}}}var he={c:new B,javascript:new M,typescript:new Y,python:new J,html:new H,css:new q};function tt(o,t,s){if(s.has(o))return o;let i=(0,P.dirname)(t),e=(0,P.normalize)((0,P.join)(i,o));if(s.has(e))return e;let n=[".js",".ts",".py",".c",".h",".css",".html"];for(let u of n){if(s.has(e+u))return e+u;if(s.has(o+u))return o+u}let l=(0,P.join)(e,"index.js");if(s.has(l))return l;let p=(0,P.basename)(o);for(let[u,m]of s)if(m.name===p)return u;for(let u of n){let m=p+u;for(let[c,h]of s)if(h.name===m)return c}return null}function Z(o,t="Project",s={}){let i=new Map;for(let r of o)i.set(r.id,r);let e=[];for(let r of o){let f=he[r.language];if(f){let I=f.parse(r,s);e.push(...I)}}let n=he.c,l=new Map,p=new Map;for(let r of o)if(r.language==="c"){let f=n.extractSymbols(r);l.set(r.id,f);for(let I of f.functions)p.has(I.name)||p.set(I.name,[]),p.get(I.name).push(r.id)}let u=[];for(let r of o)if(r.language==="c"&&r.extension===".c"){let f=n.extractCalls(r),I=l.get(r.id),j=new Set(I?I.functions.map(x=>x.name):[]);for(let x of f){if(j.has(x))continue;let oe=p.get(x);if(oe)for(let ae of oe)ae!==r.id&&u.push({source:r.id,target:ae,type:"function-call",label:`${x}()`})}}let m=new Map;for(let r of o){let f=me(r);m.set(r.id,f)}let c=[],h={count:0,targets:[]};for(let r of e){let f=tt(r.target,r.source,i);f?f!==r.source&&c.push({source:r.source,target:f,type:r.type,label:r.label}):(h.count++,h.targets.length<20&&h.targets.push({from:r.source,ref:r.target}))}c.push(...u);let R=new Set,a=c.filter(r=>{let f=`${r.source}|${r.target}|${r.type}`;return R.has(f)?!1:(R.add(f),!0)}),g=new Map,k=new Map;for(let r of a)g.set(r.source,(g.get(r.source)||0)+1),k.set(r.target,(k.get(r.target)||0)+1);let S=o.map(r=>{let f=l.get(r.id),I=m.get(r.id)||{complexity:1,details:{}},j={id:r.id,name:r.name,path:r.path,language:r.language,extension:r.extension,size:r.size,linesOfCode:r.linesOfCode,lastModified:r.lastModified||0,group:r.group,fanOut:g.get(r.id)||0,fanIn:k.get(r.id)||0,complexity:I.complexity,complexityDetails:I.details};return f&&(j.symbols={functions:f.functions.map(x=>({name:x.name,returnType:x.returnType||"",params:x.params||"",line:x.line||0,type:x.type})),structs:f.structs.map(x=>({name:x.name,type:x.type})),enums:f.enums.map(x=>({name:x.name,type:x.type})),macros:f.macros.slice(0,30),totalSymbols:f.functions.length+f.structs.length+f.enums.length+f.macros.length}),j}),C={};for(let r of S)C[r.language]||(C[r.language]={count:0,totalLOC:0,avgComplexity:0}),C[r.language].count++,C[r.language].totalLOC+=r.linesOfCode,C[r.language].avgComplexity+=r.complexity;for(let r in C)C[r].avgComplexity=Math.round(C[r].avgComplexity/C[r].count*10)/10;let ee=new Set(S.map(r=>r.group)),be=a.filter(r=>r.type==="function-call").length;return{meta:{projectName:t,analyzedAt:new Date().toISOString(),totalFiles:S.length,totalLinks:a.length,totalRelationsFound:e.length,functionCallLinks:be,unresolvedReferences:h.count,unresolvedSamples:h.targets,languageStats:C,groups:[...ee].sort()},nodes:S,links:a}}var ge=require("path");async function ve(o,t={}){let s=t.projectName||(0,ge.basename)(o),i=await ne(o,t);return Z(i,s,t)}var v,b,O=[],N,F,G,Q,K=!1;function st(o){Q=new W;let t=d.window.createTreeView("auraVisualizer.statsView",{treeDataProvider:Q,showCollapseAll:!0});o.subscriptions.push(t),F=d.window.createStatusBarItem(d.StatusBarAlignment.Left,50),F.command="auraVisualizer.open",F.text="$(eye) Aura",F.tooltip="Open Aura 3D Visualizer",F.show(),o.subscriptions.push(F),o.subscriptions.push(d.commands.registerCommand("auraVisualizer.open",()=>nt(o)),d.commands.registerCommand("auraVisualizer.refresh",()=>X(o)),d.commands.registerCommand("auraVisualizer.focusFile",()=>at()),d.commands.registerCommand("auraVisualizer.openFileFromTree",s=>{let i=d.workspace.workspaceFolders?.[0];if(!i)return;let e=$.join(i.uri.fsPath,s);d.window.showTextDocument(d.Uri.file(e),{preview:!0})}),d.commands.registerCommand("auraVisualizer.exportGraph",()=>rt())),ct(o),o.subscriptions.push(d.window.onDidChangeActiveTextEditor(s=>{if(s&&v?.isVisible){let i=d.workspace.workspaceFolders?.[0];if(i){let e=$.relative(i.uri.fsPath,s.document.uri.fsPath);e.startsWith("..")||v.focusNode(e)}}})),o.subscriptions.push(d.window.onDidChangeActiveColorTheme(s=>{v?.sendTheme(s.kind)})),d.window.registerWebviewPanelSerializer(A.viewType,{async deserializeWebviewPanel(s){v||(v=new A(o.extensionUri),we()),v.restore(s),b&&v.sendGraphData(b)}}),d.workspace.workspaceFolders?.length&&X(o)}function we(){v&&v.onOpenFile(async({path:o,line:t})=>{let s=d.workspace.workspaceFolders?.[0];if(!s)return;let i=$.join(s.uri.fsPath,o),e=d.Uri.file(i);try{let n=await d.workspace.openTextDocument(e),l=await d.window.showTextDocument(n,{preserveFocus:!1});if(t&&t>0){let p=new d.Position(t-1,0);l.selection=new d.Selection(p,p),l.revealRange(new d.Range(p,p),d.TextEditorRevealType.InCenter)}}catch{}})}async function nt(o){v||(v=new A(o.extensionUri),we()),v.show(),b?v.sendGraphData(b):await X(o)}async function X(o){if(K)return;K=!0;let t=d.workspace.workspaceFolders?.[0];if(!t){K=!1,d.window.showWarningMessage("Aura: No workspace folder open.");return}let s=t.uri.fsPath,e=d.workspace.getConfiguration("auraVisualizer").get("excludePaths",["node_modules",".git","dist","build","out","__pycache__"]);F&&(F.text="$(loading~spin) Aura: Analyzing...");try{b=await d.window.withProgress({location:d.ProgressLocation.Window,title:"Aura: Analyzing codebase..."},async()=>{let n=await ve(s,{skipDirs:new Set(e),projectName:t.name}),{scanDirectory:l}=await Promise.resolve().then(()=>(ie(),de));return O=await l(s,{skipDirs:new Set(e)}),n}),v&&v.sendGraphData(b),Q?.update(b),ye()}catch(n){let l=n instanceof Error?n.message:String(n);d.window.showErrorMessage(`Aura: Analysis failed \u2014 ${l}`),F&&(F.text="$(eye) Aura")}finally{K=!1}}async function it(o,t){let s=d.workspace.workspaceFolders?.[0];if(!s||O.length===0)return;let i=s.uri.fsPath,e=$.relative(i,o.fsPath);if(e.startsWith(".."))return;if(t)O=O.filter(p=>p.id!==e);else{let p=await V(o.fsPath,i);if(!p)return;let u=O.findIndex(m=>m.id===e);u>=0?O[u]=p:O.push(p)}let n=b,l=s.name;if(b=Z(O,l),v?.isVisible&&b)if(n){let p=ot(n,b,e,t);v.sendGraphDelta(p)}else v.sendGraphData(b);Q?.update(b),ye()}function ot(o,t,s,i){let e={changedNodes:[],removedNodeIds:[],addedLinks:[],removedLinks:[],meta:t.meta};i&&e.removedNodeIds.push(s);let n=new Map(o.nodes.map(c=>[c.id,c])),l=new Map(t.nodes.map(c=>[c.id,c]));for(let c of t.nodes){let h=n.get(c.id);(!h||c.fanIn!==h.fanIn||c.fanOut!==h.fanOut||c.complexity!==h.complexity||c.linesOfCode!==h.linesOfCode||c.size!==h.size)&&e.changedNodes.push(c)}for(let c of o.nodes)l.has(c.id)||e.removedNodeIds.includes(c.id)||e.removedNodeIds.push(c.id);let p=c=>`${typeof c.source=="object"?c.source.id:c.source}|${typeof c.target=="object"?c.target.id:c.target}|${c.type}`,u=new Set(o.links.map(p)),m=new Set(t.links.map(p));for(let c of t.links)u.has(p(c))||e.addedLinks.push(c);for(let c of o.links)m.has(p(c))||e.removedLinks.push({source:typeof c.source=="object"?c.source.id:c.source,target:typeof c.target=="object"?c.target.id:c.target,type:c.type});return e}function ye(){if(!F||!b)return;let{totalFiles:o,totalLinks:t}=b.meta;F.text=`$(eye) Aura: ${o} files, ${t} links`,F.tooltip=`Aura \u2014 ${o} files, ${t} dependencies
Click to open 3D visualizer`}function at(){let o=d.window.activeTextEditor;if(!o||!v?.isVisible)return;let t=d.workspace.workspaceFolders?.[0];if(!t)return;let s=$.relative(t.uri.fsPath,o.document.uri.fsPath);s.startsWith("..")||v.focusNode(s)}async function rt(){let o=d.workspace.workspaceFolders?.[0];if(!o){d.window.showWarningMessage("Aura: No workspace folder open.");return}if(!b){d.window.showWarningMessage("Aura: No graph data. Run analysis first (Ctrl+Shift+A).");return}let t=$.join(o.uri.fsPath,".aura");await U.mkdir(t,{recursive:!0});let s=b,i={meta:s.meta,nodes:s.nodes.map(n=>({id:n.id,name:n.name,path:n.path,language:n.language,extension:n.extension,size:n.size,linesOfCode:n.linesOfCode,group:n.group,fanIn:n.fanIn,fanOut:n.fanOut,complexity:n.complexity})),links:s.links.map(n=>({source:n.source,target:n.target,type:n.type,label:n.label}))};await U.writeFile($.join(t,"graph.json"),JSON.stringify(i,null,2),"utf-8");let e=lt(s);await U.writeFile($.join(t,"summary.md"),e,"utf-8"),d.window.showInformationMessage("Aura: Exported to .aura/ \u2014 graph.json + summary.md","Open summary").then(n=>{n==="Open summary"&&d.window.showTextDocument(d.Uri.file($.join(t,"summary.md")),{preview:!0})})}function lt(o){let{meta:t,nodes:s,links:i}=o,e=[];e.push(`# Aura Graph \u2014 ${t.projectName}`),e.push(`> Auto-generated by Aura Visualizer on ${t.analyzedAt}`),e.push("> This file describes the codebase architecture for AI-assisted development."),e.push(""),e.push("## Overview"),e.push(`- **${t.totalFiles}** files, **${t.totalLinks}** dependencies`);let n=Object.entries(t.languageStats).sort((a,g)=>g[1].count-a[1].count).map(([a,g])=>`${a} (${g.count} files, ${g.totalLOC} LOC)`);if(e.push(`- Languages: ${n.join(", ")}`),t.unresolvedReferences>0&&e.push(`- Unresolved references: ${t.unresolvedReferences}`),e.push(""),t.groups.length>0){e.push("## Directory Structure");for(let a of t.groups){let g=s.filter(S=>S.group===a),k=g.reduce((S,C)=>S+C.linesOfCode,0);e.push(`- \`${a}/\` \u2014 ${g.length} files, ${k} LOC`)}e.push("")}let l=[...s].sort((a,g)=>g.fanIn-a.fanIn).slice(0,15).filter(a=>a.fanIn>0);if(l.length>0){e.push("## Hotspots (most depended-on files)"),e.push("| File | Fan-in | Fan-out | Complexity | LOC |"),e.push("|------|--------|---------|------------|-----|");for(let a of l)e.push(`| \`${a.id}\` | ${a.fanIn} | ${a.fanOut} | ${a.complexity} | ${a.linesOfCode} |`);e.push("")}let p=[...s].sort((a,g)=>g.complexity-a.complexity).slice(0,10).filter(a=>a.complexity>1);if(p.length>0){e.push("## Most Complex Files"),e.push("| File | Complexity | LOC | Fan-in | Fan-out |"),e.push("|------|------------|-----|--------|---------|");for(let a of p)e.push(`| \`${a.id}\` | ${a.complexity} | ${a.linesOfCode} | ${a.fanIn} | ${a.fanOut} |`);e.push("")}let u=[...s].sort((a,g)=>g.linesOfCode-a.linesOfCode).slice(0,10);if(u.length>0){e.push("## Largest Files"),e.push("| File | LOC | Complexity | Language |"),e.push("|------|-----|------------|----------|");for(let a of u)e.push(`| \`${a.id}\` | ${a.linesOfCode} | ${a.complexity} | ${a.language} |`);e.push("")}let m=s.filter(a=>a.fanIn===0&&a.fanOut===0);if(m.length>0){e.push("## Orphan Files (no dependencies)");for(let a of m)e.push(`- \`${a.id}\` (${a.language}, ${a.linesOfCode} LOC)`);e.push("")}let c=[],h=new Set(i.map(a=>`${a.source}\u2192${a.target}`));for(let a of i){let g=`${a.target}\u2192${a.source}`;h.has(g)&&a.source<a.target&&c.push(`\`${a.source}\` \u2194 \`${a.target}\``)}if(c.length>0){e.push("## Circular Dependencies");for(let a of c)e.push(`- ${a}`);e.push("")}let R={};for(let a of i)R[a.type]=(R[a.type]||0)+1;if(Object.keys(R).length>0){e.push("## Dependency Types");for(let[a,g]of Object.entries(R).sort((k,S)=>S[1]-k[1]))e.push(`- **${a}**: ${g}`);e.push("")}return e.push("## Usage Notes for AI Agents"),e.push("- Files with high fan-in are **critical hubs** \u2014 changes impact many dependents."),e.push("- Check circular dependencies before refactoring \u2014 break cycles where possible."),e.push("- Orphan files may be dead code candidates for cleanup."),e.push("- Use `graph.json` for programmatic queries (e.g., find all dependents of a file)."),e.push("- High complexity files (>15) are prime candidates for decomposition."),e.push(""),e.join(`
`)}function ct(o){if(!d.workspace.getConfiguration("auraVisualizer").get("autoRefresh",!0))return;N=d.workspace.createFileSystemWatcher("**/*.{c,h,js,ts,py,css,html}");let i=new Map,e=()=>{G&&clearTimeout(G),G=setTimeout(async()=>{let n=new Map(i);if(i.clear(),O.length===0){v?.isVisible?X(o):b=void 0;return}for(let[,l]of n)await it(l.uri,l.deleted)},500)};N.onDidChange(n=>{i.set(n.fsPath,{uri:n,deleted:!1}),e()}),N.onDidCreate(n=>{i.set(n.fsPath,{uri:n,deleted:!1}),e()}),N.onDidDelete(n=>{i.set(n.fsPath,{uri:n,deleted:!0}),e()}),o.subscriptions.push(N)}function pt(){v?.dispose(),N?.dispose(),G&&clearTimeout(G)}0&&(module.exports={activate,deactivate});
