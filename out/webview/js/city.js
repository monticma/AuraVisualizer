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

    // Sizes below are written at the reference building count; `cityScale()`
    // carries them to the city actually on screen (square-root rule, city-core).
    var BASE_SCALE = 520;        // plan width at the reference count
    var HEIGHT = 170;            // tallest building, at the reference scale
    var PLATE_STEP = 9;          // altitude per district nesting level
    var MAX_POLAR = Math.PI / 2 - 0.1;   // never look under the plinth
    var MIN_H = 2.5;
    // The ground never scales: its 130-unit grid is what tells you how big the
    // city is. Only its depth under the plinth follows the plan.
    var GROUND_SIZE = BASE_SCALE * 16;   // world plane; its rim is faded out
    var GROUND_DEPTH = 4.8;              // just under the plinth
    var GROUND_CELLS = 64;               // ≈ 130 units per block

    // CodeCity's reading: desaturated on the low end, hot at the top, so the eye
    // only goes where it matters.
    var RAMP = ['#5b6b82', '#2f8f9d', '#e0b53a', '#d1462f'];

    var OPTIONS = {
        granularity: 'files',
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
        nodeById: {},
        decor: null,
        ground: null,
        scale: 0,             // world width of the plan, set by applyPlan
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
        var perFunction = OPTIONS.granularity === 'functions';
        var label = perFunction && node.name ? node.name : node.id;
        var html = '<div class="city-tip-name">' + escapeHtml(label) + '</div>';
        if (rect) {
            html += '<div class="city-tip-meta">'
                + rect.footprintValue + ' lines · height ' + rect.heightValue
                + (perFunction ? '' : ' · ' + escapeHtml(rect.district)) + '</div>';
        }
        if (perFunction && node.path) {
            html += '<div class="city-tip-meta">' + escapeHtml(node.path)
                + (node.line ? ':' + node.line : '') + '</div>';
        }
        var kind = kindOf(node);
        if (kind !== 'code') html += '<div class="city-tip-meta">' + kind + ' · not ranked</div>';
        if (state.selected && state.selected !== node.id) {
            var key = relationKey(node);
            if (state.relations.out[key]) html += '<div class="city-tip-dir city-tip-in">← used by the selection</div>';
            if (state.relations.in[key]) html += '<div class="city-tip-dir city-tip-out">→ depends on the selection</div>';
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
        // The hot red is reserved for the bounded top band: at 5 000 buildings a
        // "top tier" of 1 000 red blocks says nothing.
        if (OPTIONS.colour === 'height' && state.hotIds[node.id]) return RAMP[3];
        if (state.selected) {
            // A selection answers a different question: not "how big" but "who
            // depends on me / whom do I depend on". The ramp is muted and the
            // direction takes over, exactly like CodeCity's selection state.
            var key = relationKey(node);
            var inbound = !!state.relations.in[key];
            var outbound = !!state.relations.out[key];
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
        // and the colour agree and the eye only goes where it matters. The hot
        // end of the ramp is reserved for the bounded top band (see colourFor).
        return rampColor(((rect.h - 0.12) / 0.88) * 0.66);
    }

    /** World width of the plan for the city currently on screen. */
    function cityScale() {
        return state.scale > 0 ? state.scale : BASE_SCALE;
    }

    /** A size written at the reference scale, expressed at the current one. */
    function scaled(value) {
        return value * cityScale() / BASE_SCALE;
    }

    function plateAltitude(depth) {
        return (depth || 0) * scaled(PLATE_STEP);
    }

    /** Code, documentation, data, config or asset — see city-core.fileKind. */
    function kindOf(node) {
        if (!window.AuraCity || typeof window.AuraCity.fileKind !== 'function') return 'code';
        return window.AuraCity.fileKind(node || {});
    }

    /** "Grey glass": keep a hint of the building's colour, drain it to a flat grey. */
    function greyedColour(color) {
        var T = window.THREE;
        if (!T) return color;
        var c = new T.Color(color);
        var luma = 0.3 * c.r + 0.59 * c.g + 0.11 * c.b;
        var grey = luma * 0.55 + 0.12;
        return new T.Color(grey, grey, grey);
    }

    // ── Scene ──────────────────────────────────────────────────
    function buildingFor(node) {
        var T = window.THREE;
        var rect = state.byId[node.id];
        if (!T || !rect) return null;
        var w = Math.max(rect.w * cityScale(), scaled(1.2));
        var d = Math.max(rect.d * cityScale(), scaled(1.2));
        var h = Math.max(rect.h * scaled(HEIGHT), scaled(MIN_H));
        var selected = state.selected === node.id;
        var color = colourFor(node, rect);
        // Not ranked: documentation, data, config and assets are drawn as glass —
        // visible, but clearly not part of the ranked city.
        var glass = !selected && kindOf(node) !== 'code';
        var material = new T.MeshLambertMaterial({
            color: glass ? greyedColour(color) : color,
            transparent: glass,
            opacity: glass ? 0.55 : 1,
        });
        var mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material);
        mesh.userData.cityBuilding = node.id;
        return mesh;
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

    /** The ground sits just under the plinth, whose depth follows the plan. */
    function dropGround() {
        if (!state.ground) return;
        var plane = state.ground.children[0];
        if (plane) plane.position.y = -scaled(GROUND_DEPTH);
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
        plane.position.y = -scaled(GROUND_DEPTH);
        // Drawn under everything else and never occluding it (no depth write).
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
            new T.BoxGeometry(cityScale() * 1.04, scaled(3), cityScale() * 1.04),
            new T.MeshLambertMaterial({ color: '#11151a' })
        );
        plinth.position.y = -scaled(3.2);
        group.add(plinth);

        for (var i = 0; i < plan.districts.length; i++) {
            var district = plan.districts[i];
            var plate = new T.Mesh(
                new T.BoxGeometry(Math.max(district.w * cityScale(), scaled(2)), scaled(2.4), Math.max(district.d * cityScale(), scaled(2))),
                // The plate must read as ground, not as a second city.
                new T.MeshLambertMaterial({ color: new T.Color(districtColor(district.key)).multiplyScalar(0.34) })
            );
            plate.position.set(
                (district.x + district.w / 2 - 0.5) * cityScale(),
                plateAltitude(district.depth) - scaled(1.2),
                (district.z + district.d / 2 - 0.5) * cityScale()
            );
            group.add(plate);
        }

        buildDistrictLabels(plan, group);
        buildRankBadges(plan, group);

        scene.add(group);
        state.decor = group;
        buildBuildingEdges(plan, group);
    }

    /**
     * District names floating on their plate. Without them the plates are
     * anonymous: you have to hover a building or read the breadcrumb to know
     * which block you are looking at. Labels are sprites (always camera-facing)
     * and skip plates too small to hold a readable word.
     */
    function buildDistrictLabels(plan, group) {
        var T = window.THREE;
        if (!T || !plan || !window.AuraSprites || typeof window.AuraSprites.labelSprite !== 'function') return;
        // "Names & ranks" off: the city stays readable without a single word on
        // it — that is what a screenshot for someone else's eyes needs.
        if (state.names === false) { state.labelCount = 0; return; }
        var scale = cityScale();
        var ranked = plan.districts.slice().sort(function (a, b) { return (b.w * b.d) - (a.w * a.d); });
        var drawn = 0;
        for (var i = 0; i < ranked.length && drawn < 40; i++) {
            var district = ranked[i];
            if (district.w * scale < scaled(30) || district.d * scale < scaled(16)) continue;
            var name = String(district.key).split('/').pop();
            if (!name) continue;
            var sprite = window.AuraSprites.labelSprite(name.toUpperCase() + '/', 'rgba(255, 255, 255, 0.6)');
            if (!sprite) continue;
            sprite.scale.multiplyScalar(scaled(1.6));
            sprite.position.set(
                (district.x + district.w * 0.14 - 0.5) * scale,
                plateAltitude(district.depth) + scaled(2.5),
                (district.z + district.d * 0.14 - 0.5) * scale
            );
            sprite.renderOrder = 2;
            group.add(sprite);
            drawn++;
        }
        state.labelCount = drawn;
    }

    /**
     * Dark outlines around every block. Uniform facades in the same perspective
     * merge into one mass; a 1-thousandth-of-a-unit offset keeps the lines outside
     * the surface (no z-fighting) and one geometry keeps it to a single draw call.
     */
    function buildRankBadges(plan, group) {
        var T = window.THREE;
        if (!T || !plan || !window.AuraSprites || typeof window.AuraSprites.labelSprite !== 'function') return;
        if (!state.rankOf) return;
        if (state.names === false) { state.badgeCount = 0; return; }
        var drawn = 0;
        for (var i = 0; i < plan.rects.length; i++) {
            var rect = plan.rects[i];
            var rank = state.rankOf[rect.id];
            if (!rank) continue;
            var sprite = window.AuraSprites.labelSprite('#' + rank, 'rgba(255, 209, 102, 0.95)');
            if (!sprite) continue;
            sprite.scale.multiplyScalar(scaled(1.25));
            // Exactly on top of the block: rank is a *place*, not a decoration.
            sprite.position.set(
                (rect.x + rect.w / 2 - 0.5) * cityScale(),
                plateAltitude(rect.depth) + Math.max(rect.h * scaled(HEIGHT), scaled(MIN_H)) + scaled(3),
                (rect.z + rect.d / 2 - 0.5) * cityScale()
            );
            sprite.renderOrder = 3;
            group.add(sprite);
            drawn++;
        }
        state.badgeCount = drawn;
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
            var w = Math.max(rect.w * cityScale(), scaled(1.2)) * 1.004;
            var d = Math.max(rect.d * cityScale(), scaled(1.2)) * 1.004;
            var h = Math.max(rect.h * scaled(HEIGHT), scaled(MIN_H));
            var x = (rect.x + rect.w / 2 - 0.5) * cityScale();
            var z = (rect.z + rect.d / 2 - 0.5) * cityScale();
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
    /**
     * Nodes of the current granularity: one per file, or one per function
     * (CodeCity's "City of C" mapping, where files are the districts).
     */
    function granularNodes(list) {
        if (OPTIONS.granularity === 'functions' && window.AuraCity && window.AuraCity.functionNodes) {
            return window.AuraCity.functionNodes(list);
        }
        return list;
    }

    /** District key at the current granularity (a folder, or a file path). */
    function keyOfNode(node) {
        if (!node) return '';
        // At function granularity the district *is* the file, for the raw file
        // nodes (whose `group` is still a folder) as well as for the generated
        // function nodes (whose `group` is the file).
        if (OPTIONS.granularity === 'functions') return node.path || node.id || node.group || '';
        var lib = window.AuraCity;
        if (!lib || !lib.districtKeyOf) return node.group || node.path || node.id || '';
        return lib.districtKeyOf(node, OPTIONS.districtBy);
    }

    /** Id used by the *graph* (links stay file → file at every granularity). */
    function relationKey(node) {
        if (!node) return '';
        if (OPTIONS.granularity === 'functions') return node.path || node.id;
        return node.id;
    }

    /** File a building belongs to — what "open file" and "focus in graph" need. */
    function filePathOf(id) {
        var node = state.nodeById[id];
        if (OPTIONS.granularity === 'functions' && node && node.path) return node.path;
        return id;
    }

    function nodesInScope() {
        var all = (state.data && state.data.nodes) || [];
        if (!state.scope) return all;
        var prefix = state.scope + '/';
        var kept = [];
        for (var i = 0; i < all.length; i++) {
            var key = keyOfNode(all[i]);
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
        state.relations = { in: {}, out: {}, docs: {} };
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
        if (nodes.length === 0) { state.plan = null; renderCrumbs(); return; }

        // One building per function turns 762 files into ~5 000 buildings; the
        // file becomes the district.
        nodes = granularNodes(nodes);
        if (nodes.length === 0) { state.plan = null; renderCrumbs(); return; }

        // How big the city is on the ground: the plan is normalized, this is the
        // only place the building count becomes a size (√n, see city-core).
        state.scale = (window.AuraCity && window.AuraCity.cityScaleFor)
            ? window.AuraCity.cityScaleFor(nodes.length)
            : BASE_SCALE;
        dropGround();

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

        // The "hottest" band: a fixed, bounded number of buildings (5 % of them,
        // at least 3, at most 20) so the red always means a handful you can count.
        state.hotIds = {};
        state.rankOf = {};
        state.hotCount = (window.AuraCity && window.AuraCity.topBandSize)
            ? window.AuraCity.topBandSize(state.plan.rects.length)
            : 0;
        if (state.hotCount > 0) {
            var ranked = state.plan.rects.slice().sort(function (a, b) {
                return (b.heightValue - a.heightValue) || (a.id < b.id ? 1 : -1);
            });
            for (var hot = 0; hot < ranked.length && hot < state.hotCount; hot++) {
                state.hotIds[ranked[hot].id] = true;
                state.rankOf[ranked[hot].id] = hot + 1;
            }
        }

        for (var n = 0; n < nodes.length; n++) {
            var node = nodes[n];
            var rect = state.byId[node.id];
            if (!rect) continue;
            node.x = (rect.x + rect.w / 2 - 0.5) * cityScale();
            node.z = (rect.z + rect.d / 2 - 0.5) * cityScale();
            node.y = plateAltitude(rect.depth) + Math.max(rect.h * scaled(HEIGHT), scaled(MIN_H)) / 2;
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
        resize();
        frameCity();
        updateHud();
        updateLegend();
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
        var nodes = granularNodes((state.data.nodes || []));
        for (var i = 0; i < nodes.length; i++) {
            var key = keyOfNode(nodes[i]);
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
    /** Isometric-ish three-quarter view, the way CodeCity opens. */
    function frameCity() {
        if (!state.graph) return;
        var scale = cityScale();
        state.graph.cameraPosition({ x: scale * 0.55, y: scale * 0.95, z: scale * 1.15 }, { x: 0, y: 0, z: 0 }, 0);
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

    /**
     * Direct neighbours of the selection, split by direction. `doc-reference`
     * edges are counted *apart*: a page that mentions a file is not a dependency,
     * and the host already keeps them out of fan-in / fan-out and out of the risk
     * score. Mixing them in made the inspector contradict the Metrics block
     * (one import vs fifteen "in" because fourteen of them were documentation).
     */
    function computeRelations(id) {
        var inbound = {};
        var outbound = {};
        var docs = {};
        if (!id || !state.data) return { in: inbound, out: outbound, docs: docs };
        var links = state.data.links || [];
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            var from = link.source && typeof link.source === 'object' ? link.source.id : link.source;
            var to = link.target && typeof link.target === 'object' ? link.target.id : link.target;
            if (link.type === 'doc-reference') {
                if (from === id) docs[to] = (docs[to] || 0) + 1;
                else if (to === id) docs[from] = (docs[from] || 0) + 1;
                continue;
            }
            if (from === id) outbound[to] = (outbound[to] || 0) + 1;
            else if (to === id) inbound[from] = (inbound[from] || 0) + 1;
        }
        return { in: inbound, out: outbound, docs: docs };
    }

    function selectBuilding(node) {
        if (!node || !node.id) return;
        state.selected = node.id;
        state.relations = computeRelations(relationKey(state.nodeById[node.id] || node));
        if (state.graph) state.graph.nodeThreeObject(buildingFor);
        updateHud();
        renderSide();
    }

    function clearSelection() {
        if (!state.selected) return;
        state.selected = null;
        state.relations = { in: {}, out: {}, docs: {} };
        if (state.graph) state.graph.nodeThreeObject(buildingFor);
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
        var label = node.name ? node.name : (id.split('/').pop() || id);
        if (title) title.textContent = label;
        var pathEl = $('#city-side-path');
        if (pathEl) {
            var shown = node.path && node.path !== id ? node.path : id;
            if (OPTIONS.granularity === 'functions' && node.line) shown += ':' + node.line;
            pathEl.textContent = shown;
        }
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
        // Fan counts are *edge* counts — one per edge type — while Connections
        // below counts distinct files. Same graph, two units; say so.
        row('Fan-in (edges)', node.fanIn);
        row('Fan-out (edges)', node.fanOut);
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

        var risk = riskPanel(id);
        if (risk) html += risk;

        html += relationGraph();

        html += '<div class="city-side-section city-side-actions">'
            + '<button type="button" data-city-action="open">Open file</button>'
            + '<button type="button" data-city-action="graph">⌖ Focus in graph</button>'
            + '</div>';

        body.innerHTML = html;
    }

    /**
     * Risk block: the score the Risk tab ranks by, with the same written reasons
     * and the history behind them (commits, rewrite volume, authors). Percentiles
     * are repository-wide, so a building's score means here what it means there.
     * At function granularity the score is the *file's* — the file is the unit
     * git knows about.
     */
    function riskPanel(id) {
        var map = window.AuraRiskMap;
        if (!map || typeof map.explain !== 'function') return '';
        var node = state.nodeById[id] || {};
        var key = filePathOf(id) || relationKey(node) || id;
        var info = map.explain(key);
        if (!info || typeof info.score !== 'number') return '';
        var stats = info.stats || {};
        var reasons = info.reasons || [];
        // Nothing to say: no structural reason *and* no history. A score of 0
        // with no explanation is noise, not information.
        if (reasons.length === 0 && !stats.commits) return '';

        var score = Math.round(info.score);
        var html = '<div class="city-side-section city-risk" data-bucket="' + info.bucket + '">'
            + '<div class="city-side-label">Risk · ' + (info.windowDays || 90) + ' days</div>'
            + '<div class="city-risk-head"><span class="city-risk-score">' + score + '</span>'
            + '<span class="city-risk-bar"><i style="width:'
            + Math.max(2, Math.min(100, score)) + '%"></i></span></div>';
        if (reasons.length) {
            html += '<ul class="city-risk-reasons">';
            for (var i = 0; i < reasons.length && i < 4; i++) {
                html += '<li>' + escapeHtml(reasons[i].text || '') + '</li>';
            }
            html += '</ul>';
        }
        var bits = [];
        if (stats.commits) bits.push(stats.commits + (stats.commits === 1 ? ' commit' : ' commits'));
        if (stats.relChurn) bits.push(Math.round(stats.relChurn * 100) + ' % rewritten');
        if (stats.fixRatio) bits.push(Math.round(stats.fixRatio * 100) + ' % fixes');
        if (stats.authors) bits.push(stats.authors + (stats.authors === 1 ? ' author' : ' authors'));
        if (bits.length) html += '<div class="city-risk-stats">' + escapeHtml(bits.join(' · ')) + '</div>';
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
        var docIds = Object.keys(state.relations.docs || {});
        var label = '<div class="city-side-label"'
            + ' title="One dot per file. Fan-in / Fan-out count every edge'
            + ' (import, import-type, call, script…), so they are usually larger.'
            + ' Documentation references are not dependencies: they are counted apart.">Connections';
        if (outIds.length || inIds.length) label += ' · ' + outIds.length + ' out · ' + inIds.length + ' in';
        label += '</div>';
        // A page that mentions the file is not a dependency — the host already
        // keeps doc-reference out of fan-in/out and out of the risk score.
        var docNote = docIds.length
            ? '<div class="city-side-empty">+ ' + docIds.length
                + ' documentation reference' + (docIds.length === 1 ? '' : 's') + '</div>'
            : '';
        if (outIds.length === 0 && inIds.length === 0) {
            return '<div class="city-side-section">' + label
                + '<div class="city-side-empty">none</div>' + docNote + '</div>';
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
            + '<span class="rel-in">● used by</span></div>' + docNote + '</div>';
    }

    function shortName(id, max) {
        var name = String(id || '').split('/').pop();
        var limit = max || 13;
        return name.length > limit ? name.slice(0, limit - 1) + '…' : name;
    }

    /** Legend: what the height, the red band and the grey glass mean. */
    function updateLegend() {
        var encoding = $('#city-legend-encoding');
        if (encoding && state.plan) {
            encoding.textContent = 'height = ' + state.plan.heightMetric
                + ' · footprint = ' + state.plan.footprintMetric;
        }
        var hot = $('#city-legend-hot');
        if (hot) {
            hot.textContent = state.hotCount > 0
                ? 'top ' + state.hotCount + ' tallest · ranked #1–#' + state.hotCount
                : 'no top band';
        }
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
        var node = state.nodeById[id] || {};
        var parts = [OPTIONS.granularity === 'functions' && node.name ? node.name : id];
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
            data: { type: 'focusNode', payload: { nodeId: filePathOf(state.selected), reveal: true } },
        }));
    }

    /** Open the selected file in the editor (the host owns the message channel). */
    function openSelectedFile(line) {
        if (!state.selected) return;
        if (!window.AuraHost || typeof window.AuraHost.post !== 'function') return;
        var node = state.nodeById[state.selected] || {};
        var fallback = OPTIONS.granularity === 'functions' && node.line ? node.line : 0;
        window.AuraHost.post({
            type: 'openFile',
            payload: { path: filePathOf(state.selected), line: line || fallback },
        });
    }

    /** Export the city canvas as a PNG through the host's save dialog. */
    function exportPng() {
        var canvas = canvasElement();
        if (!canvas) return;
        var dataUrl = '';
        // A canvas that refuses to serialise (2D-less host) must not break the panel.
        try { dataUrl = canvas.toDataURL('image/png'); } catch (_) { dataUrl = ''; }
        if (!dataUrl || dataUrl.indexOf('data:image/png') !== 0) return;
        if (window.AuraHost && typeof window.AuraHost.post === 'function') {
            window.AuraHost.post({ type: 'exportImageData', payload: { dataUrl: dataUrl } });
        }
    }

    /**
     * The live WebGL canvas, after a fresh render. `preserveDrawingBuffer` is off
     * in three by default, so the pixels are only valid inside the same task as
     * the draw: render, then read, never read later.
     */
    function canvasElement() {
        if (!state.graph || typeof state.graph.renderer !== 'function') return null;
        var renderer = null;
        try { renderer = state.graph.renderer(); } catch (_) { renderer = null; }
        var canvas = renderer && renderer.domElement;
        if (!canvas || typeof canvas.toDataURL !== 'function') return null;
        try { renderer.render(state.graph.scene(), state.graph.camera()); } catch (_) { /* keep the last frame */ }
        return canvas;
    }

    /**
     * Postcard: a 1600×900 sheet — the city, then what it means. The caption is
     * the point: buildings, districts, the active encoding, and the three
     * buildings that carry the city — so the image survives being sent to
     * someone who will never run the tool.
     */
    function exportPostcard() {
        var canvas = canvasElement();
        if (!canvas || !canvas.width || !canvas.height) return;
        if (typeof document.createElement !== 'function') return;
        var W = 1600;
        var H = 900;
        var BAND = 150;
        var sheet = document.createElement('canvas');
        sheet.width = W;
        sheet.height = H;
        var ctx = sheet.getContext('2d');
        if (!ctx) return;

        ctx.fillStyle = '#0b0e13';
        ctx.fillRect(0, 0, W, H);

        var k = Math.min(W / canvas.width, (H - BAND) / canvas.height);
        var dw = Math.round(canvas.width * k);
        var dh = Math.round(canvas.height * k);
        ctx.drawImage(canvas, Math.round((W - dw) / 2), Math.max(0, Math.round((H - BAND - dh) / 2)), dw, dh);

        var plan = state.plan;
        var counts = plan
            ? plan.rects.length + ' buildings · ' + plan.districts.length + ' districts'
            : 'no plan';
        var encoding = plan
            ? 'height = ' + plan.heightMetric + ' · footprint = ' + plan.footprintMetric
            : '';
        var top = [];
        if (state.names !== false && state.rankOf) {
            for (var id in state.rankOf) {
                if (Object.prototype.hasOwnProperty.call(state.rankOf, id)) {
                    top.push({ id: id, rank: state.rankOf[id] });
                }
            }
            top.sort(function (a, b) { return a.rank - b.rank; });
            top = top.slice(0, 3);
        }

        var y = H - BAND + 42;
        ctx.fillStyle = '#e8eef4';
        ctx.font = '600 30px system-ui, sans-serif';
        ctx.fillText(counts, 48, y);
        ctx.fillStyle = 'rgba(232, 238, 244, 0.6)';
        ctx.font = '400 20px system-ui, sans-serif';
        ctx.fillText(encoding, 48, y + 32);

        for (var t = 0; t < top.length; t++) {
            var node = state.nodeById[top[t].id] || {};
            var name = node.name || String(top[t].id).split('/').pop();
            ctx.fillStyle = t === 0 ? '#d1462f' : 'rgba(232, 238, 244, 0.75)';
            ctx.fillText('#' + top[t].rank + '  ' + name, 48, y + 66 + t * 26);
        }

        ctx.fillStyle = 'rgba(232, 238, 244, 0.35)';
        ctx.font = '400 18px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('Aura Visualizer', W - 48, H - 24);
        ctx.textAlign = 'left';

        var dataUrl = '';
        try { dataUrl = sheet.toDataURL('image/png'); } catch (_) { dataUrl = ''; }
        if (!dataUrl || dataUrl.indexOf('data:image/png') !== 0) return;
        if (window.AuraHost && typeof window.AuraHost.post === 'function') {
            window.AuraHost.post({ type: 'exportImageData', payload: { dataUrl: dataUrl } });
        }
    }

    /**
     * Search entry point: bring a file on screen. At file granularity the id *is*
     * a building; at function granularity a file only exists as a block, so drill
     * into it. Returns false when the id means nothing in this plan.
     */
    function reveal(id) {
        if (!id) return false;
        if (state.byId[id]) {
            selectBuilding({ id: id });
            return true;
        }
        var districts = (state.plan && state.plan.districts) || [];
        for (var i = 0; i < districts.length; i++) {
            if (districts[i].key === id) {
                setScope(id);
                return true;
            }
        }
        return false;
    }

    /** Search entry point for a symbol: its building, else its file's block. */
    function revealSymbol(file, name) {
        if (!file || !name) return false;
        var exact = file + '#' + name;
        if (state.byId[exact]) {
            selectBuilding({ id: exact });
            return true;
        }
        var prefix = exact + '#';
        var ids = Object.keys(state.byId);
        for (var i = 0; i < ids.length; i++) {
            if (ids[i].indexOf(prefix) === 0) {
                selectBuilding({ id: ids[i] });
                return true;
            }
        }
        return false;
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
            if (goto) {
                if (state.byId[goto]) selectBuilding({ id: goto });
                // Function granularity: satellites are files, so drill into one.
                else setScope(goto);
                return;
            }
            var action = target.getAttribute('data-city-action');
            if (action === 'open') openSelectedFile(0);
            if (action === 'graph') focusInGraph();
        });
    }

    // ── Wiring ─────────────────────────────────────────────────

    /** The five selects of the city toolbar, and what each one invalidates. */
    var CONTROLS = [
        { id: 'city-granularity', key: 'granularity', relayout: true },
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

    /** Names & ranks on or off: rebuilds the decor, keeps the plan and selection. */
    function setNames(on) {
        state.names = on !== false;
        try {
            var raw = window.localStorage.getItem(STORE_KEY);
            var saved = raw ? JSON.parse(raw) : {};
            saved.names = state.names;
            window.localStorage.setItem(STORE_KEY, JSON.stringify(saved));
        } catch (_) { /* private mode */ }
        var box = $('#city-names');
        if (box) box.checked = state.names;
        if (state.plan) buildDecor(state.plan);
    }

    function restoreOptions() {
        var raw = null;
        try { raw = window.localStorage.getItem(STORE_KEY); } catch (_) { raw = null; }
        if (raw) {
            try {
                var saved = JSON.parse(raw);
                if (saved.names === false) state.names = false;
                for (var i = 0; i < CONTROLS.length; i++) {
                    var key = CONTROLS[i].key;
                    if (typeof saved[key] !== 'string' || saved[key].length === 0) continue;
                    // A stored value may predate a mode rename: never trust it,
                    // clamp it to the live options.
                    OPTIONS[key] = normaliseOption(key, saved[key]);
                }
            } catch (_) { /* corrupt entry: keep the defaults */ }
        }
        syncControls();
        var namesBox = $('#city-names');
        if (namesBox) namesBox.checked = state.names !== false;
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
        var postcardBtn = $('#city-postcard');
        if (postcardBtn) postcardBtn.addEventListener('click', exportPostcard);
        var namesBox = $('#city-names');
        if (namesBox) {
            namesBox.addEventListener('change', function () { setNames(namesBox.checked); });
        }
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
        reveal: reveal,
        revealSymbol: revealSymbol,
        clear: clearSelection,
        scope: function () { return state.scope; },
        setScope: setScope,
        colourOf: function (id) { return colourFor({ id: id, language: '' }, state.byId[id] || { h: 0.5, district: '' }); },
        tooltip: function (nodeOrId) {
            return tooltipFor(typeof nodeOrId === 'string' ? { id: nodeOrId } : nodeOrId);
        },
        sideHtml: function () { var body = $('#city-side-body'); return body ? body.innerHTML : ''; },
        relations: function () {
            return {
                in: Object.keys(state.relations.in).length,
                out: Object.keys(state.relations.out).length,
                docs: Object.keys(state.relations.docs || {}).length,
            };
        },
        plan: function () { return state.plan; },
        scale: function () { return cityScale(); },
        kindOf: function (id) { return kindOf(state.nodeById[id]); },
        hotBand: function () { return state.hotCount; },
        rankOf: function () { return state.rankOf || {}; },
        badgeCount: function () { return state.badgeCount || 0; },
        labelCount: function () { return state.labelCount || 0; },
        names: function () { return state.names !== false; },
        setNames: function (on) { setNames(on); },
        postcard: function () { exportPostcard(); },
        options: OPTIONS,
        graph: function () { return state.graph; },
    };
})();
