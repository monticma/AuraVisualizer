import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The sidebar card is a webview: its script lives in a template literal inside
 * `aura-view.ts`, so nothing type-checks it and nothing runs it in CI. These
 * tests extract that script and execute it against a minimal DOM stub — enough
 * to prove the two things that once broke: the script must **ask** for its state
 * (the section is rebuilt every time it is re-expanded, so a host `postMessage`
 * fired right after `html =` arrives before the listener exists), and a `state`
 * message must reach the renderer.
 */
const SOURCE = readFileSync(join(__dirname, '..', 'sidebar', 'aura-view.ts'), 'utf-8');
const OPEN = '<script nonce="${nonce}">';

function scriptBody(): string {
    const start = SOURCE.indexOf(OPEN);
    const end = SOURCE.indexOf('</script>', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    return SOURCE.slice(start + OPEN.length, end);
}

interface FakeElement {
    innerHTML: string;
    addEventListener(type: string, handler: (event: unknown) => void): void;
    getAttribute(name: string): string | null;
    hasAttribute(name: string): boolean;
    classList: { add(): void; remove(): void; toggle(): void; contains(): boolean };
    parentNode: FakeElement | null;
}

function fakeElement(): FakeElement {
    return {
        innerHTML: '',
        addEventListener: () => undefined,
        getAttribute: () => null,
        hasAttribute: () => false,
        classList: { add: () => undefined, remove: () => undefined, toggle: () => undefined, contains: () => false },
        parentNode: null,
    };
}

function load() {
    const posted: { type?: string }[] = [];
    const windowListeners: Record<string, (event: unknown) => void> = {};
    const elements: Record<string, FakeElement> = {};

    const document = {
        getElementById(id: string): FakeElement {
            if (!elements[id]) elements[id] = fakeElement();
            return elements[id];
        },
        querySelector: () => null,
    };
    const window = {
        addEventListener(type: string, handler: (event: unknown) => void) {
            windowListeners[type] = handler;
        },
    };
    const acquireVsCodeApi = () => ({ postMessage: (message: { type?: string }) => posted.push(message) });

    new Function('window', 'document', 'acquireVsCodeApi', scriptBody())(
        window,
        document,
        acquireVsCodeApi,
    );

    return {
        posted,
        root: (): FakeElement => document.getElementById('root'),
        send(message: unknown) {
            windowListeners.message({ data: message });
        },
    };
}

const CARD = {
    file: {
        id: 'src/a.ts', name: 'a.ts', dir: 'src', language: 'typescript',
        lines: 120, complexity: 30, cognitive: 8, fanIn: 5, fanOut: 2, pagerank: null, sizeKb: 2,
    },
    risk: {
        score: 72, bucket: 'high', topLabel: 'top 8%', reasons: ['high fan-in (5)'],
        stats: '3 commits · 40 % rewritten', spark: '0.0,20.0 84.0,0.0', direction: 'up', windowDays: 90,
    },
    flags: [{ icon: '⟳', label: '2 cycles', tone: 'bad' }],
    out: [{ id: 'src/b.ts', name: 'b.ts', type: 'import', confidence: 1 }],
    in: [{ id: 'src/c.ts', name: 'c.ts', type: 'call', confidence: 1 }],
    outTotal: 1,
    inTotal: 1,
    docs: 0,
};

describe('the Aura card webview script', () => {
    it('parses as JavaScript', () => {
        expect(() => new Function(scriptBody())).not.toThrow();
    });

    it('asks for its state before anything else', () => {
        const view = load();
        // The re-expanded section is a brand-new document: without this message
        // it stays on "Loading…" until the editor switches file.
        expect(view.posted[0]).toEqual({ type: 'ready' });
        expect(view.posted).toHaveLength(1);
    });

    it('renders the card it is handed', () => {
        const view = load();
        view.send({ type: 'state', card: CARD, repo: null });
        const html = view.root().innerHTML;
        expect(html).toContain('a.ts');
        expect(html).toContain('>72<');
        expect(html).toContain('high fan-in (5)');
        expect(html).toContain('⟳ 2 cycles');
        expect(html).toContain('b.ts');
        expect(html).toContain('c.ts');
        expect(html).toContain('◫ View in');
    });

    it('falls back to the repository summary, then to the empty state', () => {
        const view = load();
        view.send({
            type: 'state', card: null,
            repo: { files: 762, links: 3070, highRisk: 34, cycles: 3, dead: 118, violations: 7, dirty: 6, hotspots: [] },
        });
        expect(view.root().innerHTML).toContain('762');
        view.send({ type: 'state', card: null, repo: null });
        expect(view.root().innerHTML).toContain('Analyze workspace');
    });

    it('truncates a long neighbour name in the middle and keeps the path in the tooltip', () => {
        const view = load();
        view.send({
            type: 'state',
            repo: null,
            card: {
                ...CARD,
                out: [{ id: 'src/graph-builders.ts', name: 'graph-builders.ts', type: 'import', confidence: 1 }],
            },
        });
        const html = view.root().innerHTML;
        expect(html).toContain('graph-bui….ts');
        expect(html).toContain('<title>src/graph-builders.ts · import</title>');
        expect(html).not.toContain('>graph-builders.ts<');
    });

    it('keeps every label inside the SVG viewBox', () => {
        // The SVG clips outside its viewBox: a label anchored outside a column
        // used to lose its start (left) or its end (right) with no ellipsis, so
        // nothing warned that it had been cut.
        const view = load();
        view.send({
            type: 'state',
            repo: null,
            card: {
                ...CARD,
                in: [
                    { id: 'src/graph-builders.ts', name: 'graph-builders.ts', type: 'import', confidence: 1 },
                    { id: 'src/history-worker.ts', name: 'history-worker.ts', type: 'call', confidence: 0.6 },
                    { id: 'src/parsers.test.ts', name: 'parsers.test.ts', type: 'import', confidence: 1 },
                ],
                out: [{ id: 'src/base-parser.ts', name: 'base-parser.ts', type: 'import', confidence: 1 }],
                inTotal: 3,
                outTotal: 1,
            },
        });
        const width = 260;
        const runs = [...view.root().innerHTML.matchAll(/<text ([^>]*)>([^<]*)<\/text>/g)];
        expect(runs.length).toBeGreaterThan(0);
        for (const [, attributes, text] of runs) {
            const x = Number(/x="([\d.-]+)"/.exec(attributes)?.[1]);
            const anchor = /text-anchor="(\w+)"/.exec(attributes)?.[1] || 'start';
            // Pessimistic advance: the view budgets with 0.6 em as well.
            const runWidth = text.length * 0.6 * 9.5;
            const left = anchor === 'end' ? x - runWidth : anchor === 'middle' ? x - runWidth / 2 : x;
            expect(left).toBeGreaterThanOrEqual(0);
            expect(left + runWidth).toBeLessThanOrEqual(width);
        }
    });
});
