## Tabbed Views

Aura offers **9 visualization tabs** — each gives a different perspective on your codebase architecture.

### How to switch

Click any tab in the **tab bar** below the toolbar. The 3D graph pauses when you leave it and resumes when you return.

### Available views

| Tab | What it shows |
|-----|--------------|
| **✦ 3D Graph** | The interactive 3D force-directed dependency graph (default view) |
| **🗺️ Treemap** | Files as nested rectangles, sized by LOC or complexity, colored by a metric. Click a directory to zoom in, use the breadcrumb to zoom out |
| **🗑️ Matrix** | Dependency Structure Matrix (DSM) — an N×N grid where each colored cell is a dependency. Red cells with ↺ = circular dependency |
| **🎵 Chord** | Chord diagram — ribbons show dependency flows between groups. Thicker ribbon = more dependencies |
| **📊 Metrics** | Bar charts: LOC, complexity, fan-in, fan-out broken down by language and top files |
| **📈 Timeline** | Line chart of metric evolution over git history. Choose between LOC, file count, avg complexity, or total complexity |
| **📋 Table** | Sortable, filterable spreadsheet of all files with their metrics, including **Cog. max** (highest function cognitive complexity) and a **Trend** sparkline column |
| **🛡️ Risk** | Codebase health dashboard — risk score, distribution, churn × complexity matrix, complexity trends, bus factor, exportable report |
| **🔗 Co-change** | Temporal co-change — files changing together without a direct dependency. Rows show co-changes, Jaccard, support; **Show on graph** adds virtual links |

### Treemap tips
- Use the **Size** dropdown to choose what determines rectangle size (LOC, complexity, fan-in, fan-out)
- Use the **Color** dropdown to choose the color metric
- Click any directory to zoom into it; the breadcrumb trail at the top lets you navigate back

### Matrix (DSM) tips
- **Group by**: Directory, Language, or Community — separator lines mark group boundaries
- **Sort by**: Group, Name, Fan-in, or Fan-out
- Hover a cell to see source → target details. Hover a header to see file metrics.
- Red cells with ↺ indicate **circular dependencies**
- Click a dependency cell to open the source file

### Chord Diagram tips
- **Group by**: Directory, Language, or Community
- Hover an arc to highlight all its connections
- Hover a ribbon to see flows in both directions (A→B and B→A)
- Great for spotting unexpected coupling between modules

### Timeline Chart tips
- Requires **Time Travel** data — click the ⏱️ button first to scan git history
- Choose a metric: Lines of Code, File Count, Avg Complexity, or Total Complexity
- Hover a data point to see commit details (hash, message, author, date)
- The chart updates automatically as more commits are scanned

### Risk Map tips
- Risk = `100 × (0.30·complexity + 0.20·fan-in + 0.10·fan-out + 0.15·cycle + 0.15·dead-code + 0.10·churn)`
- Documentation is outside architectural risk: docs are not scored and `doc-reference` links do not inflate fan-in or PageRank
- Framework/test exemptions do not count as dead code; they remain visible in the detail panel with their reason
- Complexity, fan-in, fan-out and churn are **percentile ranks inside your repository** — a score is a standing relative to *this* codebase
- Every row explains itself in plain words ("changed 29 times in 90 days (top 1%)"); hover for the full breakdown
- **History window**: pick 30 / 90 / 365 days — it drives churn, scoring and the explanations (also editable in the ⚙️ Settings modal / `auraVisualizer.riskWindow` setting)
- **📈 Complexity Trend** — per-file sparkline + least-squares slope per 30 days (R²). Files above `auraVisualizer.complexityTrendThreshold` (default 0.5) get a degrading badge; the Table has the same sortable **Trend** column
- The VS Code **status bar** mirrors the risk of the file you are editing and warns with `⚠ N hotspots in your changes` when your working tree touches high-risk files — click it to jump to that file here
- Buckets: High ≥ 66, Medium 33–65, Low < 33
- Click any file in a list to select it and focus it in the 3D graph
- 📤 Export Report writes `.aura/risk-report.md` (reasons included)
- Churn, Recently Hot, and Bus Factor require the git **Time Travel** scan

### Co-change tips
- Run **Time Travel** first — temporal co-change is computed from git commits.
- **Jaccard** = cochanges / (A commits + B commits − cochanges); **support** = share of analysed multi-file commits touching both.
- Select a 90-day, 365-day or 2-year window and a minimum score; renames are followed, giant commits (>50 files) are ignored.
- Click a file name to focus it. **Show on graph** adds virtual magenta links; the **🔗 Co-change** toolbar filter toggles them.
- Use `cochange > 0.6` in the query bar to highlight strongly coupled files.
