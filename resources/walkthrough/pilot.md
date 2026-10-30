## Pilot Mode 🚀

Orbiting keeps the camera outside the graph. **Pilot mode** puts it inside: the camera becomes the centre of the world and you fly through your architecture.

### Enter and leave

Click the **🚀 Pilot** toolbar button or press `Space`. Leave with `Esc`, `Space`, or `○` on a gamepad — the orbit controls resume at the exact same view: the orbit target is re-aimed ahead of the camera, so nothing snaps.

While flying, single-letter shortcuts (`F`, `D`, `H`, `X`…), hover, clicks and the detail panel are **suspended**: pilot mode is for navigating, not selecting.

### Keyboard and mouse

| Input | Action |
|-------|--------|
| `W` `A` `S` `D` | Move forward / left / back / right — camera-relative, matched on the **physical keys**, so AZERTY gets `ZQSD` |
| `Q` / `E` | Descend / ascend |
| Mouse | Look around (pointer lock — click the graph once to lock the pointer) |
| Hold **left** / **right** button | Fly forward / backward while you steer by looking |
| Wheel | Base-speed multiplier (`×0.25` → `×4`, shown in the HUD) |
| `Shift` | Boost (×3.5) |
| `Esc` / `Space` | Leave the flight |

Speed is **scene-scaled**, so the same settings feel identical on a 40-file project and on a 5 000-file graph, and movement is smoothed (acceleration + damping) — a drone, not a cursor. There is no roll and the pitch is clamped, which keeps the horizon stable.

### Gamepad 🎮

A DualSense, DualShock or Xbox pad works as soon as it reports the W3C **standard mapping** — no configuration. Keyboard and pad add up, so you can fly with both.

| Input | Action |
|-------|--------|
| **Left stick** | Move — analog, with a 15 % deadzone and a response curve for precise nudges |
| **Right stick** | Look — its rate follows the **Mouse look sensitivity** setting |
| **L2 / R2** | Descend / boost — analog triggers, proportional to the travel |
| **✕** | Reset the camera to a full-graph overview (you stay in flight) |
| **Touchpad click** | Re-aim at the graph centre without moving |
| **D-pad ↑ / ↓** | Step the speed multiplier up / down (like the wheel) |
| **Options** | Reset the speed multiplier to ×1 |
| **○** | Leave the flight |

The connected pad's name appears in the pilot HUD. Pads are only polled while flying, and a browser hides a pad until one of its buttons has been pressed once with the window focused — press a button and it shows up. Turn the support off with the **Gamepad in pilot mode** checkbox in **⚙️ Settings** (`auraVisualizer.gamepadEnabled`).

### Tips

- The **🗺️ Map** minimap becomes your GPS: it reads the camera, so it keeps working in flight.
- **🌀 Warps** are the anchors — capture a pose (📌), fly away, then `Alt+Shift+1–9` to jump back.
- Too slow at full throttle? Raise **⚙️ Settings → Flight speed** or step the multiplier with the wheel / d-pad.
- Motion sickness: keep the base speed low, skip the boost, and leave the flight as soon as you feel it.
