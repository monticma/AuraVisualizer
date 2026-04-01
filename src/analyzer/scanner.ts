/**
 * scanner.ts — Recursive filesystem scanner.
 * Walks a directory tree and collects files matching target extensions.
 */

import { readdir, stat, readFile } from 'fs/promises';
import { join, extname, relative } from 'path';
import type { FileInfo, ScanOptions } from './types';

export const SUPPORTED_EXTENSIONS = new Set(['.c', '.h', '.js', '.ts', '.py', '.css', '.html', '.htm', '.java', '.go', '.rs']);

export const LANGUAGE_MAP: Record<string, string> = {
    '.c': 'c',
    '.h': 'c',
    '.js': 'javascript',
    '.ts': 'typescript',
    '.py': 'python',
    '.css': 'css',
    '.html': 'html',
    '.htm': 'html',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust'
};

export const SKIP_DIRS = new Set([
    'node_modules', '.git', '.svn', '.hg',
    'dist', 'build', 'out', '.next',
    '__pycache__', '.vscode', '.idea', 'Backup',
    'Tests'
]);

/**
 * Recursively scan a directory and collect file metadata.
 */
export async function scanDirectory(rootDir: string, options: ScanOptions = {}): Promise<FileInfo[]> {
    const extensions = options.extensions || SUPPORTED_EXTENSIONS;
    // Merge user-provided skip dirs with built-in defaults
    const skipDirs = new Set([...SKIP_DIRS, ...(options.skipDirs || [])]);    
    // Lowercase set for case-insensitive comparison
    const skipDirsLower = new Set([...skipDirs].map(d => d.toLowerCase()));
    const files: FileInfo[] = [];

    async function walk(dir: string): Promise<void> {
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = join(dir, entry.name);

            if (entry.isDirectory()) {
                if (!skipDirsLower.has(entry.name.toLowerCase())) {
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
                        const parts = relativePath.split('/');
                        const group = parts.length > 1 ? parts[0] : '/';

                        files.push({
                            id: relativePath,
                            name: entry.name,
                            path: relativePath,
                            fullPath,
                            language: LANGUAGE_MAP[ext] || 'unknown',
                            extension: ext,
                            size: fileStat.size,
                            linesOfCode,
                            lastModified: Math.floor(fileStat.mtimeMs),
                            group,
                            content
                        });
                    } catch {
                        // Skip unreadable files
                    }
                }
            }
        }
    }

    await walk(rootDir);
    return files;
}

/**
 * Scan a single file and return its FileInfo, or null if unsupported/unreadable.
 */
export async function scanSingleFile(fullPath: string, rootDir: string): Promise<FileInfo | null> {
    const ext = extname(fullPath).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(ext)) return null;

    try {
        const fileStat = await stat(fullPath);
        const content = await readFile(fullPath, 'utf-8');
        const linesOfCode = content.split('\n').filter(l => l.trim().length > 0).length;
        const relativePath = relative(rootDir, fullPath);
        const parts = relativePath.split('/');
        const group = parts.length > 1 ? parts[0] : '/';
        const name = parts[parts.length - 1];

        return {
            id: relativePath,
            name,
            path: relativePath,
            fullPath,
            language: LANGUAGE_MAP[ext] || 'unknown',
            extension: ext,
            size: fileStat.size,
            linesOfCode,
            lastModified: Math.floor(fileStat.mtimeMs),
            group,
            content
        };
    } catch {
        return null;
    }
}
