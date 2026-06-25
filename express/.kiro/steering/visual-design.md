---
inclusion: always
---

# Visual Design: Ghosty Animation, Wall Textures, Background Parallax

These conventions govern the **presentation layer only** — the `Renderer` adapter and any visual-state it owns. They must never influence the simulation. The scene matches the reference UI (`img/example-ui.png`): a flat 2D, sky-blue field with drifting clouds, green pipe pairs, the Ghosty sprite, and score text.

## Hard Rule: Visuals Never Touch the Simulation

- The renderer is a **read-only consumer** of `GameState`. It never mutates game state and never feeds values back into `step`.
- **No visual concern may affect determinism.** Animations, easing, particles, and parallax are computed from render time or a presentation-only clock — never from the seedable `Rng` that drives gameplay, and never from anything the core reads.
- Gameplay collision uses the simulation's axis-aligned bounds (`ghost.width × ghost.height`, full-width pipe segments). Sprite art, padding, and visual flourishes must not change those bounds. If art looks larger/smaller than the collider, adjust the *drawing*, not the collider.
- All draw calls must tolerate a frozen or paused state (e.g. `GameOver`) without advancing simulation values.

## Ghosty Character

The simulation provides Ghosty as `{ x, y, vy, width, height }`. The renderer draws `ghosty.png` centered on `(x, y)`, scaled to the rendered bounds.

### Sprite loading & placeholder

- Load `assets/ghosty.png` once at startup and cache it. Never load per frame.
- `GameState.spriteLoaded` reflects load success. When `false`, draw a **solid placeholder rectangle** filling the ghost's bounding area. Simulation continues unchanged either way.
- The placeholder is a visual fallback only; it uses the same bounds as the sprite.

### Animation (presentation-only)

Ghosty is a single static sprite in the source assets, so all motion is procedural and driven by render-time interpolation, not by additional simulation state:

- **Tilt by velocity.** Rotate the sprite based on `ghost.vy` to convey rise/fall: tilt nose-up on a flap (negative `vy`), nose-down as it falls. Clamp rotation to a tasteful range (e.g. `-25°` to `+70°`) and ease toward the target angle each frame so it feels smooth. Derive the angle from `vy` and a presentation easing factor — do not store it in `GameState`.
- **Flap pop (optional).** A brief scale/squash-and-stretch on the frame a flap occurs, decaying over a few hundred ms of render time. Drive it from a render-local timer, not the sim.
- **Idle bob in `Ready` (optional).** A gentle vertical sine bob purely for the renderer while phase is `Ready`. It must not change `ghost.y` in state — offset only at draw time.
- **No animation may gate or delay input or state transitions.** A flap registers instantly in the simulation regardless of any in-flight visual animation.

## Wall (Pipe) Textures

Pipes are `PipePair` data; the renderer draws the upper segment `[0, gapCenterY - gapHeight/2]` and lower segment `[gapCenterY + gapHeight/2, H]`, each spanning the full pipe width `[x, x+width]`.

- **Color:** green pipe bodies on the sky-blue field, matching the reference UI. Keep a single source-of-truth color constant in the renderer.
- **Full-coverage segments.** Each segment fills its full rectangle — no gaps between the pipe art and the field edges. The visible gap is exactly the simulation gap; do not visually narrow or widen it.
- **Optional texture/shading.** A subtle vertical edge highlight, a darker rim, or a "lip" cap at the gap-facing end is allowed for depth, drawn within the segment rectangle. Caps and trim must stay inside the segment bounds so they never imply a different collider.
- **Pixel alignment.** Round draw coordinates to whole pixels at draw time to avoid shimmer on the scrolling edges; never round the underlying simulation positions.

## Background & Parallax

The background is layered back-to-front: sky → clouds → pipes → Ghosty → HUD text.

- **Sky:** a solid sky-blue fill covering the field each frame (drawn first).
- **Clouds:** the simulation supplies `Cloud` entities `{ x, y, width, height, opacity, speed }`. Draw each at its position with its `opacity`. Cloud `speed` already encodes parallax — slower clouds read as farther away.
- **Parallax layering.** The simulation guarantees at least two distinct cloud speeds (the slower at most `0.60 ×` the faster) and speeds within `config.clouds.speedRange * pipeSpeed`. Render slower (more distant) clouds behind faster ones, and optionally tint distant clouds with lower opacity / slight desaturation to reinforce depth. Cloud motion comes from the simulation's `scrollClouds`; the renderer does not invent its own cloud drift.
- **Decorative only.** Clouds never affect gameplay. They may be culled/recycled for performance but must keep drifting toward the left edge.
- **Purely cosmetic extra layers** (e.g. a faint static gradient or distant skyline) are allowed as long as they are drawn from presentation state only and add no per-frame simulation cost in the core.

## HUD / Score Text

- **`Playing`:** draw the current score prominently (top-center per the reference UI).
- **`Ready`:** show the high score and a start prompt.
- **`GameOver`:** show the final score and the high score, plus a restart prompt.
- Text values come straight from `GameState.score` / `GameState.highScore`. The renderer formats; it does not compute scoring.

## Rendering Pipeline (per frame)

Draw order, every frame, from a read-only `GameState`:

1. Sky-blue background fill.
2. Clouds, far (slow) to near (fast), each with its opacity.
3. Pipe pairs (upper + lower green segments, full width).
4. Ghosty (sprite with velocity tilt, or placeholder rectangle if `!spriteLoaded`).
5. HUD text for the current phase.

## Performance & Asset Conventions

- Load all images once at startup and cache them; guard against load failure with the placeholder path.
- Avoid per-frame allocation in the draw path (reuse gradients/paths; don't build arrays each frame).
- Snap to whole-pixel draw coordinates to reduce shimmer; keep simulation coordinates untouched.
- Scale the canvas to the logical field on resize so the scene stays resolution-independent.

## Visual Anti-Patterns to Avoid

- Driving any animation from the gameplay `Rng` or feeding render values back into `step`.
- Making the drawn sprite/pipe art imply a collider different from the simulation bounds.
- Blocking or delaying input/state transitions behind an animation.
- Reloading image/audio assets per frame.
- Inventing cloud motion in the renderer instead of using the simulation's `Cloud.speed` / `scrollClouds`.
- Rounding or mutating simulation positions for visual reasons.
