/**
 * aura-view.ts — the **Aura** section in the Explorer container.
 *
 * Two surfaces, one card: the 3D detail panel's identity and metrics, and the
 * City inspector's risk block (score, written reasons, complexity sparkline)
 * and relation map — but drawn as **SVG**, not as a 3D scene and not as a
 * canvas. SVG means the card scales with the sidebar instead of fighting it:
 * no resize observer, no device-pixel ratio, no redraw on every layout change.
 *
 * The connection map is the City's own geometry: the file in the middle, its
 * dependencies on the right in blue, its dependents on the left in amber, every
 * dot clickable and every click opening the file in the editor.
 */
import * as vscode from 'vscode';
import type { GraphData } from '../analyzer/types';
import type { AuraCard, AuraRepoView } from './aura-card';

export interface AuraViewHandlers {
    /** The current graph, or `undefined` before the first analysis. */
    getGraph: () => Pick<GraphData, 'nodes' | 'links'> | undefined;
    /** The card for one workspace-relative file id. */
    getCard: (fileId: string) => AuraCard | null;
    /** The repository summary shown when no analyzed file is open. */
    getRepo: () => AuraRepoView | null;
    /** Open a workspace-relative file in the editor. */
    openFile: (relativePath: string) => void;
    /** `◫ View in` — land the Aura panel on that tab, on this file. */
    showIn: (tab: 'graph' | 'city' | 'treemap', fileId: string) => void;
    /** Blast radius of the active file. */
    blastRadius: (relativePath: string) => void;
    /** Run an analysis — offered from the empty state. */
    runAnalysis: () => void;
}

export class AuraViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewId = 'auraVisualizer.auraView';

    private view: vscode.WebviewView | undefined;
    private activeId = '';
    /** Listeners of the current resolve — VS Code may resolve the view again. */
    private listeners: vscode.Disposable[] = [];

    constructor(private readonly handlers: AuraViewHandlers) {}

    /** Rebuild for the file that is currently open (or the repo summary). */
    refresh(): void {
        this.postState();
    }

    /** The graph went away (workspace closed, analysis reset). */
    clear(): void {
        this.activeId = '';
        this.post({ type: 'state', card: null, repo: null });
    }

    /** Show the card of the file being edited (or the repo summary for `''`). */
    setActiveFile(relativePath: string): void {
        const next = relativePath || '';
        if (next === this.activeId) return;
        this.activeId = next;
        this.postState();
    }

    resolveWebviewView(view: vscode.WebviewView): void {
        // A re-resolved view must not stack a second set of listeners: a click
        // would then open the same file twice.
        for (const listener of this.listeners) listener.dispose();
        this.listeners = [];

        this.view = view;
        view.webview.options = { enableScripts: true };
        view.webview.html = renderHtml();

        const onMessage = view.webview.onDidReceiveMessage((message: { type?: string; id?: string; tab?: string }) => {
            if (!message || typeof message.type !== 'string') return;
            if (message.type === 'ready') {
                // Handshake from the script: only now is there a listener to
                // receive the state. Without it, collapsing and re-expanding
                // the section left the fresh webview on "Loading…" — the
                // `postState()` that used to follow `html =` was sent before
                // the scripts existed, and `setActiveFile()` stays silent when
                // the file did not change.
                this.postState();
                return;
            }
            if (message.type === 'open' && typeof message.id === 'string') {
                this.handlers.openFile(message.id);
            } else if (message.type === 'view' && (message.tab === 'graph' || message.tab === 'city' || message.tab === 'treemap')) {
                this.handlers.showIn(message.tab, this.activeId);
            } else if (message.type === 'blast' && this.activeId) {
                this.handlers.blastRadius(this.activeId);
            } else if (message.type === 'analyze') {
                this.handlers.runAnalysis();
            }
        });

        // Not every VS Code version re-resolves the provider when a hidden
        // section comes back; when the content survived, a visibility change is
        // the only signal we get.
        const onVisibility = view.onDidChangeVisibility(() => {
            if (view.visible) this.postState();
        });

        const onDispose = view.onDidDispose(() => {
            this.view = undefined;
        });
        this.listeners.push(onMessage, onVisibility, onDispose);

        // Harmless when it is lost: the `ready` message above is the guarantee.
        this.postState();
    }

    private postState(): void {
        if (!this.view) return;
        const graph = this.handlers.getGraph();
        const card = graph && this.activeId ? this.handlers.getCard(this.activeId) : null;
        const repo = graph ? this.handlers.getRepo() : null;
        this.post({ type: 'state', card, repo });
    }

    private post(message: unknown): void {
        void this.view?.webview.postMessage(message);
    }
}

function createNonce(): string {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < 32; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

function renderHtml(): string {
    const nonce = createNonce();
    const csp = [
        "default-src 'none'",
        "style-src 'unsafe-inline'",
        `script-src 'nonce-${nonce}'`,
    ].join('; ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>
    body {
        margin: 0;
        padding: 6px 9px 9px;
        font-family: var(--vscode-font-family);
        font-size: 12px;
        line-height: 1.45;
        color: var(--vscode-foreground);
    }
    .muted { opacity: 0.62; }
    .label {
        font-size: 10px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        opacity: 0.55;
        margin: 10px 0 4px;
        display: flex;
        justify-content: space-between;
        gap: 6px;
    }
    .label b { font-weight: 600; letter-spacing: 0; text-transform: none; opacity: 1; }
    .head {
        display: flex;
        align-items: baseline;
        gap: 6px;
        min-width: 0;
    }
    .name {
        font-weight: 600;
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        cursor: pointer;
    }
    .name:hover { text-decoration: underline; }
    .dir {
        font-size: 11px;
        opacity: 0.6;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        direction: rtl;
        text-align: right;
        min-width: 0;
        flex: 1;
    }
    .flags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
    .flag {
        font-size: 10px;
        padding: 1px 5px;
        border-radius: 8px;
        border: 1px solid rgba(255,255,255,0.12);
        white-space: nowrap;
    }
    .flag.bad { border-color: rgba(248,113,113,0.55); color: #f09a9a; }
    .flag.warn { border-color: rgba(240,181,58,0.45); color: #e5c07b; }
    .flag.info { border-color: rgba(96,165,250,0.45); color: #93bdfa; }
    .metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(62px, 1fr));
        gap: 3px 10px;
        margin-top: 8px;
    }
    .metric { display: flex; flex-direction: column; }
    .metric b { font-size: 12px; font-weight: 600; }
    .metric span { font-size: 10px; opacity: 0.55; }
    /* One rule between the identity, the risk and the connections. */
    .section {
        border-top: 1px solid rgba(255,255,255,0.09);
        margin-top: 9px;
        padding-top: 7px;
    }
    .risk-head { display: flex; align-items: center; gap: 7px; }
    .score { font-size: 17px; font-weight: 600; line-height: 1; }
    .bar {
        flex: 1;
        height: 5px;
        border-radius: 3px;
        background: rgba(255,255,255,0.10);
        overflow: hidden;
    }
    .bar i { display: block; height: 100%; background: #60a5fa; }
    [data-bucket="high"] .bar i { background: #f87171; }
    [data-bucket="high"] .score { color: #f09a9a; }
    [data-bucket="medium"] .bar i { background: #e0b53a; }
    [data-bucket="medium"] .score { color: #e5c07b; }
    .top { font-size: 10px; opacity: 0.6; white-space: nowrap; }
    .trend { display: flex; align-items: center; gap: 5px; margin-top: 5px; }
    .trend svg { width: 84px; height: 20px; display: block; }
    .trend .dir-up { color: #f09a9a; }
    .trend .dir-down { color: #7ec699; }
    ul.reasons {
        margin: 5px 0 0;
        padding-left: 14px;
        font-size: 11px;
        opacity: 0.85;
    }
    ul.reasons li { margin-bottom: 1px; }
    .stats { font-size: 10px; opacity: 0.55; margin-top: 4px; }
    .conn svg { width: 100%; display: block; }
    .conn-line { stroke-width: 1; opacity: 0.45; }
    .conn text { font-size: 9.5px; fill: currentColor; opacity: 0.85; }
    .conn g[data-open] { cursor: pointer; }
    .conn g[data-open]:hover text { opacity: 1; text-decoration: underline; }
    .conn g[data-open]:hover circle { r: 5; }
    .self text { font-weight: 600; opacity: 1; }
    .legend { display: flex; gap: 10px; font-size: 10px; opacity: 0.7; margin-top: 2px; }
    .legend .out { color: #4fc3f7; }
    .legend .in { color: #e0b53a; }
    .actions { display: flex; gap: 6px; margin-top: 11px; }
    .menu-wrap { position: relative; }
    .view-menu {
        display: none;
        position: absolute;
        bottom: calc(100% + 4px);
        left: 0;
        min-width: 132px;
        padding: 3px 0;
        border-radius: 4px;
        border: 1px solid rgba(255,255,255,0.14);
        background: var(--vscode-menu-background, #252526);
        box-shadow: 0 4px 14px rgba(0,0,0,0.45);
        z-index: 20;
    }
    .view-menu.open { display: block; }
    .view-menu div {
        padding: 3px 10px;
        font-size: 11px;
        cursor: pointer;
        white-space: nowrap;
    }
    .view-menu div:hover { background: var(--vscode-menu-selectionBackground, rgba(96,165,250,0.28)); }
    button {
        font: inherit;
        font-size: 11px;
        color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
        background: var(--vscode-button-secondaryBackground, rgba(255,255,255,0.08));
        border: 0;
        border-radius: 3px;
        padding: 3px 9px;
        cursor: pointer;
    }
    button:hover { background: var(--vscode-button-secondaryHoverBackground, rgba(255,255,255,0.14)); }
    button.primary {
        color: var(--vscode-button-foreground);
        background: var(--vscode-button-background);
    }
    .hotspot {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 5px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
    }
    .hotspot:hover { background: rgba(255,255,255,0.06); }
    .hotspot .n { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hotspot .s { font-variant-numeric: tabular-nums; color: #f09a9a; }
    .empty { opacity: 0.65; font-size: 11px; padding: 6px 0; }
</style>
</head>
<body>
<div id="root"><div class="empty">Loading…</div></div>
<script nonce="${nonce}">
(function () {
    'use strict';
    var vscode = acquireVsCodeApi();
    var root = document.getElementById('root');

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function num(value) {
        return Number(value || 0).toLocaleString();
    }

    function metric(value, label) {
        return '<div class="metric"><b>' + esc(value) + '</b><span>' + esc(label) + '</span></div>';
    }

    function trendBlock(risk) {
        if (!risk || !risk.spark) return '';
        var glyph = risk.direction === 'up' ? '↗ worse' : risk.direction === 'down' ? '↘ better' : '→ flat';
        var cls = risk.direction === 'up' ? 'dir-up' : risk.direction === 'down' ? 'dir-down' : 'muted';
        return '<div class="trend" title="Complexity over the scanned history">'
            + '<svg viewBox="0 0 84 20" preserveAspectRatio="none" aria-hidden="true">'
            + '<polyline fill="none" stroke="#8ab4f8" stroke-width="1.4" points="' + esc(risk.spark) + '"/></svg>'
            + '<span class="' + cls + '">' + glyph + '</span></div>';
    }

    function riskBlock(risk) {
        if (!risk) return '';
        var html = '<div class="section"><div class="label">Risk<b>' + esc(risk.windowDays) + ' days</b></div>'
            + '<div data-bucket="' + esc(risk.bucket) + '">'
            + '<div class="risk-head"><span class="score">' + esc(risk.score) + '</span>'
            + '<span class="bar"><i style="width:' + Math.max(2, Math.min(100, risk.score)) + '%"></i></span>'
            + '<span class="top">' + esc(risk.topLabel || risk.bucket) + '</span></div>'
            + trendBlock(risk);
        if (risk.reasons.length) {
            html += '<ul class="reasons">';
            for (var i = 0; i < risk.reasons.length; i++) html += '<li>' + esc(risk.reasons[i]) + '</li>';
            html += '</ul>';
        }
        if (risk.stats) html += '<div class="stats">' + esc(risk.stats) + '</div>';
        return html + '</div>';
    }

    // Same geometry as the City inspector: dependencies on the right in blue,
    // dependents on the left in amber, the file itself white in the middle.
    function connections(card) {
        var out = card.out || [];
        var inbound = card.in || [];
        var head = 'Connections';
        if (card.outTotal || card.inTotal) {
            head += ' · ' + card.outTotal + ' out · ' + card.inTotal + ' in';
        }
        var docs = card.docs
            ? '<div class="empty">+ ' + card.docs + ' documentation reference'
                + (card.docs === 1 ? '' : 's') + '</div>'
            : '';
        if (!out.length && !inbound.length) {
            return '<div class="section"><div class="label">' + esc(head) + '</div>'
                + '<div class="empty">no dependency</div>' + docs + '</div>';
        }

        var rows = Math.max(1, out.length, inbound.length);
        // The SVG clips anything outside its viewBox, and the sidebar is ~230 px
        // wide: a label anchored outside a column used to lose its beginning
        // (left) or its end (right) with no sign that it had been cut. The
        // columns sit closer to the centre, each label gets a measured budget
        // and anything longer ends on an ellipsis; the tooltip keeps the path.
        var W = 260;
        var H = Math.max(52, 30 + (rows - 1) * 20);
        var LABEL_FONT = 9.5;      // must match the .conn text rule in the CSS
        var CHARS_PER_EM = 0.6;    // conservative: proportional UI font
        var LABEL_PAD = 3;         // keep the ellipse clear of the border
        var LABEL_GAP = 6;
        var DOT_RIGHT = 176;
        var DOT_LEFT = 84;
        var cx = W / 2;
        var cy = H / 2;
        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" role="img">';

        function fit(name, room) {
            var max = Math.max(3, Math.floor(room / (LABEL_FONT * CHARS_PER_EM)));
            var text = String(name || '');
            if (text.length <= max) return text;
            // Middle-truncate: the extension survives, and so does the start of
            // the name — history-w…r.ts still reads as history-worker.ts, where
            // history-worke… loses the one part that identifies the kind. A
            // double extension counts as the extension: pars….test.ts says more
            // than parsers.t….ts.
            var parts = text.split('.');
            var ext = parts.length > 2
                ? '.' + parts.slice(-2).join('.')
                : (parts.length > 1 ? '.' + parts[parts.length - 1] : '');
            if (ext.length && ext.length + 3 <= max) {
                return text.slice(0, max - ext.length - 1) + '…' + ext;
            }
            return text.slice(0, max - 1) + '…';
        }

        function column(list, x, colour, side, total) {
            var step = list.length > 1 ? Math.min(20, (H - 22) / (list.length - 1)) : 0;
            var startY = cy - (step * (list.length - 1)) / 2;
            var anchor = side === 'right' ? 'start' : 'end';
            var textX = side === 'right' ? x + LABEL_GAP : x - LABEL_GAP;
            var room = (side === 'right' ? W - textX : textX) - LABEL_PAD;
            for (var i = 0; i < list.length; i++) {
                var item = list[i];
                var y = startY + i * step;
                var tip = item.id + ' · ' + item.type
                    + (item.confidence < 1 ? ' · confidence ' + item.confidence : '');
                svg += '<line class="conn-line" x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y
                    + '" stroke="' + colour + '"/>'
                    + '<g data-open="' + esc(item.id) + '" data-kind="' + esc(side) + '">'
                    + '<title>' + esc(tip) + '</title>'
                    + '<circle cx="' + x + '" cy="' + y + '" r="3.4" fill="' + colour + '"/>'
                    + '<text x="' + textX + '" y="' + (y + 3.2) + '" text-anchor="' + anchor + '">'
                    + esc(fit(item.name, room)) + '</text></g>';
            }
            if (total > list.length) {
                var moreY = startY + (list.length - 1) * step;
                svg += '<text class="muted" x="' + textX + '" y="' + (moreY + 15) + '"'
                    + ' text-anchor="' + anchor + '">+' + (total - list.length) + ' more</text>';
            }
        }

        column(out, DOT_RIGHT, '#4fc3f7', 'right', card.outTotal);
        column(inbound, DOT_LEFT, '#e0b53a', 'left', card.inTotal);

        svg += '<g class="self" data-open="' + esc(card.file.id) + '"><title>' + esc(card.file.id) + '</title>'
            + '<circle cx="' + cx + '" cy="' + cy + '" r="5" fill="#ffffff"/></g>'
            + '<text x="' + cx + '" y="' + (cy + 17) + '" text-anchor="middle" class="muted">'
            + esc(fit(card.file.name, W - 24)) + '</text>'
            + '</svg>';

        return '<div class="section"><div class="label">' + esc(head) + '</div><div class="conn">' + svg + '</div>'
            + '<div class="legend"><span class="out">● depends on</span>'
            + '<span class="in">● used by</span></div>' + docs + '</div>';
    }

    function renderCard(card) {
        var file = card.file;
        var html = '<div class="head">'
            + '<span class="name" data-open="' + esc(file.id) + '" title="' + esc(file.id) + '">'
            + esc(file.name) + '</span>'
            + '<span class="dir" title="' + esc(file.dir) + '">' + esc(file.dir) + '</span></div>';

        html += '<div class="metrics">'
            + metric(num(file.lines), 'LOC')
            + metric(file.complexity, 'complexity')
            + metric(file.cognitive || '—', 'cognitive')
            + '</div>';

        if (card.flags.length) {
            html += '<div class="flags">';
            for (var i = 0; i < card.flags.length; i++) {
                var flag = card.flags[i];
                html += '<span class="flag ' + esc(flag.tone) + '">' + esc(flag.icon + ' ' + flag.label) + '</span>';
            }
            html += '</div>';
        }

        html += riskBlock(card.risk);
        html += connections(card);
        html += '<div class="actions">'
            + '<div class="menu-wrap">'
            + '<button data-act="view" aria-haspopup="true" title="Open this file in the Aura panel">◫ View in ▾</button>'
            + '<div class="view-menu" id="view-menu">'
            + '<div data-view="graph">✦ 3D Graph</div>'
            + '<div data-view="city">🏙️ City</div>'
            + '<div data-view="treemap">🗺️ Treemap</div>'
            + '</div></div>'
            + '<button data-act="blast" title="Every file impacted if this one changes">💥 Blast</button>'
            + '</div>';
        return html;
    }

    function renderRepo(repo) {
        var html = '<div class="head"><span class="name muted">No analyzed file open</span></div>'
            + '<div class="metrics">'
            + metric(num(repo.files), 'files')
            + metric(num(repo.links), 'links')
            + metric(num(repo.highRisk), 'high risk')
            + metric(num(repo.cycles), 'in cycles')
            + '</div>'
            + '<div class="flags">'
            + '<span class="flag bad">☠ ' + num(repo.dead) + ' dead</span>'
            + '<span class="flag warn">🏛 ' + num(repo.violations) + ' violations</span>'
            + '<span class="flag info">✏ ' + num(repo.dirty) + ' changed</span>'
            + '</div>';
        if (repo.hotspots.length) {
            html += '<div class="label">Riskiest files</div>';
            for (var i = 0; i < repo.hotspots.length; i++) {
                var spot = repo.hotspots[i];
                html += '<div class="hotspot" data-open="' + esc(spot.id) + '" title="' + esc(spot.id) + '">'
                    + '<span class="s">' + esc(spot.score) + '</span>'
                    + '<span class="n">' + esc(spot.name) + '</span></div>';
            }
        }
        return html;
    }

    function render(state) {
        if (state.card) {
            root.innerHTML = renderCard(state.card);
            return;
        }
        if (state.repo) {
            root.innerHTML = renderRepo(state.repo);
            return;
        }
        root.innerHTML = '<div class="empty">No analysis yet.</div>'
            + '<div class="actions"><button class="primary" data-act="analyze">Analyze workspace</button></div>';
    }

    function closeViewMenu() {
        var menu = document.getElementById('view-menu');
        if (menu) menu.classList.remove('open');
    }

    function toggleViewMenu() {
        var menu = document.getElementById('view-menu');
        if (menu) menu.classList.toggle('open');
    }

    root.addEventListener('click', function (event) {
        var el = event.target;
        var open = null;
        var act = null;
        var view = null;
        while (el && el !== root && el.getAttribute) {
            if (view === null) view = el.getAttribute('data-view');
            if (open === null) open = el.getAttribute('data-open');
            if (act === null) act = el.getAttribute('data-act');
            el = el.parentNode;
        }
        if (view) {
            closeViewMenu();
            vscode.postMessage({ type: 'view', tab: view });
            return;
        }
        if (open) {
            closeViewMenu();
            vscode.postMessage({ type: 'open', id: open });
            return;
        }
        if (act === 'view') {
            toggleViewMenu();
            return;
        }
        if (act) {
            closeViewMenu();
            vscode.postMessage({ type: act });
            return;
        }
        // A click anywhere else closes the menu, exactly like the panel's.
        closeViewMenu();
    });

    window.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') closeViewMenu();
    });

    window.addEventListener('message', function (event) {
        var message = event.data || {};
        if (message.type === 'state') render(message);
    });

    // Ask for the state now that the listener exists. The host answers with the
    // current card, so a rebuilt webview (the section was collapsed) never sits
    // on "Loading…".
    vscode.postMessage({ type: 'ready' });
})();
</script>
</body>
</html>`;
}
