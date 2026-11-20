/**
 * import-metrics.ts — "Aura: Import Metrics…".
 *
 * The only entry point that writes `.aura/metrics.json`. It is deliberately
 * talkative: the mapping between the file's paths and the graph's node ids is
 * the fragile part, so the user always sees how many paths were read, matched
 * (exactly or after normalisation), left out of scope, or simply unknown —
 * before anything is written, and again in a Markdown report.
 */

import * as vscode from 'vscode';
import { basename } from 'path';
import { detectAdapters, type MetricAdapter } from '../metrics/adapters';
import {
    mergeImport,
    metricsMarkdown,
    type ImportReport,
    type ImportedMetricsDocument,
} from '../metrics/metrics-core';
import { readMetrics, writeMetrics } from '../metrics/metrics-store';
import { readCurrentHead } from '../git/git-info';

export interface ImportMetricsDeps {
    /** Workspace root; the document is written next to `.aura/graph.db`. */
    root: string;
    /** Node ids of the current graph. Without them, nothing can be matched. */
    nodeIds: string[];
    /** Push the freshly imported columns to the webview. */
    onImported?: () => void;
    /** Show the Markdown report; defaults to a read-only editor tab. */
    showReport?: (markdown: string) => void | Promise<void>;
}

const FILTERS: Record<string, string[]> = {
    'Metrics files': ['info', 'lcov', 'json', 'csv', 'tsv'],
    'lcov': ['info', 'lcov'],
    'JSON': ['json'],
    'CSV': ['csv', 'tsv'],
    'All files': ['*'],
};

/** Open dialog → parse → report → write → push. Returns the report, or null. */
export async function importMetricsCommand(deps: ImportMetricsDeps): Promise<ImportReport | null> {
    if (deps.nodeIds.length === 0) {
        void vscode.window.showWarningMessage(
            'Aura: no analysed graph yet — run "Aura: Visualize Codebase" before importing metrics.',
        );
        return null;
    }

    const picked = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: 'Import',
        defaultUri: vscode.Uri.file(deps.root),
        filters: FILTERS,
    });
    if (!picked || picked.length === 0) return null;

    const file = picked[0];
    let content: string;
    try {
        content = Buffer.from(await vscode.workspace.fs.readFile(file)).toString('utf-8');
    } catch (err) {
        void vscode.window.showErrorMessage(`Aura: cannot read ${basename(file.fsPath)} — ${String(err)}`);
        return null;
    }

    const adapter = await chooseAdapter(file.fsPath, content);
    if (!adapter) return null;

    const parsed = adapter.parse(content);
    const columns = parsed.columns.filter(column => column.key);
    if (columns.length === 0 || Object.keys(parsed.rows).length === 0) {
        void vscode.window.showWarningMessage(
            `Aura: ${basename(file.fsPath)} parsed as ${adapter.id} but contained no metric values.`,
        );
        return null;
    }

    const head = await readCurrentHead(deps.root);
    const { document, report } = mergeImport(readMetrics(deps.root), parsed, {
        root: deps.root,
        knownIds: deps.nodeIds,
        head: head || undefined,
        sourceFile: basename(file.fsPath),
    });

    // Dry run first: an import that matches nothing is worse than no import,
    // because the column would look like "every file unknown".
    if (report.mappedPaths === 0) {
        const markdown = metricsMarkdown(report, document);
        void vscode.window.showWarningMessage(
            `Aura: ${report.inputPaths} paths read but none matched a file in the graph — nothing was written.`,
            'Show report',
        ).then(action => {
            if (action === 'Show report') void showReport(deps, markdown);
        });
        return report;
    }

    writeMetrics(deps.root, document);
    deps.onImported?.();

    const detail = `${report.columns.join(', ')} · ${report.mappedPaths}/${report.inputPaths} paths`
        + `${report.unknownTotal > 0 ? ` · ${report.unknownTotal} unknown` : ''}`
        + `${report.outOfScope > 0 ? ` · ${report.outOfScope} out of scope` : ''}`;
    const action = await vscode.window.showInformationMessage(
        `Aura: imported ${detail} from ${basename(file.fsPath)}.`,
        'Open report',
        'Query it',
    );
    if (action === 'Open report') await showReport(deps, metricsMarkdown(report, document));
    if (action === 'Query it') {
        const key = report.columns[0];
        void vscode.window.showInformationMessage(
            `Try the query palette (Ctrl+K in the graph): ${key} < 80 and cognitive > 40`,
        );
    }
    return report;
}

/** Several adapters can claim a `.json` file — ask, once. */
async function chooseAdapter(filePath: string, content: string): Promise<MetricAdapter | undefined> {
    const candidates = detectAdapters(filePath, content);
    if (candidates.length === 0) {
        void vscode.window.showErrorMessage(`Aura: no importer knows how to read ${basename(filePath)}.`);
        return undefined;
    }
    if (candidates.length === 1) return candidates[0];

    const items = candidates.map(candidate => ({
        label: candidate.label,
        description: candidate.id,
        adapter: candidate,
    }));
    const picked = await vscode.window.showQuickPick(items, {
        title: `Aura: which format is ${basename(filePath)}?`,
        placeHolder: 'The file name is not enough to decide',
    });
    return picked?.adapter;
}

async function showReport(deps: ImportMetricsDeps, markdown: string): Promise<void> {
    if (deps.showReport) {
        await deps.showReport(markdown);
        return;
    }
    const document = await vscode.workspace.openTextDocument({ language: 'markdown', content: markdown });
    await vscode.window.showTextDocument(document, { preview: true });
}

/** Remove the document; the columns disappear from every surface. */
export async function clearImportedMetricsCommand(deps: {
    root: string;
    onCleared?: () => void;
}): Promise<void> {
    const existing = readMetrics(deps.root);
    if (!existing) {
        void vscode.window.showInformationMessage('Aura: no imported metrics to clear.');
        return;
    }
    const keys = existing.columns.map(column => column.key).join(', ');
    const confirm = await vscode.window.showWarningMessage(
        `Aura: remove the imported columns (${keys})? The analysis itself is untouched.`,
        { modal: true },
        'Remove',
    );
    if (confirm !== 'Remove') return;

    const { rmSync } = await import('fs');
    const { metricsFilePath } = await import('../metrics/metrics-store');
    try {
        rmSync(metricsFilePath(deps.root), { force: true });
    } catch (err) {
        void vscode.window.showErrorMessage(`Aura: could not remove the metrics file — ${String(err)}`);
        return;
    }
    deps.onCleared?.();
    void vscode.window.showInformationMessage('Aura: imported columns removed.');
}

/** Re-exported for tests that want to build a document without the dialog. */
export type { ImportedMetricsDocument };
