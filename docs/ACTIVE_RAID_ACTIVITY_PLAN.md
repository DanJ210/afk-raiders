# Active Raid Activity Plan

This document tracks the migration from single-tick damage events toward Godville-style active threads: the normal diary keeps ambient raid narration flowing, while a second activity log owns multi-tick work such as searching, extraction drama, robot fights, and damage resolution.

## Why This Exists
- The comms feed should stay funny and broad: loot observations, weather, hub gossip, panic flavor, and phase narration.
- Damage, fighting, and other multi-tick tasks need continuity across ticks instead of being resolved inside one random diary line.
- The player should be able to read both layers at once: what the Raider is generally saying and what active problem they are currently trying to survive.
- This should extend the current engine rather than restarting it.

## Current Foundation
- `GameState.activityLog` exists as a persisted capped log next to `GameState.log`.
- `TickResult` can return both `events` and `activityEvents`.
- `CommsLog.vue` renders a compact active-thread feed above the normal diary feed.
- Extraction and DOWNED timers already emit activity-thread start/progress/complete/fail lines.
- `RaidState.activeRaidActivity` exists with migration/default state support.
- Timed shield recharges run as a side condition on `RaidState.activeShieldRecharge`; use/start/completion messages belong to the ambient comms log, not the active-thread feed.
- Activity definitions have been split into focused files: `src/content/raiding-events/robot_encounter_activities.json`, `src/content/raiding-events/search_activities.json`; the old monolithic `raid_activities.json` has been migrated and removed.
- `src/engine/raidActivities.ts` can start and advance JSON-backed robot encounter activities.
- Robot activities currently use the base **Tea Kettle** weapon, apply Raider damage to robot HP pools each round, apply robot retaliation through shield-aware damage, emit activity-log round/completion lines, and award robot loot/stats on defeat. Encounters are HP-driven: old tick counters no longer fail a robot fight while robot HP remains.
- At least one generic robot-pool starter exists (`raid_metallic_noise_pool`) to prove robot selection can come from `robotPool` instead of a fixed `robotId`.
- Raiding event files have been sanitized so robot-triggering diary entries now use `effects.startRaidActivity` instead of legacy `effects.robotEncounter` / top-level `effects.robotDamageMultiplier`.
- Content tests now fail if legacy robot encounter fields are reintroduced into ordinary diary events.
- `EventTemplate` no longer exposes legacy `effects.robotEncounter` / top-level `effects.robotDamageMultiplier`, `processTick()` no longer resolves one-tick robot encounters from diary events, and the deprecated `resolveRobotEncounter()` helper has been removed.
- Low-danger robot encounter weighting has been reduced now that robot encounters are multi-tick blocking activities; this preserves the balance contract that Low remains extractable often enough for the idle loop.
- `SEARCH` activities are now supported by `src/engine/raidActivities.ts`; `search_black_box_cache` and `search_water_bottle_stash` prove backpack-loot completion, `search_medical_pouch` proves current-raid field-med completion, and `search_shield_recharger_crate` proves backpack shield-recharger completion from `src/content/raiding-events/search_activities.json`.
- Search activities can draw from every runtime loot table under `src/content/loot-tables/`, plus the derived `water_bottles` pool, and normal loot searches can return small multi-item bundles.
- Activity definitions can now declare `requires` gates for danger level, zone, zone condition, and greed. The activity resolver enforces those gates even if a diary event tries to start the activity directly.
- Activity definitions now include user-facing names. Active activity state and activity-log entries carry those names so the UI can identify the current thread or robot encounter without deriving labels from ids.
- Robot pools can now gate selection by danger level, zone, zone condition, greed, and deadliness; generic starters should use those gates instead of relying only on event-level requirements.
- Normal RAIDING diary selection uses a two-stage roll: first ambient comms vs activity starter, then eligible `SEARCH` vs `ROBOT_ENCOUNTER` starters by danger level. Activity starters target about 67% of normal RAIDING diary rolls; within those activity starters, Low targets about 75% search / 25% robots, Medium about 60% / 40%, and High about 50% / 50%.
- Activity-scoped ambient comms can also fire during active activities/conditions. They go to `GameState.log`, require `activeActivityKind`/`activeActivityId`/`activeRobotId`, and must be ambient-only content with no effects so they never mutate state or pollute `GameState.activityLog`.
- Damage-only extraction diary events now start `extraction_hazard_damage` activities instead of applying direct `effects.damage`; content tests guard `src/content/raiding-events/extraction_events.json` against direct damage effects.
- Extraction countdown activity-log text is now sourced from `extraction_countdown` in `src/content/raiding-events/search_activities.json` while `RaidState.extracting` remains the lifecycle guardrail.
- DOWNED countdown activity-log text is now sourced from `downed_countdown` in `src/content/raiding-events/search_activities.json` while `RaidState.downed` remains the lifecycle guardrail.
- All top-level event JSON is guarded against direct `effects.damage` and negative `effects.hp`; damage must now route through activity/lifecycle engine paths instead of ordinary diary effects.
- The old top-level `src/content/raiding_events.json` has been removed; RAIDING diary events now load from `src/content/raiding-events/raiding_events.json`.

## Target Model
Use a single active RAIDING activity state on `RaidState`, named `activeRaidActivity`. It should represent one multi-tick task at a time and should become the main driver for sustained raid action.

Activities are data-driven and split into focused files under `src/content/raiding-events/`: `robot_encounter_activities.json` (ROBOT_ENCOUNTER activities), `search_activities.json` (SEARCH, EXTRACTION, and DOWNED activities). The engine owns deterministic resolution; JSON owns weights, text pools, duration ranges, activity kind, requirements, and loot/robot references.

Candidate shape:

```ts
type RaidActivityKind = 'SEARCH' | 'ROBOT_ENCOUNTER' | 'EXTRACTION' | 'DOWNED'

interface ActiveRaidActivity {
  id: string
  name?: string
  kind: RaidActivityKind
  ticksRemaining: number
  totalTicks: number
  locationId?: string
  lootTableId?: string
  robotId?: string
  robotHp?: number
  robotMaxHp?: number
  weaponId?: string
  weaponName?: string
  raiderDamageMin?: number
  raiderDamageMax?: number
  raiderAction?: 'fighting' | 'hiding' | 'fleeing' | 'searching'
}
```

Decision: EXTRACTION and DOWNED should become first-class activity definitions, not just hardcoded timers forever. They may remain bridged through `RaidState.extracting` / `RaidState.downed` during migration because those fields currently protect raid lifecycle rules, but the target content model is JSON-backed `EXTRACTION` and `DOWNED` activities with their own start/progress/success/failure text, duration, outcome weights, and requirements.

Decision: robot encounters should be `ROBOT_ENCOUNTER` activities. A diary event or danger profile can start a robot encounter activity, but the activity resolver owns robot HP, raider damage, robot damage, shields, round text, and completion. Robot choice should be driven by robot data: the activity can either reference a specific robot id or ask the resolver to choose from `src/content/robots.json` using robot weights plus requirements such as danger level, greed, zone, zone condition, and deadliness tier. This keeps robot tuning in the robot table instead of burying it in one-off diary events.

## Log Ownership Contract
- `GameState.log` is the diary/comms feed. It narrates ambient events, phase transitions, Handler feedback, loot flavor, mood/greed shifts, and other broad story beats.
- Healing item use and shield recharger use/start/completion are Handler/ambient beats and belong in `GameState.log`.
- `GameState.activityLog` is the active-thread feed. It narrates multi-tick progress, combat rounds, damage, shield splits caused by active hazards/combat, revive/extraction timers, and task completion/failure.
- Activity-log entries should carry `activityName` when the source has a user-facing name, and robot encounters should include the selected robot in that name.
- Activity-log entry `id` values must include the concrete `activityId` plus status so different activity definitions cannot collide on generic ids such as `activity_extraction_completed`. Code that needs to find a logical activity event should prefer `activityId + status` over parsing `id`.
- Ordinary diary events must not directly modify HP, apply shield-aware damage, or resolve robot combat once this migration is complete.
- Damage text must still be visible, but it belongs in `activityLog` alongside the activity that caused it.
- If a diary event starts danger, it should start an activity rather than resolving the danger itself.

## Event Content Migration
Scrub old event tables so random diary events stop being hidden combat scripts.

Remove or migrate these effect styles from ordinary diary events:
- `effects.hp`
- `effects.damage`
- `effects.robotEncounter`
- robot damage multipliers attached to single-tick diary outcomes

Replace them with activity-starting effects, for example:

```json
{
  "id": "medical_search_started",
  "weight": 12,
  "requires": { "phase": "RAIDING", "downed": false, "extracting": false },
  "text": "Raider found Medical and immediately began judging the cabinets.",
  "effects": {
    "startRaidActivity": {
      "kind": "SEARCH",
      "activityId": "search_medical",
      "ticks": 3,
      "lootTable": "medical"
    }
  }
}
```

Robot-starting events should announce the encounter in the diary and then let the active-thread resolver run the fight over multiple ticks. Some robot-starting events may specify a robot directly; others should specify a robot pool or activity id that resolves through robot JSON weights and requirements.

Example robot activity starter:

```json
{
  "id": "robot_noise_in_medical",
  "weight": 10,
  "requires": { "phase": "RAIDING", "dangerLevel": ["Medium", "High"], "downed": false, "extracting": false },
  "text": "Something metallic knocked over the Medical shelf. Raider has chosen investigation, somehow.",
  "effects": {
    "startRaidActivity": {
      "kind": "ROBOT_ENCOUNTER",
      "activityId": "robot_encounter_standard",
      "robotPool": {
        "dangerLevel": ["Medium", "High"],
        "deadliness": ["moderate", "dangerous", "nasty"]
      }
    }
  }
}
```

## Tick Order Target
1. Advance lifecycle phase timers.
2. Advance existing timed conditions (`extracting`, `downed`) and mirror their progress into `activityLog`.
3. If `activeRaidActivity` exists, advance exactly one activity tick:
   - search progress or loot result
   - robot attack/defense round
   - shield-aware damage through `src/engine/shields.ts`
   - activity completion/failure
4. If no blocking activity exists, run Greed Check and choose/resolve a normal ambient diary event.
5. Apply Handler pending actions and progression rewards.
6. Optionally resolve activity-scoped ambient overlay comms for the current activity/condition.
7. Append diary/ambient overlay events to `log` and activity events to `activityLog`.

Activity-scoped ambient overlay events are implemented as no-effect diary content gated by `requires.activeActivityKind`, `requires.activeActivityId`, or `requires.activeRobotId`. They can fire during searches, robot encounters, extraction, or DOWNED conditions without replacing the active-thread progress/combat/timer line for that tick.

## Robot Encounter Target
- A robot encounter starts as an activity with robot id, robot HP, and raider intent. Robot HP and Raider HP are the normal endpoints; tick counters are legacy metadata for robot encounters and should not fail a fight while robot HP remains.
- Robot encounter activity definitions live in activity JSON, while robot identity/tuning continues to live in `src/content/robots.json`.
- Robot selection should support either a fixed `robotId` or weighted selection from robot data using requirements such as danger level, greed, zone, zone condition, and deadliness.
- Each tick resolves one round using seeded RNG.
- The Raider deals damage to the robot HP pool each round. Damage is adjusted by the currently equipped weapon.
- Future weapon/buff systems can also alter outgoing damage through activity damage range and robot-damage-taken multiplier fields.
- Weapons are a later progression stage. Until that system exists, all raiders use the default base weapon: **Tea Kettle**.
- Tea Kettle damage should be deterministic and modest, defined in engine/content constants first and moved into weapon content later. The activity resolver should already pass through `weaponId`, `weaponName`, and damage range fields so the later weapon system can replace the default without rewriting robot combat.
- Damage is routed through `applyShieldedDamage()` and narrated in `activityLog`.
- The diary may still receive occasional color lines, but it must not own the combat math.
- Robot defeat/survival/death stats and XP fire when the activity resolves.
- Robot-specific loot pools are resolved when the activity ends, using either robot loot tables or activity-specific rewards when needed.
- Existing deadliness tiers and nonlethal-floor rules still apply.
- Fixed `robotId` starters are still allowed for named diary beats, but generic starters should prefer `robotPool` gates for danger level, zone, zone condition, greed, and deadliness so encounters can be tuned by location.

## Extraction And Downed Activity Target
- EXTRACTION should have JSON-backed activity definitions for start/progress/success/failure text, duration, success/failure/complication weights, and requirements.
- DOWNED should have JSON-backed activity definitions for incapacitated progress, revive/failure text, duration, and requirements.
- During migration, `RaidState.extracting` and `RaidState.downed` can remain as lifecycle safety fields while the activity resolver mirrors or gradually absorbs their behavior.
- Final target: extraction and downed outcomes are resolved through the activity system, while phase transitions remain lifecycle moves (`RAIDING -> HUB`, `RAIDING -> KNOCKED_OUT`, `KNOCKED_OUT -> HUB`).

## Search Activity Target
- Search activities provide the Godville-style "Searching Medical for Anything" thread.
- Each tick can emit progress flavor into `activityLog`.
- Completion can award loot, healing items, shield rechargers, greed/mood changes, or nothing.
- Loot searches can award bundles. Default roll count scales gently with activity length, and individual activities can set `lootRolls` for more specific reward tuning.
- Search loot tables should use the canonical table IDs from `src/content/loot-tables/` (`apparel_accessories`, `arc_tech`, `consumables`, `cursed_weird_items`, `loot`, `personal_junk`, `scrap_components`, `valuables`, `weapons_parts`) or the derived `water_bottles` pool.
- The diary can continue ambient lines while searching unless the activity is marked blocking.

## Migration Steps
1. [Done] Document the target model and update current docs. (This document.)
2. [Done] Add `RaidState.activeRaidActivity` and migration defaults.
3. [Done] Add an activity resolver in pure engine code, currently `src/engine/raidActivities.ts`.
4. [Done/Revised] Keep shield recharge math in `RaidState.activeShieldRecharge`, but route shield recharger use/start/completion through the ambient log instead of the activity log.
5. [Done] Add JSON-backed activity definitions for one or two search activities.
6. [Done] Add JSON-backed `ROBOT_ENCOUNTER` activity definitions and robot-pool selection through `src/content/robots.json` weights/requirements.
7. [Done] Convert robot encounters from single-tick `effects.robotEncounter` into multi-tick `ROBOT_ENCOUNTER` activities.
8. [Done] Add JSON-backed `EXTRACTION` and `DOWNED` activity definitions, then bridge existing condition timers through those definitions.
9. [Done] Scrub `src/content/*_events.json` so ordinary diary events no longer apply HP/damage or resolve fights.
10. [Done] Add content tests that fail if normal diary event tables keep damage/fight effects after migration.
11. [Done] Add content and engine tests for activity requirements and robot pool gates by danger level, zone, zone condition, greed, and deadliness.
12. [Done] Update balance tests around activity-driven robot outcomes and ambient danger.
13. [Done] Split monolithic `raid_activities.json` into focused `robot_encounter_activities.json` and `search_activities.json`; migrate all 18 backpackValue events to multi-tick SEARCH activities; remove old file.

## Extraction & Downed Completion Work (Path A - Completed)
Added comprehensive activity definitions for extraction and downed outcomes:

### Extraction Activity Variants
- `extraction_countdown` - Standard extraction (4 ticks, all danger levels)
- `extraction_high_difficulty` - High-danger extraction (5 ticks, High danger only, longer timer)
- `extraction_success_bonus` - Success milestone activity (1 tick, can grant bonus effects)
- `extraction_complication_close_call` - LZ complications (2 ticks, Medium/High danger only)

### Downed Activity Variants
- `downed_countdown` - Standard downed timer (2 ticks, all danger levels)
- `downed_high_danger` - High-danger downed (1 tick, High danger only, no mercy)
- `downed_revival_attempt` - Revival through Signal cost (1 tick, custom attempt flavor)

### Requirements Gates Applied
- Extraction/downed activities now include `requires.dangerLevel` gates
- High-danger zone extractions use extended timers (5 vs 4 ticks)
- High-danger downed states use compressed timers (1 vs 2 ticks) for urgency
- Low-danger zones get standard extraction flow
- Medium/High danger zones get complication variants

## Next Implementation Order (Path B - In Progress)
1. [Done] Convert all 18 `backpackValue` instant-loot events into `SEARCH` activities.
   - Created 7 new `search_quick_value_*` SEARCH activities (values: 1, 2, 3, 4, 6, 7, 10)
   - Converted 18 diary events from `effects.backpackValue` to `effects.startRaidActivity`
   - All 263 tests passing; migration validated
   - Old `raid_activities.json` removed; migration to split files complete

2. [Done/Revised] Keep successful extraction lifecycle completion synchronous.
   - ✅ Added 5 new outcome activity definitions to `search_activities.json`:
     - `extraction_success_bonus` (1 tick, non-blocking, High/Medium/Low danger)
     - `extraction_high_difficulty` (5 ticks, blocking, High danger only)
     - `extraction_complication_close_call` (2 ticks, blocking, Medium/High danger only)
     - `downed_high_danger` (1 tick, blocking, High danger only)
     - `downed_revival_attempt` (1 tick, blocking, all danger levels)
   - ✅ `completeExtractionCondition()` applies extraction bookkeeping and always completes the `RAIDING -> HUB` lifecycle transition in the same call.
   - ✅ Outcome activity definitions remain content-side prototypes, but they are not started by successful extraction until multi-tick `EXTRACTION` activities can own lifecycle completion and emit their started/progress/completed activity events safely.
   - ✅ Regression coverage verifies extraction cannot strand the raid in `RAIDING` with `extracting` cleared and backpack state half-reset.

3. [Completed] Add zone-specific extraction difficulty modifiers.
   - ✅ **Zone Classification**: Created three difficulty tiers:
     - Friendly zones: forgotten_fields, stella (3-tick extraction)
     - Standard zones: damp_battlegrounds, buried_city, the_sunken_highrise (4-tick extraction)
     - Hostile zones: the_breach, arc_ruins (6-tick extraction)
   - ✅ **Zone-Specific Extraction Activities** (defined in `search_activities.json`):
     - `extraction_low_difficulty_zone` (3 ticks, blocking)
     - `extraction_standard_zone` (4 ticks, blocking)
     - `extraction_high_difficulty_zone` (6 ticks, blocking)
   - ✅ **Zone-Aware Extraction Startup**: Modified `startExtractionCondition()` to select zone-appropriate extraction duration
     - Added `getExtractionDurationForZone()` helper to map zones to durations
     - Extraction timer now initialized with zone-specific duration instead of hardcoded constant
     - Friendly zones extract faster (safer); hostile zones take longer (more dangerous)
   - ✅ **Deferred Zone-Aware Outcome Selection**: Zone personality can still inform future extraction outcome activities, but it must be reintroduced only after those activities are true lifecycle owners rather than instant side effects.
   - ✅ **All Tests Passing**: 263/263 tests validate zone extraction system
   - **Implementation Notes**:
     - Zone extraction activities are defined but primarily affect outcome probabilities
     - Base extraction duration is driven by zone classification in startExtractionCondition
     - Both systems work together: duration from zone, outcomes influenced by zone personality

4. [Future] Integrate downed revival cost scaling with raider level.

## Enemy Encounter & Loot Improvements (Path C - Completed)
1. [Done] Add DOWNED reason context to ambient comms.
  - Store an optional structured reason on `RaidState.downed` so saves and UI/debugging can inspect why the Raider is incapacitated.
  - Pass reason context through every `startDownedCondition()` call site: robot combat, ambient danger pressure, extraction complications, raid timer expiry, and fallback HP-zero checks.
  - Keep the active DOWNED thread focused on timer/progress text; put the causal explanation in `GameState.log`.

2. [Done] Make robot encounters HP-driven instead of tick-timeout-driven.
  - Keep robot HP and Raider weapon damage as the source of encounter length.
  - End robot encounters when robot HP reaches 0 or the Raider becomes DOWNED; do not fail a fight only because an activity tick counter expired.
  - Keep Tea Kettle as the default weapon for now, but preserve `weaponId`, `weaponName`, damage range, and multiplier fields so future weapons and buffs can shorten or reshape encounters without rewriting combat.

3. [Done] Expand search loot output and loot-table coverage.
  - Map all runtime loot tables from `src/content/loot-tables/` into the search activity resolver instead of only `scrap_components` and `water_bottles`.
  - Add content validation so every search `lootTableId` resolves to a known table.
  - Add multi-roll search rewards so longer/riskier searches can return small bundles instead of a single item.
  - Add new search activities for underused pools such as apparel/accessories, weapon parts, valuables, arc tech, cursed weird items, and consumables.


## Testing Checklist
- Same seed + same state yields the same diary and activity event sequences.
- Legacy saves load with `activityLog: []` and no active activity.
- Activity logs are capped and persisted like diary logs.
- Damage cannot be emitted without an activity source, except for explicitly documented lifecycle pressure such as raid timer failure.
- Shield mitigation and HP changes are tested through activity resolution, not random diary event effects.
- Robot activities preserve weak/moderate/dangerous nonlethal behavior and nasty/deadly downing behavior.
- Offline catch-up appends meaningful activity progress without flooding the away summary.

## Deferred Questions
- Should a search activity block robot encounters, or can a robot interrupt and replace it?
- Should activity logs show only the active thread, or a capped history of recent resolved threads?
- How much Handler influence should apply inside robot activities beyond existing Signal actions?
- Should extraction/DOWNED fully remove `RaidState.extracting` and `RaidState.downed`, or should those fields remain as derived lifecycle guardrails after activity JSON owns their content and timing?