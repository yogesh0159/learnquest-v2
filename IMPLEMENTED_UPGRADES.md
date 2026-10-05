# LearnQuest 3D Runner — Implemented upgrade checklist

## Core runner
- [x] Three.js perspective 3D game
- [x] 3-lane forward runway
- [x] auto-run
- [x] left/right lane changes
- [x] jump
- [x] slide/down
- [x] keyboard controls
- [x] swipe controls
- [x] on-screen mobile controls
- [x] pause/resume
- [x] mute/sound toggle

## Focus gameplay
- [x] one-hit collision game-over gameplay
- [x] jump logs
- [x] slide branches
- [x] lane-blocking boulders
- [x] broken-path/pit jumps
- [x] moving/swinging hazards on harder levels
- [x] two-lane blocking patterns
- [x] increasing speed
- [x] combo score
- [x] age-group speed tuning
- [x] checkpoint feedback at learning gates

## 3D visuals
- [x] dynamic perspective runway
- [x] shadows and lighting
- [x] fog/depth
- [x] procedural low-poly jungle trees
- [x] coconut grove visuals
- [x] river/water-side visuals
- [x] ruins/pillars
- [x] cave/mountain rocks
- [x] temple color themes
- [x] drifting leaf particles
- [x] stylized animated explorer
- [x] run animation
- [x] jump/slide pose changes
- [x] fox starter cosmetic
- [x] parrot pet cosmetic
- [x] jungle cape cosmetic
- [x] wooden sword cosmetic
- [x] 3D Jungle Guardian boss

## Missions and rewards
- [x] level-specific mission targets
- [x] coins
- [x] golden keys
- [x] shield pickup
- [x] coin magnet pickup
- [x] double-score/focus pickup
- [x] speed-rush pickup
- [x] 3-star completion system
- [x] XP + coin rewards
- [x] next-level unlock
- [x] replay support
- [x] best score/stars/accuracy/combo stored

## Learning integrated into gameplay
- [x] questions appear as three answer lanes
- [x] correct answer is guaranteed to be among three shuffled runner choices
- [x] backend validates answer; client never receives correct-index flag
- [x] wrong normal-level answer crashes the run unless shielded
- [x] boss learning battle uses Guardian HP and child lives
- [x] age-group-specific questions
- [x] Maths / English / GK gates
- [x] question activity written to parent analytics

## Reward shop integration
- [x] unlock rewards
- [x] equip rewards
- [x] one equipped item per slot
- [x] equipped loadout returned by child API
- [x] Guardian Shield power
- [x] Coin Magnet power
- [x] Focus Charm power
- [x] Parrot pet visible in runner
- [x] Cape visible in runner
- [x] Sword visible in runner
- [x] starter Forest Fox cosmetic automatically owned/equipped

## Database / backend
- [x] Railway MySQL support
- [x] automatic schema creation
- [x] SQLite fallback
- [x] automatic seed/upsert
- [x] game_runs table
- [x] game_run_answers table
- [x] level_run_stats table
- [x] child_equipped_rewards table
- [x] stale active run cleanup
- [x] crash logging
- [x] run completion validation
- [x] daily game minutes
- [x] streak updates
- [x] parent runner analytics

## Originality
This project uses runner mechanics inspired by the general endless-runner genre. All code, procedural geometry, level presentation, UI, characters and environment assets in this build are original LearnQuest implementations and do not include Temple Run art/assets/branding.


## World 2 — Maths Kingdom (2026-08-30)
- [x] Maths Kingdom activated as the second playable world
- [x] Unlock requires completion of Jungle Level 10
- [x] Cross-world progression unlocks Maths Kingdom Level 1 automatically
- [x] Existing Jungle graduates are reconciled automatically during seed/startup
- [x] 10 new Maths Kingdom levels
- [x] Castle Gate, Number Market, Fraction Bridge, Shape Courtyard
- [x] Multiplication Tower, Division Dungeon, Clockwork Hall
- [x] Geometry Garden, Royal Equation Hall, Dragon Tower
- [x] Procedural 3D castle environment
- [x] Royal barrel, portcullis, knight shield, moat gap and swinging mace hazards
- [x] Royal seal mission collectibles
- [x] Maths learning gates integrated into all 10 levels
- [x] Number Dragon boss with 6 HP and 8 learning gates
- [x] 18 new Maths questions across ages 4-6, 7-9 and 10-12
- [x] Royal Cape reward
- [x] Baby Dragon pet reward
- [x] Crystal Sword reward
- [x] Dashboard shows per-world unlock state and completion progress
- [x] Jungle boss result links directly into the newly unlocked Maths Kingdom
- [x] Backend remains schema-compatible with the existing Railway MySQL database
