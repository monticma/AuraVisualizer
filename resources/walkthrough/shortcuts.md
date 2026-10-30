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
| **👁 Follow** | Fly the camera to the active editor file; manual camera movement pauses it |
| **📤 Export** | Guided AI context export — Markdown/JSON, sections and token budget |
| **🗺️ Map** | Toggle the minimap — real-time overview that rotates with the camera |
| **💠 Centrality** | Toggle soft halos around the top 10% structural PageRank files |
| **✏️ Dirty** | Show only files with uncommitted changes (git working tree) |
| **📝 Notes** | Show/hide the note indicators — annotated files wear a pulsing note-colored ring + dot |
| **🔗 Co-change** | Show virtual temporal-coupling links for the strongest co-change pairs |
| **🌀 Warps** | Warp points panel — capture the current view (📌), fly back to any saved pose, quick slots |
| **🚀 Pilot** | Free flight — WASD/QE to move, mouse to look, hold left/right click to advance/retreat (`Space` toggles) · gamepad: sticks move/look, L2 down, R2 boost, ✕ reset, ○ exit |
| **⚙️ Settings** | Open the in-app settings modal — rotation speed, link style, node effect, risk window, dead-code exemptions, follow editor, auto-refresh |

### Toolbar sliders

| Slider | Effect |
|--------|--------|
| **Node Size** | Scale the visual size of all nodes |
| **Spread** | Adjust the repulsion force in the layout |
| **Depth** | Set neighbor depth for pinned focus (1–5) |

### In-App Settings ⚙️

The **⚙️ button** (next to 🔍 Query) opens an in-app settings modal — changes apply instantly and are saved to your workspace settings:

- **Risk history window** — 30 / 90 / 365 days (Risk Map, status bar and hotspots)
- **Complexity trend threshold** — complexity points per 30 days that flag a file as degrading (default 0.5)
- **Dead code exemptions** — edit custom framework/test rules stored in `.aura/dead-code.json`; defaults stay active
- **Mouse rotation speed** — 1–5 slider, live value shown on the right
- **Link style & curvature** — straight or curved dependency edges
- **Selected node effect** — glow halo or bloom post-processing (intensity / radius / threshold)
- **Auto-refresh on save** — re-analyze changed files automatically
- **Follow editor** — fly the camera to the active file; manual camera movement pauses it until you click 👁 again
- **Flight speed · smoothing · mouse sensitivity · invert Y** — pilot mode feel
- **Gamepad in pilot mode** — fly with a DualSense/Xbox pad: left stick moves, right stick looks, L2/R2 descend/boost (on by default)

### Gamepad 🎮 (pilot mode)

A DualSense, DualShock or Xbox pad works out of the box while flying — any pad that reports the **W3C standard mapping**:

| Input | Action |
|-------|--------|
| **Left stick** | Move — forward / back / strafe, camera-relative (analog, 15% deadzone + response curve) |
| **Right stick** | Look — yaw / pitch, rate follows the mouse-sensitivity setting |
| **L2 / R2** | Descend / boost — analog triggers, not on/off buttons |
| **✕** | Reset the camera to a full-graph overview |
| **Touchpad click** | Re-aim at the graph centre without moving |
| **D-pad ↑ / ↓** | Step the speed multiplier up / down (same as the wheel) |
| **Options** | Reset the speed multiplier to ×1 |
| **○** | Leave the flight (orbit resumes at the same pose) |

Pads are polled only while flying, and a browser hides a pad until one of its buttons has been pressed once with the window focused. Commands: `auraVisualizer.gamepadEnabled`.

### Editor CodeLens ⟡

In analyzed files, every function, method and class carries a `⟡ focus · flow · impact` lens:

| Action | Effect |
|--------|--------|
| **⟡ Focus in Aura** | Opens the panel and centers the 3D graph on this file |
| **⑂ Show flowchart** | Control flow of this function, built from the AST |
| **💥 Blast radius** | Every file impacted by this one, colored by depth |

Symbols and lines come from the graph database — no language server needed — and a file that was never analyzed shows no lens. Commands: `Aura: Focus Symbol in Graph`, `Aura: Show Symbol Flowchart`, `Aura: Symbol Blast Radius`; switching it off is `auraVisualizer.codeLens` (or **⚙️ Settings**).

### Blast radius from the code 💥

The impact analysis also starts outside the graph:

| Where | Action |
|-------|--------|
| **Source Control** (right-click) | *Aura: Blast Radius* on one file, or on a **multi-selection** to seed the multi-file impact cascade |
| **Editor title** | The radio-tower icon (`Aura: Blast Radius`) on the file's tab |
| **Editor** (right-click) | *Aura: Blast Radius* |
| **Explorer** (right-click) | Same entry on any file |
| **Command palette** | *Aura: Blast Radius* — uses the active editor |

Files outside the workspace or outside the analyzed graph are skipped, and Aura only opens when something matches.

### Command palette 🎛️

| Command | What it does |
|---------|--------------|
| **Aura: Focus File in Graph…** | Fuzzy picker over analyzed files → focuses the node and opens its detail panel |
| **Aura: Apply Saved Query…** | Replays a query saved from the query bar (filter / highlight / select mode) |
| **Aura: Add Warp Here** | Names a warp on the current camera pose |

### Status bar

The risk item (bottom right of the VS Code window) shows the risk of the file you are editing — its tooltip lists the written reasons. When your uncommitted changes touch high-risk files it becomes **⚠ N hotspots in your changes**; click it to reveal the file in the Risk tab.
