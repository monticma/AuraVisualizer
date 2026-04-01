/**
 * graph-config.js — Visual configuration for the Aura 3D graph.
 */

// Language → node color mapping
var LANGUAGE_COLORS = {
    'c':          '#4fc3f7',
    'c-source':   '#4fc3f7',
    'c-header':   '#81d4fa',
    'javascript': '#ffd54f',
    'typescript': '#64b5f6',
    'python':     '#81c784',
    'css':        '#ce93d8',
    'html':       '#ff8a65',
    'java':       '#e57373',
    'go':         '#4dd0e1',
    'rust':       '#ffb74d'
};

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
    'function-call':  '#81c784aa',
    'extends':        '#f06292cc',
    'implements':     '#ba68c8aa'
};

var LANGUAGE_ICONS = {
    'c':          '🔷',
    'c-source':   '🔷',
    'c-header':   '📘',
    'javascript': '🟡',
    'typescript': '🔵',
    'python':     '🟢',
    'css':        '🟣',
    'html':       '🟠',
    'java':       '☕',
    'go':         '🐹',
    'rust':       '🦀'
};

// Blast radius depth → color (0=source, 1=high, 2=medium, 3+=low)
var BLAST_COLORS = ['#ffffff', '#f44336', '#ff9800', '#ffc107', '#cddc39', '#66bb6a'];

var HEATMAP_SCALES = {
    complexity: ['#1a237e', '#1565c0', '#2e7d32', '#f9a825', '#e65100', '#b71c1c'],
    fanIn:      ['#1a237e', '#1565c0', '#2e7d32', '#f9a825', '#e65100', '#b71c1c'],
    fanOut:     ['#1a237e', '#1565c0', '#2e7d32', '#f9a825', '#e65100', '#b71c1c'],
    loc:        ['#1a237e', '#1565c0', '#2e7d32', '#f9a825', '#e65100', '#b71c1c'],
    lastModified: ['#0d47a1', '#1976d2', '#64b5f6', '#ffb74d', '#e53935', '#b71c1c']
};

var HEATMAP_LABELS = {
    off:        'By language',
    complexity: 'Complexity',
    fanIn:      'Fan-in',
    fanOut:     'Fan-out',
    loc:        'Lines of code',
    lastModified: 'Last modified',
    community:  'Communities'
};

var SYMBOL_ICONS = {
    'function':       '⚡',
    'struct':         '📦',
    'typedef-struct': '📦',
    'enum':           '🏷️',
    'function-macro': '⚙️',
    'constant-macro': '🔧'
};

var GROUP_COLORS = [
    '#ef5350', '#ab47bc', '#42a5f5', '#26a69a',
    '#66bb6a', '#ffa726', '#ec407a', '#7e57c2',
    '#29b6f6', '#26c6da', '#9ccc65', '#ffca28',
    '#8d6e63', '#78909c', '#5c6bc0', '#d4e157'
];

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

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
