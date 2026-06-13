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
│   │   ├── raidStateMachine.ts  # HUB → DEPLOY → RAID → EXTRACT/DOWNED
│   │   ├── greedCheck.ts        # The signature mechanic
│   │   ├── eventResolver.ts     # Weighted event tables by context
│   │   └── catchUp.ts           # Fast-forward elapsed ticks on app open
│   ├── content/                 # The comedy lives here, as data
│   │   ├── hub_events.json      # Desperanza rest & prep (≤5 min)
│   │   ├── deployment_events.json # One-person tunnel pod ride (60 s)
│   │   ├── raiding_events.json  # Looting, robots, greed (≤30 min)
│   │   ├── extraction_events.json # LZ drama: failed/early extractions, ambushes
│   │   ├── downed_events.json   # Death quips
│   │   ├── loot.json            # 47 varieties of water bottle
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
│   │   ├── HandlerActions.vue   # Encourage / Scold / Signal meter
│   │   ├── HubView.vue
│   │   └── RaidView.vue
│   └── App.vue
└── tests/engine/                # Snapshot sims: seed X → identical story
```

## Design decisions

### 1. Seeded, deterministic ticks
- Save format: `{ state, seed, lastTickAt }` (JSON in localStorage).
- Tick cadence: one event roughly every 30–90 seconds of real time.
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

Events may also set `"effects": { "forcePhase": "..." }` to force a phase change. This powers `extraction_events.json`: during the EXTRACTING window (~45s extraction + a final tick to call the return shuttle, 4 ticks total) events can make extraction fail (`forcePhase: "RAIDING"` — backpack kept), succeed early (`forcePhase: "HUB"` — loot transferred to the home stash), or end in tragedy (`forcePhase: "DOWNED"` — bag lost).

### Home stash transfer
On every EXTRACTING → HUB transition (natural or event-forced), `processTick` merges the backpack into `state.homeStash` before the backpack resets. Duplicate item IDs stack quantities; the stash only ever shrinks via a future sell mechanic.

### 3. Signal as the only real input
Signal regenerates (~1 per 10 min, capped 3–5). Encourage/Scold nudge hidden behavior weights; CALL EXTRACT (3 Signal) forces an extraction attempt. The UI exposes nothing else that affects the sim.

### 4. State updates are immutable-style
`processTick(state, rng)` returns `{ state: GameState, events: LogEvent[] }` without mutating its input. This keeps Pinia reactivity simple, enables snapshot tests, and makes catch-up a pure fold over ticks.

## Testing strategy
- **Engine unit tests (Vitest):** given a fixed seed and starting state, assert the exact event sequence (snapshot tests).
- **Content validation tests:** every template's `{slots}` must resolve against content tables; weights must be positive; IDs unique.
- **Catch-up tests:** N elapsed hours → expected tick count, capped correctly.

## MVP boundaries (phase 1)
- Fully client-side; no network calls, no accounts, no telemetry.
- One raider, one zone, Encourage/Scold/CALL EXTRACT, offline catch-up, PWA installability.
- localStorage persistence with a schema `version` field for future migrations.
