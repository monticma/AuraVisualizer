/**
 * path-resolver.ts — Import resolution with project aliases (V2-12).
 *
 * Pure Node module (no `vscode`): shared by the graph builder, the incremental
 * rebuild and the history worker so links/resolved deltas stay consistent.
 *
 * Supported configuration, best effort:
 *   - tsconfig.json / jsconfig.json: compilerOptions.baseUrl + paths
 *   - simple `extends` chains (relative files only)
 *   - Vite/webpack `resolve.alias` entries that map to a static path
 *   - Python `src/` layout (`src/pkg/mod.py`, `src/pkg/__init__.py`)
 *
 * Resolution order keeps the historical graph-builder behavior:
 * exact → relative → alias/paths → baseUrl → Python src → extension/index →
 * suffix → basename. Each result carries a confidence/method so callers can
 * diagnose whether an edge came from an explicit alias or a heuristic.
 */

import { existsSync, readFileSync } from 'fs';
import { basename, dirname, isAbsolute, join, normalize, relative, resolve } from 'path';

export type ResolveConfidence = 'high' | 'medium' | 'low';
export type ResolveMethod =
    | 'exact'
    | 'relative'
    | 'alias'
    | 'paths'
    | 'baseUrl'
    | 'python-src'
    | 'extension'
    | 'index'
    | 'suffix'
    | 'basename'
    | 'ambiguous';

export interface ResolveResult {
    id: string;
    confidence: ResolveConfidence;
    method: ResolveMethod;
}

export interface AliasConfig {
    baseUrl: string;
    paths: Record<string, string[]>;
    aliases: Record<string, string>;
    pythonRoots: string[];
}

export interface ImportResolver {
    rootDir: string;
    aliases: AliasConfig;
    resolve(target: string, sourceId: string): ResolveResult | null;
}

/** Numeric edge confidence: exact 1.0 → ambiguous 0.5. */
export function confidenceScore(result: ResolveResult): number {
    switch (result.method) {
        case 'exact':
        case 'relative':
        case 'alias':
        case 'paths':
        case 'baseUrl':
            return 1;
        case 'extension':
        case 'index':
        case 'python-src':
            return 0.9;
        case 'suffix':
            return 0.8;
        case 'basename':
            return 0.6;
        case 'ambiguous':
        default:
            return 0.5;
    }
}

const IMPORT_EXTENSIONS = [
    '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts',
    '.py', '.pyi', '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.hxx', '.hh',
    '.java', '.go', '.rs', '.kt', '.kts', '.rb', '.swift', '.cs', '.php',
    '.sh', '.bash', '.lua', '.css', '.scss', '.sass', '.less', '.html', '.htm',
    '.vue', '.json', '.md', '.markdown', '.txt', '.rst',
];

const INDEX_FILES = [
    'index.js', 'index.jsx', 'index.ts', 'index.tsx',
    '__init__.py', 'mod.rs', 'index.html',
];

function slashes(value: string): string {
    return value.replace(/\\/g, '/').replace(/\/+/g, '/');
}

function normalizeId(value: string): string {
    return slashes(normalize(value)).replace(/^\.\//, '').replace(/^\/+/, '');
}

function safeRelative(rootDir: string, absolutePath: string): string {
    const rel = relative(rootDir, absolutePath);
    return normalizeId(rel || '.');
}

function readJsonc(filePath: string): Record<string, unknown> | null {
    try {
        const raw = readFileSync(filePath, 'utf-8');
        return JSON.parse(stripJsonc(raw)) as Record<string, unknown>;
    } catch {
        return null;
    }
}

/** Strip // and block comments while preserving strings, then trailing commas. */
function stripJsonc(input: string): string {
    let out = '';
    let inString = false;
    let escaped = false;
    for (let i = 0; i < input.length; i++) {
        const c = input[i];
        const next = input[i + 1];
        if (inString) {
            out += c;
            if (escaped) escaped = false;
            else if (c === '\\') escaped = true;
            else if (c === '"') inString = false;
            continue;
        }
        if (c === '"') { inString = true; out += c; continue; }
        if (c === '/' && next === '/') {
            while (i < input.length && input[i] !== '\n') i++;
            out += '\n';
            continue;
        }
        if (c === '/' && next === '*') {
            i += 2;
            while (i < input.length && !(input[i] === '*' && input[i + 1] === '/')) i++;
            i++;
            continue;
        }
        out += c;
    }
    return out.replace(/,(\s*[}\]])/g, '$1');
}

function mergeAliasConfig(target: AliasConfig, source: AliasConfig): void {
    if (!target.baseUrl && source.baseUrl) target.baseUrl = source.baseUrl;
    for (const [key, values] of Object.entries(source.paths)) {
        if (!target.paths[key]) target.paths[key] = values;
    }
    for (const [key, value] of Object.entries(source.aliases)) {
        if (!target.aliases[key]) target.aliases[key] = value;
    }
    for (const root of source.pythonRoots) {
        if (!target.pythonRoots.includes(root)) target.pythonRoots.push(root);
    }
}

function configAliases(configPath: string, rootDir: string, depth = 0): AliasConfig {
    const result: AliasConfig = { baseUrl: '', paths: {}, aliases: {}, pythonRoots: [] };
    if (depth > 5) return result;
    const json = readJsonc(configPath);
    if (!json) return result;

    const extendsValue = typeof json.extends === 'string' ? json.extends : '';
    if (extendsValue && (extendsValue.startsWith('.') || isAbsolute(extendsValue))) {
        const parentPath = isAbsolute(extendsValue)
            ? extendsValue
            : resolve(dirname(configPath), extendsValue.endsWith('.json') ? extendsValue : extendsValue + '.json');
        if (existsSync(parentPath)) mergeAliasConfig(result, configAliases(parentPath, rootDir, depth + 1));
    }

    const compiler = (json.compilerOptions && typeof json.compilerOptions === 'object')
        ? json.compilerOptions as Record<string, unknown>
        : {};
    if (typeof compiler.baseUrl === 'string') {
        result.baseUrl = normalizeId(safeRelative(rootDir, resolve(dirname(configPath), compiler.baseUrl)));
    }
    if (compiler.paths && typeof compiler.paths === 'object') {
        for (const [pattern, values] of Object.entries(compiler.paths as Record<string, unknown>)) {
            if (!Array.isArray(values)) continue;
            const targets = values.filter((v): v is string => typeof v === 'string').map(slashes);
            if (targets.length > 0) result.paths[pattern] = targets;
        }
    }
    return result;
}

/** Best-effort static `resolve.alias` extraction from Vite/webpack configs. */
function extractBundlerAliases(rootDir: string, result: AliasConfig): void {
    const candidates = [
        'vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.mts',
        'webpack.config.js', 'webpack.config.ts', 'webpack.config.mjs',
    ];
    for (const name of candidates) {
        const configPath = join(rootDir, name);
        if (!existsSync(configPath)) continue;
        let text = '';
        try { text = readFileSync(configPath, 'utf-8'); } catch { continue; }
        const re = /(['"])([@~#$][\w@/.-]*)\1\s*:\s*(?:path\.)?(?:resolve|join)\(([^)]*)\)/g;
        let match: RegExpExecArray | null;
        while ((match = re.exec(text)) !== null) {
            const key = match[2];
            const quoted = [...match[3].matchAll(/(['"])([^'"]+)\1/g)].map((m) => m[2]);
            const target = quoted[quoted.length - 1];
            if (!target) continue;
            const absolute = isAbsolute(target) ? target : resolve(rootDir, target);
            result.aliases[key] = normalizeId(safeRelative(rootDir, absolute));
        }
        const simple = /(['"])([@~#$][\w@/.-]*)\1\s*:\s*(['"])([^'"]+)\3/g;
        while ((match = simple.exec(text)) !== null) {
            const key = match[2];
            if (result.aliases[key]) continue;
            result.aliases[key] = normalizeId(match[4]);
        }
    }
}

export function loadImportAliases(rootDir: string): AliasConfig {
    const result: AliasConfig = { baseUrl: '', paths: {}, aliases: {}, pythonRoots: [] };
    for (const name of ['tsconfig.json', 'jsconfig.json']) {
        const configPath = join(rootDir, name);
        if (existsSync(configPath)) mergeAliasConfig(result, configAliases(configPath, rootDir));
    }
    extractBundlerAliases(rootDir, result);
    if (existsSync(join(rootDir, 'src'))) result.pythonRoots.push('src');
    return result;
}

interface PatternMatch {
    captured: string;
}

function matchPattern(pattern: string, target: string): PatternMatch | null {
    if (!pattern.includes('*')) return pattern === target ? { captured: '' } : null;
    const star = pattern.indexOf('*');
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    if (!target.startsWith(prefix) || !target.endsWith(suffix) || target.length < prefix.length + suffix.length) return null;
    return { captured: target.slice(prefix.length, target.length - suffix.length) };
}

interface AliasCandidate {
    length: number;
    candidate: string;
    method: 'paths' | 'alias';
}

function matchPathAliases(target: string, aliases: AliasConfig): AliasCandidate[] {
    const matches: AliasCandidate[] = [];
    for (const [pattern, substitutions] of Object.entries(aliases.paths)) {
        const m = matchPattern(pattern, target);
        if (!m) continue;
        for (const substitution of substitutions) {
            const candidate = substitution.replace(/\*/g, m.captured);
            matches.push({ length: pattern.length, candidate: normalizeId(join(aliases.baseUrl, candidate)), method: 'paths' });
        }
    }
    for (const [rawKey, value] of Object.entries(aliases.aliases)) {
        const key = rawKey.replace(/\/$/, '');
        if (target === key || target.startsWith(key + '/')) {
            const rest = target.slice(key.length).replace(/^\//, '');
            matches.push({ length: key.length, candidate: normalizeId(join(value, rest)), method: 'alias' });
        }
    }
    matches.sort((a, b) => b.length - a.length);
    const seen = new Set<string>();
    return matches.filter((m) => {
        if (seen.has(m.candidate)) return false;
        seen.add(m.candidate);
        return true;
    });
}

export function createImportResolver(rootDir: string, files: Iterable<string>, aliasesOverride?: AliasConfig): ImportResolver {
    const aliases = aliasesOverride || loadImportAliases(rootDir);
    const ids = new Set<string>();
    const byBase = new Map<string, string[]>();
    for (const file of files) {
        const id = normalizeId(file);
        ids.add(id);
        const base = basename(id);
        const list = byBase.get(base);
        if (list) list.push(id);
        else byBase.set(base, [id]);
    }

    function ambiguous(ids: string[]): ResolveResult {
        return { id: ids[0], confidence: 'low', method: 'ambiguous' };
    }

    function tryCandidate(candidate: string, method: ResolveMethod, confidence: ResolveConfidence): ResolveResult | null {
        const id = normalizeId(candidate);
        if (!id || id === '.') return null;
        if (ids.has(id)) return { id, confidence, method };
        const withExts = IMPORT_EXTENSIONS.map((ext) => id + ext).filter((p) => ids.has(p));
        if (withExts.length === 1) return { id: withExts[0], confidence: 'medium', method: 'extension' };
        if (withExts.length > 1) return ambiguous(withExts);
        const withIndex = INDEX_FILES.map((index) => normalizeId(join(id, index))).filter((p) => ids.has(p));
        if (withIndex.length === 1) return { id: withIndex[0], confidence: 'medium', method: 'index' };
        if (withIndex.length > 1) return ambiguous(withIndex);
        return null;
    }

    function resolve(target: string, sourceId: string): ResolveResult | null {
        const cleanTarget = slashes(target.split('?')[0].split('#')[0]).trim();
        const source = normalizeId(sourceId);
        if (!cleanTarget) return null;

        const exact = tryCandidate(cleanTarget, 'exact', 'high');
        if (exact) return exact;

        if (cleanTarget.startsWith('.')) {
            const rel = tryCandidate(join(dirname(source), cleanTarget), 'relative', 'high');
            if (rel) return rel;
        } else if (cleanTarget.startsWith('/')) {
            const rooted = tryCandidate(cleanTarget.replace(/^\/+/, ''), 'relative', 'high');
            if (rooted) return rooted;
        } else {
            // Historical behavior: `require('utils')` (Lua) and bare local imports
            // are tried relative to the source before falling back to heuristics.
            const rel = tryCandidate(join(dirname(source), cleanTarget), 'relative', 'high');
            if (rel) return rel;
        }

        for (const match of matchPathAliases(cleanTarget, aliases)) {
            const aliased = tryCandidate(match.candidate, match.method, 'high');
            if (aliased) return aliased;
        }

        if (aliases.baseUrl) {
            const based = tryCandidate(join(aliases.baseUrl, cleanTarget), 'baseUrl', 'high');
            if (based) return based;
        }

        // Python dotted imports (`pkg.mod` / `pkg.mod.Name`) and src/ layouts.
        const dotted = cleanTarget.replace(/\./g, '/');
        if (dotted !== cleanTarget && !cleanTarget.endsWith('/')) {
            for (const root of aliases.pythonRoots.length > 0 ? aliases.pythonRoots : ['src']) {
                const py = tryCandidate(join(root, dotted), 'python-src', 'medium')
                    || tryCandidate(join(root, dotted, '__init__'), 'python-src', 'medium');
                if (py) return py;
            }
            const pyRoot = tryCandidate(dotted, 'python-src', 'medium');
            if (pyRoot) return pyRoot;
        }

        if (cleanTarget.includes('/')) {
            const suffix = '/' + cleanTarget.replace(/^\/+/, '');
            const matches: string[] = [];
            for (const id of ids) {
                if (id.endsWith(suffix)) matches.push(id);
            }
            if (matches.length === 1) return { id: matches[0], confidence: 'low', method: 'suffix' };
            if (matches.length > 1) return ambiguous(matches);
        }

        const targetBase = basename(cleanTarget);
        const sameBase = byBase.get(targetBase) || [];
        if (sameBase.length === 1) {
            return { id: sameBase[0], confidence: 'low', method: 'basename' };
        }
        if (sameBase.length > 1) return ambiguous(sameBase);
        for (const ext of IMPORT_EXTENSIONS) {
            const withExt = byBase.get(targetBase + ext) || [];
            if (withExt.length === 1) return { id: withExt[0], confidence: 'low', method: 'basename' };
            if (withExt.length > 1) return ambiguous(withExt);
        }

        return null;
    }

    return { rootDir, aliases, resolve };
}
