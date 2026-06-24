# Zones

Zones are original AFK Raiders locations built to support idle extraction comedy: bad footing, tempting crates, overconfident raiders, and machine pressure that scales with danger level.

## Current Zone Pool

| Zone | ID | Role |
|---|---|---|
| Damp Battlegrounds | `damp_battlegrounds` | Flooded industrial misery, waterlogged loot, wet socks. |
| Buried City (Now 30% more buried) | `buried_city` | Ruined urban space with sand, rubble, and questionable shortcuts. |
| The Breach | `the_breach` | Landscape scar, weird silence, and suspicious machine activity. |
| Chassis Graveyard | `arc_ruins` | Old A.R.C. infrastructure, broken machinery, and safety signage that gave up. |
| Sunken Highrise | `the_sunken_highrise` | Vertical loot greed with bad footing. |
| Forgotten Fields | `forgotten_fields` | Open farmland, wandering machines, poor cover choices. |
| The Staycation Celebration | `stella` | Camping-event parody where everyone hides, waits, and calls it strategy. |

Stable IDs may keep older internal names because saves can reference them. Player-facing names and descriptions should follow the AFK canon above.

## Conditions

Zone conditions live in `src/content/zones/zone_conditions.json`. They are split into minor and major pools, then assign `Low`, `Medium`, or `High` danger. Greed from successful raids nudges future condition selection toward major conditions, so condition flavor should read like consequences piling up.

## Tone Rules

- Low danger can be annoying, eerie, or inconvenient.
- Medium danger should threaten the run without sounding apocalyptic every time.
- High danger should feel like the raider has made a lifestyle error.
- Conditions can reference Desperanza, Handler comms, A.R.C. machinery, bad signage, and field rumors.
- Do not use source map names in player-facing content. Translate the function into an AFK place first.

## Runtime Seeds

| Zone theme | First event hooks |
|---|---|
| The Staycation Celebration tents and campers | `raid_staycation_tent_decoy_crate`, `raid_staycation_locker_philosophy`, `extract_staycation_lz_tent_camper` |