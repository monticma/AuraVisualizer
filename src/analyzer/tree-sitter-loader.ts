/**
 * tree-sitter-loader.ts — Lazy-loading manager for Tree-sitter WASM grammars.
 *
 * Initializes web-tree-sitter once, then loads language grammars on demand.
 * Only grammars actually needed are loaded (based on detected file extensions).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TSParser = require('web-tree-sitter');

// In v0.20.x, Parser is the default export (constructor).
// Parser.Language becomes available after Parser.init().

import type Parser from 'web-tree-sitter';
import { join } from 'path';

/** Map from Aura language id → tree-sitter grammar .wasm filename */
const GRAMMAR_FILES: Record<string, string> = {
    'c':          'tree-sitter-c.wasm',
    'cpp':        'tree-sitter-cpp.wasm',
    'javascript': 'tree-sitter-javascript.wasm',
    'typescript':  'tree-sitter-typescript.wasm',
    'tsx':         'tree-sitter-tsx.wasm',
    'python':      'tree-sitter-python.wasm',
    'java':        'tree-sitter-java.wasm',
    'go':          'tree-sitter-go.wasm',
    'rust':        'tree-sitter-rust.wasm',
    'csharp':      'tree-sitter-c_sharp.wasm',
    'php':         'tree-sitter-php.wasm',
    'bash':        'tree-sitter-bash.wasm',
    'lua':         'tree-sitter-lua.wasm',
    'css':         'tree-sitter-css.wasm',
    'html':        'tree-sitter-html.wasm',
    'kotlin':      'tree-sitter-kotlin.wasm',
    'ruby':        'tree-sitter-ruby.wasm',
    'swift':       'tree-sitter-swift.wasm',
};

let initialized = false;
const loadedLanguages = new Map<string, Parser.Language>();
/** Pool of reusable Parser instances per language. */
const parserPool = new Map<string, Parser[]>();

/**
 * Resolve the directory containing .wasm grammar files.
 * In dev: node_modules/tree-sitter-wasms/out/
 * In production (.vsix): out/tree-sitter-wasms/
 */
function getWasmDir(): string {
    const fs = require('fs');
    const { resolve } = require('path');
    const candidates = [
        join(__dirname, 'tree-sitter-wasms'),                                  // bundled (.vsix)
        join(__dirname, '..', 'node_modules', 'tree-sitter-wasms', 'out'),     // dev from out/
        resolve('node_modules', 'tree-sitter-wasms', 'out'),                   // dev from project root (vitest)
    ];
    return candidates.find((p: string) => fs.existsSync(p)) || candidates[0];
}

/**
 * Initialize the Tree-sitter WASM runtime. Must be called once before any parsing.
 */
export async function initTreeSitter(): Promise<void> {
    if (initialized) { return; }

    const fs = require('fs');
    const { resolve } = require('path');

    // Search for web-tree-sitter.wasm in several possible locations
    const candidates = [
        join(__dirname, 'tree-sitter-wasms', 'tree-sitter.wasm'),               // bundled (.vsix)
        join(__dirname, '..', 'node_modules', 'web-tree-sitter', 'tree-sitter.wasm'),     // dev from out/
        resolve('node_modules', 'web-tree-sitter', 'tree-sitter.wasm'),         // dev from project root (vitest)
    ];
    const wasmFile = candidates.find((p: string) => fs.existsSync(p));
    if (!wasmFile) {
        throw new Error('web-tree-sitter.wasm not found. Searched:\n' + candidates.join('\n'));
    }

    await TSParser.init({
        locateFile: () => wasmFile,
    });
    initialized = true;
}

/**
 * Load a language grammar by Aura language id.
 * Returns the Language object, cached after first load.
 */
export async function loadLanguage(languageId: string): Promise<Parser.Language> {
    const cached = loadedLanguages.get(languageId);
    if (cached) { return cached; }

    const file = GRAMMAR_FILES[languageId];
    if (!file) {
        throw new Error(`No Tree-sitter grammar available for language: ${languageId}`);
    }

    const wasmDir = getWasmDir();
    const wasmPath = join(wasmDir, file);
    const language = await TSParser.Language.load(wasmPath);
    loadedLanguages.set(languageId, language);
    return language;
}

/**
 * Create a Parser instance configured for a specific language.
 */
export async function createParser(languageId: string): Promise<Parser> {
    await initTreeSitter();
    const language = await loadLanguage(languageId);
    const parser = new TSParser();
    parser.setLanguage(language);
    return parser;
}

/**
 * Get or create a cached Parser instance for a language.
 * Reuses the same Parser object across calls (Parser.parse is stateless).
 */
async function getCachedParser(languageId: string): Promise<Parser> {
    let pool = parserPool.get(languageId);
    if (!pool) { pool = []; parserPool.set(languageId, pool); }
    let parser = pool.pop();
    if (!parser) {
        parser = await createParser(languageId);
    }
    return parser;
}

/** Return a parser to the pool for reuse. */
function releaseParser(languageId: string, parser: Parser): void {
    let pool = parserPool.get(languageId);
    if (!pool) { pool = []; parserPool.set(languageId, pool); }
    pool.push(parser);
}

/**
 * Parse source code for a given language, returning the syntax tree.
 */
export async function parseSource(languageId: string, source: string): Promise<Parser.Tree> {
    const parser = await getCachedParser(languageId);
    try {
        const tree = parser.parse(source);
        if (!tree) {
            throw new Error(`Tree-sitter failed to parse source for language: ${languageId}`);
        }
        return tree;
    } finally {
        releaseParser(languageId, parser);
    }
}

/**
 * Check if a Tree-sitter grammar is available for the given language.
 */
export function hasGrammar(languageId: string): boolean {
    return languageId in GRAMMAR_FILES;
}

/**
 * Get the list of all supported Tree-sitter language IDs.
 */
export function getSupportedLanguages(): string[] {
    return Object.keys(GRAMMAR_FILES);
}

export type { Parser };
