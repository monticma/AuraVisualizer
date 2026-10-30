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
- 🏛️ **Architecture layers** — Layer colors from `.aura/arch-rules.json`; forbidden edges are red, baselined ones amber
- 🧩 **Communities** — Code-only architectural modules detected by Louvain

Blue = low, Red = high. The legend bar shows the value range.

### Architecture layers mode

Requires a rules file (see the **Enforce Architecture Layers** walkthrough step). Each node takes its layer color; files outside every layer are dimmed, documentation stays neutral, and forbidden file pairs are drawn as thick red edges (amber when frozen in the baseline). This is the fastest way to see an architectural erosion: the red edges are the exact imports the rule forbids.

The floating palette switches between **🧩 Communities** and **🏛️ Layers** with its header combobox (it mirrors the heatmap selector). In Layers mode the cards follow the rule order — so each swatch matches the graph, the legend and the Architecture tab — and clicking one hides that layer; **All** / **None** apply to the list currently shown. An extra **Unlayered** card appears when files fall outside every layer. Selections are saved with the view state in both modes. Each layer card also has a **✨ Ask Aura** action that sends its globs, members, coupling, violations and cycles to VS Code Chat (the **Unlayered** bucket has no ask action).

### Communities mode

The **Communities** heatmap colors nodes by the shared code-only Louvain snapshot. Documentation and `doc-reference` edges are excluded: docs remain explorable with **yellow labels**, but do not influence modules, fan-in, PageRank or risk.

A floating **palette** uses readable cards showing the full hub path, the code file count and the number of files currently visible after filters. Click a card to toggle its community; unselected communities are grayed out. Use **✏️ Rename** to persist a custom label (empty restores the hub path) and **✨ Ask Aura** to send the exact membership as the authoritative scope. The header combobox switches the same palette to **🏛️ Layers**.

### Centrality halos 💠

The separate **💠 Centrality** toolbar button shows a soft violet halo around the top 10% PageRank files. It is off by default and saved with the view state; documentation is outside the structural centrality graph.
