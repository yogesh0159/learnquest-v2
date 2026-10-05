# LearnQuest — Codex + GPT-6 Astra Handoff

This file is the working brief for agent-assisted development on branch `upgrade/realworld-v1`.

## Non-negotiable safety rule

Do not push experimental RealWorld work directly to `main`. Work on `upgrade/realworld-v1` (or a child feature branch), run checks, review the diff, then merge only after CI and Railway preview checks are green.

## Current baseline

- Production branch: `main`
- Upgrade branch: `upgrade/realworld-v1`
- Stack: Node 24, Express, MySQL production, SQLite fallback, plain HTML/CSS/JS, Three.js 0.185.1
- Existing worlds: Jungle + Maths Kingdom
- Existing progression: 20 playable levels, server-checked learning answers, XP/coins/rewards, parent dashboard
- New RealWorld foundation already present:
  - boy/girl explorer presets
  - `frontend/js/game/character-controller.js`
  - GLB loader + animation alias mapping + procedural fallback
  - `/character-lab.html`
  - local Three.js add-on serving
  - parent weekly learning-plan insights
  - tightened production CORS behavior

## Primary mission

Transform LearnQuest from a procedural runner with quiz gates into a premium, measurable learning world that is attractive enough for children and useful enough for parents/schools to recommend.

The experience must stay child-safe, fast on ordinary phones/school computers, original in visual identity, and measurable in educational outcomes.

## Work package A — integrate the new explorer into both runners

1. Refactor Jungle and Maths Kingdom player visuals to use `CharacterController`.
2. Do not tie collision to the visual mesh; keep existing gameplay collision behavior stable.
3. Map runner events into animation states:
   - run/sprint
   - jump/land
   - slide
   - left/right dodge
   - hit/fall
   - victory
4. Use `state.child.avatar` to select `human_boy_v1` / `human_girl_v1`.
5. Keep current procedural runner character as an emergency fallback until the new controller is proven.
6. Add cleanup/disposal on exit/restart.
7. Preserve equipped rewards or document any reward incompatibility before changing behavior.

Acceptance:
- both existing worlds remain playable;
- no progression or API regression;
- missing GLB never blocks the game;
- mobile controls remain functional;
- `npm run check` and `npm test` pass.

## Work package B — split the monolithic runners into reusable engine modules

Create a migration path toward:

```text
frontend/js/game/
  core/
    game-engine.js
    asset-manager.js
    performance-manager.js
    input-controller.js
    camera-controller.js
    collision-system.js
    audio-manager.js
  character/
    character-controller.js
    animation-controller.js
  learning/
    learning-gate-system.js
    mission-system.js
  world/
    world-runtime.js
    jungle-config.js
    maths-kingdom-config.js
```

Do this incrementally. Avoid a single giant rewrite. Extract one stable subsystem at a time and keep the game runnable after every commit.

## Work package C — real-world learning missions

Prototype at least three missions that teach through world interaction rather than a detached quiz overlay:

1. **Market Mission** — money/change, quantities, budgeting.
2. **Bridge Builder** — shapes, measurement, estimation.
3. **Road & Language Mission** — vocabulary, signs, directions.

Every mission needs:
- explicit learning objective;
- age-group tuning;
- measurable attempt/correct/mastery data;
- short explanation after mistakes;
- no pay-to-win effect on learning outcomes;
- parent-visible progress.

## Work package D — school-ready foundation

Design, then implement behind a feature flag:
- school
- teacher
- class
- student membership
- curriculum skill mapping
- assignments
- class progress summary

Before writing schema migrations, document privacy boundaries. Minimize child data. Avoid collecting real-child photos/biometrics by default.

## Work package E — anti-cheat / trustworthy progress

Current learning answers are server-verified but several run metrics originate on the client.

Upgrade toward server-verifiable run integrity:
- issue a run nonce/session at start;
- sequence important gameplay events;
- validate impossible score/coin/key rates;
- reject duplicate/out-of-order completion events;
- keep educational mastery independent from cosmetic reward cheating;
- add tests for tampering scenarios.

Do not introduce invasive device fingerprinting.

## Work package F — performance

Target tiers:
- High: modern desktop / capable phone
- Balanced: ordinary midrange phone
- Low: school Chromebook / low-power Android

Add runtime quality selection based on measured frame time, not only screen width. Prefer instancing, pooling, compressed textures and LOD over simply reducing all visual quality.

## Work package G — production hardening

- continue removing inline scripts/styles so CSP can drop `unsafe-inline`;
- move away from long-lived bearer tokens in localStorage where practical;
- keep secrets only in Railway environment variables;
- add browser smoke tests for login → level start → answer → complete;
- add structured client error reporting hooks without leaking child data;
- add backup/restore runbook for production MySQL.

## Required commands before PR completion

From `/learnquest`:

```bash
npm run check
npm test
```

For browser/game changes also manually test:

- parent signup/login
- create boy explorer
- create girl explorer
- child PIN login
- `/character-lab.html`
- Jungle Level 1
- jump/slide/lane controls
- one correct learning gate
- one wrong learning gate
- level completion persistence
- Maths Kingdom progression
- parent dashboard weekly learning coach
- mobile viewport

## Recommended Codex task prompt

Use this prompt in Codex on `upgrade/realworld-v1`:

> Continue LearnQuest RealWorld V1 from `CODEX_ASTRA_HANDOFF.md`. First inspect the repository and current diff against `main`. Do not rewrite working systems blindly. Implement Work Package A completely: integrate `CharacterController` into Jungle and Maths Kingdom while preserving collision, progression, rewards, mobile controls and fallback behavior. Then run `npm run check` and `npm test`. Fix all failures. Review your own diff for regressions, performance problems, unsafe child-data handling and duplicated runner logic. Commit in small logical steps and leave a concise report of changed files, tests and remaining asset dependencies. Do not merge to main.

## Recommended Astra task prompt

When GPT-6 Astra is available in Codex/Work, use it for the harder architecture pass:

> Act as lead game engineer, education-product architect and production reviewer for LearnQuest. Work only on `upgrade/realworld-v1`. Read `REALWORLD_V1_ROADMAP.md` and `CODEX_ASTRA_HANDOFF.md`, inspect the full codebase and current diff against `main`, then produce and execute an incremental plan for Work Packages B, C, E and F. Preserve existing 20-level progression. Prioritize measurable learning outcomes, child privacy, server-verifiable progress, mobile performance and original game identity. Avoid a big-bang rewrite. After every subsystem extraction keep the app runnable. Add tests for each extracted pure subsystem and tampering checks. Run all project checks and provide a final risk list before any merge recommendation.

## Asset dependency

Code can proceed without final art because the new controller has a procedural fallback. Premium visual completion still requires approved licensed/custom GLB files at:

- `frontend/assets/characters/boy-explorer.glb`
- `frontend/assets/characters/girl-explorer.glb`

Do not download random copyrighted characters from games or films.
