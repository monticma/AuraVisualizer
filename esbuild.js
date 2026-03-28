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

    // Copy three.js — bundle as IIFE so window.THREE is set before 3d-force-graph loads
    const threeSrc = path.join(__dirname, 'node_modules', 'three', 'build', 'three.module.min.js');
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

    console.log('Webview assets copied.');
}

async function main() {
    await copyWebviewAssets();

    if (watch) {
        const ctx = await esbuild.context(extensionConfig);
        await ctx.watch();
        console.log('Watching for changes...');
    } else {
        await esbuild.build(extensionConfig);
    }
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
