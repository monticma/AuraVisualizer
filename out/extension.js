"use strict";var xe=Object.create;var N=Object.defineProperty;var Re=Object.getOwnPropertyDescriptor;var Ce=Object.getOwnPropertyNames;var Se=Object.getPrototypeOf,Fe=Object.prototype.hasOwnProperty;var ke=(o,t)=>()=>(o&&(t=o(o=0)),t);var re=(o,t)=>{for(var s in t)N(o,s,{get:t[s],enumerable:!0})},le=(o,t,s,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let e of Ce(t))!Fe.call(o,e)&&e!==s&&N(o,e,{get:()=>t[e],enumerable:!(i=Re(t,e))||i.enumerable});return o};var _=(o,t,s)=>(s=o!=null?xe(Se(o)):{},le(t||!o||!o.__esModule?N(s,"default",{value:o,enumerable:!0}):s,o)),Ee=o=>le(N({},"__esModule",{value:!0}),o);var de={};re(de,{LANGUAGE_MAP:()=>se,SKIP_DIRS:()=>pe,SUPPORTED_EXTENSIONS:()=>te,scanDirectory:()=>ne,scanSingleFile:()=>V});async function ne(o,t={}){let s=t.extensions||te,i=new Set([...pe,...t.skipDirs||[]]),e=new Set([...i].map(c=>c.toLowerCase())),n=[];async function l(c){let d;try{d=await(0,O.readdir)(c,{withFileTypes:!0})}catch{return}for(let f of d){let h=(0,A.join)(c,f.name);if(f.isDirectory())e.has(f.name.toLowerCase())||await l(h);else if(f.isFile()){let w=(0,A.extname)(f.name).toLowerCase();if(s.has(w))try{let R=await(0,O.stat)(h),a=await(0,O.readFile)(h,"utf-8"),m=a.split(`
`).filter(ee=>ee.trim().length>0).length,S=(0,A.relative)(o,h),F=S.split("/"),C=F.length>1?F[0]:"/";n.push({id:S,name:f.name,path:S,fullPath:h,language:se[w]||"unknown",extension:w,size:R.size,linesOfCode:m,lastModified:Math.floor(R.mtimeMs),group:C,content:a})}catch{}}}}return await l(o),n}async function V(o,t){let s=(0,A.extname)(o).toLowerCase();if(!te.has(s))return null;try{let i=await(0,O.stat)(o),e=await(0,O.readFile)(o,"utf-8"),n=e.split(`
`).filter(h=>h.trim().length>0).length,l=(0,A.relative)(t,o),c=l.split("/"),d=c.length>1?c[0]:"/",f=c[c.length-1];return{id:l,name:f,path:l,fullPath:o,language:se[s]||"unknown",extension:s,size:i.size,linesOfCode:n,lastModified:Math.floor(i.mtimeMs),group:d,content:e}}catch{return null}}var O,A,te,se,pe,ie=ke(()=>{"use strict";O=require("fs/promises"),A=require("path"),te=new Set([".c",".h",".js",".ts",".py",".css",".html",".htm"]),se={".c":"c",".h":"c",".js":"javascript",".ts":"typescript",".py":"python",".css":"css",".html":"html",".htm":"html"},pe=new Set(["node_modules",".git",".svn",".hg","dist","build","out",".next","__pycache__",".vscode",".idea","Backup","Tests"])});var ct={};re(ct,{activate:()=>tt,deactivate:()=>lt});module.exports=Ee(ct);var p=_(require("vscode")),$=_(require("path")),z=_(require("fs/promises"));var v=_(require("vscode")),ce=_(require("path")),L=class o{static viewType="auraVisualizer.graphView";panel;extensionUri;disposables=[];onOpenFileEmitter=new v.EventEmitter;onOpenFile=this.onOpenFileEmitter.event;onDisposeEmitter=new v.EventEmitter;onDidDispose=this.onDisposeEmitter.event;pendingData;webviewReady=!1;constructor(t){this.extensionUri=t}show(){return this.panel?(this.panel.reveal(v.ViewColumn.One),this.panel):(this.panel=v.window.createWebviewPanel(o.viewType,"Aura \u2014 3D Visualizer",v.ViewColumn.One,{enableScripts:!0,retainContextWhenHidden:!0,localResourceRoots:[v.Uri.joinPath(this.extensionUri,"out","webview")]}),this.initPanel(),this.panel)}restore(t){this.panel=t,t.webview.options={enableScripts:!0,localResourceRoots:[v.Uri.joinPath(this.extensionUri,"out","webview")]},this.initPanel()}initPanel(){this.panel&&(this.panel.iconPath=v.Uri.joinPath(this.extensionUri,"resources","icon.png"),this.panel.webview.html=this.getHtmlContent(this.panel.webview),this.setupMessageHandler(),this.panel.onDidDispose(()=>{this.panel=void 0,this.webviewReady=!1,this.disposables.forEach(t=>t.dispose()),this.disposables=[],this.onDisposeEmitter.fire()}))}setupMessageHandler(){this.panel&&this.panel.webview.onDidReceiveMessage(t=>{switch(t.type){case"ready":this.webviewReady=!0,this.pendingData&&this.panel?.webview.postMessage({type:"graphData",payload:this.pendingData});break;case"openFile":t.payload&&this.onOpenFileEmitter.fire({path:t.payload.path,line:t.payload.line});break;case"requestRefresh":v.commands.executeCommand("auraVisualizer.refresh");break;case"requestExport":v.commands.executeCommand("auraVisualizer.exportGraph");break}},null,this.disposables)}sendGraphData(t){this.pendingData=t,this.webviewReady&&this.panel?.webview.postMessage({type:"graphData",payload:t})}focusNode(t){this.panel?.webview.postMessage({type:"focusNode",payload:{nodeId:t}})}sendTheme(t){this.panel?.webview.postMessage({type:"themeChanged",payload:{kind:t}})}get isVisible(){return this.panel?.visible??!1}dispose(){this.panel?.dispose()}getHtmlContent(t){let s=ce.join("out","webview"),i=t.asWebviewUri(v.Uri.joinPath(this.extensionUri,s,"css","style.css")),e=t.asWebviewUri(v.Uri.joinPath(this.extensionUri,s,"js","app.js")),n=t.asWebviewUri(v.Uri.joinPath(this.extensionUri,s,"js","graph-config.js")),l=t.asWebviewUri(v.Uri.joinPath(this.extensionUri,s,"lib","3d-force-graph.min.js")),c=t.asWebviewUri(v.Uri.joinPath(this.extensionUri,s,"lib","three.global.js")),d=Ie();return`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${t.cspSource} 'unsafe-inline'; script-src 'nonce-${d}' 'unsafe-eval' ${t.cspSource}; img-src ${t.cspSource} data:; font-src ${t.cspSource};">
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
    <script nonce="${d}" src="${c}"></script>
    <script nonce="${d}" src="${l}"></script>
    <!-- App Logic -->
    <script nonce="${d}" src="${n}"></script>
    <script nonce="${d}" src="${e}"></script>
</body>
</html>`}};function Ie(){let o=new Uint8Array(16);return require("crypto").randomFillSync(o),Array.from(o,t=>t.toString(16).padStart(2,"0")).join("")}var y=_(require("vscode")),P=class extends y.TreeItem{constructor(s,i){let e=s.kind==="file"?s.node.name:s.kind==="stat"?`${s.label}: ${s.value}`:s.label;super(e,i);this.entry=s;s.kind==="header"?this.iconPath=new y.ThemeIcon(s.icon):s.kind==="stat"?this.iconPath=new y.ThemeIcon(s.icon):s.kind==="file"&&(this.description=s.metric,this.iconPath=new y.ThemeIcon("file"),this.command={command:"auraVisualizer.openFileFromTree",title:"Open File",arguments:[s.node.path]},this.tooltip=`${s.node.path}
Complexity: ${s.node.complexity}
Lines: ${s.node.linesOfCode}
Fan-in: ${s.node.fanIn} / Fan-out: ${s.node.fanOut}`)}},W=class{_onDidChangeTreeData=new y.EventEmitter;onDidChangeTreeData=this._onDidChangeTreeData.event;data;update(t){this.data=t,this._onDidChangeTreeData.fire(void 0)}getTreeItem(t){return t}getChildren(t){if(!this.data)return[new P({kind:"stat",label:"No data",value:"Open a workspace and run Aura",icon:"info"},y.TreeItemCollapsibleState.None)];if(!t)return[new P({kind:"header",label:"Stats",icon:"graph"},y.TreeItemCollapsibleState.Expanded),new P({kind:"header",label:"Most Complex",icon:"flame"},y.TreeItemCollapsibleState.Collapsed),new P({kind:"header",label:"Largest Files",icon:"file-binary"},y.TreeItemCollapsibleState.Collapsed),new P({kind:"header",label:"Orphan Files",icon:"warning"},y.TreeItemCollapsibleState.Collapsed)];if(t.entry.kind!=="header")return[];let s=this.data;switch(t.entry.label){case"Stats":{let i=Object.entries(s.meta.languageStats).map(([e,n])=>`${e}: ${n.count}`).join(", ");return[this.stat("Files",String(s.meta.totalFiles),"file"),this.stat("Links",String(s.meta.totalLinks),"link"),this.stat("Function Calls",String(s.meta.functionCallLinks),"symbol-method"),this.stat("Groups",String(s.meta.groups.length),"folder"),this.stat("Languages",i,"symbol-color")]}case"Most Complex":return[...s.nodes].sort((i,e)=>e.complexity-i.complexity).slice(0,10).map(i=>new P({kind:"file",node:i,metric:`complexity: ${i.complexity}`},y.TreeItemCollapsibleState.None));case"Largest Files":return[...s.nodes].sort((i,e)=>e.linesOfCode-i.linesOfCode).slice(0,10).map(i=>new P({kind:"file",node:i,metric:`${i.linesOfCode} lines`},y.TreeItemCollapsibleState.None));case"Orphan Files":return s.nodes.filter(i=>i.fanIn===0&&i.fanOut===0).map(i=>new P({kind:"file",node:i,metric:i.language},y.TreeItemCollapsibleState.None));default:return[]}}stat(t,s,i){return new P({kind:"stat",label:t,value:s,icon:i},y.TreeItemCollapsibleState.None)}};ie();var D=require("path");var E=class{language;constructor(t){this.language=t}parse(t,s){return[]}extractMatches(t,s,i,e,n){let l=[],c;for(;(c=s.exec(t))!==null;){let d=c[1];d&&l.push({source:e,target:d,type:i,label:n?n(c):`${i}: ${d}`})}return l}};var Pe=/#include\s*"([^"]+)"/g,$e=/#include\s*<([^>]+)>/g,De=/^[ \t]*((?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+)([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/gm,Te=/extern\s+[\w\s*]+\s+(\w+)\s*\([^)]*\)\s*;/g,Oe=/(?:typedef\s+)?struct\s+(\w+)\s*\{/g,Ae=/typedef\s+struct\s*(?:\w+\s*)?\{[^}]*\}\s*(\w+)\s*;/gs,_e=/(?:typedef\s+)?enum\s+(\w+)\s*\{/g,Le=/^[ \t]*#define\s+(\w+)(?:\(([^)]*)\))?/gm,ue=new Set(["if","else","for","while","do","switch","case","return","break","continue","goto","sizeof","typeof","typedef","struct","union","enum","static","extern","inline","const","volatile","register","auto","void","int","char","float","double","long","short","unsigned","signed","bool","BOOL","printf","fprintf","sprintf","snprintf","scanf","sscanf","malloc","calloc","realloc","free","memcpy","memset","memmove","strlen","strcpy","strncpy","strcmp","strncmp","strcat","fopen","fclose","fread","fwrite","fseek","ftell","exit","abort","assert","NULL","true","false","defined","offsetof","va_start","va_end","va_arg"]),B=class extends E{constructor(){super("c")}parse(t,s={}){let{content:i,id:e}=t,n=[];return n.push(...this.extractMatches(i,new RegExp(Pe.source,"g"),"include",e,l=>`#include "${l[1]}"`)),s.includeSystemHeaders&&n.push(...this.extractMatches(i,new RegExp($e.source,"g"),"system-include",e,l=>`#include <${l[1]}>`)),n}extractSymbols(t){let{content:s}=t,i={functions:[],externs:[],structs:[],enums:[],macros:[]},e=this.stripComments(s),n,l=new RegExp(De.source,"gm");for(;(n=l.exec(e))!==null;){let R=(n[1]||"").trim(),a=n[2],m=(n[3]||"").trim();if(!ue.has(a)){let S=e.substring(0,n.index).split(`
`).length;i.functions.push({name:a,returnType:R,params:m,line:S,type:"function"})}}let c=new RegExp(Te.source,"g");for(;(n=c.exec(e))!==null;)i.externs.push({name:n[1],type:"extern"});let d=new RegExp(Oe.source,"g");for(;(n=d.exec(e))!==null;)i.structs.push({name:n[1],type:"struct"});let f=new RegExp(Ae.source,"gs");for(;(n=f.exec(e))!==null;)i.structs.push({name:n[1],type:"typedef-struct"});let h=new RegExp(_e.source,"g");for(;(n=h.exec(e))!==null;)i.enums.push({name:n[1],type:"enum"});let w=new RegExp(Le.source,"gm");for(;(n=w.exec(e))!==null;){let R=n[1],a=n[2]!==void 0;i.macros.push({name:R,type:a?"function-macro":"constant-macro"})}return i}extractCalls(t){let{content:s}=t,i=this.stripComments(s),e=new Set,n=/\b(\w+)\s*\(/g,l;for(;(l=n.exec(i))!==null;){let c=l[1];!ue.has(c)&&!/^[A-Z_]+$/.test(c)&&e.add(c)}return[...e]}stripComments(t){let s=t.replace(/\/\/.*$/gm,"");return s=s.replace(/\/\*[\s\S]*?\*\//g,""),s=s.replace(/"(?:[^"\\]|\\.)*"/g,'""'),s}};var Me=/import\s+(?:[\w{}\s,*]+\s+from\s+)?['"]([^'"]+)['"]/g,Ue=/(?:^|[=(\s,])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,je=/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,M=class extends E{constructor(){super("javascript")}parse(t){let{content:s,id:i}=t,e=[];return e.push(...this.extractMatches(s,new RegExp(Me.source,"g"),"import",i,n=>`import from '${n[1]}'`)),e.push(...this.extractMatches(s,new RegExp(Ue.source,"g"),"require",i,n=>`require('${n[1]}')`)),e.push(...this.extractMatches(s,new RegExp(je.source,"g"),"dynamic-import",i,n=>`import('${n[1]}')`)),e}};var ze=/<script[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,Ge=/<link[^>]+href\s*=\s*['"]([^'"]+)['"]/gi,Ne=/<img[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,H=class extends E{constructor(){super("html")}parse(t,s={}){let{content:i,id:e}=t,n=[];return n.push(...this.extractMatches(i,new RegExp(ze.source,"gi"),"script",e,l=>`<script src="${l[1]}">`)),n.push(...this.extractMatches(i,new RegExp(Ge.source,"gi"),"stylesheet",e,l=>`<link href="${l[1]}">`)),s.includeAssets&&n.push(...this.extractMatches(i,new RegExp(Ne.source,"gi"),"asset",e,l=>`<img src="${l[1]}">`)),n}};var We=/@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"]\s*\)?/g,Ve=/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/g,q=class extends E{constructor(){super("css")}parse(t,s={}){let{content:i,id:e}=t,n=[];if(n.push(...this.extractMatches(i,new RegExp(We.source,"g"),"css-import",e,l=>`@import "${l[1]}"`)),s.includeUrls){let l=this.extractMatches(i,new RegExp(Ve.source,"g"),"css-url",e,c=>`url("${c[1]}")`);n.push(...l.filter(c=>!c.target.startsWith("data:")&&!c.target.startsWith("http:")&&!c.target.startsWith("https:")&&!c.target.startsWith("#")))}return n}};var J=class extends M{constructor(){super(),this.language="typescript"}};var Be=/^import\s+([\w.]+)/gm,He=/^from\s+([\w.]+)\s+import/gm,Y=class extends E{constructor(){super("python")}parse(t){let{content:s,id:i}=t,e=[];return e.push(...this.extractMatches(s,new RegExp(Be.source,"gm"),"import",i,n=>`import ${n[1]}`)),e.push(...this.extractMatches(s,new RegExp(He.source,"gm"),"from-import",i,n=>`from ${n[1]} import`)),e}};var qe=/\b(if|else\s+if|for|while|do|switch|case|catch)\b/g,Je=/(\|\||&&)/g,Ye=/[^?]\?[^?:]/g,Ze=/[^{}]+(?=\s*\{)/g,Ke=/@media\b/g;function me(o){let{content:t,language:s}=o;switch(s){case"c":case"javascript":case"typescript":return fe(t);case"css":return Qe(t);case"html":return Xe(t);default:return{complexity:1,details:{}}}}function fe(o){let t=o.replace(/\/\/.*$/gm,"").replace(/\/\*[\s\S]*?\*\//g,"").replace(/"(?:[^"\\]|\\.)*"/g,'""').replace(/'(?:[^'\\]|\\.)*'/g,"''"),s=1,i={},e={},n=new RegExp(qe.source,"g"),l;for(;(l=n.exec(t))!==null;){let w=l[1].replace(/\s+/g," ");e[w]=(e[w]||0)+1,s++}i.keywords=e;let c=new RegExp(Je.source,"g"),d=0;for(;(l=c.exec(t))!==null;)d++,s++;i.logicalOperators=d;let f=new RegExp(Ye.source,"g"),h=0;for(;(l=f.exec(t))!==null;)h++,s++;return i.ternaryOperators=h,{complexity:s,details:i}}function Qe(o){let t=o.replace(/\/\*[\s\S]*?\*\//g,""),s=0,i=new RegExp(Ze.source,"g"),e;for(;(e=i.exec(t))!==null;){let d=e[0].split(",").filter(f=>f.trim().length>0);s+=d.length}let n=0,l=new RegExp(Ke.source,"g");for(;(e=l.exec(t))!==null;)n++;return{complexity:Math.max(1,Math.round(1+s/10+n)),details:{selectors:s,mediaQueries:n}}}function Xe(o){let t=/\bon\w+\s*=/gi,s=0,i;for(;(i=t.exec(o))!==null;)s++;let e=/<script\b[^>]*>[\s\S]*?<\/script>/gi,n=0,l=0;for(;(i=e.exec(o))!==null;){n++;let d=fe(i[0]);l+=d.complexity-1}return{complexity:Math.max(1,1+s+l),details:{eventHandlers:s,scriptBlocks:n,inlineJSComplexity:l}}}var he={c:new B,javascript:new M,typescript:new J,python:new Y,html:new H,css:new q};function et(o,t,s){if(s.has(o))return o;let i=(0,D.dirname)(t),e=(0,D.normalize)((0,D.join)(i,o));if(s.has(e))return e;let n=[".js",".ts",".py",".c",".h",".css",".html"];for(let d of n){if(s.has(e+d))return e+d;if(s.has(o+d))return o+d}let l=(0,D.join)(e,"index.js");if(s.has(l))return l;let c=(0,D.basename)(o);for(let[d,f]of s)if(f.name===c)return d;for(let d of n){let f=c+d;for(let[h,w]of s)if(w.name===f)return h}return null}function Z(o,t="Project",s={}){let i=new Map;for(let r of o)i.set(r.id,r);let e=[];for(let r of o){let u=he[r.language];if(u){let I=u.parse(r,s);e.push(...I)}}let n=he.c,l=new Map,c=new Map;for(let r of o)if(r.language==="c"){let u=n.extractSymbols(r);l.set(r.id,u);for(let I of u.functions)c.has(I.name)||c.set(I.name,[]),c.get(I.name).push(r.id)}let d=[];for(let r of o)if(r.language==="c"&&r.extension===".c"){let u=n.extractCalls(r),I=l.get(r.id),G=new Set(I?I.functions.map(b=>b.name):[]);for(let b of u){if(G.has(b))continue;let oe=c.get(b);if(oe)for(let ae of oe)ae!==r.id&&d.push({source:r.id,target:ae,type:"function-call",label:`${b}()`})}}let f=new Map;for(let r of o){let u=me(r);f.set(r.id,u)}let h=[],w={count:0,targets:[]};for(let r of e){let u=et(r.target,r.source,i);u?u!==r.source&&h.push({source:r.source,target:u,type:r.type,label:r.label}):(w.count++,w.targets.length<20&&w.targets.push({from:r.source,ref:r.target}))}h.push(...d);let R=new Set,a=h.filter(r=>{let u=`${r.source}|${r.target}|${r.type}`;return R.has(u)?!1:(R.add(u),!0)}),m=new Map,S=new Map;for(let r of a)m.set(r.source,(m.get(r.source)||0)+1),S.set(r.target,(S.get(r.target)||0)+1);let F=o.map(r=>{let u=l.get(r.id),I=f.get(r.id)||{complexity:1,details:{}},G={id:r.id,name:r.name,path:r.path,language:r.language,extension:r.extension,size:r.size,linesOfCode:r.linesOfCode,lastModified:r.lastModified||0,group:r.group,fanOut:m.get(r.id)||0,fanIn:S.get(r.id)||0,complexity:I.complexity,complexityDetails:I.details};return u&&(G.symbols={functions:u.functions.map(b=>({name:b.name,returnType:b.returnType||"",params:b.params||"",line:b.line||0,type:b.type})),structs:u.structs.map(b=>({name:b.name,type:b.type})),enums:u.enums.map(b=>({name:b.name,type:b.type})),macros:u.macros.slice(0,30),totalSymbols:u.functions.length+u.structs.length+u.enums.length+u.macros.length}),G}),C={};for(let r of F)C[r.language]||(C[r.language]={count:0,totalLOC:0,avgComplexity:0}),C[r.language].count++,C[r.language].totalLOC+=r.linesOfCode,C[r.language].avgComplexity+=r.complexity;for(let r in C)C[r].avgComplexity=Math.round(C[r].avgComplexity/C[r].count*10)/10;let ee=new Set(F.map(r=>r.group)),be=a.filter(r=>r.type==="function-call").length;return{meta:{projectName:t,analyzedAt:new Date().toISOString(),totalFiles:F.length,totalLinks:a.length,totalRelationsFound:e.length,functionCallLinks:be,unresolvedReferences:w.count,unresolvedSamples:w.targets,languageStats:C,groups:[...ee].sort()},nodes:F,links:a}}var ge=require("path");async function ve(o,t={}){let s=t.projectName||(0,ge.basename)(o),i=await ne(o,t);return Z(i,s,t)}var g,x,T=[],U,k,j,Q,K=!1;function tt(o){Q=new W;let t=p.window.createTreeView("auraVisualizer.statsView",{treeDataProvider:Q,showCollapseAll:!0});o.subscriptions.push(t),k=p.window.createStatusBarItem(p.StatusBarAlignment.Left,50),k.command="auraVisualizer.open",k.text="$(eye) Aura",k.tooltip="Open Aura 3D Visualizer",k.show(),o.subscriptions.push(k),o.subscriptions.push(p.commands.registerCommand("auraVisualizer.open",()=>st(o)),p.commands.registerCommand("auraVisualizer.refresh",()=>X(o)),p.commands.registerCommand("auraVisualizer.focusFile",()=>it()),p.commands.registerCommand("auraVisualizer.openFileFromTree",s=>{let i=p.workspace.workspaceFolders?.[0];if(!i)return;let e=$.join(i.uri.fsPath,s);p.window.showTextDocument(p.Uri.file(e),{preview:!0})}),p.commands.registerCommand("auraVisualizer.exportGraph",()=>ot())),rt(o),o.subscriptions.push(p.window.onDidChangeActiveTextEditor(s=>{if(s&&g?.isVisible){let i=p.workspace.workspaceFolders?.[0];if(i){let e=$.relative(i.uri.fsPath,s.document.uri.fsPath);e.startsWith("..")||g.focusNode(e)}}})),o.subscriptions.push(p.window.onDidChangeActiveColorTheme(s=>{g?.sendTheme(s.kind)})),p.window.registerWebviewPanelSerializer(L.viewType,{async deserializeWebviewPanel(s){g||(g=new L(o.extensionUri),we()),g.restore(s),x&&g.sendGraphData(x)}}),p.workspace.workspaceFolders?.length&&X(o)}function we(){g&&g.onOpenFile(async({path:o,line:t})=>{let s=p.workspace.workspaceFolders?.[0];if(!s)return;let i=$.join(s.uri.fsPath,o),e=p.Uri.file(i);try{let n=await p.workspace.openTextDocument(e),l=await p.window.showTextDocument(n,{preserveFocus:!1});if(t&&t>0){let c=new p.Position(t-1,0);l.selection=new p.Selection(c,c),l.revealRange(new p.Range(c,c),p.TextEditorRevealType.InCenter)}}catch{}})}async function st(o){g||(g=new L(o.extensionUri),we()),g.show(),x?g.sendGraphData(x):await X(o)}async function X(o){if(K)return;K=!0;let t=p.workspace.workspaceFolders?.[0];if(!t){K=!1,p.window.showWarningMessage("Aura: No workspace folder open.");return}let s=t.uri.fsPath,e=p.workspace.getConfiguration("auraVisualizer").get("excludePaths",["node_modules",".git","dist","build","out","__pycache__"]);k&&(k.text="$(loading~spin) Aura: Analyzing...");try{x=await p.window.withProgress({location:p.ProgressLocation.Window,title:"Aura: Analyzing codebase..."},async()=>{let n=await ve(s,{skipDirs:new Set(e),projectName:t.name}),{scanDirectory:l}=await Promise.resolve().then(()=>(ie(),de));return T=await l(s,{skipDirs:new Set(e)}),n}),g&&g.sendGraphData(x),Q?.update(x),ye()}catch(n){let l=n instanceof Error?n.message:String(n);p.window.showErrorMessage(`Aura: Analysis failed \u2014 ${l}`),k&&(k.text="$(eye) Aura")}finally{K=!1}}async function nt(o,t){let s=p.workspace.workspaceFolders?.[0];if(!s||T.length===0)return;let i=s.uri.fsPath,e=$.relative(i,o.fsPath);if(e.startsWith(".."))return;if(t)T=T.filter(l=>l.id!==e);else{let l=await V(o.fsPath,i);if(!l)return;let c=T.findIndex(d=>d.id===e);c>=0?T[c]=l:T.push(l)}let n=s.name;x=Z(T,n),g?.isVisible&&g.sendGraphData(x),Q?.update(x),ye()}function ye(){if(!k||!x)return;let{totalFiles:o,totalLinks:t}=x.meta;k.text=`$(eye) Aura: ${o} files, ${t} links`,k.tooltip=`Aura \u2014 ${o} files, ${t} dependencies
Click to open 3D visualizer`}function it(){let o=p.window.activeTextEditor;if(!o||!g?.isVisible)return;let t=p.workspace.workspaceFolders?.[0];if(!t)return;let s=$.relative(t.uri.fsPath,o.document.uri.fsPath);s.startsWith("..")||g.focusNode(s)}async function ot(){let o=p.workspace.workspaceFolders?.[0];if(!o){p.window.showWarningMessage("Aura: No workspace folder open.");return}if(!x){p.window.showWarningMessage("Aura: No graph data. Run analysis first (Ctrl+Shift+A).");return}let t=$.join(o.uri.fsPath,".aura");await z.mkdir(t,{recursive:!0});let s=x,i={meta:s.meta,nodes:s.nodes.map(n=>({id:n.id,name:n.name,path:n.path,language:n.language,extension:n.extension,size:n.size,linesOfCode:n.linesOfCode,group:n.group,fanIn:n.fanIn,fanOut:n.fanOut,complexity:n.complexity})),links:s.links.map(n=>({source:n.source,target:n.target,type:n.type,label:n.label}))};await z.writeFile($.join(t,"graph.json"),JSON.stringify(i,null,2),"utf-8");let e=at(s);await z.writeFile($.join(t,"summary.md"),e,"utf-8"),p.window.showInformationMessage("Aura: Exported to .aura/ \u2014 graph.json + summary.md","Open summary").then(n=>{n==="Open summary"&&p.window.showTextDocument(p.Uri.file($.join(t,"summary.md")),{preview:!0})})}function at(o){let{meta:t,nodes:s,links:i}=o,e=[];e.push(`# Aura Graph \u2014 ${t.projectName}`),e.push(`> Auto-generated by Aura Visualizer on ${t.analyzedAt}`),e.push("> This file describes the codebase architecture for AI-assisted development."),e.push(""),e.push("## Overview"),e.push(`- **${t.totalFiles}** files, **${t.totalLinks}** dependencies`);let n=Object.entries(t.languageStats).sort((a,m)=>m[1].count-a[1].count).map(([a,m])=>`${a} (${m.count} files, ${m.totalLOC} LOC)`);if(e.push(`- Languages: ${n.join(", ")}`),t.unresolvedReferences>0&&e.push(`- Unresolved references: ${t.unresolvedReferences}`),e.push(""),t.groups.length>0){e.push("## Directory Structure");for(let a of t.groups){let m=s.filter(F=>F.group===a),S=m.reduce((F,C)=>F+C.linesOfCode,0);e.push(`- \`${a}/\` \u2014 ${m.length} files, ${S} LOC`)}e.push("")}let l=[...s].sort((a,m)=>m.fanIn-a.fanIn).slice(0,15).filter(a=>a.fanIn>0);if(l.length>0){e.push("## Hotspots (most depended-on files)"),e.push("| File | Fan-in | Fan-out | Complexity | LOC |"),e.push("|------|--------|---------|------------|-----|");for(let a of l)e.push(`| \`${a.id}\` | ${a.fanIn} | ${a.fanOut} | ${a.complexity} | ${a.linesOfCode} |`);e.push("")}let c=[...s].sort((a,m)=>m.complexity-a.complexity).slice(0,10).filter(a=>a.complexity>1);if(c.length>0){e.push("## Most Complex Files"),e.push("| File | Complexity | LOC | Fan-in | Fan-out |"),e.push("|------|------------|-----|--------|---------|");for(let a of c)e.push(`| \`${a.id}\` | ${a.complexity} | ${a.linesOfCode} | ${a.fanIn} | ${a.fanOut} |`);e.push("")}let d=[...s].sort((a,m)=>m.linesOfCode-a.linesOfCode).slice(0,10);if(d.length>0){e.push("## Largest Files"),e.push("| File | LOC | Complexity | Language |"),e.push("|------|-----|------------|----------|");for(let a of d)e.push(`| \`${a.id}\` | ${a.linesOfCode} | ${a.complexity} | ${a.language} |`);e.push("")}let f=s.filter(a=>a.fanIn===0&&a.fanOut===0);if(f.length>0){e.push("## Orphan Files (no dependencies)");for(let a of f)e.push(`- \`${a.id}\` (${a.language}, ${a.linesOfCode} LOC)`);e.push("")}let h=[],w=new Set(i.map(a=>`${a.source}\u2192${a.target}`));for(let a of i){let m=`${a.target}\u2192${a.source}`;w.has(m)&&a.source<a.target&&h.push(`\`${a.source}\` \u2194 \`${a.target}\``)}if(h.length>0){e.push("## Circular Dependencies");for(let a of h)e.push(`- ${a}`);e.push("")}let R={};for(let a of i)R[a.type]=(R[a.type]||0)+1;if(Object.keys(R).length>0){e.push("## Dependency Types");for(let[a,m]of Object.entries(R).sort((S,F)=>F[1]-S[1]))e.push(`- **${a}**: ${m}`);e.push("")}return e.push("## Usage Notes for AI Agents"),e.push("- Files with high fan-in are **critical hubs** \u2014 changes impact many dependents."),e.push("- Check circular dependencies before refactoring \u2014 break cycles where possible."),e.push("- Orphan files may be dead code candidates for cleanup."),e.push("- Use `graph.json` for programmatic queries (e.g., find all dependents of a file)."),e.push("- High complexity files (>15) are prime candidates for decomposition."),e.push(""),e.join(`
`)}function rt(o){if(!p.workspace.getConfiguration("auraVisualizer").get("autoRefresh",!0))return;U=p.workspace.createFileSystemWatcher("**/*.{c,h,js,ts,py,css,html}");let i=new Map,e=()=>{j&&clearTimeout(j),j=setTimeout(async()=>{let n=new Map(i);if(i.clear(),T.length===0){g?.isVisible?X(o):x=void 0;return}for(let[,l]of n)await nt(l.uri,l.deleted)},500)};U.onDidChange(n=>{i.set(n.fsPath,{uri:n,deleted:!1}),e()}),U.onDidCreate(n=>{i.set(n.fsPath,{uri:n,deleted:!1}),e()}),U.onDidDelete(n=>{i.set(n.fsPath,{uri:n,deleted:!0}),e()}),o.subscriptions.push(U)}function lt(){g?.dispose(),U?.dispose(),j&&clearTimeout(j)}0&&(module.exports={activate,deactivate});
