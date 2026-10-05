# LearnQuest World 2 — Maths Kingdom

Added on 2026-08-30 as the next playable part after the original 10-level Jungle World.

## Player flow

1. Jungle World remains World 1.
2. The player completes Jungle Level 10: Jungle Guardian.
3. The backend automatically unlocks `maths_kingdom_lvl_1`.
4. The dashboard changes Maths Kingdom from locked to playable.
5. The player receives 10 new sequential levels.
6. Level 10 ends with the Number Dragon boss.

Existing players who had already completed `jungle_lvl_10` before this deployment are upgraded automatically at server startup.

## New levels

1. Castle Gate
2. Number Market
3. Fraction Bridge
4. Shape Courtyard
5. Multiplication Tower
6. Division Dungeon
7. Clockwork Hall
8. Geometry Garden
9. Royal Equation Hall
10. Boss Battle: Number Dragon

## New gameplay/content

- New procedural Three.js castle environment
- Royal barrel jump hazards
- Portcullis slide hazards
- Knight-shield lane blockers
- Broken drawbridge / moat jumps
- Swinging mace hazards
- Royal seal collection missions
- Maths-only learning gates
- Number Dragon boss with 6 HP
- 18 extra Maths questions (6 for each age group)
- Royal Cape, Baby Dragon and Crystal Sword rewards

## Database/deployment

No new SQL table or manual SQL import is required. The existing `worlds`, `game_levels`, `child_level_progress`, `game_runs`, and statistics tables are reused. Normal application startup upserts World 2 and its content into Railway MySQL.

The Railway root directory and environment variables do not change because of this World 2 update.
