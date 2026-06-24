# Field Phenomena

Field phenomena are the weird surface conditions, landmarks, and repeated environmental bits that make raids feel like more than empty loot rooms.

They should be readable at comms-log speed: a strange thing happens, the raider interprets it badly, and the raid gets funnier or worse.

## Landmarks

| Landmark type | AFK identity | Content hooks |
|---|---|---|
| Damaged dam | A big civic promise currently leaking through several metaphors. | Water events, low-danger loot, sudden footing trouble. |
| Buried shopping district | Retail archaeology with escalators that still have opinions. | Junk loot, defunct brands, greed events. |
| Failed transit hub | Departure boards, blocked tunnels, and routes that insist they are delayed, not dead. | Deployment echoes, extraction reroutes, route signs. |
| Soggy tower | Vertical greed with wet stairs and backpack physics. | Highrise events, fall risk, valuable top-floor bait. |
| Warning-sign museum | A place where every safety sign failed and then became collectible. | Greed bumps, warning-label jokes, machine rooms. |

## Conditions And Oddities

| Phenomenon | Canon identity | Content hooks |
|---|---|---|
| Apology Weather | Rain, dust, or static that seems sorry while making everything worse. | Mood penalties, low visibility, extraction tension. |
| Tremor of Bad Priorities | Ground movement that rearranges loot into worse moral choices. | Greed events, forced detours, danger-level flavor. |
| Humming Crate Migration | Crates appear in places that imply intent. Everyone chooses to ignore that implication. | Loot temptation, robot bait, high-greed events. |
| Signal Shadow | Radio dead spots where Handler advice arrives late and weirdly confident. | Signal Handling flavor, failed calm/pressure comedy. |
| Overtime Red | A high-danger field mood where the world looks like it stayed past closing and wants revenge. | High danger events, extraction pressure, rare robot pressure. |
| Polite Glyphs | Strange markings that appear to be warnings but have customer-service energy. | Field notes, greed decisions, lore flavor. |

## Runtime Uses

- Zone conditions can use these as danger wrappers.
- Raid events can use landmarks as quick scene-setting.
- Extraction events can turn field phenomena into route complications.
- Loot text can imply old infrastructure is still trying to enforce policy.

## Runtime Seeds

### Landmarks

| Landmark | First event hooks |
|---|---|
| Damaged dam | `raid_damaged_dam_leak_math` |
| Buried shopping district | `raid_buried_retail_escalator_bait` |
| Failed transit hub | `raid_failed_transit_departure_board`, `extract_failed_transit_reroute` |
| Soggy tower | `raid_soggy_tower_top_floor_bait`, `extract_soggy_tower_backpack_physics` |
| Warning-sign museum | `raid_warning_sign_museum_collection` |

### Field Caches

| Cache type | First event hooks |
|---|---|
| Questionable field cache | `raid_questionable_field_cache_generous`, `extract_questionable_cache_second_thoughts` |

### Conditions And Oddities

| Phenomenon | Runtime condition ID | First event hooks |
|---|---|---|
| Apology Weather | `apology_weather` | `raid_apology_weather_forecast`, `extract_apology_weather_lz_slip` |
| Polite Glyphs | `polite_glyphs` | `raid_polite_glyphs_customer_service` |
| Signal Shadow | `signal_shadow` | `extract_signal_shadow_late_advice` |
| Tremor of Bad Priorities | `tremor_bad_priorities` | `raid_tremor_bad_priorities_shuffle` |
| Humming Crate Migration | `humming_crate_migration` | `raid_humming_crate_migration_bait`, `extract_humming_crate_last_wave` |
| Overtime Red | `overtime_red` | `extract_overtime_red_closing_time` |