# LearnQuest RealWorld V1 Roadmap

> Updated 2026-09-28: the user-supplied blue/pink hoodie concept is now the visual
> target. See [the reference development roadmap](frontend/assets/reference/ROADMAP.md)
> for the ordered milestones and acceptance gates. The khaki models are prototypes,
> not approved final character art. Review at `/reference-studio.html`.


## Goal
Build a premium, child-safe 3D learning game that parents and schools can confidently recommend because educational progress is measurable, gameplay is genuinely fun, and the experience runs well on ordinary phones and school computers.

## Product principles
1. Learning is part of the world, not a quiz pasted on top of a game.
2. Realistic-cartoon child explorers; no photoreal child face cloning in V1.
3. Parent and teacher visibility into progress, strengths, weak areas and screen time.
4. Mobile-first performance with quality tiers and graceful fallback.
5. Server-authoritative progression and anti-cheat protections.
6. Safe-by-design child accounts and privacy-minimizing data collection.

## Phase 1 — Character foundation
- Add boy/girl explorer presets.
- Add rigged GLB/glTF character loader using Three.js GLTFLoader.
- Animation state machine: idle, run, sprint, jump, land, slide, left/right dodge, hit, fall, victory.
- Keep invisible gameplay collider separate from visual character mesh.
- Procedural current character remains as fallback when a 3D asset fails.
- Character choice persists through existing child profile avatar field first; normalize to dedicated character fields later.

## Phase 2 — Reusable game engine
Refactor giant world-specific runner files into reusable modules:
- AssetManager
- CharacterController
- AnimationController
- InputController
- CollisionSystem
- CameraController
- AudioManager
- LearningGateSystem
- MissionSystem
- RewardSystem
- PerformanceManager

Worlds should provide content/config rather than duplicate engine code.

## Phase 3 — Real-world environments
Jungle:
- Optimized trees, rocks, ruins, bridges, waterfalls, rivers, birds, grass, fog, particles and light shafts.
- LOD, instancing, pooled obstacles and compressed textures.

Maths Kingdom:
- Real castle kit, drawbridge, moat, halls, dungeon and dragon arena.

## Phase 4 — Learning-through-world gameplay
Examples:
- Shop and change: calculate money while buying items.
- Road signs: language and vocabulary challenges.
- Clock tower: read time to open routes.
- Bridge builder: geometry and measurement.
- Recycling mission: science/environment sorting.
- Map navigation: directions, distance and logical reasoning.

## Phase 5 — School-ready learning system
- Teacher role and school/class dashboard.
- Curriculum/grade/subject assignments.
- Diagnostic baseline assessment.
- Adaptive difficulty based on accuracy, response time and repeated mistakes.
- Weekly parent report and teacher progress report.
- Mastery map by skill.
- Homework/mission assignment.
- Classroom-safe leaderboard options controlled by teachers.
- CSV/PDF progress exports.

## Phase 6 — Production hardening
- Tighten CSP; remove unsafe-inline/unsafe-eval where possible.
- Correct production CORS policy.
- Migrate auth away from long-lived localStorage bearer-only design where practical.
- Signed/server-validated gameplay events for score, distance, keys and coin integrity.
- Error monitoring and deploy observability.
- Database backup/restore drills.
- Accessibility and low-power graphics mode.
- Automated browser smoke tests.

## Asset requirements for premium characters
For each explorer model:
- GLB/glTF, rigged skeleton.
- Optimized mobile mesh and materials.
- PBR textures, compressed when production pipeline is ready.
- Animation clips with stable names or a mapping manifest.
- Commercial-use license owned/approved by the project.

Suggested target budgets for V1:
- Character: roughly 20k–60k triangles on high tier; lower LOD for mobile.
- Texture sets: mostly 1K–2K, not 4K everywhere.
- Avoid excessive skinned meshes/material draw calls.

## Deployment workflow
- Keep `main` production-safe.
- Develop on `upgrade/realworld-v1`.
- GitHub CI must pass before merging.
- Use Railway preview/deployment logs and `/api/health` before production promotion.
- Production secrets stay in Railway variables, never GitHub.

## Access needed
Already available:
- GitHub repository read/write access.

Helpful next connection:
- Railway plugin for service status, deploys, logs, metrics and environment configuration checks.

External asset pipeline eventually needed:
- Approved/licensed 3D character and environment assets (or custom-created assets exported as GLB).
- Optional object storage/CDN if asset size grows beyond practical app-bundle limits.

## RealWorld V1 acceptance criteria
- Boy and girl explorer selection works.
- Correct explorer loads in Jungle and Maths Kingdom.
- Animation transitions have no obvious snapping.
- 60 FPS target on capable desktop/mobile; stable playable fallback on lower-end devices.
- No progression loss when a 3D asset fails.
- Existing 20 levels, learning gates, XP, coins, rewards and parent flows remain functional.
- CI and Railway health remain green before merge.
