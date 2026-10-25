/**
 * app.js — Aura Visualizer (VSCode Webview Edition).
 * 
 * Adapted from Aura standalone: uses postMessage instead of fetch,
 * no landing overlay, supports VSCode integration (open file, focus node).
 */

(function() {
    'use strict';

    // VSCode API
    var vscode = acquireVsCodeApi();

    // ============================================================
    // State
    // ============================================================
    var graph = null;
    var graphData = null;
    var linkWidthNodeIndex = {};

    // ============================================================
    // Query overlay state — owned by query-ui.js, read by the render
    // accessors below. AuraQueryBar.state() returns a shared object (the Set is
    // a stable reference mutated in place; the flags are synced by the module).
    // ============================================================
    var EMPTY_QUERY_STATE = { active: false, mode: 'highlight', set: new Set() };
    function qsState() {
        return (window.AuraQueryBar && window.AuraQueryBar.state()) || EMPTY_QUERY_STATE;
    }

    var selectedNode = null;
    var hoveredNode = null;
    var lastHoverId = null;    // dedupe: 3d-force-graph re-fires hover after object rebuilds
    var highlightNodes = new Set();
    var highlightLinks = new Set();
    var activeLanguages = new Set(['c-source', 'c-header', 'cpp-source', 'cpp-header', 'javascript', 'typescript', 'python', 'css', 'html', 'java', 'go', 'rust', 'csharp', 'php', 'vue', 'bash', 'lua']);
    var dagMode = false;
    var showOrphans = false;
    var showDeadCode = false;
    var showCycles = false;
    var showDirtyOnly = false; // filter: only files with uncommitted changes
    var showNotes = true;      // show note indicators (pulsing ring + dot) on annotated files
    var showCentralityHalos = false; // show halos around the top PageRank files
    var centralityHaloIds = new Set();
    var centralityHaloThreshold = 0;
    var showStaleNotesOnly = false; // filter: only files whose note predates the file
    var staleNoteIds = new Set();
    var workingTree = {};      // workspace-relative path → git state (modified / untracked / …)
    var annotations = {};      // workspace-relative path → { text, color, updatedAt }
    var NOTE_COLORS = { yellow: '#fdd835', red: '#ef5350', blue: '#42a5f5', green: '#66bb6a', purple: '#ab47bc' };
    var warps = [];            // camera bookmarks — { id, name, pos, target, fov?, quickSlot? }
    var cycleNodeIds = new Set();
    var cycleLinkKeys = new Set();
    var multiSelectedNodes = new Set();
    var multiSelectedLinks = new Set();
    var showLabels = false;
    var nodeSizeMultiplier = 4;
    var spreadMultiplier = 1;
    var focusDepth = 1;
    var heatmapMode = 'off';
    var linkConfidenceMin = 0;
    var showGroups = false;
    var expandedGroups = new Set();
    var groupMeshes = [];
    var metricRanges = {};

    // Temporal coupling (co-change) — computed from the timeline commits.
    var cochangeResult = { pairs: [], windowDays: 365, commitsConsidered: 0, totalCommitsInWindow: 0, maxJaccard: 0 };
    var cochangeByNode = {};
    var cochangeWindowDays = 365;
    var cochangeMinScore = 0.2;
    var showCochangeLinks = false;

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

    // Directory filter (from Files panel checkboxes).
    // Empty means NO directory is checked → no files are shown (user clicked "None").
    var activeDirs = [];

    // Active tab
    var activeTab = 'graph';
    var graphPaused = false;

    // Follow editor — camera flies to the active file when the user switches
    // editors. A manual camera move pauses it until the 👁 button is clicked.
    var followEditorEnabled = (window.AURA_CONFIG && window.AURA_CONFIG.followEditor) !== false;
    var followEditorPaused = false;
    var followControls = null;
    var followControlsStartHandler = null;

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

    // HEAD snapshot for refresh/reset — the rest of the Time Travel state
    // (commits, deltas, diff sets, compare/impact flags) lives in timeline.js.
    var headGraphData = null;       // snapshot of graph at HEAD for reset

    var lastPointerX = -1;
    var lastPointerY = -1;

    // ============================================================
    // DOM References
    // ============================================================
    var $ = function(sel) { return document.querySelector(sel); };

    var graphContainer = $('#graph-container');
    var loadingOverlay = $('#loading-overlay');
    var detailPanel = $('#detail-panel');
    var explorerPanel = $('#explorer-panel');
    var toggleExplorerBtn = $('#btn-toggle-explorer');
    var explorerTree = $('#explorer-tree');
    var tooltip = $('#tooltip');
    // ============================================================
    // Time Travel overlay state — owned by timeline.js, read by the render
    // accessors below. AuraTimeline.state() returns a shared object: the sets
    // are stable references (mutated in place), the flags are synced by the
    // module. EMPTY_TT_STATE keeps the accessors safe before init.
    // ============================================================
    var EMPTY_TT_STATE = {
        active: false, compareMode: false, impactMode: false,
        changed: new Set(), addedNodes: new Set(), removedNodes: new Set(),
        modifiedNodes: new Set(), addedLinks: new Set(), removedLinks: new Set()
    };
    function ttState() {
        return (window.AuraTimeline && window.AuraTimeline.state()) || EMPTY_TT_STATE;
    }
    /** Commit list for the risk/churn side — lives in timeline.js now. */
    function timelineCommitsList() {
        return (window.AuraTimeline && window.AuraTimeline.getCommits()) || [];
    }
    /** Churn lookup — the index itself lives in risk.js (AuraRiskMap). */
    function getChurn(id) {
        return (window.AuraRiskMap && window.AuraRiskMap.getChurn(id)) || 0;
    }

    /** Strongest co-change Jaccard score for a file (0 outside a coupling pair). */
    function getCochangeScore(id) {
        return cochangeByNode[id] || 0;
    }

    // ============================================================
    // VSCode Message Handling
    // ============================================================
    window.addEventListener('message', function(event) {
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
                    if (message.payload.reveal && activeTab !== 'graph') {
                        switchTab('graph');
                        (function(nodeId) {
                            requestAnimationFrame(function() { focusNodeById(nodeId, true); });
                        })(message.payload.nodeId);
                    } else {
                        focusNodeById(message.payload.nodeId, !!message.payload.reveal);
                    }
                }
                break;
            case 'followEditor':
                if (message.payload && message.payload.nodeId) {
                    followNodeById(message.payload.nodeId);
                }
                break;
            case 'blastRadius':
                if (message.payload && message.payload.nodeId) {
                    if (activeTab !== 'graph') switchTab('graph');
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
                if (window.AuraTimeline) window.AuraTimeline.handleHistoryIndex(message.payload);
                refreshCochange();
                break;
            case 'historyProgress':
                if (window.AuraTimeline) window.AuraTimeline.handleHistoryProgress(message.payload);
                break;
            case 'historyDelta':
                if (window.AuraTimeline) window.AuraTimeline.handleHistoryDelta(message.payload);
                break;
            case 'graphConfig':
                if (message.payload) {
                    window.AURA_CONFIG = Object.assign({}, window.AURA_CONFIG || {}, message.payload);
                    if (window.AuraFlight) window.AuraFlight.configure(window.AURA_CONFIG);
                    if (typeof message.payload.followEditor === 'boolean') {
                        followEditorEnabled = message.payload.followEditor;
                        if (!followEditorEnabled) followEditorPaused = false;
                        updateFollowEditorButton();
                    }
                    applyLinkStyle();
                    if (typeof applySelectedNodeEffect === 'function') {
                        applySelectedNodeEffect();
                    }
                    refreshCameraControls();
                    // Risk window can change from the Settings UI — re-derive churn & scoring
                    var cfgWindow = window.AURA_CONFIG.riskWindow;
                    if (window.AuraRiskMap && typeof cfgWindow === 'number' &&
                        AuraRiskMap.normalizeWindow(cfgWindow) !== AuraRiskMap.getWindow()) {
                        AuraRiskMap.setWindow(cfgWindow);
                        var rwSelect = $('#risk-window');
                        if (rwSelect) rwSelect.value = String(AuraRiskMap.getWindow());
                        computeMetricRanges();
                        if (graphData && graphData.nodes) AuraRiskMap.renderRiskDashboard();
                        if (heatmapMode === 'churn' && graph) graph.nodeColor(graph.nodeColor());
                    }
                    if (graph && typeof graph.nodeThreeObject === 'function') {
                        graph.nodeThreeObject(graph.nodeThreeObject());
                    }
                }
                break;
            case 'riskFocusFile':
                if (window.AuraRiskMap && message.payload && message.payload.nodeId) {
                    window.AuraRiskMap.revealFile(message.payload.nodeId);
                }
                break;
            case 'showRiskTab':
                switchTab('risk');
                break;
            case 'workingTree':
                workingTree = (message.payload && message.payload.files) || {};
                if (window.AuraQueryBar) window.AuraQueryBar.refreshAfterDataChange();
                // Keep the detail panel's Git line in sync (rings rebuild above)
                if (selectedNode && !selectedNode._isCluster && !selectedNode._isSymbol) {
                    var gitState = dirtyStateOf(selectedNode);
                    var gitEl = $('#panel-git');
                    if (gitEl) {
                        gitEl.textContent = gitState ? (GIT_STATE_LABELS[gitState] || gitState) : '—';
                        gitEl.style.color = gitState ? '#ffb300' : '';
                    }
                }
                break;
            case 'annotations':
                annotations = (message.payload && message.payload.notes) || {};
                updateStaleNotesUI();
                if (window.AuraQueryBar) window.AuraQueryBar.refreshAfterDataChange();
                if (selectedNode && !selectedNode._isCluster && !selectedNode._isSymbol) {
                    if (window.AuraDetail) window.AuraDetail.refreshEditor(selectedNode);
                }
                break;
            case 'warps':
                warps = (message.payload && Array.isArray(message.payload.warps)) ? message.payload.warps : [];
                if (window.AuraWarps) window.AuraWarps.render();
                break;
            case 'flowData':
                if (window.AuraFlowView) window.AuraFlowView.receive(message.payload);
                break;
            case 'applyQuery':
                if (window.AuraQueryBar && message.payload && typeof message.payload.expr === 'string') {
                    window.AuraQueryBar.applyFromHost(message.payload.expr, message.payload.mode);
                }
                break;
            case 'savedQueries':
                if (window.AuraQueryBar && message.payload && Array.isArray(message.payload.queries)) {
                    window.AuraQueryBar.setSavedQueries(message.payload.queries);
                }
                break;
            case 'captureGraphImage':
                if (window.AuraExport) window.AuraExport.capture(message.payload);
                break;
            case 'restoreViewState':
                if (message.payload) applyViewState(message.payload);
                viewStateReady = true;
                break;
            case 'chatChunk':
            case 'chatDone':
            case 'chatError':
            case 'chatTool':
                if (window.AuraChat) window.AuraChat.handleHostMessage(message.type, message.payload);
                break;
        }
    });

    // Tell the extension we're ready
    vscode.postMessage({ type: 'ready' });


    // ============================================================
    // Initialization
    // ============================================================
    function init() {
        // Satellite modules — inject live-state hooks (getters, so no staleness)
        if (window.AuraChat) {
            AuraChat.init({
                postMessage: function (msg) { vscode.postMessage(msg); },
                focusNode: focusNodeById
            });
        }
        if (window.AuraPanels) {
            AuraPanels.init({
                getGraph: function () { return graph; },
                getActiveTab: function () { return activeTab; },
                getCommunityMap: function () { return communityMap; },
                getCommunityColors: function () { return communityColors; },
                getMetricRanges: function () { return metricRanges; },
                getGraphData: function () { return graphData; },
                showCommunityPalette: showCommunityPalette,
                hideCommunityPalette: hideCommunityPalette,
                selectNode: handleNodeClick
            });
            AuraPanels.setupSearch();
        }
        if (window.AuraTimeline) {
            AuraTimeline.init({
                getGraph: function () { return graph; },
                getGraphData: function () { return graphData; },
                getHeadGraphData: function () { return headGraphData; },
                getActiveTab: function () { return activeTab; },
                getHeatmapMode: function () { return heatmapMode; },
                filterGraphData: filterGraphData,
                computeMetricRanges: function () { computeMetricRanges(); },
                computeChurnIndex: function () { if (window.AuraRiskMap) AuraRiskMap.computeChurnIndex(); },
                renderRiskDashboard: function () { if (window.AuraRiskMap) AuraRiskMap.renderRiskDashboard(); },
                refreshGraphVisuals: function () { refreshGraphVisuals(); },
                refreshGraphColors: function () { refreshGraphColors(); },
                refreshFocusVisuals: refreshFocusVisuals,
                clearPinnedFocus: clearPinnedFocus,
                findNode: findNode,
                startMultiNodeBlast: startMultiNodeBlast
            });
        }
        setupFilters();
        if (window.AuraSprites) {
            AuraSprites.init({
                getNoteColors: function () { return NOTE_COLORS; }
            });
        }
        if (window.AuraStructure) {
            AuraStructure.init({
                getGraph: function () { return graph; }, getGraphData: function () { return graphData; },
                getFocusDepth: function () { return focusDepth; }, findNode: findNode,
                refreshFocusVisuals: refreshFocusVisuals,
                setBlastMode: function (v) { blastMode = v; }, setPinnedNode: function (v) { pinnedNode = v; },
                getPinnedNodes: function () { return pinnedNodes; }, getPinnedLinks: function () { return pinnedLinks; },
                setBlastDepths: function (v) { blastDepths = v; },
                getExplodedNode: function () { return explodedNode; }, setExplodedNode: function (v) { explodedNode = v; },
                getExplosionData: function () { return explosionData; }, setExplosionData: function (v) { explosionData = v; },
                setHoveredSymbolId: function (v) { hoveredSymbolId = v; },
                getShowGroups: function () { return showGroups; }, setShowGroups: function (v) { showGroups = v; },
                getExpandedGroups: function () { return expandedGroups; }, applyFilters: applyFilters
            });
        }
        if (window.AuraExport) {
            AuraExport.init({
                getGraph: function () { return graph; },
                getContainer: function () { return graphContainer; },
                postMessage: function (msg) { vscode.postMessage(msg); }
            });
        }
        if (window.AuraDetail) {
            AuraDetail.init({
                getGraphData: function () { return graphData; },
                getSelectedNode: function () { return selectedNode; },
                setSelectedNode: function (n) { selectedNode = n; },
                getMultiSelectedNodes: function () { return multiSelectedNodes; },
                getMultiSelectedLinks: function () { return multiSelectedLinks; },
                clearMultiSelection: function () {
                    multiSelectedNodes.clear();
                    multiSelectedLinks.clear();
                },
                getExplodedNode: function () { return explodedNode; },
                getCommunityMap: function () { return communityMap; },
                getCommunityNames: function () { return communityNames; },
                getCommunityColors: function () { return communityColors; },
                getActiveTab: function () { return activeTab; },
                getHeatmapMode: function () { return heatmapMode; },
                getQueryExpression: function () { return (window.AuraQueryBar && window.AuraQueryBar.getExpression) ? window.AuraQueryBar.getExpression() : ''; },
                getNoteColors: function () { return NOTE_COLORS; },
                getGitStateLabels: function () { return GIT_STATE_LABELS; },
                getAnnotation: annotationOf,
                dirtyStateOf: dirtyStateOf,
                selectNode: handleNodeClick,
                explodeFile: explodeFile,
                collapseExplosion: collapseExplosion,
                startFlowTrace: startFlowTrace,
                updateExplorerSelection: updateExplorerSelection,
                refreshGraphVisuals: function () { refreshGraphVisuals(); },
                postMessage: function (msg) { vscode.postMessage(msg); }
            });
            AuraDetail.setup();
        }
        setupRefresh();
        setupFollowEditor();
        setupExplorer();
        if (window.AuraTimeline) AuraTimeline.setup();
        setupTabs();
        if (window.AuraQueryBar) {
            AuraQueryBar.init({
                getGraphData: function () { return graphData; },
                getGraph: function () { return graph; },
                getAnnotations: function () { return annotations; },
                getWorkingTree: function () { return workingTree; },
                getCommunityMap: function () { return communityMap; },
                getCommunityNames: function () { return communityNames; },
                getCycleNodeIds: function () { return cycleNodeIds; },
                getMultiSelectedNodes: function () { return multiSelectedNodes; },
                getPinnedNodes: function () { return pinnedNodes; },
                getCochangeScore: getCochangeScore,
                postMessage: function (msg) { vscode.postMessage(msg); }
            });
            AuraQueryBar.setup();
        }
        if (window.AuraChat) AuraChat.setup();
        if (window.AuraRiskMap) {
            AuraRiskMap.init({
                getGraphData: function () { return graphData; },
                getGraph: function () { return graph; },
                postMessage: function (msg) { vscode.postMessage(msg); },
                selectNode: handleNodeClick,
                findNode: findNode,
                focusNode: focusNodeFromView,
                showGraphTab: function () { switchTab('graph'); },
                showRiskTab: function () { switchTab('risk'); },
                getHeatmapMode: function () { return heatmapMode; },
                refreshGraphColors: function () { refreshGraphColors(); },
                computeMetricRanges: function () { computeMetricRanges(); }
            });
            AuraRiskMap.setup();
        }
        setupBottomBarsOffset();
        vscode.postMessage({ type: 'requestSavedQueries' });
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
        lastHoverId = null; // the new dataset requires a fresh hover pass

        graphData = data;
        buildLinkWidthIndex();

        // Re-evaluate active query against the new dataset
        if (window.AuraQueryBar) AuraQueryBar.onGraphData();

        headGraphData = JSON.parse(JSON.stringify(data));
        computeMetricRanges();
        computeCommunities();
        updateStats(graphData.meta);
        updateLanguageButtons(graphData.nodes);
        if (window.AuraRiskMap) AuraRiskMap.renderRiskDashboard();
        try {
            initGraph(graphData);
            // Apply the persisted link style + selected-node effect to the new graph
            applyLinkStyle();
            applySelectedNodeEffect();
        } catch (e) {
            console.error('[aura] initGraph error:', e);
        }
        // Hide overlay after the graph has rendered its first frame
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                if (loadingOverlay) {
                    loadingOverlay.style.display = 'none';
                }
            });
        });
        buildExplorerTree(graphData.nodes);
        // Refresh saved queries now that DB is definitely open
        try { vscode.postMessage({ type: 'requestSavedQueries' }); } catch (_) { /* noop */ }
        updateStaleNotesUI();
        // Temporal coupling depends on both the graph (files + links) and the
        // timeline commits; either message can arrive second.
        refreshCochange();
        // Request saved view state from extension (pull model — guarantees graph is ready)
        vscode.postMessage({ type: 'requestViewState' });
        // Safety net: if no state is stored (fresh workspace) or the host never
        // answers, re-enable saving after a grace period.
        setTimeout(function() { viewStateReady = true; }, 5000);
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

        if (delta.functionCalls) {
            graphData.functionCalls = delta.functionCalls;
        }

        buildLinkWidthIndex();

        // Update meta
        if (delta.meta) graphData.meta = delta.meta;

        // Recompute ranges and stats
        computeMetricRanges();
        updateStats(graphData.meta);

        // Re-feed filtered data to the graph — preserve positions: no synchronous
        // warmup, no live engine run either (budgets restored right after the feed).
        graph.warmupTicks(0);
        graph.cooldownTicks(0);
        graph.graphData(filterGraphData(graphData));
        setTimeout(function () { applyEngineBudget(); }, 200);

        // Update language buttons
        updateLanguageButtons(graphData.nodes, true);

        // Update explorer
        buildExplorerTree(graphData.nodes);

        // Clear label cache for changed nodes
        for (var ci = 0; ci < changedNodes.length; ci++) {
            if (window.AuraSprites) AuraSprites.invalidateLabel(changedNodes[ci].name);
        }

        // Hide loading overlay (refresh complete)
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
        updateStaleNotesUI();

    }

    function setupRefresh() {
        var btn = $('#btn-refresh');
        if (btn) {
            btn.addEventListener('click', function() {
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
            exportBtn.addEventListener('click', function() {
                vscode.postMessage({ type: 'requestExport' });
            });
        }

        // Help modal
        var helpBtn = $('#btn-help');
        var helpModal = $('#help-modal');
        var helpClose = $('#help-modal-close');
        if (helpBtn && helpModal) {
            helpBtn.addEventListener('click', function() {
                helpModal.classList.toggle('hidden');
            });
            if (helpClose) {
                helpClose.addEventListener('click', function() {
                    helpModal.classList.add('hidden');
                });
            }
            helpModal.addEventListener('click', function(e) {
                if (e.target === helpModal) helpModal.classList.add('hidden');
            });
        }

        // Settings modal (⚙️ next to the query toggle)
        var settingsToggleBtn = $('#settings-toggle');
        var settingsModalEl = $('#settings-modal');
        if (settingsToggleBtn && settingsModalEl) {
            settingsToggleBtn.addEventListener('click', function() {
                populateSettingsModal();
                settingsModalEl.classList.remove('hidden');
            });
            var settingsCloseBtn = $('#settings-modal-close');
            if (settingsCloseBtn) {
                settingsCloseBtn.addEventListener('click', function() {
                    settingsModalEl.classList.add('hidden');
                });
            }
            settingsModalEl.addEventListener('click', function(e) {
                if (e.target === settingsModalEl) settingsModalEl.classList.add('hidden');
            });
            var openVscodeSettings = $('#settings-open-vscode');
            if (openVscodeSettings) {
                openVscodeSettings.addEventListener('click', function() {
                    vscode.postMessage({ type: 'openSettings' });
                });
            }
            var speedSliderEl = $('#set-rotateSpeed');
            var speedValueEl = $('#set-rotateSpeed-value');
            if (speedSliderEl && speedValueEl) {
                speedSliderEl.addEventListener('input', function() {
                    speedValueEl.textContent = parseFloat(this.value).toFixed(1);
                });
            }
            var settingControls = settingsModalEl.querySelectorAll('[data-setting]');
            for (var sc = 0; sc < settingControls.length; sc++) {
                settingControls[sc].addEventListener('change', function() {
                    var key = this.dataset.setting;
                    var value;
                    if (this.type === 'checkbox') value = this.checked;
                    else if (this.type === 'number' || this.type === 'range') value = parseFloat(this.value);
                    else value = this.value;
                    vscode.postMessage({ type: 'updateSetting', payload: { key: key, value: value } });
                });
            }
        }

        /** Push the current AURA_CONFIG values into the settings modal controls. */
        function populateSettingsModal() {
            var cfg = window.AURA_CONFIG || {};
            var modal = $('#settings-modal');
            if (!modal) return;
            var controls = modal.querySelectorAll('[data-setting]');
            for (var i = 0; i < controls.length; i++) {
                var el = controls[i];
                var v = cfg[el.dataset.setting];
                if (v === undefined) continue;
                if (el.type === 'checkbox') el.checked = !!v;
                else el.value = String(v);
            }
            var sliderEl = $('#set-rotateSpeed');
            var sliderValEl = $('#set-rotateSpeed-value');
            if (sliderEl && sliderValEl) {
                sliderValEl.textContent = parseFloat(sliderEl.value || '1').toFixed(1);
            }
        }

        // Minimap toggle
        var minimapBtn = $('#btn-minimap');
        var minimapEl = $('#minimap');
        var minimapClose = $('#minimap-close');
        if (minimapBtn && minimapEl) {
            minimapBtn.addEventListener('click', function() {
                minimapEl.classList.toggle('hidden');
                minimapBtn.classList.toggle('active', !minimapEl.classList.contains('hidden'));
                saveViewState();
            });
            if (minimapClose) {
                minimapClose.addEventListener('click', function() {
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
            cognitive:  { min: Infinity, max: -Infinity },
            fanIn:      { min: Infinity, max: -Infinity },
            fanOut:     { min: Infinity, max: -Infinity },
            loc:        { min: Infinity, max: -Infinity },
            churn:      { min: Infinity, max: -Infinity },
            lastModified: { min: Infinity, max: -Infinity },
            cochange:   { min: 0, max: 0 }
        };

        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            metricRanges.complexity.min = Math.min(metricRanges.complexity.min, n.complexity || 1);
            metricRanges.complexity.max = Math.max(metricRanges.complexity.max, n.complexity || 1);
            var cog = typeof n.cognitive === 'number' ? n.cognitive : 0;
            metricRanges.cognitive.min = Math.min(metricRanges.cognitive.min, cog);
            metricRanges.cognitive.max = Math.max(metricRanges.cognitive.max, cog);
            metricRanges.fanIn.min = Math.min(metricRanges.fanIn.min, n.fanIn);
            metricRanges.fanIn.max = Math.max(metricRanges.fanIn.max, n.fanIn);
            metricRanges.fanOut.min = Math.min(metricRanges.fanOut.min, n.fanOut);
            metricRanges.fanOut.max = Math.max(metricRanges.fanOut.max, n.fanOut);
            metricRanges.loc.min = Math.min(metricRanges.loc.min, n.linesOfCode);
            metricRanges.loc.max = Math.max(metricRanges.loc.max, n.linesOfCode);
            var mtime = n.lastModified || 0;
            metricRanges.lastModified.min = Math.min(metricRanges.lastModified.min, mtime);
            metricRanges.lastModified.max = Math.max(metricRanges.lastModified.max, mtime);
            var ch = getChurn(n.id) || getChurn(n.path);
            metricRanges.churn.min = Math.min(metricRanges.churn.min, ch);
            metricRanges.churn.max = Math.max(metricRanges.churn.max, ch);
            var cc = getCochangeScore(n.id);
            metricRanges.cochange.min = Math.min(metricRanges.cochange.min, cc);
            metricRanges.cochange.max = Math.max(metricRanges.cochange.max, cc);
        }
        rebuildCentralityHaloSet();
    }

    /** Halo only the top 10% PageRank files, so the graph stays readable. */
    function rebuildCentralityHaloSet() {
        centralityHaloIds = new Set();
        centralityHaloThreshold = 0;
        if (!graphData) return;
        var ranked = [];
        for (var i = 0; i < graphData.nodes.length; i++) {
            var node = graphData.nodes[i];
            if (typeof node.pagerank === 'number' && node.pagerank > 0) ranked.push(node);
        }
        if (ranked.length === 0) return;
        ranked.sort(function(a, b) { return (b.pagerank || 0) - (a.pagerank || 0); });
        var count = Math.max(1, Math.ceil(ranked.length * 0.10));
        centralityHaloThreshold = ranked[count - 1].pagerank || 0;
        for (var r = 0; r < count; r++) centralityHaloIds.add(ranked[r].id);
    }

    function normalizeMetric(value, metric) {
        var range = metricRanges[metric];
        if (!range || range.max === range.min) return 0;
        return (value - range.min) / (range.max - range.min);
    }

    function buildLinkWidthIndex() {
        linkWidthNodeIndex = {};
        var nodes = graphData ? graphData.nodes : null;
        if (!nodes) return;
        for (var i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            linkWidthNodeIndex[n.id] = { fanIn: n.fanIn || 0, fanOut: n.fanOut || 0 };
        }
    }

    /**
     * Recompute temporal coupling from the timeline commits. The pure engine
     * (cochange.ts) is bundled as window.AuraCochange, so the host, MCP and
     * webview share exactly the same pair/Jaccard logic.
     */
    function refreshCochange() {
        cochangeByNode = {};
        if (!graphData || !window.AuraCochange) {
            cochangeResult = { pairs: [], windowDays: cochangeWindowDays, commitsConsidered: 0, totalCommitsInWindow: 0, maxJaccard: 0 };
            return;
        }
        var linkedPairs = [];
        for (var i = 0; i < graphData.links.length; i++) {
            var l = graphData.links[i];
            var source = typeof l.source === 'object' ? l.source.id : l.source;
            var target = typeof l.target === 'object' ? l.target.id : l.target;
            if (source && target) linkedPairs.push([source, target]);
        }
        cochangeResult = AuraCochange.computeCochange(timelineCommitsList(), {
            windowDays: cochangeWindowDays,
            now: Date.now(),
            minCochanges: 2,
            minJaccard: cochangeMinScore,
            maxFilesPerCommit: 50,
            maxPairs: 400,
            linkedPairs: linkedPairs,
            allowedPaths: graphData.nodes.map(function(node) { return node.id; })
        });
        for (var p = 0; p < cochangeResult.pairs.length; p++) {
            var pair = cochangeResult.pairs[p];
            cochangeByNode[pair.a] = Math.max(cochangeByNode[pair.a] || 0, pair.jaccard);
            cochangeByNode[pair.b] = Math.max(cochangeByNode[pair.b] || 0, pair.jaccard);
        }
        computeMetricRanges();
        if (heatmapMode === 'cochange' && graph) graph.nodeColor(graph.nodeColor());
        if (showCochangeLinks && graph) applyFilters();
        if (activeTab === 'coupling' && window.AuraViews) AuraViews.renderCoupling();
    }

    function setCochangeOptions(options) {
        if (options && typeof options.windowDays === 'number' && options.windowDays > 0) {
            cochangeWindowDays = options.windowDays;
        }
        if (options && typeof options.minScore === 'number') {
            cochangeMinScore = Math.max(0, Math.min(1, options.minScore));
        }
        refreshCochange();
        saveViewState();
    }

    /** Show the top co-change pairs as virtual links on the 3D graph. */
    function showCochangeOnGraph() {
        if (!cochangeResult.pairs.length) return;
        showCochangeLinks = true;
        var btn = $('#btn-cochange-links');
        if (btn) btn.classList.add('active');
        applyFilters();
        switchTab('graph');
        saveViewState();
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
        var sortedKeys = Object.keys(commFiles).map(Number).sort(function(a, b) { return a - b; });
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
            communityNames[ci2] = { name: isOthers ? 'Others' : nameCommunity(files), files: files.map(function(f) { return f.id; }) };
        }
    }

    function nameCommunity(files) {
        if (files.length === 0) return '?';
        // Hub file: highest fan-in in the community
        var hub = files[0];
        for (var h = 1; h < files.length; h++) {
            if ((files[h].fanIn || 0) > (hub.fanIn || 0)) hub = files[h];
        }
        return String(hub.name || hub.id || '?').replace(/\.[^.]+$/, '');
    }

    function buildCommunityList() {
        var list = $('#community-list');
        if (!list) return;
        list.innerHTML = '';

        // Sort communities by file count descending
        var ids = Object.keys(communityNames).map(Number);
        ids.sort(function(a, b) {
            return (communityNames[b].files.length) - (communityNames[a].files.length);
        });

        for (var i = 0; i < ids.length; i++) {
            (function(cid) {
                var info = communityNames[cid];
                var item = document.createElement('div');
                item.className = 'community-item' + (activeCommunities.has(cid) ? '' : ' dimmed');
                item.innerHTML =
                    '<span class="community-swatch" style="background:' + (communityColors[cid] || '#888') + '"></span>' +
                    '<span class="community-name">' + escapeHtml(info.name) + '</span>' +
                    '<span class="community-count">' + info.files.length + '</span>';
                var askBtn = document.createElement('button');
                askBtn.type = 'button';
                askBtn.className = 'community-ask';
                askBtn.title = 'Ask Aura about this community';
                askBtn.textContent = '✨';
                askBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    vscode.postMessage({
                        type: 'askAura',
                        payload: {
                            prompt: 'Explain the community "' + info.name + '" (' + info.files.length + ' files): its architectural role, hub files, internal coupling and boundaries. Use at most 3 Aura tools, then write the answer and cite files.',
                            context: { tab: 'graph', filters: { community: info.name, files: info.files.slice(0, 50) } }
                        }
                    });
                });
                item.appendChild(askBtn);
                item.addEventListener('click', function() {
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
    /**
     * Apply the "Link style" setting (straight / curved) to the graph.
     * Must run on every graph init: `graphConfig` messages only arrive when the
     * setting *changes*, so a value saved before launch never reached the graph.
     */
    function applyLinkStyle() {
        if (!graph || typeof graph.linkCurvature !== 'function') return;
        var cfg = window.AURA_CONFIG || {};
        graph.linkCurvature(cfg.linkStyle === 'curved'
            ? (typeof cfg.linkCurvature === 'number' ? cfg.linkCurvature : 0.25)
            : 0);
        applyEngineBudget();
    }

    /**
     * Engine budgets depend on the link style. Curved links are tube meshes whose
     * geometry is rebuilt from scratch on EVERY engine tick (per link, per frame,
     * in three-forcegraph) — a live run collapses the frame rate for its whole
     * duration (up to cooldownTime = 15 s), which also slows the link particles
     * since they advance per frame. Curved mode therefore settles entirely in the
     * synchronous warmup and never ticks live; straight links keep the cheap
     * smooth frame-run settle. These props are read at feed/tick time.
     */
    function applyEngineBudget() {
        if (!graph || typeof graph.warmupTicks !== 'function') return;
        var curved = (window.AURA_CONFIG || {}).linkStyle === 'curved';
        graph.warmupTicks(curved ? 220 : 100);
        graph.cooldownTicks(curved ? 0 : 200);
        graph.cooldownTime(curved ? 0 : 15000);
    }

    /**
     * Re-heat the simulation with a short, bounded live settle (spread slider,
     * DAG off). Curved mode temporarily lifts its no-live-tick budget so the
     * change is visible, then restores it.
     */
    function reheatWithSettle() {
        if (!graph) return;
        var curved = (window.AURA_CONFIG || {}).linkStyle === 'curved';
        if (curved) {
            graph.cooldownTicks(120);
            graph.cooldownTime(6000);
        }
        graph.d3ReheatSimulation();
        if (curved) {
            setTimeout(function () { applyEngineBudget(); }, 6500);
        }
    }

    // ============================================================
    // Pointer-release self-healing (listeners registered in initGraph)
    // ============================================================
    var canvasPointerDown = false;
    var canvasPointerId = 1;

    function onCanvasPointerDownHeal(e) {
        canvasPointerDown = true;
        canvasPointerId = e.pointerId;
    }

    function onCanvasPointerUpHeal() {
        canvasPointerDown = false;
    }

    /**
     * A press started on the canvas but its release never reached this document
     * (mouse released over the VS Code UI outside the webview). Reset both the
     * 3d-force-graph press state and TrackballControls with a synthetic
     * pointerup so the next click works again. The library early-returns for
     * click dispatch when a drag was in progress, so this never fires a click.
     */
    function healMissedPointerUp() {
        if (!canvasPointerDown) return;
        canvasPointerDown = false;
        var canvas = graphContainer ? graphContainer.querySelector('canvas') : null;
        if (!canvas) return;
        try {
            canvas.dispatchEvent(new PointerEvent('pointerup', {
                bubbles: true,
                cancelable: false,
                pointerId: canvasPointerId,
                pointerType: 'mouse',
                button: 0,
                buttons: 0,
                isPrimary: true
            }));
        } catch (e) { /* PointerEvent unsupported — nothing to do */ }
    }

    function onHealCheckMove(e) {
        if (!canvasPointerDown) return;
        // Buttons all released but no pointerup was seen on the canvas: the
        // release happened outside the webview and never reached us.
        if (e.buttons === 0) healMissedPointerUp();
    }

    function onHealCheckDown(e) {
        if (!canvasPointerDown) return;
        if (e.pointerType !== 'mouse') return; // touch pointers have implicit capture
        // A new mouse press starts while we still track the old one: the old
        // release was missed — close it first so this press behaves normally.
        healMissedPointerUp();
    }

    function onHealCheckUp(e) {
        if (!canvasPointerDown) return;
        // A pointerup landed elsewhere in the document without being captured
        // and retargeted through the graph container.
        if (graphContainer && e.target && !graphContainer.contains(e.target)) {
            healMissedPointerUp();
        }
    }

    function initGraph(data) {
        if (typeof ForceGraph3D === 'undefined') {
            console.error('[aura] ForceGraph3D not loaded!');
            return;
        }
        var filtered = filterGraphData(data);

        // Destroy previous graph if any
        detachFollowControls();
        if (graph) {
            graph._destructor && graph._destructor();
        }

        graph = ForceGraph3D({ rendererConfig: { preserveDrawingBuffer: true, alpha: true } })(graphContainer)
            .graphData(filtered)
            .nodeId('id')
            .nodeLabel('')
            .nodeColor(function(node) { return getNodeColor(node); })
            .nodeRelSize(1)
            .nodeVal(function(node) { return getNodeSize(node); })
            .nodeVisibility(function(node) {
                var qs = qsState();
                if (qs.active && qs.mode === 'filter' && !qs.set.has(node.id)) return false;
                if (showDirtyOnly && !dirtyStateOf(node)) return false;
                if (showStaleNotesOnly && !staleNoteIds.has(node.id)) return false;
                return true;
            })
            .nodeOpacity(0.92)
            .nodeThreeObjectExtend(true)
            .nodeThreeObject(function(node) {
                var T = window.THREE;
                var ts = ttState();
                var isSelected = (selectedNode && selectedNode.id === node.id) || multiSelectedNodes.has(node);
                var isBlastSource = blastMode && pinnedNode && (node.id === pinnedNode.id || (ts.impactMode && blastDepths[node.id] === 0));
                var dirtyState = dirtyStateOf(node);
                var noteInfo = showNotes ? annotationOf(node) : null;
                var isCentral = showCentralityHalos && centralityHaloIds.has(node.id);
                // Rings must follow the node's dim state (query highlight, pin/blast,
                // cycles…): derive the factor from the node color so they always agree.
                // Only computed when a ring is actually drawn — avoids a second
                // getNodeColor() call for every plain node on each rebuild.
                var dimFactor = (dirtyState || noteInfo || isCentral) ? colorAlpha(getNodeColor(node)) : 1;
                var hasLabel = showLabels &&
                    !(showOrphans && (node.fanIn > 0 || node.fanOut > 0)) &&
                    !(showDeadCode && !(node.deadExports && node.deadExports.length > 0)) &&
                    !(showCycles && !cycleNodeIds.has(node.id)) &&
                    !(pinnedNode && !pinnedNodes.has(node)) &&
                    !(heatmapMode === 'community' && activeCommunities.size < Object.keys(communityNames).length &&
                      (communityMap[node.id] === undefined || !activeCommunities.has(communityMap[node.id]))) &&
                    !(flowTraceMode && !flowTraceNodes.has(node.id)) &&
                    !(ts.active && ts.compareMode && ts.changed.size > 0 && !ts.changed.has(node.id));

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

                if (!isSelected && !hasLabel && !isBlastSource && !dirtyState && !noteInfo && !isCentral) return null;

                var group = new T.Group();
                var baseScale = Math.cbrt(getNodeSize(node) || 1) * 8;

                // Centrality halo — only the top PageRank files, deliberately
                // softer than the dirty/note rings so the graph stays readable.
                if (isCentral && dimFactor > 0.02) {
                    var centralityHaloRadius = baseScale * 2.4;
                    var centralityHaloGeo = new T.SphereGeometry(centralityHaloRadius, 20, 20);
                    var centralityHaloMat = new T.MeshBasicMaterial({
                        color: 0x8b5cf6,
                        transparent: true,
                        opacity: 0.10,
                        blending: T.AdditiveBlending,
                        depthWrite: false
                    });
                    group.add(new T.Mesh(centralityHaloGeo, centralityHaloMat));
                }

                // Git dirty ring — amber circle around files with uncommitted changes
                if (dirtyState && dimFactor > 0.02) {
                    var ring = getDirtyRingSprite();
                    if (ring) {
                        ring.scale.set(baseScale, baseScale, 1);
                        ring.material.opacity = dimFactor;
                        group.add(ring);
                    }
                }

                // Note indicator — breathing note-colored ring + dot for annotated files.
                // The motion is what makes notes stand out at any zoom, whatever else glows.
                if (noteInfo && dimFactor > 0.02) {
                    var noteRing = getNoteRingSprite(noteInfo.color);
                    if (noteRing) {
                        attachNotePulse(noteRing, baseScale, dimFactor);
                        group.add(noteRing);
                    }
                    var noteDot = getNoteDotSprite(noteInfo.color);
                    if (noteDot) {
                        attachNotePulse(noteDot, baseScale, dimFactor);
                        group.add(noteDot);
                    }
                }

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

                // Selected-node highlight: either soft additive halo ("glow")
                // or a bright emissive core picked up by UnrealBloomPass ("bloom").
                if (isSelected) {
                    var nodeRadius = Math.cbrt(getNodeSize(node) || 1) * 1;
                    var auraCfg = window.AURA_CONFIG || {};
                    var effect = auraCfg.selectedNodeEffect === 'bloom' ? 'bloom' : 'glow';

                    if (effect === 'bloom') {
                        // Bright emissive sphere on BLOOM_LAYER — only this mesh
                        // is rendered into the offscreen bloom buffer.
                        var bloomColorStr = getNodeColor(node) || '#93c5fd';
                        var bloomColor;
                        try {
                            bloomColor = new T.Color(bloomColorStr);
                        } catch (e) {
                            bloomColor = new T.Color(0x93c5fd);
                        }
                        var bloomGeo = new T.SphereGeometry(nodeRadius * 1.6, 24, 24);
                        var bloomMat = new T.MeshBasicMaterial({
                            color: bloomColor,
                            transparent: false
                        });
                        var bloomMesh = new T.Mesh(bloomGeo, bloomMat);
                        bloomMesh.layers.enable(BLOOM_LAYER);
                        group.add(bloomMesh);
                    } else {
                        // Glow mode: soft additive halo (no post-processing)
                        var glowGeo = new T.SphereGeometry(nodeRadius * 3, 16, 16);
                        var glowMat = new T.MeshBasicMaterial({
                            color: 0x60a5fa,
                            transparent: true,
                            opacity: 0.25,
                            blending: T.AdditiveBlending,
                            depthWrite: false
                        });
                        group.add(new T.Mesh(glowGeo, glowMat));

                        var coreGeo = new T.SphereGeometry(nodeRadius * 1.8, 16, 16);
                        var coreMat = new T.MeshBasicMaterial({
                            color: 0x93c5fd,
                            transparent: true,
                            opacity: 0.4,
                            blending: T.AdditiveBlending,
                            depthWrite: false
                        });
                        group.add(new T.Mesh(coreGeo, coreMat));
                    }
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
            .linkVisibility(function(link) { return getLinkVisibility(link); })
            .linkColor(function(link) { return getLinkColor(link); })
            .linkWidth(getLinkWidth)
            .linkOpacity(0.4)
            .linkDirectionalArrowLength(function(link) {
                // In compare mode, hide arrows unless both endpoints are changed
                var ts = ttState();
                if (ts.active && ts.compareMode && ts.changed.size > 0) {
                    var aaSrc = typeof link.source === 'object' ? link.source.id : link.source;
                    var aaTgt = typeof link.target === 'object' ? link.target.id : link.target;
                    if (!(ts.changed.has(aaSrc) && ts.changed.has(aaTgt))) return 0;
                }
                if (link.type === 'extends' || link.type === 'implements') return 5;
                if (link.type === 'doc-reference') return 0;
                return 3;
            })
            .linkDirectionalArrowRelPos(1)
            .linkDirectionalParticles(function(link) {
                if (link && link._cochange) return 4;
                var ts = ttState();
                if (link._isCallEdge) {
                    if (!hoveredSymbolId) return 0;
                    var cpSrc = typeof link.source === 'object' ? link.source.id : link.source;
                    var cpTgt = typeof link.target === 'object' ? link.target.id : link.target;
                    return (cpSrc === hoveredSymbolId || cpTgt === hoveredSymbolId) ? 3 : 0;
                }
                // Animate added/removed links in timeline diff (single-commit mode only)
                if (ts.active && !ts.compareMode && (ts.addedLinks.size > 0 || ts.removedLinks.size > 0)) {
                    var dpSrc = typeof link.source === 'object' ? link.source.id : link.source;
                    var dpTgt = typeof link.target === 'object' ? link.target.id : link.target;
                    var dpKey = dpSrc + '>' + dpTgt;
                    if (ts.addedLinks.has(dpKey) || ts.removedLinks.has(dpKey)) return 4;
                }
                if (pathMode && highlightedPath.links.has(link)) return 4;
                if (multiSelectedLinks.has(link)) return 3;
                if (link.type === 'extends') return 2;
                if (link.type === 'implements') return 3;
                return highlightLinks.has(link) ? 3 : 0; 
            })
            .linkDirectionalParticleWidth(function(link) {
                if (link.type === 'implements') return 1.2;
                return 2;
            })
            .linkDirectionalParticleSpeed(function(link) {
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

        graphContainer.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });

        // --- Missed-pointerup self-healing ---------------------------------
        // 3d-force-graph records the press on the container (isPointerPressed /
        // isPointerDragging) and TrackballControls on the canvas. When the mouse
        // button is released outside the webview (over the VS Code UI), that
        // pointerup never reaches this document: the press stays "down", which
        // swallows the next click and freezes hover until another release
        // arrives — clicks appear to randomly do nothing, and a graph refresh
        // cannot fix it. Detect the missed release and dispatch a synthetic
        // pointerup so both layers reset (the library early-returns when a drag
        // was in progress, so no spurious click is triggered).
        graphContainer.removeEventListener('pointerdown', onCanvasPointerDownHeal, true);
        graphContainer.addEventListener('pointerdown', onCanvasPointerDownHeal, true);
        graphContainer.removeEventListener('pointerup', onCanvasPointerUpHeal, true);
        graphContainer.addEventListener('pointerup', onCanvasPointerUpHeal, true);
        graphContainer.removeEventListener('pointercancel', healMissedPointerUp);
        graphContainer.addEventListener('pointercancel', healMissedPointerUp);
        document.removeEventListener('pointermove', onHealCheckMove, true);
        document.addEventListener('pointermove', onHealCheckMove, true);
        document.removeEventListener('pointerdown', onHealCheckDown, true);
        document.addEventListener('pointerdown', onHealCheckDown, true);
        document.removeEventListener('pointerup', onHealCheckUp, true);
        document.addEventListener('pointerup', onHealCheckUp, true);
        window.removeEventListener('blur', healMissedPointerUp);
        window.addEventListener('blur', healMissedPointerUp);

        setTimeout(function() {
            graph.zoomToFit(500, 50);
        }, 1500);

        // Handle webview resize (e.g. when side editor opens/closes).
        // Skip 0x0 sizes: while another tab is active the container is hidden and
        // resizing to zero poisons the rotation math (zoom still appears to work).
        var resizeObserver = new ResizeObserver(function() {
            if (!graph) return;
            var w = graphContainer.clientWidth;
            var h = graphContainer.clientHeight;
            if (w <= 0 || h <= 0) return;
            graph.width(w);
            graph.height(h);
            refreshCameraControls();
        });
        resizeObserver.observe(graphContainer);
        // The canvas starts at its default 300×150 layout: align the camera controls
        // with the real size so the rotation speed is right from the first frame.
        refreshCameraControls();
        // Follow editor — pause on the first manual camera gesture.
        attachFollowControls();
    }

    // ============================================================
    // Selected-node selective bloom post-processing
    // Only objects on layer BLOOM_LAYER receive bloom — the rest of
    // the scene is rendered normally and composited on top.
    // ============================================================
    var BLOOM_LAYER = 1;
    var bloomState = null; // { prePass, compositePass, bloomPass, bloomComposer }

    function disposeBloomState() {
        if (!bloomState || !graph || typeof graph.postProcessingComposer !== 'function') {
            bloomState = null;
            return;
        }
        try {
            var composer = graph.postProcessingComposer();
            if (composer && composer.passes) {
                [bloomState.prePass, bloomState.compositePass].forEach(function (p) {
                    var idx = composer.passes.indexOf(p);
                    if (idx !== -1) composer.passes.splice(idx, 1);
                });
            }
            if (bloomState.bloomComposer && typeof bloomState.bloomComposer.dispose === 'function') {
                bloomState.bloomComposer.dispose();
            }
            if (bloomState.bloomPass && typeof bloomState.bloomPass.dispose === 'function') {
                bloomState.bloomPass.dispose();
            }
        } catch (e) { /* noop */ }
        bloomState = null;
    }

    function buildBloomState(strength, radius, threshold) {
        var T = window.THREE;
        if (!T || !T.UnrealBloomPass || !T.EffectComposer || !T.RenderPass || !T.ShaderPass) {
            console.warn('[aura] Bloom requires UnrealBloomPass/EffectComposer in THREE bundle');
            return null;
        }
        var scene = graph.scene();
        var camera = graph.camera();
        var renderer = graph.renderer();
        if (!scene || !camera || !renderer) return null;

        var w = renderer.domElement.width || graphContainer.clientWidth;
        var h = renderer.domElement.height || graphContainer.clientHeight;

        var bloomComposer = new T.EffectComposer(renderer);
        bloomComposer.renderToScreen = false;
        bloomComposer.addPass(new T.RenderPass(scene, camera));
        var bloomPass = new T.UnrealBloomPass(new T.Vector2(w, h), strength, radius, threshold);
        bloomComposer.addPass(bloomPass);

        var prePass = {
            enabled: true,
            needsSwap: false,
            clear: false,
            renderToScreen: false,
            render: function (rdr, writeBuffer, readBuffer, deltaTime) {
                var savedMask = camera.layers.mask;
                camera.layers.set(BLOOM_LAYER);
                bloomComposer.render(deltaTime);
                camera.layers.mask = savedMask;
            },
            setSize: function (sw, sh) {
                bloomComposer.setSize(sw, sh);
                bloomPass.setSize(sw, sh);
            },
            dispose: function () {
                if (typeof bloomComposer.dispose === 'function') bloomComposer.dispose();
            }
        };

        var compositeMaterial = new T.ShaderMaterial({
            uniforms: {
                baseTexture: { value: null },
                bloomTexture: { value: bloomComposer.renderTarget2.texture }
            },
            vertexShader: [
                'varying vec2 vUv;',
                'void main() {',
                '  vUv = uv;',
                '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
                '}'
            ].join('\n'),
            fragmentShader: [
                'uniform sampler2D baseTexture;',
                'uniform sampler2D bloomTexture;',
                'varying vec2 vUv;',
                'void main() {',
                '  vec4 base  = texture2D(baseTexture, vUv);',
                '  vec4 bloom = texture2D(bloomTexture, vUv);',
                '  gl_FragColor = base + bloom;',
                '}'
            ].join('\n'),
            defines: {}
        });
        var compositePass = new T.ShaderPass(compositeMaterial, 'baseTexture');
        compositePass.needsSwap = true;

        return {
            prePass: prePass,
            compositePass: compositePass,
            bloomPass: bloomPass,
            bloomComposer: bloomComposer
        };
    }

    function applySelectedNodeEffect() {
        if (!graph || typeof graph.postProcessingComposer !== 'function') return;
        var T = window.THREE;
        if (!T) return;

        var cfg = window.AURA_CONFIG || {};
        var wantBloom = cfg.selectedNodeEffect === 'bloom';

        var composer;
        try { composer = graph.postProcessingComposer(); } catch (e) { composer = null; }
        if (!composer || !composer.passes) return;

        if (!wantBloom) {
            disposeBloomState();
            return;
        }

        var strength = typeof cfg.bloomStrength === 'number' ? cfg.bloomStrength : 1.2;
        var radius = typeof cfg.bloomRadius === 'number' ? cfg.bloomRadius : 0.6;
        var threshold = typeof cfg.bloomThreshold === 'number' ? cfg.bloomThreshold : 0.0;

        if (bloomState) {
            bloomState.bloomPass.strength = strength;
            bloomState.bloomPass.radius = radius;
            bloomState.bloomPass.threshold = threshold;
            return;
        }

        var built = buildBloomState(strength, radius, threshold);
        if (!built) return;
        bloomState = built;

        var composer2;
        try { composer2 = graph.postProcessingComposer(); } catch (e) { composer2 = null; }
        if (!composer2 || !composer2.passes) return;
        composer2.passes.unshift(built.prePass);
        composer2.addPass(built.compositePass);
    }

    // ============================================================
    // Node Visuals
    // ============================================================
    /**
     * Append an alpha channel to a CSS color. String concat only works for hex
     * colors — heatmap colors are `rgb(r,g,b)` and would become invalid
     * ("rgb(1,2,3)15" is not parseable by THREE.Color).
     */
    function withAlpha(color, alphaHex) {
        if (typeof color !== 'string') return color;
        if (color.charAt(0) === '#') return color + alphaHex;
        var m = color.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (m) {
            return 'rgba(' + m[1] + ',' + m[2] + ',' + m[3] + ',' +
                (parseInt(alphaHex, 16) / 255).toFixed(3) + ')';
        }
        return color;
    }

    /** Opacity 0..1 encoded in a CSS color ('#rrggbbaa' / rgba()). Defaults to 1. */
    function colorAlpha(color) {
        if (typeof color !== 'string') return 1;
        if (color.charAt(0) === '#') {
            return color.length === 9 ? parseInt(color.slice(7, 9), 16) / 255 : 1;
        }
        var m = color.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/);
        if (m) return parseFloat(m[1]);
        return 1;
    }

    function getNodeColor(node) {
        // Query filter (highlight mode dims non-matching nodes)
        var qs = qsState();
        if (qs.active && qs.mode === 'highlight' && !qs.set.has(node.id)) {
            return '#ffffff0a';
        }

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

        var ts = ttState();
        if (ts.active && ts.changed.size > 0) {
            if (ts.addedNodes.has(node.id)) return '#00ff88';   // neon green = added
            if (ts.removedNodes.has(node.id)) return '#ff2080'; // neon pink = removed
            if (ts.modifiedNodes.has(node.id)) return '#ffff00'; // neon yellow = modified
            if (ts.compareMode) return '#ffffff0a'; // dim unchanged nodes in compare mode only
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
            return withAlpha(LANGUAGE_COLORS[node.language] || '#ffffff', '44');
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
                    if (!pinnedNodes.has(node)) return withAlpha(cColor, '15');
                    var bdc = blastDepths[node.id];
                    return BLAST_COLORS[Math.min(bdc || 0, BLAST_COLORS.length - 1)];
                }
                if (pinnedNode) return pinnedNodes.has(node) ? cColor : withAlpha(cColor, '15');
                if (!allActive && highlightNodes.size > 0 && !highlightNodes.has(node)) return withAlpha(cColor, '44');
                return cColor;
            }
            var value;
            switch (heatmapMode) {
                case 'complexity': value = node.complexity || 1; break;
                case 'cognitive':  value = typeof node.cognitive === 'number' ? node.cognitive : 0; break;
                case 'fanIn':      value = node.fanIn; break;
                case 'fanOut':     value = node.fanOut; break;
                case 'loc':        value = node.linesOfCode; break;
                case 'churn':      value = getChurn(node.id) || getChurn(node.path); break;
                case 'cochange':   value = getCochangeScore(node.id); break;
                case 'lastModified': value = node.lastModified || 0; break;
                default:           value = 0;
            }
            var norm = normalizeMetric(value, heatmapMode);
            var color = heatmapColor(norm, HEATMAP_SCALES[heatmapMode]);
            if (pinnedNode && blastMode) {
                if (!pinnedNodes.has(node)) return withAlpha(color, '15');
                var bd = blastDepths[node.id];
                return BLAST_COLORS[Math.min(bd || 0, BLAST_COLORS.length - 1)];
            }
            if (pinnedNode) return pinnedNodes.has(node) ? color : withAlpha(color, '15');
            if (highlightNodes.size > 0 && !highlightNodes.has(node)) return withAlpha(color, '44');
            return color;
        }

        var langKeyFinal = node.language === 'c' ? (node.extension === '.h' ? 'c-header' : 'c-source')
            : node.language === 'cpp' ? ((node.extension === '.hpp' || node.extension === '.hxx' || node.extension === '.hh') ? 'cpp-header' : 'cpp-source')
            : node.language;
        var baseColor = LANGUAGE_COLORS[langKeyFinal] || '#ffffff';

        if (pinnedNode && blastMode) {
            if (!pinnedNodes.has(node)) return withAlpha(baseColor, '15');
            var bd2 = blastDepths[node.id];
            return BLAST_COLORS[Math.min(bd2 || 0, BLAST_COLORS.length - 1)];
        }
        if (pinnedNode) return pinnedNodes.has(node) ? baseColor : withAlpha(baseColor, '15');
        if (highlightNodes.size > 0 && !highlightNodes.has(node)) return withAlpha(baseColor, '44');
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
        var ts = ttState();
        if (ts.active && ts.compareMode && ts.changed.size > 0) {
            var vSrc = typeof link.source === 'object' ? link.source.id : link.source;
            var vTgt = typeof link.target === 'object' ? link.target.id : link.target;
            return ts.changed.has(vSrc) && ts.changed.has(vTgt);
        }
        // Query in filter mode hides links unless both endpoints match
        var qs = qsState();
        if (qs.active && qs.mode === 'filter') {
            var qSrc = typeof link.source === 'object' ? link.source.id : link.source;
            var qTgt = typeof link.target === 'object' ? link.target.id : link.target;
            if (!qs.set.has(qSrc) || !qs.set.has(qTgt)) return false;
        }
        // Dirty-only filter hides links unless both endpoints are dirty
        if (showDirtyOnly) {
            var dSrc = typeof link.source === 'object' ? link.source.id : link.source;
            var dTgt = typeof link.target === 'object' ? link.target.id : link.target;
            if (!workingTree[dSrc] || !workingTree[dTgt]) return false;
        }
        if (showStaleNotesOnly) {
            var sSrc = typeof link.source === 'object' ? link.source.id : link.source;
            var sTgt = typeof link.target === 'object' ? link.target.id : link.target;
            if (!staleNoteIds.has(sSrc) || !staleNoteIds.has(sTgt)) return false;
        }
        return true;
    }

    function getLinkColor(link) {
        if (link && link._cochange) return '#e879f9';
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
        var ts = ttState();
        if (ts.active && ts.changed.size > 0) {
            var tlSrc = typeof link.source === 'object' ? link.source.id : link.source;
            var tlTgt = typeof link.target === 'object' ? link.target.id : link.target;
            var tlKey = tlSrc + '>' + tlTgt;
            // Show added/removed link colors only in single-commit mode (not compare)
            if (!ts.compareMode) {
                if (ts.addedLinks.has(tlKey)) return '#00ff88cc';   // neon green
                if (ts.removedLinks.has(tlKey)) return '#ff2080cc'; // neon pink
            }
            if (ts.compareMode) {
                // In compare mode: only show edges where both endpoints are changed
                if (ts.changed.has(tlSrc) && ts.changed.has(tlTgt)) {
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

    function getLinkWidth(link) {
        if (link && link._cochange) return 2.2;
        if (link._isCallEdge) {
            if (!hoveredSymbolId) return 0;
            var cwSrc = typeof link.source === 'object' ? link.source.id : link.source;
            var cwTgt = typeof link.target === 'object' ? link.target.id : link.target;
            return (cwSrc === hoveredSymbolId || cwTgt === hoveredSymbolId) ? 2 : 0;
        }
        // Timeline diff: thicker lines for added/removed links, hide edges in compare mode
        var ts = ttState();
        if (ts.active && ts.changed.size > 0) {
            var lwSrc = typeof link.source === 'object' ? link.source.id : link.source;
            var lwTgt = typeof link.target === 'object' ? link.target.id : link.target;
            var lwKey = lwSrc + '>' + lwTgt;
            if (!ts.compareMode && (ts.addedLinks.has(lwKey) || ts.removedLinks.has(lwKey))) return 2.5;
            if (ts.compareMode && !(ts.changed.has(lwSrc) && ts.changed.has(lwTgt))) return 0;
        }
        if (pathMode && highlightedPath.links.has(link)) return 3;
        if (multiSelectedLinks.has(link)) return 2.5;
        // Cycles mode: thicken cycle links, dim everything else
        if (showCycles) {
            var cySrc = typeof link.source === 'object' ? link.source.id : link.source;
            var cyTgt = typeof link.target === 'object' ? link.target.id : link.target;
            if (cycleLinkKeys.has(cySrc + '>' + cyTgt)) return 2;
            return highlightLinks.has(link) ? 1.5 : 0.3;
        }
        if (link.type === 'extends') return highlightLinks.has(link) ? 2.5 : 1;
        if (link.type === 'implements') return highlightLinks.has(link) ? 2 : 0.8;
        if (link.type === 'doc-reference') return highlightLinks.has(link) ? 1 : 0.25;
        // Scale base thickness by fan-in/out connectivity.
        // Use sqrt for more gradual contrast at low values.
        var lwSrcId = typeof link.source === 'object' ? link.source.id : link.source;
        var lwTgtId = typeof link.target === 'object' ? link.target.id : link.target;
        var lwSrcNode = linkWidthNodeIndex[lwSrcId];
        var lwTgtNode = linkWidthNodeIndex[lwTgtId];
        var fanSum = (lwSrcNode ? lwSrcNode.fanOut || 0 : 0) + (lwTgtNode ? lwTgtNode.fanIn || 0 : 0);
        var base = 0.15 + Math.sqrt(fanSum + 0.5) * 0.22;
        return highlightLinks.has(link) ? Math.max(1.5, base * 2.5) : Math.min(1.4, base);
    }

    // ============================================================
    // Interactions
    // ============================================================
    // Debounced hover refresh — a cursor sweeping across nodes used to trigger
    // one full link rebuild per transition (linkWidth + particles rebuild every
    // link object). On 500+ file projects that saturated the main thread:
    // particles kept crawling and clicks felt delayed until it settled. One
    // apply per burst instead; the hover highlight itself stays immediate.
    var hoverRefreshTimer = null;
    function scheduleHoverRefresh() {
        if (hoverRefreshTimer) return;
        hoverRefreshTimer = setTimeout(function () {
            hoverRefreshTimer = null;
            if (!graph) return;
            graph.nodeColor(graph.nodeColor())
                 .linkWidth(graph.linkWidth())
                 .linkDirectionalParticles(graph.linkDirectionalParticles());
        }, 90);
    }

    function handleNodeHover(node) {
        if (window.AuraFlight && window.AuraFlight.isActive()) return; // pilot: navigate, don't select
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

        // Dedupe: 3d-force-graph re-fires hover with the same node after any
        // object rebuild (every right-click rebuilds them). Re-applying the
        // accessors below rebuilds every link object (linkWidth), so without
        // this guard one rebuild cascades into more rebuilds, starving the
        // render loop — which reads as the link particles crawling.
        var hoverId = node ? node.id : null;
        if (hoverId === lastHoverId && !symbolChanged) return;
        lastHoverId = hoverId;

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
            // Coalesce the expensive link rebuilds (linkWidth + particles);
            // linkColor is cheap and stays immediate for symbol hover call-edges.
            scheduleHoverRefresh();
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
        if (window.AuraFlight && window.AuraFlight.isActive()) return; // pilot: clicks suspended
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
                if (window.AuraDetail) AuraDetail.showMultiSelect();
            } else if (multiSelectedNodes.size === 1) {
                var solo = multiSelectedNodes.values().next().value;
                multiSelectedNodes.clear();
                multiSelectedLinks.clear();
                selectedNode = solo;
                refreshGraphVisuals();
                if (window.AuraDetail) AuraDetail.show(solo);
            } else {
                detailPanel.classList.add('collapsed');
            }
            return;
        }

        // Normal click: clear multi-selection, select single
        selectNodeLikeClick(node);
        graph.cameraPosition(nodeCameraPose(node), node, 1000);
    }

    function updateMultiSelectedLinks() {
        multiSelectedLinks.clear();
        if (multiSelectedNodes.size < 2 || !graphData) return;
        var selectedIds = new Set();
        multiSelectedNodes.forEach(function(n) { selectedIds.add(n.id); });
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
        if (window.AuraFlight && window.AuraFlight.isActive()) return; // pilot: clicks suspended
        if (hoveredNode) handleNodeDblClick(hoveredNode);
    }

    // Double-click: open file in VSCode editor, or expand/collapse cluster
    function handleNodeDblClick(node) {
        if (!node) return;
        if (node._isCluster) {
            if (window.AuraStructure) AuraStructure.toggleGroupExpansion(node._clusterGroup);
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
        if (window.AuraFlight && window.AuraFlight.isActive()) return; // pilot: clicks suspended
        if (pathMode) return;
        var hadSelection = !!selectedNode || multiSelectedNodes.size > 0;
        var hadPinned = !!pinnedNode || blastMode;
        // Only multi-selection / flow-trace alter link widths & particles — skip the
        // expensive link-object rebuild when nothing did (hover highlights were
        // already cleared when the pointer left the node).
        var hadLinkWidthState = multiSelectedLinks.size > 0 || flowTraceMode;
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
                 .linkColor(graph.linkColor());
            if (hadLinkWidthState) {
                graph.linkWidth(graph.linkWidth())
                     .linkDirectionalParticles(graph.linkDirectionalParticles());
            }
            if (hadSelection || hadPinned) {
                graph.nodeThreeObject(graph.nodeThreeObject());
            }
        }
    }

    // ============================================================
    // Right-click pinned focus
    // ============================================================
    function handleNodeRightClick(node, eventOrFlag) {
        if (window.AuraFlight && window.AuraFlight.isActive()) return; // pilot: clicks suspended
        if (!node || pathMode) return;

        var isEvent = eventOrFlag && typeof eventOrFlag === 'object' && 'shiftKey' in eventOrFlag;
        var isShift = isEvent && eventOrFlag.shiftKey;
        var isLightRefresh = eventOrFlag === true;

        // Shift+RightClick → blast radius mode
        if (isShift) {
            handleBlastRadius(node, false);
            return;
        }

        // The blast glow lives in the node three-objects — remember whether a
        // rebuild is needed to swap it for a regular pin.
        var wasBlast = blastMode;

        // Clear blast mode when switching to regular pin focus
        blastMode = false;
        blastDepths = {};

        if (pinnedNode && pinnedNode.id === node.id && !isLightRefresh) {
            clearPinnedFocus();
            refreshFocusVisuals(wasBlast);
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

        refreshFocusVisuals(wasBlast);
    }

    // ============================================================
    // Blast radius (Shift+RightClick) — directional impact analysis
    // ============================================================
    function handleBlastRadius(node, lightRefresh) {
        var wasBlast = blastMode;

        if (blastMode && pinnedNode && pinnedNode.id === node.id && !lightRefresh) {
            clearPinnedFocus();
            refreshFocusVisuals(wasBlast);
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
            refreshFocusVisuals(wasBlast);
            return;
        }

        refreshFocusVisuals(wasBlast);
    }

    function handleBackgroundRightClick() {
        var hadBlast = blastMode;
        clearPinnedFocus();
        refreshFocusVisuals(hadBlast);
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

        flowTraceTimer = setInterval(function() {
            flowTraceAnimDepth++;
            refreshGraphColors();
            if (flowTraceAnimDepth >= flowTraceMaxDepth) {
                clearInterval(flowTraceTimer);
                flowTraceTimer = null;
            }
        }, 400);
    }

    // ============================================================
    // Multi-node blast — impact cascade seeded from the timeline's changed files
    // (the blast/focus state lives here, shared with pin & shift-click blast)
    // ============================================================
    function startMultiNodeBlast(seedIds) {
        if (window.AuraStructure) AuraStructure.startMultiNodeBlast(seedIds);
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

    // Light refresh: color-only updates. Re-applying linkWidth here would make
    // the library rebuild every link object just to change a color.
    function refreshGraphColors() {
        if (!graph) return;
        graph.nodeColor(graph.nodeColor())
             .linkVisibility(graph.linkVisibility())
             .linkColor(graph.linkColor())
             .nodeThreeObject(graph.nodeThreeObject());
    }

    // Focus refresh (pin / blast / impact): only node colors, link colors and
    // the label / blast-glow three-objects change. Re-applying linkWidth,
    // particles or arrows would rebuild every link object for nothing.
    // Node three-objects are only rebuilt when the labels or the blast glow
    // are actually in play (wasBlast: an existing blast glow must be removed).
    function refreshFocusVisuals(wasBlast) {
        if (!graph) return;
        graph.nodeColor(graph.nodeColor())
             .linkColor(graph.linkColor())
             .linkVisibility(graph.linkVisibility());
        if (wasBlast || showLabels || blastMode) {
            graph.nodeThreeObject(graph.nodeThreeObject());
        }
    }

    // ============================================================
    // Focus node from extension (when switching editor tabs)
    // ============================================================
    /** Resolve a graph node from an absolute/relative path or a basename. */
    function findGraphNode(nodeId) {
        if (!graphData) return null;
        var normalized = String(nodeId || '').replace(/\\/g, '/').replace(/^\.\//, '');
        for (var i = 0; i < graphData.nodes.length; i++) {
            if (graphData.nodes[i].id === nodeId || graphData.nodes[i].id === normalized) {
                return graphData.nodes[i];
            }
        }
        // Accept basenames and partial paths coming from AI citations.
        for (var j = 0; j < graphData.nodes.length; j++) {
            var candidate = graphData.nodes[j];
            if (candidate.id.endsWith('/' + normalized) || candidate.name === normalized) {
                return candidate;
            }
        }
        return null;
    }

    /** Selection + visual refresh + detail panel, exactly like a normal click. */
    function selectNodeLikeClick(node) {
        if (!graph || !node) return;
        if (multiSelectedNodes.size > 0) {
            multiSelectedNodes.clear();
            multiSelectedLinks.clear();
        }
        selectedNode = node;
        graph.nodeThreeObject(graph.nodeThreeObject());
        updateExplorerSelection();
        if (window.AuraDetail) AuraDetail.show(node);
    }

    /** Close-up camera position for a node, matching a normal click (120 units). */
    function nodeCameraPose(node) {
        var distance = 120;
        var radius = Math.hypot(node.x, node.y, node.z);
        var ratio = radius > 1e-6 ? 1 + distance / radius : 1;
        return { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio };
    }

    function focusNodeById(nodeId, reveal) {
        if (!graph || !graphData) return;
        var node = findGraphNode(nodeId);
        if (!node) return;

        if (reveal) {
            // Match a normal graph click: select, fly close, open details.
            selectNodeLikeClick(node);
            graph.cameraPosition(nodeCameraPose(node), node, 1000);
        } else {
            selectedNode = node;
            updateExplorerSelection();
            // Subtle highlight when following the active editor.
            graph.nodeColor(graph.nodeColor());
        }
    }

    /** Focus a file from a secondary view (Co-change table, etc.). */
    function focusNodeFromView(nodeId) {
        if (!graph || !graphData || !findGraphNode(nodeId)) return;
        if (activeTab !== 'graph') {
            switchTab('graph');
            requestAnimationFrame(function() { focusNodeById(nodeId, true); });
        } else {
            focusNodeById(nodeId, true);
        }
    }

    /** Update the 👁 button so the toggle state and the auto-pause are visible. */
    function updateFollowEditorButton() {
        var btn = $('#btn-follow-editor');
        if (!btn) return;
        btn.classList.toggle('active', followEditorEnabled);
        btn.classList.toggle('paused', followEditorEnabled && followEditorPaused);
        btn.setAttribute('aria-pressed', followEditorEnabled ? 'true' : 'false');
        if (!followEditorEnabled) {
            btn.title = 'Follow editor (off) — click to fly to the active file';
        } else if (followEditorPaused) {
            btn.title = 'Follow editor paused — click to resume';
        } else {
            btn.title = 'Follow editor (on) — camera flies to the active file';
        }
    }

    function setupFollowEditor() {
        var btn = $('#btn-follow-editor');
        if (btn) {
            btn.addEventListener('click', function() {
                if (followEditorEnabled && followEditorPaused) {
                    followEditorPaused = false; // resume without turning the setting off
                } else {
                    followEditorEnabled = !followEditorEnabled;
                    followEditorPaused = false;
                }
                updateFollowEditorButton();
                saveViewState();
                vscode.postMessage({
                    type: 'updateSetting',
                    payload: { key: 'followEditor', value: followEditorEnabled }
                });
                btn.blur();
            });
        }
        updateFollowEditorButton();
    }

    function detachFollowControls() {
        if (followControls && followControlsStartHandler &&
            typeof followControls.removeEventListener === 'function') {
            followControls.removeEventListener('start', followControlsStartHandler);
        }
        followControls = null;
        followControlsStartHandler = null;
    }

    /**
     * TrackballControls fires `start` on any user camera gesture. A manual
     * orbit/pan/zoom therefore pauses follow-editor until the 👁 button is
     * clicked again — the camera should not fight the user.
     */
    function attachFollowControls() {
        detachFollowControls();
        if (!graph || typeof graph.controls !== 'function') return;
        var ctrl = null;
        try { ctrl = graph.controls(); } catch (e) { ctrl = null; }
        if (!ctrl || typeof ctrl.addEventListener !== 'function') return;
        followControls = ctrl;
        followControlsStartHandler = function() {
            if (!followEditorEnabled || followEditorPaused) return;
            if (window.AuraFlight && window.AuraFlight.isActive()) return;
            followEditorPaused = true;
            updateFollowEditorButton();
        };
        ctrl.addEventListener('start', followControlsStartHandler);
    }

    /** Camera flight to the active editor file — selects it exactly like a click. */
    function followNodeById(nodeId) {
        if (!followEditorEnabled || followEditorPaused) return;
        if (activeTab !== 'graph' || !graph || !graphData) return;
        if (window.AuraFlight && window.AuraFlight.isActive()) return;

        var node = findGraphNode(nodeId);
        if (!node || typeof node.x !== 'number' || typeof node.y !== 'number' || typeof node.z !== 'number') return;

        // Compute the flight from the current framing before the detail panel opens.
        var pose = null;
        try {
            var cam = graph.camera();
            var ctrl = graph.controls();
            var orbit = (ctrl && ctrl.target) || { x: 0, y: 0, z: 0 };
            if (cam && cam.position && window.AuraPilot && typeof AuraPilot.followPose === 'function') {
                pose = AuraPilot.followPose(
                    { x: cam.position.x, y: cam.position.y, z: cam.position.z },
                    { x: orbit.x, y: orbit.y, z: orbit.z },
                    { x: node.x, y: node.y, z: node.z }
                );
            }
        } catch (e) { pose = null; }
        if (!pose) return;

        selectNodeLikeClick(node);
        if (window.AuraWarps && typeof window.AuraWarps.flyToPose === 'function') {
            AuraWarps.flyToPose(pose.pos, pose.target);
        } else {
            graph.cameraPosition(pose.pos, pose.target, 800);
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
        setTimeout(function() {
            tooltip.classList.add('hidden');
            tooltip.style.transform = '';
        }, 2500);
    }

    // ============================================================
    // File Explosion
    // ============================================================
    function explodeFile(node) {
        if (window.AuraStructure) AuraStructure.explodeFile(node);
    }

    function collapseExplosion() {
        if (window.AuraStructure) AuraStructure.collapseExplosion();
    }


    // Heatmap mode — the visuals (legend, community palette, recolor) live in
    // panels.js; this thin wrapper owns the state bit so the call sites stay put.
    function setHeatmapMode(mode) {
        heatmapMode = mode;
        if (window.AuraPanels) window.AuraPanels.applyHeatmapMode(mode);
    }

    // ============================================================
    // Directory Clustering
    // ============================================================
    // buildClusteredData() and the clustering toggles live in structure.js (V0-3).


    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ============================================================
    // Sprite factories — owned by sprites.js (window.AuraSprites). The thin
    // wrappers keep every accessor call site unchanged.
    // ============================================================
    var GIT_STATE_LABELS = {
        modified: '◐ modified',
        added: '＋ added to index',
        deleted: '− deleted',
        renamed: '↷ renamed',
        untracked: '? untracked',
        conflicted: '⚠ conflict'
    };

    /** Git state of a node, or null when it has no uncommitted changes. */
    function dirtyStateOf(node) {
        if (!node) return null;
        return workingTree[node.id] || (node.path ? workingTree[node.path] : null) || null;
    }

    /** Note of a node, or null — keyed by workspace-relative path (id fallback). */
    function annotationOf(node) {
        if (!node) return null;
        return annotations[node.id] || (node.path ? annotations[node.path] : null) || null;
    }

    function isStaleNoteNode(node) {
        if (!node || !window.AuraNotes) return false;
        var note = annotationOf(node);
        return !!note && window.AuraNotes.isStale(note, node.lastModified);
    }

    /** Refresh the stale-note counter and filter button state. */
    function updateStaleNotesUI() {
        staleNoteIds.clear();
        if (graphData && graphData.nodes) {
            for (var i = 0; i < graphData.nodes.length; i++) {
                if (isStaleNoteNode(graphData.nodes[i])) staleNoteIds.add(graphData.nodes[i].id);
            }
        }
        var count = staleNoteIds.size;
        var countEl = $('#notes-stale-count');
        if (countEl) {
            countEl.textContent = String(count);
            countEl.style.display = count > 0 ? '' : 'none';
        }
        var staleBtn = $('#btn-stale-notes');
        var needsVisibilityRefresh = showStaleNotesOnly;
        if (staleBtn) {
            staleBtn.disabled = count === 0;
            staleBtn.title = count > 0
                ? count + ' note' + (count === 1 ? '' : 's') + ' to review (older than the file)'
                : 'No stale notes';
            if (count === 0 && showStaleNotesOnly) {
                showStaleNotesOnly = false;
                staleBtn.classList.remove('active');
                needsVisibilityRefresh = true;
            }
        }
        if (needsVisibilityRefresh && graph) {
            graph.nodeVisibility(graph.nodeVisibility());
            graph.linkVisibility(graph.linkVisibility());
        }
        if (selectedNode && !selectedNode._isCluster && !selectedNode._isSymbol && window.AuraDetail) {
            if (window.AuraDetail.refreshStaleBadge) window.AuraDetail.refreshStaleBadge(selectedNode);
        }
    }

    function cloneSpriteWithMaterial(sprite) {
        return window.AuraSprites ? AuraSprites.cloneWithMaterial(sprite) : null;
    }
    function getLabelSprite(text) {
        return window.AuraSprites ? AuraSprites.labelSprite(text) : null;
    }
    function getClusterLabelSprite(groupName, count, color) {
        return window.AuraSprites ? AuraSprites.clusterLabel(groupName, count, color) : null;
    }
    function getDirtyRingSprite() {
        return window.AuraSprites ? AuraSprites.dirtyRing() : null;
    }
    function getNoteDotSprite(colorKey) {
        return window.AuraSprites ? AuraSprites.noteDot(colorKey) : null;
    }
    function getNoteRingSprite(colorKey) {
        return window.AuraSprites ? AuraSprites.noteRing(colorKey) : null;
    }
    function attachNotePulse(sprite, baseScale, opacityFactor) {
        if (window.AuraSprites) AuraSprites.attachPulse(sprite, baseScale, opacityFactor);
    }

    // ============================================================
    // Path Mode BFS
    // ============================================================
    function findPath(start, end) {
        var result = window.AuraStructure
            ? AuraStructure.findPath(start, end, graphData, findNode)
            : null;
        if (result) {
            highlightedPath.links = result.links;
            highlightedPath.nodes = result.nodes;
            if (graph) {
                // Keep the current camera: fitting the path zooms all the
                // way out when the endpoints sit on opposite sides of the
                // graph, which loses the view the user was working in.
                graph.nodeColor(graph.nodeColor())
                     .linkWidth(graph.linkWidth())
                     .linkColor(graph.linkColor())
                     .linkDirectionalParticles(graph.linkDirectionalParticles());
            }
            return;
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
    function updateLanguageButtons(nodes, keepUserSelection) {
        var presentLangs = new Set();
        for (var i = 0; i < nodes.length; i++) {
            var langKey = nodes[i].language;
            if (langKey === 'c') langKey = nodes[i].extension === '.h' ? 'c-header' : 'c-source';
            else if (langKey === 'cpp') langKey = (nodes[i].extension === '.hpp' || nodes[i].extension === '.hxx' || nodes[i].extension === '.hh') ? 'cpp-header' : 'cpp-source';
            presentLangs.add(langKey);
        }
        var langBtns = document.querySelectorAll('#language-filters .filter-btn');
        for (var j = 0; j < langBtns.length; j++) {
            var btn = langBtns[j];
            var lang = btn.dataset.lang;
            if (presentLangs.has(lang)) {
                var wasHidden = (btn.style.display === 'none');
                btn.style.display = '';
                // Documentation is opt-in: only show the button, but don't auto-activate
                if (lang === 'documentation') continue;
                // On incremental updates (graph deltas) keep the user's choice:
                // a language that is already visible keeps its filter state — only
                // a language that just appeared gets switched on.
                if (keepUserSelection && !wasHidden) continue;
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
    /** Position/size of a user-moved or user-resized floating panel, or null. */
    function capturePalettePosition(el) {
        if (!el || !el.style) return null;
        var out = null;
        if (el.style.left) {
            out = { left: el.style.left, top: el.style.top };
        }
        if (el.style.width || el.style.height) {
            out = out || {};
            if (el.style.width) out.width = el.style.width;
            if (el.style.height) out.height = el.style.height;
        }
        return out;
    }

    /** Restore a saved palette position/size, clamped to the current viewport. */
    function restorePalettePosition(el, pos, alsoBottom) {
        if (!el || !pos) return;
        if (pos.width || pos.height) {
            if (pos.width) el.style.width = pos.width;
            if (pos.height) el.style.height = pos.height;
        }
        if (pos.left === undefined || pos.top === undefined) return;
        var left = parseInt(pos.left, 10);
        var top = parseInt(pos.top, 10);
        if (!isFinite(left) || !isFinite(top)) return;
        left = Math.max(0, Math.min(left, window.innerWidth - 60));
        top = Math.max(0, Math.min(top, window.innerHeight - 40));
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.right = 'auto';
        if (alsoBottom) el.style.bottom = 'auto';
    }

    /** Debounced view-state save — native CSS resizes have no mouseup to hook. */
    var paletteSaveTimer = null;
    function schedulePaletteSave() {
        if (paletteSaveTimer) clearTimeout(paletteSaveTimer);
        paletteSaveTimer = setTimeout(function () {
            paletteSaveTimer = null;
            saveViewState();
        }, 400);
    }

    /** Whether the warps panel should be open — even when a tab switch force-hides it. */
    function warpsPanelVisibleIntent() {
        var wp = $('#warps-panel');
        if (!wp) return false;
        if (activeTab === 'graph') return !wp.classList.contains('hidden');
        return !!wp._wasVisible;
    }

    function collectViewState() {
        return {
            activeLanguages: Array.from(activeLanguages),
            dagMode: dagMode,
            showOrphans: showOrphans,
            showDeadCode: showDeadCode,
            showCycles: showCycles,
            showDirtyOnly: showDirtyOnly,
            showNotes: showNotes,
            showCentralityHalos: showCentralityHalos,
            showStaleNotesOnly: showStaleNotesOnly,
            showGroups: showGroups,
            pathMode: pathMode,
            showLabels: showLabels,
            followEditor: followEditorEnabled,
            cochangeWindow: cochangeWindowDays,
            cochangeMinScore: cochangeMinScore,
            showCochangeLinks: showCochangeLinks,
            confidenceMin: linkConfidenceMin,
            heatmapMode: heatmapMode,
            nodeSizeMultiplier: nodeSizeMultiplier,
            spreadMultiplier: spreadMultiplier,
            focusDepth: focusDepth,
            showExplorer: showExplorer,
            showMinimap: !$('#minimap').classList.contains('hidden'),
            showWarps: warpsPanelVisibleIntent(),
            // Floating panels — keep user-dragged positions across sessions
            palettePositions: {
                warps: capturePalettePosition($('#warps-panel')),
                community: capturePalettePosition($('#community-palette')),
                minimap: capturePalettePosition($('#minimap'))
            }
        };
    }

    /**
     * Nothing may be persisted before the initial restore is applied: boot-time
     * savers (palette ResizeObserver → schedulePaletteSave, warps setVisible)
     * would otherwise overwrite the stored state with defaults — the analysis
     * can take seconds, and requestViewState/restoreViewState only round-trips
     * after the graph data arrives.
     */
    var viewStateReady = false;

    function saveViewState() {
        if (!viewStateReady) return;
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
        showDirtyOnly = !!state.showDirtyOnly;
        showStaleNotesOnly = !!state.showStaleNotesOnly;
        // Defaults to true: states saved before the toggle existed must keep notes visible.
        showNotes = state.showNotes === undefined ? true : !!state.showNotes;
        showCentralityHalos = !!state.showCentralityHalos;
        showLabels = !!state.showLabels;
        pathMode = !!state.pathMode;
        if (typeof state.followEditor === 'boolean') {
            followEditorEnabled = state.followEditor;
            if (!followEditorEnabled) followEditorPaused = false;
            updateFollowEditorButton();
        }
        if (typeof state.cochangeWindow === 'number' && state.cochangeWindow > 0) {
            cochangeWindowDays = state.cochangeWindow;
        }
        if (typeof state.cochangeMinScore === 'number') {
            cochangeMinScore = Math.max(0, Math.min(1, state.cochangeMinScore));
        }
        if (typeof state.showCochangeLinks === 'boolean') {
            showCochangeLinks = state.showCochangeLinks;
            var cochangeBtn = $('#btn-cochange-links');
            if (cochangeBtn) cochangeBtn.classList.toggle('active', showCochangeLinks);
        }
        if (typeof state.confidenceMin === 'number') {
            linkConfidenceMin = Math.max(0, Math.min(1, state.confidenceMin));
            var cfs = $('#confidence-filter');
            if (cfs) cfs.value = String(linkConfidenceMin);
        }

        $('#btn-dag-mode').classList.toggle('active', dagMode);
        $('#btn-highlight-orphans').classList.toggle('active', showOrphans);
        $('#btn-dead-code').classList.toggle('active', showDeadCode);
        $('#btn-cycles').classList.toggle('active', showCycles);
        $('#btn-dirty-only').classList.toggle('active', showDirtyOnly);
        $('#btn-notes').classList.toggle('active', showNotes);
        var restoredCentralityBtn = $('#btn-centrality-halos');
        if (restoredCentralityBtn) restoredCentralityBtn.classList.toggle('active', showCentralityHalos);
        var restoredStaleBtn = $('#btn-stale-notes');
        if (restoredStaleBtn) restoredStaleBtn.classList.toggle('active', showStaleNotesOnly);
        updateStaleNotesUI();
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

        // Risk Map — the git history window is a setting now (auraVisualizer.riskWindow):
        // it is seeded from AURA_CONFIG at startup and kept in sync via graphConfig.
        // Older saved view states may still carry `riskWindow`; it is ignored.

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

        // Warps panel — graph-tab-only panel: a tab switch force-hides it
        // without changing the user's intent (kept in _wasVisible).
        if (typeof state.showWarps === 'boolean') {
            if (window.AuraWarps) window.AuraWarps.setVisible(state.showWarps);
        }

        // Floating palette positions (drag positions persist across sessions)
        if (state.palettePositions) {
            restorePalettePosition($('#warps-panel'), state.palettePositions.warps);
            restorePalettePosition($('#community-palette'), state.palettePositions.community);
            restorePalettePosition($('#minimap'), state.palettePositions.minimap, true);
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

        // Restored coupling options may differ from the boot defaults.
        if (graphData && window.AuraCochange) refreshCochange();
    }

    function setupFilters() {
        var langBtns = document.querySelectorAll('#language-filters .filter-btn');
        for (var i = 0; i < langBtns.length; i++) {
            (function(btn) {
                btn.addEventListener('click', function() {
                    var lang = btn.dataset.lang;
                    btn.classList.toggle('active');
                    if (btn.classList.contains('active')) activeLanguages.add(lang);
                    else activeLanguages.delete(lang);
                    applyFilters();
                    saveViewState();
                });
            })(langBtns[i]);
        }

        $('#btn-dag-mode').addEventListener('click', function() {
            dagMode = !dagMode;
            $('#btn-dag-mode').classList.toggle('active', dagMode);
            if (graph) {
                graph.dagMode(dagMode ? 'td' : null);
                graph.dagLevelDistance(dagMode ? 60 : null);
                if (!dagMode) {
                    graph.numDimensions(3);
                    reheatWithSettle();
                }
                applyFilters();
            }
            saveViewState();
        });

        $('#btn-highlight-orphans').addEventListener('click', function() {
            showOrphans = !showOrphans;
            $('#btn-highlight-orphans').classList.toggle('active', showOrphans);
            if (showOrphans) {
                if (showDeadCode) { showDeadCode = false; $('#btn-dead-code').classList.remove('active'); }
                if (showCycles)   { showCycles = false;   $('#btn-cycles').classList.remove('active'); }
            }
            if (graph) {
                graph.nodeColor(graph.nodeColor());
                graph.nodeVal(graph.nodeVal());
                graph.linkColor(graph.linkColor());
                graph.nodeThreeObject(graph.nodeThreeObject());
            }
            saveViewState();
        });

        $('#btn-dead-code').addEventListener('click', function() {
            showDeadCode = !showDeadCode;
            $('#btn-dead-code').classList.toggle('active', showDeadCode);
            if (showDeadCode) {
                if (showOrphans) { showOrphans = false; $('#btn-highlight-orphans').classList.remove('active'); }
                if (showCycles)  { showCycles = false;   $('#btn-cycles').classList.remove('active'); }
            }
            if (graph) {
                graph.nodeColor(graph.nodeColor());
                graph.nodeVal(graph.nodeVal());
                graph.linkColor(graph.linkColor());
                graph.nodeThreeObject(graph.nodeThreeObject());
            }
            saveViewState();
        });

        var dirtyOnlyBtn = $('#btn-dirty-only');
        if (dirtyOnlyBtn) {
            dirtyOnlyBtn.addEventListener('click', function() {
                showDirtyOnly = !showDirtyOnly;
                dirtyOnlyBtn.classList.toggle('active', showDirtyOnly);
                if (graph) {
                    graph.nodeVisibility(graph.nodeVisibility());
                    graph.linkVisibility(graph.linkVisibility());
                }
                saveViewState();
            });
        }

        var notesBtn = $('#btn-notes');
        if (notesBtn) {
            notesBtn.addEventListener('click', function() {
                showNotes = !showNotes;
                notesBtn.classList.toggle('active', showNotes);
                if (graph) graph.nodeThreeObject(graph.nodeThreeObject());
                saveViewState();
            });
        }

        var centralityBtn = $('#btn-centrality-halos');
        if (centralityBtn) {
            centralityBtn.addEventListener('click', function() {
                showCentralityHalos = !showCentralityHalos;
                centralityBtn.classList.toggle('active', showCentralityHalos);
                rebuildCentralityHaloSet();
                refreshGraphColors();
                saveViewState();
            });
        }

        var staleNotesBtn = $('#btn-stale-notes');
        if (staleNotesBtn) {
            staleNotesBtn.addEventListener('click', function() {
                if (staleNotesBtn.disabled) return;
                showStaleNotesOnly = !showStaleNotesOnly;
                staleNotesBtn.classList.toggle('active', showStaleNotesOnly);
                if (graph) {
                    graph.nodeVisibility(graph.nodeVisibility());
                    graph.linkVisibility(graph.linkVisibility());
                }
                saveViewState();
            });
        }

        var cochangeLinksBtn = $('#btn-cochange-links');
        if (cochangeLinksBtn) {
            cochangeLinksBtn.addEventListener('click', function() {
                showCochangeLinks = !showCochangeLinks;
                cochangeLinksBtn.classList.toggle('active', showCochangeLinks);
                applyFilters();
                saveViewState();
            });
        }

        // Warp points (warps.js) — inject live-state hooks, then wire the UI
        if (window.AuraWarps) {
            AuraWarps.init({
                getGraph: function () { return graph; },
                getGraphData: function () { return graphData; },
                getWarps: function () { return warps; },
                findNode: findNode,
                postMessage: function (msg) { vscode.postMessage(msg); },
                saveViewState: saveViewState,
                schedulePaletteSave: schedulePaletteSave
            });
            AuraWarps.setup();
        }

        if (window.AuraFlowView) {
            window.AuraFlowView.init({
                request: function (payload) {
                    try { vscode.postMessage({ type: 'requestFlow', payload: payload }); } catch (_) { /* noop */ }
                },
                openFile: function (fileId, line) {
                    try { vscode.postMessage({ type: 'openFile', payload: { path: fileId, line: line } }); } catch (_) { /* noop */ }
                },
                findFunction: function (name) {
                    if (!graphData || !graphData.nodes) return null;
                    for (var i = 0; i < graphData.nodes.length; i++) {
                        var n = graphData.nodes[i];
                        var fns = (n.symbols && n.symbols.functions) || [];
                        for (var j = 0; j < fns.length; j++) {
                            if (fns[j].name === name) {
                                return { fileId: n.id, line: fns[j].line, language: n.language, name: name };
                            }
                        }
                    }
                    return null;
                },
                getSymbolCycles: function () {
                    return (graphData && graphData.meta && graphData.meta.symbolCycles) || [];
                }
            });
        }

        $('#btn-cycles').addEventListener('click', function() {
            showCycles = !showCycles;
            $('#btn-cycles').classList.toggle('active', showCycles);
            if (showCycles) {
                if (showOrphans)  { showOrphans = false;  $('#btn-highlight-orphans').classList.remove('active'); }
                if (showDeadCode) { showDeadCode = false;  $('#btn-dead-code').classList.remove('active'); }
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
                graph.linkWidth(getLinkWidth);
                graph.nodeThreeObject(graph.nodeThreeObject());
            }
            saveViewState();
        });

        $('#btn-group-dirs').addEventListener('click', function() {
            if (window.AuraStructure) AuraStructure.toggleDirectoryGroups();
            saveViewState();
        });

        $('#btn-path-mode').addEventListener('click', function() {
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

        $('#btn-labels').addEventListener('click', function() {
            showLabels = !showLabels;
            $('#btn-labels').classList.toggle('active', showLabels);
            if (graph) graph.nodeThreeObject(graph.nodeThreeObject());
            saveViewState();
        });

        var pilotBtn = $('#btn-pilot');
        if (pilotBtn) {
            pilotBtn.addEventListener('click', function () {
                if (!graph || !window.AuraFlight) return;
                if (window.AuraFlight.isActive()) {
                    window.AuraFlight.stop();
                } else {
                    if (window.AuraWarps) AuraWarps.cancelTravel(); // never take off while a warp flight owns the camera
                    window.AuraFlight.start(graph, graphContainer);
                }
                pilotBtn.blur(); // keep Space free for the keyboard toggle
            });
        }

        $('#btn-recenter').addEventListener('click', function() {
            if (!graph) return;
            if (window.AuraWarps) AuraWarps.cancelTravel();
            selectedNode = null;
            multiSelectedNodes.clear();
            multiSelectedLinks.clear();
            highlightNodes.clear();
            highlightLinks.clear();
            detailPanel.classList.add('collapsed');
            if (explodedNode) collapseExplosion();
            updateExplorerSelection();
            graph.zoomToFit(500, 50);
            // Clearing `selectedNode` is not enough: the glow/bloom lives in the
            // node three-objects, and link widths/particles may still reflect a
            // multi-selection. Rebuild the visuals so the next background click
            // sees a clean state (it otherwise skips the rebuild because
            // `selectedNode` is already null and leaves a stale glow behind).
            refreshGraphVisuals();
        });

        $('#heatmap-select').addEventListener('change', function(e) {
            setHeatmapMode(e.target.value);
            saveViewState();
        });

        var confidenceFilter = $('#confidence-filter');
        if (confidenceFilter) {
            confidenceFilter.addEventListener('change', function(e) {
                linkConfidenceMin = Math.max(0, Math.min(1, parseFloat(e.target.value) || 0));
                applyFilters();
                saveViewState();
            });
        }

        // Community palette buttons
        var cpSelectAll = $('#community-select-all');
        var cpSelectNone = $('#community-select-none');
        var cpClose = $('#community-palette-close');
        if (cpSelectAll) {
            cpSelectAll.addEventListener('click', function() {
                for (var k in communityNames) activeCommunities.add(Number(k));
                buildCommunityList();
                if (graph) { graph.nodeColor(graph.nodeColor()); graph.linkColor(graph.linkColor()); graph.nodeThreeObject(graph.nodeThreeObject()); }
            });
        }
        if (cpSelectNone) {
            cpSelectNone.addEventListener('click', function() {
                activeCommunities.clear();
                buildCommunityList();
                if (graph) { graph.nodeColor(graph.nodeColor()); graph.linkColor(graph.linkColor()); graph.nodeThreeObject(graph.nodeThreeObject()); }
            });
        }
        if (cpClose) {
            cpClose.addEventListener('click', function() {
                hideCommunityPalette();
            });
        }

        // Community palette drag
        (function() {
            var palette = $('#community-palette');
            var header = palette ? palette.querySelector('.community-palette-header') : null;
            if (!header) return;
            var dragging = false;
            var offsetX = 0, offsetY = 0;

            header.addEventListener('mousedown', function(e) {
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

            document.addEventListener('mousemove', function(e) {
                if (!dragging) return;
                var x = e.clientX - offsetX;
                var y = e.clientY - offsetY;
                // Clamp to viewport
                x = Math.max(0, Math.min(x, window.innerWidth - 60));
                y = Math.max(0, Math.min(y, window.innerHeight - 40));
                palette.style.left = x + 'px';
                palette.style.top = y + 'px';
            });

            document.addEventListener('mouseup', function() {
                if (!dragging) return;
                dragging = false;
                saveViewState(); // persist the dragged position
            });
        })();

        // CSS resize: both — persist user-resized dimensions (no mouseup to hook).
        if (window.ResizeObserver) {
            var communityPaletteEl = $('#community-palette');
            if (communityPaletteEl) new ResizeObserver(function () { schedulePaletteSave(); }).observe(communityPaletteEl);
        }

        // ============================================================
        // Minimap — 2D top-down overview with camera viewport rectangle
        // ============================================================
        (function() {
            var container = $('#minimap');
            var canvas = $('#minimap-canvas');
            var header = container ? container.querySelector('.minimap-header') : null;
            if (!container || !canvas || !header) return;
            var ctx = canvas.getContext('2d');
            var PADDING = 12;

            // --- Drag logic ---
            var dragging = false;
            var offsetX = 0, offsetY = 0;
            header.addEventListener('mousedown', function(e) {
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
            document.addEventListener('mousemove', function(e) {
                if (!dragging) return;
                var x = Math.max(0, Math.min(e.clientX - offsetX, window.innerWidth - 60));
                var y = Math.max(0, Math.min(e.clientY - offsetY, window.innerHeight - 40));
                container.style.left = x + 'px';
                container.style.top = y + 'px';
            });
            document.addEventListener('mouseup', function() {
                if (!dragging) return;
                dragging = false;
                saveViewState(); // persist the dragged position
            });

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
                    var u =  m.elements[0] * rx + m.elements[4] * ry + m.elements[8]  * rz;
                    var v = -(m.elements[1] * rx + m.elements[5] * ry + m.elements[9] * rz);
                    pts.push({ node: n, u: u, v: v });
                }

                // 4) Project camera target relative to centroid
                var ctrl = graph.controls();
                var target = ctrl.target;
                var trx = target.x - wcx, try_ = target.y - wcy, trz = target.z - wcz;
                var tu =  m.elements[0] * trx + m.elements[4] * try_ + m.elements[8]  * trz;
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

            canvas.addEventListener('mousedown', function(e) {
                if (!graph) return;
                draggingViewport = true;
                lastDragX = e.clientX;
                lastDragY = e.clientY;
                e.preventDefault();
            });

            // Handle drag on both canvas (while cursor is over it) and
            // document (when cursor leaves canvas during drag)
            canvas.addEventListener('mousemove', handleMinimapDrag);
            document.addEventListener('mousemove', function(e) {
                if (!draggingViewport) return;
                handleMinimapDrag(e);
            });

            document.addEventListener('mouseup', function() {
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
                } catch (ignored) {}
            }
            requestAnimationFrame(renderMinimap);
        })();

        $('#node-size-slider').addEventListener('input', function(e) {
            nodeSizeMultiplier = parseFloat(e.target.value);
            if (graph) graph.nodeVal(graph.nodeVal());
            saveViewState();
        });

        $('#spread-slider').addEventListener('input', function(e) {
            spreadMultiplier = parseFloat(e.target.value);
            if (graph) {
                applySpreadForces();
                reheatWithSettle();
            }
            saveViewState();
        });

        $('#depth-slider').addEventListener('input', function(e) {
            focusDepth = parseInt(e.target.value);
            $('#depth-value').textContent = focusDepth;
            // Re-apply if already pinned or in impact mode
            if (ttState().impactMode) {
                if (window.AuraTimeline) window.AuraTimeline.refreshImpact();
            } else if (pinnedNode) {
                if (blastMode) handleBlastRadius(pinnedNode, true);
                else handleNodeRightClick(pinnedNode, true);
            }
            saveViewState();
        });

        // ============================================================
        // Keyboard shortcuts
        // ============================================================
        var HEATMAP_MODES = ['off', 'complexity', 'cognitive', 'fanIn', 'fanOut', 'loc', 'churn', 'cochange', 'lastModified', 'community'];

        document.addEventListener('keydown', function(e) {
            // Ignore when typing in an input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
            if (!graph) return;

            // Pilot mode owns the keyboard while flying — single-letter
            // shortcuts (D = DAG, …) must not fire.
            if (window.AuraFlight && window.AuraFlight.isActive()) return;

            // Alt+Shift+1..9 — fly to the warp assigned to that quick slot.
            // (Plain Alt+digit is swallowed by VS Code; e.code — the physical Digit
            // row — keeps this working on AZERTY layouts too.)
            if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit[1-9]$/.test(e.code || '')) {
                e.preventDefault();
                var slotNum = parseInt(e.code.slice(5), 10);
                var slotWarp = null;
                for (var wi = 0; wi < warps.length; wi++) {
                    if (warps[wi].quickSlot === slotNum) { slotWarp = warps[wi]; break; }
                }
                if (slotWarp && window.AuraWarps) window.AuraWarps.travelTo(slotWarp);
                return;
            }

            // Never steal VS Code chords such as Ctrl+Shift+P or Ctrl+K.
            if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;

            switch (e.key.toLowerCase()) {
                case ' ':
                    // Space — toggle pilot mode (graph tab only; while flying,
                    // exit is handled inside AuraFlight itself).
                    if (graphContainer.clientWidth > 0 && window.AuraFlight) {
                        e.preventDefault();
                        if (window.AuraFlight.isActive()) {
                            window.AuraFlight.stop();
                        } else {
                            if (window.AuraWarps) AuraWarps.cancelTravel();
                            window.AuraFlight.start(graph, graphContainer);
                        }
                    }
                    break;
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
                    if (window.AuraTimeline) window.AuraTimeline.toggleImpact();
                    break;
                case 'v':
                    // Toggle compare mode (timeline)
                    if (window.AuraTimeline) window.AuraTimeline.toggleCompare();
                    break;
                case '1': case '2': case '3': case '4': case '5':
                    // Set focus depth
                    focusDepth = parseInt(e.key);
                    $('#depth-slider').value = focusDepth;
                    $('#depth-value').textContent = focusDepth;
                    // Re-apply if already pinned or in impact mode
                    if (ttState().impactMode) {
                        if (window.AuraTimeline) window.AuraTimeline.refreshImpact();
                    } else if (pinnedNode) {
                        if (blastMode) handleBlastRadius(pinnedNode, true);
                        else handleNodeRightClick(pinnedNode, true);
                    }
                    break;
                case 'arrowleft':
                    // Timeline: previous commit
                    if (window.AuraTimeline && window.AuraTimeline.stepPrev()) e.preventDefault();
                    break;
                case 'arrowright':
                    // Timeline: next commit
                    if (window.AuraTimeline && window.AuraTimeline.stepNext()) e.preventDefault();
                    break;
                case 'escape':
                    // Reset: clear selection, pinned focus, path mode, heatmap
                    selectedNode = null;
                    multiSelectedNodes.clear();
                    multiSelectedLinks.clear();
                    highlightNodes.clear();
                    highlightLinks.clear();
                    clearPinnedFocus();
                    if (window.AuraTimeline) window.AuraTimeline.clearImpact();
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
                    if (window.AuraTimeline) window.AuraTimeline.resetToHead();
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
            else if (langKey === 'cpp') langKey = (n.extension === '.hpp' || n.extension === '.hxx' || n.extension === '.hh') ? 'cpp-header' : 'cpp-source';
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
            // Root-level files (no directory) are always kept — they aren't
            // covered by any directory checkbox.
            if (!inDir && n.path.indexOf('/') === -1) inDir = true;
            if (!inDir) continue;
            filteredNodes.push(n);
        }
        var nodeIds = new Set();
        for (var j = 0; j < filteredNodes.length; j++) nodeIds.add(filteredNodes[j].id);
        var filteredLinks = [];
        for (var k = 0; k < data.links.length; k++) {
            var l = data.links[k];
            if (linkConfidenceMin > 0 && !l._cochange && typeof l.confidence === 'number' && l.confidence < linkConfidenceMin) continue;
            var sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            var targetId = typeof l.target === 'object' ? l.target.id : l.target;
            if (nodeIds.has(sourceId) && nodeIds.has(targetId)) filteredLinks.push(l);
        }

        // Temporal-coupling links are virtual: they exist only while the
        // Coupling overlay is enabled and never pollute graphData/DB edges.
        if (showCochangeLinks && !showGroups && cochangeResult.pairs.length > 0) {
            var virtualLimit = Math.min(80, cochangeResult.pairs.length);
            for (var cp = 0; cp < virtualLimit; cp++) {
                var pair = cochangeResult.pairs[cp];
                if (!nodeIds.has(pair.a) || !nodeIds.has(pair.b)) continue;
                filteredLinks.push({
                    source: pair.a,
                    target: pair.b,
                    type: 'co-change',
                    label: 'co-change ' + pair.jaccard.toFixed(2),
                    _cochange: pair.jaccard,
                    _cochangeCount: pair.cochanges
                });
            }
        }

        var result = { nodes: filteredNodes, links: filteredLinks };

        // Apply clustering if Groups mode is active (logic lives in structure.js)
        if (showGroups && window.AuraStructure) {
            result = AuraStructure.buildClusteredData(result, expandedGroups);
        }

        return result;
    }

    function applyFilters() {
        if (!graph || !graphData) return;
        graph.graphData(filterGraphData(graphData));
    }

    // ============================================================
    // File Explorer
    // ============================================================
    function setupExplorer() {
        if (!toggleExplorerBtn) return;
        toggleExplorerBtn.addEventListener('click', function() {
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
            explorerAllBtn.addEventListener('click', function() {
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
            explorerNoneBtn.addEventListener('click', function() {
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
        
        var keys = Object.keys(fileTree.children).sort(function(a, b) {
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
            cb.addEventListener('click', function(e) {
                e.stopPropagation();
            });
            cb.addEventListener('change', function() {
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
            
            var keys = Object.keys(item.children).sort(function(a, b) {
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

            nodeEl.addEventListener('click', function(e) {
                e.stopPropagation();
                var isExpanded = nodeEl.dataset.expanded === 'true';
                nodeEl.dataset.expanded = !isExpanded;
                icon.textContent = isExpanded ? '📁' : '📂';
                if (isExpanded) childrenContainer.classList.add('collapsed');
                else childrenContainer.classList.remove('collapsed');
            });
        } else {
            nodeEl.addEventListener('click', function(e) {
                e.stopPropagation();
                if (item.node) {
                    handleNodeClick(item.node);
                    updateExplorerSelection();
                }
            });
            // Double-click: open in editor
            nodeEl.addEventListener('dblclick', function(e) {
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
    // Bottom bars offset
    // The filter bar and the time-travel bar flex-wrap when the webview
    // is narrow, which makes them taller. Bottom-anchored overlays
    // (heatmap legend, minimap) read --aura-bottom-bars so they always
    // sit above the bars instead of overlapping them.
    // ============================================================
    function setupBottomBarsOffset() {
        var filterBar = $('#filter-bar');
        var timeBar = $('#timeline-bar');

        function update() {
            var h = 0;
            if (filterBar && filterBar.style.display !== 'none') h += filterBar.offsetHeight;
            if (timeBar && !timeBar.classList.contains('hidden')) h += timeBar.offsetHeight;
            document.documentElement.style.setProperty('--aura-bottom-bars', h + 'px');
        }

        update();
        window.addEventListener('resize', update);
        if (typeof ResizeObserver !== 'undefined') {
            var ro = new ResizeObserver(update);
            if (filterBar) ro.observe(filterBar);
            if (timeBar) ro.observe(timeBar);
        }
    }

    // ============================================================
    // Tabs
    // ============================================================
    function setupTabs() {
        var tabBtns = document.querySelectorAll('.tab-btn');
        for (var i = 0; i < tabBtns.length; i++) {
            tabBtns[i].addEventListener('click', function() {
                switchTab(this.dataset.tab);
            });
        }

        // Tab views (views.js) — inject live-state getters, then wire the controls
        if (window.AuraViews) {
            AuraViews.init({
                getGraphData: function () { return graphData; },
                getTimelineCommits: timelineCommitsList,
                getTimelineDeltas: function () { return (window.AuraTimeline && window.AuraTimeline.getDeltas()) || {}; },
                getTimelineScannedCount: function () { return (window.AuraTimeline && window.AuraTimeline.getScannedCount()) || 0; },
                getCommunityMap: function () { return communityMap; },
                getCommunityNames: function () { return communityNames; },
                getSelectedNode: function () { return selectedNode; },
                setSelectedNode: function (n) { selectedNode = n; },
                getActiveTab: function () { return activeTab; },
                getCochangeResult: function () { return cochangeResult; },
                getCochangeOptions: function () { return { windowDays: cochangeWindowDays, minScore: cochangeMinScore }; },
                setCochangeOptions: setCochangeOptions,
                showCochangeOnGraph: showCochangeOnGraph,
                focusNode: focusNodeFromView,
                findNode: findNode,
                postMessage: function (msg) { vscode.postMessage(msg); }
            });
            AuraViews.setupTableInteractions();
            AuraViews.setupCoupling();
            AuraViews.setupTreemap();
            AuraViews.setupDSM();
            AuraViews.setupChord();
            AuraViews.setupTimelineChart();
        }
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
        var overlays = ['#heatmap-legend', '#community-palette', '#minimap', '#warps-panel', '#tooltip'];

        if (tabName !== 'graph') {
            if (prevTab === 'graph') {
                if (filterBar) filterBar._wasVisible = filterBar.style.display !== 'none';
                if (timeBar) timeBar._wasVisible = !timeBar.classList.contains('hidden');
                for (var i = 0; i < overlays.length; i++) {
                    var el = $(overlays[i]);
                    if (el) el._wasVisible = !el.classList.contains('hidden');
                }
            }
            if (filterBar) filterBar.style.display = 'none';
            if (timeBar) timeBar.classList.add('hidden');
            for (var i = 0; i < overlays.length; i++) {
                var el = $(overlays[i]);
                if (el) el.classList.add('hidden');
            }
        } else {
            if (filterBar) filterBar.style.display = '';
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

        // Pause/resume WebGL
        if (tabName === 'graph') {
            resumeGraph();
            // Re-derive state-driven overlays (they may have been requested while
            // another tab was active, e.g. by a late restoreViewState)
            setHeatmapMode(heatmapMode);
            // Re-measure the canvas and refresh the camera controls: TrackballControls
            // computes rotation from its cached screen size, which can go stale while
            // the container is hidden (zoom would still work, rotation would not).
            if (graph && graphContainer && graphContainer.clientWidth > 0) {
                graph.width(graphContainer.clientWidth);
                graph.height(graphContainer.clientHeight);
                refreshCameraControls();
            }
        } else {
            pauseGraph();
            // Pilot mode only makes sense in the graph tab.
            if (window.AuraFlight && window.AuraFlight.isActive()) window.AuraFlight.stop();
        }

        // Render tab content (the view renderers live in views.js)
        if (window.AuraViews) {
            if (tabName === 'metrics') AuraViews.renderMetrics();
            if (tabName === 'coupling') AuraViews.renderCoupling();
            if (tabName === 'treemap') AuraViews.renderTreemap();
            if (tabName === 'dsm') AuraViews.renderDSM();
            if (tabName === 'chord') AuraViews.renderChord();
            if (tabName === 'timeline') AuraViews.renderTimelineChart();
            if (tabName === 'table') AuraViews.renderTable();
        }
        if (tabName === 'risk' && window.AuraRiskMap) AuraRiskMap.renderRiskDashboard();
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

    /**
     * Re-read the canvas size into the camera controls. TrackballControls caches
     * the screen size and derives its rotation speed from it — a stale value
     * (default 300×150 canvas) makes rotation feel wrong.
     */
    function refreshCameraControls() {
        if (!graph || typeof graph.controls !== 'function') return;
        var controls;
        try { controls = graph.controls(); } catch (e) { controls = null; }
        if (!controls) return;
        if (typeof controls.handleResize === 'function') {
            controls.handleResize();
        }
        // auraVisualizer.rotateSpeed — 1 = default, 5 = fastest
        var cfg = window.AURA_CONFIG || {};
        var speed = typeof cfg.rotateSpeed === 'number' && isFinite(cfg.rotateSpeed)
            ? Math.min(5, Math.max(1, cfg.rotateSpeed)) : 1;
        controls.rotateSpeed = speed;
    }

})();
