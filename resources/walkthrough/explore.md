## Explore the Graph

Each **node** is a file. Each **edge** is a dependency (import, include, function call).
Node size reflects lines of code. Edge color reflects dependency type.

**Mouse controls:**
- 🖱️ **Click** — Select a node, see details in the side panel
- 🖱️ **Double-click** — Open the file in VS Code
- 🖱️ **Right-click** — Pin focus on a file and its neighbors (depth 1–5)
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
