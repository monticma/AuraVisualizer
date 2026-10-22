/**
 * chat.ts — Legacy in-webview Aura Assistant engine.
 *
 * The strategy (docs/Ideas/AIChatStrategy.md) is VS Code Chat via @aura; this
 * engine remains for the hidden legacy panel and reuses the shared tool registry.
 */

import * as vscode from 'vscode';
import type { GraphDB } from './graph-db';
import type { RiskSnapshot } from './risk/risk-service';
import { AURA_TOOLS, runAuraTool } from './ai/tools';
import { buildAuraSystemPrompt } from './ai/prompts';
import { describeAuraViewContext } from './chat/context';

export interface ChatStreamCallbacks {
    onChunk: (text: string) => void;
    onDone: (fullText: string) => void;
    onError: (message: string) => void;
    /** Fired when the model invokes an Aura tool (for UI transparency). */
    onToolCall?: (name: string) => void;
}

/**
 * Stream an AI answer for a user prompt, with a tool-calling loop: the model
 * can query the analyzed codebase through deterministic Aura tools, and the
 * final text answer is streamed back to the caller.
 * Must be called in response to a user action (VS Code shows a consent dialog
 * on first `vscode.lm` use).
 */
export async function runChatStream(
    getDb: () => GraphDB | undefined,
    prompt: string,
    callbacks: ChatStreamCallbacks,
    getRiskSnapshot?: () => RiskSnapshot | undefined,
): Promise<void> {
    // 1. Select a language model (the one configured in VS Code).
    let model: vscode.LanguageModelChat;
    try {
        const models = await vscode.lm.selectChatModels({});
        if (models.length === 0) {
            callbacks.onError('No language model available. Configure a chat model in VS Code (e.g. GitHub Copilot) and retry.');
            return;
        }
        model = models[0];
    } catch (err) {
        callbacks.onError(err instanceof Error ? err.message : String(err));
        return;
    }

    const db = getDb();
    const systemPrompt = buildAuraSystemPrompt(describeAuraViewContext());
    const userMessage = db
        ? systemPrompt + '\n\nUSER QUESTION: ' + prompt
        : systemPrompt + '\n\n(The workspace has not been analyzed yet — no codebase tools are available. Tell the user to run "Aura: Visualize Codebase".)\n\nUSER QUESTION: ' + prompt;

    const messages: vscode.LanguageModelChatMessage[] = [
        vscode.LanguageModelChatMessage.User(userMessage),
    ];

    const tools = AURA_TOOLS.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
    }));

    const MAX_ITERATIONS = 6;

    try {
        let fullText = '';
        for (let i = 0; i < MAX_ITERATIONS; i++) {
            const options: vscode.LanguageModelChatRequestOptions = db ? { tools } : {};
            const response = await model.sendRequest(messages, options, undefined);

            const toolCalls: vscode.LanguageModelToolCallPart[] = [];
            for await (const part of response.stream) {
                if (part instanceof vscode.LanguageModelTextPart) {
                    fullText += part.value;
                    callbacks.onChunk(part.value);
                } else if (part instanceof vscode.LanguageModelToolCallPart) {
                    toolCalls.push(part);
                }
            }

            // No tool calls → this was the final answer.
            if (toolCalls.length === 0 || !db) break;

            // Execute tool calls and feed the results back to the model.
            for (const tc of toolCalls) {
                if (callbacks.onToolCall) callbacks.onToolCall(tc.name);
                let result: unknown;
                try {
                    result = runAuraTool(db, tc.name, tc.input as Record<string, unknown>, getRiskSnapshot);
                } catch (err) {
                    result = { error: err instanceof Error ? err.message : String(err) };
                }
                messages.push(vscode.LanguageModelChatMessage.Assistant([tc]));
                messages.push(vscode.LanguageModelChatMessage.User([
                    new vscode.LanguageModelToolResultPart(
                        tc.callId,
                        [new vscode.LanguageModelTextPart(JSON.stringify(result))],
                    ),
                ]));
            }
        }
        callbacks.onDone(fullText);
    } catch (err) {
        callbacks.onError(err instanceof Error ? err.message : String(err));
    }
}
