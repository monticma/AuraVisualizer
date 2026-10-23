/**
 * navigation.ts — VS Code commands used by @aura response buttons.
 */

import * as vscode from 'vscode';
import { existsSync } from 'fs';
import { resolveNavigationPath } from './navigation-core';

export interface NavigationActions {
    /** Open/reveal the Aura graph. */
    revealGraph: () => Promise<void>;
    /** Focus a workspace-relative file in the 3D graph. */
    focusInGraph: (relativePath: string) => void;
    /** Run the blast-radius view for a workspace-relative file. */
    blastRadiusInGraph: (relativePath: string) => void;
}

function workspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

/** Open a file in the editor, optionally at a 1-based line. */
export async function openFileAt(filePath: string | undefined, line?: number): Promise<void> {
    if (!filePath) return;
    const target = resolveNavigationPath(filePath, workspaceRoot());
    if (!target) return;
    if (!existsSync(target.absolutePath)) {
        void vscode.window.showWarningMessage(`Aura: file not found — ${filePath}`);
        return;
    }
    const lineNumber = typeof line === 'number' && line > 0 ? line : undefined;
    const selection = lineNumber
        ? new vscode.Range(lineNumber - 1, 0, lineNumber - 1, 0)
        : undefined;
    await vscode.window.showTextDocument(vscode.Uri.file(target.absolutePath), {
        preview: true,
        selection,
    });
}

/** Register the commands used by @aura's Focus / Open editor / Blast radius buttons. */
export function registerNavigationCommands(actions: NavigationActions): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('auraVisualizer.focusPath', async (filePath?: string) => {
            await actions.revealGraph();
            const target = resolveNavigationPath(filePath || '', workspaceRoot());
            if (target?.insideWorkspace) actions.focusInGraph(target.relativePath);
        }),
        vscode.commands.registerCommand('auraVisualizer.openFileAt', (filePath?: string, line?: number) => openFileAt(filePath, line)),
        vscode.commands.registerCommand('auraVisualizer.blastRadiusPath', async (filePath?: string) => {
            await actions.revealGraph();
            const target = resolveNavigationPath(filePath || '', workspaceRoot());
            if (target?.insideWorkspace) actions.blastRadiusInGraph(target.relativePath);
        }),
    ];
}
