/**
 * city.js — the 2.5D City view (V5-07), as its **own tab**.
 *
 * Why a tab and not a mode of the graph: rendering the city inside the 3D tab
 * meant reconfiguring the shared engine (control type, polar limits, node
 * geometry, drag state, link visibility) on every switch, and each of those
 * leaked into the other view — a trackball has no polar limit, so constraining
 * the city also froze the graph, and a click on a building re-centred the shared
 * controls target. A dedicated tab owns its own ForceGraph3D instance, its own
 * camera and its own decor; the graph tab is never touched.
 *
 * The layout itself is pure and unit-tested: src/graph/city-core.ts, bundled as
 * `window.AuraCity` (same pattern as `AuraSeed`).
 */
(function () {
    'use strict';

    var SCALE = 520;             // plan width, in scene units
    var HEIGHT = 170;            // tallest building, in scene units
    var PLATE_STEP = 9;          // altitude per district nesting level
    var MAX_POLAR = Math.PI / 2 - 0.1;   // never look under the plinth
    var MIN_H = 2.5;

    // CodeCity's reading: desaturated on the low end, hot at the top, so the eye
    // only goes where it matters.
    var RAMP = ['#5b6b82', '#2f8f9d', '#e0b53a', '#d1462f'];

    var OPTIONS = {
        height: 'cognitive',
        footprint: 'linesOfCode',
        colour: 'height',
        mapping: 'quantiles',
        districtBy: 'group',
        streets: 'selection',
    };

    // Function calls are aggregated per file pair but still dominate the edge
    // count (ThorV2: 4 710 links for 762 files), and drawn flat on the ground
    // they are pure spaghetti. `structure` keeps the edges that describe the
    // build: imports, includes, heritage, script tags.
    var STRUCTURAL_TYPES = {
        'include': 1, 'system-include': 1, 'import': 1, 'require': 1, 'dynamic-import': 1,
        'script': 1, 'stylesheet': 1, 'css-import': 1, 'css-url': 1,
        'extends': 1, 'implements': 1, 'global-use': 1,
    };

    var STORE_KEY = 'aura.city.options.v1';

    var state = {
        view: null,
        container: null,
        graph: null,
        data: null,
        plan: null,
        byId: {},
        nodeById: {},
        decor: null,
        streets: null,
        streetCount: 0,
        relations: { in: {}, out: {} },
        selected: null,
        scope: '',            // '' = whole city, otherwise a district key path
        observer: null,
        hudMeta: null,
        hudFocus: null,
    };

    function $(selector) {
        return document.querySelector(selector);
    }

    function escapeHtml(value) {
        return String(value === undefined || value === null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    /** Hover tooltip: the two numbers a building is saying, nothing more. */
    function tooltipFor(node) {
        if (!node || !node.id) return '';
        var rect = state.byId[node.id];
        var html = '<div class="city-tip-name">' + escapeHtml(node.id) + '</div>';
        if (rect) {
            html += '<div class="city-tip-meta">'
                + rect.footprintValue + ' lines · height ' + rect.heightValue
                + ' · ' + escapeHtml(rect.district) + '</div>';
        }
        if (state.selected && state.selected !== node.id) {
            if (state.relations.out[node.id]) html += '<div class="city-tip-dir city-tip-in">← used by the selection</div>';
            if (state.relations.in[node.id]) html += '<div class="city-tip-dir city-tip-out">→ depends on the selection</div>';
        }
        return html;
    }

    function isActive() {
        return !!(state.view && state.view.classList.contains('active'));
    }

    // ── Colours ────────────────────────────────────────────────
    function hexToRgb(hex) {
        var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 255, g: 255, b: 255 };
    }

    function rampColor(t) {
        var clamped = Math.max(0, Math.min(1, t));
        var scaled = clamped * (RAMP.length - 1);
        var low = Math.min(Math.floor(scaled), RAMP.length - 2);
        var frac = scaled - low;
        var a = hexToRgb(RAMP[low]);
        var b = hexToRgb(RAMP[low + 1]);
        var r = Math.round(a.r + (b.r - a.r) * frac);
        var g = Math.round(a.g + (b.g - a.g) * frac);
        var bl = Math.round(a.b + (b.b - a.b) * frac);
        return 'rgb(' + r + ',' + g + ',' + bl + ')';
    }

    function districtColor(key) {
        if (typeof window.layerColor === 'function') return window.layerColor(key);
        return '#546e7a';
    }

    /** Building colour, per the chosen channel, with the selection override. */
    function colourFor(node, rect) {
        if (state.selected === node.id) return '#ffffff';
        if (state.selected) {
            // A selection answers a different question: not "how big" but "who
            // depends on me / whom do I depend on". The ramp is muted and the
            // direction takes over, exactly like CodeCity's selection state.
            var inbound = !!state.relations.in[node.id];
            var outbound = !!state.relations.out[node.id];
            if (inbound && outbound) return '#ba68c8';
            // Blue: a dependency of the selection (selected → X).
            if (outbound) return '#4fc3f7';
            // Amber: a dependent of the selection (X → selected).
            if (inbound) return '#e0b53a';
            return '#39424e';
        }
        return baseColour(node, rect);
    }

    /** The colour of the active channel, before any selection. */
    function baseColour(node, rect) {
        var mode = OPTIONS.colour;
        if (mode === 'language' && window.LANGUAGE_COLORS) {
            var lang = window.LANGUAGE_COLORS[node.language];
            if (lang) return lang;
        }
        if (mode === 'layer') return districtColor(node.layer || '(unlayered)');
        if (mode === 'district') return districtColor(rect.district);
        // 'height' — the default: the ramp mirrors the height tier, so the skyline
        // and the colour agree and the eye only goes where it matters.
        return rampColor((rect.h - 0.12) / 0.88);
    }

    function plateAltitude(depth) {
        return (depth || 0) * PLATE_STEP;
    }

    // ── Scene ──────────────────────────────────────────────────
    function buildingFor(node) {
        var T = window.THREE;
        var rect = state.byId[node.id];
        if (!T || !rect) return null;
        var w = Math.max(rect.w * SCALE, 1.2);
        var d = Math.max(rect.d * SCALE, 1.2);
        var h = Math.max(rect.h * HEIGHT, MIN_H);
        var selected = state.selected === node.id;
        var color = colourFor(node, rect);
        var mesh = new T.Mesh(
            new T.BoxGeometry(w, h, d),
            new T.MeshLambertMaterial({ color: color })
        );
        mesh.userData.cityBuilding = node.id;
        return mesh;
    }

    /** Colour of a dependency, straight from the graph's own edge palette. */
    function linkColorOf(type) {
        var palette = window.LINK_COLORS;
        var raw = (palette && palette[type]) || '#78909c';
        return raw.length > 7 ? raw.slice(0, 7) : raw;
    }

    function disposeStreets() {
        if (!state.streets) return;
        var parent = state.streets.parent;
        if (parent) parent.remove(state.streets);
        if (state.streets.geometry) state.streets.geometry.dispose();
        if (state.streets.material) state.streets.material.dispose();
        state.streets = null;
    }

    /**
     * Ground streets: one `LineSegments` for every drawn dependency, laid flat on
     * the plinth. Two decisions make them readable:
     *
     * 1. **Bundling** — a link between two districts is routed A → centre(A) →
     *    centre(B) → B, so every road leaving a district shares the same trunk.
     *    Straight A→B lines across 4 710 edges are an unreadable mesh; trunks
     *    converge on district plazas and read like arterial roads.
     * 2. **Selection first** — the default mode only draws the selected building's
     *    roads. CodeCity defaults to `Highlight related buildings` for the same
     *    reason.
     *
     * One draw call whatever the edge count.
     */
    function buildStreets() {
        var T = window.THREE;
        if (!T || !state.graph || !state.data) return;
        disposeStreets();
        state.streetCount = 0;
        var mode = OPTIONS.streets;
        if (mode === 'off') return;
        if (mode === 'selection' && !state.selected) return;

        var centres = {};
        if (state.plan) {
            for (var d = 0; d < state.plan.districts.length; d++) {
                var district = state.plan.districts[d];
                centres[district.key] = {
                    x: (district.x + district.w / 2 - 0.5) * SCALE,
                    z: (district.z + district.d / 2 - 0.5) * SCALE,
                };
            }
        }

        var links = state.data.links || [];
        var positions = [];
        var colors = [];
        var color = new T.Color();
        var drawn = 0;

        function point(rect) {
            if (!rect) return null;
            return {
                x: (rect.x + rect.w / 2 - 0.5) * SCALE,
                z: (rect.z + rect.d / 2 - 0.5) * SCALE,
                y: plateAltitude(rect.depth) + 0.6,
                district: rect.district,
            };
        }
        function segment(from, to) {
            positions.push(from.x, from.y, from.z, to.x, to.y, to.z);
            colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
        }

        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var fromId = link.source && typeof link.source === 'object' ? link.source.id : link.source;
            var toId = link.target && typeof link.target === 'object' ? link.target.id : link.target;
            if (mode === 'selection' && fromId !== state.selected && toId !== state.selected) continue;
            if (mode === 'structure' && !STRUCTURAL_TYPES[link.type]) continue;
            var a = state.byId[fromId];
            var b = state.byId[toId];
            if (!a || !b) continue;

            var start = point(a);
            var end = point(b);
            if (!start || !end) continue;
            color.set(linkColorOf(link.type));

            var fromCentre = centres[a.district];
            var toCentre = centres[b.district];
            if (a.district === b.district || !fromCentre || !toCentre) {
                segment(start, end);
            } else {
                var midY = Math.max(start.y, end.y);
                var hubA = { x: fromCentre.x, y: midY, z: fromCentre.z };
                var hubB = { x: toCentre.x, y: midY, z: toCentre.z };
                segment(start, hubA);
                segment(hubA, hubB);
                segment(hubB, end);
            }
            drawn++;
        }

        state.streetCount = drawn;
        if (positions.length === 0) return;

        var geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
        var lines = new T.LineSegments(geometry, new T.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: mode === 'selection' ? 0.95 : (mode === 'structure' ? 0.55 : 0.3),
            depthWrite: false,
        }));
        lines.name = 'aura-city-streets';
        lines.renderOrder = 1;
        state.graph.scene().add(lines);
        state.streets = lines;
    }

    function disposeDecor() {
        if (!state.decor) return;
        var parent = state.decor.parent;
        if (parent) parent.remove(state.decor);
        state.decor.traverse(function (child) {
            if (child.geometry) child.geometry.dispose();
            if (!child.material) return;
            if (Array.isArray(child.material)) child.material.forEach(function (m) { m.dispose(); });
            else child.material.dispose();
        });
        state.decor = null;
    }

    /** Plinth + one raised plate per district (altitude = package nesting depth). */
    function buildDecor(plan) {
        var T = window.THREE;
        if (!T || !state.graph) return;
        var scene = state.graph.scene();
        if (!scene) return;
        disposeDecor();

        var group = new T.Group();
        group.name = 'aura-city';
        var plinth = new T.Mesh(
            new T.BoxGeometry(SCALE * 1.04, 3, SCALE * 1.04),
            new T.MeshLambertMaterial({ color: '#11151a' })
        );
        plinth.position.y = -3.2;
        group.add(plinth);

        for (var i = 0; i < plan.districts.length; i++) {
            var district = plan.districts[i];
            var plate = new T.Mesh(
                new T.BoxGeometry(Math.max(district.w * SCALE, 2), 2.4, Math.max(district.d * SCALE, 2)),
                // Streets must read as ground, not as a second city.
                new T.MeshLambertMaterial({ color: new T.Color(districtColor(district.key)).multiplyScalar(0.34) })
            );
            plate.position.set(
                (district.x + district.w / 2 - 0.5) * SCALE,
                plateAltitude(district.depth) - 1.2,
                (district.z + district.d / 2 - 0.5) * SCALE
            );
            group.add(plate);
        }

        scene.add(group);
        state.decor = group;
    }

    function ensureGraph() {
        if (state.graph) return state.graph;
        if (!window.ForceGraph3D) return null;
        state.container = $('#city-canvas');
        if (!state.container) return null;

        state.graph = window.ForceGraph3D({
            // Orbit: the city is always observed from above the plinth.
            controlType: 'orbit',
            rendererConfig: { preserveDrawingBuffer: true, alpha: true },
        })(state.container)
            .backgroundColor('#0d1117')
            .nodeId('id')
            .nodeRelSize(1)
            .nodeVal(1)
            .nodeLabel(tooltipFor)
            .nodeThreeObject(buildingFor)
            .nodeThreeObjectExtend(false)
            .enableNodeDrag(false)
            .linkVisibility(function () { return false; })
            .showNavInfo(false)
            .warmupTicks(0)
            .cooldownTicks(0)
            .onNodeClick(selectBuilding)
            .onBackgroundClick(clearSelection);

        var controls = null;
        try { controls = state.graph.controls(); } catch (_) { controls = null; }
        if (controls && ('maxPolarAngle' in controls)) {
            controls.maxPolarAngle = MAX_POLAR;
            controls.minPolarAngle = 0.05;
        }
        return state.graph;
    }

    // ── Plan ───────────────────────────────────────────────────

    /** Nodes of the current drill-down scope (all of them at the root). */
    function nodesInScope() {
        var all = (state.data && state.data.nodes) || [];
        if (!state.scope) return all;
        var keyOf = window.AuraCity && window.AuraCity.districtKeyOf;
        if (!keyOf) return all;
        var prefix = state.scope + '/';
        var kept = [];
        for (var i = 0; i < all.length; i++) {
            var key = keyOf(all[i], OPTIONS.districtBy);
            if (key === state.scope || key.indexOf(prefix) === 0) kept.push(all[i]);
        }
        return kept;
    }

    function scopeDepth() {
        return state.scope ? state.scope.split('/').length : 0;
    }

    function setScope(scope) {
        var next = scope || '';
        if (next === state.scope) return;
        state.scope = next;
        state.plan = null;
        state.selected = null;
        state.relations = { in: {}, out: {} };
        renderSide();
        if (isActive()) applyPlan();
    }

    function applyPlan() {
        var graph = ensureGraph();
        if (!graph || !state.data || !window.AuraCity) return;
        // The payload nodes are the *same objects* the graph tab feeds: mutating
        // them (positions + pins) would drag the graph layout into the city and
        // leave every node pinned when the user goes back. Work on copies.
        var source = nodesInScope();
        var nodes = [];
        for (var c = 0; c < source.length; c++) {
            var clone = {};
            for (var key in source[c]) {
                if (Object.prototype.hasOwnProperty.call(source[c], key)) clone[key] = source[c][key];
            }
            nodes.push(clone);
        }
        if (nodes.length === 0) { state.plan = null; renderCrumbs(); updateSummary(); return; }

        state.plan = window.AuraCity.layoutCity(nodes, OPTIONS);
        // Inside a drill-down the plates start at the scope's own level, otherwise
        // every building would float on a stack of invisible parent platforms.
        var base = scopeDepth();
        if (base > 0) {
            for (var r0 = 0; r0 < state.plan.rects.length; r0++) {
                state.plan.rects[r0].depth = Math.max(0, state.plan.rects[r0].depth - base);
            }
            for (var d0 = 0; d0 < state.plan.districts.length; d0++) {
                state.plan.districts[d0].depth = Math.max(0, state.plan.districts[d0].depth - base);
            }
        }
        state.byId = {};
        state.nodeById = {};
        for (var k = 0; k < nodes.length; k++) state.nodeById[nodes[k].id] = nodes[k];
        for (var i = 0; i < state.plan.rects.length; i++) {
            state.byId[state.plan.rects[i].id] = state.plan.rects[i];
        }

        for (var n = 0; n < nodes.length; n++) {
            var node = nodes[n];
            var rect = state.byId[node.id];
            if (!rect) continue;
            node.x = (rect.x + rect.w / 2 - 0.5) * SCALE;
            node.z = (rect.z + rect.d / 2 - 0.5) * SCALE;
            node.y = plateAltitude(rect.depth) + Math.max(rect.h * HEIGHT, MIN_H) / 2;
            // Pinned: the force engine must never undo the plan.
            node.fx = node.x;
            node.fy = node.y;
            node.fz = node.z;
        }

        buildDecor(state.plan);
        graph.nodeThreeObjectExtend(false);
        graph.graphData({ nodes: nodes, links: [] });
        graph.nodeThreeObject(buildingFor);
        buildStreets();
        resize();
        frameCity();
        updateHud();
        updateSummary();
        renderCrumbs();
    }

    /**
     * Breadcrumb of the current scope + one chip per child district, the way
     * CodeCity filters by district (`Project` › `src`). Pure DOM: no raycasting
     * against the plates, and it works whatever the zoom level.
     */
    function renderCrumbs() {
        var bar = $('#city-crumbs');
        if (!bar) return;
        if (!state.data || !window.AuraCity) { bar.classList.add('hidden'); return; }
        bar.classList.remove('hidden');

        var keyOf = window.AuraCity.districtKeyOf;
        var segments = state.scope ? state.scope.split('/') : [];
        var html = '<button type="button" class="city-crumb' + (segments.length === 0 ? ' current' : '')
            + '" data-city-scope="">🏙️ All districts</button>';

        for (var s = 0; s < segments.length; s++) {
            var path = segments.slice(0, s + 1).join('/');
            var isLast = s === segments.length - 1;
            html += '<span class="city-crumb-sep">›</span>';
            html += '<button type="button" class="city-crumb' + (isLast ? ' current' : '')
                + '" data-city-scope="' + escapeHtml(path) + '">' + escapeHtml(segments[s]) + '</button>';
        }

        // Children of the current scope: the next path segment carrying files.
        var prefix = state.scope ? state.scope + '/' : '';
        var children = {};
        var nodes = (state.data.nodes || []);
        for (var i = 0; i < nodes.length; i++) {
            var key = keyOf(nodes[i], OPTIONS.districtBy);
            if (prefix && key.indexOf(prefix) !== 0) continue;
            var rest = key.slice(prefix.length);
            if (!rest) continue;
            var next = rest.split('/')[0];
            var childPath = prefix + next;
            children[childPath] = children[childPath] || 0;
            children[childPath]++;
        }
        var paths = Object.keys(children).sort();
        for (var p = 0; p < paths.length && p < 24; p++) {
            html += '<button type="button" class="city-crumb" data-city-scope="' + escapeHtml(paths[p]) + '"'
                + ' title="' + escapeHtml(paths[p]) + '">' + escapeHtml(paths[p].slice(prefix.length))
                + '<span class="city-crumb-count">' + children[paths[p]] + '</span></button>';
        }

        bar.innerHTML = html;
    }

    /** Legend line: what the three (four) channels actually encode right now. */
    function updateSummary() {
        var summary = $('#city-summary');
        if (!summary || !state.plan) return;
        summary.textContent = state.plan.rects.length + ' buildings · ' + state.plan.districts.length + ' districts'
            + '  ·  height = ' + state.plan.heightMetric
            + '  ·  footprint = ' + state.plan.footprintMetric
            + '  ·  colour = ' + OPTIONS.colour
            + '  ·  ' + (state.plan.mapping === 'quantiles' ? '5 tiers' : state.plan.mapping)
            + '  ·  streets = ' + OPTIONS.streets;
    }

    /** Isometric-ish three-quarter view, the way CodeCity opens. */
    function frameCity() {
        if (!state.graph) return;
        state.graph.cameraPosition({ x: SCALE * 0.55, y: SCALE * 0.95, z: SCALE * 1.15 }, { x: 0, y: 0, z: 0 }, 0);
    }

    function resize() {
        if (!state.graph || !state.container) return;
        var width = state.container.clientWidth;
        var height = state.container.clientHeight;
        if (width > 0 && height > 0 && typeof state.graph.width === 'function') {
            state.graph.width(width).height(height);
        }
    }

    // ── Selection ──────────────────────────────────────────────

    /** Direct neighbours of the selection, split by direction. */
    function computeRelations(id) {
        var inbound = {};
        var outbound = {};
        if (!id || !state.data) return { in: inbound, out: outbound };
        var links = state.data.links || [];
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var from = link.source && typeof link.source === 'object' ? link.source.id : link.source;
            var to = link.target && typeof link.target === 'object' ? link.target.id : link.target;
            if (from === id) outbound[to] = (outbound[to] || 0) + 1;
            else if (to === id) inbound[from] = (inbound[from] || 0) + 1;
        }
        return { in: inbound, out: outbound };
    }

    function selectBuilding(node) {
        if (!node || !node.id) return;
        state.selected = node.id;
        state.relations = computeRelations(node.id);
        if (state.graph) state.graph.nodeThreeObject(buildingFor);
        buildStreets();
        updateHud();
        renderSide();
    }

    function clearSelection() {
        if (!state.selected) return;
        state.selected = null;
        state.relations = { in: {}, out: {} };
        if (state.graph) state.graph.nodeThreeObject(buildingFor);
        buildStreets();
        updateHud();
        renderSide();
    }

    /** Right-hand inspector, modelled on CodeCity's selected-building panel. */
    function renderSide() {
        var side = $('#city-side');
        var body = $('#city-side-body');
        var title = $('#city-side-title');
        if (!side || !body) return;
        var id = state.selected;
        if (!id) { side.classList.add('hidden'); return; }
        side.classList.remove('hidden');

        var rect = state.byId[id];
        var node = state.nodeById[id] || {};
        if (title) title.textContent = id.split('/').pop() || id;

        var html = '';
        html += '<div class="city-side-section"><div class="city-side-label">Path</div>'
            + '<div class="city-side-path">' + escapeHtml(id) + '</div></div>';

        html += '<div class="city-side-section"><div class="city-side-label">Metrics</div><div class="city-side-grid">';
        function row(label, value) {
            html += '<span>' + label + '</span><span>' + escapeHtml(value) + '</span>';
        }
        row('Lines', node.linesOfCode);
        row('Cyclomatic', node.complexity);
        if (typeof node.cognitive === 'number') row('Cognitive', node.cognitive);
        row('Fan-in', node.fanIn);
        row('Fan-out', node.fanOut);
        if (typeof node.pagerank === 'number') row('PageRank', node.pagerank.toFixed(4));
        if (rect) {
            row('Height', rect.heightValue);
            row('Height tier', Math.round(((rect.h - 0.12) / 0.88) * 100) + '%');
        }
        html += '</div></div>';

        if (rect) {
            html += '<div class="city-side-section"><div class="city-side-label">District</div>'
                + '<div>' + escapeHtml(rect.district) + '</div></div>';
        }

        html += relationSection('Depends on', state.relations.out);
        html += relationSection('Used by', state.relations.in);

        html += '<div class="city-side-section city-side-actions">'
            + '<button type="button" data-city-action="open">Open file</button>'
            + '<button type="button" data-city-action="graph">⌖ Focus in graph</button>'
            + '</div>';

        body.innerHTML = html;
    }

    /** One clickable list of neighbours; rows select that building in place. */
    function relationSection(label, bucket) {
        var ids = Object.keys(bucket);
        var html = '<div class="city-side-section"><div class="city-side-label">'
            + label + ' (' + ids.length + ')</div>';
        if (ids.length === 0) {
            html += '<div class="city-side-empty">none</div></div>';
            return html;
        }
        ids.sort(function (a, b) { return (bucket[b] || 0) - (bucket[a] || 0) || a.localeCompare(b); });
        for (var i = 0; i < ids.length && i < 14; i++) {
            html += '<div class="city-side-row" data-city-goto="' + escapeHtml(ids[i]) + '" title="' + escapeHtml(ids[i]) + '">'
                + '<span class="city-side-row-name">' + escapeHtml(ids[i].split('/').pop()) + '</span>'
                + '<span class="city-side-row-count">' + (bucket[ids[i]] || 0) + '</span></div>';
        }
        if (ids.length > 14) {
            html += '<div class="city-side-empty">+' + (ids.length - 14) + ' more</div>';
        }
        html += '</div>';
        return html;
    }

    function updateHud() {
        if (!state.hudMeta) return;
        var id = state.selected;
        if (!id) {
            state.hudMeta.textContent = state.plan
                ? state.plan.rects.length + ' buildings · ' + state.plan.districts.length + ' districts'
                : 'Click a building';
            if (state.hudFocus) state.hudFocus.style.display = 'none';
            return;
        }
        var rect = state.byId[id];
        var parts = [id];
        if (rect) {
            parts.push(rect.footprintValue + ' LOC');
            parts.push('height ' + rect.heightValue);
            parts.push(rect.district);
        }
        var inbound = Object.keys(state.relations.in).length;
        var outbound = Object.keys(state.relations.out).length;
        parts.push(inbound + ' in · ' + outbound + ' out');
        state.hudMeta.textContent = parts.join('  ·  ');
        if (state.hudFocus) state.hudFocus.style.display = '';
    }

    /** Jump to the graph tab with this file focused (the detail panel lives there). */
    function focusInGraph() {
        if (!state.selected) return;
        var graphTab = document.querySelector('.tab-btn[data-tab="graph"]');
        if (graphTab) graphTab.click();
        window.dispatchEvent(new MessageEvent('message', {
            data: { type: 'focusNode', payload: { nodeId: state.selected, reveal: true } },
        }));
    }

    /** Open the selected file in the editor (the host owns the message channel). */
    function openSelectedFile() {
        if (!state.selected) return;
        if (!window.AuraHost || typeof window.AuraHost.post !== 'function') return;
        window.AuraHost.post({ type: 'openFile', payload: { path: state.selected, line: 0 } });
    }

    function wireSide() {
        var body = $('#city-side-body');
        var close = $('#city-side-close');
        var crumbs = $('#city-crumbs');
        if (crumbs) {
            crumbs.addEventListener('click', function (event) {
                var scope = event.target && event.target.getAttribute('data-city-scope');
                if (scope === null || scope === undefined) {
                    var parent = event.target && event.target.parentNode;
                    scope = parent && parent.getAttribute ? parent.getAttribute('data-city-scope') : null;
                }
                if (scope !== null && scope !== undefined) setScope(scope);
            });
        }
        if (close) close.addEventListener('click', clearSelection);
        if (!body) return;
        body.addEventListener('click', function (event) {
            var target = event.target;
            while (target && target !== body && !target.getAttribute('data-city-goto') && !target.getAttribute('data-city-action')) {
                target = target.parentNode;
            }
            if (!target || target === body) return;
            var goto = target.getAttribute('data-city-goto');
            if (goto) { selectBuilding({ id: goto }); return; }
            var action = target.getAttribute('data-city-action');
            if (action === 'open') openSelectedFile();
            if (action === 'graph') focusInGraph();
        });
    }

    // ── Wiring ─────────────────────────────────────────────────

    /** The five selects of the city toolbar, and what each one invalidates. */
    var CONTROLS = [
        { id: 'city-height', key: 'height', relayout: true },
        { id: 'city-footprint', key: 'footprint', relayout: true },
        { id: 'city-colour', key: 'colour', relayout: false },
        { id: 'city-mapping', key: 'mapping', relayout: true },
        { id: 'city-districts', key: 'districtBy', relayout: true },
        { id: 'city-streets', key: 'streets', relayout: false },
    ];

    function syncControls() {
        for (var i = 0; i < CONTROLS.length; i++) {
            var select = document.getElementById(CONTROLS[i].id);
            if (select) select.value = OPTIONS[CONTROLS[i].key];
        }
    }

    function saveOptions() {
        try { window.localStorage.setItem(STORE_KEY, JSON.stringify(OPTIONS)); } catch (_) { /* private mode */ }
    }

    function restoreOptions() {
        var raw = null;
        try { raw = window.localStorage.getItem(STORE_KEY); } catch (_) { raw = null; }
        if (raw) {
            try {
                var saved = JSON.parse(raw);
                for (var i = 0; i < CONTROLS.length; i++) {
                    var key = CONTROLS[i].key;
                    if (typeof saved[key] !== 'string' || saved[key].length === 0) continue;
                    // A stored value may predate a mode rename ("streets" became
                    // "structure"): never trust it, clamp it to the live options.
                    OPTIONS[key] = normaliseOption(key, saved[key]);
                }
            } catch (_) { /* corrupt entry: keep the defaults */ }
        }
        syncControls();
    }

    /** Clamp a stored value to one of the select's current options. */
    function normaliseOption(key, value) {
        for (var i = 0; i < CONTROLS.length; i++) {
            if (CONTROLS[i].key !== key) continue;
            var select = document.getElementById(CONTROLS[i].id);
            if (!select) return value;
            for (var j = 0; j < select.options.length; j++) {
                if (select.options[j].value === value) return value;
            }
            return select.options.length > 0 ? select.options[0].value : value;
        }
        return value;
    }

    function wireControls() {
        for (var i = 0; i < CONTROLS.length; i++) {
            (function (control) {
                var select = document.getElementById(control.id);
                if (!select) return;
                select.addEventListener('change', function () {
                    OPTIONS[control.key] = select.value;
                    saveOptions();
                    if (control.relayout) {
                        state.plan = null;      // heights / footprints / districts changed
                        state.selected = null;
                        applyPlan();
                        return;
                    }
                    if (state.graph) state.graph.nodeThreeObject(buildingFor);
                    buildStreets();
                    updateSummary();
                });
            })(CONTROLS[i]);
        }
    }
    function activate() {
        ensureGraph();
        if (!state.plan) applyPlan();
        else resize();
    }

    function init() {
        state.view = $('#city-view');
        if (!state.view) return;
        state.hudMeta = $('#city-hud-meta');
        state.hudFocus = $('#city-hud-graph');
        if (state.hudFocus) state.hudFocus.addEventListener('click', focusInGraph);
        wireSide();
        restoreOptions();
        wireControls();

        if (typeof MutationObserver === 'function') {
            state.observer = new MutationObserver(function () {
                if (isActive()) activate();
            });
            state.observer.observe(state.view, { attributes: true, attributeFilter: ['class'] });
        }
        window.addEventListener('resize', function () {
            if (isActive()) resize();
        });
        if (isActive()) activate();
    }

    window.addEventListener('message', function (event) {
        var message = event.data || {};
        if (message.type !== 'graphData') return;
        state.data = message.payload;
        state.plan = null;
        state.selected = null;
        if (isActive()) applyPlan();
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Test surface (jsdom harness) — no effect on the product.
    window.AuraCityView = {
        activate: activate,
        select: function (id) { selectBuilding({ id: id }); },
        clear: clearSelection,
        scope: function () { return state.scope; },
        setScope: setScope,
        colourOf: function (id) { return colourFor({ id: id, language: '' }, state.byId[id] || { h: 0.5, district: '' }); },
        tooltip: function (id) { return tooltipFor({ id: id }); },
        relations: function () {
            return { in: Object.keys(state.relations.in).length, out: Object.keys(state.relations.out).length };
        },
        plan: function () { return state.plan; },
        options: OPTIONS,
        graph: function () { return state.graph; },
        streets: function () {
            return state.streetCount;
        },
    };
})();
