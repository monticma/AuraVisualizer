/**
 * Types for the Aura analyzer.
 */

export interface FileInfo {
    id: string;
    name: string;
    path: string;
    fullPath: string;
    language: string;
    extension: string;
    size: number;
    linesOfCode: number;
    lastModified: number;
    group: string;
    content: string;
}

export interface Relation {
    source: string;
    target: string;
    type: string;
    label: string;
    resolvedTarget?: string;
}

/** A function-level call site detected by AST analysis. */
export interface CallSite {
    callerName: string;       // name of the enclosing function (or '<module>' for top-level)
    calleeName: string;       // name of the called function
    line: number;             // line number of the call expression
    isLocal: boolean;         // true if callee is defined in the same file
}

/** A resolved function call, persisted so callers can rebuild the function graph. */
export interface FunctionCallSite {
    callerFile: string;
    callerName: string;
    calleeFile: string;
    calleeName: string;
    callLine: number;
    /** 1.0 local call, 0.8 unique cross-file target, 0.5 ambiguous target. */
    confidence?: number;
}

/** A function participating in a symbol-level cycle. */
export interface SymbolCycleNode {
    file: string;
    name: string;
}

/** One call step of a symbol-level cycle. */
export interface SymbolCycleStep extends FunctionCallSite {
    confidence: number;
}

/** A function→function cycle (direct recursion or mutual recursion). */
export interface SymbolCycle {
    id: number;
    kind: 'recursive' | 'mutual';
    nodes: SymbolCycleNode[];
    edges: SymbolCycleStep[];
    confidence: number;
    ambiguous: boolean;
}

export interface SymbolInfo {
    name: string;
    type: string;
    returnType?: string;
    params?: string;
    line?: number;
    visibility?: 'public' | 'private' | 'protected' | 'internal';
    isStatic?: boolean;
    isAsync?: boolean;
    /** Function metrics (supported Tree-sitter languages only). */
    cognitive?: number;
    cyclomatic?: number;
    functionLines?: number;
    halsteadVolume?: number;
    maintainability?: number;
}

export interface FileSymbols {
    functions: SymbolInfo[];
    externs: SymbolInfo[];
    structs: SymbolInfo[];
    enums: SymbolInfo[];
    macros: SymbolInfo[];
    classes: SymbolInfo[];
    exports: SymbolInfo[];
    interfaces: SymbolInfo[];
    traits: SymbolInfo[];
    typeAliases: SymbolInfo[];
    methods: SymbolInfo[];
}

export interface NodeSymbols {
    functions: { name: string; returnType: string; params: string; line: number; type: string; visibility?: string; isStatic?: boolean; isAsync?: boolean; cognitive?: number; cyclomatic?: number; functionLines?: number; halsteadVolume?: number; maintainability?: number }[];
    structs: { name: string; type: string; line: number }[];
    enums: { name: string; type: string; line: number }[];
    macros: { name: string; type: string; line: number }[];
    classes: { name: string; type: string; line: number }[];
    exports: { name: string; type: string; line: number }[];
    interfaces: { name: string; type: string; line?: number; visibility?: string }[];
    traits: { name: string; type: string; line?: number; visibility?: string }[];
    typeAliases: { name: string; type: string; line?: number; visibility?: string }[];
    methods: { name: string; returnType: string; params: string; line: number; type: string; visibility?: string; isStatic?: boolean; isAsync?: boolean; cognitive?: number; cyclomatic?: number; functionLines?: number; halsteadVolume?: number; maintainability?: number }[];
    totalSymbols: number;
}

export interface ComplexityResult {
    complexity: number;
    details: Record<string, unknown>;
}

export interface GraphNode {
    id: string;
    name: string;
    path: string;
    language: string;
    extension: string;
    size: number;
    linesOfCode: number;
    lastModified: number;
    group: string;
    fanOut: number;
    fanIn: number;
    complexity: number;
    /** Highest cognitive complexity among this file's functions/methods (supported languages). */
    cognitive?: number;
    /** PageRank over the structural file graph (V2-16). */
    pagerank?: number;
    complexityDetails: Record<string, unknown>;
    symbols?: NodeSymbols;
    deadExports?: string[];
    cycleIds?: number[];
}

export interface GraphLink {
    source: string;
    target: string;
    type: string;
    label: string;
    /** Edge confidence: 1.0 exact, 0.9 extension, 0.8 suffix, 0.6 basename, 0.5 ambiguous. */
    confidence?: number;
}

export interface LanguageStat {
    count: number;
    totalLOC: number;
    avgComplexity: number;
}

export interface GraphMeta {
    projectName: string;
    analyzedAt: string;
    totalFiles: number;
    totalLinks: number;
    totalRelationsFound: number;
    functionCallLinks: number;
    heritageLinks: number;
    unresolvedReferences: number;
    unresolvedSamples: { from: string; ref: string }[];
    deadCodeFiles: number;
    deadExportsTotal: number;
    cycles: string[][];
    /** Function-level cycles (V2-03); absent on old databases until re-analysis. */
    symbolCycles?: SymbolCycle[];
    /** Architectural communities (documentation excluded), shared by all surfaces. */
    communities?: GraphCommunity[];
    languageStats: Record<string, LanguageStat>;
    groups: string[];
}

export interface GraphData {
    meta: GraphMeta;
    nodes: GraphNode[];
    links: GraphLink[];
    functionCalls?: FunctionCallSite[];
}

/** An architectural community, computed once from the structural code graph. */
export interface GraphCommunity {
    /** Position in the current snapshot (display/order only). */
    id: number;
    /** Stable content hash of the sorted member files. */
    key: string;
    /** Display label: custom user label when present, otherwise the hub path. */
    label: string;
    /** Automatic label: full path of the highest structural fan-in file. */
    autoLabel: string;
    /** Hub file path (highest structural fan-in, deterministic tie-break). */
    hub: string;
    /** Code files only; documentation is deliberately excluded. */
    files: string[];
    size: number;
    /** User renamed this community. */
    custom?: boolean;
    /** Synthetic bucket for singleton code files. */
    isOthers?: boolean;
}

export interface ScanOptions {
    extensions?: Set<string>;
    skipDirs?: Set<string>;
}

export interface AnalyzeOptions extends ScanOptions {
    projectName?: string;
    includeSystemHeaders?: boolean;
    includeUrls?: boolean;
    includeAssets?: boolean;
}

// ============================================================
// Time Travel — Git History Types
// ============================================================

/** Lightweight commit info from git log */
export interface CommitInfo {
    hash: string;
    date: string;          // ISO 8601
    author: string;
    message: string;
    files: CommitFileChange[];
}

/** A file changed in a commit */
export interface CommitFileChange {
    status: 'A' | 'M' | 'D' | 'R';   // Added, Modified, Deleted, Renamed
    path: string;
    oldPath?: string;                  // for renames
}

/** Full index of all commits (stored in .aura/history/index.json) */
export interface CommitIndex {
    repoRoot: string;
    totalCommits: number;
    scannedCommits: number;
    commits: CommitInfo[];             // newest first
}

/** Snapshot of a single node at a specific commit */
export interface DeltaNodeState {
    id: string;
    linesOfCode: number;
    complexity: number;
    language: string;
    symbols?: NodeSymbols;
    linksOut: { target: string; type: string; confidence?: number }[];
}

/** Delta for a single commit (stored in .aura/history/<hash>.json) */
export interface CommitDelta {
    hash: string;
    date: string;
    message: string;
    author: string;
    added: string[];                   // file IDs added in this commit
    removed: string[];                 // file IDs removed
    modified: Record<string, DeltaNodeState>;  // file ID → full state at this commit
}
