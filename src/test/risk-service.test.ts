import { describe, it, expect } from 'vitest';
import { buildRiskSnapshot, type RiskServiceNode, type RiskServiceCommit } from '../risk/risk-service';
import { riskBucket, RISK_HIGH_THRESHOLD, RISK_MEDIUM_THRESHOLD } from '../risk/risk-core';

describe('risk-service — riskBucket', () => {
    it('maps scores to the shared thresholds', () => {
        expect(riskBucket(100)).toBe('high');
        expect(riskBucket(RISK_HIGH_THRESHOLD)).toBe('high');
        expect(riskBucket(RISK_HIGH_THRESHOLD - 1)).toBe('medium');
        expect(riskBucket(RISK_MEDIUM_THRESHOLD)).toBe('medium');
        expect(riskBucket(RISK_MEDIUM_THRESHOLD - 1)).toBe('low');
        expect(riskBucket(0)).toBe('low');
    });
});

describe('risk-service — buildRiskSnapshot', () => {
    const NOW = Date.UTC(2026, 9, 10);
    const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

    it('counts churn inside the window but authors across all history', () => {
        const nodes: RiskServiceNode[] = [{ id: 'a.ts', path: 'a.ts', complexity: 5 }];
        const commits: RiskServiceCommit[] = [
            { date: daysAgo(2), author: 'alice', files: [{ path: 'a.ts' }] },
            { date: daysAgo(10), author: 'bob', files: [{ path: 'a.ts' }] },
            { date: daysAgo(400), author: 'carol', files: [{ path: 'a.ts' }] },
        ];
        const snap = buildRiskSnapshot(nodes, commits, 30, NOW);
        const text = snap.byId.get('a.ts')!.reasons.map(r => r.text).join(' | ');
        expect(text).toContain('changed 2 times in 30 days'); // 2 and 10 days ago
        expect(text).toContain('3 authors');                  // carol is outside the window but still an author
    });

    it('treats invalid commit dates as outside the window but keeps the author', () => {
        const nodes: RiskServiceNode[] = [{ id: 'a.ts', complexity: 1 }];
        const commits: RiskServiceCommit[] = [
            { date: 'not-a-date', author: 'x', files: [{ path: 'a.ts' }] },
            { date: daysAgo(1), author: 'y', files: [{ path: 'a.ts' }] },
        ];
        const snap = buildRiskSnapshot(nodes, commits, 30, NOW);
        const text = snap.byId.get('a.ts')!.reasons.map(r => r.text).join(' | ');
        expect(text).toContain('changed 1 time in 30 days');
        expect(text).toContain('2 authors');
    });

    it('ranks scores, exposes the high-risk set and the top label', () => {
        const nodes: RiskServiceNode[] = [
            { id: 'big.ts', path: 'big.ts', complexity: 400, fanIn: 50, fanOut: 40, cycleIds: [1], deadExports: ['x'], symbols: { totalSymbols: 2 } },
            { id: 'small.ts', path: 'small.ts', complexity: 1, fanIn: 0, fanOut: 0 },
            { id: 'mid.ts', path: 'mid.ts', complexity: 10, fanIn: 1, fanOut: 1 },
        ];
        const commits: RiskServiceCommit[] = [
            { date: daysAgo(1), author: 'a', files: [{ path: 'big.ts' }] },
            { date: daysAgo(30), author: 'a', files: [{ path: 'big.ts' }] },
        ];
        const snap = buildRiskSnapshot(nodes, commits, 90, NOW);
        const big = snap.byId.get('big.ts')!;
        expect(big.score).toBeGreaterThanOrEqual(RISK_HIGH_THRESHOLD);
        expect(big.bucket).toBe('high');
        expect(snap.highIds.has('big.ts')).toBe(true);
        expect(big.topLabel).toBe('the highest');
        expect(snap.byId.get('small.ts')!.bucket).toBe('low');
        expect(snap.avgScore).toBeGreaterThan(0);
        expect(snap.windowDays).toBe(90);
    });

    it('falls back from node id to path for the churn lookup', () => {
        const nodes: RiskServiceNode[] = [{ id: 'src/a.ts', path: 'other/a.ts', complexity: 1 }];
        const commits: RiskServiceCommit[] = [
            { date: daysAgo(1), author: 'a', files: [{ path: 'src/a.ts' }] },
        ];
        const snap = buildRiskSnapshot(nodes, commits, 30, NOW);
        expect(snap.byId.get('src/a.ts')!.reasons.map(r => r.text).join(' ')).toContain('changed 1 time in 30 days');
    });

    it('excludes documentation from architecture risk', () => {
        const nodes: RiskServiceNode[] = [
            { id: 'src/a.ts', path: 'src/a.ts', language: 'typescript', complexity: 3 },
            { id: 'docs/readme.md', path: 'docs/readme.md', language: 'documentation', complexity: 200, fanIn: 99 },
        ];
        const snap = buildRiskSnapshot(nodes, [], 90, NOW);
        expect(snap.byId.has('src/a.ts')).toBe(true);
        expect(snap.byId.has('docs/readme.md')).toBe(false);
        expect(snap.byId.size).toBe(1);
    });

    it('follows git renames so history under the old path counts for the new path', () => {
        const nodes: RiskServiceNode[] = [{ id: 'new/loc.ts', path: 'new/loc.ts', complexity: 1 }];
        const commits: RiskServiceCommit[] = [
            { date: daysAgo(1), author: 'alice', files: [{ status: 'M', path: 'new/loc.ts' }] },
            { date: daysAgo(4), author: 'alice', files: [{ status: 'R', path: 'new/loc.ts', oldPath: 'old/loc.ts' }] },
            { date: daysAgo(8), author: 'bob', files: [{ status: 'M', path: 'old/loc.ts' }] },
            { date: daysAgo(12), author: 'carol', files: [{ status: 'M', path: 'old/loc.ts' }] },
        ];
        const snap = buildRiskSnapshot(nodes, commits, 30, NOW);
        const text = snap.byId.get('new/loc.ts')!.reasons.map(r => r.text).join(' | ');
        // All four commits touched the same file (rename included).
        expect(text).toContain('changed 4 times in 30 days');
        expect(text).toContain('3 authors');
    });
});

describe('risk-service — history signals (score v2)', () => {
    const NOW = Date.UTC(2026, 9, 10);
    const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

    it('computes the rewrite volume against the current size', () => {
        const nodes: RiskServiceNode[] = [
            { id: 'big.ts', path: 'big.ts', complexity: 5, linesOfCode: 100 },
            { id: 'small.ts', path: 'small.ts', complexity: 5, linesOfCode: 100 },
        ];
        const commits: RiskServiceCommit[] = [
            { date: daysAgo(1), author: 'a', files: [{ path: 'big.ts', additions: 150, deletions: 50 }] },
            { date: daysAgo(2), author: 'a', files: [{ path: 'small.ts', additions: 5, deletions: 5 }] },
        ];
        const snap = buildRiskSnapshot(nodes, commits, 30, NOW);
        expect(snap.byId.get('big.ts')!.relChurn).toBeCloseTo(2, 5);   // 200 / 100
        expect(snap.byId.get('small.ts')!.relChurn).toBeCloseTo(0.1, 5);
    });

    it('only counts volumes inside the window', () => {
        const nodes: RiskServiceNode[] = [{ id: 'a.ts', path: 'a.ts', complexity: 1, linesOfCode: 50 }];
        const commits: RiskServiceCommit[] = [
            { date: daysAgo(2), author: 'a', files: [{ path: 'a.ts', additions: 25, deletions: 0 }] },
            { date: daysAgo(200), author: 'a', files: [{ path: 'a.ts', additions: 500, deletions: 500 }] },
        ];
        const snap = buildRiskSnapshot(nodes, commits, 30, NOW);
        expect(snap.byId.get('a.ts')!.relChurn).toBeCloseTo(0.5, 5);
    });

    it('measures the share of bug-fix commits', () => {
        const nodes: RiskServiceNode[] = [{ id: 'a.ts', path: 'a.ts', complexity: 1, linesOfCode: 10 }];
        const commits: RiskServiceCommit[] = [
            { date: daysAgo(1), author: 'a', message: 'fix crash on save', files: [{ path: 'a.ts', additions: 1 }] },
            { date: daysAgo(2), author: 'a', message: 'add a button', files: [{ path: 'a.ts', additions: 10 }] },
            { date: daysAgo(3), author: 'b', message: 'hotfix the loader', files: [{ path: 'a.ts', additions: 2 }] },
            { date: daysAgo(4), author: 'b', message: 'refactor', files: [{ path: 'a.ts', additions: 3 }] },
        ];
        const snap = buildRiskSnapshot(nodes, commits, 30, NOW);
        expect(snap.byId.get('a.ts')!.fixRatio).toBeCloseTo(0.5, 5);
        const text = snap.byId.get('a.ts')!.reasons.map(r => r.text).join(' | ');
        expect(text).toContain('50% of its commits are fixes');
    });

    it('honours a custom fix pattern', () => {
        const nodes: RiskServiceNode[] = [{ id: 'a.ts', path: 'a.ts', complexity: 1, linesOfCode: 10 }];
        const commits: RiskServiceCommit[] = [
            { date: daysAgo(1), author: 'a', message: 'repair the parser', files: [{ path: 'a.ts', additions: 1 }] },
            { date: daysAgo(2), author: 'a', message: 'fix crash', files: [{ path: 'a.ts', additions: 1 }] },
        ];
        const snap = buildRiskSnapshot(nodes, commits, 30, NOW, { fixKeywords: 'repair' });
        expect(snap.byId.get('a.ts')!.fixRatio).toBeCloseTo(0.5, 5);
    });

    it('survives commits without volumes (older caches)', () => {
        const nodes: RiskServiceNode[] = [{ id: 'a.ts', path: 'a.ts', complexity: 1, linesOfCode: 10 }];
        const commits: RiskServiceCommit[] = [
            { date: daysAgo(1), author: 'a', files: [{ path: 'a.ts' }] },
        ];
        const snap = buildRiskSnapshot(nodes, commits, 30, NOW);
        expect(snap.byId.get('a.ts')!.relChurn).toBe(0);
        expect(snap.byId.get('a.ts')!.churn).toBe(1);
    });

    it('weights recent commits more heavily than old ones', () => {
        const nodes: RiskServiceNode[] = [
            { id: 'new.ts', path: 'new.ts', complexity: 1, linesOfCode: 10 },
            { id: 'old.ts', path: 'old.ts', complexity: 1, linesOfCode: 10 },
            { id: 'mid.ts', path: 'mid.ts', complexity: 1, linesOfCode: 10 },
        ];
        const commits: RiskServiceCommit[] = [
            { date: daysAgo(1), author: 'a', files: [{ path: 'new.ts', additions: 1 }] },
            { date: daysAgo(28), author: 'a', files: [{ path: 'old.ts', additions: 1 }] },
            { date: daysAgo(15), author: 'a', files: [{ path: 'mid.ts', additions: 1 }] },
        ];
        const snap = buildRiskSnapshot(nodes, commits, 30, NOW);
        const score = (id: string) => snap.byId.get(id)!.score;
        // Same commits, same volumes: only recency separates them.
        expect(score('new.ts')).toBeGreaterThan(score('mid.ts'));
        expect(score('mid.ts')).toBeGreaterThan(score('old.ts'));
    });
});
