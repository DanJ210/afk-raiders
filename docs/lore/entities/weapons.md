# Weapons

AFK Raiders weapons are improvised tools, misfiled hardware, and aggressively overconfident objects that the raider insists are "fine." They are bought in Desperanza, carried into raids, and eventually returned as stories, repairs, or embarrassing paperwork.

## Current Arsenal

| Weapon | ID | Damage | Cost | Repair | Lore hook |
|---|---|---|---|---|---|
| Tea Kettle | `tea_kettle` | 3-6 | 0 | 0 | Default survival tool. Whistles, complains, and still somehow gets the job done. |
| Aspperigo | `aspperigo` | 4-7 | 65 | 18 | Eddie's favorite and we don't know why. |
| Vernerider | `vernerider` | 5-9 | 140 | 30 | No one can pronounce it right. |
| Temptrest AR | `temptrest_ar` | 7-11 | 280 | 55 | The favorite among Raiders. The most prized possession. |

## Design Rules

- Weapons should sound practical, but only just.
- Higher tiers should feel like upgraded bad decisions, not heroic armaments.
- Damage and durability are gameplay values; the joke lives in the naming and flavor.
- The raider can own and repair weapons, but a failed raid can still force a loss.
- Do not use source-game weapon names or copy source flavor text.

## Runtime Notes

- Weapons are bought with coins in the Preparation flow.
- The currently equipped weapon controls robot encounter damage ranges unless an activity overrides them.
- Healing items are selected separately and consumed when the raid starts.
