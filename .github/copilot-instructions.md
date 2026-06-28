# AFK Raiders — Copilot Instructions

## What this project is
AFK Raiders is a "zero-player" idle comedy game (inspired by Godville) that parodies extraction-shooter tropes. The player is a **Handler** who watches an autonomous **Raider** deploy, loot, panic, and die via a text comms feed. The player's only input is a small regenerating resource called **Signal**.

Key docs — read these before making changes:
- `docs/GAME_DESIGN.md` — game concept, mechanics, comedy content, roadmap
- `docs/ARCHITECTURE.md` — folder structure, engine design, persistence, testing
- `docs/lore/README.md` — versioned parody lore wiki and source-to-AFK workflow
- `docs/lore/content-guidelines/LEGAL_GUARDRAILS.md` — rules for legally distinct content
- `docs/CI_CD_AZURE.md` — CI/PR validation and Azure Static Web Apps deployment flow
- `docs/SERVER_STORAGE_AND_ACCOUNTS.md` — planned account-backed save sync architecture and backend boundaries

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
3. **Content as data:** All game text — events, phase-transition comms, loot, robots, zones, flavor lines — lives in `src/content/*.json`. Event files use weighted template tables with `{slot}` placeholders. Never hardcode joke text or event content in TypeScript.
4. **Tick-based simulation:** Game time advances in discrete ticks via `processTick(state, rng)`. Offline catch-up replays elapsed ticks (capped at ~8 hours) on app load.
5. **Tests required for engine changes:** Engine PRs must include Vitest unit tests. Prefer deterministic snapshot tests: fixed seed → expected event sequence.
6. **UI renders state; it never simulates.** Vue components read Pinia stores and dispatch Handler actions. Game logic never lives in components.
7. **Route gameplay damage through the shield helper:** Damage that should respect shield mitigation must go through `src/engine/shields.ts`, not ad hoc HP subtraction.

## Content & tone guidelines
- Comedy tone: deadpan, absurd, affectionate parody of extraction-shooter player behavior (loot greed, hoarding, hiding in lockers, "one more crate" syndrome).
- The comms log IS the product. When in doubt, make the log entry funnier.
- **Legally distinct parody:** never use the "ARC Raiders" trademark, character names, lore text, or assets. Use this project's parody equivalents (see the parody table in `docs/GAME_DESIGN.md`). In our lore, A.R.C. = "Aggressively Roaming Chassis."
- For source-lore intake, do not commit copied wiki prose or exact source names. Add AFK-original equivalents to `docs/lore/` first, then convert approved concepts into `src/content/*.json`.

## Conventions
- TypeScript strict mode; no `any` unless unavoidable and commented.
- Engine state is immutable-style: `processTick` returns new state + emitted events; it does not mutate input.
- Event/loot/zone IDs are `snake_case` strings, stable once shipped (saves reference them).
- Tailwind v4 custom sizing, spacing, text, and duration utilities must be backed by explicit tokens in `src/style.css` (`@theme inline`). Prefer standard Tailwind utilities when they match; otherwise add a semantic token instead of relying on ambiguous numeric utilities.

## Key Game Features

### Danger Level & Zone Conditions
- Each deployment picks both a zone and a seeded zone condition from `src/content/zones/zone_conditions.json`. Conditions are split into minor and major pools; carried-over greed nudges the seeded pool roll toward major conditions before weighted condition selection.
- Zone conditions set `RaidState.dangerLevel` (`Low` / `Medium` / `High`).
- Danger-level profiles in `src/engine/dangerLevelProfiles.ts` tune reward/risk globally:
	- Loot value and rarity bias
	- Small ambient RAIDING downed pressure
	- Robot encounter pressure
	- Extraction risk/safety weighting
- Event templates can gate by `requires.dangerLevel`.

### Loot Tables and Mood Bias
- Loot is sourced from `src/content/loot-tables/*.json` plus robot loot tables.
- Mood provides a mild rarity bias (positive mood slightly favors higher rarity, negative mood slightly favors lower rarity).
- Greed provides a second mild rarity bias toward higher-rarity loot. Keep this weaker than danger-level profile effects.
- Greed also mildly increases risky/robot event weights. Keep this weaker than danger-level profile effects.
- Keep mood effects subtle; danger-level profiles are the primary risk/reward lever.
- Event-driven mood changes are appended to the comms event text as the actual signed post-clamp delta (for example `Mood +2.` or `Mood -1.`).

### Home Stash
Items successfully extracted are automatically transferred from the raider's backpack to a persistent `homeStash` array on the GameState. This survives raids, failed recoveries, and sessions. When working with extraction logic or inventory systems, always ensure loot is transferred during successful extraction (`RAIDING -> HUB` caused by the EXTRACTING condition completing or succeeding). The stash holds at most 120 items (`HOME_STASH_ITEM_LIMIT` in `src/engine/homeStash.ts`; quantities count toward the cap). Overflow is never deleted: the lowest-value items are auto-sold and their value is credited to `GameState.coins` (the raider's coin stash), narrated by a `stash_overflow_sale` comms event. The Home Stash UI lists items highest-value first, and separates unsold `Stash Value` from sold `Coin Value`.

### Secret Hidden Pocket
AFK Raiders includes a parody safe pocket named **Secret Hidden Pocket**:
- It is stored on `RaidState.hiddenPocket` and is **manual only** (never auto-assigned by engine logic).
- The player can set, change, or clear the pocket selection from current raid backpack items in `BackpackPanel.vue`.
- On failure outcomes that clear the backpack (notably `KNOCKED_OUT -> HUB`), exactly one unit of the selected pocket item is transferred to `homeStash` in `processTick` before raid reset bookkeeping finishes.
- On successful extraction, do not duplicate this item; normal backpack extraction already transfers all loot.

### Raid Pacing
Raid aggression is autonomous; there is no extraction preference slider. `runGreedCheck()` uses fixed seeded probabilities so the Raider generally spends more time raiding before choosing to extract. Natural extraction is disabled until the configured minimum active RAIDING ticks have elapsed (`DEFAULT_MIN_NATURAL_EXTRACTION_RAIDING_TICKS`, currently 30 ticks / 15 minutes); `CALL_EXTRACT` bypasses this guard and starts the EXTRACTING condition. Greed no longer directly lowers extraction chance; it represents loot appetite, rarity bias, risky-event pressure, event gates, and decayed major-condition momentum for the next deployment after successful returns. KNOCKED_OUT recovery outcomes reset greed to 0. Greed rises by a small fixed amount when `runGreedCheck()` returns `PUSH_DEEPER`; content events and Handler actions can further adjust it. Low HP without any current-raid bandages increases extraction-start probability after the natural-extraction guard so the raider tries to survive and cash out, but that no-bandage extraction bonus is dampened by danger level so Medium/High conditions still punish unattended raids. If they do have bandages, this no-bandage extraction bonus is not applied. Calm reduces current greed and Pressure raises current greed before the next greed check. Separately, the RAIDING phase has a hard timer cap; timing out in RAIDING starts or resolves the DOWNED/KNOCKED_OUT loss path unless extraction completes first.

Event-driven greed changes are appended to the comms event text as the actual signed post-clamp delta (for example `Greed +5.` or `Greed -3.`). If an effect is fully swallowed by the 0–100 clamp, do not add a noise line.

During active RAIDING, only one Handler action can be pending at a time (`pendingCalm`, `pendingPressure`, or `forceExtract`). When any pending action is set, raid action buttons should remain disabled until the next simulation tick consumes the pending action and logs feedback. While `RaidState.downed` is active, normal raid actions should be disabled; `REVIVE` is the downed-only exception.

`Signal` is capped at 5 and currently supports these action costs in `src/engine/signal.ts`: `READY_UP` = 2, `CALM` = 1, `PRESSURE` = 1, `CALL_EXTRACT` = 3, `REVIVE` = 5.

### RAIDING Conditions: DOWNED and EXTRACTING
`RAIDING` is the field phase. `DOWNED` and `EXTRACTING` are timed conditions layered on `RaidState`, not phases:
- `RaidState.extracting` is the only successful raid exit path. When its timer completes or an extraction-condition event succeeds, transition `RAIDING -> HUB`, transfer backpack loot, count extraction, and clear raid conditions.
- `RaidState.downed` means the Raider is incapacitated inside RAIDING. Normal raiding/extraction events and normal Handler actions stop unless an event explicitly requires `downed: true`.
- If DOWNED and EXTRACTING overlap, both timers continue. If extraction completes before or on the same tick as the DOWNED timer expires, extraction wins and the raid succeeds. If the DOWNED timer expires first, transition `RAIDING -> KNOCKED_OUT`.
- `KNOCKED_OUT` is the short recovery/reset phase after failed revival or raid-timeout loss. `KNOCKED_OUT -> HUB` performs failed-raid bookkeeping: backpack loss, hidden pocket save, HP restore, death/failure stats, recovery XP, condition clearing, and raid reset.
- The first implementation targets DOWNED = 2 ticks, EXTRACTING = 4 ticks, KNOCKED_OUT = 2 ticks, and revive restoring 25 HP while preserving shield state exactly as-is. Keep KNOCKED_OUT duration behind a helper so skills can improve it later.

### Extraction Event Outcomes
- `src/content/extraction_events.json` describes EXTRACTING-condition comms/outcomes and should be gated by `requires.phase: "RAIDING"` plus `requires.extracting: true` once extraction is represented as a condition.
- Avoid using `effects.forcePhase` for condition-only outcomes. Use condition effects/events for extraction failure, extraction success, and downed-at-LZ outcomes; reserve phase transitions for lifecycle moves (`RAIDING -> HUB`, `RAIDING -> KNOCKED_OUT`, `KNOCKED_OUT -> HUB`).
- Failed extraction clears `RaidState.extracting` and continues the original RAIDING timer instead of refreshing it. If no raid time remains, the DOWNED/KNOCKED_OUT loss path should win unless extraction completed first.

### Raid Duration
Max raid time is 60 ticks = 30 minutes at the 30 s tick cadence. Lifecycle phase durations are defined in `src/engine/raidStateMachine.ts` as `PHASE_DURATIONS`: HUB ≤ 10 min (20 ticks), DEPLOYING 2 min (4 ticks, one-person tunnel pods), RAIDING ≤ 30 min (60 ticks), KNOCKED_OUT 1 min (2 ticks). EXTRACTING and DOWNED have their own condition timers on `RaidState` while phase remains RAIDING. When the raid timer expires while still in RAIDING, the loss path starts or resolves through DOWNED/KNOCKED_OUT; successful return requires the EXTRACTING condition to complete first. If HP reaches 0 during RAIDING, start `RaidState.downed` rather than immediately resetting the raid. Each lifecycle phase has content in `src/content/` (hub_events, deployment_events, raiding_events, knocked_out_events), while extraction/downed condition comms are content-gated by `requires.extracting` and/or `requires.downed`. Phase-transition comms text lives in `src/content/phase_transitions.json`.

`Ready Up!` is a HUB-only Handler action that spends signal and forces an immediate transition to `DEPLOYING`.

### Lifetime Stats
`GameState.stats` stores lifetime metrics independent of the in-raid snapshot:
- Extracts and deaths (total + `byZone` + `byZoneAndDanger` where keys are `zone__dangerLevel`)
- Robot defeats by robot id
- Healing item usage (total + by item id)

On save migration for older profiles that predate `state.stats`, initialize missing lifetime totals from existing `raider.extractCount` and `raider.deathCount` so legacy player history stays consistent. Leave `byZone`/`byZoneAndDanger` maps empty during this backfill.

Version 6 migration normalizes saved lifetime stats into this current shape and drops stale removed stat fields rather than preserving unknown keys from older saves.

### Robot Encounters
Robot encounter diary events in `src/content/raiding_events.json` and `src/content/extraction_events.json` start multi-tick activities with `effects.startRaidActivity`, not legacy one-tick `effects.robotEncounter`. Named diary lines should pass `startRaidActivity.robotId`; generic diary lines should pass `startRaidActivity.robotPool` and let the activity resolver choose from `src/content/robots.json` using robot weights plus filters such as danger level, greed, zone, zone condition, and deadliness. Activity definitions can also declare `requires` gates for danger level, zone, zone condition, and greed; keep event `requires` aligned so diary text does not announce an activity that the resolver refuses to start. Robots have a `deadliness` label (`weak`, `moderate`, `dangerous`, `nasty`, `deadly`) that must match their menace, abundance, and encounter tuning. Valid deadliness tiers in ascending order:

| Tier | Label | Robots |
|------|-------|--------|
| 1 (weakest) | `weak` | Anxietick (menace 2), Overthinker Tick (menace 2) |
| 2 | `moderate` | Tattletale drone (menace 3), Passive-Aggressor Drone (menace 4), Seeker of Validation (menace 5), Harvester of Mild Annoyances (menace 4) |
| 3 | `dangerous` | Walker Texas Malfunction (menace 6), Enforcer of Minor Inconveniences (menace 6) |
| 4 | `nasty` | Bomber Who Misreads the Room (menace 7) |
| 5 (deadliest) | `deadly` | Roomba Prime (menace 8), Crusher of Dreams (menace 8), Sniper of Poor Decisions (menace 9), Tank of Overcompensation (menace 10) |

Only `nasty` and `deadly` robots can down the raider (downing encounters trigger only at ≤ 50% HP). `weak`, `moderate`, and `dangerous` robots are non-lethal: damage is capped so HP cannot drop to 0. High-tier robot starter events (`nasty` and above) must include `"minGreed": 20` in their `requires` clause so they only appear after the raider has pushed deeper.

Robot combat is resolved by `src/engine/raidActivities.ts` as a `ROBOT_ENCOUNTER` activity. Each round the Raider damages the robot HP pool with the current weapon. Until the weapon system exists, all raiders use the default **Tea Kettle** weapon. Robot retaliation routes through `src/engine/shields.ts`, and round/completion text is emitted to `GameState.activityLog`. Activity starters can set `startRaidActivity.robotDamageMultiplier` to make a variant more dangerous. Robot-specific loot is awarded from the robot's `lootTable` when the activity resolves in the Raider's favor. Robot loot is also included in the regular loot resolver pool alongside the base loot tables.

Positive mood grants a small resilience bonus before shield mitigation during robot activity retaliation only. This trims the damage handed to shields and HP, does not alter robot raw damage, and should remain a small modifier. When resilience mitigates damage, the activity-log damage narration must explicitly include the reduced amount (for example `Resilience mitigated 2 damage before shields.`).

Do not add passive Raider Level damage resistance. Robot survivability should remain easy to reason about: robot deadliness/menace plus danger profile define threat; positive mood provides the soft pre-shield resilience trim; Hiding in Lockers provides a tiny explicit pre-shield skill mitigation; shields, consumables, and Handler actions are the meaningful survival levers.

### Healing Items
Field meds live in `src/content/healing_items.json` and are current-raid-only consumables, stored on `RaidState.healingItems`, not in the backpack or home stash. RAIDING events can use `effects.healingItem` to find one field med. Bandages are alive-only HP recovery items; revive meds are DOWNED-only items with `reviveAmount`. The engine automatically uses the smallest useful bandage when the raider is alive, not DOWNED, and HP is at or below 75%, capped at 50 HP per use: White +5, Green +10, Blue +25, Purple +50. Panic Paddles are a legally distinct parody revive med inspired by extraction-shooter defibrillator items: they can be found in-raid, revive a DOWNED Raider to 25 HP, and are removed from `RaidState.healingItems` when used. Each field med also has a `moodGain`, and higher-tier meds grant more mood when consumed. Healing items reset when the raid returns to HUB and are lost on failed recovery.

When normal loot is added to backpack, the engine also performs independent bonus consumable rolls:
- Healing item bonus roll
- Shield recharger bonus roll

Because these rolls are independent, one loot event can grant both.

### Shields
Shields are implemented as a deterministic protection layer on `RaidState.shield`, not as bonus HP. All incoming engine damage that should respect shields must route through the shared helper in `src/engine/shields.ts`; do not subtract shielded HP ad hoc in unrelated files. Shield rechargers are backpack items found during RAIDING and are manual-use only from the current raid backpack. They restore shield charge, never durability, and if left unused they extract into the home stash like normal backpack loot.

Additional shield behavior:
- Returning to HUB restores equipped shield charge and durability to full for MVP.
- Shield rechargers can apply over multiple ticks via `RaidState.activeShieldRecharge`.
- Comms should include shield split narration when mitigation occurs (shield charge lost vs HP damage landed).

## Persistence and Migration Notes
- Saves are local-only (`localStorage`) and versioned.
- Load migration fills missing fields for legacy saves (for example coins, stats, shield state, hidden pocket, danger level, zone condition, downed/extracting condition state).
- When the KNOCKED_OUT/condition migration lands, legacy `DOWNED` phase saves should load as `KNOCKED_OUT`, and legacy `EXTRACTING` phase saves should load as `RAIDING` with `RaidState.extracting` populated from the old timer.
- If stash quantity exceeds cap in a legacy save, overflow is auto-sold during migration rather than deleted.

## Future Development Notes
- Home stash will eventually persist to IndexedDB when transitioning from localStorage
- Consider loadout/store progression for non-starter shield persistence and durability repair loops
- Consider achievements/milestones for accumulated stash value
