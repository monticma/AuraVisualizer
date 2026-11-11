/**
 * city-minimap.js — the City's floating minimap.
 *
 * Same window as the 3D graph's (`🗺️` header, close button, draggable, position
 * remembered), but the map itself is far simpler to draw: the plan already has
 * exact rectangles, so there is nothing to project out of a simulation.
 *
 * It shows where you are, not who depends on whom: districts as blocks, the
 * selection as a dot, and the camera's footprint as a white frame. Dragging
 * inside the map pans the camera.
 */
(function () {
    'use strict';

    var POS_KEY = 'aura.city.minimap.pos.v1';
    var PAD = 10;

    var hooks = {};
    var root = null;
    var canvas = null;
    var ctx = null;
    var frame = 0;
    var dragging = false;
    var panning = false;

    function readPos() {
        try {
            var raw = window.localStorage.getItem(POS_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (_) { return null; }
    }

    function savePos(left, top) {
        try {
            window.localStorage.setItem(POS_KEY, JSON.stringify({ left: left, top: top }));
        } catch (_) { /* private mode */ }
    }

    /** World units per canvas pixel, and the centre of the plan in canvas space. */
    function projection() {
        var scale = (hooks.getScale && hooks.getScale()) || 520;
        var w = canvas.width;
        var h = canvas.height;
        var size = Math.min(w, h) - PAD * 2;
        return { k: size / scale, cx: w / 2, cy: h / 2, scale: scale };
    }

    function toPixel(p, worldX, worldZ) {
        return { x: p.cx + worldX * p.k, y: p.cy + worldZ * p.k };
    }

    function rectCentre(rect) {
        return {
            x: (rect.x + rect.w / 2 - 0.5) * ((hooks.getScale && hooks.getScale()) || 520),
            z: (rect.z + rect.d / 2 - 0.5) * ((hooks.getScale && hooks.getScale()) || 520),
        };
    }

    function draw() {
        if (!ctx || !canvas) return;
        var plan = hooks.getPlan && hooks.getPlan();
        var w = canvas.width;
        var h = canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, w, h);
        if (!plan) return;

        var p = projection();

        // Districts: the blocks of the city, not its 5 000 buildings.
        for (var i = 0; i < plan.districts.length; i++) {
            var district = plan.districts[i];
            var a = toPixel(p, (district.x - 0.5) * p.scale, (district.z - 0.5) * p.scale);
            var b = toPixel(p, (district.x + district.w - 0.5) * p.scale, (district.z + district.d - 0.5) * p.scale);
            var colour = '#546e7a';
            if (typeof window.layerColor === 'function') colour = window.layerColor(district.key);
            ctx.globalAlpha = 0.45;
            ctx.fillStyle = colour;
            ctx.fillRect(a.x, a.y, Math.max(1, b.x - a.x), Math.max(1, b.y - a.y));
            ctx.globalAlpha = 1;
        }

        // Selection.
        var selected = hooks.getSelected && hooks.getSelected();
        var byId = hooks.getRect && hooks.getRect(selected);
        if (byId) {
            var centre = rectCentre(byId);
            var dot = toPixel(p, centre.x, centre.z);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(dot.x, dot.y, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // Camera footprint, approximated on the ground plane exactly like the 3D
        // minimap does: distance × tan(fov/2).
        var graph = hooks.getGraph && hooks.getGraph();
        if (!graph) return;
        try {
            var camera = graph.camera();
            var controls = graph.controls();
            var position = camera.position;
            var target = (controls && controls.target) || { x: 0, y: 0, z: 0 };
            var dx = position.x - target.x;
            var dy = position.y - target.y;
            var dz = position.z - target.z;
            var dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || p.scale;
            var fov = camera.fov || 55;
            var aspect = camera.aspect || 1;
            var halfH = dist * Math.tan((fov * Math.PI / 180) / 2);
            var halfW = halfH * aspect;
            var c = toPixel(p, target.x, target.z);
            ctx.strokeStyle = 'rgba(255,255,255,0.75)';
            ctx.lineWidth = 1;
            ctx.strokeRect(
                c.x - halfW * p.k,
                c.y - halfH * p.k,
                Math.max(2, halfW * 2 * p.k),
                Math.max(2, halfH * 2 * p.k)
            );
        } catch (_) { /* camera not ready */ }
    }

    function loop() {
        frame = window.requestAnimationFrame(loop);
        if (!root || root.classList.contains('hidden')) return;
        draw();
    }

    function setOpen(open) {
        if (!root) return;
        root.classList.toggle('hidden', !open);
        var btn = document.getElementById('city-minimap-toggle');
        if (btn) btn.classList.toggle('active', !!open);
        if (open) draw();
    }

    function toggle() {
        if (!root) return;
        setOpen(root.classList.contains('hidden'));
    }

    // --- Camera pan from inside the map -------------------------------------
    function onCanvasDown(event) {
        panning = true;
        if (event.preventDefault) event.preventDefault();
    }

    function onCanvasMove(event) {
        if (!panning) return;
        var graph = hooks.getGraph && hooks.getGraph();
        if (!graph || !canvas) return;
        var p = projection();
        // The map is drawn with z down the canvas, so one pixel of drag is
        // -1/k world units on both axes.
        panCam(graph, -event.movementX / p.k, -event.movementY / p.k);
    }

    function panCam(graph, dx, dz) {
        try {
            var camera = graph.camera();
            var controls = graph.controls();
            var position = camera.position;
            var target = (controls && controls.target) || { x: 0, y: 0, z: 0 };
            graph.cameraPosition(
                { x: position.x + dx, y: position.y, z: position.z + dz },
                { x: target.x + dx, y: target.y, z: target.z + dz },
                0
            );
        } catch (_) { /* not ready */ }
    }

    // --- Window drag (same pattern as the warps panel) ----------------------
    function setupDrag() {
        var header = root.querySelector('.city-minimap-header');
        if (!header) return;
        var offsetX = 0;
        var offsetY = 0;
        header.addEventListener('mousedown', function (event) {
            if (event.target && event.target.tagName === 'BUTTON') return;
            dragging = true;
            var rect = root.getBoundingClientRect();
            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;
            root.style.right = 'auto';
            root.style.bottom = 'auto';
            root.style.left = rect.left + 'px';
            root.style.top = rect.top + 'px';
            if (event.preventDefault) event.preventDefault();
        });
        document.addEventListener('mousemove', function (event) {
            if (!dragging) return;
            var x = Math.max(0, Math.min(event.clientX - offsetX, window.innerWidth - 80));
            var y = Math.max(0, Math.min(event.clientY - offsetY, window.innerHeight - 60));
            root.style.left = x + 'px';
            root.style.top = y + 'px';
        });
        document.addEventListener('mouseup', function () {
            if (!dragging) return;
            dragging = false;
            var rect = root.getBoundingClientRect();
            savePos(Math.round(rect.left), Math.round(rect.top));
        });
    }

    function setup() {
        root = document.getElementById('city-minimap');
        if (!root) return;
        canvas = document.getElementById('city-minimap-canvas');
        if (canvas && typeof canvas.getContext === 'function') {
            try { ctx = canvas.getContext('2d'); } catch (_) { ctx = null; }
        }
        var pos = readPos();
        if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
            root.style.right = 'auto';
            root.style.bottom = 'auto';
            root.style.left = pos.left + 'px';
            root.style.top = pos.top + 'px';
        }
        setupDrag();
        var close = document.getElementById('city-minimap-close');
        if (close) close.addEventListener('click', function () { setOpen(false); });
        var reset = document.getElementById('city-minimap-reset');
        if (reset) {
            reset.addEventListener('click', function () {
                if (typeof hooks.onReset === 'function') hooks.onReset();
                draw();
            });
        }
        if (canvas) {
            canvas.addEventListener('mousedown', onCanvasDown);
            canvas.addEventListener('mousemove', onCanvasMove);
            document.addEventListener('mouseup', function () { panning = false; });
        }
        if (window.requestAnimationFrame) loop();
    }

    window.AuraCityMinimap = {
        init: function (injected) { hooks = injected || {}; setup(); },
        toggle: toggle,
        setOpen: setOpen,
        isOpen: function () { return !!root && !root.classList.contains('hidden'); },
        draw: draw,
    };
})();
