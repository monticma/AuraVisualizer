import { describe, it, expect, beforeAll } from 'vitest';
import { initTreeSitter, parseSource } from '../analyzer/tree-sitter-loader';
import {
    buildFunctionFlow,
    collectFunctionMetrics,
    computeFunctionMetrics,
    findFunctionAtLine,
} from '../flow/flow-core';
import { buildGraph, preParseFiles } from '../analyzer/graph-builder';
import { LANGUAGE_MAP, SUPPORTED_EXTENSIONS } from '../analyzer/scanner';
import { makeFileInfo } from './helpers';

beforeAll(async () => {
    await initTreeSitter();
});

async function metricsFor(language: string, content: string, line = 1) {
    const tree = await parseSource(language, content);
    const node = findFunctionAtLine(tree, language, line);
    expect(node).not.toBeNull();
    const metrics = computeFunctionMetrics(node!, language);
    expect(metrics).not.toBeNull();
    return metrics!;
}

describe('cognitive complexity — Sonar weighting (JS)', () => {
    it('is 0 for a linear function', async () => {
        const metrics = await metricsFor('javascript', 'function add(a, b) {\n  return a + b;\n}');
        expect(metrics.cognitive).toBe(0);
        expect(metrics.cyclomatic).toBe(1);
        expect(metrics.lines).toBe(3);
    });

    it('counts if + else, but not a trivial empty else', async () => {
        const plain = await metricsFor('javascript', `function f(x) {
  if (x > 0) { return 1; }
  else { return 0; }
}`);
        expect(plain.cognitive).toBe(2);
        expect(plain.cyclomatic).toBe(2);

        const trivial = await metricsFor('javascript', `function g(x) {
  if (x > 0) { work(); }
  else { }
}`);
        expect(trivial.cognitive).toBe(1);
    });

    it('counts else-if as +1 without an extra nesting increment', async () => {
        const metrics = await metricsFor('javascript', `function grade(score) {
  if (score >= 90) return 'A';
  else if (score >= 80) return 'B';
  else return 'C';
}`);
        expect(metrics.cognitive).toBe(3);
        expect(metrics.cyclomatic).toBe(3);
    });

    it('adds the nesting level for nested ifs and loops', async () => {
        const nestedIf = await metricsFor('javascript', `function f(a, b) {
  if (a) {
    if (b) { return 1; }
  }
  return 0;
}`);
        expect(nestedIf.cognitive).toBe(3); // if(1) + inner if(1+1)

        const loopIf = await metricsFor('javascript', `function g(items) {
  for (const item of items) {
    if (item) { handle(item); }
  }
}`);
        expect(loopIf.cognitive).toBe(3); // loop(1) + if(1+1)
    });

    it('counts logical sequences, not individual operators', async () => {
        const one = await metricsFor('javascript', `function f(a, b, c) {
  if (a && b && c) { return 1; }
  return 0;
}`);
        expect(one.cognitive).toBe(2); // if + one && sequence

        const changes = await metricsFor('javascript', `function g(a, b, c, d) {
  if (a && b || c && d) { return 1; }
  return 0;
}`);
        expect(changes.cognitive).toBe(4); // if + &&, ||, && → three sequences
        expect(changes.cyclomatic).toBe(5); // 1 + if + 3 logical operators
    });

    it('counts switch cases, ternaries and catch blocks', async () => {
        const sw = await metricsFor('javascript', `function label(code) {
  switch (code) {
    case 1: return 'one';
    case 2: return 'two';
    default: return 'other';
  }
}`);
        expect(sw.cognitive).toBe(4); // switch + 3 cases

        const ternary = await metricsFor('javascript', `function pick(a) {
  return a ? 1 : 2;
}`);
        expect(ternary.cognitive).toBe(1);

        const caught = await metricsFor('javascript', `function risky() {
  try { work(); }
  catch (err) { recover(err); }
}`);
        expect(caught.cognitive).toBe(1);
    });

    it('does not fold nested functions into the outer metric', async () => {
        const metrics = await metricsFor('javascript', `function outer() {
  const helper = (x) => {
    if (x) { return 1; }
    return 0;
  };
  return helper(2);
}`);
        expect(metrics.cognitive).toBe(0);
    });
});

describe('cognitive complexity — other flow languages', () => {
    it('handles Python elif / and-or sequences', async () => {
        const chain = await metricsFor('python', `def grade(score):
    if score >= 90:
        return 'A'
    elif score >= 80:
        return 'B'
    else:
        return 'C'`);
        expect(chain.cognitive).toBe(3);

        const boolean = await metricsFor('python', `def f(a, b, c, d):
    if a and b or c and d:
        return 1
    return 0`);
        expect(boolean.cognitive).toBe(4);
    });

    it('handles C if / else if / else and logical sequences', async () => {
        const chain = await metricsFor('c', `int grade(int score) {
  if (score >= 90) return 1;
  else if (score >= 80) return 2;
  else return 3;
}`);
        expect(chain.cognitive).toBe(3);

        const boolean = await metricsFor('c', `int f(int a, int b, int c) {
  if (a && b && c) return 1;
  return 0;
}`);
        expect(boolean.cognitive).toBe(2);
    });
});

describe('Halstead + maintainability index', () => {
    it('produces plausible values and a bounded MI', async () => {
        const metrics = await metricsFor('javascript', `function compute(items) {
  let total = 0;
  for (const item of items) {
    if (item && item.value > 10) {
      total += item.value * 2;
    }
  }
  return total;
}`);
        expect(metrics.halstead.totalOperands).toBeGreaterThan(0);
        expect(metrics.halstead.totalOperators).toBeGreaterThan(0);
        expect(metrics.halstead.volume).toBeGreaterThan(0);
        expect(metrics.halstead.difficulty).toBeGreaterThan(0);
        expect(metrics.maintainability).toBeGreaterThanOrEqual(0);
        expect(metrics.maintainability).toBeLessThanOrEqual(100);
    });

    it('scores a linear function higher than a deeply nested one', async () => {
        const simple = await metricsFor('javascript', 'function f(a) {\n  return a + 1;\n}');
        const complex = await metricsFor('javascript', `function g(a, b, c) {
  if (a) {
    for (let i = 0; i < b; i++) {
      if (c && i > 2) {
        while (a) { a--; }
      }
    }
  }
  return a;
}`);
        expect(simple.maintainability).toBeGreaterThan(complex.maintainability);
    });

    it('collects every function in one pass, including nested ones', async () => {
        const tree = await parseSource('javascript', `function outer() {
  const inner = () => { if (ready) { go(); } };
  return inner();
}
function sibling() { return 1; }`);
        const entries = collectFunctionMetrics(tree, 'javascript');
        expect(entries.map(e => e.name).sort()).toEqual(['inner', 'outer', 'sibling']);
        expect(entries.find(e => e.name === 'outer')!.metrics.cognitive).toBe(0);
        expect(entries.find(e => e.name === 'inner')!.metrics.cognitive).toBe(1);
    });
});

describe('graph integration', () => {
    it('attaches function metrics to GraphNode symbols', async () => {
        const file = makeFileInfo({
            id: 'src/grade.ts',
            language: 'typescript',
            extension: '.ts',
            content: `export function grade(score: number) {
  if (score >= 90) return 'A';
  else if (score >= 80) return 'B';
  return 'C';
}
export function plain() { return 1; }`,
        });
        const trees = await preParseFiles([file]);
        const graph = buildGraph([file], 'fixture', {}, trees);
        const fn = graph.nodes[0].symbols!.functions.find(f => f.name === 'grade')!;
        expect(fn.cognitive).toBe(2); // if + else-if (no final else)
        expect(fn.cyclomatic).toBe(3);
        expect(fn.functionLines).toBe(5);
        expect(fn.halsteadVolume).toBeGreaterThan(0);
        expect(fn.maintainability).toBeGreaterThan(0);
        expect(graph.nodes[0].cognitive).toBe(2); // file-level max
    });

    it('exposes the same metrics on the function flowchart', async () => {
        const tree = await parseSource('javascript', 'function f(a) { if (a) { return 1; } return 0; }');
        const flow = buildFunctionFlow(findFunctionAtLine(tree, 'javascript', 1)!, 'javascript')!;
        expect(flow.decisions).toBe(2);
        expect(flow.metrics.cognitive).toBe(1);
        expect(flow.metrics.cyclomatic).toBe(2);
    });

    it('scans TSX files with the dedicated grammar and attaches metrics', async () => {
        expect(SUPPORTED_EXTENSIONS.has('.tsx')).toBe(true);
        expect(SUPPORTED_EXTENSIONS.has('.jsx')).toBe(true);
        expect(LANGUAGE_MAP['.tsx']).toBe('tsx');
        expect(LANGUAGE_MAP['.jsx']).toBe('javascript');
        const file = makeFileInfo({
            id: 'src/App.tsx',
            name: 'App.tsx',
            language: 'tsx',
            extension: '.tsx',
            content: `export function App({ ready }: { ready: boolean }) {
  if (!ready) return <div>Loading</div>;
  return <main>{ready ? 'ok' : 'no'}</main>;
}`,
        });
        const trees = await preParseFiles([file]);
        const graph = buildGraph([file], 'fixture', {}, trees);
        const fn = graph.nodes[0].symbols!.functions.find(f => f.name === 'App')!;
        expect(fn.cognitive).toBe(2); // if + JSX ternary
        expect(fn.cyclomatic).toBe(3);
        expect(graph.nodes[0].cognitive).toBe(2);
    });
});

describe('extended language coverage (cognitive profiles)', () => {
    const chains: Record<string, string> = {
        java: `class A {
  int f(int x) {
    if (x > 0) { return 1; }
    else if (x == 0) { return 2; }
    else { return 3; }
  }
}`,
        go: `package main
func f(x int) int {
  if x > 0 { return 1 } else if x == 0 { return 2 } else { return 3 }
}`,
        rust: `fn f(x: i32) -> i32 {
  if x > 0 { return 1 } else if x == 0 { return 2 } else { return 3 }
}`,
        kotlin: `fun f(x: Int): Int {
  if (x > 0) { return 1 } else if (x == 0) { return 2 } else { return 3 }
}`,
        swift: `func f(_ x: Int) -> Int {
  if x > 0 { return 1 } else if x == 0 { return 2 } else { return 3 }
}`,
        csharp: `class A {
  int F(int x) {
    if (x > 0) { return 1; }
    else if (x == 0) { return 2; }
    else { return 3; }
  }
}`,
        php: `<?php
function f($x) {
  if ($x > 0) { return 1; } elseif ($x == 0) { return 2; } else { return 3; }
}`,
        lua: `function f(x)
  if x > 0 then
    return 1
  elseif x == 0 then
    return 2
  else
    return 3
  end
end`,
        bash: `f() {
  if [ "$1" -gt 0 ]; then
    return 1
  elif [ "$1" -eq 0 ]; then
    return 2
  else
    return 3
  fi
}`,
    };

    it('counts if / else-if / else chains in every supported language', async () => {
        for (const [language, code] of Object.entries(chains)) {
            const tree = await parseSource(language, code);
            const entries = collectFunctionMetrics(tree, language);
            expect(entries.length, language).toBeGreaterThan(0);
            expect(entries[0].metrics.cognitive, language).toBe(3);
            expect(entries[0].metrics.cyclomatic, language).toBe(3);
        }
    });

    it('adds nesting for loops and ifs in JVM/.NET/Go/Rust-like grammars', async () => {
        const samples: Record<string, string> = {
            java: `class A { int f(int x) { for (int i=0;i<x;i++) { if (i > 1) { return i; } } return 0; } }`,
            csharp: `class A { int F(int x) { for (int i=0;i<x;i++) { if (i > 1) { return i; } } return 0; } }`,
            go: `package main
func f(x int) int { for i := 0; i < x; i++ { if i > 1 { return i } }; return 0 }`,
            rust: `fn f(x: i32) -> i32 { for i in 0..x { if i > 1 { return i; } } 0 }`,
        };
        for (const [language, code] of Object.entries(samples)) {
            const tree = await parseSource(language, code);
            const entries = collectFunctionMetrics(tree, language);
            expect(entries[0].metrics.cognitive, language).toBe(3); // loop + nested if (1+1)
        }
    });

    it('counts boolean sequences once per run in the extended profiles', async () => {
        const samples: Record<string, string> = {
            java: `class A { boolean f(boolean a, boolean b, boolean c) { if (a && b && c) { return true; } return false; } }`,
            kotlin: `fun f(a: Boolean, b: Boolean, c: Boolean): Boolean { if (a && b && c) return true; return false }`,
            swift: `func f(_ a: Bool, _ b: Bool, _ c: Bool) -> Bool { if a && b && c { return true }; return false }`,
            go: `package main
func f(a, b, c bool) bool { if a && b && c { return true }; return false }`,
        };
        for (const [language, code] of Object.entries(samples)) {
            const tree = await parseSource(language, code);
            const entries = collectFunctionMetrics(tree, language);
            expect(entries[0].metrics.cognitive, language).toBe(2); // if + one && sequence
        }
    });
});
