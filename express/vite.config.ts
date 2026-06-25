/// <reference types="vitest/config" />
import { defineConfig } from "vite";

// Vite serves files in `public/` at the site root, so the game assets
// (ghosty.png, jump.wav, game_over.wav) copied there are reachable at
// `/ghosty.png`, `/jump.wav`, `/game_over.wav`.
export default defineConfig({
  // Relative base so the built app works when served from any sub-path.
  base: "./",
  test: {
    // jsdom gives the core/adapters access to a DOM/canvas-like environment
    // while keeping tests runnable in Node via Vitest.
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.ts"],
    // No core/adapter tests exist yet (added by later tasks); don't fail CI.
    passWithNoTests: true,
  },
});
