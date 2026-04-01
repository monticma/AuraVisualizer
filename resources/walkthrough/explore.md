## Explore the Graph

Each **node** is a file. Each **edge** is a dependency (import, include, function call, inheritance).
Node size reflects lines of code. Edge color reflects dependency type.

Aura supports **10 languages**: C, JavaScript, TypeScript, Python, Java, Go, Rust, CSS, HTML, and C headers — all parsed with Tree-sitter AST analysis.
Filter buttons at the bottom show only languages present in your project.

**Mouse controls:**
- 🖱️ **Click** — Select a node, see details in the side panel
- 🖱️ **Double-click** — Open the file in VS Code
- 🖱️ **Right-click** — Pin focus on a file and its neighbors (depth 1–5)
- 🖱️ **Shift+Right-click** — Blast radius — show all files impacted by this one, colored by depth
- 🖱️ **Shift+Click** — Multi-select several nodes for aggregate stats
- 🖱️ **Scroll** — Zoom in/out
- 🖱️ **Drag** — Rotate the 3D view

**Toolbar buttons:**
- **Labels** (`L`) — Show/hide file names above nodes
- **DAG** (`D`) — Hierarchical top-down layout
- **Orphans** (`O`) — Highlight disconnected files in red
- **Groups** (`G`) — Cluster files by directory
- **Recenter** (`F`) — Fit the entire graph in view

**Detail panel** — Click any node to see: file path, LOC, complexity, fan-in/out, symbols (functions, structs, enums), dependencies, and dependents.
