## Dead Code & Circular Dependencies

Aura can detect two common code quality issues directly in the 3D graph.

### Dead Code Detection ☠️

Press `X` or click the **Dead Code** button to highlight files with unused exports.

- Nodes turn **orange → red** based on how many unused exports they contain
- The detail panel lists each unused symbol with a ⚠️ label
- Great for finding exports that nothing imports

### Framework exemptions 🛡️

Framework entry points and callbacks are often called by the runtime, not by your code, so Aura keeps them out of the real dead list:

- `main`, VS Code `activate`/`deactivate`
- React components in `.tsx`/`.jsx` and Vue lifecycle hooks
- SwiftUI `body`, Java servlet methods, Unity callbacks
- Arduino `setup`/`loop` and test files

Exempted symbols stay visible in the detail panel with a 🛡️ **Exempted** section and their reason — they are never silently hidden. Add project-specific rules from **⚙️ Settings → Dead code exemptions → Edit rules…**; rules are stored in `.aura/dead-code.json`, defaults stay active, and saving starts a re-analysis.

### Unused Functions

The MCP tool `find_unused_functions` goes further: it detects functions and methods that are **never called anywhere** — not even within their own file. Use it via AI assistants to clean up dead logic after refactoring.

### Circular Dependencies 🔄

Press `C` or click the **Cycles** button to highlight all files involved in dependency loops.

- Cycle nodes glow **orange**
- The detail panel shows the full cycle path (A → B → C → A)
- Helps you break unwanted circular imports

### Symbol Cycles 🔁

File cycles are not the whole story: Aura also detects **function→function recursion** from resolved call sites.

- **Direct recursion** (`walk() → walk()`) and **mutual recursion** (`parse() → validate() → parse()`) appear in the detail panel's **🔄 Symbol cycles** section
- Every step keeps its **call line**; the flowchart badge adds **🔁 recursive** or **🔁 mutual recursion**
- Calls that resolve to several same-name candidates are marked **ambiguous** (confidence 0.5)
- The MCP `find_cycles` tool returns the same data as `symbol_cycles`

### Orphan Files

Press `O` to highlight files with **zero connections** in red — files that neither import nor are imported by anything.

All three modes can be combined with heatmaps for deeper analysis.
