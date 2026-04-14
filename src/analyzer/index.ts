/**
 * analyzer/index.ts — Main entry point for the code analyzer.
 */

import { scanDirectory, scanSingleFile } from './scanner';
import { buildGraph, preParseFiles } from './graph-builder';
import { basename } from 'path';
import type { GraphData, AnalyzeOptions } from './types';

export async function analyzeCodebase(targetPath: string, options: AnalyzeOptions = {}): Promise<GraphData> {
    const projectName = options.projectName || basename(targetPath);
    const files = await scanDirectory(targetPath, options);
    const astTrees = await preParseFiles(files);
    const graph = buildGraph(files, projectName, options, astTrees);
    return graph;
}

export { scanSingleFile, buildGraph, preParseFiles };
export { rebuildSingleFile, buildIncrementalContext, restoreIncrementalContext, type IncrementalContext } from './graph-builder';
export type { GraphData, GraphNode, GraphLink, GraphMeta, FileInfo, CommitIndex, CommitDelta } from './types';
export { isGitRepo, getCommitIndex, getFileAtCommit, getFileListAtCommit } from './git-history';
