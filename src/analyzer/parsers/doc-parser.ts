/**
 * doc-parser.ts — Splits documentation files (Markdown / plain text) into
 * searchable chunks for the doc RAG index.
 *
 * Strategy:
 *  - Markdown (.md/.markdown/.rst): split on H1/H2/H3 headings. Each chunk
 *    inherits the most recent heading as its `section`. Big sections are
 *    further sliced by paragraph to stay under `maxChars`.
 *  - Plain text (.txt) or no headings found: accumulate paragraphs
 *    (separated by blank lines) up to `maxChars`. Section = first non-empty
 *    line of the chunk, truncated.
 */

export interface DocChunk {
    fileId: string;
    section: string;
    content: string;
    lineStart: number;
}

const HEADING_RE = /^(#{1,3})\s+(.+?)\s*$/;
const RST_UNDERLINE_RE = /^(=+|-+|~+)\s*$/;

export function chunkDocument(content: string, fileId: string, maxChars: number = 1500): DocChunk[] {
    const lines = content.split('\n');
    const chunks: DocChunk[] = [];

    let currentSection = fileId.split('/').pop() || fileId;
    let buffer: string[] = [];
    let bufferStart = 1;

    const flush = (endLine: number) => {
        const text = buffer.join('\n').trim();
        if (text.length === 0) return;
        // Split too-large chunks into ~maxChars pieces along paragraph boundaries.
        const pieces = splitByParagraph(text, maxChars);
        let offset = 0;
        for (const piece of pieces) {
            chunks.push({
                fileId,
                section: currentSection,
                content: piece,
                lineStart: bufferStart + offset,
            });
            offset += piece.split('\n').length;
        }
        buffer = [];
        bufferStart = endLine + 1;
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const mdMatch = line.match(HEADING_RE);
        const rstUnderline = i + 1 < lines.length && lines[i + 1].match(RST_UNDERLINE_RE);

        if (mdMatch) {
            flush(i);
            currentSection = mdMatch[2];
            bufferStart = i + 1;
            continue;
        }

        if (rstUnderline && line.trim().length > 0) {
            flush(i - 1);
            currentSection = line.trim();
            bufferStart = i + 1;
            i++; // skip underline
            continue;
        }

        buffer.push(line);
    }
    flush(lines.length);

    return chunks;
}

function splitByParagraph(text: string, maxChars: number): string[] {
    if (text.length <= maxChars) return [text];
    const paragraphs = text.split(/\n\s*\n/);
    const out: string[] = [];
    let current = '';
    for (const p of paragraphs) {
        if (current.length + p.length + 2 > maxChars && current.length > 0) {
            out.push(current.trim());
            current = '';
        }
        current += (current ? '\n\n' : '') + p;
        // single paragraph bigger than max — hard split
        while (current.length > maxChars * 1.5) {
            out.push(current.slice(0, maxChars));
            current = current.slice(maxChars);
        }
    }
    if (current.trim().length > 0) out.push(current.trim());
    return out;
}
