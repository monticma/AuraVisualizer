## Heatmaps

Color every node by a metric to spot hotspots instantly.

**Available modes:**
- 🟢→🔴 **Complexity** — Cyclomatic complexity (branching, loops)
- 🧠→🔴 **Cognitive** — Highest per-function cognitive complexity in the file (nesting + boolean sequences)
- 🟢→🔴 **Fan-in** — How many files depend on this file
- 🟢→🔴 **Fan-out** — How many files this file depends on
- 🟢→🔴 **Lines of Code** — File size
- ⏱→🔴 **Churn (commits)** — Git commit count per file (requires Time Travel scan)
- 🔗 **Co-change** — strongest temporal-coupling Jaccard score per file (requires Time Travel scan)
- 🟢→🔴 **Last Modified** — File modification time (most recently changed = red)
- 🧩 **Communities** — Code-only architectural modules detected by Louvain

Blue = low, Red = high. The legend bar shows the value range.

### Communities mode

The **Communities** heatmap colors nodes by the shared code-only Louvain snapshot. Documentation and `doc-reference` edges are excluded: docs remain explorable with **yellow labels**, but do not influence modules, fan-in, PageRank or risk.

A floating **palette** uses readable cards showing the full hub path, the code file count and the number of files currently visible after filters. Click a card to toggle its community; unselected communities are grayed out. Use **✏️ Rename** to persist a custom label (empty restores the hub path) and **✨ Ask Aura** to send the exact membership as the authoritative scope.

### Centrality halos 💠

The separate **💠 Centrality** toolbar button shows a soft violet halo around the top 10% PageRank files. It is off by default and saved with the view state; documentation is outside the structural centrality graph.
