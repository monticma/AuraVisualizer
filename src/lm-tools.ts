/**
 * lm-tools.ts — registers Aura codebase tools with VS Code's Language Model API
 * (`vscode.lm.tools`). Once registered, any VS Code AI agent (Copilot Chat,
 * etc.) can invoke them to query the analyzed graph.
 *
 * Tool metadata (name, description, input schema) lives in `package.json`
 * under `contributes.languageModelTools` — this module only wires the `invoke`
 * logic. See docs/Ideas/Done/AI-CHAT.md for the full design and
 * docs/Ideas/AIChatStrategy.md for the current AI surface strategy.
 */

import * as vscode from 'vscode';
import type { GraphDB } from './graph-db';
import { runAuraToolAsync } from './ai/tools';
import type { RiskSnapshot } from './risk/risk-service';

type GetDb = () => GraphDB | undefined;

/** Build a tool result from a JSON payload. */
function jsonResult(payload: unknown): vscode.LanguageModelToolResult {
    return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(JSON.stringify(payload, null, 2)),
    ]);
}

/** Tool result when the workspace has not been analyzed yet. */
function notAnalyzedResult(): vscode.LanguageModelToolResult {
    return jsonResult({
        error: 'Aura has not analyzed this workspace yet.',
        hint: 'Run the "Aura: Visualize Codebase" command first, then retry.',
    });
}

/** Register all Aura LM tools. Returns via context.subscriptions. */
export function registerAuraLmTools(
    context: vscode.ExtensionContext,
    getDb: GetDb,
    getRiskSnapshot?: () => RiskSnapshot | undefined,
    getArchitecture?: (input: Record<string, unknown>) => unknown,
): void {
    const register = <T>(name: string, invoke: (input: T) => vscode.ProviderResult<vscode.LanguageModelToolResult>): void => {
        context.subscriptions.push(
            vscode.lm.registerTool<T>(name, {
                invoke: (options) => invoke(options.input),
            }),
        );
    };

    /** Root the tools describe; the first workspace folder matches the scan root. */
    const root = (): string => vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();

    /** Register a tool whose handler is the shared Aura registry implementation. */
    const registerShared = <T>(name: string): void => {
        register<T>(name, async (input) => {
            const db = getDb();
            if (!db) return notAnalyzedResult();
            try {
                return jsonResult(await runAuraToolAsync(db, name, input as Record<string, unknown>, {
                    root: root(),
                    dbPath: vscode.Uri.joinPath(vscode.Uri.file(root()), '.aura', 'graph.db').fsPath,
                    getRiskSnapshot,
                    getArchitecture,
                }));
            } catch (err) {
                return jsonResult({ error: err instanceof Error ? err.message : String(err) });
            }
        });
    };

    registerShared<{ task: string; limit?: number }>('aura_resolve_context');
    registerShared<{ query: string; limit?: number }>('aura_search_docs');
    registerShared<{ limit?: number; sort_by?: string }>('aura_get_hotspots');
    registerShared<{ from: string; to: string }>('aura_find_path');
    registerShared<{ query: string; kind?: string }>('aura_search_symbols');
    registerShared<{ layer?: string; include_baselined?: boolean; limit?: number }>('aura_get_architecture_violations');
    registerShared<Record<string, never>>('aura_build');
    registerShared<{ file: string }>('aura_explain_file');
    registerShared<{ base?: string; limit?: number }>('aura_hotspots_in_changes');
    registerShared<Record<string, never>>('aura_list_repositories');
}
