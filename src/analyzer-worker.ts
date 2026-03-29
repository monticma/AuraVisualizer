/**
 * analyzer-worker.ts — Runs the analyzeCodebase pipeline in a worker thread.
 * Receives { rootPath, skipDirs, projectName } and posts back GraphData + files.
 */

import { parentPort, workerData } from 'worker_threads';
import { scanDirectory } from './analyzer/scanner';
import { buildGraph } from './analyzer/graph-builder';

interface WorkerInput {
    rootPath: string;
    skipDirs: string[];
    projectName: string;
}

async function run(): Promise<void> {
    const { rootPath, skipDirs, projectName } = workerData as WorkerInput;

    const files = await scanDirectory(rootPath, {
        skipDirs: new Set(skipDirs),
    });

    const graphData = buildGraph(files, projectName, {
        skipDirs: new Set(skipDirs),
        projectName,
    });

    parentPort?.postMessage({ graphData, files });
}

run().catch((err) => {
    parentPort?.postMessage({ error: err instanceof Error ? err.message : String(err) });
});
