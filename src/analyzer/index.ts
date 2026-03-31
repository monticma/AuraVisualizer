/**
 * analyzer/index.ts — Main entry point for the code analyzer.
 */

import { scanDirectory, scanSingleFile } from './scanner';
import { buildGraph } from './graph-builder';
import { basename } from 'path';
import type { GraphData, AnalyzeOptions } from './types';

export async function analyzeCodebase(targetPath: string, options: AnalyzeOptions = {}): Promise<GraphData> {
    const projectName = options.projectName || basename(targetPath);
    const files = await scanDirectory(targetPath, options);
    const graph = buildGraph(files, projectName, options);
    return graph;
}

export { scanSingleFile, buildGraph };
export type { GraphData, GraphNode, GraphLink, GraphMeta, FileInfo, CommitIndex, CommitDelta } from './types';
export { isGitRepo, getCommitIndex, getFileAtCommit, getFileListAtCommit } from './git-history';
