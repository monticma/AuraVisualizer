/**
 * graph-config.js — Visual configuration for the Aura 3D graph.
 * Loaded as a plain script (UMD-compatible).
 */

// Language → node color mapping
var LANGUAGE_COLORS = {
    'c':          '#4fc3f7',
    'c-source':   '#4fc3f7', // Bleu habituel
    'c-header':   '#81d4fa', // Bleu légèrement plus clair
    'javascript': '#ffd54f',
    'css':        '#ce93d8',
    'html':       '#ff8a65'
};

// Relation type → link color mapping
var LINK_COLORS = {
    'include':        '#4fc3f7aa',
    'system-include': '#4fc3f755',
    'import':         '#ffd54faa',
    'require':        '#ffd54f88',
    'dynamic-import': '#ffd54f66',
    'script':         '#ff8a65aa',
    'stylesheet':     '#ce93d8aa',
    'css-import':     '#ce93d888',
    'css-url':        '#ce93d866',
    'asset':          '#ffffff44',
    'function-call':  '#81c784aa'
};

// Language → emoji icon
var LANGUAGE_ICONS = {
    'c':          '🔷',
    'c-source':   '🔷',
    'c-header':   '📘',
    'javascript': '🟡',
    'css':        '🟣',
    'html':       '🟠'
};

// Heatmap color scales (low → high)
var HEATMAP_SCALES = {
    complexity: ['#1a237e', '#1565c0', '#2e7d32', '#f9a825', '#e65100', '#b71c1c'],
    fanIn:      ['#1a237e', '#1565c0', '#2e7d32', '#f9a825', '#e65100', '#b71c1c'],
    fanOut:     ['#1a237e', '#1565c0', '#2e7d32', '#f9a825', '#e65100', '#b71c1c'],
    loc:        ['#0d47a1', '#1976d2', '#42a5f5', '#90caf9', '#ffcc80', '#ff8a65']
};

// Heatmap mode names for UI
var HEATMAP_LABELS = {
    off:        'Par langage',
    complexity: 'Complexité',
    fanIn:      'Fan-in',
    fanOut:     'Fan-out',
    loc:        'Lignes de code'
};

// Symbol type icons for explosion view
var SYMBOL_ICONS = {
    'function':       '⚡',
    'struct':         '📦',
    'typedef-struct': '📦',
    'enum':           '🏷️',
    'function-macro': '⚙️',
    'constant-macro': '🔧'
};

// Directory colors for grouping (cycle through these)
var GROUP_COLORS = [
    '#ef5350', '#ab47bc', '#42a5f5', '#26a69a',
    '#66bb6a', '#ffa726', '#ec407a', '#7e57c2',
    '#29b6f6', '#26c6da', '#9ccc65', '#ffca28',
    '#8d6e63', '#78909c', '#5c6bc0', '#d4e157'
];

/**
 * Interpolate a color from a heatmap scale based on normalized value [0..1].
 */
function heatmapColor(value, scale) {
    var clamped = Math.max(0, Math.min(1, value));
    var idx = clamped * (scale.length - 1);
    var lo = Math.floor(idx);
    var hi = Math.ceil(idx);
    var t = idx - lo;

    if (lo === hi) return scale[lo];

    var cLo = hexToRgb(scale[lo]);
    var cHi = hexToRgb(scale[hi]);

    var r = Math.round(cLo.r + (cHi.r - cLo.r) * t);
    var g = Math.round(cLo.g + (cHi.g - cLo.g) * t);
    var b = Math.round(cLo.b + (cHi.b - cLo.b) * t);

    return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
}

/**
 * Format bytes to human-readable string.
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
