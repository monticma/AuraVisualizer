/**
 * graph-builder.js — Aggregates scanner results and parser output into a graph JSON.
 * 
 * Responsibilities:
 * - Run appropriate parser on each file
 * - Resolve relative target paths to match file IDs in the graph
 * - Compute fan-in / fan-out metrics
 * - Produce final { meta, nodes, links } output
 */

import { basename, dirname, join, resolve, normalize } from 'path';
import { CParser } from './parsers/c-parser.js';
import { JSParser } from './parsers/js-parser.js';
import { HTMLParser } from './parsers/html-parser.js';
import { CSSParser } from './parsers/css-parser.js';

/**
 * Registry of parsers, keyed by language.
 * Extensible: add new parsers here for future languages.
 */
const PARSER_REGISTRY = {
    'c': new CParser(),
    'javascript': new JSParser(),
    'html': new HTMLParser(),
    'css': new CSSParser()
};

/**
 * Attempt to resolve a target reference to a file ID in the graph.
 * Tries multiple resolution strategies.
 * 
 * @param {string} target - The raw target from the parser (e.g., "utils.h", "./lib/foo")
 * @param {string} sourceId - The source file's relative path
 * @param {Map<string, Object>} fileMap - Map of id -> fileInfo
 * @returns {string|null} Resolved file ID, or null if not found
 */
function resolveTarget(target, sourceId, fileMap) {
    // Strategy 1: Direct match (target is already a relative path from root)
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

    // Run parsers and collect all relations
    const allRelations = [];
    for (const file of files) {
        const parser = PARSER_REGISTRY[file.language];
        if (parser) {
            const relations = parser.parse(file, options);
            allRelations.push(...relations);
        }
    }

    // Resolve targets and build links
    const links = [];
    const unresolvedCount = { count: 0, targets: [] };

    for (const relation of allRelations) {
        const resolvedTarget = resolveTarget(relation.target, relation.source, fileMap);
        if (resolvedTarget) {
            // Avoid self-links
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

    // Deduplicate links (same source + target + type)
    const linkSet = new Set();
    const uniqueLinks = links.filter(link => {
        const key = `${link.source}|${link.target}|${link.type}`;
        if (linkSet.has(key)) return false;
        linkSet.add(key);
        return true;
    });

    // Compute fan-in / fan-out
    const fanOut = new Map();
    const fanIn = new Map();
    for (const link of uniqueLinks) {
        fanOut.set(link.source, (fanOut.get(link.source) || 0) + 1);
        fanIn.set(link.target, (fanIn.get(link.target) || 0) + 1);
    }

    // Build nodes (without content)
    const nodes = files.map(f => ({
        id: f.id,
        name: f.name,
        path: f.path,
        language: f.language,
        extension: f.extension,
        size: f.size,
        linesOfCode: f.linesOfCode,
        group: f.group,
        fanOut: fanOut.get(f.id) || 0,
        fanIn: fanIn.get(f.id) || 0
    }));

    // Language stats
    const langStats = {};
    for (const node of nodes) {
        if (!langStats[node.language]) {
            langStats[node.language] = { count: 0, totalLOC: 0 };
        }
        langStats[node.language].count++;
        langStats[node.language].totalLOC += node.linesOfCode;
    }

    // Group stats
    const groupSet = new Set(nodes.map(n => n.group));

    return {
        meta: {
            projectName,
            analyzedAt: new Date().toISOString(),
            totalFiles: nodes.length,
            totalLinks: uniqueLinks.length,
            totalRelationsFound: allRelations.length,
            unresolvedReferences: unresolvedCount.count,
            unresolvedSamples: unresolvedCount.targets,
            languageStats: langStats,
            groups: [...groupSet].sort(),
        },
        nodes,
        links: uniqueLinks
    };
}
