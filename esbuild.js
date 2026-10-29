const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/** @type {esbuild.BuildOptions} */
const extensionConfig = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'out/extension.js',
    external: ['vscode'],
    logLevel: 'info',
    logOverride: { 'require-resolve-not-external': 'silent' },
    tsconfig: 'tsconfig.json',
};

/** @type {esbuild.BuildOptions} */
const workerConfig = {
    entryPoints: ['src/analyzer-worker.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'out/analyzer-worker.js',
    external: [],
    logLevel: 'info',
    tsconfig: 'tsconfig.json',
};

/** @type {esbuild.BuildOptions} */
const historyWorkerConfig = {
    entryPoints: ['src/history-worker.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'out/history-worker.js',
    external: [],
    logLevel: 'info',
    tsconfig: 'tsconfig.json',
};

/** @type {esbuild.BuildOptions} */
const mcpServerConfig = {
    entryPoints: ['src/mcp-server.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'out/mcp-server.js',
    external: [],
    logLevel: 'info',
    logOverride: { 'require-resolve-not-external': 'silent' },
    tsconfig: 'tsconfig.json',
};

async function copyWebviewAssets() {
    const webviewSrc = path.join(__dirname, 'webview');
    const webviewDest = path.join(__dirname, 'out', 'webview');

    // Copy webview directory recursively
    fs.cpSync(webviewSrc, webviewDest, { recursive: true, force: true });

    // Copy 3d-force-graph from node_modules
    const libDest = path.join(webviewDest, 'lib');
    fs.mkdirSync(libDest, { recursive: true });

    const forceGraphSrc = path.join(__dirname, 'node_modules', '3d-force-graph', 'dist', '3d-force-graph.min.js');
    if (fs.existsSync(forceGraphSrc)) {
        fs.copyFileSync(forceGraphSrc, path.join(libDest, '3d-force-graph.min.js'));
    }

    // Copy three.js — bundle as IIFE so window.THREE is set before 3d-force-graph loads.
    // We bundle a small re-export entry that exposes UnrealBloomPass / EffectComposer
    // on the same THREE namespace, so post-processing shares the runtime three instance.
    const threeEntry = path.join(__dirname, 'webview-vendor', 'three-bundle.js');
    const threeFallback = path.join(__dirname, 'node_modules', 'three', 'build', 'three.module.min.js');
    const threeSrc = fs.existsSync(threeEntry) ? threeEntry : threeFallback;
    if (fs.existsSync(threeSrc)) {
        await esbuild.build({
            entryPoints: [threeSrc],
            bundle: true,
            format: 'iife',
            globalName: 'THREE',
            minify: true,
            outfile: path.join(libDest, 'three.global.js'),
            logLevel: 'silent',
            footer: { js: 'window.THREE = THREE;' },
        });
    }

    // Risk core — shared scoring logic, bundled for the webview as window.AuraRisk.
    // The same source (src/risk/risk-core.ts) is imported by the extension host, so
    // the Risk tab, the status bar and the MCP tools share one implementation.
    await esbuild.build({
        entryPoints: [path.join(__dirname, 'src', 'risk', 'risk-core.ts')],
        bundle: true,
        format: 'iife',
        globalName: 'AuraRisk',
        outfile: path.join(webviewDest, 'js', 'risk-core.js'),
        logLevel: 'silent',
        tsconfig: 'tsconfig.json',
    });

    // Flight core — pilot mode math, bundled for the webview as window.AuraPilot
    // (same single-source pattern as risk-core).
    await esbuild.build({
        entryPoints: [path.join(__dirname, 'src', 'flight', 'flight-core.ts')],
        bundle: true,
        format: 'iife',
        globalName: 'AuraPilot',
        outfile: path.join(webviewDest, 'js', 'flight-core.js'),
        logLevel: 'silent',
        tsconfig: 'tsconfig.json',
    });

    // Co-change core — temporal coupling, bundled as window.AuraCochange.
    await esbuild.build({
        entryPoints: [path.join(__dirname, 'src', 'analysis', 'cochange.ts')],
        bundle: true,
        format: 'iife',
        globalName: 'AuraCochange',
        outfile: path.join(webviewDest, 'js', 'cochange-core.js'),
        logLevel: 'silent',
        tsconfig: 'tsconfig.json',
    });

    // Trend core — complexity trends, bundled as window.AuraTrend.
    await esbuild.build({
        entryPoints: [path.join(__dirname, 'src', 'analysis', 'trend.ts')],
        bundle: true,
        format: 'iife',
        globalName: 'AuraTrend',
        outfile: path.join(webviewDest, 'js', 'trend-core.js'),
        logLevel: 'silent',
        tsconfig: 'tsconfig.json',
    });

    // Architecture core — layer rules engine, bundled as window.AuraArch.
    // Same single-source pattern as risk-core: the host, the webview and the
    // MCP server all evaluate violations with this module.
    await esbuild.build({
        entryPoints: [path.join(__dirname, 'src', 'arch', 'arch-core.ts')],
        bundle: true,
        format: 'iife',
        globalName: 'AuraArch',
        outfile: path.join(webviewDest, 'js', 'arch-core.js'),
        logLevel: 'silent',
        tsconfig: 'tsconfig.json',
    });

    // Dead-code core — exemption rules parser/serializer, bundled as
    // window.AuraDeadCode for the structured rules editor.
    await esbuild.build({
        entryPoints: [path.join(__dirname, 'src', 'analysis', 'dead-code.ts')],
        bundle: true,
        format: 'iife',
        globalName: 'AuraDeadCode',
        outfile: path.join(webviewDest, 'js', 'dead-code-core.js'),
        logLevel: 'silent',
        tsconfig: 'tsconfig.json',
    });

    console.log('Webview assets copied.');
}

async function copyTreeSitterWasms() {
    const destDir = path.join(__dirname, 'out', 'tree-sitter-wasms');
    fs.mkdirSync(destDir, { recursive: true });

    // Copy the web-tree-sitter runtime .wasm
    const runtimeWasm = path.join(__dirname, 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm');
    if (fs.existsSync(runtimeWasm)) {
        fs.copyFileSync(runtimeWasm, path.join(destDir, 'tree-sitter.wasm'));
    }

    // Copy language grammar .wasm files (only the ones we use)
    const grammarsDir = path.join(__dirname, 'node_modules', 'tree-sitter-wasms', 'out');
    const NEEDED_GRAMMARS = new Set([
        'tree-sitter-c.wasm',
        'tree-sitter-cpp.wasm',
        'tree-sitter-javascript.wasm',
        'tree-sitter-typescript.wasm',
        'tree-sitter-tsx.wasm',
        'tree-sitter-python.wasm',
        'tree-sitter-java.wasm',
        'tree-sitter-go.wasm',
        'tree-sitter-rust.wasm',
        'tree-sitter-css.wasm',
        'tree-sitter-html.wasm',
        'tree-sitter-c_sharp.wasm',
        'tree-sitter-php.wasm',
        'tree-sitter-bash.wasm',
        'tree-sitter-lua.wasm',
        'tree-sitter-kotlin.wasm',
        'tree-sitter-ruby.wasm',
        'tree-sitter-swift.wasm',
    ]);
    if (fs.existsSync(grammarsDir)) {
        const wasmFiles = fs.readdirSync(grammarsDir).filter(f => NEEDED_GRAMMARS.has(f));
        for (const file of wasmFiles) {
            fs.copyFileSync(path.join(grammarsDir, file), path.join(destDir, file));
        }
        console.log(`Tree-sitter WASM files copied (${wasmFiles.length} grammars).`);
    } else {
        console.warn('Warning: tree-sitter-wasms not found, skipping grammar copy.');
    }
}

async function main() {
    await copyWebviewAssets();
    await copyTreeSitterWasms();

    // Copy sql.js WASM binary to out/ (next to the bundled JS)
    const sqlWasmSrc = path.join(__dirname, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
    if (fs.existsSync(sqlWasmSrc)) {
        fs.copyFileSync(sqlWasmSrc, path.join(__dirname, 'out', 'sql-wasm.wasm'));
        console.log('sql-wasm.wasm copied.');
    }

    if (watch) {
        const ctx = await esbuild.context(extensionConfig);
        await ctx.watch();
        console.log('Watching for changes...');
    } else {
        await esbuild.build(extensionConfig);
        await esbuild.build(workerConfig);
        await esbuild.build(historyWorkerConfig);
        await esbuild.build(mcpServerConfig);
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
