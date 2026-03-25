/**
 * graph-config.js — Visual configuration for the Aura 3D graph.
 * Loaded as a plain script (UMD-compatible).
 */

// Language → node color mapping
const LANGUAGE_COLORS = {
    'c':          '#4fc3f7',
    'javascript': '#ffd54f',
    'css':        '#ce93d8',
    'html':       '#ff8a65'
};

// Relation type → link color mapping
const LINK_COLORS = {
    'include':        '#4fc3f7aa',
    'system-include': '#4fc3f755',
    'import':         '#ffd54faa',
    'require':        '#ffd54f88',
    'dynamic-import': '#ffd54f66',
    'script':         '#ff8a65aa',
    'stylesheet':     '#ce93d8aa',
    'css-import':     '#ce93d888',
    'css-url':        '#ce93d866',
    'asset':          '#ffffff44'
};

// Language → emoji icon
const LANGUAGE_ICONS = {
    'c':          '🔷',
    'javascript': '🟡',
    'css':        '🟣',
    'html':       '🟠'
};

/**
 * Format bytes to human-readable string.
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
