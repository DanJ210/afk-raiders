# Weapons

AFK Raiders weapons are improvised tools, misfiled hardware, and aggressively overconfident objects that the raider insists are "fine." They are bought in Desperanza, carried into raids, and eventually returned as stories, repairs, or embarrassing paperwork.

## Current Arsenal

| Weapon | ID | Damage | Cost | Repair | Lore hook |
|---|---|---|---|---|---|
| Tea Kettle | `tea_kettle` | 3-6 | 0 | 0 | Default survival tool. Whistles, complains, and still somehow gets the job done. |
| Crowbar of Minor Confidence | `crowbar_of_minor_confidence` | 4-7 | 65 | 18 | Opens crates, doors, and the raider's sense of judgment. |
| Meeting Room Bat | `meeting_room_bat` | 5-9 | 140 | 30 | Salvaged from a meeting nobody agreed to attend. |
| Audit Hammer Deluxe | `audit_hammer_deluxe` | 7-11 | 280 | 55 | Every swing requests receipts and final approval. |

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
