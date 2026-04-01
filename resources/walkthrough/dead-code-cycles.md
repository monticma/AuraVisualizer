## Dead Code & Circular Dependencies

Aura can detect two common code quality issues directly in the 3D graph.

### Dead Code Detection ☠️

Press `X` or click the **Dead Code** button to highlight files with unused exports.

- Nodes turn **orange → red** based on how many unused exports they contain
- The detail panel lists each unused symbol with a ⚠️ label
- Great for finding exports that nothing imports

### Circular Dependencies 🔄

Press `C` or click the **Cycles** button to highlight all files involved in dependency loops.

- Cycle nodes glow **orange**
- The detail panel shows the full cycle path (A → B → C → A)
- Helps you break unwanted circular imports

### Orphan Files

Press `O` to highlight files with **zero connections** in red — files that neither import nor are imported by anything.

All three modes can be combined with heatmaps for deeper analysis.
