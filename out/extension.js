"use strict";var Ae=Object.create;var q=Object.defineProperty;var Oe=Object.getOwnPropertyDescriptor;var Pe=Object.getOwnPropertyNames;var $e=Object.getPrototypeOf,Te=Object.prototype.hasOwnProperty;var Le=(i,n)=>{for(var s in n)q(i,s,{get:n[s],enumerable:!0})},de=(i,n,s,o)=>{if(n&&typeof n=="object"||typeof n=="function")for(let e of Pe(n))!Te.call(i,e)&&e!==s&&q(i,e,{get:()=>n[e],enumerable:!(o=Oe(n,e))||o.enumerable});return i};var L=(i,n,s)=>(s=i!=null?Ae($e(i)):{},de(n||!i||!i.__esModule?q(s,"default",{value:i,enumerable:!0}):s,i)),Me=i=>de(q({},"__esModule",{value:!0}),i);var Ot={};Le(Ot,{activate:()=>Rt,deactivate:()=>At});module.exports=Me(Ot);var u=L(require("vscode")),F=L(require("path")),H=L(require("fs/promises")),xe=require("worker_threads");var R=L(require("vscode")),ue=L(require("path")),M=class i{static viewType="auraVisualizer.graphView";panel;extensionUri;disposables=[];onOpenFileEmitter=new R.EventEmitter;onOpenFile=this.onOpenFileEmitter.event;onDisposeEmitter=new R.EventEmitter;onDidDispose=this.onDisposeEmitter.event;pendingData;webviewReady=!1;constructor(n){this.extensionUri=n}show(){return this.panel?(this.panel.reveal(R.ViewColumn.One),this.panel):(this.panel=R.window.createWebviewPanel(i.viewType,"Aura \u2014 3D Visualizer",R.ViewColumn.One,{enableScripts:!0,retainContextWhenHidden:!0,localResourceRoots:[R.Uri.joinPath(this.extensionUri,"out","webview")]}),this.initPanel(),this.panel)}restore(n){this.panel=n,n.webview.options={enableScripts:!0,localResourceRoots:[R.Uri.joinPath(this.extensionUri,"out","webview")]},this.initPanel()}initPanel(){this.panel&&(this.panel.iconPath=R.Uri.joinPath(this.extensionUri,"resources","icon.png"),this.panel.webview.html=this.getHtmlContent(this.panel.webview),this.setupMessageHandler(),this.panel.onDidDispose(()=>{this.panel=void 0,this.webviewReady=!1,this.disposables.forEach(n=>n.dispose()),this.disposables=[],this.onDisposeEmitter.fire()}))}setupMessageHandler(){this.panel&&this.panel.webview.onDidReceiveMessage(n=>{switch(n.type){case"ready":this.webviewReady=!0,this.pendingData&&this.panel?.webview.postMessage({type:"graphData",payload:this.pendingData});break;case"openFile":n.payload&&this.onOpenFileEmitter.fire({path:n.payload.path,line:n.payload.line});break;case"requestRefresh":R.commands.executeCommand("auraVisualizer.refresh");break;case"requestExport":R.commands.executeCommand("auraVisualizer.exportGraph");break}},null,this.disposables)}sendGraphData(n){this.pendingData=n,this.webviewReady&&this.panel?.webview.postMessage({type:"graphData",payload:n})}sendGraphDelta(n){this.webviewReady&&this.panel?.webview.postMessage({type:"updateGraph",payload:n})}focusNode(n){this.panel?.webview.postMessage({type:"focusNode",payload:{nodeId:n}})}sendTheme(n){this.panel?.webview.postMessage({type:"themeChanged",payload:{kind:n}})}get isVisible(){return this.panel?.visible??!1}dispose(){this.panel?.dispose()}getHtmlContent(n){let s=ue.join("out","webview"),o=n.asWebviewUri(R.Uri.joinPath(this.extensionUri,s,"css","style.css")),e=n.asWebviewUri(R.Uri.joinPath(this.extensionUri,s,"js","app.js")),t=n.asWebviewUri(R.Uri.joinPath(this.extensionUri,s,"js","graph-config.js")),c=n.asWebviewUri(R.Uri.joinPath(this.extensionUri,s,"lib","3d-force-graph.min.js")),p=n.asWebviewUri(R.Uri.joinPath(this.extensionUri,s,"lib","three.global.js")),d=Ne();return`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${n.cspSource} 'unsafe-inline'; script-src 'nonce-${d}' 'unsafe-eval' ${n.cspSource}; img-src ${n.cspSource} data:; font-src ${n.cspSource};">
    <link rel="stylesheet" href="${o}">
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
</html>`}};function Ne(){let i=new Uint8Array(16);return require("crypto").randomFillSync(i),Array.from(i,n=>n.toString(16).padStart(2,"0")).join("")}var S=L(require("vscode")),I=class extends S.TreeItem{constructor(s,o){let e=s.kind==="file"?s.node.name:s.kind==="stat"?`${s.label}: ${s.value}`:s.label;super(e,o);this.entry=s;s.kind==="header"?this.iconPath=new S.ThemeIcon(s.icon):s.kind==="stat"?this.iconPath=new S.ThemeIcon(s.icon):s.kind==="file"&&(this.description=s.metric,this.iconPath=new S.ThemeIcon("file"),this.command={command:"auraVisualizer.openFileFromTree",title:"Open File",arguments:[s.node.path]},this.tooltip=`${s.node.path}
Complexity: ${s.node.complexity}
Lines: ${s.node.linesOfCode}
Fan-in: ${s.node.fanIn} / Fan-out: ${s.node.fanOut}`)}},J=class{_onDidChangeTreeData=new S.EventEmitter;onDidChangeTreeData=this._onDidChangeTreeData.event;data;update(n){this.data=n,this._onDidChangeTreeData.fire(void 0)}getTreeItem(n){return n}getChildren(n){if(!this.data)return[new I({kind:"stat",label:"No data",value:"Open a workspace and run Aura",icon:"info"},S.TreeItemCollapsibleState.None)];if(!n)return[new I({kind:"header",label:"Stats",icon:"graph"},S.TreeItemCollapsibleState.Expanded),new I({kind:"header",label:"Most Complex",icon:"flame"},S.TreeItemCollapsibleState.Collapsed),new I({kind:"header",label:"Largest Files",icon:"file-binary"},S.TreeItemCollapsibleState.Collapsed),new I({kind:"header",label:"Orphan Files",icon:"warning"},S.TreeItemCollapsibleState.Collapsed)];if(n.entry.kind!=="header")return[];let s=this.data;switch(n.entry.label){case"Stats":{let o=Object.entries(s.meta.languageStats).map(([e,t])=>`${e}: ${t.count}`).join(", ");return[this.stat("Files",String(s.meta.totalFiles),"file"),this.stat("Links",String(s.meta.totalLinks),"link"),this.stat("Function Calls",String(s.meta.functionCallLinks),"symbol-method"),this.stat("Groups",String(s.meta.groups.length),"folder"),this.stat("Languages",o,"symbol-color")]}case"Most Complex":return[...s.nodes].sort((o,e)=>e.complexity-o.complexity).slice(0,10).map(o=>new I({kind:"file",node:o,metric:`complexity: ${o.complexity}`},S.TreeItemCollapsibleState.None));case"Largest Files":return[...s.nodes].sort((o,e)=>e.linesOfCode-o.linesOfCode).slice(0,10).map(o=>new I({kind:"file",node:o,metric:`${o.linesOfCode} lines`},S.TreeItemCollapsibleState.None));case"Orphan Files":return s.nodes.filter(o=>o.fanIn===0&&o.fanOut===0).map(o=>new I({kind:"file",node:o,metric:o.language},S.TreeItemCollapsibleState.None));default:return[]}}stat(n,s,o){return new I({kind:"stat",label:n,value:s,icon:o},S.TreeItemCollapsibleState.None)}};var W=require("fs/promises"),V=require("path"),Ue=new Set([".c",".h",".js",".ts",".py",".css",".html",".htm"]),je={".c":"c",".h":"c",".js":"javascript",".ts":"typescript",".py":"python",".css":"css",".html":"html",".htm":"html"};async function ie(i,n){let s=(0,V.extname)(i).toLowerCase();if(!Ue.has(s))return null;try{let o=await(0,W.stat)(i),e=await(0,W.readFile)(i,"utf-8"),t=e.split(`
`).filter(r=>r.trim().length>0).length,c=(0,V.relative)(n,i),p=c.split("/"),d=p.length>1?p[0]:"/",f=p[p.length-1];return{id:c,name:f,path:c,fullPath:i,language:je[s]||"unknown",extension:s,size:o.size,linesOfCode:t,lastModified:Math.floor(o.mtimeMs),group:d,content:e}}catch{return null}}var O=require("path");var _=class{language;constructor(n){this.language=n}parse(n,s){return[]}extractMatches(n,s,o,e,t){let c=[],p;for(;(p=s.exec(n))!==null;){let d=p[1];d&&c.push({source:e,target:d,type:o,label:t?t(p):`${o}: ${d}`})}return c}};var Ge=/#include\s*"([^"]+)"/g,ze=/#include\s*<([^>]+)>/g,We=/^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?((?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+)([a-zA-Z_]\w*)\s*\(([^)]*)\)\s*\{/gm,Ve=/extern\s+[\w\s*]+\s+(\w+)\s*\([^)]*\)\s*;/g,Be=/(?:typedef\s+)?struct\s+(\w+)\s*\{/g,He=/typedef\s+struct\s*(?:\w+\s*)?\{[^}]*\}\s*(\w+)\s*;/gs,Ye=/(?:typedef\s+)?enum\s+(\w+)\s*\{/g,qe=/^[ \t]*#define\s+(\w+)(?:\(([^)]*)\))?/gm,fe=new Set(["if","else","for","while","do","switch","case","return","break","continue","goto","sizeof","typeof","typedef","struct","union","enum","static","extern","inline","const","volatile","register","auto","void","int","char","float","double","long","short","unsigned","signed","bool","BOOL","printf","fprintf","sprintf","snprintf","scanf","sscanf","malloc","calloc","realloc","free","memcpy","memset","memmove","strlen","strcpy","strncpy","strcmp","strncmp","strcat","fopen","fclose","fread","fwrite","fseek","ftell","exit","abort","assert","NULL","true","false","defined","offsetof","va_start","va_end","va_arg","__attribute__","__declspec","visibility","__extension__"]),Z=class extends _{constructor(){super("c")}parse(n,s={}){let{content:o,id:e}=n,t=[];return t.push(...this.extractMatches(o,new RegExp(Ge.source,"g"),"include",e,c=>`#include "${c[1]}"`)),s.includeSystemHeaders&&t.push(...this.extractMatches(o,new RegExp(ze.source,"g"),"system-include",e,c=>`#include <${c[1]}>`)),t}extractSymbols(n){let{content:s}=n,o={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[]},e=this.stripComments(s),t,c=new RegExp(We.source,"gm");for(;(t=c.exec(e))!==null;){let g=(t[1]||"").trim(),l=t[2],w=(t[3]||"").trim();if(!fe.has(l)){let E=e.substring(0,t.index).split(`
`).length;o.functions.push({name:l,returnType:g,params:w,line:E,type:"function"})}}let p=new RegExp(Ve.source,"g");for(;(t=p.exec(e))!==null;)o.externs.push({name:t[1],type:"extern"});let d=new RegExp(Be.source,"g");for(;(t=d.exec(e))!==null;)o.structs.push({name:t[1],type:"struct"});let f=new RegExp(He.source,"gs");for(;(t=f.exec(e))!==null;)o.structs.push({name:t[1],type:"typedef-struct"});let r=new RegExp(Ye.source,"g");for(;(t=r.exec(e))!==null;)o.enums.push({name:t[1],type:"enum"});let h=new RegExp(qe.source,"gm");for(;(t=h.exec(e))!==null;){let g=t[1],l=t[2]!==void 0;o.macros.push({name:g,type:l?"function-macro":"constant-macro"})}return o}extractCalls(n){let{content:s}=n,o=this.stripComments(s),e=new Set,t=/^[ \t]*(?:__attribute__\s*\(\((?:[^()]*|\([^()]*\))*\)\)\s*)?(?:__declspec\s*\([^)]*\)\s*)?(?:[a-zA-Z_]\w*\s+)*[a-zA-Z_]\w*[\s*]+([a-zA-Z_]\w*)\s*\([^)]*\)\s*\{/gm,c;for(;(c=t.exec(o))!==null;)e.add(c[1]);let p=new Set,d=/\b(\w+)\s*\(/g,f;for(;(f=d.exec(o))!==null;){let r=f[1];!fe.has(r)&&!/^[A-Z_]+$/.test(r)&&!e.has(r)&&p.add(r)}return[...p]}stripComments(n){let s=n.replace(/\/\/.*$/gm,"");return s=s.replace(/\/\*[\s\S]*?\*\//g,""),s=s.replace(/"(?:[^"\\]|\\.)*"/g,'""'),s}};var Je=/import\s+(?:[\w{}\s,*]+\s+from\s+)?['"]([^'"]+)['"]/g,Ze=/(?:^|[=(\s,])require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,Xe=/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,Ke=/import\s*\(\s*`([^`$]+)/g,me=/(?:^|[\s;{}])(?:async\s+)?function\s*\*?\s+(\w+)\s*\(/gm,he=/(?:^|[\s;])(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*=>/gm;var Qe=/(?:^|[\s;])class\s+(\w+)/gm,et=/export\s+(?:(?:async\s+)?function\s*\*?\s+(\w+)|class\s+(\w+)|(?:const|let|var)\s+(\w+))/gm,tt=/export\s+default\s+(?:(?:async\s+)?function\s*\*?\s+(\w+)|class\s+(\w+)|(\w+))/gm,st=/export\s*\{([^}]+)\}/g,N=new Set(["if","else","for","while","do","switch","case","return","break","continue","throw","try","catch","finally","new","delete","typeof","instanceof","void","in","of","this","super","with","yield","await","debugger","constructor","get","set","static","async","true","false","null","undefined","NaN","Infinity","console","window","document","global","process","require","module","exports","import","export","default","from"]),nt=new Set([...N,"parseInt","parseFloat","isNaN","isFinite","encodeURI","decodeURI","encodeURIComponent","decodeURIComponent","eval","JSON","Math","Object","Array","String","Number","Boolean","Date","RegExp","Error","TypeError","RangeError","SyntaxError","ReferenceError","Map","Set","WeakMap","WeakSet","Promise","Proxy","Reflect","Symbol","BigInt","ArrayBuffer","SharedArrayBuffer","DataView","Float32Array","Float64Array","Int8Array","Int16Array","Int32Array","Uint8Array","Uint16Array","Uint32Array","URL","URLSearchParams","setTimeout","setInterval","clearTimeout","clearInterval","requestAnimationFrame","cancelAnimationFrame","fetch","alert","confirm","prompt","addEventListener","removeEventListener","dispatchEvent","createElement","getElementById","querySelector","querySelectorAll","log","warn","error","info","debug","trace","dir","push","pop","shift","unshift","splice","slice","concat","map","filter","reduce","forEach","find","findIndex","some","every","includes","indexOf","join","sort","reverse","flat","flatMap","keys","values","entries","assign","freeze","seal","defineProperty","getOwnPropertyNames","hasOwnProperty","toString","valueOf","toJSON","then","catch","resolve","reject","all","allSettled","race","any","stringify","parse","replace","match","search","split","trim","startsWith","endsWith","charAt","charCodeAt","substring","repeat","padStart","padEnd","bind","call","apply","next","done","emit","on","once","off"]),U=class extends _{constructor(){super("javascript")}parse(n){let{content:s,id:o}=n,e=[];return e.push(...this.extractMatches(s,new RegExp(Je.source,"g"),"import",o,t=>`import from '${t[1]}'`)),e.push(...this.extractMatches(s,new RegExp(Ze.source,"g"),"require",o,t=>`require('${t[1]}')`)),e.push(...this.extractMatches(s,new RegExp(Xe.source,"g"),"dynamic-import",o,t=>`import('${t[1]}')`)),e.push(...this.extractMatches(s,new RegExp(Ke.source,"g"),"dynamic-import",o,t=>`import('${t[1].split("?")[0]}')`).map(t=>({...t,target:t.target.split("?")[0]}))),e}extractSymbols(n){let{content:s}=n,o={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[]},e=this.stripCommentsAndStrings(s),t,c=new RegExp(me.source,"gm");for(;(t=c.exec(e))!==null;){let g=t[1];if(!N.has(g)){let l=e.substring(0,t.index).split(`
`).length;o.functions.push({name:g,type:"function",line:l})}}let p=new RegExp(he.source,"gm");for(;(t=p.exec(e))!==null;){let g=t[1];if(!N.has(g)){let l=e.substring(0,t.index).split(`
`).length;o.functions.some(w=>w.name===g)||o.functions.push({name:g,type:"arrow",line:l})}}let d=new RegExp(Qe.source,"gm");for(;(t=d.exec(e))!==null;){let g=t[1],l=e.substring(0,t.index).split(`
`).length;o.classes.push({name:g,type:"class",line:l})}let f=new RegExp(et.source,"gm");for(;(t=f.exec(e))!==null;){let g=t[1]||t[2]||t[3];if(g){let l=t[1]?"function":t[2]?"class":"variable";o.exports.push({name:g,type:`export-${l}`})}}let r=new RegExp(tt.source,"gm");for(;(t=r.exec(e))!==null;){let g=t[1]||t[2]||t[3];g&&!N.has(g)&&o.exports.push({name:g,type:"export-default"})}let h=new RegExp(st.source,"g");for(;(t=h.exec(e))!==null;){let g=t[1].split(",");for(let l of g){let E=l.trim().match(/^(\w+)(?:\s+as\s+\w+)?$/);E&&!N.has(E[1])&&o.exports.push({name:E[1],type:"export-named"})}}return o}extractCalls(n){let{content:s}=n,o=this.stripCommentsAndStrings(s),e=new Set,t,c=new RegExp(me.source,"gm");for(;(t=c.exec(o))!==null;)e.add(t[1]);let p=new RegExp(he.source,"gm");for(;(t=p.exec(o))!==null;)e.add(t[1]);let d=new Set,f=/(?:^|[^.\w])(\w+)\s*\(/g;for(;(t=f.exec(o))!==null;){let r=t[1];!nt.has(r)&&!N.has(r)&&!e.has(r)&&!/^[A-Z_]+$/.test(r)&&d.add(r)}return[...d]}stripCommentsAndStrings(n){let s=n.replace(/\/\/.*$/gm,"");return s=s.replace(/\/\*[\s\S]*?\*\//g,""),s=s.replace(/"(?:[^"\\]|\\.)*"/g,'""'),s=s.replace(/'(?:[^'\\]|\\.)*'/g,"''"),s=s.replace(/`(?:[^`\\]|\\.)*`/gs,"``"),s}};var ot=/<script[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,it=/<link[^>]+href\s*=\s*['"]([^'"]+)['"]/gi,at=/<img[^>]+src\s*=\s*['"]([^'"]+)['"]/gi,X=class extends _{constructor(){super("html")}parse(n,s={}){let{content:o,id:e}=n,t=[];return t.push(...this.extractMatches(o,new RegExp(ot.source,"gi"),"script",e,c=>`<script src="${c[1]}">`)),t.push(...this.extractMatches(o,new RegExp(it.source,"gi"),"stylesheet",e,c=>`<link href="${c[1]}">`)),s.includeAssets&&t.push(...this.extractMatches(o,new RegExp(at.source,"gi"),"asset",e,c=>`<img src="${c[1]}">`)),t}};var rt=/@import\s+(?:url\s*\(\s*)?['"]([^'"]+)['"]\s*\)?/g,lt=/url\s*\(\s*['"]?([^'")]+)['"]?\s*\)/g,K=class extends _{constructor(){super("css")}parse(n,s={}){let{content:o,id:e}=n,t=[];if(t.push(...this.extractMatches(o,new RegExp(rt.source,"g"),"css-import",e,c=>`@import "${c[1]}"`)),s.includeUrls){let c=this.extractMatches(o,new RegExp(lt.source,"g"),"css-url",e,p=>`url("${p[1]}")`);t.push(...c.filter(p=>!p.target.startsWith("data:")&&!p.target.startsWith("http:")&&!p.target.startsWith("https:")&&!p.target.startsWith("#")))}return t}};var Q=class extends U{constructor(){super(),this.language="typescript"}};var ct=/^import\s+([\w.]+)/gm,pt=/^from\s+([\w.]+)\s+import/gm,ge=/^[ \t]*def\s+(\w+)\s*\(/gm,we=/^[ \t]*class\s+(\w+)\s*[:(]/gm,dt=/__all__\s*=\s*\[([^\]]*)\]/gs,ut=/^[ \t]*@(\w+)/gm,ve=new Set(["print","len","range","int","str","float","list","dict","set","tuple","bool","type","isinstance","issubclass","hasattr","getattr","setattr","delattr","callable","super","property","staticmethod","classmethod","abs","all","any","bin","chr","dir","divmod","enumerate","eval","exec","filter","format","frozenset","globals","hash","hex","id","input","iter","locals","map","max","min","next","object","oct","open","ord","pow","repr","reversed","round","slice","sorted","sum","vars","zip","breakpoint","compile","complex","memoryview","bytearray","bytes","__import__","__name__","__file__","__doc__"]),ee=class extends _{constructor(){super("python")}parse(n){let{content:s,id:o}=n,e=[];return e.push(...this.extractMatches(s,new RegExp(ct.source,"gm"),"import",o,t=>`import ${t[1]}`)),e.push(...this.extractMatches(s,new RegExp(pt.source,"gm"),"from-import",o,t=>`from ${t[1]} import`)),e}extractSymbols(n){let{content:s}=n,o={functions:[],externs:[],structs:[],enums:[],macros:[],classes:[],exports:[]},e=this.stripCommentsAndStrings(s),t,c=new RegExp(ge.source,"gm");for(;(t=c.exec(e))!==null;){let h=t[1],g=e.substring(0,t.index).split(`
`).length,l=h.startsWith("__")&&h.endsWith("__");o.functions.push({name:h,type:l?"dunder":"function",line:g})}let p=new RegExp(we.source,"gm");for(;(t=p.exec(e))!==null;){let h=t[1],g=e.substring(0,t.index).split(`
`).length;o.classes.push({name:h,type:"class",line:g})}let d=new RegExp(dt.source,"gs");for(;(t=d.exec(e))!==null;){let h=t[1].split(",");for(let g of h){let l=g.trim().match(/['"](\w+)['"]/);l&&o.exports.push({name:l[1],type:"export-all"})}}let f=new RegExp(ut.source,"gm"),r=new Set;for(;(t=f.exec(e))!==null;){let h=t[1];if(!r.has(h)&&!ve.has(h)){r.add(h);let g=e.substring(0,t.index).split(`
`).length;o.macros.push({name:h,type:"decorator",line:g})}}return o}extractCalls(n){let{content:s}=n,o=this.stripCommentsAndStrings(s),e=new Set,t,c=new RegExp(ge.source,"gm");for(;(t=c.exec(o))!==null;)e.add(t[1]);let p=new RegExp(we.source,"gm");for(;(t=p.exec(o))!==null;)e.add(t[1]);let d=new Set,f=/(?:^|[^.\w])(\w+)\s*\(/g;for(;(t=f.exec(o))!==null;){let r=t[1];!ve.has(r)&&!e.has(r)&&!/^[A-Z_]+$/.test(r)&&r!=="def"&&r!=="class"&&r!=="if"&&r!=="for"&&r!=="while"&&r!=="return"&&r!=="elif"&&r!=="assert"&&r!=="raise"&&r!=="yield"&&r!=="lambda"&&r!=="not"&&r!=="and"&&r!=="or"&&d.add(r)}return[...d]}stripCommentsAndStrings(n){let s=n.replace(/"""[\s\S]*?"""/g,'""');return s=s.replace(/'''[\s\S]*?'''/g,"''"),s=s.replace(/"(?:[^"\\]|\\.)*"/g,'""'),s=s.replace(/'(?:[^'\\]|\\.)*'/g,"''"),s=s.replace(/#.*$/gm,""),s}};var ft=/\b(if|else\s+if|for|while|do|switch|case|catch)\b/g,mt=/(\|\||&&)/g,ht=/[^?]\?[^?:]/g,gt=/[^{}]+(?=\s*\{)/g,wt=/@media\b/g;function ye(i){let{content:n,language:s}=i;switch(s){case"c":case"javascript":case"typescript":return be(n);case"css":return vt(n);case"html":return yt(n);default:return{complexity:1,details:{}}}}function be(i){let n=i.replace(/\/\/.*$/gm,"").replace(/\/\*[\s\S]*?\*\//g,"").replace(/"(?:[^"\\]|\\.)*"/g,'""').replace(/'(?:[^'\\]|\\.)*'/g,"''"),s=1,o={},e={},t=new RegExp(ft.source,"g"),c;for(;(c=t.exec(n))!==null;){let h=c[1].replace(/\s+/g," ");e[h]=(e[h]||0)+1,s++}o.keywords=e;let p=new RegExp(mt.source,"g"),d=0;for(;(c=p.exec(n))!==null;)d++,s++;o.logicalOperators=d;let f=new RegExp(ht.source,"g"),r=0;for(;(c=f.exec(n))!==null;)r++,s++;return o.ternaryOperators=r,{complexity:s,details:o}}function vt(i){let n=i.replace(/\/\*[\s\S]*?\*\//g,""),s=0,o=new RegExp(gt.source,"g"),e;for(;(e=o.exec(n))!==null;){let d=e[0].split(",").filter(f=>f.trim().length>0);s+=d.length}let t=0,c=new RegExp(wt.source,"g");for(;(e=c.exec(n))!==null;)t++;return{complexity:Math.max(1,Math.round(1+s/10+t)),details:{selectors:s,mediaQueries:t}}}function yt(i){let n=/\bon\w+\s*=/gi,s=0,o;for(;(o=n.exec(i))!==null;)s++;let e=/<script\b[^>]*>[\s\S]*?<\/script>/gi,t=0,c=0;for(;(o=e.exec(i))!==null;){t++;let d=be(o[0]);c+=d.complexity-1}return{complexity:Math.max(1,1+s+c),details:{eventHandlers:s,scriptBlocks:t,inlineJSComplexity:c}}}var ae={c:new Z,javascript:new U,typescript:new Q,python:new ee,html:new X,css:new K};function bt(i,n,s){if(s.has(i))return i;let o=(0,O.dirname)(n),e=(0,O.normalize)((0,O.join)(o,i));if(s.has(e))return e;let t=[".js",".ts",".py",".c",".h",".css",".html"];for(let d of t){if(s.has(e+d))return e+d;if(s.has(i+d))return i+d}let c=(0,O.join)(e,"index.js");if(s.has(c))return c;let p=(0,O.basename)(i);for(let[d,f]of s)if(f.name===p)return d;for(let d of t){let f=p+d;for(let[r,h]of s)if(h.name===f)return r}return null}function xt(i){let n=new Map;for(let f of i)n.has(f.source)||n.set(f.source,[]),n.get(f.source).push(f.target);let s=[],o=new Set,e=new Set,t=[];function c(f){o.add(f),e.add(f),t.push(f);let r=n.get(f)||[];for(let h of r)if(e.has(h)){let g=t.indexOf(h);if(g>=0){let l=t.slice(g);l.length>=2&&s.push(l)}}else o.has(h)||c(h);t.pop(),e.delete(f)}for(let f of n.keys())o.has(f)||c(f);let p=[],d=new Set;for(let f of s){let h=[...f].sort().join("|");d.has(h)||(d.add(h),p.push(f))}return p}function re(i,n="Project",s={}){let o=new Map;for(let a of i)o.set(a.id,a);let e=[];for(let a of i){let m=ae[a.language];if(m){let v=m.parse(a,s);e.push(...v)}}let t=new Map,c={c:"c",javascript:"js",typescript:"js",python:"py"},p=new Map,d=new Set(["c","javascript","typescript","python"]);for(let a of i){if(!d.has(a.language))continue;let m=ae[a.language];if(!m.extractSymbols)continue;let v=m.extractSymbols(a);t.set(a.id,v);let x=c[a.language]||a.language;for(let T of v.functions){let y=`${x}:${T.name}`;p.has(y)||p.set(y,[]),p.get(y).push(a.id)}}let f=[],r=new Set([".h",".hpp",".d.ts"]);for(let a of i){if(!d.has(a.language)||r.has(a.extension))continue;let m=ae[a.language];if(!m.extractCalls)continue;let v=m.extractCalls(a),x=t.get(a.id),T=new Set(x?x.functions.map(z=>z.name):[]),y=c[a.language]||a.language;for(let z of v){if(T.has(z))continue;let De=`${y}:${z}`,ce=p.get(De);if(ce)for(let pe of ce)pe!==a.id&&f.push({source:a.id,target:pe,type:"function-call",label:`${z}()`})}}let h=new Map;for(let a of i){let m=ye(a);h.set(a.id,m)}let g=[],l={count:0,targets:[]};for(let a of e){let m=bt(a.target,a.source,o);m?m!==a.source&&g.push({source:a.source,target:m,type:a.type,label:a.label}):(l.count++,l.targets.length<20&&l.targets.push({from:a.source,ref:a.target}))}g.push(...f);let w=new Set,E=g.filter(a=>{let m=`${a.source}|${a.target}|${a.type}`;return w.has(m)?!1:(w.add(m),!0)}),A=new Map,G=new Map;for(let a of E)A.set(a.source,(A.get(a.source)||0)+1),G.set(a.target,(G.get(a.target)||0)+1);let Y=new Set,Ce=/(?:^|[^.\w])(\w+)\s*\(/gm;for(let a of i){let m,v=new RegExp(Ce.source,"gm");for(;(m=v.exec(a.content))!==null;)Y.add(m[1])}let le=new Map;for(let a of i){let m=t.get(a.id);if(!m)continue;let v=[];for(let x of m.functions)x.name!=="main"&&x.type!=="dunder"&&(Y.has(x.name)||v.push(x.name));for(let x of m.classes)Y.has(x.name)||v.push(x.name);for(let x of m.exports)!Y.has(x.name)&&!v.includes(x.name)&&v.push(x.name);v.length>0&&le.set(a.id,v)}let $=i.map(a=>{let m=t.get(a.id),v=h.get(a.id)||{complexity:1,details:{}},x={id:a.id,name:a.name,path:a.path,language:a.language,extension:a.extension,size:a.size,linesOfCode:a.linesOfCode,lastModified:a.lastModified||0,group:a.group,fanOut:A.get(a.id)||0,fanIn:G.get(a.id)||0,complexity:v.complexity,complexityDetails:v.details};m&&(x.symbols={functions:m.functions.map(y=>({name:y.name,returnType:y.returnType||"",params:y.params||"",line:y.line||0,type:y.type})),structs:m.structs.map(y=>({name:y.name,type:y.type})),enums:m.enums.map(y=>({name:y.name,type:y.type})),macros:m.macros.slice(0,30),classes:m.classes.map(y=>({name:y.name,type:y.type})),exports:m.exports.map(y=>({name:y.name,type:y.type})),totalSymbols:m.functions.length+m.structs.length+m.enums.length+m.macros.length+m.classes.length+m.exports.length});let T=le.get(a.id);return T&&T.length>0&&(x.deadExports=T),x}),D={};for(let a of $)D[a.language]||(D[a.language]={count:0,totalLOC:0,avgComplexity:0}),D[a.language].count++,D[a.language].totalLOC+=a.linesOfCode,D[a.language].avgComplexity+=a.complexity;for(let a in D)D[a].avgComplexity=Math.round(D[a].avgComplexity/D[a].count*10)/10;let Ee=new Set($.map(a=>a.group)),ke=E.filter(a=>a.type==="function-call").length,_e=$.filter(a=>a.deadExports&&a.deadExports.length>0).length,Fe=$.reduce((a,m)=>a+(m.deadExports?m.deadExports.length:0),0),oe=xt(E),Ie=new Map($.map(a=>[a.id,a]));for(let a=0;a<oe.length;a++)for(let m of oe[a]){let v=Ie.get(m);v&&(v.cycleIds||(v.cycleIds=[]),v.cycleIds.push(a))}return{meta:{projectName:n,analyzedAt:new Date().toISOString(),totalFiles:$.length,totalLinks:E.length,totalRelationsFound:e.length,functionCallLinks:ke,unresolvedReferences:l.count,unresolvedSamples:l.targets,deadCodeFiles:_e,deadExportsTotal:Fe,cycles:oe,languageStats:D,groups:[...Ee].sort()},nodes:$,links:E}}var b,C,P=[],j,k,B,se,te=!1;function Rt(i){se=new J;let n=u.window.createTreeView("auraVisualizer.statsView",{treeDataProvider:se,showCollapseAll:!0});i.subscriptions.push(n),k=u.window.createStatusBarItem(u.StatusBarAlignment.Left,50),k.command="auraVisualizer.open",k.text="$(eye) Aura",k.tooltip="Open Aura 3D Visualizer",k.show(),i.subscriptions.push(k),i.subscriptions.push(u.commands.registerCommand("auraVisualizer.open",()=>St(i)),u.commands.registerCommand("auraVisualizer.refresh",()=>ne(i)),u.commands.registerCommand("auraVisualizer.focusFile",()=>_t()),u.commands.registerCommand("auraVisualizer.openFileFromTree",s=>{let o=u.workspace.workspaceFolders?.[0];if(!o)return;let e=F.join(o.uri.fsPath,s);u.window.showTextDocument(u.Uri.file(e),{preview:!0})}),u.commands.registerCommand("auraVisualizer.exportGraph",()=>Ft())),Dt(i),i.subscriptions.push(u.window.onDidChangeActiveTextEditor(s=>{if(s&&b?.isVisible){let o=u.workspace.workspaceFolders?.[0];if(o){let e=F.relative(o.uri.fsPath,s.document.uri.fsPath);e.startsWith("..")||b.focusNode(e)}}})),i.subscriptions.push(u.window.onDidChangeActiveColorTheme(s=>{b?.sendTheme(s.kind)})),u.window.registerWebviewPanelSerializer(M.viewType,{async deserializeWebviewPanel(s){b||(b=new M(i.extensionUri),Re()),b.restore(s),C&&b.sendGraphData(C)}}),u.workspace.workspaceFolders?.length&&ne(i)}function Re(){b&&b.onOpenFile(async({path:i,line:n})=>{let s=u.workspace.workspaceFolders?.[0];if(!s)return;let o=F.join(s.uri.fsPath,i),e=u.Uri.file(o);try{let t=await u.workspace.openTextDocument(e),c=await u.window.showTextDocument(t,{preserveFocus:!1});if(n&&n>0){let p=new u.Position(n-1,0);c.selection=new u.Selection(p,p),c.revealRange(new u.Range(p,p),u.TextEditorRevealType.InCenter)}}catch{}})}async function St(i){b||(b=new M(i.extensionUri),Re()),b.show(),C?b.sendGraphData(C):await ne(i)}async function ne(i){if(te)return;te=!0;let n=u.workspace.workspaceFolders?.[0];if(!n){te=!1,u.window.showWarningMessage("Aura: No workspace folder open.");return}let s=n.uri.fsPath,e=u.workspace.getConfiguration("auraVisualizer").get("excludePaths",["node_modules",".git","dist","build","out","__pycache__"]);k&&(k.text="$(loading~spin) Aura: Analyzing...");try{let t=await u.window.withProgress({location:u.ProgressLocation.Window,title:"Aura: Analyzing codebase..."},()=>Ct(i.extensionUri,s,e,n.name));C=t.graphData,P=t.files,b&&b.sendGraphData(C),se?.update(C),Se()}catch(t){let c=t instanceof Error?t.message:String(t);u.window.showErrorMessage(`Aura: Analysis failed \u2014 ${c}`),k&&(k.text="$(eye) Aura")}finally{te=!1}}function Ct(i,n,s,o){return new Promise((e,t)=>{let c=F.join(i.fsPath,"out","analyzer-worker.js"),p=new xe.Worker(c,{workerData:{rootPath:n,skipDirs:s,projectName:o}});p.on("message",d=>{d.error?t(new Error(d.error)):e({graphData:d.graphData,files:d.files}),p.terminate()}),p.on("error",d=>{t(d),p.terminate()}),p.on("exit",d=>{d!==0&&t(new Error(`Worker exited with code ${d}`))})})}async function Et(i,n){let s=u.workspace.workspaceFolders?.[0];if(!s||P.length===0)return;let o=s.uri.fsPath,e=F.relative(o,i.fsPath);if(e.startsWith(".."))return;if(n)P=P.filter(p=>p.id!==e);else{let p=await ie(i.fsPath,o);if(!p)return;let d=P.findIndex(f=>f.id===e);d>=0?P[d]=p:P.push(p)}let t=C,c=s.name;if(C=re(P,c),b?.isVisible&&C)if(t){let p=kt(t,C,e,n);b.sendGraphDelta(p)}else b.sendGraphData(C);se?.update(C),Se()}function kt(i,n,s,o){let e={changedNodes:[],removedNodeIds:[],addedLinks:[],removedLinks:[],meta:n.meta};o&&e.removedNodeIds.push(s);let t=new Map(i.nodes.map(r=>[r.id,r])),c=new Map(n.nodes.map(r=>[r.id,r]));for(let r of n.nodes){let h=t.get(r.id);(!h||r.fanIn!==h.fanIn||r.fanOut!==h.fanOut||r.complexity!==h.complexity||r.linesOfCode!==h.linesOfCode||r.size!==h.size)&&e.changedNodes.push(r)}for(let r of i.nodes)c.has(r.id)||e.removedNodeIds.includes(r.id)||e.removedNodeIds.push(r.id);let p=r=>`${typeof r.source=="object"?r.source.id:r.source}|${typeof r.target=="object"?r.target.id:r.target}|${r.type}`,d=new Set(i.links.map(p)),f=new Set(n.links.map(p));for(let r of n.links)d.has(p(r))||e.addedLinks.push(r);for(let r of i.links)f.has(p(r))||e.removedLinks.push({source:typeof r.source=="object"?r.source.id:r.source,target:typeof r.target=="object"?r.target.id:r.target,type:r.type});return e}function Se(){if(!k||!C)return;let{totalFiles:i,totalLinks:n}=C.meta;k.text=`$(eye) Aura: ${i} files, ${n} links`,k.tooltip=`Aura \u2014 ${i} files, ${n} dependencies
Click to open 3D visualizer`}function _t(){let i=u.window.activeTextEditor;if(!i||!b?.isVisible)return;let n=u.workspace.workspaceFolders?.[0];if(!n)return;let s=F.relative(n.uri.fsPath,i.document.uri.fsPath);s.startsWith("..")||b.focusNode(s)}async function Ft(){let i=u.workspace.workspaceFolders?.[0];if(!i){u.window.showWarningMessage("Aura: No workspace folder open.");return}if(!C){u.window.showWarningMessage("Aura: No graph data. Run analysis first (Ctrl+Shift+A).");return}let n=F.join(i.uri.fsPath,".aura");await H.mkdir(n,{recursive:!0});let s=C,o={meta:s.meta,nodes:s.nodes.map(t=>({id:t.id,name:t.name,path:t.path,language:t.language,extension:t.extension,size:t.size,linesOfCode:t.linesOfCode,group:t.group,fanIn:t.fanIn,fanOut:t.fanOut,complexity:t.complexity})),links:s.links.map(t=>({source:t.source,target:t.target,type:t.type,label:t.label}))};await H.writeFile(F.join(n,"graph.json"),JSON.stringify(o,null,2),"utf-8");let e=It(s);await H.writeFile(F.join(n,"summary.md"),e,"utf-8"),u.window.showInformationMessage("Aura: Exported to .aura/ \u2014 graph.json + summary.md","Open summary").then(t=>{t==="Open summary"&&u.window.showTextDocument(u.Uri.file(F.join(n,"summary.md")),{preview:!0})})}function It(i){let{meta:n,nodes:s,links:o}=i,e=[];e.push(`# Aura Graph \u2014 ${n.projectName}`),e.push(`> Auto-generated by Aura Visualizer on ${n.analyzedAt}`),e.push("> This file describes the codebase architecture for AI-assisted development."),e.push(""),e.push("## Overview"),e.push(`- **${n.totalFiles}** files, **${n.totalLinks}** dependencies`);let t=Object.entries(n.languageStats).sort((l,w)=>w[1].count-l[1].count).map(([l,w])=>`${l} (${w.count} files, ${w.totalLOC} LOC)`);if(e.push(`- Languages: ${t.join(", ")}`),n.unresolvedReferences>0&&e.push(`- Unresolved references: ${n.unresolvedReferences}`),e.push(""),n.groups.length>0){e.push("## Directory Structure");for(let l of n.groups){let w=s.filter(A=>A.group===l),E=w.reduce((A,G)=>A+G.linesOfCode,0);e.push(`- \`${l}/\` \u2014 ${w.length} files, ${E} LOC`)}e.push("")}let c=[...s].sort((l,w)=>w.fanIn-l.fanIn).slice(0,15).filter(l=>l.fanIn>0);if(c.length>0){e.push("## Hotspots (most depended-on files)"),e.push("| File | Fan-in | Fan-out | Complexity | LOC |"),e.push("|------|--------|---------|------------|-----|");for(let l of c)e.push(`| \`${l.id}\` | ${l.fanIn} | ${l.fanOut} | ${l.complexity} | ${l.linesOfCode} |`);e.push("")}let p=[...s].sort((l,w)=>w.complexity-l.complexity).slice(0,10).filter(l=>l.complexity>1);if(p.length>0){e.push("## Most Complex Files"),e.push("| File | Complexity | LOC | Fan-in | Fan-out |"),e.push("|------|------------|-----|--------|---------|");for(let l of p)e.push(`| \`${l.id}\` | ${l.complexity} | ${l.linesOfCode} | ${l.fanIn} | ${l.fanOut} |`);e.push("")}let d=[...s].sort((l,w)=>w.linesOfCode-l.linesOfCode).slice(0,10);if(d.length>0){e.push("## Largest Files"),e.push("| File | LOC | Complexity | Language |"),e.push("|------|-----|------------|----------|");for(let l of d)e.push(`| \`${l.id}\` | ${l.linesOfCode} | ${l.complexity} | ${l.language} |`);e.push("")}let f=s.filter(l=>l.fanIn===0&&l.fanOut===0);if(f.length>0){e.push("## Orphan Files (no dependencies)");for(let l of f)e.push(`- \`${l.id}\` (${l.language}, ${l.linesOfCode} LOC)`);e.push("")}let r=[],h=new Set(o.map(l=>`${l.source}\u2192${l.target}`));for(let l of o){let w=`${l.target}\u2192${l.source}`;h.has(w)&&l.source<l.target&&r.push(`\`${l.source}\` \u2194 \`${l.target}\``)}if(r.length>0){e.push("## Circular Dependencies");for(let l of r)e.push(`- ${l}`);e.push("")}let g={};for(let l of o)g[l.type]=(g[l.type]||0)+1;if(Object.keys(g).length>0){e.push("## Dependency Types");for(let[l,w]of Object.entries(g).sort((E,A)=>A[1]-E[1]))e.push(`- **${l}**: ${w}`);e.push("")}return e.push("## Usage Notes for AI Agents"),e.push("- Files with high fan-in are **critical hubs** \u2014 changes impact many dependents."),e.push("- Check circular dependencies before refactoring \u2014 break cycles where possible."),e.push("- Orphan files may be dead code candidates for cleanup."),e.push("- Use `graph.json` for programmatic queries (e.g., find all dependents of a file)."),e.push("- High complexity files (>15) are prime candidates for decomposition."),e.push(""),e.join(`
`)}function Dt(i){if(!u.workspace.getConfiguration("auraVisualizer").get("autoRefresh",!0))return;j=u.workspace.createFileSystemWatcher("**/*.{c,h,js,ts,py,css,html}");let o=new Map,e=()=>{B&&clearTimeout(B),B=setTimeout(async()=>{let t=new Map(o);if(o.clear(),P.length===0){b?.isVisible?ne(i):C=void 0;return}for(let[,c]of t)await Et(c.uri,c.deleted)},500)};j.onDidChange(t=>{o.set(t.fsPath,{uri:t,deleted:!1}),e()}),j.onDidCreate(t=>{o.set(t.fsPath,{uri:t,deleted:!1}),e()}),j.onDidDelete(t=>{o.set(t.fsPath,{uri:t,deleted:!0}),e()}),i.subscriptions.push(j)}function At(){b?.dispose(),j?.dispose(),B&&clearTimeout(B)}0&&(module.exports={activate,deactivate});
