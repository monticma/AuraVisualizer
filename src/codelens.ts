/**
 * codelens.ts — Aura CodeLens (V3-01): `⟡ focus · flow · impact` above the
 * symbols of analyzed files.
 *
 * The lens is a **dispatcher**: clicking it opens a quick pick with the three
 * actions (focus in the 3D graph, show the function flowchart, blast radius),
 * so a file with 40 functions shows 40 lenses instead of 120. Each action is
 * also a command of its own (`focusSymbol`, `showSymbolFlow`, `blastSymbol`)
 * so it can be bound to a key or called from another extension.
 *
 * Symbols come from GraphDB (`getNodeDetail`) — a file that was never analyzed
 * shows **no** lens at all. When an analyzed file has no symbol rows (a
 * language whose parser does not extract them) the provider falls back to the
 * editor's document symbols.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import type { GraphDB } from './graph-db';
import {
    LENS_TITLE,
    documentSymbolAnchors,
    lensArguments,
    lensLine,
    selectLensSymbols,
    type LensSymbol,
} from './codelens-core';

export const SYMBOL_COMMANDS = {
    /** Run by the lens itself — opens the action picker. */
    actions: 'auraVisualizer.symbolActions',
    focus: 'auraVisualizer.focusSymbol',
    flow: 'auraVisualizer.showSymbolFlow',
    blast: 'auraVisualizer.blastSymbol',
} as const;

export interface SymbolCommandActions {
    /** Open / reveal the Aura panel (creates it when missing). */
    revealGraph: () => Promise<void>;
    /** Focus a workspace-relative file in the 3D graph. */
    focusInGraph: (relativePath: string) => void;
    /** Run the blast-radius view for a workspace-relative file. */
    blastRadiusInGraph: (relativePath: string) => void;
    /** Open the flowchart of a function (workspace-relative file + 1-based line). */
    openFlow: (relativePath: string, line: number, language: string, name?: string) => void;
}

/** Workspace-relative node id of a document, or undefined when it is outside. */
export function documentNodeId(uri: vscode.Uri): string | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder || uri.scheme !== 'file') return undefined;
    const relativePath = path.relative(folder.uri.fsPath, uri.fsPath);
    if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) return undefined;
    return relativePath.split(path.sep).join('/');
}

export class AuraCodeLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
    private readonly emitter = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses = this.emitter.event;

    constructor(
        private readonly getDb: () => GraphDB | undefined,
        private readonly isEnabled: () => boolean = () => true,
    ) { }

    /** Re-request lenses for every open editor (after an analysis or a setting change). */
    public refresh(): void {
        this.emitter.fire();
    }

    public dispose(): void {
        this.emitter.dispose();
    }

    public async provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken,
    ): Promise<vscode.CodeLens[]> {
        if (token.isCancellationRequested || !this.isEnabled()) return [];
        const fileId = documentNodeId(document.uri);
        if (!fileId) return [];

        const detail = this.readNodeDetail(fileId);
        if (!detail) return []; // never analyzed → no lens at all

        let symbols = selectLensSymbols(detail.symbols);
        if (!symbols.length) symbols = await this.documentSymbolFallback(document);
        if (token.isCancellationRequested || !symbols.length) return [];

        const language = typeof detail.language === 'string' && detail.language
            ? detail.language
            : document.languageId;

        return symbols.map(symbol => new vscode.CodeLens(
            new vscode.Range(lensLine(symbol.line), 0, lensLine(symbol.line), 0),
            {
                title: LENS_TITLE,
                tooltip: `Aura — ${symbol.name} (${symbol.kind}): focus in the graph, open its flowchart or its blast radius`,
                command: SYMBOL_COMMANDS.actions,
                arguments: lensArguments(fileId, symbol, language),
            },
        ));
    }

    private readNodeDetail(fileId: string) {
        const db = this.getDb();
        if (!db || !db.isOpen) return null;
        try {
            return db.getNodeDetail(fileId);
        } catch {
            return null; // DB closed mid-flight — no lens is better than an error
        }
    }

    /** Analyzed file without DB symbols — ask the editor's language service. */
    private async documentSymbolFallback(document: vscode.TextDocument): Promise<LensSymbol[]> {
        try {
            const raw = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri,
            );
            return documentSymbolAnchors(raw);
        } catch {
            return [];
        }
    }
}

/** Register `focusSymbol`, `showSymbolFlow`, `blastSymbol` and the lens dispatcher. */
export function registerSymbolCommands(actions: SymbolCommandActions): vscode.Disposable[] {
    const reveal = async (): Promise<void> => {
        try {
            await actions.revealGraph();
        } catch {
            /* panel creation is best effort — the commands below no-op without it */
        }
    };

    return [
        vscode.commands.registerCommand(SYMBOL_COMMANDS.focus, async (fileId?: string) => {
            if (!fileId) return;
            await reveal();
            actions.focusInGraph(fileId);
        }),

        vscode.commands.registerCommand(SYMBOL_COMMANDS.blast, async (fileId?: string) => {
            if (!fileId) return;
            await reveal();
            actions.blastRadiusInGraph(fileId);
        }),

        vscode.commands.registerCommand(
            SYMBOL_COMMANDS.flow,
            async (fileId?: string, line?: number, language?: string, name?: string) => {
                if (!fileId || typeof line !== 'number' || !(line > 0)) return;
                await reveal();
                actions.openFlow(fileId, line, language || '', name);
            },
        ),

        // The lens itself: one entry point, three actions.
        vscode.commands.registerCommand(
            SYMBOL_COMMANDS.actions,
            async (fileId?: string, name?: string, line?: number, language?: string) => {
                if (!fileId) return;
                const hasLine = typeof line === 'number' && line > 0;
                const picks: Array<{ label: string; description: string; command: string; args: unknown[] }> = [
                    {
                        label: '⟡ Focus in Aura',
                        description: 'Center the 3D graph on this file',
                        command: SYMBOL_COMMANDS.focus,
                        args: [fileId],
                    },
                ];
                if (hasLine) {
                    picks.push({
                        label: '⑂ Show flowchart',
                        description: 'Control flow of this function, built from the AST',
                        command: SYMBOL_COMMANDS.flow,
                        args: [fileId, line, language, name],
                    });
                }
                picks.push({
                    label: '💥 Blast radius',
                    description: 'Every file impacted by this one, colored by depth',
                    command: SYMBOL_COMMANDS.blast,
                    args: [fileId],
                });

                const pick = await vscode.window.showQuickPick(picks, {
                    placeHolder: name ? `Aura — ${name}` : 'Aura: symbol actions',
                });
                if (!pick) return;
                await vscode.commands.executeCommand(pick.command, ...pick.args);
            },
        ),
    ];
}
