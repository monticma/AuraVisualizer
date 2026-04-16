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
- **🗺️ Map** — Toggle the minimap — a real-time overview that rotates with the camera. Drag inside to pan the viewport.

**Detail panel** — Click any node to see: file path, LOC, complexity, fan-in/out, symbols (functions, structs, enums), dependencies, and dependents. Function-call links show the actual function name (e.g. `helper()`) next to the target file.

**File Explorer** — Toggle the tree panel to browse files by directory. Each directory has a **checkbox** to filter it in/out of the graph. Use **All** / **None** buttons for batch selection.

**Instant startup** — The graph is cached in `.aura/graph.db`. On next launch, it loads instantly from the database while a background re-scan picks up any changes.
