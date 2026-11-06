# Enforce Architecture Layers

Aura turns your intended architecture into a **fitness function**: a set of declarative constraints checked against the real dependency graph on every analysis.

## Declare the layers

Create `.aura/arch-rules.json` (the command seeds it from your top-level `src/` folders):

```json
{
  "version": 1,
  "edgeTypes": ["import", "import-type", "require", "dynamic-import", "extends", "implements", "function-call"],
  "layers": [
    { "name": "ui", "paths": ["src/ui/**"] },
    { "name": "application", "paths": ["src/app/**"] },
    { "name": "domain", "paths": ["src/domain/**"] },
    { "name": "infrastructure", "paths": ["src/infra/**"] }
  ],
  "rules": [
    { "id": "domain-pure", "from": "domain", "deny": ["ui", "application", "infrastructure"], "severity": "error" },
    { "id": "app-no-ui", "from": "application", "deny": ["ui"] },
    { "id": "slices", "type": "slices", "pattern": "src/features/*", "shared": ["src/shared/**"] },
    { "id": "no-layer-cycles", "type": "no-cycles" }
  ],
  "exceptions": ["src/domain/legacy/**"]
}
```

- **Layers** — first matching glob wins; unmatched files are reported as `unlayered`. Matching is **case-insensitive**, so `src/Agent/**` also captures `Src/Agent/…` — a rule written with the wrong casing used to match zero files silently.
- **Deny** — an edge in the forbidden direction is a violation (`"*"` = any other layer).
- **Slices** — sibling feature folders cannot import each other; `shared` globs are allowed.
- **No-cycles** — cycles in the aggregated file → layer graph.
- **Exceptions** — source globs exempted from every rule.

## Edit without hand-writing JSON

Use **⚙️ Edit rules** in the Architecture tab (or **⚙️ Settings → Architecture rules**). The structured editor lets you:

- add, reorder and rename layers; renaming a layer updates every rule that references it
- see **how many files each layer captures**, recomputed while you type — a row showing **⚠ 0 file** is a glob that matches nothing (usually a typo or a casing mismatch)
- toggle forbidden targets per deny rule (layers, `*`, `unlayered`) and pick `warn` / `error`
- edit slices, shared globs, `no-cycles`, exceptions and strict mode
- see validation from the same engine used by the analysis; **Save** stays disabled while the model is inconsistent, and its tooltip says exactly what to fix
- fall back to **Raw JSON (advanced)** for `edgeTypes` or manual ordering

**＋ Add layer** creates a ready-to-save layer (`layer-1` → `src/layer-1/**`) with its name selected, so Save never goes grey before you type. Deleting a layer also removes the deny rules that started from it and drops it from every `deny` list — the editor cannot be left holding a rule that points at nothing.

## Read the result

| Surface | What you get |
|---|---|
| **🏛️ Architecture** tab | Violations grouped by rule, layer table with **Ca / Ce / instability**, aggregated cycles and unlayered files |
| **Architecture layers** heatmap | Nodes colored by layer; forbidden edges in red, baselined edges amber |
| **Status bar** | The active file's layer, or `🏛️ N arch violations` with the offending imports in the tooltip |
| **Detail panel** | Layer + every outgoing violation with severity, target and link types |
| **Matrix / Chord** | Group by **Architecture layer**; violating DSM cells turn red with ✖ |

Documentation stays **outside** the model: `.md` nodes and `doc-reference` edges are never evaluated.

## Adopt progressively

Use **📌 Baseline violations** in the Architecture tab (or the command palette) to freeze legacy violations in `.aura/arch-baseline.json`. From then on only **new** violations alert — exactly like dependency-cruiser or ArchUnit. **↺ Reset baseline** clears it.

Saving the rules re-evaluates immediately: no re-parse, no re-scan.
