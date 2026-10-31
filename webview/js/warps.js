/**
 * warps.js — Warp points: named camera bookmarks (.aura/warps.json).
 *
 * Extracted from app.js (refactor/app-split). The floating panel and the
 * capture/edit modal live here — and so does the camera flight
 * (travelToPose / travelToWarp / cancelTravel): the quick-slot shortcut and
 * the minimap hand off to AuraWarps through its public surface. Live app
 * state (graph instance, warps list) comes in through hooks injected by
 * app.js in init().
 */
(function() {
    'use strict';

    var hooks = {};

    // Mirrors refreshed from hooks at every entry point (see syncCtx).
    var graph = null;
    var warps = [];
    var warpEditId = null;     // warp modal: null = capturing a new warp, else the edited warp id

    var $ = function(sel) { return document.querySelector(sel); };

    function syncCtx() {
        if (!hooks.getGraph) return;
        graph = hooks.getGraph();
        warps = hooks.getWarps() || [];
    }

    // ============================================================
    // Warp points (camera bookmarks) — .aura/warps.json
    // ============================================================

    var WARP_ANCHOR_RADIUS = 120; // ≈ the focus-flight distance used by node clicks

    /** Bounding radius of the laid-out graph around its centroid (0 when unpositioned). */
    function graphRadius() {
        if (!hooks.getGraphData) return 0;
        var data = hooks.getGraphData();
        if (!data || !data.nodes) return 0;
        var sx = 0, sy = 0, sz = 0, n = 0;
        for (var i = 0; i < data.nodes.length; i++) {
            var nd = data.nodes[i];
            if (typeof nd.x !== 'number' || typeof nd.y !== 'number' || typeof nd.z !== 'number') continue;
            sx += nd.x; sy += nd.y; sz += nd.z; n++;
        }
        if (n === 0) return 0;
        var cx = sx / n, cy = sy / n, cz = sz / n;
        var maxD2 = 0;
        for (var j = 0; j < data.nodes.length; j++) {
            var m = data.nodes[j];
            if (typeof m.x !== 'number' || typeof m.y !== 'number' || typeof m.z !== 'number') continue;
            var dx = m.x - cx, dy = m.y - cy, dz = m.z - cz;
            var d2 = dx * dx + dy * dy + dz * dz;
            if (d2 > maxD2) maxD2 = d2;
        }
        return Math.sqrt(maxD2);
    }

    /**
     * Nearest graph node to the looked-at point, as an anchor: a warp stores
     * camera offsets RELATIVE to that node, not absolute coordinates. The
     * force layout places nodes differently on every session, so absolute
     * poses stop matching after a restart.
     */
    function findAnchorForPose(pos, target) {
        if (!hooks.getGraphData) return null;
        var data = hooks.getGraphData();
        if (!data || !data.nodes) return null;
        var best = null;
        var bestD2 = Infinity;
        for (var i = 0; i < data.nodes.length; i++) {
            var n = data.nodes[i];
            if (typeof n.x !== 'number' || typeof n.y !== 'number' || typeof n.z !== 'number') continue;
            var dx = target.x - n.x;
            var dy = target.y - n.y;
            var dz = target.z - n.z;
            var d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < bestD2) { bestD2 = d2; best = n; }
        }
        if (!best || bestD2 > WARP_ANCHOR_RADIUS * WARP_ANCHOR_RADIUS) return null;
        var anchor = {
            id: best.id,
            pos: { x: best.x, y: best.y, z: best.z },
            posOffset: { x: pos.x - best.x, y: pos.y - best.y, z: pos.z - best.z },
            targetOffset: { x: target.x - best.x, y: target.y - best.y, z: target.z - best.z }
        };
        // Remember the layout extent: offsets are rescaled against the CURRENT
        // extent when travelling (the force layout is more or less spread out
        // from session to session, which changed the framing distance).
        var radius = graphRadius();
        if (radius > 0) anchor.scaleRef = radius;
        return anchor;
    }

    /**
     * Rebuild the stored pose against the anchor node's CURRENT position.
     * Falls back to the absolute pose when the node is gone (deleted file)
     * or when the warp predates anchoring.
     */
    function resolveWarpPose(warp) {
        if (!warp) return null;
        var pos = warp.pos;
        var target = warp.target;
        var a = warp.anchor;
        if (a && a.id && a.posOffset && a.targetOffset && hooks.findNode) {
            var node = hooks.findNode(a.id);
            if (node && typeof node.x === 'number' && typeof node.y === 'number' && typeof node.z === 'number') {
                // Rescale to the current layout extent so the framing distance
                // matches what was captured (clamped to a sane 0.25..4 range).
                var k = 1;
                if (typeof a.scaleRef === 'number' && a.scaleRef > 0) {
                    var now = graphRadius();
                    if (now > 0) k = Math.min(4, Math.max(0.25, now / a.scaleRef));
                }
                pos = { x: node.x + a.posOffset.x * k, y: node.y + a.posOffset.y * k, z: node.z + a.posOffset.z * k };
                target = { x: node.x + a.targetOffset.x * k, y: node.y + a.targetOffset.y * k, z: node.z + a.targetOffset.z * k };
            }
        }
        return { pos: pos, target: target };
    }
    /** Current camera pose: position, orbit target and FOV. */
    function captureWarpPose() {
        syncCtx();
        if (!graph) return null;
        var cam = graph.camera();
        var ctrl = null;
        try { ctrl = graph.controls(); } catch (e) { ctrl = null; }
        var target = (ctrl && ctrl.target) || { x: 0, y: 0, z: 0 };
        var pose = {
            pos: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
            target: { x: target.x, y: target.y, z: target.z },
            quat: { x: cam.quaternion.x, y: cam.quaternion.y, z: cam.quaternion.z, w: cam.quaternion.w },
            up: { x: cam.up.x, y: cam.up.y, z: cam.up.z },
            fov: cam.fov
        };
        // Anchor to the nearest node so the warp survives a rebuilt layout.
        var anchor = findAnchorForPose(pose.pos, pose.target);
        if (anchor) pose.anchor = anchor;
        return pose;
    }

    var warpTravel = null;     // active camera flight — { cancel() }

    /** Interrupt an in-flight camera flight, leaving the camera where it is. */
    function cancelWarpTravel() {
        if (warpTravel) {
            warpTravel.cancel();
            warpTravel = null;
        }
    }

    /** Ease in-out cubic — smooth start and end for camera flights. */
    function easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /**
     * Smooth flight to a stored pose (~800 ms).
     *
     * Position and orbit target are lerped, and the camera quaternion is
     * slerped during the flight. Critically, the camera `up` vector is
     * interpolated too: TrackballControls re-applies lookAt(target) on every
     * frame (once re-enabled) using `up`, so the roll of the captured view
     * lives there — the slerped quaternion alone was silently overwritten the
     * frame the flight ended, snapping the view back to a rotated pose.
     * Warps with neither up nor quaternion (legacy) keep the old behaviour.
     */
    function travelToPose(pos, target, quat, up, fov) {
        syncCtx();
        if (!graph || !pos || !target) return;
        var cam = graph.camera();
        var T = window.THREE;
        if (!cam || !T) return;

        cancelWarpTravel();

        var ctrl = null;
        try { ctrl = graph.controls(); } catch (e) { ctrl = null; }

        var fromPos = cam.position.clone();
        var fromTarget = (ctrl && ctrl.target) ? ctrl.target.clone() : fromPos.clone();
        var fromQuat = cam.quaternion.clone();
        var fromUp = cam.up.clone();
        var fromFov = cam.fov || 0;
        var toPos = new T.Vector3(pos.x, pos.y, pos.z);
        var toTarget = new T.Vector3(target.x, target.y, target.z);
        var toQuat = quat ? new T.Quaternion(quat.x, quat.y, quat.z, quat.w).normalize() : null;
        // Orientation target: prefer the stored up vector; rebuild it from the
        // quaternion when absent (up = quat × world-up reproduces the exact
        // lookAt orientation of the capture).
        var toUp = null;
        if (up && isFinite(up.x) && isFinite(up.y) && isFinite(up.z)) {
            toUp = new T.Vector3(up.x, up.y, up.z);
            if (toUp.lengthSq() <= 1e-12) toUp = null;
            else toUp.normalize();
        }
        if (!toUp && toQuat) {
            toUp = new T.Vector3(0, 1, 0).applyQuaternion(toQuat);
        }
        var toFov = (typeof fov === 'number' && isFinite(fov)) ? fov : fromFov;
        var controlsWereEnabled = ctrl ? !!ctrl.enabled : false;
        if (ctrl) ctrl.enabled = false; // freeze user input during the flight

        // Any click during the flight hands control back to the user.
        var interacted = function () { cancelWarpTravel(); };
        document.addEventListener('mousedown', interacted, true);

        var start = performance.now();
        var DURATION = 800;
        var rafId = 0;
        var cancelled = false;

        warpTravel = {
            cancel: function () {
                cancelled = true;
                if (rafId) cancelAnimationFrame(rafId);
                document.removeEventListener('mousedown', interacted, true);
                if (ctrl) ctrl.enabled = controlsWereEnabled;
            }
        };

        function step(now) {
            if (cancelled) return;
            var t = Math.min(1, (now - start) / DURATION);
            var k = easeInOutCubic(t);

            cam.position.lerpVectors(fromPos, toPos, k);
            if (ctrl) ctrl.target.lerpVectors(fromTarget, toTarget, k);

            if (toQuat) {
                if (typeof cam.quaternion.slerpQuaternions === 'function') {
                    cam.quaternion.slerpQuaternions(fromQuat, toQuat, k);
                } else {
                    cam.quaternion.copy(fromQuat).slerp(toQuat, k);
                }
            } else {
                cam.lookAt(ctrl ? ctrl.target : toTarget); // legacy warp without quaternion
            }

            if (toUp) {
                cam.up.lerpVectors(fromUp, toUp, k);
                if (cam.up.lengthSq() < 1e-8) cam.up.copy(toUp); // guard near-zero lerp
                cam.up.normalize();
            }

            if (toFov !== fromFov) {
                cam.fov = fromFov + (toFov - fromFov) * k;
                cam.updateProjectionMatrix();
            }

            if (t < 1) {
                rafId = requestAnimationFrame(step);
            } else {
                cancelWarpTravel(); // done — controls resume with the exact pose
            }
        }
        rafId = requestAnimationFrame(step);
    }

    function travelToWarp(warp) {
        if (!warp) return;
        // Hand the camera back cleanly before the flight takes over.
        if (window.AuraFlight && window.AuraFlight.isActive()) window.AuraFlight.stop();
        var resolved = resolveWarpPose(warp);
        travelToPose(resolved.pos, resolved.target, warp.quat, warp.up, warp.fov);
    }

    function findWarp(id) {
        for (var i = 0; i < warps.length; i++) {
            if (warps[i].id === id) return warps[i];
        }
        return null;
    }

    function postWarp(warpInput) {
        try { hooks.postMessage({ type: 'saveWarp', payload: { warp: warpInput } }); } catch (_) { /* noop */ }
    }

    function renderWarpsPanel() {
        syncCtx();
        var list = $('#warps-list');
        if (!list) return;
        list.innerHTML = '';

        // Home row — the default fit-to-view pose, always available.
        var home = document.createElement('div');
        home.className = 'warp-row warp-home';
        home.title = 'Back to the default fit-to-view pose';
        var homeName = document.createElement('span');
        homeName.className = 'warp-name';
        homeName.textContent = '🏠 Home — overview';
        home.appendChild(homeName);
        home.addEventListener('click', function () {
            var btn = $('#btn-recenter');
            if (btn) btn.click();
        });
        list.appendChild(home);

        if (!warps.length) {
            var empty = document.createElement('div');
            empty.className = 'warps-empty';
            empty.textContent = 'No warps yet — travel somewhere, then press the 📌 button above.';
            list.appendChild(empty);
            return;
        }

        for (var i = 0; i < warps.length; i++) {
            list.appendChild(buildWarpRow(warps[i]));
        }
    }

    function buildWarpRow(warp) {
        var row = document.createElement('div');
        row.className = 'warp-row';

        var main = document.createElement('div');
        main.className = 'warp-main';
        main.title = 'Fly to this warp';
        main.addEventListener('click', function () { travelToWarp(warp); });

        if (warp.quickSlot) {
            var slot = document.createElement('span');
            slot.className = 'warp-slot';
            slot.textContent = 'Alt+Shift+' + warp.quickSlot;
            main.appendChild(slot);
        }
        var name = document.createElement('span');
        name.className = 'warp-name';
        name.textContent = warp.name;
        main.appendChild(name);
        row.appendChild(main);

        var actions = document.createElement('div');
        actions.className = 'warp-actions';

        var editBtn = document.createElement('button');
        editBtn.textContent = '✏️';
        editBtn.title = 'Rename / change quick slot';
        editBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            showWarpModal(warp);
        });
        actions.appendChild(editBtn);

        var recaptureBtn = document.createElement('button');
        recaptureBtn.textContent = '📌';
        recaptureBtn.title = 'Overwrite with the current camera pose';
        recaptureBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            var pose = captureWarpPose();
            if (!pose) return;
            postWarp({
                id: warp.id, createdAt: warp.createdAt, name: warp.name,
                quickSlot: warp.quickSlot || null,
                pos: pose.pos, target: pose.target, quat: pose.quat, up: pose.up, fov: pose.fov,
                anchor: pose.anchor || null
            });
        });
        actions.appendChild(recaptureBtn);

        var delBtn = document.createElement('button');
        delBtn.textContent = '🗑️';
        delBtn.title = 'Delete this warp';
        delBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            try { hooks.postMessage({ type: 'deleteWarp', payload: { id: warp.id } }); } catch (_) { /* noop */ }
        });
        actions.appendChild(delBtn);

        row.appendChild(actions);
        return row;
    }

    /** Suggested name for a new capture — first unused "Warp N". */
    function nextWarpNameSuggestion() {
        var used = {};
        for (var i = 0; i < warps.length; i++) used[warps[i].name] = true;
        for (var n = 1; n <= 999; n++) {
            if (!used['Warp ' + n]) return 'Warp ' + n;
        }
        return 'Warp';
    }

    /** Open the capture / edit modal — pass a warp to edit, none to capture. */
    function showWarpModal(warp) {
        syncCtx();
        var modal = $('#warp-modal');
        var input = $('#warp-name-input');
        var slotSel = $('#warp-slot-select');
        var title = $('#warp-modal-title');
        if (!modal || !input || !slotSel) return;
        warpEditId = warp ? warp.id : null;
        if (title) title.textContent = warp ? '✏️ Edit Warp' : '📌 New Warp';
        input.value = warp ? warp.name : nextWarpNameSuggestion();
        slotSel.value = warp && warp.quickSlot ? String(warp.quickSlot) : '';
        modal.classList.remove('hidden');
        setTimeout(function () { try { input.focus(); input.select(); } catch (_) { /* noop */ } }, 0);
    }

    function hideWarpModal() {
        var modal = $('#warp-modal');
        if (modal) modal.classList.add('hidden');
        warpEditId = null;
    }

    function saveWarpFromModal() {
        var input = $('#warp-name-input');
        var slotSel = $('#warp-slot-select');
        if (!input || !slotSel) return;
        var name = input.value || '';
        var slot = slotSel.value ? parseInt(slotSel.value, 10) : null;

        var existing = warpEditId ? findWarp(warpEditId) : null;
        if (existing) {
            // Rename / quick-slot change — keep the stored pose and anchor.
            postWarp({
                id: existing.id, createdAt: existing.createdAt, name: name,
                quickSlot: slot || null,
                pos: existing.pos, target: existing.target, quat: existing.quat, up: existing.up, fov: existing.fov,
                anchor: existing.anchor || null
            });
        } else {
            var pose = captureWarpPose();
            if (!pose) return;
            postWarp({ name: name, quickSlot: slot || null, pos: pose.pos, target: pose.target, quat: pose.quat, up: pose.up, fov: pose.fov, anchor: pose.anchor || null });
        }
        hideWarpModal();
    }

    function setWarpsPanelVisible(visible) {
        var panel = $('#warps-panel');
        var btn = $('#btn-warps-panel');
        if (!panel) return;
        panel.classList.toggle('hidden', !visible);
        if (btn) btn.classList.toggle('active', !!visible);
        if (visible) renderWarpsPanel();
        hooks.saveViewState(); // open/closed state persists across sessions
    }

    function toggleWarpsPanel() {
        var panel = $('#warps-panel');
        if (!panel) return;
        setWarpsPanelVisible(panel.classList.contains('hidden'));
    }

    function setupWarps() {
        var panelBtn = $('#btn-warps-panel');
        if (panelBtn) panelBtn.addEventListener('click', function () { toggleWarpsPanel(); });

        var closeBtn = $('#warps-panel-close');
        if (closeBtn) closeBtn.addEventListener('click', function () { setWarpsPanelVisible(false); });

        var captureBtn = $('#warps-capture');
        if (captureBtn) captureBtn.addEventListener('click', function () { showWarpModal(null); });

        var modal = $('#warp-modal');
        var modalClose = $('#warp-modal-close');
        var saveBtn = $('#warp-save');
        var cancelBtn = $('#warp-cancel');
        modalClose && modalClose.addEventListener('click', hideWarpModal);
        cancelBtn && cancelBtn.addEventListener('click', hideWarpModal);
        saveBtn && saveBtn.addEventListener('click', saveWarpFromModal);

        var nameInput = $('#warp-name-input');
        if (nameInput) {
            nameInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); saveWarpFromModal(); }
                else if (e.key === 'Escape') { e.preventDefault(); hideWarpModal(); }
            });
        }

        // Modal drag — same pattern as the saved-queries modal.
        if (modal) {
            var header = modal.querySelector('.warp-modal-header');
            if (header) {
                var dragging = false, ox = 0, oy = 0;
                header.addEventListener('mousedown', function (e) {
                    if (e.target.tagName === 'BUTTON') return;
                    dragging = true;
                    var rect = modal.getBoundingClientRect();
                    ox = e.clientX - rect.left;
                    oy = e.clientY - rect.top;
                    modal.style.left = rect.left + 'px';
                    modal.style.top = rect.top + 'px';
                    modal.style.transform = 'none';
                    e.preventDefault();
                });
                document.addEventListener('mousemove', function (e) {
                    if (!dragging) return;
                    var x = Math.max(0, Math.min(e.clientX - ox, window.innerWidth - 60));
                    var y = Math.max(0, Math.min(e.clientY - oy, window.innerHeight - 40));
                    modal.style.left = x + 'px';
                    modal.style.top = y + 'px';
                });
                document.addEventListener('mouseup', function () { dragging = false; });
            }
            // Esc closes the modal when open.
            document.addEventListener('keydown', function (e) {
                if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                    hideWarpModal();
                }
            });
        }

        // Panel drag — same pattern as the community palette.
        (function () {
            var panel = $('#warps-panel');
            var panelHeader = panel ? panel.querySelector('.warps-panel-header') : null;
            if (!panelHeader) return;
            var dragging = false;
            var offsetX = 0, offsetY = 0;
            panelHeader.addEventListener('mousedown', function (e) {
                if (e.target.tagName === 'BUTTON') return;
                dragging = true;
                var rect = panel.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                // Switch from right-anchored to left-anchored positioning
                panel.style.left = rect.left + 'px';
                panel.style.top = rect.top + 'px';
                panel.style.right = 'auto';
                e.preventDefault();
            });
            document.addEventListener('mousemove', function (e) {
                if (!dragging) return;
                var x = Math.max(0, Math.min(e.clientX - offsetX, window.innerWidth - 60));
                var y = Math.max(0, Math.min(e.clientY - offsetY, window.innerHeight - 40));
                panel.style.left = x + 'px';
                panel.style.top = y + 'px';
            });
            document.addEventListener('mouseup', function () {
                if (!dragging) return;
                dragging = false;
                hooks.saveViewState(); // persist the dragged position
            });
        })();

        // CSS resize: both — persist user-resized dimensions (no mouseup to hook).
        if (window.ResizeObserver) {
            var warpsPanelEl = $('#warps-panel');
            if (warpsPanelEl) new ResizeObserver(function () { hooks.schedulePaletteSave(); }).observe(warpsPanelEl);
        }

        renderWarpsPanel();
    }

    // ============================================================
    // Module surface
    // ============================================================
    function init(injected) {
        hooks = injected || {};
    }

    window.AuraWarps = {
        init: init,
        // Wire the toolbar button + panel controls (called once by app init)
        setup: setupWarps,
        // Capture the current camera pose (palette command / host message)
        capture: function () { syncCtx(); showWarpModal(); },
        // Re-render the list (called on every 'warps' message)
        render: function () { syncCtx(); renderWarpsPanel(); },
        // Show/hide the panel (called by applyViewState)
        setVisible: function (visible) { syncCtx(); setWarpsPanelVisible(visible); },
        // Camera flight (quick-slot shortcut)
        travelTo: function (warp) { syncCtx(); travelToWarp(warp); },
        // Smooth 800 ms camera flight to an explicit pose (follow-editor)
        flyToPose: function (pos, target) { syncCtx(); travelToPose(pos, target); },
        // Full live pose — position, orientation, up vector, fov and anchor.
        // Used by "copy view link" (V3-06).
        capturePose: function () { syncCtx(); return captureWarpPose(); },
        // Apply a shared pose: its file anchor is re-resolved against the
        // current layout before the flight, exactly like clicking a warp.
        applyPose: function (pose) {
            syncCtx();
            if (!pose || !pose.pos || !pose.target) return;
            var resolved = resolveWarpPose(pose) || pose;
            travelToPose(resolved.pos, resolved.target, pose.quat, pose.up, pose.fov);
        },
        // Resolved pose (node-anchored warps rebuild against the current layout)
        resolvePose: function (warp) { syncCtx(); return resolveWarpPose(warp); },
        // Abort an in-flight warp flight (minimap drag, pilot take-off)
        cancelTravel: cancelWarpTravel
    };
})();
