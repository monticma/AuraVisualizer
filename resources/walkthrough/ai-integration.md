## AI Integration 🤖

Aura exposes your codebase structure to AI assistants through a built-in **MCP server** (Model Context Protocol) and a local **Graph Database**.

### Graph Database

Every analysis is persisted to `.aura/graph.db` (SQLite via sql.js). This enables instant structural queries without re-parsing.

### MCP Server

The MCP server starts automatically and registers itself in `.vscode/mcp.json`. AI assistants (like GitHub Copilot) can then query your codebase graph.

**Available tools:**

| Tool | What it does |
|------|-------------|
| `find_dependencies` | What does a file depend on? (transitive, includes inheritance) |
| `find_dependents` | Blast radius — what files would be affected by a change? (with risk levels) |
| `find_path` | Shortest path between two files |
| `find_cycles` | All circular dependency cycles |
| `find_dead_code` | Unused exports across the codebase |
| `find_unused_functions` | Functions/methods never called anywhere — even within their own file |
| `get_hotspots` | Most complex or impactful files |
| `search_symbols` | Find functions, classes, exports by name |
| `find_heritage` | Inheritance and implementation relationships (extends/implements) |
| `get_architecture` | High-level overview by language |
| `get_communities` | Architectural modules detected by Louvain algorithm |
| `search_docs` | Full-text search across project documentation (`.md`, `.markdown`, `.txt`, `.rst`) — returns ranked chunks with file path, section heading, and excerpt |
| `resolve_context` | Ranked list of files most relevant to a natural-language task (deterministic, no LLM) |
| `generate_documentation` | Full documentation payload in one call: overview, modules, hotspots, cycles, dead code |

### Export for AI

Use the **Export** button (or command *Aura: Export Graph for AI*) to export the full graph data as JSON for manual analysis.

### Aura Assistant (in-app chat) ✨

Click the **✨** button in the tab bar to open the chat panel and ask about your codebase in natural language. The assistant calls the graph tools (`resolve_context`, `find_cycles`, `find_dead_code`, `get_hotspots`, `find_path`, …) to answer with real data, and every cited file is clickable. Requires the Language Model API (VS Code ≥ 1.95) and a configured LM provider.
