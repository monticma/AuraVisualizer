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
    };

    var STORE_KEY = 'aura.city.options.v1';

    var state = {
        view: null,
        container: null,
        graph: null,
        data: null,
        plan: null,
        byId: {},
        decor: null,
        selected: null,
        observer: null,
        hudMeta: null,
        hudFocus: null,
    };

    function $(selector) {
        return document.querySelector(selector);
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

    /** Building colour, per the chosen channel. */
    function colourFor(node, rect) {
        if (state.selected === node.id) return '#ffffff';
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
            .nodeLabel('')
            .nodeThreeObject(buildingFor)
            .nodeThreeObjectExtend(false)
            .enableNodeDrag(false)
            .linkVisibility(function () { return false; })
            .showNavInfo(false)
            .warmupTicks(0)
            .cooldownTicks(0)
            .onNodeClick(selectBuilding);

        var controls = null;
        try { controls = state.graph.controls(); } catch (_) { controls = null; }
        if (controls && ('maxPolarAngle' in controls)) {
            controls.maxPolarAngle = MAX_POLAR;
            controls.minPolarAngle = 0.05;
        }
        return state.graph;
    }

    // ── Plan ───────────────────────────────────────────────────
    function applyPlan() {
        var graph = ensureGraph();
        if (!graph || !state.data || !window.AuraCity) return;
        // The payload nodes are the *same objects* the graph tab feeds: mutating
        // them (positions + pins) would drag the graph layout into the city and
        // leave every node pinned when the user goes back. Work on copies.
        var source = state.data.nodes || [];
        var nodes = [];
        for (var c = 0; c < source.length; c++) {
            var clone = {};
            for (var key in source[c]) {
                if (Object.prototype.hasOwnProperty.call(source[c], key)) clone[key] = source[c][key];
            }
            nodes.push(clone);
        }
        if (nodes.length === 0) return;

        state.plan = window.AuraCity.layoutCity(nodes, OPTIONS);
        state.byId = {};
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
        resize();
        frameCity();
        updateHud();
        updateSummary();
    }

    /** Legend line: what the three (four) channels actually encode right now. */
    function updateSummary() {
        var summary = $('#city-summary');
        if (!summary || !state.plan) return;
        summary.textContent = state.plan.rects.length + ' buildings · ' + state.plan.districts.length + ' districts'
            + '  ·  height = ' + state.plan.heightMetric
            + '  ·  footprint = ' + state.plan.footprintMetric
            + '  ·  colour = ' + OPTIONS.colour
            + '  ·  ' + (state.plan.mapping === 'quantiles' ? '5 tiers' : state.plan.mapping);
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
    function selectBuilding(node) {
        if (!node || !node.id) return;
        state.selected = node.id;
        if (state.graph) state.graph.nodeThreeObject(buildingFor);
        updateHud();
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

    // ── Wiring ─────────────────────────────────────────────────

    /** The five selects of the city toolbar, and what each one invalidates. */
    var CONTROLS = [
        { id: 'city-height', key: 'height', relayout: true },
        { id: 'city-footprint', key: 'footprint', relayout: true },
        { id: 'city-colour', key: 'colour', relayout: false },
        { id: 'city-mapping', key: 'mapping', relayout: true },
        { id: 'city-districts', key: 'districtBy', relayout: true },
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
        if (!raw) { syncControls(); return; }
        try {
            var saved = JSON.parse(raw);
            for (var i = 0; i < CONTROLS.length; i++) {
                var key = CONTROLS[i].key;
                if (typeof saved[key] === 'string' && saved[key].length > 0) OPTIONS[key] = saved[key];
            }
        } catch (_) { /* corrupt entry: keep the defaults */ }
        syncControls();
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
        plan: function () { return state.plan; },
        options: OPTIONS,
        graph: function () { return state.graph; },
    };
})();
