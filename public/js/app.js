/**
 * app.js — Main Aura frontend application (V2).
 * 
 * Features:
 * - 3D force graph with interactive navigation
 * - Heatmap coloring by complexity, fan-in/out, LOC
 * - File explosion: expand a node to see its internal symbols
 * - Directory grouping: visual clusters by folder
 * - Search, filters, DAG mode, orphan highlighting
 * 
 * Depends on: ForceGraph3D (global), graph-config.js (globals)
 */

(function() {
    'use strict';

    // ============================================================
    // State
    // ============================================================
    var graph = null;
    var graphData = null;
    var selectedNode = null;
    var hoveredNode = null;
    var highlightNodes = new Set();
    var highlightLinks = new Set();
    var activeLanguages = new Set(['c-source', 'c-header', 'javascript', 'css', 'html']);
    var dagMode = false;
    var showOrphans = false;
    var showLabels = false;
    var nodeSizeMultiplier = 4;
    var heatmapMode = 'off'; // off, complexity, fanIn, fanOut, loc
    var showGroups = false;
    var groupMeshes = []; // Three.js meshes for directory groups
    var metricRanges = {}; // {min, max} for each metric

    // Path Mode
    var pathMode = false;
    var pathNodes = []; // [startNode, endNode]
    var highlightedPath = { nodes: new Set(), links: new Set() };

    // Explosion state
    var explodedNode = null;
    var explosionData = null; // { origNodes, origLinks, expandedNodes, expandedLinks }

    // ============================================================
    // DOM References
    // ============================================================
    var $ = function(sel) { return document.querySelector(sel); };
    var $$ = function(sel) { return document.querySelectorAll(sel); };

    var landingOverlay = $('#landing-overlay');
    var pathInput = $('#path-input');
    var analyzeBtn = $('#analyze-btn');
    var btnText = analyzeBtn.querySelector('.btn-text');
    var btnLoader = analyzeBtn.querySelector('.btn-loader');
    var landingError = $('#landing-error');

    var graphContainer = $('#graph-container');
    var searchInput = $('#search-input');
    var searchResults = $('#search-results');

    var detailPanel = $('#detail-panel');
    var tooltip = $('#tooltip');

    // ============================================================
    // Initialization
    // ============================================================
    document.addEventListener('DOMContentLoaded', init);
    if (document.readyState !== 'loading') init();

    function init() {
        setupLanding();
        setupSearch();
        setupFilters();
        setupPanelClose();
        setupExport();
    }

    function setupExport() {
        $('#btn-export').addEventListener('click', function() {
            if (!graph) return;
            var renderer = graph.renderer();
            var scene = graph.scene();
            var camera = graph.camera();
            
            // Forcer un rendu synchrone
            renderer.render(scene, camera);
            
            // L'extraction synchrone conserve le contexte de "clic utilisateur"
            // ce qui permet au navigateur d'honorer l'attribut 'download'.
            var dataUrl = renderer.domElement.toDataURL('image/png');
            
            var a = document.createElement('a');
            a.href = dataUrl;
            a.download = 'aura-graphe.png';
            
            // Requis par Chrome/Firefox
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        });
    }

    // ============================================================
    // Landing & Analysis
    // ============================================================
    function setupLanding() {
        analyzeBtn.addEventListener('click', startAnalysis);
        pathInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') startAnalysis();
        });
    }

    function startAnalysis() {
        var targetPath = pathInput.value.trim();
        if (!targetPath) {
            showLandingError('Veuillez entrer un chemin vers la codebase');
            return;
        }

        setLoading(true);
        landingError.classList.add('hidden');

        fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: targetPath })
        })
        .then(function(response) {
            if (!response.ok) {
                return response.json().then(function(err) {
                    throw new Error(err.error || 'Erreur HTTP ' + response.status);
                });
            }
            return response.json();
        })
        .then(function(data) {
            graphData = data;
            console.log('[aura] Analysis result:', graphData.meta);
            computeMetricRanges();
            updateStats(graphData.meta);
            landingOverlay.classList.add('hidden');
            initGraph(graphData);
        })
        .catch(function(err) {
            console.error('[aura] Analysis failed:', err);
            showLandingError(err.message);
        })
        .finally(function() {
            setLoading(false);
        });
    }

    function setLoading(loading) {
        analyzeBtn.disabled = loading;
        btnText.classList.toggle('hidden', loading);
        btnLoader.classList.toggle('hidden', !loading);
    }

    function showLandingError(msg) {
        landingError.textContent = msg;
        landingError.classList.remove('hidden');
    }

    function updateStats(meta) {
        $('#stat-files').textContent = meta.totalFiles + ' fichiers';
        $('#stat-links').textContent = meta.totalLinks + ' liens';
        $('#project-name').textContent = meta.projectName;

        var parts = [];
        var entries = Object.entries(meta.languageStats);
        for (var i = 0; i < entries.length; i++) {
            parts.push(entries[i][1].count + ' ' + entries[i][0]);
        }
        $('#stat-time').textContent = parts.join(', ');
    }

    // ============================================================
    // Metric Ranges (for heatmap normalization)
    // ============================================================
    function computeMetricRanges() {
        if (!graphData) return;
        var nodes = graphData.nodes;

        metricRanges = {
            complexity: { min: Infinity, max: -Infinity },
            fanIn:      { min: Infinity, max: -Infinity },
            fanOut:     { min: Infinity, max: -Infinity },
            loc:        { min: Infinity, max: -Infinity }
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
        }
    }

    function normalizeMetric(value, metric) {
        var range = metricRanges[metric];
        if (!range || range.max === range.min) return 0;
        return (value - range.min) / (range.max - range.min);
    }

    // ============================================================
    // 3D Graph Initialization
    // ============================================================
    function initGraph(data) {
        if (typeof ForceGraph3D === 'undefined') {
            console.error('[aura] ForceGraph3D not loaded!');
            return;
        }

        graph = ForceGraph3D()(graphContainer)
            .graphData(filterGraphData(data))
            .nodeId('id')
            .nodeLabel('')
            .nodeColor(function(node) { return getNodeColor(node); })
            .nodeRelSize(1)
            .nodeVal(function(node) { return getNodeSize(node); })
            .nodeOpacity(0.92)
            .nodeThreeObjectExtend(true)
            .nodeThreeObject(function(node) {
                if (!showLabels) return null;
                if (node._isSymbol) return null; // Don't label sub-symbols to avoid clutter
                var sprite = getLabelSprite(node.name);
                if (sprite) {
                    sprite.position.y = Math.sqrt(getNodeSize(node) || 1) * 2 + 2;
                }
                return sprite;
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
            .backgroundColor('#0a0e17')
            .showNavInfo(false)
            .onNodeHover(handleNodeHover)
            .onNodeClick(handleNodeClick)
            .onBackgroundClick(handleBackgroundClick)
            .warmupTicks(100)
            .cooldownTicks(200);

        // Zoom to fit after layout settles
        setTimeout(function() {
            graph.zoomToFit(500, 50);
        }, 1500);
    }

    // ============================================================
    // Node Visuals
    // ============================================================
    function getNodeColor(node) {
        // Path mode colors
        if (pathMode) {
            if (highlightedPath.nodes.size > 0) {
                if (highlightedPath.nodes.has(node)) {
                    if (pathNodes[0] && node.id === pathNodes[0].id) return '#4caf50'; // Start (green)
                    if (pathNodes[1] && node.id === pathNodes[1].id) return '#f44336'; // End (red)
                    return LANGUAGE_COLORS[node.language] || '#ffffff';
                }
                return '#ffffff11'; // Highly dimmed
            }
            if (pathNodes.length === 1 && pathNodes[0].id === node.id) {
                return '#4caf50'; // Start node is green
            }
            return (LANGUAGE_COLORS[node.language] || '#ffffff') + '44'; // Dim waiting for path
        }

        // Explosion sub-nodes
        if (node._isSymbol) {
            return node._symbolColor || '#81c784';
        }

        if (selectedNode && selectedNode.id === node.id) {
            return '#ffffff';
        }

        // Heatmap mode
        if (heatmapMode !== 'off') {
            var value;
            switch (heatmapMode) {
                case 'complexity': value = node.complexity || 1; break;
                case 'fanIn':      value = node.fanIn; break;
                case 'fanOut':     value = node.fanOut; break;
                case 'loc':        value = node.linesOfCode; break;
                default:           value = 0;
            }
            var norm = normalizeMetric(value, heatmapMode);
            var color = heatmapColor(norm, HEATMAP_SCALES[heatmapMode]);

            if (highlightNodes.size > 0 && !highlightNodes.has(node)) {
                return color + '44';
            }
            return color;
        }

        // Language mode (default)
        if (highlightNodes.size > 0 && !highlightNodes.has(node)) {
            var langKey = node.language === 'c' ? (node.extension === '.h' ? 'c-header' : 'c-source') : node.language;
            return (LANGUAGE_COLORS[langKey] || '#ffffff') + '44';
        }
        var langKeyActive = node.language === 'c' ? (node.extension === '.h' ? 'c-header' : 'c-source') : node.language;
        return LANGUAGE_COLORS[langKeyActive] || '#ffffff';
    }

    function getNodeSize(node) {
        if (node._isSymbol) {
            return nodeSizeMultiplier * 0.5;
        }
        var baseLOC = Math.max(node.linesOfCode || 1, 1);
        var size = Math.pow(baseLOC, 0.4) * nodeSizeMultiplier * 0.3;
        if (showOrphans && node.fanIn === 0 && node.fanOut === 0) {
            return size * 1.5;
        }
        return size;
    }

    function getLinkColor(link) {
        if (pathMode) {
            if (highlightedPath.links.size > 0) {
                return highlightedPath.links.has(link) ? (LINK_COLORS[link.type] || '#ffffffaa') : '#ffffff05';
            }
            return '#ffffff11';
        }

        if (link._isExplosionLink) {
            return '#81c78488';
        }
        if (highlightLinks.has(link)) {
            return LINK_COLORS[link.type] || '#ffffff88';
        }
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
            return; // Don't highlight local neighbors when path is shown
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
                pathNodes = [node]; // Reset to new start node
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

        // Fly to node
        var distance = 120;
        var distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        graph.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
            node,
            1000
        );

        showDetailPanel(node);
    }

    function handleBackgroundClick() {
        if (pathMode) return; // Keep path visible or allow user to click around
        selectedNode = null;
        highlightNodes.clear();
        highlightLinks.clear();
        detailPanel.classList.add('hidden');

        // Collapse explosion if active
        if (explodedNode) {
            collapseExplosion();
        }

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
            metaEl.textContent = node._symbolType + ' · ligne ' + (node._line || '?');
        } else {
            nameEl.textContent = (LANGUAGE_ICONS[node.language] || '📄') + ' ' + node.name;
            var parts = [
                node.linesOfCode + ' lignes',
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
        if (node._isSymbol) return; // Don't show panel for sub-symbols
        detailPanel.classList.remove('hidden');

        $('#panel-icon').textContent = LANGUAGE_ICONS[node.language] || '📄';
        $('#panel-filename').textContent = node.name;
        $('#panel-path').textContent = node.path;
        $('#panel-language').textContent = node.language;
        $('#panel-language').style.color = LANGUAGE_COLORS[node.language] || '#fff';
        $('#panel-group').textContent = node.group;
        $('#panel-loc').textContent = node.linesOfCode.toLocaleString();
        $('#panel-size').textContent = formatBytes(node.size);
        $('#panel-fanout').textContent = node.fanOut;
        $('#panel-fanin').textContent = node.fanIn;
        $('#panel-complexity').textContent = node.complexity || 1;

        // Symbols count
        var symbolCount = node.symbols ? node.symbols.totalSymbols : 0;
        $('#panel-symbols-count').textContent = symbolCount;

        // Symbols section (explosion mode)
        var symbolsSection = $('#symbols-section');
        var symbolsList = $('#symbols-list');
        symbolsList.innerHTML = '';

        if (node.symbols && node.symbols.totalSymbols > 0) {
            symbolsSection.style.display = 'block';
            $('#symbols-total').textContent = node.symbols.totalSymbols;

            // Functions
            for (var i = 0; i < node.symbols.functions.length; i++) {
                var fn = node.symbols.functions[i];
                var item = document.createElement('div');
                item.className = 'symbol-item';
                item.innerHTML =
                    '<span class="symbol-icon">' + (SYMBOL_ICONS['function'] || '⚡') + '</span>' +
                    '<span class="symbol-name">' + fn.name + '</span>' +
                    '<span class="symbol-meta">' + fn.returnType + '(' + shortenParams(fn.params) + ') L' + fn.line + '</span>';
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

            // Macros (limited)
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

            // Add explode button
            var explodeBtn = document.createElement('button');
            explodeBtn.className = 'explode-btn';
            explodeBtn.textContent = explodedNode && explodedNode.id === node.id ? '⊖ Replier' : '⊕ Exploser le fichier';
            explodeBtn.addEventListener('click', function() {
                if (explodedNode && explodedNode.id === node.id) {
                    collapseExplosion();
                } else {
                    explodeFile(node);
                }
            });
            symbolsList.insertBefore(explodeBtn, symbolsList.firstChild);

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
    // File Explosion Mode
    // ============================================================
    function explodeFile(node) {
        if (!node.symbols || !node.symbols.functions.length) return;

        // Collapse previous explosion if any
        if (explodedNode) {
            collapseExplosion();
        }

        explodedNode = node;
        var currentData = graph.graphData();

        // Create sub-nodes for each function
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
                // Position near parent
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

        // Save state for collapse
        explosionData = {
            parentId: node.id,
            subNodeIds: subNodes.map(function(n) { return n.id; })
        };

        // Add to graph
        var newNodes = currentData.nodes.concat(subNodes);
        var newLinks = currentData.links.concat(subLinks);
        graph.graphData({ nodes: newNodes, links: newLinks });

        console.log('[aura] Exploded ' + node.name + ': ' + subNodes.length + ' symbols');
    }

    function collapseExplosion() {
        if (!explosionData) return;

        var currentData = graph.graphData();
        var subIds = new Set(explosionData.subNodeIds);

        var filteredNodes = currentData.nodes.filter(function(n) {
            return !subIds.has(n.id);
        });
        var filteredLinks = currentData.links.filter(function(l) {
            return !l._isExplosionLink;
        });

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

            // Build gradient
            var gradient = $('#legend-gradient');
            var scale = HEATMAP_SCALES[mode];
            if (scale) {
                gradient.style.background = 'linear-gradient(to right, ' + scale.join(', ') + ')';
            }

            // Set range labels
            var range = metricRanges[mode];
            if (range) {
                $('#legend-low').textContent = range.min;
                $('#legend-high').textContent = range.max;
            }
        }

        // Refresh colors
        if (graph) {
            graph.nodeColor(graph.nodeColor());
        }
    }

    // ============================================================
    // Directory Grouping
    // ============================================================
    function toggleDirectoryGroups() {
        showGroups = !showGroups;
        $('#btn-group-dirs').classList.toggle('active', showGroups);

        if (showGroups) {
            buildGroupMeshes();
        } else {
            removeGroupMeshes();
        }
    }

    function buildGroupMeshes() {
        removeGroupMeshes(); // Clean up any existing
        if (!graph || !graphData) return;

        var scene = graph.scene();
        if (!scene) return;

        var THREE = window.THREE;
        if (!THREE) {
            // Try to get THREE from the graph's renderer
            try {
                var renderer = graph.renderer();
                // 3d-force-graph bundles THREE internally
                // We use the graph's scene and construct basic meshes
            } catch (e) {
                console.warn('[aura] THREE.js not accessible for group meshes');
            }
        }

        // Group nodes by directory
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

            // Compute bounding sphere
            var cx = 0, cy = 0, cz = 0;
            for (var ni = 0; ni < nodes.length; ni++) {
                cx += (nodes[ni].x || 0);
                cy += (nodes[ni].y || 0);
                cz += (nodes[ni].z || 0);
            }
            cx /= nodes.length;
            cy /= nodes.length;
            cz /= nodes.length;

            var maxDist = 0;
            for (var nj = 0; nj < nodes.length; nj++) {
                var dx = (nodes[nj].x || 0) - cx;
                var dy = (nodes[nj].y || 0) - cy;
                var dz = (nodes[nj].z || 0) - cz;
                var dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist > maxDist) maxDist = dist;
            }

            var radius = maxDist + 15;
            var color = GROUP_COLORS[colorIdx % GROUP_COLORS.length];
            colorIdx++;

            // Create a transparent sphere using raw Three.js from the scene
            try {
                var geometry = new scene.constructor.__proto__.constructor.prototype.constructor
                    ? null : null;

                // Since we can't directly access THREE, create a simple visual indicator
                // We'll use the graph's custom layer instead
                // Add group labels using CSS overlay instead
                addGroupLabel(groupName, cx, cy, cz, radius, color, nodes.length);
            } catch (e) {
                addGroupLabel(groupName, cx, cy, cz, radius, color, nodes.length);
            }
        }
    }

    function addGroupLabel(name, x, y, z, radius, color, count) {
        var overlay = document.createElement('div');
        overlay.className = 'group-label';
        overlay.style.borderColor = color;
        overlay.style.color = color;
        overlay.innerHTML = '<span class="group-label-name">' + name + '</span>' +
                           '<span class="group-label-count">' + count + '</span>';
        overlay._groupData = { x: x, y: y, z: z };
        graphContainer.appendChild(overlay);
        groupMeshes.push(overlay);

        // Update position on each frame
        updateGroupLabelPositions();
    }

    function updateGroupLabelPositions() {
        if (!graph || groupMeshes.length === 0) return;

        requestAnimationFrame(function updateLoop() {
            if (!showGroups || groupMeshes.length === 0) return;

            var camera = graph.camera();
            var renderer = graph.renderer();
            if (!camera || !renderer) return;

            var width = renderer.domElement.width;
            var height = renderer.domElement.height;

            for (var i = 0; i < groupMeshes.length; i++) {
                var label = groupMeshes[i];
                var data = label._groupData;
                if (!data) continue;

                // Project 3D position to 2D screen space
                var pos = graph.graph2ScreenCoords(data.x, data.y, data.z);
                if (pos) {
                    label.style.left = pos.x + 'px';
                    label.style.top = pos.y + 'px';
                    label.style.display = 'block';
                } else {
                    label.style.display = 'none';
                }
            }

            if (showGroups) {
                requestAnimationFrame(updateLoop);
            }
        });
    }

    function removeGroupMeshes() {
        for (var i = 0; i < groupMeshes.length; i++) {
            if (groupMeshes[i].parentNode) {
                groupMeshes[i].parentNode.removeChild(groupMeshes[i]);
            }
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
                            '<div class="result-path">' + node.path + '</div>' +
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
        if (idx === -1) return text;
        return text.slice(0, idx) +
               '<strong style="color:var(--text-accent)">' +
               text.slice(idx, idx + query.length) + '</strong>' +
               text.slice(idx + query.length);
    }

    // ============================================================
    // Label Sprites
    // ============================================================
    var labelSpriteCache = {};
    function getLabelSprite(text) {
        var THREE = window.THREE;
        if (!THREE) return null;

        if (labelSpriteCache[text]) {
            return labelSpriteCache[text].clone();
        }

        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        var fontSize = 32;
        context.font = fontSize + 'px sans-serif';
        var textWidth = context.measureText(text).width;
        
        // Add padding
        var paddingX = 16;
        var paddingY = 8;
        canvas.width = textWidth + paddingX;
        canvas.height = fontSize + paddingY;

        context.font = fontSize + 'px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Background
        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        context.roundRect ? context.roundRect(0, 0, canvas.width, canvas.height, 8) : context.fillRect(0, 0, canvas.width, canvas.height);
        context.fill();

        // Text
        context.fillStyle = 'rgba(255, 255, 255, 0.9)';
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        var texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        var material = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
        var sprite = new THREE.Sprite(material);
        
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
            
            var tNode = typeof l.target === 'object' ? l.target : null;
            if (!tNode) {
                tNode = findNode(typeof l.target === 'object' ? l.target.id : l.target);
            }
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
                var l = neighbors[k].link;
                if (n && !visited.has(n.id)) {
                    visited.add(n.id);
                    var newPathLinks = pathLinks.slice();
                    newPathLinks.push(l);
                    queue.push([n, newPathLinks]);
                }
            }
        }
        
        // No path
        alert("Aucun chemin trouvé entre " + start.name + " et " + end.name + ".");
        pathNodes = [];
        highlightedPath.nodes.clear();
        highlightedPath.links.clear();
        if (graph) {
            graph.nodeColor(graph.nodeColor());
        }
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
                    if (btn.classList.contains('active')) {
                        activeLanguages.add(lang);
                    } else {
                        activeLanguages.delete(lang);
                    }
                    applyFilters();
                });
            })(langBtns[i]);
        }

        $('#btn-dag-mode').addEventListener('click', function() {
            dagMode = !dagMode;
            $('#btn-dag-mode').classList.toggle('active', dagMode);
            if (graph) {
                graph.dagMode(dagMode ? 'td' : null);
            }
        });

        $('#btn-highlight-orphans').addEventListener('click', function() {
            showOrphans = !showOrphans;
            $('#btn-highlight-orphans').classList.toggle('active', showOrphans);
            if (graph) {
                graph.nodeVal(graph.nodeVal());
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
            if (graph) {
                // Trigger node refresh to attach/detach 3D objects
                graph.nodeThreeObject(graph.nodeThreeObject());
            }
        });

        // Heatmap select
        $('#heatmap-select').addEventListener('change', function(e) {
            setHeatmapMode(e.target.value);
        });

        $('#node-size-slider').addEventListener('input', function(e) {
            nodeSizeMultiplier = parseFloat(e.target.value);
            if (graph) {
                graph.nodeVal(graph.nodeVal());
            }
        });
    }

    function filterGraphData(data) {
        var filteredNodes = [];
        for (var i = 0; i < data.nodes.length; i++) {
            var n = data.nodes[i];
            var langKey = n.language;
            if (langKey === 'c') {
                langKey = n.extension === '.h' ? 'c-header' : 'c-source';
            }
            if (activeLanguages.has(langKey)) {
                filteredNodes.push(n);
            }
        }
        var nodeIds = new Set();
        for (var j = 0; j < filteredNodes.length; j++) {
            nodeIds.add(filteredNodes[j].id);
        }
        var filteredLinks = [];
        for (var k = 0; k < data.links.length; k++) {
            var l = data.links[k];
            var sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            var targetId = typeof l.target === 'object' ? l.target.id : l.target;
            if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
                filteredLinks.push(l);
            }
        }
        return { nodes: filteredNodes, links: filteredLinks };
    }

    function applyFilters() {
        if (!graph || !graphData) return;
        var filtered = filterGraphData(graphData);
        graph.graphData(filtered);
    }

})();
