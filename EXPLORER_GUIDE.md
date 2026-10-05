# LearnQuest Explorer - how to test EVERYTHING on your computer

## Quick start (Windows)
1. Extract the ZIP. Open the folder `LearnQuest_Jungle_Local_Node24_WindowsFix_v3\learnquest`.
2. Double-click **`START_EXPLORER_ALL.bat`**. (Needs Node.js 24 LTS. The first start may install a few small packages: no compiler, no Python.)
3. Your browser opens the **Explorer Hub**: `http://127.0.0.1:4000/explorer.html`.
4. Keep the black window open while you test. Close it (or Ctrl+C) to stop.

`START_JUNGLE_LOCAL.bat` still starts only the Jungle Run game on port 5177 (no accounts/dashboards). The Hub also opens there, but the pages that need the backend are marked.

## What the Hub gives you
| Tab | What you can do |
|---|---|
| **Start here** | One card for every page of the project (20). Cards that need a login are tagged. |
| **Demo accounts** | One button creates a parent (`demo.parent@learnquest.local` / `Demo@1234`) and 3 children (Aarav 8, Mia 5, Riya 11, PIN `1234`) with tasks, then lets you open the parent dashboard or any child dashboard with one click. |
| **Jungle Run** | Builds a link with the options you pick: explorer, graphics, grade, subjects, start world (day/sunset/night/dawn), lives, god mode, tutorial, touch buttons, test tools. |
| **Profile** | Shows and edits the saved player profile (coins, best score, grade, subjects, trail, achievements, tutorial flag). Unlock everything, start fresh, export / import JSON. |
| **Sound** | Buttons for every sound effect, and the music with mood, tempo and volume. |
| **Questions** | Generate sample questions for any subject / grade, check that each has 3 different options and one right answer. |
| **3D assets** | 3D gallery (runtime + original models, clips, wireframe) and the characters Lab. |
| **Self-check** | Runs about 25 automatic checks of the real game on your PC and measures real FPS at every graphics level. Press **Copy report** and send it to me if anything looks wrong. |
| **Documents** | Reads the reports from inside the Hub. |

## Inside the game
| Key | Action |
|---|---|
| **F9** | Test tools: god mode, lives, speed, give any power-up, put coins / Enigma / rock / beam in front of you, call the question board now (any subject), jump to day / sunset / night / dawn, +300 m, unlock everything, replay tutorial |
| **F2** | Lab: Boy / Girl, every animation clip, original vs gameplay root motion, camera views |
| M / P | sound / pause |
| arrows, WASD, Space | lanes, jump, slide |

Useful link options (add to `/jungle-local-preview.html`): `?lang=hi` (हिन्दी) `?lang=mr` (मराठी) `?lang=en` `?tools=1` `?god=1` `?lives=9` `?grade=3` `?subjects=science,spelling` `?biomeStart=1200` `?character=girl` `?quality=low` `?lab=1` `?touch=1` `?tutorial=1` `?notutorial=1` `?seed=123`. These test options never change your saved profile (except what you do in the game).

## Where things are stored
* **Player profile / sound settings**: your browser (`localStorage`), per browser. The Profile tab shows and edits it.
* **Parents, children, tasks, rewards, runs**: the file `backend\learnquest-explorer.sqlite` (created on first start). Delete the file for a clean database. Your real database (if any) is never used by this launcher.
* The self-check runs in a private sandbox and does not touch either.

## Under the hood (what was changed to make this possible)
* The backend used `better-sqlite3`, which needs a compiler on Windows. It now falls back to Node's built-in `node:sqlite` when that package is not installed (`backend/db/sqlite-driver.js`). MySQL/Railway behaviour is unchanged.
* `backend/node_modules` ships with pure-JavaScript packages only, so no `npm install` is needed to start. `better-sqlite3` is now an optional dependency.
* The server binds to `127.0.0.1` in explorer mode (not reachable from other computers).
* Original versions of every pre-existing file that was changed are in `original_v3_backup/`.

## If something does not work
* "Port already in use": another copy is running. Open the address again, or `set EXPLORER_PORT=4001` before the BAT.
* Blank 3D view: update the browser / graphics driver (WebGL 2 is required). The Hub's top badge shows your graphics device.
* Slow: open Self-check, read the recommended quality, then use `?quality=low`.

## Languages
The game speaks English, Hindi and Marathi: use the three buttons in the menu, or open it with `?lang=hi` / `?lang=mr`. Science and spelling questions are English-language content on purpose.

## Note on Maths Kingdom
Its level 1 is locked for a new child until the Jungle world is finished. "Create / repair demo family" unlocks all levels for the demo children (explorer mode only).

## Slow computer?
Open `/selftest.html`: it measures the real frame rate at every graphics level and has an **Apply ... to my game** button. In the game, Settings -> **Graphics** lets you choose Auto / High / Balanced / Low. Auto also lowers the picture sharpness by itself whenever the game would otherwise stutter.

## Automatic quality: how it decides
On the first start the game checks the device (graphics card, screen, memory, CPU), then tests the real game for a few seconds at Ultra (4K) / High (2K) / Full HD / HD / Minimal and keeps the best level that stays smooth. The result is remembered for this device. See it in Settings -> Graphics -> "Your device", or in the Hub -> Device tab; re-measure with "Analyse this device again". Choosing a level yourself always overrides the automatic choice.

## Core engine in C / C++ / Python / Java
See `native/README.md`. In short: the browser game uses JavaScript plus a 2.9 KB C/C++ WebAssembly module (particles and collisions) that is switched on automatically and checked against the JavaScript at start-up; Python and Java ports exist for servers and apps and are proven identical with `sh native/run_all_tests.sh`. They do not change the frame rate (the game logic costs ~0.1 ms of a 16.7 ms frame; the GPU is the limit).

## Engine on the server (Python)
`/api/engine/*` makes questions from a seed and checks answers on the server, using a Python worker when Python is installed (otherwise JavaScript, identical results). Try it in the Hub -> "Backend engine"; details in `backend/engine/README.md`. `npm run engine:test` runs its tests.

## Apps and platforms
`PLATFORMS.md` explains how to install the game as a web app, build the Android and iPhone apps (`mobile/`) and the Windows / macOS / Linux app (`desktop/`). The Hub's Device tab shows what kind of app and operating system you are running in, and whether offline mode is active.

## The teacher
A friendly teacher runs behind the child. Mistakes bring her closer, right answers push her back; if she catches up she asks a rescue question (right = free, wrong = one heart). She also "asks" the question boards. Switch her off in Settings -> Teacher chase. In the F9 test tools: "Teacher catches me" and "Teacher far".
