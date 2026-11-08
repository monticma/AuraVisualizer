/**
 * panels.js — Small floating panels: heatmap legend + toolbar search.
 *
 * Extracted from app.js (refactor/app-split). `applyHeatmapMode` only updates
 * the visuals (legend, community palette, node recolor) — the heatmapMode
 * state itself stays in app.js, whose thin `setHeatmapMode(mode)` wrapper
 * forwards here. The search box filters the graph node list and selects a
 * result through a hook.
 */
(function() {
    'use strict';

    var hooks = {};

    // Mirrors refreshed from hooks at every entry point (see syncCtx).
    var graph = null;
    var activeTab = 'graph';
    var communityMap = {};
    var communityColors = {};
    var metricRanges = {};

    var $ = function(sel) { return document.querySelector(sel); };
    var searchInput = document.getElementById('search-input');
    var searchResults = document.getElementById('search-results');

    function syncCtx() {
        if (!hooks.getGraph) return;
        graph = hooks.getGraph();
        activeTab = hooks.getActiveTab();
        communityMap = hooks.getCommunityMap();
        communityColors = hooks.getCommunityColors();
        metricRanges = hooks.getMetricRanges();
    }

    // Local HTML escaping for the search results (kept out of the app scope).
    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ============================================================
    // Heatmap
    // ============================================================
    function formatLegendDate(timestamp) {
        if (!timestamp || timestamp === Infinity || timestamp === -Infinity) return '—';
        var d = new Date(timestamp);
        return d.toLocaleDateString();
    }

    function applyHeatmapMode(mode) {
        syncCtx();
        var legend = $('#heatmap-legend');
        // The legend and the community palette are overlays of the 3D view: only
        // show them there. A late state restore (restoreViewState) can call this
        // while another tab is active — switchTab re-derives them on return.
        var graphTabActive = (activeTab === 'graph');

        // Show/hide the group palette (communities or architecture layers).
        if (mode === 'community' || mode === 'layers') {
            if (graphTabActive) if (hooks.showCommunityPalette) hooks.showCommunityPalette();
        } else {
            if (hooks.hideCommunityPalette) hooks.hideCommunityPalette();
        }

        if (mode === 'off') {
            legend.classList.add('hidden');
        } else if (mode === 'community') {
            if (graphTabActive) legend.classList.remove('hidden');
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
        } else if (mode === 'layers') {
            if (graphTabActive) legend.classList.remove('hidden');
            $('#legend-mode').textContent = HEATMAP_LABELS[mode] || mode;

            var layerGradient = $('#legend-gradient');
            var layerMeta = hooks.getGraphData() && hooks.getGraphData().meta
                ? hooks.getGraphData().meta.arch
                : null;
            if (layerMeta && layerMeta.layers.length > 0) {
                var layerStops = [];
                for (var li = 0; li < layerMeta.layers.length; li++) {
                    layerStops.push(layerColor(layerMeta.layers[li].name, li));
                }
                layerGradient.style.background = 'linear-gradient(to right, ' + layerStops.join(', ') + ')';
                $('#legend-low').textContent = layerMeta.layers.length + ' layers';
                $('#legend-high').textContent = layerMeta.counts.newTotal + ' violations';
            } else {
                layerGradient.style.background = 'linear-gradient(to right, #37474f, #78909c)';
                $('#legend-low').textContent = 'No architecture rules';
                $('#legend-high').textContent = '';
            }
        } else {
            if (graphTabActive) legend.classList.remove('hidden');
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

        if (graph) {
            graph.nodeColor(graph.nodeColor());
            // Link colours/widths depend on the heatmap mode as well: red
            // forbidden edges in layers mode, dimmed links in both group modes.
            graph.linkColor(graph.linkColor());
            graph.linkWidth(graph.linkWidth());
        }
    }
    // ============================================================
    // Search
    // ============================================================
    /**
     * A search hit is an action on the *view on screen*: the 3D graph or the
     * city. On the city a file has no building of its own at function
     * granularity, so it drills into the file's block instead.
     */
    function activateNode(node) {
        if (!node) return;
        if (hooks.getActiveTab && hooks.getActiveTab() === 'city'
            && window.AuraCityView && typeof window.AuraCityView.reveal === 'function') {
            window.AuraCityView.reveal(node.id);
            return;
        }
        hooks.selectNode(node);
    }

    /** Same for a symbol hit: its building, else its file's block. */
    function activateSymbol(hit) {
        if (!hit || !hit.node || !hit.symbol) return;
        if (hooks.getActiveTab && hooks.getActiveTab() === 'city'
            && window.AuraCityView && typeof window.AuraCityView.revealSymbol === 'function') {
            if (window.AuraCityView.revealSymbol(hit.node.id, hit.symbol.name)) return;
            window.AuraCityView.reveal(hit.node.id);
            return;
        }
        if (hooks.focusSymbol) hooks.focusSymbol(hit.node.id, hit.symbol.name);
    }

    function setupSearch() {
        searchInput.addEventListener('input', function(e) {
            var query = e.target.value.trim().toLowerCase();
            if (query.length < 2 || !hooks.getGraphData()) {
                searchResults.classList.add('hidden');
                searchResults.innerHTML = '';
                return;
            }

            var results = [];
            var symbolHits = [];
            var nodes = hooks.getGraphData().nodes;
            for (var i = 0; i < nodes.length; i++) {
                var n = nodes[i];
                if (results.length < 10 &&
                    (n.name.toLowerCase().indexOf(query) !== -1 ||
                     n.path.toLowerCase().indexOf(query) !== -1)) {
                    results.push(n);
                }
                // Symbol search (V3-09): the file rows stay first, then the
                // matching functions/structs of the analysed files.
                if (symbolHits.length < 10 && n.symbols) {
                    var lists = [n.symbols.functions || [], n.symbols.structs || []];
                    for (var l = 0; l < lists.length && symbolHits.length < 10; l++) {
                        for (var s = 0; s < lists[l].length && symbolHits.length < 10; s++) {
                            var sym = lists[l][s];
                            if (sym && sym.name && sym.name.toLowerCase().indexOf(query) !== -1) {
                                symbolHits.push({ node: n, symbol: sym });
                            }
                        }
                    }
                }
            }

            if (results.length === 0 && symbolHits.length === 0) {
                searchResults.classList.add('hidden');
                searchResults.innerHTML = '';
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
                        activateNode(node);
                        searchResults.classList.add('hidden');
                        searchInput.value = node.name;
                    });
                    searchResults.appendChild(item);
                })(results[r]);
            }

            for (var s2 = 0; s2 < symbolHits.length; s2++) {
                (function(hit) {
                    var item = document.createElement('div');
                    item.className = 'search-result-item search-result-symbol';
                    item.innerHTML =
                        '<span>⚡</span>' +
                        '<div>' +
                            '<div class="result-name">' + highlightMatch(hit.symbol.name, query) + '</div>' +
                            '<div class="result-path">' + escapeHtml(hit.node.path) + ':' + (hit.symbol.line || 0) + '</div>' +
                        '</div>';
                    item.title = 'Explode ' + hit.node.name + ' and mark ' + hit.symbol.name;
                    item.addEventListener('click', function() {
                        activateSymbol(hit);
                        searchResults.classList.add('hidden');
                        searchInput.value = hit.symbol.name;
                    });
                    searchResults.appendChild(item);
                })(symbolHits[s2]);
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

    function init(injected) {
        hooks = injected || {};
    }

    window.AuraPanels = {
        init: init,
        setupSearch: setupSearch,
        // Visual-only heatmap application — the mode state lives in app.js
        applyHeatmapMode: applyHeatmapMode
    };
})();
