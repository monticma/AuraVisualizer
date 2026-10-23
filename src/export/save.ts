/**
 * save.ts — Unified save/copy helpers for Aura exports.
 *
 * All text/binary exports go through this module so paths, dialogs and
 * notifications stay consistent (V1-11).
 */

import * as vscode from 'vscode';
import * as path from 'path';

export interface SaveTextOptions {
    /** File name used for the `.aura/` default or the save dialog. */
    fileName: string;
    /** Save dialog filters, e.g. `{ Markdown: ['md'] }`. */
    filters?: Record<string, string[]>;
    /** Open a save dialog; false writes directly under `.aura/`. */
    askLocation?: boolean;
    /** Show the "saved" notification (default true). */
    notify?: boolean;
}

function workspaceFolder(): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.workspaceFolders?.[0];
}

async function writeFile(target: vscode.Uri, content: string | Uint8Array): Promise<void> {
    const parent = vscode.Uri.file(path.dirname(target.fsPath));
    await vscode.workspace.fs.createDirectory(parent);
    await vscode.workspace.fs.writeFile(target, typeof content === 'string' ? Buffer.from(content, 'utf-8') : content);
}

async function notifySaved(kind: string, target: vscode.Uri): Promise<void> {
    const relative = vscode.workspace.asRelativePath(target, false);
    const choice = await vscode.window.showInformationMessage(`Aura: ${kind} saved to ${relative}`, 'Open');
    if (choice === 'Open') {
        await vscode.commands.executeCommand('vscode.open', target);
    }
}

async function saveTo(target: vscode.Uri, kind: string, content: string | Uint8Array, notify: boolean): Promise<vscode.Uri> {
    await writeFile(target, content);
    if (notify) await notifySaved(kind, target);
    return target;
}

/** Save text either under `.aura/` (default) or through a save dialog. */
export async function saveText(kind: string, content: string, options: SaveTextOptions): Promise<vscode.Uri | undefined> {
    const ws = workspaceFolder();
    if (!ws) {
        void vscode.window.showWarningMessage('Aura: No workspace folder open.');
        return undefined;
    }
    const defaultUri = options.askLocation
        ? vscode.Uri.joinPath(ws.uri, options.fileName)
        : vscode.Uri.joinPath(ws.uri, '.aura', options.fileName);
    let target = defaultUri;
    if (options.askLocation) {
        const selected = await vscode.window.showSaveDialog({
            defaultUri,
            filters: options.filters,
            saveLabel: 'Save',
        });
        if (!selected) return undefined;
        target = selected;
    }
    return saveTo(target, kind, content, options.notify !== false);
}

/** Copy text to the clipboard with a consistent notification. */
export async function copyText(kind: string, content: string): Promise<void> {
    await vscode.env.clipboard.writeText(content);
    void vscode.window.showInformationMessage(`Aura: ${kind} copied to clipboard`);
}

/** QuickPick between saving to a file and copying to the clipboard. */
export async function saveOrCopyText(
    kind: string,
    content: string,
    fileName: string,
    filters?: Record<string, string[]>,
): Promise<vscode.Uri | undefined> {
    const choice = await vscode.window.showQuickPick(
        [
            { label: '$(save) Save…', description: 'Choose a file name and location', action: 'save' as const },
            { label: '$(clippy) Copy to clipboard', description: 'Paste into a document or chat', action: 'copy' as const },
        ],
        { placeHolder: `Aura: export ${kind}` },
    );
    if (!choice) return undefined;
    if (choice.action === 'copy') {
        await copyText(kind, content);
        return undefined;
    }
    return saveText(kind, content, { fileName, filters, askLocation: true });
}

/** Save binary data (PNG, etc.) through a save dialog. */
export async function saveBinary(
    kind: string,
    data: Uint8Array,
    fileName: string,
    filters?: Record<string, string[]>,
): Promise<vscode.Uri | undefined> {
    const ws = workspaceFolder();
    if (!ws) {
        void vscode.window.showWarningMessage('Aura: No workspace folder open.');
        return undefined;
    }
    const target = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.joinPath(ws.uri, '.aura', fileName),
        filters,
        saveLabel: 'Save',
    });
    if (!target) return undefined;
    return saveTo(target, kind, data, true);
}
