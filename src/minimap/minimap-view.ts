/**
 * minimap-view.ts — the Aura minimap as a **view inside the Explorer container**
 * (`contributes.views.explorer`), so the file tree stays visible above it and
 * the section collapses in one click.
 *
 * What it draws is `minimap-core`'s plan: a top-down city, computed on the host.
 * That is why this view works with the Aura panel closed — there is no webview
 * of ours to talk to, no camera to mirror, no 3D engine to load.
 *
 * Interaction is deliberately thin: click a building to open the file, hover to
 * read its path, and the file you are editing is outlined in white.
 */
import * as vscode from 'vscode';
import type { CityNodeLike } from '../graph/city-core';
import { EMPTY_MINIMAP, MinimapPayload, buildMinimapPlan } from './minimap-core';

export interface MinimapViewHandlers {
    /** The nodes of the current analysis, or `undefined` when there is none. */
    getNodes: () => CityNodeLike[] | undefined;
    /** Open a workspace-relative file id in the editor. */
    openFile: (relativePath: string) => void;
    /** Run an analysis — offered from the empty state. */
    runAnalysis: () => void;
}

export class MinimapViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewId = 'auraVisualizer.minimapView';

    private view: vscode.WebviewView | undefined;
    private payload: MinimapPayload = EMPTY_MINIMAP;
    private activeId = '';

    constructor(private readonly handlers: MinimapViewHandlers) {}

    /**
     * Recompute the plan from the current graph and push it. Called whenever the
     * tree view refreshes, which is exactly when the graph changed — so the two
     * sidebar surfaces can never disagree.
     */
    refresh(): void {
        this.payload = buildMinimapPlan(this.handlers.getNodes());
        this.post({ type: 'data', payload: this.payload, active: this.activeId });
    }

    /** The graph went away (workspace closed, analysis reset). */
    clear(): void {
        this.payload = EMPTY_MINIMAP;
        this.activeId = '';
        this.post({ type: 'data', payload: this.payload, active: '' });
    }

    /** Outline the file being edited. Cheap: one message, no re-layout. */
    setActiveFile(relativePath: string): void {
        const next = relativePath || '';
        if (next === this.activeId) return;
        this.activeId = next;
        this.post({ type: 'select', id: next });
    }

    resolveWebviewView(view: vscode.WebviewView): void {
        this.view = view;
        view.webview.options = { enableScripts: true };
        // A stale payload must not survive a resolve (the tree may have changed
        // while the section was collapsed and destroyed).
        this.payload = buildMinimapPlan(this.handlers.getNodes());
        view.webview.html = this.renderHtml(view.webview);

        view.webview.onDidReceiveMessage((message: { type?: string; id?: string }) => {
            if (!message) return;
            if (message.type === 'open' && typeof message.id === 'string') {
                this.handlers.openFile(message.id);
            } else if (message.type === 'analyze') {
                this.handlers.runAnalysis();
            }
        });

        view.onDidDispose(() => {
            this.view = undefined;
        });
    }

    private post(message: unknown): void {
        void this.view?.webview.postMessage(message);
    }

    private renderHtml(webview: vscode.Webview): string {
        const nonce = createNonce();
        // `<` is escaped so a file named `</script>` cannot close the block.
        const initial = JSON.stringify({ payload: this.payload, active: this.activeId })
            .replace(/</g, '\\u003c');
        const csp = [
            "default-src 'none'",
            "style-src 'unsafe-inline'",
            `script-src 'nonce-${nonce}'`,
            'img-src data:',
        ].join('; ');

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>Aura Minimap</title>
<style>
    body {
        margin: 0;
        padding: 6px 8px 8px;
        font-family: var(--vscode-font-family);
        font-size: 12px;
        color: var(--vscode-foreground);
        overflow: hidden;
    }
    #map {
        display: block;
        width: 100%;
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.03);
        cursor: pointer;
    }
    #caption {
        margin-top: 5px;
        font-size: 11px;
        opacity: 0.65;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    #empty {
        display: none;
        padding: 14px 4px;
        text-align: center;
        font-size: 11px;
        opacity: 0.8;
    }
    #analyze {
        margin-top: 8px;
        font: inherit;
        color: var(--vscode-button-foreground);
        background: var(--vscode-button-background);
        border: 0;
        border-radius: 3px;
        padding: 4px 10px;
        cursor: pointer;
    }
    #analyze:hover { background: var(--vscode-button-hoverBackground); }
</style>
</head>
<body>
<canvas id="map"></canvas>
<div id="empty">No plan yet.<br><button id="analyze" type="button">Analyze workspace</button></div>
<div id="caption">—</div>
<script nonce="${nonce}">
(function () {
    'use strict';
    var vscode = acquireVsCodeApi();
    var state = ${initial};
    var canvas = document.getElementById('map');
    var caption = document.getElementById('caption');
    var empty = document.getElementById('empty');
    var analyze = document.getElementById('analyze');
    var ctx = canvas.getContext('2d');

    // Height tiers, low to high. Index 0 is unused: tierOf() returns 1..n-1.
    var TIERS = ['#243447', '#2c4257', '#38556f', '#4a7191', '#6997b8', '#9cc3dc'];
    var MUTED = 'rgba(150, 170, 190, 0.35)';
    var box = { size: 0, ox: 0, oy: 0, css: 0 };
    var hoverId = '';

    function baseName(id) {
        var parts = String(id).split('/');
        return parts[parts.length - 1];
    }

    function captionFor() {
        var p = state.payload || { buildings: [], total: 0, truncated: false };
        if (hoverId) return hoverId;
        var text = p.total + (p.total === 1 ? ' file' : ' files');
        if (p.truncated) text += ' · top ' + p.buildings.length + ' drawn';
        return text;
    }

    function draw() {
        var p = state.payload || { buildings: [], districts: [], total: 0, truncated: false };
        var has = p.buildings.length > 0;
        canvas.style.display = has ? 'block' : 'none';
        empty.style.display = has ? 'none' : 'block';
        caption.textContent = captionFor();
        if (!has) return;

        var css = Math.max(80, canvas.clientWidth || 200);
        var dpr = window.devicePixelRatio || 1;
        canvas.style.height = css + 'px';
        canvas.width = Math.round(css * dpr);
        canvas.height = Math.round(css * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, css, css);

        var size = css - 2;
        var ox = 1;
        var oy = 1;
        box = { size: size, ox: ox, oy: oy, css: css };

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
        ctx.lineWidth = 1;
        for (var d = 0; d < p.districts.length; d++) {
            var district = p.districts[d];
            ctx.strokeRect(
                ox + district.x * size + 0.5,
                oy + district.y * size + 0.5,
                Math.max(1, district.w * size - 1),
                Math.max(1, district.h * size - 1)
            );
        }

        var active = null;
        for (var i = 0; i < p.buildings.length; i++) {
            var b = p.buildings[i];
            if (b.id === state.active) { active = b; continue; }
            ctx.fillStyle = b.kind === 'code' ? (TIERS[b.tier] || TIERS[1]) : MUTED;
            ctx.fillRect(
                ox + b.x * size,
                oy + b.y * size,
                Math.max(1, b.w * size),
                Math.max(1, b.h * size)
            );
        }

        if (active) {
            var ax = ox + active.x * size;
            var ay = oy + active.y * size;
            var aw = Math.max(2, active.w * size);
            var ah = Math.max(2, active.h * size);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(ax, ay, aw, ah);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(ax - 1, ay - 1, aw + 2, ah + 2);
        }
    }

    function buildingAt(event) {
        var p = state.payload;
        if (!p || !box.size) return null;
        var rect = canvas.getBoundingClientRect();
        var mx = (event.clientX - rect.left - box.ox) / box.size;
        var my = (event.clientY - rect.top - box.oy) / box.size;
        // Reverse order: the last drawn building is the one on top.
        for (var i = p.buildings.length - 1; i >= 0; i--) {
            var b = p.buildings[i];
            if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) return b;
        }
        return null;
    }

    canvas.addEventListener('click', function (event) {
        var b = buildingAt(event);
        if (b) vscode.postMessage({ type: 'open', id: b.id });
    });

    canvas.addEventListener('mousemove', function (event) {
        var b = buildingAt(event);
        var next = b ? b.id : '';
        if (next === hoverId) return;
        hoverId = next;
        canvas.style.cursor = b ? 'pointer' : 'default';
        caption.textContent = captionFor();
    });

    canvas.addEventListener('mouseleave', function () {
        hoverId = '';
        caption.textContent = captionFor();
    });

    analyze.addEventListener('click', function () {
        vscode.postMessage({ type: 'analyze' });
    });

    window.addEventListener('message', function (event) {
        var message = event.data || {};
        if (message.type === 'data') {
            state.payload = message.payload || state.payload;
            state.active = message.active || '';
            hoverId = '';
            canvas.style.cursor = 'default';
            draw();
        } else if (message.type === 'select') {
            state.active = message.id || '';
            draw();
        }
    });

    if (typeof ResizeObserver === 'function') {
        // Guarded: drawing writes style.height on the canvas, which is itself a
        // resize. Without the guard the observer would ping-pong every frame.
        new ResizeObserver(function () {
            if (canvas.clientWidth === box.css) return;
            draw();
        }).observe(canvas);
    }
    window.addEventListener('resize', draw);
    requestAnimationFrame(draw);
    // The first draw can happen before the sidebar has laid out; the observer
    // corrects it, and a second frame covers the case where it did not fire.
    setTimeout(draw, 60);
})();
</script>
</body>
</html>`;
    }
}

function createNonce(): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}
