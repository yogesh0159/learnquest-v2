"""Checks the Python port against native/golden/golden.txt (written by the JavaScript reference). Run: python3 native/python/test_golden.py"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import lq_core as C

path = os.path.join(os.path.dirname(__file__), "..", "golden", "golden.txt")
counts, fails = {}, []

def eq(a, b):
    return a == b or (a != a and b != b)

def check(kind, ok, msg=""):
    counts[kind] = counts.get(kind, 0) + 1
    if not ok and len(fails) < 8:
        fails.append(f"{kind}: {msg}")

def nums(tokens):
    return [float(t) for t in tokens]

def split_bars(line):
    return [seg.split() for seg in line.split("|")]

for line in open(path, encoding="utf-8"):
    line = line.rstrip("\n")
    kind = line.split(" ", 1)[0].split("\t", 1)[0]
    if kind == "SIN":
        _, x, y = line.split(); check("SIN", C.fast_sin(float(x)) == float(y), x)
    elif kind == "RNG":
        t = line.split(); seed, cnt = int(t[1]), int(t[2]); r = C.Rng(seed); exp = nums(t[3:])
        check("RNG", all(r.next() == e for e in exp), f"seed {seed}")
    elif kind == "AMB":
        h, init, pos_e, base_e = split_bars(line); n, steps, seed, t0, dz = int(h[1]), int(h[2]), int(h[3]), float(h[4]), float(h[5])
        pos, base, sd = C.f32(n * 3), C.f32(n * 3), C.f32(n); v = nums(init)
        for i in range(n):
            base[i*3], base[i*3+1], base[i*3+2], sd[i] = v[i*4], v[i*4+1], v[i*4+2], v[i*4+3]
        r = C.Rng(seed)
        for s in range(steps): C.ambient_step(pos, base, sd, n, s * 0.016 + t0, dz, r)
        check("AMB", all(eq(a, b) for a, b in zip(pos, nums(pos_e))) and all(eq(a, b) for a, b in zip(base, nums(base_e))), line[:40])
    elif kind == "FX":
        h, init, pos_e, col_e, life_e = split_bars(line); n, steps, dt, dz = int(h[1]), int(h[2]), float(h[3]), float(h[4])
        pos, col, vel, base = C.f32(n*3), C.f32(n*3), C.f32(n*3), C.f32(n*3); life, ml = C.f32(n), C.f32(n); v = nums(init)
        for i in range(n):
            o = i * 10
            for k in range(3): pos[i*3+k], vel[i*3+k], base[i*3+k] = v[o+k], v[o+3+k], v[o+6+k]
            life[i] = ml[i] = v[o+9]
        for _ in range(steps): C.fx_step(pos, col, vel, base, life, ml, n, dt, dz)
        check("FX", all(eq(a, b) for a, b in zip(pos, nums(pos_e))) and all(eq(a, b) for a, b in zip(col, nums(col_e))) and all(eq(a, b) for a, b in zip(life, nums(life_e))), line[:40])
    elif kind == "COLL":
        h, items, res = split_bars(line); n, px, py, ht, rz = int(h[1]), *nums(h[2:6]); got = C.collide_collectibles(nums(items), n, px, py, ht, rz)
        exp = [int(x) for x in res[1:]]; check("COLL", int(res[0]) == len(got) and got == exp, line[:40])
    elif kind == "OBS":
        h, obs, res = split_bars(line); n = int(h[1]); px, py, hw, hd, ht = nums(h[2:7]); check("OBS", C.collide_obstacle(nums(obs), n, px, py, hw, hd, ht) == int(res[0]), line[:40])
    elif kind == "DEVICE":
        t = line.split("\t"); g = lambda s: None if s == "null" else float(s)
        raw = {"gpu": t[1], "screenW": float(t[2]), "screenH": float(t[3]), "dpr": float(t[4]), "deviceMemory": g(t[5]), "cores": g(t[6]), "maxTexture": g(t[7]), "touch": t[8] == "1", "mobile": t[9] == "1", "saveData": t[10] == "1",
               "battery": None if t[11] == "null" else {"charging": t[11] == "1", "level": float(t[12])}}
        a = C.analyse_device(raw); check("DEVICE", [a["gpuClass"], a["cap"], a["start"], a["native"]["w"], a["native"]["h"]] == [t[13], t[14], t[15], int(t[16]), int(t[17])], f"{t[1][:40]} -> {a['gpuClass']}/{a['cap']}/{a['start']} expected {t[13]}/{t[14]}/{t[15]}")
    elif kind == "RSZ":
        t = line.split(); r = C.render_size_for(t[1], int(t[2]), int(t[3]), int(t[4])); check("RSZ", [r["w"], r["h"]] == [int(t[5]), int(t[6])], line)
    elif kind == "PASS":
        t = line.split(); check("PASS", C.passes({"frames": int(t[1]), "avgFps": float(t[2]), "p95Ms": float(t[3])}, int(t[4])) == (t[5] == "1"), line)
    elif kind == "CAL":
        h, res = [s.strip() for s in line.split("|")]; t = h.split(); fps = dict(zip(C.TIER_ORDER, [None if x == "null" else float(x) for x in t[3:8]])); log = []
        def measure(tier):
            log.append(tier); f = fps[tier]
            return {"frames": 0, "avgFps": 0, "p95Ms": 0} if f is None else {"frames": 60, "avgFps": f, "p95Ms": 18 if f >= 55 else 40}
        r = C.calibrate_tiers(t[1], t[2], measure); e = res.split(); check("CAL", [r["tier"], int(r["conclusive"]), ",".join(log)] == [e[0], int(e[1]), e[2]], f"{h} -> {r['tier']} {','.join(log)} expected {res}")

import json
import questions as Q
for line in open(os.path.join(os.path.dirname(__file__), "..", "golden", "golden_questions.jsonl"), encoding="utf-8"):
    r = json.loads(line)
    check("QUESTION", Q.question_at(r["seed"], r["index"], r["subject"], r["level"]) == r["q"], f'{r["subject"]} L{r["level"]} seed {r["seed"]} #{r["index"]}')
    verdict = Q.verify_answer(r["seed"], r["index"], r["subject"], r["level"], r["q"]["correctIndex"])
    check("VERIFY", verdict["correct"] is True and Q.verify_answer(r["seed"], r["index"], r["subject"], r["level"], (r["q"]["correctIndex"] + 1) % 3)["correct"] is False, "verify")

total = sum(counts.values())
print("Python port vs JavaScript reference:", ", ".join(f"{k} {v}" for k, v in counts.items()))
if fails:
    print("FAILURES:"); [print("  ", f) for f in fails]; sys.exit(1)
print(f"OK - all {total} records identical")
