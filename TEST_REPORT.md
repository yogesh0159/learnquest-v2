# TEST_REPORT.md

## Environment actually used
- Linux sandbox, **Node.js 22.22.2** (Node 24 was not available there), npm 10.9.7
- Chromium 141 (Playwright), WebGL 2 through **SwiftShader software rendering** (no GPU)
- Real HTTP server (`scripts/jungle-local-server.js`) on `127.0.0.1:5177`, real keyboard/mouse events through the browser

**Not tested:** real Windows, the `.bat` launcher executing, Node 24 itself, real-GPU frame rate. SwiftShader is far too slow to give meaningful FPS, so the game was stepped deterministically (`LQ_JUNGLE.advance(seconds)`) and frames were rendered on demand.

## Commands run
| Command | Result |
|---|---|
| `node scripts/jungle-local-server.js` | starts; `GET /__health` -> `{"ok":true}`; GLB served with `Content-Length` + `ETag` |
| `node scripts/test-jungle-run.mjs` (`npm run jungle:test`) | **14 / 14 passed** |
| `node scripts/validate-project.js` (existing project validator) | **passed (470 checks)** |
| Playwright gameplay suite (below) | **27 / 27 passed** (includes the 'all 3 lane centres are on the flat walkway' check) |
| Playwright real-input suite | **16 / 16 passed** |
| `npm install` | Not required: `node_modules/three` ships in the ZIP (BAT runs `npm install --ignore-scripts` only if missing). Dependency install was exercised separately for the asset pipeline tools (`@gltf-transform/*`, `sharp`, `meshoptimizer`). |

## Boot / visual checks (screenshots reviewed)
Road visible and continuous; boy and girl visible from behind; textures load; trees, bushes, rocks, torches visible; coins visible; board visible with dynamic text; rock + beam obstacles visible. Console output on boot is the expected `[LearnQuest] ...` log (all 8 props + character loaded, 12 animation aliases mapped, "Jungle ready") with **0 errors and 0 warnings**.
Bugs found and fixed during testing: sky dome clipped by the far plane; ground texture blobs too large; torch flames washed out to cream (light placement + emissive patch + halo opacity); **board centre post hid half of the question text** (text plane moved in front of it); answer plaque clipped by the pillar (narrowed); coin/torch polygon budget reduced.

## Gameplay suite (27 checks, all PASS)
coin collected in own lane / not in other lane / removed from pool; Golden Enigma collected -> token counter + x2 multiplier; rock hit costs a life and plays HIT then returns to RUN; jumping over a rock = no damage; sliding under the beam = no damage; standing into the beam = damage; slide pressed in the air fast-falls then slides; last life -> FALL animation -> game-over screen; restart resets state; **180 s simulated run: 220 tiles recycled, 2,455 m, worst seam error 1.3e-13 m, never more than 2 of 3 lanes blocked, object pools bounded (<=50 collectibles, <=11 obstacles), GPU geometry/texture counts unchanged (11/24 before and after = no leak), no NaN, 13 question zones**; girl rig loads with HIT mapped to `Hit_in_Back_While_Running`; root motion verified neutral (girl slide z 3.436 -> 0, hit z 2.348 -> 0); lab/orbit mode toggles; canvas + camera follow a resize to portrait (420x800, FOV widens); no console errors/warnings.

## Question system
Zone spawned on its reserved tile with `4 x 4 = ?  12 / 16 / 20`; running the correct lane -> `CORRECT`, +100 score; wrong lane -> `WRONG`, life lost (verified separately in the collision tests since this run used invulnerability). Same seed gives the same question. Generator: 20,000 random questions at levels 1-4 -> always exactly 3 unique non-negative options with exactly one correct.

## Real-input suite (16 checks, all PASS)
Enter starts; Left/A/Right/D lane moves; Up/W/Space jump; Down/S slide; P pauses and resumes; Esc + Resume button; mouse-swipe left changes lane; no console errors.

## Measured render load (renderer.info, mid-run, includes shadow pass)
| Tier | Draw calls | Triangles |
|---|---|---|
| high | 152 | 2.30 M |
| balanced | 127 | 1.68 M |
| low | 113 | 1.40 M |

## Not covered
Touch devices, audio (none), long real-time sessions on a GPU, Safari/Firefox (Chromium only), the Windows launcher.

## Update 1 (lane fix)
Measured walkway by raycast before the fix (flat only to |x| ~ 2.0, wall at 0.19 m from |x| = 2.2) and after (flat to +-2.95 m, lanes need 2.62 m). Left- and right-lane screenshots show the character on the paving. Joint hairline gap verified gone by screenshot. Board re-checked on the wider road.

## Update 2 (sound and music) - audio suite, 34 checks, all PASS
Offline-rendered every effect (13) and 16 bars of music in both moods and measured them: audible (peak > 0.03), never above 1.0, no NaN, and silent at the end of the buffer (no stuck notes); quiz mood measurably calmer than run mood (RMS 0.012 vs 0.023, before makeup gain). Live context: locked before any gesture; the first key press unlocks it and starts the music; jump/slide/lane/coin/hit events each trigger their sound; M mutes/unmutes, mute is persisted; 500 rapid coin sounds are rate-limited (voices stay <= 90); pause suspends and resume restarts audio; game over stops the music and plays the jingle; restart brings the music back; no console errors.
Problems the measurements exposed and that were fixed: the lane swish was practically silent (peak 0.00) and jump/slide/click too quiet (filtered noise loses most of its energy), the pause bug described in section 10, and clipping of overlapping sounds (now limited; preview peak 0.88, 0 clipped samples). Gameplay (27) and real-input (16) suites were re-run after the audio hooks: still all PASS.
**Not verified:** how it actually sounds. Levels and structure are measured; taste is not. Real speakers/headphones, Safari/Firefox audio behaviour and mobile autoplay rules were not tested.

## Updates 3-5 - final regression (all run on the final code)
| Suite | Result |
|---|---|
| Node unit tests (`npm run jungle:test`) | **26 / 26** - includes 25,000 random questions across 5 subjects, pattern/spelling correctness, grades, profile persistence incl. corrupt storage, trails, achievements, biome cycle continuity |
| Existing project validator | **passed (479 checks)** |
| Gameplay (`t_full.py`) | **27 / 27** |
| Real keyboard / swipe input (`t_keys.py`) | **16 / 16** |
| Audio (`t_audio.py`) | **36 / 36** |
| Lab viewer + power-ups + combo (`t_b1.py`) | **21 / 21** |
| Settings, subjects, review, trail, achievements, read-aloud, reduce-motion (`t_b2.py`) | **22 / 22** |
| Biomes, fireflies, speed lines (`t_b3.py`) | **12 / 12** |

Highlights: Lab lists 13 clips for the Boy and for the Girl, and switching characters works; original vs neutralised `slide_light` drift 4.01 m vs 0.007 m; all four power-ups granted by four Enigmas; magnet pulls far-lane coins; shield absorbs exactly one hit; slow time cuts speed 7.9 -> 4.8 m/s; settings and profile survive a reload; only the selected subjects are asked; wrong answers are spoken (stand-in speech engine) and appear in the end-of-run review; biome fog steps are smooth (max 0.013 per 2 m).
**Problems found by these tests and fixed**: duplicate wrong options for vowel spelling questions; Lab camera facing away from the character on first open; question text overflowing the board (now wraps and fits); an `unlock` race that kept music playing during pause (Update 2). Two older test expectations were updated on purpose: an Enigma now grants a random power-up (not always x2 coins), and the long gameplay test now switches question boards off so a random wrong answer cannot end the run mid-test.
**One false alarm**: "Failed to fetch" seen after reload turned out to be the test navigating twice, not a game bug; the server keep-alive / loader retry hardening was kept anyway.

## Update 6 (tutorial, touch, report) - final regression on the final code
| Suite | Result |
|---|---|
| Node unit tests | **32 / 32** (adds per-subject tally, report advice, profile reset, tutorial state machine incl. timeouts and skip) |
| Validator | **passed (481 checks)** |
| Gameplay | **27 / 27** |
| Keyboard / swipe input | **16 / 16** |
| Audio | **36 / 36** |
| Lab + power-ups | **21 / 21** |
| Settings / subjects / review | **22 / 22** |
| Biomes | **12 / 12** |
| Tutorial + touch + report (`t_b4.py`) | **31 / 31** |

`t_b4.py` runs a fresh profile through the whole tutorial (each step advances on the right input, wrong inputs are ignored, coins appear, the road fills in afterwards, the question board comes a few tiles later, no tutorial on the 2nd run, replay and Skip work, and 90 s of doing nothing still finishes it). A phone-sized touch context (844x390, `has_touch`) was used for the touch buttons: every button works by tap, the buttons are hidden on desktop, and the vibration call is made on a hit (checked with a stand-in `navigator.vibrate`). The report, print (stand-in `window.print`) and the confirmed reset were checked on desktop. Real page screenshots were taken of the coach bar (it first covered the character; moved to the top), the touch layout and the menu.
Test-side mistakes I made and corrected (not game bugs): a stub function being auto-called by the test tool (print counted twice), the open road after the tutorial hitting an un-invulnerable test player, and a test that restored a stale profile.
**Not verified**: real phones/tablets (only an emulated touch context), real vibration hardware, a real printer or PDF output, Windows `.bat`, real GPU frame rate.

## Update 7 (Explorer) - final results on the final code
| Suite | Result |
|---|---|
| Node unit tests | **32 / 32** |
| Project validator | **passed (498 checks)** |
| Backend's own tests, run on the node:sqlite driver | **62 / 62** |
| Gameplay | **27 / 27** |
| Keyboard / swipe input | **16 / 16** |
| Audio | **36 / 36** |
| Lab + power-ups | **21 / 21** |
| Settings / subjects / review | **22 / 22** |
| Biomes | **12 / 12** |
| Tutorial + touch + report | **31 / 31** |
| Explorer Hub on the full backend (`t_hub.py`) | **25 / 25** |
| 3D asset gallery (`t_gallery.py`) | **8 / 8** |
| 10 pages under the backend's real security headers (`t_csp.py`) | all clean |
| Self-check page (`selftest.html`, 21 checks) | **21 passed, 0 failed** |

What `t_hub.py` proved: backend badge reads "full backend ON (sqlite)", 20 page cards, the demo family is created (parent, 3 children, 3 tasks) and pressing the button again is safe, one-click sign-in opens the real parent dashboard (shows Aarav, Mia, Riya) and the child dashboard as Aarav, 6 more child pages and both original 3D games (level 1) open without JavaScript errors, Unlock-everything / edit / fresh-player work and the game reads the edited profile, the sound board has a button for every one of 15 effects, the question lab validates its output, documents (including the preserved original v3 test report) are readable, and the link builder produces correct URLs.
**Mistakes in my own tests found and fixed (not game bugs):** visiting login pages clears the session on purpose (so the original games then redirected); `jungle-game.html` opened without `?level=` redirects to the world map by design; Playwright cannot `eval` under the backend's strict CSP (used a bypass for interactive tests and a separate passive CSP sweep).
**Not verified:** a real Windows PC, Node 24 itself (tested on Node 22.22), the `.bat` launchers, a real GPU. The self-check's FPS benchmark could only be run in a 1-core software-rendering sandbox, where it correctly reports "too few frames to measure"; its real numbers will come from your PC.

## Update 8 (gallery / old models)
Re-run on the final code: gallery **11 / 11** (21 models listed, no 'old' entries, opens on your girl.glb with 1,276,110 triangles and 44.26 MB, note shown, runtime and untouched-source models still load), Lab + power-ups 21 / 21 (both characters load without any fallback), gameplay 27 / 27, input 16 / 16, unit tests 32 / 32, validator 498 checks. A real browser screenshot of the gallery was reviewed.
Test-side slip fixed: my first 'no old models' check matched the word 'Golden'.

## Update 9 (original pages on the new characters)
`t_oldpages.py` runs the original `CharacterController` with both presets: **15 / 15** (the new model file is used, it loads as a real 3D model, fits 2.85 high with feet on the ground, has every runner state, no state moves the character away from its lane - dx/dz = 0 for run, jump, slide, hit, fall, dodge, land, victory, idle -, lane dodge and landing keep running, and the jump adds no extra hop). Screenshots of the real original pages were reviewed: the 3D Explorer Lab shows the new Boy, and the original Jungle Runner (level 1, with a real child login) shows the new Boy and the new Girl running. Re-run after the change: Hub 25 / 25, gameplay 27 / 27, Lab + power-ups 21 / 21, unit 32 / 32, backend 62 / 62, validator 498.
**Not verified:** the original runner's full gameplay (jumping, sliding, hits) with the new characters was verified at the animation-controller level and by screenshots of the running pose, not by playing a level; Maths Kingdom's running pose was not screenshotted (it shares the same controller).

## Update 10 (original runners played; Hindi / Marathi) - final results on the final code
| Suite | Result |
|---|---|
| Node unit tests | **41 / 41** (adds: Hindi and Marathi have exactly English's keys and placeholders, are really translated, every achievement / biome / subject / trail / shape / power-up / tutorial step has a key, language detection, localised question wording for every subject in all 3 languages) |
| Project validator | **passed (501 checks)** |
| Backend's own tests (node:sqlite) | **62 / 62** |
| Gameplay | **27 / 27** |
| Keyboard / swipe input | **16 / 16** |
| Audio | **36 / 36** |
| Lab + power-ups | **21 / 21** |
| Settings / subjects / review | **22 / 22** |
| Biomes | **12 / 12** |
| Tutorial + touch + report | **31 / 31** |
| English / Hindi / Marathi in the browser (`t_b5.py`) | **19 / 19** |
| Explorer Hub on the full backend (`t_hub.py`) | **29 / 29** (now also checks that both original games really open, plus the language options) |
| 3D gallery | **11 / 11** |
| Original CharacterController with the new models | **15 / 15** |
| Original Jungle Runner played: Boy / Girl | **7 / 7** and **7 / 7** |
| Original Maths Kingdom played: Boy / Girl | **14 / 14** (7 + 7) |

`t_b5.py` proved: a Hindi browser gets Hindi automatically; `?lang=hi` shows the menu, hint line, settings, report and all 12 achievements in Hindi with no English UI words left; Marathi / English switch live; the choice is saved and survives a reload; HUD, combo chip, power-up toast, shape question ("त्रिभुज की कितनी भुजाएँ होती हैं?", wrapped on two lines on the board), wrong-answer toast and the game-over screen with review are Hindi; maths and pattern questions stay digits; science questions stay English by design. A screenshot of the Hindi board and game-over screen was reviewed (Devanagari renders correctly).
**Mistakes of mine found by the tests and fixed (not game bugs):** the Marathi word for "equals" is बरोबर (my test expected the Hindi spelling); a duplicate import in the test file; the weak Maths Kingdom check described above; the original-runner test first used wall-clock waits, which the slow software renderer made meaningless, so it now advances the runner's own clock.
**Not verified:** a native speaker's review of the Hindi / Marathi wording; a real PC, GPU, Node 24 and the `.bat` launchers (software renderer, Node 22 only); the Hub's *hand-made* ZIP launch on Windows.

## Update 11 (performance) - results on the final code
| Suite | Result |
|---|---|
| Node unit tests | **45 / 45** (adds GPU-class detection incl. your real Intel HD 520 string, adaptive-resolution behaviour, graphics setting) |
| Project validator | **passed (502 checks)** |
| Backend's own tests (node:sqlite) | **62 / 62** |
| Performance features (`t_b6.py`, 2 parts) | **29 / 29** |
| Gameplay / input / audio / biomes | **27 / 27**, **16 / 16**, **36 / 36**, **12 / 12** |
| Languages / tutorial+touch+report / Lab+power-ups / settings | **19 / 19**, **31 / 31**, **21 / 21**, **22 / 22** |
| Original CharacterController / original Jungle Runner Boy + Girl / Maths Kingdom | **15 / 15**, **7 / 7 + 7 / 7**, **14 / 14** |
| Explorer Hub / 3D gallery | **29 / 29**, **11 / 11** |
| Self-check page end to end (sandbox) | 21 checks passed; new benchmark ran all four rows (high, balanced, low, auto) and reported "too few frames" as designed on the 1-core software renderer |
`t_b6.py` proved: the tier comes from the graphics card (software -> low) and is overridden by `?quality=` or the Graphics buttons, which apply at once, are saved and survive a reload; the Girl is 132,012 triangles and the coin 2,428; every roadside object and road tile shows the right LOD for its distance in all three tiers (also after recycling); scenery uses diffuse shading on balanced / low and PBR on high; balanced / low use a blob shadow and no shadow pass, high uses real shadows; per-frame triangles are within budget (high 1.13M, balanced 0.68M, low 0.42M including everything); slow frames shrink the canvas 960 -> 480 px and fast frames restore it; and **16 shader programs before and 16 after** a run that shows every power-up, the Enigma, the board, particles and all four worlds, i.e. nothing is compiled mid-run.
Test-side slip fixed: the LOD check ran between the every-third-frame LOD updates, so two objects exactly at a threshold looked wrong; the test now calls the update first.
**Not verified:** the actual FPS on a weak GPU (see section 20), a native-speaker review of the Hindi / Marathi wording, Node 24 itself.

## Update 12 (GPU classes)
Unit tests **46 / 46** (adds the 'entry' class for the real GT 730 string, GT 710/1030, MX150, GTX 750 Ti, 940MX, Radeon HD 7570 -> balanced, and GTX 1050 Ti / 1060 / 1650 / RTX / RX 580 -> high), validator 502, performance features 29 / 29, Lab + power-ups 21 / 21.
**Not verified:** the new build on the GT 730 or on the HD 520 (both reports are from the build before the performance update).

## Update 13 (device analysis) - results on the final code
| Suite | Result |
|---|---|
| Node unit tests | **54 / 54** (adds: 12 very different devices incl. both real PCs, battery / data-saver rules, native-resolution render sizes 4K -> 540p and the texture-limit cap, the 60-fps pass rule, calibration for strong / mid / weak / very weak / stalled devices, ceiling and probe limits, cache by device signature) |
| Project validator / backend's own tests | **503 checks** / **62 / 62** |
| Device features in the browser (`t_b7.py`) | **6 / 6 + 17 / 17** |
| Explorer Hub incl. the new Device tab | **30 / 30** |
| 3D gallery | **11 / 11** |
| Performance features / gameplay / input / audio / biomes | **29 / 29**, **27 / 27**, **16 / 16**, **36 / 36**, **12 / 12** |
| Languages / tutorial+touch+report / Lab+power-ups / settings | **19 / 19**, **31 / 31**, **21 / 21**, **22 / 22** |
| Original controller / original Jungle Runner Boy + Girl / Maths Kingdom | **15 / 15**, **7 / 7 + 7 / 7**, **14 / 14** |
| Self-check page (21 checks, five levels, device analysis in the report) | passed in the sandbox |
`t_b7.py` proved on a real browser with a simulated 4K display (1920x1080 window at 2x): the canvas is **3840x2160 on Ultra**, 2560x1440 on High, 1920x1080 on Balanced, 1280x720 on Low, 960x540 on Minimal; adaptive resolution halves the 4K picture when needed; a Full HD screen is never up-scaled. Calibration (with simulated frame rates): strong -> Ultra (tests High then Ultra only), mid -> Balanced, weak -> Minimal, stalled test -> keeps the safe level and saves nothing; the result is saved, applied at the next start without new tests, and ignored for a different device; the Settings panel, the re-test button, the player's override and Auto all behave; the original runners report the same levels, the same 4K budget and the same start level / ceiling.
Test-side slips fixed: the cap was reset by a reload in one step, the Hub tab count changed from 9 to 10, and a family left by another test broke the "fresh family" check.
**Not verified:** the real frame rate on a 4K display or on any real GPU (the calibration decisions were tested with simulated frame rates; only the software renderer was available here), and the new Hindi / Marathi device-panel wording with a native speaker.

## Update 14 (native core, four languages) - results on the final code
| Suite | Result |
|---|---|
| Node unit tests / validator / backend's own tests | **54 / 54**, **505 checks**, **62 / 62** |
| C / C++ WebAssembly vs JavaScript (`native:test`) | **10 / 10**, bit-identical (sine 100,000; generator; 300 particle worlds x2; 200,000 collision cases x2; tampered / corrupt module falls back) |
| Python port vs golden vectors | **1,864 / 1,864 identical** |
| Java port vs golden vectors | **1,864 / 1,864 identical** |
| Native core in the browser (`t_b8.py`) | **9 / 9** (loaded by default, zero-copy buffers, particles animate, gameplay identical with `?wasm=0`, Settings switch) + **2 / 2** on the full backend under its strict CSP |
| Gameplay / input / audio / biomes | **27 / 27**, **16 / 16**, **36 / 36**, **12 / 12** |
| Languages / tutorial+touch+report / Lab+power-ups / settings | **19 / 19**, **31 / 31**, **21 / 21**, **22 / 22** |
| Performance features / device analysis | **29 / 29**, **23 / 23** (incl. "no shader compiled mid-run" with the native core on) |
| Original controller / Jungle Runner Boy + Girl / Maths Kingdom | **15 / 15**, **7 / 7 + 7 / 7**, **14 / 14** |
| Explorer Hub / 3D gallery | **30 / 30**, **11 / 11** |
Test-side slips fixed: my first error bound for the polynomial sine was wrong (the real maximum is ~6e-8, harmless for particle sway), and the effect-particle test gave the JS and WebAssembly buffers different random starting values.
**Not verified:** any frame-rate gain (none is expected: see section 23), the native core on a real GPU machine, and the Python / Java ports outside the golden vectors.

### Correction to Update 14 (found while verifying the ZIP)
My first "gameplay is identical with the C/C++ core and with JavaScript" check was **not reliable**: the 30 s scripted run is not deterministic by itself (random power-ups from an Enigma use `Math.random`; the same mode gave 80, 73, 63 and 80 coins in four runs), so the earlier "35 = 35" was a coincidence. Two fixes: (1) the test now seeds `Math.random`, and (2) a real, small difference was removed - with the native core the ambient particles drew one extra `Math.random` number at start-up, shifting every later random choice; both modes now draw exactly two. Result: with a seeded `Math.random` the scripted run gives **exactly the same result in all four runs** (two native, two JavaScript: 35 coins, score 590, distance 224.69, 3 hits), and the test passed twice in a row (9 / 9). The bit-exact C / C++ / Python / Java parity tests were never affected.

## Update 15 (engine in the backend) - results on the final code
| Suite | Result |
|---|---|
| Backend's own tests (incl. 8 new engine tests) | **70 / 70** |
| Python port vs golden vectors (kernels, collisions, device logic, 960 questions, 960 verifications) | **3,784 / 3,784 identical** |
| Java port vs golden vectors | **1,864 / 1,864 identical** |
| C / C++ WebAssembly vs JavaScript | **10 / 10** |
| Explorer Hub incl. the new "Backend engine" panel | **35 / 35** |
| Node unit tests / project validator | **54 / 54** / **511 checks** |
New backend tests: JavaScript engine = 960 golden questions + verification; Python worker = the same 960 (one batch call), 6 device analyses and 24 calibration scenarios exactly equal to JavaScript; "auto" picks Python only after the self-test and reports why; with no usable Python the service answers with JavaScript; killing the worker mid-run still returns correct answers, counts fallbacks and pauses Python after repeated failures; the HTTP API returns questions **without** answers, verifies right / wrong server-side, analyses the real GT 730 string as entry / Balanced, decides calibration, and rejects bad input (bad level, subject, option index, impossible screen size, oversized count) with 400 and hides the benchmark outside explorer mode. A real server started with an unusable Python (`ENGINE_PYTHON=/nonexistent`) reports `active: js` and serves identical questions.
**Mistakes of mine found by the tests (not product bugs):** a Python syntax slip in a Hub test (`any(... await ...)`), and a stale "fresh database" assumption in the demo-family check.
**Not verified:** Windows (the interpreter candidates `python`, `py -3`, `python3` are untested there; if none works the JavaScript engine answers), deployment on Railway (needs `python3` in the image; otherwise JavaScript answers), and any speed or scalability gain (none expected, see section 24).

## Update 16 (apps and platforms) - results on the final code
| Suite | Result |
|---|---|
| Platform configuration (`npm run platforms:test`): detection on 8 environments, server-address rules, PWA files, Android / iOS / desktop project settings, app bundle contents and size | **14 / 14** |
| Installable web app (`t_pwa.py`): manifest + icons; offline with the server stopped; update / install / iPhone hint | **10 / 10**, **13 / 13**, **11 / 11** |
| Service worker under the full backend's strict CSP (`t_sw_csp.py`); PWA files served by the backend | **pass**, **10 / 10** |
| App shell behaviour (`t_app.py c`): home button, back button, wake lock, tab hidden, GPU context loss, iOS silent audio, fullscreen button | **15 / 15** |
| Phone layouts (`t_app.py`): iPhone 13 portrait, iPhone 13 landscape, Pixel 7 - detection, no overflow, full-screen 3D view, menu fits, touch buttons >= 60 px, nothing cut off, finger taps move / jump | **9 / 9** each |
| Desktop app (Electron 33, Linux, virtual display, software GL) | game started, platform `electron`, native C/C++ core active, 9 / 9 models, 0 failures, a run played, screenshot checked |
| Node unit tests / validator / backend's own tests | **54 / 54**, **610 checks**, **70 / 70** |
| Python / Java / C++ parity (JS golden vectors, device rule for phones included) | **3,784 / 3,784**, **1,864 / 1,864**, **10 / 10** |
| Gameplay / input / audio / biomes | **27 / 27**, **16 / 16**, **36 / 36**, **12 / 12** |
| Languages / tutorial+touch+report / Lab+power-ups / settings | **19 / 19**, **31 / 31**, **21 / 21**, **22 / 22** |
| Performance features / device analysis / native core | **29 / 29**, **23 / 23**, **9 / 9** |
| Original controller / Jungle Runner Boy + Girl / Maths Kingdom / Explorer Hub / gallery / CSP sweep | **15 / 15**, **7 / 7 + 7 / 7**, **14 / 14**, **35 / 35**, **11 / 11**, clean |
**Mistakes of mine found by the tests and fixed:**
1. My first "offline" test was a false pass: Playwright's `set_offline` does **not** put a service worker offline, so the worker still reached the server. The test now stops the server process and the worker for real.
2. A real bug found by it: the service worker kept its manifest only in memory; after the browser restarted the idle worker, offline requests failed. The active version's manifest is now stored in the worker's own cache.
3. Test slips: Settings panel not opened before clicking the install button; a missing `screen` key for the landscape device; the page-update test first tried to intercept the worker's own requests (also not possible), so it now publishes "version 2" on a private server copy.
**Not verified:** APK / AAB / IPA builds, Windows and macOS installers, signing, real phones and tablets, WebKit / Safari behaviour (including the iOS audio and wake-lock code paths, which are only simulated in Chromium), and store-review requirements.

## Update 17 (teacher) - results on the final code
| Suite | Result |
|---|---|
| Node unit tests (7 new: closeness rules, grace and board hold, catching, rescue outcomes, adaptive pace, distance mapping and line variants in 3 languages, disabled teacher) | **61 / 61** |
| Teacher in the browser (`t_b9.py`): dressed with cap / glasses / book, behind the child, follows lanes, mistakes bring her closer, right answers / Enigma push her back; catch -> rescue question (3 buttons, world stops, lane keys ignored, key and tap answers, right: free + review + score, wrong: heart lost, last heart: normal game over); no rescue in the tutorial or near a board; Settings switch; Hindi; iPhone fit (buttons >= 60 px); leaving the app mid-question; Minimal level without the model and on-demand load; cost +77k triangles | **17 / 17 + 10 / 10 + 4 / 4** |
| Project validator / platform configuration / backend's own tests | **612 checks** / **14 / 14** / **70 / 70** |
| Python / Java / C++ parity | **3,784 / 3,784**, **1,864 / 1,864**, **10 / 10** |
| Gameplay / input / audio / biomes / languages / tutorial+touch / Lab / settings | **27 / 27**, **16 / 16**, **36 / 36**, **12 / 12**, **19 / 19**, **31 / 31**, **21 / 21**, **22 / 22** |
| Performance (incl. "no shader compiled mid-run" with the teacher) / device analysis / native core | **29 / 29**, **23 / 23**, **9 / 9** |
| Installable web app (files, real offline, update / install) / app shell / phone layouts | **10 + 13 + 11**, **15 / 15**, **9 + 9 + 9** |
| Explorer Hub / original runners (Boy, Girl, Maths Kingdom) / original controller / gallery / CSP sweep | **35 / 35**, **7 + 7 + 14**, **15 / 15**, **11 / 11**, clean |
**Found by the tests and fixed:** the tutorial's `update` crashed when the tutorial was marked active without being started (now guarded); in my rescue tests the "director" was off, which in the game means "tutorial" (she deliberately never catches then); the Hindi language test expected a board question without the new "Teacher:" label.
**Not verified:** feel and balance with real children, real phones, and a purpose-made teacher model.

## Update 18 (GitHub Pages) - results
| Suite | Result |
|---|---|
| Site checker `test-pages.mjs` on the project-folder build (`/LearnQuest/`) and the user-site build (`/`) | **9 / 9** and **8 / 8** |
| Browser, served like GitHub Pages under `/LearnQuest/` (`t_pages.py a`): opening the folder address enters the game; 9 models; **zero 404 / failed requests**; WebAssembly core; a run with the teacher; service worker scope = the project folder; app files saved; "Download for offline play"; **server stopped -> game restarts offline with all real models and plays** | **13 / 13** |
| Browser, user-site layout at `/` (`t_pages.py b`): game, no missing file, self-check page | **3 / 3** |
| Clean-checkout simulation of the whole workflow: only the files git would upload (456 files, 103 MB) -> `npm ci --omit=dev --ignore-scripts` -> offline list -> build -> checks, both layouts | pass |
| Teacher after the layout fixes (side position, bubble on the outer side, no duplicate bubble, hint inside the card) | **17 / 17 + 10 / 10 + 4 / 4** |
**Found by the tests and fixed:** `npm ci` in the workflow would have run the root `postinstall` (backend install) - now `--ignore-scripts`; dead links in the self-check page (Hub) and the 3D lab (profile, reference studio) - now pointed at the game; two false alarms in my own checker (extension matching, root-path matching); and, from the earlier teacher preview: the speech bubble covered the child, the teacher stood exactly in the child's lane, the rescue hint escaped the card (CSS class clash with the game's `.hint`) and the "Got you!" bubble ghosted behind the panel - all fixed.
**Also found by the new phone checks and fixed:** on a narrow phone the Fullscreen button and the third score chip sat under the pause / sound buttons - the Fullscreen button is now hidden on phones and the chips keep clear of the buttons (checked on iPhone portrait + landscape and Pixel: 11 / 11 each).
**Not verified:** the real GitHub Actions run, the live `github.io` address, GitHub's own response headers, and the repository push (needs the user's account).

## Update 19 - results on the final code
| Suite | Result |
|---|---|
| Unit tests (teacher x7, free runs x3, story questions x2) / validator / platform config / backend | **68 / 68**, **637 checks**, **14 / 14**, **70 / 70** |
| Python / Java / C++ parity (questions untouched) | **3,784**, **1,864**, **10 / 10** |
| Teacher (`t_b9`): far / close / caught, escape question, wrong-answer scene, tutorial, setting, Hindi, iPhone, weak-device mode, cost | **15 + 7 + 4** |
| Free runs (`t_free`): counting, gate without a server, signed-in bypass, Hindi, Enter key; with the backend: redirect to parent sign-up, Sign Up tab, navigation bar | **13 + 4** |
| Home page (`t_home`): illustration mode, scroll, languages, reduced motion, lite / full 3D, context loss, iPhone | **15 + 7 + 9 + 6** |
| GitHub Pages layout (`t_pages`: home page, real offline, no self-check) / root layout | **17**, **3** |
| Installable app: files / offline / update + stale-file regression | **10**, **13**, **12** |
| Gameplay / audio / biomes / languages / tutorial+touch / Lab / settings | **27**, **36**, **12**, **19**, **31**, **21**, **22** |
| Performance B / device analysis (A + B) / native core | **4**, **6 + 18**, **9** |
| Phones and app shell (iPhone portrait + landscape, Pixel, lifecycle) | **11 + 11 + 11**, **15** |
| Hub / original pages with the new navigation bar / Jungle Runner (Boy, Girl) / Maths Kingdom / gallery / CSP sweep | **35**, **15**, **7 + 7**, **14**, **11**, clean |
**Found by the tests and fixed:** the service worker mixed new pages with old translation files; the question banner was huge and the coach text almost invisible; on phones the banner was squeezed to half the width; the emoji in the teacher's speech bubble printed as code; a wrong answer grabbed him even when a shield had saved him (and froze the long-run test); the language chosen on the home page did not reach the game; tests that tapped (100,100) now hit the menu navigation; the device panel is folded so its text is only visible after opening "Advanced".
**Not verified:** real GPUs and phones, the native feel of the grab scene (the teacher uses her talking pose, there is no dedicated grab animation), Hindi / Marathi wording by a native speaker, and the real GitHub run.
