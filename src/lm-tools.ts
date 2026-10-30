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
import { runAuraTool } from './ai/tools';
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
    const register = <T>(name: string, invoke: (input: T) => vscode.LanguageModelToolResult): void => {
        context.subscriptions.push(
            vscode.lm.registerTool<T>(name, {
                invoke: (options) => invoke(options.input),
            }),
        );
    };

    /** Register a tool whose handler is the shared Aura registry implementation. */
    const registerShared = <T>(name: string): void => {
        register<T>(name, (input) => {
            const db = getDb();
            if (!db) return notAnalyzedResult();
            try {
                return jsonResult(runAuraTool(db, name, input as Record<string, unknown>, getRiskSnapshot, getArchitecture));
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
}
