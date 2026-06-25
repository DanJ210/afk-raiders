# RAIDING Conditions Implementation Plan

Temporary planning document. Remove this file after the KNOCKED_OUT / DOWNED / EXTRACTING condition migration is implemented, tested, and reflected in the durable docs.

## Target Model

The raid lifecycle phase answers where the Raider is in the overall loop. DOWNED and EXTRACTING answer what urgent condition is layered on top of RAIDING.

Lifecycle phases:

```ts
export type Phase = 'HUB' | 'DEPLOYING' | 'RAIDING' | 'KNOCKED_OUT'
```

RAIDING condition state:

```ts
export interface DownedState {
  ticksRemaining: number
  reviveHp: number
  reason: 'hp_zero' | 'ambient_pressure' | 'robot' | 'extraction_event' | 'raid_timer'
}

export interface ExtractingState {
  ticksRemaining: number
}

export interface RaidState {
  phase: Phase
  phaseTicksRemaining: number
  downed: DownedState | null
  extracting: ExtractingState | null
}
```

## Behavior Rules

- RAIDING is the only field phase. The Raider remains in RAIDING while downed, extracting, or both.
- DOWNED is a revivable RAIDING condition. The Raider cannot perform normal actions while downed.
- EXTRACTING is a RAIDING condition and the only successful way to end a raid.
- KNOCKED_OUT is the short reset phase between failed RAIDING and HUB. It starts only after the downed revive window fails or the raid timer loss resolves.
- A Raider must be DOWNED before KNOCKED_OUT. Do not transition directly from normal active RAIDING to KNOCKED_OUT unless the same tick starts and expires the downed/loss state by explicit rule.
- Revive will be implemented later. The target revive behavior is to clear `raid.downed`, restore the Raider to 25 HP, preserve shield state exactly as it is, and continue RAIDING with the remaining raid/extraction timers.

## Timer Race Rules

Every RAIDING tick advances the raid timer. If `raid.extracting` is active, its timer also advances. If `raid.downed` is active, its timer also advances.

When both DOWNED and EXTRACTING are active:

1. If extraction completes before or on the same tick as the DOWNED timer expires, the raid succeeds and transitions `RAIDING -> HUB`.
2. If the DOWNED timer expires first, transition `RAIDING -> KNOCKED_OUT`.
3. If the raid timer expires before extraction completes, transition to the loss path. If already downed, transition `RAIDING -> KNOCKED_OUT`; otherwise start DOWNED from raid timer loss.

The same-tick tie favors extraction. This avoids ambiguous 30-second tick ordering and matches the player expectation that a shuttle completing now gets the Raider out in time.

## Event Rules

Normal RAIDING events should not fire while DOWNED. DOWNED-specific comms may fire if an event explicitly requires the DOWNED condition.

EXTRACTING-specific comms are still content events, but they are gated by `requires.extracting` rather than an EXTRACTING phase. They may fire while extracting and not downed. If downed while extracting, only events that explicitly require `downed: true` should fire.

Add condition requirements to event templates:

```json
"requires": {
  "phase": "RAIDING",
  "extracting": true,
  "downed": false
}
```

Potential event IDs:

- `condition_extracting_started`
- `condition_extracting_completed`
- `condition_extracting_failed`
- `condition_downed_started`
- `condition_downed_tick`
- `condition_downed_revived`
- `condition_downed_expired`

Phase transition IDs remain for lifecycle changes only:

- `phase_HUB_to_DEPLOYING`
- `phase_DEPLOYING_to_RAIDING`
- `phase_RAIDING_to_HUB`
- `phase_RAIDING_to_KNOCKED_OUT`
- `phase_KNOCKED_OUT_to_HUB`

## Content Migration

- Rename the current terminal recovery content file from `downed_events.json` to `knocked_out_events.json`.
- Change current terminal recovery event requirements from `phase: "DOWNED"` to `phase: "KNOCKED_OUT"`.
- Keep extraction-event style content, but resolve it as RAIDING condition content gated by `requires.extracting`.
- Add DOWNED condition events either to `raiding_events.json` or to a dedicated condition event file if that keeps content cleaner. The engine still treats them as RAIDING condition events.
- Phase-transition text remains in `src/content/phase_transitions.json`.

## Engine Migration Steps

1. Add `DownedState`, `ExtractingState`, `RaidState.downed`, and `RaidState.extracting`.
2. Rename terminal phase `DOWNED` to `KNOCKED_OUT` across engine types, state machine durations, content validation, UI labels, and tests.
3. Remove `EXTRACTING` from the `Phase` union and represent extraction as `RaidState.extracting`.
4. Add save migration for older saves:
   - legacy `phase: "DOWNED"` -> `phase: "KNOCKED_OUT"`
   - legacy `phase: "EXTRACTING"` -> `phase: "RAIDING"` with `extracting` populated from the old phase timer
   - missing `downed` / `extracting` -> `null`
   - old log entry phases can be preserved for history or normalized if type constraints require it
5. Route HP-zero, ambient downed pressure, robot lethal outcomes, and extraction downing outcomes into `raid.downed` instead of immediate phase transition.
6. Route CALL EXTRACT and natural extraction into `raid.extracting` instead of phase transition.
7. Resolve `RAIDING -> HUB` successful extraction only when extraction completes or a condition event forces success.
8. Resolve `RAIDING -> KNOCKED_OUT` only when the downed window fails or raid timer loss wins.
9. Keep backpack loss, hidden-pocket save, death stats, HP restoration, and recovery XP on `KNOCKED_OUT -> HUB`.
10. Update catch-up death counting to use `phase_RAIDING_to_KNOCKED_OUT` or the final chosen loss transition ID.

## Test Plan

- Existing terminal loss tests renamed from DOWNED to KNOCKED_OUT.
- HP reaching 0 during RAIDING starts `raid.downed` and keeps phase RAIDING.
- Ambient downed pressure starts `raid.downed` and keeps phase RAIDING.
- CALL EXTRACT starts `raid.extracting` and keeps phase RAIDING.
- Natural extraction starts `raid.extracting` after the minimum raiding guard and keeps phase RAIDING.
- Extraction completion transitions `RAIDING -> HUB`, transfers backpack, counts extract, and clears conditions.
- Failed extraction clears only `raid.extracting` and preserves the raid timer.
- Downed while extracting suppresses normal events but preserves extraction countdown.
- Extraction completing before or on the same tick as downed expiry succeeds.
- Downed expiry before extraction completion transitions `RAIDING -> KNOCKED_OUT`.
- `KNOCKED_OUT -> HUB` clears backpack, saves hidden pocket item, restores HP, records death, resets greed, and clears conditions.
- Catch-up summaries count new losses from KNOCKED_OUT transition events and successful extracts from `RAIDING -> HUB`.
- Save migration handles legacy DOWNED and EXTRACTING saves.

## UI Notes

- Status surfaces should show RAIDING as the phase and expose DOWNED / EXTRACTING as condition badges or timer rows.
- When DOWNED, normal Handler actions should be disabled. Future revive action can be enabled from this state.
- When EXTRACTING, CALL EXTRACT should be disabled because extraction is already active.
- If DOWNED and EXTRACTING overlap, show both timers clearly; extraction is the only possible successful return path.
