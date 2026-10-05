# Game engine on the server

```
Browser / apps ──HTTP──▶ Express  /api/engine/*  ──▶ EngineService ──▶ Python worker (native/python/engine_server.py, JSON lines)
                                                                   └─▶ JavaScript engine (same code the game uses; always loaded)
```

* **Choice:** `ENGINE_PROVIDER=auto` (default) uses Python if it starts and gives exactly the JavaScript answers on a 10-case self-test; `python` asks for it explicitly;
  `js` never starts Python. Set `ENGINE_PYTHON` to a specific interpreter (default: `python3`/`python`, on Windows `python`, `py -3`).
* **Safety:** a missing, slow (2 s), crashing or wrong worker never breaks the API. The request is answered by JavaScript, and after 3 failures in a row Python is
  paused for 60 s and restarted. `GET /api/engine/status` shows what is active and why.
* **Endpoints**
  * `GET  /api/engine/status`
  * `POST /api/engine/device/analyse`   `{facts:{gpu,screenW,screenH,dpr,deviceMemory,cores,maxTexture,...}}` -> class, highest level, safe start, render size of every level
  * `POST /api/engine/device/calibrate` `{start,cap,refreshHz,probes:{tier:{frames,avgFps,p95Ms}}}` -> best level
  * `GET  /api/engine/questions?seed=&subject=&level=&from=&count=` -> questions **without answers**
  * `POST /api/engine/verify`           `{seed,subject,level,index,chosenIndex}` -> `{correct, correctIndex, explanation}`
  * `GET  /api/engine/benchmark`        (explorer mode or `ENGINE_BENCH=1` only)
* **Same question everywhere:** `(seed, index, subject, level)` gives the same question in the game (JavaScript), in Python and in the server - 960 questions are checked for exact equality.
* **Measured cost** (question.at, this machine): JavaScript in-process ~0.006-0.02 ms, Python worker ~0.07 ms including the pipe. Python is slower, not faster; it is used because the
  engine is also maintained in Python, and it is fully optional.
