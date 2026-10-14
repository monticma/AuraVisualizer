/**
 * flow-core.ts — Function flowchart engine (intra-procedural control flow).
 *
 * Pure module (no `vscode`): transforms a Tree-sitter function AST node into a
 * compact control-flow TREE — statement-level, not compiler basic blocks
 * (readable by humans, which is the whole point of a visualizer).
 *
 * Driven by per-language profiles (same pattern as the complexity configs):
 * each profile declares, for its grammar, which node type is an `if`, a loop,
 * a `switch`, a `try`, a `return`, where the fields live, and which nodes open
 * nested scopes that must never be descended into (nested functions/classes).
 *
 * Runs in the analyzer worker (on-demand, per function); the JSON tree is
 * cached host-side and rendered by the 2D SVG modal in the webview.
 */

import type Parser from 'web-tree-sitter';

// ============================================================
// Result model (JSON-serializable — sent to the webview)
// ============================================================

export interface FlowStep {
    kind: 'step';
    text: string;
    line: number;
    calls?: string[];   // function names called by this statement (for drill-down)
    dead?: boolean;     // unreachable — placed after an unconditional jump
}

export interface FlowIf {
    kind: 'if';
    cond: string;
    line: number;
    then: FlowNode[];
    else?: FlowNode[];
    dead?: boolean;
}

export interface FlowLoop {
    kind: 'loop';
    loopType: string;   // 'for' | 'foreach' | 'while' | 'do' | …
    header: string;
    line: number;
    body: FlowNode[];
    dead?: boolean;
}

export interface FlowSwitch {
    kind: 'switch';
    expr: string;
    line: number;
    cases: FlowCase[];
    dead?: boolean;
}

export interface FlowCase {
    label: string;
    line: number;
    body: FlowNode[];
}

export interface FlowTry {
    kind: 'try';
    line: number;
    body: FlowNode[];
    catches: FlowCatch[];
    finally?: FlowNode[];
    dead?: boolean;
}

export interface FlowCatch {
    param?: string;
    line: number;
    body: FlowNode[];
}

export interface FlowJump {
    kind: 'jump';
    jump: string;       // 'return' | 'throw' | 'break' | 'continue' | 'goto'
    text: string;
    line: number;
    calls?: string[];   // e.g. `return helper(x)` — for drill-down
    dead?: boolean;
}

export type FlowNode = FlowStep | FlowIf | FlowLoop | FlowSwitch | FlowTry | FlowJump;

export interface FunctionFlow {
    name: string;
    line: number;       // 1-based
    endLine: number;    // 1-based
    language: string;
    /** 1 + decisions (if / loop / case / catch / ternary) — AST-exact branching count. */
    decisions: number;
    nodes: FlowNode[];
    /** Node cap hit — the function is too large to display in full. */
    truncated?: boolean;
}

// ============================================================
// Limits
// ============================================================

const MAX_NODES = 300;      // guardrail for very large functions
const MAX_TEXT = 160;       // collapsed text cap per step/condition/header
const MAX_CALLS = 8;        // calls reported per step

// ============================================================
// Language profiles
// ============================================================

interface LoopSpec {
    node: string;
    label: string;
    /** Fields joined for the loop header text (fallback: first line of node text). */
    headerFields?: string[];
    /** Separator between header fields (default " ; "). */
    joinWith?: string;
}

export interface FlowProfile {
    ifNode: string;
    ifCondField: string;
    ifThenField: string;
    ifElseField: string;
    /** Extra node types that continue an if-chain (e.g. Python `elif_clause`). */
    elseIfTypes?: string[];
    /** Else wrappers to unwrap (e.g. Python `else_clause`). */
    elseWrapperTypes?: string[];
    loops: LoopSpec[];
    loopBodyField: string;
    switchNode?: string;
    switchValueField?: string;
    switchCaseTypes?: string[];
    switchCaseLabelField?: string;
    tryNode?: string;
    tryBodyField?: string;
    catchTypes?: string[];
    catchParamField?: string;
    finallyTypes?: string[];
    finallyBodyField?: string;
    /** Node type → jump label. */
    jumps: Record<string, string>;
    callNode?: string;
    callFuncField?: string;
    /** Counted for the decisions badge (stays inside the step text). */
    ternaryNode?: string;
    /** Function-like node types: located by line, and never descended into when nested. */
    functions: string[];
    /** Additional opaque scope types (classes, lambdas…) skipped when nested. */
    scopeOnly?: string[];
    commentTypes: string[];
    bodyField: string;
    nameField?: string;
    /** Node types whose named children form a statement list. */
    blockTypes: string[];
}

const JS_FUNCTIONS = [
    'function_declaration', 'function_expression', 'generator_function',
    'generator_function_declaration', 'arrow_function', 'method_definition',
];

const JAVASCRIPT_PROFILE: FlowProfile = {
    ifNode: 'if_statement',
    ifCondField: 'condition',
    ifThenField: 'consequence',
    ifElseField: 'alternative',
    elseWrapperTypes: ['else_clause'], // the JS grammar wraps else bodies
    loops: [
        { node: 'for_statement', label: 'for', headerFields: ['initializer', 'condition', 'increment'] },
        { node: 'for_in_statement', label: 'foreach' },
        { node: 'while_statement', label: 'while', headerFields: ['condition'] },
        { node: 'do_statement', label: 'do', headerFields: ['condition'] },
    ],
    loopBodyField: 'body',
    switchNode: 'switch_statement',
    switchValueField: 'value',
    switchCaseTypes: ['switch_case', 'switch_default'],
    switchCaseLabelField: 'value',
    tryNode: 'try_statement',
    tryBodyField: 'body',
    catchTypes: ['catch_clause'],
    catchParamField: 'parameter',
    finallyTypes: ['finally_clause'],
    finallyBodyField: 'body',
    jumps: {
        return_statement: 'return',
        throw_statement: 'throw',
        break_statement: 'break',
        continue_statement: 'continue',
    },
    callNode: 'call_expression',
    callFuncField: 'function',
    ternaryNode: 'ternary_expression',
    functions: JS_FUNCTIONS,
    scopeOnly: ['class_declaration', 'class'],
    commentTypes: ['comment'],
    bodyField: 'body',
    nameField: 'name',
    blockTypes: ['statement_block'],
};

const PYTHON_PROFILE: FlowProfile = {
    ifNode: 'if_statement',
    ifCondField: 'condition',
    ifThenField: 'consequence',
    ifElseField: 'alternative',
    elseIfTypes: ['elif_clause'],
    elseWrapperTypes: ['else_clause'],
    loops: [
        { node: 'for_statement', label: 'for', headerFields: ['left', 'right'], joinWith: ' in ' },
        { node: 'while_statement', label: 'while', headerFields: ['condition'] },
    ],
    loopBodyField: 'body',
    tryNode: 'try_statement',
    tryBodyField: 'body',
    catchTypes: ['except_clause'],
    finallyTypes: ['finally_clause'],
    finallyBodyField: 'body',
    jumps: {
        return_statement: 'return',
        raise_statement: 'throw',
        break_statement: 'break',
        continue_statement: 'continue',
    },
    callNode: 'call',
    callFuncField: 'function',
    ternaryNode: 'conditional_expression',
    functions: ['function_definition'],
    scopeOnly: ['lambda', 'class_definition'],
    commentTypes: ['comment'],
    bodyField: 'body',
    nameField: 'name',
    blockTypes: ['block'],
};

const C_PROFILE: FlowProfile = {
    ifNode: 'if_statement',
    ifCondField: 'condition',
    ifThenField: 'consequence',
    ifElseField: 'alternative',
    loops: [
        { node: 'for_statement', label: 'for', headerFields: ['initializer', 'condition', 'update'] },
        { node: 'while_statement', label: 'while', headerFields: ['condition'] },
        { node: 'do_statement', label: 'do', headerFields: ['condition'] },
    ],
    loopBodyField: 'body',
    switchNode: 'switch_statement',
    switchValueField: 'condition',
    switchCaseTypes: ['case_statement'],
    switchCaseLabelField: 'value',
    jumps: {
        return_statement: 'return',
        break_statement: 'break',
        continue_statement: 'continue',
        goto_statement: 'goto',
    },
    callNode: 'call_expression',
    callFuncField: 'function',
    ternaryNode: 'conditional_expression',
    functions: ['function_definition'],
    commentTypes: ['comment'],
    bodyField: 'body',
    blockTypes: ['compound_statement'],
};

const CPP_PROFILE: FlowProfile = {
    ...C_PROFILE,
    loops: [
        ...C_PROFILE.loops,
        { node: 'for_range_loop', label: 'foreach', headerFields: ['declarator', 'right'] },
    ],
    tryNode: 'try_statement',
    tryBodyField: 'body',
    catchTypes: ['catch_clause'],
    jumps: {
        ...C_PROFILE.jumps,
        throw_statement: 'throw',
    },
    scopeOnly: ['class_specifier', 'namespace_definition', 'lambda_expression'],
};

const FLOW_PROFILES: Record<string, FlowProfile> = {
    javascript: JAVASCRIPT_PROFILE,
    typescript: JAVASCRIPT_PROFILE,
    tsx: JAVASCRIPT_PROFILE,
    python: PYTHON_PROFILE,
    c: C_PROFILE,
    cpp: CPP_PROFILE,
};

/** Languages with a flow profile (MVP set). */
export function flowLanguages(): string[] {
    return Object.keys(FLOW_PROFILES);
}

export function flowProfile(language: string): FlowProfile | undefined {
    return FLOW_PROFILES[language];
}

// ============================================================
// Engine
// ============================================================

interface BuildContext {
    profile: FlowProfile;
    decisions: number;   // extra decisions beyond the base 1 (filled during build)
    count: number;       // nodes emitted (cap guardrail)
    truncated: boolean;
}

function collapse(text: string, max: number = MAX_TEXT): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > max ? flat.slice(0, max - 1) + '…' : flat;
}

function line1(node: Parser.SyntaxNode): number {
    return node.startPosition.row + 1;
}

/**
 * Node equality — web-tree-sitter wraps AST nodes in fresh objects on every
 * access, so `child === other` never matches; positions are the identity.
 */
function sameNode(a: Parser.SyntaxNode | null, b: Parser.SyntaxNode | null): boolean {
    return !!a && !!b && a.startIndex === b.startIndex && a.endIndex === b.endIndex && a.type === b.type;
}

function fieldText(node: Parser.SyntaxNode, field: string): string {
    const child = node.childForFieldName(field);
    return child ? collapse(child.text) : '';
}

/** The named children of a block-like node, or [node] when it is a single statement. */
function statementNodes(node: Parser.SyntaxNode, profile: FlowProfile): Parser.SyntaxNode[] {
    if (profile.blockTypes.includes(node.type)) {
        return node.namedChildren.filter((c) => c !== null) as Parser.SyntaxNode[];
    }
    return [node];
}

/** Body of a clause: the named field, else the last block-like child (Python clauses). */
function bodyNode(node: Parser.SyntaxNode, field: string, profile: FlowProfile): Parser.SyntaxNode | null {
    const byField = node.childForFieldName(field);
    if (byField) return byField;
    for (let i = node.namedChildCount - 1; i >= 0; i--) {
        const child = node.namedChild(i);
        if (child && profile.blockTypes.includes(child.type)) return child;
    }
    return null;
}

/**
 * The else/elif alternative children of an if node, in source order.
 * `childForFieldName` only returns the FIRST alternative — Python repeats the
 * `alternative` field on the same if_statement for elif/else chains, so the
 * remaining clauses are collected by their clause types.
 */
function alternativeNodes(node: Parser.SyntaxNode, profile: FlowProfile): Parser.SyntaxNode[] {
    const out: Parser.SyntaxNode[] = [];
    const byField = node.childForFieldName(profile.ifElseField);
    if (byField) out.push(byField);
    for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (!child || sameNode(child, byField)) continue;
        if (profile.elseWrapperTypes && profile.elseWrapperTypes.includes(child.type)) out.push(child);
        else if (profile.elseIfTypes && profile.elseIfTypes.includes(child.type)) out.push(child);
    }
    return out;
}

/** Statements inside a wrapper node (e.g. JS `else_clause`): named children, blocks unwrapped. */
function wrapperStatements(wrapper: Parser.SyntaxNode, profile: FlowProfile): Parser.SyntaxNode[] {
    const out: Parser.SyntaxNode[] = [];
    for (let i = 0; i < wrapper.namedChildCount; i++) {
        const child = wrapper.namedChild(i);
        if (!child) continue;
        if (profile.blockTypes.includes(child.type)) {
            for (let j = 0; j < child.namedChildCount; j++) {
                const inner = child.namedChild(j);
                if (inner) out.push(inner);
            }
        } else {
            out.push(child);
        }
    }
    return out;
}

/** Depth-first walk that never descends into nested functions / opaque scopes. */
function walkScope(node: Parser.SyntaxNode, profile: FlowProfile, visit: (n: Parser.SyntaxNode) => void): void {
    visit(node);
    for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (!child) continue;
        if (profile.functions.includes(child.type)) continue;
        if (profile.scopeOnly && profile.scopeOnly.includes(child.type)) continue;
        walkScope(child, profile, visit);
    }
}

/** Function names called by a statement subtree (nested scopes excluded). */
function collectCalls(node: Parser.SyntaxNode, profile: FlowProfile): string[] {
    if (!profile.callNode) return [];
    const calls: string[] = [];
    walkScope(node, profile, (n) => {
        if (n.type !== profile.callNode || calls.length >= MAX_CALLS) return;
        const fn = profile.callFuncField ? n.childForFieldName(profile.callFuncField) : null;
        if (!fn) return;
        // Keep only the last identifier of a member chain: a.b.run() → run
        const text = collapse(fn.text, 60);
        const name = text.split(/[.(]/).pop() || text;
        if (name && calls.indexOf(name) === -1) calls.push(name);
    });
    return calls;
}

function countTernaries(node: Parser.SyntaxNode, profile: FlowProfile): number {
    if (!profile.ternaryNode) return 0;
    let count = 0;
    walkScope(node, profile, (n) => {
        if (n.type === profile.ternaryNode) count++;
    });
    return count;
}

function classify(node: Parser.SyntaxNode, ctx: BuildContext): FlowNode {
    const p = ctx.profile;

    // if / else-if
    if (node.type === p.ifNode || (p.elseIfTypes && p.elseIfTypes.includes(node.type))) {
        return buildIf(node, ctx);
    }

    // loops
    for (const spec of p.loops) {
        if (node.type !== spec.node) continue;
        ctx.decisions++;
        const body = bodyNode(node, p.loopBodyField, p);
        return {
            kind: 'loop',
            loopType: spec.label,
            header: loopHeader(node, spec),
            line: line1(node),
            body: body ? buildStatements(statementNodes(body, p), ctx) : [],
        };
    }

    // switch
    if (p.switchNode && node.type === p.switchNode) {
        const value = (p.switchValueField ? fieldText(node, p.switchValueField) : '') || loopHeader(node, { node: node.type, label: 'switch' });
        const cases: FlowCase[] = [];
        const body = bodyNode(node, 'body', p);
        if (body) {
            for (let i = 0; i < body.namedChildCount; i++) {
                const child = body.namedChild(i);
                if (!child || !p.switchCaseTypes || !p.switchCaseTypes.includes(child.type)) continue;
                ctx.decisions++;
                let label: string;
                if (child.type === 'switch_default' || /^\s*default\b/.test(child.text)) {
                    label = 'default';
                } else {
                    label = (p.switchCaseLabelField ? fieldText(child, p.switchCaseLabelField) : '')
                        || collapse(child.text.split(':')[0], 60);
                }
                cases.push({ label, line: line1(child), body: buildStatements(caseBodyNodes(child, p), ctx) });
            }
        }
        return { kind: 'switch', expr: value, line: line1(node), cases };
    }

    // try / catch / finally
    if (p.tryNode && node.type === p.tryNode) {
        const body = bodyNode(node, p.tryBodyField || 'body', p);
        const catches: FlowCatch[] = [];
        for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (!child || !p.catchTypes || !p.catchTypes.includes(child.type)) continue;
            ctx.decisions++;
            const param = p.catchParamField ? fieldText(child, p.catchParamField) : '';
            const catchBody = bodyNode(child, 'body', p);
            catches.push({
                param: param || undefined,
                line: line1(child),
                body: catchBody ? buildStatements(statementNodes(catchBody, p), ctx) : [],
            });
        }
        let finallyNodes: FlowNode[] | undefined;
        if (p.finallyTypes) {
            for (let i = 0; i < node.namedChildCount; i++) {
                const child = node.namedChild(i);
                if (!child || !p.finallyTypes.includes(child.type)) continue;
                const finBody = bodyNode(child, p.finallyBodyField || 'body', p);
                finallyNodes = finBody ? buildStatements(statementNodes(finBody, p), ctx) : [];
            }
        }
        return {
            kind: 'try',
            line: line1(node),
            body: body ? buildStatements(statementNodes(body, p), ctx) : [],
            catches,
            finally: finallyNodes,
        };
    }

    // jumps
    const jump = p.jumps[node.type];
    if (jump) {
        ctx.decisions += countTernaries(node, p);
        const calls = collectCalls(node, p);
        const flow: FlowJump = { kind: 'jump', jump, text: collapse(node.text), line: line1(node) };
        if (calls.length) flow.calls = calls;
        return flow;
    }

    // plain statement
    const calls = collectCalls(node, p);
    ctx.decisions += countTernaries(node, p);
    const step: FlowStep = { kind: 'step', text: collapse(node.text), line: line1(node) };
    if (calls.length) step.calls = calls;
    return step;
}

/** Statements of a switch case: the case node's children minus the label (blocks unwrapped). */
function caseBodyNodes(caseNode: Parser.SyntaxNode, profile: FlowProfile): Parser.SyntaxNode[] {
    const label = profile.switchCaseLabelField ? caseNode.childForFieldName(profile.switchCaseLabelField) : null;
    const out: Parser.SyntaxNode[] = [];
    for (let i = 0; i < caseNode.namedChildCount; i++) {
        const child = caseNode.namedChild(i);
        if (!child || sameNode(child, label)) continue;
        if (profile.blockTypes.includes(child.type)) {
            for (let j = 0; j < child.namedChildCount; j++) {
                const inner = child.namedChild(j);
                if (inner) out.push(inner);
            }
        } else {
            out.push(child);
        }
    }
    return out;
}

function buildIf(node: Parser.SyntaxNode, ctx: BuildContext): FlowIf {
    const p = ctx.profile;
    ctx.decisions++;
    const thenBody = bodyNode(node, p.ifThenField, p);
    const flow: FlowIf = {
        kind: 'if',
        cond: fieldText(node, p.ifCondField) || collapse(node.text, 60),
        line: line1(node),
        then: thenBody ? buildStatements(statementNodes(thenBody, p), ctx) : [],
    };

    const alternatives = alternativeNodes(node, p);
    if (alternatives.length) {
        flow.else = buildAlternatives(alternatives, ctx);
    }
    return flow;
}

/** Build the else part from one or more alternative children (Python repeats the `alternative` field). */
function buildAlternatives(alts: Parser.SyntaxNode[], ctx: BuildContext): FlowNode[] {
    const p = ctx.profile;
    const first = alts[0];
    const rest = alts.slice(1);

    if (first.type === p.ifNode || (p.elseIfTypes && p.elseIfTypes.includes(first.type))) {
        const chain = buildIf(first, ctx);
        if (rest.length) {
            // Attach the remaining clauses at the deepest link of the else-if chain
            let cursor: FlowIf = chain;
            while (cursor.else && cursor.else.length === 1 && cursor.else[0].kind === 'if') {
                cursor = cursor.else[0] as FlowIf;
            }
            cursor.else = buildAlternatives(rest, ctx);
        }
        return [chain];
    }
    if (p.elseWrapperTypes && p.elseWrapperTypes.includes(first.type)) {
        const wrapperBody = first.childForFieldName('body');
        return wrapperBody
            ? buildStatements(statementNodes(wrapperBody, p), ctx)
            : buildStatements(wrapperStatements(first, p), ctx);
    }
    return buildStatements(statementNodes(first, p), ctx);
}

function loopHeader(node: Parser.SyntaxNode, spec: LoopSpec): string {
    if (spec.headerFields) {
        const parts: string[] = [];
        for (const field of spec.headerFields) {
            const text = fieldText(node, field);
            if (text) parts.push(text);
        }
        if (parts.length) return collapse(parts.join(spec.joinWith || ' ; '), 120);
    }
    // Fallback: first line of the node text, trailing brace removed
    const firstLine = (node.text.split('\n')[0] || node.type).replace(/[\s{]+$/, '');
    return collapse(firstLine, 120);
}

function isSkippable(node: Parser.SyntaxNode, profile: FlowProfile): boolean {
    if (profile.commentTypes.includes(node.type)) return true;
    return node.type === 'empty_statement';
}

/** Build the flow for a statement list; marks statements after a jump as dead. */
function buildStatements(list: Parser.SyntaxNode[], ctx: BuildContext): FlowNode[] {
    const out: FlowNode[] = [];
    let dead = false;

    for (const node of list) {
        if (ctx.truncated) break;
        if (isSkippable(node, ctx.profile)) continue;

        ctx.count++;
        if (ctx.count > MAX_NODES) {
            ctx.truncated = true;
            break;
        }

        const flow = classify(node, ctx);
        if (dead) flow.dead = true;
        out.push(flow);
        if (flow.kind === 'jump') dead = true; // everything after an unconditional jump is unreachable
    }
    return out;
}

// ============================================================
// Public API
// ============================================================

/** Innermost function-like node containing `line` (1-based), or null. */
export function findFunctionAtLine(
    tree: Parser.Tree,
    language: string,
    line: number,
): Parser.SyntaxNode | null {
    const profile = flowProfile(language);
    if (!profile) return null;

    let best: Parser.SyntaxNode | null = null;
    const visit = (node: Parser.SyntaxNode): void => {
        if (profile.functions.includes(node.type)) {
            const start = node.startPosition.row + 1;
            const end = node.endPosition.row + 1;
            if (start <= line && line <= end) {
                if (!best
                    || node.startPosition.row > best.startPosition.row
                    || (node.startPosition.row === best.startPosition.row
                        && node.endPosition.row < best.endPosition.row)) {
                    best = node;
                }
            }
        }
        for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (child) visit(child);
        }
    };
    visit(tree.rootNode);
    return best;
}

/** Function name — the name field, else the first identifier in declarator order. */
export function functionName(node: Parser.SyntaxNode, profile: FlowProfile): string {
    if (profile.nameField) {
        const name = node.childForFieldName(profile.nameField);
        if (name) return collapse(name.text, 60);
    }
    // Arrow / expression functions bound to a variable or object property
    const parent = node.parent;
    if (parent) {
        const bind = parent.childForFieldName('name') || parent.childForFieldName('left');
        if (bind && (bind.type === 'identifier' || bind.type === 'property_identifier' || bind.type === 'member_expression')) {
            return collapse(bind.text, 60);
        }
    }
    let found: string | null = null;
    let visited = 0;
    const visit = (n: Parser.SyntaxNode): void => {
        if (found || visited > 40) return;
        visited++;
        if (n.type === 'identifier' || n.type === 'field_identifier' || n.type === 'property_identifier') {
            found = n.text;
            return;
        }
        for (let i = 0; i < n.namedChildCount; i++) {
            const child = n.namedChild(i);
            if (child) visit(child);
        }
    };
    visit(node);
    return found ? collapse(found, 60) : '(anonymous)';
}

/** Build the flow tree for a function node (or any statement list node). */
export function buildFunctionFlow(node: Parser.SyntaxNode, language: string): FunctionFlow | null {
    const profile = flowProfile(language);
    if (!profile) return null;

    const body = bodyNode(node, profile.bodyField, profile);
    const ctx: BuildContext = { profile, decisions: 0, count: 0, truncated: false };
    const nodes = body ? buildStatements(statementNodes(body, profile), ctx) : [];

    return {
        name: functionName(node, profile),
        line: line1(node),
        endLine: node.endPosition.row + 1,
        language,
        decisions: 1 + ctx.decisions,
        nodes,
        truncated: ctx.truncated || undefined,
    };
}

/** One-call helper: locate the function containing `line` and build its flow. */
export function functionFlowAtLine(
    tree: Parser.Tree,
    language: string,
    line: number,
): FunctionFlow | null {
    const node = findFunctionAtLine(tree, language, line);
    return node ? buildFunctionFlow(node, language) : null;
}
