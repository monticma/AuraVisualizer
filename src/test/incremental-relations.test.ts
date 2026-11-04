import { describe, it, expect, beforeAll } from 'vitest';
import { buildIncrementalContext, preParseFiles, rebuildSingleFile } from '../analyzer/graph-builder';
import { initTreeSitter } from '../analyzer/tree-sitter-loader';
import { PARSER_VERSION } from '../analyzer/fingerprint';
import { makeFileInfo } from './helpers';

beforeAll(async () => {
    await initTreeSitter();
});

/**
 * The incremental path re-parses one file with the same parser object as a full
 * analysis, so relation extractors added later (`script` / `stylesheet` asset
 * refs, `global-use` namespaces) must show up there too. These tests pin that
 * down — a stale DB once showed satellites with `fan_in = 0` because relations
 * are only recomputed for files that actually change.
 */
describe('incremental relation extraction', () => {
    const provider = makeFileInfo({
        id: 'src/webview/WebviewProvider.ts',
        content: [
            'const scripts = vscode.Uri.joinPath(this.extensionUri, "js", "sprites.js");',
            'const styles = vscode.Uri.joinPath(this.extensionUri, "css", "style.css");',
        ].join('\n'),
        language: 'typescript',
        extension: '.ts',
    });
    const script = makeFileInfo({
        id: 'webview/js/sprites.js',
        content: 'window.AuraSprites = { ripple: function () {} };\n',
        language: 'javascript',
        extension: '.js',
    });
    const style = makeFileInfo({
        id: 'webview/css/style.css',
        content: '.a { color: red; }\n',
        language: 'css',
        extension: '.css',
    });

    it('emits script and stylesheet edges for a single-file rebuild', async () => {
        const files = [provider, script, style];
        const trees = await preParseFiles(files);
        const ctx = buildIncrementalContext(files, trees);
        const single = await preParseFiles([provider]);
        const result = rebuildSingleFile(provider, ctx, single.get(provider.id));

        const targets = result.outEdges.map(edge => `${edge.type}:${edge.target}`);
        expect(targets).toContain('script:webview/js/sprites.js');
        expect(targets).toContain('stylesheet:webview/css/style.css');
    });

    it('bumps PARSER_VERSION whenever the relation set changes', () => {
        // 2026-11-04.1 introduced the `global-use` edges (V4-09). Bumping this
        // constant is what forces existing databases to be re-analysed instead
        // of keeping relations extracted by an older parser.
        expect(PARSER_VERSION >= '2026-11-04.1').toBe(true);
    });
});
