"use strict";var fe=Object.create;var j=Object.defineProperty;var he=Object.getOwnPropertyDescriptor;var me=Object.getOwnPropertyNames;var ge=Object.getPrototypeOf,ve=Object.prototype.hasOwnProperty;var we=(o,t)=>{for(var s in t)j(o,s,{get:t[s],enumerable:!0})},se=(o,t,s,i)=>{if(t&&typeof t=="object"||typeof t=="function")for(let e of me(t))!ve.call(o,e)&&e!==s&&j(o,e,{get:()=>t[e],enumerable:!(i=he(t,e))||i.enumerable});return o};var T=(o,t,s)=>(s=o!=null?fe(ge(o)):{},se(t||!o||!o.__esModule?j(s,"default",{value:o,enumerable:!0}):s,o)),ye=o=>se(j({},"__esModule",{value:!0}),o);var at={};we(at,{activate:()=>Ze,deactivate:()=>ot});module.exports=ye(at);var u=T(require("vscode")),S=T(require("path")),z=T(require("fs/promises")),le=require("worker_threads");var w=T(require("vscode")),ne=T(require("path")),_=class o{static viewType="auraVisualizer.graphView";panel;extensionUri;disposables=[];onOpenFileEmitter=new w.EventEmitter;onOpenFile=this.onOpenFileEmitter.event;onDisposeEmitter=new w.EventEmitter;onDidDispose=this.onDisposeEmitter.event;pendingData;webviewReady=!1;constructor(t){this.extensionUri=t}show(){return this.panel?(this.panel.reveal(w.ViewColumn.One),this.panel):(this.panel=w.window.createWebviewPanel(o.viewType,"Aura \u2014 3D Visualizer",w.ViewColumn.One,{enableScripts:!0,retainContextWhenHidden:!0,localResourceRoots:[w.Uri.joinPath(this.extensionUri,"out","webview")]}),this.initPanel(),this.panel)}restore(t){this.panel=t,t.webview.options={enableScripts:!0,localResourceRoots:[w.Uri.joinPath(this.extensionUri,"out","webview")]},this.initPanel()}initPanel(){this.panel&&(this.panel.iconPath=w.Uri.joinPath(this.extensionUri,"resources","icon.png"),this.panel.webview.html=this.getHtmlContent(this.panel.webview),this.setupMessageHandler(),this.panel.onDidDispose(()=>{this.panel=void 0,this.webviewReady=!1,this.disposables.forEach(t=>t.dispose()),this.disposables=[],this.onDisposeEmitter.fire()}))}setupMessageHandler(){this.panel&&this.panel.webview.onDidReceiveMessage(t=>{switch(t.type){case"ready":this.webviewReady=!0,this.pendingData&&this.panel?.webview.postMessage({type:"graphData",payload:this.pendingData});break;case"openFile":t.payload&&this.onOpenFileEmitter.fire({path:t.payload.path,line:t.payload.line});break;case"requestRefresh":w.commands.executeCommand("auraVisualizer.refresh");break;case"requestExport":w.commands.executeCommand("auraVisualizer.exportGraph");break}},null,this.disposables)}sendGraphData(t){this.pendingData=t,this.webviewReady&&this.panel?.webview.postMessage({type:"graphData",payload:t})}sendGraphDelta(t){this.webviewReady&&this.panel?.webview.postMessage({type:"updateGraph",payload:t})}focusNode(t){this.panel?.webview.postMessage({type:"focusNode",payload:{nodeId:t}})}sendTheme(t){this.panel?.webview.postMessage({type:"themeChanged",payload:{kind:t}})}get isVisible(){return this.panel?.visible??!1}dispose(){this.panel?.dispose()}getHtmlContent(t){let s=ne.join("out","webview"),i=t.asWebviewUri(w.Uri.joinPath(this.extensionUri,s,"css","style.css")),e=t.asWebviewUri(w.Uri.joinPath(this.extensionUri,s,"js","app.js")),n=t.asWebviewUri(w.Uri.joinPath(this.extensionUri,s,"js","graph-config.js")),l=t.asWebviewUri(w.Uri.joinPath(this.extensionUri,s,"lib","3d-force-graph.min.js")),c=t.asWebviewUri(w.Uri.joinPath(this.extensionUri,s,"lib","three.global.js")),d=be();return`<!DOCTYPE html>
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
</html>`}};function be(){let o=new Uint8Array(16);return require("crypto").randomFillSync(o),Array.from(o,t=>t.toString(16).padStart(2,"0")).join("")}var y=T(require("vscode")),I=class extends y.TreeItem{constructor(s,i){let e=s.kind==="file"?s.node.name:s.kind==="stat"?`${s.label}: ${s.value}`:s.label;super(e,i);this.entry=s;s.kind==="header"?this.iconPath=new y.ThemeIcon(s.icon):s.kind==="stat"?this.iconPath=new y.ThemeIcon(s.icon):s.kind==="file"&&(this.description=s.metric,this.iconPath=new y.ThemeIcon("file"),this.command={command:"auraVisualizer.openFileFromTree",title:"Open File",arguments:[s.node.path]},this.tooltip=`${s.node.path}
Complexity: ${s.node.complexity}
Lines: ${s.node.linesOfCode}
Fan-in: ${s.node.fanIn} / Fan-out: ${s.node.fanOut}`)}},W=class{_onDidChangeTreeData=new y.EventEmitter;onDidChangeTreeData=this._onDidChangeTreeData.event;data;update(t){this.data=t,this._onDidChangeTreeData.fire(void 0)}getTreeItem(t){return t}getChildren(t){if(!this.data)return[new I({kind:"stat",label:"No data",value:"Open a workspace and run Aura",icon:"info"},y.TreeItemCollapsibleState.None)];if(!t)return[new I({kind:"header",label:"Stats",icon:"graph"},y.TreeItemCollapsibleState.Expanded),new I({kind:"header",label:"Most Complex",icon:"flame"},y.TreeItemCollapsibleState.Collapsed),new I({kind:"header",label:"Largest Files",icon:"file-binary"},y.TreeItemCollapsibleState.Collapsed),new I({kind:"header",label:"Orphan Files",icon:"warning"},y.TreeItemCollapsibleState.Collapsed)];if(t.entry.kind!=="header")return[];let s=this.data;switch(t.entry.label){case"Stats":{let i=Object.entries(s.meta.languageStats).map(([e,n])=>`${e}: ${n.count}`).join(", ");return[this.stat("Files",String(s.meta.totalFiles),"file"),this.stat("Links",String(s.meta.totalLinks),"link"),this.stat("Function Calls",String(s.meta.functionCallLinks),"symbol-method"),this.stat("Groups",String(s.meta.groups.length),"folder"),this.stat("Languages",i,"symbol-color")]}case"Most Complex":return[...s.nodes].sort((i,e)=>e.complexity-i.complexity).slice(0,10).map(i=>new I({kind:"file",node:i,metric:`complexity: ${i.complexity}`},y.TreeItemCollapsibleState.None));case"Largest Files":return[...s.nodes].sort((i,e)=>e.linesOfCode-i.linesOfCode).slice(0,10).map(i=>new I({kind:"file",node:i,metric:`${i.linesOfCode} lines`},y.TreeItemCollapsibleState.None));case"Orphan Files":return s.nodes.filter(i=>i.fanIn===0&&i.fanOut===0).map(i=>new I({kind:"file",node:i,metric:i.language},y.TreeItemCollapsibleState.None));default:return[]}}stat(t,s,i){return new I({kind:"stat",label:t,value:s,icon:i},y.TreeItemCollapsibleState.None)}};var M=require("fs/promises"),G=require("path"),xe=new Set([".c",".h",".js",".ts",".py",".css",".html",".htm"]),Re={".c":"c",".h":"c",".js":"javascript",".ts":"typescript",".py":"python",".css":"css",".html":"html",".htm":"html"};async function Q(o,t){let s=(0,G.extname)(o).toLowerCase();if(!xe.has(s))return null;try{let i=await(0,M.stat)(o),e=await(0,M.readFile)(o,"utf-8"),n=e.split(`
`).filter(p=>p.trim().length>0).length,l=(0,G.relative)(t,o),c=l.split("/"),d=c.length>1?c[0]:"/",h=c[c.length-1];return{id:l,name:h,path:l,fullPath:o,language:Re[s]||"unknown",extension:s,size:i.size,linesOfCode:n,lastModified:Math.floor(i.mtimeMs),group:d,content:e}}catch{return null}}var $=require("path");var k=class{language;constructor(t){this.language=t}parse(t,s){return[]}extractMatches(t,s,i,e,n){let l=[],c;for(;(c=s.exec(t))!==null;){let d=c[1];d&&l.push({source:e,target:d,type:i,label:n?n(c):`${i}: ${d}`})}return l}};var Ce=/#include\s*"([^"]+)"/g,ke=/#include\s*<([^>]+)>/g,Se=/^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?((?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+)([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/gm,Fe=/extern\s+[\w\s*]+\s+(\w+)\s*\([^)]*\)\s*;/g,Ee=/(?:typedef\s+)?struct\s+(\w+)\s*\{/g,Ie=/typedef\s+struct\s*(?:\w+\s*)?\{[^}]*\}\s*(\w+)\s*;/gs,De=/(?:typedef\s+)?enum\s+(\w+)\s*\{/g,Pe=/^[ \t]*#define\s+(\w+)(?:\(([^)]*)\))?/gm,ie=new Set(["if","else","for","while","do","switch","case","return","break","continue","goto","sizeof","typeof","typedef","struct","union","enum","static","extern","inline","const","volatile","register","auto","void","int","char","float","double","long","short","unsigned","signed","bool","BOOL","printf","fprintf","sprintf","snprintf","scanf","sscanf","malloc","calloc","realloc","free","memcpy","memset","memmove","strlen","strcpy","strncpy","strcmp","strncmp","strcat","fopen","fclose","fread","fwrite","fseek","ftell","exit","abort","assert","NULL","true","false","defined","offsetof","va_start","va_end","va_arg","__attribute__","__declspec","visibility","__extension__"]),V=class extends k{constructor(){super("c")}parse(t,s={}){let{content:i,id:e}=t,n=[];return n.push(...this.extractMatches(i,new RegExp(Ce.source,"g"),"include",e,l=>`#include "${l[1]}"`)),s.includeSystemHeaders&&n.push(...this.extractMatches(i,new RegExp(ke.source,"g"),"system-include",e,l=>`#include <${l[1]}>`)),n}extractSymbols(t){let{content:s}=t,i={functions:[],externs:[],structs:[],enums:[],macros:[]},e=this.stripComments(s),n,l=new RegExp(Se.source,"gm");for(;(n=l.exec(e))!==null;){let F=(n[1]||"").trim(),r=n[2],m=(n[3]||"").trim();if(!ie.has(r)){let P=e.substring(0,n.index).split(`
`).length;i.functions.push({name:r,returnType:F,params:m,line:P,type:"function"})}}let c=new RegExp(Fe.source,"g");for(;(n=c.exec(e))!==null;)i.externs.push({name:n[1],type:"extern"});let d=new RegExp(Ee.source,"g");for(;(n=d.exec(e))!==null;)i.structs.push({name:n[1],type:"struct"});let h=new RegExp(Ie.source,"gs");for(;(n=h.exec(e))!==null;)i.structs.push({name:n[1],type:"typedef-struct"});let p=new RegExp(De.source,"g");for(;(n=p.exec(e))!==null;)i.enums.push({name:n[1],type:"enum"});let v=new RegExp(Pe.source,"gm");for(;(n=v.exec(e))!==null;){let F=n[1],r=n[2]!==void 0;i.macros.push({name:F,type:r?"function-macro":"constant-macro"})}return i}extractCalls(t){let{content:s}=t,i=this.stripComments(s),e=new Set,n=/^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?(?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+([a-zA-Z_]\w*)\s*\([^)]*\)\s*\{/gm,l;for(;(l=n.exec(i))!==null;)e.add(l[1]);let c=new Set,d=/\b(\w+)\s*\(/g,h;for(;(h=d.exec(i))!==null;){let p=h[1];!ie.has(p)&&!/^[A-Z_]+$/.test(p)&&!e.has(p)&&c.add(p)}return[...c]}stripComments(t){let s=t.replace(/\/\/.*$/gm,"");return s=s.replace(/\/\*[\s\S]*?\*\//g,""),s=s.replace(/"(?:[^"\\]|\\.)*"/g,'""'),s}};var $e=/import\s+(?:[\w{}\s,*]+\s+from\s+)?['"]([^'"]+)['"]/g,Oe=/(?:^|[=(\s,])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,Te=/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,_e=/import\s*\(\s*`([^`$]+)/g,L=class extends k{constructor(){super("javascript")}parse(t){let{content:s,id:i}=t,e=[];return e.push(...this.extractMatches(s,new RegExp($e.source,"g"),"import",i,n=>`import from '${n[1]}'`)),e.push(...this.extractMatches(s,new RegExp(Oe.source,"g"),"require",i,n=>`require('${n[1]}')`)),e.push(...this.extractMatches(s,new RegExp(Te.source,"g"),"dynamic-import",i,n=>`import('${n[1]}')`)),e.push(...this.extractMatches(s,new RegExp(_e.source,"g"),"dynamic-import",i,n=>`import('${n[1].split("?")[0]}')`).map(n=>({...n,target:n.target.split("?")[0]}))),e}};var Le=/<script[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,Ae=/<link[^>]+href\s*=\s*['"]([^'"]+)['"]/gi,Me=/<img[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,B=class extends k{constructor(){super("html")}parse(t,s={}){let{content:i,id:e}=t,n=[];return n.push(...this.extractMatches(i,new RegExp(Le.source,"gi"),"script",e,l=>`<script src="${l[1]}">`)),n.push(...this.extractMatches(i,new RegExp(Ae.source,"gi"),"stylesheet",e,l=>`<link href="${l[1]}">`)),s.includeAssets&&n.push(...this.extractMatches(i,new RegExp(Me.source,"gi"),"asset",e,l=>`<img src="${l[1]}">`)),n}};var Ge=/@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"]\s*\)?/g,Ue=/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/g,H=class extends k{constructor(){super("css")}parse(t,s={}){let{content:i,id:e}=t,n=[];if(n.push(...this.extractMatches(i,new RegExp(Ge.source,"g"),"css-import",e,l=>`@import "${l[1]}"`)),s.includeUrls){let l=this.extractMatches(i,new RegExp(Ue.source,"g"),"css-url",e,c=>`url("${c[1]}")`);n.push(...l.filter(c=>!c.target.startsWith("data:")&&!c.target.startsWith("http:")&&!c.target.startsWith("https:")&&!c.target.startsWith("#")))}return n}};var q=class extends L{constructor(){super(),this.language="typescript"}};var ze=/^import\s+([\w.]+)/gm,Ne=/^from\s+([\w.]+)\s+import/gm,Y=class extends k{constructor(){super("python")}parse(t){let{content:s,id:i}=t,e=[];return e.push(...this.extractMatches(s,new RegExp(ze.source,"gm"),"import",i,n=>`import ${n[1]}`)),e.push(...this.extractMatches(s,new RegExp(Ne.source,"gm"),"from-import",i,n=>`from ${n[1]} import`)),e}};var je=/\b(if|else\s+if|for|while|do|switch|case|catch)\b/g,We=/(\|\||&&)/g,Ve=/[^?]\?[^?:]/g,Be=/[^{}]+(?=\s*\{)/g,He=/@media\b/g;function oe(o){let{content:t,language:s}=o;switch(s){case"c":case"javascript":case"typescript":return ae(t);case"css":return qe(t);case"html":return Ye(t);default:return{complexity:1,details:{}}}}function ae(o){let t=o.replace(/\/\/.*$/gm,"").replace(/\/\*[\s\S]*?\*\//g,"").replace(/"(?:[^"\\]|\\.)*"/g,'""').replace(/'(?:[^'\\]|\\.)*'/g,"''"),s=1,i={},e={},n=new RegExp(je.source,"g"),l;for(;(l=n.exec(t))!==null;){let v=l[1].replace(/\s+/g," ");e[v]=(e[v]||0)+1,s++}i.keywords=e;let c=new RegExp(We.source,"g"),d=0;for(;(l=c.exec(t))!==null;)d++,s++;i.logicalOperators=d;let h=new RegExp(Ve.source,"g"),p=0;for(;(l=h.exec(t))!==null;)p++,s++;return i.ternaryOperators=p,{complexity:s,details:i}}function qe(o){let t=o.replace(/\/\*[\s\S]*?\*\//g,""),s=0,i=new RegExp(Be.source,"g"),e;for(;(e=i.exec(t))!==null;){let d=e[0].split(",").filter(h=>h.trim().length>0);s+=d.length}let n=0,l=new RegExp(He.source,"g");for(;(e=l.exec(t))!==null;)n++;return{complexity:Math.max(1,Math.round(1+s/10+n)),details:{selectors:s,mediaQueries:n}}}function Ye(o){let t=/\bon\w+\s*=/gi,s=0,i;for(;(i=t.exec(o))!==null;)s++;let e=/<script\b[^>]*>[\s\S]*?<\/script>/gi,n=0,l=0;for(;(i=e.exec(o))!==null;){n++;let d=ae(i[0]);l+=d.complexity-1}return{complexity:Math.max(1,1+s+l),details:{eventHandlers:s,scriptBlocks:n,inlineJSComplexity:l}}}var re={c:new V,javascript:new L,typescript:new q,python:new Y,html:new B,css:new H};function Je(o,t,s){if(s.has(o))return o;let i=(0,$.dirname)(t),e=(0,$.normalize)((0,$.join)(i,o));if(s.has(e))return e;let n=[".js",".ts",".py",".c",".h",".css",".html"];for(let d of n){if(s.has(e+d))return e+d;if(s.has(o+d))return o+d}let l=(0,$.join)(e,"index.js");if(s.has(l))return l;let c=(0,$.basename)(o);for(let[d,h]of s)if(h.name===c)return d;for(let d of n){let h=c+d;for(let[p,v]of s)if(v.name===h)return p}return null}function X(o,t="Project",s={}){let i=new Map;for(let a of o)i.set(a.id,a);let e=[];for(let a of o){let f=re[a.language];if(f){let E=f.parse(a,s);e.push(...E)}}let n=re.c,l=new Map,c=new Map;for(let a of o)if(a.language==="c"){let f=n.extractSymbols(a);l.set(a.id,f);for(let E of f.functions)c.has(E.name)||c.set(E.name,[]),c.get(E.name).push(a.id)}let d=[];for(let a of o)if(a.language==="c"&&a.extension===".c"){let f=n.extractCalls(a),E=l.get(a.id),N=new Set(E?E.functions.map(x=>x.name):[]);for(let x of f){if(N.has(x))continue;let ee=c.get(x);if(ee)for(let te of ee)te!==a.id&&d.push({source:a.id,target:te,type:"function-call",label:`${x}()`})}}let h=new Map;for(let a of o){let f=oe(a);h.set(a.id,f)}let p=[],v={count:0,targets:[]};for(let a of e){let f=Je(a.target,a.source,i);f?f!==a.source&&p.push({source:a.source,target:f,type:a.type,label:a.label}):(v.count++,v.targets.length<20&&v.targets.push({from:a.source,ref:a.target}))}p.push(...d);let F=new Set,r=p.filter(a=>{let f=`${a.source}|${a.target}|${a.type}`;return F.has(f)?!1:(F.add(f),!0)}),m=new Map,P=new Map;for(let a of r)m.set(a.source,(m.get(a.source)||0)+1),P.set(a.target,(P.get(a.target)||0)+1);let D=o.map(a=>{let f=l.get(a.id),E=h.get(a.id)||{complexity:1,details:{}},N={id:a.id,name:a.name,path:a.path,language:a.language,extension:a.extension,size:a.size,linesOfCode:a.linesOfCode,lastModified:a.lastModified||0,group:a.group,fanOut:m.get(a.id)||0,fanIn:P.get(a.id)||0,complexity:E.complexity,complexityDetails:E.details};return f&&(N.symbols={functions:f.functions.map(x=>({name:x.name,returnType:x.returnType||"",params:x.params||"",line:x.line||0,type:x.type})),structs:f.structs.map(x=>({name:x.name,type:x.type})),enums:f.enums.map(x=>({name:x.name,type:x.type})),macros:f.macros.slice(0,30),totalSymbols:f.functions.length+f.structs.length+f.enums.length+f.macros.length}),N}),C={};for(let a of D)C[a.language]||(C[a.language]={count:0,totalLOC:0,avgComplexity:0}),C[a.language].count++,C[a.language].totalLOC+=a.linesOfCode,C[a.language].avgComplexity+=a.complexity;for(let a in C)C[a].avgComplexity=Math.round(C[a].avgComplexity/C[a].count*10)/10;let de=new Set(D.map(a=>a.group)),ue=r.filter(a=>a.type==="function-call").length;return{meta:{projectName:t,analyzedAt:new Date().toISOString(),totalFiles:D.length,totalLinks:r.length,totalRelationsFound:e.length,functionCallLinks:ue,unresolvedReferences:v.count,unresolvedSamples:v.targets,languageStats:C,groups:[...de].sort()},nodes:D,links:r}}var g,b,O=[],A,R,U,Z,J=!1;function Ze(o){Z=new W;let t=u.window.createTreeView("auraVisualizer.statsView",{treeDataProvider:Z,showCollapseAll:!0});o.subscriptions.push(t),R=u.window.createStatusBarItem(u.StatusBarAlignment.Left,50),R.command="auraVisualizer.open",R.text="$(eye) Aura",R.tooltip="Open Aura 3D Visualizer",R.show(),o.subscriptions.push(R),o.subscriptions.push(u.commands.registerCommand("auraVisualizer.open",()=>Ke(o)),u.commands.registerCommand("auraVisualizer.refresh",()=>K(o)),u.commands.registerCommand("auraVisualizer.focusFile",()=>tt()),u.commands.registerCommand("auraVisualizer.openFileFromTree",s=>{let i=u.workspace.workspaceFolders?.[0];if(!i)return;let e=S.join(i.uri.fsPath,s);u.window.showTextDocument(u.Uri.file(e),{preview:!0})}),u.commands.registerCommand("auraVisualizer.exportGraph",()=>st())),it(o),o.subscriptions.push(u.window.onDidChangeActiveTextEditor(s=>{if(s&&g?.isVisible){let i=u.workspace.workspaceFolders?.[0];if(i){let e=S.relative(i.uri.fsPath,s.document.uri.fsPath);e.startsWith("..")||g.focusNode(e)}}})),o.subscriptions.push(u.window.onDidChangeActiveColorTheme(s=>{g?.sendTheme(s.kind)})),u.window.registerWebviewPanelSerializer(_.viewType,{async deserializeWebviewPanel(s){g||(g=new _(o.extensionUri),ce()),g.restore(s),b&&g.sendGraphData(b)}}),u.workspace.workspaceFolders?.length&&K(o)}function ce(){g&&g.onOpenFile(async({path:o,line:t})=>{let s=u.workspace.workspaceFolders?.[0];if(!s)return;let i=S.join(s.uri.fsPath,o),e=u.Uri.file(i);try{let n=await u.workspace.openTextDocument(e),l=await u.window.showTextDocument(n,{preserveFocus:!1});if(t&&t>0){let c=new u.Position(t-1,0);l.selection=new u.Selection(c,c),l.revealRange(new u.Range(c,c),u.TextEditorRevealType.InCenter)}}catch{}})}async function Ke(o){g||(g=new _(o.extensionUri),ce()),g.show(),b?g.sendGraphData(b):await K(o)}async function K(o){if(J)return;J=!0;let t=u.workspace.workspaceFolders?.[0];if(!t){J=!1,u.window.showWarningMessage("Aura: No workspace folder open.");return}let s=t.uri.fsPath,e=u.workspace.getConfiguration("auraVisualizer").get("excludePaths",["node_modules",".git","dist","build","out","__pycache__"]);R&&(R.text="$(loading~spin) Aura: Analyzing...");try{let n=await u.window.withProgress({location:u.ProgressLocation.Window,title:"Aura: Analyzing codebase..."},()=>Qe(o.extensionUri,s,e,t.name));b=n.graphData,O=n.files,g&&g.sendGraphData(b),Z?.update(b),pe()}catch(n){let l=n instanceof Error?n.message:String(n);u.window.showErrorMessage(`Aura: Analysis failed \u2014 ${l}`),R&&(R.text="$(eye) Aura")}finally{J=!1}}function Qe(o,t,s,i){return new Promise((e,n)=>{let l=S.join(o.fsPath,"out","analyzer-worker.js"),c=new le.Worker(l,{workerData:{rootPath:t,skipDirs:s,projectName:i}});c.on("message",d=>{d.error?n(new Error(d.error)):e({graphData:d.graphData,files:d.files}),c.terminate()}),c.on("error",d=>{n(d),c.terminate()}),c.on("exit",d=>{d!==0&&n(new Error(`Worker exited with code ${d}`))})})}async function Xe(o,t){let s=u.workspace.workspaceFolders?.[0];if(!s||O.length===0)return;let i=s.uri.fsPath,e=S.relative(i,o.fsPath);if(e.startsWith(".."))return;if(t)O=O.filter(c=>c.id!==e);else{let c=await Q(o.fsPath,i);if(!c)return;let d=O.findIndex(h=>h.id===e);d>=0?O[d]=c:O.push(c)}let n=b,l=s.name;if(b=X(O,l),g?.isVisible&&b)if(n){let c=et(n,b,e,t);g.sendGraphDelta(c)}else g.sendGraphData(b);Z?.update(b),pe()}function et(o,t,s,i){let e={changedNodes:[],removedNodeIds:[],addedLinks:[],removedLinks:[],meta:t.meta};i&&e.removedNodeIds.push(s);let n=new Map(o.nodes.map(p=>[p.id,p])),l=new Map(t.nodes.map(p=>[p.id,p]));for(let p of t.nodes){let v=n.get(p.id);(!v||p.fanIn!==v.fanIn||p.fanOut!==v.fanOut||p.complexity!==v.complexity||p.linesOfCode!==v.linesOfCode||p.size!==v.size)&&e.changedNodes.push(p)}for(let p of o.nodes)l.has(p.id)||e.removedNodeIds.includes(p.id)||e.removedNodeIds.push(p.id);let c=p=>`${typeof p.source=="object"?p.source.id:p.source}|${typeof p.target=="object"?p.target.id:p.target}|${p.type}`,d=new Set(o.links.map(c)),h=new Set(t.links.map(c));for(let p of t.links)d.has(c(p))||e.addedLinks.push(p);for(let p of o.links)h.has(c(p))||e.removedLinks.push({source:typeof p.source=="object"?p.source.id:p.source,target:typeof p.target=="object"?p.target.id:p.target,type:p.type});return e}function pe(){if(!R||!b)return;let{totalFiles:o,totalLinks:t}=b.meta;R.text=`$(eye) Aura: ${o} files, ${t} links`,R.tooltip=`Aura \u2014 ${o} files, ${t} dependencies
Click to open 3D visualizer`}function tt(){let o=u.window.activeTextEditor;if(!o||!g?.isVisible)return;let t=u.workspace.workspaceFolders?.[0];if(!t)return;let s=S.relative(t.uri.fsPath,o.document.uri.fsPath);s.startsWith("..")||g.focusNode(s)}async function st(){let o=u.workspace.workspaceFolders?.[0];if(!o){u.window.showWarningMessage("Aura: No workspace folder open.");return}if(!b){u.window.showWarningMessage("Aura: No graph data. Run analysis first (Ctrl+Shift+A).");return}let t=S.join(o.uri.fsPath,".aura");await z.mkdir(t,{recursive:!0});let s=b,i={meta:s.meta,nodes:s.nodes.map(n=>({id:n.id,name:n.name,path:n.path,language:n.language,extension:n.extension,size:n.size,linesOfCode:n.linesOfCode,group:n.group,fanIn:n.fanIn,fanOut:n.fanOut,complexity:n.complexity})),links:s.links.map(n=>({source:n.source,target:n.target,type:n.type,label:n.label}))};await z.writeFile(S.join(t,"graph.json"),JSON.stringify(i,null,2),"utf-8");let e=nt(s);await z.writeFile(S.join(t,"summary.md"),e,"utf-8"),u.window.showInformationMessage("Aura: Exported to .aura/ \u2014 graph.json + summary.md","Open summary").then(n=>{n==="Open summary"&&u.window.showTextDocument(u.Uri.file(S.join(t,"summary.md")),{preview:!0})})}function nt(o){let{meta:t,nodes:s,links:i}=o,e=[];e.push(`# Aura Graph \u2014 ${t.projectName}`),e.push(`> Auto-generated by Aura Visualizer on ${t.analyzedAt}`),e.push("> This file describes the codebase architecture for AI-assisted development."),e.push(""),e.push("## Overview"),e.push(`- **${t.totalFiles}** files, **${t.totalLinks}** dependencies`);let n=Object.entries(t.languageStats).sort((r,m)=>m[1].count-r[1].count).map(([r,m])=>`${r} (${m.count} files, ${m.totalLOC} LOC)`);if(e.push(`- Languages: ${n.join(", ")}`),t.unresolvedReferences>0&&e.push(`- Unresolved references: ${t.unresolvedReferences}`),e.push(""),t.groups.length>0){e.push("## Directory Structure");for(let r of t.groups){let m=s.filter(D=>D.group===r),P=m.reduce((D,C)=>D+C.linesOfCode,0);e.push(`- \`${r}/\` \u2014 ${m.length} files, ${P} LOC`)}e.push("")}let l=[...s].sort((r,m)=>m.fanIn-r.fanIn).slice(0,15).filter(r=>r.fanIn>0);if(l.length>0){e.push("## Hotspots (most depended-on files)"),e.push("| File | Fan-in | Fan-out | Complexity | LOC |"),e.push("|------|--------|---------|------------|-----|");for(let r of l)e.push(`| \`${r.id}\` | ${r.fanIn} | ${r.fanOut} | ${r.complexity} | ${r.linesOfCode} |`);e.push("")}let c=[...s].sort((r,m)=>m.complexity-r.complexity).slice(0,10).filter(r=>r.complexity>1);if(c.length>0){e.push("## Most Complex Files"),e.push("| File | Complexity | LOC | Fan-in | Fan-out |"),e.push("|------|------------|-----|--------|---------|");for(let r of c)e.push(`| \`${r.id}\` | ${r.complexity} | ${r.linesOfCode} | ${r.fanIn} | ${r.fanOut} |`);e.push("")}let d=[...s].sort((r,m)=>m.linesOfCode-r.linesOfCode).slice(0,10);if(d.length>0){e.push("## Largest Files"),e.push("| File | LOC | Complexity | Language |"),e.push("|------|-----|------------|----------|");for(let r of d)e.push(`| \`${r.id}\` | ${r.linesOfCode} | ${r.complexity} | ${r.language} |`);e.push("")}let h=s.filter(r=>r.fanIn===0&&r.fanOut===0);if(h.length>0){e.push("## Orphan Files (no dependencies)");for(let r of h)e.push(`- \`${r.id}\` (${r.language}, ${r.linesOfCode} LOC)`);e.push("")}let p=[],v=new Set(i.map(r=>`${r.source}\u2192${r.target}`));for(let r of i){let m=`${r.target}\u2192${r.source}`;v.has(m)&&r.source<r.target&&p.push(`\`${r.source}\` \u2194 \`${r.target}\``)}if(p.length>0){e.push("## Circular Dependencies");for(let r of p)e.push(`- ${r}`);e.push("")}let F={};for(let r of i)F[r.type]=(F[r.type]||0)+1;if(Object.keys(F).length>0){e.push("## Dependency Types");for(let[r,m]of Object.entries(F).sort((P,D)=>D[1]-P[1]))e.push(`- **${r}**: ${m}`);e.push("")}return e.push("## Usage Notes for AI Agents"),e.push("- Files with high fan-in are **critical hubs** \u2014 changes impact many dependents."),e.push("- Check circular dependencies before refactoring \u2014 break cycles where possible."),e.push("- Orphan files may be dead code candidates for cleanup."),e.push("- Use `graph.json` for programmatic queries (e.g., find all dependents of a file)."),e.push("- High complexity files (>15) are prime candidates for decomposition."),e.push(""),e.join(`
`)}function it(o){if(!u.workspace.getConfiguration("auraVisualizer").get("autoRefresh",!0))return;A=u.workspace.createFileSystemWatcher("**/*.{c,h,js,ts,py,css,html}");let i=new Map,e=()=>{U&&clearTimeout(U),U=setTimeout(async()=>{let n=new Map(i);if(i.clear(),O.length===0){g?.isVisible?K(o):b=void 0;return}for(let[,l]of n)await Xe(l.uri,l.deleted)},500)};A.onDidChange(n=>{i.set(n.fsPath,{uri:n,deleted:!1}),e()}),A.onDidCreate(n=>{i.set(n.fsPath,{uri:n,deleted:!1}),e()}),A.onDidDelete(n=>{i.set(n.fsPath,{uri:n,deleted:!0}),e()}),o.subscriptions.push(A)}function ot(){g?.dispose(),A?.dispose(),U&&clearTimeout(U)}0&&(module.exports={activate,deactivate});
