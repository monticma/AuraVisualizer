/**
 * analyzer-worker.ts — Runs the analyzeCodebase pipeline in a worker thread.
 * Receives { rootPath, skipDirs, projectName } and posts back GraphData + files.
 */

import { parentPort, workerData } from 'worker_threads';
import { scanDirectory } from './analyzer/scanner';
import { buildGraph, preParseFiles } from './analyzer/graph-builder';
import { chunkDocument, type DocChunk } from './analyzer/parsers/doc-parser';

interface WorkerInput {
    rootPath: string;
    skipDirs: string[];
    projectName: string;
}

async function run(): Promise<void> {
    const { rootPath, skipDirs, projectName } = workerData as WorkerInput;

    parentPort?.postMessage({ progress: { phase: 'scanning', message: 'Scanning files...' } });
    const files = await scanDirectory(rootPath, {
        skipDirs: new Set(skipDirs),
    });

    parentPort?.postMessage({ progress: { phase: 'parsing', message: `Parsing ${files.length} files...` } });
    // Pre-parse files with Tree-sitter where grammar is available
    const astTrees = await preParseFiles(files);

    parentPort?.postMessage({ progress: { phase: 'building', message: 'Building dependency graph...' } });
    const graphData = buildGraph(files, projectName, {
        skipDirs: new Set(skipDirs),
        projectName,
    }, astTrees);

    // Chunk documentation files for the RAG index
    const docChunks: DocChunk[] = [];
    for (const f of files) {
        if (f.language !== 'documentation') continue;
        try {
            const chunks = chunkDocument(f.content, f.id);
            for (const c of chunks) docChunks.push(c);
        } catch {
            // Ignore individual chunking errors — never fail analysis on a single doc
        }
    }

    parentPort?.postMessage({ graphData, files, docChunks });
}

run().catch((err) => {
    parentPort?.postMessage({ error: err instanceof Error ? err.message : String(err) });
});

