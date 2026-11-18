## AI Integration 🤖

Aura exposes your codebase structure to AI assistants through a built-in **MCP server** (Model Context Protocol) and a local **Graph Database**.

### Graph Database

Every analysis is persisted to `.aura/graph.db` (SQLite via sql.js). This enables instant structural queries without re-parsing.

### Chat participant `@aura`

Open **VS Code Chat** and type `@aura ...` to ask about the codebase. Aura uses the analyzed graph — the same deterministic tools as MCP and the Language Model tools — so answers cite real files instead of guessing.

Slash commands: `/explain`, `/impact`, `/path`, `/hotspots`, `/query`. Each answer links files and offers **Focus in Aura**, **Apply Aura Query**, **Open Risk** and **Open Aura** buttons.

Contextual **Ask Aura** actions are also available in the file detail panel, clusters, community cards, layer cards, the Risk dashboard and the explorer context menu — they open VS Code Chat with the current view context already attached. The community **✨** action sends the palette's exact member files as the authoritative scope; the layer **✨** action sends the rule globs, members, `Ca`/`Ce`/`I`, new vs baselined violations and aggregated layer cycles. Documentation remains excluded from architectural analysis.

Aura has **no in-panel assistant**: the graph panel is for exploration, and **VS Code Chat** is the single conversational surface.

### MCP Server

The MCP server starts automatically and registers itself in `.vscode/mcp.json`. AI assistants (like GitHub Copilot) can then query your codebase graph.

Start with **`build`**: it answers “is this graph still in sync with my checkout?” — analysis age, file/link counts, the commit analysed vs `HEAD` and a `stale` flag with its reason — so the agent reports freshness instead of quoting outdated numbers. Then `explain_file` gives one-call briefings, `hotspots_in_changes` ranks the risk inside the working tree (or a branch diff with `base`) and `list_repositories` says which repository or worktree is being served.

**Available tools (22):**

| Tool | What it does |
|------|-------------|
| `build` | Readiness check — is the graph still in sync with the checkout? Returns the analysis age, file/link counts, the commit analysed vs `HEAD` and a `stale` flag with its reason |
| `explain_file` | One-call briefing for a file: metrics, risk score with reasons, cycles, dead code, call sites, dependencies, heritage, co-change partners, community |
| `hotspots_in_changes` | Risky files inside the current changes (working tree by default, or a branch with `base`), riskiest first with their `+/-` |
| `list_repositories` | Which repository/worktree Aura serves — root, database, analysis age, `HEAD`, staleness, `git worktree` list |
| `find_dependencies` | What does a file depend on? (transitive, includes inheritance) |
| `find_dependents` | Blast radius — what files would be affected by a change? (with risk levels) |
| `find_path` | Shortest path between two files |
| `find_cycles` | All circular dependency cycles |
| `find_orphan_files` | Files that nothing imports (entry-point / isolation candidates) |
| `find_dead_code` | Unused exports across the codebase; framework/test exemptions are returned separately with their reasons |
| `find_unused_functions` | Functions/methods never called anywhere — even within their own file |
| `get_hotspots` | Most at-risk files, ranked by the repository-relative risk score (percentile-based) with written reasons — optional `window_days`, raw sorts via `sort_by` |
| `get_largest_files` | Largest files by lines of code |
| `get_cochange` | Temporal-coupling pairs — files changing together without a direct dependency (Jaccard score) |
| `search_symbols` | Find functions, classes, exports by name |
| `find_heritage` | Inheritance and implementation relationships (extends/implements) |
| `get_architecture` | High-level overview by language |
| `get_communities` | Code-only architectural modules from the shared Louvain snapshot; labels are hub paths or user renames, documentation is excluded |
| `search_docs` | Full-text search across project documentation (`.md`, `.markdown`, `.txt`, `.rst`) — returns ranked chunks with file path, section heading, and excerpt |
| `resolve_context` | Ranked list of files most relevant to a natural-language task (deterministic, no LLM) |
| `generate_documentation` | Full documentation payload in one call: overview, modules, hotspots, cycles, dead code |
| `get_architecture_violations` | Evaluate `.aura/arch-rules.json` — new deny/slice violations, per-layer Ca/Ce/instability and aggregated layer cycles (optional `layer` filter, baselined included on demand) |

Every symbol-bearing answer carries a `file`, a `line` and a ready-to-cite `anchor` (`"src/risk/risk-core.ts:142"`), and the dependency tools also return the direct `call_sites` behind each edge — the agent opens the exact line instead of searching the repository.

The server also sends **operating instructions** on connect: call `build` first, prefer the indexed tools over shell `git`/`grep`, quote the anchors, and report staleness instead of presenting outdated numbers as current.


### Export for AI

Use the **📤 Export** button (or command *Aura: Export Graph for AI*) to build a focused context for an LLM:

- Choose **Markdown** or structured **JSON**.
- Pick sections: modules, contracts, hotspots, cycles and dead code.
- Set a token budget (2k / 4k / 8k / 16k / no limit); truncation is reported explicitly.
- Save the result or copy it directly into a chat prompt.

For a raw graph, use the MCP `generate_documentation` tool or `get_architecture` / `get_hotspots` instead.

### Export the graph itself: DOT, GraphML, Mermaid

Three formats, one sentence each:

- **DOT** (Graphviz) — the file you attach to a design review. One `subgraph` per folder, node width from the file size, fill colour from the language, dashed edges for documentation references, and a header comment with the `unflatten -l 3 -c 5` tip that turns a hairball into a drawing.
- **GraphML** — the file you open in Gephi, yEd or NetworkX. Typed attributes, synthetic node ids with the path in a `<data>`, folders expressed as an attribute (Gephi partitions, NetworkX without code) or as nested graphs.
- **Mermaid** — the file you paste in a README. It is saved as a **fenced Markdown document** (````mermaid`), because a `.md` file holding bare Mermaid source is previewed as a single endless line: Markdown joins consecutive lines into one paragraph. It is **capped on both axes** — `auraVisualizer.mermaidNodeLimit` (default 300) and `auraVisualizer.mermaidEdgeLimit` (default 500, which is Mermaid's own ceiling: above that a renderer draws nothing), `0` lifting a cap. Nodes go by fan-in, relations by importance (inheritance and calls before `<script>`/`global-use`), and the header plus a trailing `%%` line say what was left out.

**Which graph?** `Aura: Export Graph (DOT / GraphML / Mermaid)` from the palette exports the **whole** graph; the 📤 Export menu of the graph view exports **what you see** — the active filters included.

`auraVisualizer.graphClusters` chooses `first-level` or `full` folders for DOT and Mermaid, `auraVisualizer.graphmlGroups` chooses `attribute` or `nested` for GraphML. Every format is deterministic: the same graph always produces the same text.

### Agent context files

An assistant that opens a repository it has never seen does not know which files are dangerous. **Aura: Generate Agent Context** writes that knowledge where agents actually look:

- `.aura/hotspots.json` — the exact `get_hotspots` payload (score, bucket, reasons, fan-in/out);
- `.aura/HOTSPOTS.md` — the same data as a readable table (`.aura/` is git-ignored, this copy stays local);
- a short block between `<!-- aura:begin -->` and `<!-- aura:end -->` in the first instruction file that exists — `AGENTS.md`, `.github/copilot-instructions.md`, then `CLAUDE.md`.

The block lists the top 10 hotspots with their reasons plus the repository health line (cycles, dead exports, architecture violations). Regenerating replaces only what is between the markers, so the prose around it is never touched, and only paths and metrics are written — never source code. If no instruction file exists the command offers to create `AGENTS.md`; the automatic refresh (`auraVisualizer.agentContext`, off by default) only ever updates a file that already exists.

### How much can an agent trust the graph?

Every tool answer now carries a **`coverage`** block — `files`, `parsed_failed`,
`edges`, `guessed`, `unresolved`, `bare_specifiers`, `analyzed_at` — plus a
`warning` sentence when something is off:

> *3 files failed to parse and 118 relations are unresolved (41 bare specifiers,
> outside the repository): an empty result is not a proof of absence.*

The **`get_resolution`** tool returns the full report — what was read, parsed,
resolved, guessed and refused, with a code per reason (`bare-specifier`,
`missing-file`, `outside-root`, `no-tsconfig`, `unparsed-file`, `ambiguous`) and
the blind spots the analysis cannot see at all. `format: "markdown"` returns the
same content ready to paste into a pull request.

The same numbers sit behind the **⚠ chip** in the graph bar, and
**Aura: Export Resolution Report** writes the Markdown from the command palette.
