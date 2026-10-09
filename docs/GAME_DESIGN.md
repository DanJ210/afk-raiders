# AFK Raiders — Game Design Document

> An autonomous extraction comedy game where you, the Handler, prepare a Raider, manage emerging danger, and help them bring home increasingly valuable loot. Their encounters and terrible decisions create the story.

- **Genre:** Autonomous / idle / text-driven extraction comedy — inspired by [Godville](https://wiki.godvillegame.com/Main_Page), with meaningful Handler intervention
- **Parody target:** Extraction-shooter tropes (loot greed, extraction camping, hoarding, killer robots)
- **Platforms:** Web, iOS, Android — one codebase, offline-first PWA; Capacitor wrappers in a later phase
- **Current prototype scope:** Fully client-side, no backend or real-player encounters
- **Multiplayer direction:** Asynchronous encounters between real players' Raiders; both Handlers need not be online

---

## 1. The Pitch
You are **not** the raider. You are their Handler back in the underground hub. The Raider deploys, searches, and fights autonomously; you prepare their equipment, monitor danger, spend limited support resources, and decide when a growing haul is worth protecting with an extraction call. Left alone, they keep raiding and fail more often. Good handling should visibly improve survival and the loot that actually makes it home.

The core tension is: **"The backpack is getting valuable. Can I keep this idiot alive long enough to extract?"** Comedy gives the Raider personality and makes consequences memorable; it does not replace satisfying gameplay.

### Design pillars
- **Autonomy, not spectator-only play:** No direct movement, aiming, or mandatory command every tick. The Handler still makes consequential preparation and survival decisions.
- **Readable danger and meaningful intervention:** Threats expose enough information and response time to support a decision. Healing, shield recharge, Signal spending, and extraction must affect outcomes, not just produce feedback text.
- **Loot worth bringing home:** Secured loot supports preparation, progression, or concrete goals. More time raiding offers upside while putting the current haul at risk.
- **Offline continuity without mandatory vigilance:** Unattended raids remain playable and can succeed, especially on Low danger. Attention should improve results without requiring continuous monitoring to avoid account-wide ruin.
- **Social uncertainty:** Real-player encounters, including PvP, are a core target alongside robots. Cooperation, competition, and recurring rivals should produce stakes and stories that scripted flavor cannot substitute for.
- **Comedy with consequences:** Diary personality and continuity complement clear combat/support feedback. The player should understand what happened and why their intervention mattered.

### Document status and precedence
This document owns product direction. Existing mechanics below describe the current prototype unless explicitly labeled as a target or planned feature; this revision does not change runtime behavior or certify current balance. [ARCHITECTURE.md](ARCHITECTURE.md) owns implementation contracts. The earlier [story-first proposal](STORY_FIRST_DIRECTION.md) is historical: its narrative ideas remain useful, but its spectator-only emphasis and blanket pause on combat/economy work are superseded.

## 2. Core Loop
**Current prototype:** The lifecycle and mechanics below are the foundation to evaluate against the design pillars, not proof that the intended intervention loop already feels rewarding.

1. **Prep phase (hub):** Raider sells loot, buys questionable gear, equips one weapon, and stages consumable loadout stock before deployment. Preparation is HUB-only: weapons can be bought/equipped/repaired, healing items and shield rechargers are purchased into persistent stock, and selected consumable loadouts are applied at deployment start without being auto-consumed. Purchase/equip/repair actions use confirmations so accidental spend is less likely.
2. **Deploy:** Raider autonomously picks a zone and a seeded **zone condition** (for example Light Fog, Acid Rain, Robot Surge). Greed carried over from the last raid nudges whether the next condition comes from the minor or major condition pool.
3. **Raid diary and active threads:** Ambient raid diary lines cover loot finds, weather, suspicious noises, Raider commentary, and manual shield-recharger use/progress. Multi-tick active threads cover searches, extraction drama, DOWNED recovery, and robot fights. The selected condition sets a `dangerLevel` (Low/Medium/High), which then drives the danger-level profile for both upside (loot value/rarity) and risk (ambient downed pressure, robot pressure, extraction danger).
   - Raider **mood** now provides a tiny secondary bias to loot quality: positive mood slightly improves higher-rarity odds, while negative mood slightly favors lower-rarity outcomes. Greed adds a second small loot-appetite bias toward higher-rarity finds.
4. **The Greed Check™ (signature mechanic):** Every eligible tick in active RAIDING, the Raider rolls to start extracting *or* keep looting. Ordinary natural extraction is locked out early in the raid, scaled by danger: roughly the first half of RAIDING on Low danger (30 ticks / 15 minutes), longer on Medium (38 ticks) and High (46 ticks). Deadline urgency overrides that guard and can interrupt combat: most surviving Raiders should call extraction with time for their zone's countdown, but ignoring the deadline and losing remains possible. CALL EXTRACT bypasses both rolls and, when consumed on the next tick, immediately starts EXTRACTING while interrupting any active raid activity or shield recharge thread. **Greed rises slowly when the Raider keeps pushing deeper**, can jump from specific raiding/extraction-condition events, and is modified by Handler actions (Calm lowers it, Pressure raises it). Higher greed directly suppresses the extraction roll — the Raider wants one more crate — and also nudges rare loot odds, makes risky robot/extraction events more likely, and decays into major-condition momentum after successful returns. Failed raids that reach KNOCKED_OUT reset greed to 0. Elapsed raid time independently increases dangerous-encounter pressure and favors valuable loot; danger-level profiles remain the primary risk/reward lever. The Raider continues autonomously, but the Handler can manage support resources and call extraction to protect the haul.
5. **Extract or get knocked out:** Extraction is a timed condition layered on RAIDING, not a separate phase. During that window **extraction events** can fire — the shuttle may arrive early, the beacon may get jammed and clear the extracting condition, or the raider may get DOWNED at the LZ. DOWNED is also a RAIDING condition: the raider is incapacitated, normal events/actions stop, and a short revive timer starts. Revive costs 5 Signal, clears DOWNED, and restores 25 HP; the in-raid Panic Paddles field med can do the same if found before the disaster. If extraction completes before the DOWNED timer expires, the raid succeeds and returns straight to HUB. If the DOWNED timer expires first, the raid transitions to KNOCKED_OUT, then briefly resets to HUB with a sheepish wake-up log entry. If the raid timer itself hits zero with no extraction running, the round is simply over: the raid goes straight to KNOCKED_OUT.

### RAIDING Conditions: DOWNED and EXTRACTING
`RAIDING` is the field phase. `DOWNED` and `EXTRACTING` are timed conditions that can overlap during RAIDING:
- **EXTRACTING** is the only successful way to leave a raid. When it completes, the raid transitions `RAIDING → HUB` and the backpack transfers into Home Stash.
- **DOWNED** means the raider is still in the raid but unable to perform normal actions. Normal raiding/extraction events pause unless a comms event explicitly requires the DOWNED condition.
- EXTRACTING and DOWNED also write progress into the active-thread log so timed danger is visible separately from ordinary diary chatter.
- If DOWNED and EXTRACTING overlap, the timers race. Extraction completing first is a successful return; the DOWNED timer expiring first transitions `RAIDING → KNOCKED_OUT`.
- **Raid timeout:** if the RAIDING timer hits zero with no extraction in progress, the raid goes straight to `KNOCKED_OUT` — no DOWNED window. If extraction is already running at timeout, a one-shot DOWNED race starts instead; reviving during that race escapes the expired timer for good, leaving extraction to decide the outcome.
- Reviving (Handler REVIVE or Panic Paddles) clears DOWNED and closes the DOWNED active-thread entry immediately.
- **Danger-level scaling:** Extraction timers vary by zone difficulty, so safer routes extract faster and hostile zones take longer. DOWNED currently uses the standard short revive window; high-danger compressed DOWNED variants are content prototypes for a later activity-owned lifecycle pass.
- **KNOCKED_OUT** is the short recovery/reset phase after failed revival or raid-timeout loss. `KNOCKED_OUT → HUB` performs failed-raid bookkeeping.

### The Home Stash
Loot that makes it home goes into the **Stash** — a persistent collection that survives raids, deaths, and sessions:
- On successful extraction the raider's backpack is transferred into the stash.
- The stash has a hard cap of 120 total items (quantity counts).
- Overflow is auto-sold by lowest value first and credited as coins (value is never deleted).
- Duplicate items stack with a ×N quantity multiplier, and their displayed value is multiplied accordingly.
- The in-raid backpack resets if the raider dies or fails to extract — the stash is untouched.

### Preparation Economy (current implementation)
- The Preparation panel is available in HUB (desktop panel and mobile tab parity).
- Weapon loop:
   - Buy weapon tiers with coins.
   - Equip exactly one weapon for the next raid.
   - Repair owned weapons in HUB.
   - Failed raid recovery can remove the currently equipped weapon.
- Healing loop:
   - Buy healing items into persistent stock.
   - Stage quantities into raid loadout.
   - On deployment start, staged loadout is copied into current-raid healing inventory.
   - Successful HUB return keeps staged loadouts configured; KNOCKED_OUT clears staged loadouts.
- Shield recharger loop:
   - Buy shield rechargers into persistent stock.
   - Stage quantities into raid loadout.
   - On deployment start, staged rechargers are copied into current-raid backpack as manual-use shield consumables.
   - Successful HUB return keeps staged loadouts configured; KNOCKED_OUT clears staged loadouts.

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
- When a shield soaks part of a hit, the active-thread feed shows both the shield loss and the remaining HP damage so the mitigation is visible beside the fight or hazard that caused it.
- For the MVP, returning to the HUB restores the starter shield to full charge and durability.
- In future phases, a loadout and store loop can decide which shield is equipped and how it persists.

### Resilience
Mood also feeds a small hidden **resilience** bonus against robot damage:
- Positive mood slightly reduces failed-robot damage before shield mitigation.
- Mood at or below zero gives no resilience bonus.
- Robots still roll and hit for the same raw damage; resilience only trims the amount that reaches shields and HP.
- The active-thread feed calls out the bonus when it happens so the player can see the mood effect in the same place as the fight math.

### Shield Rechargers
Shield rechargers are manual-use backpack consumables available from both RAIDING finds and HUB loadout prep:
- They drop into the normal current-raid backpack, not the separate field-meds pocket.
- The player can buy them in HUB, stage them in a prep loadout, and deploy with them already in the backpack.
- The player must manually apply them from the backpack UI.
- Rechargers restore shield charge only; they do not repair shield durability.
- If unused, RAIDING-found rechargers extract into Home Stash like normal backpack loot; staged loadout copies are excluded from extraction transfer by the engine.

### Consumables on Loot
When normal loot is received, the raid also rolls independent bonus chances for:
- one healing item
- one shield recharger

Because the rolls are independent, the same loot event can award both bonus consumables in addition to normal loot.

Completed search activities also have a chance to uncover a current-raid healing item, while dedicated medical searches remain the high-confidence source for field meds.

## 3. The Handler (player) — support and survival
**Current Signal actions:** Signal is the regenerating radio-support budget, not the Handler's only resource or input. It regenerates ~1 per 10 minutes, capped at 5.
- **Ready Up! (2 Signal):** HUB-only action that immediately starts DEPLOYING.
- **Calm (1 Signal):** Radio a motivational cliché ("You miss 100% of the loot you don't grab"). Calms the raider and lowers immediate greed before the next check, reducing rare-loot appetite and future major-condition momentum.
- **Pressure (1 Signal):** Revoke snack privileges. Rattles the raider and raises immediate greed before the next check, increasing rare-loot appetite and future major-condition momentum.
- **CALL EXTRACT (3 Signal):** Force an extraction attempt. The panic button.
- During RAIDING, only one handler action can be pending at a time; raid action buttons stay locked until the next tick consumes it.
- On successful returns to HUB, raid pressure cools down: greed decays instead of resetting to 0, extraction state is cleared, and pending handler actions are consumed/cleared before the next raid. KNOCKED_OUT recovery outcomes reset greed to 0.
- Possible later: ping a loot stash, bless a piece of gear.

Other existing Handler decisions include HUB purchases/equipment/loadout staging, manual field-med and shield-recharger use, and choosing the Secret Hidden Pocket item. Any proposed change to manual-versus-automatic support responsibilities needs an explicit design decision; autonomy is not a reason to remove these controls.

### Intended intervention experience (target, not yet validated)
- The Handler can read the current threat, HP/shield condition, available support, and haul at risk before making a survival decision.
- Support has opportunity costs: using a consumable or Signal now competes with saving it for a later threat or extraction. Increasing action count alone is not a design success.
- Comms report the actual effect of an action, including relevant HP/shield/resource changes and activity interruption. Do not claim an action guaranteed survival when the engine cannot establish that.
- Raid pacing provides decision opportunities before irreversible failure; long extraction lockouts and short rescue windows are tuning inputs to review, not untouchable product requirements.
- Calm and Pressure must have understandable risk/reward roles. Subtle statistical effects alone should not be presented as reliable rescue tools.
- Passive level/skill bonuses must not remove the need to manage threats. Equally, scarce Signal should not leave the Handler watching preventable failure with no meaningful response throughout a raid.
- Returning players need a readable outcome summary, while attending players need clear anticipation, intervention, and payoff. Neither experience should depend on reading every ambient line.

Mood therefore matters beyond flavor text: keeping the raider in a better mood gives a subtle long-run boost to item quality without overriding danger-level risk/reward tuning.

## 4. The Comms Log — diary plus active thread
The UI has two coordinated text streams:

- **Diary / comms feed:** the broad autoscrolling story feed for ambient jokes, loot observations, phase transitions, Handler feedback, Raider personality, and shield-recharger use/progress.
- **Active thread:** a compact second feed for the thing currently taking multiple ticks: searching Medical, waiting for extraction, lying DOWNED, or fighting a robot. Timed activities show a progress bar, while robot fights show robot HP.

Damage and fighting should live in the active thread, not in one-off diary events. A diary line can announce that a robot appeared or that Medical is being searched, and safe activity-scoped ambient lines can fire during an active thread, but the active thread owns the progress ticks, HP/shield changes, combat outcome, and completion/failure text.

The implementation-level rules for this split, including `processTick()` sequencing and log priority behavior, are documented in [docs/ARCHITECTURE.md](ARCHITECTURE.md) and tracked during implementation in [ACTIVE_RAID_ACTIVITY_PLAN.md](ACTIVE_RAID_ACTIVITY_PLAN.md).

Diary examples:

> 📻 *Day 12, 14:02 — Found a water bottle. That's 47 now. I have a system.*
>
> 📻 *14:09 — A Tattletale drone spotted me. I waved. That was a mistake.*
>
> 📻 *14:15 — Hiding in a locker. The robot is also waiting. We're both very patient.*
>
> 📻 *14:31 — Met another raider. We emoted at each other for 5 minutes then both ran away.*

Active-thread examples:

> 🚨 *14:33 — Extraction thread: 2 ticks remaining. Raider is negotiating with flares and panic.*
>
> 🛡️ *14:34 — Tattletale fight round 2: shield lost 6 charge, 4 HP got through. Raider called that "a learning invoice."*

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
Progression should reinforce the survival-and-loot loop: a player should be able to explain what the next useful purchase or goal is and how a successful haul helps reach it. Slow autonomous XP and cosmetic titles are supporting rewards, not substitutes for that loop.

**Current progression:** Skill and Raider Level details below describe existing systems. Achievements, The Wipe, and fetch quests are planned concepts, not claims of implemented features.
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
- **EventLog** — the diary/comms feed entries
- **ActivityLog** — active-thread entries for multi-tick tasks, damage, fighting, extraction, and DOWNED progress
- **ActiveRaidActivity** — current-raid task state for searches, robot encounters, and other multi-tick actions; see [ACTIVE_RAID_ACTIVITY_PLAN.md](ACTIVE_RAID_ACTIVITY_PLAN.md)
- **Inventory / Gear** — hub stash, equipped items
- **Quest** — planned parody fetch-quest concept; narrative arcs are a separate existing story system
- *(Planned multiplayer: shared encounters and player relationships; schema not yet selected)*

## 8. Social Encounters and PvP (planned)
**Selected direction:** Asynchronous encounters between real players' autonomous Raiders. Both Handlers need not be online. This is a product target, not an implemented feature or approval of a particular combat model.

### Experience requirements
- Player identity and encounter history make another Raider recognizable as a person with an owner, not an interchangeable robot or anonymous event.
- Encounters must support meaningful social uncertainty and PvP stakes. Cooperation, contested loot, rescue, and rivalry are candidate interactions; their exact rules still need approval.
- Handler preparation and supported interventions should matter without direct aiming or a requirement that both participants respond live.
- Offline participation must have defined limits on exposure and loss. Continuous monitoring must not become the only defense against repeated targeting or griefing.
- Scripted rivals can test mechanics but must be identified as NPCs; they do not validate real-player social engagement. Leaderboards and spectating do not replace encounters.
- Shared outcomes and rewards require an authoritative resolution boundary so two clients cannot claim incompatible results, duplicate rewards, or repeatedly resolve the same encounter.

### Decisions required before implementation
| Decision | What must be specified |
|---|---|
| Participation and availability | How Raiders enter encounters; when offline Raiders are eligible; whether participation is opt-in |
| Handler influence | Precommitted behavior versus intervention windows; what happens when neither or only one Handler responds |
| Matching and fairness | Gear/progression differences, repeat encounters, targeting limits, and safeguards against farming |
| Stakes and loss | What can be stolen/lost, how much offline exposure is allowed, and how recovery works |
| Shared resolution | Authoritative state, action ordering, encounter identity, retries, disconnects, and reward settlement |
| Relationships and communication | Which cooperative/rivalry actions exist; whether communication is preset or freeform and what moderation is needed |

The current offline client is not a multiplayer authority. [SERVER_STORAGE_AND_ACCOUNTS.md](SERVER_STORAGE_AND_ACCOUNTS.md) describes a narrow account/save foundation, not a PvP backend. Shared encounter ownership and reconciliation with local catch-up require a separate design before adding real-player rewards or losses.

## 9. Roadmap and Verification
These are delivery priorities, not claims that earlier phases are complete. Narrative enrichment supports each phase rather than blocking survival improvements or real-player experiments.

| Phase | Scope |
|---|---|
| **1 — Survival-and-loot prototype** | Retain the local autonomous engine; audit preparation, support actions, danger readability, raid pacing, and extraction payoff. Verify attended versus unattended results and playtest whether handling is enjoyable. |
| **2 — Asynchronous social vertical slice** | Resolve the multiplayer decisions in §8; build the necessary account/authoritative encounter foundation and one bounded real-player encounter loop with meaningful stakes and offline safeguards. Do not wait for a large content/progression expansion to test social fun. |
| **3 — Depth and social expansion** | Expand proven systems: goals, gear economy, achievements, story continuity, relationships, and additional encounter types. Squads, spectating, leaderboards, and The Wipe remain candidates, not substitutes for the core loop. |
| **4 — Native** | Capacitor builds, push notifications, app store release |

### Verification gates
Before balance changes, define a reproducible seed cohort, starting equipment, run length, attended action policy, and numeric acceptance thresholds. Thresholds are not yet approved; the design direction is not evidence that the current build meets them.

| Gate | Evidence required |
|---|---|
| Attention improves outcomes | Compare matched initial states/seeds with and without Handler actions by danger level. Report extraction rate, failed-raid rate, secured loot value per simulated hour, and support/preparation costs; do not count backpack value that was lost as a reward. |
| Offline play remains viable | Measure unattended Low-danger progress and failure costs over the same run length, including offline catch-up. Verify that leaving the game does not imply guaranteed failure. |
| Decisions are readable and consequential | In focused playtests, players can identify a threat, name a response and its cost, and explain the visible result. Record decisionless waiting and threats with no usable response; agree pacing/response-window targets before tuning. |
| Loot has purpose | Players can identify a useful next purchase or goal and explain how a secured haul advances it. Include failed-raid equipment loss and consumable costs when evaluating the economy. |
| Social play adds real value | Test with distinct human-owned Raiders under both one-Handler-online and neither-Handler-online conditions. Verify compatible outcomes, exactly-once reward settlement, approved offline-loss limits, and whether participants recognize a reason to cooperate, compete, or meet again. |
| Comedy strengthens the experience | Players can recall both a Raider-specific story and a consequential gameplay moment. Funny logs alone are not sufficient to ship. |

### Survival audit baseline — 2026-10-08

This is the historical **pre-tuning** descriptive baseline, **not an approved balance target or a playtest**. Recording this baseline did not change runtime balance; the later approved tuning is measured separately below. The reproducible audit lives in [survivalAudit.test.ts](../tests/composables/survivalAudit.test.ts) and exercises `processTick` plus the real `useHandlerActions` boundary, including Signal spending, amplifiers, skill practice, and action guards.

#### Method and limits
- Single-raid cohort: seeds **1–120** for each danger level, Tea Kettle, full starter shield, 100 HP, neutral mood, no traits, zero progression, full initial Signal, no banked amplifiers. Start in RAIDING in Damp Battlegrounds with no zone condition; stop at successful HUB return or failed-recovery bookkeeping. These runs isolate danger profiles and do not represent every zone/condition.
- Two matched starting inventories: **found-only** (no staged supplies) and **prepared** (three Blue Bandages, one Panic Paddles, two Fizz Cells, bought/staged through preparation helpers for **240 coins**). Both policies in a prepared comparison receive the same loadout. Funding is supplied solely to test this purchase; it is not available to a fresh profile.
- Continuous cohort: seeds **1–24**, fresh HUB state, **960 ticks / eight hours**, natural zone/condition selection and normal progression. No purchases, repairs, Ready Up, Calm, Pressure, or pocket selection in any policy. Unattended state, RNG, outcomes, and secured wealth are checked against `catchUp` for every seed.
- **Unattended:** no actions. **Support:** after each tick, use a revive med first when DOWNED, otherwise Signal revive; use at most one smallest bandage at HP ≤75%; start the smallest recharger at shield charge ≤50% if legal. Use a banked amplifier only when needed to afford a selected Signal action.
- **Support + extract:** same support, then CALL EXTRACT with ≤6 raid ticks remaining, or with a nonempty haul when HP ≤50% or at least 20 raid ticks have elapsed. Evaluate extraction after healing and before starting recharge; retry after a failed extraction when affordable. Act immediately after each tick, without foreknowledge of RNG. This is a highly attentive policy, not a human reaction-time model.
- Secured value is the change in **home stash value + coins**, including overflow sales and any extraction stipend, excluding backpack contents, unspent field meds, and staged rechargers. Single-raid hourly rates include recovery time on failure but exclude HUB/deployment time; use continuous results for session throughput. Incomplete final raids in eight-hour runs contribute neither secured backpack loot nor a resolved outcome.
- Costs are separate: report actual preparation spend, consumed meds' catalog replacement value, consumed rechargers' catalog value, Signal/amplifier use, and lost weapons' catalog value. Found meds cost no coins; replacement values are not deducted again as actual spending. The starter weapon has zero replacement value. This baseline does not establish paid-weapon loss/repair economics.
- Matched seeds mean matched **initial** conditions, not identical later encounters: actions, differing survival time, and Signal Handling practice can change RNG consumption. These are descriptive cohort comparisons, not causal proof for one individual action, optimal strategies, or acceptance thresholds.

#### First-raid results: found-only
Each row represents 120 resolved raids. Value/hour is secured value, not loot found.

| Danger | Policy | Extract / fail | Secured value/hour | Mean RAIDING minutes |
|---|---|---|---|---|
| Low | Unattended | 16.7% / 83.3% | 271.0 | 28.9 |
| Low | Support | 20.0% / 80.0% | 309.8 | 29.0 |
| Low | Support + extract | 100.0% / 0.0% | 1,624.7 | 13.2 |
| Medium | Unattended | 14.2% / 85.8% | 741.3 | 25.4 |
| Medium | Support | 25.8% / 74.2% | 1,209.5 | 28.6 |
| Medium | Support + extract | 93.3% / 6.7% | 3,055.7 | 13.7 |
| High | Unattended | 2.5% / 97.5% | 93.0 | 23.0 |
| High | Support | 6.7% / 93.3% | 350.1 | 28.0 |
| High | Support + extract | 80.0% / 20.0% | 2,143.2 | 14.9 |

#### Prepared comparison
The net column subtracts the full 240-coin loadout purchase per run; this is not a universal optimal loadout.

| Danger | Policy | Extract / fail | Secured value/hour | Net after preparation/hour |
|---|---|---|---|---|
| Low | Unattended | 15.8% / 84.2% | 263.3 | -221.1 |
| Low | Support | 17.5% / 82.5% | 273.4 | -209.9 |
| Low | Support + extract | 100.0% / 0.0% | 1,624.7 | 534.1 |
| Medium | Unattended | 13.3% / 86.7% | 737.9 | 190.7 |
| Medium | Support | 17.5% / 82.5% | 688.0 | 208.5 |
| Medium | Support + extract | 99.2% / 0.8% | 3,441.2 | 2,290.0 |
| High | Unattended | 2.5% / 97.5% | 93.0 | -508.2 |
| High | Support | 6.7% / 93.3% | 219.1 | -252.3 |
| High | Support + extract | 98.3% / 1.7% | 2,958.9 | 1,837.5 |

#### Eight-hour natural sessions
Each policy covers 24 profiles / 192 simulated hours. Supplies are found-only and Signal scarcity carries between raids.

| Policy | Extracts / resolved failures | Extraction rate | Secured value/hour | Meds / rechargers used | Signal spent / amplifiers used |
|---|---|---|---|---|---|
| Unattended | 42 / 248 | 14.5% | 259.8 | 0 / 0 | 0 / 0 |
| Support | 62 / 203 | 23.4% | 396.9 | 367 / 142 | 480 / 83 |
| Support + extract | 364 / 68 | 84.3% | 1,549.1 | 113 / 46 | 1,150 / 28 |

Consumed meds' replacement values were 7,149 (support) and 2,496 (support + extract); consumed recharger values were 3,384 and 1,214 respectively. Actual purchase spend and starter-weapon loss value were zero. None of these figures include a paid-weapon progression strategy.

#### Findings and next decisions
1. **Survival often ends in timer loss, not a secured haul.** Found-only Low support eliminated downed-expiry losses, yet 96 of 120 runs still failed at timeout. High support produced 92 timeout losses and 20 downed-expiry losses. More healing alone is unlikely to fix the loop.
2. **CALL EXTRACT dominates these policies.** In natural eight-hour sessions, support + extract secured about 3.9× the value/hour of support alone while consuming fewer meds/rechargers. On found-only Low first raids, the extraction policy used no meds or rechargers at all. This demonstrates meaningful intervention, but does not yet demonstrate engaging survival management.
3. **Recharge cannot currently rescue the ongoing fight that triggered its use.** Blocking robot rounds advance before the recharge branch; recharge remains pending during those rounds. The High prepared support cohort accumulated 3,059 such combat ticks across 258 recharger uses. This is an implementation observation to review, not an approved change to sequencing.
4. **Some danger bypasses the visible damage budget.** Medium/High ambient pressure can start DOWNED directly instead of draining HP/shields. In the found-only High support cohort, 56 of 74 downings came from ambient pressure. The eight-hour extraction policy encountered 62 downings with no med/Signal/amplifier rescue available; imminent extraction can still save some of these. Threat readability needs human evaluation.
5. **Stocking supplies is not sufficient, and can worsen the tested outcome.** Prepared High support still failed 93.3% of raids and had negative net return after purchase cost. Bandages also suppress the low-HP/no-bandage natural extraction bonus while they remain in inventory. The prepared policy can survive longer without securing more loot; compare alternative policies before concluding that preparation is inherently bad.
6. **Offline progress exists, but success is infrequent in this baseline.** Catch-up parity passed and unattended sessions gained secured value, but 85.5% of resolved raids failed. Whether that feels acceptable requires an approved target and a playtest, not merely the existing broad balance guardrails.

**Decision prompted by this baseline:** the Handler approved rising deadline extraction urgency, not guaranteed forced extraction. "Most extract" applies to surviving Raiders; Medium/High combat failures should still punish unattended runs. The resulting implementation and measurements follow below. Recharge sequencing and warnings/response windows still need review. The asynchronous social decisions in §8 remain open.

To reproduce the complete JSON report in PowerShell:

```powershell
$env:SURVIVAL_AUDIT_REPORT = '1'
npm test -- tests\composables\survivalAudit.test.ts --disableConsoleIntercept --reporter=verbose
Remove-Item Env:SURVIVAL_AUDIT_REPORT
```

### Approved extraction and elapsed-time risk/reward tuning

- **Reserve countdown time:** urgency starts when raid time remaining minus the zone's extraction countdown is at most 12 ticks (6 minutes). Per-check extraction chance starts at 10% and rises to 75% at zero margin, less up to 1.8 percentage points for greed. It overrides the ordinary minimum-duration guard and can interrupt a blocking robot encounter. Forced Handler extraction still wins immediately; DOWNED Raiders cannot start natural extraction. Failed rolls, combat/downing, and extraction failure still allow losses. No new natural extraction starts after timer expiry.
- **Reward and punish staying longer:** exposure rises linearly from 0 to 1 over the 60-tick raid. Ambient downing pressure, robot encounter odds, and risky extraction-event weights gain up to a 1.5x multiplier. Diary-loot target value gains up to 1.5x; SEARCH and robot-reward pools increasingly favor their valuable items (up to 3x the highest-value item's selection weight). This changes expected reward, not a guarantee for any individual roll. Named danger level remains the zone condition's label; elapsed exposure does not rewrite it.
- **Keep loot prices stable:** reward growth selects more valuable catalog items, rather than changing an item's stored price. Backpack/stash stacking, sale prices, and older saves remain compatible. Exposure is derived from the existing timer, so no new saved field or migration is needed.
- **Readable exit:** deadline-driven extraction emits a priority comms line explaining the closing exit window and actual zone countdown. Ordinary/Handler extraction retains its existing narration.

Re-running the same 120-seed, found-only first-raid cohorts:

| Danger | Unattended extraction, before -> after | Support-only extraction, before -> after | After secured value/hour, unattended / support |
|--------|----------------------------------------|------------------------------------------|------------------------------------------------|
| Low | 16.7% -> 98.3% | 20.0% -> 100.0% | 2,631.8 / 2,656.8 |
| Medium | 14.2% -> 70.8% | 25.8% -> 94.2% | 3,773.9 / 4,884.4 |
| High | 2.5% -> 64.2% | 6.7% -> 87.5% | 3,631.4 / 4,166.8 |

No timer-only knockouts occurred in these measured cohorts; this is not a guarantee. Forced missed-roll tests still produce timeout loss. Longer supported runs averaged about 25 minutes of RAIDING and secured 1,121 / 2,200 / 1,935 value per extraction on Low / Medium / High, compared with 396 / 943 / 892 for the tested early-extraction policy. Surviving longer now offers a meaningful haul tradeoff rather than mostly postponing timeout.

In the same 24-seed eight-hour natural-zone cohorts, unattended resolved-raid extraction rose from 14.5% to **68.8%**, and support-only from 23.4% to **94.6%**. Secured value/hour rose to **2,230.6 unattended** and **3,506.7 supported** (about 57% more with support). Early extraction secured 2,081.3/hour: it is no longer the universally dominant throughput strategy. These deterministic policies are comparison tools, not evidence that humans find the game fun or final economy targets.

Tests verify deadline misses, combat interruption, actual zone countdowns, existing timeout races, higher elapsed-time risk, and higher **actual catalog-item** rewards. Matched-seed samples require at least a 5% SEARCH mean-value increase and a 2% increase in the narrower Tank robot reward pool, from full timer to 10 ticks remaining; reward growth depends on the pool's value spread. Broad raid guardrails now require at least 80% Low extraction and a failure-rate increase of at least five percentage points for each danger step, rather than preserving the old timeout-heavy failure minima. Catch-up parity accounts separately for a final knockout whose recovery/stat bookkeeping has not yet completed.

**Next validation:** human playtest threat anticipation, rescue timing, and secured-loot payoff. More valuable late loot is not progression by itself; useful spending/progression and the unresolved asynchronous PvP design still matter.

The mobile usability walkthrough found that a DOWNED countdown was visible on Comms, but both rescue paths were hidden on separate tabs. A persistent DOWNED rescue prompt now appears above every mobile tab: it shows time to knockout, any competing extraction countdown, Signal revive cost/current resources, and revive-med dose count, with shortcuts to the existing controls. It explicitly reports when neither rescue is currently available. This removes a navigation/discoverability barrier; it does not change rescue timing, cost, or balance, and is not a substitute for a human fun/readability playtest.

Extraction payoff now has a non-blocking **latest-success receipt** in HUB, available on desktop and every mobile tab. Expand it to see secured loot units/value, net stash-value change, overflow sales, and the extraction stipend. The timestamp and extraction number distinguish this historical success from a later failed return. Overflow can sell older stash items, so the receipt reports net stash change rather than pretending every incoming item remained unsold. Staged supplies and unused field meds are not counted as earned loot. Receipts persist through reload/catch-up; older saves begin with no receipt.

Receipt shortcuts open the stash for **manual selling** or preparation to choose a **next purchase goal**. The goal shows the real item's benefit, catalog cost, current spendable coins, and coin shortfall, explicitly distinguishing unsold stash value. An unowned weapon is the initial suggestion; the Handler may choose a med or recharger instead. Goals are session-local UI choices, not quests or automatic transactions. Buying remains HUB-only, with existing confirmation, equipment-loss, and loadout rules. This makes the existing economy easier to understand; it does not add progression or rebalance rewards.

The full-tick starter cohort also requires at least 95% of successful Raiders at each danger level to extract strictly before the timer-zero tick, rather than relying on the expiry race to satisfy the pacing goal.

## 10. Legal Positioning
Parody enjoys some protection, but we do **not** use the "ARC Raiders" trademark, logos, names, lore text, or assets — especially important for app-store distribution. Branding is original; positioning is "affectionate parody of extraction shooters" generally. All names in the parody table above are original to this project. See [docs/lore/content-guidelines/LEGAL_GUARDRAILS.md](lore/content-guidelines/LEGAL_GUARDRAILS.md) before adding new lore or content.
