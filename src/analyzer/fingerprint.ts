/**
 * fingerprint.ts — Analysis cache fingerprint (V2-14).
 *
 * A cheap sha256 over:
 *   - git HEAD
 *   - the analysis-relevant settings
 *   - the parser/metrics version
 *   - every scanned file's path, size and mtime
 *
 * If the fingerprint matches the one stored in `.aura/graph.db` meta, the
 * extension can reuse the cached graph without reading/parsing file contents.
 * When it differs, diffFileSignatures() tells exactly which files need a parse.
 */

import { createHash } from 'crypto';

/** Bump when analyzer/parser output changes without a package version bump. */
export const PARSER_VERSION = '2026-10-24.1';

export interface FileSignature {
    /** Workspace-relative path, same id used by the scanner/graph. */
    path: string;
    size: number;
    mtimeMs: number;
}

export interface AnalysisFingerprint {
    hash: string;
    head: string;
    configHash: string;
    parserVersion: string;
    files: FileSignature[];
}

export interface FingerprintInput {
    head: string;
    configHash: string;
    parserVersion?: string;
    files: FileSignature[];
}

export interface FileSignatureDiff {
    added: string[];
    modified: string[];
    deleted: string[];
    unchanged: string[];
}

function sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

/** Stable stringify so object key order never changes the config hash. */
function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

/** Hash the analysis-relevant settings (excludePaths, grammar flags, …). */
export function hashAnalysisConfig(config: unknown): string {
    return sha256(stableStringify(config));
}

/** Sort signatures by path so filesystem enumeration order cannot change the hash. */
function normalizedFiles(files: FileSignature[]): FileSignature[] {
    return files
        .map((f) => ({ path: f.path, size: f.size, mtimeMs: f.mtimeMs }))
        .sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}

export function computeFingerprint(input: FingerprintInput): AnalysisFingerprint {
    const parserVersion = input.parserVersion || PARSER_VERSION;
    const files = normalizedFiles(input.files);
    const hash = sha256(JSON.stringify({
        head: input.head,
        configHash: input.configHash,
        parserVersion,
        files,
    }));
    return { hash, head: input.head, configHash: input.configHash, parserVersion, files };
}

export function fingerprintsEqual(a: AnalysisFingerprint | null | undefined, b: AnalysisFingerprint | null | undefined): boolean {
    return !!a && !!b && a.hash === b.hash;
}

/** Exact file-level delta between two signed file lists. */
export function diffFileSignatures(previous: FileSignature[], current: FileSignature[]): FileSignatureDiff {
    const before = new Map(previous.map((f) => [f.path, f]));
    const after = new Map(current.map((f) => [f.path, f]));
    const diff: FileSignatureDiff = { added: [], modified: [], deleted: [], unchanged: [] };

    for (const [path, sig] of after) {
        const old = before.get(path);
        if (!old) diff.added.push(path);
        else if (old.size !== sig.size || old.mtimeMs !== sig.mtimeMs) diff.modified.push(path);
        else diff.unchanged.push(path);
    }
    for (const path of before.keys()) {
        if (!after.has(path)) diff.deleted.push(path);
    }
    diff.added.sort();
    diff.modified.sort();
    diff.deleted.sort();
    return diff;
}

/** Above this many changed files, a full worker scan is cheaper than N rebuilds. */
export const MAX_INCREMENTAL_FILES = 50;

export type AnalysisPlan =
    | { mode: 'full'; reason: string }
    | { mode: 'skip' }
    | { mode: 'head-only' }
    | { mode: 'incremental'; diff: FileSignatureDiff };

/**
 * Decide what the extension should do on refresh. Pure and testable:
 * force/no cache/parser change → full, same fingerprint → skip, HEAD-only
 * change → head-only, small file delta → incremental.
 */
export function planAnalysis(
    previous: AnalysisFingerprint | null | undefined,
    current: AnalysisFingerprint | null | undefined,
    options: { force?: boolean; hasCachedGraph?: boolean; maxIncrementalFiles?: number } = {},
): AnalysisPlan {
    if (options.force) return { mode: 'full', reason: 'forced refresh' };
    if (!options.hasCachedGraph) return { mode: 'full', reason: 'no cached graph' };
    if (!previous || !current) return { mode: 'full', reason: 'missing fingerprint' };
    if (previous.hash === current.hash) return { mode: 'skip' };
    if (previous.parserVersion !== current.parserVersion) return { mode: 'full', reason: 'parser version changed' };
    if (previous.configHash !== current.configHash) return { mode: 'full', reason: 'analysis settings changed' };
    if (previous.files.length === 0) return { mode: 'full', reason: 'empty cached signature list' };
    const diff = diffFileSignatures(previous.files, current.files);
    const changed = diff.added.length + diff.modified.length + diff.deleted.length;
    if (changed === 0) return { mode: 'head-only' };
    if (changed <= (options.maxIncrementalFiles ?? MAX_INCREMENTAL_FILES)) {
        return { mode: 'incremental', diff };
    }
    return { mode: 'full', reason: `${changed} files changed` };
}

/** Persisted metadata keys (all strings, graph.db `meta` table). */
export function fingerprintMetaEntries(fp: AnalysisFingerprint): [string, string][] {
    return [
        ['fingerprint', fp.hash],
        ['head', fp.head],
        ['configHash', fp.configHash],
        ['parserVersion', fp.parserVersion],
        ['fileSignatures', JSON.stringify(fp.files)],
    ];
}

/** Rebuild a fingerprint from `.aura/graph.db` meta; null when incomplete/corrupt. */
export function fingerprintFromMeta(meta: Record<string, string>): AnalysisFingerprint | null {
    const hash = meta.fingerprint;
    const head = meta.head;
    const configHash = meta.configHash;
    const parserVersion = meta.parserVersion;
    if (!hash || head === undefined || !configHash || !parserVersion) return null;
    let files: FileSignature[] = [];
    try {
        const parsed = JSON.parse(meta.fileSignatures || '[]');
        if (!Array.isArray(parsed)) return null;
        files = parsed
            .filter((f) => f && typeof f.path === 'string' && typeof f.size === 'number' && typeof f.mtimeMs === 'number')
            .map((f) => ({ path: f.path, size: f.size, mtimeMs: f.mtimeMs }));
    } catch {
        return null;
    }
    return { hash, head, configHash, parserVersion, files };
}
