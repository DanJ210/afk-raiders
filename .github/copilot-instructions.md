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

## Key Game Features

### Home Stash
Items successfully extracted are automatically transferred from the raider's backpack to a persistent `homeStash` array on the GameState. This survives raids, deaths, and sessions. When working with extraction logic or inventory systems, always ensure loot is transferred during the EXTRACTING → HUB phase transition (see `src/engine/tick.ts` for the implementation pattern). The stash holds at most 120 items (`HOME_STASH_ITEM_LIMIT` in `src/engine/homeStash.ts`; quantities count toward the cap). Overflow is never deleted: the lowest-value items are auto-sold and their value is credited to `GameState.coins` (the raider's coin stash), narrated by a `stash_overflow_sale` comms event. The Home Stash UI lists items highest-value first, and separates unsold `Stash Value` from sold `Coin Value`.

### Extraction Preference Slider
Players control raid aggression via a slider (0-100) stored in `settingsStore` as `extractionPreference`:
- **Safer (0):** Higher base extraction chance, greed grows faster
- **Hoarder (100):** Lower extraction chance, greed grows slower
- The slider affects `runGreedCheck()` in two ways:
  1. Extract probability modifier: ±30% variance based on slider value
  2. Greed accumulation rate: 0.5x to 1.5x multiplier
- Pass `extractionPreference` through `processTick()` and `catchUp()` functions
- Use `ExtractionPreference.vue` and `HomeStash.vue` components as reference for UI patterns

### Raid Duration
Max raid time is 120 ticks = 30 minutes at the 15 s tick cadence. Phase durations are defined in `src/engine/raidStateMachine.ts` as `PHASE_DURATIONS`: HUB ≤ 5 min (20 ticks), DEPLOYING 60 s (4 ticks, one-person tunnel pods), RAIDING ≤ 30 min (120 ticks), EXTRACTING ~60 s (4 ticks). When the raid timer expires the raider is forced into EXTRACTING. If HP reaches 0 in any phase the raider goes DOWNED, loses the backpack, and respawns in the HUB. Each phase has its own events file in `src/content/` (hub_events, deployment_events, raiding_events, extraction_events, downed_events).

## Future Development Notes
- Home stash will eventually persist to IndexedDB when transitioning from localStorage
- Consider adding sell/trade mechanics in the hub to let players convert stash items to currency
- Extraction preference could be expanded to affect other raider behaviors (hiding frequency, trading mood, etc.)
- Consider achievements/milestones for accumulated stash value
