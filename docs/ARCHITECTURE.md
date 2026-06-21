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

## PWA Installation & Offline Support

The app is configured as a fully installable Progressive Web App targeting web, iOS, and Android:

- **Web installation:** Modern browsers (Chrome, Edge, Brave) show a native install prompt after brief use. The [PWAInstallPrompt.vue](../src/components/PWAInstallPrompt.vue) component surfaces the `beforeinstallprompt` event as a dismissible banner in the UI.
- **iOS installation:** Users install via "Share → Add to Home Screen" on Safari. Requires `apple-touch-icon` meta tag, `apple-mobile-web-app-capable`, and `apple-mobile-web-app-status-bar-style` for status bar theming.
- **Android installation:** Native install prompt appears automatically after short engagement. Falls back to "Add to Home Screen" from the browser menu.

Configuration in [vite.config.ts](../vite.config.ts):
- Manifest is auto-generated with app name, theme colors, icons (192×192 and 512×512 px in `any` and `maskable` variants), app shortcuts (e.g., "Ready Up" to deploy), and screenshot support for installation UI.
- Service worker uses `registerType: 'autoUpdate'` with Workbox `generateSW`. All built assets (`**/*.{js,css,html,ico,png,svg,woff2}`) are fully precached (cache-first). SPA navigation requests are served from the cached `index.html` via `navigateFallback`, so the app works entirely offline. No network fallback is needed because AFK Raiders currently has no backend calls. **Future:** once server/network calls are introduced (e.g. leaderboards, cloud saves), add Workbox [runtime caching strategies](https://developer.chrome.com/docs/workbox/caching-strategies-overview/) in `vite.config.ts` — typically `NetworkFirst` or `StaleWhileRevalidate` for API routes and `CacheFirst` for static assets fetched from CDNs.
- Scope and start_url ensure the app launches to `/` in standalone mode.

Meta tags in [index.html](../index.html) enable iOS and desktop browser detection. Installation state is tracked in [useSettingsStore](../src/stores/settingsStore.ts) via `beforeinstallprompt` and `appinstalled` events, plus `window.matchMedia('(display-mode: standalone)')` for PWA mode detection.

## Golden rule: Engine ≠ UI
The simulation engine is **pure TypeScript with zero framework imports**. Vue renders state and dispatches the rare Handler action. The engine must run identically in Node (tests) and the browser.

## Core engine contracts
- Determinism: the same seed + state must produce the same outcomes and comms sequence.
- Single damage pipeline: all incoming HP damage must flow through shared shield-aware helpers (no ad hoc HP subtraction).
- Damage narration guarantee: whenever damage is processed by the engine (shielded, unshielded, mitigated to zero HP damage, or lethal), a readable damage flavor line must be emitted to the comms feed in that tick.

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
│   │   ├── dangerLevelProfiles.ts # Low/Medium/High risk/reward tuning
│   │   ├── robotCombat.ts       # Active multi-tick robot battle resolver
│   │   ├── weapons.ts           # Weapon catalog lookup and starter weapon state
│   │   ├── signal.ts            # Signal regen + spend rules
│   │   ├── shields.ts           # Shared shield damage + recharge rules
│   │   ├── skills.ts            # Autonomous Raider skill progression + tiny modifiers
│   │   ├── raiderLevel.ts       # Raider Level 1-75 XP curve, titles, and level-up text
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
│   │   ├── shield_rechargers.json # Manual-use backpack shield consumables
│   │   ├── skills.json          # Cardio/Hoarding/Hiding definitions and level-up text
│   │   ├── raider_levels.json   # Raider Level title bands and level-up comms text
│   │   ├── robots.json          # Anxieticks, Tattletales, Roomba Prime…
│   │   ├── weapons.json         # Original parody weapon stats for robot battles
│   │   ├── zones.json           # Damp Battlegrounds, etc.
│   │   └── flavor.json          # Hub gossip, death quips, mood lines
│   ├── stores/
│   │   ├── gameStore.ts         # Engine state + tick driver
│   │   └── settingsStore.ts
│   ├── components/
│   │   ├── CommsLog.vue         # THE star — autoscrolling feed
│   │   ├── RaiderCard.vue       # Stats, mood, Raider Level, Rat Rating
│   │   ├── BackpackPanel.vue
│   │   ├── HomeStash.vue        # Persistent stash — extracted loot, ×N stacking
│   │   ├── HandlerActions.vue   # Ready Up / Calm / Pressure / CALL EXTRACT
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

Events may also gate themselves by `requires.dangerLevel` (`Low`, `Medium`, or `High`). The danger level is determined by a seeded combination of zone selection and zone condition selection (from `src/content/zones/zone_conditions.json`). The engine applies the matching danger-level profile in `src/engine/dangerLevelProfiles.ts`: Low has lower loot value and rarity bias, Medium raises loot upside and ambient/robot/extraction pressure, and High has the highest loot ceiling with the harshest ambient pressure, robot pressure, and LZ risk. These profiles are the economy guardrail for risk/reward tuning.

Loot rarity selection also applies a small raider-mood bias in `eventResolver.ts`: positive mood nudges weights toward higher rarity and negative mood nudges toward lower rarity. The effect is intentionally mild and always secondary to danger-level profile tuning.

When an event awards backpack loot (`effects.backpackValue` producing a positive loot add), `processTick()` performs two additional independent consumable bonus rolls: one for a healing item and one for a shield recharger. This allows a single loot event to grant normal loot plus either or both consumable types.

When a shield mitigates damage, the comms feed should include a follow-up line that shows the split between shield charge lost and HP damage landed. That keeps the log readable while still reflecting the shield math.

### Home stash transfer
On every EXTRACTING → HUB transition (natural or event-forced), `processTick` merges the backpack into `state.homeStash` before the backpack resets. Duplicate item IDs stack quantities.

The stash has an enforced item cap (`HOME_STASH_ITEM_LIMIT`). Overflow items are auto-sold by lowest value first, and their value is converted to `state.coins` with a narrated `stash_overflow_sale` comms line. (Manual selling/trading is a future hub mechanic.)

`RaidState` also includes an optional manual `hiddenPocket` selection (the parody safe pocket). The UI (`BackpackPanel.vue`) explicitly sets/changes/clears this slot from current backpack items. On backpack-loss failures (DOWNED → HUB), the engine transfers exactly one unit of the selected pocket item into home stash before normal reset bookkeeping.

### Shield layer
`RaidState.shield` stores the current shield snapshot for the active raid. Shield damage rules live in `src/engine/shields.ts` so all incoming damage uses one deterministic calculation path. Negative HP event effects and failed robot encounters both route through the same helper.

Positive raider mood adds a small derived resilience bonus in `eventResolver.ts` for failed robot encounters only. It does not change robot raw damage; it slightly reduces the final HP loss after shield mitigation when mood is above zero.
The resulting shield-damage log line includes a short note when that bonus applies so the effect stays visible in the comms UI.

Robot battles are being introduced as a pure engine layer in `src/engine/robotCombat.ts`. `RaidState.activeRobotBattle` stores the current robot, HP, battle round, weapon id, and encounter damage multiplier so combat can persist across ticks. `processTick()` advances an existing active battle before resolving a normal phase event; the existing instant `resolveRobotEncounter()` path remains available for focused damage and balance tests while event start behavior migrates in smaller slices. Robot `maxHp` controls battle duration, while menace/deadliness and danger profiles continue to control threat.

Weapon content lives in `src/content/weapons.json`, with catalog helpers in `src/engine/weapons.ts`. Weapons are offensive pacing tools only: do not use them to add passive Raider toughness or flatten danger-level survival curves. The staged plan is tracked in [ROBOT_BATTLES_AND_WEAPONS_PLAN.md](./ROBOT_BATTLES_AND_WEAPONS_PLAN.md).

Shield rechargers are intentionally different from bandages:
- Bandages live in `RaidState.healingItems` and never extract.
- Shield rechargers live in `RaidState.backpack` with backpack-item metadata, are manual-use only, and extract if unused.
- HUB currently restores the equipped shield to full charge and 100% durability; loadout/store systems are the future hook for persisted shield state.
- `src/content/healing_items.json` and `src/content/shield_rechargers.json` are still required: they define weighted type selection for consumables awarded by both dedicated event effects and loot-bonus rolls.
- Damage events should remain source-first: the event text announces the encounter, then a shield summary line can explain how much shield charge was lost and how much HP damage landed.
- This is a contract, not a style preference: every processed damage instance must produce a comms damage line, even if the same tick later transitions the raider to DOWNED.

### 3. Signal as the only real input
Signal regenerates (~1 per 10 min, capped at 5). Ready Up (2 Signal) starts DEPLOYING from HUB. Calm (1 Signal, internal action ID `CALM`) reduces current greed before the next greed check and lowers extraction chance (calm raider stays in longer). Pressure (1 Signal, internal action ID `PRESSURE`) increases current greed before the next check and raises extraction chance (rattled raider wants out sooner). CALL EXTRACT (3 Signal) forces an extraction attempt. When the Raider is low on HP and has no current-raid bandages, the Greed Check adds a survival-instinct extraction bonus, but that bonus is dampened by danger level so Medium and High conditions still punish unattended raids. During RAIDING only one action may be queued at a time, so action buttons lock until the next tick applies and clears the pending action. On every HUB return, raid pressure state resets (greed 0, force-extract cleared).

### 4. Lifetime stat collection
`GameState.stats` tracks long-lived outcomes: extraction/death totals and context (zone + zone/time), robot defeats, and healing item usage.

Save migration in `gameStore.ts` backfills missing legacy stats from pre-existing `raider.extractCount` and `raider.deathCount` so historical totals remain consistent.

### 4b. Autonomous Raider skills
`GameState.raider.skills` stores persistent parody skill progress for Cardio, Hoarding, and Hiding in Lockers. Skills are raider-level state, not raid-level state, so they survive deaths, extractions, and sessions.

Skill definitions and visible level-up text live in `src/content/skills.json`. The pure engine helper in `src/engine/skills.ts` owns initial state, save normalization, seeded practice rolls, level thresholds, and small modifier derivation. `processTick()` records explicit practice triggers from existing simulation outcomes, then applies XP before appending the tick log so level-up comms land in the same tick that earned them.

The Handler never spends skill points. Skill power should stay subtle and inspectable:
- Cardio nudges extraction chance and greed-death safety.
- Hoarding nudges loot value and bonus consumable find chance.
- Hiding in Lockers trims failed robot encounter damage before shield-aware damage is applied, with damage narration showing the reduction when it matters.

Save migration must preserve compatible local saves. Version 3 saves are upgraded to the current save version by backfilling initialized skill state rather than being discarded.

### 4c. Raider Level
`GameState.raider.levelXp` stores cumulative Raider Level XP. The current level is derived by `src/engine/raiderLevel.ts`, starts at 1, and caps at 75. The save never stores a separate level number, which prevents XP/level drift during migration or catch-up. The XP curve is intentionally long: Level 2 requires multiple meaningful outcomes rather than one lucky extraction, and the Level 75 cap requires hundreds of thousands of cumulative XP so automatic/offline play does not burn through progression quickly.

Raider Level is the long-term career spine, separate from both Rat Rating and the three skill tracks:
- Rat Rating remains an unbounded cowardly/looty shame-pride score.
- Skills are specific bad habits that level 1-5 and provide tiny modifiers.
- Raider Level summarizes broad accumulated field experience and title-band status.

`processTick()` queues Raider XP from meaningful autonomous outcomes: successful extraction, extracted loot value/quantity, robot defeat or survival, High-danger survival, close-call extraction, hidden-pocket saves, stash overflow, death recovery, failed extraction, and skill level-ups. XP rolls use the seeded RNG, and level-up comms are emitted before the final log append. If multiple levels are crossed in one tick or offline catch-up step, the engine emits a single compact level-up line for the highest crossed level to avoid log spam.

Routine XP awards stay small by design. Normal loot finds are a trickle, death recovery is a consolation prize, and the biggest repeatable gains come from successful extractions with meaningful loot. Danger, close calls, robots, hidden-pocket saves, and skill level-ups add flavor-weighted bonuses without turning Raider Level into a fast grind.

Raider Level benefits are intentionally light-power and title-band based:
- Levels 1-9: title/progress only, no stipend.
- Levels 10-18: +1 coin extraction stipend.
- Levels 19-27: +2 coin extraction stipend.
- Levels 28-36: +3 coin extraction stipend.
- Levels 37-45: +4 coin extraction stipend.
- Levels 46-54: +5 coin extraction stipend.
- Levels 55-63: +6 coin extraction stipend.
- Levels 64-70: +7 coin extraction stipend.
- Levels 71-75: +8 coin extraction stipend.

The stipend is paid only on successful extraction and is narrated with `raider_level_extraction_stipend`. Levels deliberately do not add HP, raw damage, or major extraction safety; skills and danger-level profiles remain the mechanical tuning levers. Future content can use Raider Level for title-gated comms variants, hub gags, achievements, or prestige requirements.

### 4d. Balance guardrails
Raid balance is guarded as an engine contract, not just a table of current constants. `tests/engine/raidBalance.test.ts` runs seeded starter-raider simulations across Low, Medium, and High danger and asserts the shape we want:
- Low danger remains extractable often enough for the idle comedy loop.
- Medium danger downs starter raiders frequently when the Handler does not intervene.
- High danger is deadlier than Medium and should feel like a manual-intervention zone.

The same test file also protects the tuning hierarchy. Danger-level profiles must stay monotonic: loot upside, ambient RAIDING downed pressure, robot encounter pressure, robot failure damage, and extraction risk all rise from Low to Medium to High, while safe extraction weighting falls. Skill and Raider Level benefits are capped so progression never flattens that curve; Raider Level remains title/stipend progression, and max skill mitigation still leaves High-danger robot failures harsher than Medium.

When changing robot weights, danger profiles, greed/extraction math, healing, shields, or progression modifiers, update the tests only if the new design intentionally changes these contracts. Handler survivability should be proven through explicit intervention paths such as manual healing, shield recharger use, and CALL EXTRACT rather than by making autonomous High-danger raids broadly safe.

Robot balance has its own focused guardrail in `tests/engine/robotBalance.test.ts`. It forces failed combat rolls against the real `robots.json` entries and verifies the tier math directly: max failed damage rises by deadliness tier, nasty/deadly robots can kill wounded starter raiders, weak/moderate/dangerous robots remain nonlethal, Raider Level does not passively reduce robot damage, and existing mitigation sources help without making High-danger robot damage softer than Medium baseline.

Do not add passive Raider Level damage resistance for the MVP. That would make the broad level spine behave like a hidden combat stat and would flatten the danger curve. Keep resistance simple: positive mood already provides the soft resilience trim, Hiding in Lockers is the tiny skill-specific robot mitigation, and shields/consumables/Handler actions are the meaningful survival levers.

Visible Raider Level title bands and level-up text live in `src/content/raider_levels.json`. The first UI surface is `RaiderCard.vue`, which shows the derived level, title, progress to next level, and current stipend benefit while keeping Rat Rating visible as its own row.

Save migration upgrades older saves to version 5 by backfilling missing `levelXp`. Legacy profiles receive a small deterministic XP estimate from extracts, deaths, and deploys, not from raw Rat Rating.

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
- One raider, one zone pool, Ready Up/Calm/Pressure/CALL EXTRACT, offline catch-up, PWA installability.
- localStorage persistence with a schema `version` field for future migrations.

## Planned account-backed save phase
- Future server-side account/save work is documented in [`docs/SERVER_STORAGE_AND_ACCOUNTS.md`](./SERVER_STORAGE_AND_ACCOUNTS.md).
- Scope for that phase remains offline-first: local simulation stays authoritative while offline, with remote sync when signed in and online.
- Backend target for that phase is .NET 8+ with PostgreSQL and revision-based conflict handling.
