# Changelog

All notable changes to Aura Visualizer are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-10-30

### Added
- **Enriched command palette (V3-03)** — three navigation gestures now work from anywhere in VS Code. **Aura: Focus File in Graph…** opens a fuzzy picker over the analyzed files (path, language, directory, LOC, fan-in/out, architecture layer, violations; code only, documentation excluded, capped at 5 000 entries with a status-bar hint when truncated) and focuses the picked node with its detail panel. **Aura: Apply Saved Query…** replays a query saved from the query bar with its stored filter/highlight/select mode, most recent first, and says so explicitly when nothing is saved yet. **Aura: Add Warp Here** opens the existing warp naming modal on the live camera pose (`captureWarp`, queued behind the `graphRendered` handshake like the other graph actions) instead of requiring the Warps panel. The list building lives in a pure `palette-core` module (9 tests).
- **Blast radius from the code (V3-02)** — the impact analysis is no longer reachable only from inside the graph: right-click one or several files in **Source Control**, use the radio-tower button in the **editor title**, the **editor** right-click menu, or the **Explorer** context menu. A single file runs the usual blast (camera + depth colors); a multi-selection runs the **multi-seed impact cascade** (`startMultiNodeBlast`, already used by Time Travel) with every selected file at depth 0. Targets are resolved by a new pure helper (`src/commands/blast-targets.ts`, 13 tests): URIs are normalized to workspace-relative POSIX ids, deduplicated, capped at 50, and filtered to the analyzed graph — files outside the workspace or unknown to the graph are skipped, and the panel is not opened when nothing matches (the command falls back to the active editor when invoked from the palette without an argument). `sendBlastRadius` now carries `nodeIds[]` and still honours the single-node payload, queued behind the `graphRendered` handshake like the other graph actions.
- **Symbol CodeLens ⟡ (V3-01)** — every function, method, class, interface, struct, enum and type alias of an **analyzed** file now carries a `⟡ focus · flow · impact` CodeLens. Clicking it opens a quick pick with **Focus in Aura** (reveals the panel and centers the graph on the file), **Show flowchart** (the same AST flowchart as the graph detail panel, requested through the existing `flowData` round-trip) and **Blast radius**. Symbols and 1-based lines come from the graph database (`getNodeDetail`), so the lenses need no language server; a file that was never analyzed shows no lens, and an analyzed file without symbol rows falls back to the editor's document symbols. The three actions are also standalone commands (`focusSymbol`, `showSymbolFlow`, `blastSymbol`), a file caps at 300 lenses, and `auraVisualizer.codeLens` turns the feature off. The pure selection/placement rules live in `codelens-core` and are unit-tested (12 tests).
- **Gamepad in pilot mode (V2 pilot tier 2)** — the free-flight camera can now be flown with a DualSense/DualShock/Xbox pad (any W3C *standard mapping* gamepad), in parallel with the keyboard and mouse. Left stick translates, right stick looks (its rate follows the **Mouse look sensitivity** setting), the analog **L2** descends and **R2** boosts proportionally to the trigger travel, **✕** resets to a full-graph overview, a touchpad click re-aims at the graph centre, **d-pad ↑/↓** step the speed multiplier, **Options** resets it and **○** leaves the flight. Sticks pass a 15 % deadzone and a 1.5 response curve, `navigator.getGamepads()` is polled inside the flight rAF loop (no motion events in the API), connect/disconnect events update the HUD immediately, and the live pad name appears in the pilot HUD. The mapping is pure and unit-tested in `flight-core` (`deadzone`, `readPadState`, `triggerValue`, `applyStickLook`, `combineInput`, `boostFactor`), keyboard and pad input are summed and re-normalized, and `auraVisualizer.gamepadEnabled` (on by default) turns polling off entirely outside pilot mode.
- **Ask Aura on architecture layers** — every Layers card in the floating palette now has the same **✨** action as communities. It sends the authoritative member list (capped, documentation excluded), the layer globs, Martin coupling (`Ca`/`Ce`/`I`), new vs baselined violations with their rule ids, and aggregated layer cycles; `@aura` is told that membership comes from `.aura/arch-rules.json` (first matching glob wins) so code fixes and rule changes stay distinct. The **Unlayered** bucket has no ask action for now.
- **`aura_get_architecture_violations` AI tool** — new shared tool for `@aura` and VS Code LM agents: evaluates the layer rules against the current graph with optional `layer`, `include_baselined` and `limit` filters, returning per-layer globs and metrics, violations and cycles. Layer globs are now part of `ArchLayerStat`, so the palette, the tool and the Architecture tab describe layers consistently.
- **Parse failure report ⚠️ (V2-17)** — a file Tree-sitter cannot parse cleanly (syntax errors) or that makes a parser throw is no longer a silent fallback: the analysis catches the failure, keeps the file's node so its imports and dependents stay visible, and records a short reason. `meta.parseFailures` carries an exact count plus a deterministic, capped sample (25 entries); the report is persisted in `.aura/graph.db` and kept up to date by incremental edits (a fixed file leaves the list, a newly broken one joins it). A **⚠ N parse failures** badge in the stats bar opens a panel listing the sampled paths and reasons — clicking a path reveals the node — and exports a Markdown report. No analysis aborts on a broken file.
- **Communities / Layers palette** — the floating palette now has a header combobox that switches between **🧩 Communities** and **🏛️ Layers** (it mirrors the heatmap selector, so either control can switch). Layer cards follow the rule order — their swatches match the graph, the legend and the Architecture tab — and clicking one dims that layer exactly like a community toggle: nodes fade, labels disappear and links touching a hidden layer dim. **All** / **None** apply to the list currently shown, an **Unlayered** card (gray, matching the Architecture tab) is added when files fall outside every layer, and a missing rules file shows an empty state with **Create / open rules file**. Selections are persisted for **both** modes with the view state (communities by stable key, layers by name).
- **Architecture rules (V2-20)** — declarative layers over the typed dependency graph in `.aura/arch-rules.json`: glob → layer assignment (first match wins), `deny` rules with `error`/`warn` severity, sibling `slices` with `shared` allowances, aggregated `no-cycles` (Tarjan SCC on the file → layer graph), source `exceptions`, and a `strict` flag for unlayered files. A pure engine (`src/arch/arch-core.ts`) is shared by the extension host, the webview bundle (`window.AuraArch`) and MCP, and reports per-layer Martin metrics (`Ca`, `Ce`, `I = Ce / (Ca + Ce)`).
- **Adoption baseline** — `.aura/arch-baseline.json` freezes existing violations (rule + source + target, deterministic ordering); only new ones alert. Create it from the Architecture tab or `Aura: Baseline Architecture Violations`; reset clears it.
- **🏛️ Architecture tab** — violations grouped by rule with severity, link types and baseline state; layer table with files/Ca/Ce/instability; aggregated layer cycles; unlayered files; Markdown export; **Create or open rules** seeded from top-level `src/` folders.
- **Structured rules editor** — the **⚙️ Edit rules** modal edits layers (name, globs, order), deny rules (source + forbidden-target chips + severity), slices (pattern + shared globs), `no-cycles`, exceptions and strict mode. Renaming a layer updates every deny reference, every change is validated by the same engine before saving, invalid forms disable **Save**, and a raw JSON fallback keeps `edgeTypes`/advanced ordering editable.
- **Structured dead-code exemption editor** — **⚙️ Settings → Dead code exemptions** now edits each custom rule as a form (reason, exact names, regex, path globs, languages, kinds), with rule ordering, add/remove, built-in defaults shown read-only, live validation through `parseDeadCodeRules`, a disabled **Save** while invalid, and a raw JSON fallback. A new **Open file** action seeds `.aura/dead-code.json`; saving still starts a re-analysis.
- **Architecture surfaces** — **Architecture layers** heatmap (layer colors, red forbidden edges, amber baselined edges), **Group by → Architecture layer** in Matrix and Chord (red DSM cells with ✖), a sortable **Layer** table column, a detail-panel section with every outgoing violation, and a status-bar item showing the active file's layer or violation count with the offending imports in the tooltip.
- **Query & MCP** — new AuraQL fields `layer`, `archviolations`, `isarchviolator`; new MCP tool `get_architecture_violations` returning new violations, layer metrics, cycles and unlayered files. Documentation (`.md` nodes and `doc-reference` edges) is never evaluated, whatever `edgeTypes` says.
- **Tests/docs** — 24 unit tests for glob semantics, deny/slices/cycles, baseline, coupling metrics and graph annotation; README, help, walkthrough (`Enforce Architecture Layers`), CHANGELOG and the Marketplace walkthrough updated.

### Changed
- Rules and baseline are side files: saving either re-evaluates immediately (`auraVisualizer.reloadArchRules`) without re-parsing the project or rewriting the DB. A syntax error leaves the rest of Aura working and is surfaced in the Architecture tab.

### Fixed
- **Focus on a cold start (graph appearing then vanishing)** — the `graphRendered` handshake now waits for `restoreViewState`, so a queued CodeLens focus lands **after** the restored language/directory filters, heatmap and layout instead of being undone a few milliseconds later. `focusNodeById` also refuses to move the camera onto a node the force engine has not positioned yet — `cameraPosition()` with `NaN` poisons the camera for good (the scene background keeps painting while the graph becomes invisible) — and retries for up to 1.5 s instead; the blast-radius camera got the same guard. `applyViewState` is wrapped so a bad saved state can no longer abort the handshake. Finally, the deferred **initial fit-to-view** (`zoomToFit(500, 50)` 1.5 s after a graph is built) is now **cancelled** as soon as something navigates on purpose — CodeLens focus, blast radius — instead of zooming back out on top of the selection; this is why the bug only showed when Aura had never been opened (a fresh graph schedules the fit, an open panel does not).
- **Cold-start `ready` race** — the webview told the host it was ready at script-evaluation time, *before* `init()` ran (which is deferred to `DOMContentLoaded`). With a warm `.aura/graph.db` the host answered instantly with the cached graph, so a first graphData could reach a half-initialized webview: `AuraRiskMap.renderRiskDashboard()` then threw (`hooks.getGraphData` not a function), `handleGraphData` aborted before building the graph and the **loading overlay stayed on top of an empty panel** — the panel looked grey and the graph never appeared. `ready` is now sent at the end of `init()`, the satellite renders are individually guarded, and the overlay hide + `graphRendered` handshake are scheduled in a `finally` so no exception can strand them.
- **CodeLens actions on a cold start** — clicking `⟡ focus · flow · impact` before Aura had ever been opened dropped the focus and the blast radius: the command creates the panel, but the startup analysis is still running, so `openVisualizer` returned before any graph existed and the webview silently ignored the `focusNode` / `blastRadius` messages (the flowchart worked — it needs no 3D graph). The webview now posts a **`graphRendered`** handshake after its first rendered frame; the host queues **focus / follow editor / blast radius / flowchart** until that handshake and re-arms the queue whenever a new dataset rebuilds the `ForceGraph3D` instance. `blastRadiusCurrentFile` (`Aura: Blast Radius`) no longer relies on its 300 ms delay.
- Selecting a file from an **Architecture layer row** before ever clicking a node now applies the configured selected-node effect. The bloom composer is built after the graph becomes visible (with a short retry), and the selective bloom mesh is restricted to `BLOOM_LAYER` so it is no longer drawn as an opaque pale-blue sphere in the main pass.
- **Parse-failure false positives** — valid modern syntax the bundled Tree-sitter grammars predate no longer shows up in the report: TypeScript import type expressions (`import('./x').Type`, with their cascading MISSING/stray-brace fallout), CSS comma-separated keyframe selectors (`0%, 100%`) and `url(#fragment)` values are recognised as grammar gaps and ignored, while real errors (unexpected tokens, missing structural braces) still alert. Scanning Aura itself now reports zero parse failures.
- **Restored spread applies at startup** — the saved **Spread** value was written to the charge/link forces after the layout had already cooled, and cooling down is what makes force changes invisible (alpha is the temperature). On launch the graph therefore stayed compact at the centre until the slider was nudged, which called `d3ReheatSimulation()`. Restoring a different spread now restores the engine budget and reheats with a bounded settle, so the saved repulsion shapes the very first layout (a second restore with the same value does not reheat).
- **Filters no longer nudge the settled layout** — changing the **Edge confidence** selector, clicking **All** in the file explorer when every folder is already visible, or any other visibility change that leaves the visible set untouched no longer re-feeds the dataset. Every `graphData()` feed reheats the force engine (synchronous warmup + live cooldown), which drifted every node and was perceived as a small clockwise rotation of the whole graph. Genuine filter changes are still fed, but with zeroed warmup/cooldown so the remaining nodes keep their positions.
- **Architecture edits keep the 3D view** — saving a rule, or creating/clearing the baseline, used to re-send the whole graph: the `ForceGraph3D` instance was rebuilt, the force layout restarted and the camera snapped back to its default centered framing. The host now sends an annotation-only `archUpdate` message (layers, violation counters, red edges) that the webview patches in place, so camera position and the settled node layout are preserved.

### Removed
- **Legacy in-panel AI chat** — the hidden **✨ Aura Assistant** side panel and its dead plumbing are gone (`src/chat.ts`, `webview/js/chat.js`, the `chat-toggle`/`chat-panel` markup, the `chatRequest`/`chatChunk`/`chatDone`/`chatError`/`chatTool` messages and the `body.chat-open` CSS). VS Code Chat (`@aura`), the Language Model tools and the MCP server are the supported AI surfaces and are unchanged.

## [1.4.1] - 2026-10-27

### Added
- **Dead-code framework exemptions (V2-13)** — built-in rules keep framework-owned entry points and callbacks out of the dead list (`main`, VS Code lifecycle, React components, Vue hooks, SwiftUI `body`, Java servlet methods, Unity callbacks, Arduino, test files). Exempted symbols are shown in the detail panel with their reason instead of being silently hidden. Custom rules can be edited from **⚙️ Settings → Dead code exemptions** (`.aura/dead-code.json`, validated JSON) and are merged after the defaults; saving triggers a re-analysis. Exemptions are persisted in `symbol_exemptions`, exported by `GraphDB`, and returned separately by the dead-code AI/MCP tools.
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
- **Communities use a shared code-only snapshot** — the extension/`GraphDB` computes the partition once; the webview, `@aura` and MCP read the same membership. Documentation nodes and `doc-reference` edges remain visible for exploration but no longer influence communities, structural fan-in, PageRank centrality or the risk score. Documentation labels are **yellow** so they remain distinguishable from code. Automatic labels use the full hub path; cards show total and currently visible file counts and support persisted **✏️ rename** with an empty label restoring the hub path.
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
