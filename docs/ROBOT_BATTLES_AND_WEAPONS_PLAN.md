# Robot Battles And Weapons Plan

This document tracks the move from instant robot encounters to short deterministic robot battles with legally distinct parody weapons. The goal is combat depth without turning AFK Raiders into a tactical combat game. The comms log stays the product; battles should create better stories, not UI micromanagement.

## Design Contract
- Robots have health pools. HP controls how long a fight can last; `deadliness` and `menace` continue to define threat identity.
- Weapons improve Raider offense and battle pacing. They must not add passive toughness.
- Danger Level remains the main global risk lever for autonomous survival.
- Raider Level must not add HP, raw damage, shield strength, passive damage resistance, or major extraction safety.
- Positive mood remains the small robot-damage resilience trim after shield mitigation.
- Hiding in Lockers remains a tiny explicit robot mitigation.
- Shields, consumables, and Handler actions remain the meaningful survival levers, especially in High danger.
- Battles should be short enough for an idle text feed: weak robots can end quickly, while nasty/deadly robots can take multiple ticks and punish unattended wounded Raiders.

## Legal And Parody Constraints
- Use the ARC Raiders weapons page only for broad class inspiration such as pistol, hand cannon, SMG, assault rifle, battle rifle, shotgun, LMG, sniper, launcher, or odd energy weapon.
- Do not copy weapon names, descriptions, assets, lore text, icons, exact stat blocks, trademarked terms, or recognizable proprietary loadout details.
- Use original parody weapon names, ids, stats, and flavor text.
- Keep A.R.C. in AFK Raiders as the original in-world acronym: Aggressively Roaming Chassis.

## Phase 1: Robot HP And Active Battles
- Add `maxHp` to every robot in [src/content/robots.json](../src/content/robots.json).
- Add `ActiveRobotBattle` to `RaidState` and default it to `null` for new and migrated saves.
- Add a pure [src/engine/robotCombat.ts](../src/engine/robotCombat.ts) resolver for starting and advancing battles.
- Let [src/engine/tick.ts](../src/engine/tick.ts) advance an existing active battle before normal RAIDING flavor events.
- Preserve current instant `resolveRobotEncounter()` behavior until the battle path has enough tests and balance samples to replace it.

## Phase 2: Weapons
- Add [src/content/weapons.json](../src/content/weapons.json) with original parody weapon content.
- Start with one default weapon and a small class spread for content validation and future tuning.
- Suggested fields: `id`, `name`, `class`, `rarity`, `weight`, `baseDamage`, `accuracy`, `critChance`, `armorPierce`, `durability`, `fireRateStyle`, and `flavor`.
- Keep upgrades, mods, ammo, repair costs, and weapon loot drops out of the first implementation unless the base system feels too flat.

## Phase 3: Event Integration
- Convert robot encounter events from instant pass/fail resolution into battle-start events.
- Process active battles across later RAIDING ticks and pause normal raiding flavor while a fight is active.
- Award robot loot, robot defeat stats, Raider XP, and skill practice when the battle ends.
- Keep failure paths simple: victory, ongoing fight, or Raider downed. Add escape/flee only if tests show long fights feel sticky.

## Phase 4: UI
- Add a compact active battle display near the raid status surface.
- Show robot name, robot HP, equipped weapon, and short status.
- Keep comms primary and avoid turning combat into a dense management panel.
- Defer weapon inventory/equip UI until engine balance is stable.

## Balance Guardrails
- Robot battle duration should rise by deadliness tier.
- Starter weapons should not trivialize Medium or High danger.
- Higher-rarity weapons should improve offense, not broad survivability.
- Mood resilience and Hiding in Lockers can help, but High-danger robot damage should remain harsher than Medium baseline.
- Nasty and deadly robots can still down wounded low-progression Raiders.
- Weak, moderate, and dangerous robots remain nonlethal by tier rule unless the design contract changes intentionally.

## Verification Checklist
- Content tests validate robot HP and weapon schema.
- Pure combat tests validate battle start, hit/miss ticks, victory, and defensive mitigation.
- Tick tests validate active battle persistence, battle cleanup, and no overlapping normal RAIDING event while combat is active.
- Balance tests validate duration and damage curves once events are fully routed through battles.
- Run focused Vitest, then full Vitest, then `npm run build -- --logLevel warn`.
