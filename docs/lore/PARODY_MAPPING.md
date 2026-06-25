# Parody Mapping

This table is the canonical mapping from source-facing tropes or design functions to AFK Raiders equivalents. Keep the left column broad: describe the role a source element plays, not copied names or lore text.

## Core Mapping

| Source-facing function or trope | AFK Raiders canon | Type | Runtime hook |
|---|---|---|---|
| Underground survivor hub | Desperanza | Parody Equivalent | Hub UI, hub events, save/lore docs |
| Hostile machine faction acronym | A.R.C. = Aggressively Roaming Chassis | Parody Equivalent | Robot lore, loot flavor, zone conditions |
| Small scuttling machine | Anxietick, Overthinker Tick | Parody Equivalent | `src/content/robots.json` |
| Alert or surveillance drone | Tattletale drone, Passive-Aggressor Drone | Parody Equivalent | Robot encounters and extraction events |
| Explosive or overcommitted machine | Bomber Who Misreads the Room, Tank of Overcompensation | Parody Equivalent | High-greed robot encounters |
| Heavy armored machine | Roomba Prime, Crusher of Dreams, Tank of Overcompensation | Parody Equivalent | Deadly robot tiers |
| Giant dramatic boss machine | The Drama Queen | Backlog | Future boss/event content |
| Flooded industrial map | Damp Battlegrounds | Parody Equivalent | Zone pool |
| Ruined buried city map | Buried City (Now 30% More Buried) | Parody Equivalent | Zone pool |
| Machine facility ruins | Chassis Graveyard | Original AFK Creation | Zone pool |
| Limited-time camping event or high-traffic trap | The Staycation Celebration | Parody Equivalent | Zone pool, event variants |
| Protected pocket / safe container | Secret Hidden Pocket | Parody Equivalent | `RaidState.hiddenPocket`, backpack UI |
| Skill trees | Cardio, Hoarding, Hiding in Lockers, Signal Handling | Parody Equivalent | `src/content/skills.json` |
| Surface supply infrastructure | Questionable field caches, suspicious crates, emergency snack boxes | General Extraction-Shooter Trope | Backlog and event templates |
| Hub traders | Desperanza trader desks: Pawn Desk, Gear Weirdos, Coupon Barons, brand kiosks, and claims windows | General Extraction-Shooter Trope | [Traders](entities/traders.md), hub events, future store content |
| Lost-history eras and survivor mythmaking | The Before-ish, The Bad Years, The Great Downstairs, The Current Problem | Original AFK Creation | Lore wiki, hub gossip, future flavor tables |
| Underground civic infrastructure | Hatch Authority, Tube Routes, Hydroponic Arguments, Water Ration Desk, Security Stamp Maze | Original AFK Creation | Hub and deployment events |
| Survivor social groups | Coupon Barons, Blue-Tarp Nomads, Clipboard Researchers, Permit Choir, Locker Philosophers | Original AFK Creation | Future NPCs, faction-flavored events |
| Defunct old-world companies | Bravado Battery, ComfortCo, Nearly Fresh, OopsAll Logistics, HushTone, Exit Strategy Unlimited | Original AFK Creation | Loot tables, vendor jokes, environment flavor |
| Strange field conditions | Apology Weather, Tremor of Bad Priorities, Humming Crate Migration, Signal Shadow, Overtime Red | Original AFK Creation | Zone conditions and extraction complications |

## Status Labels

- `Parody Equivalent`: inspired by a recognizable source function, rewritten as AFK Raiders canon.
- `General Extraction-Shooter Trope`: common genre behavior, not tied to one specific source element.
- `Original AFK Creation`: invented for AFK Raiders first.
- `Backlog`: approved direction, not yet implemented as runtime JSON.

## Maintenance Rules

- Prefer AFK names from this table over inventing one-off synonyms in runtime content.
- Add a mapping row before adding a new major robot, zone, faction, event theme, or recurring NPC.
- Do not preserve source names in notes, examples, or hidden metadata unless the term is explicitly listed as allowed in the legal guardrails.