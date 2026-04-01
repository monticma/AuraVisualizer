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

    // Explorer state
    var showExplorer = false;
    var fileTree = {};

    // Explosion state
    var explodedNode = null;
    var explosionData = null;

    // Time Machine state
    var timelineCommits = [];       // all commits, newest first
    var timelineDeltas = {};        // hash → CommitDelta
    var timelinePosition = -1;     // -1 = HEAD (current), 0 = newest commit, N = older
    var timelineScannedCount = 0;
    var timelineTotalCount = 0;
    var headGraphData = null;       // snapshot of graph at HEAD for reset
    var timelineActive = false;     // true when navigating history
    var timelineChangedNodes = new Set(); // nodes touched at current commit (for visual highlight)

    // Render throttle state
    var engineRunning = true;
    var idleTimer = null;
    var isPaused = false;
    var lastPointerX = -1;
    var lastPointerY = -1;

    // ============================================================
    // DOM References
    // ============================================================
    var $ = function(sel) { return document.querySelector(sel); };

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
            case 'historyIndex':
                handleHistoryIndex(message.payload);
                break;
            case 'historyProgress':
                handleHistoryProgress(message.payload);
                break;
            case 'historyDelta':
                handleHistoryDelta(message.payload);
                break;
        }
    });

    // Tell the extension we're ready
    vscode.postMessage({ type: 'ready' });

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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function handleGraphData(data) {
        graphData = data;
        headGraphData = JSON.parse(JSON.stringify(data));
        computeMetricRanges();
        computeCommunities();
        updateStats(graphData.meta);
        updateLanguageButtons(graphData.nodes);
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        try {
            initGraph(graphData);
        } catch (e) {
            console.error('[aura] initGraph error:', e);
        }
        buildExplorerTree(graphData.nodes);
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
    }

    function setupRefresh() {
        var btn = $('#btn-refresh');
        if (btn) {
            btn.addEventListener('click', function() {
                vscode.postMessage({ type: 'requestRefresh' });
                if (loadingOverlay) loadingOverlay.style.display = 'flex';
            });
        }
        var exportBtn = $('#btn-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', function() {
                vscode.postMessage({ type: 'requestExport' });
            });
        }
    }

    function updateStats(meta) {
        $('#stat-files').textContent = meta.totalFiles + ' files';
        $('#stat-links').textContent = meta.totalLinks + ' links';
        $('#project-name').textContent = meta.projectName;

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
            fanIn:      { min: Infinity, max: -Infinity },
            fanOut:     { min: Infinity, max: -Infinity },
            loc:        { min: Infinity, max: -Infinity },
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
            metricRanges.loc.min = Math.min(metricRanges.loc.min, n.linesOfCode);
            metricRanges.loc.max = Math.max(metricRanges.loc.max, n.linesOfCode);
            var mtime = n.lastModified || 0;
            metricRanges.lastModified.min = Math.min(metricRanges.lastModified.min, mtime);
            metricRanges.lastModified.max = Math.max(metricRanges.lastModified.max, mtime);
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

        // Drop singleton communities (< 2 members)
        for (var sc in commFiles) {
            if (commFiles[sc].length < 2) {
                for (var si2 = 0; si2 < commFiles[sc].length; si2++) {
                    delete communityMap[commFiles[sc][si2].id];
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

        // Name each community
        activeCommunities.clear();
        for (var ci2 = 0; ci2 < finalId; ci2++) {
            communityColors[ci2] = GROUP_COLORS[ci2 % GROUP_COLORS.length];
            activeCommunities.add(ci2);
            var files = newCommFiles[ci2] || [];
            communityNames[ci2] = { name: nameCommunity(files), files: files.map(function(f) { return f.id; }) };
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
                item.addEventListener('click', function() {
                    if (activeCommunities.has(cid)) activeCommunities.delete(cid);
                    else activeCommunities.add(cid);
                    item.classList.toggle('dimmed', !activeCommunities.has(cid));
                    if (graph) { graph.nodeColor(graph.nodeColor()); graph.linkColor(graph.linkColor()); }
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
            .nodeColor(function(node) { return getNodeColor(node); })
            .nodeRelSize(1)
            .nodeVal(function(node) { return getNodeSize(node); })
            .nodeOpacity(0.92)
            .nodeThreeObjectExtend(true)
            .nodeThreeObject(function(node) {
                var T = window.THREE;
                var isSelected = (selectedNode && selectedNode.id === node.id) || multiSelectedNodes.has(node);
                var isBlastSource = blastMode && pinnedNode && node.id === pinnedNode.id;
                var hasLabel = showLabels &&
                    !(showOrphans && (node.fanIn > 0 || node.fanOut > 0)) &&
                    !(showDeadCode && !(node.deadExports && node.deadExports.length > 0)) &&
                    !(showCycles && !cycleNodeIds.has(node.id)) &&
                    !(pinnedNode && !pinnedNodes.has(node));

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

                // Glow effect for blast radius source node
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
            .linkColor(function(link) { return getLinkColor(link); })
            .linkWidth(function(link) { 
                if (pathMode && highlightedPath.links.has(link)) return 3;
                if (multiSelectedLinks.has(link)) return 2.5;
                if (link.type === 'extends') return highlightLinks.has(link) ? 2.5 : 1;
                if (link.type === 'implements') return highlightLinks.has(link) ? 2 : 0.8;
                return highlightLinks.has(link) ? 2 : 0.5; 
            })
            .linkOpacity(0.4)
            .linkDirectionalArrowLength(function(link) {
                if (link.type === 'extends' || link.type === 'implements') return 5;
                return 3;
            })
            .linkDirectionalArrowRelPos(1)
            .linkDirectionalParticles(function(link) { 
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

        graph
            .onEngineStop(function() {
                engineRunning = false;
                scheduleIdle();
            })
            .onEngineTick(function() {
                engineRunning = true;
            });

        // Double-click to open file (not natively supported, use DOM event)
        graphContainer.addEventListener('dblclick', function() {
            if (hoveredNode) handleNodeDblClick(hoveredNode);
        });

        graphContainer.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });

        // Resume rendering on real user interaction
        ['pointerdown', 'wheel'].forEach(function(evt) {
            graphContainer.addEventListener(evt, wakeGraph, { passive: true });
        });

        // Wake graph when interacting with overlays (palette, explorer, sidebar)
        var overlayEls = [
            $('#community-palette'),
            explorerPanel,
            $('#filter-bar'),
            detailPanel
        ];
        overlayEls.forEach(function(el) {
            if (el) el.addEventListener('pointerdown', wakeGraph, { passive: true });
        });

        // Track real mouse movement (ignore jitter < 3px)
        graphContainer.addEventListener('pointermove', function(e) {
            var dx = e.clientX - lastPointerX;
            var dy = e.clientY - lastPointerY;
            lastPointerX = e.clientX;
            lastPointerY = e.clientY;
            if (dx * dx + dy * dy > 9) {
                wakeGraph();
            }
        }, { passive: true });

        // Pause when webview tab is hidden
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                pauseGraph();
            } else {
                wakeGraph();
            }
        });

        setTimeout(function() {
            graph.zoomToFit(500, 50);
        }, 1500);

        // Handle webview resize (e.g. when side editor opens/closes)
        var resizeObserver = new ResizeObserver(function() {
            if (graph) {
                wakeGraph();
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
            if (timelineChangedNodes.has(node.id)) return '#ffd54f';
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
                case 'fanIn':      value = node.fanIn; break;
                case 'fanOut':     value = node.fanOut; break;
                case 'loc':        value = node.linesOfCode; break;
                case 'lastModified': value = node.lastModified || 0; break;
                default:           value = 0;
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

        if (pathMode) {
            if (highlightedPath.links.size > 0) {
                return highlightedPath.links.has(link) ? (LINK_COLORS[link.type] || '#ffffffaa') : '#ffffff05';
            }
            return '#ffffff11';
        }

        if (link._isExplosionLink) return '#81c78488';

        if (multiSelectedNodes.size > 0) {
            return multiSelectedLinks.has(link) ? '#93c5fdcc' : '#ffffff06';
        }

        if (pinnedNode) {
            return pinnedLinks.has(link) ? (LINK_COLORS[link.type] || '#ffffffaa') : '#ffffff06';
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
            if (hadSelection) {
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
    }

    function refreshGraphVisuals() {
        if (!graph) return;
        wakeGraph();
        graph.nodeColor(graph.nodeColor())
             .linkWidth(graph.linkWidth())
             .linkColor(graph.linkColor())
             .linkDirectionalParticles(graph.linkDirectionalParticles())
             .nodeThreeObject(graph.nodeThreeObject());
    }

    // Light refresh: update colors without reheating the simulation
    function refreshGraphColors() {
        if (!graph) return;
        if (isPaused) {
            isPaused = false;
            graph.resumeAnimation();
        }
        graph.nodeColor(graph.nodeColor())
             .linkWidth(graph.linkWidth())
             .linkColor(graph.linkColor())
             .linkDirectionalParticles(graph.linkDirectionalParticles())
             .nodeThreeObject(graph.nodeThreeObject());
        scheduleIdle();
    }

    // ============================================================
    // Idle / Wake render management
    // ============================================================
    function hasActiveParticles() {
        return highlightLinks.size > 0 || pinnedLinks.size > 0 ||
               multiSelectedLinks.size > 0 ||
               (pathMode && highlightedPath.links.size > 0);
    }

    function scheduleIdle() {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(function() {
            if (hasActiveParticles()) {
                // Particles still animating, re-check later
                scheduleIdle();
                return;
            }
            if (!engineRunning && graph && !document.hidden) {
                pauseGraph();
            }
        }, 3000);
    }

    function pauseGraph() {
        if (isPaused || !graph) return;
        isPaused = true;
        graph.pauseAnimation();
    }

    function wakeGraph() {
        if (idleTimer) clearTimeout(idleTimer);
        if (!graph) return;
        if (isPaused) {
            isPaused = false;
            graph.resumeAnimation();
        }
        if (!engineRunning) {
            scheduleIdle();
        }
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
            var parts = [
                node.linesOfCode + ' lines',
                node.language,
                'ccx: ' + (node.complexity || 1),
                'in: ' + node.fanIn,
                'out: ' + node.fanOut
            ];
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
        $('#panel-loc').textContent = node.linesOfCode.toLocaleString();
        $('#panel-size').textContent = formatBytes(node.size);
        
        if (node.lastModified) {
            var date = new Date(node.lastModified);
            $('#panel-mtime').textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
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
            explodeBtn.addEventListener('click', function() {
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
                item.innerHTML =
                    '<span class="symbol-icon">' + (SYMBOL_ICONS['function'] || '⚡') + '</span>' +
                    '<span class="symbol-name">' + fn.name + '</span>' +
                    '<span class="symbol-meta">' + fn.returnType + '(' + shortenParams(fn.params) + ') L' + fn.line + '</span>';
                (function(line) {
                    item.addEventListener('dblclick', function() {
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
            (function(d) {
                var targetId = typeof d.target === 'object' ? d.target.id : d.target;
                var targetNode = null;
                for (var x = 0; x < graphData.nodes.length; x++) {
                    if (graphData.nodes[x].id === targetId) { targetNode = graphData.nodes[x]; break; }
                }
                var li = document.createElement('li');
                var typeClass = d.type === 'function-call' ? 'dep-type dep-type-call' : 'dep-type';
                li.innerHTML =
                    '<span class="dep-arrow">→</span>' +
                    '<span>' + (targetNode ? targetNode.name : targetId) + '</span>' +
                    '<span class="' + typeClass + '">' + d.type + '</span>';
                li.addEventListener('click', function() {
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
            (function(d) {
                var sourceId = typeof d.source === 'object' ? d.source.id : d.source;
                var sourceNode = null;
                for (var x = 0; x < graphData.nodes.length; x++) {
                    if (graphData.nodes[x].id === sourceId) { sourceNode = graphData.nodes[x]; break; }
                }
                var li = document.createElement('li');
                var typeClass = d.type === 'function-call' ? 'dep-type dep-type-call' : 'dep-type';
                li.innerHTML =
                    '<span class="dep-arrow">←</span>' +
                    '<span>' + (sourceNode ? sourceNode.name : sourceId) + '</span>' +
                    '<span class="' + typeClass + '">' + d.type + '</span>';
                li.addEventListener('click', function() {
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
        multiSelectedNodes.forEach(function(n) { nodes.push(n); });

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
            (function(node) {
                var fItem = document.createElement('div');
                fItem.className = 'symbol-item symbol-item-clickable';
                fItem.innerHTML =
                    '<span class="symbol-icon">' + (LANGUAGE_ICONS[node.language] || '📄') + '</span>' +
                    '<span class="symbol-name">' + node.name + '</span>' +
                    '<span class="symbol-meta">' + node.linesOfCode + ' lines</span>';
                fItem.addEventListener('click', function() {
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
        multiSelectedLinks.forEach(function(link) {
            var srcId = typeof link.source === 'object' ? link.source.id : link.source;
            var tgtId = typeof link.target === 'object' ? link.target.id : link.target;
            var srcNode = null, tgtNode = null;
            for (var x = 0; x < graphData.nodes.length; x++) {
                if (graphData.nodes[x].id === srcId) srcNode = graphData.nodes[x];
                if (graphData.nodes[x].id === tgtId) tgtNode = graphData.nodes[x];
            }
            var liEl = document.createElement('li');
            var typeClass = link.type === 'function-call' ? 'dep-type dep-type-call' : 'dep-type';
            liEl.innerHTML =
                '<span class="dep-arrow">→</span>' +
                '<span>' + (srcNode ? srcNode.name : srcId) + ' → ' + (tgtNode ? tgtNode.name : tgtId) + '</span>' +
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
        $('#panel-close').addEventListener('click', function() {
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

        explosionData = {
            parentId: node.id,
            subNodeIds: subNodes.map(function(n) { return n.id; })
        };

        var newNodes = currentData.nodes.concat(subNodes);
        var newLinks = currentData.links.concat(subLinks);
        graph.graphData({ nodes: newNodes, links: newLinks });
    }

    function collapseExplosion() {
        if (!explosionData) return;
        var currentData = graph.graphData();
        var subIds = new Set(explosionData.subNodeIds);

        var filteredNodes = currentData.nodes.filter(function(n) { return !subIds.has(n.id); });
        var filteredLinks = currentData.links.filter(function(l) { return !l._isExplosionLink; });

        graph.graphData({ nodes: filteredNodes, links: filteredLinks });
        explodedNode = null;
        explosionData = null;
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
                    _memberIds: members.map(function(n) { return n.id; })
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
        searchInput.addEventListener('input', function(e) {
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
                (function(node) {
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
                    item.addEventListener('click', function() {
                        handleNodeClick(node);
                        searchResults.classList.add('hidden');
                        searchInput.value = node.name;
                    });
                    searchResults.appendChild(item);
                })(results[r]);
            }

            searchResults.classList.remove('hidden');
        });

        document.addEventListener('click', function(e) {
            if (!e.target.closest('#search-container')) {
                searchResults.classList.add('hidden');
            }
        });

        searchInput.addEventListener('keydown', function(e) {
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
                    graph.zoomToFit(1000, 50, function(n) { return nodesInPath.has(n); });
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
                    graph.d3ReheatSimulation();
                }
                applyFilters();
            }
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
        });

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
                graph.linkWidth(function(link) {
                    if (showCycles) {
                        var srcId = typeof link.source === 'object' ? link.source.id : link.source;
                        var tgtId = typeof link.target === 'object' ? link.target.id : link.target;
                        if (cycleLinkKeys.has(srcId + '>' + tgtId)) return 2;
                    }
                    return highlightLinks.has(link) ? 1.5 : 0.3;
                });
                graph.nodeThreeObject(graph.nodeThreeObject());
            }
        });

        $('#btn-group-dirs').addEventListener('click', function() {
            toggleDirectoryGroups();
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
        });

        $('#btn-labels').addEventListener('click', function() {
            showLabels = !showLabels;
            $('#btn-labels').classList.toggle('active', showLabels);
            if (graph) graph.nodeThreeObject(graph.nodeThreeObject());
        });

        $('#btn-recenter').addEventListener('click', function() {
            if (!graph) return;
            selectedNode = null;
            highlightNodes.clear();
            highlightLinks.clear();
            detailPanel.classList.add('collapsed');
            if (explodedNode) collapseExplosion();
            graph.zoomToFit(500, 50);
            graph.nodeColor(graph.nodeColor());
        });

        $('#heatmap-select').addEventListener('change', function(e) {
            setHeatmapMode(e.target.value);
        });

        // Community palette buttons
        var cpSelectAll = $('#community-select-all');
        var cpSelectNone = $('#community-select-none');
        var cpClose = $('#community-palette-close');
        if (cpSelectAll) {
            cpSelectAll.addEventListener('click', function() {
                for (var k in communityNames) activeCommunities.add(Number(k));
                buildCommunityList();
                if (graph) { graph.nodeColor(graph.nodeColor()); graph.linkColor(graph.linkColor()); }
            });
        }
        if (cpSelectNone) {
            cpSelectNone.addEventListener('click', function() {
                activeCommunities.clear();
                buildCommunityList();
                if (graph) { graph.nodeColor(graph.nodeColor()); graph.linkColor(graph.linkColor()); }
            });
        }
        if (cpClose) {
            cpClose.addEventListener('click', function() {
                hideCommunityPalette();
            });
        }

        $('#node-size-slider').addEventListener('input', function(e) {
            nodeSizeMultiplier = parseFloat(e.target.value);
            if (graph) graph.nodeVal(graph.nodeVal());
        });

        $('#spread-slider').addEventListener('input', function(e) {
            spreadMultiplier = parseFloat(e.target.value);
            if (graph) {
                applySpreadForces();
                graph.d3ReheatSimulation();
                wakeGraph();
            }
        });

        $('#depth-slider').addEventListener('input', function(e) {
            focusDepth = parseInt(e.target.value);
            $('#depth-value').textContent = focusDepth;
            // Re-apply if already pinned
            if (pinnedNode) {
                if (blastMode) handleBlastRadius(pinnedNode, true);
                else handleNodeRightClick(pinnedNode, true);
            }
        });

        // ============================================================
        // Keyboard shortcuts
        // ============================================================
        var HEATMAP_MODES = ['off', 'complexity', 'fanIn', 'fanOut', 'loc', 'lastModified', 'community'];

        document.addEventListener('keydown', function(e) {
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
                case '1': case '2': case '3': case '4': case '5':
                    // Set focus depth
                    focusDepth = parseInt(e.key);
                    $('#depth-slider').value = focusDepth;
                    $('#depth-value').textContent = focusDepth;
                    // Re-apply if already pinned
                    if (pinnedNode) {
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
            if (activeLanguages.has(langKey)) filteredNodes.push(n);
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
    // Time Machine — Timeline Navigation
    // ============================================================
    function setupTimeline() {
        if (!timelineSlider || !timelinePrevBtn || !timelineNextBtn) return;

        timelineSlider.addEventListener('input', function() {
            var pos = parseInt(timelineSlider.value);
            navigateToCommit(pos);
        });

        timelinePrevBtn.addEventListener('click', function() {
            var pos = parseInt(timelineSlider.value);
            if (pos > 0) {
                timelineSlider.value = pos - 1;
                navigateToCommit(pos - 1);
            }
        });

        timelineNextBtn.addEventListener('click', function() {
            var pos = parseInt(timelineSlider.value);
            var max = parseInt(timelineSlider.max);
            if (pos < max) {
                timelineSlider.value = pos + 1;
                navigateToCommit(pos + 1);
            }
        });
    }

    function handleHistoryIndex(index) {
        timelineCommits = index.commits || [];
        timelineTotalCount = index.totalCommits || 0;
        timelineScannedCount = index.scannedCommits || 0;

        if (timelineCommits.length === 0) return;

        // Show timeline bar
        timelineBar.classList.remove('hidden');
        document.body.classList.add('has-timeline');

        // Slider: 0 = oldest scanned, max = HEAD (current state)
        // We add +1 to max because the last position is HEAD (not a commit)
        var maxPos = timelineScannedCount;
        timelineSlider.min = 0;
        timelineSlider.max = maxPos;
        timelineSlider.value = maxPos; // start at HEAD
        timelinePosition = -1;

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

        updateTimelineButtons();
        updateTimelineProgress();
    }

    function handleHistoryDelta(delta) {
        // Store the delta keyed by hash
        timelineDeltas[delta.hash] = delta;
        updateTimelineButtons();
    }

    function navigateToCommit(sliderPos) {
        var maxPos = parseInt(timelineSlider.max);

        if (sliderPos >= maxPos) {
            // Back to HEAD
            timelinePosition = -1;
            timelineActive = false;
            timelineChangedNodes.clear();
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
                timelineChangedNodes.add(node.id);
            }
            nodeIds.add(node.id);
            newNodes.push(node);
        }

        // Grab the most recent commit's delta to identify what changed at the current position
        var currentCommit = timelineCommits[targetCommitIdx];
        var currentDelta = timelineDeltas[currentCommit.hash];
        if (currentDelta) {
            for (var ca = 0; ca < currentDelta.added.length; ca++) {
                timelineChangedNodes.add(currentDelta.added[ca]);
            }
            for (var cr = 0; cr < currentDelta.removed.length; cr++) {
                timelineChangedNodes.add(currentDelta.removed[cr]);
            }
            var cmk = Object.keys(currentDelta.modified);
            for (var cm = 0; cm < cmk.length; cm++) {
                timelineChangedNodes.add(cmk[cm]);
            }
        }

        // Rebuild links from HEAD links + modified state
        for (var li = 0; li < headGraphData.links.length; li++) {
            var headLink = headGraphData.links[li];
            var srcId = typeof headLink.source === 'object' ? headLink.source.id : headLink.source;
            var tgtId = typeof headLink.target === 'object' ? headLink.target.id : headLink.target;
            if (nodeIds.has(srcId) && nodeIds.has(tgtId)) {
                newLinks.push({ source: srcId, target: tgtId, type: headLink.type, label: headLink.label || '' });
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
                        // Check if this link already exists
                        var exists = false;
                        for (var el = 0; el < newLinks.length; el++) {
                            var es = typeof newLinks[el].source === 'object' ? newLinks[el].source.id : newLinks[el].source;
                            var et = typeof newLinks[el].target === 'object' ? newLinks[el].target.id : newLinks[el].target;
                            if (es === modFile && et === linkOut.target && newLinks[el].type === linkOut.type) {
                                exists = true;
                                break;
                            }
                        }
                        if (!exists) {
                            newLinks.push({
                                source: modFile,
                                target: linkOut.target,
                                type: linkOut.type,
                                label: ''
                            });
                        }
                    }
                }
            }
        }

        // Pin existing nodes so the layout doesn't restart
        for (var pi = 0; pi < newNodes.length; pi++) {
            var pn = newNodes[pi];
            if (pn.x !== undefined) { pn.fx = pn.x; pn.fy = pn.y; pn.fz = pn.z; }
        }

        // Update the graph
        graphData.nodes = newNodes;
        graphData.links = newLinks;
        graphData.meta.totalFiles = newNodes.length;
        graphData.meta.totalLinks = newLinks.length;

        graph.graphData({ nodes: newNodes, links: newLinks });
        refreshGraphVisuals();

        // Unpin after engine settles
        setTimeout(function() {
            var d = graph.graphData();
            for (var ui = 0; ui < d.nodes.length; ui++) {
                delete d.nodes[ui].fx; delete d.nodes[ui].fy; delete d.nodes[ui].fz;
            }
        }, 500);
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
        refreshGraphVisuals();

        setTimeout(function() {
            var d = graph.graphData();
            for (var ui = 0; ui < d.nodes.length; ui++) {
                delete d.nodes[ui].fx; delete d.nodes[ui].fy; delete d.nodes[ui].fz;
            }
        }, 500);
    }

    function findNodeInGraph(id) {
        if (!graph) return null;
        var data = graph.graphData();
        for (var i = 0; i < data.nodes.length; i++) {
            if (data.nodes[i].id === id) return data.nodes[i];
        }
        return null;
    }

    function updateTimelineLabel() {
        var maxPos = parseInt(timelineSlider.max);
        var pos = parseInt(timelineSlider.value);

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
                $('#timeline-message').textContent = commit.message;
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
        toggleExplorerBtn.addEventListener('click', function() {
            showExplorer = !showExplorer;
            if (showExplorer) {
                explorerPanel.classList.remove('collapsed');
                toggleExplorerBtn.classList.add('active');
            } else {
                explorerPanel.classList.add('collapsed');
                toggleExplorerBtn.classList.remove('active');
            }
        });
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

})();
