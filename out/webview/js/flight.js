/**
 * flight.js — Pilot mode: free-flight camera (keyboard, mouse and gamepad).
 *
 * Owns the whole flight UX: keyboard/mouse/gamepad input, pointer lock (with a
 * drag-to-look fallback), the rAF integration loop, the HUD badge and the
 * clean handover back to TrackballControls. The math lives in
 * `window.AuraPilot` (src/flight/flight-core.ts, unit-tested).
 *
 * Mouse: under pointer lock, hold the LEFT button to fly forward and the
 * RIGHT button to fly backward — steer by simply moving the mouse; the
 * keyboard keeps working in parallel. In the drag-to-look fallback, the
 * left button keeps its "look" role and only the right button reels back.
 *
 * Gamepad (W3C standard mapping — DualSense, Xbox…): left stick translates,
 * right stick looks, L2 descends, R2 boosts (analog), ✕ resets the camera,
 * touchpad re-aims at the graph centre, ○ leaves the flight, Options resets
 * the speed, d-pad up/down change the speed. `navigator.getGamepads()` is
 * poll-based and returns nulls until a button is pressed once with the window
 * focused — the polling loop keeps trying, so the pad simply appears after the
 * first press. The pad is ignored when `auraVisualizer.gamepadEnabled` is off.
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
        invertY: false,
        gamepadEnabled: true,
        padLookScale: 1
    };

    // Gamepad state (polled every frame — the API has no motion events)
    var pad = null;
    var padPrevButtons = [];
    var padHudLabel = '';

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
        cfg.gamepadEnabled = config.gamepadEnabled !== false;
        // One slider drives both looks: the stick rate follows the mouse sensitivity.
        cfg.padLookScale = cfg.mouseSensitivity / core.DEFAULT_MOUSE_SENSITIVITY;
        if (!cfg.gamepadEnabled) {
            pad = null;
            padPrevButtons = [];
            updatePadHud(null);
        }
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

    function onGamepadConnected(e) {
        if (!active || !cfg.gamepadEnabled) return;
        pad = (e && e.gamepad) || pad;
        padPrevButtons = [];
        updatePadHud(core.readPadState(pad, cfg.invertY));
    }

    function onGamepadDisconnected() {
        if (!active) return;
        pad = null;
        padPrevButtons = [];
        updatePadHud(null);
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
        window.addEventListener('gamepadconnected', onGamepadConnected);
        window.addEventListener('gamepaddisconnected', onGamepadDisconnected);
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
        window.removeEventListener('gamepadconnected', onGamepadConnected);
        window.removeEventListener('gamepaddisconnected', onGamepadDisconnected);
        container.removeEventListener('mousedown', onMouseDown);
        container.removeEventListener('wheel', onWheel);
    }

    // ============================================================
    // Gamepad
    // ============================================================

    /** First connected pad, or null. `getGamepads()` is poll-based by design. */
    function pollPad() {
        if (!cfg.gamepadEnabled) return null;
        if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null;
        var pads;
        try { pads = navigator.getGamepads(); } catch (e) { return null; }
        if (!pads) return null;
        for (var i = 0; i < pads.length; i++) {
            var candidate = pads[i];
            if (candidate && candidate.connected !== false) return candidate;
        }
        return null;
    }

    /** HUD chip: "🎮 DualSense Wireless Controller" while a pad is live. */
    function updatePadHud(state) {
        var el = document.getElementById('pilot-pad');
        if (!el) return;
        var label = state
            ? '🎮 ' + String(state.id || 'gamepad')
                .replace(/\s*\(.*?\)\s*/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
            : '';
        if (label === padHudLabel) return; // called every frame — avoid DOM churn
        padHudLabel = label;
        el.textContent = label;
        el.classList.toggle('hidden', !label);
    }

    /** Centre of the laid-out graph (average of node positions), or null. */
    function graphCenter() {
        var nodes = (graph && graph.graphData ? graph.graphData().nodes : null) || [];
        var count = 0, cx = 0, cy = 0, cz = 0;
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes[i];
            if (typeof node.x !== 'number' || typeof node.y !== 'number' || typeof node.z !== 'number') continue;
            cx += node.x; cy += node.y; cz += node.z; count++;
        }
        if (!count) return null;
        return { x: cx / count, y: cy / count, z: cz / count };
    }

    /** ✕ — teleport back to an overview framing of the whole graph, still flying. */
    function resetCamera() {
        var centre = graphCenter();
        if (!centre) return;
        scale = core.sceneScale((graph.graphData ? graph.graphData().nodes : null) || []);
        var distance = Math.max(core.MIN_SCENE_SCALE, scale) * 1.5;
        camera.position.set(centre.x, centre.y, centre.z + distance);
        yaw = 0;
        pitch = 0;
        velocity = { x: 0, y: 0, z: 0 };
        orbitRadius = distance; // keeps the orbit hand-over sane after a reset
    }

    /** Touchpad — re-aim at the graph centre without moving. */
    function recenterLook() {
        var centre = graphCenter();
        if (!centre) return;
        var yp = core.yawPitchFromDirection(
            centre.x - camera.position.x,
            centre.y - camera.position.y,
            centre.z - camera.position.z
        );
        yaw = yp.yaw;
        pitch = yp.pitch;
        velocity = { x: 0, y: 0, z: 0 };
    }

    /**
     * Edge-triggered pad buttons. Returns true when the flight was left
     * (the caller must stop scheduling frames).
     */
    function handlePadButtons(state) {
        if (!state) return false;
        var now = state.buttons || [];
        var prev = padPrevButtons || [];
        var pressed = function (index) { return now[index] === true && prev[index] !== true; };

        if (pressed(core.PAD_BUTTON.cross)) resetCamera();
        if (pressed(core.PAD_BUTTON.touchpad)) recenterLook();
        if (pressed(core.PAD_BUTTON.options)) { speedMult = 1; updateHud(); }
        if (pressed(core.PAD_BUTTON.up)) { speedMult = core.adjustSpeedMult(speedMult, 1); updateHud(); }
        if (pressed(core.PAD_BUTTON.down)) { speedMult = core.adjustSpeedMult(speedMult, -1); updateHud(); }

        padPrevButtons = now.slice();
        if (pressed(core.PAD_BUTTON.circle)) { stop(); return true; }
        return false;
    }

    // ============================================================
    // Frame loop
    // ============================================================

    function frame(now) {
        if (!active) return;
        var dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        // Gamepad — polled every frame (the API has no motion events). The
        // first frame after a pad wakes up has no previous state, so button
        // edges start clean.
        var livePad = pollPad();
        var padState = null;
        if (livePad) {
            if (livePad !== pad) { pad = livePad; padPrevButtons = []; }
            padState = core.readPadState(livePad, cfg.invertY);
            updatePadHud(padState);
            if (handlePadButtons(padState)) return; // ○ left the flight
        } else if (pad) {
            pad = null;
            padPrevButtons = [];
            updatePadHud(null);
        }

        // Look — right stick rates (dt-scaled) on top of the mouse deltas.
        if (padState) {
            var look = core.applyStickLook(yaw, pitch, padState, dt, cfg.padLookScale);
            yaw = look.yaw;
            pitch = look.pitch;
        }

        // Orientation — yaw/pitch around world-up, rebuilt every frame (no roll).
        var q = core.yawPitchQuaternion(yaw, pitch);
        camera.quaternion.set(q.x, q.y, q.z, q.w);

        // Movement — camera-relative WASD / left stick, world-axis Q/E / L2,
        // exponential smoothing. Both sources may be active at once.
        var keyInput = core.inputVector({
            forward: keys.KeyW || mouseHeld.forward,
            back: keys.KeyS || mouseHeld.backward,
            left: keys.KeyA, right: keys.KeyD,
            up: keys.KeyE, down: keys.KeyQ
        });
        var padInput = padState
            ? { forward: padState.forward, strafe: padState.strafe, vertical: -padState.descend }
            : { forward: 0, strafe: 0, vertical: 0 };
        var input = core.combineInput(keyInput, padInput);
        var boost = core.boostFactor(!!(keys.ShiftLeft || keys.ShiftRight), padState ? padState.boost : 0);
        var speed = core.baseSpeed(scale, cfg.flightSpeed) * speedMult * boost;
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
        pad = null;
        padPrevButtons = [];

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
        pad = null;
        padPrevButtons = [];
        padHudLabel = '';
        var padEl = document.getElementById('pilot-pad');
        if (padEl) { padEl.textContent = ''; padEl.classList.add('hidden'); }

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
