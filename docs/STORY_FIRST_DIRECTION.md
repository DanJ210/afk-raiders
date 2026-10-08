# AFK Raiders — Story-First Direction Plan

> Status: proposal / decision doc. Written in response to the concern: *"I meant for this to be a parody story of the life of a Raider, with the flow of Godville — an auto-story. Did I take this in the wrong direction?"*

## 1. Honest assessment: how wrong is the current direction?

**Short answer: the foundation is right; the emphasis drifted.** Nothing needs to be thrown away.

### What is already exactly right for a Godville-like
- Autonomous Raider, zero-player input, tiny Signal influence — that *is* the Godville formula.
- Deterministic seeded engine + content-as-data means the game is already a text-story generator.
- "The comms log IS the product" is already the project's stated north star.
- Godville itself is **not AI-driven** — it is a huge library of templated text over a trivially simple simulation, plus a persistent character with a voice.

### What drifted
Recent investment went deep on **simulation mechanics** (shield charge/durability math, robot combat rounds, danger-level profiles, greed suppression curves, loadout economy) while the **story layer stayed shallow**:

- Comms events are disconnected one-liners with no memory of each other. The log reads like *tactical telemetry*, not *the life of a Raider*.
- The Raider has stats but no identity: no name the log uses, no personality, no goals, no history it references, no relationships, no running gags that build.
- Nothing spans raids narratively. Lifetime stats exist as numbers, but the story never says "that's the third time Roomba Prime has gotten you."

Godville's ratio is the opposite: **simple mechanics, extremely rich narrative continuity.** The fix is a re-weighting, not a pivot.

## 2. The vision, restated (the continuous life loop)

The product is an **auto-biography**: the ongoing, absurd life story of one specific Raider, told through their comms diary.

A new Raider starts in **Desperanza** and lives a mock parody life on a continuous rhythm:

1. **Live in Desperanza** — trade at the Pawn Desk, sleep on a cot, recharge, repair gear, argue about lettuce custody, get stamped by the Security Stamp Maze.
2. **Deploy** through the Hatch Authority and Tube Routes to one of many zones, each with a seeded condition.
3. **Raid** — parody interactions with that zone's *specific environment*: flooded footing in the Damp Battlegrounds, tombstone buildings in the Buried City, retired safety signage in the Chassis Graveyard.
4. **Extract (or don't)** and return to Desperanza, where the loot, injuries, and shame feed the next chapter of hub life.
5. Repeat, forever. Raids are episodes; Desperanza is the sitcom set between them.

Mechanics are the skeleton the story hangs on — they generate *events*; the story layer turns events into *narrative*. A reader should be able to scroll the diary and feel: this is a *person* (a dumb, greedy, lovable person), with a past, a nemesis, an impossible dream, a hometown, and a water bottle problem.

**Most of this loop already runs.** HUB → DEPLOYING → RAIDING → HUB is the engine's lifecycle, and the lore wiki already defines Desperanza's infrastructure ([desperanza.md](lore/entities/desperanza.md)), traders, and seven zones. What is missing is *texture density* at both ends of the loop: Desperanza life is mostly silent menus, and zones mostly share one generic event pool.

## 3. Gap analysis — what "the life of a Raider" needs

| Missing piece | What it means | What already exists to build on |
|---|---|---|
| **Character identity** | A generated/chosen name, 2–3 personality traits (e.g. `coward`, `hoarder`, `optimist`, `drama_magnet`) that bias which flavor lines fire and add trait-specific lines | `eventResolver` already gates/weights by `dangerLevel`, `zone`, `zoneCondition`, `minGreed` — traits are just one more `requires`/weight axis |
| **Diary voice** | First-person-ish prose with attitude, not status reports. "Found 3x Bandage" → "Found bandages in a pouch labeled PROBABLY CLEAN. Taking medical advice from a pouch now. New low." (some content already does this — make it the standard) | Existing `{slot}` template system; flavor tables in `src/content/flavor.json` |
| **Callbacks & continuity** | Events that reference past events: repeated deaths to the same robot, the 40th water bottle, the zone they always die in | `GameState.stats` already tracks robot defeats, deaths `byZone`, healing usage — it's just never *narrated* |
| **Arcs / chapters** | Multi-raid storylines with named beats: a nemesis robot grudge, "save 500 coins for a bunk with a door", a vending machine friendship | Quests are already in the GDD (§6) and data model (§7) but unbuilt — arcs are quests with narrative beats |
| **Desperanza life** | The hub is where the Raider *lives*: narrated autonomous hub activities (sleeping, trading, repairing, recharging, gossip, ration lines) instead of a silent waiting phase. Prep economy actions (buy/repair/stage) should also *narrate* — the Pawn Desk clerk should have opinions about what the Raider just sold | `hub_events.json` exists; HUB lasts up to 20 ticks; [desperanza.md](lore/entities/desperanza.md) defines nine infrastructure systems with event-id seeds; [traders.md](lore/entities/traders.md) defines desk personalities |
| **Zone identity** | Each zone should feel like a different episode: zone-specific environment interactions (wet socks and ambush puddles in Damp Battlegrounds, sand-swallowed storefronts in Buried City, unstampable silence in The Breach, tactical picnics in The Staycation Celebration) rather than one shared generic pool | `requires.zone` gating already works (a few events use it); `zones.json` descriptions and [zones.md](lore/entities/zones.md) lore define each zone's comedy premise — it just needs dedicated event pools per zone |
| **Milestone narration** | Lifetime firsts and records announced with ceremony: first extract, 10th death, first `deadly` robot survived | Stats + skill level-up narration pattern already exists |

## 4. AI: recommendation

Three options, evaluated against the project's hard rules (engine purity, determinism, fully client-side MVP):

| Approach | Verdict |
|---|---|
| **No AI** (hand-write everything, Godville-style) | Viable but slow. Content volume is the bottleneck for a story-first game. |
| **Build-time AI** — use an LLM *offline* to draft diary lines, trait variants, arc beats → human-review for tone & legal-distinctness → commit as JSON | **Recommended.** AI-scale writing volume, zero runtime cost, deterministic, no backend, no moderation risk, no architecture change. The existing content guardrail tests (`tests/engine/content.test.ts`) already police the output. |
| **Runtime AI narration** — LLM rewrites/narrates events live | **Defer.** Breaks determinism, requires a backend + API keys + per-player cost, conflicts with the client-side MVP rule. Revisit post-MVP as an optional "premium narrator" that *re-tells* engine-authored events (engine stays source of truth). |

Practical build-time workflow:
1. Write a **voice bible** (short doc: the Raider's tone, trait voices, banned constructions, legal guardrails).
2. Prompt an LLM with the voice bible + event schema + existing examples → generate candidate lines in the exact JSON template format.
3. Human review pass (tone, humor, no source-game terms).
4. Commit; guardrail tests validate IDs, slots, and prohibited terms as they already do.

## 5. Phased plan (everything reuses the existing engine)

### Phase A — Raider identity (small, high leverage)
- Generated Raider name (seeded, from name-part tables in content JSON); the diary uses it.
- 2–3 personality traits on `Raider`, rolled at creation (and re-rolled by The Wipe later).
- Event templates gain optional `requires.traits` / trait-based weight multipliers in `eventResolver` — same pattern as existing gates.
- Seed each trait with ~15–20 dedicated diary lines.
- Save migration: backfill name + traits for existing saves.

### Phase B — Desperanza life & zone identity (make the loop's places real)
- **Hub life activities:** narrated autonomous HUB happenings drawn from the Desperanza infrastructure systems — cot naps, ration-line drama, Pawn Desk haggling, repair-bench commentary, Security Stamp Maze friction. These can reuse the existing multi-tick activity pattern (a HUB-scoped analog of SEARCH) or stay as richer weighted diary events; start with events, promote to activities only if progress bars add comedy.
- **Narrated prep economy:** when the player buys/repairs/stages gear, emit a diary line with desk personality (traders.md voices) so menu actions become story beats.
- **Zone event pools:** a dedicated `requires.zone` event file or section per zone (~10–15 environment-interaction lines each) built from each zone's comedy premise, plus zone-condition crossover lines (Acid Rain in the Sunken Highrise reads differently than in Forgotten Fields).
- No engine changes required for most of this — it is content volume aimed where the loop is thinnest.

### Phase C — Continuity & callbacks (turn stats into story)
- A small pure `narrator` module in `src/engine/` that inspects `GameState.stats` + raid outcome and can emit callback events: repeat-death grudges, milestone firsts, zone reputations, water-bottle-count jokes.
- Nemesis mechanic: the robot that has downed the Raider most becomes `nemesisRobotId`; encounter and hub events can reference it via a context slot (same pattern as `{robot_name}`).
- Zone reputation: deaths/extracts `byZone` already exist — narrate them ("back to the Sunken Highrise, where you have died four times; the building seems pleased").
- Milestone narration table in content JSON (first extract, Nth death, stash records).

### Phase D — Arcs / chapters (the Godville quest layer)
- `Arc` state on `GameState`: id, current beat, progress counters. Arcs defined in `src/content/arcs/*.json` as beat sequences with `requires` gates and completion conditions fed by real engine outcomes (extract counts, coins, robot defeats).
- Ship 3–5 launch arcs: a nemesis grudge arc, a savings goal ("a bunk with a door"), a vending-machine friendship, a hoarding intervention, a Desperanza bureaucracy saga (the missing stamp).
- Arcs emit `priority` comms at beat transitions; ambient arc-flavored lines while active.
- This *is* the GDD §6 "Quests" feature, built story-first.

### Phase E — Content volume via build-time AI
- Voice bible + generation workflow (see §4).
- Target: 3–5× current diary line volume, trait-variant coverage, HUB life texture pool.
- Optional later: runtime AI narrator experiment behind a flag, post-MVP, opt-in.

### What to pause (not delete)
- New combat/economy systems (weapon tiers beyond current, shield persistence loops, store depth). They work; they're not the bottleneck. Resume after the story layer catches up.

## 6. What NOT to do
- Do **not** rewrite the engine or abandon determinism — it is the story generator.
- Do **not** delete shields/robots/greed — demote them to skeleton; narrate them better.
- Do **not** start with runtime AI — it's the most expensive path to the same reader experience.
- Do **not** treat this as a restart. The continuous life loop (Desperanza → deploy → zone raid → extract → Desperanza) already runs in the engine — the work is making the places and the person *felt*, mostly through content. Phase A alone (name + traits + trait lines) should make the log feel like a *person* within one small PR.

## 7. Success test
Same bar as the roadmap already says: **ship when the logs alone make people laugh** — amended to: *ship when someone who reads a week of one Raider's diary can describe that Raider's personality without being told.*
