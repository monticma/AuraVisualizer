import { describe, it, expect } from 'vitest';
import { detectCommunities, communityKey } from '../analysis/communities';

const nodes = [
    { id: 'src/a.ts', language: 'typescript' },
    { id: 'src/b.ts', language: 'typescript' },
    { id: 'src/c.ts', language: 'typescript' },
    { id: 'docs/readme.md', language: 'documentation' },
];

const links = [
    { source: 'src/a.ts', target: 'src/b.ts', type: 'import' },
    { source: 'src/c.ts', target: 'src/b.ts', type: 'import' },
    // Documentation is linked to the same files but must not join their group.
    { source: 'docs/readme.md', target: 'src/a.ts', type: 'doc-reference' },
    { source: 'docs/readme.md', target: 'src/b.ts', type: 'doc-reference' },
];

describe('architectural communities', () => {
    it('excludes documentation nodes and doc-reference edges', () => {
        const communities = detectCommunities(nodes, links);
        const members = communities.flatMap(community => community.files);
        expect(members).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
        expect(members).not.toContain('docs/readme.md');
        expect(communities).toHaveLength(1);
    });

    it('names a community after its highest structural fan-in hub path', () => {
        const communities = detectCommunities(nodes, links);
        expect(communities[0].autoLabel).toBe('src/b.ts');
        expect(communities[0].hub).toBe('src/b.ts');
        expect(communities[0].label).toBe('src/b.ts');
    });

    it('applies a custom label using the stable member-set key', () => {
        const initial = detectCommunities(nodes, links);
        const key = initial[0].key;
        expect(key).toBe(communityKey(initial[0].files));
        const renamed = detectCommunities(nodes, links, { labels: { [key]: 'UI shell' } });
        expect(renamed[0].label).toBe('UI shell');
        expect(renamed[0].autoLabel).toBe('src/b.ts');
        expect(renamed[0].custom).toBe(true);
    });

    it('is deterministic when the input order changes', () => {
        const forward = detectCommunities(nodes, links);
        const reversed = detectCommunities(nodes.slice().reverse(), links.slice().reverse());
        expect(reversed.map(community => ({
            key: community.key,
            label: community.label,
            files: community.files,
        }))).toEqual(forward.map(community => ({
            key: community.key,
            label: community.label,
            files: community.files,
        })));
    });

    it('puts isolated code files into the Others bucket', () => {
        const communities = detectCommunities(
            [{ id: 'src/a.ts' }, { id: 'src/b.ts' }, { id: 'src/alone.ts' }],
            [{ source: 'src/a.ts', target: 'src/b.ts', type: 'import' }],
        );
        expect(communities.some(community => community.isOthers && community.files.includes('src/alone.ts'))).toBe(true);
    });
});
