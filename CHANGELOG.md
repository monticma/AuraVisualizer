# Changelog

All notable changes to Aura Visualizer are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **PageRank centrality (V2-16)** — a normalized PageRank score is computed over the structural **code** graph (`damping 0.85`, 40 iterations, dangling nodes handled; documentation and `doc-reference` links excluded) and persisted per node. The detail panel shows **Centrality**, the **💠 Centrality** toolbar button adds a soft **top-10% halo** (off by default, persisted), and the optional `auraVisualizer.riskCentrality` setting replaces fan-in with the PageRank percentile in the risk score. `resolve_context` prefers PageRank when available. Haloes are separate from dirty/note/selection rings.
- **Complexity trends (V2-05)** — per-file complexity series rebuilt from Time Travel commit deltas, with least-squares slope per 30 days, R², degrading/improving detection and SVG sparklines. The Risk dashboard ranks the top slope files in a collapsible **📈 COMPLEXITY TREND** section, the Table gains a sortable **Trend** column, and the threshold is configurable via `auraVisualizer.complexityTrendThreshold` (default 0.5 point / 30 days). Short histories never produce NaN.
- **Symbol cycles (V2-03)** — direct recursion (`walk() → walk()`) and mutual recursion (`parse() → validate() → parse()`) are detected from resolved call sites with the call line of every step. Cycles are stored in `symbol_cycles` / `symbol_cycle_steps`, shown in the detail panel's **🔄 Symbol cycles** section and the **Risk** dashboard, flagged **🔁 recursive / mutual recursion** in the flowchart badge, recomputed after incremental edits, and returned as `symbol_cycles` by the MCP `find_cycles` tool. Ambiguous same-name targets are marked with confidence 0.5.
- **Edge confidence (V2-08)** — every resolved edge now carries a 0–1 confidence score: 1.0 exact/relative/alias, 0.9 extension/index, 0.8 vendored suffix, 0.6 basename, 0.5 ambiguous; function-call edges use 0.8 (unique) / 0.5 (ambiguous) and inheritance 0.9. Scores are persisted in `edges.confidence` (additive migration, legacy default 1.0), shown as a badge in the detail panel, filterable through the new **Edge confidence** selector, and exposed in the `aura://node` MCP edges.
- **Import alias resolution (V2-12)** — imports now resolve through `tsconfig.json`/`jsconfig.json` (`baseUrl` + `paths`, simple relative `extends`), static Vite/webpack `resolve.alias`, and Python `src/` layouts. `@/components`, `~/lib`, `@app/*` and dotted Python imports produce real edges instead of false orphans; relative/extension/index/suffix/basename fallbacks are preserved. The history worker shares the same resolver for consistent temporal deltas.
- **Fingerprint analysis cache (V2-14)** — a sha256 over `git HEAD`, analysis settings, parser version and the path/size/mtime list of scanned files is stored in `.aura/graph.db` meta. A second startup with no changes now skips parsing entirely; small deltas re-parse only added/modified/deleted files, and a `HEAD`-only change reuses the graph. Explicit **Refresh** (`auraVisualizer.refresh`) and `excludePaths` changes force a full analysis.
- **Function metrics (V2-04)** — Sonar-style **cognitive complexity** per function (nesting, else-if and boolean-sequence rules, empty else ignored) for JS/TS/TSX, Python, C/C++, Java, Go, Rust, Kotlin, Swift, C#, PHP, Lua and Bash, plus McCabe cyclomatic complexity, approximate Halstead volume and a 0–100 **Maintainability Index**. The detail panel shows a `cog N · MI N` chip with a full tooltip, the Table has a sortable **Cog. max** column, the flowchart badge includes cognitive + MI, and the metrics are persisted in `.aura/graph.db` and exposed through the symbol search MCP/AI tools.
- **Cognitive heatmap** — new **🧠 Cognitive** coloring mode uses the highest function cognitive complexity in each file, with the same gradient as **Complexity** and its own legend. The `cognitive` field is also available in AuraQL queries.
- **TSX/JSX scanning** — `.tsx` files now use the dedicated TSX grammar and `.jsx` files are scanned as JavaScript, so React components get symbols, metrics and flowcharts.
- **Temporal co-change** — new **🔗 Co-change** tab finds files that change together in git commits without a direct dependency. Computes Jaccard and support over a selectable 90-day / 365-day / 2-year window, follows renames, ignores giant commits, and shows virtual magenta links on the 3D graph. Includes a **Co-change** heatmap, the `cochange` query field, and the `get_cochange` MCP tool.

### Changed
- **Communities use a shared code-only snapshot** — the extension/`GraphDB` computes the partition once; the webview, `@aura` and MCP read the same membership. Documentation nodes and `doc-reference` edges remain visible for exploration but no longer influence communities, structural fan-in, PageRank centrality or the risk score. Automatic labels use the full hub path; cards show total and currently visible file counts and support persisted **✏️ rename** with an empty label restoring the hub path.
- MCP now exposes 17 tools, including `find_orphan_files`, `get_largest_files` and `get_cochange` from the shared registry.
- The Co-change view is consistently named **Co-change** (tab, filter button, heatmap, docs), replacing the previous Coupling/Co-change mix.
- **Detail panel redesign** — file metrics, **Ask Aura** and **Notes** are grouped in one collapsible **File details** section; **Symbols**, **Dependencies** and **Dependents** are collapsible cards with separate name/signature/metrics and path/type/confidence rows. Empty sections are hidden automatically.

### Fixed
- **Communities ✨ Ask Aura scope** — the palette button sends the exact code-only membership as an authoritative `community` context instead of an ambiguous `filters.community` label; the palette and tools now consume the same `GraphDB` snapshot, so `@aura` cannot re-map a hub-derived label to a different group.
- **Complexity Trend focus** — trend rows for renamed files now follow git renames, merge their history under the current node id, and use the same raw-node focus path as other views; stale historical paths that no longer exist are no longer listed in the Risk trend section.
- The Co-change table headers now sort every column (pair, co-changes, Jaccard, support, A/B commits) with ascending/descending indicators.
- Clicking a file name in the Co-change table switches to the 3D graph and performs the normal full selection (close-up, detail panel).

## [1.4.0] - 2026-10-23

### Added
- **`@aura` chat participant** — ask VS Code Chat about architecture, hotspots, impact, dependency paths or natural-language filters. Aura answers from the analyzed graph, links files, and offers **Focus in Aura**, **Apply Aura Query**, **Open Risk** and **Open Aura** actions. Slash commands: `/explain`, `/impact`, `/path`, `/hotspots`, `/query`.
- **Shared tool registry** — MCP, Language Model tools and `@aura` now execute the same 16 deterministic GraphDB tools, including a shared `generate_documentation` implementation.
- **`@aura` navigation actions** — file references now carry their line number, and answers expose **Open in editor** and **Blast radius** actions alongside **Focus**. Files outside the graph still get an **Open in editor** fallback; paths with spaces, absolute paths and `../` escapes are handled explicitly.
- **Contextual Ask Aura actions** — the file detail panel offers **Explain**, **Impact**, **Refactor plan** and **Tests first**; clusters and communities expose an explanation action; the Risk dashboard opens the chat for its top 3 actions; the Aura explorer adds an **Ask @aura about this file** context-menu entry. Each action forwards the current view context (selection, tab, heatmap, query, filters) to the participant.
- **Stale notes** — notes written before the file's last modification show a **⚠️ À revoir** badge, a **✓ Mark reviewed** action, an exact stale count on the **📝 Notes** button, a **⚠️ Stale** graph filter and the `stalenote` query flag.
- **High-resolution PNG export** — the **📷 PNG** button opens a QuickPick for ×1/×2/×4 resolution, current/transparent background and optional Aura watermark, then saves the captured 3D graph through a unified save dialog.
- **Unified exports** — `saveText`, `copyText`, `saveOrCopyText` and `saveBinary` centralize paths, save dialogs and notifications; the AI graph export, Risk report and PNG export use them.
- **Architecture report** — `Aura: Export Architecture Report` produces a deterministic Markdown document with a Mermaid module graph, top dependencies, hotspots, cycles and dead exports (line budget and path-free options included). Documentation files are excluded by default; `Aura: Export Architecture Report with AI Narrative` optionally adds an explanation generated from that report.
- **CSV/JSON metrics export** — `Aura: Export Metrics (CSV/JSON)` writes a stable per-file table with lines, complexity, fan-in/out, churn, author count and risk score/bucket. CSV uses RFC 4180 escaping; JSON uses a versioned `{version, generatedAt, columns, rows}` envelope.
- **AI context export** — **📤 Export** now opens a guided export: Markdown or structured JSON, selectable sections (modules + dependencies, contracts, hotspots, cycles, dead code) and a token budget (2k / 4k / 8k / 16k / unlimited). Estimated at ~4 chars/token; truncation is explicit and the result can be saved or copied. Replaces the silent `graph.json` + `summary.md` dump.
- **Follow editor** — switching editor tabs flies the 3D camera to the active file and selects it exactly like a click (glow, explorer selection, detail panel). The camera keeps a fixed 120-unit close-up, so alternating files no longer creeps closer or leaves the node unreadable from a far overview; the 👁 toolbar toggle persists in the view state, and any manual camera gesture pauses following until it is clicked again. Files outside the graph are ignored.

### Changed
- The legacy in-webview Aura Assistant is hidden; VS Code Chat is the primary conversational surface.

### Fixed
- **Center clears the selection visuals** — after clicking **🎯 Center**, the selected node no longer keeps its glow/bloom or explorer highlight, so a subsequent background click can deselect normally instead of silently doing nothing.
- `@aura` **Focus** buttons now use the normal graph click behavior: switch back to the 3D view when needed, fly close, center the file and open the detail panel.
- **Open Risk** switches to the Risk tab without reloading the graph, and **Open Aura** is hidden when the panel is already visible (and no longer refreshes a visible graph).
- `/explain` and `/impact` use the active editor/selected file (and ask for one when missing) instead of returning an empty answer; `/explain` also streams deterministic graph facts, so it always returns content even if the model stops after a tool call.
- `/query` only shows **Apply Aura Query**, and **Focus** buttons are only created for files that actually exist in the workspace graph (no more `69.0`).
- Contextual **Ask Aura** actions (Explain / Impact / Refactor plan / Tests first) now stream deterministic file facts and request one final tool-free synthesis when the model stops on a tool call — they no longer end on the generic “no written answer” message.

## [1.3.1] - 2026-10-16

### Added
- **Function flowcharts** ⑂ — click the ⑂ button next to a function in the detail panel (JS/TS/TSX, Python, C, C++) to open its **control-flow chart**, built on demand from the AST: conditions fork into `T`/`F` branches that re-join, loops get a framed body with their back edge, `switch` cases line up as columns, `try`/`catch`/`finally` stack as labelled frames. Dead code after a jump shows as red dashed boxes, the badge counts decision points. Click any step to open the file at its line, drill into calls through the breadcrumb, export a standalone **SVG**, and drag or resize the window.
- Floating panels (Warps, Communities, Minimap) keep their dragged **position** — and Warps/Communities their resized **size** — across sessions; the Warps panel also keeps its open state.

### Fixed
- Dirty/note rings now dim (or hide) together with their node; `rgb()` heatmap colors dim correctly (they previously received an invalid hex-alpha suffix).
- Node clicks no longer go dead after releasing the mouse outside the webview — the stuck press state is detected and self-healed.
- The Warps panel is hidden outside the graph tab, like the minimap and the communities palette.
- The dirty overlay (amber rings) refreshes automatically after commits, staging and checkouts — it used to wait for the next file save.

### Changed
- README, walkthrough and the in-app help document function flowcharts; tab descriptions refreshed.

## [1.3.0] - 2026-10-14

### Added
- **Pilot mode (free flight)** 🚀 — fly through the graph in first person: `WASD`/`ZQSD` camera-relative movement, `Q`/`E` down-up, pointer-lock mouse look (drag-to-look fallback), hold the **left mouse button** to advance and the **right** to retreat, mouse wheel = speed, `Shift` = boost. Toggle via the `🚀 Pilot` toolbar button or `Space`; `Esc`/`Space` exits and the orbit controls resume seamlessly at the exact same view. Speed scales with the graph size; flight speed, smoothing, sensitivity and invert-Y are settings. Single-letter shortcuts, hover and clicks are suspended while flying.
- **Warp points** 🌀 — named camera bookmarks: capture the current pose (position + orientation + view target) from the floating panel, fly back with a smooth 800 ms flight, rename / re-capture / delete per row, exclusive quick slots on `Alt+Shift+1–9`, and a `🏠 Home` row for the default view. Stored in `.aura/warps.json` (local, never committed).

## [1.2.1] - 2026-10-13

### Added
- Support for **C#**, **PHP**, **Vue**, **Bash** and **Lua**: scanning, parsers (Tree-sitter; Vue SFCs are scanned for script/style imports), symbols, cross-file function calls, `extends`/`implements` for C# and PHP, complexity, graph colors, language filters and docs.
- Per-file notes (colored, persisted in `.aura/annotations.json`) with pulsing graph indicators, a toolbar toggle and the `hasnote` query flag.
- Rename-aware churn: `git mv` renames are followed in the Risk Map, the status bar and the MCP `get_hotspots` tool.

### Fixed
- Curved links no longer collapse the frame rate: the simulation settles in the synchronous warmup instead of ticking live (every tick rebuilt each tube geometry).
- Interaction slowdowns: hover / pin no longer rebuild every link object; delta refreshes keep node positions.
- Heatmap legend and minimap stay above the bottom bars when they wrap in a narrow webview.

## [1.1.7] - 2026-08-25

### Added
- Cyclomatic complexity for Python, Java, Go, Rust, Kotlin, Ruby and Swift (generic decision counter).
- Query language: `lastmodified` alias for the `mtime` keyword.
- Query bar toggle moved to the tab bar (far right).

### Fixed
- `history-worker` `LANGUAGE_MAP` completed (`.cpp/.cc/.cxx/.hpp/.hxx/.hh`, `.kt/.kts`, `.rb`, `.swift`, `.md/.markdown/.txt/.rst`) with matching parsers.
- Query DSL bugs: `mtime` now maps to `lastModified`, `symbols` count uses `totalSymbols`, community name resolution, and cycle node IDs derived from `graphData.meta.cycles`.
- Saved query save (`modalSelectedId` declaration missing under strict mode).
- DAG toggle no longer breaks link width (centralized `getLinkWidth`).
- Query bar no longer reserves a second line when no error is shown.

### Changed
- Packaging: `docs/`, `.aura/`, `.vscode/`, `webview-vendor/` and `package-lock.json` excluded from the VSIX.

## [1.1.6] - 2026-06-10

### Added
- Link thickness driven by fan-in/fan-out.
- Bloom, glow and curvature settings.

### Fixed
- Search box z-index.
- Removed the Call Graph view.

## [1.1.5] - 2026-05-24

### Added
- Enhanced language support and documentation parsing.

## [1.1.4] - 2026-05-12

### Added
- Aura Query Language (DSL) for filtering the graph.
- Three.js vendor bundle.

## [1.1.3] - 2026-05-06

### Added
- Support for Kotlin, Ruby and Swift.

## [1.1.2] - 2026-05-01

### Added
- Calls 3D view (function-level call graph), later replaced by call-count annotations on the 3D graph.

### Changed
- Code structure refactoring.

## [1.1.1] - 2026-04-17

### Added
- DSM, Chord Diagram and Timeline Chart tabs.

## [1.1.0] - 2026-04-16

### Added
- Visual diff between commits in Time Travel.
- Incremental parsing pipeline with instant startup.
- Directory filtering and dependency labels.
- C/C++ import reachability.
- `find_unused_functions` MCP tool.

### Fixed
- Label visibility after right-click / blast radius.
- Double-click opening the file twice.

## [1.0.1] - 2026-04-09

### Added
- Interactive minimap with camera-synced projection.

## [1.0.0] - 2026-04-08

### Added
- Initial release: code analyzer with Tree-sitter WASM (C, C++, JavaScript, TypeScript, Python, Java, Go, Rust, HTML, CSS).
- 3D dependency graph (3d-force-graph + Three.js) with symbol visualization and complexity heatmap.
- Dead code detection and circular dependency (cycle) detection.
- Time Travel: git history timeline with delta navigation.
- Graph persistence in SQLite (sql.js) and MCP server.
- Community detection (Louvain) and blast radius (directional impact analysis).
- Multi-selection, keyboard shortcuts, focus depth and view-state persistence.
- Function-level call-site extraction and call edges on hover.
- Interactive walkthrough.
