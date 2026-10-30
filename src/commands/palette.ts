/**
 * palette.ts — enriched command palette (V3-03).
 *
 * Three navigation gestures that used to require the graph panel UI:
 *   Aura: Focus File…        → QuickPick over the analyzed files
 *   Aura: Apply Saved Query… → QuickPick over the queries saved in GraphDB
 *   Aura: Add Warp Here      → opens the warp naming modal on the live camera
 *
 * The list building lives in `palette-core.ts` (pure, unit-tested); this module
 * only talks to the VS Code UI and to the actions injected by `extension.ts`.
 */

import * as vscode from 'vscode';
import {
    MAX_FILE_ITEMS,
    buildFileQuickPick,
    buildQueryQuickPick,
    type PaletteNode,
    type SavedQueryRow,
} from './palette-core';

export const PALETTE_COMMANDS = {
    focusFile: 'auraVisualizer.focusFileByName',
    applySavedQuery: 'auraVisualizer.applySavedQuery',
    addWarp: 'auraVisualizer.addWarpHere',
} as const;

export interface PaletteActions {
    /** Open / reveal the Aura panel (creates it when missing). */
    revealGraph: () => Promise<void>;
    /** Focus a workspace-relative file in the 3D graph (reveals the detail panel). */
    focusInGraph: (relativePath: string) => void;
    /** Apply a query expression with a filter / highlight / select mode. */
    applyQuery: (expr: string, mode: 'highlight' | 'filter' | 'select') => void;
    /** Open the warp capture modal on the current camera pose. */
    captureWarp: () => void;
}

export interface PaletteProviders {
    /** Nodes of the current graph (empty when nothing was analyzed yet). */
    files: () => ReadonlyArray<PaletteNode>;
    /** Saved queries from GraphDB. */
    queries: () => ReadonlyArray<SavedQueryRow>;
}

export function registerPaletteCommands(actions: PaletteActions, providers: PaletteProviders): vscode.Disposable[] {
    const reveal = async (): Promise<void> => {
        try {
            await actions.revealGraph();
        } catch {
            /* panel creation is best effort — the actions below no-op without it */
        }
    };

    return [
        // ------------------------------------------------------------
        // Aura: Focus File…
        // ------------------------------------------------------------
        vscode.commands.registerCommand(PALETTE_COMMANDS.focusFile, async () => {
            const { items, total, truncated } = buildFileQuickPick(providers.files(), MAX_FILE_ITEMS);
            if (!items.length) {
                void vscode.window.showInformationMessage(
                    'Aura: no analyzed file yet — run the analysis once (Ctrl+Shift+A) so the graph is available.',
                );
                return;
            }
            if (truncated) {
                void vscode.window.setStatusBarMessage(
                    `Aura: picker limited to ${items.length} of ${total} files — type a path fragment to narrow it down.`,
                    4000,
                );
            }
            const pick = await vscode.window.showQuickPick(items, {
                placeHolder: 'Aura: focus a file in the 3D graph',
                matchOnDescription: true,
                matchOnDetail: true,
            });
            if (!pick) return;
            await reveal();
            actions.focusInGraph(pick.nodeId);
        }),

        // ------------------------------------------------------------
        // Aura: Apply Saved Query…
        // ------------------------------------------------------------
        vscode.commands.registerCommand(PALETTE_COMMANDS.applySavedQuery, async () => {
            const items = buildQueryQuickPick(providers.queries());
            if (!items.length) {
                void vscode.window.showInformationMessage(
                    'Aura: no saved query yet — save one from the query bar (💾) and it will show up here.',
                );
                return;
            }
            const pick = await vscode.window.showQuickPick(items, {
                placeHolder: 'Aura: apply a saved query',
                matchOnDescription: true,
                matchOnDetail: true,
            });
            if (!pick) return;
            await reveal();
            actions.applyQuery(pick.expr, pick.mode);
        }),

        // ------------------------------------------------------------
        // Aura: Add Warp Here
        // ------------------------------------------------------------
        vscode.commands.registerCommand(PALETTE_COMMANDS.addWarp, async () => {
            // The camera lives in the webview: opening the panel is what makes
            // "here" meaningful. captureWarp() is queued until a graph exists.
            await reveal();
            actions.captureWarp();
        }),
    ];
}
