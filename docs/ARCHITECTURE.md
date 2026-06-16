# AFK Raiders — Architecture

## Stack
| Layer | Choice | Why |
|---|---|---|
| Framework | Vue 3 + TypeScript + Vite | Composition API suits a tick-driven UI |
| State | Pinia | Bridges engine ↔ UI cleanly; devtools support |
| Utilities | VueUse | `useIntervalFn` (tick loop), `useDocumentVisibility` (pause/catch-up), `useLocalStorage` |
| PWA | vite-plugin-pwa | Installable on web/iOS/Android from day one |
| Persistence | localStorage (MVP) | State is small; migrate to IndexedDB (localForage) when the log grows |
| Testing | Vitest | Deterministic engine → trivial to unit test |
| Later | Capacitor | Store distribution + native push, no rewrite |

## Golden rule: Engine ≠ UI
The simulation engine is **pure TypeScript with zero framework imports**. Vue renders state and dispatches the rare Handler action. The engine must run identically in Node (tests) and the browser.

## Folder structure
```
afk-raiders/
├── src/
│   ├── engine/                  # Pure TS, no framework imports
│   │   ├── rng.ts               # Seeded RNG (mulberry32) — determinism
│   │   ├── tick.ts              # processTick(state, rng) → { state, events }
│   │   ├── raidStateMachine.ts  # HUB → DEPLOYING → RAIDING → EXTRACTING/DOWNED
│   │   ├── greedCheck.ts        # The signature mechanic
│   │   ├── eventResolver.ts     # Weighted event tables by context
│   │   ├── timeProfiles.ts      # Day/Night/Stella Red risk/reward tuning
│   │   ├── signal.ts            # Signal regen + spend rules
│   │   ├── homeStash.ts         # Stash transfer and overflow auto-sell
│   │   ├── stats.ts             # Lifetime stat aggregation helpers
│   │   ├── log.ts               # Centralized log append/capping
│   │   └── catchUp.ts           # Fast-forward elapsed ticks on app open
│   ├── content/                 # The comedy lives here, as data
│   │   ├── hub_events.json      # Desperanza rest & prep (≤5 min)
│   │   ├── deployment_events.json # One-person tunnel pod ride (2 min)
│   │   ├── raiding_events.json  # Looting, robots, greed (≤30 min + nuke risk)
│   │   ├── extraction_events.json # LZ drama: failed/early extractions, ambushes
│   │   ├── downed_events.json   # Death quips
│   │   ├── loot.json            # Many varieties of original comedy/parody loot items
│   │   ├── healing_items.json   # Current-raid-only bandages
│   │   ├── robots.json          # Anxieticks, Tattletales, Roomba Prime…
│   │   ├── zones.json           # Damp Battlegrounds, etc.
│   │   └── flavor.json          # Hub gossip, death quips, mood lines
│   ├── stores/
│   │   ├── gameStore.ts         # Engine state + tick driver
│   │   └── settingsStore.ts
│   ├── components/
│   │   ├── CommsLog.vue         # THE star — autoscrolling feed
│   │   ├── RaiderCard.vue       # Stats, mood, Rat Rating
│   │   ├── BackpackPanel.vue
│   │   ├── HomeStash.vue        # Persistent stash — extracted loot, ×N stacking
│   │   ├── HandlerActions.vue   # Ready Up / Encourage / Scold / CALL EXTRACT
│   │   └── AwaySummary.vue
│   └── App.vue
└── tests/engine/                # Snapshot sims: seed X → identical story
```

## Design decisions

### 1. Seeded, deterministic ticks
- Save format: `{ state, seed, lastTickAt }` (JSON in localStorage).
- Tick cadence: one event every 30 seconds of real time.
- On load, `catchUp()` replays elapsed ticks — **capped at ~8 hours** — then shows a "While you were away…" summary (e.g., "your raider died twice and befriended a vending machine").
- Determinism makes catch-up cheap, bugs reproducible, and save-scumming pointless.
- All engine randomness flows through the seeded RNG. `Math.random()` is banned in `src/engine/`.

### 2. Content as weighted template tables
Events are picked by context (zone, greed level, mood, HP) and fill `{slot}` placeholders from content tables:
```json
{
  "id": "loot_mundane",
  "weight": 30,
  "requires": { "phase": "RAIDING" },
  "text": "Found {mundane_item}. {hoarder_justification}",
  "effects": { "backpackValue": "+1d6", "mood": "+1" }
}
```
Writing jokes never touches engine code — and this is the future community-content pipeline.

Events may also set `"effects": { "forcePhase": "..." }` to force a phase change. This powers `extraction_events.json`: during the EXTRACTING window (~90s extraction + a final tick to call the return shuttle, 4 ticks total) events can make extraction fail (`forcePhase: "RAIDING"` — backpack kept), succeed early (`forcePhase: "HUB"` — loot transferred to the home stash), or end in tragedy (`forcePhase: "DOWNED"` — bag lost).

Events may also gate themselves by `requires.timeOfDay` (`Day`, `Night`, or `Stella Red`). The engine applies the matching time-of-day profile in `src/engine/timeProfiles.ts`: Day has lower loot value and rarity bias, Night raises loot upside and robot/extraction pressure, and Stella Red has the highest loot ceiling with the harshest robot and LZ risk. These profiles are the economy guardrail for risk/reward tuning.

### Home stash transfer
On every EXTRACTING → HUB transition (natural or event-forced), `processTick` merges the backpack into `state.homeStash` before the backpack resets. Duplicate item IDs stack quantities.

The stash has an enforced item cap (`HOME_STASH_ITEM_LIMIT`). Overflow items are auto-sold by lowest value first, and their value is converted to `state.coins` with a narrated `stash_overflow_sale` comms line. (Manual selling/trading is a future hub mechanic.)

`RaidState` also includes an optional manual `hiddenPocket` selection (the parody safe pocket). The UI (`BackpackPanel.vue`) explicitly sets/changes/clears this slot from current backpack items. On backpack-loss failures (DOWNED → HUB), the engine transfers exactly one unit of the selected pocket item into home stash before normal reset bookkeeping.

### 3. Signal as the only real input
Signal regenerates (~1 per 10 min, capped at 5). Ready Up (2 Signal) starts DEPLOYING from HUB, Encourage/Scold (1 each) nudge hidden behavior weights, and Scold also reduces current greed before the next greed check; CALL EXTRACT (3 Signal) forces an extraction attempt. During RAIDING only one action may be queued at a time, so action buttons lock until the next tick applies the pending action.

### 4. Lifetime stat collection
`GameState.stats` tracks long-lived outcomes: extraction/death totals and context (zone + zone/time), robot defeats, and healing item usage.

Save migration in `gameStore.ts` backfills missing legacy stats from pre-existing `raider.extractCount` and `raider.deathCount` so historical totals remain consistent.

### 5. Phase timings and failure states
- Tick cadence remains 30 seconds.
- `HUB`: 20 ticks (10 minutes)
- `DEPLOYING`: 4 ticks (2 minutes)
- `RAIDING`: 60 ticks (30 minutes)
- `EXTRACTING`: 4 ticks (~2 minutes)
- `DOWNED`: 2 ticks

When RAIDING time expires without extraction, the next natural transition is DOWNED (zone nuke failure), not EXTRACTING.

### 6. State updates are immutable-style
`processTick(state, rng)` returns `{ state: GameState, events: LogEvent[] }` without mutating its input. This keeps Pinia reactivity simple, enables snapshot tests, and makes catch-up a pure fold over ticks.

### 7. Phase timings and timeout behavior
- Tick cadence remains 30 seconds.
- `HUB`: 20 ticks (10 minutes)
- `DEPLOYING`: 4 ticks (2 minutes)
- `RAIDING`: 60 ticks (30 minutes)
- `EXTRACTING`: 4 ticks (~2 minutes)
- `DOWNED`: 2 ticks

If RAIDING time expires without extracting, natural transition goes to DOWNED (zone nuke failure), not EXTRACTING.

## Testing strategy
- **Engine unit tests (Vitest):** given a fixed seed and starting state, assert the exact event sequence (snapshot tests).
- **Content validation tests:** every template's `{slots}` must resolve against content tables; weights must be positive; IDs unique.
- **Catch-up tests:** N elapsed hours → expected tick count, capped correctly.

## MVP boundaries (phase 1)
- Fully client-side; no network calls, no accounts, no telemetry.
- One raider, one zone pool, Ready Up/Encourage/Scold/CALL EXTRACT, offline catch-up, PWA installability.
- localStorage persistence with a schema `version` field for future migrations.

