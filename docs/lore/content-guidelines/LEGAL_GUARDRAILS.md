# Legal Guardrails

This is a practical writing checklist, not legal advice. The project goal is original, legally distinct parody of extraction-shooter behavior.

## Allowed

- Original AFK Raiders names, factions, places, robots, jokes, and item flavor.
- Broad genre tropes such as looting greed, extraction panic, camping, supply drops, and dangerous machines.
- `A.R.C.` with periods when it means `Aggressively Roaming Chassis`.
- Short source-title references in planning conversation when needed to understand intake material.

## Not Allowed In Repo Content

- Copied source-wiki prose, codex text, mission text, item descriptions, screenshots, logos, or assets.
- Exact source character, faction, company, location, robot, or event names.
- Raw `ARC` in player-facing content. Use `A.R.C.` only for AFK's original acronym.
- The source game's title as marketing, metadata, app text, or runtime content.
- Hidden notes that preserve source lore text for later rewriting.

## Intake Transformation

Use this sequence when reading outside lore:

1. Identify the broad function: hub, route, machine role, disaster, social group, resource pressure, or joke target.
2. Ignore the exact name and prose.
3. Write an AFK-original equivalent in [../PARODY_MAPPING.md](../PARODY_MAPPING.md) or [../BACKLOG.md](../BACKLOG.md).
4. Add runtime content only after the AFK version can stand without the source page.

## Pre-Commit Check

- Search `src/content/` for source-specific terms before merging.
- Run the content validation tests after adding or changing content.
- Confirm every new recurring lore idea appears in this wiki or the backlog.
- If a name feels like it only works because the player knows the source, rewrite it until the joke works inside AFK Raiders.