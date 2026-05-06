/**
 * app.js — Aura Visualizer (VSCode Webview Edition).
 * 
 * Adapted from Aura standalone: uses postMessage instead of fetch,
 * no landing overlay, supports VSCode integration (open file, focus node).
 */

(function () {
    'use strict';

    // VSCode API
    var vscode = acquireVsCodeApi();

    // ============================================================
    // State
    // ============================================================
    var graph = null;
    var graphData = null;
    var selectedNode = null;
    var hoveredNode = null;
    var highlightNodes = new Set();
    var highlightLinks = new Set();
    var activeLanguages = new Set(['c-source', 'c-header', 'javascript', 'typescript', 'python', 'css', 'html', 'java', 'go', 'rust']);
    var dagMode = false;
    var showOrphans = false;
    var showDeadCode = false;
    var showCycles = false;
    var cycleNodeIds = new Set();
    var cycleLinkKeys = new Set();
    var multiSelectedNodes = new Set();
    var multiSelectedLinks = new Set();
    var showLabels = false;
    var nodeSizeMultiplier = 4;
    var spreadMultiplier = 1;
    var focusDepth = 1;
    var heatmapMode = 'off';
    var showGroups = false;
    var expandedGroups = new Set();
    var groupMeshes = [];
    var metricRanges = {};

    // Path Mode
    var pathMode = false;
    var pathNodes = [];
    var highlightedPath = { nodes: new Set(), links: new Set() };

    // Pinned focus
    var pinnedNode = null;
    var pinnedNodes = new Set();
    var pinnedLinks = new Set();

    // Blast radius mode (Shift+RightClick)
    var blastMode = false;
    var blastDepths = {};  // nodeId → depth

    // Community detection
    var communityMap = {};  // nodeId → communityId
    var communityColors = {}; // communityId → color
    var communityNames = {}; // communityId → { name, files }
    var activeCommunities = new Set(); // communityIds currently visible

    // Directory filter (from Files panel checkboxes)
    var activeDirs = []; // empty = show all

    // Active tab
    var activeTab = 'graph';
    var graphPaused = false;

    // Explorer state
    var showExplorer = false;
    var fileTree = {};

    // Explosion state
    var explodedNode = null;
    var explosionData = null;

    // Hovered symbol in explosion (call edges shown only for this symbol)
    var hoveredSymbolId = null;

    // Flow trace mode (function call propagation)
    var flowTraceMode = false;
    var flowTraceNodes = new Set();  // file nodes in the trace
    var flowTraceDepths = {};        // nodeId → depth
    var flowTraceAnimDepth = -1;     // current animated depth (-1 = done)
    var flowTraceMaxDepth = 0;
    var flowTraceTimer = null;

    // Time Travel state
    var timelineCommits = [];       // all commits, newest first
    var timelineDeltas = {};        // hash → CommitDelta
    var timelinePosition = -1;     // -1 = HEAD (current), 0 = newest commit, N = older
    var timelineScannedCount = 0;
    var timelineTotalCount = 0;
    var headGraphData = null;       // snapshot of graph at HEAD for reset
    var timelineActive = false;     // true when navigating history
    var timelineChangedNodes = new Set(); // union of add/remove/modify (for impact mode compat)
    var timelineAddedNodes = new Set();   // files added at current commit (green)
    var timelineRemovedNodes = new Set(); // files removed at current commit (red)
    var timelineModifiedNodes = new Set(); // files modified at current commit (yellow)
    var timelineAddedLinks = new Set();   // link keys added at current commit
    var timelineRemovedLinks = new Set(); // link keys removed at current commit
    var impactMode = false; // true when showing impact cascade from timeline changed nodes
    var timelineCompareMode = false;  // dual-slider compare
    var timelineFromPos = 0;          // "from" slider position in compare mode
    var timelineSavedToPos = -1;      // saved "to" slider position when leaving compare mode
    var timelineSavedFromPos = -1;    // saved "from" slider position when leaving compare mode

    var lastPointerX = -1;
    var lastPointerY = -1;

    // ============================================================
    // DOM References
    // ============================================================
    var $ = function (sel) { return document.querySelector(sel); };

    var graphContainer = $('#graph-container');
    var loadingOverlay = $('#loading-overlay');
    var searchInput = $('#search-input');
    var searchResults = $('#search-results');
    var detailPanel = $('#detail-panel');
    var explorerPanel = $('#explorer-panel');
    var toggleExplorerBtn = $('#btn-toggle-explorer');
    var explorerTree = $('#explorer-tree');
    var tooltip = $('#tooltip');
    var timelineBar = $('#timeline-bar');
    var timelineSlider = $('#timeline-slider');
    var timelinePrevBtn = $('#timeline-prev');
    var timelineNextBtn = $('#timeline-next');
    var timelineImpactBtn = $('#timeline-impact');
    var timelineCompareBtn = $('#timeline-compare');
    var timelineFromSlider = $('#timeline-from-slider');
    var timelineFromPrevBtn = $('#timeline-from-prev');
    var timelineFromNextBtn = $('#timeline-from-next');
    var timelineFromControls = $('#timeline-from-controls');

    // ============================================================
    // VSCode Message Handling
    // ============================================================
    window.addEventListener('message', function (event) {
        var message = event.data;
        switch (message.type) {
            case 'graphData':
                handleGraphData(message.payload);
                break;
            case 'updateGraph':
                handleGraphDelta(message.payload);
                break;
            case 'focusNode':
                if (message.payload && message.payload.nodeId) {
                    focusNodeById(message.payload.nodeId);
                }
                break;
            case 'blastRadius':
                if (message.payload && message.payload.nodeId) {
                    var brNode = findNode(message.payload.nodeId);
                    if (brNode) {
                        handleBlastRadius(brNode, false);
                        if (graph) {
                            graph.cameraPosition(
                                { x: brNode.x, y: brNode.y, z: (brNode.z || 0) + 200 },
                                { x: brNode.x, y: brNode.y, z: brNode.z || 0 },
                                1000
                            );
                        }
                    }
                }
                break;
            case 'themeChanged':
                // Could adapt colors here if needed
                break;
            case 'progress':
                if (message.payload) {
                    var statusEl = $('#loading-status');
                    if (statusEl) statusEl.textContent = message.payload.message || 'Analyzing...';
                }
                break;
            case 'refreshComplete':
                if (loadingOverlay) {
                    loadingOverlay.style.display = 'none';
                }
                break;
            case 'historyIndex':
                handleHistoryIndex(message.payload);
                break;
            case 'historyProgress':
                handleHistoryProgress(message.payload);
                break;
            case 'historyDelta':
                handleHistoryDelta(message.payload);
                break;
            case 'restoreViewState':
                if (message.payload) applyViewState(message.payload);
                break;
            case 'visibilityChanged':
                if (message.payload) {
                    if (message.payload.visible) {
                        if (activeTab === 'graph') resumeGraph();
                    } else {
                        pauseGraph();
                    }
                }
                break;
        }
    });

    // Tell the extension we're ready
    vscode.postMessage({ type: 'ready' });

    // Pause/resume the active graph when the webview visibility changes
    // (e.g. when the user switches to another VS Code tab)
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            pauseGraph();
        } else {
            if (activeTab === 'graph') {
                resumeGraph();
            }
        }
    });

    // ============================================================
    // Initialization
    // ============================================================
    function init() {
        setupSearch();
        setupFilters();
        setupPanelClose();
        setupRefresh();
        setupExplorer();
        setupTimeline();
        setupTabs();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function handleGraphData(data) {
        // Reset interaction state before re-init (retainContextWhenHidden keeps
        // the JS closure, so stale state survives refresh)
        clearPinnedFocus();   // also clears flowTrace timer
        pathMode = false;
        pathNodes = [];
        highlightedPath.nodes.clear();
        highlightedPath.links.clear();
        selectedNode = null;
        explodedNode = null;
        explosionData = null;

        graphData = data;
        headGraphData = JSON.parse(JSON.stringify(data));
        computeCallCounts();
        computeMetricRanges();
        computeCommunities();
        updateStats(graphData.meta);
        updateLanguageButtons(graphData.nodes);
        try {
            initGraph(graphData);
        } catch (e) {
            console.error('[aura] initGraph error:', e);
        }
        // Hide overlay after the graph has rendered its first frame
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (loadingOverlay) {
                    loadingOverlay.style.display = 'none';
                }
            });
        });
        buildExplorerTree(graphData.nodes);
        // Request saved view state from extension (pull model — guarantees graph is ready)
        vscode.postMessage({ type: 'requestViewState' });
    }

    function handleGraphDelta(delta) {
        if (!graphData || !graph) {
            // No graph yet — can't apply delta, need full data
            return;
        }

        var removedSet = new Set(delta.removedNodeIds || []);
        var changedMap = {};
        var changedNodes = delta.changedNodes || [];
        for (var i = 0; i < changedNodes.length; i++) {
            changedMap[changedNodes[i].id] = changedNodes[i];
        }

        // Update graphData.nodes: remove deleted, update changed, add new
        var existingIds = new Set();
        var newNodes = [];
        for (var j = 0; j < graphData.nodes.length; j++) {
            var node = graphData.nodes[j];
            if (removedSet.has(node.id)) continue; // skip removed
            if (changedMap[node.id]) {
                // Update properties in-place to preserve 3d-force-graph position (x,y,z,vx,vy,vz)
                var updated = changedMap[node.id];
                node.name = updated.name;
                node.size = updated.size;
                node.linesOfCode = updated.linesOfCode;
                node.complexity = updated.complexity;
                node.fanIn = updated.fanIn;
                node.fanOut = updated.fanOut;
                node.lastModified = updated.lastModified;
                if (updated.symbols) node.symbols = updated.symbols;
                if (updated.complexityDetails) node.complexityDetails = updated.complexityDetails;
            }
            existingIds.add(node.id);
            newNodes.push(node);
        }
        // Add truly new nodes (files that didn't exist before)
        for (var k = 0; k < changedNodes.length; k++) {
            if (!existingIds.has(changedNodes[k].id)) {
                newNodes.push(changedNodes[k]);
            }
        }
        graphData.nodes = newNodes;

        // Update graphData.links: remove old, add new
        var removedLinks = delta.removedLinks || [];
        var removedLinkSet = new Set();
        for (var rl = 0; rl < removedLinks.length; rl++) {
            removedLinkSet.add(removedLinks[rl].source + '|' + removedLinks[rl].target + '|' + removedLinks[rl].type);
        }

        var keptLinks = [];
        for (var li = 0; li < graphData.links.length; li++) {
            var link = graphData.links[li];
            var src = typeof link.source === 'object' ? link.source.id : link.source;
            var tgt = typeof link.target === 'object' ? link.target.id : link.target;
            var key = src + '|' + tgt + '|' + link.type;
            if (!removedLinkSet.has(key) && !removedSet.has(src) && !removedSet.has(tgt)) {
                keptLinks.push(link);
            }
        }
        var addedLinks = delta.addedLinks || [];
        for (var al = 0; al < addedLinks.length; al++) {
            keptLinks.push(addedLinks[al]);
        }
        graphData.links = keptLinks;

        // Update meta
        if (delta.meta) graphData.meta = delta.meta;

        // Recompute ranges and stats
        computeCallCounts();
        computeMetricRanges();
        updateStats(graphData.meta);

        // Re-feed filtered data to the graph — preserves positions
        graph.graphData(filterGraphData(graphData));

        // Update language buttons
        updateLanguageButtons(graphData.nodes);

        // Update explorer
        buildExplorerTree(graphData.nodes);

        // Clear label cache for changed nodes
        for (var ci = 0; ci < changedNodes.length; ci++) {
            delete labelSpriteCache[changedNodes[ci].name];
        }

        // Hide loading overlay (refresh complete)
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }

    function setupRefresh() {
        var btn = $('#btn-refresh');
        if (btn) {
            btn.addEventListener('click', function () {
                vscode.postMessage({ type: 'requestRefresh' });
                // Switch back to 3D Graph so the user sees the refresh
                if (activeTab !== 'graph') switchTab('graph');
                if (loadingOverlay) {
                    loadingOverlay.style.display = 'flex';
                }
                var statusEl = $('#loading-status');
                if (statusEl) statusEl.textContent = 'Refreshing analysis...';
            });
        }
        var exportBtn = $('#btn-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', function () {
                vscode.postMessage({ type: 'requestExport' });
            });
        }

        // Help modal
        var helpBtn = $('#btn-help');
        var helpModal = $('#help-modal');
        var helpClose = $('#help-modal-close');
        if (helpBtn && helpModal) {
            helpBtn.addEventListener('click', function () {
                helpModal.classList.toggle('hidden');
            });
            if (helpClose) {
                helpClose.addEventListener('click', function () {
                    helpModal.classList.add('hidden');
                });
            }
            helpModal.addEventListener('click', function (e) {
                if (e.target === helpModal) helpModal.classList.add('hidden');
            });
        }

        // Minimap toggle
        var minimapBtn = $('#btn-minimap');
        var minimapEl = $('#minimap');
        var minimapClose = $('#minimap-close');
        if (minimapBtn && minimapEl) {
            minimapBtn.addEventListener('click', function () {
                minimapEl.classList.toggle('hidden');
                minimapBtn.classList.toggle('active', !minimapEl.classList.contains('hidden'));
                saveViewState();
            });
            if (minimapClose) {
                minimapClose.addEventListener('click', function () {
                    minimapEl.classList.add('hidden');
                    minimapBtn.classList.remove('active');
                    saveViewState();
                });
            }
        }
    }

    function updateStats(meta) {
        $('#stat-files').textContent = meta.totalFiles + ' files';
        $('#stat-links').textContent = meta.totalLinks + ' links';

        var parts = [];
        var entries = Object.entries(meta.languageStats);
        for (var i = 0; i < entries.length; i++) {
            parts.push(entries[i][1].count + ' ' + entries[i][0]);
        }
        $('#stat-time').textContent = parts.join(', ');
    }

    // ============================================================
    // Metric Ranges
    // ============================================================
    function computeMetricRanges() {
        if (!graphData) return;
        var nodes = graphData.nodes;

        metricRanges = {
            complexity: { min: Infinity, max: -Infinity },
            fanIn: { min: Infinity, max: -Infinity },
            fanOut: { min: Infinity, max: -Infinity },
            callVolume: { min: Infinity, max: -Infinity },
            loc: { min: Infinity, max: -Infinity },
            lastModified: { min: Infinity, max: -Infinity }
        };

        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            metricRanges.complexity.min = Math.min(metricRanges.complexity.min, n.complexity || 1);
            metricRanges.complexity.max = Math.max(metricRanges.complexity.max, n.complexity || 1);
            metricRanges.fanIn.min = Math.min(metricRanges.fanIn.min, n.fanIn);
            metricRanges.fanIn.max = Math.max(metricRanges.fanIn.max, n.fanIn);
            metricRanges.fanOut.min = Math.min(metricRanges.fanOut.min, n.fanOut);
            metricRanges.fanOut.max = Math.max(metricRanges.fanOut.max, n.fanOut);
            var cv = (n.callsIn || 0) + (n.callsOut || 0);
            metricRanges.callVolume.min = Math.min(metricRanges.callVolume.min, cv);
            metricRanges.callVolume.max = Math.max(metricRanges.callVolume.max, cv);
            metricRanges.loc.min = Math.min(metricRanges.loc.min, n.linesOfCode);
            metricRanges.loc.max = Math.max(metricRanges.loc.max, n.linesOfCode);
            var mtime = n.lastModified || 0;
            metricRanges.lastModified.min = Math.min(metricRanges.lastModified.min, mtime);
            metricRanges.lastModified.max = Math.max(metricRanges.lastModified.max, mtime);
        }
    }

    /**
     * Aggregate per-(callerFile, calleeFile) call counts from graphData.functionCalls
     * and annotate function-call links with `callCount` + `callPairs` (sample list of
     * "caller→callee" pairs for tooltips). Also computes per-node `callsIn`/`callsOut`
     * totals used by the "Call volume" heatmap.
     */
    function computeCallCounts() {
        if (!graphData) return;
        var calls = graphData.functionCalls || [];
        // Map<callerFile, Map<calleeFile, { count, pairs: Map<"caller→callee", count> }>>
        var byPair = {};
        for (var i = 0; i < calls.length; i++) {
            var c = calls[i];
            if (!byPair[c.callerFile]) byPair[c.callerFile] = {};
            var inner = byPair[c.callerFile];
            if (!inner[c.calleeFile]) inner[c.calleeFile] = { count: 0, pairs: {} };
            var slot = inner[c.calleeFile];
            slot.count++;
            var key = c.callerName + ' → ' + c.calleeName;
            slot.pairs[key] = (slot.pairs[key] || 0) + 1;
        }
        // Reset per-node totals
        for (var ni = 0; ni < graphData.nodes.length; ni++) {
            graphData.nodes[ni].callsIn = 0;
            graphData.nodes[ni].callsOut = 0;
        }
        var nodeById = {};
        for (var nj = 0; nj < graphData.nodes.length; nj++) nodeById[graphData.nodes[nj].id] = graphData.nodes[nj];
        for (var caller in byPair) {
            var srcN = nodeById[caller];
            for (var callee in byPair[caller]) {
                var s = byPair[caller][callee];
                if (srcN) srcN.callsOut += s.count;
                var tgtN = nodeById[callee];
                if (tgtN) tgtN.callsIn += s.count;
            }
        }
        // Annotate function-call links
        var links = graphData.links || [];
        for (var li = 0; li < links.length; li++) {
            var l = links[li];
            if (l.type !== 'function-call') continue;
            var sId = typeof l.source === 'object' ? l.source.id : l.source;
            var tId = typeof l.target === 'object' ? l.target.id : l.target;
            var bucket = byPair[sId] && byPair[sId][tId];
            if (bucket) {
                l.callCount = bucket.count;
                // Top 5 pair labels for tooltip
                var pairList = [];
                for (var k in bucket.pairs) pairList.push({ k: k, n: bucket.pairs[k] });
                pairList.sort(function (a, b) { return b.n - a.n; });
                l.callPairs = pairList.slice(0, 5);
            } else {
                l.callCount = 1;
                l.callPairs = [];
            }
        }
    }

    function normalizeMetric(value, metric) {
        var range = metricRanges[metric];
        if (!range || range.max === range.min) return 0;
        return (value - range.min) / (range.max - range.min);
    }

    // ============================================================
    // Community Detection (Louvain)
    // ============================================================
    function computeCommunities() {
        communityMap = {};
        communityColors = {};
        if (!graphData) return;

        var nodes = graphData.nodes;
        var links = graphData.links;
        var n = nodes.length;
        if (n === 0) return;

        // Build index
        var idx = {};
        for (var i = 0; i < n; i++) idx[nodes[i].id] = i;

        // Adjacency with weights (undirected)
        var adj = [];
        for (var a = 0; a < n; a++) adj[a] = {};
        var totalWeight = 0;

        for (var li = 0; li < links.length; li++) {
            var lk = links[li];
            var si = idx[typeof lk.source === 'object' ? lk.source.id : lk.source];
            var ti = idx[typeof lk.target === 'object' ? lk.target.id : lk.target];
            if (si === undefined || ti === undefined || si === ti) continue;
            adj[si][ti] = (adj[si][ti] || 0) + 1;
            adj[ti][si] = (adj[ti][si] || 0) + 1;
            totalWeight += 1;
        }

        if (totalWeight === 0) {
            for (var z = 0; z < n; z++) {
                communityMap[nodes[z].id] = z;
                communityColors[z] = GROUP_COLORS[z % GROUP_COLORS.length];
            }
            return;
        }

        var m2 = totalWeight * 2;
        // Node degrees
        var deg = [];
        for (var di = 0; di < n; di++) {
            var d = 0;
            for (var k in adj[di]) d += adj[di][k];
            deg[di] = d;
        }

        // Each node starts in its own community
        var comm = [];
        for (var ci = 0; ci < n; ci++) comm[ci] = ci;

        // Louvain phase 1: local moves
        var improved = true;
        var iter = 0;
        while (improved && iter < 20) {
            improved = false;
            iter++;
            for (var ni = 0; ni < n; ni++) {
                var curComm = comm[ni];
                // Weights to neighboring communities
                var cw = {};
                for (var nb in adj[ni]) {
                    var cn = comm[nb];
                    cw[cn] = (cw[cn] || 0) + adj[ni][nb];
                }
                // Degree sum per neighboring community (excluding ni)
                var cd = {};
                for (var nj = 0; nj < n; nj++) {
                    if (nj === ni) continue;
                    var cj = comm[nj];
                    if (cw[cj] !== undefined || cj === curComm) {
                        cd[cj] = (cd[cj] || 0) + deg[nj];
                    }
                }

                var ki = deg[ni];
                var wIn = cw[curComm] || 0;
                var sumCi = cd[curComm] || 0;
                var removeCost = wIn / totalWeight - (ki * sumCi) / (m2 * m2) * 2;

                var bestGain = 0;
                var bestComm = curComm;
                for (var cc in cw) {
                    var ccNum = parseInt(cc);
                    if (ccNum === curComm) continue;
                    var sumCj = cd[ccNum] || 0;
                    var gain = cw[ccNum] / totalWeight - (ki * sumCj) / (m2 * m2) * 2 - removeCost;
                    if (gain > bestGain) {
                        bestGain = gain;
                        bestComm = ccNum;
                    }
                }

                if (bestComm !== curComm) {
                    comm[ni] = bestComm;
                    improved = true;
                }
            }
        }

        // Renumber communities 0..k-1
        var remap = {};
        var nextId = 0;
        for (var ri = 0; ri < n; ri++) {
            var c = comm[ri];
            if (remap[c] === undefined) remap[c] = nextId++;
            communityMap[nodes[ri].id] = remap[c];
        }

        // Group files by community
        var commFiles = {};
        for (var gi = 0; gi < n; gi++) {
            var cid = communityMap[nodes[gi].id];
            if (!commFiles[cid]) commFiles[cid] = [];
            commFiles[cid].push(nodes[gi]);
        }

        // Separate singleton communities (< 2 members) into "Others"
        var singletonFiles = [];
        for (var sc in commFiles) {
            if (commFiles[sc].length < 2) {
                for (var si2 = 0; si2 < commFiles[sc].length; si2++) {
                    singletonFiles.push(commFiles[sc][si2]);
                }
                delete commFiles[sc];
            }
        }

        // Renumber remaining communities 0..k-1
        var finalRemap = {};
        var finalId = 0;
        var sortedKeys = Object.keys(commFiles).map(Number).sort(function (a, b) { return a - b; });
        for (var sk = 0; sk < sortedKeys.length; sk++) {
            finalRemap[sortedKeys[sk]] = finalId++;
        }
        var newCommFiles = {};
        for (var oldK in commFiles) {
            var newK = finalRemap[oldK];
            newCommFiles[newK] = commFiles[oldK];
            for (var fi2 = 0; fi2 < commFiles[oldK].length; fi2++) {
                communityMap[commFiles[oldK][fi2].id] = newK;
            }
        }

        // Add "Others" community for singletons
        if (singletonFiles.length > 0) {
            var othersId = finalId++;
            newCommFiles[othersId] = singletonFiles;
            for (var oi = 0; oi < singletonFiles.length; oi++) {
                communityMap[singletonFiles[oi].id] = othersId;
            }
        }

        // Name each community
        activeCommunities.clear();
        for (var ci2 = 0; ci2 < finalId; ci2++) {
            communityColors[ci2] = GROUP_COLORS[ci2 % GROUP_COLORS.length];
            activeCommunities.add(ci2);
            var files = newCommFiles[ci2] || [];
            var isOthers = (singletonFiles.length > 0 && ci2 === finalId - 1);
            communityNames[ci2] = { name: isOthers ? 'Others' : nameCommunity(files), files: files.map(function (f) { return f.id; }) };
        }
    }

    function nameCommunity(files) {
        if (files.length === 0) return '?';
        // Hub file: highest fan-in in the community
        var hub = files[0];
        for (var h = 1; h < files.length; h++) {
            if ((files[h].fanIn || 0) > (hub.fanIn || 0)) hub = files[h];
        }
        return hub.name.replace(/\.[^.]+$/, '');
    }

    function buildCommunityList() {
        var list = $('#community-list');
        if (!list) return;
        list.innerHTML = '';

        // Sort communities by file count descending
        var ids = Object.keys(communityNames).map(Number);
        ids.sort(function (a, b) {
            return (communityNames[b].files.length) - (communityNames[a].files.length);
        });

        for (var i = 0; i < ids.length; i++) {
            (function (cid) {
                var info = communityNames[cid];
                var item = document.createElement('div');
                item.className = 'community-item' + (activeCommunities.has(cid) ? '' : ' dimmed');
                item.innerHTML =
                    '<span class="community-swatch" style="background:' + (communityColors[cid] || '#888') + '"></span>' +
                    '<span class="community-name">' + escapeHtml(info.name) + '</span>' +
                    '<span class="community-count">' + info.files.length + '</span>';
                item.addEventListener('click', function () {
                    if (activeCommunities.has(cid)) activeCommunities.delete(cid);
                    else activeCommunities.add(cid);
                    item.classList.toggle('dimmed', !activeCommunities.has(cid));
                    if (graph) { graph.nodeColor(graph.nodeColor()); graph.linkColor(graph.linkColor()); graph.nodeThreeObject(graph.nodeThreeObject()); }
                });
                list.appendChild(item);
            })(ids[i]);
        }
    }

    function showCommunityPalette() {
        var el = $('#community-palette');
        if (el) {
            buildCommunityList();
            el.classList.remove('hidden');
        }
    }

    function hideCommunityPalette() {
        var el = $('#community-palette');
        if (el) el.classList.add('hidden');
    }

    // ============================================================
    // 3D Graph
    // ============================================================
    function initGraph(data) {
        if (typeof ForceGraph3D === 'undefined') {
            console.error('[aura] ForceGraph3D not loaded!');
            return;
        }

        var filtered = filterGraphData(data);

        // Destroy previous graph if any
        if (graph) {
            graph._destructor && graph._destructor();
        }

        graph = ForceGraph3D()(graphContainer)
            .graphData(filtered)
            .nodeId('id')
            .nodeLabel('')
            .nodeColor(function (node) { return getNodeColor(node); })
            .nodeRelSize(1)
            .nodeVal(function (node) { return getNodeSize(node); })
            .nodeOpacity(0.92)
            .nodeThreeObjectExtend(true)
            .nodeThreeObject(function (node) {
                var T = window.THREE;
                var isSelected = (selectedNode && selectedNode.id === node.id) || multiSelectedNodes.has(node);
                var isBlastSource = blastMode && pinnedNode && (node.id === pinnedNode.id || (impactMode && blastDepths[node.id] === 0));
                var hasLabel = showLabels &&
                    !(showOrphans && (node.fanIn > 0 || node.fanOut > 0)) &&
                    !(showDeadCode && !(node.deadExports && node.deadExports.length > 0)) &&
                    !(showCycles && !cycleNodeIds.has(node.id)) &&
                    !(pinnedNode && !pinnedNodes.has(node)) &&
                    !(heatmapMode === 'community' && activeCommunities.size < Object.keys(communityNames).length &&
                        (communityMap[node.id] === undefined || !activeCommunities.has(communityMap[node.id]))) &&
                    !(flowTraceMode && !flowTraceNodes.has(node.id)) &&
                    !(timelineActive && timelineCompareMode && timelineChangedNodes.size > 0 && !timelineChangedNodes.has(node.id));

                // In flow trace mode, force labels on trace nodes even if showLabels is off
                if (flowTraceMode && flowTraceNodes.has(node.id) && flowTraceDepths[node.id] <= flowTraceAnimDepth) {
                    hasLabel = true;
                }

                // Cluster meta-nodes always get a label
                if (node._isCluster) {
                    var cGroup = new T.Group();
                    var cRadius = Math.cbrt(getNodeSize(node) || 1) * 1.5;

                    // Translucent shell
                    var shellGeo = new T.SphereGeometry(cRadius, 24, 24);
                    var shellMat = new T.MeshBasicMaterial({
                        color: node._clusterColor || '#78909c',
                        transparent: true,
                        opacity: 0.3,
                        depthWrite: false
                    });
                    cGroup.add(new T.Mesh(shellGeo, shellMat));

                    // Wireframe outline
                    var wireGeo = new T.SphereGeometry(cRadius * 1.02, 16, 16);
                    var wireMat = new T.MeshBasicMaterial({
                        color: node._clusterColor || '#78909c',
                        wireframe: true,
                        transparent: true,
                        opacity: 0.5
                    });
                    cGroup.add(new T.Mesh(wireGeo, wireMat));

                    // Cluster label
                    var clusterLabel = getClusterLabelSprite(node.name, node._clusterCount, node._clusterColor);
                    if (clusterLabel) {
                        clusterLabel.position.y = cRadius + 4;
                        cGroup.add(clusterLabel);
                    }

                    return cGroup;
                }

                if (!isSelected && !hasLabel && !isBlastSource) return null;

                var group = new T.Group();

                // Glow effect for blast radius / trace calls source node
                if (isBlastSource && !isSelected) {
                    var blastRadius = Math.cbrt(getNodeSize(node) || 1) * 1;
                    var blastGlowGeo = new T.SphereGeometry(blastRadius * 3.5, 16, 16);
                    var blastGlowMat = new T.MeshBasicMaterial({
                        color: 0xff6b35,
                        transparent: true,
                        opacity: 0.3,
                        blending: T.AdditiveBlending,
                        depthWrite: false
                    });
                    group.add(new T.Mesh(blastGlowGeo, blastGlowMat));
                }

                // Glow effect for selected node
                if (isSelected) {
                    var nodeRadius = Math.cbrt(getNodeSize(node) || 1) * 1;
                    var glowGeo = new T.SphereGeometry(nodeRadius * 3, 16, 16);
                    var glowMat = new T.MeshBasicMaterial({
                        color: 0x60a5fa,
                        transparent: true,
                        opacity: 0.25,
                        blending: T.AdditiveBlending,
                        depthWrite: false
                    });
                    var glow = new T.Mesh(glowGeo, glowMat);
                    group.add(glow);

                    // Inner brighter core
                    var coreGeo = new T.SphereGeometry(nodeRadius * 1.8, 16, 16);
                    var coreMat = new T.MeshBasicMaterial({
                        color: 0x93c5fd,
                        transparent: true,
                        opacity: 0.4,
                        blending: T.AdditiveBlending,
                        depthWrite: false
                    });
                    var core = new T.Mesh(coreGeo, coreMat);
                    group.add(core);
                }

                // Label sprite
                if (hasLabel) {
                    var sprite = getLabelSprite(node.name);
                    if (sprite) {
                        sprite.position.y = Math.sqrt(getNodeSize(node) || 1) * 2 + 2;
                        group.add(sprite);
                    }
                }

                return group;
            })
            .linkSource('source')
            .linkTarget('target')
            .linkVisibility(function (link) { return getLinkVisibility(link); })
            .linkColor(function (link) { return getLinkColor(link); })
            .linkWidth(function (link) {
                if (link._isCallEdge) {
                    if (!hoveredSymbolId) return 0;
                    var cwSrc = typeof link.source === 'object' ? link.source.id : link.source;
                    var cwTgt = typeof link.target === 'object' ? link.target.id : link.target;
                    return (cwSrc === hoveredSymbolId || cwTgt === hoveredSymbolId) ? 2 : 0;
                }
                // Timeline diff: thicker lines for added/removed links, hide edges in compare mode
                if (timelineActive && timelineChangedNodes.size > 0) {
                    var lwSrc = typeof link.source === 'object' ? link.source.id : link.source;
                    var lwTgt = typeof link.target === 'object' ? link.target.id : link.target;
                    var lwKey = lwSrc + '>' + lwTgt;
                    if (!timelineCompareMode && (timelineAddedLinks.has(lwKey) || timelineRemovedLinks.has(lwKey))) return 2.5;
                    if (timelineCompareMode && !(timelineChangedNodes.has(lwSrc) && timelineChangedNodes.has(lwTgt))) return 0;
                }
                if (pathMode && highlightedPath.links.has(link)) return 3;
                if (multiSelectedLinks.has(link)) return 2.5;
                if (link.type === 'extends') return highlightLinks.has(link) ? 2.5 : 1;
                if (link.type === 'implements') return highlightLinks.has(link) ? 2 : 0.8;
                if (link.type === 'function-call' && link.callCount > 1) {
                    // Logarithmic scaling: 1 call = 0.5, 10 = ~1.5, 100 = ~2.5, 1000 = ~3.5
                    var w = 0.5 + Math.log(link.callCount) * 0.5;
                    if (highlightLinks.has(link)) w += 1;
                    return Math.min(w, 4);
                }
                return highlightLinks.has(link) ? 2 : 0.5;
            })
            .linkOpacity(0.4)
            .linkLabel(function (link) {
                if (link._isCallEdge || link._isExplosionLink) return '';
                if (link.type === 'function-call' && link.callCount) {
                    var lines = ['<b>' + link.callCount + ' call' + (link.callCount > 1 ? 's' : '') + '</b>'];
                    if (link.callPairs && link.callPairs.length) {
                        for (var p = 0; p < link.callPairs.length; p++) {
                            var pp = link.callPairs[p];
                            lines.push('  ' + pp.k + (pp.n > 1 ? ' (×' + pp.n + ')' : ''));
                        }
                    }
                    return '<div style="font-family:monospace;font-size:11px;line-height:1.5;background:rgba(13,17,23,0.95);padding:6px 8px;border-radius:4px;border:1px solid #30363d;color:#c9d1d9;">' + lines.join('<br>') + '</div>';
                }
                return link.label || link.type || '';
            })
            .linkDirectionalArrowLength(function (link) {
                // In compare mode, hide arrows unless both endpoints are changed
                if (timelineActive && timelineCompareMode && timelineChangedNodes.size > 0) {
                    var aaSrc = typeof link.source === 'object' ? link.source.id : link.source;
                    var aaTgt = typeof link.target === 'object' ? link.target.id : link.target;
                    if (!(timelineChangedNodes.has(aaSrc) && timelineChangedNodes.has(aaTgt))) return 0;
                }
                if (link.type === 'extends' || link.type === 'implements') return 5;
                return 3;
            })
            .linkDirectionalArrowRelPos(1)
            .linkDirectionalParticles(function (link) {
                if (link._isCallEdge) {
                    if (!hoveredSymbolId) return 0;
                    var cpSrc = typeof link.source === 'object' ? link.source.id : link.source;
                    var cpTgt = typeof link.target === 'object' ? link.target.id : link.target;
                    return (cpSrc === hoveredSymbolId || cpTgt === hoveredSymbolId) ? 3 : 0;
                }
                // Animate added/removed links in timeline diff (single-commit mode only)
                if (timelineActive && !timelineCompareMode && (timelineAddedLinks.size > 0 || timelineRemovedLinks.size > 0)) {
                    var dpSrc = typeof link.source === 'object' ? link.source.id : link.source;
                    var dpTgt = typeof link.target === 'object' ? link.target.id : link.target;
                    var dpKey = dpSrc + '>' + dpTgt;
                    if (timelineAddedLinks.has(dpKey) || timelineRemovedLinks.has(dpKey)) return 4;
                }
                if (pathMode && highlightedPath.links.has(link)) return 4;
                if (multiSelectedLinks.has(link)) return 3;
                if (link.type === 'extends') return 2;
                if (link.type === 'implements') return 3;
                return highlightLinks.has(link) ? 3 : 0;
            })
            .linkDirectionalParticleWidth(function (link) {
                if (link.type === 'implements') return 1.2;
                return 2;
            })
            .linkDirectionalParticleSpeed(function (link) {
                if (link.type === 'implements') return 0.008;
                return 0.005;
            })
            .backgroundColor('#0d1117')
            .showNavInfo(false)
            .onNodeHover(handleNodeHover)
            .onNodeClick(handleNodeClick)
            .onNodeRightClick(handleNodeRightClick)
            .onBackgroundClick(handleBackgroundClick)
            .onBackgroundRightClick(handleBackgroundRightClick)
            .warmupTicks(100)
            .cooldownTicks(200)
            .d3AlphaDecay(0.03)
            .d3VelocityDecay(0.5);

        // Apply spread forces
        applySpreadForces();

        // Double-click to open file (not natively supported, use DOM event)
        // Remove previous listener to prevent duplication on re-init
        graphContainer.removeEventListener('dblclick', graphContainerDblClick);
        graphContainer.addEventListener('dblclick', graphContainerDblClick);

        graphContainer.addEventListener('contextmenu', function (e) {
            e.preventDefault();
        });

        setTimeout(function () {
            graph.zoomToFit(500, 50);
        }, 1500);

        // Handle webview resize (e.g. when side editor opens/closes)
        var resizeObserver = new ResizeObserver(function () {
            if (graph) {
                graph.width(graphContainer.clientWidth);
                graph.height(graphContainer.clientHeight);
            }
        });
        resizeObserver.observe(graphContainer);
    }

    // ============================================================
    // Node Visuals
    // ============================================================
    function getNodeColor(node) {
        if (showOrphans) {
            if (node.fanIn === 0 && node.fanOut === 0) return '#ff1744';
            return '#ffffff0a';
        }

        if (showDeadCode) {
            if (node.deadExports && node.deadExports.length > 0) {
                // Gradient: few dead = orange, many = red
                var ratio = Math.min(node.deadExports.length / 5, 1);
                var r = 255;
                var g = Math.round(165 * (1 - ratio));
                return 'rgb(' + r + ',' + g + ',0)';
            }
            return '#ffffff0a';
        }

        if (showCycles) {
            if (cycleNodeIds.has(node.id)) return '#ff9800';
            return '#ffffff0a';
        }

        if (timelineActive && timelineChangedNodes.size > 0) {
            if (timelineAddedNodes.has(node.id)) return '#00ff88';   // neon green = added
            if (timelineRemovedNodes.has(node.id)) return '#ff2080'; // neon pink = removed
            if (timelineModifiedNodes.has(node.id)) return '#ffff00'; // neon yellow = modified
            if (timelineCompareMode) return '#ffffff0a'; // dim unchanged nodes in compare mode only
        }

        if (pathMode) {
            if (highlightedPath.nodes.size > 0) {
                if (highlightedPath.nodes.has(node)) {
                    if (pathNodes[0] && node.id === pathNodes[0].id) return '#4caf50';
                    if (pathNodes[1] && node.id === pathNodes[1].id) return '#f44336';
                    return LANGUAGE_COLORS[node.language] || '#ffffff';
                }
                return '#ffffff11';
            }
            if (pathNodes.length === 1 && pathNodes[0].id === node.id) return '#4caf50';
            return (LANGUAGE_COLORS[node.language] || '#ffffff') + '44';
        }

        // Flow trace mode — animated call propagation
        if (flowTraceMode) {
            if (!flowTraceNodes.has(node.id)) return '#ffffff08';
            var fd = flowTraceDepths[node.id];
            if (fd === undefined || fd > flowTraceAnimDepth) return '#ffffff08';
            return FLOW_COLORS[Math.min(fd, FLOW_COLORS.length - 1)];
        }

        if (node._isSymbol) return node._symbolColor || '#81c784';
        if (node._isCluster) return node._clusterColor || '#78909c';

        if (multiSelectedNodes.size > 0) {
            if (multiSelectedNodes.has(node)) return '#93c5fd';
            return '#ffffff11';
        }

        if (selectedNode && selectedNode.id === node.id) return '#93c5fd';

        if (heatmapMode !== 'off') {
            if (heatmapMode === 'community') {
                var cid = communityMap[node.id];
                var cColor = (cid !== undefined) ? (communityColors[cid] || '#ffffff') : '#ffffff';
                var isActive = (cid !== undefined) && activeCommunities.has(cid);
                var allActive = activeCommunities.size === Object.keys(communityNames).length;
                if (!isActive) return '#ffffff08';
                if (pinnedNode && blastMode) {
                    if (!pinnedNodes.has(node)) return cColor + '15';
                    var bdc = blastDepths[node.id];
                    return BLAST_COLORS[Math.min(bdc || 0, BLAST_COLORS.length - 1)];
                }
                if (pinnedNode) return pinnedNodes.has(node) ? cColor : cColor + '15';
                if (!allActive && highlightNodes.size > 0 && !highlightNodes.has(node)) return cColor + '44';
                return cColor;
            }
            var value;
            switch (heatmapMode) {
                case 'complexity': value = node.complexity || 1; break;
                case 'fanIn': value = node.fanIn; break;
                case 'fanOut': value = node.fanOut; break;
                case 'callVolume': value = (node.callsIn || 0) + (node.callsOut || 0); break;
                case 'loc': value = node.linesOfCode; break;
                case 'lastModified': value = node.lastModified || 0; break;
                default: value = 0;
            }
            var norm = normalizeMetric(value, heatmapMode);
            var color = heatmapColor(norm, HEATMAP_SCALES[heatmapMode]);
            if (pinnedNode && blastMode) {
                if (!pinnedNodes.has(node)) return color + '15';
                var bd = blastDepths[node.id];
                return BLAST_COLORS[Math.min(bd || 0, BLAST_COLORS.length - 1)];
            }
            if (pinnedNode) return pinnedNodes.has(node) ? color : color + '15';
            if (highlightNodes.size > 0 && !highlightNodes.has(node)) return color + '44';
            return color;
        }

        var langKeyFinal = node.language === 'c' ? (node.extension === '.h' ? 'c-header' : 'c-source') : node.language;
        var baseColor = LANGUAGE_COLORS[langKeyFinal] || '#ffffff';

        if (pinnedNode && blastMode) {
            if (!pinnedNodes.has(node)) return baseColor + '15';
            var bd2 = blastDepths[node.id];
            return BLAST_COLORS[Math.min(bd2 || 0, BLAST_COLORS.length - 1)];
        }
        if (pinnedNode) return pinnedNodes.has(node) ? baseColor : baseColor + '15';
        if (highlightNodes.size > 0 && !highlightNodes.has(node)) return baseColor + '44';
        return baseColor;
    }

    function getNodeSize(node) {
        if (node._isSymbol) return nodeSizeMultiplier * 0.5;
        if (node._isCluster) return Math.pow(node._clusterCount, 0.6) * nodeSizeMultiplier * 2;
        var baseLOC = Math.max(node.linesOfCode || 1, 1);
        var size = Math.pow(baseLOC, 0.4) * nodeSizeMultiplier * 0.3;
        if (showOrphans && node.fanIn === 0 && node.fanOut === 0) return size * 1.5;
        if (showDeadCode && node.deadExports && node.deadExports.length > 0) return size * 1.5;
        if (showCycles && cycleNodeIds.has(node.id)) return size * 1.5;
        if (multiSelectedNodes.has(node)) return size * 1.3;
        return size;
    }

    function getLinkVisibility(link) {
        // In compare mode, only show links where both endpoints are changed
        if (timelineActive && timelineCompareMode && timelineChangedNodes.size > 0) {
            var vSrc = typeof link.source === 'object' ? link.source.id : link.source;
            var vTgt = typeof link.target === 'object' ? link.target.id : link.target;
            return timelineChangedNodes.has(vSrc) && timelineChangedNodes.has(vTgt);
        }
        return true;
    }

    function getLinkColor(link) {
        if (showOrphans) return '#ffffff02';
        if (showDeadCode) return '#ffffff08';

        if (showCycles) {
            var srcId = typeof link.source === 'object' ? link.source.id : link.source;
            var tgtId = typeof link.target === 'object' ? link.target.id : link.target;
            var key = srcId + '>' + tgtId;
            if (cycleLinkKeys.has(key)) return '#ff1744';
            return '#ffffff06';
        }

        // Timeline diff link colors
        if (timelineActive && timelineChangedNodes.size > 0) {
            var tlSrc = typeof link.source === 'object' ? link.source.id : link.source;
            var tlTgt = typeof link.target === 'object' ? link.target.id : link.target;
            var tlKey = tlSrc + '>' + tlTgt;
            // Show added/removed link colors only in single-commit mode (not compare)
            if (!timelineCompareMode) {
                if (timelineAddedLinks.has(tlKey)) return '#00ff88cc';   // neon green
                if (timelineRemovedLinks.has(tlKey)) return '#ff2080cc'; // neon pink
            }
            if (timelineCompareMode) {
                // In compare mode: only show edges where both endpoints are changed
                if (timelineChangedNodes.has(tlSrc) && timelineChangedNodes.has(tlTgt)) {
                    return LINK_COLORS[link.type] || '#ffffff44';
                }
                return '#00000000';
            }
        }

        if (pathMode) {
            if (highlightedPath.links.size > 0) {
                return highlightedPath.links.has(link) ? (LINK_COLORS[link.type] || '#ffffffaa') : '#ffffff05';
            }
            return '#ffffff11';
        }

        if (flowTraceMode) {
            var ftSrc = typeof link.source === 'object' ? link.source.id : link.source;
            var ftTgt = typeof link.target === 'object' ? link.target.id : link.target;
            if (flowTraceNodes.has(ftSrc) && flowTraceNodes.has(ftTgt) &&
                flowTraceDepths[ftSrc] <= flowTraceAnimDepth && flowTraceDepths[ftTgt] <= flowTraceAnimDepth) {
                var edgeDepth = Math.max(flowTraceDepths[ftSrc] || 0, flowTraceDepths[ftTgt] || 0);
                return FLOW_COLORS[Math.min(edgeDepth, FLOW_COLORS.length - 1)] + 'aa';
            }
            return '#ffffff06';
        }

        if (link._isExplosionLink) {
            if (link._isCallEdge) {
                if (!hoveredSymbolId) return '#00000000';
                var ceSrc = typeof link.source === 'object' ? link.source.id : link.source;
                var ceTgt = typeof link.target === 'object' ? link.target.id : link.target;
                if (ceSrc === hoveredSymbolId || ceTgt === hoveredSymbolId) return '#00e5ffcc';
                return '#00000000';
            }
            return '#81c78488';
        }

        if (multiSelectedNodes.size > 0) {
            return multiSelectedLinks.has(link) ? '#93c5fdcc' : '#ffffff06';
        }

        if (pinnedNode) {
            if (!pinnedLinks.has(link)) return '#ffffff06';
            return LINK_COLORS[link.type] || '#ffffffaa';
        }

        // Dim links for unselected communities
        if (heatmapMode === 'community' && activeCommunities.size < Object.keys(communityNames).length) {
            var lSrc = typeof link.source === 'object' ? link.source.id : link.source;
            var lTgt = typeof link.target === 'object' ? link.target.id : link.target;
            var srcActive = activeCommunities.has(communityMap[lSrc]);
            var tgtActive = activeCommunities.has(communityMap[lTgt]);
            if (!srcActive || !tgtActive) return '#ffffff06';
        }

        if (highlightLinks.has(link)) return LINK_COLORS[link.type] || '#ffffff88';
        return LINK_COLORS[link.type] || '#ffffff22';
    }

    // ============================================================
    // Interactions
    // ============================================================
    function handleNodeHover(node) {
        hoveredNode = node;
        graphContainer.style.cursor = node ? 'pointer' : 'default';

        if (pathMode && highlightedPath.nodes.size > 0) {
            if (node) showTooltip(node);
            else hideTooltip();
            return;
        }

        // Track hovered symbol for call-edge visibility
        var symbolChanged = false;
        if (explodedNode) {
            var prevHoveredSymbol = hoveredSymbolId;
            hoveredSymbolId = (node && node._isSymbol) ? node.id : null;
            symbolChanged = hoveredSymbolId !== prevHoveredSymbol;
        } else {
            hoveredSymbolId = null;
        }

        highlightNodes.clear();
        highlightLinks.clear();

        if (node) {
            highlightNodes.add(node);
            var currentLinks = graph.graphData().links;
            for (var i = 0; i < currentLinks.length; i++) {
                var l = currentLinks[i];
                var sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                var targetId = typeof l.target === 'object' ? l.target.id : l.target;
                if (sourceId === node.id || targetId === node.id) {
                    highlightLinks.add(l);
                    var sourceNode = typeof l.source === 'object' ? l.source : findNode(l.source);
                    var targetNode = typeof l.target === 'object' ? l.target : findNode(l.target);
                    if (sourceNode) highlightNodes.add(sourceNode);
                    if (targetNode) highlightNodes.add(targetNode);
                }
            }
            showTooltip(node);
        } else {
            hideTooltip();
        }

        if (graph) {
            graph.nodeColor(graph.nodeColor())
                .linkWidth(graph.linkWidth())
                .linkDirectionalParticles(graph.linkDirectionalParticles());
            if (symbolChanged) {
                graph.linkColor(graph.linkColor());
            }
        }
    }

    function findNode(id) {
        var nodes = graph.graphData().nodes;
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].id === id) return nodes[i];
        }
        return null;
    }

    function handleNodeClick(node, event) {
        if (!node) return;

        if (pathMode) {
            if (pathNodes.length === 0) {
                pathNodes.push(node);
                if (graph) graph.nodeColor(graph.nodeColor());
            } else if (pathNodes.length === 1) {
                if (pathNodes[0].id === node.id) return;
                pathNodes.push(node);
                findPath(pathNodes[0], pathNodes[1]);
            } else {
                pathNodes = [node];
                highlightedPath.nodes.clear();
                highlightedPath.links.clear();
                if (graph) {
                    graph.nodeColor(graph.nodeColor())
                        .linkWidth(graph.linkWidth())
                        .linkColor(graph.linkColor())
                        .linkDirectionalParticles(graph.linkDirectionalParticles());
                }
            }
            return;
        }

        // Multi-selection with Shift+Click
        if (event && event.shiftKey) {
            if (multiSelectedNodes.size === 0 && selectedNode) {
                // Promote current single selection into multi-selection
                multiSelectedNodes.add(selectedNode);
            }
            if (multiSelectedNodes.has(node)) {
                multiSelectedNodes.delete(node);
            } else {
                multiSelectedNodes.add(node);
            }
            selectedNode = null;
            updateMultiSelectedLinks();
            refreshGraphVisuals();
            if (multiSelectedNodes.size > 1) {
                showMultiSelectPanel();
            } else if (multiSelectedNodes.size === 1) {
                var solo = multiSelectedNodes.values().next().value;
                multiSelectedNodes.clear();
                multiSelectedLinks.clear();
                selectedNode = solo;
                refreshGraphVisuals();
                showDetailPanel(solo);
            } else {
                detailPanel.classList.add('collapsed');
            }
            return;
        }

        // Normal click: clear multi-selection, select single
        if (multiSelectedNodes.size > 0) {
            multiSelectedNodes.clear();
            multiSelectedLinks.clear();
        }
        selectedNode = node;

        // Refresh glow effect
        if (graph) graph.nodeThreeObject(graph.nodeThreeObject());

        var distance = 120;
        var distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        graph.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
            node,
            1000
        );

        showDetailPanel(node);
    }

    function updateMultiSelectedLinks() {
        multiSelectedLinks.clear();
        if (multiSelectedNodes.size < 2 || !graphData) return;
        var selectedIds = new Set();
        multiSelectedNodes.forEach(function (n) { selectedIds.add(n.id); });
        var links = graphData.links;
        for (var i = 0; i < links.length; i++) {
            var srcId = typeof links[i].source === 'object' ? links[i].source.id : links[i].source;
            var tgtId = typeof links[i].target === 'object' ? links[i].target.id : links[i].target;
            if (selectedIds.has(srcId) && selectedIds.has(tgtId)) {
                multiSelectedLinks.add(links[i]);
            }
        }
    }

    function graphContainerDblClick() {
        if (hoveredNode) handleNodeDblClick(hoveredNode);
    }

    // Double-click: open file in VSCode editor, or expand/collapse cluster
    function handleNodeDblClick(node) {
        if (!node) return;
        if (node._isCluster) {
            toggleGroupExpansion(node._clusterGroup);
            return;
        }
        if (node._isSymbol) {
            vscode.postMessage({
                type: 'openFile',
                payload: { path: node.path, line: node._line }
            });
            return;
        }
        vscode.postMessage({
            type: 'openFile',
            payload: { path: node.path }
        });
    }

    function handleBackgroundClick() {
        if (pathMode) return;
        var hadSelection = !!selectedNode || multiSelectedNodes.size > 0;
        var hadPinned = !!pinnedNode || blastMode;
        selectedNode = null;
        multiSelectedNodes.clear();
        multiSelectedLinks.clear();
        highlightNodes.clear();
        highlightLinks.clear();
        detailPanel.classList.add('collapsed');
        clearPinnedFocus();
        if (explodedNode) collapseExplosion();
        updateExplorerSelection();
        if (graph) {
            graph.nodeColor(graph.nodeColor())
                .linkWidth(graph.linkWidth())
                .linkColor(graph.linkColor())
                .linkDirectionalParticles(graph.linkDirectionalParticles());
            if (hadSelection || hadPinned) {
                graph.nodeThreeObject(graph.nodeThreeObject());
            }
        }
    }

    // ============================================================
    // Right-click pinned focus
    // ============================================================
    function handleNodeRightClick(node, eventOrFlag) {
        if (!node || pathMode) return;

        var isEvent = eventOrFlag && typeof eventOrFlag === 'object' && 'shiftKey' in eventOrFlag;
        var isShift = isEvent && eventOrFlag.shiftKey;
        var isLightRefresh = eventOrFlag === true;

        // Shift+RightClick → blast radius mode
        if (isShift) {
            handleBlastRadius(node, false);
            return;
        }

        // Clear blast mode when switching to regular pin focus
        blastMode = false;
        blastDepths = {};

        if (pinnedNode && pinnedNode.id === node.id && !isLightRefresh) {
            clearPinnedFocus();
            refreshGraphVisuals();
            return;
        }

        pinnedNode = node;
        pinnedNodes.clear();
        pinnedLinks.clear();
        pinnedNodes.add(node);

        // BFS traversal up to focusDepth levels
        var currentLinks = graph.graphData().links;
        var frontier = [node];
        var visited = new Set();
        visited.add(node.id);

        for (var depth = 0; depth < focusDepth; depth++) {
            var nextFrontier = [];
            for (var f = 0; f < frontier.length; f++) {
                var curr = frontier[f];
                for (var i = 0; i < currentLinks.length; i++) {
                    var l = currentLinks[i];
                    var sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                    var targetId = typeof l.target === 'object' ? l.target.id : l.target;
                    if (sourceId === curr.id || targetId === curr.id) {
                        var neighborId = sourceId === curr.id ? targetId : sourceId;
                        var sourceNode = typeof l.source === 'object' ? l.source : findNode(l.source);
                        var targetNode = typeof l.target === 'object' ? l.target : findNode(l.target);
                        pinnedLinks.add(l);
                        if (!visited.has(neighborId)) {
                            visited.add(neighborId);
                            var neighborNode = sourceId === curr.id ? targetNode : sourceNode;
                            if (neighborNode) {
                                pinnedNodes.add(neighborNode);
                                nextFrontier.push(neighborNode);
                            }
                        }
                    }
                }
            }
            frontier = nextFrontier;
        }

        if (isLightRefresh) {
            refreshGraphColors();
        } else {
            refreshGraphVisuals();
        }
    }

    // ============================================================
    // Blast radius (Shift+RightClick) — directional impact analysis
    // ============================================================
    function handleBlastRadius(node, lightRefresh) {
        if (blastMode && pinnedNode && pinnedNode.id === node.id && !lightRefresh) {
            clearPinnedFocus();
            refreshGraphVisuals();
            return;
        }

        blastMode = true;
        pinnedNode = node;
        pinnedNodes.clear();
        pinnedLinks.clear();
        blastDepths = {};
        pinnedNodes.add(node);
        blastDepths[node.id] = 0;

        // Directional BFS — only follow dependents
        // Files whose edges point TO the current node (they import/use it)
        var currentLinks = graph.graphData().links;
        var frontier = [node];
        var visited = new Set();
        visited.add(node.id);

        for (var depth = 0; depth < focusDepth; depth++) {
            var nextFrontier = [];
            for (var f = 0; f < frontier.length; f++) {
                var curr = frontier[f];
                for (var i = 0; i < currentLinks.length; i++) {
                    var l = currentLinks[i];
                    var sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                    var targetId = typeof l.target === 'object' ? l.target.id : l.target;
                    // Reverse direction: find files that import/use/extend curr
                    if (targetId === curr.id && !visited.has(sourceId)) {
                        visited.add(sourceId);
                        var neighborNode = typeof l.source === 'object' ? l.source : findNode(sourceId);
                        if (neighborNode) {
                            pinnedNodes.add(neighborNode);
                            blastDepths[sourceId] = depth + 1;
                            nextFrontier.push(neighborNode);
                        }
                    }
                }
            }
            frontier = nextFrontier;
        }

        // Collect all links between blast nodes
        for (var j = 0; j < currentLinks.length; j++) {
            var link = currentLinks[j];
            var sid = typeof link.source === 'object' ? link.source.id : link.source;
            var tid = typeof link.target === 'object' ? link.target.id : link.target;
            if (visited.has(sid) && visited.has(tid)) {
                pinnedLinks.add(link);
            }
        }

        // No dependents found — cancel blast mode
        if (pinnedNodes.size <= 1) {
            clearPinnedFocus();
            refreshGraphVisuals();
            return;
        }

        if (lightRefresh) {
            refreshGraphColors();
        } else {
            refreshGraphVisuals();
        }
    }

    function handleBackgroundRightClick() {
        clearPinnedFocus();
        refreshGraphVisuals();
    }

    function clearPinnedFocus() {
        pinnedNode = null;
        pinnedNodes.clear();
        pinnedLinks.clear();
        blastMode = false;
        blastDepths = {};
        clearFlowTrace();
    }

    // ============================================================
    // Flow Trace — animate function call propagation across files
    // ============================================================
    function clearFlowTrace() {
        flowTraceMode = false;
        flowTraceNodes.clear();
        flowTraceDepths = {};
        flowTraceAnimDepth = -1;
        flowTraceMaxDepth = 0;
        if (flowTraceTimer) {
            clearInterval(flowTraceTimer);
            flowTraceTimer = null;
        }
    }

    function startFlowTrace(fileId, funcName) {
        // If already tracing same function, toggle off
        if (flowTraceMode && flowTraceDepths[fileId] === 0 && flowTraceNodes.size > 0) {
            clearFlowTrace();
            refreshGraphColors();
            return;
        }

        clearFlowTrace();

        if (!graphData || !graphData.functionCalls || graphData.functionCalls.length === 0) return;

        // Build caller→callees map: callerFile::callerName → [{calleeFile, calleeName}]
        var callMap = {};
        for (var i = 0; i < graphData.functionCalls.length; i++) {
            var fc = graphData.functionCalls[i];
            var key = fc.callerFile + '::' + fc.callerName;
            if (!callMap[key]) callMap[key] = [];
            callMap[key].push({ file: fc.calleeFile, name: fc.calleeName });
        }

        // Also build a file→functions map (which functions are defined in each file)
        var fileFuncs = {};
        var allNodes = graph ? graph.graphData().nodes : (graphData ? graphData.nodes : []);
        for (var n = 0; n < allNodes.length; n++) {
            var nd = allNodes[n];
            if (nd.symbols && nd.symbols.functions) {
                fileFuncs[nd.id] = [];
                for (var f = 0; f < nd.symbols.functions.length; f++) {
                    fileFuncs[nd.id].push(nd.symbols.functions[f].name);
                }
            }
        }

        // BFS: start from funcName in fileId
        flowTraceDepths[fileId] = 0;
        flowTraceNodes.add(fileId);

        var frontier = [{ file: fileId, name: funcName }];
        var visited = new Set();
        visited.add(fileId + '::' + funcName);
        var depth = 0;

        while (frontier.length > 0) {
            var nextFrontier = [];
            for (var fi = 0; fi < frontier.length; fi++) {
                var curr = frontier[fi];
                var key2 = curr.file + '::' + curr.name;
                var callees = callMap[key2];
                if (!callees) continue;
                for (var ci = 0; ci < callees.length; ci++) {
                    var callee = callees[ci];
                    var calleeKey = callee.file + '::' + callee.name;
                    if (visited.has(calleeKey)) continue;
                    visited.add(calleeKey);

                    // Record this file at its depth (keep shallowest)
                    if (flowTraceDepths[callee.file] === undefined) {
                        flowTraceDepths[callee.file] = depth + 1;
                    }
                    flowTraceNodes.add(callee.file);
                    nextFrontier.push(callee);
                }
            }
            depth++;
            frontier = nextFrontier;
            if (depth > 20) break; // safety limit
        }

        flowTraceMaxDepth = depth - 1;
        if (flowTraceNodes.size <= 1) {
            clearFlowTrace();
            return;
        }

        // Animate: reveal depth by depth
        flowTraceMode = true;
        flowTraceAnimDepth = 0;
        refreshGraphColors();

        flowTraceTimer = setInterval(function () {
            flowTraceAnimDepth++;
            refreshGraphColors();
            if (flowTraceAnimDepth >= flowTraceMaxDepth) {
                clearInterval(flowTraceTimer);
                flowTraceTimer = null;
            }
        }, 400);
    }

    // ============================================================
    // Impact mode — multi-source blast radius from timeline changed nodes
    // ============================================================
    function computeTimelineImpact() {
        if (!timelineActive || timelineChangedNodes.size === 0 || !graph) {
            impactMode = false;
            clearPinnedFocus();
            if (timelineImpactBtn) timelineImpactBtn.classList.remove('active');
            refreshGraphVisuals();
            return;
        }

        // Set up blast infrastructure
        blastMode = true;
        pinnedNode = {}; // sentinel — not a real node, just truthy
        pinnedNodes.clear();
        pinnedLinks.clear();
        blastDepths = {};

        var currentNodes = graph.graphData().nodes;
        var currentLinks = graph.graphData().links;
        var visited = new Set();
        var frontier = [];

        // Seed: all changed nodes as depth 0
        for (var ni = 0; ni < currentNodes.length; ni++) {
            var n = currentNodes[ni];
            if (timelineChangedNodes.has(n.id)) {
                pinnedNodes.add(n);
                blastDepths[n.id] = 0;
                visited.add(n.id);
                frontier.push(n);
            }
        }

        // BFS — follow dependents (reverse edges)
        for (var depth = 0; depth < focusDepth; depth++) {
            var nextFrontier = [];
            for (var f = 0; f < frontier.length; f++) {
                var curr = frontier[f];
                for (var i = 0; i < currentLinks.length; i++) {
                    var l = currentLinks[i];
                    var sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                    var targetId = typeof l.target === 'object' ? l.target.id : l.target;
                    if (targetId === curr.id && !visited.has(sourceId)) {
                        visited.add(sourceId);
                        var neighborNode = typeof l.source === 'object' ? l.source : findNode(sourceId);
                        if (neighborNode) {
                            pinnedNodes.add(neighborNode);
                            blastDepths[sourceId] = depth + 1;
                            nextFrontier.push(neighborNode);
                        }
                    }
                }
            }
            frontier = nextFrontier;
        }

        // Collect links between impacted nodes
        for (var j = 0; j < currentLinks.length; j++) {
            var link = currentLinks[j];
            var sid = typeof link.source === 'object' ? link.source.id : link.source;
            var tid = typeof link.target === 'object' ? link.target.id : link.target;
            if (visited.has(sid) && visited.has(tid)) {
                pinnedLinks.add(link);
            }
        }

        refreshGraphVisuals();
    }

    function toggleImpactMode() {
        if (!timelineActive || timelineChangedNodes.size === 0) return;
        impactMode = !impactMode;
        if (timelineImpactBtn) timelineImpactBtn.classList.toggle('active', impactMode);
        if (impactMode) {
            computeTimelineImpact();
        } else {
            clearPinnedFocus();
            refreshGraphVisuals();
        }
    }

    function toggleCompareMode() {
        timelineCompareMode = !timelineCompareMode;
        if (timelineCompareBtn) timelineCompareBtn.classList.toggle('active', timelineCompareMode);
        if (timelineFromSlider) {
            if (timelineCompareMode) {
                // Show the from-slider; restore saved positions if available
                timelineFromSlider.min = timelineSlider.min;
                timelineFromSlider.max = timelineSlider.max;
                if (timelineSavedFromPos >= 0 && timelineSavedToPos >= 0) {
                    timelineFromSlider.value = timelineSavedFromPos;
                    timelineFromPos = timelineSavedFromPos;
                    timelineSlider.value = timelineSavedToPos;
                } else {
                    timelineFromSlider.value = timelineSlider.value;
                    timelineFromPos = parseInt(timelineSlider.value);
                }
                timelineFromSlider.classList.remove('hidden');
                if (timelineFromControls) timelineFromControls.classList.remove('hidden');
                // Navigate to show the diff immediately
                var toPos = parseInt(timelineSlider.value);
                navigateToCommit(toPos);
            } else {
                // Save positions before hiding
                timelineSavedFromPos = parseInt(timelineFromSlider.value);
                timelineSavedToPos = parseInt(timelineSlider.value);
                timelineFromSlider.classList.add('hidden');
                if (timelineFromControls) timelineFromControls.classList.add('hidden');
                // Refresh to single-commit mode
                var pos = parseInt(timelineSlider.value);
                navigateToCommit(pos);
            }
        }
        updateTimelineLabel();
    }

    function refreshGraphVisuals() {
        if (!graph) return;
        graph.nodeColor(graph.nodeColor())
            .linkVisibility(graph.linkVisibility())
            .linkWidth(graph.linkWidth())
            .linkColor(graph.linkColor())
            .linkDirectionalArrowLength(graph.linkDirectionalArrowLength())
            .linkDirectionalParticles(graph.linkDirectionalParticles())
            .nodeThreeObject(graph.nodeThreeObject());
    }

    // Light refresh: update colors without reheating the simulation
    function refreshGraphColors() {
        if (!graph) return;
        graph.nodeColor(graph.nodeColor())
            .linkVisibility(graph.linkVisibility())
            .linkWidth(graph.linkWidth())
            .linkColor(graph.linkColor())
            .linkDirectionalArrowLength(graph.linkDirectionalArrowLength())
            .linkDirectionalParticles(graph.linkDirectionalParticles())
            .nodeThreeObject(graph.nodeThreeObject());
    }

    // ============================================================
    // Focus node from extension (when switching editor tabs)
    // ============================================================
    function focusNodeById(nodeId) {
        if (!graph || !graphData) return;
        var node = null;
        for (var i = 0; i < graphData.nodes.length; i++) {
            if (graphData.nodes[i].id === nodeId) {
                node = graphData.nodes[i];
                break;
            }
        }
        if (!node) return;

        selectedNode = node;
        updateExplorerSelection();

        // Subtle highlight without flying camera
        if (graph) {
            graph.nodeColor(graph.nodeColor());
        }
    }

    // ============================================================
    // Tooltip
    // ============================================================
    function showTooltip(node) {
        var nameEl = $('#tooltip-name');
        var metaEl = $('#tooltip-meta');

        if (node._isCluster) {
            nameEl.textContent = '📁 ' + node.name;
            metaEl.textContent = node._clusterCount + ' files · in: ' + (node.fanIn || 0) + ' · out: ' + (node.fanOut || 0) + ' · double-click to expand';
        } else if (node._isSymbol) {
            nameEl.textContent = (SYMBOL_ICONS[node._symbolType] || '⚡') + ' ' + node.name;
            metaEl.textContent = node._symbolType + ' · line ' + (node._line || '?');
        } else {
            nameEl.textContent = (LANGUAGE_ICONS[node.language] || '📄') + ' ' + node.name;
            var commName = '';
            var cid = communityMap[node.id];
            if (cid !== undefined && communityNames[cid]) commName = communityNames[cid].name;
            var parts = [
                node.linesOfCode + ' lines',
                node.language,
                'ccx: ' + (node.complexity || 1),
                'in: ' + node.fanIn,
                'out: ' + node.fanOut
            ];
            if (commName) parts.push(commName);
            metaEl.textContent = parts.join(' · ');
        }

        tooltip.classList.remove('hidden');
        document.addEventListener('mousemove', positionTooltip);
    }

    function positionTooltip(e) {
        tooltip.style.left = (e.clientX + 15) + 'px';
        tooltip.style.top = (e.clientY + 15) + 'px';
    }

    function hideTooltip() {
        tooltip.classList.add('hidden');
        document.removeEventListener('mousemove', positionTooltip);
    }

    function showTooltipMessage(msg) {
        tooltip.innerHTML = '<div style="padding:6px 10px;color:#ffd54f">' + msg + '</div>';
        tooltip.classList.remove('hidden');
        tooltip.style.left = '50%';
        tooltip.style.top = '60px';
        tooltip.style.transform = 'translateX(-50%)';
        setTimeout(function () {
            tooltip.classList.add('hidden');
            tooltip.style.transform = '';
        }, 2500);
    }

    // ============================================================
    // Detail Panel
    // ============================================================
    function showDetailPanel(node) {
        if (node._isSymbol) return;

        // Cluster meta-node detail panel
        if (node._isCluster) {
            detailPanel.classList.remove('collapsed');
            $('#panel-icon').textContent = '📁';
            $('#panel-filename').textContent = node.name;
            $('#panel-path').textContent = node._clusterGroup;
            $('#panel-language').textContent = node._clusterCount + ' files';
            $('#panel-language').style.color = node._clusterColor || '#78909c';
            $('#panel-group').textContent = node._clusterGroup;
            $('#panel-community').textContent = '—';
            $('#panel-community').style.color = '';
            $('#panel-loc').textContent = '—';
            $('#panel-size').textContent = '—';
            $('#panel-mtime').textContent = '—';
            $('#panel-fanout').textContent = node.fanOut || 0;
            $('#panel-fanin').textContent = node.fanIn || 0;
            $('#panel-complexity').textContent = '—';
            $('#panel-symbols-count').textContent = '0';
            $('#symbols-section').style.display = 'none';

            // Show member files in deps section
            var depsUl = $('#panel-deps');
            depsUl.innerHTML = '';
            $('#deps-count').textContent = node._memberIds ? node._memberIds.length : 0;
            if (node._memberIds) {
                for (var mi = 0; mi < node._memberIds.length; mi++) {
                    var memberId = node._memberIds[mi];
                    var memberNode = null;
                    for (var x = 0; x < graphData.nodes.length; x++) {
                        if (graphData.nodes[x].id === memberId) { memberNode = graphData.nodes[x]; break; }
                    }
                    var li = document.createElement('li');
                    li.innerHTML =
                        '<span class="dep-arrow">📄</span>' +
                        '<span>' + (memberNode ? memberNode.name : memberId) + '</span>';
                    depsUl.appendChild(li);
                }
            }

            var depUl = $('#panel-dependents');
            depUl.innerHTML = '';
            $('#dependents-count').textContent = '0';
            return;
        }

        detailPanel.classList.remove('collapsed');

        $('#panel-icon').textContent = LANGUAGE_ICONS[node.language] || '📄';
        $('#panel-filename').textContent = node.name;
        $('#panel-path').textContent = node.path;
        $('#panel-language').textContent = node.language;
        $('#panel-language').style.color = LANGUAGE_COLORS[node.language] || '#fff';
        $('#panel-group').textContent = node.group;
        var cid = communityMap[node.id];
        var commEl = $('#panel-community');
        if (cid !== undefined && communityNames[cid]) {
            commEl.textContent = communityNames[cid].name;
            commEl.style.color = communityColors[cid] || '#fff';
        } else {
            commEl.textContent = '—';
            commEl.style.color = '';
        }
        $('#panel-loc').textContent = node.linesOfCode.toLocaleString();
        $('#panel-size').textContent = formatBytes(node.size);

        if (node.lastModified) {
            var date = new Date(node.lastModified);
            $('#panel-mtime').textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else {
            $('#panel-mtime').textContent = '—';
        }
        $('#panel-fanout').textContent = node.fanOut;
        $('#panel-fanin').textContent = node.fanIn;
        $('#panel-complexity').textContent = node.complexity || 1;

        var symbolCount = node.symbols ? node.symbols.totalSymbols : 0;
        $('#panel-symbols-count').textContent = symbolCount;

        var symbolsSection = $('#symbols-section');
        var symbolsList = $('#symbols-list');
        symbolsList.innerHTML = '';

        if (node.symbols && node.symbols.totalSymbols > 0) {
            symbolsSection.style.display = 'block';
            $('#symbols-total').textContent = node.symbols.totalSymbols;

            // Explode button
            var explodeBtn = document.createElement('button');
            explodeBtn.className = 'explode-btn';
            explodeBtn.textContent = explodedNode && explodedNode.id === node.id ? '⊖ Collapse' : '⊕ Explode File';
            explodeBtn.addEventListener('click', function () {
                if (explodedNode && explodedNode.id === node.id) {
                    collapseExplosion();
                } else {
                    explodeFile(node);
                }
            });
            symbolsList.appendChild(explodeBtn);

            // Functions
            for (var i = 0; i < node.symbols.functions.length; i++) {
                var fn = node.symbols.functions[i];
                var item = document.createElement('div');
                item.className = 'symbol-item symbol-item-clickable';
                var traceBtn = document.createElement('button');
                traceBtn.className = 'flow-trace-btn';
                traceBtn.textContent = '▶';
                traceBtn.title = 'Trace call flow from ' + fn.name;
                (function (funcName, fileId) {
                    traceBtn.addEventListener('click', function (e) {
                        e.stopPropagation();
                        startFlowTrace(fileId, funcName);
                    });
                })(fn.name, node.id);
                item.appendChild(traceBtn);
                var iconSpan = document.createElement('span');
                iconSpan.className = 'symbol-icon';
                iconSpan.textContent = SYMBOL_ICONS['function'] || '⚡';
                item.appendChild(iconSpan);
                var nameSpan = document.createElement('span');
                nameSpan.className = 'symbol-name';
                nameSpan.textContent = fn.name;
                item.appendChild(nameSpan);
                var metaSpan = document.createElement('span');
                metaSpan.className = 'symbol-meta';
                metaSpan.textContent = fn.returnType + '(' + shortenParams(fn.params) + ') L' + fn.line;
                item.appendChild(metaSpan);
                (function (line) {
                    item.addEventListener('dblclick', function () {
                        vscode.postMessage({ type: 'openFile', payload: { path: node.path, line: line } });
                    });
                })(fn.line);
                symbolsList.appendChild(item);
            }

            // Structs
            for (var j = 0; j < node.symbols.structs.length; j++) {
                var s = node.symbols.structs[j];
                var sItem = document.createElement('div');
                sItem.className = 'symbol-item';
                sItem.innerHTML =
                    '<span class="symbol-icon">' + (SYMBOL_ICONS[s.type] || '📦') + '</span>' +
                    '<span class="symbol-name">' + s.name + '</span>' +
                    '<span class="symbol-meta">' + s.type + '</span>';
                symbolsList.appendChild(sItem);
            }

            // Enums
            for (var k = 0; k < node.symbols.enums.length; k++) {
                var en = node.symbols.enums[k];
                var eItem = document.createElement('div');
                eItem.className = 'symbol-item';
                eItem.innerHTML =
                    '<span class="symbol-icon">' + (SYMBOL_ICONS['enum'] || '🏷️') + '</span>' +
                    '<span class="symbol-name">' + en.name + '</span>' +
                    '<span class="symbol-meta">enum</span>';
                symbolsList.appendChild(eItem);
            }

            // Macros
            var macros = node.symbols.macros.slice(0, 15);
            for (var m = 0; m < macros.length; m++) {
                var mac = macros[m];
                var mItem = document.createElement('div');
                mItem.className = 'symbol-item';
                mItem.innerHTML =
                    '<span class="symbol-icon">' + (SYMBOL_ICONS[mac.type] || '⚙️') + '</span>' +
                    '<span class="symbol-name">' + mac.name + '</span>' +
                    '<span class="symbol-meta">' + mac.type + '</span>';
                symbolsList.appendChild(mItem);
            }
        } else {
            symbolsSection.style.display = 'none';
        }

        // Dead exports section
        if (node.deadExports && node.deadExports.length > 0) {
            var deadSection = document.createElement('div');
            deadSection.className = 'dead-exports-section';
            deadSection.innerHTML =
                '<div class="dead-exports-header">☠️ Dead code <span class="dead-count">' +
                node.deadExports.length + '</span></div>';
            for (var de = 0; de < node.deadExports.length; de++) {
                var dItem = document.createElement('div');
                dItem.className = 'symbol-item dead-export-item';
                dItem.innerHTML =
                    '<span class="symbol-icon">⚠️</span>' +
                    '<span class="symbol-name dead-name">' + node.deadExports[de] + '</span>' +
                    '<span class="symbol-meta">unused</span>';
                deadSection.appendChild(dItem);
            }
            symbolsList.appendChild(deadSection);
            symbolsSection.style.display = 'block';
        }

        // Cycles section
        if (node.cycleIds && node.cycleIds.length > 0 && graphData.meta.cycles) {
            var cycleSection = document.createElement('div');
            cycleSection.className = 'dead-exports-section';
            cycleSection.innerHTML =
                '<div class="dead-exports-header" style="color:#ff9800">🔄 Circular dependencies <span class="dead-count" style="background:rgba(255,152,0,0.2);color:#ff9800">' +
                node.cycleIds.length + '</span></div>';
            for (var cy = 0; cy < node.cycleIds.length; cy++) {
                var cycle = graphData.meta.cycles[node.cycleIds[cy]];
                if (!cycle) continue;
                var cNames = [];
                for (var cn = 0; cn < cycle.length; cn++) {
                    var parts = cycle[cn].split('/');
                    cNames.push(parts[parts.length - 1]);
                }
                var cycItem = document.createElement('div');
                cycItem.className = 'symbol-item';
                cycItem.innerHTML =
                    '<span class="symbol-icon">🔄</span>' +
                    '<span class="symbol-name" style="color:#ff9800;font-size:10px">' + cNames.join(' → ') + ' → ' + cNames[0] + '</span>';
                cycleSection.appendChild(cycItem);
            }
            symbolsList.appendChild(cycleSection);
            symbolsSection.style.display = 'block';
        }

        // Dependencies (outgoing)
        var deps = [];
        var currentLinks = graphData.links;
        for (var di = 0; di < currentLinks.length; di++) {
            var dl = currentLinks[di];
            var dsId = typeof dl.source === 'object' ? dl.source.id : dl.source;
            if (dsId === node.id) deps.push(dl);
        }
        var depsUl = $('#panel-deps');
        depsUl.innerHTML = '';
        $('#deps-count').textContent = deps.length;
        for (var dd = 0; dd < deps.length; dd++) {
            (function (d) {
                var targetId = typeof d.target === 'object' ? d.target.id : d.target;
                var targetNode = null;
                for (var x = 0; x < graphData.nodes.length; x++) {
                    if (graphData.nodes[x].id === targetId) { targetNode = graphData.nodes[x]; break; }
                }
                var li = document.createElement('li');
                var typeClass = d.type === 'function-call' ? 'dep-type dep-type-call' : 'dep-type';
                var labelStr = d.label ? ' <span class="dep-label">' + d.label + '</span>' : '';
                var countStr = (d.type === 'function-call' && d.callCount && d.callCount > 1)
                    ? ' <span class="dep-call-count" title="Number of distinct call sites">×' + d.callCount + '</span>'
                    : '';
                li.innerHTML =
                    '<span class="dep-arrow">→</span>' +
                    '<span>' + (targetNode ? targetNode.name : targetId) + '</span>' +
                    labelStr +
                    countStr +
                    '<span class="' + typeClass + '">' + d.type + '</span>';
                li.addEventListener('click', function () {
                    if (targetNode) handleNodeClick(targetNode);
                });
                depsUl.appendChild(li);
            })(deps[dd]);
        }

        // Dependents (incoming)
        var dependents = [];
        for (var ri = 0; ri < currentLinks.length; ri++) {
            var rl = currentLinks[ri];
            var rtId = typeof rl.target === 'object' ? rl.target.id : rl.target;
            if (rtId === node.id) dependents.push(rl);
        }
        var depUl = $('#panel-dependents');
        depUl.innerHTML = '';
        $('#dependents-count').textContent = dependents.length;
        for (var rr = 0; rr < dependents.length; rr++) {
            (function (d) {
                var sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                var sourceNode = null;
                for (var x = 0; x < graphData.nodes.length; x++) {
                    if (graphData.nodes[x].id === sourceId) { sourceNode = graphData.nodes[x]; break; }
                }
                var li = document.createElement('li');
                var typeClass = d.type === 'function-call' ? 'dep-type dep-type-call' : 'dep-type';
                var labelStr = d.label ? ' <span class="dep-label">' + d.label + '</span>' : '';
                var countStr = (d.type === 'function-call' && d.callCount && d.callCount > 1)
                    ? ' <span class="dep-call-count" title="Number of distinct call sites">×' + d.callCount + '</span>'
                    : '';
                li.innerHTML =
                    '<span class="dep-arrow">←</span>' +
                    '<span>' + (sourceNode ? sourceNode.name : sourceId) + '</span>' +
                    labelStr +
                    countStr +
                    '<span class="' + typeClass + '">' + d.type + '</span>';
                li.addEventListener('click', function () {
                    if (sourceNode) handleNodeClick(sourceNode);
                });
                depUl.appendChild(li);
            })(dependents[rr]);
        }

        updateExplorerSelection();
    }

    function showMultiSelectPanel() {
        detailPanel.classList.remove('collapsed');

        var nodes = [];
        multiSelectedNodes.forEach(function (n) { nodes.push(n); });

        var totalLoc = 0;
        var totalComplexity = 0;
        var totalSymbols = 0;
        var languages = {};
        for (var i = 0; i < nodes.length; i++) {
            totalLoc += nodes[i].linesOfCode || 0;
            totalComplexity += nodes[i].complexity || 1;
            totalSymbols += (nodes[i].symbols ? nodes[i].symbols.totalSymbols : 0);
            var lang = nodes[i].language || 'unknown';
            languages[lang] = (languages[lang] || 0) + 1;
        }
        var avgComplexity = nodes.length > 0 ? (totalComplexity / nodes.length).toFixed(1) : 0;

        $('#panel-icon').textContent = '📌';
        $('#panel-filename').textContent = nodes.length + ' files selected';
        $('#panel-path').textContent = 'Multi-selection';
        $('#panel-language').textContent = Object.keys(languages).join(', ');
        $('#panel-language').style.color = '#93c5fd';
        $('#panel-group').textContent = '—';
        $('#panel-community').textContent = '—';
        $('#panel-community').style.color = '';
        $('#panel-loc').textContent = totalLoc.toLocaleString();
        $('#panel-size').textContent = '—';
        $('#panel-mtime').textContent = '—';
        $('#panel-fanout').textContent = '—';
        $('#panel-fanin').textContent = '—';
        $('#panel-complexity').textContent = avgComplexity;
        $('#panel-symbols-count').textContent = totalSymbols;

        var symbolsSection = $('#symbols-section');
        var symbolsList = $('#symbols-list');
        symbolsList.innerHTML = '';

        // Language breakdown
        symbolsSection.style.display = 'block';
        $('#symbols-total').textContent = nodes.length;

        var langKeys = Object.keys(languages);
        for (var li = 0; li < langKeys.length; li++) {
            var langItem = document.createElement('div');
            langItem.className = 'symbol-item';
            langItem.innerHTML =
                '<span class="symbol-icon">' + (LANGUAGE_ICONS[langKeys[li]] || '📄') + '</span>' +
                '<span class="symbol-name">' + langKeys[li] + '</span>' +
                '<span class="symbol-meta">' + languages[langKeys[li]] + ' files</span>';
            symbolsList.appendChild(langItem);
        }

        // List selected files
        var filesSection = document.createElement('div');
        filesSection.className = 'dead-exports-section';
        filesSection.innerHTML =
            '<div class="dead-exports-header" style="color:#93c5fd">📌 Selected files <span class="dead-count" style="background:rgba(147,197,253,0.2);color:#93c5fd">' +
            nodes.length + '</span></div>';
        for (var fi = 0; fi < nodes.length; fi++) {
            (function (node) {
                var fItem = document.createElement('div');
                fItem.className = 'symbol-item symbol-item-clickable';
                fItem.innerHTML =
                    '<span class="symbol-icon">' + (LANGUAGE_ICONS[node.language] || '📄') + '</span>' +
                    '<span class="symbol-name">' + node.name + '</span>' +
                    '<span class="symbol-meta">' + node.linesOfCode + ' lines</span>';
                fItem.addEventListener('click', function () {
                    handleNodeClick(node);
                });
                filesSection.appendChild(fItem);
            })(nodes[fi]);
        }
        symbolsList.appendChild(filesSection);

        // Internal links count
        var depsUl = $('#panel-deps');
        depsUl.innerHTML = '';
        $('#deps-count').textContent = multiSelectedLinks.size;
        multiSelectedLinks.forEach(function (link) {
            var srcId = typeof link.source === 'object' ? link.source.id : link.source;
            var tgtId = typeof link.target === 'object' ? link.target.id : link.target;
            var srcNode = null, tgtNode = null;
            for (var x = 0; x < graphData.nodes.length; x++) {
                if (graphData.nodes[x].id === srcId) srcNode = graphData.nodes[x];
                if (graphData.nodes[x].id === tgtId) tgtNode = graphData.nodes[x];
            }
            var liEl = document.createElement('li');
            var typeClass = link.type === 'function-call' ? 'dep-type dep-type-call' : 'dep-type';
            var labelStr = link.label ? ' <span class="dep-label">' + link.label + '</span>' : '';
            liEl.innerHTML =
                '<span class="dep-arrow">→</span>' +
                '<span>' + (srcNode ? srcNode.name : srcId) + ' → ' + (tgtNode ? tgtNode.name : tgtId) + '</span>' +
                labelStr +
                '<span class="' + typeClass + '">' + link.type + '</span>';
            depsUl.appendChild(liEl);
        });

        var depUl = $('#panel-dependents');
        depUl.innerHTML = '';
        $('#dependents-count').textContent = '0';
    }

    function shortenParams(params) {
        if (!params) return '';
        if (params.length > 40) return params.substring(0, 37) + '...';
        return params;
    }

    function setupPanelClose() {
        $('#panel-close').addEventListener('click', function () {
            detailPanel.classList.add('collapsed');
            selectedNode = null;
            if (multiSelectedNodes.size > 0) {
                multiSelectedNodes.clear();
                multiSelectedLinks.clear();
                refreshGraphVisuals();
            }
        });
    }

    // ============================================================
    // File Explosion
    // ============================================================
    function explodeFile(node) {
        if (!node.symbols || !node.symbols.functions.length) return;
        if (explodedNode) collapseExplosion();

        explodedNode = node;
        var currentData = graph.graphData();
        var subNodes = [];
        var subLinks = [];
        var colors = { 'function': '#81c784', 'struct': '#ce93d8', 'enum': '#ffd54f' };

        var allSymbols = [];
        for (var i = 0; i < node.symbols.functions.length; i++) {
            allSymbols.push(node.symbols.functions[i]);
        }
        for (var j = 0; j < node.symbols.structs.length; j++) {
            allSymbols.push(node.symbols.structs[j]);
        }

        for (var s = 0; s < allSymbols.length; s++) {
            var sym = allSymbols[s];
            var subId = node.id + '::' + sym.name;
            subNodes.push({
                id: subId,
                name: sym.name,
                path: node.path,
                language: node.language,
                linesOfCode: 10,
                size: 0,
                group: node.group,
                fanIn: 0,
                fanOut: 0,
                complexity: 1,
                _isSymbol: true,
                _parentId: node.id,
                _symbolType: sym.type,
                _symbolColor: colors[sym.type] || '#81c784',
                _line: sym.line,
                x: (node.x || 0) + (Math.random() - 0.5) * 60,
                y: (node.y || 0) + (Math.random() - 0.5) * 60,
                z: (node.z || 0) + (Math.random() - 0.5) * 60
            });
            subLinks.push({
                source: node.id,
                target: subId,
                type: 'contains',
                label: 'contains ' + sym.name,
                _isExplosionLink: true
            });
        }

        // Build call edges (not shown immediately — revealed on symbol hover)
        var allCallEdges = [];
        var subIdSet = new Set(subNodes.map(function (n) { return n.id; }));
        if (graphData && graphData.functionCalls) {
            for (var fc = 0; fc < graphData.functionCalls.length; fc++) {
                var call = graphData.functionCalls[fc];
                if (call.callerFile !== node.id) continue;
                var callerId = node.id + '::' + call.callerName;
                // Intra-file: callee is a symbol in the same file
                if (call.calleeFile === node.id) {
                    var calleeId = node.id + '::' + call.calleeName;
                    if (subIdSet.has(callerId) && subIdSet.has(calleeId) && callerId !== calleeId) {
                        allCallEdges.push({
                            source: callerId,
                            target: calleeId,
                            type: 'function-call',
                            label: call.callerName + ' → ' + call.calleeName,
                            _isExplosionLink: true,
                            _isCallEdge: true
                        });
                    }
                }
                // Cross-file: caller symbol → external file node
                else if (subIdSet.has(callerId) && call.calleeFile) {
                    allCallEdges.push({
                        source: callerId,
                        target: call.calleeFile,
                        type: 'function-call',
                        label: call.callerName + ' → ' + call.calleeName + ' (' + call.calleeFile + ')',
                        _isExplosionLink: true,
                        _isCallEdge: true
                    });
                }
            }
        }

        explosionData = {
            parentId: node.id,
            subNodeIds: subNodes.map(function (n) { return n.id; })
        };

        var newNodes = currentData.nodes.concat(subNodes);
        var newLinks = currentData.links.concat(subLinks).concat(allCallEdges);
        graph.graphData({ nodes: newNodes, links: newLinks });
    }

    function collapseExplosion() {
        if (!explosionData) return;
        var currentData = graph.graphData();
        var subIds = new Set(explosionData.subNodeIds);

        var filteredNodes = currentData.nodes.filter(function (n) { return !subIds.has(n.id); });
        var filteredLinks = currentData.links.filter(function (l) { return !l._isExplosionLink; });

        graph.graphData({ nodes: filteredNodes, links: filteredLinks });
        explodedNode = null;
        explosionData = null;
        hoveredSymbolId = null;
    }

    // ============================================================
    // Heatmap
    // ============================================================
    function formatLegendDate(timestamp) {
        if (!timestamp || timestamp === Infinity || timestamp === -Infinity) return '—';
        var d = new Date(timestamp);
        return d.toLocaleDateString();
    }

    function setHeatmapMode(mode) {
        heatmapMode = mode;
        var legend = $('#heatmap-legend');

        // Show/hide community palette
        if (mode === 'community') {
            showCommunityPalette();
        } else {
            hideCommunityPalette();
        }

        if (mode === 'off') {
            legend.classList.add('hidden');
        } else if (mode === 'community') {
            legend.classList.remove('hidden');
            $('#legend-mode').textContent = HEATMAP_LABELS[mode] || mode;

            // Count communities
            var commCounts = {};
            for (var nid in communityMap) {
                var c = communityMap[nid];
                commCounts[c] = (commCounts[c] || 0) + 1;
            }
            var numComm = Object.keys(commCounts).length;

            var gradient = $('#legend-gradient');
            // Build gradient from community colors
            var stops = [];
            for (var ci = 0; ci < Math.min(numComm, GROUP_COLORS.length); ci++) {
                stops.push(communityColors[ci] || GROUP_COLORS[ci]);
            }
            if (stops.length > 0) {
                gradient.style.background = 'linear-gradient(to right, ' + stops.join(', ') + ')';
            }
            $('#legend-low').textContent = numComm + ' communities';
            $('#legend-high').textContent = '';
        } else {
            legend.classList.remove('hidden');
            $('#legend-mode').textContent = HEATMAP_LABELS[mode] || mode;

            var gradient = $('#legend-gradient');
            var scale = HEATMAP_SCALES[mode];
            if (scale) {
                gradient.style.background = 'linear-gradient(to right, ' + scale.join(', ') + ')';
            }

            var range = metricRanges[mode];
            if (range) {
                if (mode === 'lastModified') {
                    $('#legend-low').textContent = formatLegendDate(range.min);
                    $('#legend-high').textContent = formatLegendDate(range.max);
                } else {
                    $('#legend-low').textContent = range.min;
                    $('#legend-high').textContent = range.max;
                }
            }
        }

        if (graph) graph.nodeColor(graph.nodeColor());
    }

    // ============================================================
    // Directory Clustering
    // ============================================================
    function toggleDirectoryGroups() {
        showGroups = !showGroups;
        $('#btn-group-dirs').classList.toggle('active', showGroups);
        if (!showGroups) {
            expandedGroups.clear();
        }
        applyFilters();
    }

    function toggleGroupExpansion(groupName) {
        if (expandedGroups.has(groupName)) {
            expandedGroups.delete(groupName);
        } else {
            expandedGroups.add(groupName);
        }
        applyFilters();
    }

    function buildClusteredData(data) {
        // Group nodes by their group property (top-level directory)
        var groups = {};
        for (var i = 0; i < data.nodes.length; i++) {
            var n = data.nodes[i];
            if (n._isSymbol) continue;
            var grp = n.group || '/';
            if (!groups[grp]) groups[grp] = [];
            groups[grp].push(n);
        }

        var clusterNodes = [];
        var clusterLinks = [];
        var nodeToCluster = {}; // nodeId -> clusterId or nodeId

        var colorIdx = 0;
        var groupNames = Object.keys(groups).sort();

        for (var g = 0; g < groupNames.length; g++) {
            var groupName = groupNames[g];
            var members = groups[groupName];

            if (expandedGroups.has(groupName) || members.length === 1) {
                // Expanded: show individual nodes
                for (var m = 0; m < members.length; m++) {
                    clusterNodes.push(members[m]);
                    nodeToCluster[members[m].id] = members[m].id;
                }
            } else {
                // Collapsed: create meta-node
                var totalLoc = 0, totalSize = 0, maxComplexity = 0;
                for (var mc = 0; mc < members.length; mc++) {
                    totalLoc += members[mc].linesOfCode || 0;
                    totalSize += members[mc].size || 0;
                    maxComplexity = Math.max(maxComplexity, members[mc].complexity || 1);
                }
                var color = GROUP_COLORS[colorIdx % GROUP_COLORS.length];
                var clusterId = '__cluster__' + groupName;
                clusterNodes.push({
                    id: clusterId,
                    name: groupName + '/',
                    path: groupName,
                    language: 'cluster',
                    extension: '',
                    size: totalSize,
                    linesOfCode: totalLoc,
                    lastModified: 0,
                    group: groupName,
                    fanIn: 0,
                    fanOut: 0,
                    complexity: maxComplexity,
                    _isCluster: true,
                    _clusterGroup: groupName,
                    _clusterColor: color,
                    _clusterCount: members.length,
                    _memberIds: members.map(function (n) { return n.id; })
                });
                for (var mi = 0; mi < members.length; mi++) {
                    nodeToCluster[members[mi].id] = clusterId;
                }
                colorIdx++;
            }
        }

        // Remap links
        var linkSet = new Set();
        for (var li = 0; li < data.links.length; li++) {
            var link = data.links[li];
            var srcId = typeof link.source === 'object' ? link.source.id : link.source;
            var tgtId = typeof link.target === 'object' ? link.target.id : link.target;
            var mappedSrc = nodeToCluster[srcId] || srcId;
            var mappedTgt = nodeToCluster[tgtId] || tgtId;
            if (mappedSrc === mappedTgt) continue; // internal link within same cluster
            var lkey = mappedSrc + '|' + mappedTgt;
            if (linkSet.has(lkey)) continue;
            linkSet.add(lkey);
            clusterLinks.push({
                source: mappedSrc,
                target: mappedTgt,
                type: link.type,
                label: link.label
            });
        }

        // Compute cluster fan-in/fan-out
        for (var ci = 0; ci < clusterNodes.length; ci++) {
            var cn = clusterNodes[ci];
            if (cn._isCluster) {
                var fi = 0, fo = 0;
                for (var cl = 0; cl < clusterLinks.length; cl++) {
                    var csrc = typeof clusterLinks[cl].source === 'object' ? clusterLinks[cl].source.id : clusterLinks[cl].source;
                    var ctgt = typeof clusterLinks[cl].target === 'object' ? clusterLinks[cl].target.id : clusterLinks[cl].target;
                    if (csrc === cn.id) fo++;
                    if (ctgt === cn.id) fi++;
                }
                cn.fanIn = fi;
                cn.fanOut = fo;
            }
        }

        return { nodes: clusterNodes, links: clusterLinks };
    }

    // ============================================================
    // Search
    // ============================================================
    function setupSearch() {
        searchInput.addEventListener('input', function (e) {
            var query = e.target.value.trim().toLowerCase();
            if (query.length < 2 || !graphData) {
                searchResults.classList.add('hidden');
                return;
            }

            var results = [];
            for (var i = 0; i < graphData.nodes.length; i++) {
                var n = graphData.nodes[i];
                if (n.name.toLowerCase().indexOf(query) !== -1 ||
                    n.path.toLowerCase().indexOf(query) !== -1) {
                    results.push(n);
                    if (results.length >= 10) break;
                }
            }

            if (results.length === 0) {
                searchResults.classList.add('hidden');
                return;
            }

            searchResults.innerHTML = '';
            for (var r = 0; r < results.length; r++) {
                (function (node) {
                    var item = document.createElement('div');
                    item.className = 'search-result-item';
                    item.innerHTML =
                        '<span style="color:' + (LANGUAGE_COLORS[node.language] || '#fff') + '">' +
                        (LANGUAGE_ICONS[node.language] || '📄') +
                        '</span>' +
                        '<div>' +
                        '<div class="result-name">' + highlightMatch(node.name, query) + '</div>' +
                        '<div class="result-path">' + escapeHtml(node.path) + '</div>' +
                        '</div>';
                    item.addEventListener('click', function () {
                        handleNodeClick(node);
                        searchResults.classList.add('hidden');
                        searchInput.value = node.name;
                    });
                    searchResults.appendChild(item);
                })(results[r]);
            }

            searchResults.classList.remove('hidden');
        });

        document.addEventListener('click', function (e) {
            if (!e.target.closest('#search-container')) {
                searchResults.classList.add('hidden');
            }
        });

        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                searchResults.classList.add('hidden');
                searchInput.blur();
            }
        });
    }

    function highlightMatch(text, query) {
        var idx = text.toLowerCase().indexOf(query);
        if (idx === -1) return escapeHtml(text);
        return escapeHtml(text.slice(0, idx)) +
            '<strong style="color:#60a5fa">' +
            escapeHtml(text.slice(idx, idx + query.length)) + '</strong>' +
            escapeHtml(text.slice(idx + query.length));
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ============================================================
    // Label Sprites (THREE.js)
    // ============================================================
    var labelSpriteCache = {};
    function getLabelSprite(text) {
        var T = window.THREE;
        if (!T) return null;

        if (labelSpriteCache[text]) {
            return labelSpriteCache[text].clone();
        }

        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        var fontSize = 32;
        context.font = fontSize + 'px sans-serif';
        var textWidth = context.measureText(text).width;

        var paddingX = 16;
        var paddingY = 8;
        canvas.width = textWidth + paddingX;
        canvas.height = fontSize + paddingY;

        context.font = fontSize + 'px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        if (context.roundRect) {
            context.beginPath();
            context.roundRect(0, 0, canvas.width, canvas.height, 8);
            context.fill();
        } else {
            context.fillRect(0, 0, canvas.width, canvas.height);
        }

        context.fillStyle = 'rgba(255, 255, 255, 0.9)';
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        var texture = new T.CanvasTexture(canvas);
        texture.minFilter = T.LinearFilter;
        var material = new T.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
        var sprite = new T.Sprite(material);

        var scaleFactor = 0.15;
        sprite.scale.set(canvas.width * scaleFactor, canvas.height * scaleFactor, 1);

        labelSpriteCache[text] = sprite;
        return sprite.clone();
    }

    function getClusterLabelSprite(groupName, count, color) {
        var T = window.THREE;
        if (!T) return null;

        var label = groupName + ' (' + count + ')';
        var cacheKey = 'cluster:' + label + ':' + color;
        if (labelSpriteCache[cacheKey]) return labelSpriteCache[cacheKey].clone();

        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var fontSize = 36;
        ctx.font = 'bold ' + fontSize + 'px sans-serif';
        var tw = ctx.measureText(label).width;

        var px = 24, py = 16;
        canvas.width = tw + px;
        canvas.height = fontSize + py;

        ctx.font = 'bold ' + fontSize + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Background pill
        ctx.fillStyle = color || 'rgba(120,144,156,0.8)';
        ctx.globalAlpha = 0.75;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(0, 0, canvas.width, canvas.height, 12);
            ctx.fill();
        } else {
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.globalAlpha = 1.0;

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, canvas.width / 2, canvas.height / 2);

        var texture = new T.CanvasTexture(canvas);
        texture.minFilter = T.LinearFilter;
        var mat = new T.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
        var sprite = new T.Sprite(mat);
        var sf = 0.18;
        sprite.scale.set(canvas.width * sf, canvas.height * sf, 1);

        labelSpriteCache[cacheKey] = sprite;
        return sprite.clone();
    }

    // ============================================================
    // Path Mode BFS
    // ============================================================
    function findPath(start, end) {
        var queue = [[start, []]];
        var visited = new Set();
        visited.add(start.id);

        var adj = {};
        var links = graphData.links;
        for (var i = 0; i < links.length; i++) {
            var l = links[i];
            var sId = typeof l.source === 'object' ? l.source.id : l.source;
            if (!adj[sId]) adj[sId] = [];

            var tNode = typeof l.target === 'object' ? l.target : findNode(typeof l.target === 'object' ? l.target.id : l.target);
            adj[sId].push({ target: tNode, link: l });
        }

        while (queue.length > 0) {
            var current = queue.shift();
            var currNode = current[0];
            var pathLinks = current[1];

            if (currNode.id === end.id) {
                highlightedPath.links = new Set(pathLinks);
                var nodesInPath = new Set();
                nodesInPath.add(start);
                for (var j = 0; j < pathLinks.length; j++) {
                    var nsId = typeof pathLinks[j].source === 'object' ? pathLinks[j].source.id : pathLinks[j].source;
                    var ntId = typeof pathLinks[j].target === 'object' ? pathLinks[j].target.id : pathLinks[j].target;
                    nodesInPath.add(findNode(nsId));
                    nodesInPath.add(findNode(ntId));
                }
                highlightedPath.nodes = nodesInPath;

                if (graph) {
                    graph.nodeColor(graph.nodeColor())
                        .linkWidth(graph.linkWidth())
                        .linkColor(graph.linkColor())
                        .linkDirectionalParticles(graph.linkDirectionalParticles());
                    graph.zoomToFit(1000, 50, function (n) { return nodesInPath.has(n); });
                }
                return;
            }

            var neighbors = adj[currNode.id] || [];
            for (var k = 0; k < neighbors.length; k++) {
                var n = neighbors[k].target;
                var link = neighbors[k].link;
                if (n && !visited.has(n.id)) {
                    visited.add(n.id);
                    var newPathLinks = pathLinks.slice();
                    newPathLinks.push(link);
                    queue.push([n, newPathLinks]);
                }
            }
        }

        // No path found
        pathNodes = [];
        highlightedPath.nodes.clear();
        highlightedPath.links.clear();
        if (graph) graph.nodeColor(graph.nodeColor());
    }

    // ============================================================
    // Filters
    // ============================================================
    function updateLanguageButtons(nodes) {
        var presentLangs = new Set();
        for (var i = 0; i < nodes.length; i++) {
            var langKey = nodes[i].language;
            if (langKey === 'c') langKey = nodes[i].extension === '.h' ? 'c-header' : 'c-source';
            presentLangs.add(langKey);
        }
        var langBtns = document.querySelectorAll('#language-filters .filter-btn');
        for (var j = 0; j < langBtns.length; j++) {
            var btn = langBtns[j];
            var lang = btn.dataset.lang;
            if (presentLangs.has(lang)) {
                btn.style.display = '';
                if (!activeLanguages.has(lang)) activeLanguages.add(lang);
                btn.classList.add('active');
            } else {
                btn.style.display = 'none';
                activeLanguages.delete(lang);
            }
        }
    }

    // ============================================================
    // View State Persistence
    // ============================================================
    function collectViewState() {
        return {
            activeLanguages: Array.from(activeLanguages),
            dagMode: dagMode,
            showOrphans: showOrphans,
            showDeadCode: showDeadCode,
            showCycles: showCycles,
            showGroups: showGroups,
            pathMode: pathMode,
            showLabels: showLabels,
            heatmapMode: heatmapMode,
            nodeSizeMultiplier: nodeSizeMultiplier,
            spreadMultiplier: spreadMultiplier,
            focusDepth: focusDepth,
            showExplorer: showExplorer,
            showMinimap: !$('#minimap').classList.contains('hidden')
        };
    }

    function saveViewState() {
        vscode.postMessage({ type: 'saveViewState', payload: collectViewState() });
    }

    function applyViewState(state) {
        if (!state) return;

        // Languages — only restrict to saved set, intersect with present languages
        if (state.activeLanguages) {
            var savedLangs = new Set(state.activeLanguages);
            var langBtns = document.querySelectorAll('#language-filters .filter-btn');
            for (var i = 0; i < langBtns.length; i++) {
                var btn = langBtns[i];
                var lang = btn.dataset.lang;
                if (btn.style.display === 'none') continue; // not present in project
                var shouldBeActive = savedLangs.has(lang);
                btn.classList.toggle('active', shouldBeActive);
                if (shouldBeActive) activeLanguages.add(lang);
                else activeLanguages.delete(lang);
            }
        }

        // Boolean toggles
        dagMode = !!state.dagMode;
        showOrphans = !!state.showOrphans;
        showDeadCode = !!state.showDeadCode;
        showCycles = !!state.showCycles;
        showLabels = !!state.showLabels;
        pathMode = !!state.pathMode;

        $('#btn-dag-mode').classList.toggle('active', dagMode);
        $('#btn-highlight-orphans').classList.toggle('active', showOrphans);
        $('#btn-dead-code').classList.toggle('active', showDeadCode);
        $('#btn-cycles').classList.toggle('active', showCycles);
        $('#btn-labels').classList.toggle('active', showLabels);
        $('#btn-path-mode').classList.toggle('active', pathMode);

        // Groups — set directly (don't call toggleDirectoryGroups which flips the value)
        showGroups = !!state.showGroups;
        $('#btn-group-dirs').classList.toggle('active', showGroups);

        // Sliders
        if (typeof state.nodeSizeMultiplier === 'number') {
            nodeSizeMultiplier = state.nodeSizeMultiplier;
            var nss = $('#node-size-slider');
            if (nss) nss.value = nodeSizeMultiplier;
        }
        if (typeof state.spreadMultiplier === 'number') {
            spreadMultiplier = state.spreadMultiplier;
            var ss = $('#spread-slider');
            if (ss) ss.value = spreadMultiplier;
        }
        if (typeof state.focusDepth === 'number') {
            focusDepth = state.focusDepth;
            var ds = $('#depth-slider');
            if (ds) ds.value = focusDepth;
            var dv = $('#depth-value');
            if (dv) dv.textContent = focusDepth;
        }

        // Heatmap
        if (state.heatmapMode) {
            var hs = $('#heatmap-select');
            if (hs) hs.value = state.heatmapMode;
            setHeatmapMode(state.heatmapMode);
        }

        // Explorer
        if (typeof state.showExplorer === 'boolean') {
            showExplorer = state.showExplorer;
            if (showExplorer) {
                explorerPanel.classList.remove('collapsed');
                toggleExplorerBtn.classList.add('active');
            } else {
                explorerPanel.classList.add('collapsed');
                toggleExplorerBtn.classList.remove('active');
            }
        }

        // Minimap
        if (typeof state.showMinimap === 'boolean') {
            var mm = $('#minimap');
            var mmBtn = $('#btn-minimap');
            if (mm) mm.classList.toggle('hidden', !state.showMinimap);
            if (mmBtn) mmBtn.classList.toggle('active', !!state.showMinimap);
        }

        // Apply to graph
        if (graph) {
            graph.dagMode(dagMode ? 'td' : null);
            graph.dagLevelDistance(dagMode ? 60 : null);

            // Build cycle sets if needed
            if (showCycles && graphData && graphData.meta && graphData.meta.cycles) {
                cycleNodeIds.clear();
                cycleLinkKeys.clear();
                for (var ci = 0; ci < graphData.meta.cycles.length; ci++) {
                    var cycle = graphData.meta.cycles[ci];
                    for (var cj = 0; cj < cycle.length; cj++) {
                        cycleNodeIds.add(cycle[cj]);
                        var nextIdx = (cj + 1) % cycle.length;
                        cycleLinkKeys.add(cycle[cj] + '>' + cycle[nextIdx]);
                    }
                }
            }

            applySpreadForces();
            applyFilters();
            // Force refresh of all visual accessors
            graph.nodeColor(graph.nodeColor());
            graph.nodeVal(graph.nodeVal());
            graph.linkColor(graph.linkColor());
            graph.nodeThreeObject(graph.nodeThreeObject());
        }
    }

    function setupFilters() {
        var langBtns = document.querySelectorAll('#language-filters .filter-btn');
        for (var i = 0; i < langBtns.length; i++) {
            (function (btn) {
                btn.addEventListener('click', function () {
                    var lang = btn.dataset.lang;
                    btn.classList.toggle('active');
                    if (btn.classList.contains('active')) activeLanguages.add(lang);
                    else activeLanguages.delete(lang);
                    applyFilters();
                    saveViewState();
                });
            })(langBtns[i]);
        }

        $('#btn-dag-mode').addEventListener('click', function () {
            dagMode = !dagMode;
            $('#btn-dag-mode').classList.toggle('active', dagMode);
            if (graph) {
                graph.dagMode(dagMode ? 'td' : null);
                graph.dagLevelDistance(dagMode ? 60 : null);
                if (!dagMode) {
                    graph.numDimensions(3);
                    graph.d3ReheatSimulation();
                }
                applyFilters();
            }
            saveViewState();
        });

        $('#btn-highlight-orphans').addEventListener('click', function () {
            showOrphans = !showOrphans;
            $('#btn-highlight-orphans').classList.toggle('active', showOrphans);
            if (showOrphans) {
                if (showDeadCode) { showDeadCode = false; $('#btn-dead-code').classList.remove('active'); }
                if (showCycles) { showCycles = false; $('#btn-cycles').classList.remove('active'); }
            }
            if (graph) {
                graph.nodeColor(graph.nodeColor());
                graph.nodeVal(graph.nodeVal());
                graph.linkColor(graph.linkColor());
                graph.nodeThreeObject(graph.nodeThreeObject());
            }
            saveViewState();
        });

        $('#btn-dead-code').addEventListener('click', function () {
            showDeadCode = !showDeadCode;
            $('#btn-dead-code').classList.toggle('active', showDeadCode);
            if (showDeadCode) {
                if (showOrphans) { showOrphans = false; $('#btn-highlight-orphans').classList.remove('active'); }
                if (showCycles) { showCycles = false; $('#btn-cycles').classList.remove('active'); }
            }
            if (graph) {
                graph.nodeColor(graph.nodeColor());
                graph.nodeVal(graph.nodeVal());
                graph.linkColor(graph.linkColor());
                graph.nodeThreeObject(graph.nodeThreeObject());
            }
            saveViewState();
        });

        $('#btn-cycles').addEventListener('click', function () {
            showCycles = !showCycles;
            $('#btn-cycles').classList.toggle('active', showCycles);
            if (showCycles) {
                if (showOrphans) { showOrphans = false; $('#btn-highlight-orphans').classList.remove('active'); }
                if (showDeadCode) { showDeadCode = false; $('#btn-dead-code').classList.remove('active'); }
                // Build cycle sets from graphData.meta.cycles
                cycleNodeIds.clear();
                cycleLinkKeys.clear();
                if (graphData && graphData.meta && graphData.meta.cycles) {
                    for (var ci = 0; ci < graphData.meta.cycles.length; ci++) {
                        var cycle = graphData.meta.cycles[ci];
                        for (var cj = 0; cj < cycle.length; cj++) {
                            cycleNodeIds.add(cycle[cj]);
                            // Link from this node to the next in cycle (wrapping around)
                            var nextIdx = (cj + 1) % cycle.length;
                            cycleLinkKeys.add(cycle[cj] + '>' + cycle[nextIdx]);
                        }
                    }
                }
            }
            if (graph) {
                graph.nodeColor(graph.nodeColor());
                graph.nodeVal(graph.nodeVal());
                graph.linkColor(graph.linkColor());
                graph.linkWidth(function (link) {
                    if (showCycles) {
                        var srcId = typeof link.source === 'object' ? link.source.id : link.source;
                        var tgtId = typeof link.target === 'object' ? link.target.id : link.target;
                        if (cycleLinkKeys.has(srcId + '>' + tgtId)) return 2;
                    }
                    return highlightLinks.has(link) ? 1.5 : 0.3;
                });
                graph.nodeThreeObject(graph.nodeThreeObject());
            }
            saveViewState();
        });

        $('#btn-group-dirs').addEventListener('click', function () {
            toggleDirectoryGroups();
            saveViewState();
        });

        $('#btn-path-mode').addEventListener('click', function () {
            pathMode = !pathMode;
            $('#btn-path-mode').classList.toggle('active', pathMode);
            pathNodes = [];
            highlightedPath.nodes.clear();
            highlightedPath.links.clear();
            if (graph) {
                graph.nodeColor(graph.nodeColor())
                    .linkWidth(graph.linkWidth())
                    .linkColor(graph.linkColor())
                    .linkDirectionalParticles(graph.linkDirectionalParticles());
            }
            saveViewState();
        });

        $('#btn-labels').addEventListener('click', function () {
            showLabels = !showLabels;
            $('#btn-labels').classList.toggle('active', showLabels);
            if (graph) graph.nodeThreeObject(graph.nodeThreeObject());
            saveViewState();
        });

        $('#btn-recenter').addEventListener('click', function () {
            if (!graph) return;
            selectedNode = null;
            highlightNodes.clear();
            highlightLinks.clear();
            detailPanel.classList.add('collapsed');
            if (explodedNode) collapseExplosion();
            graph.zoomToFit(500, 50);
            graph.nodeColor(graph.nodeColor());
        });

        $('#heatmap-select').addEventListener('change', function (e) {
            setHeatmapMode(e.target.value);
            saveViewState();
        });

        // Community palette buttons
        var cpSelectAll = $('#community-select-all');
        var cpSelectNone = $('#community-select-none');
        var cpClose = $('#community-palette-close');
        if (cpSelectAll) {
            cpSelectAll.addEventListener('click', function () {
                for (var k in communityNames) activeCommunities.add(Number(k));
                buildCommunityList();
                if (graph) { graph.nodeColor(graph.nodeColor()); graph.linkColor(graph.linkColor()); graph.nodeThreeObject(graph.nodeThreeObject()); }
            });
        }
        if (cpSelectNone) {
            cpSelectNone.addEventListener('click', function () {
                activeCommunities.clear();
                buildCommunityList();
                if (graph) { graph.nodeColor(graph.nodeColor()); graph.linkColor(graph.linkColor()); graph.nodeThreeObject(graph.nodeThreeObject()); }
            });
        }
        if (cpClose) {
            cpClose.addEventListener('click', function () {
                hideCommunityPalette();
            });
        }

        // Community palette drag
        (function () {
            var palette = $('#community-palette');
            var header = palette ? palette.querySelector('.community-palette-header') : null;
            if (!header) return;
            var dragging = false;
            var offsetX = 0, offsetY = 0;

            header.addEventListener('mousedown', function (e) {
                if (e.target.tagName === 'BUTTON') return;
                dragging = true;
                var rect = palette.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                // Switch from right-anchored to left-anchored positioning
                palette.style.left = rect.left + 'px';
                palette.style.top = rect.top + 'px';
                palette.style.right = 'auto';
                e.preventDefault();
            });

            document.addEventListener('mousemove', function (e) {
                if (!dragging) return;
                var x = e.clientX - offsetX;
                var y = e.clientY - offsetY;
                // Clamp to viewport
                x = Math.max(0, Math.min(x, window.innerWidth - 60));
                y = Math.max(0, Math.min(y, window.innerHeight - 40));
                palette.style.left = x + 'px';
                palette.style.top = y + 'px';
            });

            document.addEventListener('mouseup', function () {
                dragging = false;
            });
        })();

        // ============================================================
        // Minimap — 2D top-down overview with camera viewport rectangle
        // ============================================================
        (function () {
            var container = $('#minimap');
            var canvas = $('#minimap-canvas');
            var header = container ? container.querySelector('.minimap-header') : null;
            if (!container || !canvas || !header) return;
            var ctx = canvas.getContext('2d');
            var PADDING = 12;

            // --- Drag logic ---
            var dragging = false;
            var offsetX = 0, offsetY = 0;
            header.addEventListener('mousedown', function (e) {
                if (e.target.tagName === 'BUTTON') return;
                dragging = true;
                var rect = container.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                container.style.left = rect.left + 'px';
                container.style.top = rect.top + 'px';
                container.style.right = 'auto';
                container.style.bottom = 'auto';
                e.preventDefault();
            });
            document.addEventListener('mousemove', function (e) {
                if (!dragging) return;
                var x = Math.max(0, Math.min(e.clientX - offsetX, window.innerWidth - 60));
                var y = Math.max(0, Math.min(e.clientY - offsetY, window.innerHeight - 40));
                container.style.left = x + 'px';
                container.style.top = y + 'px';
            });
            document.addEventListener('mouseup', function () { dragging = false; });

            // --- Helpers: camera-view projection with fixed centroid ---
            // Projects world positions onto the camera's screen plane
            // (right + up axes). Centroid and scale are computed in WORLD
            // space so they stay fixed across frames — only the rotation
            // changes, giving a clean full-360° rotation.
            function projectAll(nodes, w, h) {
                var cam = graph.camera();
                cam.updateMatrixWorld();
                var m = cam.matrixWorldInverse;

                // 1) World-space centroid (camera-independent, stable)
                var wcx = 0, wcy = 0, wcz = 0, count = 0;
                for (var i = 0; i < nodes.length; i++) {
                    var n = nodes[i];
                    if (n.x === undefined) continue;
                    wcx += n.x; wcy += n.y; wcz += n.z; count++;
                }
                if (count === 0) return null;
                wcx /= count; wcy /= count; wcz /= count;

                // 2) Max radius from centroid in world space (stable)
                var maxR = 0;
                for (var i = 0; i < nodes.length; i++) {
                    var n = nodes[i];
                    if (n.x === undefined) continue;
                    var dx = n.x - wcx, dy = n.y - wcy, dz = n.z - wcz;
                    var r = dx * dx + dy * dy + dz * dz;
                    if (r > maxR) maxR = r;
                }
                maxR = Math.sqrt(maxR) || 1;
                var halfSize = Math.min(w, h) / 2 - PADDING;
                var scale = halfSize / maxR;

                // 3) Project each node (relative to centroid) via camera rotation
                var pts = [];
                for (var i = 0; i < nodes.length; i++) {
                    var n = nodes[i];
                    if (n.x === undefined) continue;
                    var rx = n.x - wcx, ry = n.y - wcy, rz = n.z - wcz;
                    var u = m.elements[0] * rx + m.elements[4] * ry + m.elements[8] * rz;
                    var v = -(m.elements[1] * rx + m.elements[5] * ry + m.elements[9] * rz);
                    pts.push({ node: n, u: u, v: v });
                }

                // 4) Project camera target relative to centroid
                var ctrl = graph.controls();
                var target = ctrl.target;
                var trx = target.x - wcx, try_ = target.y - wcy, trz = target.z - wcz;
                var tu = m.elements[0] * trx + m.elements[4] * try_ + m.elements[8] * trz;
                var tv = -(m.elements[1] * trx + m.elements[5] * try_ + m.elements[9] * trz);

                return {
                    pts: pts, scale: scale,
                    cx: w / 2, cy: h / 2,
                    midU: 0, midV: 0,
                    targetU: tu, targetV: tv
                };
            }

            // --- Drag to pan the camera viewport ---
            var draggingViewport = false;
            var lastDragX = 0, lastDragY = 0;

            function handleMinimapDrag(e) {
                if (!draggingViewport || !graph) return;
                var dx = e.clientX - lastDragX;
                var dy = e.clientY - lastDragY;
                lastDragX = e.clientX;
                lastDragY = e.clientY;

                var nodes = graph.graphData().nodes;
                if (!nodes || nodes.length === 0) return;
                var p = projectAll(nodes, canvas.width, canvas.height);
                if (!p) return;

                // Minimap pixels → view-space units
                var pixelRatio = canvas.width / canvas.getBoundingClientRect().width;
                var du = dx * pixelRatio / p.scale;
                var dv = dy * pixelRatio / p.scale;

                // Convert view-space deltas back to world using camera's world matrix
                // column 0 = right vector, column 1 = up vector
                var cam = graph.camera();
                var mw = cam.matrixWorld;
                // du → right direction (col 0), dv → -up direction (col 1, negated because v was flipped)
                var worldDx = mw.elements[0] * du - mw.elements[4] * dv;
                var worldDy = mw.elements[1] * du - mw.elements[5] * dv;
                var worldDz = mw.elements[2] * du - mw.elements[6] * dv;

                var pos = cam.position;
                var ctrl = graph.controls();
                var target = ctrl.target;
                graph.cameraPosition(
                    { x: pos.x + worldDx, y: pos.y + worldDy, z: pos.z + worldDz },
                    { x: target.x + worldDx, y: target.y + worldDy, z: target.z + worldDz },
                    0
                );
            }

            canvas.addEventListener('mousedown', function (e) {
                if (!graph) return;
                draggingViewport = true;
                lastDragX = e.clientX;
                lastDragY = e.clientY;
                e.preventDefault();
            });

            // Handle drag on both canvas (while cursor is over it) and
            // document (when cursor leaves canvas during drag)
            canvas.addEventListener('mousemove', handleMinimapDrag);
            document.addEventListener('mousemove', function (e) {
                if (!draggingViewport) return;
                handleMinimapDrag(e);
            });

            document.addEventListener('mouseup', function () {
                draggingViewport = false;
            });

            // --- Render loop ---
            function renderMinimap() {
                requestAnimationFrame(renderMinimap);
                if (container.classList.contains('hidden') || !graph) return;

                var nodes = graph.graphData().nodes;
                if (!nodes || nodes.length === 0) return;

                var w = canvas.width;
                var h = canvas.height;
                ctx.clearRect(0, 0, w, h);
                ctx.fillStyle = '#0d1117';
                ctx.fillRect(0, 0, w, h);

                var p = projectAll(nodes, w, h);
                if (!p) return;

                // Draw nodes
                for (var j = 0; j < p.pts.length; j++) {
                    var pt = p.pts[j];
                    var px = p.cx + (pt.u - p.midU) * p.scale;
                    var py = p.cy + (pt.v - p.midV) * p.scale;
                    ctx.fillStyle = getNodeColor(pt.node);
                    ctx.beginPath();
                    ctx.arc(px, py, 2, 0, Math.PI * 2);
                    ctx.fill();
                }

                // Viewport rectangle centered on camera target
                try {
                    var cam = graph.camera();
                    var pos = cam.position;
                    var ctrl = graph.controls();
                    var target = ctrl.target || { x: 0, y: 0, z: 0 };
                    var dist = Math.sqrt(
                        (pos.x - target.x) * (pos.x - target.x) +
                        (pos.y - target.y) * (pos.y - target.y) +
                        (pos.z - target.z) * (pos.z - target.z)
                    ) || 500;
                    var fov = cam.fov || 75;
                    var aspect = cam.aspect || 1;
                    var halfH = dist * Math.tan((fov * Math.PI / 180) / 2);
                    var halfW = halfH * aspect;

                    // Camera target position in minimap space
                    var vpCx = p.cx + (p.targetU - p.midU) * p.scale;
                    var vpCy = p.cy + (p.targetV - p.midV) * p.scale;
                    var vpHalfW = halfW * p.scale;
                    var vpHalfH = halfH * p.scale;

                    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(vpCx - vpHalfW, vpCy - vpHalfH, vpHalfW * 2, vpHalfH * 2);
                } catch (ignored) { }
            }
            requestAnimationFrame(renderMinimap);
        })();

        $('#node-size-slider').addEventListener('input', function (e) {
            nodeSizeMultiplier = parseFloat(e.target.value);
            if (graph) graph.nodeVal(graph.nodeVal());
            saveViewState();
        });

        $('#spread-slider').addEventListener('input', function (e) {
            spreadMultiplier = parseFloat(e.target.value);
            if (graph) {
                applySpreadForces();
                graph.d3ReheatSimulation();
            }
            saveViewState();
        });

        $('#depth-slider').addEventListener('input', function (e) {
            focusDepth = parseInt(e.target.value);
            $('#depth-value').textContent = focusDepth;
            // Re-apply if already pinned or in impact mode
            if (impactMode) {
                computeTimelineImpact();
            } else if (pinnedNode) {
                if (blastMode) handleBlastRadius(pinnedNode, true);
                else handleNodeRightClick(pinnedNode, true);
            }
            saveViewState();
        });

        // ============================================================
        // Keyboard shortcuts
        // ============================================================
        var HEATMAP_MODES = ['off', 'complexity', 'fanIn', 'fanOut', 'loc', 'lastModified', 'community'];

        document.addEventListener('keydown', function (e) {
            // Ignore when typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
            if (!graph) return;

            switch (e.key.toLowerCase()) {
                case 'f':
                    // Fit-to-view
                    $('#btn-recenter').click();
                    break;
                case 'l':
                    // Toggle labels
                    $('#btn-labels').click();
                    break;
                case 'g':
                    // Toggle groups
                    $('#btn-group-dirs').click();
                    break;
                case 'h':
                    // Cycle heatmaps
                    var idx = HEATMAP_MODES.indexOf(heatmapMode);
                    var nextMode = HEATMAP_MODES[(idx + 1) % HEATMAP_MODES.length];
                    $('#heatmap-select').value = nextMode;
                    setHeatmapMode(nextMode);
                    saveViewState();
                    break;
                case 'p':
                    // Toggle path mode
                    $('#btn-path-mode').click();
                    break;
                case 'd':
                    // Toggle DAG mode
                    $('#btn-dag-mode').click();
                    break;
                case 'o':
                    // Toggle orphans
                    $('#btn-highlight-orphans').click();
                    break;
                case 'x':
                    // Toggle dead code
                    $('#btn-dead-code').click();
                    break;
                case 'c':
                    // Toggle cycles
                    $('#btn-cycles').click();
                    break;
                case 'i':
                    // Toggle impact mode (timeline)
                    if (timelineActive) toggleImpactMode();
                    break;
                case 'v':
                    // Toggle compare mode (timeline)
                    if (timelineBar && !timelineBar.classList.contains('hidden')) toggleCompareMode();
                    break;
                case '1': case '2': case '3': case '4': case '5':
                    // Set focus depth
                    focusDepth = parseInt(e.key);
                    $('#depth-slider').value = focusDepth;
                    $('#depth-value').textContent = focusDepth;
                    // Re-apply if already pinned or in impact mode
                    if (impactMode) {
                        computeTimelineImpact();
                    } else if (pinnedNode) {
                        if (blastMode) handleBlastRadius(pinnedNode, true);
                        else handleNodeRightClick(pinnedNode, true);
                    }
                    break;
                case 'arrowleft':
                    // Timeline: previous commit
                    if (timelineCommits.length > 0 && !timelinePrevBtn.disabled) {
                        e.preventDefault();
                        timelinePrevBtn.click();
                    }
                    break;
                case 'arrowright':
                    // Timeline: next commit
                    if (timelineCommits.length > 0 && !timelineNextBtn.disabled) {
                        e.preventDefault();
                        timelineNextBtn.click();
                    }
                    break;
                case 'escape':
                    // Reset: clear selection, pinned focus, path mode, heatmap
                    selectedNode = null;
                    multiSelectedNodes.clear();
                    multiSelectedLinks.clear();
                    highlightNodes.clear();
                    highlightLinks.clear();
                    clearPinnedFocus();
                    if (impactMode) {
                        impactMode = false;
                        if (timelineImpactBtn) timelineImpactBtn.classList.remove('active');
                    }
                    if (pathMode) {
                        pathMode = false;
                        $('#btn-path-mode').classList.remove('active');
                        pathNodes = [];
                        highlightedPath.nodes.clear();
                        highlightedPath.links.clear();
                    }
                    if (showOrphans) {
                        showOrphans = false;
                        $('#btn-highlight-orphans').classList.remove('active');
                    }
                    if (showDeadCode) {
                        showDeadCode = false;
                        $('#btn-dead-code').classList.remove('active');
                    }
                    if (showCycles) {
                        showCycles = false;
                        $('#btn-cycles').classList.remove('active');
                        cycleNodeIds.clear();
                        cycleLinkKeys.clear();
                    }
                    detailPanel.classList.add('collapsed');
                    if (explodedNode) collapseExplosion();
                    if (timelineActive) {
                        restoreHeadGraph();
                        timelineSlider.value = timelineSlider.max;
                        timelinePosition = parseInt(timelineSlider.max);
                        updateTimelineLabel();
                        updateTimelineButtons();
                    }
                    graph.nodeColor(graph.nodeColor())
                        .linkWidth(graph.linkWidth())
                        .linkColor(graph.linkColor())
                        .linkDirectionalParticles(graph.linkDirectionalParticles())
                        .nodeThreeObject(graph.nodeThreeObject());
                    break;
            }
        });
    }

    function applySpreadForces() {
        if (!graph) return;
        var charge = graph.d3Force('charge');
        if (charge) charge.strength(-30 * spreadMultiplier);
        var link = graph.d3Force('link');
        if (link) link.distance(30 * spreadMultiplier);
    }

    function filterGraphData(data) {
        var filteredNodes = [];
        for (var i = 0; i < data.nodes.length; i++) {
            var n = data.nodes[i];
            var langKey = n.language;
            if (langKey === 'c') langKey = n.extension === '.h' ? 'c-header' : 'c-source';
            if (!activeLanguages.has(langKey)) continue;
            // Directory filter: only keep files under checked dirs
            if (activeDirs.length === 0) continue; // nothing checked = nothing shown
            var inDir = false;
            for (var d = 0; d < activeDirs.length; d++) {
                if (n.path === activeDirs[d] || n.path.indexOf(activeDirs[d] + '/') === 0) {
                    inDir = true;
                    break;
                }
            }
            // Also keep root-level files (no directory) when all dirs are checked
            if (!inDir && n.path.indexOf('/') === -1) inDir = true;
            if (!inDir) continue;
            filteredNodes.push(n);
        }
        var nodeIds = new Set();
        for (var j = 0; j < filteredNodes.length; j++) nodeIds.add(filteredNodes[j].id);
        var filteredLinks = [];
        for (var k = 0; k < data.links.length; k++) {
            var l = data.links[k];
            var sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            var targetId = typeof l.target === 'object' ? l.target.id : l.target;
            if (nodeIds.has(sourceId) && nodeIds.has(targetId)) filteredLinks.push(l);
        }

        var result = { nodes: filteredNodes, links: filteredLinks };

        // Apply clustering if Groups mode is active
        if (showGroups) {
            result = buildClusteredData(result);
        }

        return result;
    }

    function applyFilters() {
        if (!graph || !graphData) return;
        graph.graphData(filterGraphData(graphData));
    }

    // ============================================================
    // Time Travel — Timeline Navigation
    // ============================================================
    function setupTimeline() {
        if (!timelineSlider || !timelinePrevBtn || !timelineNextBtn) return;

        // Update tooltip while dragging, navigate only on release
        timelineSlider.addEventListener('input', function () {
            // In compare mode, clamp blue (to) slider to not go before orange (from)
            if (timelineCompareMode && timelineFromSlider) {
                var curTo = parseInt(timelineSlider.value);
                var curFrom = parseInt(timelineFromSlider.value);
                if (curTo < curFrom) timelineSlider.value = curFrom;
            }
            updateTimelineLabel();
        });
        timelineSlider.addEventListener('change', function () {
            if (timelineCompareMode && timelineFromSlider) {
                var curTo = parseInt(timelineSlider.value);
                var curFrom = parseInt(timelineFromSlider.value);
                if (curTo < curFrom) timelineSlider.value = curFrom;
            }
            var pos = parseInt(timelineSlider.value);
            navigateToCommit(pos);
        });

        timelinePrevBtn.addEventListener('click', function () {
            var pos = parseInt(timelineSlider.value);
            var minPos = (timelineCompareMode && timelineFromSlider) ? parseInt(timelineFromSlider.value) : 0;
            if (pos > minPos) {
                timelineSlider.value = pos - 1;
                navigateToCommit(pos - 1);
            }
        });

        timelineNextBtn.addEventListener('click', function () {
            var pos = parseInt(timelineSlider.value);
            var max = parseInt(timelineSlider.max);
            if (pos < max) {
                timelineSlider.value = pos + 1;
                navigateToCommit(pos + 1);
            }
        });

        if (timelineImpactBtn) {
            timelineImpactBtn.addEventListener('click', function () {
                toggleImpactMode();
            });
        }

        // Compare mode button
        if (timelineCompareBtn) {
            timelineCompareBtn.addEventListener('click', function () {
                toggleCompareMode();
            });
        }

        // From-slider (compare mode)
        if (timelineFromSlider) {
            // Update tooltip while dragging, navigate only on release
            timelineFromSlider.addEventListener('input', function () {
                // Clamp orange (from) slider to not go after blue (to)
                var curFrom = parseInt(timelineFromSlider.value);
                var curTo = parseInt(timelineSlider.value);
                if (curFrom > curTo) timelineFromSlider.value = curTo;
                timelineFromPos = parseInt(timelineFromSlider.value);
                updateTimelineLabel();
            });
            timelineFromSlider.addEventListener('change', function () {
                var curFrom = parseInt(timelineFromSlider.value);
                var curTo = parseInt(timelineSlider.value);
                if (curFrom > curTo) timelineFromSlider.value = curTo;
                timelineFromPos = parseInt(timelineFromSlider.value);
                var toPos = parseInt(timelineSlider.value);
                navigateToCommit(toPos);
            });
        }

        // From-slider prev/next buttons (compare mode)
        if (timelineFromPrevBtn) {
            timelineFromPrevBtn.addEventListener('click', function () {
                if (!timelineFromSlider) return;
                var pos = parseInt(timelineFromSlider.value);
                if (pos > 0) {
                    timelineFromSlider.value = pos - 1;
                    timelineFromPos = pos - 1;
                    var toPos = parseInt(timelineSlider.value);
                    navigateToCommit(toPos);
                }
            });
        }
        if (timelineFromNextBtn) {
            timelineFromNextBtn.addEventListener('click', function () {
                if (!timelineFromSlider) return;
                var pos = parseInt(timelineFromSlider.value);
                var toPos = parseInt(timelineSlider.value);
                // Don't go past blue slider
                if (pos < toPos) {
                    timelineFromSlider.value = pos + 1;
                    timelineFromPos = pos + 1;
                    navigateToCommit(toPos);
                }
            });
        }

        // Timeline slider hover tooltip
        var sliderTip = document.createElement('div');
        sliderTip.id = 'timeline-slider-tip';
        sliderTip.className = 'hidden';
        document.body.appendChild(sliderTip);

        // Attach tooltip to the wrapper so it works on the full track, not just the thumb
        var sliderWrap = $('#timeline-slider-wrap') || timelineSlider.parentElement;
        function showSliderTip(e) {
            if (timelineCommits.length === 0) return;
            var rect = sliderWrap.getBoundingClientRect();
            var ratio = (e.clientX - rect.left) / rect.width;
            ratio = Math.max(0, Math.min(1, ratio));
            var maxPos = parseInt(timelineSlider.max);
            var pos = Math.round(ratio * maxPos);
            if (pos >= maxPos) {
                sliderTip.textContent = 'HEAD — Current state';
            } else {
                var commitIdx = (maxPos - 1) - pos;
                if (commitIdx >= 0 && commitIdx < timelineCommits.length) {
                    var c = timelineCommits[commitIdx];
                    var d = new Date(c.date);
                    sliderTip.textContent = d.toLocaleDateString() + ' — ' + c.message;
                } else {
                    sliderTip.textContent = '';
                }
            }
            sliderTip.classList.remove('hidden');
            var tipX = e.clientX - sliderTip.offsetWidth / 2;
            tipX = Math.max(4, Math.min(tipX, window.innerWidth - sliderTip.offsetWidth - 4));
            sliderTip.style.left = tipX + 'px';
            sliderTip.style.top = (rect.top - 32) + 'px';
        }
        sliderWrap.addEventListener('mousemove', showSliderTip);
        sliderWrap.addEventListener('mouseleave', function () {
            sliderTip.classList.add('hidden');
        });
    }

    function handleHistoryIndex(index) {
        timelineCommits = index.commits || [];
        timelineTotalCount = index.totalCommits || 0;
        timelineScannedCount = index.scannedCommits || 0;

        if (timelineCommits.length === 0) return;

        // Show timeline bar (only if on graph tab)
        if (activeTab !== 'graph') {
            timelineBar._wasVisible = true;
        } else {
            timelineBar.classList.remove('hidden');
        }
        document.body.classList.add('has-timeline');

        // Slider: 0 = oldest scanned, max = HEAD (current state)
        // We add +1 to max because the last position is HEAD (not a commit)
        var maxPos = timelineScannedCount;
        timelineSlider.min = 0;
        timelineSlider.max = maxPos;
        timelineSlider.value = maxPos; // start at HEAD
        timelinePosition = -1;

        // Sync from-slider
        if (timelineFromSlider) {
            timelineFromSlider.min = 0;
            timelineFromSlider.max = maxPos;
            timelineFromSlider.value = maxPos;
        }

        updateTimelineLabel();
        updateTimelineButtons();
        updateTimelineProgress();
    }

    function handleHistoryProgress(progress) {
        timelineScannedCount = progress.scanned;
        timelineTotalCount = progress.total;

        // Expand slider range as more commits are scanned
        var maxPos = timelineScannedCount;
        var currentVal = parseInt(timelineSlider.value);
        var wasAtHead = currentVal === parseInt(timelineSlider.max);
        timelineSlider.max = maxPos;
        if (wasAtHead) {
            timelineSlider.value = maxPos;
        }

        // Sync from-slider range
        if (timelineFromSlider) {
            var fromWasAtHead = parseInt(timelineFromSlider.value) === parseInt(timelineFromSlider.max);
            timelineFromSlider.max = maxPos;
            if (fromWasAtHead) {
                timelineFromSlider.value = maxPos;
            }
        }

        updateTimelineButtons();
        updateTimelineProgress();
    }

    function handleHistoryDelta(delta) {
        // Store the delta keyed by hash
        timelineDeltas[delta.hash] = delta;
        tchartCachedSnapshots = null; // invalidate timeline chart cache
        updateTimelineButtons();
    }

    function navigateToCommit(sliderPos) {
        var maxPos = parseInt(timelineSlider.max);

        if (sliderPos >= maxPos) {
            // In compare mode, HEAD is a valid "to" target — compute diff from fromPos to HEAD
            if (timelineCompareMode && timelineFromPos < maxPos) {
                timelinePosition = -1;
                timelineActive = true;
                // First compute the diff sets (before restoring, so they survive the refresh)
                computeCompareDiff(timelineFromPos, maxPos);
                // Now restore HEAD graph visuals (but don't clear diff sets)
                if (headGraphData && graph) {
                    restoreHeadGraphKeepDiff();
                }
                if (impactMode) computeTimelineImpact();
                updateTimelineLabel();
                updateTimelineButtons();
                return;
            }
            // Back to HEAD (no compare)
            timelinePosition = -1;
            timelineActive = false;
            timelineChangedNodes.clear();
            timelineAddedNodes.clear();
            timelineRemovedNodes.clear();
            timelineModifiedNodes.clear();
            timelineAddedLinks.clear();
            timelineRemovedLinks.clear();
            // Clear impact mode
            if (impactMode) {
                impactMode = false;
                if (timelineImpactBtn) timelineImpactBtn.classList.remove('active');
                clearPinnedFocus();
            }
            // Restore HEAD graph
            if (headGraphData && graph) {
                restoreHeadGraph();
            }
            updateTimelineLabel();
            updateTimelineButtons();
            return;
        }

        // sliderPos: 0 = oldest scanned commit, maxPos-1 = newest commit
        // commits array is newest first, so we need to reverse the index
        var commitIdx = (maxPos - 1) - sliderPos;
        if (commitIdx < 0 || commitIdx >= timelineCommits.length) return;

        var commit = timelineCommits[commitIdx];
        if (!commit) return;

        var delta = timelineDeltas[commit.hash];
        if (!delta) {
            // Delta not yet scanned — can't navigate here
            updateTimelineLabel();
            updateTimelineButtons();
            return;
        }

        timelinePosition = commitIdx;
        timelineActive = true;

        // Apply the cumulative state up to this commit
        applyCumulativeState(commitIdx);

        // Re-compute impact cascade if impact mode is active
        if (impactMode) {
            computeTimelineImpact();
        }

        updateTimelineLabel();
        updateTimelineButtons();
    }

    function applyCumulativeState(targetCommitIdx) {
        if (!headGraphData || !graph) return;

        // Start from HEAD graph and apply deltas backward
        // We need to reconstruct the graph at targetCommitIdx
        // by knowing what changed between HEAD and that commit.

        // Strategy: collect all files that were added/removed/modified
        // between HEAD and the target commit
        var removedAtTarget = new Set();   // files that don't exist at target (added after target)
        var addedAtTarget = new Set();     // files re-added at target (removed after target)
        var modifiedState = {};            // file id → DeltaNodeState at closest commit

        // Walk from newest commit (index 0) to targetCommitIdx
        // Each delta tells us what changed IN that commit (going forward in time)
        // Going backward: "added" in a commit means the file didn't exist before → remove it
        //                 "removed" in a commit means the file existed before → add it back
        //                 "modified" in a commit means the file was different before → use the delta state
        for (var i = 0; i <= targetCommitIdx; i++) {
            var commit = timelineCommits[i];
            var delta = timelineDeltas[commit.hash];
            if (!delta) continue;

            // Files added in this commit didn't exist before this commit
            // Since we're going backward, these should be removed
            for (var a = 0; a < delta.added.length; a++) {
                removedAtTarget.add(delta.added[a]);
                addedAtTarget.delete(delta.added[a]);
            }

            // Files removed in this commit existed before this commit
            // Since we're going backward, these should be present
            for (var r = 0; r < delta.removed.length; r++) {
                addedAtTarget.add(delta.removed[r]);
                removedAtTarget.delete(delta.removed[r]);
            }

            // Modified files: store their state at this commit
            // The delta contains the state AT this commit
            var modKeys = Object.keys(delta.modified);
            for (var m = 0; m < modKeys.length; m++) {
                modifiedState[modKeys[m]] = delta.modified[modKeys[m]];
            }
        }

        // Now build the new node/link set
        // Start from HEAD nodes
        var newNodes = [];
        var newLinks = [];
        var nodeIds = new Set();
        timelineChangedNodes.clear();
        timelineAddedNodes.clear();
        timelineRemovedNodes.clear();
        timelineModifiedNodes.clear();
        timelineAddedLinks.clear();
        timelineRemovedLinks.clear();

        // Keep HEAD nodes that aren't removed at target
        for (var ni = 0; ni < headGraphData.nodes.length; ni++) {
            var headNode = headGraphData.nodes[ni];
            if (removedAtTarget.has(headNode.id)) continue;

            // Check if this node was modified — apply the older state
            var mod = modifiedState[headNode.id];
            var graphNode = findNodeInGraph(headNode.id);
            var node;
            if (graphNode) {
                // Reuse the 3d node to preserve position
                node = graphNode;
            } else {
                node = Object.assign({}, headNode);
            }

            if (mod) {
                node.linesOfCode = mod.linesOfCode;
                node.complexity = mod.complexity;
                if (mod.symbols) node.symbols = mod.symbols;
                if (!timelineCompareMode) timelineChangedNodes.add(node.id);
            }
            nodeIds.add(node.id);
            newNodes.push(node);
        }

        // Grab the delta(s) to build colored diff sets
        // In compare mode, collect all deltas between fromIdx and targetIdx
        // In normal mode, just use the current commit's delta
        var diffStartIdx, diffEndIdx;
        if (timelineCompareMode) {
            var maxPos = parseInt(timelineSlider.max);
            var fromIdx = (maxPos - 1) - timelineFromPos;
            diffStartIdx = Math.min(fromIdx, targetCommitIdx);
            diffEndIdx = Math.max(fromIdx, targetCommitIdx);
        } else {
            diffStartIdx = targetCommitIdx;
            diffEndIdx = targetCommitIdx;
        }

        for (var di = diffStartIdx; di <= diffEndIdx; di++) {
            var diffCommit = timelineCommits[di];
            if (!diffCommit) continue;
            var diffDelta = timelineDeltas[diffCommit.hash];
            if (!diffDelta) continue;

            for (var ca = 0; ca < diffDelta.added.length; ca++) {
                var addedId = diffDelta.added[ca];
                timelineChangedNodes.add(addedId);
                timelineAddedNodes.add(addedId);
                timelineRemovedNodes.delete(addedId);
            }
            for (var cr = 0; cr < diffDelta.removed.length; cr++) {
                var removedId = diffDelta.removed[cr];
                timelineChangedNodes.add(removedId);
                timelineRemovedNodes.add(removedId);
                timelineAddedNodes.delete(removedId);
            }
            var cmk = Object.keys(diffDelta.modified);
            for (var cm = 0; cm < cmk.length; cm++) {
                var modId = cmk[cm];
                timelineChangedNodes.add(modId);
                if (!timelineAddedNodes.has(modId) && !timelineRemovedNodes.has(modId)) {
                    timelineModifiedNodes.add(modId);
                }
            }
        }

        // Build HEAD link key set for diff comparison
        var headLinkKeys = new Set();
        for (var hli = 0; hli < headGraphData.links.length; hli++) {
            var hl = headGraphData.links[hli];
            var hSrc = typeof hl.source === 'object' ? hl.source.id : hl.source;
            var hTgt = typeof hl.target === 'object' ? hl.target.id : hl.target;
            headLinkKeys.add(hSrc + '>' + hTgt);
        }

        // Rebuild links from HEAD links + modified state
        var newLinkKeys = new Set();
        for (var li = 0; li < headGraphData.links.length; li++) {
            var headLink = headGraphData.links[li];
            var srcId = typeof headLink.source === 'object' ? headLink.source.id : headLink.source;
            var tgtId = typeof headLink.target === 'object' ? headLink.target.id : headLink.target;
            if (nodeIds.has(srcId) && nodeIds.has(tgtId)) {
                // In compare mode, skip links unless both endpoints are changed
                if (timelineCompareMode && timelineChangedNodes.size > 0 &&
                    !(timelineChangedNodes.has(srcId) && timelineChangedNodes.has(tgtId))) {
                    newLinkKeys.add(srcId + '>' + tgtId);
                    continue;
                }
                newLinks.push({ source: srcId, target: tgtId, type: headLink.type, label: headLink.label || '' });
                newLinkKeys.add(srcId + '>' + tgtId);
            }
        }

        // Add links from modified states (for files whose imports changed)
        for (var modFile in modifiedState) {
            if (!nodeIds.has(modFile)) continue;
            var state = modifiedState[modFile];
            if (state.linksOut) {
                for (var lo = 0; lo < state.linksOut.length; lo++) {
                    var linkOut = state.linksOut[lo];
                    if (nodeIds.has(linkOut.target)) {
                        var lKey = modFile + '>' + linkOut.target;
                        // Check if this link already exists
                        if (!newLinkKeys.has(lKey)) {
                            newLinkKeys.add(lKey);
                            // In compare mode, skip links unless both endpoints are changed
                            if (timelineCompareMode && timelineChangedNodes.size > 0 &&
                                !(timelineChangedNodes.has(modFile) && timelineChangedNodes.has(linkOut.target))) {
                                continue;
                            }
                            newLinks.push({
                                source: modFile,
                                target: linkOut.target,
                                type: linkOut.type,
                                label: ''
                            });
                            // This link exists at target commit but not at HEAD → added
                            if (!headLinkKeys.has(lKey)) {
                                timelineAddedLinks.add(lKey);
                            }
                        }
                    }
                }
            }
        }

        // Links in HEAD but not in target graph → removed
        headLinkKeys.forEach(function (hk) {
            if (!newLinkKeys.has(hk)) {
                timelineRemovedLinks.add(hk);
            }
        });

        // Pin existing nodes so the layout doesn't restart
        for (var pi = 0; pi < newNodes.length; pi++) {
            var pn = newNodes[pi];
            if (pn.x !== undefined) { pn.fx = pn.x; pn.fy = pn.y; pn.fz = pn.z; }
        }

        // Update the graph — freeze simulation to prevent layout drift
        newLinks = filterLinksForCompare(newNodes, newLinks);
        graphData.nodes = newNodes;
        graphData.links = newLinks;
        graphData.meta.totalFiles = newNodes.length;
        graphData.meta.totalLinks = newLinks.length;

        var savedCooldown = graph.cooldownTicks();
        graph.cooldownTicks(0);
        graph.graphData({ nodes: newNodes, links: newLinks });
        graph.cooldownTicks(savedCooldown);
        refreshGraphVisuals();
    }

    // Filter links for compare mode: only keep links where both endpoints
    // are truly visible changed nodes (exist in nodes array AND are colored)
    function filterLinksForCompare(nodes, links) {
        if (!timelineCompareMode || timelineChangedNodes.size === 0) return links;
        var visibleIds = new Set();
        for (var i = 0; i < nodes.length; i++) {
            var nid = nodes[i].id;
            if (timelineAddedNodes.has(nid) || timelineRemovedNodes.has(nid) || timelineModifiedNodes.has(nid)) {
                visibleIds.add(nid);
            }
        }
        var filtered = [];
        for (var j = 0; j < links.length; j++) {
            var src = typeof links[j].source === 'object' ? links[j].source.id : links[j].source;
            var tgt = typeof links[j].target === 'object' ? links[j].target.id : links[j].target;
            if (visibleIds.has(src) && visibleIds.has(tgt)) {
                filtered.push(links[j]);
            }
        }
        return filtered;
    }

    function restoreHeadGraph() {
        if (!headGraphData || !graph) return;

        // Restore nodes (preserve positions for existing nodes)
        var newNodes = [];
        for (var i = 0; i < headGraphData.nodes.length; i++) {
            var headNode = headGraphData.nodes[i];
            var existing = findNodeInGraph(headNode.id);
            if (existing) {
                // Restore HEAD properties but keep position
                existing.linesOfCode = headNode.linesOfCode;
                existing.complexity = headNode.complexity;
                existing.symbols = headNode.symbols;
                existing.fanIn = headNode.fanIn;
                existing.fanOut = headNode.fanOut;
                existing.deadExports = headNode.deadExports;
                existing.cycleIds = headNode.cycleIds;
                newNodes.push(existing);
            } else {
                newNodes.push(Object.assign({}, headNode));
            }
        }

        // Deep-copy links (source/target may have been mutated to objects)
        var restoredLinks = [];
        for (var rl = 0; rl < headGraphData.links.length; rl++) {
            var hl = headGraphData.links[rl];
            restoredLinks.push({
                source: typeof hl.source === 'object' ? hl.source.id : hl.source,
                target: typeof hl.target === 'object' ? hl.target.id : hl.target,
                type: hl.type, label: hl.label || ''
            });
        }

        // Pin nodes
        for (var rp = 0; rp < newNodes.length; rp++) {
            var rn = newNodes[rp];
            if (rn.x !== undefined) { rn.fx = rn.x; rn.fy = rn.y; rn.fz = rn.z; }
        }

        graphData.nodes = newNodes;
        graphData.links = restoredLinks;
        graphData.meta = JSON.parse(JSON.stringify(headGraphData.meta));

        graph.graphData({ nodes: newNodes, links: restoredLinks });
        timelineChangedNodes.clear();
        timelineAddedNodes.clear();
        timelineRemovedNodes.clear();
        timelineModifiedNodes.clear();
        timelineAddedLinks.clear();
        timelineRemovedLinks.clear();
        refreshGraphVisuals();

        // Unpin to let simulation settle (back to normal view)
        setTimeout(function () {
            var d = graph.graphData();
            for (var ui = 0; ui < d.nodes.length; ui++) {
                delete d.nodes[ui].fx; delete d.nodes[ui].fy; delete d.nodes[ui].fz;
            }
        }, 200);
    }

    // Like restoreHeadGraph but preserves the timeline diff sets (for compare mode at HEAD)
    function restoreHeadGraphKeepDiff() {
        if (!headGraphData || !graph) return;

        var newNodes = [];
        for (var i = 0; i < headGraphData.nodes.length; i++) {
            var headNode = headGraphData.nodes[i];
            var existing = findNodeInGraph(headNode.id);
            if (existing) {
                existing.linesOfCode = headNode.linesOfCode;
                existing.complexity = headNode.complexity;
                existing.symbols = headNode.symbols;
                existing.fanIn = headNode.fanIn;
                existing.fanOut = headNode.fanOut;
                existing.deadExports = headNode.deadExports;
                existing.cycleIds = headNode.cycleIds;
                newNodes.push(existing);
            } else {
                newNodes.push(Object.assign({}, headNode));
            }
        }

        var restoredLinks = [];
        for (var rl = 0; rl < headGraphData.links.length; rl++) {
            var hl = headGraphData.links[rl];
            var rlSrc = typeof hl.source === 'object' ? hl.source.id : hl.source;
            var rlTgt = typeof hl.target === 'object' ? hl.target.id : hl.target;
            // In compare mode, only include links where both endpoints are changed
            if (timelineCompareMode && timelineChangedNodes.size > 0 &&
                !(timelineChangedNodes.has(rlSrc) && timelineChangedNodes.has(rlTgt))) continue;
            restoredLinks.push({
                source: rlSrc, target: rlTgt,
                type: hl.type, label: hl.label || ''
            });
        }

        for (var rp = 0; rp < newNodes.length; rp++) {
            var rn = newNodes[rp];
            if (rn.x !== undefined) { rn.fx = rn.x; rn.fy = rn.y; rn.fz = rn.z; }
        }

        restoredLinks = filterLinksForCompare(newNodes, restoredLinks);

        graphData.nodes = newNodes;
        graphData.links = restoredLinks;
        graphData.meta = JSON.parse(JSON.stringify(headGraphData.meta));

        var savedCooldown2 = graph.cooldownTicks();
        graph.cooldownTicks(0);
        graph.graphData({ nodes: newNodes, links: restoredLinks });
        graph.cooldownTicks(savedCooldown2);
        // Do NOT clear diff sets — they are pre-computed by computeCompareDiff
        refreshGraphVisuals();
    }

    function findNodeInGraph(id) {
        if (!graph) return null;
        var data = graph.graphData();
        for (var i = 0; i < data.nodes.length; i++) {
            if (data.nodes[i].id === id) return data.nodes[i];
        }
        return null;
    }

    // Compute diff sets between two slider positions without rebuilding the graph
    // Used when "to" is HEAD — the graph is already at HEAD, we just color the diffs
    function computeCompareDiff(fromPos, toPos) {
        var maxPos = parseInt(timelineSlider.max);
        timelineChangedNodes.clear();
        timelineAddedNodes.clear();
        timelineRemovedNodes.clear();
        timelineModifiedNodes.clear();
        timelineAddedLinks.clear();
        timelineRemovedLinks.clear();

        // Convert slider positions to commit indexes
        // Walk deltas from the "from" commit to the "to" commit
        var startIdx = Math.min((maxPos - 1) - fromPos, (maxPos - 1) - toPos);
        var endIdx = Math.max((maxPos - 1) - fromPos, (maxPos - 1) - toPos);
        if (startIdx < 0) startIdx = 0;

        for (var di = startIdx; di <= endIdx; di++) {
            var diffCommit = timelineCommits[di];
            if (!diffCommit) continue;
            var diffDelta = timelineDeltas[diffCommit.hash];
            if (!diffDelta) continue;

            for (var ca = 0; ca < diffDelta.added.length; ca++) {
                var addedId = diffDelta.added[ca];
                timelineChangedNodes.add(addedId);
                timelineAddedNodes.add(addedId);
                timelineRemovedNodes.delete(addedId);
            }
            for (var cr = 0; cr < diffDelta.removed.length; cr++) {
                var removedId = diffDelta.removed[cr];
                timelineChangedNodes.add(removedId);
                timelineRemovedNodes.add(removedId);
                timelineAddedNodes.delete(removedId);
            }
            var cmk = Object.keys(diffDelta.modified);
            for (var cm = 0; cm < cmk.length; cm++) {
                var modId = cmk[cm];
                timelineChangedNodes.add(modId);
                if (!timelineAddedNodes.has(modId) && !timelineRemovedNodes.has(modId)) {
                    timelineModifiedNodes.add(modId);
                }
            }
        }

        refreshGraphVisuals();
    }

    function updateTimelineLabel() {
        var maxPos = parseInt(timelineSlider.max);
        var pos = parseInt(timelineSlider.value);

        if (timelineCompareMode) {
            // Show "from → to" in compare mode
            var fromPos = parseInt(timelineFromSlider.value);
            var fromLabel, toLabel;

            if (fromPos >= maxPos) {
                fromLabel = 'HEAD';
            } else {
                var fromIdx = (maxPos - 1) - fromPos;
                fromLabel = (fromIdx >= 0 && fromIdx < timelineCommits.length)
                    ? timelineCommits[fromIdx].hash.substring(0, 7) : '?';
            }

            if (pos >= maxPos) {
                toLabel = 'HEAD';
            } else {
                var toIdx = (maxPos - 1) - pos;
                toLabel = (toIdx >= 0 && toIdx < timelineCommits.length)
                    ? timelineCommits[toIdx].hash.substring(0, 7) : '?';
            }

            $('#timeline-hash').textContent = fromLabel + ' → ' + toLabel;
            var diffCount = timelineAddedNodes.size + timelineRemovedNodes.size + timelineModifiedNodes.size;
            $('#timeline-message').textContent = diffCount > 0
                ? '+' + timelineAddedNodes.size + ' / −' + timelineRemovedNodes.size + ' / ~' + timelineModifiedNodes.size
                : 'No changes';
            $('#timeline-date').textContent = '';
            return;
        }

        if (pos >= maxPos) {
            // HEAD
            $('#timeline-hash').textContent = 'HEAD';
            $('#timeline-message').textContent = 'Current state';
            $('#timeline-date').textContent = '';
        } else {
            var commitIdx = (maxPos - 1) - pos;
            if (commitIdx >= 0 && commitIdx < timelineCommits.length) {
                var commit = timelineCommits[commitIdx];
                $('#timeline-hash').textContent = commit.hash.substring(0, 7);
                var diffSummary = '';
                if (timelineActive && timelineChangedNodes.size > 0) {
                    diffSummary = ' (+' + timelineAddedNodes.size + ' −' + timelineRemovedNodes.size + ' ~' + timelineModifiedNodes.size + ')';
                }
                $('#timeline-message').textContent = commit.message + diffSummary;
                var d = new Date(commit.date);
                $('#timeline-date').textContent = d.toLocaleDateString();
            }
        }
    }

    function updateTimelineButtons() {
        var pos = parseInt(timelineSlider.value);
        var max = parseInt(timelineSlider.max);

        // Can go back (prev) if not at 0 and the target has a delta
        var canPrev = pos > 0;
        if (canPrev) {
            var prevCommitIdx = (max - 1) - (pos - 1);
            if (prevCommitIdx >= 0 && prevCommitIdx < timelineCommits.length) {
                var prevHash = timelineCommits[prevCommitIdx].hash;
                if (!timelineDeltas[prevHash]) canPrev = false;
            }
        }
        timelinePrevBtn.disabled = !canPrev;

        // Can always go forward (next) as long as not at max
        timelineNextBtn.disabled = pos >= max;
    }

    function updateTimelineProgress() {
        var progressEl = $('#timeline-progress');
        var textEl = $('#timeline-progress-text');
        if (timelineScannedCount < timelineTotalCount) {
            progressEl.classList.remove('hidden');
            textEl.textContent = '⏳ ' + timelineScannedCount + '/' + timelineTotalCount;
        } else {
            progressEl.classList.add('hidden');
        }
    }

    // ============================================================
    // File Explorer
    // ============================================================
    function setupExplorer() {
        if (!toggleExplorerBtn) return;
        toggleExplorerBtn.addEventListener('click', function () {
            showExplorer = !showExplorer;
            if (showExplorer) {
                explorerPanel.classList.remove('collapsed');
                toggleExplorerBtn.classList.add('active');
            } else {
                explorerPanel.classList.add('collapsed');
                toggleExplorerBtn.classList.remove('active');
            }
            saveViewState();
        });

        var explorerAllBtn = $('#explorer-all');
        var explorerNoneBtn = $('#explorer-none');
        if (explorerAllBtn) {
            explorerAllBtn.addEventListener('click', function () {
                activeDirs = [];
                var rootKeys = Object.keys(fileTree.children);
                for (var i = 0; i < rootKeys.length; i++) {
                    if (fileTree.children[rootKeys[i]].type === 'dir') {
                        activeDirs.push(fileTree.children[rootKeys[i]].path);
                    }
                }
                updateExplorerCheckboxes();
                applyFilters();
            });
        }
        if (explorerNoneBtn) {
            explorerNoneBtn.addEventListener('click', function () {
                activeDirs = [];
                updateExplorerCheckboxes();
                applyFilters();
            });
        }
    }

    function buildExplorerTree(nodes) {
        fileTree = { name: 'root', type: 'dir', children: {}, path: '' };

        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            var parts = node.path.split('/');
            var current = fileTree;
            var currentPath = '';

            for (var j = 0; j < parts.length; j++) {
                var part = parts[j];
                var isFile = (j === parts.length - 1);
                currentPath = currentPath ? currentPath + '/' + part : part;

                if (!current.children[part]) {
                    current.children[part] = {
                        name: part,
                        type: isFile ? 'file' : 'dir',
                        path: currentPath,
                        node: isFile ? node : null,
                        children: {}
                    };
                }
                current = current.children[part];
            }
        }

        // Default: all top-level dirs checked (visible)
        activeDirs = [];
        var rootKeys = Object.keys(fileTree.children);
        for (var k = 0; k < rootKeys.length; k++) {
            if (fileTree.children[rootKeys[k]].type === 'dir') {
                activeDirs.push(fileTree.children[rootKeys[k]].path);
            }
        }

        renderExplorerTree();
    }

    function renderExplorerTree() {
        if (!explorerTree) return;
        explorerTree.innerHTML = '';
        var rootFragment = document.createDocumentFragment();

        var keys = Object.keys(fileTree.children).sort(function (a, b) {
            var aObj = fileTree.children[a];
            var bObj = fileTree.children[b];
            if (aObj.type === 'dir' && bObj.type === 'file') return -1;
            if (aObj.type === 'file' && bObj.type === 'dir') return 1;
            return a.localeCompare(b);
        });

        for (var i = 0; i < keys.length; i++) {
            rootFragment.appendChild(createTreeNode(fileTree.children[keys[i]], 0));
        }

        explorerTree.appendChild(rootFragment);
    }

    function createTreeNode(item, depth) {
        var container = document.createElement('div');

        var nodeEl = document.createElement('div');
        nodeEl.className = 'tree-node';
        nodeEl.style.paddingLeft = (12 + depth * 16) + 'px';

        var icon = document.createElement('span');
        icon.className = 'tree-icon';

        if (item.type === 'dir') {
            icon.textContent = '📁';
            nodeEl.dataset.expanded = 'false';

            // Checkbox for directory filtering
            var cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'tree-dir-checkbox';
            cb.dataset.dirPath = item.path;
            cb.title = 'Show/hide files in ' + item.name;
            cb.checked = activeDirs.indexOf(item.path) !== -1;
            cb.addEventListener('click', function (e) {
                e.stopPropagation();
            });
            cb.addEventListener('change', function () {
                var idx = activeDirs.indexOf(item.path);
                if (cb.checked && idx === -1) {
                    activeDirs.push(item.path);
                } else if (!cb.checked && idx !== -1) {
                    activeDirs.splice(idx, 1);
                }
                applyFilters();
            });
            nodeEl.appendChild(cb);
        } else {
            icon.textContent = LANGUAGE_ICONS[item.node.language] || '📄';
            nodeEl.dataset.nodeId = item.node.id;
        }

        var label = document.createElement('span');
        label.className = 'tree-label';
        label.textContent = item.name;

        nodeEl.appendChild(icon);
        nodeEl.appendChild(label);
        container.appendChild(nodeEl);

        if (item.type === 'dir') {
            var childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children collapsed';

            var keys = Object.keys(item.children).sort(function (a, b) {
                var aObj = item.children[a];
                var bObj = item.children[b];
                if (aObj.type === 'dir' && bObj.type === 'file') return -1;
                if (aObj.type === 'file' && bObj.type === 'dir') return 1;
                return a.localeCompare(b);
            });

            for (var i = 0; i < keys.length; i++) {
                childrenContainer.appendChild(createTreeNode(item.children[keys[i]], depth + 1));
            }
            container.appendChild(childrenContainer);

            nodeEl.addEventListener('click', function (e) {
                e.stopPropagation();
                var isExpanded = nodeEl.dataset.expanded === 'true';
                nodeEl.dataset.expanded = !isExpanded;
                icon.textContent = isExpanded ? '📁' : '📂';
                if (isExpanded) childrenContainer.classList.add('collapsed');
                else childrenContainer.classList.remove('collapsed');
            });
        } else {
            // Collect symbols (functions + methods) for this file
            var syms = [];
            if (item.node.symbols) {
                if (item.node.symbols.functions) {
                    for (var sf = 0; sf < item.node.symbols.functions.length; sf++) {
                        syms.push(item.node.symbols.functions[sf]);
                    }
                }
                if (item.node.symbols.methods) {
                    for (var sm = 0; sm < item.node.symbols.methods.length; sm++) {
                        syms.push(item.node.symbols.methods[sm]);
                    }
                }
            }

            var symContainer = null;
            var symToggle = null;
            if (syms.length > 0) {
                // Sort by line number
                syms.sort(function (a, b) { return (a.line || 0) - (b.line || 0); });

                symToggle = document.createElement('span');
                symToggle.className = 'tree-sym-toggle';
                symToggle.textContent = '▶';
                symToggle.title = syms.length + ' function' + (syms.length > 1 ? 's' : '');
                nodeEl.insertBefore(symToggle, icon);

                symContainer = document.createElement('div');
                symContainer.className = 'tree-children tree-symbols collapsed';

                for (var si = 0; si < syms.length; si++) {
                    (function (sym) {
                        var symEl = document.createElement('div');
                        symEl.className = 'tree-node tree-sym-node';
                        symEl.style.paddingLeft = (12 + (depth + 1) * 16) + 'px';

                        var symIcon = document.createElement('span');
                        symIcon.className = 'tree-icon tree-sym-icon';
                        symIcon.textContent = sym.type === 'method' ? 'ƒ' : 'ƒ';

                        var symLabel = document.createElement('span');
                        symLabel.className = 'tree-label tree-sym-label';
                        symLabel.textContent = sym.name + (sym.params ? '()' : '');
                        symLabel.title = sym.name + (sym.params || '()') + (sym.line ? ' — line ' + sym.line : '');

                        symEl.appendChild(symIcon);
                        symEl.appendChild(symLabel);

                        symEl.addEventListener('click', function (e) {
                            e.stopPropagation();
                            vscode.postMessage({
                                type: 'openFile',
                                payload: { path: item.node.path, line: sym.line || 1 }
                            });
                        });

                        symContainer.appendChild(symEl);
                    })(syms[si]);
                }

                container.appendChild(symContainer);

                symToggle.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var isOpen = symToggle.dataset.expanded === 'true';
                    symToggle.dataset.expanded = !isOpen;
                    if (isOpen) symContainer.classList.add('collapsed');
                    else symContainer.classList.remove('collapsed');
                });
            }

            nodeEl.addEventListener('click', function (e) {
                e.stopPropagation();
                if (item.node) {
                    handleNodeClick(item.node);
                    updateExplorerSelection();
                }
            });
            // Double-click: open in editor
            nodeEl.addEventListener('dblclick', function (e) {
                e.stopPropagation();
                if (item.node) {
                    vscode.postMessage({ type: 'openFile', payload: { path: item.node.path } });
                }
            });
        }

        return container;
    }

    function updateExplorerCheckboxes() {
        if (!explorerTree) return;
        var checkboxes = explorerTree.querySelectorAll('.tree-dir-checkbox');
        for (var i = 0; i < checkboxes.length; i++) {
            checkboxes[i].checked = activeDirs.indexOf(checkboxes[i].dataset.dirPath) !== -1;
        }
    }

    function updateExplorerSelection() {
        if (!explorerTree) return;
        var nodes = explorerTree.querySelectorAll('.tree-node');
        for (var i = 0; i < nodes.length; i++) {
            nodes[i].classList.remove('selected');
            if (selectedNode && nodes[i].dataset.nodeId === selectedNode.id) {
                nodes[i].classList.add('selected');

                var parent = nodes[i].parentElement;
                while (parent && parent !== explorerTree) {
                    if (parent.classList.contains('tree-children')) {
                        parent.classList.remove('collapsed');
                        var dirNode = parent.previousElementSibling;
                        if (dirNode && dirNode.classList.contains('tree-node')) {
                            dirNode.dataset.expanded = 'true';
                            dirNode.querySelector('.tree-icon').textContent = '📂';
                        }
                    }
                    parent = parent.parentElement;
                }

                nodes[i].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    // ============================================================
    // Tabs
    // ============================================================
    function setupTabs() {
        var tabBtns = document.querySelectorAll('.tab-btn');
        for (var i = 0; i < tabBtns.length; i++) {
            tabBtns[i].addEventListener('click', function () {
                switchTab(this.dataset.tab);
            });
        }
        setupTableInteractions();
        setupTreemap();
        setupDSM();
        setupChord();
        setupTimelineChart();
    }

    function switchTab(tabName) {
        if (tabName === activeTab) return;
        var prevTab = activeTab;
        activeTab = tabName;

        // Update buttons
        var tabBtns = document.querySelectorAll('.tab-btn');
        for (var i = 0; i < tabBtns.length; i++) {
            tabBtns[i].classList.toggle('active', tabBtns[i].dataset.tab === tabName);
        }

        // Update content panels
        var contents = document.querySelectorAll('.tab-content');
        for (var i = 0; i < contents.length; i++) {
            contents[i].classList.toggle('active', contents[i].dataset.tab === tabName);
        }

        // Show/hide graph-only UI elements
        var filterBar = $('#filter-bar');
        var timeBar = $('#timeline-bar');
        var overlays = ['#heatmap-legend', '#community-palette', '#minimap', '#tooltip'];

        if (tabName !== 'graph') {
            // Leaving graph — hide overlays, filter bar, timeline
            // Save visibility state only when leaving the graph tab
            if (prevTab === 'graph') {
                if (filterBar) filterBar._wasVisible = filterBar.style.display !== 'none';
                if (timeBar) timeBar._wasVisible = !timeBar.classList.contains('hidden');
                for (var i = 0; i < overlays.length; i++) {
                    var el = $(overlays[i]);
                    if (el) el._wasVisible = !el.classList.contains('hidden');
                }
            }
            // Always ensure graph-only UI is hidden on non-graph tabs
            if (filterBar) filterBar.style.display = 'none';
            if (timeBar) timeBar.classList.add('hidden');
            for (var i = 0; i < overlays.length; i++) {
                var el = $(overlays[i]);
                if (el) el.classList.add('hidden');
            }
        } else {
            // Returning to graph — restore everything
            if (filterBar && filterBar._wasVisible !== false) filterBar.style.display = '';
            if (timeBar && timeBar._wasVisible) {
                timeBar.classList.remove('hidden');
            }
            for (var i = 0; i < overlays.length; i++) {
                var el = $(overlays[i]);
                if (el && el._wasVisible) {
                    el.classList.remove('hidden');
                }
            }
        }

        // Pause/resume WebGL — always pause the inactive graph
        if (tabName === 'graph') {
            resumeGraph();
        } else {
            pauseGraph();
        }

        // Render tab content
        if (tabName === 'metrics') renderMetrics();
        if (tabName === 'treemap') renderTreemap();
        if (tabName === 'dsm') renderDSM();
        if (tabName === 'chord') renderChord();
        if (tabName === 'timeline') renderTimelineChart();
        if (tabName === 'table') renderTable();
    }

    function pauseGraph() {
        if (graphPaused || !graph) return;
        graphPaused = true;
        graph.pauseAnimation();
    }

    function resumeGraph() {
        if (!graphPaused || !graph) return;
        graphPaused = false;
        graph.resumeAnimation();
    }

    // ============================================================
    // Metrics View
    // ============================================================
    function renderMetrics() {
        var container = $('#metrics-view');
        if (!container || !graphData) return;

        var nodes = graphData.nodes || [];
        var links = graphData.links || [];

        // Aggregate stats
        var totalFiles = nodes.length;
        var totalLoc = 0;
        var totalComplexity = 0;
        var maxComplexity = 0;
        var maxComplexityFile = '';
        var maxFanIn = 0;
        var maxFanInFile = '';
        var maxFanOut = 0;
        var maxFanOutFile = '';
        var maxLoc = 0;
        var maxLocFile = '';
        var langCounts = {};
        var langLoc = {};
        var folderCounts = {};
        var folderLoc = {};

        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            var loc = n.linesOfCode || 0;
            var cx = n.complexity || 0;
            totalLoc += loc;
            totalComplexity += cx;
            if (cx > maxComplexity) { maxComplexity = cx; maxComplexityFile = n.id; }
            if ((n.fanIn || 0) > maxFanIn) { maxFanIn = n.fanIn; maxFanInFile = n.id; }
            if ((n.fanOut || 0) > maxFanOut) { maxFanOut = n.fanOut; maxFanOutFile = n.id; }
            if (loc > maxLoc) { maxLoc = loc; maxLocFile = n.id; }
            var lang = n.language || 'unknown';
            langCounts[lang] = (langCounts[lang] || 0) + 1;
            langLoc[lang] = (langLoc[lang] || 0) + loc;
            var folder = n.group || '/';
            folderCounts[folder] = (folderCounts[folder] || 0) + 1;
            folderLoc[folder] = (folderLoc[folder] || 0) + loc;
        }

        var avgComplexity = totalFiles > 0 ? (totalComplexity / totalFiles).toFixed(1) : 0;

        // Build HTML
        var html = '';

        // Summary cards
        html += '<div class="metrics-grid">';
        html += metricCard('Files', totalFiles, '');
        html += metricCard('Total LOC', totalLoc.toLocaleString(), maxLocFile ? 'Max: ' + shortName(maxLocFile) + ' (' + maxLoc + ')' : '');
        html += metricCard('Links', links.length, '');
        html += metricCard('Avg Complexity', avgComplexity, maxComplexityFile ? 'Max: ' + shortName(maxComplexityFile) + ' (' + maxComplexity + ')' : '');
        html += metricCard('Max Fan-in', maxFanIn, maxFanInFile ? shortName(maxFanInFile) : '');
        html += metricCard('Max Fan-out', maxFanOut, maxFanOutFile ? shortName(maxFanOutFile) : '');
        html += '</div>';

        // LOC by language
        html += '<div class="metrics-section"><h3>Lines of Code by Language</h3>';
        html += buildBarChart(langLoc, LANGUAGE_COLORS, maxLoc);
        html += '</div>';

        // Files by language
        html += '<div class="metrics-section"><h3>Files by Language</h3>';
        html += buildBarChart(langCounts, LANGUAGE_COLORS, totalFiles);
        html += '</div>';

        // Top 10 largest files
        var sorted = nodes.slice().sort(function (a, b) { return (b.linesOfCode || 0) - (a.linesOfCode || 0); });
        html += '<div class="metrics-section"><h3>Top 10 Largest Files</h3>';
        html += buildFileBarChart(sorted.slice(0, 10), 'linesOfCode', maxLoc);
        html += '</div>';

        // Top 10 most complex files
        var sortedCx = nodes.slice().sort(function (a, b) { return (b.complexity || 0) - (a.complexity || 0); });
        html += '<div class="metrics-section"><h3>Top 10 Most Complex Files</h3>';
        html += buildFileBarChart(sortedCx.slice(0, 10), 'complexity', maxComplexity);
        html += '</div>';

        // Top 10 highest fan-in
        var sortedFi = nodes.slice().sort(function (a, b) { return (b.fanIn || 0) - (a.fanIn || 0); });
        html += '<div class="metrics-section"><h3>Top 10 Highest Fan-in (Most Depended On)</h3>';
        html += buildFileBarChart(sortedFi.slice(0, 10), 'fanIn', maxFanIn);
        html += '</div>';

        // LOC by folder (top 15)
        var folderEntries = Object.keys(folderLoc).map(function (k) { return { key: k, value: folderLoc[k] }; });
        folderEntries.sort(function (a, b) { return b.value - a.value; });
        var folderObj = {};
        var folderMax = 0;
        for (var i = 0; i < Math.min(folderEntries.length, 15); i++) {
            folderObj[folderEntries[i].key] = folderEntries[i].value;
            if (folderEntries[i].value > folderMax) folderMax = folderEntries[i].value;
        }
        html += '<div class="metrics-section"><h3>LOC by Folder (Top 15)</h3>';
        html += buildBarChart(folderObj, {}, folderMax);
        html += '</div>';

        container.innerHTML = html;
    }

    function metricCard(title, value, sub) {
        return '<div class="metric-card">' +
            '<div class="metric-card-title">' + title + '</div>' +
            '<div class="metric-card-value">' + value + '</div>' +
            (sub ? '<div class="metric-card-sub">' + sub + '</div>' : '') +
            '</div>';
    }

    function shortName(id) {
        if (!id) return '';
        var parts = id.split('/');
        return parts[parts.length - 1];
    }

    function buildBarChart(dataObj, colorMap, maxVal) {
        var html = '<div class="metrics-bar-chart">';
        var keys = Object.keys(dataObj).sort(function (a, b) { return dataObj[b] - dataObj[a]; });
        for (var i = 0; i < keys.length; i++) {
            var k = keys[i];
            var v = dataObj[k];
            var pct = maxVal > 0 ? (v / maxVal * 100) : 0;
            var color = colorMap[k] || 'var(--aura-accent)';
            html += '<div class="metrics-bar-row">' +
                '<span class="metrics-bar-label">' + escapeHtml(k) + '</span>' +
                '<div class="metrics-bar-track"><div class="metrics-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
                '<span class="metrics-bar-value">' + v.toLocaleString() + '</span>' +
                '</div>';
        }
        html += '</div>';
        return html;
    }

    function buildFileBarChart(fileNodes, metric, maxVal) {
        var html = '<div class="metrics-bar-chart">';
        for (var i = 0; i < fileNodes.length; i++) {
            var n = fileNodes[i];
            var v = n[metric] || 0;
            var pct = maxVal > 0 ? (v / maxVal * 100) : 0;
            var color = LANGUAGE_COLORS[n.language] || 'var(--aura-accent)';
            html += '<div class="metrics-bar-row">' +
                '<span class="metrics-bar-label" title="' + escapeHtml(n.id) + '">' + escapeHtml(shortName(n.id)) + '</span>' +
                '<div class="metrics-bar-track"><div class="metrics-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
                '<span class="metrics-bar-value">' + v.toLocaleString() + '</span>' +
                '</div>';
        }
        html += '</div>';
        return html;
    }

    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ============================================================
    // Treemap View
    // ============================================================
    var treemapZoomPath = ''; // '' = root
    var treemapSizeMetric = 'linesOfCode';
    var treemapColorMetric = 'complexity';
    var treemapTooltipEl = null;
    var treemapRenderedW = 0;
    var treemapRenderedH = 0;

    function setupTreemap() {
        var sizeSelect = $('#treemap-size-metric');
        var colorSelect = $('#treemap-color-metric');
        if (sizeSelect) sizeSelect.addEventListener('change', function () {
            treemapSizeMetric = this.value;
            treemapRenderedW = 0; treemapRenderedH = 0; // force full re-render
            renderTreemap();
        });
        if (colorSelect) colorSelect.addEventListener('change', function () {
            treemapColorMetric = this.value;
            treemapRenderedW = 0; treemapRenderedH = 0;
            renderTreemap();
        });

        // Re-render on resize only if container grew
        var resizeTimer = null;
        window.addEventListener('resize', function () {
            if (activeTab === 'treemap') {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(function () {
                    var container = $('#treemap-container');
                    if (!container) return;
                    var rect = container.getBoundingClientRect();
                    // Only re-render if viewport grew beyond current treemap
                    if (rect.width > treemapRenderedW || rect.height > treemapRenderedH) {
                        renderTreemap();
                    }
                }, 150);
            }
        });
    }

    /**
     * Build a nested tree from flat graph nodes.
     * Each node: { name, path, children[], files[], value }
     */
    function buildTreemapHierarchy(nodes, sizeMetric) {
        var root = { name: 'root', path: '', children: {}, files: [], value: 0 };

        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            var val = n[sizeMetric] || 1;
            var parts = n.id.split('/');
            var current = root;

            // Walk directory path
            for (var p = 0; p < parts.length - 1; p++) {
                var dirName = parts[p];
                if (!current.children[dirName]) {
                    var dirPath = parts.slice(0, p + 1).join('/');
                    current.children[dirName] = { name: dirName, path: dirPath, children: {}, files: [], value: 0 };
                }
                current = current.children[dirName];
            }
            current.files.push({ node: n, name: parts[parts.length - 1], value: val });
            current.value += val;
        }

        // Propagate values up and convert children objects to arrays
        function finalize(dir) {
            var childArray = [];
            var keys = Object.keys(dir.children);
            for (var k = 0; k < keys.length; k++) {
                var child = dir.children[keys[k]];
                finalize(child);
                dir.value += child.value;
                childArray.push(child);
            }
            dir.childrenArr = childArray;
        }
        finalize(root);
        return root;
    }

    /**
     * Get a subtree at a given path (for zoom)
     */
    function getSubtree(root, zoomPath) {
        if (!zoomPath) return root;
        var parts = zoomPath.split('/');
        var current = root;
        for (var i = 0; i < parts.length; i++) {
            if (current.children[parts[i]]) {
                current = current.children[parts[i]];
            } else {
                return root;
            }
        }
        return current;
    }

    /**
     * Count total leaf files in a subtree.
     */
    function countLeaves(dir) {
        var count = dir.files.length;
        for (var i = 0; i < dir.childrenArr.length; i++) {
            count += countLeaves(dir.childrenArr[i]);
        }
        return count;
    }

    /**
     * Squarified treemap layout.
     * Assigns x, y, w, h to each item in the items array.
     */
    function squarify(items, x, y, w, h) {
        if (items.length === 0 || w <= 0 || h <= 0) return;

        var totalValue = 0;
        for (var i = 0; i < items.length; i++) totalValue += items[i].value;
        if (totalValue <= 0) return;

        // Sort descending by value
        items.sort(function (a, b) { return b.value - a.value; });

        layoutStrip(items, 0, x, y, w, h, totalValue);
    }

    function layoutStrip(items, start, x, y, w, h, totalValue) {
        if (start >= items.length) return;
        if (items.length - start === 1) {
            items[start].x = x;
            items[start].y = y;
            items[start].w = w;
            items[start].h = h;
            return;
        }

        var vertical = h <= w;
        var mainSize = vertical ? w : h;
        var otherSize = vertical ? h : w;

        var strip = [];
        var stripValue = 0;
        var bestAspect = Infinity;

        for (var i = start; i < items.length; i++) {
            strip.push(items[i]);
            stripValue += items[i].value;

            var stripFraction = stripValue / totalValue;
            var stripMainSize = mainSize * stripFraction;

            // Compute worst aspect ratio in this strip
            var worstAspect = 0;
            for (var j = 0; j < strip.length; j++) {
                var itemFraction = strip[j].value / stripValue;
                var itemOther = otherSize * itemFraction;
                var aspect = stripMainSize > itemOther
                    ? stripMainSize / itemOther
                    : itemOther / stripMainSize;
                if (aspect > worstAspect) worstAspect = aspect;
            }

            if (worstAspect > bestAspect && strip.length > 1) {
                // Undo last add — previous strip was better
                strip.pop();
                stripValue -= items[i].value;
                break;
            }
            bestAspect = worstAspect;
        }

        // Lay out the strip
        var stripFraction = stripValue / totalValue;
        var stripMainSize = mainSize * stripFraction;
        var offset = 0;

        for (var j = 0; j < strip.length; j++) {
            var itemFraction = strip[j].value / stripValue;
            var itemOtherSize = otherSize * itemFraction;

            if (vertical) {
                strip[j].x = x;
                strip[j].y = y + offset;
                strip[j].w = stripMainSize;
                strip[j].h = itemOtherSize;
            } else {
                strip[j].x = x + offset;
                strip[j].y = y;
                strip[j].w = itemOtherSize;
                strip[j].h = stripMainSize;
            }
            offset += itemOtherSize;
        }

        // Recurse for remaining items
        var remaining = items.length - start - strip.length;
        if (remaining > 0) {
            var newTotal = totalValue - stripValue;
            if (vertical) {
                layoutStrip(items, start + strip.length, x + stripMainSize, y, w - stripMainSize, h, newTotal);
            } else {
                layoutStrip(items, start + strip.length, x, y + stripMainSize, w, h - stripMainSize, newTotal);
            }
        }
    }

    /**
     * Get color for a treemap cell based on the selected color metric.
     */
    function getTreemapColor(node, colorMetric, metricRange) {
        if (colorMetric === 'language') {
            return LANGUAGE_COLORS[node.language] || '#888';
        }
        var val = node[colorMetric] || 0;
        var min = metricRange.min || 0;
        var max = metricRange.max || 1;
        var t = max > min ? (val - min) / (max - min) : 0;
        t = Math.max(0, Math.min(1, t));
        // Muted blue-teal → amber → red-orange
        var r, g, b;
        if (t < 0.5) {
            var s = t * 2;
            r = Math.round(40 + s * 140);
            g = Math.round(120 + s * 20);
            b = Math.round(140 - s * 80);
        } else {
            var s = (t - 0.5) * 2;
            r = Math.round(180 + s * 60);
            g = Math.round(140 - s * 90);
            b = Math.round(60 - s * 30);
        }
        return 'rgb(' + r + ',' + g + ',' + b + ')';
    }

    function renderTreemap() {
        var container = $('#treemap-container');
        if (!container || !graphData) return;

        // Defer to next frame so the tab-content is visible and has dimensions
        requestAnimationFrame(function () { renderTreemapInner(container); });
    }

    function renderTreemapInner(container) {
        var nodes = graphData.nodes || [];
        if (nodes.length === 0) {
            container.innerHTML = '<div style="padding:24px;opacity:0.5">No data to display</div>';
            return;
        }

        // Compute color range
        var metricRange = { min: Infinity, max: -Infinity };
        if (treemapColorMetric !== 'language') {
            for (var i = 0; i < nodes.length; i++) {
                var v = nodes[i][treemapColorMetric] || 0;
                if (v < metricRange.min) metricRange.min = v;
                if (v > metricRange.max) metricRange.max = v;
            }
        }

        var hierarchy = buildTreemapHierarchy(nodes, treemapSizeMetric);
        var subtree = getSubtree(hierarchy, treemapZoomPath);

        // Build flat items for layout: dirs + files at this level
        var items = [];
        for (var i = 0; i < subtree.childrenArr.length; i++) {
            var dir = subtree.childrenArr[i];
            items.push({ value: dir.value, isDir: true, dir: dir, name: dir.name });
        }
        for (var i = 0; i < subtree.files.length; i++) {
            var f = subtree.files[i];
            items.push({ value: f.value, isDir: false, file: f, name: f.name, node: f.node });
        }

        if (items.length === 0) {
            container.innerHTML = '<div style="padding:24px;opacity:0.5">Empty directory</div>';
            return;
        }

        var rect = container.getBoundingClientRect();
        var viewW = Math.floor(rect.width) || 800;
        var viewH = Math.floor(rect.height) || 600;

        // Compute minimum useful size: ~50px per leaf item in each dimension
        var leafCount = countLeaves(subtree);
        var minSide = Math.ceil(Math.sqrt(leafCount)) * 50;
        var W = Math.max(viewW, minSide);
        var H = Math.max(viewH, minSide);

        treemapRenderedW = W;
        treemapRenderedH = H;

        squarify(items, 0, 0, W, H);

        // Render inside a sized wrapper so the parent can scroll if needed
        var html = '<div style="position:relative;width:' + W + 'px;height:' + H + 'px">';
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (!item.w || !item.h || item.w < 1 || item.h < 1) continue;
            var cx = Math.floor(item.x);
            var cy = Math.floor(item.y);
            var cw = Math.min(Math.floor(item.w), W - cx);
            var ch = Math.min(Math.floor(item.h), H - cy);
            if (cw < 1 || ch < 1) continue;

            if (item.isDir) {
                var dirColor = 'rgba(255,255,255,0.03)';
                html += '<div class="treemap-cell treemap-dir" data-dir-path="' + escapeHtml(item.dir.path) + '" ' +
                    'style="left:' + cx + 'px;top:' + cy + 'px;width:' + cw + 'px;height:' + ch + 'px;background:' + dirColor + '">' +
                    '<span class="treemap-cell-label">📁 ' + escapeHtml(item.name) + '</span>';

                // Recursively render children inside
                if (cw > 30 && ch > 30) {
                    var headerH = 22;
                    var innerItems = [];
                    for (var ci = 0; ci < item.dir.childrenArr.length; ci++) {
                        var cd = item.dir.childrenArr[ci];
                        innerItems.push({ value: cd.value, isDir: true, dir: cd, name: cd.name });
                    }
                    for (var fi = 0; fi < item.dir.files.length; fi++) {
                        var ff = item.dir.files[fi];
                        innerItems.push({ value: ff.value, isDir: false, file: ff, name: ff.name, node: ff.node });
                    }
                    var innerW = cw - 4;
                    var innerH = ch - headerH - 4;
                    if (innerItems.length > 0 && innerW > 10 && innerH > 10) {
                        squarify(innerItems, 0, 0, innerW, innerH);
                        html += renderTreemapCells(innerItems, 0, headerH, metricRange, cw, ch);
                    }
                }
                html += '</div>';
            } else {
                var color = getTreemapColor(item.node, treemapColorMetric, metricRange);
                html += '<div class="treemap-cell treemap-file" data-node-id="' + escapeHtml(item.node.id) + '" ' +
                    'style="left:' + cx + 'px;top:' + cy + 'px;width:' + cw + 'px;height:' + ch + 'px;background:' + color + '">';
                if (cw > 40 && ch > 16) {
                    html += '<span class="treemap-cell-label">' + escapeHtml(item.name) + '</span>';
                }
                if (cw > 50 && ch > 30) {
                    html += '<span class="treemap-cell-value">' + (item.node[treemapSizeMetric] || 0).toLocaleString() + '</span>';
                }
                html += '</div>';
            }
        }
        html += '</div>';

        // Breadcrumb
        updateTreemapBreadcrumb();

        container.innerHTML = html;

        // Tooltip
        if (!treemapTooltipEl) {
            treemapTooltipEl = document.createElement('div');
            treemapTooltipEl.className = 'treemap-tooltip';
            document.body.appendChild(treemapTooltipEl);
        }

        // Event delegation
        container.onmousemove = function (e) {
            var cell = e.target.closest('.treemap-file');
            if (cell) {
                var nodeId = cell.dataset.nodeId;
                var n = findNode(nodeId);
                if (n) {
                    treemapTooltipEl.innerHTML =
                        '<div class="treemap-tooltip-title">' + escapeHtml(n.id) + '</div>' +
                        '<div class="treemap-tooltip-meta">' +
                        'LOC: ' + (n.linesOfCode || 0).toLocaleString() + '<br>' +
                        'Complexity: ' + (n.complexity || 0) + '<br>' +
                        'Fan-in: ' + (n.fanIn || 0) + ' · Fan-out: ' + (n.fanOut || 0) + '<br>' +
                        'Language: ' + (n.language || '—') +
                        '</div>';
                    treemapTooltipEl.classList.add('visible');
                    treemapTooltipEl.style.left = (e.clientX + 12) + 'px';
                    treemapTooltipEl.style.top = (e.clientY + 12) + 'px';
                }
            } else {
                treemapTooltipEl.classList.remove('visible');
            }
        };
        container.onmouseleave = function () {
            if (treemapTooltipEl) treemapTooltipEl.classList.remove('visible');
        };

        container.onclick = function (e) {
            var dirCell = e.target.closest('.treemap-dir');
            var fileCell = e.target.closest('.treemap-file');
            if (fileCell) {
                var nodeId = fileCell.dataset.nodeId;
                vscode.postMessage({ type: 'openFile', payload: { path: nodeId } });
            } else if (dirCell && !dirCell.parentElement.closest('.treemap-dir')) {
                // Only zoom on top-level dir clicks (not nested)
                var dirPath = dirCell.dataset.dirPath;
                if (dirPath) {
                    treemapZoomPath = dirPath;
                    treemapRenderedW = 0; treemapRenderedH = 0;
                    renderTreemap();
                }
            }
        };
    }

    function renderTreemapCells(items, offsetX, offsetY, metricRange, parentW, parentH) {
        var html = '';
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (!item.w || !item.h || item.w < 1 || item.h < 1) continue;
            var x = Math.floor(item.x + offsetX);
            var y = Math.floor(item.y + offsetY);
            var cw = Math.min(Math.floor(item.w), parentW - x);
            var ch = Math.min(Math.floor(item.h), parentH - y);
            if (cw < 1 || ch < 1) continue;

            if (item.isDir) {
                html += '<div class="treemap-cell treemap-dir" data-dir-path="' + escapeHtml(item.dir.path) + '" ' +
                    'style="left:' + x + 'px;top:' + y + 'px;width:' + cw + 'px;height:' + ch + 'px">' +
                    '<span class="treemap-cell-label">📁 ' + escapeHtml(item.name) + '</span>';
                if (cw > 30 && ch > 30) {
                    var headerH = 22;
                    var innerItems = [];
                    for (var ci = 0; ci < item.dir.childrenArr.length; ci++) {
                        var cd = item.dir.childrenArr[ci];
                        innerItems.push({ value: cd.value, isDir: true, dir: cd, name: cd.name });
                    }
                    for (var fi = 0; fi < item.dir.files.length; fi++) {
                        var ff = item.dir.files[fi];
                        innerItems.push({ value: ff.value, isDir: false, file: ff, name: ff.name, node: ff.node });
                    }
                    var innerW = cw - 4;
                    var innerH = ch - headerH - 4;
                    if (innerItems.length > 0 && innerW > 10 && innerH > 10) {
                        squarify(innerItems, 0, 0, innerW, innerH);
                        html += renderTreemapCells(innerItems, 0, headerH, metricRange, cw, ch);
                    }
                }
                html += '</div>';
            } else {
                var color = getTreemapColor(item.node, treemapColorMetric, metricRange);
                html += '<div class="treemap-cell treemap-file" data-node-id="' + escapeHtml(item.node.id) + '" ' +
                    'style="left:' + x + 'px;top:' + y + 'px;width:' + cw + 'px;height:' + ch + 'px;background:' + color + '">';
                if (cw > 40 && ch > 16) {
                    html += '<span class="treemap-cell-label">' + escapeHtml(item.name) + '</span>';
                }
                if (cw > 50 && ch > 30) {
                    html += '<span class="treemap-cell-value">' + (item.node[treemapSizeMetric] || 0).toLocaleString() + '</span>';
                }
                html += '</div>';
            }
        }
        return html;
    }

    function updateTreemapBreadcrumb() {
        var bc = $('#treemap-breadcrumb');
        if (!bc) return;
        var html = '<span class="treemap-crumb treemap-crumb-root" data-path="">root</span>';
        if (treemapZoomPath) {
            var parts = treemapZoomPath.split('/');
            for (var i = 0; i < parts.length; i++) {
                var partial = parts.slice(0, i + 1).join('/');
                html += '<span class="treemap-crumb-sep">›</span>';
                html += '<span class="treemap-crumb" data-path="' + escapeHtml(partial) + '">' + escapeHtml(parts[i]) + '</span>';
            }
        }
        bc.innerHTML = html;

        // Click handlers
        var crumbs = bc.querySelectorAll('.treemap-crumb');
        for (var i = 0; i < crumbs.length; i++) {
            crumbs[i].addEventListener('click', function () {
                treemapZoomPath = this.dataset.path;
                treemapRenderedW = 0; treemapRenderedH = 0;
                renderTreemap();
            });
        }
    }

    // ============================================================
    // Chord Diagram View
    // ============================================================
    var chordGroupBy = 'directory';
    var chordTooltipEl = null;

    function setupChord() {
        var groupSelect = $('#chord-group-by');
        if (groupSelect) groupSelect.addEventListener('change', function () {
            chordGroupBy = this.value;
            renderChord();
        });
    }

    // 10 distinct muted colors for groups
    var CHORD_PALETTE = [
        '#4fc3f7', '#81c784', '#ffd54f', '#ff8a65', '#ce93d8',
        '#4dd0e1', '#e57373', '#64b5f6', '#ffb74d', '#a1887f',
        '#90a4ae', '#aed581', '#f48fb1', '#80deea', '#fff176'
    ];

    function renderChord() {
        var container = $('#chord-container');
        if (!container || !graphData) return;

        var nodes = graphData.nodes || [];
        var links = graphData.links || [];
        if (nodes.length === 0) {
            container.innerHTML = '<div style="padding:24px;opacity:0.5">No data to display</div>';
            return;
        }

        // Build groups
        function groupKey(n) {
            if (chordGroupBy === 'language') return n.language || 'unknown';
            if (chordGroupBy === 'community') {
                var cid = communityMap[n.id];
                if (cid != null && communityNames[cid]) return communityNames[cid].name;
                return 'ungrouped';
            }
            // directory: first path segment
            var parts = n.id.split('/');
            return parts.length > 1 ? parts[0] : '.';
        }

        // Assign each node to a group
        var groupNames = [];
        var groupMap = {}; // groupName → index
        var nodeToGroup = {};
        for (var i = 0; i < nodes.length; i++) {
            var gk = groupKey(nodes[i]);
            if (groupMap[gk] === undefined) {
                groupMap[gk] = groupNames.length;
                groupNames.push(gk);
            }
            nodeToGroup[nodes[i].id] = groupMap[gk];
        }

        var G = groupNames.length;
        if (G < 2) {
            container.innerHTML = '<div style="padding:24px;opacity:0.5">Only 1 group found — try a different grouping</div>';
            return;
        }

        // Build G×G adjacency matrix (flow counts between groups)
        var matrix = [];
        for (var i = 0; i < G; i++) {
            matrix[i] = new Array(G);
            for (var j = 0; j < G; j++) matrix[i][j] = 0;
        }
        for (var k = 0; k < links.length; k++) {
            var link = links[k];
            var src = typeof link.source === 'object' ? link.source.id : link.source;
            var tgt = typeof link.target === 'object' ? link.target.id : link.target;
            var gi = nodeToGroup[src], gj = nodeToGroup[tgt];
            if (gi !== undefined && gj !== undefined && gi !== gj) {
                matrix[gi][gj] += 1;
            }
        }

        // Group sizes (file count)
        var groupSizes = new Array(G);
        for (var i = 0; i < G; i++) groupSizes[i] = 0;
        for (var i = 0; i < nodes.length; i++) {
            groupSizes[nodeToGroup[nodes[i].id]]++;
        }

        // Stats
        var totalFlows = 0;
        for (var i = 0; i < G; i++) for (var j = 0; j < G; j++) totalFlows += matrix[i][j];
        var statsEl = $('#chord-stats');
        if (statsEl) statsEl.textContent = G + ' groups · ' + totalFlows + ' cross-group dependencies';

        // Compute chord layout
        // Row sums for arc sizing
        var rowSums = new Array(G);
        for (var i = 0; i < G; i++) {
            rowSums[i] = 0;
            for (var j = 0; j < G; j++) rowSums[i] += matrix[i][j] + matrix[j][i];
        }
        // Minimum arc size so every group is visible
        var minArc = 0.02;
        var totalSum = 0;
        for (var i = 0; i < G; i++) totalSum += rowSums[i];
        if (totalSum === 0) totalSum = 1;

        var padAngle = 0.03;
        var totalPad = padAngle * G;
        var available = 2 * Math.PI - totalPad;

        // Arc angles
        var arcs = []; // { startAngle, endAngle, index }
        var angle = 0;
        for (var i = 0; i < G; i++) {
            var frac = rowSums[i] / totalSum;
            if (frac < minArc) frac = minArc;
            var arcLen = frac * available;
            arcs.push({ startAngle: angle, endAngle: angle + arcLen, index: i });
            angle += arcLen + padAngle;
        }
        // Normalize to fit exactly in 2π
        var scale = (2 * Math.PI) / angle;
        for (var i = 0; i < G; i++) {
            arcs[i].startAngle *= scale;
            arcs[i].endAngle *= scale;
        }

        // SVG dimensions
        var rect = container.getBoundingClientRect();
        var W = rect.width || 600;
        var H = rect.height || 600;
        var size = Math.min(W, H);
        var outerR = size * 0.40;
        var innerR = outerR - 14;

        var cx = W / 2;
        var cy = H / 2;

        var svgNS = 'http://www.w3.org/2000/svg';

        function arcPath(r1, r2, a1, a2) {
            var x1o = cx + r2 * Math.cos(a1), y1o = cy + r2 * Math.sin(a1);
            var x2o = cx + r2 * Math.cos(a2), y2o = cy + r2 * Math.sin(a2);
            var x1i = cx + r1 * Math.cos(a2), y1i = cy + r1 * Math.sin(a2);
            var x2i = cx + r1 * Math.cos(a1), y2i = cy + r1 * Math.sin(a1);
            var large = (a2 - a1) > Math.PI ? 1 : 0;
            return 'M' + x1o + ',' + y1o +
                ' A' + r2 + ',' + r2 + ' 0 ' + large + ' 1 ' + x2o + ',' + y2o +
                ' L' + x1i + ',' + y1i +
                ' A' + r1 + ',' + r1 + ' 0 ' + large + ' 0 ' + x2i + ',' + y2i +
                ' Z';
        }

        // Ribbon path: quad bezier through center
        function ribbonPath(srcArc, srcStart, srcEnd, tgtArc, tgtStart, tgtEnd) {
            var r = innerR;
            var sx1 = cx + r * Math.cos(srcStart), sy1 = cy + r * Math.sin(srcStart);
            var sx2 = cx + r * Math.cos(srcEnd), sy2 = cy + r * Math.sin(srcEnd);
            var tx1 = cx + r * Math.cos(tgtStart), ty1 = cy + r * Math.sin(tgtStart);
            var tx2 = cx + r * Math.cos(tgtEnd), ty2 = cy + r * Math.sin(tgtEnd);
            return 'M' + sx1 + ',' + sy1 +
                ' A' + r + ',' + r + ' 0 0 1 ' + sx2 + ',' + sy2 +
                ' Q' + cx + ',' + cy + ' ' + tx1 + ',' + ty1 +
                ' A' + r + ',' + r + ' 0 0 1 ' + tx2 + ',' + ty2 +
                ' Q' + cx + ',' + cy + ' ' + sx1 + ',' + sy1 +
                ' Z';
        }

        // Assign sub-arc angles for ribbons
        // For each group, divide its arc proportionally among its flows
        var arcPositions = []; // [i] → current angle offset within arc
        for (var i = 0; i < G; i++) arcPositions[i] = arcs[i].startAngle;

        // Compute ribbons
        var ribbons = [];
        for (var i = 0; i < G; i++) {
            for (var j = i + 1; j < G; j++) {
                var flow_ij = matrix[i][j];
                var flow_ji = matrix[j][i];
                var total = flow_ij + flow_ji;
                if (total === 0) continue;

                var arcI = arcs[i], arcJ = arcs[j];
                var arcILen = arcI.endAngle - arcI.startAngle;
                var arcJLen = arcJ.endAngle - arcJ.startAngle;
                var sumI = rowSums[i] || 1, sumJ = rowSums[j] || 1;

                // Source portion on arc i
                var srcSpan = (total / sumI) * arcILen;
                var srcStart = arcPositions[i];
                var srcEnd = srcStart + srcSpan;
                arcPositions[i] = srcEnd;

                // Target portion on arc j
                var tgtSpan = (total / sumJ) * arcJLen;
                var tgtStart = arcPositions[j];
                var tgtEnd = tgtStart + tgtSpan;
                arcPositions[j] = tgtEnd;

                ribbons.push({
                    source: i, target: j,
                    flow_ij: flow_ij, flow_ji: flow_ji,
                    srcStart: srcStart, srcEnd: srcEnd,
                    tgtStart: tgtStart, tgtEnd: tgtEnd
                });
            }
        }

        // Build SVG
        var svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('width', W);
        svg.setAttribute('height', H);

        // Ribbons
        var ribbonGroup = document.createElementNS(svgNS, 'g');
        ribbonGroup.setAttribute('class', 'chord-ribbons');
        for (var k = 0; k < ribbons.length; k++) {
            var rb = ribbons[k];
            var path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', ribbonPath(
                rb.source, rb.srcStart, rb.srcEnd,
                rb.target, rb.tgtStart, rb.tgtEnd
            ));
            var color = CHORD_PALETTE[rb.source % CHORD_PALETTE.length];
            path.setAttribute('fill', color);
            path.setAttribute('fill-opacity', '0.35');
            path.setAttribute('stroke', color);
            path.setAttribute('stroke-opacity', '0.5');
            path.setAttribute('stroke-width', '0.5');
            path.setAttribute('class', 'chord-ribbon');
            path.dataset.source = rb.source;
            path.dataset.target = rb.target;
            path.dataset.flowIj = rb.flow_ij;
            path.dataset.flowJi = rb.flow_ji;
            ribbonGroup.appendChild(path);
        }
        svg.appendChild(ribbonGroup);

        // Arcs
        var arcGroup = document.createElementNS(svgNS, 'g');
        arcGroup.setAttribute('class', 'chord-arcs');
        for (var i = 0; i < G; i++) {
            var arc = arcs[i];
            var path = document.createElementNS(svgNS, 'path');
            path.setAttribute('d', arcPath(innerR, outerR, arc.startAngle, arc.endAngle));
            path.setAttribute('fill', CHORD_PALETTE[i % CHORD_PALETTE.length]);
            path.setAttribute('class', 'chord-arc');
            path.dataset.group = i;
            arcGroup.appendChild(path);

            // Label
            var midAngle = (arc.startAngle + arc.endAngle) / 2;
            var labelR = outerR + 8;
            var lx = cx + labelR * Math.cos(midAngle);
            var ly = cy + labelR * Math.sin(midAngle);
            var text = document.createElementNS(svgNS, 'text');
            text.setAttribute('x', lx);
            text.setAttribute('y', ly);
            text.setAttribute('class', 'chord-label');
            // Rotate so text follows the arc
            var deg = midAngle * 180 / Math.PI;
            if (deg > 90 && deg < 270) {
                text.setAttribute('transform', 'rotate(' + (deg + 180) + ',' + lx + ',' + ly + ')');
                text.setAttribute('text-anchor', 'end');
            } else {
                text.setAttribute('transform', 'rotate(' + deg + ',' + lx + ',' + ly + ')');
                text.setAttribute('text-anchor', 'start');
            }
            var label = groupNames[i];
            if (label.length > 20) label = label.slice(0, 18) + '…';
            text.textContent = label + ' (' + groupSizes[i] + ')';
            arcGroup.appendChild(text);
        }
        svg.appendChild(arcGroup);

        container.innerHTML = '';
        container.appendChild(svg);

        // Legend
        var legend = document.createElement('div');
        legend.className = 'chord-legend';
        for (var i = 0; i < G; i++) {
            legend.innerHTML += '<div class="chord-legend-item">' +
                '<div class="chord-legend-swatch" style="background:' + CHORD_PALETTE[i % CHORD_PALETTE.length] + '"></div>' +
                '<span>' + escapeHtml(groupNames[i]) + ' (' + groupSizes[i] + ')</span></div>';
        }
        container.appendChild(legend);

        // Tooltip
        if (!chordTooltipEl) {
            chordTooltipEl = document.createElement('div');
            chordTooltipEl.className = 'chord-tooltip';
            document.body.appendChild(chordTooltipEl);
        }

        // Interactions
        svg.addEventListener('mouseover', function (e) {
            var ribbon = e.target.closest('.chord-ribbon');
            var arc = e.target.closest('.chord-arc');

            if (ribbon) {
                var si = parseInt(ribbon.dataset.source);
                var ti = parseInt(ribbon.dataset.target);
                // Dim everything except this ribbon and its arcs
                var allRibbons = svg.querySelectorAll('.chord-ribbon');
                var allArcs = svg.querySelectorAll('.chord-arc');
                for (var r = 0; r < allRibbons.length; r++) allRibbons[r].classList.add('chord-dimmed');
                for (var a = 0; a < allArcs.length; a++) allArcs[a].classList.add('chord-dimmed');
                ribbon.classList.remove('chord-dimmed');
                ribbon.setAttribute('fill-opacity', '0.6');
                // Highlight source/target arcs
                for (var a = 0; a < allArcs.length; a++) {
                    var gi = parseInt(allArcs[a].dataset.group);
                    if (gi === si || gi === ti) allArcs[a].classList.remove('chord-dimmed');
                }
                // Tooltip
                chordTooltipEl.innerHTML =
                    '<div class="chord-tooltip-title">' + escapeHtml(groupNames[si]) + ' ↔ ' + escapeHtml(groupNames[ti]) + '</div>' +
                    '<div class="chord-tooltip-meta">' +
                    escapeHtml(groupNames[si]) + ' → ' + escapeHtml(groupNames[ti]) + ': <strong>' + ribbon.dataset.flowIj + '</strong><br>' +
                    escapeHtml(groupNames[ti]) + ' → ' + escapeHtml(groupNames[si]) + ': <strong>' + ribbon.dataset.flowJi + '</strong></div>';
                chordTooltipEl.classList.add('visible');
            } else if (arc) {
                var gi = parseInt(arc.dataset.group);
                // Dim everything, highlight this group's ribbons
                var allRibbons = svg.querySelectorAll('.chord-ribbon');
                var allArcs = svg.querySelectorAll('.chord-arc');
                for (var r = 0; r < allRibbons.length; r++) allRibbons[r].classList.add('chord-dimmed');
                for (var a = 0; a < allArcs.length; a++) allArcs[a].classList.add('chord-dimmed');
                arc.classList.remove('chord-dimmed');
                for (var r = 0; r < allRibbons.length; r++) {
                    var s = parseInt(allRibbons[r].dataset.source);
                    var t = parseInt(allRibbons[r].dataset.target);
                    if (s === gi || t === gi) {
                        allRibbons[r].classList.remove('chord-dimmed');
                        // Also un-dim connected arcs
                        var other = s === gi ? t : s;
                        for (var a = 0; a < allArcs.length; a++) {
                            if (parseInt(allArcs[a].dataset.group) === other) allArcs[a].classList.remove('chord-dimmed');
                        }
                    }
                }
                // Tooltip
                var inFlow = 0, outFlow = 0;
                for (var j = 0; j < G; j++) {
                    outFlow += matrix[gi][j];
                    inFlow += matrix[j][gi];
                }
                chordTooltipEl.innerHTML =
                    '<div class="chord-tooltip-title">' + escapeHtml(groupNames[gi]) + '</div>' +
                    '<div class="chord-tooltip-meta">' + groupSizes[gi] + ' files<br>' +
                    'Outgoing: ' + outFlow + ' · Incoming: ' + inFlow + '</div>';
                chordTooltipEl.classList.add('visible');
            } else {
                // Clear highlights
                var allRibbons = svg.querySelectorAll('.chord-ribbon');
                var allArcs = svg.querySelectorAll('.chord-arc');
                for (var r = 0; r < allRibbons.length; r++) {
                    allRibbons[r].classList.remove('chord-dimmed');
                    allRibbons[r].setAttribute('fill-opacity', '0.35');
                }
                for (var a = 0; a < allArcs.length; a++) allArcs[a].classList.remove('chord-dimmed');
                chordTooltipEl.classList.remove('visible');
            }
        });

        svg.addEventListener('mousemove', function (e) {
            if (chordTooltipEl.classList.contains('visible')) {
                chordTooltipEl.style.left = (e.clientX + 12) + 'px';
                chordTooltipEl.style.top = (e.clientY + 12) + 'px';
            }
        });

        svg.addEventListener('mouseleave', function () {
            var allRibbons = svg.querySelectorAll('.chord-ribbon');
            var allArcs = svg.querySelectorAll('.chord-arc');
            for (var r = 0; r < allRibbons.length; r++) {
                allRibbons[r].classList.remove('chord-dimmed');
                allRibbons[r].setAttribute('fill-opacity', '0.35');
            }
            for (var a = 0; a < allArcs.length; a++) allArcs[a].classList.remove('chord-dimmed');
            if (chordTooltipEl) chordTooltipEl.classList.remove('visible');
        });
    }

    // ============================================================
    // Timeline Chart View
    // ============================================================
    var tchartMetric = 'loc';
    var tchartTooltipEl = null;
    var tchartCachedSnapshots = null; // cached computed data

    function setupTimelineChart() {
        var metricSelect = $('#tchart-metric');
        if (metricSelect) metricSelect.addEventListener('change', function () {
            tchartMetric = this.value;
            renderTimelineChart();
        });
    }

    /**
     * Reconstruct aggregate metrics at each commit by walking backward from HEAD.
     * Returns array of { hash, date, author, message, loc, files, complexity, totalComplexity }
     * ordered oldest → newest, plus a HEAD entry at the end.
     */
    function computeTimelineSnapshots() {
        if (tchartCachedSnapshots) return tchartCachedSnapshots;
        if (!graphData || timelineCommits.length === 0) return null;

        var nodes = graphData.nodes || [];

        // HEAD aggregate
        var headLoc = 0, headComplexity = 0;
        var headNodeStates = {}; // id → { loc, complexity }
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            headLoc += (n.linesOfCode || 0);
            headComplexity += (n.complexity || 0);
            headNodeStates[n.id] = { loc: n.linesOfCode || 0, complexity: n.complexity || 0 };
        }

        // Walk commits newest→oldest (index 0 = newest)
        // At each commit, reconstruct the state BEFORE that commit
        // by reversing the delta
        var snapshots = [];
        var currentLoc = headLoc;
        var currentComplexity = headComplexity;
        var currentFiles = nodes.length;
        var currentStates = {};
        for (var k in headNodeStates) currentStates[k] = { loc: headNodeStates[k].loc, complexity: headNodeStates[k].complexity };

        // Add HEAD as the newest point
        snapshots.push({
            hash: 'HEAD',
            date: new Date().toISOString(),
            author: '',
            message: 'Current state (HEAD)',
            loc: currentLoc,
            files: currentFiles,
            complexity: currentFiles > 0 ? currentComplexity / currentFiles : 0,
            totalComplexity: currentComplexity
        });

        var maxScanned = Math.min(timelineScannedCount, timelineCommits.length);
        for (var ci = 0; ci < maxScanned; ci++) {
            var commit = timelineCommits[ci];
            var delta = timelineDeltas[commit.hash];
            if (!delta) continue;

            // Reverse the delta to get state BEFORE this commit:
            // - files added in this commit: remove them (didn't exist before)
            for (var a = 0; a < delta.added.length; a++) {
                var fid = delta.added[a];
                if (currentStates[fid]) {
                    currentLoc -= currentStates[fid].loc;
                    currentComplexity -= currentStates[fid].complexity;
                    delete currentStates[fid];
                    currentFiles--;
                }
            }

            // - files removed in this commit: add them back (existed before)
            //   We don't know their exact size before, but use 0 as estimate
            for (var r = 0; r < delta.removed.length; r++) {
                var fid = delta.removed[r];
                if (!currentStates[fid]) {
                    currentStates[fid] = { loc: 0, complexity: 0 };
                    currentFiles++;
                }
            }

            // - files modified in this commit: restore to previous state
            //   delta.modified[id] has the state AT this commit; we need state BEFORE
            //   Approximate: subtract the difference between current tracked state and delta state
            var modKeys = Object.keys(delta.modified);
            for (var m = 0; m < modKeys.length; m++) {
                var mid = modKeys[m];
                var deltaState = delta.modified[mid];
                if (currentStates[mid]) {
                    // Replace current state with delta state (state AT this commit)
                    // Then on next iteration we'll see the state at the previous commit
                    var oldLoc = currentStates[mid].loc;
                    var oldCplx = currentStates[mid].complexity;
                    var newLoc = deltaState.linesOfCode || 0;
                    var newCplx = deltaState.complexity || 0;
                    currentLoc += (newLoc - oldLoc);
                    currentComplexity += (newCplx - oldCplx);
                    currentStates[mid] = { loc: newLoc, complexity: newCplx };
                }
            }

            snapshots.push({
                hash: commit.hash.slice(0, 7),
                date: commit.date || delta.date,
                author: commit.author || delta.author || '',
                message: commit.message || delta.message || '',
                loc: Math.max(0, currentLoc),
                files: Math.max(0, currentFiles),
                complexity: currentFiles > 0 ? currentComplexity / currentFiles : 0,
                totalComplexity: Math.max(0, currentComplexity)
            });
        }

        // Reverse so oldest is first
        snapshots.reverse();
        tchartCachedSnapshots = snapshots;
        return snapshots;
    }

    function renderTimelineChart() {
        var container = $('#tchart-container');
        if (!container) return;

        if (!graphData || timelineCommits.length === 0) {
            container.innerHTML = '<div class="tchart-no-data">No git history available.<br>Use the Time Travel feature (⏱️ button) to scan commits first.</div>';
            return;
        }

        var snapshots = computeTimelineSnapshots();
        if (!snapshots || snapshots.length < 2) {
            container.innerHTML = '<div class="tchart-no-data">Not enough data points yet.<br>Wait for more commits to be scanned.</div>';
            return;
        }

        // Metric to display
        var metricKey = tchartMetric; // loc, files, complexity, totalComplexity
        var metricLabels = { loc: 'Lines of Code', files: 'File Count', complexity: 'Avg Complexity', totalComplexity: 'Total Complexity' };
        var metricLabel = metricLabels[metricKey] || metricKey;

        // Stats
        var statsEl = $('#tchart-stats');
        if (statsEl) statsEl.textContent = snapshots.length + ' data points · ' + metricLabel;

        // Extract values
        var values = [];
        var dates = [];
        for (var i = 0; i < snapshots.length; i++) {
            values.push(snapshots[i][metricKey] || 0);
            dates.push(new Date(snapshots[i].date));
        }

        // Layout
        var rect = container.getBoundingClientRect();
        var W = rect.width || 800;
        var H = rect.height || 400;
        var margin = { top: 20, right: 30, bottom: 50, left: 60 };
        var chartW = W - margin.left - margin.right;
        var chartH = H - margin.top - margin.bottom;

        // Scales
        var minDate = dates[0].getTime();
        var maxDate = dates[dates.length - 1].getTime();
        var dateRange = maxDate - minDate || 1;

        var minVal = 0;
        var maxVal = Math.max.apply(null, values);
        if (maxVal === 0) maxVal = 1;
        // Add 10% padding on top
        maxVal *= 1.1;

        function xScale(d) { return margin.left + ((d.getTime() - minDate) / dateRange) * chartW; }
        function yScale(v) { return margin.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH; }

        var svgNS = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('width', W);
        svg.setAttribute('height', H);

        // Gradient for area fill
        var defs = document.createElementNS(svgNS, 'defs');
        var grad = document.createElementNS(svgNS, 'linearGradient');
        grad.setAttribute('id', 'tchart-gradient');
        grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
        grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
        var stop1 = document.createElementNS(svgNS, 'stop');
        stop1.setAttribute('offset', '0%'); stop1.setAttribute('stop-color', '#4fc3f7'); stop1.setAttribute('stop-opacity', '0.4');
        var stop2 = document.createElementNS(svgNS, 'stop');
        stop2.setAttribute('offset', '100%'); stop2.setAttribute('stop-color', '#4fc3f7'); stop2.setAttribute('stop-opacity', '0.02');
        grad.appendChild(stop1);
        grad.appendChild(stop2);
        defs.appendChild(grad);
        svg.appendChild(defs);

        // Y-axis grid lines + labels
        var yTicks = 5;
        for (var t = 0; t <= yTicks; t++) {
            var val = minVal + (maxVal - minVal) * (t / yTicks);
            var y = yScale(val);
            // Grid line
            var line = document.createElementNS(svgNS, 'line');
            line.setAttribute('x1', margin.left);
            line.setAttribute('x2', W - margin.right);
            line.setAttribute('y1', y); line.setAttribute('y2', y);
            line.setAttribute('class', 'tchart-grid-line');
            svg.appendChild(line);
            // Label
            var text = document.createElementNS(svgNS, 'text');
            text.setAttribute('x', margin.left - 8);
            text.setAttribute('y', y + 3);
            text.setAttribute('text-anchor', 'end');
            text.setAttribute('class', 'tchart-axis-label');
            text.textContent = val >= 1000 ? Math.round(val / 1000) + 'k' : Math.round(val * 10) / 10;
            svg.appendChild(text);
        }

        // X-axis: date labels (sample ~8 ticks)
        var xTickCount = Math.min(snapshots.length, 8);
        var xStep = Math.max(1, Math.floor(snapshots.length / xTickCount));
        for (var i = 0; i < snapshots.length; i += xStep) {
            var x = xScale(dates[i]);
            var text = document.createElementNS(svgNS, 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', H - margin.bottom + 18);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('class', 'tchart-axis-label');
            var d = dates[i];
            text.textContent = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            svg.appendChild(text);
            // Tick
            var tick = document.createElementNS(svgNS, 'line');
            tick.setAttribute('x1', x); tick.setAttribute('x2', x);
            tick.setAttribute('y1', margin.top + chartH); tick.setAttribute('y2', margin.top + chartH + 5);
            tick.setAttribute('class', 'tchart-grid-line');
            svg.appendChild(tick);
        }

        // Area path
        var areaD = 'M' + xScale(dates[0]) + ',' + yScale(0);
        for (var i = 0; i < values.length; i++) {
            areaD += ' L' + xScale(dates[i]) + ',' + yScale(values[i]);
        }
        areaD += ' L' + xScale(dates[dates.length - 1]) + ',' + yScale(0) + ' Z';
        var areaPath = document.createElementNS(svgNS, 'path');
        areaPath.setAttribute('d', areaD);
        areaPath.setAttribute('class', 'tchart-area');
        svg.appendChild(areaPath);

        // Line path
        var lineD = '';
        for (var i = 0; i < values.length; i++) {
            lineD += (i === 0 ? 'M' : ' L') + xScale(dates[i]) + ',' + yScale(values[i]);
        }
        var linePath = document.createElementNS(svgNS, 'path');
        linePath.setAttribute('d', lineD);
        linePath.setAttribute('class', 'tchart-line');
        svg.appendChild(linePath);

        // Dots
        var dotGroup = document.createElementNS(svgNS, 'g');
        // Sample dots to avoid overcrowding (max ~60)
        var dotStep = Math.max(1, Math.floor(values.length / 60));
        for (var i = 0; i < values.length; i += dotStep) {
            var dot = document.createElementNS(svgNS, 'circle');
            dot.setAttribute('cx', xScale(dates[i]));
            dot.setAttribute('cy', yScale(values[i]));
            dot.setAttribute('r', 3);
            dot.setAttribute('class', 'tchart-dot');
            dot.dataset.idx = i;
            dotGroup.appendChild(dot);
        }
        // Always include last point
        if ((values.length - 1) % dotStep !== 0) {
            var dot = document.createElementNS(svgNS, 'circle');
            dot.setAttribute('cx', xScale(dates[values.length - 1]));
            dot.setAttribute('cy', yScale(values[values.length - 1]));
            dot.setAttribute('r', 3);
            dot.setAttribute('class', 'tchart-dot');
            dot.dataset.idx = values.length - 1;
            dotGroup.appendChild(dot);
        }
        svg.appendChild(dotGroup);

        // Crosshair line (hidden by default)
        var crosshair = document.createElementNS(svgNS, 'line');
        crosshair.setAttribute('y1', margin.top);
        crosshair.setAttribute('y2', margin.top + chartH);
        crosshair.setAttribute('class', 'tchart-crosshair');
        crosshair.style.display = 'none';
        svg.appendChild(crosshair);

        // Y axis label
        var yLabel = document.createElementNS(svgNS, 'text');
        yLabel.setAttribute('x', 14);
        yLabel.setAttribute('y', margin.top + chartH / 2);
        yLabel.setAttribute('text-anchor', 'middle');
        yLabel.setAttribute('transform', 'rotate(-90,' + 14 + ',' + (margin.top + chartH / 2) + ')');
        yLabel.setAttribute('class', 'tchart-axis-label');
        yLabel.textContent = metricLabel;
        svg.appendChild(yLabel);

        container.innerHTML = '';
        container.appendChild(svg);

        // Tooltip
        if (!tchartTooltipEl) {
            tchartTooltipEl = document.createElement('div');
            tchartTooltipEl.className = 'tchart-tooltip';
            document.body.appendChild(tchartTooltipEl);
        }

        // Interactions
        svg.addEventListener('mouseover', function (e) {
            var dot = e.target.closest('.tchart-dot');
            if (dot) {
                var idx = parseInt(dot.dataset.idx);
                var snap = snapshots[idx];
                crosshair.setAttribute('x1', dot.getAttribute('cx'));
                crosshair.setAttribute('x2', dot.getAttribute('cx'));
                crosshair.style.display = '';
                tchartTooltipEl.innerHTML =
                    '<div class="tchart-tooltip-title">' + escapeHtml(snap.hash) + '</div>' +
                    '<div class="tchart-tooltip-meta">' +
                    escapeHtml(snap.message.split('\n')[0].slice(0, 80)) + '<br>' +
                    '<strong>' + metricLabel + ': ' + (metricKey === 'complexity' ? (Math.round(snap[metricKey] * 100) / 100) : Math.round(snap[metricKey])) + '</strong><br>' +
                    snap.files + ' files · ' + snap.loc + ' LOC<br>' +
                    escapeHtml(snap.author) + ' · ' + snap.date.slice(0, 10) +
                    '</div>';
                tchartTooltipEl.classList.add('visible');
            } else {
                crosshair.style.display = 'none';
                tchartTooltipEl.classList.remove('visible');
            }
        });

        svg.addEventListener('mousemove', function (e) {
            if (tchartTooltipEl.classList.contains('visible')) {
                tchartTooltipEl.style.left = (e.clientX + 12) + 'px';
                tchartTooltipEl.style.top = (e.clientY + 12) + 'px';
            }
        });

        svg.addEventListener('mouseleave', function () {
            crosshair.style.display = 'none';
            if (tchartTooltipEl) tchartTooltipEl.classList.remove('visible');
        });
    }

    // ============================================================
    // DSM (Dependency Structure Matrix) View
    // ============================================================
    var dsmGroupBy = 'directory';
    var dsmSortBy = 'group';
    var dsmTooltipEl = null;

    function setupDSM() {
        var groupSelect = $('#dsm-group-by');
        var sortSelect = $('#dsm-sort');
        if (groupSelect) groupSelect.addEventListener('change', function () {
            dsmGroupBy = this.value;
            renderDSM();
        });
        if (sortSelect) sortSelect.addEventListener('change', function () {
            dsmSortBy = this.value;
            renderDSM();
        });
    }

    function renderDSM() {
        var container = $('#dsm-container');
        if (!container || !graphData) return;

        var nodes = graphData.nodes || [];
        var links = graphData.links || [];
        if (nodes.length === 0) {
            container.innerHTML = '<div style="padding:24px;opacity:0.5">No data to display</div>';
            return;
        }

        // Cap at 200 files for performance — take highest fan-in + fan-out
        var MAX = 200;
        var sortedNodes = nodes.slice();
        if (sortedNodes.length > MAX) {
            sortedNodes.sort(function (a, b) { return (b.fanIn + b.fanOut) - (a.fanIn + a.fanOut); });
            sortedNodes = sortedNodes.slice(0, MAX);
        }

        // Build group key for each node
        function groupKey(n) {
            if (dsmGroupBy === 'language') return n.language || 'unknown';
            if (dsmGroupBy === 'community') {
                var cid = communityMap[n.id];
                if (cid != null && communityNames[cid]) return communityNames[cid].name;
                return 'ungrouped';
            }
            return n.group || '.';
        }

        // Sort nodes
        sortedNodes.sort(function (a, b) {
            if (dsmSortBy === 'group') {
                var ga = groupKey(a), gb = groupKey(b);
                if (ga !== gb) return ga < gb ? -1 : 1;
                return a.id < b.id ? -1 : 1;
            }
            if (dsmSortBy === 'name') return a.id < b.id ? -1 : 1;
            if (dsmSortBy === 'fanIn') return (b.fanIn || 0) - (a.fanIn || 0);
            if (dsmSortBy === 'fanOut') return (b.fanOut || 0) - (a.fanOut || 0);
            return 0;
        });

        // Build id → index map
        var idToIdx = {};
        for (var i = 0; i < sortedNodes.length; i++) {
            idToIdx[sortedNodes[i].id] = i;
        }

        // Build adjacency matrix
        var N = sortedNodes.length;
        var matrix = new Array(N);
        for (var i = 0; i < N; i++) {
            matrix[i] = new Uint8Array(N);
        }
        for (var k = 0; k < links.length; k++) {
            var link = links[k];
            var src = typeof link.source === 'object' ? link.source.id : link.source;
            var tgt = typeof link.target === 'object' ? link.target.id : link.target;
            var si = idToIdx[src], ti = idToIdx[tgt];
            if (si !== undefined && ti !== undefined && si !== ti) {
                matrix[si][ti] = 1;
            }
        }

        // Stats
        var depCount = 0;
        for (var i = 0; i < N; i++) for (var j = 0; j < N; j++) depCount += matrix[i][j];
        var statsEl = $('#dsm-stats');
        if (statsEl) statsEl.textContent = N + ' files · ' + depCount + ' dependencies' + (nodes.length > MAX ? ' (top ' + MAX + ' shown)' : '');

        // Detect group boundaries for separator lines
        var groupBounds = [];
        var prevGroup = null;
        for (var i = 0; i < N; i++) {
            var gk = groupKey(sortedNodes[i]);
            groupBounds.push(gk !== prevGroup);
            prevGroup = gk;
        }

        // Build HTML table
        var html = '<div class="dsm-wrapper"><table class="dsm-table">';

        // Header row
        html += '<tr><th class="dsm-corner"></th>';
        for (var j = 0; j < N; j++) {
            var n = sortedNodes[j];
            var name = n.name || n.id.split('/').pop();
            var sepCls = groupBounds[j] ? ' dsm-group-sep-col' : '';
            html += '<th class="dsm-col-hdr' + sepCls + '" data-idx="' + j + '" title="' + escapeHtml(n.id) + '"><span>' + escapeHtml(name) + '</span></th>';
        }
        html += '</tr>';

        // Data rows
        for (var i = 0; i < N; i++) {
            var ni = sortedNodes[i];
            var rowName = ni.name || ni.id.split('/').pop();
            var sepRow = groupBounds[i] ? ' dsm-group-sep-row' : '';
            html += '<tr class="' + sepRow + '">';
            html += '<th class="dsm-row-hdr" data-idx="' + i + '" title="' + escapeHtml(ni.id) + '">' + escapeHtml(rowName) + '</th>';

            for (var j = 0; j < N; j++) {
                var sepCls = groupBounds[j] ? ' dsm-group-sep-col' : '';
                if (i === j) {
                    html += '<td class="dsm-cell dsm-cell-diag' + sepCls + '"></td>';
                } else if (matrix[i][j]) {
                    // Check for bidirectional (cycle)
                    var isBidi = matrix[j][i] ? 1 : 0;
                    var color = isBidi ? 'rgba(255,100,100,0.5)' : 'rgba(88,166,255,0.35)';
                    html += '<td class="dsm-cell dsm-cell-dep' + sepCls + '" data-row="' + i + '" data-col="' + j + '" style="background:' + color + '">';
                    if (isBidi) html += '<span style="font-size:8px;color:#ff6b6b">↺</span>';
                    html += '</td>';
                } else {
                    html += '<td class="dsm-cell' + sepCls + '"></td>';
                }
            }
            html += '</tr>';
        }
        html += '</table></div>';

        container.innerHTML = html;

        // Tooltip
        if (!dsmTooltipEl) {
            dsmTooltipEl = document.createElement('div');
            dsmTooltipEl.className = 'dsm-tooltip';
            document.body.appendChild(dsmTooltipEl);
        }

        // Interactions: hover highlight row/col, tooltip
        container.addEventListener('mouseover', function (e) {
            var cell = e.target.closest('.dsm-cell');
            var rowHdr = e.target.closest('.dsm-row-hdr');
            var colHdr = e.target.closest('.dsm-col-hdr');

            // Clear previous highlights
            var prevRows = container.querySelectorAll('.dsm-highlight-row');
            for (var i = 0; i < prevRows.length; i++) prevRows[i].classList.remove('dsm-highlight-row');
            var prevCols = container.querySelectorAll('.dsm-highlight-col');
            for (var i = 0; i < prevCols.length; i++) prevCols[i].classList.remove('dsm-highlight-col');

            if (cell && cell.dataset.row !== undefined) {
                var ri = parseInt(cell.dataset.row);
                var ci = parseInt(cell.dataset.col);
                // Highlight row and column
                var rows = container.querySelectorAll('tr');
                if (rows[ri + 1]) rows[ri + 1].classList.add('dsm-highlight-row');
                // Highlight column cells
                for (var r = 0; r < rows.length; r++) {
                    var cells = rows[r].children;
                    if (cells[ci + 1]) cells[ci + 1].classList.add('dsm-highlight-col');
                }
                // Tooltip
                var srcNode = sortedNodes[ri];
                var tgtNode = sortedNodes[ci];
                var isBidi = matrix[ci] && matrix[ci][ri];
                dsmTooltipEl.innerHTML =
                    '<div class="dsm-tooltip-title">' + escapeHtml(srcNode.id) + '</div>' +
                    '<div class="dsm-tooltip-meta">→ depends on → <strong>' + escapeHtml(tgtNode.id) + '</strong>' +
                    (isBidi ? '<br><span style="color:#ff6b6b">↺ Circular dependency</span>' : '') +
                    '</div>';
                dsmTooltipEl.classList.add('visible');
            } else if (rowHdr) {
                var idx = parseInt(rowHdr.dataset.idx);
                var rows = container.querySelectorAll('tr');
                if (rows[idx + 1]) rows[idx + 1].classList.add('dsm-highlight-row');
                var n = sortedNodes[idx];
                dsmTooltipEl.innerHTML =
                    '<div class="dsm-tooltip-title">' + escapeHtml(n.id) + '</div>' +
                    '<div class="dsm-tooltip-meta">Fan-out: ' + (n.fanOut || 0) + ' · Fan-in: ' + (n.fanIn || 0) + '<br>' +
                    'Complexity: ' + (n.complexity || 0) + ' · LOC: ' + (n.linesOfCode || 0) + '</div>';
                dsmTooltipEl.classList.add('visible');
            } else if (colHdr) {
                var idx = parseInt(colHdr.dataset.idx);
                var rows = container.querySelectorAll('tr');
                for (var r = 0; r < rows.length; r++) {
                    var cells = rows[r].children;
                    if (cells[idx + 1]) cells[idx + 1].classList.add('dsm-highlight-col');
                }
                var n = sortedNodes[idx];
                dsmTooltipEl.innerHTML =
                    '<div class="dsm-tooltip-title">' + escapeHtml(n.id) + '</div>' +
                    '<div class="dsm-tooltip-meta">Fan-out: ' + (n.fanOut || 0) + ' · Fan-in: ' + (n.fanIn || 0) + '<br>' +
                    'Complexity: ' + (n.complexity || 0) + ' · LOC: ' + (n.linesOfCode || 0) + '</div>';
                dsmTooltipEl.classList.add('visible');
            } else {
                dsmTooltipEl.classList.remove('visible');
            }
        });

        container.addEventListener('mousemove', function (e) {
            if (dsmTooltipEl.classList.contains('visible')) {
                dsmTooltipEl.style.left = (e.clientX + 12) + 'px';
                dsmTooltipEl.style.top = (e.clientY + 12) + 'px';
            }
        });

        container.addEventListener('mouseleave', function () {
            if (dsmTooltipEl) dsmTooltipEl.classList.remove('visible');
            var prevRows = container.querySelectorAll('.dsm-highlight-row');
            for (var i = 0; i < prevRows.length; i++) prevRows[i].classList.remove('dsm-highlight-row');
            var prevCols = container.querySelectorAll('.dsm-highlight-col');
            for (var i = 0; i < prevCols.length; i++) prevCols[i].classList.remove('dsm-highlight-col');
        });

        // Click on dep cell → open source file
        container.addEventListener('click', function (e) {
            var cell = e.target.closest('.dsm-cell-dep');
            if (cell) {
                var ri = parseInt(cell.dataset.row);
                var nodeId = sortedNodes[ri].id;
                vscode.postMessage({ type: 'openFile', payload: { path: nodeId } });
            }
        });
    }

    // ============================================================
    // Table View
    // ============================================================
    var tableSortCol = 'loc';
    var tableSortAsc = false;
    var tableFilter = '';

    function renderTable() {
        var tbody = $('#table-body');
        if (!tbody || !graphData) return;

        var nodes = graphData.nodes || [];

        // Filter
        var filtered = nodes;
        if (tableFilter) {
            var lf = tableFilter.toLowerCase();
            filtered = nodes.filter(function (n) {
                return n.id.toLowerCase().indexOf(lf) !== -1 ||
                    (n.language || '').toLowerCase().indexOf(lf) !== -1 ||
                    (n.group || '').toLowerCase().indexOf(lf) !== -1;
            });
        }

        // Sort
        filtered.sort(function (a, b) {
            var va, vb;
            switch (tableSortCol) {
                case 'name': va = a.id.toLowerCase(); vb = b.id.toLowerCase(); break;
                case 'language': va = (a.language || '').toLowerCase(); vb = (b.language || '').toLowerCase(); break;
                case 'loc': va = a.linesOfCode || 0; vb = b.linesOfCode || 0; break;
                case 'complexity': va = a.complexity || 0; vb = b.complexity || 0; break;
                case 'fanIn': va = a.fanIn || 0; vb = b.fanIn || 0; break;
                case 'fanOut': va = a.fanOut || 0; vb = b.fanOut || 0; break;
                case 'symbols': va = (a.symbols ? a.symbols.totalSymbols : 0); vb = (b.symbols ? b.symbols.totalSymbols : 0); break;
                case 'group': va = (a.group || '').toLowerCase(); vb = (b.group || '').toLowerCase(); break;
                default: va = a.linesOfCode || 0; vb = b.linesOfCode || 0;
            }
            if (va < vb) return tableSortAsc ? -1 : 1;
            if (va > vb) return tableSortAsc ? 1 : -1;
            return 0;
        });

        // Update sort indicator
        var ths = document.querySelectorAll('.aura-table th');
        for (var i = 0; i < ths.length; i++) {
            ths[i].classList.remove('sorted-asc', 'sorted-desc');
            if (ths[i].dataset.col === tableSortCol) {
                ths[i].classList.add(tableSortAsc ? 'sorted-asc' : 'sorted-desc');
            }
        }

        // Build rows
        var html = '';
        for (var i = 0; i < filtered.length; i++) {
            var n = filtered[i];
            var color = LANGUAGE_COLORS[n.language] || '#888';
            var symCount = n.symbols ? n.symbols.totalSymbols : 0;
            html += '<tr data-id="' + escapeHtml(n.id) + '"' +
                (selectedNode && selectedNode.id === n.id ? ' class="selected"' : '') + '>' +
                '<td title="' + escapeHtml(n.id) + '">' + escapeHtml(n.id) + '</td>' +
                '<td><span class="lang-dot" style="background:' + color + '"></span>' + escapeHtml(n.language || '—') + '</td>' +
                '<td class="num">' + (n.linesOfCode || 0).toLocaleString() + '</td>' +
                '<td class="num">' + (n.complexity || 0) + '</td>' +
                '<td class="num">' + (n.fanIn || 0) + '</td>' +
                '<td class="num">' + (n.fanOut || 0) + '</td>' +
                '<td class="num">' + symCount + '</td>' +
                '<td>' + escapeHtml(n.group || '—') + '</td>' +
                '</tr>';
        }
        tbody.innerHTML = html;

        // Click handler — select node & open in editor on dblclick
        var rows = tbody.querySelectorAll('tr');
        for (var i = 0; i < rows.length; i++) {
            rows[i].addEventListener('click', (function (row) {
                return function () {
                    var allRows = tbody.querySelectorAll('tr');
                    for (var j = 0; j < allRows.length; j++) allRows[j].classList.remove('selected');
                    row.classList.add('selected');
                    // Pre-select so switching to graph tab highlights this node
                    var node = findNode(row.dataset.id);
                    if (node) selectedNode = node;
                };
            })(rows[i]));
            rows[i].addEventListener('dblclick', (function (row) {
                return function () {
                    vscode.postMessage({ type: 'openFile', payload: { path: row.dataset.id } });
                };
            })(rows[i]));
        }
    }

    function setupTableInteractions() {
        var ths = document.querySelectorAll('.aura-table th');
        for (var i = 0; i < ths.length; i++) {
            ths[i].addEventListener('click', (function (th) {
                return function () {
                    var col = th.dataset.col;
                    if (tableSortCol === col) {
                        tableSortAsc = !tableSortAsc;
                    } else {
                        tableSortCol = col;
                        tableSortAsc = col === 'name' || col === 'language' || col === 'group';
                    }
                    renderTable();
                };
            })(ths[i]));
        }

        var tableSearchInput = $('#table-search');
        if (tableSearchInput) {
            tableSearchInput.addEventListener('input', function () {
                tableFilter = this.value;
                renderTable();
            });
        }
    }

})();
