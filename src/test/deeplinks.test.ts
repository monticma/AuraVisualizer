import { describe, it, expect } from 'vitest';
import {
    MAX_VIEW_LINK_BYTES,
    VIEW_LINK_VERSION,
    buildViewLinkUri,
    decodeViewLink,
    encodeViewLink,
    sanitizeViewLinkPayload,
    stateParamFromQuery,
    type ViewLinkPayload,
} from '../deeplinks';

function decodeRaw(json: string) {
    return decodeViewLink(Buffer.from(json, 'utf8').toString('base64url'));
}

/** Reason of a rejected payload (`undefined` when it was accepted). */
function decodeReason(json: string): string | undefined {
    const result = decodeRaw(json);
    return result.ok ? undefined : result.reason;
}

const sample: ViewLinkPayload = {
    v: VIEW_LINK_VERSION,
    t: 'risk',
    s: {
        activeLanguages: ['typescript', 'css'],
        heatmapMode: 'complexity',
        confidenceMin: 0.8,
        showLabels: true,
        focusDepth: 2,
        palettePositions: { warps: { left: '10px', top: '20px' } },
    },
    p: {
        pos: { x: 1, y: 2, z: 3 },
        target: { x: 0, y: 0, z: 0 },
        quat: { x: 0, y: 0, z: 0, w: 1 },
        up: { x: 0, y: 1, z: 0 },
        fov: 50,
        anchor: { id: 'src/extension.ts', posOffset: { x: 4, y: 0, z: 0 }, targetOffset: { x: 0, y: 0, z: 0 }, scaleRef: 4800 },
    },
    q: { expr: "risk > 60 && layer == 'domain'", mode: 'highlight' },
    w: { name: 'AuraVisualizer', files: 512 },
};

describe('deeplinks — encode / decode', () => {
    it('round-trips a full payload', () => {
        const decoded = decodeViewLink(encodeViewLink(sample));
        expect(decoded).toEqual({ ok: true, payload: sample });
    });

    it('produces a URL-safe parameter without padding', () => {
        const encoded = encodeViewLink(sample);
        expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(encoded).not.toContain('=');
    });

    it('keeps non-ASCII text intact', () => {
        const payload: ViewLinkPayload = { v: VIEW_LINK_VERSION, q: { expr: 'name ~ "réseau"', mode: 'filter' } };
        const decoded = decodeViewLink(encodeViewLink(payload));
        expect(decoded).toEqual({ ok: true, payload });
    });

    it('builds the vscode:// URI and reads its state back', () => {
        const uri = buildViewLinkUri('vscode', 'monticma-aura.aura-visualizer-3D', sample);
        expect(uri.startsWith('vscode://monticma-aura.aura-visualizer-3D/open?state=')).toBe(true);
        const state = stateParamFromQuery(uri.slice(uri.indexOf('?') + 1));
        expect(decodeViewLink(state)).toEqual({ ok: true, payload: sample });
    });
});

describe('deeplinks — stateParamFromQuery', () => {
    it('accepts a query string with or without the question mark', () => {
        expect(stateParamFromQuery('?state=abc&other=1')).toBe('abc');
        expect(stateParamFromQuery('other=1&state=abc')).toBe('abc');
        expect(stateParamFromQuery('state=')).toBe('');
        expect(stateParamFromQuery('other=1')).toBeUndefined();
        expect(stateParamFromQuery('')).toBeUndefined();
    });

    it('decodes percent-encoded values', () => {
        expect(stateParamFromQuery('state=a%2Bb%3D')).toBe('a+b=');
    });
});

describe('deeplinks — rejection', () => {
    it('refuses empty input', () => {
        expect(decodeViewLink(undefined)).toEqual({ ok: false, reason: 'empty' });
        expect(decodeViewLink('')).toEqual({ ok: false, reason: 'empty' });
    });

    it('refuses something that is not base64url', () => {
        expect(decodeViewLink('https://example.com/?state=<script>')).toEqual({ ok: false, reason: 'not-a-view-link' });
        expect(decodeViewLink('abc def')).toEqual({ ok: false, reason: 'not-a-view-link' });
    });

    it('refuses non-JSON and non-object payloads', () => {
        expect(decodeReason('not json at all')).toBe('not-json');
        expect(decodeReason('[1,2,3]')).toBe('invalid-payload');
        expect(decodeReason('"just a string"')).toBe('invalid-payload');
    });

    it('refuses an unknown version instead of guessing', () => {
        expect(decodeRaw(JSON.stringify({ v: 2, s: { showLabels: true } }))).toEqual({ ok: false, reason: 'unsupported-version' });
        expect(decodeRaw(JSON.stringify({ s: { showLabels: true } }))).toEqual({ ok: false, reason: 'unsupported-version' });
    });

    it('refuses a payload that restores nothing', () => {
        expect(decodeRaw(JSON.stringify({ v: 1 }))).toEqual({ ok: false, reason: 'invalid-payload' });
        expect(decodeRaw(JSON.stringify({ v: 1, t: 'risk' }))).toEqual({ ok: false, reason: 'invalid-payload' });
        expect(decodeRaw(JSON.stringify({ v: 1, s: { unknown: true } }))).toEqual({ ok: false, reason: 'invalid-payload' });
    });

    it('refuses oversized links', () => {
        const huge: ViewLinkPayload = {
            v: VIEW_LINK_VERSION,
            s: { activeLanguages: Array.from({ length: 200 }, () => 'x'.repeat(200)) },
        };
        expect(Buffer.byteLength(JSON.stringify(huge), 'utf8')).toBeGreaterThan(MAX_VIEW_LINK_BYTES);
        expect(decodeViewLink(encodeViewLink(huge))).toEqual({ ok: false, reason: 'too-large' });
    });
});

describe('deeplinks — sanitising', () => {
    it('drops unknown keys, tabs and heatmaps', () => {
        const payload = sanitizeViewLinkPayload({
            v: 1,
            t: 'evil-tab',
            s: { heatmapMode: 'evil', showLabels: true, owner: 'root' },
        });
        expect(payload).toEqual({ v: 1, s: { showLabels: true } });
    });

    it('clamps numbers into sane ranges', () => {
        const payload = sanitizeViewLinkPayload({
            v: 1,
            s: {
                spreadMultiplier: 1e9,
                focusDepth: -3,
                confidenceMin: 42,
                cochangeWindow: 999999,
                nodeSizeMultiplier: Number.NaN,
            },
        });
        expect(payload?.s).toEqual({ confidenceMin: 1, cochangeWindow: 3650, spreadMultiplier: 5, focusDepth: 1 });
    });

    it('only keeps real booleans and caps list sizes', () => {
        const payload = sanitizeViewLinkPayload({
            v: 1,
            s: {
                dagMode: 'yes',
                showLabels: true,
                activeLanguages: Array.from({ length: 500 }, (_, i) => `lang-${i}`),
            },
        });
        expect(payload?.s?.dagMode).toBeUndefined();
        expect(payload?.s?.showLabels).toBe(true);
        expect((payload?.s?.activeLanguages as string[]).length).toBe(200);
    });

    it('strips control characters from strings', () => {
        const payload = sanitizeViewLinkPayload({
            v: 1,
            q: { expr: 'risk\u0000 > 60', mode: 'select' },
        });
        expect(payload?.q).toEqual({ expr: 'risk > 60', mode: 'select' });
    });

    it('rejects a non-finite camera pose but keeps the rest', () => {
        const nanPose = sanitizeViewLinkPayload({
            v: 1,
            s: { showLabels: true },
            p: { pos: { x: Number.NaN, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } },
        });
        expect(nanPose?.p).toBeUndefined();
        expect(nanPose?.s).toEqual({ showLabels: true });
    });

    it('clamps the field of view and keeps a valid anchor', () => {
        const payload = sanitizeViewLinkPayload({
            v: 1,
            p: {
                pos: { x: 1, y: 2, z: 3 },
                target: { x: 0, y: 0, z: 0 },
                fov: 500,
                anchor: { id: 'src/a.ts', posOffset: { x: 1, y: 0, z: 0 }, targetOffset: { x: 0, y: 0, z: 0 }, scaleRef: -8 },
            },
        });
        expect(payload?.p?.fov).toBe(120);
        expect(payload?.p?.anchor?.id).toBe('src/a.ts');
        expect(payload?.p?.anchor?.scaleRef).toBe(0.0001);
    });

    it('drops an anchor without an id', () => {
        const payload = sanitizeViewLinkPayload({
            v: 1,
            p: { pos: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 }, anchor: { posOffset: { x: 1, y: 0, z: 0 } } },
        });
        expect(payload?.p?.pos).toEqual({ x: 1, y: 2, z: 3 });
        expect(payload?.p?.anchor).toBeUndefined();
    });

    it('sanitises the query mode and the workspace hint', () => {
        const payload = sanitizeViewLinkPayload({
            v: 1,
            q: { expr: 'loc > 500', mode: 'whatever' },
            w: { name: '  Aura  ', files: 12.6 },
        });
        expect(payload?.q).toEqual({ expr: 'loc > 500', mode: 'filter' });
        expect(payload?.w).toEqual({ name: 'Aura', files: 13 });
    });

    it('only keeps CSS pixel positions for floating panels', () => {
        const payload = sanitizeViewLinkPayload({
            v: 1,
            s: { palettePositions: { warps: { left: '12px', top: 'javascript:alert(1)' }, nope: { left: '1px' } } },
        });
        expect(payload?.s?.palettePositions).toEqual({ warps: { left: '12px' } });
    });
});
