/**
 * participant.ts — VS Code Chat participant `@aura`.
 *
 * Reuses the shared tool registry and the legacy assistant prompt, but streams
 * through the native Chat UI (model picker, history, consent handled by VS Code).
 */

import * as vscode from 'vscode';
import { existsSync } from 'fs';
import { isAbsolute, join } from 'path';
import type { GraphDB } from '../graph-db';
import type { RiskSnapshot } from '../risk/risk-service';
import { AURA_TOOLS, runAuraTool } from '../ai/tools';
import { buildAuraSystemPrompt } from '../ai/prompts';
import { describeAuraViewContext } from './context';
import { buildUserPrompt, extractAql, extractFileReferences } from './prompt';

export const AURA_PARTICIPANT_ID = 'monticma-aura.aura';
const MAX_ITERATIONS = 6;

export function registerAuraChatParticipant(
    context: vscode.ExtensionContext,
    getDb: () => GraphDB | undefined,
    getRiskSnapshot?: () => RiskSnapshot | undefined,
): void {
    const handler: vscode.ChatRequestHandler = async (request, _chatContext, stream, token) => {
        const db = getDb();
        if (!db) {
            stream.markdown('Aura has not analyzed this workspace yet. Run **Aura: Visualize Codebase** first, then retry.');
            stream.button({ command: 'auraVisualizer.open', title: 'Open Aura' });
            return;
        }

        const systemPrompt = buildAuraSystemPrompt(describeAuraViewContext());
        const userPrompt = buildUserPrompt(request.command, request.prompt);
        const messages: vscode.LanguageModelChatMessage[] = [
            vscode.LanguageModelChatMessage.User(systemPrompt + '\n\nUSER QUESTION: ' + userPrompt),
        ];
        const tools = AURA_TOOLS.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
        }));

        let fullText = '';
        try {
            for (let i = 0; i < MAX_ITERATIONS; i++) {
                const response = await request.model.sendRequest(messages, { tools }, token);
                const toolCalls: vscode.LanguageModelToolCallPart[] = [];

                for await (const part of response.stream) {
                    if (part instanceof vscode.LanguageModelTextPart) {
                        fullText += part.value;
                        stream.markdown(part.value);
                    } else if (part instanceof vscode.LanguageModelToolCallPart) {
                        toolCalls.push(part);
                    }
                }

                if (token.isCancellationRequested) return;
                if (toolCalls.length === 0) break;

                messages.push(vscode.LanguageModelChatMessage.Assistant(toolCalls));
                for (const tc of toolCalls) {
                    stream.progress(`Aura · ${tc.name}`);
                    let result: unknown;
                    try {
                        result = runAuraTool(db, tc.name, tc.input as Record<string, unknown>, getRiskSnapshot);
                    } catch (err) {
                        result = { error: err instanceof Error ? err.message : String(err) };
                    }
                    messages.push(vscode.LanguageModelChatMessage.User([
                        new vscode.LanguageModelToolResultPart(
                            tc.callId,
                            [new vscode.LanguageModelTextPart(JSON.stringify(result))],
                        ),
                    ]));
                }
            }

            // Clickable references + action buttons.
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            const refs = extractFileReferences(fullText);
            for (const ref of refs.slice(0, 20)) {
                const abs = isAbsolute(ref) ? ref : (workspaceRoot ? join(workspaceRoot, ref) : '');
                if (abs && existsSync(abs)) {
                    stream.reference(vscode.Uri.file(abs));
                }
            }
            for (const ref of refs.slice(0, 3)) {
                stream.button({ command: 'auraVisualizer.focusPath', title: `Focus ${ref}`, arguments: [ref] });
            }
            const aql = extractAql(fullText);
            if (aql) {
                stream.button({ command: 'auraVisualizer.applyQuery', title: 'Apply Aura Query', arguments: [aql] });
            }
            stream.button({ command: 'auraVisualizer.statusBarRisk', title: 'Open Risk' });
            stream.button({ command: 'auraVisualizer.open', title: 'Open Aura' });
        } catch (err) {
            stream.markdown(`\n\n**Aura error:** ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const participant = vscode.chat.createChatParticipant(AURA_PARTICIPANT_ID, handler);
    participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'aura-star-icon.png');
    context.subscriptions.push(participant);
}
