## Heatmaps

Color every node by a metric to spot hotspots instantly.

**Available modes:**
- 🟢→🔴 **Complexity** — Cyclomatic complexity (branching, loops)
- �→🔴 **Cognitive** — Highest per-function cognitive complexity in the file (nesting + boolean sequences)
- 🟢→🔴 **Fan-in** — How many files depend on this file
- 🟢→🔴 **Fan-out** — How many files this file depends on
- 🟢→🔴 **Lines of Code** — File size
- ⏱→🔴 **Churn (commits)** — Git commit count per file (requires Time Travel scan)
- 🔗 **Co-change** — strongest temporal-coupling Jaccard score per file (requires Time Travel scan)
- 🟢→🔴 **Last Modified** — File modification time (most recently changed = red)
- 🧩 **Communities** — Architectural modules detected by Louvain algorithm

Blue = low, Red = high. The legend bar shows the value range.

### Communities mode

The **Communities** heatmap colors nodes by detected architectural modules (Louvain algorithm). A floating **palette** shows all communities with their hub name, color, and file count. Click a community to toggle it on/off — unselected communities are grayed out.
