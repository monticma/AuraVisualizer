/**
 * graph-builder.ts — Aggregates scanner results and parser output into a graph.
 */

import { basename, dirname, join, normalize } from 'path';
import { CParser } from './parsers/c-parser';
import { JSParser } from './parsers/js-parser';
import { HTMLParser } from './parsers/html-parser';
import { CSSParser } from './parsers/css-parser';
import { TSParser } from './parsers/ts-parser';
import { PyParser } from './parsers/py-parser';
import { computeComplexity } from './complexity';
import type { BaseParser } from './parsers/base-parser';
import type { FileInfo, Relation, GraphData, GraphNode, GraphLink, AnalyzeOptions, FileSymbols } from './types';

const PARSER_REGISTRY: Record<string, BaseParser> = {
    'c': new CParser(),
    'javascript': new JSParser(),
    'typescript': new TSParser(),
    'python': new PyParser(),
    'html': new HTMLParser(),
    'css': new CSSParser()
};

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

export function buildGraph(files: FileInfo[], projectName: string = 'Project', options: AnalyzeOptions = {}): GraphData {
    const fileMap = new Map<string, FileInfo>();
    for (const file of files) {
        fileMap.set(file.id, file);
    }

    // Phase 1: Parse relations
    const allRelations: Relation[] = [];
    for (const file of files) {
        const parser = PARSER_REGISTRY[file.language];
        if (parser) {
            const relations = parser.parse(file, options as Record<string, unknown>);
            allRelations.push(...relations);
        }
    }

    // Phase 2: Extract symbols for C/H files
    const cParser = PARSER_REGISTRY['c'] as CParser;
    const fileSymbols = new Map<string, FileSymbols>();
    const globalFunctionIndex = new Map<string, string[]>();

    for (const file of files) {
        if (file.language === 'c') {
            const symbols = cParser.extractSymbols(file);
            fileSymbols.set(file.id, symbols);

            for (const func of symbols.functions) {
                if (!globalFunctionIndex.has(func.name)) {
                    globalFunctionIndex.set(func.name, []);
                }
                globalFunctionIndex.get(func.name)!.push(file.id);
            }
        }
    }

    // Phase 3: Detect cross-file function calls
    const functionCallLinks: GraphLink[] = [];

    for (const file of files) {
        if (file.language === 'c' && file.extension === '.c') {
            const calls = cParser.extractCalls(file);
            const ownSymbols = fileSymbols.get(file.id);
            const ownFunctions = new Set(
                ownSymbols ? ownSymbols.functions.map(f => f.name) : []
            );

            for (const callName of calls) {
                if (ownFunctions.has(callName)) continue;

                const definedIn = globalFunctionIndex.get(callName);
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

    // Phase 7: Build nodes
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
                    type: fn.type
                })),
                structs: symbols.structs.map(s => ({ name: s.name, type: s.type })),
                enums: symbols.enums.map(e => ({ name: e.name, type: e.type })),
                macros: symbols.macros.slice(0, 30),
                totalSymbols:
                    symbols.functions.length +
                    symbols.structs.length +
                    symbols.enums.length +
                    symbols.macros.length
            };
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
            languageStats: langStats,
            groups: [...groupSet].sort(),
        },
        nodes,
        links: uniqueLinks
    };
}
