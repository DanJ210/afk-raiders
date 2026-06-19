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
2. **Deploy:** Raider autonomously picks a zone and a seeded **zone condition** (for example Light Fog, Acid Rain, Robot Surge).
3. **Raid events:** Loot finds, robot encounters, weather, meeting other AI raiders (alliance → inevitable betrayal). The selected condition sets a `dangerLevel` (Low/Medium/High), which then drives the danger-level profile for both upside (loot value/rarity) and risk (robot pressure/extraction danger).
   - Raider **mood** now provides a tiny secondary bias to loot quality: positive mood slightly improves higher-rarity odds, while negative mood slightly favors lower-rarity outcomes.
4. **The Greed Check™ (signature mechanic):** Every tick in RAIDING, the Raider rolls to extract *or* push deeper for better loot. **Greed is event-driven:** it rises when triggered by specific raiding events (e.g., "spotted shiny loot in the distance") and is modified by Handler actions (Calm lowers it, Pressure raises it). Higher greed slightly reduces extraction chance and increases downed risk. Pure dramatic tension, zero input required — the Handler can only nudge via Signal actions.
5. **Extract or die:** Extraction takes ~90 seconds, then a final beat to hit the big RETURN HOME button. During that window **extraction events** can fire — the shuttle may arrive early (instant success), the beacon may get jammed (back into the zone, backpack kept), or the raider may go down at the LZ (lose the bag). If the raider stays in RAIDING until the timer expires, they go DOWNED (zone nuke failure).  Death = lose the bag (keep the Emotional Support Pocket item), respawn in hub with a sheepish log entry. If the raid timer reaches zero while still in RAIDING, the zone nuke lands and the raider goes DOWNED.

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
- On failures that clear the backpack (for example DOWNED outcomes), exactly one unit of the selected item is transferred safely to Home Stash.
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
- Positive mood slightly reduces the HP damage that remains after shield mitigation.
- Mood at or below zero gives no resilience bonus.
- Robots still roll and hit for the same raw damage; resilience only trims the final HP loss.
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
- **Calm (1 Signal):** Radio a motivational cliché ("You miss 100% of the loot you don't grab"). Calms the raider and lowers immediate greed before the next check, which makes extraction less likely so they stay in longer.
- **Pressure (1 Signal):** Revoke snack privileges. Rattles the raider and raises immediate greed before the next check, but also increases extraction tendency so they are more likely to bail out early.
- **CALL EXTRACT (3 Signal):** Force an extraction attempt. The panic button.
- During RAIDING, only one handler action can be pending at a time; raid action buttons stay locked until the next tick consumes it.
- On every return to HUB, raid-phase pressure resets: greed returns to 0, forced-extract is cleared, and pending handler actions are consumed/cleared before the next raid.
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
| Trope / inspiration | AFK Raiders version |
|---|---|
| Underground hub city | **Desperanza** |
| Small spider bots | **Anxieticks** (they're nervous too) |
| Alert drones | **Tattletales** |
| Rocket robot | **The Overcompensator** |
| Heavy armored robot | **Roomba Prime** |
| Giant boss machine | **The Drama Queen** (monologues before attacking) |
| Flooded dam map | **Damp Battlegrounds** |
| Ruined city map | **Buried City (Now 30% More Buried)** |
| Stella Camping Festival | **The Staycation Celebration** (raiders hide in lockers and tents instead of extracting) |
| Safe pocket | **Emotional Support Pocket** |
| Skill trees | **Cardio**, **Hoarding**, **Hiding in Lockers** |
| A.R.C. acronym | **Aggressively Roaming Chassis** |

## 6. Progression & Gags
- **Gear with cursed flavor text** (e.g., "Helmet of Mild Confidence: +2 defense, -1 awareness of exits").
- **Rat Rating** — a stat tracking how cowardly/looty the Raider plays. Both a badge of shame and pride.
- **Achievements:** "Died to an Anxietick — Twice", "Extracted with 50 water bottles", "Befriended a vending machine."
- **The Wipe** — prestige system parodying seasonal wipes: the Raider forgets everything but keeps one sentimental item; account-level bonuses persist.
- **Quests** that parody fetch-quest absurdity ("Bring me 12 left boots. Don't ask.").

## 7. Data Model (MVP)
- **Raider** — stats, mood, Rat Rating, skills
- **Raid** — zone, condition, tick count, backpack contents/value, greed level, phase, optional manual Secret Hidden Pocket selection
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
Parody enjoys some protection, but we do **not** use the "ARC Raiders" trademark, logos, names, lore text, or assets — especially important for app-store distribution. Branding is original; positioning is "affectionate parody of extraction shooters" generally. All names in the parody table above are original to this project.

