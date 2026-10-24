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
 *
 * The same AST profile also drives per-function metrics: Sonar-style cognitive
 * complexity (nesting + boolean sequences), McCabe cyclomatic complexity,
 * approximate Halstead volume and the Maintainability Index.
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
    /** Cognitive complexity, Halstead and maintainability for this function. */
    metrics: FunctionMetrics;
    /** Node cap hit — the function is too large to display in full. */
    truncated?: boolean;
}

/** Approximate Halstead metrics (token counts, not a compiler semantic pass). */
export interface HalsteadMetrics {
    distinctOperators: number;
    distinctOperands: number;
    totalOperators: number;
    totalOperands: number;
    vocabulary: number;
    length: number;
    volume: number;
    difficulty: number;
    effort: number;
    bugs: number;
}

export interface FunctionMetrics {
    /** Sonar-style cognitive complexity (nesting + boolean sequences). */
    cognitive: number;
    /** McCabe cyclomatic complexity (1 + branches + logical operators). */
    cyclomatic: number;
    /** Function length in source lines (signature to closing brace). */
    lines: number;
    halstead: HalsteadMetrics;
    /** Maintainability Index, 0–100 (higher is better). */
    maintainability: number;
}

export interface FunctionMetricEntry {
    name: string;
    line: number;
    endLine: number;
    metrics: FunctionMetrics;
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
    /** Some grammars expose no fields on if/else branches; use child positions. */
    ifPositional?: boolean;
    /** Statement containers used to find a positional if body. */
    ifBodyTypes?: string[];
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
    /** Logical expression node types (binary_expression, boolean_operator…). */
    logicalNodeTypes?: string[];
    /** Logical operators worth +1 cognitive each time the sequence changes. */
    logicalOperators?: string[];
    /** AST field holding a binary/unary operator token. */
    operatorField?: string;
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
    logicalNodeTypes: ['binary_expression'],
    logicalOperators: ['&&', '||'],
    operatorField: 'operator',
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
    logicalNodeTypes: ['boolean_operator'],
    logicalOperators: ['and', 'or'],
    operatorField: 'operator',
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
    elseWrapperTypes: ['else_clause'],
    jumps: {
        return_statement: 'return',
        break_statement: 'break',
        continue_statement: 'continue',
        goto_statement: 'goto',
    },
    callNode: 'call_expression',
    callFuncField: 'function',
    ternaryNode: 'conditional_expression',
    logicalNodeTypes: ['binary_expression'],
    logicalOperators: ['&&', '||'],
    operatorField: 'operator',
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

const JAVA_COGNITIVE_PROFILE: FlowProfile = {
    ifNode: 'if_statement',
    ifCondField: 'condition',
    ifThenField: 'consequence',
    ifElseField: 'alternative',
    loops: [
        { node: 'for_statement', label: 'for', headerFields: ['init', 'condition', 'update'] },
        { node: 'enhanced_for_statement', label: 'foreach' },
        { node: 'while_statement', label: 'while', headerFields: ['condition'] },
        { node: 'do_statement', label: 'do', headerFields: ['condition'] },
    ],
    loopBodyField: 'body',
    switchNode: 'switch_expression',
    switchValueField: 'condition',
    switchCaseTypes: ['switch_block_statement_group', 'switch_rule'],
    tryNode: 'try_statement',
    tryBodyField: 'body',
    catchTypes: ['catch_clause'],
    finallyTypes: ['finally_clause'],
    finallyBodyField: 'body',
    jumps: {
        return_statement: 'return', throw_statement: 'throw',
        break_statement: 'break', continue_statement: 'continue', yield_statement: 'yield',
    },
    callNode: 'method_invocation',
    callFuncField: 'name',
    ternaryNode: 'ternary_expression',
    logicalNodeTypes: ['binary_expression'],
    logicalOperators: ['&&', '||'],
    operatorField: 'operator',
    functions: ['method_declaration', 'constructor_declaration'],
    scopeOnly: ['class_declaration', 'interface_declaration', 'enum_declaration', 'record_declaration', 'lambda_expression'],
    commentTypes: ['line_comment', 'block_comment'],
    bodyField: 'body',
    nameField: 'name',
    blockTypes: ['block', 'constructor_body', 'switch_block'],
};

const GO_COGNITIVE_PROFILE: FlowProfile = {
    ifNode: 'if_statement',
    ifCondField: 'condition',
    ifThenField: 'consequence',
    ifElseField: 'alternative',
    loops: [{ node: 'for_statement', label: 'for' }],
    loopBodyField: 'body',
    switchNode: 'expression_switch_statement',
    switchValueField: 'value',
    switchCaseTypes: ['expression_case', 'default_case'],
    jumps: {
        return_statement: 'return', break_statement: 'break',
        continue_statement: 'continue', goto_statement: 'goto',
    },
    callNode: 'call_expression',
    callFuncField: 'function',
    logicalNodeTypes: ['binary_expression'],
    logicalOperators: ['&&', '||'],
    operatorField: 'operator',
    functions: ['function_declaration', 'method_declaration'],
    scopeOnly: ['func_literal'],
    commentTypes: ['comment'],
    bodyField: 'body',
    nameField: 'name',
    blockTypes: ['block'],
};

const RUST_COGNITIVE_PROFILE: FlowProfile = {
    ifNode: 'if_expression',
    ifCondField: 'condition',
    ifThenField: 'consequence',
    ifElseField: 'alternative',
    elseWrapperTypes: ['else_clause'],
    loops: [
        { node: 'for_expression', label: 'for', headerFields: ['pattern', 'value'] },
        { node: 'while_expression', label: 'while', headerFields: ['condition'] },
        { node: 'loop_expression', label: 'loop' },
    ],
    loopBodyField: 'body',
    switchNode: 'match_expression',
    switchValueField: 'value',
    switchCaseTypes: ['match_arm'],
    jumps: {
        return_expression: 'return', break_expression: 'break',
        continue_expression: 'continue',
    },
    callNode: 'call_expression',
    callFuncField: 'function',
    logicalNodeTypes: ['binary_expression'],
    logicalOperators: ['&&', '||'],
    operatorField: 'operator',
    functions: ['function_item'],
    scopeOnly: ['closure_expression', 'impl_item'],
    commentTypes: ['line_comment', 'block_comment'],
    bodyField: 'body',
    nameField: 'name',
    blockTypes: ['block', 'match_block'],
};

const CSHARP_COGNITIVE_PROFILE: FlowProfile = {
    ifNode: 'if_statement',
    ifCondField: 'condition',
    ifThenField: 'consequence',
    ifElseField: 'alternative',
    loops: [
        { node: 'for_statement', label: 'for', headerFields: ['initializer', 'condition', 'update'] },
        { node: 'foreach_statement', label: 'foreach' },
        { node: 'while_statement', label: 'while', headerFields: ['condition'] },
        { node: 'do_statement', label: 'do', headerFields: ['condition'] },
    ],
    loopBodyField: 'body',
    switchNode: 'switch_statement',
    switchValueField: 'value',
    switchCaseTypes: ['switch_section'],
    tryNode: 'try_statement',
    tryBodyField: 'body',
    catchTypes: ['catch_clause'],
    finallyTypes: ['finally_clause'],
    finallyBodyField: 'body',
    jumps: {
        return_statement: 'return', throw_statement: 'throw',
        break_statement: 'break', continue_statement: 'continue', goto_statement: 'goto',
    },
    callNode: 'invocation_expression',
    callFuncField: 'function',
    ternaryNode: 'conditional_expression',
    logicalNodeTypes: ['binary_expression'],
    logicalOperators: ['&&', '||'],
    operatorField: 'operator',
    functions: ['method_declaration', 'local_function_statement', 'constructor_declaration'],
    scopeOnly: ['class_declaration', 'struct_declaration', 'interface_declaration', 'lambda_expression'],
    commentTypes: ['comment', 'line_comment', 'block_comment'],
    bodyField: 'body',
    nameField: 'name',
    blockTypes: ['block', 'switch_body'],
};

const PHP_COGNITIVE_PROFILE: FlowProfile = {
    ifNode: 'if_statement',
    ifCondField: 'condition',
    ifThenField: 'body',
    ifElseField: 'alternative',
    elseIfTypes: ['else_if_clause'],
    elseWrapperTypes: ['else_clause'],
    loops: [
        { node: 'for_statement', label: 'for', headerFields: ['initialize', 'condition', 'update'] },
        { node: 'foreach_statement', label: 'foreach' },
        { node: 'while_statement', label: 'while', headerFields: ['condition'] },
        { node: 'do_statement', label: 'do', headerFields: ['condition'] },
    ],
    loopBodyField: 'body',
    switchNode: 'switch_statement',
    switchValueField: 'condition',
    switchCaseTypes: ['case_statement', 'default_statement'],
    tryNode: 'try_statement',
    tryBodyField: 'body',
    catchTypes: ['catch_clause'],
    finallyTypes: ['finally_clause'],
    finallyBodyField: 'body',
    jumps: {
        return_statement: 'return', throw_expression: 'throw',
        break_statement: 'break', continue_statement: 'continue',
    },
    callNode: 'function_call_expression',
    callFuncField: 'function',
    ternaryNode: 'conditional_expression',
    logicalNodeTypes: ['binary_expression'],
    logicalOperators: ['&&', '||', 'and', 'or'],
    operatorField: 'operator',
    functions: ['function_definition', 'method_declaration'],
    scopeOnly: ['class_declaration', 'anonymous_function_creation_expression', 'arrow_function'],
    commentTypes: ['comment'],
    bodyField: 'body',
    nameField: 'name',
    blockTypes: ['compound_statement', 'switch_block'],
};

const KOTLIN_COGNITIVE_PROFILE: FlowProfile = {
    ifNode: 'if_expression',
    ifCondField: '',
    ifThenField: '',
    ifElseField: '',
    ifPositional: true,
    ifBodyTypes: ['control_structure_body'],
    loops: [
        { node: 'for_statement', label: 'for' },
        { node: 'while_statement', label: 'while' },
        { node: 'do_while_statement', label: 'do' },
    ],
    loopBodyField: 'body',
    switchNode: 'when_expression',
    switchCaseTypes: ['when_entry'],
    tryNode: 'try_expression',
    catchTypes: ['catch_block'],
    finallyTypes: ['finally_block'],
    jumps: { jump_expression: 'jump' },
    callNode: 'call_expression',
    logicalNodeTypes: ['conjunction_expression', 'disjunction_expression'],
    logicalOperators: ['&&', '||'],
    functions: ['function_declaration'],
    scopeOnly: ['class_declaration', 'object_declaration', 'lambda_literal', 'anonymous_function'],
    commentTypes: ['line_comment', 'multiline_comment'],
    bodyField: 'body',
    nameField: 'name',
    blockTypes: ['statements', 'control_structure_body', 'function_body', 'block'],
};

const SWIFT_COGNITIVE_PROFILE: FlowProfile = {
    ifNode: 'if_statement',
    ifCondField: 'condition',
    ifThenField: '',
    ifElseField: '',
    ifPositional: true,
    ifBodyTypes: ['statements'],
    loops: [
        { node: 'for_statement', label: 'for', headerFields: ['item', 'collection'] },
        { node: 'while_statement', label: 'while', headerFields: ['condition'] },
        { node: 'repeat_while_statement', label: 'repeat', headerFields: ['condition'] },
    ],
    loopBodyField: 'body',
    switchNode: 'switch_statement',
    switchValueField: 'expr',
    switchCaseTypes: ['switch_entry'],
    tryNode: 'do_statement',
    catchTypes: ['catch_block'],
    jumps: { control_transfer_statement: 'jump' },
    callNode: 'call_expression',
    ternaryNode: 'ternary_expression',
    logicalNodeTypes: ['conjunction_expression', 'disjunction_expression'],
    logicalOperators: ['&&', '||'],
    functions: ['function_declaration'],
    scopeOnly: ['class_declaration', 'struct_declaration', 'closure_expression', 'lambda_literal'],
    commentTypes: ['line_comment', 'block_comment', 'multiline_comment'],
    bodyField: 'body',
    nameField: 'name',
    blockTypes: ['statements', 'function_body'],
};

const LUA_COGNITIVE_PROFILE: FlowProfile = {
    ifNode: 'if_statement',
    ifCondField: 'condition',
    ifThenField: 'consequence',
    ifElseField: 'alternative',
    elseIfTypes: ['elseif_clause'],
    elseWrapperTypes: ['else_clause'],
    loops: [
        { node: 'for_statement', label: 'for' },
        { node: 'while_statement', label: 'while' },
        { node: 'repeat_statement', label: 'repeat' },
    ],
    loopBodyField: 'body',
    jumps: {
        return_statement: 'return', break_statement: 'break', goto_statement: 'goto',
    },
    callNode: 'function_call',
    logicalNodeTypes: ['binary_expression'],
    logicalOperators: ['and', 'or'],
    operatorField: 'operator',
    functions: ['function_definition_statement', 'local_function_definition_statement'],
    scopeOnly: ['function_definition'],
    commentTypes: ['comment'],
    bodyField: 'body',
    nameField: 'name',
    blockTypes: ['block'],
};

const BASH_COGNITIVE_PROFILE: FlowProfile = {
    ifNode: 'if_statement',
    ifCondField: 'condition',
    ifThenField: '',
    ifElseField: '',
    ifPositional: true,
    ifBodyTypes: [],
    elseIfTypes: ['elif_clause'],
    elseWrapperTypes: ['else_clause'],
    loops: [
        { node: 'for_statement', label: 'for' },
        { node: 'c_style_for_statement', label: 'for' },
        { node: 'while_statement', label: 'while' },
    ],
    loopBodyField: 'body',
    jumps: {},
    logicalNodeTypes: ['list'],
    logicalOperators: ['&&', '||'],
    functions: ['function_definition'],
    commentTypes: ['comment'],
    bodyField: 'body',
    nameField: 'name',
    blockTypes: ['compound_statement'],
};

const COGNITIVE_PROFILES: Record<string, FlowProfile> = {
    ...FLOW_PROFILES,
    java: JAVA_COGNITIVE_PROFILE,
    go: GO_COGNITIVE_PROFILE,
    rust: RUST_COGNITIVE_PROFILE,
    csharp: CSHARP_COGNITIVE_PROFILE,
    php: PHP_COGNITIVE_PROFILE,
    kotlin: KOTLIN_COGNITIVE_PROFILE,
    swift: SWIFT_COGNITIVE_PROFILE,
    lua: LUA_COGNITIVE_PROFILE,
    bash: BASH_COGNITIVE_PROFILE,
};

/** Languages with a flow profile (MVP set). */
export function flowLanguages(): string[] {
    return Object.keys(FLOW_PROFILES);
}

export function flowProfile(language: string): FlowProfile | undefined {
    return FLOW_PROFILES[language];
}

/** Language profile used by the per-function metric engine (broader than flowcharts). */
export function cognitiveProfile(language: string): FlowProfile | undefined {
    return COGNITIVE_PROFILES[normalizeFlowLanguage(language)];
}

/** Languages with a cognitive/function-metric profile. */
export function cognitiveLanguages(): string[] {
    return Object.keys(COGNITIVE_PROFILES);
}

/** Map Aura language ids (`c-source`, `cpp-header`…) to a flow grammar id. */
export function normalizeFlowLanguage(language: string): string {
    if (language.indexOf('cpp') === 0) return 'cpp';
    if (language.indexOf('c-') === 0) return 'c';
    return language;
}

// ============================================================
// Cognitive complexity + Halstead + maintainability
// ============================================================

/** Leaf-like node types counted as Halstead operands (approximate). */
const OPERAND_NODE_TYPES = new Set([
    'identifier', 'property_identifier', 'field_identifier', 'type_identifier',
    'simple_identifier', 'scoped_identifier', 'variable_name', 'name', 'word',
    'shorthand_property_identifier', 'shorthand_property_identifier_pattern',
    'number', 'integer', 'float', 'number_literal', 'integer_literal', 'float_literal',
    'int_literal', 'decimal_integer_literal', 'hex_integer_literal', 'octal_integer_literal',
    'binary_integer_literal', 'real_literal', 'character_literal', 'char_literal',
    'string', 'string_literal', 'template_string', 'raw_string_literal',
    'interpreted_string_literal', 'line_string_literal', 'multi_line_string_literal',
    'string_content', 'encapsed_string', 'boolean_literal', 'true', 'false',
    'null', 'null_literal', 'none', 'nil', 'undefined', 'unit',
    'this', 'self', 'super',
]);

interface MeasureContext {
    profile: FlowProfile;
    cognitive: number;
    cyclomatic: number;
    operators: Set<string>;
    operands: Set<string>;
    totalOperators: number;
    totalOperands: number;
}

function recordOperator(ctx: MeasureContext, token: string): void {
    const op = collapse(token, 24);
    if (!op) return;
    ctx.operators.add(op);
    ctx.totalOperators++;
}

function recordOperand(ctx: MeasureContext, token: string): void {
    const operand = collapse(token, 40);
    if (!operand) return;
    ctx.operands.add(operand);
    ctx.totalOperands++;
}

function isLogicalNode(node: Parser.SyntaxNode, profile: FlowProfile): boolean {
    if (!profile.logicalNodeTypes || !profile.logicalNodeTypes.includes(node.type)) return false;
    const op = logicalOperator(node, profile);
    return !profile.logicalOperators || profile.logicalOperators.includes(op);
}

/** Operator token of an expression: named field first, then an anonymous token child. */
function directOperator(node: Parser.SyntaxNode, profile: FlowProfile): string {
    const field = profile.operatorField || 'operator';
    const op = node.childForFieldName(field);
    if (op) return op.text.trim();
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (!child || child.isNamed()) continue;
        const text = child.text.trim();
        if (!text || text.length > 4) continue;
        if (/^[(){}[\],;.]$/.test(text)) continue;
        return text;
    }
    return '';
}

/** Operator token of a logical expression, with a text fallback for grammars without the field. */
function logicalOperator(node: Parser.SyntaxNode, profile: FlowProfile): string {
    const direct = directOperator(node, profile);
    if (direct) return direct;
    const match = node.text.match(/&&|\|\||\b(?:and|or)\b/);
    return match ? match[0] : '';
}

/**
 * Logical operators in source order. A binary tree stores its root operator
 * between its operands, so an in-order walk is required to count sequences
 * correctly: `a && b || c && d` → `&&`, `||`, `&&` (3 runs).
 */
function collectLogicalOperators(node: Parser.SyntaxNode, profile: FlowProfile, out: string[]): void {
    if (!isLogicalNode(node, profile)) return;
    const op = logicalOperator(node, profile);
    const children: Parser.SyntaxNode[] = [];
    for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child) children.push(child);
    }
    if (children.length >= 2) {
        collectLogicalOperators(children[0], profile, out);
        if (op) out.push(op);
        for (let i = 1; i < children.length; i++) {
            collectLogicalOperators(children[i], profile, out);
        }
    } else {
        if (op) out.push(op);
        for (const child of children) collectLogicalOperators(child, profile, out);
    }
}

/** Whether a body contains at least one real statement (comments do not count). */
function bodyIsMeaningful(node: Parser.SyntaxNode, profile: FlowProfile): boolean {
    const body = bodyNode(node, profile.bodyField, profile);
    if (body) {
        return statementNodes(body, profile).some((s) => !isSkippable(s, profile));
    }
    const wrapper = wrapperStatements(node, profile);
    if (wrapper.length > 0) return wrapper.some((s) => !isSkippable(s, profile));
    return !isSkippable(node, profile);
}

function walkMeasuredBody(body: Parser.SyntaxNode | null, nesting: number, ctx: MeasureContext): void {
    if (!body) return;
    const statements = statementNodes(body, ctx.profile);
    for (const statement of statements) measureNode(statement, nesting, false, ctx);
}

function walkMeasuredStatements(statements: Parser.SyntaxNode[], nesting: number, ctx: MeasureContext): void {
    for (const statement of statements) measureNode(statement, nesting, false, ctx);
}

function namedChildren(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const out: Parser.SyntaxNode[] = [];
    for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child) out.push(child);
    }
    return out;
}

function isIfLike(node: Parser.SyntaxNode, profile: FlowProfile): boolean {
    return node.type === profile.ifNode
        || !!(profile.elseIfTypes && profile.elseIfTypes.includes(node.type));
}

/** Unwrap `else` containers (statements/control_structure_body) around a single if. */
function findSingleIf(node: Parser.SyntaxNode, profile: FlowProfile, depth = 0): Parser.SyntaxNode | null {
    if (isIfLike(node, profile)) return node;
    if (depth >= 4) return null;
    const children = namedChildren(node);
    if (children.length === 1) return findSingleIf(children[0], profile, depth + 1);
    return null;
}

interface PositionalIfParts {
    condition: Parser.SyntaxNode | null;
    thenNodes: Parser.SyntaxNode[];
    alternatives: Parser.SyntaxNode[];
}

/** Tokens that some grammars expose as named children but are not statements. */
const IF_KEYWORDS = new Set(['else', 'else_keyword', 'elseif', 'elif', 'then', 'do']);

/** Fallback for grammars that expose if/else branches by position (Kotlin, Swift, Bash). */
function positionalIfParts(node: Parser.SyntaxNode, profile: FlowProfile): PositionalIfParts {
    const children = namedChildren(node).filter((c) => !IF_KEYWORDS.has(c.type));
    let condition = profile.ifCondField ? node.childForFieldName(profile.ifCondField) : null;
    if (!condition) {
        condition = children.find((c) => !isIfLike(c, profile)
            && !(profile.ifBodyTypes && profile.ifBodyTypes.includes(c.type))
            && !profile.blockTypes.includes(c.type)
            && !(profile.elseWrapperTypes && profile.elseWrapperTypes.includes(c.type))) || null;
    }
    const start = condition ? children.indexOf(condition) + 1 : 0;
    let thenNode: Parser.SyntaxNode | null = null;
    if (profile.ifThenField) thenNode = node.childForFieldName(profile.ifThenField);
    if (!thenNode) {
        const bodyTypes = profile.ifBodyTypes && profile.ifBodyTypes.length > 0
            ? profile.ifBodyTypes
            : profile.blockTypes;
        for (let i = start; i < children.length; i++) {
            if (bodyTypes.includes(children[i].type)) { thenNode = children[i]; break; }
        }
    }
    if (thenNode) {
        return {
            condition,
            thenNodes: statementNodes(thenNode, profile),
            alternatives: children.slice(children.indexOf(thenNode) + 1),
        };
    }
    // Bash has no statement block: statements sit directly between the condition and elif/else.
    let altStart = -1;
    for (let i = start; i < children.length; i++) {
        if (isIfLike(children[i], profile)
            || (profile.elseWrapperTypes && profile.elseWrapperTypes.includes(children[i].type))) {
            altStart = i;
            break;
        }
    }
    return {
        condition,
        thenNodes: children.slice(start, altStart < 0 ? children.length : altStart),
        alternatives: altStart < 0 ? [] : children.slice(altStart),
    };
}

function measurePositionalIf(node: Parser.SyntaxNode, nesting: number, elseIf: boolean, ctx: MeasureContext): void {
    const p = ctx.profile;
    ctx.cognitive += elseIf ? 1 : 1 + nesting;
    ctx.cyclomatic += 1;
    recordOperator(ctx, elseIf ? 'else if' : 'if');

    const parts = positionalIfParts(node, p);
    if (parts.condition) measureNode(parts.condition, nesting, false, ctx);
    walkMeasuredStatements(parts.thenNodes, nesting + 1, ctx);

    for (const alt of parts.alternatives) {
        const innerIf = findSingleIf(alt, p);
        if (innerIf) {
            measurePositionalIf(innerIf, nesting, true, ctx);
            continue;
        }
        if (bodyIsMeaningful(alt, p)) {
            ctx.cognitive += 1;
            recordOperator(ctx, 'else');
        }
        const body = bodyNode(alt, p.bodyField, p) || alt;
        walkMeasuredBody(body, nesting + 1, ctx);
    }
}

function measureIf(node: Parser.SyntaxNode, nesting: number, elseIf: boolean, ctx: MeasureContext): void {
    const p = ctx.profile;
    if (p.ifPositional) {
        measurePositionalIf(node, nesting, elseIf, ctx);
        return;
    }
    ctx.cognitive += elseIf ? 1 : 1 + nesting;
    ctx.cyclomatic += 1;
    recordOperator(ctx, elseIf ? 'else if' : 'if');

    const condition = p.ifCondField ? node.childForFieldName(p.ifCondField) : null;
    if (condition) measureNode(condition, nesting, false, ctx);

    walkMeasuredBody(bodyNode(node, p.ifThenField, p), nesting + 1, ctx);

    for (const alt of alternativeNodes(node, p)) {
        if (alt.type === p.ifNode || (p.elseIfTypes && p.elseIfTypes.includes(alt.type))) {
            measureIf(alt, nesting, true, ctx);
            continue;
        }
        if (p.elseWrapperTypes && p.elseWrapperTypes.includes(alt.type)) {
            // JS wraps `else if` in an else_clause; an inner if is still an else-if.
            let innerIf: Parser.SyntaxNode | null = null;
            for (let i = 0; i < alt.namedChildCount; i++) {
                const child = alt.namedChild(i);
                if (child && (child.type === p.ifNode || (p.elseIfTypes && p.elseIfTypes.includes(child.type)))) {
                    innerIf = child;
                    break;
                }
            }
            if (innerIf) {
                measureIf(innerIf, nesting, true, ctx);
                continue;
            }
            if (bodyIsMeaningful(alt, p)) {
                ctx.cognitive += 1;
                recordOperator(ctx, 'else');
            }
            walkMeasuredBody(bodyNode(alt, p.bodyField, p), nesting + 1, ctx);
            continue;
        }
        if (bodyIsMeaningful(alt, p)) {
            ctx.cognitive += 1;
            recordOperator(ctx, 'else');
        }
        walkMeasuredBody(alt, nesting + 1, ctx);
    }
}

function measureNode(node: Parser.SyntaxNode, nesting: number, inLogical: boolean, ctx: MeasureContext): void {
    const p = ctx.profile;

    // Nested functions and opaque scopes belong to their own metric.
    if (p.functions.includes(node.type)) return;
    if (p.scopeOnly && p.scopeOnly.includes(node.type)) return;

    if (node.type === p.ifNode || (p.elseIfTypes && p.elseIfTypes.includes(node.type))) {
        measureIf(node, nesting, !!(p.elseIfTypes && p.elseIfTypes.includes(node.type)), ctx);
        return;
    }

    for (const spec of p.loops) {
        if (node.type !== spec.node) continue;
        ctx.cognitive += 1 + nesting;
        ctx.cyclomatic += 1;
        recordOperator(ctx, spec.label);
        const loopBody = bodyNode(node, p.loopBodyField, p);
        if (spec.headerFields && spec.headerFields.length > 0) {
            for (const field of spec.headerFields) {
                const header = node.childForFieldName(field);
                if (header) measureNode(header, nesting, false, ctx);
            }
        } else {
            for (let i = 0; i < node.namedChildCount; i++) {
                const child = node.namedChild(i);
                if (child && !sameNode(child, loopBody)) measureNode(child, nesting, false, ctx);
            }
        }
        walkMeasuredBody(loopBody, nesting + 1, ctx);
        return;
    }

    if (p.switchNode && node.type === p.switchNode) {
        ctx.cognitive += 1 + nesting;
        ctx.cyclomatic += 1;
        recordOperator(ctx, 'switch');
        const value = p.switchValueField ? node.childForFieldName(p.switchValueField) : null;
        if (value) measureNode(value, nesting, false, ctx);
        if (p.switchCaseTypes) {
            const body = bodyNode(node, 'body', p);
            const container = body || node;
            for (let i = 0; i < container.namedChildCount; i++) {
                const child = container.namedChild(i);
                if (!child || !p.switchCaseTypes.includes(child.type)) continue;
                ctx.cognitive += 1;
                ctx.cyclomatic += 1;
                recordOperator(ctx, 'case');
                measureNode(child, nesting + 1, false, ctx);
            }
        }
        return;
    }

    if (p.tryNode && node.type === p.tryNode) {
        recordOperator(ctx, 'try');
        let tryBody = p.tryBodyField ? node.childForFieldName(p.tryBodyField) : null;
        if (!tryBody) {
            for (const child of namedChildren(node)) {
                if (p.blockTypes.includes(child.type)) { tryBody = child; break; }
            }
        }
        walkMeasuredBody(tryBody, nesting, ctx);
        for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (!child) continue;
            if (p.catchTypes && p.catchTypes.includes(child.type)) {
                ctx.cognitive += 1 + nesting;
                ctx.cyclomatic += 1;
                recordOperator(ctx, 'catch');
                if (p.catchParamField) {
                    const param = child.childForFieldName(p.catchParamField);
                    if (param) measureNode(param, nesting, false, ctx);
                }
                walkMeasuredBody(bodyNode(child, 'body', p), nesting + 1, ctx);
            } else if (p.finallyTypes && p.finallyTypes.includes(child.type)) {
                recordOperator(ctx, 'finally');
                walkMeasuredBody(bodyNode(child, p.finallyBodyField || 'body', p), nesting, ctx);
            }
        }
        return;
    }

    if (p.ternaryNode && node.type === p.ternaryNode) {
        ctx.cognitive += 1 + nesting;
        ctx.cyclomatic += 1;
        recordOperator(ctx, '?:');
        for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (child) measureNode(child, nesting + 1, false, ctx);
        }
        return;
    }

    if (isLogicalNode(node, p)) {
        if (!inLogical) {
            const operators: string[] = [];
            collectLogicalOperators(node, p, operators);
            let runs = 0;
            let previous = '';
            for (const op of operators) {
                if (op !== previous) runs++;
                previous = op;
                recordOperator(ctx, op);
            }
            ctx.cognitive += runs;
            ctx.cyclomatic += operators.length;
        }
        for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (child) measureNode(child, nesting, true, ctx);
        }
        return;
    }

    // Generic token accounting for Halstead / McCabe.
    const operator = directOperator(node, p);
    if (operator) recordOperator(ctx, operator);
    else if (node.type.indexOf('assignment') !== -1) recordOperator(ctx, '=');
    if (p.callNode && node.type === p.callNode) recordOperator(ctx, '()');
    if (node.type.indexOf('member_expression') !== -1 || node.type.indexOf('field_expression') !== -1) {
        recordOperator(ctx, '.');
    }
    if (node.type.indexOf('subscript') !== -1 || node.type.indexOf('index_expression') !== -1) {
        recordOperator(ctx, '[]');
    }
    const jump = p.jumps[node.type];
    if (jump) {
        recordOperator(ctx, jump);
        if (jump === 'goto') ctx.cognitive += 1; // explicit jump breaks linear flow
    }
    if (OPERAND_NODE_TYPES.has(node.type)) recordOperand(ctx, node.text);

    for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child) measureNode(child, nesting, false, ctx);
    }
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

function finalizeHalstead(ctx: MeasureContext): HalsteadMetrics {
    const n1 = ctx.operators.size;
    const n2 = ctx.operands.size;
    const N1 = ctx.totalOperators;
    const N2 = ctx.totalOperands;
    const vocabulary = n1 + n2;
    const length = N1 + N2;
    const volume = vocabulary > 0 ? length * Math.log2(vocabulary) : 0;
    const difficulty = n2 > 0 ? (n1 / 2) * (N2 / n2) : 0;
    return {
        distinctOperators: n1,
        distinctOperands: n2,
        totalOperators: N1,
        totalOperands: N2,
        vocabulary,
        length,
        volume: round2(volume),
        difficulty: round2(difficulty),
        effort: round2(volume * difficulty),
        bugs: round2(volume / 3000),
    };
}

/** Maintainability Index (0–100; higher is better). */
function maintainabilityIndex(halstead: HalsteadMetrics, cyclomatic: number, lines: number): number {
    if (halstead.volume <= 0 || lines <= 0) return 100;
    const raw = 171
        - 3.42 * Math.log(halstead.volume)
        - 0.23 * cyclomatic
        - 16.2 * Math.log(lines);
    return Math.round(Math.max(0, Math.min(100, raw * 100 / 171)) * 10) / 10;
}

function metricsForFunctionNode(node: Parser.SyntaxNode, profile: FlowProfile): FunctionMetrics {
    const ctx: MeasureContext = {
        profile,
        cognitive: 0,
        cyclomatic: 1,
        operators: new Set<string>(),
        operands: new Set<string>(),
        totalOperators: 0,
        totalOperands: 0,
    };
    const body = bodyNode(node, profile.bodyField, profile);
    if (body) walkMeasuredBody(body, 0, ctx);
    const halstead = finalizeHalstead(ctx);
    const lines = node.endPosition.row - node.startPosition.row + 1;
    return {
        cognitive: ctx.cognitive,
        cyclomatic: ctx.cyclomatic,
        lines,
        halstead,
        maintainability: maintainabilityIndex(halstead, ctx.cyclomatic, lines),
    };
}

/** Cognitive / Halstead / MI for one function-like AST node. */
export function computeFunctionMetrics(node: Parser.SyntaxNode, language: string): FunctionMetrics | null {
    const profile = cognitiveProfile(language);
    return profile ? metricsForFunctionNode(node, profile) : null;
}

/** Every function-like node in a tree, with its metrics (single AST pass). */
export function collectFunctionMetrics(tree: Parser.Tree, language: string): FunctionMetricEntry[] {
    const profile = cognitiveProfile(language);
    if (!profile) return [];
    const out: FunctionMetricEntry[] = [];
    const visit = (node: Parser.SyntaxNode): void => {
        if (profile.functions.includes(node.type)) {
            out.push({
                name: functionName(node, profile),
                line: line1(node),
                endLine: node.endPosition.row + 1,
                metrics: metricsForFunctionNode(node, profile),
            });
        }
        for (let i = 0; i < node.namedChildCount; i++) {
            const child = node.namedChild(i);
            if (child) visit(child);
        }
    };
    visit(tree.rootNode);
    return out;
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
    const profile = flowProfile(normalizeFlowLanguage(language));
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
        if (n.type === 'identifier' || n.type === 'field_identifier' || n.type === 'property_identifier'
            || n.type === 'simple_identifier') {
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
    const profile = flowProfile(normalizeFlowLanguage(language));
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
        metrics: metricsForFunctionNode(node, profile),
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
