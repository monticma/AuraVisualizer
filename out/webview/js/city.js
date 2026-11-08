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
    var GROUND_SIZE = SCALE * 16;        // world plane; its rim is faded out
    var GROUND_Y = -4.8;                 // just under the plinth
    var GROUND_CELLS = 64;               // ≈ 130 units per block

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
        ground: null,
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

    /**
     * Ground texture: a lit plaza under the city, a street grid, then a radial
     * alpha ramp baked with `destination-in` so the plane dissolves into the
     * scene background. Baking the fade (instead of using scene fog) keeps the
     * buildings untouched — fog would grey out the whole city.
     */
    function groundTexture() {
        var T = window.THREE;
        if (!T) return null;
        var size = 2048;
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        if (!ctx) return null;
        var half = size / 2;

        var fill = ctx.createRadialGradient(half, half, 0, half, half, half);
        fill.addColorStop(0, '#1c2532');
        fill.addColorStop(0.35, '#151c26');
        fill.addColorStop(1, '#0f141b');
        ctx.fillStyle = fill;
        ctx.fillRect(0, 0, size, size);

        // Two passes: minor streets, then every 5th one a little brighter.
        var step = size / GROUND_CELLS;
        for (var pass = 0; pass < 2; pass++) {
            var major = pass === 1;
            ctx.beginPath();
            ctx.strokeStyle = major ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.032)';
            ctx.lineWidth = major ? 2.5 : 1.5;
            for (var i = 0; i <= GROUND_CELLS; i++) {
                if ((i % 5 === 0) !== major) continue;
                var p = i * step;
                ctx.moveTo(p, 0);
                ctx.lineTo(p, size);
                ctx.moveTo(0, p);
                ctx.lineTo(size, p);
            }
            ctx.stroke();
        }

        var fade = ctx.createRadialGradient(half, half, size * 0.30, half, half, half);
        fade.addColorStop(0, 'rgba(0,0,0,1)');
        fade.addColorStop(0.55, 'rgba(0,0,0,0.72)');
        fade.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalCompositeOperation = 'destination-in';
        ctx.fillStyle = fade;
        ctx.fillRect(0, 0, size, size);
        ctx.globalCompositeOperation = 'source-over';

        var texture = new T.CanvasTexture(canvas);
        // Canvas colours are sRGB: without this three treats them as linear and
        // the ground washes out to a pale grey.
        if (T.SRGBColorSpace) texture.colorSpace = T.SRGBColorSpace;
        texture.anisotropy = 8;
        return texture;
    }

    /** One plane under the plinth: the city stands somewhere instead of floating. */
    function buildGround() {
        var T = window.THREE;
        if (!T || state.ground || !state.graph) return;
        var scene = state.graph.scene();
        if (!scene) return;
        var texture = groundTexture();
        var group = new T.Group();
        group.name = 'aura-city-ground';
        var plane = new T.Mesh(
            new T.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
            new T.MeshBasicMaterial({
                color: texture ? '#ffffff' : '#141a22',
                map: texture,
                transparent: true,
                depthWrite: false,
            })
        );
        plane.name = 'aura-city-ground-plane';
        plane.rotation.x = -Math.PI / 2;
        plane.position.y = GROUND_Y;
        // Drawn before the streets, never occluding them (no depth write).
        plane.renderOrder = -1;
        group.add(plane);
        scene.add(group);
        state.ground = group;
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
        buildBuildingEdges(plan, group);
    }

    /**
     * Dark outlines around every block. Uniform facades in the same perspective
     * merge into one mass; a 1-thousandth-of-a-unit offset keeps the lines outside
     * the surface (no z-fighting) and one geometry keeps it to a single draw call.
     */
    function buildBuildingEdges(plan, group) {
        var T = window.THREE;
        if (!T || !plan) return;
        var positions = [];

        function edge(a, b) {
            positions.push(a[0], a[1], a[2], b[0], b[1], b[2]);
        }

        for (var i = 0; i < plan.rects.length; i++) {
            var rect = plan.rects[i];
            var w = Math.max(rect.w * SCALE, 1.2) * 1.004;
            var d = Math.max(rect.d * SCALE, 1.2) * 1.004;
            var h = Math.max(rect.h * HEIGHT, MIN_H);
            var x = (rect.x + rect.w / 2 - 0.5) * SCALE;
            var z = (rect.z + rect.d / 2 - 0.5) * SCALE;
            var base = plateAltitude(rect.depth);
            var top = base + h;
            var hw = w / 2, hd = d / 2;

            var p000 = [x - hw, base, z - hd];
            var p100 = [x + hw, base, z - hd];
            var p110 = [x + hw, base, z + hd];
            var p010 = [x - hw, base, z + hd];
            var p001 = [x - hw, top, z - hd];
            var p101 = [x + hw, top, z - hd];
            var p111 = [x + hw, top, z + hd];
            var p011 = [x - hw, top, z + hd];

            edge(p000, p100); edge(p100, p110); edge(p110, p010); edge(p010, p000);
            edge(p001, p101); edge(p101, p111); edge(p111, p011); edge(p011, p001);
            edge(p000, p001); edge(p100, p101); edge(p110, p111); edge(p010, p011);
        }

        if (positions.length === 0) return;
        var geometry = new T.BufferGeometry();
        geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
        var lines = new T.LineSegments(geometry, new T.LineBasicMaterial({
            color: '#070a0e',
            transparent: true,
            opacity: 0.7,
            depthWrite: false,
        }));
        lines.name = 'aura-city-edges';
        group.add(lines);
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
        // The ground plane reaches well past the default far plane, and a clip
        // there would cut a hard circle into the horizon.
        try {
            var camera = typeof state.graph.camera === 'function' ? state.graph.camera() : null;
            if (camera && camera.far !== undefined) {
                var far = GROUND_SIZE * 2;
                if (!camera.far || camera.far < far) {
                    camera.far = far;
                    camera.updateProjectionMatrix();
                }
            }
        } catch (_) { /* older 3d-force-graph: leave the camera alone */ }
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

        buildGround();
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
        summary.textContent = state.plan.rects.length + ' buildings · '
            + state.plan.districts.length + ' districts';
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
        if (!id) { side.classList.remove('open'); return; }
        side.classList.add('open');

        var rect = state.byId[id];
        var node = state.nodeById[id] || {};
        if (title) title.textContent = id.split('/').pop() || id;
        var pathEl = $('#city-side-path');
        if (pathEl) pathEl.textContent = id;
        var iconEl = $('#city-side-icon');
        if (iconEl) {
            var icons = window.LANGUAGE_ICONS || {};
            iconEl.textContent = icons[node.language] || '📄';
        }

        var html = '';
        html += '<div class="city-side-section"><div class="city-side-label">Metrics</div><div class="city-side-grid">';
        function row(label, value) {
            html += '<div class="city-side-cell"><span class="city-side-k">' + label + '</span>'
                + '<span class="city-side-v">' + escapeHtml(value) + '</span></div>';
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
                + '<div class="city-side-v">' + escapeHtml(rect.district) + '</div></div>';
        }

        html += relationGraph();

        html += memberSection(node);

        html += '<div class="city-side-section city-side-actions">'
            + '<button type="button" data-city-action="open">Open file</button>'
            + '<button type="button" data-city-action="graph">⌖ Focus in graph</button>'
            + '</div>';

        body.innerHTML = html;
    }

    /** Members of the file (CodeCity's MEMBERS list), clickable to the line. */
    function memberSection(node) {
        var symbols = node && node.symbols;
        if (!symbols) return '';
        var rows = [];
        function collect(list, kind) {
            if (!list || !list.length) return;
            for (var i = 0; i < list.length; i++) {
                if (!list[i] || !list[i].name) continue;
                rows.push({ name: list[i].name, line: list[i].line || 0, kind: kind });
            }
        }
        collect(symbols.classes, 'class');
        collect(symbols.structs, 'struct');
        collect(symbols.interfaces, 'interface');
        collect(symbols.functions, 'fn');
        collect(symbols.methods, 'method');
        var total = symbols.totalSymbols || rows.length;
        if (rows.length === 0) return '';

        var html = '<div class="city-side-section"><div class="city-side-label">Members (' + total + ')</div>';
        for (var r = 0; r < rows.length && r < 40; r++) {
            html += '<div class="city-side-row" data-city-line="' + rows[r].line + '" title="line ' + rows[r].line + '">'
                + '<span class="city-side-row-name">' + escapeHtml(rows[r].name) + '</span>'
                + '<span class="city-side-row-count">' + rows[r].kind + (rows[r].line ? ' L' + rows[r].line : '') + '</span></div>';
        }
        if (rows.length > 40) html += '<div class="city-side-empty">+' + (rows.length - 40) + ' more</div>';
        return html + '</div>';
    }

    /**
     * Mini dependency map, the way CodeCity draws it in its inspector: the file
     * in the middle, its dependencies on the right (blue), its dependents on the
     * left (amber), both violet. Clicking a satellite selects that building.
     */
    function relationGraph() {
        var outIds = Object.keys(state.relations.out);
        var inIds = Object.keys(state.relations.in);
        var label = '<div class="city-side-label">Connections';
        if (outIds.length || inIds.length) label += ' · ' + outIds.length + ' out · ' + inIds.length + ' in';
        label += '</div>';
        if (outIds.length === 0 && inIds.length === 0) {
            return '<div class="city-side-section">' + label + '<div class="city-side-empty">none</div></div>';
        }

        var MAX = 8;
        var rows = Math.max(1, Math.min(outIds.length, MAX), Math.min(inIds.length, MAX));
        var W = 280;
        var H = Math.max(58, 34 + (rows - 1) * 24);
        var cx = W / 2;
        var cy = H / 2;
        var COL_R = 196;
        var COL_L = 84;
        var svg = '<svg class="city-rel-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">';

        function column(ids, x, colour, side) {
            var overflow = ids.length > MAX ? ids.length - MAX : 0;
            var slots = Math.min(ids.length, MAX);
            var shown = overflow ? ids.slice(0, slots - 1) : ids.slice();
            var step = slots > 1 ? Math.min(24, (H - 24) / (slots - 1)) : 0;
            var startY = cy - (step * (slots - 1)) / 2;
            var anchor = side === 'right' ? 'start' : 'end';
            var textX = side === 'right' ? x + 9 : x - 9;
            for (var i = 0; i < shown.length; i++) {
                var y = startY + i * step;
                var id = shown[i];
                svg += '<line class="city-rel-link" x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y
                    + '" stroke="' + colour + '"/>';
                svg += '<g class="city-rel" data-city-goto="' + escapeHtml(id) + '"><title>' + escapeHtml(id) + '</title>'
                    + '<circle cx="' + x + '" cy="' + y + '" r="4" fill="' + colour + '"/>'
                    + '<text x="' + textX + '" y="' + (y + 3.2) + '" text-anchor="' + anchor + '">'
                    + escapeHtml(shortName(id)) + '</text></g>';
            }
            if (overflow) {
                var moreY = startY + (slots - 1) * step;
                svg += '<text class="city-rel-more" x="' + textX + '" y="' + (moreY + 3.2) + '"'
                    + ' text-anchor="' + anchor + '">+' + overflow + ' more</text>';
            }
        }

        column(outIds, COL_R, '#4fc3f7', 'right');
        column(inIds, COL_L, '#e0b53a', 'left');

        svg += '<circle cx="' + cx + '" cy="' + cy + '" r="6.5" fill="#ffffff"/>';
        svg += '<text class="city-rel-self" x="' + cx + '" y="' + (cy + 20) + '" text-anchor="middle">'
            + escapeHtml(shortName(state.selected || '', 18)) + '</text>';
        svg += '</svg>';

        return '<div class="city-side-section">' + label + svg
            + '<div class="city-rel-legend"><span class="rel-out">● depends on</span>'
            + '<span class="rel-in">● used by</span></div></div>';
    }

    function shortName(id, max) {
        var name = String(id || '').split('/').pop();
        var limit = max || 13;
        return name.length > limit ? name.slice(0, limit - 1) + '…' : name;
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
    function openSelectedFile(line) {
        if (!state.selected) return;
        if (!window.AuraHost || typeof window.AuraHost.post !== 'function') return;
        window.AuraHost.post({ type: 'openFile', payload: { path: state.selected, line: line || 0 } });
    }

    /** Export the city canvas as a PNG through the host's save dialog. */
    function exportPng() {
        if (!state.graph || typeof state.graph.renderer !== 'function') return;
        var renderer = null;
        try { renderer = state.graph.renderer(); } catch (_) { renderer = null; }
        var canvas = renderer && renderer.domElement;
        if (!canvas || typeof canvas.toDataURL !== 'function') return;
        var dataUrl = canvas.toDataURL('image/png');
        if (!dataUrl || dataUrl.indexOf('data:image/png') !== 0) return;
        if (window.AuraHost && typeof window.AuraHost.post === 'function') {
            window.AuraHost.post({ type: 'exportImageData', payload: { dataUrl: dataUrl } });
        }
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
            var line = target.getAttribute('data-city-line');
            if (line) { openSelectedFile(parseInt(line, 10) || 0); return; }
            var action = target.getAttribute('data-city-action');
            if (action === 'open') openSelectedFile(0);
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
        var exportBtn = $('#city-export');
        if (exportBtn) exportBtn.addEventListener('click', exportPng);
        var treemapBtn = $('#treemap-city');
        if (treemapBtn) {
            treemapBtn.addEventListener('click', function () {
                var cityTab = document.querySelector('.tab-btn[data-tab="city"]');
                if (cityTab) cityTab.click();
            });
        }
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
        sideHtml: function () { var body = $('#city-side-body'); return body ? body.innerHTML : ''; },
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
