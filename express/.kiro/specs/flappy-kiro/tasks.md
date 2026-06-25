# Implementation Plan: Flappy Kiro

## Overview

This plan implements Flappy Kiro as a TypeScript browser game built with Vite, with Vitest + fast-check for testing. The work follows the design's strict separation between a pure simulation core (`step`, physics, pipes, scoring, collision, clouds, high-score parsing) and impure adapters (renderer, audio, input, storage), wired together by a fixed-timestep `GameLoop` shell.

Tasks build incrementally: tooling and types first, then each pure core module with its property tests, then the unifying `step` function, then the adapters, and finally the shell that wires everything into a running game. Every tunable value flows through `GameConfig`, and all property tests are written against an arbitrary valid config (not only `DEFAULT_CONFIG`).

## Tasks

- [ ] 1. Set up project structure and tooling
  - Initialize a Vite + TypeScript project (`package.json`, `tsconfig.json`, `vite.config.ts`)
  - Add and configure Vitest and fast-check as dev dependencies; add `test` (with `--run`) and `build` scripts
  - Create the source layout: `src/core/`, `src/adapters/`, `src/shell/`, and `src/core/__tests__/`
  - Copy/reference the `assets/` (`ghosty.png`, `jump.wav`, `game_over.wav`) so they are reachable from the app
  - _Requirements: 8.8_

- [ ] 2. Define core data models and configuration
  - [ ] 2.1 Define core types and interfaces
    - Add `src/core/types.ts` with `GamePhase`, `Field`, `Ghost`, `PipePair`, `Cloud`, `GameState`, `InputEvent`, `Effect`, and `StepResult`
    - Add the `GameConfig` interface (physics, ghost, pipes, clouds groups) and the `Rng` type
    - _Requirements: 3.1, 3.2, 3.5, 4.1, 4.4, 4.5_

  - [ ] 2.2 Define DEFAULT_CONFIG
    - Add `src/core/config.ts` exporting `DEFAULT_CONFIG` with the exact values from the Derived constants table (gravity 1800, flapVelocity -500, terminalVelocity 900, fixedTimestep 1/60, ratios, cloud ranges)
    - _Requirements: 1.2, 3.1, 3.2, 3.5, 4.1, 4.2, 4.4, 4.5, 8.3, 8.4, 8.5_

  - [ ] 2.3 Implement a seedable PRNG
    - Add `src/core/rng.ts` with a deterministic, seedable `Rng` (next-float and advance helpers) carried in `GameState` for reproducible spawning
    - _Requirements: 4.4_

- [ ] 3. Implement high score parsing
  - [ ] 3.1 Implement parseHighScore
    - Add `src/core/highScore.ts` with `parseHighScore(raw: string | null): number` returning a valid non-negative integer or `0` for null/empty/whitespace/non-numeric/negative/float/out-of-range input
    - _Requirements: 1.6, 1.7, 1.8_

  - [ ]* 3.2 Write property test for high score parsing
    - **Property 1: High score parsing yields a valid non-negative integer or zero**
    - **Validates: Requirements 1.6, 1.7, 1.8**

- [ ] 4. Implement physics helpers
  - [ ] 4.1 Implement gravity, flap, and position integration
    - Add `src/core/physics.ts` with `applyGravity` (clamps to `config.physics.terminalVelocity`), `applyFlap` (returns `config.physics.flapVelocity`), and `integratePosition`
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

  - [ ]* 4.2 Write property test for gravity and terminal velocity
    - **Property 6: Gravity integrates velocity and respects terminal velocity**
    - **Validates: Requirements 3.1, 3.5**

  - [ ]* 4.3 Write property test for position integration
    - **Property 7: Position integrates from velocity**
    - **Validates: Requirements 3.4**

- [ ] 5. Implement pipe generation and scrolling
  - [ ] 5.1 Implement pipe lifecycle helpers
    - Add `src/core/pipes.ts` with `scrollPipes` (speed `W / config.pipes.scrollSeconds`), `shouldSpawn` (newest pipe moved `config.pipes.spawnGapRatio * W`), `spawnPipe` (gap height `config.pipes.gapHeightRatio * H`, gap center within margins, consumes `Rng`), and `cullPipes` (removes pipes with `x + width < 0`)
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 4.6_

  - [ ]* 5.2 Write property test for pipe scrolling
    - **Property 8: Pipes scroll left at the fixed traversal speed**
    - **Validates: Requirements 4.1**

  - [ ]* 5.3 Write property test for spawn spacing
    - **Property 9: New pipes spawn at the correct horizontal spacing**
    - **Validates: Requirements 4.2**

  - [ ]* 5.4 Write property test for generated gap validity
    - **Property 10: Generated pipe gaps are valid in size and placement**
    - **Validates: Requirements 4.4, 4.5**

  - [ ]* 5.5 Write property test for culling
    - **Property 11: Off-screen pipes are culled and on-screen pipes are retained**
    - **Validates: Requirements 4.6**

- [ ] 6. Implement scoring and collision
  - [ ] 6.1 Implement scoring
    - Add `src/core/scoring.ts` with `applyScoring` that increments the score by 1 when the ghost passes a pipe's trailing edge and marks that pipe `scored` so it never re-counts
    - _Requirements: 5.1, 5.2_

  - [ ]* 6.2 Write property test for scoring
    - **Property 12: Each passed pipe increments the score exactly once**
    - **Validates: Requirements 5.1, 5.2**

  - [ ] 6.3 Implement collision and boundary checks
    - Add `src/core/collision.ts` with `ghostCollides` (AABB intersection of ghost bounds against upper/lower segments) and `ghostOutOfBounds` (top/bottom boundary breach)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 7. Implement clouds
  - [ ] 7.1 Implement cloud generation and drift
    - Add `src/core/clouds.ts` with `makeClouds` (count in `[minCount, maxCount]`, opacity in `config.clouds.opacityRange`, speed in `config.clouds.speedRange * pipeSpeed`, at least two distinct parallax speeds where slower ≤ 0.60 × faster) and `scrollClouds` (drifts every cloud toward the left edge)
    - _Requirements: 1.4, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 7.2 Write property test for cloud generation and parallax
    - **Property 17: Cloud generation is bounded and uses parallax speeds**
    - **Validates: Requirements 1.4, 8.3, 8.4, 8.5, 8.6**

- [ ] 8. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement state reset and the simulation step
  - [ ] 9.1 Implement toReady reset
    - Add `src/core/state.ts` with `toReady(state, config, field)` setting phase `Ready`, score `0`, empty pipes, ghost at `(config.ghost.startXRatio * W, config.ghost.startYRatio * H)`
    - _Requirements: 1.2, 1.5, 7.8, 7.9, 7.10_

  - [ ]* 9.2 Write property test for the Ready reset
    - **Property 2: Entering the Ready state resets the game to a canonical start**
    - **Validates: Requirements 1.2, 1.5, 7.8, 7.9, 7.10**

  - [ ] 9.3 Implement step for the Ready phase
    - Add `src/core/step.ts` with `step(state, config, dt, input)`; in `Ready`, a flap sets vy to `config.physics.flapVelocity`, transitions to `Playing`, generates the first pipe from the right edge, and emits `playFlapSound`; non-flap input keeps phase `Ready`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.3_

  - [ ] 9.4 Implement step for the Playing phase
    - Extend `step` so the `Playing` branch applies gravity, integrates position, handles flap (set vy + emit `playFlapSound`), scrolls/spawns/culls pipes, applies scoring, and on collision or boundary breach transitions to `GameOver` (emit one `playGameOverSound`, set `highScore = max(highScore, score)`, emit `persistHighScore` when it increases)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.6, 5.1, 5.2, 6.1, 6.2, 6.3, 6.4, 7.1, 7.4, 7.5_

  - [ ] 9.5 Implement step for the Game_Over phase
    - Extend `step` so the `GameOver` branch freezes ghost position/velocity and pipe positions, and on a restart input resets via `toReady` (score 0, pipes cleared, ghost repositioned, phase `Ready`)
    - _Requirements: 7.2, 7.3, 7.8, 7.9, 7.10_

  - [ ]* 9.6 Write property test for flap velocity
    - **Property 3: A flap sets the ghost's vertical velocity to the fixed upward value**
    - **Validates: Requirements 2.2, 3.2**

  - [ ]* 9.7 Write property test for Ready-to-Playing transition
    - **Property 4: Flap in the Ready state transitions to Playing**
    - **Validates: Requirements 2.1**

  - [ ]* 9.8 Write property test for flap sound while playing
    - **Property 5: A flap emits the flap sound while playing**
    - **Validates: Requirements 3.3**

  - [ ]* 9.9 Write property test for collision and boundary game-over
    - **Property 13: Collision or boundary breach ends the game**
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 9.10 Write property test for clear gap passage
    - **Property 14: Clear passage through a gap keeps the game playing**
    - **Validates: Requirements 6.4**

  - [ ]* 9.11 Write property test for the frozen Game_Over state
    - **Property 15: The Game_Over state is frozen**
    - **Validates: Requirements 7.2, 7.3**

  - [ ]* 9.12 Write property test for high score update and persistence
    - **Property 16: High score updates to the maximum and is persisted**
    - **Validates: Requirements 7.4, 7.5**

  - [ ]* 9.13 Write unit tests for step side-effects
    - Start flap emits one `playFlapSound` and first pipe enters from the right edge (Req 2.3, 4.3); non-flap input in Ready keeps phase Ready (Req 2.4); transition to GameOver emits exactly one `playGameOverSound` and subsequent GameOver steps emit none (Req 7.1)
    - _Requirements: 2.3, 2.4, 4.3, 7.1_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement adapters
  - [ ] 11.1 Implement HighScoreStore
    - Add `src/adapters/highScoreStore.ts` with `load()` (delegates to `parseHighScore` over `localStorage`) and `save(value)` returning `false` on failure (quota/denied/unavailable), keeping the in-memory high score intact
    - _Requirements: 1.6, 1.7, 1.8, 7.5, 7.6_

  - [ ]* 11.2 Write edge-case tests for HighScoreStore
    - Stub the store to throw/return false; assert the in-memory high score is retained and the game still reaches GameOver with working display/input
    - _Requirements: 7.6_

  - [ ] 11.3 Implement AudioAdapter
    - Add `src/adapters/audioAdapter.ts` with `play("flap" | "gameOver")` loading `jump.wav`/`game_over.wav`, wrapping playback in try/catch so load/autoplay failures are ignored without affecting gameplay
    - _Requirements: 2.3, 3.3, 7.1_

  - [ ] 11.4 Implement InputAdapter
    - Add `src/adapters/inputAdapter.ts` translating keydown and pointerdown within the Play_Field into normalized `InputEvent`s, queued for the loop to drain
    - _Requirements: 2.1, 3.2, 7.8_

  - [ ] 11.5 Implement Renderer
    - Add `src/adapters/renderer.ts` drawing sky-blue background, clouds (with opacity), full-width green upper/lower pipe segments, the ghost sprite, and current/high/final score text per phase; draws a solid placeholder rectangle when `spriteLoaded` is false
    - _Requirements: 1.3, 5.3, 5.4, 5.5, 7.7, 8.1, 8.2, 8.7, 8.9_

  - [ ]* 11.6 Write unit tests for the Renderer
    - Assert (via a mock canvas context) the background, ghost sprite, full-width green segments, placeholder shape, and score/high-score/final-score text are drawn in the appropriate phases
    - _Requirements: 1.3, 5.3, 5.4, 5.5, 7.7, 8.1, 8.2, 8.7, 8.9_

- [ ] 12. Implement shell and wire the game together
  - [ ] 12.1 Implement GameLoop with fixed-timestep accumulator
    - Add `src/shell/gameLoop.ts` driving `requestAnimationFrame`, accumulating wall-clock time, clamping max simulated time per frame, calling `step` once per `config.physics.fixedTimestep` while draining input, dispatching returned effects to AudioAdapter/HighScoreStore, and invoking the Renderer
    - _Requirements: 3.4, 7.1, 7.5, 8.8_

  - [ ] 12.2 Implement sprite loading
    - Add a sprite loader that loads `ghosty.png` and sets `state.spriteLoaded` (false on failure) so the renderer can fall back to the placeholder
    - _Requirements: 8.1, 8.9_

  - [ ] 12.3 Wire the entry point and initialize to Ready
    - Add `index.html` and `src/main.ts` that construct the canvas, build the initial `GameState` (load high score, generate clouds), enter the `Ready` state, and start the `GameLoop` with `DEFAULT_CONFIG`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 12.4 Write smoke tests
    - Assert the game initializes into the `Ready` phase promptly after construction (Req 1.1) and a fixed-timestep determinism check confirms identical simulation results independent of the real frame interval (Req 8.8)
    - _Requirements: 1.1, 8.8_

- [ ] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP; core implementation tasks are never optional.
- Each task references specific requirements for traceability, and every property test task references a numbered property from the design.
- All 17 correctness properties are each implemented by a single property-based test using fast-check, run with at least 100 generated cases and composed with an arbitrary valid `GameConfig`.
- Checkpoints ensure incremental validation; run `npm run test` (with `--run`) and `npm run build` at each checkpoint.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["3.1", "4.1", "5.1", "6.1", "6.3", "7.1", "9.1", "11.1", "11.3", "11.4", "11.5"] },
    { "id": 4, "tasks": ["3.2", "4.2", "4.3", "5.2", "5.3", "5.4", "5.5", "6.2", "7.2", "9.2", "9.3", "11.2", "11.6"] },
    { "id": 5, "tasks": ["9.4"] },
    { "id": 6, "tasks": ["9.5"] },
    { "id": 7, "tasks": ["9.6", "9.7", "9.8", "9.9", "9.10", "9.11", "9.12", "9.13", "12.1", "12.2"] },
    { "id": 8, "tasks": ["12.3"] },
    { "id": 9, "tasks": ["12.4"] }
  ]
}
```
