/**
 * resolution.ts — « ce que l'analyse n'a pas vu ».
 *
 * The graph draws what Aura resolved. This module keeps the **other half**: how
 * many relations were attempted, how many were resolved, which of them were
 * only *guessed* (suffix, basename, ambiguity) and why the rest failed — with a
 * code per reason, not a single opaque counter.
 *
 * Counters are kept **per file** so an incremental rebuild can swap one file's
 * contribution and leave the rest exact (the host stores them in
 * `file_resolution`). Everything here is pure: no fs, no vscode, no DOM.
 */

/** Why a relation could not be resolved. */
export type ResolveCode =
    /** `fastify`, `@scope/pkg` — a dependency outside the repository. */
    | 'bare-specifier'
    /** A path we understand, pointing at something that is not there. */
    | 'missing-file'
    /** A path that climbs out of the scanned root. */
    | 'outside-root'
    /** An alias (`@/x`, a `paths` entry) the project does not map. */
    | 'no-tsconfig'
    /** The target exists in the project but failed to parse. */
    | 'unparsed-file'
    /** Several candidates matched equally: we picked one, on purpose, weakly. */
    | 'ambiguous';

/** Display order — the honest ones first, the coin flip last. */
export const RESOLVE_CODES: ResolveCode[] = [
    'bare-specifier', 'missing-file', 'outside-root', 'no-tsconfig', 'unparsed-file', 'ambiguous',
];

/** One line per reason, used by the report and the Markdown export. */
export const RESOLVE_CODE_LABELS: Record<ResolveCode, string> = {
    'bare-specifier': 'external dependency (outside the repository)',
    'missing-file': 'file not found',
    'outside-root': 'path escapes the scanned root',
    'no-tsconfig': 'alias with no mapping (tsconfig/jsconfig)',
    'unparsed-file': 'target exists but did not parse',
    'ambiguous': 'several candidates, picked the weakest match',
};

/** Relation types keep a stable order so two reports never disagree. */
export const RELATION_TYPES = ['import', 'require', 'include', 'system-include', 'call', 'heritage', 'global-use'];

/**
 * Methods that are a *guess*: the file was found by matching a tail of the path
 * or by ambiguity — not by the project's own convention.
 *
 * `extension` (`./b` → `b.ts`) and `index` (`./dir` → `dir/index.ts`) are
 * deliberately **not** guesses: every TypeScript import is written that way, and
 * counting them would drown the signal.
 */
export const GUESSED_METHODS = ['suffix', 'basename', 'ambiguous'];

/** What one file contributed. Stored as JSON in `file_resolution`. */
export interface FileResolution {
    /** Relations seen, by type. A `system-include` counts here too. */
    attempts: Record<string, number>;
    /** Relations that produced an edge, by type. */
    resolved: Record<string, number>;
    /** How each resolution was found (`exact`, `suffix`, `ambiguous`…). */
    methods: Record<string, number>;
    /** Why the others failed. */
    codes: Record<string, number>;
    /** A few examples per failure, so the report can be acted on. */
    samples: { from: string; ref: string; code: ResolveCode }[];
}

/** Enough examples to be useful, few enough to keep the payload small. */
export const SAMPLES_PER_CODE = 3;

export function createFileResolution(): FileResolution {
    return { attempts: {}, resolved: {}, methods: {}, codes: {}, samples: [] };
}

function bump(bag: Record<string, number>, key: string, by = 1): void {
    bag[key] = (bag[key] || 0) + by;
}

/** One relation was seen for `type`. Called for every relation, resolved or not. */
export function recordAttempt(target: FileResolution, type: string): void {
    bump(target.attempts, type);
}

/** That relation produced an edge, found by `method`. */
export function recordResolved(target: FileResolution, type: string, method: string): void {
    bump(target.resolved, type);
    bump(target.methods, method);
}

/** That relation produced nothing, for `code`. */
export function recordUnresolved(
    target: FileResolution,
    code: ResolveCode,
    sample: { from: string; ref: string },
): void {
    bump(target.codes, code);
    const seen = target.samples.filter(entry => entry.code === code).length;
    if (seen < SAMPLES_PER_CODE) {
        target.samples.push({ from: sample.from, ref: sample.ref, code });
    }
}

/** True when the relation's method was a guess rather than a certain match. */
export function isGuessed(method: string): boolean {
    return GUESSED_METHODS.indexOf(method) >= 0;
}

export interface ClassifyInput {
    /** The specifier exactly as written in the source. */
    target: string;
    /** `import`, `include`, `call`… */
    type: string;
    /** The project declares an alias with this prefix (`@/`, `~/`, a `paths` key). */
    aliasPrefix: boolean;
    /** File ids that exist in the project but failed to parse. */
    unparsedIds: ReadonlySet<string>;
    /** Top-level path segments that exist in the project (`src`, `webview`…). */
    topLevelDirs: ReadonlySet<string>;
    /** Directory of the importing file, workspace-relative (`webview/js`). */
    sourceDir: string;
}

/** `../..//x` → climbs; used to recognise a path that leaves the root. */
function climbsOut(sourceDir: string, target: string): boolean {
    let depth = sourceDir ? sourceDir.split('/').length : 0;
    for (const segment of target.split('/')) {
        if (segment === '' || segment === '.') continue;
        if (segment === '..') {
            depth--;
            if (depth < 0) return true;
        } else {
            depth++;
        }
    }
    return false;
}

function baseName(path: string): string {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
}

/** `broken.ts` → `broken`: an import often omits the extension. */
function stemOf(path: string): string {
    return baseName(path).replace(/\.[^.]+$/, '');
}

/**
 * Why did this relation fail? The order matters: a bare specifier is an
 * external dependency (the most useful thing to say), an unknown alias means
 * the project's configuration is missing, and only then do we fall back to
 * "the file is not there".
 */
export function classifyUnresolved(input: ClassifyInput): ResolveCode {
    const target = String(input.target || '').trim();
    const isPathLike = input.type === 'include' || input.type === 'system-include';

    if (input.aliasPrefix) return 'no-tsconfig';

    const relative = target.startsWith('.') || target.startsWith('/');
    if (relative || isPathLike) {
        if (climbsOut(input.sourceDir, target)) return 'outside-root';
        const name = baseName(target);
        const stem = stemOf(target);
        for (const id of input.unparsedIds) {
            if (baseName(id) === name || stemOf(id) === stem) return 'unparsed-file';
        }
        return 'missing-file';
    }

    // `lodash`, `@scope/pkg`, `react-dom/client`: a package, unless its first
    // segment is a directory we actually have (then it is a root-relative path).
    const head = target.split('/')[0];
    if (input.topLevelDirs.has(head)) return 'missing-file';
    return 'bare-specifier';
}

// ── Aggregation ────────────────────────────────────────────────

/** What the scanner could not even hand to the analyser. */
export interface ScanCounters {
    /** Files read and analysed. */
    scanned: number;
    /** Directory names skipped (unique, sorted) — `node_modules`, `out`… */
    skippedDirs: string[];
    /** How many directory entries those names cover. */
    skippedDirHits: number;
    /** Files whose extension Aura does not analyse. */
    unsupported: number;
    /** Files that could not be read. */
    unreadable: number;
}

export function emptyScanCounters(): ScanCounters {
    return { scanned: 0, skippedDirs: [], skippedDirHits: 0, unsupported: 0, unreadable: 0 };
}

export interface ResolutionReport {
    /** Files analysed, and the ones the scanner left out. */
    scan: ScanCounters;
    /** Files analysed, and the ones that failed to parse. */
    parsed: { total: number; failed: number };
    /** Per relation type: attempts and resolved. */
    types: { type: string; attempts: number; resolved: number }[];
    /** How each resolution was found. */
    methods: { method: string; count: number; guessed: boolean }[];
    /** Totals, for the compact stamp. */
    totals: { attempts: number; resolved: number; guessed: number; unresolved: number };
    /** Unresolved relations by reason, with samples. */
    codes: { code: ResolveCode; label: string; count: number; samples: { from: string; ref: string }[] }[];
    /** What the report cannot say, by construction. */
    blindSpots: string[];
}

export interface SumInput {
    entries: Iterable<FileResolution>;
    scan: ScanCounters;
    parsedTotal: number;
    parsedFailed: number;
    /** Merge the external `@aura` config? Not needed yet — reserved. */
}

const BLIND_SPOTS = [
    'external dependencies (a bare specifier is named, its package tree is not read)',
    'dynamic calls (string-built requires, reflection, dependency injection)',
    'macros and generated code that never exist as files',
    'files skipped by the scanner (see the read section)',
];

/** Fold the per-file contributions into the report the UI and MCP serve. */
export function sumResolution(input: SumInput): ResolutionReport {
    const attempts: Record<string, number> = {};
    const resolved: Record<string, number> = {};
    const methods: Record<string, number> = {};
    const codes: Record<string, number> = {};
    const samples = new Map<ResolveCode, { from: string; ref: string }[]>();

    for (const entry of input.entries) {
        for (const [type, count] of Object.entries(entry.attempts)) bump(attempts, type, count);
        for (const [type, count] of Object.entries(entry.resolved)) bump(resolved, type, count);
        for (const [method, count] of Object.entries(entry.methods)) bump(methods, method, count);
        for (const [code, count] of Object.entries(entry.codes)) bump(codes, code, count);
        for (const sample of entry.samples) {
            const list = samples.get(sample.code) || [];
            if (list.length < SAMPLES_PER_CODE) list.push({ from: sample.from, ref: sample.ref });
            samples.set(sample.code, list);
        }
    }

    const typeNames = RELATION_TYPES.filter(type => attempts[type])
        .concat(Object.keys(attempts).filter(type => RELATION_TYPES.indexOf(type) < 0).sort());

    const totalAttempts = Object.values(attempts).reduce((sum, count) => sum + count, 0);
    const totalResolved = Object.values(resolved).reduce((sum, count) => sum + count, 0);
    const guessed = Object.entries(methods)
        .filter(([method]) => isGuessed(method))
        .reduce((sum, [, count]) => sum + count, 0);
    const totalUnresolved = RESOLVE_CODES.reduce((sum, code) => sum + (codes[code] || 0), 0);

    return {
        scan: input.scan,
        parsed: { total: input.parsedTotal, failed: input.parsedFailed },
        types: typeNames.map(type => ({ type, attempts: attempts[type] || 0, resolved: resolved[type] || 0 })),
        methods: Object.entries(methods)
            .sort((a, b) => b[1] - a[1])
            .map(([method, count]) => ({ method, count, guessed: isGuessed(method) })),
        totals: { attempts: totalAttempts, resolved: totalResolved, guessed, unresolved: totalUnresolved },
        codes: RESOLVE_CODES.filter(code => (codes[code] || 0) > 0).map(code => ({
            code,
            label: RESOLVE_CODE_LABELS[code],
            count: codes[code] || 0,
            samples: samples.get(code) || [],
        })),
        blindSpots: BLIND_SPOTS.slice(),
    };
}

/** One line for the badge and the MCP stamp. */
export function resolutionSummaryLine(report: ResolutionReport): string {
    const bits = [`${report.totals.resolved}/${report.totals.attempts} relations resolved`];
    if (report.totals.guessed) bits.push(`${report.totals.guessed} guessed`);
    if (report.totals.unresolved) bits.push(`${report.totals.unresolved} unresolved`);
    if (report.parsed.failed) bits.push(`${report.parsed.failed} unparsed file${report.parsed.failed === 1 ? '' : 's'}`);
    return bits.join(' · ');
}

function percent(part: number, total: number): string {
    if (!total) return '—';
    return Math.round((part / total) * 100) + ' %';
}

/**
 * The deliverable that gets pasted into a pull request. Deliberately plain
 * Markdown: no tables wider than a terminal, no nested lists.
 */
export function resolutionMarkdown(report: ResolutionReport): string {
    const lines: string[] = [];
    lines.push('# Aura — resolution report', '');
    lines.push('What the analysis could see, what it guessed, and what it could not see at all.', '');

    lines.push('## Read', '');
    lines.push(`- **${report.scan.scanned}** files analysed`);
    if (report.scan.skippedDirs.length) {
        lines.push(`- **${report.scan.skippedDirHits}** entries skipped in ${report.scan.skippedDirs.length} directories: `
            + report.scan.skippedDirs.map(dir => '`' + dir + '`').join(', '));
    }
    if (report.scan.unsupported) lines.push(`- **${report.scan.unsupported}** files with an extension Aura does not analyse`);
    if (report.scan.unreadable) lines.push(`- **${report.scan.unreadable}** files could not be read`);
    lines.push('');

    lines.push('## Parsed', '');
    const ok = report.parsed.total - report.parsed.failed;
    lines.push(`- **${ok}/${report.parsed.total}** files parsed cleanly (${percent(ok, report.parsed.total)})`);
    if (report.parsed.failed) {
        lines.push(`- **${report.parsed.failed}** failed — their imports and dependents may be incomplete`);
    }
    lines.push('');

    lines.push('## Resolved', '');
    if (report.types.length === 0) {
        lines.push('- no relation was attempted');
    } else {
        lines.push('| Type | Resolved | Attempted | Share |', '|---|---:|---:|---:|');
        for (const row of report.types) {
            lines.push(`| \`${row.type}\` | ${row.resolved} | ${row.attempts} | ${percent(row.resolved, row.attempts)} |`);
        }
    }
    lines.push('');

    lines.push('## Guessed', '');
    const guessed = report.methods.filter(method => method.guessed);
    if (guessed.length === 0) {
        lines.push('- every resolved relation was matched exactly');
    } else {
        lines.push(`- **${report.totals.guessed}** relations were *guessed*, not matched:`);
        for (const method of guessed) lines.push(`  - \`${method.method}\` — ${method.count}`);
    }
    lines.push('');

    lines.push('## Not resolved, and why', '');
    if (report.codes.length === 0) {
        lines.push('- nothing was left unresolved');
    } else {
        for (const code of report.codes) {
            lines.push(`- **${code.code}** — ${code.count} · ${code.label}`);
            for (const sample of code.samples) {
                lines.push(`  - \`${sample.ref}\` in \`${sample.from}\``);
            }
        }
    }
    lines.push('');

    lines.push('## What this report cannot say', '');
    for (const spot of report.blindSpots) lines.push(`- ${spot}`);
    lines.push('');

    return lines.join('\n');
}
