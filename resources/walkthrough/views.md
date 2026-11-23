## Tabbed Views

Aura offers **11 visualization tabs** — each gives a different perspective on your codebase architecture.

### How to switch

Click any tab in the **tab bar** below the toolbar. The 3D graph pauses when you leave it and resumes when you return.

### Available views

| Tab | What it shows |
|-----|--------------|
| **✦ 3D Graph** | The interactive 3D force-directed dependency graph (default view) |
| **🏙️ City** | The same graph as a 2.5D city: a building per file, height = the metric you pick, footprint = its size, districts = its folder. Click to read, double-click to open, right-click for the Source / 3D Graph / Treemap menu, click a plate to drill in |
| **🗺️ Treemap** | Files as nested rectangles, sized by LOC or complexity, colored by a metric. Click a directory to zoom in, use the breadcrumb to zoom out |
| **🗑️ Matrix** | Dependency Structure Matrix (DSM) — an N×N grid where each colored cell is a dependency. Red cells with ↺ = circular dependency |
| **🎵 Chord** | Chord diagram — ribbons show dependency flows between groups. Thicker ribbon = more dependencies |
| **📊 Metrics** | Bar charts: LOC, complexity, fan-in, fan-out broken down by language and top files |
| **📈 Timeline** | Line chart of metric evolution over git history. Choose between LOC, file count, avg complexity, or total complexity |
| **📋 Table** | Sortable, filterable spreadsheet of all files with their metrics, including **Cog. max** (highest function cognitive complexity) and a **Trend** sparkline column |
| **🛡️ Risk** | Codebase health dashboard — risk score, distribution, churn × complexity matrix, complexity trends, bus factor, exportable report |
| **🏛️ Architecture** | Layer rules — violations grouped by rule, Ca/Ce/instability per layer, aggregated layer cycles, unlayered files, baseline and Markdown export |
| **🔗 Co-change** | Temporal co-change — files changing together without a direct dependency. Rows show co-changes, Jaccard, support; **Show on graph** adds virtual links |

### File lists

Treemap, Matrix, Metrics (the top-file bars), Table, Risk and Co-change share one interaction model:

- **Left click selects** the file. The row lights up and the graph keeps the selection, so the tab is yours to read, sort and compare — nothing opens.
- **Right click opens a menu**: **📄 Open source** (the editor), **✦ 3D Graph** (switches tab and selects the node), **🏙️ City** (switches tab and selects the building). <kbd>Esc</kbd> or a click elsewhere closes it.
- In the **City**, right-click a **building** for the same menu — with **🗺️ Treemap** instead of City, since you are already there. Empty ground keeps the native menu.

There is no double-click gesture any more: one click selects, the menu acts.

### Aura in the Explorer

The **Explorer** carries an **Aura** section under the file tree. It reads the file you are editing and puts the 3D detail panel's metrics next to the City inspector's risk block:

- **Identity and metrics** — file name, folder, `LOC · complexity · cognitive · fan-in / fan-out`. Click the name to open the file.
- **Flags**, only when true: `✏ modified`, `⚠ parse error`, `⟳ N cycles`, `☠ N dead exports`, `🏛 N violations`.
- **Risk** — the score, its bucket, the **written reasons**, and the **complexity sparkline** with its `▲ +N/30d` badge, drawn exactly like the Risk tab and the City inspector.
- **Connections** — the City inspector's relation map: **dependencies on the right in blue**, **dependents on the left in amber**, documentation references counted apart. Two neighbours that share a base name carry the folder that separates them. Every dot shows its path and edge type on hover and **opens the file** on click.
- **Actions** — **◫ View in** (3D Graph, City or Treemap — the panel opens on that file, on that tab) and **💥 Blast**.

It follows the editor: switching tabs rebuilds the card. With no analyzed file open it falls back to a repository summary — files, links, the riskiest files, and how many are in cycles, dead, in violation or uncommitted. It is fed by caches the host already keeps, so it works with the Aura panel closed.

### Exports

Every view carries an **📤 Export** in its bar, and the menu lists what *that* view can say: CSV of the cells (Treemap, Table), Markdown of the dependency list (Matrix), SVG of the diagram and CSV of the flows (Chord), CSV of the series (Timeline), CSV of the pairs (Co-change), Markdown of the summary (Metrics). The 3D Graph exports a PNG and an AI context, the City a PNG or a postcard. Risk and Architecture keep their one-click Markdown report. Each export offers **Save…** or **Copy to clipboard**.

### Files palette tips
- **☰ Files** opens the folder tree as a **floating card over the canvas**, not a column: the graph keeps its size and its camera, and the card is **dragged by its header** — the drop position is remembered
- **All** / **None** check or clear every top-level folder; **✕** closes the card and **☰ Files** reopens it where you left it

### Treemap tips
- Use the **Size** dropdown to choose what determines rectangle size (LOC, complexity, fan-in, fan-out)
- Use the **Color** dropdown to choose the color metric
- Click any directory to zoom into it; the breadcrumb trail at the top lets you navigate back
- Click a file cell to select it; right-click it for the Source / 3D Graph / City menu

### Matrix (DSM) tips
- **Group by**: Directory, Language, Architecture layer, or Community — separator lines mark group boundaries
- **Sort by**: Group, Name, Fan-in, or Fan-out
- Hover a cell to see source → target details. Hover a header to see file metrics.
- Red cells with ↺ indicate **circular dependencies**
- In **Architecture layer** mode, a forbidden dependency is a solid red cell with ✖, and a baselined one is amber
- Click a dependency cell to select the row's file; right-click it (or a row/column header) for the Source / 3D Graph / City menu

### Chord Diagram tips
- **Group by**: Directory, Language, Architecture layer, or Community
- The **🏷 Groups** panel on the left lists every group with its file count and its outgoing / incoming flows. **Click a row — or its arc, or its label — to isolate that group**: the rest of the diagram dims and stays dimmed until you click again, so the isolation survives the mouse leaving the circle. **Shift+click adds a group** to the isolation (Shift+click again removes it), so « these three modules » is one picture. Hovering crosses the two halves: a row lights its ribbons, a ribbon lights its two rows.
- **Each ribbon is a gradient from the source colour to the target colour** — the direction of a dependency reads at a glance, without the tooltip
- **Min flow** (≥ 2, 4, 8) hides the ribbons below the threshold: on a large repository the one-dependency tail is most of the drawing
- **Click a ribbon** to swap the panel for the concrete file pairs behind it — both directions. A pair follows the rule of every list here: **click focuses it in the 3D graph, right-click opens the shared menu**; **← groups** goes back
- In **Group by: Directory**, **↳** on a group row (or a double-click on its arc) drills one directory deeper and **↩** climbs back
- **SVG and CSV exports follow the screen**: they carry the drilled level, the min-flow threshold and the isolation — a dimmed ribbon is simply not in the file
- Hover an arc to highlight all its connections
- Hover a ribbon to see flows in both directions (A→B and B→A)
- Great for spotting unexpected coupling between modules

### Timeline Chart tips
- Requires **Time Travel** data — click the ⏱️ button first to scan git history
- Choose a metric: Lines of Code, File Count, Avg Complexity, or Total Complexity
- Hover a data point to see commit details (hash, message, author, date)
- The chart updates automatically as more commits are scanned

### City tips
- **Height** offers cognitive, cyclomatic, lines, fan-in, fan-out, PageRank and **risk** — so the skyline can be the risk score itself
- The **hot band** is always 5 % of the buildings (min 3, max 20) and carries the `#1…#N` badges; the rest of the city stays muted on purpose
- **Click** a building: white = selected, blue = it depends on, amber = depends on it, purple = both. The outlines follow
- **Double-click** opens the file; clicking a district plate drills into that folder, and the breadcrumb walks back out
- **Function granularity** makes one tower per function and the file becomes the district — the city scales with √n, the ground keeps a fixed grid
- **🗺️ Map** and **🌀 Warps** work here too, with their own position and their own saved poses; **📤 Export** gives a PNG or a 1600×900 postcard

### Risk Map tips
- Risk = `100 × (0.21·complexity + 0.18·centrality + 0.08·fan-out + 0.12·cycle + 0.12·dead-code + 0.09·rewrite + 0.06·recency + 0.06·frequency + 0.05·authors + 0.03·fixes)` — the structural half stays dominant, git history refines the ranking
- Documentation is outside architectural risk: docs are not scored and `doc-reference` links do not inflate fan-in or PageRank
- Framework/test exemptions do not count as dead code; they remain visible in the detail panel with their reason
- Complexity, fan-in, fan-out and churn are **percentile ranks inside your repository** — a score is a standing relative to *this* codebase
- Every row explains itself in plain words ("changed 29 times in 90 days (top 1%)"); hover for the full breakdown
- **History window**: pick 30 / 90 / 365 days — it drives churn, scoring and the explanations (also editable in the ⚙️ Settings modal / `auraVisualizer.riskWindow` setting)
- **📈 Complexity Trend** — per-file sparkline + least-squares slope per 30 days (R²). Files above `auraVisualizer.complexityTrendThreshold` (default 0.5) get a degrading badge; the Table has the same sortable **Trend** column
- The VS Code **status bar** mirrors the risk of the file you are editing and warns with `⚠ N hotspots in your changes` when your working tree touches high-risk files — click it to jump to that file here. Deleted files are ignored, and `auraVisualizer.statusBar` turns all Aura badges off at once
- Buckets: High ≥ 66, Medium 33–65, Low < 33
- Click any file in a list to select it and focus it in the 3D graph
- 📤 Export writes `.aura/risk-report.md` (reasons included)
- Churn, Recently Hot, and Bus Factor require the git **Time Travel** scan

### Status bar
Every object view ends on the same line: on the left what is selected (`path · LOC · ccx · in · out`, with ⌖ focus in the 3D graph and ↗ open in the editor), on the right what the view currently shows (`⌕ query · 142 / 303 files · 21 cycles · 91 % resolved`). A zero is not written, and an unmeasured resolution is not shown as 0 %. The selection side only appears where the objects carry no numbers of their own: Treemap, Chord and Matrix.

### Co-change tips
- Run **Time Travel** first — temporal co-change is computed from git commits.
- **Jaccard** = cochanges / (A commits + B commits − cochanges); **support** = share of analysed multi-file commits touching both.
- Select a 90-day, 365-day or 2-year window and a minimum score; renames are followed, giant commits (>50 files) are ignored.
- Click a file name to focus it. **Show on graph** adds virtual magenta links; the **🔗 Co-change** toolbar filter toggles them.
- Use `cochange > 0.6` in the query palette to highlight strongly coupled files.
