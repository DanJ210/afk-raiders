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

### Raid Pacing
Raid aggression is autonomous; there is no extraction preference slider. `runGreedCheck()` uses fixed seeded probabilities so the Raider generally spends more time raiding before choosing to extract, while the 30-minute RAIDING phase timer still forces EXTRACTING when it expires. Low HP without any current-raid bandages increases extract probability so the raider tries to survive and cash out. If they do have bandages, this no-bandage extraction bonus is not applied.

### Raid Duration
Max raid time is 120 ticks = 30 minutes at the 15 s tick cadence. Phase durations are defined in `src/engine/raidStateMachine.ts` as `PHASE_DURATIONS`: HUB ≤ 5 min (20 ticks), DEPLOYING 60 s (4 ticks, one-person tunnel pods), RAIDING ≤ 30 min (120 ticks), EXTRACTING ~60 s (4 ticks). When the raid timer expires the raider is forced into EXTRACTING. If HP reaches 0 in any phase the raider goes DOWNED, loses the backpack, and respawns in the HUB. Each phase has its own events file in `src/content/` (hub_events, deployment_events, raiding_events, extraction_events, downed_events).

### Robot Encounters
Robot encounter events in `src/content/raiding_events.json` use `effects.robotEncounter` to reference a robot ID from `src/content/robots.json`. Robots have a `deadliness` label (`weak`, `moderate`, `nasty`, `deadly`) that must match their menace, abundance, and encounter tuning: Anxietick < Tattletale < Shredder Dedder < Roomba Prime. `resolveRobotEncounter()` rolls 1-10 with the seeded RNG; if the roll is greater than the robot's `menace`, the raider defeats it, emits a `successText` line, and wins an item from that robot's `lootTable`. On failure, the raider takes damage based on menace and runs away. Rare event variants can set `effects.robotDamageMultiplier` to make failed encounters more dangerous or lethal; this multiplier only applies on failure, never when the robot is defeated. Robot loot is also included in the regular loot resolver pool alongside `loot.json`.

### Healing Items
Bandages live in `src/content/healing_items.json` and are current-raid-only consumables, stored on `RaidState.healingItems`, not in the backpack or home stash. RAIDING events can use `effects.healingItem` to find one bandage. The engine automatically uses the smallest useful bandage when the raider is alive and HP is at or below 75%, capped at 50 HP per use: White +5, Green +10, Blue +25, Purple +50. Each bandage also has a `moodGain`, and higher-tier bandages grant more mood when consumed. The used bandage is removed from `RaidState.healingItems`. Healing items reset when the raid returns to HUB and are lost on death.

## Future Development Notes
- Home stash will eventually persist to IndexedDB when transitioning from localStorage
- Consider adding sell/trade mechanics in the hub to let players convert stash items to currency
- Extraction preference could be expanded to affect other raider behaviors (hiding frequency, trading mood, etc.)
- Consider achievements/milestones for accumulated stash value
