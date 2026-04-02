## Time Travel ⏳

Navigate your project's git history and watch the dependency graph evolve over time.

### How to use

1. The **timeline bar** appears at the bottom of the graph
2. Aura scans your git history automatically in the background
3. Use the **slider** to jump to any commit, or the **Prev / Next** buttons to step through

### Controls

| Control | Action |
|---------|--------|
| Timeline slider | Jump to any scanned commit |
| Prev / Next buttons | Step one commit at a time |
| `←` / `→` arrow keys | Quick navigation |
| `Escape` | Return to HEAD (current state) |

### What you see

- **Changed files** are highlighted in yellow at each commit
- Commit info shows: short hash, message, and date
- Progress indicator: ⏳ X/Y commits while scanning
- Files that were added, removed, or modified across history are reflected in the graph

This is useful for understanding how your codebase architecture evolved and when complexity was introduced.
