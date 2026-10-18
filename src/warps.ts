/**
 * warps.ts — camera bookmarks ("Warp points"), persisted to `.aura/warps.json`.
 *
 * Pure module (no `vscode` import) so it can be unit-tested: the webview
 * provider owns the file I/O, this module owns the data shape, validation and
 * merging. A warp is a named camera pose (position + orientation + view
 * target + FOV) — capture the current view, fly back to it later. They are
 * the anchors that keep free-flight navigation from getting you lost.
 */

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

/** Camera orientation (unit quaternion). */
export interface Quat {
    x: number;
    y: number;
    z: number;
    w: number;
}

/**
 * Node anchor that keeps a warp meaningful across sessions: the force layout
 * places nodes differently on every start, so an absolute camera pose drifts.
 * The camera pose is stored as offsets from a node position and rebuilt
 * against that node's CURRENT position when travelling.
 */
export interface WarpAnchor {
    /** Node id in the graph (workspace-relative file path). */
    id: string;
    /** Node position at capture time — fallback when the layout is missing. */
    pos: Vec3;
    /** camera.pos − anchor.pos at capture time. */
    posOffset: Vec3;
    /** camera.target − anchor.pos at capture time. */
    targetOffset: Vec3;
    /**
     * Layout scale reference (graph bounding radius at capture time). The
     * force layout is more or less spread out between sessions; offsets are
     * rescaled by radiusNow / scaleRef so the framing distance is preserved.
     */
    scaleRef?: number;
}

export interface Warp {
    id: string;
    name: string;
    /** Camera position. */
    pos: Vec3;
    /**
     * Camera orientation. Kept as a fallback: the effective roll of the view
     * lives in `up` (TrackballControls re-applies lookAt every frame), but
     * the quaternion lets an older warp rebuild an exact up vector
     * (up = quat × world-up).
     */
    quat?: Quat;
    /**
     * Camera up vector. TrackballControls re-applies lookAt(target) on every
     * frame using this vector, so restoring it (with pos/target) is what
     * actually reproduces the captured orientation of the view.
     */
    up?: Vec3;
    /** Looked-at point (orbit controls target). */
    target: Vec3;
    /** Optional vertical field of view, in degrees. */
    fov?: number;
    /**
     * Node anchor (optional). Absent on warps captured before anchoring, or
     * when no node was close enough to the looked-at point.
     */
    anchor?: WarpAnchor;
    /** Exclusive quick slot, 1..QUICK_SLOT_COUNT (Alt+1..9 in the webview). */
    quickSlot?: number;
    createdAt: number;  // epoch ms
    updatedAt: number;  // epoch ms
}

export type WarpList = Warp[];

export const MAX_WARP_NAME = 60;
/** Guardrail so a hand-edited or runaway file cannot flood the panel. */
export const MAX_WARPS = 100;
export const QUICK_SLOT_COUNT = 9;
const MIN_FOV = 15;
const MAX_FOV = 120;

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function normalizeVec3(value: unknown): Vec3 | null {
    if (!value || typeof value !== 'object') return null;
    const rec = value as { x?: unknown; y?: unknown; z?: unknown };
    if (!isFiniteNumber(rec.x) || !isFiniteNumber(rec.y) || !isFiniteNumber(rec.z)) return null;
    return { x: rec.x, y: rec.y, z: rec.z };
}

/** Unit quaternion (rescaled), or undefined when absent/invalid. */
function normalizeQuat(value: unknown): Quat | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const rec = value as { x?: unknown; y?: unknown; z?: unknown; w?: unknown };
    if (!isFiniteNumber(rec.x) || !isFiniteNumber(rec.y) || !isFiniteNumber(rec.z) || !isFiniteNumber(rec.w)) {
        return undefined;
    }
    const len = Math.hypot(rec.x, rec.y, rec.z, rec.w);
    if (!(len > 1e-6)) return undefined;
    return { x: rec.x / len, y: rec.y / len, z: rec.z / len, w: rec.w / len };
}

/** Unit vector (rescaled), or undefined when absent/degenerate. */
function normalizeUnitVec3(value: unknown): Vec3 | undefined {
    const v = normalizeVec3(value);
    if (!v) return undefined;
    const len = Math.hypot(v.x, v.y, v.z);
    if (!(len > 1e-6)) return undefined;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/** Trimmed, whitespace-collapsed and capped; blank names fall back. */
export function normalizeWarpName(value: unknown, fallback: string = 'Warp'): string {
    if (typeof value !== 'string') return fallback;
    const cleaned = value.replace(/\s+/g, ' ').trim().slice(0, MAX_WARP_NAME);
    return cleaned || fallback;
}

/** Quick slot 1..QUICK_SLOT_COUNT, or undefined when absent/invalid. */
export function normalizeQuickSlot(value: unknown): number | undefined {
    if (!isFiniteNumber(value)) return undefined;
    const slot = Math.round(value);
    return slot >= 1 && slot <= QUICK_SLOT_COUNT ? slot : undefined;
}

/** FOV guarded to a sane range, or undefined. */
export function normalizeFov(value: unknown): number | undefined {
    if (!isFiniteNumber(value) || value <= 0) return undefined;
    return Math.min(MAX_FOV, Math.max(MIN_FOV, value));
}
/** Node anchor, or undefined when any part is missing/invalid. */
function normalizeAnchor(value: unknown): WarpAnchor | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const rec = value as Record<string, unknown>;
    const id = typeof rec.id === 'string' ? rec.id.trim() : '';
    if (!id) return undefined;
    const pos = normalizeVec3(rec.pos);
    const posOffset = normalizeVec3(rec.posOffset);
    const targetOffset = normalizeVec3(rec.targetOffset);
    if (!pos || !posOffset || !targetOffset) return undefined;
    const anchor: WarpAnchor = { id, pos, posOffset, targetOffset };
    if (isFiniteNumber(rec.scaleRef) && rec.scaleRef > 0) anchor.scaleRef = rec.scaleRef;
    return anchor;
}
export function generateWarpId(now: number = Date.now()): string {
    return 'w_' + now.toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * Build a warp from a captured pose (webview capture/edit or stored entry).
 * Returns null when the pose is unusable (missing / non-finite coordinates).
 */
export function makeWarp(value: unknown, now: number = Date.now(), fallbackName: string = 'Warp'): Warp | null {
    if (!value || typeof value !== 'object') return null;
    const rec = value as Record<string, unknown>;
    const pos = normalizeVec3(rec.pos);
    const target = normalizeVec3(rec.target);
    if (!pos || !target) return null;
    const createdAt = isFiniteNumber(rec.createdAt) ? rec.createdAt : now;
    return {
        id: typeof rec.id === 'string' && rec.id ? rec.id : generateWarpId(now),
        name: normalizeWarpName(rec.name, fallbackName),
        pos,
        target,
        quat: normalizeQuat(rec.quat),
        up: normalizeUnitVec3(rec.up),
        fov: normalizeFov(rec.fov),
        anchor: normalizeAnchor(rec.anchor),
        quickSlot: normalizeQuickSlot(rec.quickSlot),
        createdAt,
        updatedAt: isFiniteNumber(rec.updatedAt) ? rec.updatedAt : now,
    };
}

/** Validate one stored entry; the index drives the "Warp N" fallback name. */
export function normalizeWarp(value: unknown, index: number = 0, now: number = Date.now()): Warp | null {
    return makeWarp(value, now, 'Warp ' + (index + 1));
}

/** Tolerant parse: a corrupt or missing file reads as an empty list, never throws. */
export function parseWarps(raw: string | undefined | null): WarpList {
    if (!raw) return [];
    try {
        const data = JSON.parse(raw);
        const entries = Array.isArray(data)
            ? data
            : data && typeof data === 'object'
                ? (data as { warps?: unknown }).warps
                : undefined;
        if (!Array.isArray(entries)) return [];
        const out: WarpList = [];
        const seen = new Set<string>();
        for (let i = 0; i < entries.length && out.length < MAX_WARPS; i++) {
            const warp = normalizeWarp(entries[i], i);
            if (!warp || seen.has(warp.id)) continue;
            seen.add(warp.id);
            out.push(warp);
        }
        return out;
    } catch {
        return [];
    }
}

export function serializeWarps(list: WarpList): string {
    return JSON.stringify({ version: 1, warps: list }, null, 2) + '\n';
}

/** Quick slots are exclusive: the slot moves to the warp being saved. */
function releaseQuickSlot(list: WarpList, slot: number | undefined, keepId: string): WarpList {
    if (slot === undefined) return list;
    let changed = false;
    const next = list.map((warp) => {
        if (warp.quickSlot === slot && warp.id !== keepId) {
            changed = true;
            return { ...warp, quickSlot: undefined };
        }
        return warp;
    });
    return changed ? next : list;
}

/** Add or replace a warp by id; assigning a quick slot steals it. Capped. */
export function upsertWarp(list: WarpList, warp: Warp): WarpList {
    let next = releaseQuickSlot(list, warp.quickSlot, warp.id);
    const index = next.findIndex((w) => w.id === warp.id);
    if (index >= 0) {
        next = next.slice();
        next[index] = warp;
        return next;
    }
    if (next.length >= MAX_WARPS) {
        // Full: drop the oldest warp (by creation time) to make room.
        let oldest = 0;
        for (let i = 1; i < next.length; i++) {
            if (next[i].createdAt < next[oldest].createdAt) oldest = i;
        }
        next = next.slice();
        next.splice(oldest, 1);
    }
    return next.concat([warp]);
}

export function removeWarp(list: WarpList, id: string): WarpList {
    const index = list.findIndex((w) => w.id === id);
    if (index < 0) return list; // no-op keeps the same reference
    const next = list.slice();
    next.splice(index, 1);
    return next;
}

export function warpByQuickSlot(list: WarpList, slot: number): Warp | undefined {
    return list.find((w) => w.quickSlot === slot);
}
