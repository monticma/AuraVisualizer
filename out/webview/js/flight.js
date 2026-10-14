/**
 * flight.js — Pilot mode: free-flight camera (WASD/QE + mouse look).
 *
 * Owns the whole flight UX: keyboard/mouse input, pointer lock (with a
 * drag-to-look fallback), the rAF integration loop, the HUD badge and the
 * clean handover back to TrackballControls. The math lives in
 * `window.AuraPilot` (src/flight/flight-core.ts, unit-tested).
 *
 * Mouse: under pointer lock, hold the LEFT button to fly forward and the
 * RIGHT button to fly backward — steer by simply moving the mouse; the
 * keyboard keeps working in parallel. In the drag-to-look fallback, the
 * left button keeps its "look" role and only the right button reels back.
 *
 * Design notes (see docs/Ideas/PilotMode.md):
 * - entry/exit through the 🚀 toolbar button only — single-letter shortcuts
 *   are suspended while flying (`D` is bound to the DAG toggle);
 * - ESC exits: under pointer lock the browser releases the lock (first ESC =
 *   leave the flight), then Aura's global ESC reset is available again;
 * - on exit the orbit target is re-aimed (`target = position + forward ×
 *   radius`) and `camera.up` is reset to world-up, so the next
 *   TrackballControls lookAt() reproduces the flight orientation exactly —
 *   no visual snap.
 *
 * Keys are matched on `e.code` (physical position): QWERTY users get WASD,
 * AZERTY users automatically get ZQSD — same physical layout, like games do.
 */
(function () {
    'use strict';

    var core = window.AuraPilot;
    if (!core) {
        console.error('[aura] flight.js: window.AuraPilot (flight-core) not loaded');
        return;
    }

    var active = false;
    var graph = null;
    var container = null;
    var controls = null;
    var camera = null;
    var prevControlsEnabled = true;
    var orbitRadius = 200;

    var yaw = 0, pitch = 0;
    var velocity = { x: 0, y: 0, z: 0 };
    var keys = Object.create(null);
    var mouseHeld = { forward: false, backward: false }; // pointer-lock fly buttons
    var speedMult = 1;
    var scale = core.MIN_SCENE_SCALE;

    var cfg = {
        flightSpeed: core.DEFAULT_FLIGHT_SPEED,
        flightSmoothing: core.DEFAULT_SMOOTHING,
        mouseSensitivity: core.DEFAULT_MOUSE_SENSITIVITY,
        invertY: false
    };

    var pointerLocked = false;
    var dragLook = false;
    var dragging = false;
    var lastX = 0, lastY = 0;

    var rafId = 0;
    var lastTime = 0;
    var listenersOn = false;

    var MOVE_CODES = { KeyW: true, KeyA: true, KeyS: true, KeyD: true, KeyQ: true, KeyE: true, ShiftLeft: true, ShiftRight: true };

    function clampNum(value, fallback, min, max) {
        return (typeof value === 'number' && isFinite(value)) ? Math.min(max, Math.max(min, value)) : fallback;
    }

    /** Read the auraVisualizer.* flight settings (called on entry + on graphConfig). */
    function configure(config) {
        if (!config) return;
        cfg.flightSpeed = clampNum(config.flightSpeed, core.DEFAULT_FLIGHT_SPEED, 0.25, 4);
        cfg.flightSmoothing = clampNum(config.flightSmoothing, core.DEFAULT_SMOOTHING, 0.02, 0.5);
        cfg.mouseSensitivity = clampNum(config.mouseSensitivity, core.DEFAULT_MOUSE_SENSITIVITY, 0.0005, 0.01);
        cfg.invertY = config.invertY === true;
    }

    function isActive() { return active; }

    function updateHud() {
        var el = document.getElementById('pilot-speed-mult');
        if (el) el.textContent = '×' + (Math.round(speedMult * 100) / 100);
    }

    function setHudVisible(visible) {
        var hud = document.getElementById('pilot-hud');
        if (hud) hud.classList.toggle('hidden', !visible);
    }

    function setButtonActive(on) {
        var btn = document.getElementById('btn-pilot');
        if (btn) btn.classList.toggle('active', on);
    }

    // ============================================================
    // Input handlers
    // ============================================================

    function inTextField(e) {
        var tag = e.target && e.target.tagName;
        return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    }

    function onKeyDown(e) {
        if (!active || inTextField(e)) return;
        if (e.key === 'Escape') {
            // Under pointer lock the browser releases the lock on ESC
            // (pointerlockchange → stop). In drag-to-look mode, handle it here —
            // stopPropagation so Aura's global ESC reset doesn't also fire.
            if (!pointerLocked) {
                e.preventDefault();
                e.stopPropagation();
                stop();
            }
            return;
        }
        if (e.code === 'Space') {
            // Space toggles back out — swallow the event so it can never
            // re-activate a focused toolbar button.
            e.preventDefault();
            e.stopPropagation();
            stop();
            return;
        }
        if (MOVE_CODES[e.code]) {
            keys[e.code] = true;
            e.preventDefault();
        }
    }

    function onKeyUp(e) {
        if (!active || inTextField(e)) return;
        if (MOVE_CODES[e.code]) {
            keys[e.code] = false;
            e.preventDefault();
        }
    }

    function onMouseMove(e) {
        if (!active) return;
        var dx, dy;
        if (pointerLocked) {
            dx = e.movementX || 0;
            dy = e.movementY || 0;
        } else if (dragLook && dragging) {
            dx = e.clientX - lastX;
            dy = e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
        } else {
            return;
        }
        var yp = core.applyMouseDelta(yaw, pitch, dx, dy, cfg.mouseSensitivity, cfg.invertY);
        yaw = yp.yaw;
        pitch = yp.pitch;
    }

    function onMouseDown(e) {
        if (!active) return;
        // Pointer lock: hold LMB = fly forward, RMB = fly backward (steer by
        // moving the mouse while holding — keys stay available in parallel).
        if (e.button === 0 && pointerLocked) {
            mouseHeld.forward = true;
            e.preventDefault();
            return;
        }
        if (e.button === 2) {
            mouseHeld.backward = true;
            e.preventDefault();
            return;
        }
        // Drag-to-look fallback: the left button keeps its "look" role.
        if (!dragLook || e.button !== 0) return;
        dragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        e.preventDefault();
    }

    function onMouseUp(e) {
        if (e.button === 0) { mouseHeld.forward = false; dragging = false; }
        if (e.button === 2) { mouseHeld.backward = false; }
    }

    function onContextMenu(e) {
        if (!active) return; // right button is "fly backward" — no context menu
        e.preventDefault();
        e.stopPropagation();
    }

    function onPointerLockChange() {
        if (!active) return;
        if (document.pointerLockElement === container) {
            pointerLocked = true;
        } else if (pointerLocked) {
            // Lock released (ESC, focus loss, …) — leave the flight.
            stop();
        }
    }

    function onPointerLockError() {
        if (active && !pointerLocked) dragLook = true; // fallback
    }

    function onWheel(e) {
        if (!active) return;
        e.preventDefault();
        speedMult = core.adjustSpeedMult(speedMult, e.deltaY < 0 ? 1 : -1);
        updateHud();
    }

    function onBlur() {
        keys = Object.create(null); // drop held keys — no sticky flight
        mouseHeld.forward = false;
        mouseHeld.backward = false;
    }

    function addListeners() {
        if (listenersOn || !container) return;
        listenersOn = true;
        document.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('keyup', onKeyUp, true);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('pointerlockchange', onPointerLockChange);
        document.addEventListener('pointerlockerror', onPointerLockError);
        document.addEventListener('contextmenu', onContextMenu, true);
        window.addEventListener('blur', onBlur);
        container.addEventListener('mousedown', onMouseDown);
        container.addEventListener('wheel', onWheel, { passive: false });
    }

    function removeListeners() {
        if (!listenersOn || !container) return;
        listenersOn = false;
        document.removeEventListener('keydown', onKeyDown, true);
        document.removeEventListener('keyup', onKeyUp, true);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('pointerlockchange', onPointerLockChange);
        document.removeEventListener('pointerlockerror', onPointerLockError);
        document.removeEventListener('contextmenu', onContextMenu, true);
        window.removeEventListener('blur', onBlur);
        container.removeEventListener('mousedown', onMouseDown);
        container.removeEventListener('wheel', onWheel);
    }

    // ============================================================
    // Frame loop
    // ============================================================

    function frame(now) {
        if (!active) return;
        var dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        // Orientation — yaw/pitch around world-up, rebuilt every frame (no roll).
        var q = core.yawPitchQuaternion(yaw, pitch);
        camera.quaternion.set(q.x, q.y, q.z, q.w);

        // Movement — camera-relative WASD, world-axis Q/E, exponential smoothing.
        var input = core.inputVector({
            forward: keys.KeyW || mouseHeld.forward,
            back: keys.KeyS || mouseHeld.backward,
            left: keys.KeyA, right: keys.KeyD,
            up: keys.KeyE, down: keys.KeyQ
        });
        var boost = keys.ShiftLeft || keys.ShiftRight;
        var speed = core.baseSpeed(scale, cfg.flightSpeed) * speedMult * (boost ? core.BOOST_MULT : 1);
        var dir = core.moveDirection(input, q);
        velocity = core.approachVec3(velocity, { x: dir.x * speed, y: dir.y * speed, z: dir.z * speed }, cfg.flightSmoothing, dt);

        camera.position.set(
            camera.position.x + velocity.x * dt,
            camera.position.y + velocity.y * dt,
            camera.position.z + velocity.z * dt
        );

        rafId = requestAnimationFrame(frame);
    }

    // ============================================================
    // Lifecycle
    // ============================================================

    function start(g, el) {
        if (active || !g || !el) return;
        var T = window.THREE;
        if (!T) return;

        graph = g;
        container = el;
        try { controls = graph.controls(); } catch (e) { controls = null; }
        camera = graph.camera ? graph.camera() : null;
        if (!camera) return;

        active = true;
        keys = Object.create(null);
        mouseHeld.forward = false;
        mouseHeld.backward = false;
        velocity = { x: 0, y: 0, z: 0 };
        speedMult = 1;
        pointerLocked = false;
        dragLook = false;
        dragging = false;

        // Entry orientation: unroll the current orbital view onto world-up yaw/pitch.
        var forward = new T.Vector3();
        camera.getWorldDirection(forward);
        var yp = core.yawPitchFromDirection(forward.x, forward.y, forward.z);
        yaw = yp.yaw;
        pitch = yp.pitch;

        orbitRadius = (controls && controls.target)
            ? (camera.position.distanceTo(controls.target) || 200)
            : 200;
        prevControlsEnabled = controls ? !!controls.enabled : false;
        if (controls) controls.enabled = false;

        scale = core.sceneScale(graph.graphData().nodes);
        configure(window.AURA_CONFIG || {});

        addListeners();
        setHudVisible(true);
        setButtonActive(true);
        updateHud();

        // Pointer lock — allowed in the webview sandbox (user gesture: the
        // toolbar click). If it fails, fall back to drag-to-look.
        try {
            var req = container.requestPointerLock();
            if (req && typeof req.catch === 'function') {
                req.catch(function () { if (active && !pointerLocked) dragLook = true; });
            }
        } catch (e) {
            dragLook = true;
        }

        lastTime = performance.now();
        rafId = requestAnimationFrame(frame);
    }

    function stop() {
        if (!active) return;
        active = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        removeListeners();
        keys = Object.create(null);
        mouseHeld.forward = false;
        mouseHeld.backward = false;
        velocity = { x: 0, y: 0, z: 0 };
        dragging = false;

        if (pointerLocked && document.exitPointerLock) {
            try { document.exitPointerLock(); } catch (e) { /* noop */ }
        }
        pointerLocked = false;

        // Hand back to TrackballControls without a visual snap: re-aim the
        // orbit target ahead of the camera and restore world-up, so its next
        // lookAt() reproduces the flight orientation exactly.
        var T = window.THREE;
        if (camera && controls && T) {
            var forward = new T.Vector3();
            camera.getWorldDirection(forward);
            controls.target.set(
                camera.position.x + forward.x * orbitRadius,
                camera.position.y + forward.y * orbitRadius,
                camera.position.z + forward.z * orbitRadius
            );
            controls.enabled = prevControlsEnabled;
        }
        if (camera) camera.up.set(0, 1, 0);

        setHudVisible(false);
        setButtonActive(false);
    }

    function toggle(g, el) {
        if (active) stop();
        else start(g, el);
    }

    // Pick up the settings snapshot embedded in the HTML; graphConfig
    // messages keep it fresh while the panel lives.
    configure(window.AURA_CONFIG || {});

    window.AuraFlight = {
        configure: configure,
        start: start,
        stop: stop,
        toggle: toggle,
        isActive: isActive
    };
})();
