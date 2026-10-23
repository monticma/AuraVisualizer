/**
 * annotations.ts — per-file notes, persisted to `.aura/annotations.json`.
 *
 * Pure module (no `vscode` import) so it can be unit-tested: the webview
 * provider owns the file I/O, this module owns the data shape and merging.
 * Node keys are workspace-relative paths (same convention as `workingTree`).
 */

/** Note colors — the palette also drives the node markers in the webview. */
export const NOTE_COLORS = {
    yellow: '#fdd835',
    red: '#ef5350',
    blue: '#42a5f5',
    green: '#66bb6a',
    purple: '#ab47bc',
} as const;

export type NoteColor = keyof typeof NOTE_COLORS;

export const DEFAULT_NOTE_COLOR: NoteColor = 'yellow';
export const MAX_NOTE_LENGTH = 2000;

export interface NodeNote {
    text: string;
    color: NoteColor;
    updatedAt: string;   // ISO 8601
}

export type AnnotationMap = Record<string, NodeNote>;

/** Normalize ISO strings, Dates and millisecond/second numbers to epoch ms. */
export function toTimestamp(value: string | number | Date | null | undefined): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    if (value instanceof Date) {
        const time = value.getTime();
        return Number.isFinite(time) ? time : undefined;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return undefined;
        return value < 1e11 ? value * 1000 : value;
    }
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : undefined;
}

/** A note is stale when it was written before the file's last modification. */
export function isNoteStale(
    note: Pick<NodeNote, 'updatedAt'> | null | undefined,
    lastModified: string | number | Date | null | undefined,
): boolean {
    const noteTime = toTimestamp(note?.updatedAt);
    const fileTime = toTimestamp(lastModified);
    return noteTime !== undefined && fileTime !== undefined && noteTime < fileTime;
}

export function normalizeNoteColor(value: unknown): NoteColor {
    return typeof value === 'string' && value in NOTE_COLORS ? (value as NoteColor) : DEFAULT_NOTE_COLOR;
}

function cleanText(text: unknown): string {
    return typeof text === 'string' ? text.trim().slice(0, MAX_NOTE_LENGTH) : '';
}

/** Tolerant parse: a corrupt or missing file reads as an empty map, never throws. */
export function parseAnnotations(raw: string | undefined | null): AnnotationMap {
    if (!raw) return {};
    try {
        const data = JSON.parse(raw);
        const notes = data && typeof data === 'object' ? (data as { notes?: unknown }).notes : undefined;
        if (!notes || typeof notes !== 'object') return {};
        const out: AnnotationMap = {};
        for (const [key, value] of Object.entries(notes as Record<string, unknown>)) {
            const rec = value as { text?: unknown; color?: unknown; updatedAt?: unknown };
            const text = cleanText(rec.text);
            if (!text) continue;
            out[key] = {
                text,
                color: normalizeNoteColor(rec.color),
                updatedAt: typeof rec.updatedAt === 'string' ? rec.updatedAt : '',
            };
        }
        return out;
    } catch {
        return {};
    }
}

export function serializeAnnotations(map: AnnotationMap): string {
    return JSON.stringify({ version: 1, notes: map }, null, 2) + '\n';
}

/** Add or replace a note. Blank text removes the note instead. */
export function withNote(
    map: AnnotationMap,
    path: string,
    text: string,
    color: unknown,
    now: Date = new Date()
): AnnotationMap {
    const cleaned = cleanText(text);
    if (!cleaned) return withoutNote(map, path);
    return {
        ...map,
        [path]: { text: cleaned, color: normalizeNoteColor(color), updatedAt: now.toISOString() },
    };
}

export function withoutNote(map: AnnotationMap, path: string): AnnotationMap {
    if (!(path in map)) return map; // no-op keeps the same reference
    const next = { ...map };
    delete next[path];
    return next;
}
