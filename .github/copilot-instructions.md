# AFK Raiders — Copilot Instructions

## What this project is
AFK Raiders is a "zero-player" idle comedy game (inspired by Godville) that parodies extraction-shooter tropes. The player is a **Handler** who watches an autonomous **Raider** deploy, loot, panic, and die via a text comms feed. The player's only input is a small regenerating resource called **Signal**.

Key docs — read these before making changes:
- `docs/GAME_DESIGN.md` — game concept, mechanics, comedy content, roadmap
- `docs/ARCHITECTURE.md` — folder structure, engine design, persistence, testing

## Tech stack
- Vue 3 + TypeScript + Vite, Composition API with `<script setup>`
- Pinia for state management, VueUse for utilities
- vite-plugin-pwa — offline-first PWA targeting web, iOS, and Android
- localStorage persistence for MVP (IndexedDB via localForage later)
- Vitest for testing
- MVP is **fully client-side**: no backend, no network calls, no accounts

## Hard architectural rules
1. **Engine purity:** Everything in `src/engine/` is pure TypeScript. No Vue, Pinia, DOM, or browser API imports. The engine must run in Node (for tests) and the browser identically.
2. **Determinism:** All randomness flows through the seeded RNG in `src/engine/rng.ts`. Never use `Math.random()` inside the engine. Same seed + same state must always produce the same story.
3. **Content as data:** All game text — events, loot, robots, zones, flavor lines — lives in `src/content/*.json` as weighted template tables with `{slot}` placeholders. Never hardcode joke text or event content in TypeScript.
4. **Tick-based simulation:** Game time advances in discrete ticks via `processTick(state, rng)`. Offline catch-up replays elapsed ticks (capped at ~8 hours) on app load.
5. **Tests required for engine changes:** Engine PRs must include Vitest unit tests. Prefer deterministic snapshot tests: fixed seed → expected event sequence.
6. **UI renders state; it never simulates.** Vue components read Pinia stores and dispatch Handler actions. Game logic never lives in components.

## Content & tone guidelines
- Comedy tone: deadpan, absurd, affectionate parody of extraction-shooter player behavior (loot greed, hoarding, hiding in lockers, "one more crate" syndrome).
- The comms log IS the product. When in doubt, make the log entry funnier.
- **Legally distinct parody:** never use the "ARC Raiders" trademark, character names, lore text, or assets. Use this project's parody equivalents (see the parody table in `docs/GAME_DESIGN.md`). In our lore, A.R.C. = "Aggressively Roaming Chassis."

## Conventions
- TypeScript strict mode; no `any` unless unavoidable and commented.
- Engine state is immutable-style: `processTick` returns new state + emitted events; it does not mutate input.
- Event/loot/zone IDs are `snake_case` strings, stable once shipped (saves reference them).
