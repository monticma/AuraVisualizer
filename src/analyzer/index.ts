/**
 * analyzer/index.ts — Main entry point for the code analyzer.
 */

import { scanDirectory, scanSingleFile, scanFileSignatures } from './scanner';
import { buildGraph, preParseFiles } from './graph-builder';
import { basename } from 'path';
import type { GraphData, AnalyzeOptions } from './types';

export async function analyzeCodebase(targetPath: string, options: AnalyzeOptions = {}): Promise<GraphData> {
    const projectName = options.projectName || basename(targetPath);
    const files = await scanDirectory(targetPath, options);
    // Parse failures never drop a node (V2-17): they are collected and summarized
    // in `meta.parseFailures` while the file stays in the graph.
    const failures = new Map<string, string>();
    const astTrees = await preParseFiles(files, failures);
    const graph = buildGraph(files, projectName, options, astTrees, failures);
    return graph;
}

export { scanSingleFile, scanFileSignatures, buildGraph, preParseFiles };
export { rebuildSingleFile, buildIncrementalContext, restoreIncrementalContext, type IncrementalContext } from './graph-builder';
export type { GraphData, GraphNode, GraphLink, GraphMeta, ParseFailure, ParseFailureReport, FileInfo, CommitIndex, CommitDelta } from './types';
export { isGitRepo, getCommitIndex, getFileAtCommit, getFileListAtCommit } from './git-history';
