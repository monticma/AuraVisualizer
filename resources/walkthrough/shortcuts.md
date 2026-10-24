## Keyboard Shortcuts ⌨️

Quick access to every feature without leaving the keyboard.

| Key | Action |
|-----|--------|
| `Ctrl+K` | Open the query filter bar |
| `F` | Fit to view / recenter camera |
| `L` | Toggle node labels |
| `G` | Toggle directory groups |
| `H` | Cycle through heatmap modes (Complexity, Fan-in/out, Churn, Communities…) |
| `P` | Toggle path-finding mode |
| `D` | Toggle DAG (hierarchical) layout |
| `O` | Highlight orphan files |
| `X` | Toggle dead code visualization |
| `C` | Toggle circular dependencies |
| `I` | Toggle timeline impact cascade |
| `V` | Toggle timeline compare mode (dual slider) |
| `1`–`5` | Set pinned focus depth (1 to 5 levels) |
| `Space` | Toggle pilot mode (free flight) — `Esc` exits and orbit resumes at the same view |
| `Alt`+`Shift`+`1`–`9` | Fly to the warp point on that quick slot |
| `←` `→` | Timeline: previous / next commit |
| `Escape` | Reset everything — clear all selections, heatmaps, and timeline |

### Toolbar buttons

| Button | Effect |
|--------|--------|
| **🔍 Query** | Toggle the query filter bar (also `Ctrl+K`) — filter / highlight / select files by metric |
| **� Follow** | Fly the camera to the active editor file; manual camera movement pauses it || **📤 Export** | Guided AI context export — Markdown/JSON, sections and token budget || **�🗺️ Map** | Toggle the minimap — real-time overview that rotates with the camera |
| **✏️ Dirty** | Show only files with uncommitted changes (git working tree) |
| **📝 Notes** | Show/hide the note indicators — annotated files wear a pulsing note-colored ring + dot |
| **🔗 Co-change** | Show virtual temporal-coupling links for the strongest co-change pairs |
| **🌀 Warps** | Warp points panel — capture the current view (📌), fly back to any saved pose, quick slots |
| **🚀 Pilot** | Free flight — WASD/QE to move, mouse to look, hold left/right click to advance/retreat (`Space` toggles) |
| **⚙️ Settings** | Open the in-app settings modal — rotation speed, link style, node effect, risk window, follow editor, auto-refresh |

### Toolbar sliders

| Slider | Effect |
|--------|--------|
| **Node Size** | Scale the visual size of all nodes |
| **Spread** | Adjust the repulsion force in the layout |
| **Depth** | Set neighbor depth for pinned focus (1–5) |

### In-App Settings ⚙️

The **⚙️ button** (next to 🔍 Query) opens an in-app settings modal — changes apply instantly and are saved to your workspace settings:

- **Risk history window** — 30 / 90 / 365 days (Risk Map, status bar and hotspots)
- **Mouse rotation speed** — 1–5 slider, live value shown on the right
- **Link style & curvature** — straight or curved dependency edges
- **Selected node effect** — glow halo or bloom post-processing (intensity / radius / threshold)
- **Auto-refresh on save** — re-analyze changed files automatically
- **Follow editor** — fly the camera to the active file; manual camera movement pauses it until you click 👁 again
- **Flight speed · smoothing · mouse sensitivity · invert Y** — pilot mode feel

### Status bar

The risk item (bottom right of the VS Code window) shows the risk of the file you are editing — its tooltip lists the written reasons. When your uncommitted changes touch high-risk files it becomes **⚠ N hotspots in your changes**; click it to reveal the file in the Risk tab.
