# 📡 AFK Raiders

> A zero-player idle comedy game where an autonomous Raider deploys, loots, panics, and dies in a robot-infested wasteland — and you, their overworked Handler, can only watch the comms feed and occasionally radio bad advice.

**Genre:** Zero-player / idle / text-driven comedy sim — inspired by [Godville](https://wiki.godvillegame.com/Main_Page)  
**Parody target:** Extraction-shooter tropes (loot greed, hoarding, killer robots, "one more crate" syndrome)  
**Platforms:** Web, iOS, Android — offline-first PWA

---

## 🎮 How It Works

You are **not** the Raider. You are their Handler back in the underground hub of **Desperanza**, watching a comms feed and occasionally nudging them with your limited **Signal** resource:

| Action | Cost | Effect |
|---|---|---|
| Ready Up! | 2 Signal | HUB-only action that immediately starts deployment |
| Calm | 1 Signal | Lowers current greed before the next check |
| Pressure | 1 Signal | Raises current greed before the next check |
| CALL EXTRACT | 3 Signal | Forces an extraction attempt |

Signal regenerates ~1 per 10 minutes, capped at 5. During RAIDING, only one Handler action can be pending at a time; buttons stay locked until the next tick consumes it. The Raider still plays themselves.

The current MVP loop includes:

- **Greed Check™:** the Raider decides whether to extract or push deeper; greed affects loot appetite, risky events, and future zone-condition pressure, but DOWNED resets greed to 0.
- **Danger Levels:** each deployment gets a seeded zone condition with Low, Medium, or High danger that drives reward/risk tuning.
- **Home Stash:** successful extraction transfers backpack loot into a persistent stash, with overflow auto-sold into coins.
- **Secret Hidden Pocket:** one manually selected backpack item can survive backpack-loss failures.
- **Shields, field meds, and rechargers:** shield-aware damage, current-raid bandages, and manual-use shield rechargers give the Handler real survival levers.
- **Raider Level and skills:** long-running progression tracks successful extracts, meaningful outcomes, and four parody skill tracks: Cardio, Hoarding, Hiding in Lockers, and Signal Handling.

---

## 📖 Documentation

- [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) — game concept, core loop, Greed Check™, Signal/Handler mechanics, parody content table, roadmap
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — tech stack, folder structure, engine design, determinism rules, testing strategy
- [`docs/SERVER_STORAGE_AND_ACCOUNTS.md`](docs/SERVER_STORAGE_AND_ACCOUNTS.md) — planned account-backed save sync architecture (.NET 8+, PostgreSQL, offline-first model)
- [`docs/CI_CD_AZURE.md`](docs/CI_CD_AZURE.md) — CI pull request validation, Azure Static Web Apps deployment flow, branch protections, rollback
- [`docs/SHIELDS_PLAN.md`](docs/SHIELDS_PLAN.md) — shield-layer design notes and follow-up planning

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — a tick fires every 30 seconds. Watch the comms log.

### Other scripts

```bash
npm run build    # Production build (TypeScript check + Vite bundle)
npm run preview  # Preview the production build locally
npm test         # Run Vitest unit tests
```

PWA install prompts are browser-controlled and usually will not appear during `npm run dev`. To test installability, run `npm run build` followed by `npm run preview`, then open the preview URL in Chrome or Edge. The custom install banner appears only after the browser fires `beforeinstallprompt`; iOS/Safari uses the manual "Add to Home Screen" flow instead.

### Prototype progression profile

Skill XP pacing is configured in [`src/content/progression_config.json`](src/content/progression_config.json):

- `standard` is the normal long idle-game curve and should be active for PRs, production builds, and deploys.
- `prototype` keeps smaller thresholds for local/internal testing when fast skill level-ups are useful.

Switch only the `skillXpThresholdProfile` value when testing pacing locally, then switch it back to `standard` before merge or deploy.

---

## 🏗️ Project Structure

```
src/
├── engine/                 # Pure TypeScript — no Vue/browser imports
│   ├── tick.ts             # processTick(state, rng) → { state, events }
│   ├── raidStateMachine.ts # HUB → DEPLOYING → RAIDING → EXTRACTING/DOWNED
│   ├── greedCheck.ts       # Greed Check™ extraction/push-deeper decisions
│   ├── eventResolver.ts    # Weighted event templates + {slot} filling
│   ├── dangerLevelProfiles.ts # Low/Medium/High reward/risk tuning
│   ├── shields.ts          # Shield-aware damage and recharge rules
│   ├── skills.ts           # Parody skills and tiny modifiers
│   ├── raiderLevel.ts      # Raider Level 1-75 progression
│   ├── homeStash.ts        # Stash transfer and overflow auto-sell
│   ├── signal.ts           # Signal regen + spend rules
│   ├── catchUp.ts          # Offline catch-up
│   ├── rng.ts              # Seeded PRNG
│   └── types.ts            # Core engine types
├── content/                # Game content and deterministic balance config
│   ├── *_events.json       # HUB/deploy/raid/extract/downed event tables
│   ├── loot-tables/        # Weighted loot groups
│   ├── zones/              # Zones and seeded zone conditions
│   ├── skills.json         # Skill definitions and level-up text
│   ├── progression_config.json # Standard/prototype progression profiles
│   ├── raider_levels.json  # Raider Level titles and level-up text
│   ├── robots.json         # Robot bestiary and loot tables
│   ├── healing_items.json  # Current-raid field meds
│   ├── shield_rechargers.json # Manual-use backpack shield consumables
│   └── flavor.json         # Slot-fill tables
├── stores/
│   ├── gameStore.ts     # Engine state + tick driver
│   └── settingsStore.ts
├── composables/         # View models and interaction helpers
└── components/
    ├── CommsLog.vue       # Autoscrolling comms feed
    ├── RaiderCard.vue     # Raider stats, level, mood, shield/resilience UI
    ├── BackpackPanel.vue  # Backpack, hidden pocket, field meds, rechargers
    ├── HomeStash.vue      # Persistent extracted loot
    ├── SkillsPanel.vue    # Parody skill progress
    ├── HandlerActions.vue # Signal meter + action buttons
    └── AwaySummary.vue    # "While you were away…" banner
tests/
├── engine/                # Deterministic engine/content/balance tests
├── composables/           # View-model and Handler action tests
└── utils/
```

---

## ⚙️ Architecture principles

1. **Engine purity** — `src/engine/` is pure TypeScript with zero Vue/DOM/browser imports. Tests run in Node.
2. **Determinism** — all randomness flows through the seeded `RNG` in `rng.ts`. Same seed + state always produces the same story.
3. **Content as data** — game text lives in `src/content/*.json`; deterministic balance config also lives there when the engine must consume it.
4. **Immutable ticks** — `processTick(state, rng)` returns new state; never mutates input.
5. **Shield damage pipeline** — gameplay damage that should respect shields goes through the shared shield helper, not ad hoc HP subtraction.

---

## ⚠️ Legal

This is an original parody of extraction-shooter tropes. It does not use the ARC Raiders trademark, character names, lore, or assets. All names are original to this project. A.R.C. in our lore = **Aggressively Roaming Chassis**.
