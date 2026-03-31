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

export interface SymbolInfo {
    name: string;
    type: string;
    returnType?: string;
    params?: string;
    line?: number;
}

export interface FileSymbols {
    functions: SymbolInfo[];
    externs: SymbolInfo[];
    structs: SymbolInfo[];
    enums: SymbolInfo[];
    macros: SymbolInfo[];
    classes: SymbolInfo[];
    exports: SymbolInfo[];
}

export interface NodeSymbols {
    functions: { name: string; returnType: string; params: string; line: number; type: string }[];
    structs: { name: string; type: string }[];
    enums: { name: string; type: string }[];
    macros: { name: string; type: string }[];
    classes: { name: string; type: string }[];
    exports: { name: string; type: string }[];
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
    unresolvedReferences: number;
    unresolvedSamples: { from: string; ref: string }[];
    deadCodeFiles: number;
    deadExportsTotal: number;
    cycles: string[][];
    languageStats: Record<string, LanguageStat>;
    groups: string[];
}

export interface GraphData {
    meta: GraphMeta;
    nodes: GraphNode[];
    links: GraphLink[];
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
// Time Machine — Git History Types
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
    linksOut: { target: string; type: string }[];
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
