# LearnQuest native / multi-language core

The game is a **browser game**: JavaScript + WebGL (three.js). In a browser only JavaScript and WebAssembly run, so:

| Language | Where it is used | Runs in the browser game? |
|---|---|---|
| **JavaScript** | the whole game; `frontend/js/game/jungle-run/native-reference.js` is the *specification* and the fallback | yes |
| **C** (`native/c/kernels.c`) | bulk particle kernels (fireflies / pollen, sparkles, bursts), compiled to WebAssembly | yes (WebAssembly) |
| **C++** (`native/cpp/collide.cpp`) | collision rules, compiled to the same WebAssembly module | yes (WebAssembly) |
| **Python** (`native/python/`) | `lq_core.py` (kernels, collisions, device analysis, calibration) and `questions.py` (the question engine) + `engine_server.py`, **the worker the Node backend runs** (see below) | no (not possible in a browser); **yes, in the backend** |
| **Java** (`native/java/LqCore.java`) | the same pure logic for Android, desktop or a Java backend | no (not possible in a browser) |

Every port is checked against `native/golden/golden.txt` (1,864 inputs/outputs written by the JavaScript reference, including float32 rounding) and
`golden_questions.jsonl` (960 questions, Python only), and all of them match **exactly**. Run everything with `sh native/run_all_tests.sh`.

## Honest performance note
Measured: the whole game-logic update takes about **0.09 ms per frame** (a frame is 16.7 ms), and the C/C++ kernels are only ~1.0-1.1x faster than
the JavaScript they replace (the browser's JIT already compiles these typed-array loops to native-quality code). The real bottleneck on weak
computers is the **GPU drawing the picture**, not the game logic, so moving logic to C/C++/Java/Python does **not** raise the frame rate.
What does: lower render resolution, fewer triangles (LOD), cheaper shading, fewer draw calls - which the device-analysis / quality system does.
Python and Java would be *slower* in a browser (they would have to be shipped with an interpreter / VM compiled to WebAssembly), so they are not used there.

## Rebuild the WebAssembly
`sh native/build.sh` (needs `clang` + `wasm-ld`). The compiled `frontend/wasm/lq_core.wasm` (2.9 KB, no imports) is already included.
At start-up the game runs a small self-test (WebAssembly vs JavaScript); if the file is missing, blocked or differs, the game silently uses the JavaScript.
Switch: Settings -> "Native engine core", or `?wasm=0`.

## Python in the backend
`backend/engine/` runs `native/python/engine_server.py` as a worker process (one JSON line in, one out) and exposes it as `/api/engine/*`:
status, device analysis (+ render size per quality level), calibration decision, **questions made from a seed** and **server-side answer checking**
(the browser cannot read the answers from the question list). Details and numbers: `backend/engine/README.md`.
Java is deliberately **not** wired into the backend: nothing in the backend needs it, and it would add a JVM dependency with no benefit.
`native/java` stays available for Android / desktop reuse (and shares the same golden vectors).
