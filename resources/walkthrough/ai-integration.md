## AI Integration 🤖

Aura exposes your codebase structure to AI assistants through a built-in **MCP server** (Model Context Protocol) and a local **Graph Database**.

### Graph Database

Every analysis is persisted to `.aura/graph.db` (SQLite via sql.js). This enables instant structural queries without re-parsing.

### Chat participant `@aura`

Open **VS Code Chat** and type `@aura ...` to ask about the codebase. Aura uses the analyzed graph — the same deterministic tools as MCP and the Language Model tools — so answers cite real files instead of guessing.

Slash commands: `/explain`, `/impact`, `/path`, `/hotspots`, `/query`. Each answer links files and offers **Focus in Aura**, **Apply Aura Query**, **Open Risk** and **Open Aura** buttons.

Contextual **Ask Aura** actions are also available in the file detail panel, clusters, community cards, the Risk dashboard and the explorer context menu — they open the chat with the current view context already attached. The community **✨** action sends the palette's exact member files as the authoritative scope; documentation remains excluded from architectural analysis.

### MCP Server

The MCP server starts automatically and registers itself in `.vscode/mcp.json`. AI assistants (like GitHub Copilot) can then query your codebase graph.

**Available tools (17):**

| Tool | What it does |
|------|-------------|
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

### Export for AI

Use the **📤 Export** button (or command *Aura: Export Graph for AI*) to build a focused context for an LLM:

- Choose **Markdown** or structured **JSON**.
- Pick sections: modules, contracts, hotspots, cycles and dead code.
- Set a token budget (2k / 4k / 8k / 16k / no limit); truncation is reported explicitly.
- Save the result or copy it directly into a chat prompt.

For a raw graph, use the MCP `generate_documentation` tool or `get_architecture` / `get_hotspots` instead.
