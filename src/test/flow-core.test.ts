import { describe, it, expect, beforeAll } from 'vitest';
import { initTreeSitter, parseSource } from '../analyzer/tree-sitter-loader';
import {
    buildFunctionFlow,
    findFunctionAtLine,
    flowLanguages,
    flowProfile,
    functionFlowAtLine,
    type FlowNode,
} from '../flow/flow-core';

beforeAll(async () => {
    await initTreeSitter();
});

async function flowFor(language: string, content: string, line: number) {
    const tree = await parseSource(language, content);
    return functionFlowAtLine(tree, language, line);
}

const kinds = (nodes: FlowNode[]) => nodes.map((n) => n.kind);

describe('flow: JS/TS — the grading example (if / else-if chain / for)', () => {
    const CODE = `function grade(score) {
  if (score < 0) return 'invalid';
  let grade;
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else grade = 'C';
  for (let i = 0; i < score / 10; i++) console.log(i);
  return grade;
}`;

    it('builds the control-flow tree with the right shapes', async () => {
        const flow = (await flowFor('javascript', CODE, 1))!;
        expect(flow.name).toBe('grade');
        expect(flow.line).toBe(1);
        expect(flow.endLine).toBe(9);
        expect(kinds(flow.nodes)).toEqual(['if', 'step', 'if', 'loop', 'jump']);

        // if (score < 0) return 'invalid'; — no else
        const first = flow.nodes[0] as any;
        expect(first.cond).toContain('score < 0');
        expect(kinds(first.then)).toEqual(['jump']);
        expect(first.then[0].jump).toBe('return');
        expect(first.else).toBeUndefined();

        // else-if chain: nested if in else
        const second = flow.nodes[2] as any;
        expect(second.cond).toContain('score >= 90');
        expect(kinds(second.else)).toEqual(['if']);
        const nested = second.else[0] as any;
        expect(nested.cond).toContain('score >= 80');
        expect(kinds(nested.else)).toEqual(['step']);

        // for loop with calls inside the body
        const loop = flow.nodes[3] as any;
        expect(loop.loopType).toBe('for');
        expect(loop.header).toContain('i < score / 10');
        expect(loop.body).toHaveLength(1);
        expect(loop.body[0].calls).toEqual(['log']);
    });

    it('counts decisions like McCabe (1 + if + elif + for)', async () => {
        const flow = (await flowFor('javascript', CODE, 1))!;
        expect(flow.decisions).toBe(5);
    });
});

describe('flow: JS — loops, dead code, continue', () => {
    const CODE = `function drain(q) {
  while (!q.empty()) {
    const item = q.pop();
    if (item) continue;
    q.process(item);
  }
  do { q.step(); } while (q.pending());
  q.done();
  return q;
  q.never();
}`;

    it('marks statements after a jump as dead and keeps loops distinct', async () => {
        const flow = (await flowFor('javascript', CODE, 1))!;
        expect(kinds(flow.nodes)).toEqual(['loop', 'loop', 'step', 'jump', 'step']);

        const whileLoop = flow.nodes[0] as any;
        expect(whileLoop.loopType).toBe('while');
        expect(kinds(whileLoop.body)).toEqual(['step', 'if', 'step']);
        const innerIf = whileLoop.body[1] as any;
        expect(innerIf.then[0].jump).toBe('continue');

        const doLoop = flow.nodes[1] as any;
        expect(doLoop.loopType).toBe('do');

        const afterReturn = flow.nodes[4] as any;
        expect(afterReturn.text).toContain('q.never()');
        expect(afterReturn.dead).toBe(true);

        expect(flow.decisions).toBe(4); // while + if + do
    });
});

describe('flow: JS — switch with fallthrough and default', () => {
    const CODE = `function label(code) {
  switch (code) {
    case 1:
      return 'one';
    case 2:
    case 3:
      console.log(code);
      break;
    default:
      return 'other';
  }
}`;

    it('extracts cases in order with their bodies', async () => {
        const flow = (await flowFor('javascript', CODE, 1))!;
        expect(kinds(flow.nodes)).toEqual(['switch']);
        const sw = flow.nodes[0] as any;
        expect(sw.expr).toContain('code');
        expect(sw.cases.map((c: any) => c.label)).toEqual(['1', '2', '3', 'default']);
        expect(sw.cases[0].body[0].jump).toBe('return');
        expect(sw.cases[1].body).toHaveLength(0); // fallthrough
        expect(kinds(sw.cases[2].body)).toEqual(['step', 'jump']);
        expect(sw.cases[3].body[0].jump).toBe('return');
        expect(flow.decisions).toBe(5); // 1 + 4 cases
    });
});

describe('flow: JS — try / catch / finally', () => {
    const CODE = `function risky() {
  try {
    doWork();
  } catch (err) {
    console.error(err);
    throw err;
  } finally {
    cleanup();
  }
  return 1;
}`;

    it('nests the trio and skips flow after the try block', async () => {
        const flow = (await flowFor('javascript', CODE, 1))!;
        expect(kinds(flow.nodes)).toEqual(['try', 'jump']);
        const t = flow.nodes[0] as any;
        expect(t.body[0].calls).toEqual(['doWork']);
        expect(t.catches).toHaveLength(1);
        expect(t.catches[0].param).toBe('err');
        expect(kinds(t.catches[0].body)).toEqual(['step', 'jump']);
        expect(t.finally[0].calls).toEqual(['cleanup']);
        expect(flow.decisions).toBe(2);
    });
});

describe('flow: JS — nested functions are opaque', () => {
    const CODE = `function outer() {
  const helper = (x) => {
    if (x) { return 1; }
    return 0;
  };
  helper(2);
  return helper(3);
}`;

    it('does not descend into nested functions (flow nor decisions)', async () => {
        const flow = (await flowFor('javascript', CODE, 1))!;
        expect(kinds(flow.nodes)).toEqual(['step', 'step', 'jump']);
        expect(flow.decisions).toBe(1);
        expect((flow.nodes[0] as any).calls ?? []).not.toContain('inner');
        expect((flow.nodes[2] as any).calls).toEqual(['helper']);
    });

    it('counts ternaries in decisions', async () => {
        const flow = (await flowFor('javascript', 'function t(a) {\n  return a ? 1 : 2;\n}', 1))!;
        expect(flow.decisions).toBe(2);
    });
});

describe('flow: findFunctionAtLine', () => {
    const CODE = `const square = (x) => {
  return x * x;
};
function named() {
  return 1;
}`;

    it('picks the innermost function containing the line, with a usable name', async () => {
        const tree = await parseSource('javascript', CODE);
        const arrow = findFunctionAtLine(tree, 'javascript', 2);
        expect(arrow).not.toBeNull();
        const flow = buildFunctionFlow(arrow!, 'javascript')!;
        expect(flow.name).toBe('square');
        expect(flow.line).toBe(1);

        const named = findFunctionAtLine(tree, 'javascript', 5);
        expect(named).not.toBeNull();
        expect(buildFunctionFlow(named!, 'javascript')!.name).toBe('named');

        expect(findFunctionAtLine(tree, 'javascript', 99)).toBeNull();
        expect(findFunctionAtLine(tree, 'rust', 1)).toBeNull();
    });
});

describe('flow: Python', () => {
    it('handles for / while / break / return', async () => {
        const CODE = `def process(items, limit):
    if not items:
        return None
    total = 0
    for item in items:
        if item > limit:
            break
        total += item
    while total > limit:
        total -= 1
    return total`;
        const flow = (await flowFor('python', CODE, 1))!;
        expect(flow.name).toBe('process');
        expect(kinds(flow.nodes)).toEqual(['if', 'step', 'loop', 'loop', 'jump']);
        const forLoop = flow.nodes[2] as any;
        expect(forLoop.loopType).toBe('for');
        expect(forLoop.header).toContain('item in items');
        expect(kinds(forLoop.body)).toEqual(['if', 'step']);
        expect(forLoop.body[0].then[0].jump).toBe('break');
        expect(flow.decisions).toBe(5);
    });

    it('flattens elif chains into nested ifs', async () => {
        const CODE = `def grade(score):
    if score >= 90:
        return 'A'
    elif score >= 80:
        return 'B'
    else:
        return 'C'`;
        const flow = (await flowFor('python', CODE, 1))!;
        const first = flow.nodes[0] as any;
        expect(first.cond).toContain('score >= 90');
        expect(kinds(first.else)).toEqual(['if']);
        const elif = first.else[0] as any;
        expect(elif.cond).toContain('score >= 80');
        expect(kinds(elif.else)).toEqual(['jump']);
        expect(flow.decisions).toBe(3);
    });

    it('handles try / except / finally', async () => {
        const CODE = `def risky():
    try:
        work()
    except ValueError as e:
        log(e)
        raise
    finally:
        clean()`;
        const flow = (await flowFor('python', CODE, 1))!;
        expect(kinds(flow.nodes)).toEqual(['try']);
        const t = flow.nodes[0] as any;
        expect(t.catches).toHaveLength(1);
        expect(kinds(t.catches[0].body)).toEqual(['step', 'jump']);
        expect(t.catches[0].body[1].jump).toBe('throw');
        expect(t.finally).toHaveLength(1);
        expect(flow.decisions).toBe(2);
    });
});

describe('flow: C', () => {
    const CODE = `int process(int *arr, int n) {
    int total = 0;
    for (int i = 0; i < n; i++) {
        if (arr[i] < 0) continue;
        total += arr[i];
    }
    while (total > 100) total -= 10;
    switch (n) {
        case 0:
            return -1;
        default:
            break;
    }
    return total;
}`;

    it('extracts loops, switch cases and jumps with the function name', async () => {
        const flow = (await flowFor('c', CODE, 1))!;
        expect(flow.name).toBe('process');
        expect(kinds(flow.nodes)).toEqual(['step', 'loop', 'loop', 'switch', 'jump']);
        const forLoop = flow.nodes[1] as any;
        expect(forLoop.loopType).toBe('for');
        expect(kinds(forLoop.body)).toEqual(['if', 'step']);
        const sw = flow.nodes[3] as any;
        expect(sw.cases.map((c: any) => c.label)).toEqual(['0', 'default']);
        expect(sw.cases[0].body[0].jump).toBe('return');
        expect(flow.decisions).toBe(6); // for + if + while + case 0 + default
    });
});

describe('flow: C++ — try/throw and range-for', () => {
    const CODE = `int run(std::vector<int> xs) {
    try {
        for (int x : xs) {
            if (x < 0) throw std::runtime_error("neg");
        }
    } catch (const std::exception &e) {
        return -1;
    }
    return 0;
}`;

    it('handles exceptions and the C++ range-for', async () => {
        const flow = (await flowFor('cpp', CODE, 1))!;
        expect(kinds(flow.nodes)).toEqual(['try', 'jump']);
        const t = flow.nodes[0] as any;
        expect(kinds(t.body)).toEqual(['loop']);
        const rangeFor = t.body[0] as any;
        expect(rangeFor.loopType).toBe('foreach');
        expect(kinds(rangeFor.body)).toEqual(['if']);
        expect(rangeFor.body[0].then[0].jump).toBe('throw');
        expect(t.catches).toHaveLength(1);
        expect(flow.decisions).toBe(4); // catch + range-for + if
    });
});

describe('flow: profiles registry', () => {
    it('exposes the MVP languages and rejects unknown ones', () => {
        expect(flowLanguages()).toEqual(expect.arrayContaining(['javascript', 'typescript', 'python', 'c', 'cpp']));
        expect(flowProfile('javascript')).toBeDefined();
        expect(flowProfile('rust')).toBeUndefined();
    });
});
