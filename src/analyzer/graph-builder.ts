/**
 * graph-builder.ts — Aggregates scanner results and parser output into a graph.
 */

import { basename, dirname, join, normalize } from 'path';
import { TreeSitterCParser } from './parsers/ts-c-parser';
import { TreeSitterJSParser } from './parsers/ts-js-parser';
import { TreeSitterTSParser } from './parsers/ts-ts-parser';
import { TreeSitterPyParser } from './parsers/ts-py-parser';
import { TreeSitterJavaParser } from './parsers/ts-java-parser';
import { TreeSitterGoParser } from './parsers/ts-go-parser';
import { TreeSitterRustParser } from './parsers/ts-rust-parser';
import { TreeSitterKotlinParser } from './parsers/ts-kotlin-parser';
import { TreeSitterRubyParser } from './parsers/ts-ruby-parser';
import { TreeSitterSwiftParser } from './parsers/ts-swift-parser';
import { HTMLParser } from './parsers/html-parser';
import { CSSParser } from './parsers/css-parser';
import { computeComplexity } from './complexity';
import { hasGrammar, parseSource } from './tree-sitter-loader';
import type { BaseParser } from './parsers/base-parser';
import type Parser from 'web-tree-sitter';
import type { FileInfo, Relation, GraphData, GraphNode, GraphLink, AnalyzeOptions, FileSymbols, SymbolInfo, CallSite } from './types';

/** Parser registry — Tree-sitter for languages with WASM grammars, regex for HTML/CSS. */
const PARSERS: Record<string, BaseParser> = {
    'c': new TreeSitterCParser(),
    'javascript': new TreeSitterJSParser(),
    'typescript': new TreeSitterTSParser(),
    'python': new TreeSitterPyParser(),
    'java': new TreeSitterJavaParser(),
    'go': new TreeSitterGoParser(),
    'rust': new TreeSitterRustParser(),
    'kotlin': new TreeSitterKotlinParser(),
    'ruby': new TreeSitterRubyParser(),
    'swift': new TreeSitterSwiftParser(),
    'html': new HTMLParser(),
    'css': new CSSParser()
};

/** Language family scoping: match calls within compatible language groups. */
const LANG_FAMILY: Record<string, string> = {
    'c': 'c', 'javascript': 'js', 'typescript': 'js', 'python': 'py',
    'java': 'java', 'go': 'go', 'rust': 'rust',
    'kotlin': 'kotlin', 'ruby': 'ruby', 'swift': 'swift'
};

const SYMBOL_LANGUAGES = new Set(['c', 'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'kotlin', 'ruby', 'swift']);
const HEADER_EXTS = new Set(['.h', '.hpp', '.d.ts']);

/**
 * Get the parser for a language.
 */
function getParser(language: string): BaseParser | undefined {
    return PARSERS[language];
}

/**
 * Pre-parse all files using Tree-sitter where grammar is available.
 * Parser instances are pooled per language to avoid re-creation overhead.
 */
export async function preParseFiles(files: FileInfo[]): Promise<Map<string, Parser.Tree>> {
    const trees = new Map<string, Parser.Tree>();
    for (const file of files) {
        if (hasGrammar(file.language)) {
            try {
                const tree = await parseSource(file.language, file.content);
                trees.set(file.id, tree);
            } catch {
                // Fall back to regex for this file
            }
        }
    }
    return trees;
}

function resolveTarget(target: string, sourceId: string, fileMap: Map<string, FileInfo>): string | null {
    if (fileMap.has(target)) return target;

    const sourceDir = dirname(sourceId);
    const relativePath = normalize(join(sourceDir, target));
    if (fileMap.has(relativePath)) return relativePath;

    const extensions = ['.js', '.ts', '.py', '.c', '.h', '.css', '.html'];
    for (const ext of extensions) {
        if (fileMap.has(relativePath + ext)) return relativePath + ext;
        if (fileMap.has(target + ext)) return target + ext;
    }

    const indexPath = join(relativePath, 'index.js');
    if (fileMap.has(indexPath)) return indexPath;

    const targetBasename = basename(target);
    for (const [id, file] of fileMap) {
        if (file.name === targetBasename) return id;
    }

    for (const ext of extensions) {
        const nameWithExt = targetBasename + ext;
        for (const [id, file] of fileMap) {
            if (file.name === nameWithExt) return id;
        }
    }

    return null;
}

/**
 * Detect circular dependencies using DFS back-edge detection.
 * Returns arrays of node IDs forming each cycle.
 */
function findCycles(links: GraphLink[]): string[][] {
    // Build adjacency list
    const adj = new Map<string, string[]>();
    for (const link of links) {
        if (!adj.has(link.source)) adj.set(link.source, []);
        adj.get(link.source)!.push(link.target);
    }

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const stack: string[] = [];

    function dfs(node: string): void {
        visited.add(node);
        inStack.add(node);
        stack.push(node);

        const neighbors = adj.get(node) || [];
        for (const next of neighbors) {
            if (inStack.has(next)) {
                // Back-edge: extract cycle from stack
                const cycleStart = stack.indexOf(next);
                if (cycleStart >= 0) {
                    const cycle = stack.slice(cycleStart);
                    // Only keep cycles of 2+ nodes (self-loops are trivial)
                    if (cycle.length >= 2) {
                        cycles.push(cycle);
                    }
                }
            } else if (!visited.has(next)) {
                dfs(next);
            }
        }

        stack.pop();
        inStack.delete(node);
    }

    for (const node of adj.keys()) {
        if (!visited.has(node)) {
            dfs(node);
        }
    }

    // Deduplicate cycles (same set of nodes, different start point)
    const unique: string[][] = [];
    const seen = new Set<string>();
    for (const cycle of cycles) {
        const sorted = [...cycle].sort();
        const key = sorted.join('|');
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(cycle);
        }
    }

    return unique;
}

export function buildGraph(files: FileInfo[], projectName: string = 'Project', options: AnalyzeOptions = {}, astTrees?: Map<string, Parser.Tree>): GraphData {
    const fileMap = new Map<string, FileInfo>();
    for (const file of files) {
        fileMap.set(file.id, file);
    }

    // Phase 1: Parse relations
    const allRelations: Relation[] = [];
    for (const file of files) {
        const tree = astTrees?.get(file.id);
        const parser = getParser(file.language);
        if (parser) {
            const relations = tree && parser.usesTreeSitter
                ? parser.parseAST(tree, file, options as Record<string, unknown>)
                : parser.parse(file, options as Record<string, unknown>);
            allRelations.push(...relations);
        }
    }

    // Phase 2: Extract symbols for all languages
    const fileSymbols = new Map<string, FileSymbols>();
    // globalFunctionIndex keyed by "family:funcName" to prevent cross-language false links
    const globalFunctionIndex = new Map<string, string[]>();

    for (const file of files) {
        if (!SYMBOL_LANGUAGES.has(file.language)) continue;
        const tree = astTrees?.get(file.id);
        const parser = getParser(file.language);
        if (!parser) continue;

        const symbols = tree && parser.usesTreeSitter
            ? parser.extractSymbolsAST(tree, file)
            : (parser as unknown as { extractSymbols(f: FileInfo): FileSymbols }).extractSymbols?.(file);
        if (!symbols) continue;
        fileSymbols.set(file.id, symbols);

        const family = LANG_FAMILY[file.language] || file.language;
        for (const func of symbols.functions) {
            const key = `${family}:${func.name}`;
            if (!globalFunctionIndex.has(key)) {
                globalFunctionIndex.set(key, []);
            }
            globalFunctionIndex.get(key)!.push(file.id);
        }
    }

    // Phase 3: Detect cross-file function calls (within same language family)
    // Build import reachability graph to avoid false links between unrelated files.
    // A function-call link is only created if the caller can reach the callee's
    // definition file (or a header that exposes it) through the import graph.
    const importGraph = new Map<string, Set<string>>();
    for (const rel of allRelations) {
        const resolved = resolveTarget(rel.target, rel.source, fileMap);
        if (!resolved || resolved === rel.source) continue;
        if (!importGraph.has(rel.source)) importGraph.set(rel.source, new Set());
        importGraph.get(rel.source)!.add(resolved);
    }
    // For header-based languages (C/C++), also link a header to the files that include it
    // so we can traverse: caller.c → utils.h → utils.c
    const includedBy = new Map<string, Set<string>>(); // header → set of files that include it
    for (const [src, targets] of importGraph) {
        for (const tgt of targets) {
            const tgtFile = fileMap.get(tgt);
            if (tgtFile && HEADER_EXTS.has(tgtFile.extension)) {
                if (!includedBy.has(tgt)) includedBy.set(tgt, new Set());
                includedBy.get(tgt)!.add(src);
            }
        }
    }

    function isReachableViaImports(source: string, target: string): boolean {
        // Direct import
        if (importGraph.get(source)?.has(target)) return true;
        // Via shared header: source imports header H, and target also imports H
        // or target is the .c paired with a .h that source imports
        const sourceImports = importGraph.get(source);
        if (!sourceImports) return false;
        const targetImports = importGraph.get(target);
        for (const imported of sourceImports) {
            const imp = fileMap.get(imported);
            if (!imp || !HEADER_EXTS.has(imp.extension)) continue;
            // source → header.h, does target also import header.h?
            if (targetImports?.has(imported)) return true;
            // source → header.h, is target the implementation of header.h? (same basename)
            const baseName = imported.replace(/\.[^.]+$/, '');
            if (target.startsWith(baseName + '.')) return true;
        }
        return false;
    }

    const functionCallLinks: GraphLink[] = [];

    for (const file of files) {
        if (!SYMBOL_LANGUAGES.has(file.language)) continue;
        if (HEADER_EXTS.has(file.extension)) continue;
        const tree = astTrees?.get(file.id);
        const parser = getParser(file.language);
        if (!parser) continue;

        let calls: string[];
        if (tree && parser.usesTreeSitter) {
            // AST-based: use extractCallsFromAST for raw call list
            const tsParser = parser as unknown as { extractCallsFromAST(t: Parser.Tree): string[] };
            calls = tsParser.extractCallsFromAST?.(tree) || [];
        } else {
            const regexParser = parser as unknown as { extractCalls(f: FileInfo): string[] };
            calls = regexParser.extractCalls?.(file) || [];
        }
        const ownSymbols = fileSymbols.get(file.id);
        const ownFunctions = new Set(
            ownSymbols ? ownSymbols.functions.map(f => f.name) : []
        );

        const family = LANG_FAMILY[file.language] || file.language;
        const hasHeaders = HEADER_EXTS.size > 0 && (file.language === 'c' || file.language === 'cpp');
        for (const callName of calls) {
            if (ownFunctions.has(callName)) continue;

            const key = `${family}:${callName}`;
            const definedIn = globalFunctionIndex.get(key);
            if (definedIn) {
                for (const defFileId of definedIn) {
                    if (defFileId === file.id) continue;
                    // For C/C++, only link if files are connected via imports
                    if (hasHeaders && !isReachableViaImports(file.id, defFileId)) continue;
                    functionCallLinks.push({
                        source: file.id,
                        target: defFileId,
                        type: 'function-call',
                        label: `${callName}()`
                    });
                }
            }
        }
    }

    // Phase 3a: Collect function-level call sites
    const allCallSites: { callerFile: string; callerName: string; calleeFile: string; calleeName: string; callLine: number }[] = [];
    for (const file of files) {
        if (!SYMBOL_LANGUAGES.has(file.language)) continue;
        if (HEADER_EXTS.has(file.extension)) continue;
        const tree = astTrees?.get(file.id);
        const parser = getParser(file.language);
        if (!tree || !parser?.usesTreeSitter) continue;

        const sites: CallSite[] = parser.extractCallSitesAST(tree, file);
        const family = LANG_FAMILY[file.language] || file.language;

        for (const site of sites) {
            if (site.isLocal) {
                // Intra-file call: callee is in the same file
                allCallSites.push({
                    callerFile: file.id,
                    callerName: site.callerName,
                    calleeFile: file.id,
                    calleeName: site.calleeName,
                    callLine: site.line,
                });
            } else {
                // Cross-file call: resolve callee to target file(s)
                const key = `${family}:${site.calleeName}`;
                const definedIn = globalFunctionIndex.get(key);
                if (definedIn) {
                    for (const defFileId of definedIn) {
                        if (defFileId !== file.id) {
                            allCallSites.push({
                                callerFile: file.id,
                                callerName: site.callerName,
                                calleeFile: defFileId,
                                calleeName: site.calleeName,
                                callLine: site.line,
                            });
                        }
                    }
                }
            }
        }
    }

    // Phase 3b: Extract heritage relations (extends/implements)
    const heritageLinks: GraphLink[] = [];
    // Build symbol → fileId index (classes, interfaces, traits, structs)
    const symbolFileIndex = new Map<string, string>();
    for (const [fileId, symbols] of fileSymbols) {
        for (const cls of symbols.classes) { symbolFileIndex.set(cls.name, fileId); }
        for (const iface of (symbols.interfaces || [])) { symbolFileIndex.set(iface.name, fileId); }
        for (const trait of (symbols.traits || [])) { symbolFileIndex.set(trait.name, fileId); }
        for (const struct of symbols.structs) { symbolFileIndex.set(struct.name, fileId); }
    }

    for (const file of files) {
        const tree = astTrees?.get(file.id);
        if (!tree) continue;
        const parser = getParser(file.language);
        if (!parser) continue;

        const heritageRels = parser.extractHeritageRelations(tree, file);
        for (const rel of heritageRels) {
            // rel.target is a symbol name (e.g. "Base", "ILogger") — resolve to file ID
            const targetFileId = symbolFileIndex.get(rel.target);
            if (targetFileId && targetFileId !== file.id) {
                heritageLinks.push({
                    source: file.id,
                    target: targetFileId,
                    type: rel.type,
                    label: rel.label
                });
            }
        }
    }

    // Phase 4: Compute complexity
    const complexityMap = new Map<string, { complexity: number; details: Record<string, unknown> }>();
    for (const file of files) {
        const result = computeComplexity(file);
        complexityMap.set(file.id, result);
    }

    // Phase 5: Resolve targets and build links
    const links: GraphLink[] = [];
    const unresolvedCount = { count: 0, targets: [] as { from: string; ref: string }[] };

    for (const relation of allRelations) {
        // system-include relations are used for reachability only; skip visible links unless opted in
        if (relation.type === 'system-include' && !options.includeSystemHeaders) continue;
        const resolvedTarget = resolveTarget(relation.target, relation.source, fileMap);
        if (resolvedTarget) {
            if (resolvedTarget !== relation.source) {
                links.push({
                    source: relation.source,
                    target: resolvedTarget,
                    type: relation.type,
                    label: relation.label
                });
            }
        } else {
            unresolvedCount.count++;
            if (unresolvedCount.targets.length < 20) {
                unresolvedCount.targets.push({ from: relation.source, ref: relation.target });
            }
        }
    }

    links.push(...functionCallLinks);
    links.push(...heritageLinks);

    // Deduplicate links
    const linkSet = new Set<string>();
    const uniqueLinks = links.filter(link => {
        const key = `${link.source}|${link.target}|${link.type}`;
        if (linkSet.has(key)) return false;
        linkSet.add(key);
        return true;
    });

    // Phase 6: Compute fan-in / fan-out
    const fanOut = new Map<string, number>();
    const fanIn = new Map<string, number>();
    for (const link of uniqueLinks) {
        fanOut.set(link.source, (fanOut.get(link.source) || 0) + 1);
        fanIn.set(link.target, (fanIn.get(link.target) || 0) + 1);
    }

    // Phase 7: Dead code detection
    // Build set of all function/class names called anywhere in the codebase
    // (including intra-file calls). Simple regex on raw content — false negatives
    // (matches in comments/strings) are acceptable as they only under-report dead code.
    const allCalledNames = new Set<string>();
    const CALL_SCAN_RE = /(?:^|[^.\w])(\w+)\s*\(/gm;
    for (const file of files) {
        let m;
        const re = new RegExp(CALL_SCAN_RE.source, 'gm');
        while ((m = re.exec(file.content)) !== null) {
            allCalledNames.add(m[1]);
        }
    }

    const deadExportsMap = new Map<string, string[]>();
    for (const file of files) {
        const symbols = fileSymbols.get(file.id);
        if (!symbols) continue;

        const dead: string[] = [];

        // Check each defined function: is it called anywhere?
        for (const func of symbols.functions) {
            if (func.name === 'main') continue; // C entry point
            if (func.type === 'dunder') continue; // Python __init__ etc.
            if (!allCalledNames.has(func.name)) {
                dead.push(func.name);
            }
        }

        // Check each defined class
        for (const cls of symbols.classes) {
            if (!allCalledNames.has(cls.name)) {
                dead.push(cls.name);
            }
        }

        // Check JS/TS/Python exports
        for (const exp of symbols.exports) {
            if (!allCalledNames.has(exp.name) && !dead.includes(exp.name)) {
                dead.push(exp.name);
            }
        }

        if (dead.length > 0) {
            deadExportsMap.set(file.id, dead);
        }
    }

    // Phase 8: Build nodes
    const nodes: GraphNode[] = files.map(f => {
        const symbols = fileSymbols.get(f.id);
        const cmplx = complexityMap.get(f.id) || { complexity: 1, details: {} };

        const node: GraphNode = {
            id: f.id,
            name: f.name,
            path: f.path,
            language: f.language,
            extension: f.extension,
            size: f.size,
            linesOfCode: f.linesOfCode,
            lastModified: f.lastModified || 0,
            group: f.group,
            fanOut: fanOut.get(f.id) || 0,
            fanIn: fanIn.get(f.id) || 0,
            complexity: cmplx.complexity,
            complexityDetails: cmplx.details
        };

        if (symbols) {
            node.symbols = {
                functions: symbols.functions.map(fn => ({
                    name: fn.name,
                    returnType: fn.returnType || '',
                    params: fn.params || '',
                    line: fn.line || 0,
                    type: fn.type,
                    visibility: fn.visibility,
                    isStatic: fn.isStatic,
                    isAsync: fn.isAsync
                })),
                structs: symbols.structs.map(s => ({ name: s.name, type: s.type })),
                enums: symbols.enums.map(e => ({ name: e.name, type: e.type })),
                macros: symbols.macros.slice(0, 30),
                classes: symbols.classes.map(c => ({ name: c.name, type: c.type })),
                exports: symbols.exports.map(e => ({ name: e.name, type: e.type })),
                interfaces: (symbols.interfaces || []).map(i => ({ name: i.name, type: i.type })),
                traits: (symbols.traits || []).map(t => ({ name: t.name, type: t.type })),
                typeAliases: (symbols.typeAliases || []).map(ta => ({ name: ta.name, type: ta.type })),
                methods: (symbols.methods || []).map(m => ({
                    name: m.name,
                    returnType: m.returnType || '',
                    params: m.params || '',
                    line: m.line || 0,
                    type: m.type,
                    visibility: m.visibility,
                    isStatic: m.isStatic,
                    isAsync: m.isAsync
                })),
                totalSymbols:
                    symbols.functions.length +
                    symbols.structs.length +
                    symbols.enums.length +
                    symbols.macros.length +
                    symbols.classes.length +
                    symbols.exports.length +
                    (symbols.interfaces || []).length +
                    (symbols.traits || []).length +
                    (symbols.typeAliases || []).length +
                    (symbols.methods || []).length
            };
        }

        const dead = deadExportsMap.get(f.id);
        if (dead && dead.length > 0) {
            node.deadExports = dead;
        }

        return node;
    });

    // Language stats
    const langStats: Record<string, { count: number; totalLOC: number; avgComplexity: number }> = {};
    for (const node of nodes) {
        if (!langStats[node.language]) {
            langStats[node.language] = { count: 0, totalLOC: 0, avgComplexity: 0 };
        }
        langStats[node.language].count++;
        langStats[node.language].totalLOC += node.linesOfCode;
        langStats[node.language].avgComplexity += node.complexity;
    }
    for (const lang in langStats) {
        langStats[lang].avgComplexity = Math.round(
            langStats[lang].avgComplexity / langStats[lang].count * 10
        ) / 10;
    }

    const groupSet = new Set(nodes.map(n => n.group));
    const funcCallCount = uniqueLinks.filter(l => l.type === 'function-call').length;
    const heritageCount = uniqueLinks.filter(l => l.type === 'extends' || l.type === 'implements').length;
    const deadCodeFiles = nodes.filter(n => n.deadExports && n.deadExports.length > 0).length;
    const deadExportsTotal = nodes.reduce((sum, n) => sum + (n.deadExports ? n.deadExports.length : 0), 0);

    // Cycle detection
    const cycles = findCycles(uniqueLinks);

    // Tag nodes with their cycle indices
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    for (let i = 0; i < cycles.length; i++) {
        for (const nodeId of cycles[i]) {
            const node = nodeMap.get(nodeId);
            if (node) {
                if (!node.cycleIds) node.cycleIds = [];
                node.cycleIds.push(i);
            }
        }
    }

    return {
        meta: {
            projectName,
            analyzedAt: new Date().toISOString(),
            totalFiles: nodes.length,
            totalLinks: uniqueLinks.length,
            totalRelationsFound: allRelations.length,
            functionCallLinks: funcCallCount,
            heritageLinks: heritageCount,
            unresolvedReferences: unresolvedCount.count,
            unresolvedSamples: unresolvedCount.targets,
            deadCodeFiles,
            deadExportsTotal,
            cycles,
            languageStats: langStats,
            groups: [...groupSet].sort(),
        },
        nodes,
        links: uniqueLinks,
        functionCalls: allCallSites,
    };
}

// ── Incremental single-file rebuild ────────────────────────────

/** Persistent state for incremental rebuilds, seeded from a full buildGraph(). */
export interface IncrementalContext {
    fileMap: Map<string, FileInfo>;
    globalFunctionIndex: Map<string, string[]>;
    fileSymbols: Map<string, FileSymbols>;
    importGraph: Map<string, Set<string>>; // fileId → set of resolved import targets
}

/**
 * Create an IncrementalContext by running a full buildGraph().
 * Call once at startup, then pass the context to rebuildSingleFile() on each save.
 */
export function buildIncrementalContext(files: FileInfo[], astTrees?: Map<string, Parser.Tree>): IncrementalContext {
    const fileMap = new Map<string, FileInfo>();
    for (const file of files) fileMap.set(file.id, file);

    const globalFunctionIndex = new Map<string, string[]>();
    const fileSymbols = new Map<string, FileSymbols>();

    for (const file of files) {
        if (!SYMBOL_LANGUAGES.has(file.language)) continue;
        const tree = astTrees?.get(file.id);
        const parser = getParser(file.language);
        if (!parser) continue;

        const symbols = tree && parser.usesTreeSitter
            ? parser.extractSymbolsAST(tree, file)
            : (parser as unknown as { extractSymbols(f: FileInfo): FileSymbols }).extractSymbols?.(file);
        if (!symbols) continue;
        fileSymbols.set(file.id, symbols);

        const family = LANG_FAMILY[file.language] || file.language;
        for (const func of symbols.functions) {
            const key = `${family}:${func.name}`;
            if (!globalFunctionIndex.has(key)) globalFunctionIndex.set(key, []);
            globalFunctionIndex.get(key)!.push(file.id);
        }
    }

    return { fileMap, globalFunctionIndex, fileSymbols, importGraph: buildImportGraph(files, fileMap, astTrees) };
}

/** Build import graph: fileId → set of resolved import targets (used for C/C++ reachability). */
function buildImportGraph(files: FileInfo[], fileMap: Map<string, FileInfo>, astTrees?: Map<string, Parser.Tree>): Map<string, Set<string>> {
    const importGraph = new Map<string, Set<string>>();
    for (const file of files) {
        const tree = astTrees?.get(file.id);
        const parser = getParser(file.language);
        if (!parser) continue;
        const rels = tree && parser.usesTreeSitter
            ? parser.parseAST(tree, file, {})
            : parser.parse(file, {});
        for (const rel of rels) {
            const resolved = resolveTarget(rel.target, rel.source, fileMap);
            if (resolved && resolved !== rel.source) {
                if (!importGraph.has(rel.source)) importGraph.set(rel.source, new Set());
                importGraph.get(rel.source)!.add(resolved);
            }
        }
    }
    return importGraph;
}

/**
 * Reconstruct an IncrementalContext from an already-computed GraphData + files array.
 * This avoids re-parsing all files — it rebuilds fileSymbols from GraphNode.symbols
 * and globalFunctionIndex from the function names. O(N) scan, no AST parsing.
 */
export function restoreIncrementalContext(files: FileInfo[], graphData: GraphData): IncrementalContext {
    const fileMap = new Map<string, FileInfo>();
    for (const file of files) fileMap.set(file.id, file);

    const globalFunctionIndex = new Map<string, string[]>();
    const fileSymbols = new Map<string, FileSymbols>();

    for (const node of graphData.nodes) {
        if (!SYMBOL_LANGUAGES.has(node.language)) continue;
        if (!node.symbols) continue;

        // Reconstruct FileSymbols from NodeSymbols
        const ns = node.symbols;
        const symbols: FileSymbols = {
            functions: ns.functions.map(f => ({ name: f.name, type: f.type, returnType: f.returnType, params: f.params, line: f.line, visibility: f.visibility as SymbolInfo['visibility'], isStatic: f.isStatic, isAsync: f.isAsync })),
            methods: (ns.methods || []).map(m => ({ name: m.name, type: m.type, returnType: m.returnType, params: m.params, line: m.line, visibility: m.visibility as SymbolInfo['visibility'], isStatic: m.isStatic, isAsync: m.isAsync })),
            structs: ns.structs.map(s => ({ name: s.name, type: s.type })),
            enums: ns.enums.map(e => ({ name: e.name, type: e.type })),
            macros: (ns.macros || []).map(m => ({ name: m.name, type: m.type })),
            classes: ns.classes.map(c => ({ name: c.name, type: c.type })),
            exports: ns.exports.map(e => ({ name: e.name, type: e.type })),
            interfaces: (ns.interfaces || []).map(i => ({ name: i.name, type: i.type })),
            traits: (ns.traits || []).map(t => ({ name: t.name, type: t.type })),
            typeAliases: (ns.typeAliases || []).map(ta => ({ name: ta.name, type: ta.type })),
            externs: [],
        };
        fileSymbols.set(node.id, symbols);

        const family = LANG_FAMILY[node.language] || node.language;
        for (const func of symbols.functions) {
            const key = `${family}:${func.name}`;
            if (!globalFunctionIndex.has(key)) globalFunctionIndex.set(key, []);
            globalFunctionIndex.get(key)!.push(node.id);
        }
    }

    // Rebuild importGraph from include-type links
    const importGraph = new Map<string, Set<string>>();
    for (const link of graphData.links) {
        if (link.type === 'include' || link.type === 'system-include') {
            if (!importGraph.has(link.source)) importGraph.set(link.source, new Set());
            importGraph.get(link.source)!.add(link.target);
        }
    }

    return { fileMap, globalFunctionIndex, fileSymbols, importGraph };
}

/**
 * Rebuild analysis for a single changed file.
 * Mutates ctx in-place (updates fileMap, globalFunctionIndex, fileSymbols).
 * Dead code detection is skipped (requires scanning all files).
 */
export function rebuildSingleFile(
    file: FileInfo,
    ctx: IncrementalContext,
    astTree?: Parser.Tree,
    options: AnalyzeOptions = {},
): {
    node: GraphNode;
    outEdges: GraphLink[];
    callSites: { callerFile: string; callerName: string; calleeFile: string; calleeName: string; callLine: number }[];
} {
    const { fileMap, globalFunctionIndex, fileSymbols: allFileSymbols } = ctx;

    // Update fileMap
    fileMap.set(file.id, file);

    // Remove old entries for this file from globalFunctionIndex
    const oldSymbols = allFileSymbols.get(file.id);
    if (oldSymbols) {
        const family = LANG_FAMILY[file.language] || file.language;
        for (const func of oldSymbols.functions) {
            const key = `${family}:${func.name}`;
            const arr = globalFunctionIndex.get(key);
            if (arr) {
                const filtered = arr.filter(id => id !== file.id);
                if (filtered.length > 0) globalFunctionIndex.set(key, filtered);
                else globalFunctionIndex.delete(key);
            }
        }
    }

    // Phase 1: Parse relations
    const parser = getParser(file.language);
    const relations: Relation[] = [];
    if (parser) {
        const rels = astTree && parser.usesTreeSitter
            ? parser.parseAST(astTree, file, options as Record<string, unknown>)
            : parser.parse(file, options as Record<string, unknown>);
        relations.push(...rels);
    }

    // Phase 2: Extract symbols and update indexes
    let symbols: FileSymbols | undefined;
    if (SYMBOL_LANGUAGES.has(file.language) && parser) {
        symbols = astTree && parser.usesTreeSitter
            ? parser.extractSymbolsAST(astTree, file)
            : (parser as unknown as { extractSymbols(f: FileInfo): FileSymbols }).extractSymbols?.(file);
    }

    if (symbols) {
        allFileSymbols.set(file.id, symbols);
        const family = LANG_FAMILY[file.language] || file.language;
        for (const func of symbols.functions) {
            const key = `${family}:${func.name}`;
            if (!globalFunctionIndex.has(key)) globalFunctionIndex.set(key, []);
            globalFunctionIndex.get(key)!.push(file.id);
        }
    } else {
        allFileSymbols.delete(file.id);
    }

    // Phase 3: Detect cross-file function calls
    // Update import graph for this file
    const localImportTargets = new Set<string>();
    for (const rel of relations) {
        const resolved = resolveTarget(rel.target, rel.source, fileMap);
        if (resolved && resolved !== rel.source) localImportTargets.add(resolved);
    }
    ctx.importGraph.set(file.id, localImportTargets);

    function isReachableFromFile(target: string): boolean {
        if (localImportTargets.has(target)) return true;
        // Check via shared header using the full import graph
        const targetImports = ctx.importGraph.get(target);
        for (const imported of localImportTargets) {
            const imp = fileMap.get(imported);
            if (!imp || !HEADER_EXTS.has(imp.extension)) continue;
            // target also imports this header?
            if (targetImports?.has(imported)) return true;
            // target is the .c implementation of this .h? (same basename)
            const baseName = imported.replace(/\.[^.]+$/, '');
            if (target.startsWith(baseName + '.')) return true;
        }
        return false;
    }

    const functionCallLinks: GraphLink[] = [];
    if (SYMBOL_LANGUAGES.has(file.language) && !HEADER_EXTS.has(file.extension) && parser) {
        let calls: string[];
        if (astTree && parser.usesTreeSitter) {
            const tsParser = parser as unknown as { extractCallsFromAST(t: Parser.Tree): string[] };
            calls = tsParser.extractCallsFromAST?.(astTree) || [];
        } else {
            const regexParser = parser as unknown as { extractCalls(f: FileInfo): string[] };
            calls = regexParser.extractCalls?.(file) || [];
        }
        const ownFunctions = new Set(symbols ? symbols.functions.map(f => f.name) : []);
        const family = LANG_FAMILY[file.language] || file.language;
        const hasHeaders = file.language === 'c' || file.language === 'cpp';

        for (const callName of calls) {
            if (ownFunctions.has(callName)) continue;
            const key = `${family}:${callName}`;
            const definedIn = globalFunctionIndex.get(key);
            if (definedIn) {
                for (const defFileId of definedIn) {
                    if (defFileId === file.id) continue;
                    if (hasHeaders && !isReachableFromFile(defFileId)) continue;
                    functionCallLinks.push({ source: file.id, target: defFileId, type: 'function-call', label: `${callName}()` });
                }
            }
        }
    }

    // Phase 3a: Collect call sites
    const callSites: { callerFile: string; callerName: string; calleeFile: string; calleeName: string; callLine: number }[] = [];
    if (SYMBOL_LANGUAGES.has(file.language) && !HEADER_EXTS.has(file.extension) && parser && astTree && parser.usesTreeSitter) {
        const sites: CallSite[] = parser.extractCallSitesAST(astTree, file);
        const family = LANG_FAMILY[file.language] || file.language;

        for (const site of sites) {
            if (site.isLocal) {
                callSites.push({ callerFile: file.id, callerName: site.callerName, calleeFile: file.id, calleeName: site.calleeName, callLine: site.line });
            } else {
                const key = `${family}:${site.calleeName}`;
                const definedIn = globalFunctionIndex.get(key);
                if (definedIn) {
                    for (const defFileId of definedIn) {
                        if (defFileId !== file.id) {
                            callSites.push({ callerFile: file.id, callerName: site.callerName, calleeFile: defFileId, calleeName: site.calleeName, callLine: site.line });
                        }
                    }
                }
            }
        }
    }

    // Phase 3b: Heritage relations
    const heritageLinks: GraphLink[] = [];
    if (astTree && parser) {
        const symbolFileIndex = new Map<string, string>();
        for (const [fid, syms] of allFileSymbols) {
            for (const cls of syms.classes) symbolFileIndex.set(cls.name, fid);
            for (const iface of (syms.interfaces || [])) symbolFileIndex.set(iface.name, fid);
            for (const trait of (syms.traits || [])) symbolFileIndex.set(trait.name, fid);
            for (const struct of syms.structs) symbolFileIndex.set(struct.name, fid);
        }
        const heritageRels = parser.extractHeritageRelations(astTree, file);
        for (const rel of heritageRels) {
            const targetFileId = symbolFileIndex.get(rel.target);
            if (targetFileId && targetFileId !== file.id) {
                heritageLinks.push({ source: file.id, target: targetFileId, type: rel.type, label: rel.label });
            }
        }
    }

    // Phase 4: Complexity
    const cmplx = computeComplexity(file);

    // Phase 5: Resolve targets and build outEdges
    const outEdges: GraphLink[] = [];
    for (const rel of relations) {
        if (rel.type === 'system-include' && !options.includeSystemHeaders) continue;
        const resolved = resolveTarget(rel.target, rel.source, fileMap);
        if (resolved && resolved !== rel.source) {
            outEdges.push({ source: rel.source, target: resolved, type: rel.type, label: rel.label });
        }
    }
    outEdges.push(...functionCallLinks);
    outEdges.push(...heritageLinks);

    // Deduplicate
    const linkSet = new Set<string>();
    const uniqueEdges = outEdges.filter(e => {
        const key = `${e.source}|${e.target}|${e.type}`;
        if (linkSet.has(key)) return false;
        linkSet.add(key);
        return true;
    });

    // Build node
    const node: GraphNode = {
        id: file.id,
        name: file.name,
        path: file.path,
        language: file.language,
        extension: file.extension,
        size: file.size,
        linesOfCode: file.linesOfCode,
        lastModified: file.lastModified || 0,
        group: file.group,
        fanOut: uniqueEdges.length,
        fanIn: 0, // Will be recomputed by graphDb.updateFanCounts()
        complexity: cmplx.complexity,
        complexityDetails: cmplx.details,
    };

    if (symbols) {
        node.symbols = {
            functions: symbols.functions.map(fn => ({
                name: fn.name, returnType: fn.returnType || '', params: fn.params || '',
                line: fn.line || 0, type: fn.type, visibility: fn.visibility,
                isStatic: fn.isStatic, isAsync: fn.isAsync,
            })),
            structs: symbols.structs.map(s => ({ name: s.name, type: s.type })),
            enums: symbols.enums.map(e => ({ name: e.name, type: e.type })),
            macros: symbols.macros.slice(0, 30),
            classes: symbols.classes.map(c => ({ name: c.name, type: c.type })),
            exports: symbols.exports.map(e => ({ name: e.name, type: e.type })),
            interfaces: (symbols.interfaces || []).map(i => ({ name: i.name, type: i.type })),
            traits: (symbols.traits || []).map(t => ({ name: t.name, type: t.type })),
            typeAliases: (symbols.typeAliases || []).map(ta => ({ name: ta.name, type: ta.type })),
            methods: (symbols.methods || []).map(m => ({
                name: m.name, returnType: m.returnType || '', params: m.params || '',
                line: m.line || 0, type: m.type, visibility: m.visibility,
                isStatic: m.isStatic, isAsync: m.isAsync,
            })),
            totalSymbols:
                symbols.functions.length + symbols.structs.length + symbols.enums.length +
                symbols.macros.length + symbols.classes.length + symbols.exports.length +
                (symbols.interfaces || []).length + (symbols.traits || []).length +
                (symbols.typeAliases || []).length + (symbols.methods || []).length,
        };
    }

    return { node, outEdges: uniqueEdges, callSites };
}
