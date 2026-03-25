/**
 * analyzer/index.js — Main entry point for the code analyzer.
 * 
 * Orchestrates scanning and graph building.
 * Used both by the server API and by the CLI.
 */

import { scanDirectory } from './scanner.js';
import { buildGraph } from './graph-builder.js';
import { basename } from 'path';

/**
 * Analyze a codebase at the given path.
 * 
 * @param {string} targetPath - Absolute path to the directory to analyze
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} The graph object { meta, nodes, links }
 */
export async function analyzeCodebase(targetPath, options = {}) {
    const projectName = options.projectName || basename(targetPath);

    console.log(`[analyzer] Scanning: ${targetPath}`);
    const startTime = Date.now();

    const files = await scanDirectory(targetPath, options);
    console.log(`[analyzer] Found ${files.length} files`);

    const graph = buildGraph(files, projectName, options);
    const elapsed = Date.now() - startTime;

    console.log(`[analyzer] Analysis complete in ${elapsed}ms`);
    console.log(`[analyzer] ${graph.meta.totalFiles} files, ${graph.meta.totalLinks} links`);
    console.log(`[analyzer] ${graph.meta.unresolvedReferences} unresolved references`);

    return graph;
}
