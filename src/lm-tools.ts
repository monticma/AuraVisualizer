/**
 * lm-tools.ts — registers Aura codebase tools with VS Code's Language Model API
 * (`vscode.lm.tools`). Once registered, any VS Code AI agent (Copilot Chat,
 * etc.) can invoke them to query the analyzed graph.
 *
 * Tool metadata (name, description, input schema) lives in `package.json`
 * under `contributes.languageModelTools` — this module only wires the `invoke`
 * logic. See docs/AI-CHAT.md for the full design.
 */

import * as vscode from 'vscode';
import type { GraphDB } from './graph-db';
import { resolveContext } from './mcp/context';
import { topRiskHotspots, type RiskSnapshot } from './risk/risk-service';

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
export function registerAuraLmTools(context: vscode.ExtensionContext, getDb: GetDb, getRiskSnapshot?: () => RiskSnapshot | undefined): void {
    const register = <T>(name: string, invoke: (input: T) => vscode.LanguageModelToolResult): void => {
        context.subscriptions.push(
            vscode.lm.registerTool<T>(name, {
                invoke: (options) => invoke(options.input),
            }),
        );
    };

    register<{ task: string; limit?: number }>('aura_resolve_context', (input) => {
        const db = getDb();
        if (!db) return notAnalyzedResult();
        try {
            return jsonResult(resolveContext(db, input.task, input.limit ?? 10));
        } catch (err) {
            return jsonResult({ error: err instanceof Error ? err.message : String(err) });
        }
    });

    register<{ query: string; limit?: number }>('aura_search_docs', (input) => {
        const db = getDb();
        if (!db) return notAnalyzedResult();
        const results = db.searchDocs(input.query, input.limit ?? 10);
        return jsonResult({
            query: input.query,
            total: results.length,
            results: results.map(r => ({
                file: r.fileId,
                section: r.section,
                line: r.lineStart,
                score: r.score,
                excerpt: r.content.length > 600 ? r.content.slice(0, 600) + '…' : r.content,
            })),
        });
    });

    register<{ limit?: number; sort_by?: string }>('aura_get_hotspots', (input) => {
        const db = getDb();
        if (!db) return notAnalyzedResult();
        const limit = input.limit ?? 20;
        const sortBy = input.sort_by ?? 'risk';
        if (sortBy === 'risk') {
            const snapshot = getRiskSnapshot?.();
            if (snapshot) {
                return jsonResult(topRiskHotspots(snapshot, limit));
            }
        }
        const hotspots = db.getHotspots(limit, sortBy === 'risk' ? 'impact' : sortBy);
        return jsonResult({
            sort_by: sortBy === 'risk' ? 'impact' : sortBy,
            hotspots: hotspots.map(h => ({
                file: h.id,
                lines: h.lines,
                complexity: h.complexity,
                fan_in: h.fan_in,
                fan_out: h.fan_out,
                impact_score: h.impact_score,
            })),
            total: hotspots.length,
        });
    });

    register<{ from: string; to: string }>('aura_find_path', (input) => {
        const db = getDb();
        if (!db) return notAnalyzedResult();
        const path = db.findPath(input.from, input.to);
        return jsonResult(path
            ? { from: input.from, to: input.to, path, length: path.length - 1 }
            : { from: input.from, to: input.to, path: null, message: 'No dependency path found between these files' });
    });

    register<{ query: string; kind?: string }>('aura_search_symbols', (input) => {
        const db = getDb();
        if (!db) return notAnalyzedResult();
        const results = db.searchSymbols(input.query, input.kind);
        return jsonResult({
            query: input.query,
            kind: input.kind || 'all',
            results: results.map(r => ({
                file: r.nodeId,
                symbol: r.name,
                kind: r.kind,
                line: r.line,
                visibility: r.visibility,
                is_static: r.isStatic,
                is_async: r.isAsync,
            })),
            total: results.length,
        });
    });
}
