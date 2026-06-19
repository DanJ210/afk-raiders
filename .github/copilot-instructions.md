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

### Secret Hidden Pocket
AFK Raiders includes a parody safe pocket named **Secret Hidden Pocket**:
- It is stored on `RaidState.hiddenPocket` and is **manual only** (never auto-assigned by engine logic).
- The player can set, change, or clear the pocket selection from current raid backpack items in `BackpackPanel.vue`.
- On failure outcomes that clear the backpack (notably DOWNED → HUB), exactly one unit of the selected pocket item is transferred to `homeStash` in `processTick` before raid reset bookkeeping finishes.
- On successful extraction, do not duplicate this item; normal backpack extraction already transfers all loot.

### Raid Pacing
Raid aggression is autonomous; there is no extraction preference slider. `runGreedCheck()` uses fixed seeded probabilities so the Raider generally spends more time raiding before choosing to extract. Low HP without any current-raid bandages increases extract probability so the raider tries to survive and cash out. If they do have bandages, this no-bandage extraction bonus is not applied. Scolding also reduces current greed before the next greed check, giving the Handler a direct way to cool risky behavior. Separately, the RAIDING phase has a hard timer cap; timing out in RAIDING transitions to DOWNED.

During RAIDING, only one Handler action can be pending at a time (`pendingCalm`, `pendingPressure`, or `forceExtract`). When any pending action is set, raid action buttons should remain disabled until the next simulation tick consumes the pending action and logs feedback.

`Signal` is capped at 5 and currently supports these action costs in `src/engine/signal.ts`: `READY_UP` = 2, `ENCOURAGE` = 1, `SCOLD` = 1, `CALL_EXTRACT` = 3.

### Raid Duration
Max raid time is 60 ticks = 30 minutes at the 30 s tick cadence. Phase durations are defined in `src/engine/raidStateMachine.ts` as `PHASE_DURATIONS`: HUB ≤ 10 min (20 ticks), DEPLOYING 2 min (4 ticks, one-person tunnel pods), RAIDING ≤ 30 min (60 ticks), EXTRACTING ~2 min (4 ticks), DOWNED 1 min (2 ticks). When the raid timer expires while still in RAIDING, the natural transition is DOWNED (zone nuke failure), not EXTRACTING. If HP reaches 0 in any non-HUB phase the raider goes DOWNED, loses the backpack, and respawns in the HUB. Each phase has its own events file in `src/content/` (hub_events, deployment_events, raiding_events, extraction_events, downed_events).

`Ready Up!` is a HUB-only Handler action that spends signal and forces an immediate transition to `DEPLOYING`.

### Lifetime Stats
`GameState.stats` stores lifetime metrics independent of the in-raid snapshot:
- Extracts and deaths (total + `byZone` + `byZoneAndDanger` where keys are `zone__dangerLevel`)
- Robot defeats by robot id
- Healing item usage (total + by item id)

On save migration for older profiles that predate `state.stats`, initialize missing lifetime totals from existing `raider.extractCount` and `raider.deathCount` so legacy player history stays consistent. Leave `byZone`/`byZoneAndDanger` maps empty during this backfill.

### Robot Encounters
Robot encounter events in `src/content/raiding_events.json` use `effects.robotEncounter` to reference a robot ID from `src/content/robots.json`. Robots have a `deadliness` label (`weak`, `moderate`, `dangerous`, `nasty`, `deadly`) that must match their menace, abundance, and encounter tuning. Valid deadliness tiers in ascending order:

| Tier | Label | Robots |
|------|-------|--------|
| 1 (weakest) | `weak` | Anxietick (menace 2), Overthinker Tick (menace 2) |
| 2 | `moderate` | Tattletale drone (menace 3), Passive-Aggressor Drone (menace 4), Seeker of Validation (menace 5), Harvester of Mild Annoyances (menace 4) |
| 3 | `dangerous` | Walker Texas Malfunction (menace 6), Enforcer of Minor Inconveniences (menace 6) |
| 4 | `nasty` | Bomber Who Misreads the Room (menace 7) |
| 5 (deadliest) | `deadly` | Roomba Prime (menace 8), Crusher of Dreams (menace 8), Sniper of Poor Decisions (menace 9), Tank of Overcompensation (menace 10) |

Only `nasty` and `deadly` robots can kill the raider (lethal encounters trigger only at ≤ 50% HP). `weak`, `moderate`, and `dangerous` robots are non-lethal: damage is capped so HP cannot drop to 0. High-tier robot encounter events (`nasty` and above) must include `"minGreed": 20` in their `requires` clause so they only appear after the raider has pushed deeper.

`resolveRobotEncounter()` rolls 1-10 with the seeded RNG; if the roll is greater than the robot's `menace`, the raider defeats it, emits a `successText` line, and wins an item from that robot's `lootTable`. On failure, the raider takes damage based on menace and runs away. Rare event variants can set `effects.robotDamageMultiplier` to make failed encounters more dangerous or lethal; this multiplier only applies on failure, never when the robot is defeated. Robot loot is also included in the regular loot resolver pool alongside `loot.json`.

### Healing Items
Bandages live in `src/content/healing_items.json` and are current-raid-only consumables, stored on `RaidState.healingItems`, not in the backpack or home stash. RAIDING events can use `effects.healingItem` to find one bandage. The engine automatically uses the smallest useful bandage when the raider is alive and HP is at or below 75%, capped at 50 HP per use: White +5, Green +10, Blue +25, Purple +50. Each bandage also has a `moodGain`, and higher-tier bandages grant more mood when consumed. The used bandage is removed from `RaidState.healingItems`. Healing items reset when the raid returns to HUB and are lost on death.

### Shields
Shields are implemented as a deterministic protection layer on `RaidState.shield`, not as bonus HP. All incoming engine damage that should respect shields must route through the shared helper in `src/engine/shields.ts`; do not subtract shielded HP ad hoc in unrelated files. Shield rechargers are backpack items found during RAIDING and are manual-use only from the current raid backpack. They restore shield charge, never durability, and if left unused they extract into the home stash like normal backpack loot.

## Future Development Notes
- Home stash will eventually persist to IndexedDB when transitioning from localStorage
- Consider adding sell/trade mechanics in the hub to let players convert stash items to currency
- Extraction preference could be expanded to affect other raider behaviors (hiding frequency, trading mood, etc.)
- Consider achievements/milestones for accumulated stash value

