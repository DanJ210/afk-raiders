# Active Raid Activity Contract

AFK Raiders splits raid narration into two persistent logs to maintain clarity and pacing:
- **`GameState.log`:** The diary/comms feed for ambient raid narration (loot flavor, phase transitions, mood/greed shifts, Handler feedback).
- **`GameState.activityLog`:** The active-thread feed for multi-tick work (searches, extraction, DOWNED recovery, robot fights, damage rounds).

Multi-tick tasks are implemented as `RaidState.activeRaidActivity` (timed SEARCH/ROBOT_ENCOUNTER/etc activities) or lifecycle conditions (`RaidState.extracting` and `RaidState.downed`). The engine resolves activities deterministically; JSON owns weights, text, duration, and tuning.

## Active Raid Activity Model

`RaidState.activeRaidActivity` represents one multi-tick task at a time: SEARCH, ROBOT_ENCOUNTER, or blocking activity.

```ts
type RaidActivityKind = 'SEARCH' | 'ROBOT_ENCOUNTER'

interface ActiveRaidActivity {
  id: string
  name?: string                  // User-facing activity name
  kind: RaidActivityKind
  ticksRemaining: number
  totalTicks: number
  locationId?: string
  lootTableId?: string
  robotId?: string               // Specific robot encounter
  robotHp?: number
  robotMaxHp?: number
  weaponId?: string
  weaponName?: string
  raiderDamageMin?: number
  raiderDamageMax?: number
  raiderAction?: 'fighting' | 'hiding' | 'fleeing' | 'searching'
}

interface ExtractingState {
  ticksRemaining: number
  totalTicks?: number            // For UI progress tracking
}

interface DownedState {
  ticksRemaining: number
  totalTicks?: number            // For UI progress tracking
  reason?: DownedReason          // Contextual downage cause
}
```

Activities are data-driven and split into focused files under `src/content/raiding-events/`:
- `robot_encounter_activities.json` — ROBOT_ENCOUNTER activity definitions and robot pool selection.
- `search_activities.json` — SEARCH activities (backpack loot, field meds, shield rechargers), plus EXTRACTION and DOWNED activity metadata.

The engine deterministically resolves activities; JSON owns weights, text, duration, requirements, and tuning.

**Future:** EXTRACTION and DOWNED will eventually own lifecycle completion (not just activity metadata), replacing synchronous bookkeeping. This requires the activity system to safely emit started/progress/completed lifecycle events.

## Log Ownership Contract
- `GameState.log` is the diary/comms feed. It narrates ambient events, phase transitions, Handler feedback, loot flavor, mood/greed shifts, and other broad story beats.
- Healing item use and shield recharger use/start/completion are Handler/ambient beats and belong in `GameState.log`.
- `GameState.activityLog` is the active-thread feed. It narrates multi-tick progress, combat rounds, damage, shield splits caused by active hazards/combat, revive/extraction timers, and task completion/failure. The UI renders timed progress from `ActiveRaidActivity.ticksRemaining / totalTicks` or the current `RaidState.extracting` / `RaidState.downed` condition timer, while robot encounters use `robotHp / robotMaxHp` instead.
- Activity-log entries should carry `activityName` when the source has a user-facing name, and robot encounters should include the selected robot in that name.
- Activity-log entry `id` values must include the concrete `activityId` plus status so different activity definitions cannot collide on generic ids such as `activity_extraction_completed`. Code that needs to find a logical activity event should prefer `activityId + status` over parsing `id`.
- Ordinary diary events must not directly modify HP, apply shield-aware damage, or resolve robot combat once this migration is complete.
- Damage text must still be visible, but it belongs in `activityLog` alongside the activity that caused it.
- If a diary event starts danger, it should start an activity rather than resolving the danger itself.

## Event Content Guidelines

Diary events should use `effects.startRaidActivity` to initiate multi-tick work. Example patterns:

**SEARCH Activity:**
```json
{
  "id": "medical_search_started",
  "weight": 12,
  "requires": { "phase": "RAIDING" },
  "text": "Raider found Medical and immediately began judging the cabinets.",
  "effects": {
    "startRaidActivity": {
      "kind": "SEARCH",
      "activityId": "search_medical"
    }
  }
}
```

**ROBOT_ENCOUNTER Activity (specific robot):**
```json
{
  "id": "robot_encounter_named",
  "weight": 10,
  "requires": { "phase": "RAIDING", "dangerLevel": ["Medium", "High"] },
  "text": "Something metallic knocked over the shelf.",
  "effects": {
    "startRaidActivity": {
      "kind": "ROBOT_ENCOUNTER",
      "activityId": "robot_encounter_standard",
      "robotId": "enforcer_minor"
    }
  }
}
```

**ROBOT_ENCOUNTER Activity (pooled selection):**
```json
{
  "id": "robot_noise_pool",
  "weight": 15,
  "requires": { "phase": "RAIDING", "dangerLevel": ["Medium", "High"] },
  "text": "Something metallic knocked over the shelf.",
  "effects": {
    "startRaidActivity": {
      "kind": "ROBOT_ENCOUNTER",
      "activityId": "robot_encounter_standard",
      "robotPool": {
        "dangerLevel": ["Medium", "High"],
        "deadliness": ["moderate", "dangerous"]
      }
    }
  }
}
```

**Content Contract:** Ordinary diary events must not apply direct `effects.hp` / `effects.damage` or resolve combat. Damage and multi-tick hazards route through the activity system. Content tests enforce this; legacy effect fields are guarded against.

## Current Extraction And Downed Contract
Extraction and DOWNED are still lifecycle conditions layered on `RAIDING`, with JSON-backed text/activity metadata used by the active-thread log.

### Current Extraction Behavior
- `RaidState.extracting` is the successful raid-exit guardrail.
- `startExtractionCondition()` starts the condition and clears conflicting side activities such as shield recharge.
- Extraction duration is content-driven from `EXTRACTION` activity definitions in `search_activities.json`:
  - `extraction_low_difficulty_zone` - friendly zones, 3 ticks
  - `extraction_standard_zone` - standard zones, 4 ticks
  - `extraction_high_difficulty_zone` - hostile zones, 6 ticks
  - `extraction_countdown` - fallback/default, 4 ticks
- When the extraction timer completes, `completeExtractionCondition()` performs successful-extraction bookkeeping and immediately transitions `RAIDING -> HUB` in the same tick.
- Failed extraction events clear `RaidState.extracting`, emit an extraction failed activity entry without the `EXTRACTING` condition tag, and leave the raid in `RAIDING`.

### Current Downed Behavior
- `RaidState.downed` is the incapacitated/revive guardrail.
- Runtime DOWNED duration still uses the standard 2-tick `DOWNED_TICKS` window.
- DOWNED start/progress activity entries carry the `DOWNED` condition tag; completed/failed entries do not claim the Raider is still DOWNED.
- `downed_high_danger` and `downed_revival_attempt` remain activity-content prototypes until DOWNED activities own lifecycle duration and completion.

### Deferred Outcome Prototypes
These definitions exist in `search_activities.json`, but successful extraction does not start them yet:
- `extraction_success_bonus` - success milestone activity (1 tick, non-blocking)
- `extraction_high_difficulty` - high-danger extraction prototype (5 ticks, blocking)
- `extraction_complication_close_call` - LZ complication prototype (2 ticks, blocking)

They should only be reintroduced after multi-tick `EXTRACTION` activities can own lifecycle completion and emit started/progress/completed activity events safely. Until then, successful extraction must stay synchronous so stash transfer, raid reset, stats, XP, and `RAIDING -> HUB` cannot drift apart.

## Future Enhancement Targets

### Downed Activity Lifecycle Ownership
DOWNED activity definitions should eventually own duration and completion, replacing the hard-coded `DOWNED_TICKS` lifecycle value. This requires the activity system to safely emit started/progress/completed activity events and call lifecycle transitions, not just side-condition handling.

### Extraction Activity Lifecycle Ownership
EXTRACTION activity definitions should eventually own duration and completion outcomes, replacing synchronous extraction bookkeeping. This requires the activity system to emit activity events and perform raid reset in a deterministic, timeline fashion.

### Downed Revival Cost Scaling
Revival cost scaling should tie to Raider Level so players can reduce future `CALL_REVIVE` Signal costs through progression.

## Migration & Validation Changelog

### Phase 1: Active Activity Foundation
- Added `RaidState.activeRaidActivity` with `src/engine/raidActivities.ts` resolver.
- Implemented `GameState.activityLog` with `TickResult.activityEvents`.
- Split monolithic `raid_activities.json` into `robot_encounter_activities.json` and `search_activities.json`.
- Migrated 18 `effects.backpackValue` instant-loot events into multi-tick SEARCH activities.
- Added content tests guarding against legacy `effects.damage` and `effects.robotEncounter` in diary events.

### Phase 2: Robot Encounters
- Converted one-tick robot damage events into multi-tick `ROBOT_ENCOUNTER` activities.
- Implemented HP-driven combat: encounters continue while robot HP remains; old tick counters no longer fail fights.
- Added robot pool selection by danger level, zone, zone condition, greed, and deadliness tier.
- Reduced Low-danger robot encounter weighting to preserve extractability for idle loop.
- Added nonlethal floor enforcement: weak/moderate/dangerous robots cannot down; nasty/deadly can.

### Phase 3: Search Activities
- Implemented SEARCH activities for backpack loot, field meds, shield rechargers, and water bottles.
- Added search activity gates: danger level, zone, zone condition, greed.
- Implemented bonus healing-item rolls on completed searches (general: 15%, medical: 100%).
- Search activities can award multi-item loot bundles.

### Phase 4: Extraction and DOWNED
- Added extraction zone-specific duration modifiers (3/4/6 ticks for friendly/standard/hostile).
- Implemented `RaidState.extracting.totalTicks` and `RaidState.downed.totalTicks` for UI progress.
- Extraction duration now content-driven from `search_activities.json` zone definitions.
- DOWNED and EXTRACTING condition timers emit activity-log start/progress/complete/fail lines.
- UI renders progress from active activities or condition timers, not only `activeRaidActivity`.

### Phase 5: Content and Validation
- Added content guardrail: every zone in `zones.json` maps to exactly one `extraction_*_zone` activity.
- Activity definitions include user-facing names for UI and debugging.
- Activity-scoped ambient overlay comms can fire during active activities/conditions without replacing thread progress.
- Damage text routes through `activityLog` alongside the activity that caused it.
- All tests passing; balance guardrails intact; coverage maintained.
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