/**
 * global-refs.ts — Runtime couplings through `window.*` namespaces (V4-09).
 *
 * The webview satellites (`webview/js/*.js`) are plain scripts, not modules:
 * they expose `window.AuraSprites = { … }` and consume each other as
 * `AuraSprites.ripple(…)`. No `import` statement exists, so the dependency was
 * invisible: `sprites.js` showed up with `fan_in = 0` and an empty blast radius
 * even though renaming one of its functions breaks the whole panel.
 *
 * The provider already links them through `script` edges ("loaded by"), this
 * module adds the missing half — "used by" — by pairing namespace definitions
 * with their usages. Both sides are read from the Tree-sitter AST, so comments
 * and string literals never produce a false edge.
 *
 * Pure module: it only walks a minimal node shape, so it is unit-testable
 * without loading any grammar.
 */

/** The subset of a Tree-sitter node this module needs. */
export interface SyntaxNodeLike {
    type: string;
    text: string;
    childCount: number;
    child(index: number): SyntaxNodeLike | null;
    childForFieldName(name: string): SyntaxNodeLike | null;
    startPosition: { row: number; column: number };
}

/** Objects whose properties are visible from every other script. */
export const GLOBAL_OBJECTS: readonly string[] = ['window', 'globalThis', 'self'];

/**
 * Confidence of a `global-use` edge: the namespace name is unique in the
 * repository, but nothing guarantees the object is still the same at runtime
 * (any script may overwrite `window.X`). Same tier as a basename match.
 */
export const GLOBAL_USE_CONFIDENCE = 0.6;

/** `__x` / `_x` helpers are too short to be unambiguous. */
const MIN_NAME_LENGTH = 3;

export interface NamespaceDef {
    /** Exported name, e.g. `AuraSprites`. */
    name: string;
    /** 1-based line of the assignment. */
    line: number;
}

export interface NamespaceUse {
    name: string;
    /** First property read on the namespace, e.g. `ripple`. */
    member: string;
    /** 1-based line of the read. */
    line: number;
}

function isUsableName(name: string): boolean {
    return name.length >= MIN_NAME_LENGTH && /^[A-Za-z_$][\w$]*$/.test(name);
}

/** `window.AuraSprites` → `{ object: 'window', property: 'AuraSprites' }`. */
function memberParts(node: SyntaxNodeLike | null): { object: string; property: string } | null {
    if (!node || node.type !== 'member_expression') return null;
    const object = node.childForFieldName('object');
    const property = node.childForFieldName('property');
    if (!object || !property || object.type !== 'identifier') return null;
    if (property.type !== 'property_identifier' && property.type !== 'identifier') return null;
    return { object: object.text, property: property.text };
}

/** Visit every node of the tree, depth first. */
function walk(node: SyntaxNodeLike, visit: (node: SyntaxNodeLike) => void): void {
    visit(node);
    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) walk(child, visit);
    }
}

/**
 * Namespace definitions: `window.X = …`, `globalThis.X = …`, `self.X = …`.
 * The first assignment of a name wins (a second `window.X ||= …` guard is the
 * same namespace).
 */
export function collectNamespaceDefs(root: SyntaxNodeLike): NamespaceDef[] {
    const found: NamespaceDef[] = [];
    const seen = new Set<string>();
    walk(root, node => {
        if (node.type !== 'assignment_expression') return;
        const parts = memberParts(node.childForFieldName('left'));
        if (!parts || !GLOBAL_OBJECTS.includes(parts.object)) return;
        if (!isUsableName(parts.property) || seen.has(parts.property)) return;
        seen.add(parts.property);
        found.push({ name: parts.property, line: node.startPosition.row + 1 });
    });
    return found;
}

/**
 * Namespace reads: `X.member` and `window.X.member` (the guarded form used
 * everywhere in the webview: `if (window.AuraTimeline) window.AuraTimeline.state()`).
 *
 * The definition itself (`window.X = …`) is not a read — the left side of an
 * assignment is skipped — and the same `(name, member)` pair only counts once
 * per file: the edge is between two files, not two expressions.
 */
export function collectNamespaceUses(root: SyntaxNodeLike, names: ReadonlySet<string>): NamespaceUse[] {
    if (names.size === 0) return [];
    const found: NamespaceUse[] = [];
    const seen = new Set<string>();
    walk(root, node => {
        if (node.type !== 'member_expression') return;
        const object = node.childForFieldName('object');
        const property = node.childForFieldName('property');
        if (!object || !property) return;

        // `AuraSprites.ripple` → object is the namespace identifier.
        let name = object.type === 'identifier' && names.has(object.text) ? object.text : '';
        // `window.AuraSprites.ripple` → object is `window.AuraSprites`.
        if (!name) {
            const inner = memberParts(object);
            if (inner && GLOBAL_OBJECTS.includes(inner.object) && names.has(inner.property)) {
                name = inner.property;
            }
        }
        if (!name) return;
        if (property.type !== 'property_identifier' && property.type !== 'identifier') return;

        // `window.X = …` writes to a member_expression that is itself the object
        // of the assignment target (`window.X`), never read here — but guard
        // anyway so a `window.X.y` target cannot be mistaken for a use.
        const parent = (node as { parent?: SyntaxNodeLike }).parent;
        if (parent && parent.type === 'assignment_expression') {
            const target = parent.childForFieldName('left');
            if (target === node) return;
        }
        const key = `${name}.${property.text}`;
        if (seen.has(key)) return;
        seen.add(key);
        found.push({
            name,
            member: property.text,
            line: property.startPosition.row + 1,
        });
    });
    return found;
}

/** Label shown on the edge: `AuraSprites.ripple` (a member read, not always a call). */
export function globalUseLabel(use: { name: string; member: string }): string {
    return `${use.name}.${use.member}`;
}

/** Reverse a `globalUseLabel()` back to its namespace name (best effort). */
export function namespaceFromLabel(label: string): string {
    const dot = String(label || '').indexOf('.');
    return dot > 0 ? label.slice(0, dot) : '';
}
