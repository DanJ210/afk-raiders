# Robots

AFK Raiders robots are A.R.C. units: `Aggressively Roaming Chassis`. They are not mysterious, majestic war machines. They are hostile appliances with bad priorities, strange workplace culture, and enough firepower to make unattended looting a poor lifestyle choice.

## Deadliness Tiers

| Tier | Label | Design meaning |
|---|---|---|
| 1 | `weak` | Common nuisance machines that can hurt but should not kill. |
| 2 | `moderate` | Regular threat units that punish carelessness without ending a healthy raid alone. |
| 3 | `dangerous` | Serious machines that can force extraction, healing, or shield use. |
| 4 | `nasty` | Lethal-capable machines unlocked by greedier, deeper raids. |
| 5 | `deadly` | Major threats that can down wounded raiders and anchor scary comms moments. |

Only `nasty` and `deadly` robots can kill the raider outright, and high-tier encounter events should require built-up greed. Lower tiers can make the situation worse, but they should respect the nonlethal floor in the engine.

## Current Roster

| Robot | ID | Tier | Menace | Lore hook |
|---|---|---|---|---|
| Anxietick | `anxietick` | `weak` | 2 | Small machine with more nerves than strategy. |
| Overthinker Tick | `overthinker_tick` | `weak` | 2 | Tick variant that loses fights to decision paralysis. |
| Tattletale drone | `tattletale` | `moderate` | 3 | Broadcasts the raider's location with judgmental cheer. |
| Passive-Aggressor Drone | `passive_aggressor` | `moderate` | 4 | Makes combat feel like a performance review. |
| Seeker of Validation | `seeker_validation` | `moderate` | 5 | Wants approval and also wants to attack. |
| Harvester of Mild Annoyances | `harvester_annoyance` | `moderate` | 4 | Gathers scrap, blocks paths, and worsens the day. |
| Receipt Printer of Doom | `receipt_printer_doom` | `moderate` | 5 | Citation platform that turns looting too slowly into a punishable offense. |
| Walker Texas Malfunction | `walker_texas_malfunction` | `dangerous` | 6 | Heavy walker with confidence exceeding competence. |
| Enforcer of Minor Inconveniences | `enforcer_inconvenience` | `dangerous` | 6 | Turns small problems into official problems. |
| Apology Turret | `apology_turret` | `dangerous` | 6 | Stationary courtesy weapon that says sorry before firing. |
| Bomber Who Misreads the Room | `bomber_misread` | `nasty` | 7 | Explosive enthusiasm at the worst possible moment. |
| Roomba Prime | `roomba_prime` | `deadly` | 8 | Cleaning mandate escalated into war doctrine. |
| Crusher of Dreams | `crusher_of_dreams` | `deadly` | 8 | Anti-optimism platform with crushing hardware. |
| Sniper of Poor Decisions | `sniper_poor_decisions` | `deadly` | 9 | Punishes looting pauses and bad instincts. |
| Tank of Overcompensation | `tank_overcompensation` | `deadly` | 10 | Maximum threat, maximum insecurity. |

## Writing Hooks

- Robots should feel like dangerous systems with petty emotional bugs.
- Failed encounters should create readable cause and consequence: spotted, judged, hit, hid, escaped, or got greedy.
- Defeated robots should drop parts that preserve the bit in item names and flavor.
- Avoid direct source-machine names. Use this roster, or add a new AFK-original row here before adding JSON content.

## Machine Role Families

Use these broad families when converting new machine ideas into AFK-original robots. Add a specific robot row above before adding runtime encounters.

| Role family | AFK direction | Existing or planned examples |
|---|---|---|
| Informants | Machines that make stealth socially impossible. | Tattletale drone, Passive-Aggressor Drone. |
| Skirmishers | Small units that punish panic and bad footwork. | Anxietick, Overthinker Tick. |
| Bomb carriers | Machines that confuse enthusiasm with safety. | Bomber Who Misreads the Room. |
| Citation platforms | Stationary or slow machines that weaponize procedure. | Receipt Printer of Doom, Apology Turret. |
| Heavy walkers | Big threats with more confidence than grace. | Walker Texas Malfunction, Tank of Overcompensation. |
| Surveyors | Machines that inspect, judge, and escalate. | Seeker of Validation, Enforcer of Minor Inconveniences. |
| Harvesters | Resource collectors that make the route worse by existing. | Harvester of Mild Annoyances. |
| Boss platforms | Rare machines that turn a bad decision into a set piece. | The Drama Queen. |

## Runtime Seeds

| Role family | Runtime robot IDs | First event hooks |
|---|---|---|
| Citation platforms | `receipt_printer_doom`, `apology_turret` | `encounter_receipt_printer_doom`, `encounter_receipt_printer_doom_paper_jam`, `encounter_apology_turret`, `encounter_apology_turret_hold_still` |