/**
 * dead-code.ts — Dead-code candidate classification and framework exemptions.
 *
 * The analyzer's call scan is intentionally cheap (regex over source text), so
 * framework-owned entry points and callbacks can look unused. This module keeps
 * those false positives out of the architectural dead-code list while keeping
 * every exemption visible with a reason.
 *
 * Rules are AND-combined: a rule with `language` + `name` only matches symbols
 * in that language whose name is listed. A rule with only `path` matches every
 * candidate in a matching file (used for test files).
 */

import type { DeadCodeExemption, FileInfo, FileSymbols } from '../analyzer/types';

export interface DeadCodeRule {
    /** Exact symbol names. */
    name?: string | string[];
    /** Regular expression over the symbol name. */
    namePattern?: string;
    /** Workspace-relative glob paths (`*`, `**`, `?`). */
    path?: string | string[];
    /** Aura language ids (`typescript`, `java`, `swift`, …). */
    language?: string | string[];
    /** Symbol kind (`function`, `class`, `export`, `method`, `dunder`, …). */
    kind?: string | string[];
    /** Human-readable why this rule exists; shown in the UI. */
    reason: string;
}

export interface DeadCodeRuleFile {
    rules?: unknown;
}

export interface DeadCodeCandidate {
    name: string;
    kind: string;
}

export interface DeadCodeResult {
    dead: string[];
    exempted: DeadCodeExemption[];
}

/** Conservative defaults. They are always active; user rules refine them. */
export const DEFAULT_DEAD_CODE_RULES: DeadCodeRule[] = [
    { name: 'main', reason: 'program entry point' },
    { namePattern: '^__.*__$', reason: 'Python special method' },
    {
        name: ['activate', 'deactivate'],
        path: ['**/extension.ts', '**/extension.js'],
        reason: 'VS Code extension lifecycle',
    },
    {
        namePattern: '^[A-Z][A-Za-z0-9_]*$',
        path: ['**/*.tsx', '**/*.jsx'],
        kind: ['function', 'class', 'export'],
        reason: 'React component exported for JSX',
    },
    {
        name: ['setup', 'created', 'beforeCreate', 'mounted', 'beforeMount', 'updated',
            'beforeUpdate', 'unmounted', 'beforeDestroy', 'activated', 'deactivated',
            'onMounted', 'onUpdated', 'onUnmounted'],
        language: 'vue',
        reason: 'Vue lifecycle hook',
    },
    {
        name: ['body'],
        language: 'swift',
        reason: 'SwiftUI view body',
    },
    {
        name: ['doGet', 'doPost', 'doPut', 'doDelete', 'doHead', 'doOptions', 'doTrace',
            'init', 'destroy', 'service'],
        language: 'java',
        reason: 'Java servlet lifecycle',
    },
    {
        name: ['Awake', 'Start', 'Update', 'FixedUpdate', 'LateUpdate', 'OnEnable',
            'OnDisable', 'OnDestroy', 'OnCollisionEnter', 'OnCollisionExit',
            'OnCollisionStay', 'OnTriggerEnter', 'OnTriggerExit', 'OnTriggerStay'],
        language: 'csharp',
        reason: 'Unity lifecycle callback',
    },
    {
        name: ['setup', 'loop'],
        path: ['**/*.ino'],
        reason: 'Arduino entry point',
    },
    {
        path: ['**/*.test.*', '**/*.spec.*', '**/*_test.*', '**/test_*.py',
            '**/__tests__/**', '**/tests/**', '**/test/**'],
        reason: 'test file',
    },
];

function asArray(value: string | string[] | undefined): string[] | undefined {
    if (value === undefined) return undefined;
    return Array.isArray(value) ? value : [value];
}

function normalizeSelector(value: unknown): string[] | undefined {
    if (typeof value === 'string' && value.trim()) return [value.trim()];
    if (Array.isArray(value)) {
        const list = value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
            .map(v => v.trim());
        return list.length > 0 ? list : undefined;
    }
    return undefined;
}

function globToRegExp(glob: string): RegExp {
    let out = '^';
    for (let i = 0; i < glob.length; i++) {
        const ch = glob[i];
        if (ch === '*') {
            if (glob[i + 1] === '*') {
                i++;
                if (glob[i + 1] === '/') i++;
                out += '.*';
            } else {
                out += '[^/]*';
            }
        } else if (ch === '?') {
            out += '[^/]';
        } else {
            out += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
        }
    }
    return new RegExp(out + '$');
}

function matchesAnyPath(filePath: string, patterns: string[]): boolean {
    return patterns.some(pattern => globToRegExp(pattern).test(filePath));
}

function matchesString(value: string, expected: string | string[] | undefined): boolean {
    const list = asArray(expected);
    return !list || list.length === 0 || list.indexOf(value) !== -1;
}

function matchesPath(filePath: string, expected: string | string[] | undefined): boolean {
    const list = asArray(expected);
    return !list || list.length === 0 || matchesAnyPath(filePath, list);
}

/** Validate and normalize a `.aura/dead-code.json` payload. */
export function parseDeadCodeRules(raw: unknown): DeadCodeRule[] {
    let value = raw;
    if (typeof value === 'string') {
        if (!value.trim()) return [];
        try {
            value = JSON.parse(value);
        } catch (err) {
            throw new Error('Dead-code rules are not valid JSON: ' + (err instanceof Error ? err.message : String(err)));
        }
    }
    if (value === null || value === undefined) return [];
    if (typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Dead-code rules must be an object with a "rules" array.');
    }
    const candidate = value as DeadCodeRuleFile;
    if (candidate.rules === undefined) return [];
    if (!Array.isArray(candidate.rules)) {
        throw new Error('Dead-code "rules" must be an array.');
    }
    if (candidate.rules.length > 200) {
        throw new Error('Dead-code rules are limited to 200 entries.');
    }
    return candidate.rules.map((entry, index) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            throw new Error(`Dead-code rule #${index + 1} must be an object.`);
        }
        const rule = entry as Record<string, unknown>;
        const reason = typeof rule.reason === 'string' ? rule.reason.trim() : '';
        if (!reason) throw new Error(`Dead-code rule #${index + 1} needs a non-empty "reason".`);
        const name = normalizeSelector(rule.name);
        const namePattern = typeof rule.namePattern === 'string' ? rule.namePattern : undefined;
        const path = normalizeSelector(rule.path);
        const language = normalizeSelector(rule.language);
        const kind = normalizeSelector(rule.kind);
        if (!name && !namePattern && !path) {
            throw new Error(`Dead-code rule #${index + 1} needs at least one selector: name, namePattern or path.`);
        }
        if (namePattern) {
            try { new RegExp(namePattern); } catch {
                throw new Error(`Dead-code rule #${index + 1} has an invalid namePattern.`);
            }
        }
        const normalized: DeadCodeRule = { reason };
        if (name) normalized.name = name;
        if (namePattern) normalized.namePattern = namePattern;
        if (path) normalized.path = path;
        if (language) normalized.language = language;
        if (kind) normalized.kind = kind;
        return normalized;
    });
}

/** First matching rule wins; defaults are evaluated before user rules. */
export function findExemption(
    file: FileInfo,
    candidate: DeadCodeCandidate,
    rules: DeadCodeRule[],
): string | undefined {
    const filePath = file.id || file.path;
    for (const rule of rules) {
        if (rule.name !== undefined && !matchesString(candidate.name, rule.name)) continue;
        if (rule.namePattern !== undefined && !new RegExp(rule.namePattern).test(candidate.name)) continue;
        if (rule.path !== undefined && !matchesPath(filePath, rule.path)) continue;
        if (rule.language !== undefined && !matchesString(file.language, rule.language)) continue;
        if (rule.kind !== undefined && !matchesString(candidate.kind, rule.kind)) continue;
        return rule.reason;
    }
    return undefined;
}

/** Collect identifiers followed by `(` from every source file (the cheap call scan). */
export function collectCalledNames(files: FileInfo[]): Set<string> {
    const allCalledNames = new Set<string>();
    const CALL_SCAN_RE = /(?:^|[^.\w])(\w+)\s*\(/gm;
    for (const file of files) {
        const re = new RegExp(CALL_SCAN_RE.source, 'gm');
        let match: RegExpExecArray | null;
        while ((match = re.exec(file.content)) !== null) allCalledNames.add(match[1]);
    }
    return allCalledNames;
}

/**
 * Classify function/class/export candidates. Methods are inclusion-only:
 * they can be reported as framework-exempt, but are not added to the real
 * dead list because the existing detector never marked methods dead.
 */
export function classifyDeadCode(
    file: FileInfo,
    symbols: FileSymbols | undefined,
    calledNames: Set<string>,
    rules: DeadCodeRule[],
): DeadCodeResult {
    if (!symbols) return { dead: [], exempted: [] };
    const candidates: DeadCodeCandidate[] = [];
    const add = (name: string, kind: string) => {
        if (name) candidates.push({ name, kind });
    };
    for (const fn of symbols.functions) add(fn.name, fn.type || 'function');
    for (const cls of symbols.classes) add(cls.name, cls.type || 'class');
    for (const exp of symbols.exports) add(exp.name, exp.type || 'export');
    for (const method of symbols.methods || []) add(method.name, method.type || 'method');

    const dead: string[] = [];
    const exempted: DeadCodeExemption[] = [];
    const seenDead = new Set<string>();
    const seenExempted = new Set<string>();
    for (const candidate of candidates) {
        if (calledNames.has(candidate.name)) continue;
        const reason = findExemption(file, candidate, rules);
        if (reason) {
            const key = candidate.name + '|' + candidate.kind;
            if (!seenExempted.has(key)) {
                exempted.push({ name: candidate.name, kind: candidate.kind, reason });
                seenExempted.add(key);
            }
        } else if (candidate.kind !== 'method' && !seenDead.has(candidate.name)) {
            dead.push(candidate.name);
            seenDead.add(candidate.name);
        }
    }
    return { dead, exempted };
}

/** Count exemptions across a set of symbols (used in GraphMeta). */
export function countExemptions(nodes: Array<{ exemptedExports?: DeadCodeExemption[] }>): number {
    return nodes.reduce((sum, node) => sum + (node.exemptedExports?.length || 0), 0);
}
