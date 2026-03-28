/**
 * complexity.ts — Cyclomatic complexity calculator.
 */

import type { FileInfo, ComplexityResult } from './types';

const C_JS_DECISION_RE = /\b(if|else\s+if|for|while|do|switch|case|catch)\b/g;
const LOGICAL_OPERATORS_RE = /(\|\||&&)/g;
const TERNARY_RE = /[^?]\?[^?:]/g;
const CSS_SELECTOR_RE = /[^{}]+(?=\s*\{)/g;
const CSS_MEDIA_RE = /@media\b/g;

export function computeComplexity(fileInfo: FileInfo): ComplexityResult {
    const { content, language } = fileInfo;

    switch (language) {
        case 'c':
        case 'javascript':
        case 'typescript':
            return computeCJSComplexity(content);
        case 'css':
            return computeCSSComplexity(content);
        case 'html':
            return computeHTMLComplexity(content);
        default:
            return { complexity: 1, details: {} };
    }
}

function computeCJSComplexity(content: string): ComplexityResult {
    const stripped = content
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''");

    let complexity = 1;
    const details: Record<string, unknown> = {};

    const keywords: Record<string, number> = {};
    const decisionRe = new RegExp(C_JS_DECISION_RE.source, 'g');
    let match;
    while ((match = decisionRe.exec(stripped)) !== null) {
        const kw = match[1].replace(/\s+/g, ' ');
        keywords[kw] = (keywords[kw] || 0) + 1;
        complexity++;
    }
    details.keywords = keywords;

    const logicalRe = new RegExp(LOGICAL_OPERATORS_RE.source, 'g');
    let logicalCount = 0;
    while ((match = logicalRe.exec(stripped)) !== null) {
        logicalCount++;
        complexity++;
    }
    details.logicalOperators = logicalCount;

    const ternaryRe = new RegExp(TERNARY_RE.source, 'g');
    let ternaryCount = 0;
    while ((match = ternaryRe.exec(stripped)) !== null) {
        ternaryCount++;
        complexity++;
    }
    details.ternaryOperators = ternaryCount;

    return { complexity, details };
}

function computeCSSComplexity(content: string): ComplexityResult {
    const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '');

    let selectorCount = 0;
    const selectorRe = new RegExp(CSS_SELECTOR_RE.source, 'g');
    let match;
    while ((match = selectorRe.exec(stripped)) !== null) {
        const selectors = match[0].split(',').filter(s => s.trim().length > 0);
        selectorCount += selectors.length;
    }

    let mediaCount = 0;
    const mediaRe = new RegExp(CSS_MEDIA_RE.source, 'g');
    while ((match = mediaRe.exec(stripped)) !== null) {
        mediaCount++;
    }

    const complexity = Math.max(1, Math.round(1 + selectorCount / 10 + mediaCount));
    return {
        complexity,
        details: { selectors: selectorCount, mediaQueries: mediaCount }
    };
}

function computeHTMLComplexity(content: string): ComplexityResult {
    const eventHandlerRe = /\bon\w+\s*=/gi;
    let eventCount = 0;
    let match;
    while ((match = eventHandlerRe.exec(content)) !== null) {
        eventCount++;
    }

    const scriptRe = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
    let scriptCount = 0;
    let inlineJSComplexity = 0;
    while ((match = scriptRe.exec(content)) !== null) {
        scriptCount++;
        const jsResult = computeCJSComplexity(match[0]);
        inlineJSComplexity += jsResult.complexity - 1;
    }

    const complexity = Math.max(1, 1 + eventCount + inlineJSComplexity);
    return {
        complexity,
        details: { eventHandlers: eventCount, scriptBlocks: scriptCount, inlineJSComplexity }
    };
}
