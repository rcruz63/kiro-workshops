---
inclusion: always
---

# Flappy Kiro Domain Rules: Obstacles, Gap Sizing, Difficulty Progression

Domain rules for how obstacles (pipe pairs) are generated, how gaps are sized, and how difficulty may progress over a run. These live in the **pure simulation core**, read every value from the threaded `GameConfig`, and use only the seedable `Rng` for randomness.

> **Spec-alignment note (read first).** The current `flappy-kiro` design and the `game-mechanics.md` steering define a **fixed** pipe scroll speed and a **constant** gap height. Two correctness properties enforce this:
> - **Property 8** — pipes scroll at the fixed speed `W / config.pipes.scrollSeconds`.
> - **Property 10** — generated gap height equals `config.pipes.gapHeightRatio * H`.
>
> The **Difficulty Progression** section below describes an *optional extension* that is **off by default**. With `DEFAULT_CONFIG`, all progression multipliers are identity, so the game behaves exactly as the current spec and Properties 8 and 10 continue to hold as written. **Turning progression on is a real scope change**: it requires updating `requirements.md`, `design.md` (config + derived constants), and **revising Properties 8 and 10** to be stated against the *effective* (progressed) speed and gap rather than the base config. Do not enable it in code without first updating the spec.

## Obstacle Generation Rules

Obstacles are `PipePair` entities `{ x, width, gapCenterY, gapHeight, scored }` following a **spawn → scroll → score → cull** lifecycle.

- **Single source of randomness.** `gapCenterY` (and any progression jitter) is drawn from the seedable `Rng` carried in `GameState`. Never `Math.random()`. Identical seeds must reproduce identical obstacle sequences.
- **Spawn cadence by spacing, not time.** `shouldSpawn` returns true exactly when the newest pipe has moved at least `effectiveSpawnGap` from the right edge (base: `config.pipes.spawnGapRatio * W`). Spacing-based spawning keeps obstacle density stable regardless of speed.
- **First obstacle** enters from the right edge (`x = W`) on the start flap.
- **One pair at a time is generated**, in order; consecutive pairs never overlap horizontally.
- **Cull aggressively.** Remove pipes whose right edge has crossed the left boundary (`x + width < 0`). Keep the active set bounded; recycle via an object pool if allocation shows up in the hot path.
- **Reachability guarantee.** Every generated gap must be clearable: gap height stays large enough and gap-center moves between consecutive pairs stay within what Ghosty's flap physics can traverse. When progression narrows gaps or speeds the field up, these limits must be respected (see clamps below).

## Gap Sizing Algorithm

For a spawned pair, given the current field `H` and the *effective* gap-height ratio:

```
gapHeight   = effectiveGapHeightRatio * H
centerMin   = config.pipes.marginRatio * H + gapHeight / 2
centerMax   = (1 - config.pipes.marginRatio) * H - gapHeight / 2
gapCenterY  = lerp(centerMin, centerMax, rng.nextFloat())   // uniform within margins
```

- **Base (default) behavior:** `effectiveGapHeightRatio = config.pipes.gapHeightRatio` (default `0.25`), so gap height is constant — matching Property 10.
- **Margins always honored:** the gap top edge stays ≥ `marginRatio * H` from the top and the bottom edge ≥ `marginRatio * H` from the bottom, for *any* effective gap height.
- **Validity invariant:** the config/effective values must satisfy `2 * marginRatio + effectiveGapHeightRatio <= 1` so a valid placement range exists (`centerMax >= centerMin`). Clamp the effective ratio to preserve this.
- **No correlation between pairs** beyond the spacing rule — each `gapCenterY` is an independent uniform draw, so the course does not become trivially predictable.

## Difficulty Progression (OPTIONAL EXTENSION — default-off)

> Not part of the current shipped spec. Implement only after updating requirements/design/properties. Designed to be **backward-compatible**: with progression disabled, every formula collapses to the fixed values above.

### Progression driver

Progression is a pure function of an objective run metric — **prefer score** (pipes passed) over wall-clock time, since score is deterministic and already in `GameState`:

```
level = floor(score / progression.stepEvery)        // 0 when disabled
t     = min(level, progression.maxLevels)            // clamp the ramp
```

### Effective speed (progressive speed increase)

```
speedMultiplier  = min(1 + progression.speedGainPerStep * t, progression.maxSpeedMultiplier)
effectivePipeSpeed = (W / config.pipes.scrollSeconds) * speedMultiplier
```

- The base `pipeSpeed` is unchanged; progression multiplies it. Cloud parallax speeds, which are expressed as a fraction of pipe speed, scale automatically — keep that relationship intact.
- **Cap the multiplier** at `progression.maxSpeedMultiplier` so the game stays clearable and the fixed-timestep accumulator never has to simulate absurd per-step displacement.
- Speed changes must be applied uniformly to all active pipes within a step; never have two pipes scrolling at different speeds in the same frame.

### Effective gap (progressive gap tightening)

```
effectiveGapHeightRatio = max(
  config.pipes.gapHeightRatio - progression.gapShrinkPerStep * t,
  progression.minGapHeightRatio
)
```

- Gaps may narrow as the run advances but never below `progression.minGapHeightRatio`, and always subject to the `2*marginRatio + ratio <= 1` validity clamp.
- Optionally widen spacing slightly as speed rises so reaction time stays fair; keep spacing spacing-based (a multiplier on `spawnGapRatio`), never time-based.

### Suggested config shape

```typescript
// Extension to GameConfig.pipes (or a new GameConfig.progression group)
progression: {
  enabled: boolean;            // default false -> all multipliers identity
  driver: "score" | "time";    // prefer "score" for determinism
  stepEvery: number;           // score units per difficulty level
  maxLevels: number;           // clamp the ramp
  speedGainPerStep: number;    // e.g. 0.05 (+5% per level); 0 when disabled
  maxSpeedMultiplier: number;  // hard cap, e.g. 1.75
  gapShrinkPerStep: number;    // ratio reduction per level; 0 when disabled
  minGapHeightRatio: number;   // floor, e.g. 0.18
}
```

**Default values must make progression a no-op:** `enabled: false`, `speedGainPerStep: 0`, `gapShrinkPerStep: 0`, `maxSpeedMultiplier: 1`. Under these defaults `speedMultiplier = 1` and `effectiveGapHeightRatio = gapHeightRatio`, so the simulation is byte-for-byte the current design.

## Determinism & Fairness Invariants

1. All obstacle randomness flows through the seedable `Rng`; identical seeds produce identical courses.
2. Every gap is placed within the boundary margins for any effective gap height (`2*marginRatio + effectiveGapHeightRatio <= 1` always enforced).
3. With default config, scroll speed and gap height are constant (Properties 8 and 10 hold as written).
4. With progression enabled, effective speed and gap are pure functions of the deterministic driver (`score`), so runs remain reproducible — but Properties 8 and 10 must be **restated against the effective values** before enabling.
5. Effective speed and gap are always clamped so the course stays clearable: speed ≤ `maxSpeedMultiplier × base`, gap ≥ `minGapHeightRatio × H`.

## If You Want Progression to Be Real

Treat it as a spec change, in order:
1. Add acceptance criteria to `requirements.md` describing the difficulty ramp and its caps.
2. Extend `GameConfig` and the derived-constants table in `design.md` with the `progression` group and defaults.
3. Revise **Property 8** (speed) and **Property 10** (gap) to be stated over the effective, progressed values, and add a property asserting the ramp is monotonic and clamped.
4. Add tasks for the progression helpers and their property tests.

Until those are done, keep `progression.enabled = false` and rely on the fixed-speed, fixed-gap behavior the current spec guarantees.
