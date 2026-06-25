# Desperanza

Desperanza is the underground survivor hub. It is safe in the way a waiting room is safe: fluorescent, rule-bound, crowded, and full of people pretending the form they are holding matters.

The hub should feel functional enough to keep humanity alive and absurd enough to explain why everyone keeps volunteering to leave.

## Infrastructure

| System | Canon identity | Content hooks |
|---|---|---|
| Hatch Authority | The office that decides which raiders are allowed to become someone else's problem. | Ready Up flavor, deployment paperwork, security jokes. |
| Tube Routes | One-person pod routes that are technically mapped and emotionally improvised. | Deployment events, route errors, pod announcements. |
| Hydroponic Arguments | Food cultivation sustained by lamps, optimism, and people arguing over lettuce custody. | Hub events, ration jokes, mood bumps or penalties. |
| Water Ration Desk | Civic water distribution with stamps, cups, and rules about heroic sipping. | Hub events, low-danger zone flavor, stash water jokes. |
| Security Stamp Maze | A scanner-and-stamp process that catches nothing important but feels official. | Hub friction, backpack inspection, rat rating bits. |
| Field Depot Counter | The place that promises supplies will be waiting topside, maybe, if labels can be trusted. | Loot events, supply cache flavor, deployment confidence. |
| Pawn Desk | A quiet economy where cracked mugs become investment vehicles. | Coins, stash overflow, vendor jokes. |
| Handler Certification Office | Paperwork that turns radio meddling into a career path. | Signal Handling progression, tutorial flavor. |
| Wipe Counselor's Folding Chair | A future prestige station that insists forgetting everything is healthy. | Future reset/prestige feature jokes. |

## Social Texture

- Nobody in Desperanza makes eye contact for longer than needed.
- Every desk has a stamp, even if the desk is a crate.
- People respect the Secret Hidden Pocket more than most laws.
- Desperanza morale is maintained by synth-coffee, gossip, and claiming the tubes are improving.

## Runtime Uses

- HUB events should make Desperanza feel lived-in without becoming a menu tutorial.
- Deployment events can treat the hub as a bureaucracy handing the raider to physics.
- Stash and vendor text can use pawn desk logic: everything has value if described with enough confidence.
- Repeated vendor voices should point back to [Traders](traders.md) so future shop content has consistent desks and kiosk personalities.

## Runtime Seeds

| System | First event hooks |
|---|---|
| Hatch Authority | `hub_hatch_authority_stamp`, `deploy_hatch_authority_final_notice` |
| Tube Routes | `deploy_tube_routes_confident_error` |
| Hydroponic Arguments | `hub_hydroponic_greens` |
| Water Ration Desk | `hub_water_ration_cup_math`, `hub_water_dispenser_applause` |
| Security Stamp Maze | `hub_security_stamp_maze_backpack`, `hub_security_backpack_scan` |
| Field Depot Counter | `deploy_field_depot_counter_promise` |
| Pawn Desk | `hub_pawn_desk_cracked_mug_index`, `hub_pawn_clerk_squints`, `hub_pawn_desk_overflow_prophecy`, `extract_pawn_desk_valuation_intrusive` |
| Handler Certification Office | `hub_handler_cert_office_signal_form`, `deploy_handler_cert_office_badge` |