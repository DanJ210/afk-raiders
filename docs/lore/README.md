# AFK Raiders Lore Wiki

This folder is the versioned source of truth for AFK Raiders parody canon. It is where we translate outside inspiration, extraction-shooter tropes, and player-facing comedy ideas into legally distinct AFK Raiders names, rules, tone, and content hooks.

Do not commit copied source-wiki prose, screenshots, logos, codex text, or exact source names here. Public lore pages can be used as intake, but this repo stores only original AFK Raiders canon.

## Index

- [Parody Mapping](PARODY_MAPPING.md): canonical trope-to-AFK equivalent table.
- [World History](entities/world-history.md): unreliable AFK eras and old-world context hooks.
- [Desperanza](entities/desperanza.md): underground hub infrastructure and social texture.
- [Factions And Brands](entities/factions-and-brands.md): survivor groups and defunct old-world brands.
- [Traders](entities/traders.md): Desperanza vendor archetypes and future shop voices.
- [Robots](entities/robots.md): A.R.C. chassis roster, deadliness tiers, and content hooks.
- [Zones](entities/zones.md): original zone identities, condition hooks, and danger-level tone.
- [Field Phenomena](entities/field-phenomena.md): surface landmarks, oddities, and condition hooks.
- [Skills](entities/skills.md): autonomous Raider and Handler skill identities.
- [Legal Guardrails](content-guidelines/LEGAL_GUARDRAILS.md): required checks before adding content.
- [Tone Voice](content-guidelines/TONE_VOICE.md): deadpan comedy and writing patterns.
- [Backlog](BACKLOG.md): approved AFK-original lore/content ideas not yet converted into runtime JSON.

## Workflow

1. Read source material only as reference intake.
2. Reduce it to a general function, trope, or design need.
3. Create an original AFK Raiders equivalent in [PARODY_MAPPING.md](PARODY_MAPPING.md) or [BACKLOG.md](BACKLOG.md).
4. Add runtime text only after the concept is AFK-original and fits the tone guide.
5. Put game-facing text in `src/content/*.json`; keep engine logic text-free.

## Canon Boundaries

- AFK Raiders is an affectionate parody of extraction-shooter behavior, not a lore-compatible alternate universe for another game.
- A.R.C. means `Aggressively Roaming Chassis` in this project.
- `src/content/` is still the runtime source of comms lines, loot flavor, zones, robots, and event templates.
- This wiki explains why content exists and how to write more without drifting into copied source lore.