## Function Flowcharts

Read a function's logic at a glance — every branch, loop and call, laid out as a diagram.

**How to use:**
1. Click a file node to open its detail panel (or expand the file's chevron in the Explorer)
2. In the **Functions** list, click the **⑂** button next to a function
3. The flowchart opens — built on demand from the source AST (JS/TS/TSX, Python, C, C++)

**Reading the chart:**
- Conditions fork into **T** / **F** branches that re-join below
- Loops show a framed body with a **back edge** carrying the loop label
- `switch` cases line up as columns; `try` / `catch` / `finally` stack as labelled frames
- **Red dashed** boxes are **dead code** — unreachable after a `return` / `throw`
- The badge in the header shows the function's **complexity** (its number of decision points)

**Actions:**
- **Click a step** → open the file at that exact line
- **Click a call chip** (`↳ fn()`) → drill into that function's flowchart; the breadcrumb at the top walks back
- **⤓ SVG** → download the chart as a standalone vector file
- Drag the header to move the window, drag any edge or corner to resize it; `Esc` closes
