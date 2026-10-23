/**
 * ai-summary.ts — Optional AI narrative for the architecture report.
 *
 * The narrative is generated from the deterministic report only, never from a
 * second graph query, so the exported facts and the prose stay aligned.
 */

import * as vscode from 'vscode';

export async function generateArchitectureNarrative(report: string, token?: vscode.CancellationToken): Promise<string | undefined> {
    let model: vscode.LanguageModelChat;
    try {
        const models = await vscode.lm.selectChatModels({});
        if (models.length === 0) return undefined;
        model = models[0];
    } catch {
        return undefined;
    }

    const prompt =
        'You are a software architecture analyst. Using ONLY the report below, write a concise architecture narrative in 4–6 short paragraphs. ' +
        'Explain: (1) what the system appears to do, (2) the main modules and their responsibilities, (3) the dependency flow between modules, ' +
        '(4) the main risks, cycles or dead exports, and (5) the 3 most useful next actions. ' +
        'Do not invent files or facts. If information is missing, say so explicitly. Use markdown, no top-level title.\n\n' +
        'ARCHITECTURE REPORT:\n' +
        report;

    const source = token ? undefined : new vscode.CancellationTokenSource();
    try {
        const response = await model.sendRequest(
            [vscode.LanguageModelChatMessage.User(prompt)],
            {},
            token || source!.token,
        );
        let text = '';
        for await (const part of response.stream) {
            if (part instanceof vscode.LanguageModelTextPart) text += part.value;
        }
        const trimmed = text.trim();
        return trimmed || undefined;
    } catch {
        return undefined;
    } finally {
        source?.dispose();
    }
}
