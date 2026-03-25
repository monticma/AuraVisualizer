/**
 * graph-builder.js — Aggregates scanner results and parser output into a graph JSON.
 * 
 * V2 Responsibilities:
 * - Run appropriate parser on each file
 * - Resolve relative target paths to match file IDs
 * - Extract symbols (functions, structs) for explosion mode
 * - Detect cross-file function calls for C files
 * - Compute cyclomatic complexity per file
 * - Compute fan-in / fan-out metrics
 * - Produce final { meta, nodes, links } output
 */

import { basename, dirname, join, resolve, normalize } from 'path';
import { CParser } from './parsers/c-parser.js';
import { JSParser } from './parsers/js-parser.js';
import { HTMLParser } from './parsers/html-parser.js';
import { CSSParser } from './parsers/css-parser.js';
import { computeComplexity } from './complexity.js';

/**
 * Registry of parsers, keyed by language.
 */
const PARSER_REGISTRY = {
    'c': new CParser(),
    'javascript': new JSParser(),
    'html': new HTMLParser(),
    'css': new CSSParser()
};

/**
 * Attempt to resolve a target reference to a file ID in the graph.
 */
function resolveTarget(target, sourceId, fileMap) {
    // Strategy 1: Direct match
    if (fileMap.has(target)) return target;

    // Strategy 2: Resolve relative to source file's directory
    const sourceDir = dirname(sourceId);
    const relativePath = normalize(join(sourceDir, target));
    if (fileMap.has(relativePath)) return relativePath;

    // Strategy 3: Try adding common extensions
    const extensions = ['.js', '.c', '.h', '.css', '.html'];
    for (const ext of extensions) {
        if (fileMap.has(relativePath + ext)) return relativePath + ext;
        if (fileMap.has(target + ext)) return target + ext;
    }

    // Strategy 4: Try index files (for JS directories)
    const indexPath = join(relativePath, 'index.js');
    if (fileMap.has(indexPath)) return indexPath;

    // Strategy 5: Search by basename anywhere in the project
    const targetBasename = basename(target);
    for (const [id, file] of fileMap) {
        if (file.name === targetBasename) return id;
    }

    // Strategy 6: Search by basename with extension added
    for (const ext of extensions) {
        const nameWithExt = targetBasename + ext;
        for (const [id, file] of fileMap) {
            if (file.name === nameWithExt) return id;
        }
    }

    return null;
}

/**
 * Build the complete graph from scanned files.
 * 
 * @param {Array<Object>} files - Array of file infos from scanner
 * @param {string} projectName - Name of the project
 * @param {Object} options - Analysis options
 * @returns {Object} Graph object with { meta, nodes, links }
 */
export function buildGraph(files, projectName = 'Project', options = {}) {
    // Build file lookup map
    const fileMap = new Map();
    for (const file of files) {
        fileMap.set(file.id, file);
    }

    // ================================================================
    // Phase 1: Parse include/import relations
    // ================================================================
    const allRelations = [];
    for (const file of files) {
        const parser = PARSER_REGISTRY[file.language];
        if (parser) {
            const relations = parser.parse(file, options);
            allRelations.push(...relations);
        }
    }

    // ================================================================
    // Phase 2: Extract symbols for C/H files (functions, structs, etc.)
    // ================================================================
    const cParser = PARSER_REGISTRY['c'];
    const fileSymbols = new Map(); // fileId -> symbols
    const globalFunctionIndex = new Map(); // functionName -> [fileId, ...]

    for (const file of files) {
        if (file.language === 'c') {
            const symbols = cParser.extractSymbols(file);
            fileSymbols.set(file.id, symbols);

            // Index function definitions globally
            for (const func of symbols.functions) {
                if (!globalFunctionIndex.has(func.name)) {
                    globalFunctionIndex.set(func.name, []);
                }
                globalFunctionIndex.get(func.name).push(file.id);
            }
        }
    }

    // ================================================================
    // Phase 3: Detect cross-file function calls
    // ================================================================
    const functionCallLinks = [];

    for (const file of files) {
        if (file.language === 'c' && file.extension === '.c') {
            const calls = cParser.extractCalls(file);
            const ownSymbols = fileSymbols.get(file.id);
            const ownFunctions = new Set(
                ownSymbols ? ownSymbols.functions.map(f => f.name) : []
            );

            for (const callName of calls) {
                // Skip if it's a call to a function defined in the same file
                if (ownFunctions.has(callName)) continue;

                // Find which file(s) define this function
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

    // ================================================================
    // Phase 4: Compute cyclomatic complexity per file
    // ================================================================
    const complexityMap = new Map();
    for (const file of files) {
        const result = computeComplexity(file);
        complexityMap.set(file.id, result);
    }

    // ================================================================
    // Phase 5: Resolve targets and build links
    // ================================================================
    const links = [];
    const unresolvedCount = { count: 0, targets: [] };

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
                unresolvedCount.targets.push({
                    from: relation.source,
                    ref: relation.target
                });
            }
        }
    }

    // Add function call links (already resolved)
    links.push(...functionCallLinks);

    // Deduplicate links (same source + target + type)
    const linkSet = new Set();
    const uniqueLinks = links.filter(link => {
        const key = `${link.source}|${link.target}|${link.type}`;
        if (linkSet.has(key)) return false;
        linkSet.add(key);
        return true;
    });

    // ================================================================
    // Phase 6: Compute fan-in / fan-out
    // ================================================================
    const fanOut = new Map();
    const fanIn = new Map();
    for (const link of uniqueLinks) {
        fanOut.set(link.source, (fanOut.get(link.source) || 0) + 1);
        fanIn.set(link.target, (fanIn.get(link.target) || 0) + 1);
    }

    // ================================================================
    // Phase 7: Build nodes with all metrics
    // ================================================================
    const nodes = files.map(f => {
        const symbols = fileSymbols.get(f.id);
        const cmplx = complexityMap.get(f.id) || { complexity: 1, details: {} };

        const node = {
            id: f.id,
            name: f.name,
            path: f.path,
            language: f.language,
            extension: f.extension,
            size: f.size,
            linesOfCode: f.linesOfCode,
            group: f.group,
            fanOut: fanOut.get(f.id) || 0,
            fanIn: fanIn.get(f.id) || 0,
            complexity: cmplx.complexity,
            complexityDetails: cmplx.details
        };

        // Add symbols for explosion mode (only for C files that have them)
        if (symbols) {
            node.symbols = {
                functions: symbols.functions.map(fn => ({
                    name: fn.name,
                    returnType: fn.returnType,
                    params: fn.params,
                    line: fn.line,
                    type: fn.type
                })),
                structs: symbols.structs.map(s => ({ name: s.name, type: s.type })),
                enums: symbols.enums.map(e => ({ name: e.name, type: e.type })),
                macros: symbols.macros.slice(0, 30), // Limit macro count per file
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
    const langStats = {};
    for (const node of nodes) {
        if (!langStats[node.language]) {
            langStats[node.language] = { count: 0, totalLOC: 0, avgComplexity: 0 };
        }
        langStats[node.language].count++;
        langStats[node.language].totalLOC += node.linesOfCode;
        langStats[node.language].avgComplexity += node.complexity;
    }
    // Compute avg complexity per language
    for (const lang in langStats) {
        langStats[lang].avgComplexity = Math.round(
            langStats[lang].avgComplexity / langStats[lang].count * 10
        ) / 10;
    }

    // Group stats
    const groupSet = new Set(nodes.map(n => n.group));

    // Function call stats
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
