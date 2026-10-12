# Changelog

All notable changes to Aura Visualizer are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
