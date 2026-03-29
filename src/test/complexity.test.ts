import { describe, it, expect } from 'vitest';
import { computeComplexity } from '../analyzer/complexity';
import { makeFileInfo } from './helpers';

describe('computeComplexity', () => {
    // ============================================================
    // C / JS / TS
    // ============================================================
    describe('C/JS/TS complexity', () => {
        it('returns base complexity 1 for trivial code', () => {
            const file = makeFileInfo({
                id: 'simple.c', content: 'int main() { return 0; }\n',
                language: 'c', extension: '.c',
            });
            const result = computeComplexity(file);
            expect(result.complexity).toBe(1);
        });

        it('increments for each decision keyword', () => {
            const file = makeFileInfo({
                id: 'branchy.js',
                content: 'if (a) {} else if (b) {} for (;;) {} while (true) {} switch (x) { case 1: break; }\n',
                language: 'javascript', extension: '.js',
            });
            const result = computeComplexity(file);
            // if + else if + for + while + switch + case = 6 decisions + base 1 = 7
            expect(result.complexity).toBeGreaterThanOrEqual(7);
        });

        it('counts logical operators', () => {
            const file = makeFileInfo({
                id: 'logic.c',
                content: 'if (a && b || c) { }\n',
                language: 'c', extension: '.c',
            });
            const result = computeComplexity(file);
            // if(1) + &&(1) + ||(1) + base 1 = 4
            expect(result.complexity).toBe(4);
        });

        it('counts ternary operators', () => {
            const file = makeFileInfo({
                id: 'ternary.ts',
                content: 'const x = a ? 1 : 0;\nconst y = b ? 2 : 3;\n',
                language: 'typescript', extension: '.ts',
            });
            const result = computeComplexity(file);
            // base 1 + 2 ternaries = 3
            expect(result.complexity).toBe(3);
        });

        it('ignores keywords in comments', () => {
            const file = makeFileInfo({
                id: 'commented.c',
                content: '// if (x) while for switch\nint main() { return 0; }\n',
                language: 'c', extension: '.c',
            });
            const result = computeComplexity(file);
            expect(result.complexity).toBe(1);
        });

        it('ignores keywords in strings', () => {
            const file = makeFileInfo({
                id: 'strings.js',
                content: 'const s = "if while for switch";\n',
                language: 'javascript', extension: '.js',
            });
            const result = computeComplexity(file);
            expect(result.complexity).toBe(1);
        });
    });

    // ============================================================
    // CSS
    // ============================================================
    describe('CSS complexity', () => {
        it('returns 1 for minimal CSS', () => {
            const file = makeFileInfo({
                id: 'min.css', content: 'body { color: red; }\n',
                language: 'css', extension: '.css',
            });
            const result = computeComplexity(file);
            expect(result.complexity).toBeGreaterThanOrEqual(1);
        });

        it('accounts for media queries', () => {
            const file = makeFileInfo({
                id: 'responsive.css',
                content: '@media (max-width: 600px) { body { font-size: 14px; } }\n@media print { .no-print { display: none; } }\n',
                language: 'css', extension: '.css',
            });
            const result = computeComplexity(file);
            expect(result.details.mediaQueries).toBe(2);
        });
    });

    // ============================================================
    // HTML
    // ============================================================
    describe('HTML complexity', () => {
        it('returns 1 for plain HTML', () => {
            const file = makeFileInfo({
                id: 'page.html', content: '<html><body></body></html>\n',
                language: 'html', extension: '.html',
            });
            const result = computeComplexity(file);
            expect(result.complexity).toBe(1);
        });

        it('counts inline event handlers', () => {
            const file = makeFileInfo({
                id: 'events.html',
                content: '<button onclick="go()">Go</button>\n<input onchange="update()">\n',
                language: 'html', extension: '.html',
            });
            const result = computeComplexity(file);
            expect(result.details.eventHandlers).toBe(2);
            expect(result.complexity).toBeGreaterThanOrEqual(3);
        });
    });

    // ============================================================
    // Unknown
    // ============================================================
    it('returns 1 for unknown languages', () => {
        const file = makeFileInfo({
            id: 'data.json', content: '{ "key": "value" }\n',
            language: 'json', extension: '.json',
        });
        const result = computeComplexity(file);
        expect(result.complexity).toBe(1);
    });
});
