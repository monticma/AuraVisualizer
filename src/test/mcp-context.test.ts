import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GraphDB } from '../graph-db';
import { resolveContext, tokenizeTask } from '../mcp/context';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { GraphData, GraphNode } from '../analyzer/types';

function makeNode(
    id: string,
    name: string,
    functions: { name: string; line: number }[],
    fanIn: number,
    fanOut: number,
    lastModified: number,
): GraphNode {
    return {
        id,
        name,
        path: id,
        language: 'typescript',
        extension: '.ts',
        size: 100,
        linesOfCode: 100,
        lastModified,
        group: '',
        fanOut,
        fanIn,
        complexity: 1,
        complexityDetails: {},
        symbols: {
            functions: functions.map(f => ({
                name: f.name, returnType: '', params: '', line: f.line, type: 'function',
                visibility: 'public' as const, isStatic: false, isAsync: false,
            })),
            structs: [], enums: [], macros: [], classes: [], exports: [],
            interfaces: [], traits: [], typeAliases: [], methods: [],
            totalSymbols: functions.length,
        },
    };
}

function makeGraph(): GraphData {
    return {
        meta: {
            projectName: 'Test', analyzedAt: '2026-01-01T00:00:00Z',
            totalFiles: 3, totalLinks: 2, totalRelationsFound: 2,
            functionCallLinks: 0, heritageLinks: 0, unresolvedReferences: 0,
            unresolvedSamples: [], deadCodeFiles: 0, deadExportsTotal: 0,
            cycles: [], languageStats: {}, groups: [],
        },
        nodes: [
            makeNode('src/auth/oauth.ts', 'oauth.ts',
                [{ name: 'oauthLogin', line: 14 }, { name: 'beginLogin', line: 1 }], 3, 1, 1000),
            makeNode('src/api/routes.ts', 'routes.ts',
                [{ name: 'route', line: 246 }], 5, 2, 2000),
            makeNode('src/utils/helpers.ts', 'helpers.ts',
                [{ name: 'helper', line: 10 }], 1, 0, 500),
        ],
        links: [
            { source: 'src/api/routes.ts', target: 'src/auth/oauth.ts', type: 'import', label: '' },
            { source: 'src/auth/oauth.ts', target: 'src/utils/helpers.ts', type: 'import', label: '' },
        ],
    };
}

describe('tokenizeTask', () => {
    it('splits camelCase and drops stopwords', () => {
        // NB: the acronym splitter turns "OAuth" into "O Auth" → token "auth".
        expect(tokenizeTask('add OAuthLogin to the API')).toEqual(['auth', 'login', 'api']);
    });

    it('preserves lowercase tokens verbatim', () => {
        expect(tokenizeTask('add oauth login')).toEqual(['oauth', 'login']);
    });

    it('splits snake_case and dedupes', () => {
        expect(tokenizeTask('fix rate_limiting rate limiting')).toEqual(['rate', 'limiting']);
    });

    it('returns empty for stopword-only input', () => {
        expect(tokenizeTask('add the to')).toEqual([]);
    });
});

describe('resolveContext', () => {
    let db: GraphDB;
    let tmpDir: string;

    beforeEach(async () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'aura-ctx-'));
        db = new GraphDB();
        await db.open(join(tmpDir, 'graph.db'));
    });

    afterEach(() => {
        db.close();
        rmSync(tmpDir, { recursive: true, force: true });
    });

    it('ranks the oauth file first and returns line anchors', async () => {
        db.importGraphData(makeGraph());
        const result = resolveContext(db, 'add oauth login');

        expect(result.files.length).toBeGreaterThan(0);
        expect(result.files[0].file).toBe('src/auth/oauth.ts');
        expect(result.files[0].anchors).toEqual(expect.arrayContaining([
            expect.objectContaining({ symbol: 'oauthLogin', line: 14 }),
        ]));
    });

    it('respects the limit', async () => {
        db.importGraphData(makeGraph());
        const result = resolveContext(db, 'oauth', 1);
        expect(result.files).toHaveLength(1);
    });

    it('is deterministic across calls', async () => {
        db.importGraphData(makeGraph());
        const a = resolveContext(db, 'oauth login');
        const b = resolveContext(db, 'oauth login');
        expect(a.files.map(f => f.file)).toEqual(b.files.map(f => f.file));
    });

    it('returns an empty result for a stopword-only task', async () => {
        db.importGraphData(makeGraph());
        const result = resolveContext(db, 'add the to');
        expect(result.files).toEqual([]);
    });
});
