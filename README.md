<h1 align="center">✦ Aura Visualizer</h1>

<p align="center">
  <strong>Visualize your codebase in 3D directly inside VS Code</strong><br/>
  Interactive dependency graph &bull; Force-directed layout &bull; AI-ready
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Languages-C%20%7C%20C%2B%2B%20%7C%20JS%20%7C%20TS%20%7C%20Python%20%7C%20Java%20%7C%20Go%20%7C%20Rust%20%7C%20Kotlin%20%7C%20Ruby%20%7C%20Swift%20%7C%20C%23%20%7C%20PHP%20%7C%20Vue%20%7C%20Bash%20%7C%20Lua%20%7C%20CSS%20%7C%20HTML%20%7C%20Markdown-blue" alt="Languages" />
  <img src="https://img.shields.io/badge/VS%20Code-%3E%3D1.95-007ACC" alt="VS Code" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

<p align="center">
  <img src="resources/AuraScreen.png" alt="Aura 3D Visualizer — interactive dependency graph" width="900" />
</p>

---

## What's New in 1.4.0

- **`@aura` in VS Code Chat** — ask about architecture, hotspots, impact, dependency paths or natural-language filters, with clickable files and contextual actions.
- **Follow editor 👁** — switching tabs flies the camera to the active file and selects it exactly like a click, at a fixed close-up distance.
- **Guided AI context export 📤** — Markdown or JSON, selectable sections (modules, contracts, hotspots, cycles, dead code) and an explicit token budget.
- **Architecture report** — deterministic Markdown + Mermaid, optionally enriched with an AI narrative.
- **CSV/JSON metrics** — per-file LOC, complexity, fan-in/out, churn, authors and risk for spreadsheets or dashboards.
- **Stale notes, PNG export and unified save/copy** — shareable outputs and notes that tell you when they need review.

---

## Features

### 3D Force-Directed Graph

Files become interactive 3D nodes, dependencies become edges. The graph uses physics simulation to arrange nodes organically — highly connected files cluster together, isolated files drift to the periphery.

- **Node size** scales with lines of code (cube root)
- **Edge colors** reflect dependency type (import, include, function call, etc.)
- **Directional arrows** show dependency direction
- **Animated particles** flow along highlighted paths

### Multi-Language Support

Powered by **Tree-sitter** AST parsing (WASM) for accurate, structural code analysis.

| Language | Extensions | Color |
|----------|-----------|-------|
| C source | `.c` | 🔷 Light blue |
| C header | `.h` | 📘 Sky blue |
| C++ | `.cpp`, `.cc`, `.cxx`, `.hpp`, `.hxx`, `.hh` | 🔹 Steel blue |
| JavaScript | `.js`, `.jsx` | 🟡 Yellow |
| TypeScript | `.ts`, `.tsx` | 🔵 Blue |
| Python | `.py` | 🟢 Green |
| Java | `.java` | 🔴 Red |
| Go | `.go` | 🩵 Cyan |
| Rust | `.rs` | 🟠 Orange |
| Kotlin | `.kt`, `.kts` | 🟣 Purple |
| Ruby | `.rb` | ❤️ Red |
| Swift | `.swift` | 🟥 Coral |
| C# | `.cs` | 💜 Violet |
| PHP | `.php` | 🐘 Periwinkle |
| Vue | `.vue` | 💚 Vue green |
| Bash | `.sh`, `.bash` | 🐚 Lime |
| Lua | `.lua` | 🌙 Indigo |
| CSS | `.css` | 🟣 Purple |
| HTML | `.html` | 🟧 Coral |
| Documentation | `.md`, `.markdown`, `.txt`, `.rst` | 📄 Slate |

Cross-file **function calls** are detected for C, C++, JS/TS, Python, Java, Go, Rust, Kotlin, Ruby, Swift, C#, PHP, and Lua.
**Inheritance edges** (`extends` / `implements`) are detected for JS/TS, Python, Java, Go (struct embedding), Rust (trait impl), Kotlin, Swift (protocol conformance), C#, and PHP.
Language filter buttons are **dynamic** — only languages present in the current analysis are shown.

### Import Resolution & Aliases

Imports are resolved through the project's real configuration, not just relative paths:
- **`tsconfig.json` / `jsconfig.json`** — `compilerOptions.baseUrl` and `paths` (including `@/*`, `~/lib/*`, `@app/*` and simple relative `extends` chains)
- **Vite / webpack** — static `resolve.alias` entries such as `'@': path.resolve(__dirname, './src')`
- **Python `src/` layout** — `app.models.user` → `src/app/models/user.py` (or `__init__.py`)
- Historical fallbacks stay available: relative imports, extension/index probing, vendored suffix matches and basename matching.

This removes the false “orphan” nodes that aliased imports used to create. The same resolver is used by the history worker, so temporal deltas stay consistent with the current graph.

### Edge Confidence

Every edge carries a confidence score: **1.0** exact/relative/alias, **0.9** extension or index, **0.8** vendored suffix, **0.6** basename, **0.5** ambiguous (multiple candidates). Function-call edges are **0.8** when the target is unique and **0.5** when several definitions match; heritage edges are **0.9**. Use the **Edge confidence** selector in the toolbar to hide low-confidence links, inspect the per-edge badge in the detail panel, or read the `edges` array (with confidence) from the `aura://node` MCP resource. Legacy databases default to **1.0**.

### PageRank Centrality 💠

Aura computes a **PageRank** centrality over the structural **code** graph (`source → target` = "depends on"; damping `0.85`, 40 iterations, normalized scores): a file is central when the files that depend on it are themselves central, not just numerous. Documentation and `doc-reference` links are excluded from this graph and from fan-in.

- **Detail panel** — the **Centrality** metric shows the PageRank score (`0.0042`, hover for context)
- **💠 Centrality** toolbar button — shows a soft violet halo around the **top 10%** most central code files; off by default and persisted in the view state
- **Risk score** — optional `auraVisualizer.riskCentrality` setting replaces the fan-in percentile with the PageRank centrality percentile (same `0.20` weight); disabled by default so existing scores are unchanged
- **MCP / `resolve_context`** — ranking uses PageRank when available, falling back to fan-in for older databases
- Halos are deliberately subtle: dirty rings, note rings, selection glow and labels keep their existing visual priority

### Interactive Exploration

| Action | Effect |
|--------|--------|
| **Click** | Select node, show detail panel, focus camera |
| **Double-click** | Open file in VS Code editor |
| **Right-click** | Pin focus — isolate file + neighbors up to N depth |
| **Shift+Right-click** | Blast radius — show impact (all dependents) with depth coloring |
| **Shift+Click** | Multi-select — aggregate stats for multiple files |
| **Scroll** | Zoom in / out |
| **Drag** | Rotate the 3D view |
| **Background click** | Clear all selections |

### Detail Panel 🗂️

Click a file node to open a collapsible detail panel:

- **📋 File details** groups the file metrics, **Ask Aura** actions and the **📝 Note** editor in one foldable section
- **Symbols**, **Dependencies** and **Dependents** are collapsible too, and render as readable cards (name/signature/metrics on separate lines, path + type + confidence for edges)
- Empty sections are hidden automatically — no empty Dependents block, no Symbols block for a file without symbols
- Section open/closed state is kept while the webview stays open

### Heatmap Modes

Color every node by a metric to spot hotspots at a glance. Press `H` to cycle through:

| Mode | Description |
|------|-------------|
| **Off** | Color by programming language |
| **Complexity** | Cyclomatic complexity (branching, loops) |
| **Cognitive** | Highest per-function cognitive complexity in the file — supported for JS/TS/TSX, Python, C/C++, Java, Go, Rust, Kotlin, Swift, C#, PHP, Lua and Bash |
| **Fan-in** | How many files depend on this file |
| **Fan-out** | How many files this file depends on |
| **Lines of Code** | File size |
| **Churn (commits)** | Git commit count per file — requires Time Travel scan |
| **Co-change** | Strongest temporal-coupling Jaccard score per file — requires Time Travel scan |
| **Last Modified** | File modification time (most recently changed = red) |
| **Communities** | Architectural modules detected by Louvain algorithm |

Blue = low, Red = high. A legend displays the value range.

### Community Detection

The **Communities** heatmap mode uses a single shared **code-only Louvain snapshot** computed by the extension and reused by the webview, `@aura` and MCP. Documentation nodes and `doc-reference` edges remain visible in the graph for exploration, but they are excluded from communities, fan-in, PageRank and risk: documentation is not architecture.

Each community gets a unique color and an automatic label equal to the **full path of its hub file** (highest structural fan-in, deterministic tie-break). The palette uses readable cards showing:
- color swatch, label and hub path
- code file count, plus the currently visible count when filters hide members (`31 files · 18 visible`)
- **✏️ Rename** — a custom label persisted by member-set hash; empty restores the hub path
- **✨ Ask Aura** — sends the exact member files as the authoritative scope
- **All** / **None** buttons for batch selection

Unselected communities are grayed out (nodes + links), just like pin focus. `Others` collects isolated code files.

### Blast Radius

**Shift+Right-click** on any file to see its impact radius — all files that transitively depend on it. Nodes are colored by depth of impact:

| Depth | Color |
|-------|-------|
| Source | White (orange glow halo) |
| 1 | Red |
| 2 | Orange |
| 3 | Yellow |
| 4 | Yellow-green |
| 5 | Green |

Use the **Depth slider** (1–5) or keys `1`–`5` to control the blast radius depth.

### File Explosion

Expand any file into its internal symbols — functions, structs, enums, macros. Each symbol becomes its own node, connected to the parent file. Double-click a symbol to jump to that exact line in the editor.

### Path Finder

Find the shortest dependency path between any two files. Click **Path** in the toolbar then select source and destination. The path lights up with animated particles.

### Dead Code Detection ☠️

Press `X` or click the **Dead Code** button. Files with unused exports are highlighted in orange-to-red gradient. The detail panel lists each unused export with a ⚠️ label.

### Risk Map 🛡️

Open the **🛡️ Risk** tab for a codebase health dashboard built on a transparent, explainable risk score:

`risk = 100 × (0.30·complexity + 0.20·fan-in + 0.10·fan-out + 0.15·cycle + 0.15·dead-code + 0.10·churn)`

Documentation files are outside the architectural risk model: they are not scored, and `doc-reference` links do not inflate fan-in or PageRank. The doc links remain visible in the graph for exploration.

Complexity, fan-in, fan-out and churn are **percentile ranks inside your repository** (0 = lowest file, 1 = highest), so a score is a standing relative to *your* codebase rather than an absolute threshold — a 72 means the same thing in a 50-file project and in a 5 000-file one. Cycle and dead-code are ratios by nature.

- **Codebase Health** — overall health score (`100 − average risk`), plus the most risky and most connected files
- **Risk Distribution** — high / medium / low buckets with percentages
- **High / Medium / Low files** — collapsible lists (▼/▶ arrows); each file states *why* it scores that way ("changed 29 times in 90 days (top 1%)", "12 files depend on it"), with the full breakdown on hover. Click a file to select it and focus it in the 3D graph.
- **History window** — pick 30 / 90 / 365 days of git history; it drives churn, scoring and the explanations. Also available as the `auraVisualizer.riskWindow` workspace setting, shared with the status bar and the MCP `get_hotspots` tool
- **Rename-aware churn** — files moved with `git mv` keep their history: churn, bus factor and the written explanations follow the rename (chained renames collapsed, latest one wins)
- **🛡️ Status bar** — the risk of the file you are editing (`Risk 72 · top 8%`, written reasons in the tooltip); it switches to **`⚠ N hotspots in your changes`** when your working tree touches high-risk files. Click to jump to the file in the Risk tab
- **📈 Risk Trend** — average complexity over git history (structural risk proxy)
- **🔥 Recently Hot** — files modified most in the last 30 days
- **📊 Churn × Complexity** — scatter matrix (log scale) spotting files that are both complex and heavily churned (red = hot)
- **👤 Bus Factor** — files touched by a single developer (≥ 3 commits in the window)
- **📤 Export Report** — writes a Markdown report to `.aura/risk-report.md`, reasons included
- **📷 PNG** — exports the 3D graph at ×1/×2/×4 with current or transparent background, optional watermark, and a unified save dialog

Risk buckets: **High ≥ 66**, **Medium 33–65**, **Low < 33**. Churn is measured as commits per file and requires the git **Time Travel** scan.

### Complexity Trends 📈

The **Risk** dashboard and the **Table** tab add a per-file **complexity trend** derived from the commit deltas already collected by **Time Travel**:

- **Sparkline** — complexity across the file's changed commits, colored red when degrading and green when improving
- **Slope + R²** — linear regression of complexity over time; the badge shows the slope **per 30 days**
- **Degrading badge** — shown when the slope crosses `auraVisualizer.complexityTrendThreshold` (default `0.5`) and the fit is meaningful (`R² ≥ 0.3`)
- **Risk dashboard** — a collapsible **📈 COMPLEXITY TREND** section ranks the top files by slope; click a row to focus it in the graph
- **Rename-aware** — historical paths follow git renames and are merged under the current file id, so trend rows focus the right node
- **Table** — sortable **Trend** column with the same sparkline/badge
- Short histories are safe: one sample gives `—`, never `NaN`; removed files are dropped and a re-add starts a fresh series

### Temporal Co-change 🔗

Open the **🔗 Co-change** tab after a **Time Travel** scan to find files that keep changing in the same commits **without a direct dependency** — implicit contracts (API + client, test + implementation, shared configuration…).

- **Jaccard score** — `cochanges / (A commits + B commits − cochanges)`, plus support (share of analysed multi-file commits touching both)
- **Window & threshold** — 90 days / 365 days / 2 years, minimum score 0.2–0.6
- **Rename-aware** — `git mv` history follows the current path; deletions and giant commits (>50 files) are ignored
- **Show on graph** — adds virtual magenta co-change links for the strongest pairs; the **🔗 Co-change** filter toggles them
- **Heatmap + query** — color files by their strongest coupling score or run `cochange > 0.6`
- **MCP / AI** — the `get_cochange` tool exposes the same persisted pairs

### Git Working Tree ✏️

Aura reads `git status` and shows what you are working on right now:

- **Dirty rings** — files with uncommitted changes wear a thin amber ring in the 3D graph; the detail panel adds a **Git** line with the exact state (modified / staged / untracked / renamed / conflicted)
- **✏️ Dirty filter** — toolbar button showing only files with uncommitted changes (nodes *and* links)
- **Query flag** — `dirty` works in the query bar: `dirty AND complexity > 20`
- **Status bar alert** — when your changes touch high-risk files, the status bar switches to `⚠ N hotspots in your changes` (see Risk Map)

Everything refreshes automatically on save (debounced, no shell involved).

### File Notes 📝

Annotate any file with a personal, color-coded note — a marker that follows you through the graph:

- **Write a note** — click a file node: the detail panel shows a **📝 Note** section with a text area (up to 2 000 characters) and five colors (yellow, red, blue, green, purple). **Save** applies it, **Delete** removes it
- **Pulsing indicator** — annotated files wear a note-colored ring + dot in the graph, animated (breathing) so they stand out at any zoom level; the ring nests inside the amber dirty ring when a file is both annotated and modified
- **📝 Notes toggle** — toolbar button next to ✏️ Dirty: shows / hides all note indicators; the choice is saved with your view state
- **Stale notes** — when a file changes after its note was written, the note header shows **⚠️ À revoir**, **✓ Mark reviewed** refreshes its timestamp, the **📝 Notes** button shows the exact count and the **⚠️ Stale** filter isolates those files
- **Query flag** — `hasnote` works in the query bar: `hasnote AND complexity > 20`; use `stalenote` for notes older than their file
- **Storage** — notes are stored in `.aura/annotations.json`, local to the workspace (not committed)

### Circular Dependencies 🔄

Press `C` or click the **Cycles** button. All nodes involved in circular dependency chains are highlighted in orange. The detail panel shows the full cycle paths.

### Orphan Detection

Press `O` to highlight isolated files (zero incoming and outgoing dependencies) in red. Useful for finding dead files that nothing references.

### DAG Mode

Press `D` to switch from physics-based layout to a hierarchical top-down **Directed Acyclic Graph** layout. Entry-point files float to the top, leaf dependencies sink to the bottom.

### Directory Clustering

Press `G` to group files by directory. Directories become translucent spheres containing their files. Click a cluster to expand or collapse it.

### Multi-Selection

Hold `Shift` and click multiple nodes to select a group. The detail panel shows:

- Combined LOC and average complexity
- Language breakdown
- Internal links between selected files
- List of all selected files

### Minimap 🗺️

Toggle with the **🗺️ Map** button in the toolbar. A floating minimap displays a real-time overview of all nodes, projected from the camera's perspective. The white rectangle shows the current viewport.

- **Rotate** the 3D view — the minimap rotates in sync
- **Drag** inside the minimap — pan the camera in the 3D view
- **Drag the header** — reposition the minimap panel
- **Close** with the ✕ button or toggle the toolbar button

### Warp Points 🌀

Save named camera bookmarks of the 3D view and fly back to them in one click:

- **📌 capture** (in the panel header) — stores the current pose: camera position, **orientation** and view target — the exact view comes back to the pixel
- **Layout-proof** — warps are anchored to the files in view (plus the layout scale), so they land on the same spot even though the force layout differs between sessions
- **Click a warp** — smooth ~800 ms flight; **✏️ rename · 📌 re-capture · 🗑️ delete** per row
- **Quick slots** — assign `Alt+Shift+1–9` in the panel; the shortcut flies there from anywhere in the graph
- **🏠 Home** — the first row always returns to the default fit-to-view
- Stored in `.aura/warps.json`, local to the workspace (not committed)

### Follow Editor 👁

Switch editor tabs and the 3D camera flies to the matching file — the same 800 ms close-up and selection as clicking its node:

- The **👁** toolbar button toggles following; the choice is saved in the view state and as `auraVisualizer.followEditor`
- The file is **selected** like a click: glow, explorer selection and detail panel, with a fixed 120-unit camera distance (no creeping zoom when alternating files)
- Any manual orbit, pan or zoom **pauses** following so the camera never fights you — click 👁 again to resume
- Files outside the analyzed graph are ignored

### Pilot Mode 🚀

Switch from orbiting the graph to **flying through it** — first-person navigation:

- **Toggle** with the `🚀 Pilot` toolbar button or `Space`; `Esc` (or `Space`) exits — the orbit controls take over seamlessly at the exact same view
- **`W A S D`** move camera-relative (physical key layout — AZERTY gets ZQSD), **`Q`/`E`** descend / ascend
- **Mouse look** with pointer lock; hold the **left mouse button** to fly forward, the **right** to fly backward — steer by looking while you hold
- **Wheel** adjusts base speed, **`Shift`** boosts — the base speed scales with the graph size
- No roll (pitch clamped), smooth acceleration/damping, and single-letter shortcuts, hover and clicks are suspended while flying
- Flight speed, smoothing, mouse sensitivity and Y-inversion live in **⚙️ Settings**

### Function Flowcharts ⑂

Turn any function into a readable **control-flow chart** — without tracing `if`s and loops by eye:

- Click the **⑂ button** next to a function in the Explorer symbols list (JS/TS/TSX, Python, C and C++)
- The chart is built on demand from the AST: conditions fork into `T` / `F` branches that re-join, loops get a framed body with their **back edge**, `switch` cases line up as columns, and `try` / `catch` / `finally` stack as labelled frames
- **Dead code** after a `return` / `throw` is drawn as red dashed boxes; the header badge shows the function's **cognitive complexity**, **maintainability index** and decision count
- **Function metrics** — for JS/TS/TSX, Python, C/C++, Java, Go, Rust, Kotlin, Swift, C#, PHP, Lua and Bash, each function also reports Sonar-style **cognitive complexity** (nesting + boolean sequences), McCabe cyclomatic complexity, approximate Halstead volume and a 0–100 **Maintainability Index**. The detail panel shows a `cog N · MI N` chip (hover for the full breakdown), and the **📋 Table** has a sortable **Cog. max** column
- **Click any step** to open the file at that exact line, and click an underlined **call chip** (`↳ validate()`) to drill into the called function — the breadcrumb walks back
- **⤓ SVG** exports the chart as a standalone vector file
- The window is **draggable and resizable**; `Esc` closes it

### Symbol Cycles 🔁

Aura also detects **function→function recursion**, not just file-level import loops:

- **Direct recursion** — `walk() → walk()` — is reported as a self-loop
- **Mutual recursion** — `parse() → validate() → parse()` — is reported with the full function chain
- Every step keeps the **call line** (`file.ts:42`), and cycles through same-name candidates are marked **ambiguous** with a 0.5 confidence
- The **🔄 Symbol cycles** section in the detail panel lists cycles involving the selected file; the function **flowchart badge** adds **🔁 recursive** / **🔁 mutual recursion**
- The **Risk** dashboard adds a collapsible **🔁 Symbol cycles** list with the chain, kind, confidence and ambiguous marker
- Cycles are persisted in `.aura/graph.db` (`symbol_cycles` / `symbol_cycle_steps`) and recomputed after incremental edits
- The MCP / `@aura` **`find_cycles`** tool returns both file cycles and `symbol_cycles`

Dynamic dispatch, callbacks and unresolved calls are not guessed; cycles are built only from statically resolved call sites.

### Time Travel ⏳

Navigate your project's git history commit by commit. A timeline bar at the bottom lets you scrub through commits. Changed files are color-coded: 🟢 green = added, 🔴 pink = removed, 🟡 yellow = modified. Edges follow the same color scheme.

| Control | Action |
|---------|--------|
| Timeline slider | Jump to any commit |
| `←` / `→` arrows | Step through commits |
| Prev / Next buttons | Navigate history |
| `I` | Toggle impact cascade from changed files |
| `Escape` | Return to HEAD |

### Visual Diff Between Commits 🔀

Press `V` or click the **⇄ Compare** button to enter **Compare mode**. A second slider appears — drag both sliders to diff any two commits. Files that changed between those commits are highlighted; unchanged nodes are dimmed. Compare mode shows the cumulative diff across the selected range.

### Search

Type in the search box (2+ characters) to find files by name or path. Results appear in a live dropdown — click to navigate.

### Query Filter 🔍

Filter, highlight, or select files with the built-in **Aura Query Language** — a small boolean DSL evaluated over node metrics.

- Open the query bar with the **🔍 button** (far right of the tab bar) or `Ctrl+K` / `Cmd+K`. It stays hidden until you need it.
- Type an expression such as `complexity > 20 AND fanIn > 5` — matches are highlighted (or filtered / selected, depending on the mode).

**Available fields:**

| Field | Description |
|-------|-------------|
| `complexity` | Cyclomatic complexity |
| `cognitive` | Highest per-function cognitive complexity in the file |
| `loc` / `linesofcode` | Lines of code |
| `fanin` / `fanout` | Incoming / outgoing dependency counts |
| `size` | File size in bytes |
| `mtime` / `lastmodified` | Last modification time |
| `symbols` / `symbolscount` | Number of extracted symbols |
| `deadexports` | Number of unused (dead) exports |
| `cochange` | Strongest temporal-coupling Jaccard score (0–1) |
| `language`, `name`, `path`, `group`, `extension` | String metadata |
| `community` | Detected community name |
| `isorphan`, `isdead`, `incycle`, `ispinned`, `dirty`, `hasnote` | Boolean flags (`dirty` = uncommitted git changes, `hasnote` = annotated file) |

**Operators:** `==`, `!=`, `>`, `<`, `>=`, `<=`, `~` (regex), `!~`, `in [ ... ]`, plus `AND` / `OR` / `NOT` and parentheses.

**Examples:**

- `language in [typescript, python]`
- `fanIn > 10 AND complexity > 20`
- `isorphan`
- `dirty AND complexity > 20` — files being edited right now
- `cochange > 0.6` — strongly coupled files (run Time Travel first)
- `hasnote` — every annotated file
- `path ~ /src\/.*/`

**Modes:** **Highlight** (dim non-matching files), **Filter** (hide non-matching files), **Select** (multi-select matching files).

**Saved queries:** press **⭐** to save the current expression and **📚** to reopen the saved list (persisted in `.aura/graph.db`).

### File Explorer Panel

Toggle a tree-view panel showing all files organized by directory. Click a file to select it in the graph.

**Directory filtering**: Each directory has a checkbox to show/hide its files in the graph. Use the **All** / **None** buttons at the top for batch selection. Directories are checked by default.

### Filter by Language

Toggle language buttons in the filter bar to show/hide files by type. Multiple languages can be active simultaneously.

### Adjustable Controls

| Slider | Effect |
|--------|--------|
| **Node Size** | Scale the visual radius of all nodes |
| **Spread** | Adjust repulsion force between nodes |
| **Depth** (1–5) | Set how many neighbor levels to show when pinning focus |

### In-App Settings ⚙️

The **⚙️ button** in the tab bar (next to 🔍 Query) opens an in-app settings modal — no need to dig into VS Code settings:

| Control | Effect |
|---------|--------|
| **Risk history window** | 30 / 90 / 365 days of git history — drives the Risk Map, the status bar and hotspots |
| **Mouse rotation speed** | 1 → 5 slider — how fast dragging rotates the 3D view |
| **Link style** | Straight or curved dependency edges (+ curvature amount) |
| **Selected node effect** | Glow halo or bloom post-processing (+ intensity / radius / threshold) |
| **Flight speed / smoothing** | Pilot mode base speed (scene-scaled) and acceleration damping |
| **Mouse look sensitivity / invert Y** | Pilot mode mouse-look feel |
| **Follow editor** | Fly the camera to the file of the active editor (👁 toolbar toggle) |
| **Auto-refresh on save** | Re-analyze changed files automatically |

Changes apply instantly and are saved to your workspace settings. The footer link opens the full `auraVisualizer.*` list.

### Incremental Updates

When `autoRefresh` is enabled, the graph updates automatically whenever you save a file — no manual re-scan needed. Only the changed file is re-parsed and its edges recalculated (O(1) instead of O(N)).

**Instant startup**: The graph is persisted to a local SQLite database (`.aura/graph.db`). On next launch, the cached graph loads instantly; a fingerprint (`git HEAD` + settings + parser version + file size/mtime list) skips the analysis entirely when nothing changed, and otherwise re-parses only the modified files before sending a delta update.

### Function Call Labels

In the detail panel, dependency links of type `function-call` display the actual function name (e.g. `helper()`) next to the target file. A green `×N` badge shows when multiple distinct call sites exist between the same pair of files.

In the 3D Graph, function-call edges have **logarithmic width** scaled to call count, and **hovering an edge** displays a tooltip listing the top 5 caller → callee function pairs.

For **C/C++ projects**, function-call links are only created between files connected via `#include` — preventing false positives between unrelated files that happen to define functions with the same name.

### Documentation in the Graph

Markdown, plain-text and reStructuredText files (`.md`, `.markdown`, `.txt`, `.rst`) are first-class nodes in the graph:

- **Dotted `doc-reference` edges** automatically connect each doc file to the code files it mentions — detected from symbol names (functions, classes, methods, exports) and basename references like `extension.ts`. Doc edges do **not** count toward fan-in / fan-out, so hotspot metrics stay clean.
- A **📄 Docs** filter button in the toolbar toggles documentation nodes on / off (hidden by default to keep the structural view focused).
- Doc content is chunked by heading and indexed in a local **FTS** full-text index — exposed to AI assistants through the `search_docs` MCP tool.

### Symbols in the File Explorer

Files in the side Explorer panel that contain functions or methods show a **chevron** to their left. Click it to reveal an indented list of every function/method in the file (sorted by line number). Click any function to **open the file in the editor and jump to that exact line**.

Each function row also carries two action buttons: **▶** traces its outgoing call chain across files, and **⑂** opens its **function flowchart** — the branching structure of the function rendered as an explorable SVG diagram.

In the detail panel, functions supported by the static metric engine (JS/TS/TSX, Python, C/C++, Java, Go, Rust, Kotlin, Swift, C#, PHP, Lua and Bash) show a **`cog N · MI N`** chip: Sonar-style cognitive complexity and Maintainability Index, with cyclomatic complexity, Halstead volume and function length in the tooltip.

This turns the Explorer into a fast outline / go-to-symbol navigator across your whole project.

### Tabbed Views

Switch between **9 visualization tabs** for different perspectives on your codebase:

| Tab | Description |
|-----|-------------|
| **✦ 3D Graph** | Interactive 3D force-directed dependency graph (default) |
| **🗺️ Treemap** | Files nested by directory, sized by LOC or complexity, colored by metric. Click to zoom into subdirectories, breadcrumb navigation to zoom out. |
| **🗑️ Matrix** | N×N Dependency Structure Matrix (DSM). Rows and columns are files; a colored cell means a dependency exists. Red cells with ↺ indicate circular dependencies. Group by directory, language, or community. |
| **🎵 Chord** | Chord diagram showing dependency flows between groups (directories, languages, or communities). Ribbon thickness reflects flow volume. Hover to highlight a group and its connections. |
| **📊 Metrics** | Dashboard with bar charts: LOC, complexity, fan-in, fan-out by language and top files. |
| **📈 Timeline** | Line chart showing metric evolution over git history (LOC, file count, avg complexity, total complexity). Requires Time Travel scan. |
| **📋 Table** | Sortable, filterable spreadsheet of all files with LOC, complexity, cognitive max, fan-in/out, symbols, and folder. |
| **🛡️ Risk** | Codebase risk dashboard — health score, risk distribution, churn × complexity matrix, bus factor, and an exportable report |
| **🔗 Co-change** | Temporal co-change — files that change together in git commits without a direct dependency (Jaccard score, support, virtual links) |

All tabs share the same live data and update when the graph is refreshed.

---

## Getting Started

1. Install the extension from the VS Code Marketplace (or load the `.vsix`)
2. Open a project folder in VS Code
3. Press `Ctrl+Shift+A` (or `Cmd+Shift+A` on Mac)
4. Explore your codebase in 3D

You can also open the visualizer from the **Aura** icon in the Activity Bar or via the Command Palette → *Aura: Visualize Codebase*.

---

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Aura: Visualize Codebase | `Ctrl+Shift+A` | Open the 3D visualization |
| Aura: Refresh Visualization | — | Re-analyze the workspace |
| Aura: Focus Current File | — | Highlight the active editor file in the graph |
| Aura: Blast Radius | — | Show blast radius for the active file |
| Aura: Export Graph for AI | — | AI context export — Markdown or JSON, selectable sections and token budget |
| Aura: Export Graph as PNG | — | Capture the 3D graph at ×1/×2/×4 |
| Aura: Export Architecture Report | — | Markdown + Mermaid architecture report |
| Aura: Export Architecture Report with AI Narrative | — | Same report plus an AI-written architecture explanation |
| Aura: Export Metrics (CSV/JSON) | — | Per-file LOC, complexity, cognitive max, fan-in/out, churn, authors and risk |

## Keyboard Shortcuts (in graph)

| Key | Action |
|-----|--------|
| `Ctrl+K` | Open the query filter bar |
| `F` | Fit to view / recenter |
| `L` | Toggle node labels |
| `G` | Toggle directory groups |
| `H` | Cycle heatmap modes |
| `P` | Toggle path-finding mode |
| `D` | Toggle DAG layout |
| `O` | Highlight orphan files |
| `X` | Toggle dead code visualization |
| `C` | Toggle circular dependencies |
| `1`–`5` | Set pinned focus depth |
| `V` | Toggle timeline compare mode (dual slider) |
| `I` | Toggle timeline impact cascade |
| `Space` | Toggle pilot mode (free flight) |
| `Alt`+`Shift`+`1`–`9` | Fly to the warp point on that quick slot |
| `←` `→` | Timeline: previous / next commit |
| `Escape` | Reset all — clear selections, heatmaps, timeline |

---

## AI Integration

Aura includes a built-in **MCP server** (Model Context Protocol) and a **Graph Database** so AI assistants can query your codebase structure programmatically.

### Graph Database

Every analysis is persisted to a local SQLite database (`.aura/graph.db` via sql.js/WASM). This enables fast structural queries without re-parsing.

### Chat participant `@aura`

Open **VS Code Chat** and mention `@aura` to ask about architecture, hotspots, impact or dependencies. Aura grounds every answer in the analyzed graph and exposes the same deterministic tools as the MCP server and the Language Model tools.

- **Slash commands:** `/explain`, `/impact`, `/path`, `/hotspots`, `/query`
- **Answers** link files directly and offer actions: **Focus in Aura**, **Apply Aura Query**, **Open Risk**, **Open Aura**
- **Ask Aura** buttons live directly in the UI: file detail (Explain / Impact / Refactor plan / Tests first), clusters, communities, the Risk dashboard and the explorer context menu
- The legacy in-panel assistant is hidden — VS Code Chat is the main conversational surface

### Export an AI context

Use **📤 Export** (or *Aura: Export Graph for AI*) to give an LLM a focused view of the codebase:

- **Format:** Markdown briefing or structured JSON
- **Sections:** modules + inter-module dependencies, contracts (exports/interfaces/header declarations), hotspots, cycles and dead code
- **Budget:** 2k / 4k / 8k / 16k tokens or no limit — estimated at ~4 characters per token
- **Truncation is explicit:** omitted items/sections are reported, never silently cut
- Save to a file or copy directly into the prompt

### MCP Server

The MCP server exposes your codebase graph to AI tools via stdio transport. It registers automatically in `.vscode/mcp.json` on first run.

**Resources:**

| URI | Description |
|-----|-------------|
| `aura://overview` | Architecture overview — file counts, LOC, complexity by language |
| `aura://nodes` | All files with full metrics |
| `aura://node/{id}` | Detail for a specific file — symbols, dependencies, dependents |

**Tools (17):**

| Tool | Parameters | Description |
|------|-----------|-------------|
| `find_dependencies` | `file`, `depth` | Transitive dependency tree |
| `find_dependents` | `file`, `depth` | Impact analysis — blast radius with risk levels |
| `find_path` | `from`, `to` | Shortest dependency path between two files |
| `find_cycles` | — | Circular dependencies — file-level cycles plus function-level `symbol_cycles` (recursion/mutual recursion with call lines) |
| `find_orphan_files` | `limit` | Files that nothing imports |
| `find_dead_code` | — | Unused exports across the codebase |
| `find_unused_functions` | `file`, `include_methods` | Functions/methods never called anywhere |
| `get_hotspots` | `limit`, `sort_by`, `window_days` | At-risk files ranked by the repository-relative risk score (percentile-based) with written reasons; raw metric sorts still available via `sort_by` |
| `get_largest_files` | `limit` | Largest files by lines of code |
| `get_cochange` | `limit`, `min_score` | Temporal-coupling pairs — files changing together without a direct dependency (Jaccard score) |
| `search_symbols` | `query`, `kind` | Find functions, classes, exports by name |
| `find_heritage` | `file` | Inheritance and implementation relationships (extends/implements) |
| `get_architecture` | — | High-level overview by language |
| `get_communities` | — | Architectural modules detected by Louvain algorithm |
| `search_docs` | `query`, `limit` | Full-text search across project documentation (Markdown / `.txt` / `.rst`) — returns ranked chunks with file path, section heading, and excerpt |
| `resolve_context` | `task`, `limit` | Ranked list of files most relevant to a natural-language task (deterministic, no LLM) |
| `generate_documentation` | `hotspot_limit` | Full documentation payload: overview, modules, hotspots, cycles, dead code, inter-module links |

---

## Settings

All settings live under `auraVisualizer.*` — the most common ones are also editable in-app via the **⚙️ Settings** button.

| Setting | Default | Description |
|---------|---------|-------------|
| `auraVisualizer.excludePaths` | `["node_modules", ".git", "dist", "build", "out", "__pycache__"]` | Directories to exclude from analysis |
| `auraVisualizer.maxFiles` | `500` | Maximum number of files to analyze |
| `auraVisualizer.autoRefresh` | `true` | Auto-refresh on file save |
| `auraVisualizer.followEditor` | `true` | Fly the 3D camera to the active editor file; manual camera movement pauses following until the 👁 toolbar button is clicked again |
| `auraVisualizer.riskWindow` | `90` | Git history window (30 / 90 / 365 days) used by the Risk Map, the status bar and `get_hotspots` |
| `auraVisualizer.riskCentrality` | `false` | Use the PageRank centrality percentile instead of fan-in in the risk score |
| `auraVisualizer.complexityTrendThreshold` | `0.5` | Complexity points per 30 days that flag a file as degrading in the Trend column / Risk dashboard |
| `auraVisualizer.rotateSpeed` | `1` | Rotation speed when dragging the 3D graph (1–5, 5 = fastest) |
| `auraVisualizer.linkStyle` | `"straight"` | Edge style in the 3D graph (`straight` / `curved`) |
| `auraVisualizer.linkCurvature` | `0.25` | Curvature amount when `linkStyle` is `curved` (0–1) |
| `auraVisualizer.selectedNodeEffect` | `"glow"` | Selected-node highlight — `glow` halo or `bloom` post-processing |
| `auraVisualizer.bloomStrength` / `bloomRadius` / `bloomThreshold` | `1.2` / `0.6` / `0.0` | Bloom tuning when `selectedNodeEffect` is `bloom` |

---

## Edge Types

| Type | Color | Source |
|------|-------|--------|
| `include` | Light blue | C `#include "file.h"` |
| `system-include` | Light blue (dim) | C `#include <stdlib.h>` |
| `import` | Yellow | JS/TS `import` |
| `require` | Yellow (dim) | CommonJS `require()` |
| `dynamic-import` | Yellow (faint) | `import()` expressions |
| `function-call` | Green | Cross-file function calls (C, C++, JS/TS, Python, Java, Go, Rust, Kotlin, Ruby, Swift, C#, PHP, Lua) |
| `extends` | Pink | Class/struct inheritance |
| `implements` | Purple | Interface / trait implementation |
| `script` | Orange | HTML `<script src>` / Vue `<script src>` |
| `stylesheet` | Purple | HTML `<link rel="stylesheet">` |
| `css-import` | Purple (dim) | CSS `@import` |
| `source` | Green (dim) | Shell `source file.sh` / `. file.sh` |
| `css-url` | Purple (faint) | CSS `url()` references |
| `doc-reference` | Slate (thin) | Mentions of code symbols / filenames inside `.md` / `.txt` / `.rst` files |

---

## License

MIT
