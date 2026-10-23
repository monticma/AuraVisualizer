/**
 * ask-aura.ts — "Ask Aura" commands used by the Aura panel and explorer.
 *
 * Aura never hosts its own chat: these commands forward the current view
 * context to VS Code Chat and let the `@aura` participant answer.
 */

import * as vscode from 'vscode';
import { setAuraViewContext, type AuraViewContext } from '../chat/context';

export interface AskAuraOptions {
    prompt?: string;
    context?: AuraViewContext;
}

/** Open VS Code Chat with `@aura` and an optional view context. */
export async function askAura(options?: AskAuraOptions): Promise<void> {
    setAuraViewContext(options?.context);
    const prompt = options?.prompt?.trim() || 'What should I know about this view?';
    const query = prompt.startsWith('@aura') ? prompt : `@aura ${prompt}`;
    try {
        await vscode.commands.executeCommand('workbench.action.chat.open', { query });
    } catch {
        void vscode.window.showInformationMessage('Open VS Code Chat and mention @aura to ask about this codebase.');
    }
}

interface AuraTreeItemLike {
    entry?: {
        kind?: string;
        node?: { path?: string };
    };
}

export function registerAskAuraCommands(): vscode.Disposable[] {
    return [
        vscode.commands.registerCommand('auraVisualizer.askAura', (options?: AskAuraOptions) => askAura(options)),
        vscode.commands.registerCommand('auraVisualizer.askAuraForTreeItem', (item?: AuraTreeItemLike) => {
            const entry = item?.entry;
            const filePath = entry?.kind === 'file' ? entry.node?.path : undefined;
            if (!filePath) return;
            return askAura({
                prompt: `Explain ${filePath}: its role, dependencies, dependents, symbols and risk. Use at most 3 Aura tools, then write the answer and cite files.`,
                context: { selection: filePath, tab: 'explorer' },
            });
        }),
    ];
}
