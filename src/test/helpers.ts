import type { FileInfo } from '../analyzer/types';

/**
 * Create a minimal FileInfo for testing.
 */
export function makeFileInfo(overrides: Partial<FileInfo> & { id: string; content: string }): FileInfo {
    const ext = overrides.extension || '.' + (overrides.name || overrides.id).split('.').pop();
    return {
        name: overrides.name || overrides.id.split('/').pop()!,
        path: overrides.path || overrides.id,
        fullPath: overrides.fullPath || '/project/' + overrides.id,
        language: overrides.language || 'c',
        extension: ext,
        size: overrides.size || overrides.content.length,
        linesOfCode: overrides.linesOfCode || overrides.content.split('\n').length,
        lastModified: overrides.lastModified || Date.now(),
        group: overrides.group || '',
        ...overrides,
    };
}
