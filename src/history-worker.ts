/**
 * history-worker.ts — Background worker that scans git history commit by commit.
 * 
 * Receives { rootPath, skipDirs, historyDir } via workerData.
 * Posts incremental progress messages back to the parent.
 * 
 * Message protocol:
 *   → parent: { type: 'index', payload: CommitIndex }          — initial index ready
 *   → parent: { type: 'progress', payload: { scanned, total } } — scan progress
 *   → parent: { type: 'delta', payload: CommitDelta }           — one commit scanned
 *   → parent: { type: 'done' }                                  — scan complete
 *   → parent: { type: 'error', message: string }                — error
 */

import { parentPort, workerData } from 'worker_threads';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { getCommitIndex, getFileAtCommit, isGitRepo } from './analyzer/git-history';
import { createImportResolver, confidenceScore, loadImportAliases, type ImportResolver } from './analyzer/path-resolver';
import { computeComplexity } from './analyzer/complexity';
import { initTreeSitter, parseSource, hasGrammar } from './analyzer/tree-sitter-loader';
import { TreeSitterCParser } from './analyzer/parsers/ts-c-parser';
import { TreeSitterCppParser } from './analyzer/parsers/ts-cpp-parser';
import { TreeSitterJSParser } from './analyzer/parsers/ts-js-parser';
import { TreeSitterTSParser } from './analyzer/parsers/ts-ts-parser';
import { TreeSitterPyParser } from './analyzer/parsers/ts-py-parser';
import { TreeSitterJavaParser } from './analyzer/parsers/ts-java-parser';
import { TreeSitterGoParser } from './analyzer/parsers/ts-go-parser';
import { TreeSitterRustParser } from './analyzer/parsers/ts-rust-parser';
import { TreeSitterKotlinParser } from './analyzer/parsers/ts-kotlin-parser';
import { TreeSitterRubyParser } from './analyzer/parsers/ts-ruby-parser';
import { TreeSitterSwiftParser } from './analyzer/parsers/ts-swift-parser';
import { TreeSitterCSharpParser } from './analyzer/parsers/ts-csharp-parser';
import { TreeSitterPhpParser } from './analyzer/parsers/ts-php-parser';
import { TreeSitterBashParser } from './analyzer/parsers/ts-bash-parser';
import { TreeSitterLuaParser } from './analyzer/parsers/ts-lua-parser';
import { VueParser } from './analyzer/parsers/vue-parser';
import { HTMLParser } from './analyzer/parsers/html-parser';
import { CSSParser } from './analyzer/parsers/css-parser';
import type { BaseParser } from './analyzer/parsers/base-parser';
import type { FileInfo, CommitIndex, CommitDelta, DeltaNodeState, FileSymbols } from './analyzer/types';

interface HistoryWorkerInput {
    rootPath: string;
    skipDirs: string[];
    historyDir: string;       // path to .aura/history/
}

const LANGUAGE_MAP: Record<string, string> = {
    '.c': 'c', '.h': 'c',
    '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp',
    '.hpp': 'cpp', '.hxx': 'cpp', '.hh': 'cpp',
    '.js': 'javascript', '.ts': 'typescript',
    '.py': 'python', '.css': 'css',
    '.html': 'html', '.htm': 'html',
    '.java': 'java', '.go': 'go', '.rs': 'rust',
    '.kt': 'kotlin', '.kts': 'kotlin',
    '.rb': 'ruby', '.swift': 'swift',
    '.cs': 'csharp', '.php': 'php', '.vue': 'vue',
    '.sh': 'bash', '.bash': 'bash', '.lua': 'lua',
    '.md': 'documentation', '.markdown': 'documentation',
    '.txt': 'documentation', '.rst': 'documentation'
};

const SUPPORTED_EXTENSIONS = new Set(Object.keys(LANGUAGE_MAP));

const PARSER_REGISTRY: Record<string, BaseParser> = {
    'c': new TreeSitterCParser(),
    'cpp': new TreeSitterCppParser(),
    'javascript': new TreeSitterJSParser(),
    'typescript': new TreeSitterTSParser(),
    'python': new TreeSitterPyParser(),
    'java': new TreeSitterJavaParser(),
    'go': new TreeSitterGoParser(),
    'rust': new TreeSitterRustParser(),
    'kotlin': new TreeSitterKotlinParser(),
    'ruby': new TreeSitterRubyParser(),
    'swift': new TreeSitterSwiftParser(),
    'csharp': new TreeSitterCSharpParser(),
    'php': new TreeSitterPhpParser(),
    'vue': new VueParser(),
    'bash': new TreeSitterBashParser(),
    'lua': new TreeSitterLuaParser(),
    'html': new HTMLParser(),
    'css': new CSSParser()
};

const LANG_FAMILY: Record<string, string> = {
    'c': 'c', 'javascript': 'js', 'typescript': 'js', 'python': 'py',
    'java': 'java', 'go': 'go', 'rust': 'rust',
    'csharp': 'csharp', 'php': 'php', 'bash': 'bash', 'lua': 'lua'
};

const SYMBOL_LANGUAGES = new Set(['c', 'cpp', 'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'kotlin', 'ruby', 'swift', 'csharp', 'php', 'bash', 'lua']);

function post(msg: unknown): void {
    parentPort?.postMessage(msg);
}

/**
 * Build a FileInfo-like object from git-show content (no filesystem access).
 */
function buildFileInfoFromContent(
    relativePath: string,
    content: string
): FileInfo {
    const ext = extname(relativePath).toLowerCase();
    const parts = relativePath.split('/');
    return {
        id: relativePath,
        name: parts[parts.length - 1],
        path: relativePath,
        fullPath: '',  // not on disk
        language: LANGUAGE_MAP[ext] || 'unknown',
        extension: ext,
        size: Buffer.byteLength(content, 'utf-8'),
        linesOfCode: content.split('\n').filter(l => l.trim().length > 0).length,
        lastModified: 0,
        group: parts.length > 1 ? parts[0] : '/',
        content
    };
}

/**
 * Parse a single file to extract its relations (imports) and symbols.
 * Returns a DeltaNodeState with resolved outgoing links.
 */
async function analyzeFileForDelta(
    fileInfo: FileInfo,
    resolver: ImportResolver,
): Promise<DeltaNodeState> {
    const parser = PARSER_REGISTRY[fileInfo.language];

    // Parse AST if grammar is available
    let tree: import('web-tree-sitter').Tree | undefined;
    if (parser?.usesTreeSitter && hasGrammar(fileInfo.language)) {
        try {
            tree = await parseSource(fileInfo.language, fileInfo.content);
        } catch {
            // Fall back to regex parse
        }
    }

    // Parse relations (imports/includes/requires)
    const linksOut: { target: string; type: string; confidence?: number }[] = [];
    if (parser) {
        const relations = tree
            ? parser.parseAST(tree, fileInfo, {})
            : parser.parse(fileInfo, {});
        for (const rel of relations) {
            const resolution = resolver.resolve(rel.target, fileInfo.id);
            if (resolution && resolution.id !== fileInfo.id) {
                linksOut.push({ target: resolution.id, type: rel.type, confidence: confidenceScore(resolution) });
            }
        }
    }

    // Extract symbols
    let symbols: DeltaNodeState['symbols'] = undefined;
    if (SYMBOL_LANGUAGES.has(fileInfo.language) && parser) {
        const raw = tree
            ? parser.extractSymbolsAST(tree, fileInfo)
            : (parser as unknown as { extractSymbols(f: FileInfo): FileSymbols }).extractSymbols?.(fileInfo);
        if (raw) {
            symbols = {
                functions: raw.functions.map(f => ({
                    name: f.name,
                    returnType: f.returnType || '',
                    params: f.params || '',
                    line: f.line || 0,
                    type: f.type
                })),
                structs: raw.structs.map(s => ({ name: s.name, type: s.type, line: s.line || 0 })),
                enums: raw.enums.map(e => ({ name: e.name, type: e.type, line: e.line || 0 })),
                macros: raw.macros.map(m => ({ name: m.name, type: m.type, line: m.line || 0 })),
                classes: raw.classes.map(c => ({ name: c.name, type: c.type, line: c.line || 0 })),
                exports: raw.exports.map(e => ({ name: e.name, type: e.type, line: e.line || 0 })),
                interfaces: (raw.interfaces || []).map(i => ({ name: i.name, type: i.type })),
                traits: (raw.traits || []).map(t => ({ name: t.name, type: t.type })),
                typeAliases: (raw.typeAliases || []).map(ta => ({ name: ta.name, type: ta.type })),
                methods: (raw.methods || []).map(m => ({
                    name: m.name,
                    returnType: m.returnType || '',
                    params: m.params || '',
                    line: m.line || 0,
                    type: m.type,
                    visibility: m.visibility,
                    isStatic: m.isStatic,
                    isAsync: m.isAsync
                })),
                totalSymbols: raw.functions.length + raw.structs.length + raw.enums.length +
                    raw.macros.length + raw.classes.length + raw.exports.length +
                    (raw.interfaces || []).length + (raw.traits || []).length +
                    (raw.typeAliases || []).length + (raw.methods || []).length
            };
        }
    }

    // Complexity
    const complexity = computeComplexity(fileInfo).complexity;

    return {
        id: fileInfo.id,
        linesOfCode: fileInfo.linesOfCode,
        complexity,
        language: fileInfo.language,
        symbols,
        linksOut
    };
}

async function run(): Promise<void> {
    const { rootPath, skipDirs, historyDir } = workerData as HistoryWorkerInput;
    const importAliases = loadImportAliases(rootPath);

    // Initialize Tree-sitter WASM runtime
    await initTreeSitter();

    // Check git
    const gitAvailable = await isGitRepo(rootPath);
    if (!gitAvailable) {
        post({ type: 'error', message: 'Not a git repository' });
        return;
    }

    // Ensure history dir exists
    mkdirSync(historyDir, { recursive: true });

    // Step 1: Build commit index
    const commits = await getCommitIndex(rootPath);
    if (commits.length === 0) {
        post({ type: 'error', message: 'No commits found' });
        return;
    }

    // Check which deltas are already cached
    const cachedHashes = new Set<string>();
    for (const commit of commits) {
        const deltaPath = join(historyDir, `${commit.hash}.json`);
        if (existsSync(deltaPath)) {
            cachedHashes.add(commit.hash);
        }
    }

    const index: CommitIndex = {
        repoRoot: rootPath,
        totalCommits: commits.length,
        scannedCommits: cachedHashes.size,
        commits
    };

    // Save index
    writeFileSync(join(historyDir, 'index.json'), JSON.stringify(index), 'utf-8');
    post({ type: 'index', payload: index });

    // Step 2a: Send cached deltas so webview has them immediately
    for (const commit of commits) {
        if (!cachedHashes.has(commit.hash)) continue;
        try {
            const deltaPath = join(historyDir, `${commit.hash}.json`);
            const cached = JSON.parse(readFileSync(deltaPath, 'utf-8')) as CommitDelta;
            post({ type: 'delta', payload: cached });
        } catch {
            // Corrupted cache — will be re-scanned
            cachedHashes.delete(commit.hash);
        }
    }

    // Step 2b: Scan commits from newest to oldest
    const skipDirsLower = new Set(skipDirs.map(d => d.toLowerCase()));
    let scanned = cachedHashes.size;

    for (const commit of commits) {
        if (cachedHashes.has(commit.hash)) continue;

        try {
            const delta = await scanCommit(commit, rootPath, skipDirsLower, importAliases);
            
            // Save delta to cache
            const deltaPath = join(historyDir, `${commit.hash}.json`);
            writeFileSync(deltaPath, JSON.stringify(delta), 'utf-8');

            scanned++;
            post({ type: 'delta', payload: delta });
            post({ type: 'progress', payload: { scanned, total: commits.length } });

            // Update index
            index.scannedCommits = scanned;
            writeFileSync(join(historyDir, 'index.json'), JSON.stringify(index), 'utf-8');
        } catch {
            // Skip commits that fail (e.g. binary files, encoding issues)
            scanned++;
            post({ type: 'progress', payload: { scanned, total: commits.length } });
        }
    }

    post({ type: 'done' });
}

async function scanCommit(
    commit: { hash: string; date: string; author: string; message: string; files: { status: string; path: string; oldPath?: string }[] },
    rootPath: string,
    skipDirsLower: Set<string>,
    importAliases: ReturnType<typeof loadImportAliases>,
): Promise<CommitDelta> {
    const delta: CommitDelta = {
        hash: commit.hash,
        date: commit.date,
        message: commit.message,
        author: commit.author,
        added: [],
        removed: [],
        modified: {}
    };

    // Filter to supported files, skip excluded dirs
    const relevantFiles = commit.files.filter(f => {
        const ext = extname(f.path).toLowerCase();
        if (!SUPPORTED_EXTENSIONS.has(ext)) return false;
        const firstDir = f.path.split('/')[0]?.toLowerCase();
        if (firstDir && skipDirsLower.has(firstDir)) return false;
        return true;
    });

    if (relevantFiles.length === 0) return delta;

    // Get all files existing at this commit for resolution context
    // (We'll build a minimal set from the changed files for efficiency)
    const fileMap = new Map<string, FileInfo>();

    for (const f of relevantFiles) {
        const status = f.status as 'A' | 'M' | 'D' | 'R';

        if (status === 'D') {
            delta.removed.push(f.path);
            continue;
        }

        if (status === 'A') {
            delta.added.push(f.path);
        }

        // For A, M, R: fetch content and analyze
        const content = await getFileAtCommit(rootPath, commit.hash, f.path);
        if (content === null) continue;

        const fileInfo = buildFileInfoFromContent(f.path, content);
        fileMap.set(f.path, fileInfo);
    }

    // Analyze each non-deleted file
    const resolver = createImportResolver(rootPath, fileMap.keys(), importAliases);
    for (const [filePath, fileInfo] of fileMap) {
        const state = await analyzeFileForDelta(fileInfo, resolver);
        delta.modified[filePath] = state;
    }

    return delta;
}

run().catch((err) => {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
});
