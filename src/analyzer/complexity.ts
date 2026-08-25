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
        case 'cpp':
        case 'javascript':
        case 'typescript':
            return computeCJSComplexity(content);
        case 'css':
            return computeCSSComplexity(content);
        case 'html':
            return computeHTMLComplexity(content);
        default: {
            const cfg = GENERIC_LANGUAGE_CONFIGS[language];
            if (cfg) {
                return computeDecisionComplexity(content, cfg.keywords, cfg.operators, cfg.ternary, cfg.strip);
            }
            return { complexity: 1, details: {} };
        }
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

// ============================================================
// Generic decision-point counter for the remaining languages
// (Python, Java, Go, Rust, Kotlin, Ruby, Swift).
// Same approach as computeCJSComplexity: strip comments and string
// literals, then count branching keywords, logical operators and
// (where present) ternary operators.
// ============================================================

interface LanguageComplexityConfig {
    /** Branching keywords — each adds 1 to complexity. */
    keywords: string[];
    /** Logical / short-circuit operators — each adds 1. */
    operators: string[];
    /** Optional ternary-operator pattern. */
    ternary: RegExp | null;
    /** Strips comments and string literals for this language. */
    strip: (content: string) => string;
}

/** Strip `//`, `/* *\/` comments and quoted strings (C-family syntax). */
function stripCLikeComments(content: string): string {
    return content
        .replace(/\/\/.*$/gm, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''")
        .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

/** Strip `#` comments and quoted strings (Python / Ruby syntax). */
function stripHashComments(content: string): string {
    return content
        .replace(/"""[\s\S]*?"""/g, '""')
        .replace(/'''[\s\S]*?'''/g, "''")
        .replace(/"(?:[^"\\]|\\.)*"/g, '""')
        .replace(/'(?:[^'\\]|\\.)*'/g, "''")
        .replace(/#.*$/gm, '');
}

/** Escape a literal string for use inside a RegExp. */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function computeDecisionComplexity(
    content: string,
    keywords: string[],
    operators: string[],
    ternary: RegExp | null,
    strip: (s: string) => string,
): ComplexityResult {
    const stripped = strip(content);

    let complexity = 1;
    const details: Record<string, unknown> = {};

    // Branching keywords (word-boundary matched).
    const keywordCounts: Record<string, number> = {};
    for (const kw of keywords) {
        const re = new RegExp(`\\b${escapeRegex(kw)}\\b`, 'g');
        let count = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(stripped)) !== null) {
            count++;
        }
        if (count > 0) {
            keywordCounts[kw] = count;
            complexity += count;
        }
    }
    details.keywords = keywordCounts;

    // Logical operators (symbols as-is; word operators use boundaries).
    let logicalCount = 0;
    for (const op of operators) {
        const isWord = /^[A-Za-z]+$/.test(op);
        const re = new RegExp(isWord ? `\\b${escapeRegex(op)}\\b` : escapeRegex(op), 'g');
        let m: RegExpExecArray | null;
        while ((m = re.exec(stripped)) !== null) {
            logicalCount++;
            complexity++;
        }
    }
    details.logicalOperators = logicalCount;

    // Ternary operators.
    let ternaryCount = 0;
    if (ternary) {
        const re = new RegExp(ternary.source, 'g');
        let m: RegExpExecArray | null;
        while ((m = re.exec(stripped)) !== null) {
            ternaryCount++;
            complexity++;
        }
    }
    details.ternaryOperators = ternaryCount;

    return { complexity, details };
}

const GENERIC_LANGUAGE_CONFIGS: Record<string, LanguageComplexityConfig> = {
    python: {
        keywords: ['if', 'elif', 'for', 'while', 'except', 'finally', 'with', 'assert'],
        operators: ['and', 'or'],
        ternary: null, // `x if c else y` — the `if` is already counted as a keyword
        strip: stripHashComments,
    },
    java: {
        keywords: ['if', 'for', 'while', 'do', 'switch', 'case', 'catch'],
        operators: ['&&', '||'],
        ternary: TERNARY_RE,
        strip: stripCLikeComments,
    },
    go: {
        keywords: ['if', 'for', 'switch', 'case', 'select'],
        operators: ['&&', '||'],
        ternary: null, // Go has no ternary operator
        strip: stripCLikeComments,
    },
    rust: {
        keywords: ['if', 'for', 'while', 'loop', 'match'],
        operators: ['&&', '||'],
        ternary: null, // Rust has no ternary operator
        strip: stripCLikeComments,
    },
    kotlin: {
        keywords: ['if', 'for', 'while', 'do', 'when', 'catch'],
        operators: ['&&', '||', '?:'], // Elvis operator counts as a branch
        ternary: null, // Kotlin has no ternary; `if` is an expression (counted as keyword)
        strip: stripCLikeComments,
    },
    ruby: {
        keywords: ['if', 'elsif', 'unless', 'while', 'until', 'for', 'case', 'when', 'rescue'],
        operators: ['&&', '||', 'and', 'or'],
        ternary: TERNARY_RE,
        strip: stripHashComments,
    },
    swift: {
        keywords: ['if', 'guard', 'for', 'while', 'repeat', 'switch', 'case', 'catch'],
        operators: ['&&', '||', '??'], // nil-coalescing counts as a branch
        ternary: TERNARY_RE,
        strip: stripCLikeComments,
    },
};
