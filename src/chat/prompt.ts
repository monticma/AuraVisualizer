/**
 * prompt.ts — Pure helpers for the @aura chat participant.
 */

/** Turn a slash command + arguments into the user prompt sent to the model. */
export function buildUserPrompt(command: string | undefined, prompt: string): string {
    const p = (prompt || '').trim();
    switch (command) {
        case 'explain':
            return p
                ? `Explain what this file/module does and its role in the architecture: ${p}. Use the Aura tools for facts and cite files.`
                : 'Explain the file currently selected in Aura: its role, dependencies, dependents and risk. Use the Aura tools for facts and cite files.';
        case 'impact':
            return p
                ? `Analyze the impact of changing ${p}: dependents, blast radius, risk and cycles. Use the Aura tools.`
                : 'Analyze the impact of changing the file currently selected in Aura: dependents, blast radius, risk and cycles. Use the Aura tools.';
        case 'path':
            return p
                ? `Find the shortest dependency path. Arguments (from and to): ${p}. Use aura_find_path and explain the path.`
                : 'Ask the user for two file paths (from and to) to find a dependency path.';
        case 'hotspots':
            return `List the most at-risk files${p ? ` (${p})` : ''} with their reasons and propose 3 concrete actions. Use aura_get_hotspots.`;
        case 'query':
            return p
                ? `Translate this natural-language filter into Aura Query Language (AQL). Return only the AQL expression in a fenced code block, then a one-line explanation.\nFilter: ${p}`
                : 'Ask the user to describe the filter they want in natural language.';
        default:
            return p || 'What should I know about this codebase?';
    }
}

const FILE_REF_RE = /([A-Za-z0-9_./-]+\.[A-Za-z0-9]{1,8})(?::(\d+))?/g;

/** Extract workspace-relative file references such as `src/foo.ts:42` from an answer. */
export function extractFileReferences(text: string): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    const re = new RegExp(FILE_REF_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        const file = m[1];
        if (!file || file.includes('://') || seen.has(file)) continue;
        seen.add(file);
        out.push(file);
    }
    return out;
}

/** Extract a single-line AQL expression from a fenced code block, if present. */
export function extractAql(text: string): string | undefined {
    const fenced = text.match(/```(?:aql|text)?\s*\n([^\n]+)\n```/i);
    const candidate = (fenced ? fenced[1] : '').trim();
    if (candidate && /(==|!=|>=|<=|>|<|\bAND\b|\bOR\b)/i.test(candidate)) {
        return candidate;
    }
    return undefined;
}
