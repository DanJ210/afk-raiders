# Shields MVP Plan

This document exists so coding agents can extend the shield feature without re-discovering the intended shape.

## Goal
- Add a starter shield system alongside HP.
- Add shield rechargers as current-raid backpack loot.
- Rechargers are manual-use backpack items, not automatic healing.
- Keep the feature deterministic, engine-first, and legally distinct from source inspiration.

## MVP Rules
- Every raider has one starter shield for now: `makeshift_confidence_shield`.
- Shield state lives on `RaidState.shield` so the engine can simulate charge changes deterministically.
- Active shields mitigate incoming damage before HP is reduced.
- Shields lose charge from incoming damage and durability from spent charge.
- Shield rechargers restore charge only. They do not repair durability.
- Returning to the hub restores the starter shield to full charge and full durability for the MVP.
- A future loadout/store loop can decide whether shields persist or are replaced before a raid starts.
- Shield rechargers are backpack items. If unused, they extract home like normal loot.
- Loot pickups can also grant bonus consumables: one healing-item roll and one shield-recharger roll are evaluated independently whenever backpack loot is awarded.
- These bonus rolls are independent, so a single loot pickup can grant normal loot plus one healing item plus one shield recharger.
- Home stash items remain non-usable; only current-raid backpack items can be applied.
- HUB fully restores shields and durability for now; later loadout/store systems can change that behavior.

## Engine Boundaries
- All shield math belongs in `src/engine/shields.ts`.
- HP damage paths must route through the shared shield helper rather than subtracting HP ad hoc.
- Current integration points are `applyEffects()` and `resolveRobotEncounter()` in `src/engine/eventResolver.ts`.
- Loot-bonus consumable rolls are triggered from `processTick()` in `src/engine/tick.ts` after a loot event successfully adds backpack loot.
- UI should never compute shield outcomes; it only renders state and dispatches manual use actions.

## Backpack Item Rules
- Existing backpack loot keeps its current shape.
- Shield rechargers add optional `kind: 'shield_recharger'` and `shieldChargeAmount` metadata on `BackpackItem`.
- Do not add special-case UI behavior to stash items. Usability is only for raid backpack items.
- `src/content/healing_items.json` and `src/content/shield_rechargers.json` remain canonical weighted tables for consumable type selection whenever a consumable is awarded.

## Acquisition Sources
- Healing items can be awarded from event effects (`effects.healingItem`) and from loot-bonus rolls.
- Shield rechargers can be awarded from event effects (`effects.shieldRecharger`) and from loot-bonus rolls.
- Keep both sources unless design explicitly switches to "bonus-on-loot only" progression.

## Testing Priorities
- Shield mitigation applies to negative HP event effects.
- Shield mitigation applies to failed robot encounters.
- Non-lethal robot safeguards still hold after shield mitigation.
- Rechargers can be found as backpack loot, manually consumed, and extracted if unused.
- Save migration backfills missing shield state on older profiles.

## Deferred Work
- Multiple shield tiers.
- Augment compatibility.
- Shield durability repair items.
- Loadout and home-stash equipment flow.
- Lifetime stats for shield recharger usage.