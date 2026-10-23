/**
 * prompt.ts — Pure helpers for the @aura chat participant.
 */

/** Turn a slash command + arguments into the user prompt sent to the model. */
export function buildUserPrompt(command: string | undefined, prompt: string, selection?: string): string {
    const p = (prompt || '').trim();
    const target = p || (selection || '').trim();
    switch (command) {
        case 'explain':
            return target
                ? `Explain what this file/module does and its role in the architecture: ${target}. Use the Aura tools for facts and cite files.`
                : 'Ask the user which file or module they want explained.';
        case 'impact':
            return target
                ? `Analyze the impact of changing ${target}: dependents, blast radius, risk and cycles. Use the Aura tools.`
                : 'Ask the user which file they want an impact analysis for.';
        case 'path':
            if (p) return `Find the shortest dependency path. Arguments (from and to): ${p}. Use aura_find_path and explain the path.`;
            return selection
                ? `Find the shortest dependency path starting from ${selection}. Ask the user for the destination file, then use aura_find_path.`
                : 'Ask the user for two file paths (from and to) to find a dependency path.';
        case 'hotspots':
            return `List the most at-risk files${p ? ` (${p})` : ''} with their reasons and propose 3 concrete actions. Use aura_get_hotspots.`;
        case 'query':
            return p
                ? `Translate this natural-language filter into Aura Query Language (AQL). Return only the AQL expression in a fenced code block, then a one-line explanation. Do not list files or propose navigation actions.\nFilter: ${p}`
                : 'Ask the user to describe the filter they want in natural language.';
        default:
            return p || 'What should I know about this codebase?';
    }
}

const FILE_REF_RE = /([A-Za-z0-9_./-]+\.[A-Za-z][A-Za-z0-9]{0,7})(?::(\d+))?/g;

export interface FileAnchor {
    file: string;
    line?: number;
}

/** Extract workspace-relative file references with optional 1-based line numbers. */
export function extractFileAnchors(text: string): FileAnchor[] {
    const out: FileAnchor[] = [];
    const index = new Map<string, number>();
    const re = new RegExp(FILE_REF_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        const file = m[1];
        if (!file || file.includes('://')) continue;
        const line = m[2] ? parseInt(m[2], 10) : undefined;
        const existing = index.get(file);
        if (existing === undefined) {
            index.set(file, out.length);
            out.push({ file, line });
        } else if (out[existing].line === undefined && line) {
            out[existing] = { file, line };
        }
    }
    return out;
}

/** Extract workspace-relative file references such as `src/foo.ts:42` from an answer. */
export function extractFileReferences(text: string): string[] {
    return extractFileAnchors(text).map(a => a.file);
}

/** Extract a single-line AQL expression from a fenced/inline block, if present. */
export function extractAql(text: string): string | undefined {
    const fenced = text.match(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/i);
    const inline = text.match(/`([^`\n]+)`/);
    const candidate = (fenced ? fenced[1] : (inline ? inline[1] : '')).trim();
    if (!candidate) return undefined;
    const line = candidate.split('\n').map(l => l.trim()).find(l => l.length > 0);
    if (line && /(==|!=|>=|<=|>|<|\bAND\b|\bOR\b)/i.test(line)) return line;
    return undefined;
}
