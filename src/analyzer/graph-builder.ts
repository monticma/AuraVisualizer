/**
 * graph-builder.ts — Aggregates scanner results and parser output into a graph.
 */

import { basename, dirname, join, normalize } from 'path';
import { CParser } from './parsers/c-parser';
import { TreeSitterCParser } from './parsers/ts-c-parser';
import { JSParser } from './parsers/js-parser';
import { HTMLParser } from './parsers/html-parser';
import { CSSParser } from './parsers/css-parser';
import { TSParser } from './parsers/ts-parser';
import { PyParser } from './parsers/py-parser';
import { computeComplexity } from './complexity';
import { hasGrammar, parseSource } from './tree-sitter-loader';
import type { BaseParser } from './parsers/base-parser';
import type Parser from 'web-tree-sitter';
import type { FileInfo, Relation, GraphData, GraphNode, GraphLink, AnalyzeOptions, FileSymbols } from './types';

/** Regex-only parsers (fallback when Tree-sitter unavailable). */
const REGEX_PARSERS: Record<string, BaseParser> = {
    'c': new CParser(),
    'javascript': new JSParser(),
    'typescript': new TSParser(),
    'python': new PyParser(),
    'html': new HTMLParser(),
    'css': new CSSParser()
};

/** Tree-sitter AST parsers (preferred when AST trees are provided). */
const TS_PARSERS: Record<string, BaseParser> = {
    'c': new TreeSitterCParser(),
};

/**
 * Get the best parser for a language.
 * Uses Tree-sitter parser when an AST tree is available, else falls back to regex.
 */
function getParser(language: string, hasAst: boolean): BaseParser | undefined {
    if (hasAst && TS_PARSERS[language]) { return TS_PARSERS[language]; }
    return REGEX_PARSERS[language];
}

/**
 * Pre-parse all files using Tree-sitter where grammar is available.
 * Returns a map of fileId → syntax tree. Call before buildGraph.
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
        const parser = getParser(file.language, !!tree);
        if (parser) {
            const relations = tree && parser.usesTreeSitter
                ? parser.parseAST(tree, file, options as Record<string, unknown>)
                : parser.parse(file, options as Record<string, unknown>);
            allRelations.push(...relations);
        }
    }

    // Phase 2: Extract symbols for all languages
    const fileSymbols = new Map<string, FileSymbols>();
    // Language family scoping: only match calls within compatible language groups
    const LANG_FAMILY: Record<string, string> = {
        'c': 'c', 'javascript': 'js', 'typescript': 'js', 'python': 'py'
    };
    // globalFunctionIndex keyed by "family:funcName" to prevent cross-language false links
    const globalFunctionIndex = new Map<string, string[]>();
    const SYMBOL_LANGUAGES = new Set(['c', 'javascript', 'typescript', 'python']);

    for (const file of files) {
        if (!SYMBOL_LANGUAGES.has(file.language)) continue;
        const tree = astTrees?.get(file.id);
        const parser = getParser(file.language, !!tree);
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
    const functionCallLinks: GraphLink[] = [];
    const HEADER_EXTS = new Set(['.h', '.hpp', '.d.ts']);

    for (const file of files) {
        if (!SYMBOL_LANGUAGES.has(file.language)) continue;
        if (HEADER_EXTS.has(file.extension)) continue;
        const tree = astTrees?.get(file.id);
        const parser = getParser(file.language, !!tree);
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
        for (const callName of calls) {
            if (ownFunctions.has(callName)) continue;

            const key = `${family}:${callName}`;
            const definedIn = globalFunctionIndex.get(key);
            if (definedIn) {
                for (const defFileId of definedIn) {
                    if (defFileId !== file.id) {
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
            unresolvedReferences: unresolvedCount.count,
            unresolvedSamples: unresolvedCount.targets,
            deadCodeFiles,
            deadExportsTotal,
            cycles,
            languageStats: langStats,
            groups: [...groupSet].sort(),
        },
        nodes,
        links: uniqueLinks
    };
}
