## AI Integration 🤖

Aura exposes your codebase structure to AI assistants through a built-in **MCP server** (Model Context Protocol) and a local **Graph Database**.

### Graph Database

Every analysis is persisted to `.aura/graph.db` (SQLite via sql.js). This enables instant structural queries without re-parsing.

### MCP Server

The MCP server starts automatically and registers itself in `.vscode/mcp.json`. AI assistants (like GitHub Copilot) can then query your codebase graph.

**Available tools:**

| Tool | What it does |
|------|-------------|
| `find_dependencies` | What does a file depend on? (transitive) |
| `find_dependents` | What files would be affected by a change? |
| `find_path` | Shortest path between two files |
| `find_cycles` | All circular dependency cycles |
| `find_dead_code` | Unused exports across the codebase |
| `get_hotspots` | Most complex or impactful files |
| `search_symbols` | Find functions, classes, exports by name |
| `get_architecture` | High-level overview by language |

### Export for AI

Use the **Export** button (or command *Aura: Export Graph for AI*) to export the full graph data as JSON for manual analysis.
