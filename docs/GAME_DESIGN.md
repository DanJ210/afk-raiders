# AFK Raiders — Game Design Document

> A zero-player comedy idle game where an autonomous Raider loots, panics, and dies in a robot-infested wasteland — and you, their overworked Handler, can only watch the comms feed and occasionally radio bad advice.

- **Genre:** Zero-player / idle / text-driven comedy sim — inspired by [Godville](https://wiki.godvillegame.com/Main_Page)
- **Parody target:** Extraction-shooter tropes (loot greed, extraction camping, hoarding, killer robots)
- **Platforms:** Web, iOS, Android — one codebase, offline-first PWA; Capacitor wrappers in a later phase
- **MVP scope:** Fully client-side, no backend

---

## 1. The Pitch
You are **not** the raider. You are their Handler back in the underground hub, watching a comms feed, occasionally nudging them, and mostly witnessing their terrible decisions. The Raider plays themselves: deploys topside, loots garbage, panics at robots, befriends vending machines, and dies hilariously — or extracts triumphantly with a backpack full of water bottles.

## 2. Core Loop
1. **Prep phase (hub):** Raider sells loot, buys questionable gear, eats expired MREs, gossips with NPCs.
2. **Deploy:** Raider autonomously picks a zone and a seeded **zone condition** (for example Light Fog, Acid Rain, Robot Surge). Greed carried over from the last raid nudges whether the next condition comes from the minor or major condition pool.
3. **Raid events:** Loot finds, robot encounters, weather, meeting other AI raiders (alliance → inevitable betrayal). The selected condition sets a `dangerLevel` (Low/Medium/High), which then drives the danger-level profile for both upside (loot value/rarity) and risk (ambient downed pressure, robot pressure, extraction danger).
   - Raider **mood** now provides a tiny secondary bias to loot quality: positive mood slightly improves higher-rarity odds, while negative mood slightly favors lower-rarity outcomes. Greed adds a second small loot-appetite bias toward higher-rarity finds.
4. **The Greed Check™ (signature mechanic):** Every tick in active RAIDING, the Raider rolls to start extracting *or* keep looting. Natural extraction is locked out for roughly the first half of RAIDING (30 ticks / 15 minutes by default) so the raider cannot immediately bail after deployment; CALL EXTRACT bypasses this. **Greed rises slowly when the Raider keeps pushing deeper**, can jump from specific raiding/extraction-condition events, and is modified by Handler actions (Calm lowers it, Pressure raises it). Higher greed does not directly lower extraction chance; instead it nudges rare loot odds, makes risky robot/extraction events more likely, and decays into major-condition momentum after successful returns. Failed raids that reach KNOCKED_OUT reset greed to 0. Pure dramatic tension, zero input required — the Handler can only nudge via Signal actions.
5. **Extract or get knocked out:** Extraction is a timed condition layered on RAIDING, not a separate phase. During that window **extraction events** can fire — the shuttle may arrive early, the beacon may get jammed and clear the extracting condition, or the raider may get DOWNED at the LZ. DOWNED is also a RAIDING condition: the raider is incapacitated, normal events/actions stop, and a short revive timer starts. If extraction completes before the DOWNED timer expires, the raid succeeds and returns straight to HUB. If the DOWNED timer expires first, the raid transitions to KNOCKED_OUT, then briefly resets to HUB with a sheepish wake-up log entry.

### RAIDING Conditions: DOWNED and EXTRACTING
`RAIDING` is the field phase. `DOWNED` and `EXTRACTING` are timed conditions that can overlap during RAIDING:
- **EXTRACTING** is the only successful way to leave a raid. When it completes, the raid transitions `RAIDING → HUB` and the backpack transfers into Home Stash.
- **DOWNED** means the raider is still in the raid but unable to perform normal actions. Normal raiding/extraction events pause unless a comms event explicitly requires the DOWNED condition.
- If DOWNED and EXTRACTING overlap, the timers race. Extraction completing first is a successful return; the DOWNED timer expiring first transitions `RAIDING → KNOCKED_OUT`.
- **KNOCKED_OUT** is the short recovery/reset phase after failed revival or raid-timeout loss. `KNOCKED_OUT → HUB` performs failed-raid bookkeeping.

### The Home Stash
Loot that makes it home goes into the **Stash** — a persistent collection that survives raids, deaths, and sessions:
- On successful extraction the raider's backpack is transferred into the stash.
- The stash has a hard cap of 120 total items (quantity counts).
- Overflow is auto-sold by lowest value first and credited as coins (value is never deleted).
- Duplicate items stack with a ×N quantity multiplier, and their displayed value is multiplied accordingly.
- The in-raid backpack resets if the raider dies or fails to extract — the stash is untouched.

### Secret Hidden Pocket (parody safe pocket)
The Raider has one manual **Secret Hidden Pocket** slot per raid:
- The player must manually pick an item from the current raid backpack; it is never auto-assigned.
- The slot can be changed or cleared at any time during the active raid.
- On failed raids that clear the backpack (KNOCKED_OUT recovery into HUB), exactly one unit of the selected item is transferred safely to Home Stash.
- On successful extraction, normal extraction transfer already keeps everything, so the pocket provides no extra duplicate item.

### Shields
The Raider now starts each raid with a basic **Makeshift Confidence Shield** layered on top of the normal health system:
- Shields mitigate incoming damage while they still have both charge and durability.
- Shields are not extra HP; they reduce the HP damage taken from a hit while spending shield charge.
- Shield durability wears down as shield charge is spent.
- When a shield soaks part of a hit, the comms feed shows both the shield loss and the remaining HP damage so the mitigation is visible.
- For the MVP, returning to the HUB restores the starter shield to full charge and durability.
- In future phases, a loadout and store loop can decide which shield is equipped and how it persists.

### Resilience
Mood also feeds a small hidden **resilience** bonus against robot damage:
- Positive mood slightly reduces failed-robot damage before shield mitigation.
- Mood at or below zero gives no resilience bonus.
- Robots still roll and hit for the same raw damage; resilience only trims the amount that reaches shields and HP.
- The comms feed calls out the bonus when it happens so the player can see the mood effect.

### Shield Rechargers
Shield rechargers are manual-use backpack loot found during RAIDING:
- They drop into the normal current-raid backpack, not the separate field-meds pocket.
- The player must manually apply them from the backpack UI.
- Rechargers restore shield charge only; they do not repair shield durability.
- If unused, they extract into Home Stash like normal backpack loot.

### Consumables on Loot
When normal loot is received, the raid also rolls independent bonus chances for:
- one healing item
- one shield recharger

Because the rolls are independent, the same loot event can award both bonus consumables in addition to normal loot.

## 3. The Handler (player) — Signal
The only player resource. Regenerates ~1 per 10 minutes, capped at 5.
- **Ready Up! (2 Signal):** HUB-only action that immediately starts DEPLOYING.
- **Calm (1 Signal):** Radio a motivational cliché ("You miss 100% of the loot you don't grab"). Calms the raider and lowers immediate greed before the next check, reducing rare-loot appetite and future major-condition momentum.
- **Pressure (1 Signal):** Revoke snack privileges. Rattles the raider and raises immediate greed before the next check, increasing rare-loot appetite and future major-condition momentum.
- **CALL EXTRACT (3 Signal):** Force an extraction attempt. The panic button.
- During RAIDING, only one handler action can be pending at a time; raid action buttons stay locked until the next tick consumes it.
- On successful returns to HUB, raid pressure cools down: greed decays instead of resetting to 0, extraction state is cleared, and pending handler actions are consumed/cleared before the next raid. KNOCKED_OUT recovery outcomes reset greed to 0.
- Possible later: ping a loot stash, bless a piece of gear.

Keeping input this thin is the point — it must remain firmly zero-player.

Mood therefore matters beyond flavor text: keeping the raider in a better mood gives a subtle long-run boost to item quality without overriding danger-level risk/reward tuning.

## 4. The Comms Log — the content engine
Everything funny flows through an autoscrolling text feed:

> 📻 *Day 12, 14:02 — Found a water bottle. That's 47 now. I have a system.*
>
> 📻 *14:09 — A Tattletale drone spotted me. I waved. That was a mistake.*
>
> 📻 *14:15 — Hiding in a locker. The robot is also waiting. We're both very patient.*
>
> 📻 *14:31 — Met another raider. We emoted at each other for 5 minutes then both ran away.*

## 5. Parody Content Table (legally distinct names)
The canonical expanded parody reference lives in [docs/lore/PARODY_MAPPING.md](lore/PARODY_MAPPING.md). This table is the short design-doc summary.

| Trope / inspiration | AFK Raiders version |
|---|---|
| Underground hub city | **Desperanza** |
| Small spider bots | **Anxieticks** (they're nervous too) |
| Alert drones | **Tattletales** |
| Rocket or explosive robot | **Tank of Overcompensation** / **Bomber Who Misreads the Room** |
| Heavy armored robot | **Roomba Prime** |
| Giant boss machine | **The Drama Queen** (monologues before attacking) |
| Flooded dam map | **Damp Battlegrounds** |
| Ruined city map | **Buried City (Now 30% More Buried)** |
| Camp-heavy event or hot zone | **The Staycation Celebration** (raiders hide in lockers and tents instead of extracting) |
| Safe pocket | **Secret Hidden Pocket** |
| Skill trees | **Cardio**, **Hoarding**, **Hiding in Lockers**, **Signal Handling** |
| A.R.C. acronym | **Aggressively Roaming Chassis** |

## 6. Progression & Gags
- **Parody Skill System:** The Raider and Handler develop four questionable skill tracks: **Cardio**, **Hoarding**, **Hiding in Lockers**, and **Signal Handling**. The Handler does not spend points or pick builds. Each skill is discovered once, then levels from 1–5 through seeded practice gained from real outcomes:
   - **Cardio** improves from extraction attempts, successful returns, and low-HP escapes.
   - **Hoarding** improves from looting, extracting stuffed backpacks, valuable hauls, and stash-overflow pawn-shop disasters.
   - **Hiding in Lockers** improves from surviving robot encounters, botched extractions, High-danger survival, and Secret Hidden Pocket saves.
   - **Signal Handling** improves only when the Handler successfully spends Signal on Ready Up, Calm, Pressure, or CALL EXTRACT.
   Skill progression is intentionally slow because the game can run unattended: repeated real outcomes should build identity over many raids, not max a track in one evening. The normal skill XP curve is selected by the `standard` profile in `src/content/progression_config.json`; the `prototype` profile keeps smaller thresholds for faster internal testing. Skill effects stay intentionally small: tiny extraction-odds help, tiny loot/bonus-find help, tiny robot-damage mitigation, and Signal Handling as visible Handler competence/progression without a direct survival modifier for MVP. Level-ups are narrated in the comms feed because the joke is that everyone is slowly becoming good at the wrong things.
- **Raider Level:** a long-term level spine from 1–75. The label stays plain for clarity, while title bands such as **Questionable Competence** provide the in-world joke. Pacing is deliberately slow because the game runs itself: routine loot and failure grant tiny XP, every successful extraction grants a small base XP award, extracted loot adds a little more, and later levels require a much larger cumulative total. Raider XP is earned autonomously from meaningful outcomes: successful extractions, extracted loot, robot outcomes, High-danger survival, hidden-pocket saves, death recovery, stash-overflow pawn-shop lessons, and skill level-ups. Rat Rating does not drive Raider Level directly; it remains its own shame/pride metric. Level benefits are intentionally light-power: title bands, level-up comms, a small title-band extraction stipend that starts at Level 10, and a tiny title-band resilience trim that piggybacks on the existing failed-robot resilience system. Higher levels should feel like long-term identity and future unlock territory, not a combat stat that solves raids.
- **Balance contract:** Danger Level and robot deadliness are the main survival levers. A starter Raider with no meaningful skill progress should survive Low often enough to keep the comedy loop moving, but should die frequently in Medium and especially High when left alone. Medium and High add small per-tick ambient downed pressure during RAIDING so dangerous conditions matter; greed can unlock scarier robot events and bias future major conditions, but it does not directly add death chance. Nasty and deadly robots should be able to down wounded starter Raiders; weaker tiers can hurt badly but should not bypass their nonlethal floor. High danger is tuned as a Handler-intervention space: manual bandages, shield rechargers, and CALL EXTRACT are the intended survival path, not passive Raider Level scaling. Raider Level must not add HP, raw damage, shield strength, broad passive damage resistance, or major extraction safety. Keep resistance simple: positive mood provides the main soft pre-shield resilience trim, Raider Level adds only a tiny visible title-band trim in that same failed-robot path, Hiding in Lockers stays a tiny explicit pre-shield skill bonus, and real survival comes from shields, consumables, and Handler intervention. Skill modifiers stay small enough that max skills still leave High danger harsher than Medium.
- **Gear with cursed flavor text** (e.g., "Helmet of Mild Confidence: +2 defense, -1 awareness of exits").
- **Rat Rating** — a stat tracking how cowardly/looty the Raider plays. Both a badge of shame and pride.
- **Achievements:** "Died to an Anxietick — Twice", "Extracted with 50 water bottles", "Befriended a vending machine."
- **The Wipe** — prestige system parodying seasonal wipes: the Raider forgets everything but keeps one sentimental item; account-level bonuses persist.
- **Quests** that parody fetch-quest absurdity ("Bring me 12 left boots. Don't ask.").

## 7. Data Model (MVP)
- **Raider** — stats, mood, Raider Level XP, Rat Rating, skills
- **Raid** — zone, zone condition, tick count, backpack contents/value, greed level, lifecycle phase, RAIDING conditions (DOWNED/EXTRACTING), optional manual Secret Hidden Pocket selection
- **Home Stash** — persistent extracted loot; stacks duplicates (×N), capped at 120 items with overflow auto-sold into coins
- **Coins** — accumulated value from stash overflow auto-sales
- **Lifetime Stats** — extracts/deaths totals and context breakdowns, robot defeats, healing usage
- **Shield Layer** — current raid shield state (starter shield for now)
- **EventLog** — the comms feed entries
- **Inventory / Gear** — hub stash, equipped items
- **Quest** — active parody quests
- *(Later phases: Squad, Friends, Leaderboards)*

## 8. Roadmap
| Phase | Scope |
|---|---|
| **1 — MVP (the toy)** | One raider, one zone pool, tick engine, comms log, loot/greed/extract loop, Ready Up/Calm/Pressure/CALL EXTRACT, offline catch-up, PWA. **Ship when the log alone makes people laugh.** |
| **2 — Depth** | More zones, robot bestiary, quests, traders, gear-crafting parody, achievements, The Wipe |
| **3 — Social** | Accounts, leaderboards ("Most Water Bottles"), spectate friends' raiders, squads |
| **4 — Native** | Capacitor builds, push notifications, app store release |

## 9. Legal Positioning
Parody enjoys some protection, but we do **not** use the "ARC Raiders" trademark, logos, names, lore text, or assets — especially important for app-store distribution. Branding is original; positioning is "affectionate parody of extraction shooters" generally. All names in the parody table above are original to this project. See [docs/lore/content-guidelines/LEGAL_GUARDRAILS.md](lore/content-guidelines/LEGAL_GUARDRAILS.md) before adding new lore or content.

