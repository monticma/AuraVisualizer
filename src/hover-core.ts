/**
 * hover-core.ts — pure logic behind the import hover (V3-04).
 *
 * Three questions, all answerable without `vscode`: *is the cursor on an import
 * specifier?*, *which graph node does that specifier point at?* and *what does
 * the hover card say?*. The provider (`hover.ts`) only adapts these results to
 * the editor API, so everything here is unit-tested.
 */

/** A specifier found on a line, with the range of the specifier itself. */
export interface ImportMatch {
    /** The specifier text (`./utils/helper`, `a.b.C`, `crate::x`, …). */
    value: string;
    /** 0-based start column of the specifier (quotes excluded). */
    start: number;
    /** 0-based end column (exclusive). */
    end: number;
}

const JS_LIKE = new Set(['javascript', 'javascriptreact', 'typescript', 'typescriptreact', 'vue', 'svelte']);

/** One import pattern: a regex plus the group that carries the specifier. */
interface ImportPattern {
    re: RegExp;
    group: number;
}

/** Patterns per VS Code language id — quoted specifiers exclude the quotes. */
const PATTERNS: Record<string, ImportPattern[]> = {
    python: [
        { re: /\bfrom\s+([\w.]+)\s+import\b/, group: 1 },
        { re: /\bimport\s+([\w.]+)/, group: 1 },
    ],
    c: [
        { re: /#\s*include\s*[<"]([^>"]+)[>"]/, group: 1 },
    ],
    cpp: [
        { re: /#\s*include\s*[<"]([^>"]+)[>"]/, group: 1 },
    ],
    java: [
        { re: /\bimport\s+(?:static\s+)?([\w.]+)\s*;/, group: 1 },
    ],
    kotlin: [
        { re: /\bimport\s+([\w.]+)/, group: 1 },
    ],
    go: [
        { re: /\bimport\s+(?:[\w.]+\s+)?"([^"]+)"/, group: 1 },
    ],
    rust: [
        { re: /\buse\s+([\w:]+)/, group: 1 },
        { re: /\bmod\s+(\w+)\s*;/, group: 1 },
    ],
    csharp: [
        { re: /\busing\s+(?:static\s+)?([\w.]+)\s*;/, group: 1 },
    ],
    php: [
        { re: /\b(?:require|require_once|include|include_once)\s*\(?\s*['"]([^'"]+)['"]/, group: 1 },
        { re: /\buse\s+([\w\\]+)/, group: 1 },
    ],
    ruby: [
        { re: /\brequire(?:_relative)?\s*\(?\s*['"]([^'"]+)['"]/, group: 1 },
    ],
    lua: [
        { re: /\brequire\s*\(?\s*['"]([^'"]+)['"]/, group: 1 },
    ],
    shellscript: [
        { re: /\b(?:source|\.)\s+([\w./-]+)/, group: 1 },
    ],
};

/** JS/TS/Vue: `from 'x'`, side-effect `import 'x'`, `require('x')`, `import('x')`. */
const JS_PATTERNS: ImportPattern[] = [
    { re: /\bfrom\s*['"]([^'"]+)['"]/, group: 1 },
    { re: /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/, group: 1 },
    { re: /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/, group: 1 },
    { re: /\bimport\s+['"]([^'"]+)['"]/, group: 1 },
];

/** Language ids the hover understands. */
export function supportsLanguage(languageId: string): boolean {
    const id = (languageId || '').toLowerCase();
    return JS_LIKE.has(id) || Object.prototype.hasOwnProperty.call(PATTERNS, id);
}

/**
 * Find the import specifier under `column` on `lineText`.
 *
 * Returns undefined when the line carries no import, when the language is not
 * supported, or when the cursor is anywhere else on the line — a hover must
 * never appear over arbitrary text.
 */
export function findImportSpecifier(lineText: string, languageId: string, column: number): ImportMatch | undefined {
    for (const match of matchSpecifiers(lineText, languageId)) {
        if (column >= match.start && column <= match.end) return match;
    }
    return undefined;
}

/** First import specifier of the line, whatever the cursor position. */
export function findFirstSpecifier(lineText: string, languageId: string): ImportMatch | undefined {
    return matchSpecifiers(lineText, languageId)[0];
}

/** All import specifiers of a line, in order. */
export function matchSpecifiers(lineText: string, languageId: string): ImportMatch[] {
    if (typeof lineText !== 'string' || !lineText) return [];
    const id = (languageId || '').toLowerCase();
    const patterns = JS_LIKE.has(id) ? JS_PATTERNS : PATTERNS[id];
    if (!patterns || !patterns.length) return [];

    const out: ImportMatch[] = [];
    for (const pattern of patterns) {
        const re = new RegExp(pattern.re.source, 'g');
        let match: RegExpExecArray | null;
        while ((match = re.exec(lineText)) !== null) {
            const value = match[pattern.group];
            if (!value) continue;
            const offset = match[0].indexOf(value);
            if (offset < 0) continue;
            const start = match.index + offset;
            out.push({ value, start, end: start + value.length });
        }
    }
    out.sort((a, b) => a.start - b.start);
    return out;
}

// ============================================================
// Specifier → graph node
// ============================================================

/** Extensions tried when a specifier omits it (mirrors the analyzer's order). */
export const CANDIDATE_EXTENSIONS = [
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.go', '.rs', '.java', '.kt', '.kts', '.cs', '.rb', '.php',
    '.c', '.h', '.cpp', '.hpp', '.lua', '.sh', '.vue', '.css', '.html',
];

export interface SpecifierResolution {
    nodeId: string;
    /** Mirrors the edge-confidence vocabulary: 1.0 exact … 0.5 unique basename. */
    confidence: number;
}

/** POSIX join + normalize (no `path` import: the ids are always `/`-separated). */
function joinPosix(dir: string, relative: string): string {
    const stack = dir.split('/').filter(Boolean);
    for (const segment of relative.split('/')) {
        if (!segment || segment === '.') continue;
        if (segment === '..') stack.pop();
        else stack.push(segment);
    }
    return stack.join('/');
}

function dirName(fileId: string): string {
    const index = fileId.lastIndexOf('/');
    return index < 0 ? '' : fileId.slice(0, index);
}

function baseName(fileId: string): string {
    const index = fileId.lastIndexOf('/');
    const name = index < 0 ? fileId : fileId.slice(index + 1);
    const dot = name.lastIndexOf('.');
    return dot > 0 ? name.slice(0, dot) : name;
}

/** Try a concrete path against the graph, with the usual extension/index variants. */
function matchPath(path: string, known: ReadonlySet<string>): SpecifierResolution | undefined {
    if (known.has(path)) return { nodeId: path, confidence: 1 };
    for (const ext of CANDIDATE_EXTENSIONS) {
        if (known.has(path + ext)) return { nodeId: path + ext, confidence: 0.9 };
    }
    for (const ext of CANDIDATE_EXTENSIONS) {
        if (known.has(path + '/index' + ext)) return { nodeId: path + '/index' + ext, confidence: 0.85 };
    }
    return undefined;
}

/**
 * Resolve an import specifier to a node id of the current graph.
 *
 * Relative specifiers are joined to the importing file's directory; dotted /
 * `::`-separated module paths (Python, Java, C#, Rust) are turned into path
 * segments. Anything unresolved or ambiguous returns undefined — the hover then
 * simply does not appear.
 */
export function resolveSpecifier(
    specifier: string,
    fromFileId: string,
    knownIds: ReadonlySet<string> | ReadonlyArray<string>,
): SpecifierResolution | undefined {
    const raw = (specifier || '').trim();
    if (!raw || !fromFileId) return undefined;
    const known = knownIds instanceof Set ? knownIds : new Set(knownIds);

    // Strip query/hash noise and normalise separators.
    const clean = raw.split('?')[0].split('#')[0].replace(/\\/g, '/');
    if (!clean) return undefined;

    // 1. Relative to the importing file.
    if (clean.startsWith('./') || clean.startsWith('../') || clean === '.' || clean === '..') {
        const joined = joinPosix(dirName(fromFileId), clean);
        if (!joined) return undefined;
        return matchPath(joined, known);
    }

    // 2. Workspace-relative (`src/utils/helper`, `utils/helper.ts`).
    const direct = matchPath(clean.replace(/^\/+/, ''), known);
    if (direct) return direct;

    // 3. Dotted (`pkg.mod`, `a.b.C`) and `::` (Rust) module paths → segments.
    if (clean.includes('.') || clean.includes('::')) {
        const asPath = clean
            .replace(/::/g, '/')
            .replace(/^crate\//, '')
            .replace(/^super\//, '')
            .replace(/^self\//, '')
            .replace(/\./g, '/');
        const bySegments = matchPath(asPath, known);
        if (bySegments) return bySegments;
        const bySuffix = matchSuffix(asPath, known);
        if (bySuffix) return bySuffix;
    }

    // 4. Any node whose path ends with the specifier (`utils/helper`).
    const suffix = matchSuffix(clean, known);
    if (suffix) return suffix;

    // 5. Unique basename (`helper` → only one helper.* in the graph).
    const wanted = baseName(clean);
    if (wanted) {
        const hits = [...known].filter(id => baseName(id) === wanted);
        if (hits.length === 1) return { nodeId: hits[0], confidence: 0.5 };
    }
    return undefined;
}

/** `/x/y` suffix lookup, with the extension variants. */
function matchSuffix(path: string, known: ReadonlySet<string>): SpecifierResolution | undefined {
    for (const ext of ['', ...CANDIDATE_EXTENSIONS]) {
        const tail = '/' + path + ext;
        const hits: string[] = [];
        for (const id of known) {
            if (id.endsWith(tail)) hits.push(id);
        }
        if (hits.length === 1) return { nodeId: hits[0], confidence: 0.6 };
        if (hits.length > 1) return { nodeId: shortest(hits), confidence: 0.6 };
    }
    return undefined;
}

function shortest(ids: string[]): string {
    return ids.reduce((best, id) => (id.length < best.length ? id : best), ids[0]);
}

// ============================================================
// Hover card
// ============================================================

export interface HoverMetrics {
    id: string;
    language?: string;
    linesOfCode?: number;
    complexity?: number;
    cognitive?: number;
    fanIn?: number;
    fanOut?: number;
    layer?: string;
    archViolations?: number;
    riskBucket?: string;
    riskScore?: number;
    confidence?: number;
}

export interface HoverLinks {
    focus: string;
    blast: string;
    open: string;
}

/** Build the markdown of the hover card (pure — the provider wraps it). */
export function formatHover(metrics: HoverMetrics, links: HoverLinks): string {
    const lines: string[] = [];
    const title: string[] = [`**\`${metrics.id}\`**`];
    if (metrics.language) title.push(metrics.language);
    lines.push(title.join(' · '));

    const facts: string[] = [];
    if (typeof metrics.linesOfCode === 'number' && metrics.linesOfCode > 0) facts.push(`${metrics.linesOfCode} LOC`);
    if (typeof metrics.complexity === 'number' && metrics.complexity > 0) facts.push(`complexity ${metrics.complexity}`);
    if (typeof metrics.cognitive === 'number' && metrics.cognitive > 0) facts.push(`cognitive ${metrics.cognitive}`);
    if (facts.length) lines.push(facts.join(' · '));

    const degrees: string[] = [];
    if (typeof metrics.fanOut === 'number') degrees.push(`↘ ${metrics.fanOut} dependencies`);
    if (typeof metrics.fanIn === 'number') degrees.push(`↗ ${metrics.fanIn} dependents`);
    if (degrees.length) lines.push(degrees.join(' · '));

    const arch: string[] = [];
    if (metrics.layer) arch.push(`🏛️ ${metrics.layer}`);
    if (typeof metrics.archViolations === 'number') {
        arch.push(metrics.archViolations > 0
            ? `⚠ ${metrics.archViolations} violation${metrics.archViolations > 1 ? 's' : ''}`
            : '✓ no violation');
    }
    if (arch.length) lines.push(arch.join(' · '));

    if (metrics.riskBucket && typeof metrics.riskScore === 'number') {
        lines.push(`🛡️ risk: ${metrics.riskBucket} (${Math.round(metrics.riskScore)})`);
    }
    if (typeof metrics.confidence === 'number' && metrics.confidence < 1) {
        lines.push(`_resolved with confidence ${metrics.confidence.toFixed(2)}_`);
    }

    lines.push('');
    lines.push(`[⟡ Focus in Aura](${links.focus}) · [💥 Blast radius](${links.blast}) · [📂 Open file](${links.open})`);
    return lines.join('\n');
}
