import { describe, it, expect } from 'vitest';
import { PyParser } from '../analyzer/parsers/py-parser';
import { CSSParser } from '../analyzer/parsers/css-parser';
import { HTMLParser } from '../analyzer/parsers/html-parser';
import { makeFileInfo } from './helpers';

// ============================================================
// Python
// ============================================================
describe('PyParser.parse', () => {
    const parser = new PyParser();

    it('extracts import statements', () => {
        const file = makeFileInfo({
            id: 'app.py', content: 'import os\nimport sys\n',
            language: 'python', extension: '.py',
        });
        const rels = parser.parse(file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ target: 'os', type: 'import' });
        expect(rels[1]).toMatchObject({ target: 'sys', type: 'import' });
    });

    it('extracts from ... import statements', () => {
        const file = makeFileInfo({
            id: 'app.py', content: 'from flask import Flask, jsonify\nfrom os.path import join\n',
            language: 'python', extension: '.py',
        });
        const rels = parser.parse(file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ target: 'flask', type: 'from-import' });
        expect(rels[1]).toMatchObject({ target: 'os.path', type: 'from-import' });
    });

    it('returns empty for no imports', () => {
        const file = makeFileInfo({
            id: 'pure.py', content: 'x = 42\nprint(x)\n',
            language: 'python', extension: '.py',
        });
        expect(parser.parse(file)).toHaveLength(0);
    });
});

// ============================================================
// CSS
// ============================================================
describe('CSSParser.parse', () => {
    const parser = new CSSParser();

    it('extracts @import statements', () => {
        const file = makeFileInfo({
            id: 'style.css', content: '@import "reset.css";\n@import url("theme.css");\n',
            language: 'css', extension: '.css',
        });
        const rels = parser.parse(file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ target: 'reset.css', type: 'css-import' });
        expect(rels[1]).toMatchObject({ target: 'theme.css', type: 'css-import' });
    });

    it('ignores url() by default', () => {
        const file = makeFileInfo({
            id: 'style.css', content: 'body { background: url("bg.png"); }\n',
            language: 'css', extension: '.css',
        });
        expect(parser.parse(file)).toHaveLength(0);
    });

    it('includes url() when option set, filtering data: and http:', () => {
        const file = makeFileInfo({
            id: 'style.css',
            content: [
                'body { background: url("bg.png"); }',
                '.icon { background: url("data:image/png;base64,abc"); }',
                '.ext { background: url("https://example.com/img.png"); }',
            ].join('\n'),
            language: 'css', extension: '.css',
        });
        const rels = parser.parse(file, { includeUrls: true });
        const targets = rels.filter(r => r.type === 'css-url').map(r => r.target);
        expect(targets).toContain('bg.png');
        expect(targets).not.toContain('data:image/png;base64,abc');
        expect(targets).not.toContain('https://example.com/img.png');
    });
});

// ============================================================
// HTML
// ============================================================
describe('HTMLParser.parse', () => {
    const parser = new HTMLParser();

    it('extracts script src and link href', () => {
        const file = makeFileInfo({
            id: 'index.html',
            content: '<script src="app.js"></script>\n<link href="style.css" rel="stylesheet">\n',
            language: 'html', extension: '.html',
        });
        const rels = parser.parse(file);
        expect(rels).toHaveLength(2);
        expect(rels[0]).toMatchObject({ target: 'app.js', type: 'script' });
        expect(rels[1]).toMatchObject({ target: 'style.css', type: 'stylesheet' });
    });

    it('ignores img src by default', () => {
        const file = makeFileInfo({
            id: 'page.html',
            content: '<img src="photo.jpg">\n<script src="app.js"></script>\n',
            language: 'html', extension: '.html',
        });
        const rels = parser.parse(file);
        expect(rels).toHaveLength(1);
        expect(rels[0].type).toBe('script');
    });

    it('includes img src when option set', () => {
        const file = makeFileInfo({
            id: 'page.html',
            content: '<img src="photo.jpg">\n',
            language: 'html', extension: '.html',
        });
        const rels = parser.parse(file, { includeAssets: true });
        expect(rels).toHaveLength(1);
        expect(rels[0]).toMatchObject({ target: 'photo.jpg', type: 'asset' });
    });

    it('returns empty for plain HTML with no references', () => {
        const file = makeFileInfo({
            id: 'bare.html', content: '<html><body><h1>Hello</h1></body></html>\n',
            language: 'html', extension: '.html',
        });
        expect(parser.parse(file)).toHaveLength(0);
    });
});
