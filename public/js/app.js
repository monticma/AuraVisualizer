/**
 * app.js — Main Aura frontend application.
 * 
 * Initializes the 3D force graph, handles user interactions,
 * search, filtering, and detail panel.
 * 
 * Depends on: ForceGraph3D (global), graph-config.js (globals)
 */

(function() {
    'use strict';

    // ============================================================
    // State
    // ============================================================
    let graph = null;
    let graphData = null;
    let selectedNode = null;
    let hoveredNode = null;
    let highlightNodes = new Set();
    let highlightLinks = new Set();
    let activeLanguages = new Set(['c', 'javascript', 'css', 'html']);
    let dagMode = false;
    let showOrphans = false;
    let nodeSizeMultiplier = 4;

    // ============================================================
    // DOM References
    // ============================================================
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const landingOverlay = $('#landing-overlay');
    const pathInput = $('#path-input');
    const analyzeBtn = $('#analyze-btn');
    const btnText = analyzeBtn.querySelector('.btn-text');
    const btnLoader = analyzeBtn.querySelector('.btn-loader');
    const landingError = $('#landing-error');

    const graphContainer = $('#graph-container');
    const searchInput = $('#search-input');
    const searchResults = $('#search-results');

    const detailPanel = $('#detail-panel');
    const tooltip = $('#tooltip');

    // ============================================================
    // Initialization
    // ============================================================
    document.addEventListener('DOMContentLoaded', init);
    // If DOM already loaded
    if (document.readyState !== 'loading') init();

    function init() {
        setupLanding();
        setupSearch();
        setupFilters();
        setupPanelClose();
    }

    // ============================================================
    // Landing & Analysis
    // ============================================================
    function setupLanding() {
        analyzeBtn.addEventListener('click', startAnalysis);
        pathInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') startAnalysis();
        });
    }

    async function startAnalysis() {
        const targetPath = pathInput.value.trim();
        if (!targetPath) {
            showLandingError('Veuillez entrer un chemin vers la codebase');
            return;
        }

        setLoading(true);
        landingError.classList.add('hidden');

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: targetPath })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Erreur HTTP ' + response.status);
            }

            graphData = await response.json();
            console.log('[aura] Analysis result:', graphData.meta);

            updateStats(graphData.meta);
            landingOverlay.classList.add('hidden');

            initGraph(graphData);

        } catch (err) {
            console.error('[aura] Analysis failed:', err);
            showLandingError(err.message);
        } finally {
            setLoading(false);
        }
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

        const langs = Object.entries(meta.languageStats)
            .map(function(entry) { return entry[1].count + ' ' + entry[0]; })
            .join(', ');
        $('#stat-time').textContent = langs;
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
            .linkSource('source')
            .linkTarget('target')
            .linkColor(function(link) { return getLinkColor(link); })
            .linkWidth(function(link) { return highlightLinks.has(link) ? 2 : 0.5; })
            .linkOpacity(0.4)
            .linkDirectionalArrowLength(3)
            .linkDirectionalArrowRelPos(1)
            .linkDirectionalParticles(function(link) { return highlightLinks.has(link) ? 3 : 0; })
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
        if (selectedNode && selectedNode.id === node.id) {
            return '#ffffff';
        }
        if (highlightNodes.size > 0 && !highlightNodes.has(node)) {
            return (LANGUAGE_COLORS[node.language] || '#ffffff') + '44';
        }
        return LANGUAGE_COLORS[node.language] || '#ffffff';
    }

    function getNodeSize(node) {
        const baseLOC = Math.max(node.linesOfCode || 1, 1);
        const size = Math.pow(baseLOC, 0.4) * nodeSizeMultiplier * 0.3;
        if (showOrphans && node.fanIn === 0 && node.fanOut === 0) {
            return size * 1.5;
        }
        return size;
    }

    function getLinkColor(link) {
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

        highlightNodes.clear();
        highlightLinks.clear();

        if (node) {
            highlightNodes.add(node);
            const nodeLinks = graphData.links.filter(function(l) {
                const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
                const targetId = typeof l.target === 'object' ? l.target.id : l.target;
                return sourceId === node.id || targetId === node.id;
            });
            nodeLinks.forEach(function(link) {
                highlightLinks.add(link);
                const sourceNode = typeof link.source === 'object' ? link.source :
                    graphData.nodes.find(function(n) { return n.id === link.source; });
                const targetNode = typeof link.target === 'object' ? link.target :
                    graphData.nodes.find(function(n) { return n.id === link.target; });
                if (sourceNode) highlightNodes.add(sourceNode);
                if (targetNode) highlightNodes.add(targetNode);
            });

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

    function handleNodeClick(node) {
        if (!node) return;

        selectedNode = node;

        // Fly to node
        const distance = 120;
        const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
        graph.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
            node,
            1000
        );

        showDetailPanel(node);
    }

    function handleBackgroundClick() {
        selectedNode = null;
        highlightNodes.clear();
        highlightLinks.clear();
        detailPanel.classList.add('hidden');

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

        nameEl.textContent = (LANGUAGE_ICONS[node.language] || '📄') + ' ' + node.name;
        metaEl.textContent = node.linesOfCode + ' lignes · ' + node.language +
            ' · fan-in: ' + node.fanIn + ' · fan-out: ' + node.fanOut;

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

        // Dependencies (outgoing)
        const deps = graphData.links.filter(function(l) {
            const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            return sourceId === node.id;
        });
        const depsUl = $('#panel-deps');
        depsUl.innerHTML = '';
        $('#deps-count').textContent = deps.length;
        deps.forEach(function(d) {
            const targetId = typeof d.target === 'object' ? d.target.id : d.target;
            const targetNode = graphData.nodes.find(function(n) { return n.id === targetId; });
            const li = document.createElement('li');
            li.innerHTML =
                '<span class="dep-arrow">→</span>' +
                '<span>' + (targetNode ? targetNode.name : targetId) + '</span>' +
                '<span class="dep-type">' + d.type + '</span>';
            li.addEventListener('click', function() {
                if (targetNode) handleNodeClick(targetNode);
            });
            depsUl.appendChild(li);
        });

        // Dependents (incoming)
        const dependents = graphData.links.filter(function(l) {
            const targetId = typeof l.target === 'object' ? l.target.id : l.target;
            return targetId === node.id;
        });
        const depUl = $('#panel-dependents');
        depUl.innerHTML = '';
        $('#dependents-count').textContent = dependents.length;
        dependents.forEach(function(d) {
            const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
            const sourceNode = graphData.nodes.find(function(n) { return n.id === sourceId; });
            const li = document.createElement('li');
            li.innerHTML =
                '<span class="dep-arrow">←</span>' +
                '<span>' + (sourceNode ? sourceNode.name : sourceId) + '</span>' +
                '<span class="dep-type">' + d.type + '</span>';
            li.addEventListener('click', function() {
                if (sourceNode) handleNodeClick(sourceNode);
            });
            depUl.appendChild(li);
        });
    }

    function setupPanelClose() {
        $('#panel-close').addEventListener('click', function() {
            detailPanel.classList.add('hidden');
            selectedNode = null;
        });
    }

    // ============================================================
    // Search
    // ============================================================
    function setupSearch() {
        searchInput.addEventListener('input', function(e) {
            const query = e.target.value.trim().toLowerCase();
            if (query.length < 2 || !graphData) {
                searchResults.classList.add('hidden');
                return;
            }

            const results = graphData.nodes
                .filter(function(n) {
                    return n.name.toLowerCase().includes(query) ||
                           n.path.toLowerCase().includes(query);
                })
                .slice(0, 10);

            if (results.length === 0) {
                searchResults.classList.add('hidden');
                return;
            }

            searchResults.innerHTML = '';
            results.forEach(function(node) {
                const item = document.createElement('div');
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
            });

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
        const idx = text.toLowerCase().indexOf(query);
        if (idx === -1) return text;
        return text.slice(0, idx) +
               '<strong style="color:var(--text-accent)">' +
               text.slice(idx, idx + query.length) + '</strong>' +
               text.slice(idx + query.length);
    }

    // ============================================================
    // Filters
    // ============================================================
    function setupFilters() {
        var langBtns = document.querySelectorAll('#language-filters .filter-btn');
        langBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                const lang = btn.dataset.lang;
                btn.classList.toggle('active');

                if (btn.classList.contains('active')) {
                    activeLanguages.add(lang);
                } else {
                    activeLanguages.delete(lang);
                }
                applyFilters();
            });
        });

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

        $('#node-size-slider').addEventListener('input', function(e) {
            nodeSizeMultiplier = parseFloat(e.target.value);
            if (graph) {
                graph.nodeVal(graph.nodeVal());
            }
        });
    }

    function filterGraphData(data) {
        const filteredNodes = data.nodes.filter(function(n) {
            return activeLanguages.has(n.language);
        });
        const nodeIds = new Set(filteredNodes.map(function(n) { return n.id; }));

        const filteredLinks = data.links.filter(function(l) {
            const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            const targetId = typeof l.target === 'object' ? l.target.id : l.target;
            return nodeIds.has(sourceId) && nodeIds.has(targetId);
        });

        return { nodes: filteredNodes, links: filteredLinks };
    }

    function applyFilters() {
        if (!graph || !graphData) return;
        const filtered = filterGraphData(graphData);
        graph.graphData(filtered);
    }

})();
