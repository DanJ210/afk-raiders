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
2. **Deploy:** Raider autonomously picks a zone and wanders it.
3. **Raid events:** Loot finds, robot encounters, weather, meeting other AI raiders (alliance → inevitable betrayal).
4. **The Greed Check™ (signature mechanic):** At intervals the Raider rolls to extract *or* push deeper for better loot. Backpack value rises → death risk rises. Pure dramatic tension, zero input required.
5. **Extract or die:** Extraction takes ~45 seconds, then a final beat to hit the big RETURN HOME button. During that window **extraction events** can fire — the shuttle may arrive early (instant success), the beacon may get jammed (back into the zone, backpack kept), or the raider may go down at the LZ (lose the bag). Death = lose the bag (keep the Emotional Support Pocket item), respawn in hub with a sheepish log entry. Repeat forever.

### The Home Stash
Loot that makes it home goes into the **Stash** — a persistent collection that survives raids, deaths, and sessions:
- On successful extraction the raider's backpack is transferred into the stash.
- The stash **never empties** unless items are sold (selling/trading is a future hub mechanic).
- Duplicate items stack with a ×2 / ×3 quantity multiplier, and their displayed value is multiplied accordingly.
- The in-raid backpack resets if the raider dies or fails to extract — the stash is untouched.

## 3. The Handler (player) — Signal
The only player resource. Regenerates ~1 per 10 minutes, capped at 3–5.
- **Encourage (1 Signal):** Radio a motivational cliché ("You miss 100% of the loot you don't grab"). Nudges hidden behavior weights toward boldness.
- **Scold (1 Signal):** Revoke snack privileges. Raider sulks but plays safer.
- **CALL EXTRACT (3 Signal):** Force an extraction attempt. The panic button.
- Possible later: ping a loot stash, bless a piece of gear.

Keeping input this thin is the point — it must remain firmly zero-player.

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
- **Raid** — zone, tick count, backpack contents/value, greed level, phase
- **Home Stash** — persistent extracted loot; stacks duplicates (×N); only shrinks via selling (future)
- **EventLog** — the comms feed entries
- **Inventory / Gear** — hub stash, equipped items
- **Quest** — active parody quests
- *(Later phases: Squad, Friends, Leaderboards)*

## 8. Roadmap
| Phase | Scope |
|---|---|
| **1 — MVP (the toy)** | One raider, one zone, tick engine, comms log, loot/greed/extract loop, Encourage/Scold, offline catch-up, PWA. **Ship when the log alone makes people laugh.** |
| **2 — Depth** | More zones, robot bestiary, quests, traders, gear-crafting parody, achievements, The Wipe |
| **3 — Social** | Accounts, leaderboards ("Most Water Bottles"), spectate friends' raiders, squads |
| **4 — Native** | Capacitor builds, push notifications, app store release |

## 9. Legal Positioning
Parody enjoys some protection, but we do **not** use the "ARC Raiders" trademark, logos, names, lore text, or assets — especially important for app-store distribution. Branding is original; positioning is "affectionate parody of extraction shooters" generally. All names in the parody table above are original to this project.
