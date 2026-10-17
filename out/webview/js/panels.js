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

        // Show/hide community palette
        if (mode === 'community') {
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

        if (graph) graph.nodeColor(graph.nodeColor());
    }
    // ============================================================
    // Search
    // ============================================================
    function setupSearch() {
        searchInput.addEventListener('input', function(e) {
            var query = e.target.value.trim().toLowerCase();
            if (query.length < 2 || !hooks.getGraphData()) {
                searchResults.classList.add('hidden');
                return;
            }

            var results = [];
            for (var i = 0; i < hooks.getGraphData().nodes.length; i++) {
                var n = hooks.getGraphData().nodes[i];
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
                        hooks.selectNode(node);
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
