/**
 * complexity.js — Cyclomatic complexity calculator.
 * 
 * Computes cyclomatic complexity for C, JS, CSS, and HTML files.
 * Uses regex-based counting of branching constructs.
 * 
 * Cyclomatic Complexity = 1 + number of decision points
 * Decision points: if, else if, for, while, do, switch, case, &&, ||, ?:, catch
 */

// Branching patterns for C and JavaScript
const C_JS_DECISION_RE = /\b(if|else\s+if|for|while|do|switch|case|catch)\b/g;
const LOGICAL_OPERATORS_RE = /(\|\||&&)/g;
const TERNARY_RE = /[^?]\?[^?:]/g;

// CSS complexity: number of selectors and media queries
const CSS_SELECTOR_RE = /[^{}]+(?=\s*\{)/g;
const CSS_MEDIA_RE = /@media\b/g;

/**
 * Compute cyclomatic complexity for a file.
 * 
 * @param {Object} fileInfo - File info with content and language
 * @returns {Object} { complexity, details }
 */
export function computeComplexity(fileInfo) {
    const { content, language } = fileInfo;

    switch (language) {
        case 'c':
        case 'javascript':
            return computeCJSComplexity(content);
        case 'css':
            return computeCSSComplexity(content);
        case 'html':
            return computeHTMLComplexity(content);
        default:
            return { complexity: 1, details: {} };
    }
}

/**
 * Cyclomatic complexity for C/JS files.
 */
function computeCJSComplexity(content) {
    // Strip comments and strings
    const stripped = content
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''");

    let complexity = 1; // Base complexity
    const details = {};

    // Count decision points
    let match;

    const keywords = {};
    const decisionRe = new RegExp(C_JS_DECISION_RE.source, 'g');
    while ((match = decisionRe.exec(stripped)) !== null) {
        const kw = match[1].replace(/\s+/g, ' ');
        keywords[kw] = (keywords[kw] || 0) + 1;
        complexity++;
    }
    details.keywords = keywords;

    // Count logical operators
    const logicalRe = new RegExp(LOGICAL_OPERATORS_RE.source, 'g');
    let logicalCount = 0;
    while ((match = logicalRe.exec(stripped)) !== null) {
        logicalCount++;
        complexity++;
    }
    details.logicalOperators = logicalCount;

    // Count ternary operators
    const ternaryRe = new RegExp(TERNARY_RE.source, 'g');
    let ternaryCount = 0;
    while ((match = ternaryRe.exec(stripped)) !== null) {
        ternaryCount++;
        complexity++;
    }
    details.ternaryOperators = ternaryCount;

    return { complexity, details };
}

/**
 * Complexity for CSS files — based on selector count and nesting.
 */
function computeCSSComplexity(content) {
    const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '');

    let selectorCount = 0;
    const selectorRe = new RegExp(CSS_SELECTOR_RE.source, 'g');
    let match;
    while ((match = selectorRe.exec(stripped)) !== null) {
        // Count comma-separated selectors
        const selectors = match[0].split(',').filter(s => s.trim().length > 0);
        selectorCount += selectors.length;
    }

    let mediaCount = 0;
    const mediaRe = new RegExp(CSS_MEDIA_RE.source, 'g');
    while ((match = mediaRe.exec(stripped)) !== null) {
        mediaCount++;
    }

    // CSS complexity: 1 + selectors/10 + media queries
    const complexity = Math.max(1, Math.round(1 + selectorCount / 10 + mediaCount));

    return {
        complexity,
        details: { selectors: selectorCount, mediaQueries: mediaCount }
    };
}

/**
 * Complexity for HTML files — based on inline scripts and event handlers.
 */
function computeHTMLComplexity(content) {
    // Count inline event handlers (onclick, onload, etc.)
    const eventHandlerRe = /\bon\w+\s*=/gi;
    let eventCount = 0;
    let match;
    while ((match = eventHandlerRe.exec(content)) !== null) {
        eventCount++;
    }

    // Count embedded script blocks
    const scriptRe = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
    let scriptCount = 0;
    let inlineJSComplexity = 0;
    while ((match = scriptRe.exec(content)) !== null) {
        scriptCount++;
        // Compute sub-complexity of inline JS
        const scriptContent = match[0];
        const jsResult = computeCJSComplexity(scriptContent);
        inlineJSComplexity += jsResult.complexity - 1;
    }

    const complexity = Math.max(1, 1 + eventCount + inlineJSComplexity);

    return {
        complexity,
        details: { eventHandlers: eventCount, scriptBlocks: scriptCount, inlineJSComplexity }
    };
}
