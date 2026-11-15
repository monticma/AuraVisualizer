import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * `webview/js/export-menu.js` owns the popover shared by Export, "Open in…" and
 * the file right-click menu. The file entries are pure data plus a `run()`, so
 * they can be tested the way the browser evaluates them — no bundler, no DOM
 * beyond what the module touches at load time.
 */
type Entry = { label: string; hint: string; run: () => void };
type OpenInApi = {
    fileEntries: (id: string, handlers: any) => Entry[];
    openAt: (x: number, y: number, entries: Entry[], className?: string) => boolean;
    entriesFor: (tab: string) => Entry[];
    isOpen: () => boolean;
};

let openIn: OpenInApi;

/** Minimal document: the module only builds DOM inside the functions we skip. */
const documentStub = {
    addEventListener() {},
    removeEventListener() {},
    body: { appendChild() {} },
    createElement() {
        throw new Error('no DOM in this test');
    },
};

beforeAll(() => {
    const src = readFileSync(join(__dirname, '..', '..', 'webview', 'js', 'export-menu.js'), 'utf8');
    const win: any = {};
    new Function('window', 'document', src)(win, documentStub);
    win.AuraExportMenu.init(); // wires the attribute delegation only
    openIn = win.AuraOpenIn;
});

const labels = (entries: Entry[]) => entries.map((e) => e.label);

describe('file context menu — entries', () => {
    it('offers exactly the three destinations, in order', () => {
        const entries = openIn.fileEntries('src/a.ts', {});
        expect(entries).toHaveLength(3);
        expect(labels(entries)).toEqual(['📄 Open source', '✦ 3D Graph', '🏙️ City']);
        // Every entry explains itself: the popover shows the hint under the label.
        expect(entries.every((e) => typeof e.hint === 'string' && e.hint.length > 0)).toBe(true);
    });

    it('opens the editor for the file it was built for', () => {
        const opened: string[] = [];
        const entries = openIn.fileEntries('src/deep/a.ts', { openSource: (id: string) => opened.push(id) });
        entries[0].run();
        expect(opened).toEqual(['src/deep/a.ts']);
    });

    it('sends the file to the 3D graph and to the City, by id', () => {
        const jumps: Array<[string, string]> = [];
        const entries = openIn.fileEntries('src/b.ts', { selectIn: (tab: string, id: string) => jumps.push([tab, id]) });
        entries[1].run();
        entries[2].run();
        expect(jumps).toEqual([
            ['graph', 'src/b.ts'],
            ['city', 'src/b.ts'],
        ]);
    });

    it('never throws when a handler is missing', () => {
        const entries = openIn.fileEntries('src/c.ts', {});
        expect(() => entries.forEach((e) => e.run())).not.toThrow();
    });

    it('is exposed alongside the cursor-anchored opener', () => {
        expect(typeof openIn.fileEntries).toBe('function');
        expect(typeof openIn.openAt).toBe('function');
    });

    it('can swap the second destination — the City asks for the Treemap', () => {
        const jumps: Array<[string, string]> = [];
        const entries = openIn.fileEntries('src/b.ts', {
            selectIn: (tab: string, id: string) => jumps.push([tab, id]),
            destinations: ['graph', 'treemap'],
        });
        expect(labels(entries)).toEqual(['📄 Open source', '✦ 3D Graph', '🗺️ Treemap']);
        entries[1].run();
        entries[2].run();
        expect(jumps).toEqual([
            ['graph', 'src/b.ts'],
            ['treemap', 'src/b.ts'],
        ]);
    });

    it('ignores a destination it does not know', () => {
        const entries = openIn.fileEntries('src/b.ts', { destinations: ['graph', 'nowhere'] });
        expect(labels(entries)).toEqual(['📄 Open source', '✦ 3D Graph']);
    });

    it('refuses to open an empty menu', () => {
        expect(openIn.openAt(10, 10, [])).toBe(false);
        expect(openIn.isOpen()).toBe(false);
    });
});

describe('file context menu — one path for every list view', () => {
    const read = (file: string) => readFileSync(join(__dirname, '..', '..', 'webview', 'js', file), 'utf8');

    it('views.js builds the menu from the shared entries, not a private copy', () => {
        const src = read('views.js');
        expect(src).toContain('window.AuraOpenIn.fileEntries');
        expect(src).toContain('window.AuraOpenIn.openAt');
        // The three entries are declared in one place only: no local labels.
        expect(src).not.toContain("'Open source'");
        expect(src).not.toContain("'✦ 3D Graph'");
        expect(src).not.toContain("'🏙️ City'");
    });

    it('risk.js delegates to the same menu instead of shipping its own', () => {
        const src = read('risk.js');
        expect(src).toContain('AuraViews.fileMenu');
        expect(src).not.toContain('Open source');
    });

    it('city.js takes both menus from the same declaration', () => {
        const src = read('city.js');
        // The right-click menu and the toolbar's Open-in both come from it.
        expect(src).toContain('window.AuraOpenIn.fileEntries');
        expect(src).toContain("destinations: ['graph', 'treemap']");
        expect(src).not.toContain("'✦ 3D Graph'");
        expect(src).not.toContain("'🗺️ Treemap'");
    });

    it('no list view opens the editor from a plain click any more', () => {
        // The only openFile in the file views is the menu's own entry.
        const views = read('views.js');
        const occurrences = views.split("type: 'openFile'").length - 1;
        expect(occurrences).toBe(1);
        const risk = read('risk.js');
        expect(risk.includes("type: 'openFile'")).toBe(false);
    });
});
