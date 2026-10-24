## Explore the Graph

Each **node** is a file. Each **edge** is a dependency (import, include, function call, inheritance).
Node size reflects lines of code. Edge color reflects dependency type.

Aura supports **19 languages**: C, C++, JavaScript, TypeScript, Python, Java, Go, Rust, Kotlin, Ruby, Swift, C#, PHP, Vue, Bash, Lua, CSS, HTML, and Markdown / plain-text docs. Code files are parsed with Tree-sitter AST analysis; Vue single-file components are scanned for their `<script>` / `<style>` imports.
Filter buttons at the bottom show only languages present in your project.

**Import aliases** — Aura reads `tsconfig.json`/`jsconfig.json` (`baseUrl` + `paths`), static Vite/webpack `resolve.alias` entries and Python `src/` layouts, so `@/components`, `~/lib` and `@app/*` imports resolve to real files instead of creating false orphans.

**Edge confidence** — every resolved edge carries a 0–1 score (1.0 exact/alias, 0.9 extension, 0.8 suffix, 0.6 basename, 0.5 ambiguous). Filter weaker links with the **Edge confidence** selector and check the badge in the detail panel.

**Mouse controls:**
- 🖱️ **Click** — Select a node, see details in the side panel
- 🖱️ **Double-click** — Open the file in VS Code
- 🖱️ **Right-click** — Pin focus on a file and its neighbors (depth 1–5)
- 🖱️ **Shift+Right-click** — Blast radius — show all files impacted by this one, colored by depth
- 🖱️ **Shift+Click** — Multi-select several nodes for aggregate stats
- 🖱️ **Scroll** — Zoom in/out
- 🖱️ **Drag** — Rotate the 3D view
- 🖱️ **Hold left / right click** (pilot mode) — Fly forward / backward while looking around

**Toolbar buttons:**
- **👁 Follow** — fly the camera to the active editor file and select it exactly like a click (fixed 120-unit close-up). A manual camera move pauses following until you click 👁 again.
- **📤 Export** — guided AI context export: Markdown or JSON, selectable sections and token budget.
- **Labels** (`L`) — Show/hide file names above nodes
- **DAG** (`D`) — Hierarchical top-down layout
- **Orphans** (`O`) — Highlight disconnected files in red
- **Groups** (`G`) — Cluster files by directory
- **✏️ Dirty** — Show only files with uncommitted changes (git working tree) — those files also wear a thin amber ring by default
- **📝 Notes** — Show/hide the note indicators — annotated files wear a pulsing note-colored ring + dot
- **Recenter** (`F`) — Fit the entire graph in view and clear the current selection, glow and detail panel
- **🗺️ Map** — Toggle the minimap — a real-time overview that rotates with the camera. Drag inside to pan the viewport.
- **🌀 Warps** — Named camera bookmarks — capture the current view (📌) and fly back to it, quick slots on `Alt+Shift+1–9`
- **🚀 Pilot** (`Space`) — Free flight: `WASD`/`Q`/`E` to move, mouse to look, hold left/right click to advance/retreat

**Detail panel** — Click any node to see: file path, LOC, complexity, fan-in/out, symbols (functions, structs, enums), dependencies, dependents, and — when the file has uncommitted changes — its **Git state** (modified, staged, untracked, renamed). Function-call links show the actual function name (e.g. `helper()`) next to the target file, with a green `×N` badge when several distinct call sites connect the same pair of files. In the 3D Graph itself, function-call edges are **scaled in width** by call count and **hovering an edge** reveals a tooltip listing the top caller → callee pairs. Every file also has a **📝 Note** section — write an annotation, pick one of five colors and Save: the node gains a pulsing note-colored ring + dot in the graph (toggle them all with the **📝 Notes** toolbar button).

**File Explorer** — Toggle the tree panel to browse files by directory. Each directory has a **checkbox** to filter it in/out of the graph. Use **All** / **None** buttons for batch selection. Files containing functions show a **chevron** — click it to expand the list of every function in the file; click any function to **open the file at that exact line**.

**📄 Documentation nodes** — Markdown, `.txt` and `.rst` files are first-class nodes, hidden by default. Click the **📄 Docs** toolbar button to show them. Thin dotted `doc-reference` edges automatically connect each doc file to the code files it mentions (by symbol name or basename) — these edges are informational and do not pollute fan-in/out metrics. AI assistants can full-text-search docs through the `search_docs` MCP tool.

**Instant startup** — The graph is cached in `.aura/graph.db`. On next launch, a fingerprint (`git HEAD` + settings + parser version + file size/mtime list) skips re-parsing entirely when nothing changed; otherwise only added/modified/deleted files are re-parsed and sent as a delta.
