import { describe, it, expect } from 'vitest';
import { computeComplexity } from '../analyzer/complexity';
import { makeFileInfo } from './helpers';

describe('complexity for newly supported languages', () => {
    it('python branches', () => {
        const f = makeFileInfo({
            id: 'a.py', language: 'python', extension: '.py',
            content: 'def f(x):\n    if x > 0:\n        return 1\n    elif x == 0:\n        return 0\n    else:\n        return -1\n',
        });
        expect(computeComplexity(f).complexity).toBe(3); // base 1 + if + elif (`else` adds nothing)
    });

    it('python logical operators and comments ignored', () => {
        const f = makeFileInfo({
            id: 'b.py', language: 'python', extension: '.py',
            content: '# if and or while\nx = a and b or c\n',
        });
        const r = computeComplexity(f);
        expect(r.details.keywords).toEqual({});
        expect(r.details.logicalOperators).toBe(2); // and + or
    });

    it('java switch/case and ternary', () => {
        const f = makeFileInfo({
            id: 'A.java', language: 'java', extension: '.java',
            content: 'void f(int x) { if (x) {} else {} switch (x) { case 1: break; } int y = a ? 1 : 0; }\n',
        });
        expect(computeComplexity(f).complexity).toBe(5); // base 1 + if + switch + case + ternary
    });

    it('go keywords', () => {
        const f = makeFileInfo({
            id: 'a.go', language: 'go', extension: '.go',
            content: 'func f() { if true {} for {} }\n',
        });
        expect(computeComplexity(f).complexity).toBeGreaterThanOrEqual(3);
    });

    it('rust match', () => {
        const f = makeFileInfo({
            id: 'a.rs', language: 'rust', extension: '.rs',
            content: 'fn f(x: i32) { match x { 1 => {}, _ => {} } }\n',
        });
        expect(computeComplexity(f).complexity).toBeGreaterThanOrEqual(2);
    });

    it('ruby unless and ternary', () => {
        const f = makeFileInfo({
            id: 'a.rb', language: 'ruby', extension: '.rb',
            content: 'def f(x)\n  return x unless x.nil?\n  x > 0 ? 1 : 0\nend\n',
        });
        expect(computeComplexity(f).complexity).toBeGreaterThanOrEqual(3);
    });

    it('swift guard and nil-coalescing', () => {
        const f = makeFileInfo({
            id: 'a.swift', language: 'swift', extension: '.swift',
            content: 'func f(_ x: Int?) -> Int { guard let v = x else { return 0 }\n  return v ?? -1 }\n',
        });
        expect(computeComplexity(f).complexity).toBeGreaterThanOrEqual(3);
    });

    it('documentation stays at 1', () => {
        const f = makeFileInfo({
            id: 'readme.md', language: 'documentation', extension: '.md',
            content: '# Title\nif while for\n',
        });
        expect(computeComplexity(f).complexity).toBe(1);
    });
});
