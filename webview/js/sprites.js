/**
 * sprites.js — THREE.js sprite factories for the 3D graph: file labels,
 * cluster pills, amber dirty rings, note dots/rings and their breathing pulse.
 *
 * Extracted from app.js (Lot 2e). window.AuraSprites + init(hooks). Each cache
 * keeps ONE drawn sprite per key and every call returns a clone with its own
 * material (THREE's clone() shares materials — per-node opacity would leak).
 * The data behind the visuals (workingTree, annotations, dirtyStateOf,
 * annotationOf, GIT_STATE_LABELS) stays in app.js.
 */
(function () {
    'use strict';

    var hooks = {};

    // ============================================================
    // Label Sprites (THREE.js)
    // ============================================================
    var labelSpriteCache = {};
    function getLabelSprite(text, color) {
        var T = window.THREE;
        if (!T) return null;
        var fill = color || 'rgba(255, 255, 255, 0.9)';
        var cacheKey = fill + '|' + text;

        if (labelSpriteCache[cacheKey]) {
            return labelSpriteCache[cacheKey].clone();
        }

        var canvas = document.createElement('canvas');
        var context = canvas.getContext('2d');
        var fontSize = 32;
        context.font = fontSize + 'px sans-serif';
        var textWidth = context.measureText(text).width;

        var paddingX = 16;
        var paddingY = 8;
        canvas.width = textWidth + paddingX;
        canvas.height = fontSize + paddingY;

        context.font = fontSize + 'px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        if (context.roundRect) {
            context.beginPath();
            context.roundRect(0, 0, canvas.width, canvas.height, 8);
            context.fill();
        } else {
            context.fillRect(0, 0, canvas.width, canvas.height);
        }

        context.fillStyle = fill;
        context.fillText(text, canvas.width / 2, canvas.height / 2);

        var texture = new T.CanvasTexture(canvas);
        texture.minFilter = T.LinearFilter;
        var material = new T.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
        var sprite = new T.Sprite(material);

        var scaleFactor = 0.15;
        sprite.scale.set(canvas.width * scaleFactor, canvas.height * scaleFactor, 1);

        labelSpriteCache[cacheKey] = sprite;
        return sprite.clone();
    }

    // ============================================================
    // Dirty rings (git working tree)
    // ============================================================
    var dirtyRingSprite = null;

    /**
     * Clone a sprite with its OWN material. THREE's clone() shares the material
     * instance, so a per-node opacity (dimming) written on one clone leaks onto
     * every other clone sharing it — the last write wins for all of them.
     */
    function cloneSpriteWithMaterial(sprite) {
        var clone = sprite.clone();
        clone.material = sprite.material.clone();
        return clone;
    }

    /** Amber ring drawn once, then cloned — shown around files with uncommitted changes. */
    function getDirtyRingSprite() {
        var T = window.THREE;
        if (!T) return null;
        if (dirtyRingSprite) return cloneSpriteWithMaterial(dirtyRingSprite);

        var size = 128;
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        var center = size / 2;

        // Soft halo
        ctx.beginPath();
        ctx.arc(center, center, size * 0.30, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(251, 192, 45, 0.22)';
        ctx.lineWidth = size * 0.10;
        ctx.stroke();

        // Crisp ring
        ctx.beginPath();
        ctx.arc(center, center, size * 0.30, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 179, 0, 0.95)';
        ctx.lineWidth = size * 0.045;
        ctx.stroke();

        var texture = new T.CanvasTexture(canvas);
        texture.minFilter = T.LinearFilter;
        var material = new T.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
        var sprite = new T.Sprite(material);
        dirtyRingSprite = sprite;
        return cloneSpriteWithMaterial(sprite);
    }

    // ============================================================
    // Centrality halo (PageRank top files)
    // ============================================================
    var centralityHaloSprite = null;

    /**
     * Soft violet glow drawn once, then cloned. The centre stays transparent so
     * the node remains readable; the alpha peaks just outside the node radius.
     * Callers set sprite.scale to 5 × node radius (outer glow ≈ 2.5 × radius).
     */
    function getCentralityHaloSprite() {
        var T = window.THREE;
        if (!T) return null;
        if (centralityHaloSprite) return cloneSpriteWithMaterial(centralityHaloSprite);

        var size = 256;
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        var center = size / 2;

        var gradient = ctx.createRadialGradient(center, center, size * 0.18, center, center, size * 0.48);
        gradient.addColorStop(0.00, 'rgba(139, 92, 246, 0)');
        gradient.addColorStop(0.45, 'rgba(139, 92, 246, 0.10)');
        gradient.addColorStop(0.78, 'rgba(167, 139, 250, 0.34)');
        gradient.addColorStop(0.92, 'rgba(139, 92, 246, 0.14)');
        gradient.addColorStop(1.00, 'rgba(139, 92, 246, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        // Faint rim keeps the halo readable on busy parts of the graph.
        ctx.beginPath();
        ctx.arc(center, center, size * 0.42, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(196, 181, 253, 0.45)';
        ctx.lineWidth = size * 0.012;
        ctx.stroke();

        var texture = new T.CanvasTexture(canvas);
        texture.minFilter = T.LinearFilter;
        var material = new T.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            blending: T.AdditiveBlending
        });
        var sprite = new T.Sprite(material);
        centralityHaloSprite = sprite;
        return cloneSpriteWithMaterial(sprite);
    }

    // ============================================================
    // Notes (annotations)
    // ============================================================
    var noteDotSprites = {};

    /** Colored dot drawn once per color, then cloned — shown top-right of the node. */
    function getNoteDotSprite(colorKey) {
        var T = window.THREE;
        if (!T) return null;
        var NOTE_COLORS = hooks.getNoteColors() || { yellow: '#fdd835' };
        var hex = NOTE_COLORS[colorKey] || NOTE_COLORS.yellow;
        if (noteDotSprites[hex]) return cloneSpriteWithMaterial(noteDotSprites[hex]);

        // Same canvas scale as the dirty ring (128px, ring radius 0.30)
        // so the dot sits on the ring's top-right diagonal.
        var size = 128;
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        var ringR = size * 0.30;
        var cx = size / 2 + ringR * Math.SQRT1_2;
        var cy = size / 2 - ringR * Math.SQRT1_2;
        var r = size * 0.10;

        ctx.beginPath();
        ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(13, 17, 23, 0.9)'; // dark outline for contrast
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = hex;
        ctx.fill();

        var texture = new T.CanvasTexture(canvas);
        texture.minFilter = T.LinearFilter;
        var material = new T.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
        var sprite = new T.Sprite(material);
        noteDotSprites[hex] = sprite;
        return cloneSpriteWithMaterial(sprite);
    }

    var noteRingSprites = {};

    /** Note-colored ring drawn once per color, then cloned — sits inside the amber dirty ring. */
    function getNoteRingSprite(colorKey) {
        var T = window.THREE;
        if (!T) return null;
        var NOTE_COLORS = hooks.getNoteColors() || { yellow: '#fdd835' };
        var hex = NOTE_COLORS[colorKey] || NOTE_COLORS.yellow;
        if (noteRingSprites[hex]) return cloneSpriteWithMaterial(noteRingSprites[hex]);

        // Same canvas scale as the dirty ring (128px) but a tighter radius (0.22 vs 0.30),
        // so a noted+dirty file shows two nested rings instead of one ambiguous circle.
        var size = 128;
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        var center = size / 2;
        var rgb = parseInt(hex.slice(1, 3), 16) + ',' + parseInt(hex.slice(3, 5), 16) + ',' + parseInt(hex.slice(5, 7), 16);

        // Soft halo stroke, then crisp ring — mirrors the dirty ring's look.
        ctx.beginPath();
        ctx.arc(center, center, size * 0.22, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(' + rgb + ', 0.22)';
        ctx.lineWidth = size * 0.09;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(center, center, size * 0.22, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(' + rgb + ', 0.95)';
        ctx.lineWidth = size * 0.04;
        ctx.stroke();

        var texture = new T.CanvasTexture(canvas);
        texture.minFilter = T.LinearFilter;
        var material = new T.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
        var sprite = new T.Sprite(material);
        noteRingSprites[hex] = sprite;
        return cloneSpriteWithMaterial(sprite);
    }

    // ============================================================
    // Note pulse — breathing animation for the note indicators
    // ============================================================
    var NOTE_PULSE_MS = 1800;        // one full breathe cycle
    var NOTE_PULSE_SCALE_MIN = 0.90; // trough size (fraction of base)
    var NOTE_PULSE_SCALE_AMP = 0.22; // added at the crest → up to 1.12×
    var NOTE_PULSE_ALPHA_MIN = 0.45;

    /**
     * Attach the per-frame breathing to a note sprite. Driven from onBeforeRender:
     * no global timer, the animation lives and dies with the sprite itself.
     */
    function attachNotePulse(sprite, baseScale, opacityFactor) {
        sprite.userData.noteBaseScale = baseScale;
        // Dimmed nodes keep dimmed rings — the factor multiplies the breathing
        // opacity so the pulse never brightens a ghost.
        sprite.userData.noteOpacityFactor = (typeof opacityFactor === 'number') ? opacityFactor : 1;
        sprite.onBeforeRender = function () {
            var t = performance.now() / NOTE_PULSE_MS * Math.PI * 2;
            var pulse = 0.5 + 0.5 * Math.sin(t); // 0..1
            var s = this.userData.noteBaseScale * (NOTE_PULSE_SCALE_MIN + NOTE_PULSE_SCALE_AMP * pulse);
            this.scale.set(s, s, 1);
            this.material.opacity = (NOTE_PULSE_ALPHA_MIN + (1 - NOTE_PULSE_ALPHA_MIN) * pulse) * this.userData.noteOpacityFactor;
            // matrixWorld was computed before rendering — refresh it for the new scale.
            this.updateMatrixWorld(true);
        };
    }

    function getClusterLabelSprite(groupName, count, color) {
        var T = window.THREE;
        if (!T) return null;

        var label = groupName + ' (' + count + ')';
        var cacheKey = 'cluster:' + label + ':' + color;
        if (labelSpriteCache[cacheKey]) return labelSpriteCache[cacheKey].clone();

        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var fontSize = 36;
        ctx.font = 'bold ' + fontSize + 'px sans-serif';
        var tw = ctx.measureText(label).width;

        var px = 24, py = 16;
        canvas.width = tw + px;
        canvas.height = fontSize + py;

        ctx.font = 'bold ' + fontSize + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Background pill
        ctx.fillStyle = color || 'rgba(120,144,156,0.8)';
        ctx.globalAlpha = 0.75;
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(0, 0, canvas.width, canvas.height, 12);
            ctx.fill();
        } else {
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.globalAlpha = 1.0;

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, canvas.width / 2, canvas.height / 2);

        var texture = new T.CanvasTexture(canvas);
        texture.minFilter = T.LinearFilter;
        var mat = new T.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
        var sprite = new T.Sprite(mat);
        var sf = 0.18;
        sprite.scale.set(canvas.width * sf, canvas.height * sf, 1);

        labelSpriteCache[cacheKey] = sprite;
        return sprite.clone();
    }

    // ============================================================
    // Public API
    // ============================================================
    window.AuraSprites = {
        init: function (h) { hooks = h || {}; },
        labelSprite: getLabelSprite,
        clusterLabel: getClusterLabelSprite,
        dirtyRing: getDirtyRingSprite,
        centralityHalo: getCentralityHaloSprite,
        noteDot: getNoteDotSprite,
        noteRing: getNoteRingSprite,
        attachPulse: attachNotePulse,
        cloneWithMaterial: cloneSpriteWithMaterial,
        /** Drop a cached label (file re-analysed). */
        invalidateLabel: function (name) {
            var suffix = '|' + name;
            Object.keys(labelSpriteCache).forEach(function (key) {
                if (key === name || key.slice(-suffix.length) === suffix) delete labelSpriteCache[key];
            });
        },
        /** Drop every cached sprite (full refresh). */
        invalidateAll: function () {
            labelSpriteCache = {};
            dirtyRingSprite = null;
            centralityHaloSprite = null;
            noteDotSprites = {};
            noteRingSprites = {};
        }
    };
})();
