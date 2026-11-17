import { describe, it, expect } from 'vitest';
import {
    buildMinimapPlan,
    EMPTY_MINIMAP,
    MINIMAP_MAX_BUILDINGS,
    type MinimapBuilding,
} from '../minimap/minimap-core';
import type { CityNodeLike } from '../graph/city-core';

function node(id: string, patch: Partial<CityNodeLike> = {}): CityNodeLike {
    return { id, group: 'src', linesOfCode: 100, complexity: 10, cognitive: 8, ...patch };
}

const FIXTURE: CityNodeLike[] = [
    node('src/extension.ts', { group: 'src', language: 'typescript', linesOfCode: 2600, complexity: 240 }),
    node('src/graph-db.ts', { group: 'src/graph', language: 'typescript', linesOfCode: 900, complexity: 70 }),
    node('webview/js/app.js', { group: 'webview', language: 'javascript', linesOfCode: 4100, complexity: 180 }),
    node('README.md', { group: '.', language: 'markdown', linesOfCode: 900, complexity: 0 }),
    node('package.json', { group: '.', language: 'json', linesOfCode: 500, complexity: 0 }),
];

function withinUnitSquare(building: MinimapBuilding): boolean {
    return (
        building.x >= 0 &&
        building.y >= 0 &&
        building.w > 0 &&
        building.h > 0 &&
        building.x + building.w <= 1.0001 &&
        building.y + building.h <= 1.0001
    );
}

describe('buildMinimapPlan', () => {
    it('returns the empty payload for missing or empty input', () => {
        expect(buildMinimapPlan(undefined)).toBe(EMPTY_MINIMAP);
        expect(buildMinimapPlan([])).toBe(EMPTY_MINIMAP);
    });

    it('draws one building per node, inside the unit square', () => {
        const plan = buildMinimapPlan(FIXTURE);
        expect(plan.buildings).toHaveLength(FIXTURE.length);
        expect(plan.total).toBe(FIXTURE.length);
        expect(plan.truncated).toBe(false);
        for (const building of plan.buildings) {
            expect(withinUnitSquare(building)).toBe(true);
        }
    });

    it('keeps every node id, so a click can open the file', () => {
        const plan = buildMinimapPlan(FIXTURE);
        const ids = plan.buildings.map(building => building.id).sort();
        expect(ids).toEqual(FIXTURE.map(item => item.id).sort());
    });

    it('tags non-code files, so the drawer can mute them', () => {
        const plan = buildMinimapPlan(FIXTURE);
        const byId = new Map(plan.buildings.map(building => [building.id, building]));
        // The taxonomy is `city-core`'s (`docs` / `data` / `config` / `asset`):
        // the minimap must not invent its own.
        expect(byId.get('README.md')!.kind).toBe('docs');
        expect(byId.get('package.json')!.kind).toBe('data');
        expect(byId.get('src/extension.ts')!.kind).toBe('code');
    });

    it('uses integer tiers in the range layoutCity produces', () => {
        const plan = buildMinimapPlan(FIXTURE);
        for (const building of plan.buildings) {
            expect(Number.isInteger(building.tier)).toBe(true);
            expect(building.tier).toBeGreaterThanOrEqual(1);
            expect(building.tier).toBeLessThanOrEqual(5);
        }
        // The two heaviest files must not be in the darkest tier.
        const byId = new Map(plan.buildings.map(building => [building.id, building]));
        expect(byId.get('webview/js/app.js')!.tier).toBeGreaterThan(byId.get('README.md')!.tier);
    });

    it('rounds coordinates to four decimals', () => {
        const plan = buildMinimapPlan(FIXTURE);
        for (const building of plan.buildings) {
            for (const value of [building.x, building.y, building.w, building.h]) {
                expect(Math.abs(value * 1e4 - Math.round(value * 1e4))).toBeLessThan(1e-6);
            }
        }
    });

    it('groups districts the same way the City does', () => {
        const plan = buildMinimapPlan(FIXTURE);
        expect(plan.districts.length).toBeGreaterThan(0);
        for (const district of plan.districts) {
            expect(district.x).toBeGreaterThanOrEqual(0);
            expect(district.y).toBeGreaterThanOrEqual(0);
            expect(district.w).toBeGreaterThan(0);
            expect(district.h).toBeGreaterThan(0);
        }
    });

    it('caps the drawing and reports the real total', () => {
        const many = Array.from({ length: 10 }, (_, index) =>
            node(`src/file-${index}.ts`, { linesOfCode: 100 + index * 37 }),
        );
        const plan = buildMinimapPlan(many, { maxBuildings: 4 });
        expect(plan.buildings).toHaveLength(4);
        expect(plan.total).toBe(10);
        expect(plan.truncated).toBe(true);
        // The survivors are the largest footprints, not the first four.
        const ids = plan.buildings.map(building => building.id);
        expect(ids).not.toEqual(many.slice(0, 4).map(item => item.id));
    });

    it('never truncates by default on a small graph', () => {
        expect(MINIMAP_MAX_BUILDINGS).toBeGreaterThan(FIXTURE.length);
        expect(buildMinimapPlan(FIXTURE).truncated).toBe(false);
    });

    it('is deterministic', () => {
        expect(buildMinimapPlan(FIXTURE)).toEqual(buildMinimapPlan(FIXTURE));
    });
});
