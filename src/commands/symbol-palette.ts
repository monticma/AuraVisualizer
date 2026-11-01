/**
 * symbol-palette.ts — "Aura: Find Symbol…" (V3-09).
 *
 * A QuickPick over `GraphDB.searchSymbols`: kind chips as the first rows of the
 * list, live filtering as you type (↑↓ is the QuickPick's own navigation), and
 * a selection that opens the graph, focuses the file, explodes it and marks the
 * exact symbol with a one-shot ripple.
 *
 * The list building lives in `symbol-palette-core.ts` (pure, unit-tested).
 */

import * as vscode from 'vscode';
import {
    MAX_SYMBOL_ITEMS,
    buildKindChips,
    buildSymbolQuickPick,
    type SymbolKindCount,
    type SymbolRow,
} from './symbol-palette-core';

export const SYMBOL_PALETTE_COMMAND = 'auraVisualizer.findSymbol';

export interface SymbolPaletteActions {
    /** Open / reveal the Aura panel (creates it when missing). */
    revealGraph: () => Promise<void>;
    /** Focus a file, explode it and mark one of its symbols. */
    focusSymbolInGraph: (fileId: string, symbolName: string) => void;
}

export interface SymbolPaletteProviders {
    /** Symbol rows for a query (the kind filter is applied by the core). */
    symbols: (query: string, kind: string | undefined, limit: number) => SymbolRow[];
    /** Symbol count per kind, for the chips. */
    kindCounts: (query: string) => SymbolKindCount[];
}

interface SymbolPickItem extends vscode.QuickPickItem {
    symbol?: SymbolRow;
    /** Present on a kind chip (`null` = all kinds). */
    chipKind?: string | null;
}

export function registerSymbolPaletteCommands(
    actions: SymbolPaletteActions,
    providers: SymbolPaletteProviders,
): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand(SYMBOL_PALETTE_COMMAND, () => runSymbolPicker(actions, providers)),
    ];
}

async function runSymbolPicker(actions: SymbolPaletteActions, providers: SymbolPaletteProviders): Promise<void> {
    if (providers.symbols('', undefined, 1).length === 0) {
        void vscode.window.showInformationMessage(
            'Aura: no symbol indexed yet — run the analysis once (Ctrl+Shift+A) so the graph database is filled.',
        );
        return;
    }

    const picker = vscode.window.createQuickPick<SymbolPickItem>();
    picker.title = 'Aura: Find Symbol';
    picker.placeholder = 'Type a symbol name — pick a kind chip to filter';
    picker.matchOnDescription = true;
    picker.matchOnDetail = true;

    let activeKind: string | undefined;

    const refresh = (): void => {
        const query = picker.value;
        const rows = providers.symbols(query, activeKind, MAX_SYMBOL_ITEMS);
        const { items, total, truncated } = buildSymbolQuickPick(rows, {
            query,
            kind: activeKind,
            limit: MAX_SYMBOL_ITEMS,
        });

        const chips: SymbolPickItem[] = buildKindChips(providers.kindCounts(query), activeKind).map(chip => ({
            label: chip.label,
            description: chip.description,
            chipKind: chip.kind ?? null,
        }));

        const list: SymbolPickItem[] = [
            ...chips,
            { label: 'Symbols', kind: vscode.QuickPickItemKind.Separator },
            ...items.map(item => ({
                label: item.label,
                description: item.description,
                detail: item.detail,
                symbol: item.symbol,
            })),
        ];
        if (items.length === 0) {
            list.push({ label: 'No symbol matched', description: 'change the query or pick another kind' });
        }
        picker.items = list;
        picker.title = truncated
            ? `Aura: Find Symbol — first ${items.length} of ${total}`
            : 'Aura: Find Symbol';
    };

    picker.onDidChangeValue(() => refresh());
    picker.onDidAccept(() => {
        const picked = picker.selectedItems[0];
        if (!picked) return;
        if ('chipKind' in picked) {
            activeKind = picked.chipKind ?? undefined;
            refresh();
            return;
        }
        if (!picked.symbol) return;
        const { nodeId, name } = picked.symbol;
        picker.hide();
        void (async () => {
            try {
                await actions.revealGraph();
            } catch {
                /* panel creation is best effort — the focus message is queued */
            }
            actions.focusSymbolInGraph(nodeId, name);
        })();
    });
    picker.onDidHide(() => picker.dispose());

    refresh();
    picker.show();
}
