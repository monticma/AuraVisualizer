## The City

The **🏙️ City** tab is the same graph, read as a city. Nothing is re-analysed — it is another way of looking at the files Aura already knows.

### What a building says

| Channel | Meaning | Change it with |
|---------|---------|----------------|
| **Height** | The metric you pick — cognitive complexity by default | the **height** dropdown |
| **Footprint** | How much of the plan the file takes, from its size | the **footprint** dropdown |
| **Colour** | The height ramp, the risk score, the language, the layer or the district | the **colour** dropdown |
| **District** | The folder the file belongs to | the **districts** dropdown (folder, layer or community) |

Files that are not code — documentation, data, config, assets — are drawn as **grey glass**: visible, but clearly outside the ranking.

### Reading the city

- The **hot band** — 5 % of the buildings, never fewer than 3 and never more than 20 — takes the red end of the ramp and carries a **#1…#N badge**. Everything else is muted, so the eye only goes where it matters.
- **Click** a building: it turns white, the files it depends on turn **blue**, the files that depend on it turn **amber**, and files in both directions turn **purple**. Everything else dims, outlines included.
- **Double-click** a building to open the file in the editor.
- Click a **district plate** to drill into that folder — the breadcrumb at the bottom walks back out.
- **Orbit** with the mouse: the camera stays above the plinth, so the plan always reads like a map.

### The inspector

The right-hand panel gives the file's metrics, its district, its **risk score with the reasons behind it** and the complexity trend, a small map of its relations, and two actions: **↗ Open** in the editor and **◫ View in** another view. Double-clicking a building does the same as **↗ Open**.

### When the city gets big

- The city grows with the square root of the building count while the **ground keeps a fixed grid** — so the streets stay a ruler you can read.
- **Function granularity** builds one tower per function and turns the file into the district: ~5 000 buildings for a repository this size.
- Above **1 500 buildings** contact shadows switch themselves off; the toggle in the legend tells you so.

### Floating windows and exports

- **🗺️ Map** — a small plan of the whole city with the camera footprint; drag it anywhere, `⟲` reframes the city.
- **🌀 Warps** — the same camera bookmarks as the 3D Graph, but scoped to the City: a pose saved here is not offered there.
- **📤 Export** — **PNG** for the city exactly as it is, and **Postcard** for a 1600×900 sheet with a caption: the method, the hottest buildings and the date.

The legend (bottom left) carries the switches for **district names**, **rank badges** and **shadows**.
