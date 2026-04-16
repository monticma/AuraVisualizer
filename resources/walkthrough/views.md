## Tabbed Views

Aura offers **7 visualization tabs** — each gives a different perspective on your codebase architecture.

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
| **📋 Table** | Sortable, filterable spreadsheet of all files with their metrics |

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
