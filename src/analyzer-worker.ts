/**
 * analyzer-worker.ts — Runs the analyzeCodebase pipeline in a worker thread.
 * Receives { rootPath, skipDirs, projectName } and posts back GraphData + files.
 *
 * Also serves on-demand function-flowchart requests:
 * { flowRequest: { filePath, language, line } } → posts back { flow }.
 */

import { parentPort, workerData } from 'worker_threads';
import { readFileSync } from 'fs';
import { scanDirectory } from './analyzer/scanner';
import { buildGraph, preParseFiles } from './analyzer/graph-builder';
import { chunkDocument, type DocChunk } from './analyzer/parsers/doc-parser';
import { parseSource } from './analyzer/tree-sitter-loader';
import { flowProfile, functionFlowAtLine, type FunctionFlow } from './flow/flow-core';
import type { DeadCodeRule } from './analysis/dead-code';

interface WorkerInput {
    rootPath?: string;
    skipDirs?: string[];
    projectName?: string;
    deadCodeRules?: DeadCodeRule[];
    flowRequest?: { filePath: string; language: string; line: number };
}

/** Aura node languages (c-source, cpp-header, …) → tree-sitter grammar ids. */
function normalizeFlowLanguage(language: string): string {
    if (language.indexOf('cpp') === 0) return 'cpp';
    if (language.indexOf('c-') === 0) return 'c';
    return language;
}

/** On-demand: parse a single file and build one function's flow tree. */
async function runFlow(req: { filePath: string; language: string; line: number }): Promise<void> {
    const language = normalizeFlowLanguage(req.language);
    if (!flowProfile(language)) {
        parentPort?.postMessage({ flow: null });
        return;
    }
    const content = readFileSync(req.filePath, 'utf-8');
    const tree = await parseSource(language, content);
    const flow: FunctionFlow | null = functionFlowAtLine(tree, language, req.line);
    parentPort?.postMessage({ flow });
}

async function run(): Promise<void> {
    const input = workerData as WorkerInput;

    if (input.flowRequest) {
        await runFlow(input.flowRequest);
        return;
    }

    const rootPath = input.rootPath || '';
    const skipDirs = input.skipDirs || [];
    const projectName = input.projectName || '';

    parentPort?.postMessage({ progress: { phase: 'scanning', message: 'Scanning files...' } });
    const files = await scanDirectory(rootPath, {
        skipDirs: new Set(skipDirs),
    });

    parentPort?.postMessage({ progress: { phase: 'parsing', message: `Parsing ${files.length} files...` } });
    // Pre-parse files with Tree-sitter where grammar is available. Failures are
    // collected (V2-17) and summarized in meta.parseFailures — never fatal.
    const parseFailures = new Map<string, string>();
    const astTrees = await preParseFiles(files, parseFailures);

    parentPort?.postMessage({ progress: { phase: 'building', message: 'Building dependency graph...' } });
    const graphData = buildGraph(files, projectName, {
        skipDirs: new Set(skipDirs),
        projectName,
        deadCodeRules: input.deadCodeRules || [],
    }, astTrees, parseFailures);

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

    parentPort?.postMessage({
        graphData,
        files,
        docChunks,
        // Full failure list (usually tiny): the host keeps it for incremental edits.
        parseFailures: [...parseFailures.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([path, reason]) => ({ path, reason })),
    });
}

run().catch((err) => {
    parentPort?.postMessage({ error: err instanceof Error ? err.message : String(err) });
});

