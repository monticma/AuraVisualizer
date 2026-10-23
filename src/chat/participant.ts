/**
 * participant.ts — VS Code Chat participant `@aura`.
 *
 * Reuses the shared tool registry and the legacy assistant prompt, but streams
 * through the native Chat UI (model picker, history, consent handled by VS Code).
 */

import * as vscode from 'vscode';
import { existsSync } from 'fs';
import { relative } from 'path';
import type { GraphDB } from '../graph-db';
import type { RiskSnapshot } from '../risk/risk-service';
import { AURA_TOOLS, resolveFileArg, runAuraTool } from '../ai/tools';
import { buildAuraSystemPrompt } from '../ai/prompts';
import { resolveNavigationPath, type NavigationPath } from '../commands/navigation-core';
import { describeAuraViewContext, getAuraViewContext, setAuraViewContext, type AuraViewContext } from './context';
import { buildFileFacts } from './file-facts';
import { buildUserPrompt, extractAql, extractFileAnchors } from './prompt';

export const AURA_PARTICIPANT_ID = 'monticma-aura.aura';
const MAX_ITERATIONS = 8;

/** Resolve the file under the cursor / selected in Aura, as a workspace-relative path. */
function currentSelection(): string | undefined {
    const existing = getAuraViewContext();
    if (existing?.selection) return existing.selection;
    const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const editor = vscode.window.activeTextEditor;
    if (!root || !editor) return undefined;
    const rel = relative(root, editor.document.uri.fsPath);
    return rel.startsWith('..') ? undefined : rel;
}

/** Merge the active editor into the stored view context before prompting. */
function buildViewContext(): { context: AuraViewContext; selection?: string } {
    const existing = getAuraViewContext() ?? {};
    const selection = existing.selection || currentSelection();
    if (selection && selection !== existing.selection) {
        const context = { ...existing, selection };
        setAuraViewContext(context);
        return { context, selection };
    }
    return { context: existing, selection };
}

export function registerAuraChatParticipant(
    context: vscode.ExtensionContext,
    getDb: () => GraphDB | undefined,
    getRiskSnapshot?: () => RiskSnapshot | undefined,
    isAuraVisible?: () => boolean,
): void {
    const handler: vscode.ChatRequestHandler = async (request, _chatContext, stream, token) => {
        const db = getDb();
        if (!db) {
            stream.markdown('Aura has not analyzed this workspace yet. Run **Aura: Visualize Codebase** first, then retry.');
            if (!isAuraVisible?.()) stream.button({ command: 'auraVisualizer.open', title: 'Open Aura' });
            return;
        }

        const command = request.command;
        const rawPrompt = (request.prompt || '').trim();
        const { context: viewContext, selection } = buildViewContext();
        if (!rawPrompt && !selection && (command === 'explain' || command === 'impact')) {
            stream.markdown(`Which file should I ${command === 'explain' ? 'explain' : 'analyze'}? Use \`/${command} src/file.ts\`, open the file in the editor, or select it in Aura.`);
            return;
        }
        if (command === 'path' && !rawPrompt && !selection) {
            stream.markdown('Give me two files to connect: `/path src/a.ts src/b.ts`.');
            return;
        }

        const systemPrompt = buildAuraSystemPrompt(describeAuraViewContext(viewContext));
        const userPrompt = buildUserPrompt(command, rawPrompt, selection);

        // Contextual actions (detail panel, cluster, Risk, explorer) name a file in
        // their prompt. Stream deterministic facts first, so the answer is never an
        // empty "no written answer" when the model ends on a tool call.
        let explainedFile: string | undefined;
        const promptAnchors = extractFileAnchors(rawPrompt);
        const fileTarget = promptAnchors[0]?.file || selection;
        const wantsFileFacts = command !== 'query' && command !== 'path' && command !== 'hotspots'
            && !!fileTarget
            && (promptAnchors.length > 0 || command === 'explain' || command === 'impact');
        if (wantsFileFacts && fileTarget) {
            const facts = buildFileFacts(db, fileTarget);
            if (facts) {
                explainedFile = facts.file;
                stream.markdown(facts.markdown + '\n\n');
            } else if (promptAnchors.length > 0 || command === 'explain' || command === 'impact') {
                stream.markdown(`I couldn't find \`${fileTarget}\` in the analyzed graph. Check the path, then run **Aura: Visualize Codebase** again if the file is new.`);
                return;
            }
        }
        const messages: vscode.LanguageModelChatMessage[] = [
            vscode.LanguageModelChatMessage.User(systemPrompt + '\n\nUSER QUESTION: ' + userPrompt),
        ];
        const tools = AURA_TOOLS.map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
        }));

        let fullText = '';
        let lastText = '';
        try {
            for (let i = 0; i < MAX_ITERATIONS; i++) {
                const response = await request.model.sendRequest(messages, { tools }, token);
                const toolCalls: vscode.LanguageModelToolCallPart[] = [];
                let iterationText = '';

                for await (const part of response.stream) {
                    if (part instanceof vscode.LanguageModelTextPart) {
                        iterationText += part.value;
                        fullText += part.value;
                        stream.markdown(part.value);
                    } else if (part instanceof vscode.LanguageModelToolCallPart) {
                        toolCalls.push(part);
                    }
                }
                lastText = iterationText;

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
            if (!lastText.trim()) {
                // The model sometimes ends its turn on a tool call (especially for
                // long prompts such as "tests first"). Ask once for a plain answer
                // without tools so the user always gets written content.
                messages.push(vscode.LanguageModelChatMessage.User(
                    'Now write the final answer for the user in markdown, using the tool results above. Do not call any more tools. Be concrete and cite files.',
                ));
                const finalResponse = await request.model.sendRequest(messages, {}, token);
                let finalText = '';
                for await (const part of finalResponse.stream) {
                    if (part instanceof vscode.LanguageModelTextPart) {
                        finalText += part.value;
                        fullText += part.value;
                        stream.markdown(part.value);
                    }
                }
                lastText = finalText;
            }
            if (!lastText.trim()) {
                stream.markdown('_Aura queried the graph but returned no written answer. Try rephrasing, or name a specific file._');
            }
            const isQueryCommand = command === 'query';
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            const anchors = isQueryCommand ? [] : extractFileAnchors(fullText);
            if (explainedFile && !anchors.some(a => a.file === explainedFile)) {
                anchors.unshift({ file: explainedFile });
            }
            const fileRefs: { file: string; line?: number; navigation: NavigationPath; graphFile?: string }[] = [];
            for (const anchor of anchors) {
                const navigation = resolveNavigationPath(anchor.file, workspaceRoot);
                if (!navigation || !existsSync(navigation.absolutePath)) continue;
                const graphFile = navigation.insideWorkspace
                    ? resolveFileArg(db, navigation.relativePath) ?? undefined
                    : undefined;
                fileRefs.push({ ...anchor, navigation, graphFile });
            }
            const graphRefs = fileRefs.filter(ref => !!ref.graphFile);
            for (const ref of fileRefs.slice(0, 20)) {
                const uri = vscode.Uri.file(ref.navigation.absolutePath);
                if (ref.line && ref.line > 0) {
                    stream.reference(new vscode.Location(uri, new vscode.Position(ref.line - 1, 0)));
                } else {
                    stream.reference(uri);
                }
            }
            for (const ref of graphRefs.slice(0, 3)) {
                stream.button({ command: 'auraVisualizer.focusPath', title: `Focus ${ref.graphFile}`, arguments: [ref.graphFile] });
            }
            if (!isQueryCommand && fileRefs[0]) {
                const primary = fileRefs[0];
                const label = primary.line ? `${primary.file}:${primary.line}` : primary.file;
                stream.button({ command: 'auraVisualizer.openFileAt', title: `Open ${label}`, arguments: [primary.file, primary.line] });
            }
            if (!isQueryCommand && graphRefs[0]) {
                const blast = graphRefs[0];
                stream.button({ command: 'auraVisualizer.blastRadiusPath', title: `Blast radius: ${blast.graphFile}`, arguments: [blast.graphFile] });
            }
            const aql = extractAql(fullText);
            if (aql) {
                stream.button({ command: 'auraVisualizer.applyQuery', title: 'Apply Aura Query', arguments: [aql] });
            }
            if (!isQueryCommand) {
                stream.button({ command: 'auraVisualizer.statusBarRisk', title: 'Open Risk' });
                if (!isAuraVisible?.()) {
                    stream.button({ command: 'auraVisualizer.open', title: 'Open Aura' });
                }
            }
        } catch (err) {
            stream.markdown(`\n\n**Aura error:** ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const participant = vscode.chat.createChatParticipant(AURA_PARTICIPANT_ID, handler);
    participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'aura-star-icon.png');
    context.subscriptions.push(participant);
}
