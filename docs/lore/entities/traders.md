# Traders

Desperanza traders are recurring desks, kiosks, and aggressively confident specialists rather than heroic named merchants. They exist to turn loot economy, future shops, and hub gossip into jokes the comms log can reuse.

Use source material only for the broad function: hub vendors give the player recognizable places to buy, sell, repair, snack, overpay, and receive terrible advice. AFK Raiders should answer that with original Desperanza vendor archetypes that are funny without outside context.

## Trader Archetypes

| Trader archetype | Canon identity | Content hooks |
|---|---|---|
| Pawn Desk | A valuation counter where cracked mugs become investment vehicles if described with enough confidence. | Stash overflow, sell jokes, extraction greed, future market UI. |
| Gear Weirdos | Loadout sellers who believe every refurbished battery, shield plate, or cable has a destiny. | Shields, rechargers, risky purchases, deployment pep talks. |
| Coupon Barons | Discount mathematicians who treat barter rates like diplomacy. | Hub gossip, bargain events, coin jokes, mood penalties. |
| Nearly Fresh Counter | Food vendors with a flexible legal relationship to freshness. | Mood events, snacks, healing-adjacent flavor, ration jokes. |
| Bravado Battery Kiosk | A power stall where every cell is marketed as courageous. | Shield rechargers, battery loot, humming equipment jokes. |
| ComfortCo Warranty Clerk | A claims desk for old-world comfort products that failed politely. | Cot jokes, blanket loot, morale failure, refund bureaucracy. |
| OopsAll Claims Window | A logistics desk that can explain why the package is wrong but not where the correct one went. | Field caches, mislabeled crates, route errors, loot table flavor. |
| Exit Strategy Booth | A map and extraction-advice stall with confidence inversely related to accuracy. | Extraction panic, route cards, LZ complications, greed warnings. |
| HushTone Whisper Stall | A quiet-device vendor who speaks too softly near machines that listen too well. | Radio static, stealth jokes, Tattletale irony, signal flavor. |

## Writing Rules

- Do not mirror source trader names, biographies, or exact specialties.
- Prefer a vendor desk or faction voice over a singular important NPC unless a future feature needs one.
- Trader jokes should still communicate the mechanical effect: mood, greed, coins, stash overflow, shield confidence, or extraction risk.
- A trader should sound useful enough to visit and suspicious enough to be funny.
- If a vendor becomes a repeated runtime voice, add it here before adding more event hooks.

## Runtime Seeds

| Trader archetype | First event hooks |
|---|---|
| Pawn Desk | `hub_pawn_desk_cracked_mug_index`, `hub_pawn_clerk_squints`, `hub_pawn_desk_overflow_prophecy`, `extract_pawn_desk_valuation_intrusive` |
| Gear Weirdos | `hub_gear_weirdo_battery_pitch`, `hub_gear_weirdo_shield_pitch`, `deploy_gear_weirdo_recharger_demo` |
| Coupon Barons | `hub_coupon_barons_math`, `hub_coupon_barons_receipt_duel` |
| Nearly Fresh Counter | `hub_nearly_fresh_sample_table`, `hub_nearly_fresh_counter_sample_oath` |
| Bravado Battery Kiosk | `hub_bravado_battery_kiosk_tiny_spark` |
| ComfortCo Warranty Clerk | `hub_comfortco_cot_warranty` |
| OopsAll Claims Window | `hub_oopsall_claims_window_wrong_box`, `raid_oopsall_misdelivery_cache` |
| Exit Strategy Booth | `hub_exit_strategy_booth_bad_map`, `raid_exit_strategy_bad_map` |
| HushTone Whisper Stall | `raid_hushtone_static_confession` |
