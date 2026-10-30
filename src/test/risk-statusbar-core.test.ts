import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
    HOTSPOT_ICON,
    RISK_ICON,
    TOOLTIP_HOTSPOTS,
    hotspotBadgeText,
    hotspotTooltipSummary,
    hotspotTooltipTitle,
    isHotspotEligibleState,
    riskBadgeText,
    selectDirtyHotspots,
    toWorkspaceRelative,
    type StatusBarRiskSnapshot,
} from '../risk/statusbar-core';
import type { GitFileState } from '../analyzer/git-history';

const ROOT = path.resolve('/ws');
const REPO = path.resolve('/ws');

function snapshot(entries: Record<string, number>, high: string[] = Object.keys(entries)): StatusBarRiskSnapshot {
    const byId = new Map<string, { score: number; topLabel: string | null }>();
    for (const [id, score] of Object.entries(entries)) {
        byId.set(id, { score, topLabel: score >= 70 ? 'top 8%' : null });
    }
    return { byId, highIds: new Set(high) };
}

function tree(files: Record<string, GitFileState>): Map<string, GitFileState> {
    return new Map(Object.entries(files));
}

describe('statusbar-core — toWorkspaceRelative', () => {
    it('maps a repo-relative path onto the workspace id', () => {
        expect(toWorkspaceRelative('src/app.ts', ROOT, REPO)).toBe('src/app.ts');
        expect(toWorkspaceRelative('src/deep/nested/app.ts', ROOT, REPO)).toBe('src/deep/nested/app.ts');
    });

    it('handles a workspace nested inside the repository', () => {
        const repo = path.resolve('/repo');
        const workspace = path.join(repo, 'packages', 'app');
        expect(toWorkspaceRelative('packages/app/src/main.ts', workspace, repo)).toBe('src/main.ts');
    });

    it('refuses files outside the workspace root', () => {
        // The multi-root / sibling-folder case: `../server/src/x.ts` is not ours.
        const workspace = path.resolve('/ws/client');
        const repo = path.resolve('/ws');
        expect(toWorkspaceRelative('server/src/x.ts', workspace, repo)).toBeUndefined();
    });

    it('refuses empty input and the root itself', () => {
        expect(toWorkspaceRelative('', ROOT, REPO)).toBeUndefined();
        expect(toWorkspaceRelative('src/app.ts', '', REPO)).toBeUndefined();
        expect(toWorkspaceRelative('src/app.ts', ROOT, '')).toBeUndefined();
        expect(toWorkspaceRelative('.', ROOT, REPO)).toBeUndefined();
    });

    it('always answers with forward slashes', () => {
        const id = toWorkspaceRelative(path.join('src', 'webview', 'provider.ts'), ROOT, REPO);
        expect(id).toBe('src/webview/provider.ts');
    });
});

describe('statusbar-core — isHotspotEligibleState', () => {
    it('drops deleted files and keeps every other git state', () => {
        expect(isHotspotEligibleState('deleted')).toBe(false);
        expect(isHotspotEligibleState('modified')).toBe(true);
        expect(isHotspotEligibleState('added')).toBe(true);
        expect(isHotspotEligibleState('renamed')).toBe(true);
        expect(isHotspotEligibleState('untracked')).toBe(true);
        expect(isHotspotEligibleState('conflicted')).toBe(true);
    });
});

describe('statusbar-core — selectDirtyHotspots', () => {
    it('keeps only high-risk files touched by the working tree', () => {
        const snap = snapshot({ 'src/hot.ts': 88, 'src/cold.ts': 12 }, ['src/hot.ts']);
        const hotspots = selectDirtyHotspots(
            tree({ 'src/hot.ts': 'modified', 'src/cold.ts': 'modified' }),
            snap,
            ROOT,
            REPO,
        );
        expect(hotspots).toEqual([{ id: 'src/hot.ts', score: 88 }]);
    });

    it('sorts by descending score, then by id', () => {
        const snap = snapshot({ 'b.ts': 80, 'a.ts': 80, 'c.ts': 95 }, ['a.ts', 'b.ts', 'c.ts']);
        const hotspots = selectDirtyHotspots(
            tree({ 'b.ts': 'modified', 'a.ts': 'added', 'c.ts': 'untracked' }),
            snap,
            ROOT,
            REPO,
        );
        expect(hotspots.map(h => h.id)).toEqual(['c.ts', 'a.ts', 'b.ts']);
    });

    it('ignores deleted files — a removed hotspot is no longer at risk', () => {
        const snap = snapshot({ 'src/gone.ts': 91 }, ['src/gone.ts']);
        expect(selectDirtyHotspots(tree({ 'src/gone.ts': 'deleted' }), snap, ROOT, REPO)).toEqual([]);
    });

    it('ignores files that belong to another workspace folder', () => {
        const workspace = path.resolve('/ws/client');
        const repo = path.resolve('/ws');
        const snap = snapshot({ 'client/src/a.ts': 99 }, ['client/src/a.ts']);
        expect(selectDirtyHotspots(tree({ 'client/src/a.ts': 'modified' }), snap, workspace, repo)).toEqual([]);
    });

    it('deduplicates and tolerates files missing from the snapshot', () => {
        const snap = snapshot({ 'src/a.ts': 77 }, ['src/a.ts', 'src/ghost.ts']);
        const hotspots = selectDirtyHotspots(
            new Map<string, GitFileState>([
                ['src/a.ts', 'modified'],
                ['./src/a.ts', 'modified'],
                ['src/ghost.ts', 'added'],
            ]),
            snap,
            ROOT,
            REPO,
        );
        expect(hotspots).toEqual([
            { id: 'src/a.ts', score: 77 },
            { id: 'src/ghost.ts', score: 0 },
        ]);
    });

    it('returns an empty list when nothing is dirty', () => {
        expect(selectDirtyHotspots(tree({}), snapshot({ 'src/a.ts': 90 }), ROOT, REPO)).toEqual([]);
    });
});

describe('statusbar-core — badge wording', () => {
    it('writes the active-file risk badge', () => {
        expect(riskBadgeText({ score: 72.4, topLabel: 'top 8%' })).toBe(`${RISK_ICON} Risk 72 · top 8%`);
        expect(riskBadgeText({ score: 31, topLabel: null })).toBe(`${RISK_ICON} Risk 31`);
        expect(riskBadgeText({ score: 100 })).toBe(`${RISK_ICON} Risk 100`);
    });

    it('writes the hotspot alert badge with correct pluralisation', () => {
        expect(hotspotBadgeText(1)).toBe(`${HOTSPOT_ICON} 1 hotspot in your changes`);
        expect(hotspotBadgeText(3)).toBe(`${HOTSPOT_ICON} 3 hotspots in your changes`);
        expect(hotspotBadgeText(0)).toBe('');
        expect(hotspotBadgeText(-2)).toBe('');
    });

    it('writes the tooltip title with correct pluralisation', () => {
        expect(hotspotTooltipTitle(1)).toBe('**1 high-risk file in your current changes**');
        expect(hotspotTooltipTitle(4)).toBe('**4 high-risk files in your current changes**');
    });

    it('lists the riskiest hotspots and counts the hidden ones', () => {
        const hotspots = Array.from({ length: 7 }, (_, i) => ({ id: `src/f${i}.ts`, score: 90 - i }));
        const { lines, hidden } = hotspotTooltipSummary(hotspots);
        expect(lines).toHaveLength(TOOLTIP_HOTSPOTS);
        expect(lines[0]).toBe('- `src/f0.ts` — risk 90/100');
        expect(hidden).toBe(2);
    });

    it('reports nothing hidden when the list fits', () => {
        const { lines, hidden } = hotspotTooltipSummary([{ id: 'src/a.ts', score: 66.6 }]);
        expect(lines).toEqual(['- `src/a.ts` — risk 67/100']);
        expect(hidden).toBe(0);
    });

    it('honours an explicit limit of zero', () => {
        const { lines, hidden } = hotspotTooltipSummary([{ id: 'src/a.ts', score: 66 }], 0);
        expect(lines).toEqual([]);
        expect(hidden).toBe(1);
    });
});
