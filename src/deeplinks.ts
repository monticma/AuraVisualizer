/**
 * deeplinks.ts — Encode and decode `vscode://<extension-id>/open?state=…`
 * "share this view" links.
 *
 * A view link can arrive from anywhere — a README, a chat message, a pull
 * request — so the decoder is deliberately paranoid: versioned payload, size
 * cap, whitelisted keys, clamped numbers, finite camera coordinates. It never
 * throws, and a link can only restore *view state*: nothing executable, no
 * filesystem writes, no commands.
 *
 * Pure module (no `vscode` import) — unit-tested in `src/test/deeplinks.test.ts`.
 */

export const VIEW_LINK_VERSION = 1;
/** Decoded JSON ceiling. A real link is ~1.5–2 KB. */
export const MAX_VIEW_LINK_BYTES = 8 * 1024;

export const VIEW_LINK_TABS = [
    'graph', 'treemap', 'dsm', 'chord', 'metrics',
    'timeline', 'table', 'risk', 'arch', 'coupling',
] as const;
export type ViewLinkTab = (typeof VIEW_LINK_TABS)[number];

export const VIEW_LINK_HEATMAPS = [
    'off', 'complexity', 'cognitive', 'fanIn', 'fanOut', 'loc',
    'churn', 'cochange', 'lastModified', 'layers', 'community',
] as const;

export const VIEW_LINK_QUERY_MODES = ['highlight', 'filter', 'select'] as const;
export type ViewLinkQueryMode = (typeof VIEW_LINK_QUERY_MODES)[number];

export interface ViewLinkVec3 {
    x: number;
    y: number;
    z: number;
}

export interface ViewLinkQuat extends ViewLinkVec3 {
    w: number;
}

export interface ViewLinkAnchor {
    id: string;
    posOffset: ViewLinkVec3;
    targetOffset: ViewLinkVec3;
    /** Layout extent when the pose was captured — used to rescale offsets. */
    scaleRef?: number;
}

export interface ViewLinkPose {
    pos: ViewLinkVec3;
    target: ViewLinkVec3;
    quat?: ViewLinkQuat;
    up?: ViewLinkVec3;
    fov?: number;
    anchor?: ViewLinkAnchor;
}

export interface ViewLinkWorkspace {
    name?: string;
    files?: number;
}

export interface ViewLinkQuery {
    expr: string;
    mode: ViewLinkQueryMode;
}

export interface ViewLinkPayload {
    v: number;
    /** Active tab. */
    t?: ViewLinkTab;
    /** Whitelisted slice of the webview view state (`applyViewState` input). */
    s?: Record<string, unknown>;
    /** Camera pose, anchored to files like a warp so a rebuilt layout still matches. */
    p?: ViewLinkPose;
    /** Query bar expression + mode, re-applied on open. */
    q?: ViewLinkQuery;
    /** Which workspace captured the link — informational only. */
    w?: ViewLinkWorkspace;
}

export type ViewLinkDecode =
    | { ok: true; payload: ViewLinkPayload }
    | { ok: false; reason: string };

// ============================================================
// Encoding
// ============================================================

function toBase64Url(text: string): string {
    return Buffer.from(text, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/u, '');
}

function fromBase64Url(text: string): string {
    return Buffer.from(text.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

/** JSON payload → URL-safe state parameter (no padding, no `+`/`/`). */
export function encodeViewLink(payload: ViewLinkPayload): string {
    return toBase64Url(JSON.stringify(payload));
}

/** Full `vscode://` URI for a payload (`uriScheme` is `vscode.env.uriScheme`). */
export function buildViewLinkUri(uriScheme: string, extensionId: string, payload: ViewLinkPayload): string {
    return `${uriScheme}://${extensionId}/open?state=${encodeViewLink(payload)}`;
}

/** Extract the `state` parameter from a URI query string (with or without `?`). */
export function stateParamFromQuery(query: string): string | undefined {
    const clean = query.startsWith('?') ? query.slice(1) : query;
    for (const part of clean.split('&')) {
        if (!part) continue;
        const eq = part.indexOf('=');
        const key = eq < 0 ? part : part.slice(0, eq);
        if (key !== 'state') continue;
        const value = eq < 0 ? '' : part.slice(eq + 1);
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    }
    return undefined;
}

// ============================================================
// Decoding
// ============================================================

export function decodeViewLink(raw: string | null | undefined): ViewLinkDecode {
    if (typeof raw !== 'string' || raw.length === 0) return { ok: false, reason: 'empty' };
    if (raw.length > MAX_VIEW_LINK_BYTES * 2) return { ok: false, reason: 'too-large' };
    if (!/^[A-Za-z0-9_-]+$/u.test(raw)) return { ok: false, reason: 'not-a-view-link' };

    let json: string;
    try {
        json = fromBase64Url(raw);
    } catch {
        return { ok: false, reason: 'not-a-view-link' };
    }
    if (Buffer.byteLength(json, 'utf8') > MAX_VIEW_LINK_BYTES) return { ok: false, reason: 'too-large' };

    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        return { ok: false, reason: 'not-json' };
    }
    if (!isRecord(parsed)) return { ok: false, reason: 'invalid-payload' };
    if (parsed.v !== VIEW_LINK_VERSION) return { ok: false, reason: 'unsupported-version' };

    const payload = sanitizeViewLinkPayload(parsed);
    if (!payload) return { ok: false, reason: 'invalid-payload' };
    return { ok: true, payload };
}

/**
 * Rebuild a payload from untrusted JSON: unknown keys are dropped, numbers are
 * clamped, arrays are capped. Returns `undefined` when nothing usable is left.
 */
export function sanitizeViewLinkPayload(raw: unknown): ViewLinkPayload | undefined {
    if (!isRecord(raw) || raw.v !== VIEW_LINK_VERSION) return undefined;

    const payload: ViewLinkPayload = { v: VIEW_LINK_VERSION };

    const tab = VIEW_LINK_TABS.find(candidate => candidate === raw.t);
    if (tab) payload.t = tab;

    const state = sanitizeViewState(raw.s);
    if (state) payload.s = state;

    const pose = sanitizePose(raw.p);
    if (pose) payload.p = pose;

    const query = sanitizeQuery(raw.q);
    if (query) payload.q = query;

    const workspace = sanitizeWorkspace(raw.w);
    if (workspace) payload.w = workspace;

    // A tab on its own restores nothing useful.
    if (!payload.s && !payload.p && !payload.q) return undefined;
    return payload;
}

const VIEW_STATE_BOOLEANS = [
    'dagMode', 'showOrphans', 'showDeadCode', 'showCycles', 'showDirtyOnly',
    'showNotes', 'showCentralityHalos', 'showStaleNotesOnly', 'showGroups',
    'pathMode', 'showLabels', 'followEditor', 'showCochangeLinks',
    'showExplorer', 'showMinimap', 'showWarps',
] as const;

const VIEW_STATE_NUMBERS: Record<string, readonly [number, number]> = {
    cochangeWindow: [1, 3650],
    cochangeMinScore: [0, 1],
    confidenceMin: [0, 1],
    nodeSizeMultiplier: [0.5, 10],
    spreadMultiplier: [0.5, 5],
    focusDepth: [1, 5],
};

const VIEW_STATE_LISTS = ['activeLanguages', 'activeCommunityKeys', 'activeLayers'] as const;

function sanitizeViewState(raw: unknown): Record<string, unknown> | undefined {
    if (!isRecord(raw)) return undefined;
    const state: Record<string, unknown> = {};

    for (const key of VIEW_STATE_BOOLEANS) {
        if (typeof raw[key] === 'boolean') state[key] = raw[key];
    }
    for (const [key, [min, max]] of Object.entries(VIEW_STATE_NUMBERS)) {
        const value = clampNumber(raw[key], min, max);
        if (value !== undefined) state[key] = value;
    }
    for (const key of VIEW_STATE_LISTS) {
        const list = stringList(raw[key]);
        if (list) state[key] = list;
    }
    const heatmap = VIEW_LINK_HEATMAPS.find(candidate => candidate === raw.heatmapMode);
    if (heatmap) state.heatmapMode = heatmap;
    const positions = sanitizePalettePositions(raw.palettePositions);
    if (positions) state.palettePositions = positions;

    return Object.keys(state).length > 0 ? state : undefined;
}

const PX = /^-?\d{1,5}(?:\.\d{1,3})?px$/u;

function px(value: unknown): string | undefined {
    return typeof value === 'string' && PX.test(value) ? value : undefined;
}

function sanitizePalettePositions(raw: unknown): Record<string, Record<string, string>> | undefined {
    if (!isRecord(raw)) return undefined;
    const out: Record<string, Record<string, string>> = {};
    for (const panel of ['warps', 'community', 'minimap'] as const) {
        const entry = raw[panel];
        if (!isRecord(entry)) continue;
        const box: Record<string, string> = {};
        for (const side of ['left', 'top', 'width', 'height'] as const) {
            const value = px(entry[side]);
            if (value) box[side] = value;
        }
        if (Object.keys(box).length > 0) out[panel] = box;
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizePose(raw: unknown): ViewLinkPose | undefined {
    if (!isRecord(raw)) return undefined;
    const pos = vec3(raw.pos);
    const target = vec3(raw.target);
    if (!pos || !target) return undefined;

    const pose: ViewLinkPose = { pos, target };
    const quat = vec4(raw.quat);
    if (quat) pose.quat = quat;
    const up = vec3(raw.up, 1e3);
    if (up) pose.up = up;
    const fov = clampNumber(raw.fov, 10, 120);
    if (fov !== undefined) pose.fov = fov;
    const anchor = sanitizeAnchor(raw.anchor);
    if (anchor) pose.anchor = anchor;
    return pose;
}

function sanitizeAnchor(raw: unknown): ViewLinkAnchor | undefined {
    if (!isRecord(raw)) return undefined;
    const id = shortString(raw.id, 500);
    if (!id) return undefined;
    const posOffset = vec3(raw.posOffset);
    const targetOffset = vec3(raw.targetOffset);
    if (!posOffset || !targetOffset) return undefined;
    const anchor: ViewLinkAnchor = { id, posOffset, targetOffset };
    const scaleRef = clampNumber(raw.scaleRef, 0.0001, 1e9);
    if (scaleRef !== undefined) anchor.scaleRef = scaleRef;
    return anchor;
}

function sanitizeQuery(raw: unknown): ViewLinkQuery | undefined {
    if (!isRecord(raw)) return undefined;
    const expr = shortString(raw.expr, 400);
    if (!expr) return undefined;
    const mode = VIEW_LINK_QUERY_MODES.find(candidate => candidate === raw.mode) ?? 'filter';
    return { expr, mode };
}

function sanitizeWorkspace(raw: unknown): ViewLinkWorkspace | undefined {
    if (!isRecord(raw)) return undefined;
    const workspace: ViewLinkWorkspace = {};
    const name = shortString(raw.name, 120);
    if (name) workspace.name = name;
    const files = clampNumber(raw.files, 0, 1_000_000);
    if (files !== undefined) workspace.files = Math.round(files);
    return workspace.name || workspace.files !== undefined ? workspace : undefined;
}

// ============================================================
// Small validators
// ============================================================

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function clampNumber(value: unknown, min: number, max: number): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    return Math.min(max, Math.max(min, value));
}

function finiteNumber(value: unknown, limit = 1e6): number | undefined {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    return Math.abs(value) > limit ? undefined : value;
}

function vec3(value: unknown, limit = 1e6): ViewLinkVec3 | undefined {
    if (!isRecord(value)) return undefined;
    const x = finiteNumber(value.x, limit);
    const y = finiteNumber(value.y, limit);
    const z = finiteNumber(value.z, limit);
    if (x === undefined || y === undefined || z === undefined) return undefined;
    return { x, y, z };
}

function vec4(value: unknown): ViewLinkQuat | undefined {
    if (!isRecord(value)) return undefined;
    const base = vec3(value, 1);
    const w = finiteNumber(value.w, 1);
    if (!base || w === undefined) return undefined;
    return { ...base, w };
}

function shortString(value: unknown, max: number): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.replace(/[\u0000-\u001f\u007f]/gu, '').trim();
    if (!trimmed || trimmed.length > max) return undefined;
    return trimmed;
}

function stringList(value: unknown, maxItems = 200): string[] | undefined {
    if (!Array.isArray(value)) return undefined;
    const out: string[] = [];
    for (const item of value.slice(0, maxItems)) {
        const text = shortString(item, 200);
        if (text) out.push(text);
    }
    return out.length > 0 ? out : undefined;
}
