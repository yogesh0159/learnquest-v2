Optional automated browser tests (Python + Playwright + Chromium).  Not needed to play the game.
  pip install playwright && playwright install chromium
  1) start the game server (START_JUNGLE_LOCAL.bat or: node scripts/jungle-local-server.js)
  2) python t_full.py     gameplay, collisions, recycling, memory, lane-fit   (27 checks)
     python t_keys.py     real keyboard / swipe input                         (16 checks)
     python t_audio.py    sound engine + music                                (34 checks)
     python t_question.py question board correct / wrong answer
     python t_b1.py       Lab character viewer, power-ups, combo               (21 checks)
     python t_b2.py       settings, subjects, review, trail, achievements      (22 checks)
     python t_b3.py       biomes, fireflies, speed lines                       (12 checks)
     python t_b4.py       tutorial, touch controls, vibration, progress report (31 checks)
The tests pretend the tutorial is already done (browser_test.launch(tutorial_done=True)) except t_b4.py.
Tests drive the game through window.LQ_JUNGLE (advance(), snapshot(), renderOnce()).
Note: the files use http://127.0.0.1:5177 ; edit the URL if you changed JUNGLE_PORT.

EXPLORER (full app, port 4000 - start START_EXPLORER_ALL.bat first; tests that touch the backend use it):
     python t_hub.py       Explorer Hub, demo family, logins, original games, profile editor, sound, questions   (25 checks)
     python t_gallery.py   3D asset gallery incl. untouched original sources                                       (8 checks)
     python t_csp.py       10 pages with the real backend security headers: no CSP or JavaScript errors
     python t_selftest.py  runs selftest.html (shortened benchmark) and prints its report
Note: these tests block internet access on purpose (Google Fonts errors are ignored) and use the software renderer.

Update 10 tests: t_b5.py (English / Hindi / Marathi, 19 checks, Jungle-only server on port 5177) and
     t_origplay.py jungle_boy | jungle_girl | maths   (plays the ORIGINAL Jungle Runner / Maths Kingdom with the new characters; needs START_EXPLORER_ALL.bat)

Update 11 (performance): t_b6.py a|b  (graphics tiers, LOD swap, cheap shading, adaptive resolution, 'no shader compiled mid-run'; 29 checks, Jungle-only server 5177)
     t_perf2.py [high balanced low]   prints visible triangles per object type (what the frame is spent on)
     t_tiers_shot.py                   screenshots of the three tiers

Update 13 (device analysis): t_b7.py a|b  (render size per level on a 4K screen, calibration with simulated frame rates, cache, signature change, Settings panel, player override, original runners; 23 checks, Jungle-only server 5177)

Update 14 (native core): t_b8.py a|b (C/C++ WebAssembly in the game: zero-copy buffers, identical gameplay with ?wasm=0, Settings switch; b = strict-CSP full backend)
     t_profile.py  per-subsystem game-logic cost per frame (shows logic is ~0.1 ms of a 16.7 ms frame)
     Also: `sh native/run_all_tests.sh` runs C/C++ (WebAssembly), Python and Java against the same golden vectors.

Update 16 (apps and platforms):
     t_pwa.py a|b|c  installable web app: manifest + icons (a), offline with the server REALLY stopped (b), update / install / iPhone hint (c)
     t_app.py a|a0|b|c  phones (iPhone landscape / portrait, Pixel) and the app-shell behaviour (home button, back button, wake lock, GPU context loss, iOS audio)
     t_sw_csp.py     the service worker installs under the full backend's strict security headers
     Also: `npm run platforms:test` (platform detection, PWA files, Android / iOS / desktop project settings, app bundle contents).
     browser_test.launch hides the service worker unless service_workers="allow" is passed.

Update 17 (teacher): t_b9.py a|b|c  the friendly teacher who runs behind the child and asks the rescue question (31 checks, Jungle-only server 5177)

Update 18 (GitHub Pages): t_pages.py a|b  the built site served like GitHub Pages under /LearnQuest/ (a: game, no 404, service worker scope, real offline) and at the root (b).
     scripts/test-pages.mjs checks a built site; scripts/serve-pages.mjs serves it like Pages.
