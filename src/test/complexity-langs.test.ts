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

    it('csharp keywords and null-coalescing', () => {
        const f = makeFileInfo({
            id: 'A.cs', language: 'csharp', extension: '.cs',
            content: 'class A { int F(int x) { if (x == 0) { return 0; } x = x ?? -1; return x; } }\n',
        });
        expect(computeComplexity(f).complexity).toBe(3); // base + if + ??
    });

    it('php elseif, logical operators and # comments', () => {
        const f = makeFileInfo({
            id: 'a.php', language: 'php', extension: '.php',
            content: "<?php\nfunction f($x) { if ($x) { return 1; } elseif ($x > 0 && $x < 5) { return 2; } # if for while\n}\n",
        });
        expect(computeComplexity(f).complexity).toBeGreaterThanOrEqual(4); // base + if + elseif + &&
    });

    it('bash if and elif', () => {
        const f = makeFileInfo({
            id: 'a.sh', language: 'bash', extension: '.sh',
            content: '#!/bin/bash\nf() {\n  if [ -f x ]; then\n    echo ok\n  elif [ -d y ]; then\n    echo y\n  fi\n}\n',
        });
        expect(computeComplexity(f).complexity).toBeGreaterThanOrEqual(3); // base + if + elif
    });

    it('lua repeat/until and logical operators', () => {
        const f = makeFileInfo({
            id: 'a.lua', language: 'lua', extension: '.lua',
            content: 'local function f(x)\n  if x > 0 and x < 10 then\n    return 1\n  end\n  repeat\n    x = x - 1\n  until x == 0\nend\n',
        });
        expect(computeComplexity(f).complexity).toBeGreaterThanOrEqual(4); // base + if + and + repeat/until
    });

    it('vue counts inline script blocks', () => {
        const f = makeFileInfo({
            id: 'A.vue', language: 'vue', extension: '.vue',
            content: '<template><div onclick="go()">x</div></template>\n<script>\nexport default { methods: { go() { if (a) {} for (;;) {} } } };\n</script>\n',
        });
        expect(computeComplexity(f).complexity).toBeGreaterThanOrEqual(3); // event + inline if + for
    });

    it('documentation stays at 1', () => {
        const f = makeFileInfo({
            id: 'readme.md', language: 'documentation', extension: '.md',
            content: '# Title\nif while for\n',
        });
        expect(computeComplexity(f).complexity).toBe(1);
    });
});
