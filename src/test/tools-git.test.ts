import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { GraphDB } from '../graph-db';
import { buildGraph, preParseFiles } from '../analyzer/graph-builder';
import { initTreeSitter } from '../analyzer/tree-sitter-loader';
import { runAuraToolAsync } from '../ai/tools';
import type { RiskFileEntry, RiskSnapshot } from '../risk/risk-service';
import { makeFileInfo } from './helpers';

const HAS_GIT = (() => {
    try {
        execFileSync('git', ['--version'], { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
})();

/** A risk snapshot with just the files we care about. */
function snapshotOf(entries: Record<string, Partial<RiskFileEntry>>): RiskSnapshot {
    const byId = new Map<string, RiskFileEntry>();
    for (const [id, overrides] of Object.entries(entries)) {
        byId.set(id, {
            id,
            score: 50,
            scorePct: 0.5,
            topLabel: null,
            bucket: 'medium',
            reasons: [{ weight: 1, text: 'reason' }],
            lines: 20,
            complexity: 3,
            fanIn: 1,
            fanOut: 1,
            churn: 2,
            authorCount: 1,
            ...overrides,
        });
    }
    return { windowDays: 90, byId, highIds: new Set(), avgScore: 50 };
}

const FILES = {
    'a.ts': "import { helper } from './b';\nexport function run(): number {\n  return helper(2);\n}\n",
    'b.ts': 'export function helper(value: number): number {\n  return value * 2;\n}\n',
};

async function openGraph(dir: string): Promise<GraphDB> {
    const files = Object.entries(FILES).map(([id, content]) =>
        makeFileInfo({ id, content, language: 'typescript', extension: '.ts', group: '' }));
    const trees = await preParseFiles(files);
    const db = new GraphDB();
    await db.open(join(dir, 'graph.db'));
    db.importGraphData(buildGraph(files, 'Fixture', {}, trees));
    return db;
}

function git(cwd: string, args: string[]): string {
    return execFileSync('git', args, { cwd, encoding: 'utf-8' });
}

describe.skipIf(!HAS_GIT)('V3-16 tools (git-backed)', () => {
    let repo: string;
    let dataDir: string;
    let db: GraphDB;
    let head: string;
    let baseBranch: string;

    beforeAll(async () => {
        await initTreeSitter();
    });

    beforeEach(async () => {
        repo = mkdtempSync(join(tmpdir(), 'aura-v316-'));
        dataDir = mkdtempSync(join(tmpdir(), 'aura-v316-db-'));
        for (const [name, content] of Object.entries(FILES)) {
            writeFileSync(join(repo, name), content);
        }
        git(repo, ['init', '-q']);
        git(repo, ['config', 'user.email', 'test@example.com']);
        git(repo, ['config', 'user.name', 'Test']);
        git(repo, ['config', 'commit.gpgsign', 'false']);
        git(repo, ['add', '.']);
        git(repo, ['commit', '-q', '-m', 'init']);
        head = git(repo, ['rev-parse', 'HEAD']).trim();
        baseBranch = git(repo, ['branch', '--show-current']).trim();
        db = await openGraph(dataDir);
    });

    afterEach(() => {
        db.close();
        rmSync(repo, { recursive: true, force: true });
        rmSync(dataDir, { recursive: true, force: true });
    });

    describe('aura_build', () => {
        it('reports a fresh graph when the analysed commit is HEAD', async () => {
            db.setMeta('analyzedAt', '2024-05-01T10:00:00.000Z');
            db.setMeta('head', head);
            db.setMeta('totalFiles', '2');
            db.setMeta('totalLinks', '1');
            const payload = await runAuraToolAsync(db, 'aura_build', {}, { root: repo }) as Record<string, unknown>;
            expect(payload.stale).toBe(false);
            expect(payload.head_now).toBe(head);
            expect(payload.head_at_analysis).toBe(head);
            expect(payload.files).toBe(2);
            expect(payload.links).toBe(1);
            expect(String(payload.note)).toContain('match');
        });

        it('reports a stale graph after a new commit', async () => {
            db.setMeta('analyzedAt', '2024-05-01T10:00:00.000Z');
            db.setMeta('head', head);
            writeFileSync(join(repo, 'a.ts'), FILES['a.ts'] + '// touched\n');
            git(repo, ['commit', '-aqm', 'touch']);
            const payload = await runAuraToolAsync(db, 'aura_build', {}, { root: repo }) as Record<string, unknown>;
            expect(payload.stale).toBe(true);
            expect(String(payload.note)).toContain('re-run');
        });

        it('stays undecided without a fingerprint', async () => {
            db.setMeta('analyzedAt', '2024-05-01T10:00:00.000Z');
            const payload = await runAuraToolAsync(db, 'aura_build', {}, { root: repo }) as Record<string, unknown>;
            expect(payload.stale).toBeNull();
            expect(String(payload.reason)).toContain('fingerprint');
        });
    });

    describe('aura_list_repositories', () => {
        it('describes the workspace, its database and its worktrees', async () => {
            db.setMeta('analyzedAt', '2024-05-01T10:00:00.000Z');
            db.setMeta('head', head);
            const payload = await runAuraToolAsync(db, 'aura_list_repositories', {}, {
                root: repo,
                dbPath: join(repo, 'graph.db'),
            }) as Record<string, unknown>;
            expect(payload.root).toBe(repo);
            expect(payload.head_now).toBe(head);
            expect(payload.stale).toBe(false);
            const worktrees = payload.worktrees as { path: string; head: string | null; branch: string | null }[];
            expect(worktrees.length).toBeGreaterThanOrEqual(1);
            expect(worktrees[0].head).toBe(head);
            expect(worktrees[0].branch === null || typeof worktrees[0].branch === 'string').toBe(true);
        });
    });

    describe('aura_hotspots_in_changes', () => {
        it('reports nothing on a clean tree', async () => {
            const payload = await runAuraToolAsync(db, 'aura_hotspots_in_changes', {}, {
                root: repo,
                getRiskSnapshot: () => snapshotOf({}),
            }) as Record<string, unknown>;
            expect(payload.total).toBe(0);
            expect(payload.changes).toEqual([]);
            expect(String(payload.note)).toContain('Nothing changed');
        });

        it('ranks working-tree changes by risk', async () => {
            writeFileSync(join(repo, 'a.ts'), FILES['a.ts'] + '// one\n// two\n');
            writeFileSync(join(repo, 'b.ts'), FILES['b.ts'] + '// small\n');
            const payload = await runAuraToolAsync(db, 'aura_hotspots_in_changes', {}, {
                root: repo,
                getRiskSnapshot: () => snapshotOf({
                    'a.ts': { score: 20, bucket: 'low', reasons: [{ weight: 1, text: 'low risk' }] },
                    'b.ts': { score: 90, bucket: 'high', reasons: [{ weight: 3, text: 'hot path' }] },
                }),
            }) as Record<string, unknown>;
            const changes = payload.changes as { file: string; risk_score: number | null; bucket: string | null; status: string; additions: number; reasons: string[] }[];
            expect(changes).toHaveLength(2);
            expect(changes[0].file).toBe('b.ts');
            expect(changes[0].risk_score).toBe(90);
            expect(changes[0].bucket).toBe('high');
            expect(changes[0].reasons).toEqual(['hot path']);
            expect(changes[1].file).toBe('a.ts');
            expect(changes[1].additions).toBe(2);
            expect(payload.additions).toBe(3);
            expect(payload.deletions).toBe(0);
            expect(payload.risky).toBe(1);
        });

        it('includes untracked files with an unknown risk', async () => {
            writeFileSync(join(repo, 'new.ts'), 'export const x = 1;\n');
            const payload = await runAuraToolAsync(db, 'aura_hotspots_in_changes', {}, {
                root: repo,
                getRiskSnapshot: () => snapshotOf({}),
            }) as Record<string, unknown>;
            const changes = payload.changes as { file: string; status: string; risk_score: number | null }[];
            expect(changes).toHaveLength(1);
            expect(changes[0].file).toBe('new.ts');
            expect(changes[0].status).toBe('U');
            expect(changes[0].risk_score).toBeNull();
        });

        it('diffs against a base branch when one is given', async () => {
            git(repo, ['checkout', '-q', '-b', 'feature']);
            writeFileSync(join(repo, 'b.ts'), FILES['b.ts'] + '// feature work\n');
            git(repo, ['commit', '-aqm', 'feature']);
            const payload = await runAuraToolAsync(db, 'aura_hotspots_in_changes', { base: baseBranch }, {
                root: repo,
                getRiskSnapshot: () => snapshotOf({ 'b.ts': { score: 70, bucket: 'high' } }),
            }) as Record<string, unknown>;
            const changes = payload.changes as { file: string }[];
            expect(changes.map(c => c.file)).toEqual(['b.ts']);
            expect(String(payload.scope)).toContain('branch changes');
        });
    });

    describe('aura_explain_file', () => {
        it('aggregates metrics, risk, structure and calls for one file', async () => {
            const payload = await runAuraToolAsync(db, 'aura_explain_file', { file: 'a.ts' }, {
                root: repo,
                getRiskSnapshot: () => snapshotOf({
                    'a.ts': {
                        score: 81.7,
                        bucket: 'high',
                        topLabel: 'top 4%',
                        reasons: [{ weight: 3, text: 'called from everywhere' }, { weight: 1, text: 'churn' }],
                        churn: 7,
                        authorCount: 3,
                    },
                }),
            }) as Record<string, unknown>;
            expect(payload.resolved_file).toBe('a.ts');
            expect(payload.language).toBe('typescript');
            expect(payload.dependencies).toContain('b.ts');
            const risk = payload.risk as Record<string, unknown>;
            expect(risk.score).toBe(81.7);
            expect(risk.bucket).toBe('high');
            expect(risk.top_label).toBe('top 4%');
            expect(risk.reasons).toEqual(['called from everywhere', 'churn']);
            const metrics = risk.metrics as Record<string, number>;
            expect(metrics.churn).toBe(7);
            expect(metrics.authors).toBe(3);
            const calls = payload.call_sites as { outgoing: { to: string; anchor?: string }[]; outgoing_total: number };
            expect(calls.outgoing_total).toBeGreaterThanOrEqual(1);
            expect(calls.outgoing[0].to).toContain('helper');
            expect(calls.outgoing[0].anchor).toMatch(/^a\.ts:\d+$/);
            expect(payload.risk_window_days).toBe(90);
            expect(Array.isArray(payload.cycles)).toBe(true);
            expect(Array.isArray(payload.dead_exports)).toBe(true);
        });

        it('explains a file without a risk entry', async () => {
            const payload = await runAuraToolAsync(db, 'aura_explain_file', { file: 'b.ts' }, {
                root: repo,
                getRiskSnapshot: () => snapshotOf({}),
            }) as Record<string, unknown>;
            expect(payload.risk).toBeNull();
            expect(payload.file).toBe('b.ts');
        });

        it('returns a helpful error for an unknown file', async () => {
            const payload = await runAuraToolAsync(db, 'aura_explain_file', { file: 'nope.ts' }, { root: repo }) as Record<string, unknown>;
            expect(String(payload.error)).toContain('File not found');
        });
    });

    describe('dispatch', () => {
        it('still routes the deterministic tools through runAuraTool', async () => {
            const payload = await runAuraToolAsync(db, 'aura_get_architecture', {}, { root: repo }) as Record<string, unknown>;
            expect(payload.project).toBe('Fixture');
            expect(payload.total_files).toBe(2);
        });

        it('rejects unknown tool names', async () => {
            const payload = await runAuraToolAsync(db, 'aura_nope', {}, { root: repo }) as Record<string, unknown>;
            expect(String(payload.error)).toContain('Unknown tool');
        });
    });
});
