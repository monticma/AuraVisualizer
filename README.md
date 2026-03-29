# Aura Visualizer

Visualize your codebase in 3D directly inside VS Code — interactive dependency graph with force-directed layout.

## Features

- **3D Force-Directed Graph** — Files as nodes, dependencies as edges
- **Multi-language support** — C/H, JavaScript, TypeScript, Python, CSS, HTML
- **Cross-file function calls** — Detects C function calls across files
- **Interactive exploration** — Click, hover, zoom, rotate, search
- **Heatmap modes** — Complexity, fan-in/out, lines of code, last modified
- **File explosion** — Expand a node to see its internal symbols
- **Path finder** — Find shortest dependency path between two files
- **Directory clustering** — Collapse directories into meta-nodes
- **Incremental updates** — Graph updates when you save a file
- **Integrated panel** — Click a node to see file details & dependencies

## Usage

1. Open a project in VS Code
2. Press `Ctrl+Shift+A` (or `Cmd+Shift+A` on Mac)
3. Explore your codebase in 3D

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Aura: Visualize Codebase | `Ctrl+Shift+A` | Open the 3D visualization |
| Aura: Refresh | — | Re-analyze the workspace |
| Aura: Focus Current File | — | Highlight the active file in the graph |
| Aura: Export Graph for AI | — | Export graph data for AI analysis |
