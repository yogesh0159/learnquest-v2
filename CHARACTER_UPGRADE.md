# LearnQuest — reference explorer update

Based on LearnQuest_Character_Video_Processed(1).zip, on top of upgrade/realworld-v1
commit e9f0347. This package does not merge or deploy main.

## Included
- Two original, reference-inspired 3D GLB explorers with 14 animation clips each.
- Shared procedural fallback using the same outfits and joint animations.
- Both runners show the character's back in the direction of travel.
- Character Lab with all 14 states, front/back view, auto-rotation and pinch zoom.
- Async character switching cleanup: a disposed controller cannot add a late model.
- Backend lockfile synchronized with its existing dependency manifest.
- Rebuild source and script; no paid model service needed.

## Install and run
1. Use Node.js 24 (the project's declared runtime).
2. Open the `learnquest` folder and run `npm ci`.
3. Keep your existing environment variables/database configuration. For a fresh
   setup follow README.md and backend/.env.example. Never overwrite live secrets.
4. Run `npm start` and open http://localhost:4000/character-lab.html.
5. Select Boy and Girl, preview animations, then test Jungle Runner and Maths
   Kingdom using a human explorer profile.

For Railway preview, deploy the upgrade branch with the existing `learnquest`
root directory. The committed GLBs need no build step. Do not merge to main until
preview review is complete.

## Scope and limitations
The ZIP input contains 2D keyframes and motion-reference videos, not source
meshes. These delivered models are lightweight original approximations with
jointed parts, not exact image reconstruction, skin deformation, or captured
video motion. The 14 clips cover action categories; multiple camera views in
the original 40 videos do not require 40 different animation clips.

For higher-detail facial modeling or seamless elbows/knees, a sculpted and
skinned mesh remains a future art pass. This update provides an immediately
usable free character option without blocking the game on that work.

## Verification (2026-09-26)
- Historical Node 20 build: 62 automated tests passed.
- Project validation: 423 checks passed.
- Headless Chromium: both GLBs loaded, 28 animation buttons exercised, zero
  JavaScript page errors; 390px mobile viewport had no horizontal overflow.
- Controller runtime: replaying one-shot clips resets correctly; disposing
  during an async load leaves no late character in the scene; fallback works.
- Historical local Node 20/SQLite startup: API health, character lab, both model URLs, and
  the shared character module returned HTTP 200.
- Source ZIP is reference-only and was not modified.
- Railway/MySQL deployment and physical-device FPS are not validated here.
