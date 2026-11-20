/**
 * The only part of the imported-metrics feature that touches the disk.
 *
 * Kept apart from `metrics-core` (pure) so the whole matching/provenance logic
 * can be tested without a file system, and apart from the webview so the MCP
 * server can read the same document without a VS Code host.
 */
import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import {
    METRICS_FILE,
    parseMetricsDocument,
    serializeMetricsDocument,
    type ImportedMetricsDocument,
} from './metrics-core';

/** Absolute path of the document for a workspace root. */
export function metricsFilePath(root: string): string {
    return join(root, ...METRICS_FILE.split('/'));
}

/** Workspace root implied by an `.aura/graph.db` path (MCP has no workspace). */
export function rootFromDbPath(dbPath: string | undefined): string | undefined {
    if (!dbPath) return undefined;
    // …/<root>/.aura/graph.db → <root>
    return dirname(dirname(dbPath));
}

interface CacheEntry {
    signature: string;
    document: ImportedMetricsDocument | null;
}

/**
 * mtime + size, so a re-import is picked up and an untouched file costs one
 * `stat` instead of a JSON parse on every graph refresh.
 */
function signatureOf(path: string): string {
    try {
        const stat = statSync(path);
        return `${stat.mtimeMs}:${stat.size}`;
    } catch {
        return 'missing';
    }
}

const cache = new Map<string, CacheEntry>();

/**
 * Read the document for a workspace. Never throws: a missing, unreadable or
 * corrupt file means "nothing imported", which every surface renders as
 * "no value" rather than as a zero.
 */
export function readMetrics(root: string | undefined): ImportedMetricsDocument | null {
    if (!root) return null;
    const path = metricsFilePath(root);
    const signature = signatureOf(path);
    const cached = cache.get(path);
    if (cached && cached.signature === signature) return cached.document;

    let document: ImportedMetricsDocument | null = null;
    if (signature !== 'missing') {
        try {
            document = parseMetricsDocument(readFileSync(path, 'utf-8'));
        } catch {
            document = null;
        }
    }
    cache.set(path, { signature, document });
    return document;
}

/** Write the document, creating `.aura/` when needed. Returns the path written. */
export function writeMetrics(root: string, document: ImportedMetricsDocument): string {
    const path = metricsFilePath(root);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, serializeMetricsDocument(document), 'utf-8');
    // The next read must see the new file even on a coarse mtime filesystem.
    cache.delete(path);
    return path;
}

export function metricsFileExists(root: string | undefined): boolean {
    if (!root) return false;
    return existsSync(metricsFilePath(root));
}

/** Drop the cache entry (tests, and after a delete). */
export function forgetMetrics(root: string | undefined): void {
    if (!root) return;
    cache.delete(metricsFilePath(root));
}
