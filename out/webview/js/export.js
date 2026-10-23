/**
 * export.js — High-resolution PNG capture for the 3D graph.
 *
 * The host opens a save dialog; this module resizes the WebGL renderer,
 * captures the current frame and posts the base64 image back.
 */
(function () {
    'use strict';

    var hooks = {};

    function post(type, payload) {
        try { hooks.postMessage({ type: type, payload: payload }); } catch (_) { /* noop */ }
    }

    function setup() {
        var btn = document.getElementById('btn-export-image');
        if (!btn) return;
        btn.addEventListener('click', function() {
            post('requestExportImage', {});
        });
    }

    function capture(options) {
        options = options || {};
        var graph = hooks.getGraph && hooks.getGraph();
        var container = hooks.getContainer && hooks.getContainer();
        if (!graph || !container) {
            post('exportImageError', { message: 'The 3D graph is not ready yet.' });
            return;
        }
        var renderer = graph.renderer && graph.renderer();
        var scene = graph.scene && graph.scene();
        var camera = graph.camera && graph.camera();
        if (!renderer || !scene || !camera || !renderer.domElement) {
            post('exportImageError', { message: 'The 3D renderer is not available.' });
            return;
        }

        var T = window.THREE;
        var width = Math.max(1, container.clientWidth);
        var height = Math.max(1, container.clientHeight);
        var scale = Math.max(1, Math.min(4, Number(options.scale) || 2));
        var pixelRatio = renderer.getPixelRatio ? renderer.getPixelRatio() : 1;
        var previousAspect = camera.aspect;
        var previousBackground = scene.background;
        var previousClearColor = new T.Color();
        if (renderer.getClearColor) renderer.getClearColor(previousClearColor);
        var previousClearAlpha = renderer.getClearAlpha ? renderer.getClearAlpha() : 1;

        try {
            renderer.setPixelRatio(1);
            renderer.setSize(width * scale, height * scale, false);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();

            if (options.background === 'transparent') {
                scene.background = null;
                renderer.setClearColor(0x000000, 0);
            }

            renderer.render(scene, camera);
            var dataUrl = renderer.domElement.toDataURL('image/png');
            if (options.watermark) {
                addWatermark(dataUrl, width * scale, height * scale, function(result) {
                    post('exportImageData', {
                        dataUrl: result,
                        width: width * scale,
                        height: height * scale,
                    });
                });
            } else {
                post('exportImageData', {
                    dataUrl: dataUrl,
                    width: width * scale,
                    height: height * scale,
                });
            }
        } catch (err) {
            post('exportImageError', { message: String(err && err.message ? err.message : err) });
        } finally {
            renderer.setPixelRatio(pixelRatio);
            renderer.setSize(width, height, false);
            camera.aspect = previousAspect;
            camera.updateProjectionMatrix();
            scene.background = previousBackground;
            if (renderer.setClearColor) renderer.setClearColor(previousClearColor, previousClearAlpha);
        }
    }

    function addWatermark(dataUrl, width, height, done) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        var img = new Image();
        img.onload = function() {
            ctx.drawImage(img, 0, 0, width, height);
            var size = Math.max(14, Math.round(width / 90));
            ctx.font = '600 ' + size + 'px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillStyle = 'rgba(255,255,255,0.62)';
            ctx.shadowColor = 'rgba(0,0,0,0.55)';
            ctx.shadowBlur = Math.max(2, size / 4);
            ctx.fillText('Aura', width - size, height - size);
            done(canvas.toDataURL('image/png'));
        };
        img.onerror = function() { done(dataUrl); };
        img.src = dataUrl;
    }

    window.AuraExport = {
        init: function(injectedHooks) {
            hooks = injectedHooks || {};
            setup();
        },
        capture: capture
    };
})();
