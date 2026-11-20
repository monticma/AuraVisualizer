import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { scanDirectory, SKIP_DIRS } from '../analyzer/scanner';
import { emptyScanCounters } from '../analysis/resolution';

/**
 * The scanner's default scope. A `npx vitest run --coverage` writes a
 * `coverage/lcov-report/` folder with 109 HTML/JS/CSS files next to the lcov:
 * analysed, they show up as an island of connected-to-nothing nodes, and the
 * whole point of the import feature is to *read* that lcov, not to draw its
 * report.
 */
describe('scanDirectory — generated folders stay out of the graph', () => {
    const makeTree = () => {
        const root = mkdtempSync(join(tmpdir(), 'aura-scan-'));
        mkdirSync(join(root, 'src'), { recursive: true });
        writeFileSync(join(root, 'src', 'a.ts'), 'export const a = 1;\n');
        for (const dir of ['coverage/lcov-report', '.nyc_output', 'htmlcov', '.pytest_cache', '.turbo']) {
            mkdirSync(join(root, dir), { recursive: true });
            writeFileSync(join(root, dir, 'index.html'), '<html></html>\n');
            writeFileSync(join(root, dir, 'bundle.js'), 'var x = 1;\n');
        }
        return root;
    };

    it('lists the report folders in SKIP_DIRS', () => {
        for (const dir of ['coverage', '.nyc_output', 'htmlcov', '.pytest_cache', '.turbo']) {
            expect(SKIP_DIRS.has(dir)).toBe(true);
        }
        // Never skip something a real project names after its sources.
        expect(SKIP_DIRS.has('src')).toBe(false);
        expect(SKIP_DIRS.has('vendor')).toBe(false);
    });

    it('scans the sources and reports what it skipped', async () => {
        const root = makeTree();
        try {
            const counters = emptyScanCounters();
            const files = await scanDirectory(root, {}, counters);
            expect(files.map(file => file.id)).toEqual(['src/a.ts']);
            expect(counters.skippedDirs).toContain('coverage');
            // Only the top-level folder is visited: no descent into lcov-report.
            expect(counters.skippedDirs).not.toContain('lcov-report');
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });
});
