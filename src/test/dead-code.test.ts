import { describe, it, expect } from 'vitest';
import {
    DEFAULT_DEAD_CODE_RULES,
    classifyDeadCode,
    findExemption,
    parseDeadCodeRules,
    serializeDeadCodeRules,
    type DeadCodeRule,
} from '../analysis/dead-code';
import type { FileInfo, FileSymbols } from '../analyzer/types';

function fileInfo(id: string, language = 'typescript'): FileInfo {
    return {
        id,
        name: id.split('/').pop() || id,
        path: id,
        fullPath: '/' + id,
        language,
        extension: '.' + (id.split('.').pop() || 'ts'),
        size: 10,
        linesOfCode: 1,
        lastModified: 0,
        group: 'src',
        content: '',
    };
}

function symbols(functions: string[], exports: string[] = [], methods: string[] = []): FileSymbols {
    return {
        functions: functions.map(name => ({ name, type: 'function' })),
        classes: [],
        exports: exports.map(name => ({ name, type: 'export' })),
        externs: [],
        structs: [],
        enums: [],
        macros: [],
        interfaces: [],
        traits: [],
        typeAliases: [],
        methods: methods.map(name => ({ name, type: 'method' })),
    };
}

describe('dead-code exemption serialization', () => {
    it('round-trips custom rules through canonical serialization', () => {
        const rules: DeadCodeRule[] = [
            { reason: 'Android lifecycle', name: ['onResume', 'onPause'], language: ['kotlin', 'java'] },
            { reason: 'Generated code', path: 'src/gen/**' },
            { reason: 'Init hooks', namePattern: '^init[A-Z]', kind: 'function' },
        ];
        const text = serializeDeadCodeRules(rules);
        const parsed = parseDeadCodeRules(text);
        expect(parsed[0]).toEqual({
            reason: 'Android lifecycle',
            name: ['onResume', 'onPause'],
            language: ['kotlin', 'java'],
        });
        expect(parsed).toHaveLength(3);
        expect(parsed[1].path).toEqual(['src/gen/**']);
        expect(text).toContain('"version": 1');
        expect(text).toContain('"namePattern": "^init[A-Z]"');
        // Canonical text is stable.
        expect(serializeDeadCodeRules(parsed)).toBe(text);
    });
});

describe('dead-code exemption rules', () => {
    it('keeps normal unused exports dead', () => {
        const result = classifyDeadCode(
            fileInfo('src/util.ts'),
            symbols(['legacyHelper'], ['legacyHelper']),
            new Set(),
            DEFAULT_DEAD_CODE_RULES,
        );
        expect(result.dead).toContain('legacyHelper');
        expect(result.exempted).toHaveLength(0);
    });

    it('exempts React components in TSX without hiding them', () => {
        const result = classifyDeadCode(
            fileInfo('src/Button.tsx'),
            symbols(['Button'], ['Button']),
            new Set(),
            DEFAULT_DEAD_CODE_RULES,
        );
        expect(result.dead).toHaveLength(0);
        expect(result.exempted[0]).toMatchObject({ name: 'Button', reason: 'React component exported for JSX' });
    });

    it('exempts test files and entry points', () => {
        const testResult = classifyDeadCode(
            fileInfo('src/foo.test.ts'),
            symbols(['helper']),
            new Set(),
            DEFAULT_DEAD_CODE_RULES,
        );
        expect(testResult.exempted[0].reason).toBe('test file');

        const mainResult = classifyDeadCode(
            fileInfo('src/main.c', 'c'),
            symbols(['main']),
            new Set(),
            DEFAULT_DEAD_CODE_RULES,
        );
        expect(mainResult.exempted[0].reason).toBe('program entry point');
    });

    it('supports custom path/name rules', () => {
        const rules: DeadCodeRule[] = [
            { name: 'onResume', path: 'src/android/**', reason: 'Android lifecycle' },
        ];
        const file = fileInfo('src/android/Panel.ts');
        const result = classifyDeadCode(file, symbols(['onResume']), new Set(), rules);
        expect(result.dead).toHaveLength(0);
        expect(result.exempted[0].reason).toBe('Android lifecycle');
        expect(findExemption(file, { name: 'onResume', kind: 'function' }, rules)).toBe('Android lifecycle');
    });

    it('covers SwiftUI, servlet and Unity lifecycle methods', () => {
        const vue = classifyDeadCode(
            fileInfo('src/Widget.vue', 'vue'),
            symbols(['mounted']),
            new Set(),
            DEFAULT_DEAD_CODE_RULES,
        );
        expect(vue.exempted[0].reason).toBe('Vue lifecycle hook');

        const swift = classifyDeadCode(
            fileInfo('src/View.swift', 'swift'),
            symbols([], [], ['body']),
            new Set(),
            DEFAULT_DEAD_CODE_RULES,
        );
        expect(swift.exempted[0].reason).toBe('SwiftUI view body');
        expect(swift.dead).toHaveLength(0);

        const servlet = classifyDeadCode(
            fileInfo('src/MyServlet.java', 'java'),
            symbols([], [], ['doGet']),
            new Set(),
            DEFAULT_DEAD_CODE_RULES,
        );
        expect(servlet.exempted[0].reason).toBe('Java servlet lifecycle');

        const unity = classifyDeadCode(
            fileInfo('src/Player.cs', 'csharp'),
            symbols([], [], ['Update']),
            new Set(),
            DEFAULT_DEAD_CODE_RULES,
        );
        expect(unity.exempted[0].reason).toBe('Unity lifecycle callback');
    });

    it('validates malformed custom rule files', () => {
        expect(parseDeadCodeRules('{ "rules": [] }')).toEqual([]);
        expect(() => parseDeadCodeRules('not json')).toThrow(/valid JSON/);
        expect(() => parseDeadCodeRules('{ "rules": [{ "reason": "" }] }')).toThrow(/reason/);
        expect(() => parseDeadCodeRules('{ "rules": [{ "reason": "x" }] }')).toThrow(/selector/);
        expect(parseDeadCodeRules('{ "rules": [{ "name": ["a", "b"], "reason": "x" }] }')[0].name)
            .toEqual(['a', 'b']);
    });
});
