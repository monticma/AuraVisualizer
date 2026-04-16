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
| `I` | Toggle impact cascade from changed files |
| `Escape` | Return to HEAD (current state) |

### What you see

- **Added files** glow green, **removed files** glow pink, **modified files** glow yellow
- **Edges** follow the same color scheme (green = new link, pink = removed, yellow = changed)
- Commit info shows: short hash, message, and date
- Progress indicator: ⏳ X/Y commits while scanning

### Visual Diff — Compare any two commits

Press `V` or click the **⇄ Compare** button to enter **Compare mode**. A second slider appears — drag both sliders to diff any two commits. Files changed between those commits are highlighted; unchanged nodes and edges are dimmed. This shows the cumulative structural impact across a range of commits.

This is useful for understanding how your codebase architecture evolved and when complexity was introduced.
