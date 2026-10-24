/**
 * views.js — Tab view renderers: Metrics, Treemap, Chord, Timeline Chart, DSM, Table.
 *
 * Extracted from app.js (refactor/app-split). Reads live app state through hooks
 * injected by app.js in setupTabs() — see AuraViews.init(). The setup functions
 * wire the in-view controls (dropdowns, sort headers, resize handlers) and call
 * the renderers directly.
 */
(function() {
    'use strict';

    var hooks = {};

    // Mirrors of app state, refreshed by syncCtx() at the entry of every render —
    // the hook getters return live values, so the mirrors never go stale.
    var graphData = null;
    var timelineCommits = [];
    var timelineDeltas = {};
    var timelineScannedCount = 0;
    var communityMap = {};
    var communityNames = {};
    var selectedNode = null;
    var activeTab = 'graph';
    var cochangeResult = { pairs: [], windowDays: 365, commitsConsidered: 0, totalCommitsInWindow: 0, maxJaccard: 0 };
    var cochangeOptions = { windowDays: 365, minScore: 0.2 };
    var couplingSort = { col: 'jaccard', dir: 'desc' };

    var $ = function(sel) { return document.querySelector(sel); };
    var tooltip = document.getElementById('tooltip');

    function syncCtx() {
        if (!hooks.getGraphData) return;
        graphData = hooks.getGraphData();
        timelineCommits = hooks.getTimelineCommits();
        timelineDeltas = hooks.getTimelineDeltas();
        timelineScannedCount = hooks.getTimelineScannedCount();
        communityMap = hooks.getCommunityMap();
        communityNames = hooks.getCommunityNames();
        selectedNode = hooks.getSelectedNode();
        activeTab = hooks.getActiveTab();
        cochangeResult = hooks.getCochangeResult ? hooks.getCochangeResult() : cochangeResult;
        cochangeOptions = hooks.getCochangeOptions ? hooks.getCochangeOptions() : cochangeOptions;
    }

    // ============================================================
    // Temporal Coupling View
    // ============================================================
    function compareCoupling(left, right) {
        var direction = couplingSort.dir === 'asc' ? 1 : -1;
        if (couplingSort.col === 'pair') {
            return direction * (left.a + ' ↔ ' + left.b).localeCompare(right.a + ' ↔ ' + right.b);
        }
        var av = left[couplingSort.col];
        var bv = right[couplingSort.col];
        if (typeof av === 'number' && typeof bv === 'number') {
            return direction * (av - bv) || left.a.localeCompare(right.a) || left.b.localeCompare(right.b);
        }
        return direction * String(av).localeCompare(String(bv));
    }

    function updateCouplingSortIndicators() {
        var headers = document.querySelectorAll('#coupling-view th[data-col]');
        for (var i = 0; i < headers.length; i++) {
            var header = headers[i];
            var active = header.dataset.col === couplingSort.col;
            header.classList.toggle('sorted', active);
            if (active) header.dataset.sortDir = couplingSort.dir;
            else header.removeAttribute('data-sort-dir');
        }
    }

    function renderCoupling() {
        syncCtx();
        var body = $('#coupling-body');
        var summary = $('#coupling-summary');
        if (!body) return;

        var windowSelect = $('#coupling-window');
        var minSelect = $('#coupling-min');
        if (windowSelect) windowSelect.value = String(cochangeOptions.windowDays || 365);
        if (minSelect) minSelect.value = String(cochangeOptions.minScore != null ? cochangeOptions.minScore : 0.2);

        var pairs = cochangeResult && cochangeResult.pairs ? cochangeResult.pairs.slice() : [];
        pairs.sort(compareCoupling);
        updateCouplingSortIndicators();
        if (summary) {
            if (pairs.length === 0) {
                summary.textContent = timelineCommits.length === 0
                    ? 'No git history yet — run Time Travel (⏱️) to load commits.'
                    : 'No implicit coupling detected in this window. Lower the minimum score or widen the window.';
            } else {
                summary.textContent = pairs.length + ' implicit pairs · ' +
                    (cochangeResult.commitsConsidered || 0) + ' multi-file commits · window ' +
                    (cochangeResult.windowDays || cochangeOptions.windowDays) + ' days · min Jaccard ' +
                    cochangeOptions.minScore;
            }
        }

        if (pairs.length === 0) {
            body.innerHTML = '<tr><td colspan="6" class="coupling-empty">No pairs to display.</td></tr>';
            return;
        }

        var html = '';
        for (var i = 0; i < pairs.length && i < 200; i++) {
            var pair = pairs[i];
            html += '<tr>' +
                '<td><span class="coupling-file" data-node-id="' + escapeHtml(pair.a) + '">' + escapeHtml(pair.a) + '</span>' +
                ' ↔ ' +
                '<span class="coupling-file" data-node-id="' + escapeHtml(pair.b) + '">' + escapeHtml(pair.b) + '</span></td>' +
                '<td class="num">' + pair.cochanges + '</td>' +
                '<td class="num"><span class="coupling-score">' + pair.jaccard.toFixed(3) + '</span></td>' +
                '<td class="num">' + (pair.support * 100).toFixed(1) + '%</td>' +
                '<td class="num">' + pair.aCommits + '</td>' +
                '<td class="num">' + pair.bCommits + '</td>' +
                '</tr>';
        }
        body.innerHTML = html;
    }

    function setupCoupling() {
        var windowSelect = $('#coupling-window');
        var minSelect = $('#coupling-min');
        var showBtn = $('#coupling-show-graph');
        var body = $('#coupling-body');
        var headers = document.querySelectorAll('#coupling-view th[data-col]');
        for (var h = 0; h < headers.length; h++) {
            headers[h].addEventListener('click', function() {
                var col = this.dataset.col;
                if (couplingSort.col === col) {
                    couplingSort.dir = couplingSort.dir === 'desc' ? 'asc' : 'desc';
                } else {
                    couplingSort.col = col;
                    couplingSort.dir = col === 'pair' ? 'asc' : 'desc';
                }
                renderCoupling();
            });
        }
        if (windowSelect) {
            windowSelect.addEventListener('change', function() {
                if (hooks.setCochangeOptions) hooks.setCochangeOptions({ windowDays: parseFloat(this.value) });
            });
        }
        if (minSelect) {
            minSelect.addEventListener('change', function() {
                if (hooks.setCochangeOptions) hooks.setCochangeOptions({ minScore: parseFloat(this.value) });
            });
        }
        if (showBtn) {
            showBtn.addEventListener('click', function() {
                if (hooks.showCochangeOnGraph) hooks.showCochangeOnGraph();
            });
        }
        if (body) {
            body.addEventListener('click', function(e) {
                var target = e.target && e.target.closest ? e.target.closest('.coupling-file') : null;
                if (target && hooks.focusNode) hooks.focusNode(target.dataset.nodeId);
            });
        }
    }

    // ============================================================
    // Metrics View
    // ============================================================
    function renderMetrics() {
        syncCtx();
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
        var sorted = nodes.slice().sort(function(a, b) { return (b.linesOfCode || 0) - (a.linesOfCode || 0); });
        html += '<div class="metrics-section"><h3>Top 10 Largest Files</h3>';
        html += buildFileBarChart(sorted.slice(0, 10), 'linesOfCode', maxLoc);
        html += '</div>';

        // Top 10 most complex files
        var sortedCx = nodes.slice().sort(function(a, b) { return (b.complexity || 0) - (a.complexity || 0); });
        html += '<div class="metrics-section"><h3>Top 10 Most Complex Files</h3>';
        html += buildFileBarChart(sortedCx.slice(0, 10), 'complexity', maxComplexity);
        html += '</div>';

        // Top 10 highest fan-in
        var sortedFi = nodes.slice().sort(function(a, b) { return (b.fanIn || 0) - (a.fanIn || 0); });
        html += '<div class="metrics-section"><h3>Top 10 Highest Fan-in (Most Depended On)</h3>';
        html += buildFileBarChart(sortedFi.slice(0, 10), 'fanIn', maxFanIn);
        html += '</div>';

        // LOC by folder (top 15)
        var folderEntries = Object.keys(folderLoc).map(function(k) { return { key: k, value: folderLoc[k] }; });
        folderEntries.sort(function(a, b) { return b.value - a.value; });
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
        var keys = Object.keys(dataObj).sort(function(a, b) { return dataObj[b] - dataObj[a]; });
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
        if (sizeSelect) sizeSelect.addEventListener('change', function() {
            treemapSizeMetric = this.value;
            treemapRenderedW = 0; treemapRenderedH = 0; // force full re-render
            renderTreemap();
        });
        if (colorSelect) colorSelect.addEventListener('change', function() {
            treemapColorMetric = this.value;
            treemapRenderedW = 0; treemapRenderedH = 0;
            renderTreemap();
        });

        // Re-render on resize only if container grew
        var resizeTimer = null;
        window.addEventListener('resize', function() {
            if (activeTab === 'treemap') {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(function() {
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
        items.sort(function(a, b) { return b.value - a.value; });

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
        syncCtx();
        var container = $('#treemap-container');
        if (!container || !graphData) return;

        // Defer to next frame so the tab-content is visible and has dimensions
        requestAnimationFrame(function() { renderTreemapInner(container); });
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
        container.onmousemove = function(e) {
            var cell = e.target.closest('.treemap-file');
            if (cell) {
                var nodeId = cell.dataset.nodeId;
                var n = hooks.findNode(nodeId);
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
        container.onmouseleave = function() {
            if (treemapTooltipEl) treemapTooltipEl.classList.remove('visible');
        };

        container.onclick = function(e) {
            var dirCell = e.target.closest('.treemap-dir');
            var fileCell = e.target.closest('.treemap-file');
            if (fileCell) {
                var nodeId = fileCell.dataset.nodeId;
                hooks.postMessage({ type: 'openFile', payload: { path: nodeId } });
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
            crumbs[i].addEventListener('click', function() {
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
        if (groupSelect) groupSelect.addEventListener('change', function() {
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
        syncCtx();
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
        svg.addEventListener('mouseover', function(e) {
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

        svg.addEventListener('mousemove', function(e) {
            if (chordTooltipEl.classList.contains('visible')) {
                chordTooltipEl.style.left = (e.clientX + 12) + 'px';
                chordTooltipEl.style.top = (e.clientY + 12) + 'px';
            }
        });

        svg.addEventListener('mouseleave', function() {
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
        if (metricSelect) metricSelect.addEventListener('change', function() {
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
        syncCtx();
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
        syncCtx();
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
        svg.addEventListener('mouseover', function(e) {
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

        svg.addEventListener('mousemove', function(e) {
            if (tchartTooltipEl.classList.contains('visible')) {
                tchartTooltipEl.style.left = (e.clientX + 12) + 'px';
                tchartTooltipEl.style.top = (e.clientY + 12) + 'px';
            }
        });

        svg.addEventListener('mouseleave', function() {
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
        if (groupSelect) groupSelect.addEventListener('change', function() {
            dsmGroupBy = this.value;
            renderDSM();
        });
        if (sortSelect) sortSelect.addEventListener('change', function() {
            dsmSortBy = this.value;
            renderDSM();
        });
    }

    function renderDSM() {
        syncCtx();
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
            sortedNodes.sort(function(a, b) { return (b.fanIn + b.fanOut) - (a.fanIn + a.fanOut); });
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
        sortedNodes.sort(function(a, b) {
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
        container.addEventListener('mouseover', function(e) {
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

        container.addEventListener('mousemove', function(e) {
            if (dsmTooltipEl.classList.contains('visible')) {
                dsmTooltipEl.style.left = (e.clientX + 12) + 'px';
                dsmTooltipEl.style.top = (e.clientY + 12) + 'px';
            }
        });

        container.addEventListener('mouseleave', function() {
            if (dsmTooltipEl) dsmTooltipEl.classList.remove('visible');
            var prevRows = container.querySelectorAll('.dsm-highlight-row');
            for (var i = 0; i < prevRows.length; i++) prevRows[i].classList.remove('dsm-highlight-row');
            var prevCols = container.querySelectorAll('.dsm-highlight-col');
            for (var i = 0; i < prevCols.length; i++) prevCols[i].classList.remove('dsm-highlight-col');
        });

        // Click on dep cell → open source file
        container.addEventListener('click', function(e) {
            var cell = e.target.closest('.dsm-cell-dep');
            if (cell) {
                var ri = parseInt(cell.dataset.row);
                var nodeId = sortedNodes[ri].id;
                hooks.postMessage({ type: 'openFile', payload: { path: nodeId } });
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
        syncCtx();
        var tbody = $('#table-body');
        if (!tbody || !graphData) return;

        var nodes = graphData.nodes || [];

        // Filter
        var filtered = nodes;
        if (tableFilter) {
            var lf = tableFilter.toLowerCase();
            filtered = nodes.filter(function(n) {
                return n.id.toLowerCase().indexOf(lf) !== -1 ||
                       (n.language || '').toLowerCase().indexOf(lf) !== -1 ||
                       (n.group || '').toLowerCase().indexOf(lf) !== -1;
            });
        }

        // Sort
        filtered.sort(function(a, b) {
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
            rows[i].addEventListener('click', (function(row) {
                return function() {
                    var allRows = tbody.querySelectorAll('tr');
                    for (var j = 0; j < allRows.length; j++) allRows[j].classList.remove('selected');
                    row.classList.add('selected');
                    // Pre-select so switching to graph tab highlights this node
                    var node = hooks.findNode(row.dataset.id);
                    if (node) { hooks.setSelectedNode(node); selectedNode = node; }
                };
            })(rows[i]));
            rows[i].addEventListener('dblclick', (function(row) {
                return function() {
                    hooks.postMessage({ type: 'openFile', payload: { path: row.dataset.id } });
                };
            })(rows[i]));
        }
    }

    function setupTableInteractions() {
        var ths = document.querySelectorAll('.aura-table th');
        for (var i = 0; i < ths.length; i++) {
            ths[i].addEventListener('click', (function(th) {
                return function() {
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
            tableSearchInput.addEventListener('input', function() {
                tableFilter = this.value;
                renderTable();
            });
        }
    }

    // ============================================================
    // Module surface
    // ============================================================
    function init(injected) {
        hooks = injected || {};
    }

    window.AuraViews = {
        init: init,
        // Tab renderers — called by switchTab()
        renderMetrics: renderMetrics,
        renderCoupling: renderCoupling,
        renderTreemap: renderTreemap,
        renderChord: renderChord,
        renderTimelineChart: renderTimelineChart,
        renderDSM: renderDSM,
        renderTable: renderTable,
        // Control wiring — called once by setupTabs()
        setupTreemap: setupTreemap,
        setupChord: setupChord,
        setupDSM: setupDSM,
        setupTimelineChart: setupTimelineChart,
        setupTableInteractions: setupTableInteractions,
        setupCoupling: setupCoupling,
        // Shared with the Risk dashboard / time-travel invalidation
        computeTimelineSnapshots: computeTimelineSnapshots,
        invalidateTimelineSnapshots: function () { tchartCachedSnapshots = null; }
    };
})();
