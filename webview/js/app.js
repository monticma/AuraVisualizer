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
    var activeLanguages = new Set(['c-source', 'c-header', 'javascript', 'typescript', 'python', 'css', 'html']);
    var dagMode = false;
    var showOrphans = false;
    var showLabels = false;
    var nodeSizeMultiplier = 4;
    var heatmapMode = 'off';
    var showGroups = false;
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

    // Explorer state
    var showExplorer = false;
    var fileTree = {};

    // Explosion state
    var explodedNode = null;
    var explosionData = null;

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

    // ============================================================
    // VSCode Message Handling
    // ============================================================
    window.addEventListener('message', function(event) {
        var message = event.data;
        switch (message.type) {
            case 'graphData':
                handleGraphData(message.payload);
                break;
            case 'focusNode':
                if (message.payload && message.payload.nodeId) {
                    focusNodeById(message.payload.nodeId);
                }
                break;
            case 'themeChanged':
                // Could adapt colors here if needed
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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function handleGraphData(data) {
        graphData = data;
        computeMetricRanges();
        updateStats(graphData.meta);
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        try {
            initGraph(graphData);
        } catch (e) {
            console.error('[aura] initGraph error:', e);
        }
        buildExplorerTree(graphData.nodes);
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
                var isSelected = selectedNode && selectedNode.id === node.id;
                var hasLabel = showLabels && !node._isSymbol &&
                    !(showOrphans && (node.fanIn > 0 || node.fanOut > 0)) &&
                    !(pinnedNode && !pinnedNodes.has(node));

                if (!isSelected && !hasLabel) return null;

                var group = new T.Group();

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
                return highlightLinks.has(link) ? 2 : 0.5; 
            })
            .linkOpacity(0.4)
            .linkDirectionalArrowLength(3)
            .linkDirectionalArrowRelPos(1)
            .linkDirectionalParticles(function(link) { 
                if (pathMode && highlightedPath.links.has(link)) return 4;
                return highlightLinks.has(link) ? 3 : 0; 
            })
            .linkDirectionalParticleWidth(2)
            .linkDirectionalParticleSpeed(0.005)
            .backgroundColor('#0d1117')
            .showNavInfo(false)
            .onNodeHover(handleNodeHover)
            .onNodeClick(handleNodeClick)
            .onNodeRightClick(handleNodeRightClick)
            .onBackgroundClick(handleBackgroundClick)
            .onBackgroundRightClick(handleBackgroundRightClick)
            .warmupTicks(100)
            .cooldownTicks(200);

        // Double-click to open file (not natively supported, use DOM event)
        graphContainer.addEventListener('dblclick', function() {
            if (hoveredNode) handleNodeDblClick(hoveredNode);
        });

        graphContainer.addEventListener('contextmenu', function(e) {
            e.preventDefault();
        });

        setTimeout(function() {
            graph.zoomToFit(500, 50);
        }, 1500);

        // Handle webview resize (e.g. when side editor opens/closes)
        var resizeObserver = new ResizeObserver(function() {
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

        if (selectedNode && selectedNode.id === node.id) return '#93c5fd';

        if (heatmapMode !== 'off') {
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
            if (pinnedNode) return pinnedNodes.has(node) ? color : color + '15';
            if (highlightNodes.size > 0 && !highlightNodes.has(node)) return color + '44';
            return color;
        }

        var langKeyFinal = node.language === 'c' ? (node.extension === '.h' ? 'c-header' : 'c-source') : node.language;
        var baseColor = LANGUAGE_COLORS[langKeyFinal] || '#ffffff';

        if (pinnedNode) return pinnedNodes.has(node) ? baseColor : baseColor + '15';
        if (highlightNodes.size > 0 && !highlightNodes.has(node)) return baseColor + '44';
        return baseColor;
    }

    function getNodeSize(node) {
        if (node._isSymbol) return nodeSizeMultiplier * 0.5;
        var baseLOC = Math.max(node.linesOfCode || 1, 1);
        var size = Math.pow(baseLOC, 0.4) * nodeSizeMultiplier * 0.3;
        if (showOrphans && node.fanIn === 0 && node.fanOut === 0) return size * 1.5;
        return size;
    }

    function getLinkColor(link) {
        if (showOrphans) return '#ffffff02';

        if (pathMode) {
            if (highlightedPath.links.size > 0) {
                return highlightedPath.links.has(link) ? (LINK_COLORS[link.type] || '#ffffffaa') : '#ffffff05';
            }
            return '#ffffff11';
        }

        if (link._isExplosionLink) return '#81c78488';

        if (pinnedNode) {
            return pinnedLinks.has(link) ? (LINK_COLORS[link.type] || '#ffffffaa') : '#ffffff06';
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

    function handleNodeClick(node) {
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

    // Double-click: open file in VSCode editor
    function handleNodeDblClick(node) {
        if (!node || node._isSymbol) {
            // For symbols, open file at symbol line
            if (node && node._isSymbol) {
                vscode.postMessage({
                    type: 'openFile',
                    payload: { path: node.path, line: node._line }
                });
            }
            return;
        }
        vscode.postMessage({
            type: 'openFile',
            payload: { path: node.path }
        });
    }

    function handleBackgroundClick() {
        if (pathMode) return;
        selectedNode = null;
        highlightNodes.clear();
        highlightLinks.clear();
        detailPanel.classList.add('hidden');
        clearPinnedFocus();
        if (explodedNode) collapseExplosion();
        updateExplorerSelection();
        if (graph) {
            graph.nodeColor(graph.nodeColor())
                 .nodeThreeObject(graph.nodeThreeObject());
        }
    }

    // ============================================================
    // Right-click pinned focus
    // ============================================================
    function handleNodeRightClick(node) {
        if (!node || pathMode) return;
        if (pinnedNode && pinnedNode.id === node.id) {
            clearPinnedFocus();
            refreshGraphVisuals();
            return;
        }

        pinnedNode = node;
        pinnedNodes.clear();
        pinnedLinks.clear();
        pinnedNodes.add(node);

        var currentLinks = graph.graphData().links;
        for (var i = 0; i < currentLinks.length; i++) {
            var l = currentLinks[i];
            var sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            var targetId = typeof l.target === 'object' ? l.target.id : l.target;
            if (sourceId === node.id || targetId === node.id) {
                pinnedLinks.add(l);
                var sourceNode = typeof l.source === 'object' ? l.source : findNode(l.source);
                var targetNode = typeof l.target === 'object' ? l.target : findNode(l.target);
                if (sourceNode) pinnedNodes.add(sourceNode);
                if (targetNode) pinnedNodes.add(targetNode);
            }
        }

        refreshGraphVisuals();
    }

    function handleBackgroundRightClick() {
        clearPinnedFocus();
        refreshGraphVisuals();
    }

    function clearPinnedFocus() {
        pinnedNode = null;
        pinnedNodes.clear();
        pinnedLinks.clear();
    }

    function refreshGraphVisuals() {
        if (!graph) return;
        graph.nodeColor(graph.nodeColor())
             .linkWidth(graph.linkWidth())
             .linkColor(graph.linkColor())
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

        if (node._isSymbol) {
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

    // ============================================================
    // Detail Panel
    // ============================================================
    function showDetailPanel(node) {
        if (node._isSymbol) return;
        detailPanel.classList.remove('hidden');

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

    function shortenParams(params) {
        if (!params) return '';
        if (params.length > 40) return params.substring(0, 37) + '...';
        return params;
    }

    function setupPanelClose() {
        $('#panel-close').addEventListener('click', function() {
            detailPanel.classList.add('hidden');
            selectedNode = null;
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
    function setHeatmapMode(mode) {
        heatmapMode = mode;
        var legend = $('#heatmap-legend');

        if (mode === 'off') {
            legend.classList.add('hidden');
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
                $('#legend-low').textContent = range.min;
                $('#legend-high').textContent = range.max;
            }
        }

        if (graph) graph.nodeColor(graph.nodeColor());
    }

    // ============================================================
    // Directory Grouping
    // ============================================================
    function toggleDirectoryGroups() {
        showGroups = !showGroups;
        $('#btn-group-dirs').classList.toggle('active', showGroups);
        if (showGroups) buildGroupMeshes();
        else removeGroupMeshes();
    }

    function buildGroupMeshes() {
        removeGroupMeshes();
        if (!graph || !graphData) return;

        var groups = {};
        var currentNodes = graph.graphData().nodes;
        for (var i = 0; i < currentNodes.length; i++) {
            var n = currentNodes[i];
            if (n._isSymbol) continue;
            var grp = n.group || '/';
            if (!groups[grp]) groups[grp] = [];
            groups[grp].push(n);
        }

        var groupNames = Object.keys(groups).sort();
        var colorIdx = 0;

        for (var g = 0; g < groupNames.length; g++) {
            var groupName = groupNames[g];
            var nodes = groups[groupName];
            if (nodes.length < 2) continue;

            var cx = 0, cy = 0, cz = 0;
            for (var ni = 0; ni < nodes.length; ni++) {
                cx += (nodes[ni].x || 0);
                cy += (nodes[ni].y || 0);
                cz += (nodes[ni].z || 0);
            }
            cx /= nodes.length; cy /= nodes.length; cz /= nodes.length;

            var maxDist = 0;
            for (var nj = 0; nj < nodes.length; nj++) {
                var dx = (nodes[nj].x || 0) - cx;
                var dy = (nodes[nj].y || 0) - cy;
                var dz = (nodes[nj].z || 0) - cz;
                var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist > maxDist) maxDist = dist;
            }

            var color = GROUP_COLORS[colorIdx % GROUP_COLORS.length];
            colorIdx++;
            addGroupLabel(groupName, cx, cy, cz, color, nodes.length);
        }
    }

    function addGroupLabel(name, x, y, z, color, count) {
        var overlay = document.createElement('div');
        overlay.className = 'group-label';
        overlay.style.borderColor = color;
        overlay.style.color = color;
        overlay.innerHTML = '<span class="group-label-name">' + name + '</span>' +
                           '<span class="group-label-count">' + count + '</span>';
        overlay._groupData = { x: x, y: y, z: z };
        graphContainer.appendChild(overlay);
        groupMeshes.push(overlay);
        updateGroupLabelPositions();
    }

    function updateGroupLabelPositions() {
        if (!graph || groupMeshes.length === 0) return;

        requestAnimationFrame(function updateLoop() {
            if (!showGroups || groupMeshes.length === 0) return;

            for (var i = 0; i < groupMeshes.length; i++) {
                var label = groupMeshes[i];
                var data = label._groupData;
                if (!data) continue;

                var pos = graph.graph2ScreenCoords(data.x, data.y, data.z);
                if (pos) {
                    label.style.left = pos.x + 'px';
                    label.style.top = pos.y + 'px';
                    label.style.display = 'block';
                } else {
                    label.style.display = 'none';
                }
            }

            if (showGroups) requestAnimationFrame(updateLoop);
        });
    }

    function removeGroupMeshes() {
        for (var i = 0; i < groupMeshes.length; i++) {
            if (groupMeshes[i].parentNode) groupMeshes[i].parentNode.removeChild(groupMeshes[i]);
        }
        groupMeshes = [];
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
            if (graph) {
                graph.nodeColor(graph.nodeColor());
                graph.nodeVal(graph.nodeVal());
                graph.linkColor(graph.linkColor());
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
            detailPanel.classList.add('hidden');
            if (explodedNode) collapseExplosion();
            graph.zoomToFit(500, 50);
            graph.nodeColor(graph.nodeColor());
        });

        $('#heatmap-select').addEventListener('change', function(e) {
            setHeatmapMode(e.target.value);
        });

        $('#node-size-slider').addEventListener('input', function(e) {
            nodeSizeMultiplier = parseFloat(e.target.value);
            if (graph) graph.nodeVal(graph.nodeVal());
        });
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
        return { nodes: filteredNodes, links: filteredLinks };
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
                explorerPanel.classList.remove('hidden');
                toggleExplorerBtn.classList.add('active');
            } else {
                explorerPanel.classList.add('hidden');
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
