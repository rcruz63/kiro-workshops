---
inclusion: always
---

# Game Mechanics: Ghosty Physics, Wall Generation, Scoring

These rules define the gameplay mechanics for Flappy Kiro and how they must be implemented. All mechanics live in the **pure simulation core** and read every tunable value from the threaded `GameConfig` — never from hardcoded literals. All values below are the `DEFAULT_CONFIG` defaults; the implementation must remain correct for any valid config.

## Coordinate & Timing Conventions

- **Logical play field** of width `W` and height `H`. All positions expressed as fractions of `W`/`H` are resolved against the actual `Field` at the use site, so the simulation is resolution-independent.
- **Y axis points down.** `y = 0` is the top boundary, `y = H` is the bottom. Upward motion is negative; gravity is positive.
- **Fixed timestep.** Simulation advances in fixed steps of `config.physics.fixedTimestep` (default `1/60` s) via an accumulator. Physics must never depend on the real frame interval.

## Ghosty Movement Physics

Ghosty is a data-only entity `{ x, y, vy, width, height }`. `x` is fixed at `config.ghost.startXRatio * W` during play; only `y` and `vy` change. Behavior is expressed as pure helpers, not methods.

### Gravity (continuous downward acceleration)

Each `Playing` step integrates velocity then clamps to terminal velocity:

```
vy_next = min(vy + config.physics.gravity * dt, config.physics.terminalVelocity)
```

- `config.physics.gravity` default `1800` px/s² (downward, positive).
- `config.physics.terminalVelocity` default `+900` px/s. Velocity must never exceed this, and the bound must hold across any number of repeated steps.
- Clamping is one-sided: only the downward (positive) magnitude is capped. Upward velocity from a flap is not clamped by terminal velocity.

### Flap (instantaneous upward impulse)

A flap sets vertical velocity to a fixed value — it does not add to the current velocity:

```
vy_next = config.physics.flapVelocity   // default -500 px/s (upward)
```

- A flap fully replaces `vy` regardless of the prior velocity. This applies both to the start flap (`Ready` → `Playing`) and to in-play flaps.
- A flap during `Playing` emits exactly one `playFlapSound` effect. The start flap also emits `playFlapSound`.
- Effects are returned as data from `step`; the core never plays audio directly.

### Position integration

```
y_next = y + vy * dt
```

Straightforward Euler integration against the fixed `dt`. No frame-rate scaling beyond the fixed step.

### Ready position

On entering `Ready`, Ghosty is placed at `(config.ghost.startXRatio * W, config.ghost.startYRatio * H)` — default `(0.30 * W, 0.50 * H)` — with score reset to `0` and the pipe list emptied.

## Wall (Pipe) Generation Algorithms

Walls are `PipePair` entities `{ x, width, gapCenterY, gapHeight, scored }`. A pair occupies `[x, x+width]` horizontally; the upper segment spans `[0, gapCenterY - gapHeight/2]` and the lower segment spans `[gapCenterY + gapHeight/2, H]`. Pipes follow a spawn → scroll → score → cull lifecycle.

### Scrolling

Every pipe moves left at the fixed traversal speed each step:

```
pipeSpeed = W / config.pipes.scrollSeconds          // default W / 4.0 px/s
x_next   = x - pipeSpeed * dt
```

A pipe therefore crosses the full field width in `config.pipes.scrollSeconds` seconds.

### Spawn trigger (horizontal spacing)

`shouldSpawn` returns true exactly when the most recently generated pipe has moved at least `config.pipes.spawnGapRatio * W` (default `0.50 * W`) from the right edge. This yields consistent spacing between consecutive pipes. The first pipe enters from the right edge (`x = W`) on the start flap.

### Gap sizing & placement

A spawned `PipePair` must satisfy:

- **Gap height** = `config.pipes.gapHeightRatio * H` (default `0.25 * H`).
- **Gap placement** keeps the gap clear of both boundaries by at least `config.pipes.marginRatio * H` (default `0.10 * H`). Concretely, `gapCenterY` is sampled within:

  ```
  [ marginRatio*H + gapHeight/2 , (1 - marginRatio)*H - gapHeight/2 ]
  ```

- **Randomness is deterministic.** `gapCenterY` is drawn from the seedable `Rng` carried in `GameState` — never `Math.random()`. The same seed must reproduce the same pipe sequence (required for property tests and replays).

### Culling

`cullPipes` removes exactly those pipes whose right-most edge has crossed the left boundary (`x + width < 0`) and retains all others. This keeps the pipe collection bounded; prefer culling over unbounded growth and recycle via a pool if allocation becomes a hot-path concern.

## Scoring System Patterns

- **Pass detection.** The score increases by exactly `1` when Ghosty's horizontal position passes a pipe's trailing edge (`ghost.x > pipe.x + pipe.width`).
- **Idempotent per pipe.** Each `PipePair` carries a `scored` flag. Once scored, repeated steps over the same already-passed pipe must never increment the score again. Set `scored = true` the moment it counts.
- **Score is a non-negative integer** held in `GameState.score`; reset to `0` on entering `Ready`.

### High score

- On transition to `GameOver`: `highScore = max(previousHighScore, score)`.
- Whenever the high score increases, `step` emits a `persistHighScore` effect carrying the new value. The shell forwards it to `HighScoreStore`; the core never touches `localStorage`.
- The persisted value must round-trip through `parseHighScore` to the same number.
- `parseHighScore(raw)` returns the value as a non-negative integer only for a valid non-negative integer string, and returns `0` for null/empty/whitespace/non-numeric/negative/floating-point/out-of-range input.
- If persistence fails (quota/denied/unavailable), keep the updated high score in memory for the session and continue into `GameOver` normally.

## Collision & Boundary Rules

- **Collision model:** axis-aligned rectangle intersection between Ghosty's bounds (centered on `(x, y)`, size `width × height`) and either pipe segment.
- **Game over** on any of: bounds intersect a pipe segment, top edge reaches/passes `y = 0`, or bottom edge reaches/passes `y = H`. Advancing one step from such a `Playing` state transitions to `GameOver`.
- **Clear passage:** if Ghosty's bounds lie entirely within a gap and within the vertical boundaries (intersecting neither segment), the phase stays `Playing`.
- Entering `GameOver` emits exactly one `playGameOverSound`; subsequent `GameOver` steps emit none.

## State Machine

Three phases drive interpretation of every step and input:

- **`Ready`** — Ghosty parked at the start position; a flap transitions to `Playing`, applies the flap impulse, spawns the first pipe from the right edge, and emits `playFlapSound`. Non-flap input keeps the phase `Ready`.
- **`Playing`** — gravity, integration, flap handling, pipe scroll/spawn/cull, scoring, and collision/boundary checks all run each step.
- **`GameOver`** — fully frozen: Ghosty position/velocity and all pipe positions are unchanged across any number of steps. A restart input resets via `toReady` (score `0`, pipes cleared, Ghosty repositioned, phase `Ready`).

A single physical action (key/click) is interpreted by phase: it is a **flap** in `Ready`/`Playing` and a **restart** in `GameOver`.

## Invariants (must always hold)

1. Gravity-clamped velocity never exceeds `config.physics.terminalVelocity`, across any number of steps.
2. A flap sets `vy` to exactly `config.physics.flapVelocity`, independent of prior velocity.
3. Generated gaps are exactly `config.pipes.gapHeightRatio * H` tall and stay at least `config.pipes.marginRatio * H` from each boundary.
4. Each pipe contributes at most `+1` to the score, ever.
5. `highScore` is monotonic non-decreasing and equals the max of itself and the score.
6. The `GameOver` state is frozen.
7. All randomness flows through the seedable `Rng`; identical seeds produce identical runs.
