# 📡 AFK Raiders

> A zero-player idle comedy game where an autonomous Raider deploys, loots, panics, and dies in a robot-infested wasteland — and you, their overworked Handler, can only watch the comms feed and occasionally radio bad advice.

**Genre:** Zero-player / idle / text-driven comedy sim — inspired by [Godville](https://wiki.godvillegame.com/Main_Page)  
**Parody target:** Extraction-shooter tropes (loot greed, hoarding, killer robots, "one more crate" syndrome)  
**Platforms:** Web, iOS, Android — offline-first PWA

---

## 🎮 How it works

You are **not** the Raider. You are their Handler back in the underground hub of **Desperanza**, watching a comms feed and occasionally nudging them with your limited **Signal** resource:

| Action | Cost | Effect |
|---|---|---|
| 📣 Encourage | 1 📶 | Nudges Raider toward boldness (more greed, more loot, more risk) |
| 🔇 Scold | 1 📶 | Nudges Raider toward caution (more likely to extract safely) |
| 🚨 CALL EXTRACT | 3 📶 | Forces an extraction attempt next tick |

Signal regenerates ~1 per 10 minutes, capped at 5. The Raider plays themselves.

---

## 📖 Documentation

- [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) — game concept, core loop, Greed Check™, Signal/Handler mechanics, parody content table, roadmap
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — tech stack, folder structure, engine design, determinism rules, testing strategy
- [`docs/CI_CD_AZURE.md`](docs/CI_CD_AZURE.md) — CI pull request validation, Azure Static Web Apps deployment flow, branch protections, rollback

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — a tick fires every 5 seconds in dev mode. Watch the comms log.

### Other scripts

```bash
npm run build    # Production build (TypeScript check + Vite bundle)
npm run preview  # Preview the production build locally
npm test         # Run engine unit tests (Vitest, runs in Node — no DOM needed)
```

---

## 🏗️ Project Structure

```
src/
├── engine/          # Pure TypeScript — no Vue/browser imports
│   ├── rng.ts       # Seeded mulberry32 PRNG
│   ├── types.ts     # Core types (GameState, LogEvent, …)
│   ├── tick.ts      # processTick(state, rng) → { state, events }
│   ├── raidStateMachine.ts  # HUB → DEPLOYING → RAIDING → EXTRACTING/DOWNED → HUB
│   ├── greedCheck.ts        # The Greed Check™
│   ├── eventResolver.ts     # Weighted event templates + {slot} filling
│   ├── catchUp.ts           # Offline catch-up (8 h cap)
│   ├── signal.ts            # Signal meter logic
│   └── initialState.ts      # Fresh GameState factory
├── content/         # All game text as data (never hardcoded in TS)
│   ├── events.json  # ~20 weighted event templates with {slot} placeholders
│   ├── loot.json    # 12 loot items (several water bottle variants)
│   ├── robots.json  # Anxieticks, Tattletales, Roomba Prime
│   ├── zones.json   # Damp Battlegrounds
│   └── flavor.json  # Slot-fill tables: gossip, death quips, hoarder justifications…
├── stores/
│   ├── gameStore.ts     # Engine state + tick driver + Handler actions
│   └── settingsStore.ts
└── components/
    ├── CommsLog.vue       # Autoscrolling comms feed — the star of the show
    ├── RaiderCard.vue     # Name, HP, mood, Rat Rating, phase badge
    ├── BackpackPanel.vue  # Backpack value + greed level indicator
    ├── HandlerActions.vue # Signal meter + action buttons
    └── AwaySummary.vue    # Dismissible "While you were away…" banner
tests/engine/        # Vitest unit tests (engine purity enforced)
```

---

## ⚙️ Architecture principles

1. **Engine purity** — `src/engine/` is pure TypeScript with zero Vue/DOM/browser imports. Tests run in Node.
2. **Determinism** — all randomness flows through the seeded `RNG` in `rng.ts`. Same seed + state always produces the same story.
3. **Content as data** — all game text lives in `src/content/*.json`. Writing jokes never touches TypeScript.
4. **Immutable ticks** — `processTick(state, rng)` returns new state; never mutates input.

---

## ⚠️ Legal

This is an original parody of extraction-shooter tropes. It does not use the ARC Raiders trademark, character names, lore, or assets. All names are original to this project. A.R.C. in our lore = **Aggressively Roaming Chassis**.
