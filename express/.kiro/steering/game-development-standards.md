---
inclusion: always
---

# Game Development Coding Standards

These standards guide how game code is structured and reviewed in this workspace. They favor deterministic, testable simulation logic and predictable runtime performance. The guiding principle is a strict separation between **pure simulation** (deterministic, side-effect-free) and **impure adapters** (rendering, audio, input, storage, timing).

## Core Principles

1. **Separate simulation from presentation.** Game state and the rules that advance it must be pure and independent of how they are drawn, heard, or persisted. Rendering, audio, input, and storage live behind adapters.
2. **Determinism by default.** Given the same state, config, timestep, and input, advancing the simulation must always produce the same result. Randomness flows through an explicit, seedable PRNG carried in state — never `Math.random()` inside simulation code.
3. **Data flows one direction per frame.** Input is gathered, the simulation advances, effects are dispatched, then the frame is rendered. Avoid mutating game state during rendering.
4. **Configuration over magic numbers.** Tunable values (gravity, speeds, spawn rates, sizes) live in a typed config object, not scattered as literals through the code.

## Entity / Component Patterns

Prefer composition over inheritance. Model entities as plain data and behavior as functions over that data.

- **Entities are data, not classes with logic.** Represent an entity as a plain object (or struct-of-fields) describing its state. Keep methods off the entity; advance entities with pure functions instead.

  ```ts
  // Good: data-only entity
  interface Ghost {
    x: number;
    y: number;
    vy: number;
    width: number;
    height: number;
  }

  // Behavior is a pure function over the entity
  function applyGravity(g: Ghost, dt: number, cfg: PhysicsConfig): Ghost {
    const vy = Math.min(g.vy + cfg.gravity * dt, cfg.terminalVelocity);
    return { ...g, vy };
  }
  ```

- **Components describe a single concern.** When an entity needs multiple aspects (position, velocity, collider, sprite), model each as a small, named component rather than one large flat object. Systems operate on the components they need.
- **Systems are pure transforms.** A system takes the relevant slice of state plus config/dt/input and returns the next slice. Systems do not perform I/O; they return descriptions of side effects (see Effects) for adapters to execute.
- **Avoid deep inheritance hierarchies.** No `Enemy extends Character extends GameObject`. If shared behavior is needed, extract a free function and call it from each system.
- **Keep collections homogeneous and flat.** Store entities in plain arrays/maps keyed by id. Avoid nested object graphs that are hard to copy and reason about.

## Game Loop Structure

Use a **fixed-timestep** loop with an accumulator so that simulation behavior is independent of frame rate and rendering rate.

- **Fixed timestep for simulation.** Advance the simulation in fixed increments (e.g. `1/60` s). Accumulate real elapsed wall-clock time and consume it one fixed step at a time.
- **Variable timestep only for rendering.** Render once per animation frame using the latest simulated state. Interpolate between states for smoothness only if needed; never let render cadence change simulation results.
- **Clamp the accumulator.** Cap the maximum simulated time per frame (the "spiral of death" guard) so a long pause (tab backgrounded, breakpoint) does not trigger a flood of catch-up steps.
- **Drain input per step.** Pull queued input events as the loop advances each fixed step, so no input is dropped or double-counted.
- **Dispatch effects after stepping.** The `step` function returns effects (play sound, persist score, etc.); the loop dispatches them to adapters. Adapters never call back into the simulation.

```ts
function frame(now: number) {
  accumulator += Math.min(now - last, MAX_FRAME_TIME);
  last = now;

  while (accumulator >= cfg.fixedTimestep) {
    const input = inputQueue.drain();
    const { state: next, effects } = step(state, cfg, cfg.fixedTimestep, input);
    state = next;
    dispatchEffects(effects); // audio, storage — impure
    accumulator -= cfg.fixedTimestep;
  }

  renderer.draw(state); // read-only view of state
  requestAnimationFrame(frame);
}
```

## Memory Management

Garbage-collection pauses cause frame hitches. Minimize per-frame allocation in hot paths.

- **Avoid allocation in the hot loop.** Don't create new arrays, closures, or objects every frame in `step`/render where it can be avoided. Reuse buffers and scratch objects where it does not compromise determinism.
- **Pool reusable entities.** For frequently spawned/destroyed objects (pipes, particles, projectiles), use an object pool: deactivate and recycle instead of allocating and discarding. Reset all fields on reuse so no stale state leaks.
- **Prefer culling over unbounded growth.** Remove off-screen/expired entities promptly so collections stay small and bounded.
- **Be intentional about immutability.** Pure systems that return new state are correct and testable; for large collections, mutate a pooled/owned copy rather than spreading huge arrays every frame. Document where in-place mutation is used and why.
- **Load assets once.** Images, audio buffers, and fonts are loaded at startup (or lazily once) and cached — never reloaded per frame. Guard against load failures with placeholders/fallbacks.
- **Release listeners and timers.** Adapters that register event listeners or `requestAnimationFrame`/timers must expose teardown that removes them, to avoid leaks when the game is destroyed or restarted.

## Testing

- **Property-based tests for the simulation core.** Pure systems are tested against invariants (determinism, conservation, bounds) over generated inputs and arbitrary valid configs — not only default values.
- **Adapters are tested behind mocks/stubs.** Renderer, audio, input, and storage are tested with mock contexts; failures in adapters (e.g. storage quota, audio autoplay block) must never break gameplay.
- **Run tests in single-shot mode** (e.g. `--run`) in CI rather than watch mode.

## Anti-Patterns to Avoid

- Calling `Math.random()`, `Date.now()`, or reading the DOM/`localStorage` inside simulation code.
- Mutating game state inside the renderer.
- Frame-rate-dependent physics (multiplying by a raw, unclamped delta with no fixed step).
- Per-frame allocation of arrays/objects/closures in hot paths.
- Deep class inheritance for entities.
- Magic numbers embedded in logic instead of a typed config.
