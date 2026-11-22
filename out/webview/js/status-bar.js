/**
 * AuraStatus — one line at the bottom of an object view, in two zones.
 *
 *   [ selection ] src/a.ts · 340 LOC · ccx 12 · 7 in · 3 out        [⌖] [↗]
 *   [ state ]     ⌕ incycle · 142 / 303 files · 21 cycles · 91 % resolved
 *
 * Why it exists: five views each invented their own counter line —
 * `#chord-stats`, `#dsm-stats`, `#coupling-summary`, the City HUD and the
 * graph's `#stat-*` — with five different phrasings, and four views showed
 * nothing at all. One vocabulary, one place.
 *
 * The module owns **no state of its own**: `views.js` hands it the counters at
 * the end of every render, `app.js` hands it the selected node. Same rule as
 * `AuraViews` and `AuraPanels` — a renderer that also decides is a renderer
 * that disagrees with itself.
 *
 * Public API: window.AuraStatus
 *   - render(tab, counts)     called by a view at the end of its render
 *   - setSelection(node)      the app's global selection
 *   - setActiveTab(tab)       only the current tab's bar stays visible
 *   - refresh()               re-render the active bar
 *   - formatCounts(counts)    the state zone text (pure, testable)
 *   - formatSelection(node)   the selection zone text (pure, testable)
 *   - TABS                    which tabs get a bar, and which zones they show
 */
(function () {
    'use strict';

    /**
     * `selection: true` = the view's objects do not carry their numbers, so the
     * bar has to. Table, Metrics and Risk already say everything on their rows;
     * a selection line there would be noise.
     *
     * `city` is special: it has its own richer selection line (`#city-hud`,
     * with the building height and its district) and only gains the state zone.
     */
    var TABS = {
        treemap:  { selection: true },
        chord:    { selection: true },
        dsm:      { selection: true },
        coupling: { selection: false },
        table:    { selection: false },
        metrics:  { selection: false },
        risk:     { selection: false },
        city:     { selection: false, city: true }
    };

    var bars = {};          // tab -> { root, selection, state, actions }
    var countsByTab = {};   // tab -> last counters handed by the view
    var selected = null;    // last node handed by the app
    var activeTab = 'graph';
    var lastGraph = null;   // last dataset handed by the app (totals live here)

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }

    /** 1 234 — the app writes counts with a thin separator everywhere else. */
    function thousands(value) {
        var n = Number(value);
        if (!isFinite(n)) return '0';
        return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    }

    /** `in`, `out` and the two buttons need a file node, not a cluster. */
    function isFileNode(node) {
        return !!node && !node._isCluster && !node._isSymbol && !!(node.id || node.path);
    }

    /**
     * State zone. Absent numbers are **omitted**, never written as 0: a graph
     * with no measured resolution must not read as "0 % resolved".
     */
    function formatCounts(counts) {
        if (!counts) return '';
        var parts = [];
        parts.push(counts.query ? '⌕ ' + counts.query : '⌕ —');
        if (typeof counts.shown === 'number' && typeof counts.total === 'number') {
            parts.push(thousands(counts.shown) + ' / ' + thousands(counts.total) + ' files');
        }
        if (counts.cycles > 0) parts.push(thousands(counts.cycles) + (counts.cycles > 1 ? ' cycles' : ' cycle'));
        if (counts.deadExports > 0) parts.push(thousands(counts.deadExports) + ' dead exports');
        if (typeof counts.resolution === 'number' && isFinite(counts.resolution)) {
            parts.push(counts.resolution + ' % resolved');
        }
        if (counts.note) parts.push(String(counts.note));
        return parts.join(' · ');
    }

    /** Selection zone: what the pointed object is, in the same vocabulary. */
    function formatSelection(node) {
        if (!isFileNode(node)) return '';
        var parts = [String(node.id || node.path)];
        if (typeof node.linesOfCode === 'number' && node.linesOfCode > 0) {
            parts.push(thousands(node.linesOfCode) + ' LOC');
        }
        if (typeof node.complexity === 'number' && node.complexity > 0) parts.push('ccx ' + node.complexity);
        if (typeof node.cognitive === 'number' && node.cognitive > 0) parts.push('cog ' + node.cognitive);
        if (typeof node.fanIn === 'number') parts.push(node.fanIn + ' in · ' + (node.fanOut || 0) + ' out');
        return parts.join(' · ');
    }

    function post(message) {
        if (window.AuraHost && typeof window.AuraHost.post === 'function') window.AuraHost.post(message);
    }

    /** Build the bar once per tab; the City keeps its own line and gets a span. */
    function ensure(tab) {
        if (bars[tab]) return bars[tab];
        var spec = TABS[tab];
        if (!spec) return null;

        if (spec.city) {
            var hud = document.getElementById('city-hud');
            if (!hud) return null;
            var state = el('span', 'status-state');
            state.id = 'city-hud-state';
            hud.appendChild(state);
            // `selection: null` on purpose: `#city-hud-meta` belongs to the City
            // (it adds the building height and its district, which a generic
            // line cannot). The bar only adds the state zone on the same row.
            bars[tab] = { root: hud, selection: null, state: state, actions: null };
            return bars[tab];
        }

        var view = document.querySelector('.tab-content[data-tab="' + tab + '"]');
        if (!view) return null;

        var root = el('div', 'view-status status-bar');
        root.id = 'status-' + tab;
        var selection = null;
        var actions = null;
        if (spec.selection) {
            selection = el('span', 'status-selection');
            actions = el('span', 'status-actions');
            var focusBtn = el('button', 'status-btn', '⌖');
            focusBtn.type = 'button';
            focusBtn.title = 'Focus this file in the 3D Graph';
            focusBtn.addEventListener('click', function () {
                if (!isFileNode(selected)) return;
                // `AuraHost.post` talks to the **host**, and `focusNode` is a
                // webview-internal message: posting it to the host reached nobody
                // and the button did nothing. Same sequence as the City's HUD and
                // `AuraViews.openIn('graph', …)`: switch the tab, then dispatch.
                var graphTab = document.querySelector('.tab-btn[data-tab="graph"]');
                if (graphTab) graphTab.click();
                window.dispatchEvent(new MessageEvent('message', {
                    data: { type: 'focusNode', payload: { nodeId: selected.id, reveal: true } },
                }));
            });
            var openBtn = el('button', 'status-btn', '↗');
            openBtn.type = 'button';
            openBtn.title = 'Open this file in the editor';
            openBtn.addEventListener('click', function () {
                if (!isFileNode(selected)) return;
                post({ type: 'openFile', payload: { path: selected.id } });
            });
            actions.appendChild(focusBtn);
            actions.appendChild(openBtn);
            root.appendChild(selection);
            root.appendChild(actions);
        }
        var stateEl = el('span', 'status-state');
        root.appendChild(stateEl);

        // Last child of the view: the flex column docks it, and `position:
        // sticky` keeps it pinned inside a scrolling container (#risk-view).
        view.appendChild(root);
        bars[tab] = { root: root, selection: selection, state: stateEl, actions: actions };
        return bars[tab];
    }

    function apply(tab) {
        var bar = bars[tab] || ensure(tab);
        if (!bar) return;
        bar.state.textContent = formatCounts(countsByTab[tab]);

        if (bar.selection) {
            var text = formatSelection(selected);
            bar.selection.textContent = text;
            if (bar.actions) bar.actions.style.display = text ? '' : 'none';
            bar.root.classList.toggle('status-has-selection', !!text);
        }

        // Only the active tab's bar is shown: nine hidden bars in a hidden tab
        // cost nothing, but a stale one flashing on a switch costs trust.
        var visible = tab === activeTab;
        bar.root.classList.toggle('hidden', !visible);
    }

    function render(tab, counts) {
        if (!TABS[tab]) return;
        countsByTab[tab] = counts || {};
        // A render may happen while the tab is not active (a background
        // refresh); its counters are kept and applied on the next switch.
        apply(tab);
    }

    function setSelection(node) {
        selected = node || null;
        // The City draws its own selection line (path, height, district).
        Object.keys(bars).forEach(function (tab) {
            if (bars[tab].selection && tab !== 'city') apply(tab);
        });
    }

    function setActiveTab(tab) {
        activeTab = tab || 'graph';
        Object.keys(bars).forEach(apply);
        if (TABS[activeTab]) apply(activeTab);
    }

    function refresh() {
        if (TABS[activeTab]) apply(activeTab);
    }

    /** The app hands the current dataset: the totals of a view are not its own. */
    function setGraph(graph) {
        lastGraph = graph || null;
    }

    /**
     * Counters from a graph payload — one implementation for every view, so the
     * bar and the graph's own `#stat-*` can never disagree. Absent numbers are
     * omitted rather than written as 0.
     */
    function countsFrom(graph, shown, note, queryExpr) {
        var payload = graph || lastGraph;
        var meta = (payload && payload.meta) || {};
        var report = meta.resolution || null;
        var total = (payload && payload.nodes) ? payload.nodes.length : 0;
        var resolution;
        if (report && report.totals && report.totals.attempts > 0) {
            resolution = Math.round((report.totals.resolved / report.totals.attempts) * 100);
        }
        return {
            shown: typeof shown === 'number' ? shown : total,
            total: total,
            query: queryExpr || '',
            cycles: (meta.cycles && meta.cycles.length) || 0,
            deadExports: meta.deadExportsTotal || 0,
            resolution: resolution,
            note: note || ''
        };
    }

    window.AuraStatus = {
        render: render,
        setSelection: setSelection,
        setActiveTab: setActiveTab,
        refresh: refresh,
        setGraph: setGraph,
        countsFrom: countsFrom,
        formatCounts: formatCounts,
        formatSelection: formatSelection,
        TABS: TABS
    };
})();
