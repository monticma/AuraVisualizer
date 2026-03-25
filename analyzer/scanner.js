/**
 * scanner.js — Recursive filesystem scanner
 * Walks a directory tree and collects files matching target extensions.
 */

import { readdir, stat, readFile } from 'fs/promises';
import { join, extname, relative } from 'path';

const SUPPORTED_EXTENSIONS = new Set(['.c', '.h', '.js', '.css', '.html', '.htm']);

const LANGUAGE_MAP = {
    '.c': 'c',
    '.h': 'c',
    '.js': 'javascript',
    '.css': 'css',
    '.html': 'html',
    '.htm': 'html'
};

/**
 * Directories to skip during scanning
 */
const SKIP_DIRS = new Set([
    'node_modules', '.git', '.svn', '.hg',
    'dist', 'build', 'out', '.next',
    '__pycache__', '.vscode', '.idea'
]);

/**
 * Recursively scan a directory and collect file metadata.
 * @param {string} rootDir - The root directory to scan
 * @param {Object} options - Scanner options
 * @param {Set<string>} options.extensions - File extensions to include (default: all supported)
 * @param {Set<string>} options.skipDirs - Directory names to skip
 * @returns {Promise<Array<FileInfo>>} Array of file info objects
 */
export async function scanDirectory(rootDir, options = {}) {
    const extensions = options.extensions || SUPPORTED_EXTENSIONS;
    const skipDirs = options.skipDirs || SKIP_DIRS;
    const files = [];

    async function walk(dir) {
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        } catch (err) {
            console.warn(`[scanner] Cannot read directory: ${dir} — ${err.message}`);
            return;
        }

        for (const entry of entries) {
            const fullPath = join(dir, entry.name);

            if (entry.isDirectory()) {
                if (!skipDirs.has(entry.name)) {
                    await walk(fullPath);
                }
            } else if (entry.isFile()) {
                const ext = extname(entry.name).toLowerCase();
                if (extensions.has(ext)) {
                    try {
                        const fileStat = await stat(fullPath);
                        const content = await readFile(fullPath, 'utf-8');
                        const linesOfCode = content.split('\n').filter(l => l.trim().length > 0).length;
                        const relativePath = relative(rootDir, fullPath);
                        // Extract group from first directory segment
                        const parts = relativePath.split('/');
                        const group = parts.length > 1 ? parts[0] : '/';

                        files.push({
                            id: relativePath,
                            name: entry.name,
                            path: relativePath,
                            fullPath: fullPath,
                            language: LANGUAGE_MAP[ext] || 'unknown',
                            extension: ext,
                            size: fileStat.size,
                            linesOfCode: linesOfCode,
                            group: group,
                            content: content // kept for parsing, removed before output
                        });
                    } catch (err) {
                        console.warn(`[scanner] Cannot read file: ${fullPath} — ${err.message}`);
                    }
                }
            }
        }
    }

    await walk(rootDir);
    return files;
}

export { SUPPORTED_EXTENSIONS, LANGUAGE_MAP, SKIP_DIRS };
