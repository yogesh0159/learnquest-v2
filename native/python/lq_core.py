"""LearnQuest engine core, Python port.

A faithful port of the pure logic in frontend/js/game/jungle-run (native-reference.js, device-profile.js, adaptive-resolution.js):
particle kernels, collision rules, device analysis, render-size budgets and the quality calibration.  The browser game runs
JavaScript + C/C++ WebAssembly; this port is for backends, analytics, tooling and tests.  `test_golden.py` proves every result is
identical to the JavaScript reference (float32 buffers use array('f'), so rounding matches too).
"""
import math
import re
from array import array

TWO_PI = 6.283185307179586
INV_TWO_PI = 0.15915494309189535
PI = 3.141592653589793
HALF_PI = 1.5707963267948966
C3, C5, C7, C9, C11 = -0.16666666666666666, 0.008333333333333333, -0.0001984126984126984, 2.7557319223985893e-06, -2.505210838544172e-08
MAX_ITEMS, MAX_OBSTACLES, ITEM_STRIDE, OBS_STRIDE = 128, 64, 5, 6


def fast_sin(x):
    x = x - TWO_PI * float(math.floor(x * INV_TWO_PI + 0.5))
    if x > HALF_PI:
        x = PI - x
    elif x < -HALF_PI:
        x = -PI - x
    x2 = x * x
    return x * (1.0 + x2 * (C3 + x2 * (C5 + x2 * (C7 + x2 * (C9 + x2 * C11)))))


class Rng:
    """xorshift32 -> [0,1)"""

    def __init__(self, seed=2463534242):
        self.s = (seed & 0xFFFFFFFF) or 2463534242

    def next(self):
        x = self.s
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= x >> 17
        x ^= (x << 5) & 0xFFFFFFFF
        self.s = x & 0xFFFFFFFF
        return self.s / 4294967296.0


def f32(n):
    return array("f", [0.0]) * n


def ambient_step(pos, base, seed, n, t, dz, rng):
    for i in range(n):
        z = base[i * 3 + 2] + dz
        if z > 8.0:
            z -= 78.0
            base[i * 3] = (rng.next() - 0.5) * 34.0
        base[i * 3 + 2] = z
        s = seed[i]
        pos[i * 3] = base[i * 3] + fast_sin(t * 0.7 + s) * 0.6
        pos[i * 3 + 1] = base[i * 3 + 1] + fast_sin(t * 1.1 + s * 2.0) * 0.35
        pos[i * 3 + 2] = z


def fx_step(pos, col, vel, base, life, max_life, n, dt, dz):
    for i in range(n):
        if life[i] <= 0:
            continue
        life[i] = life[i] - dt
        j = i * 3
        if life[i] <= 0:
            pos[j + 1] = -999.0
            continue
        vel[j + 1] = vel[j + 1] - 6.0 * dt
        pos[j] = pos[j] + vel[j] * dt
        pos[j + 1] = pos[j + 1] + vel[j + 1] * dt
        pos[j + 2] = pos[j + 2] + (vel[j + 2] * dt + dz)
        f = life[i] / max_life[i]
        col[j] = base[j] * f
        col[j + 1] = base[j + 1] * f
        col[j + 2] = base[j + 2] * f


def collide_collectibles(items, n, px, py, height, reach_z):
    """items: flat list [x, y, z, kind, collected] * n  ->  list of hit indices"""
    out = []
    for i in range(min(n, MAX_ITEMS)):
        o = i * ITEM_STRIDE
        if items[o + 4] != 0:
            continue
        enigma = items[o + 3] != 0
        rx = 0.95 if enigma else 0.75
        if abs(items[o] - px) > rx:
            continue
        if abs(items[o + 2]) > reach_z + (0.3 if enigma else 0.0):
            continue
        if items[o + 1] < py - 0.35 or items[o + 1] > py + height + 0.35:
            continue
        out.append(i)
    return out


def collide_obstacle(obs, n, px, py, half_w, half_d, height):
    """obs: flat list [x, z, halfX, halfZ, yBottom, yTop] * n  ->  first index hit or -1"""
    for i in range(min(n, MAX_OBSTACLES)):
        o = i * OBS_STRIDE
        if abs(obs[o] - px) > obs[o + 2] + half_w * 0.8:
            continue
        if abs(obs[o + 1]) > obs[o + 3] + half_d:
            continue
        if py + height <= obs[o + 4] + 0.02 or py >= obs[o + 5] - 0.05:
            continue
        return i
    return -1


# ---------------------------------------------------------------- device analysis
TIER_ORDER = ["minimal", "low", "balanced", "high", "ultra"]
BUDGET = {"ultra": 3840 * 2160, "high": 2560 * 1440, "balanced": 1920 * 1080, "low": 1280 * 720, "minimal": 960 * 540}
CAP_BY_CLASS = {"software": "low", "entry": "balanced", "integrated": "high", "unknown": "high", "discrete": "ultra"}
START_BY_CLASS = {"software": "low", "entry": "balanced", "integrated": "balanced", "unknown": "balanced", "discrete": "high"}

_SOFTWARE = re.compile(r"swiftshader|llvmpipe|software|microsoft basic")
_ENTRY = re.compile(r"geforce\s*(gt|gts|mx)\s*\d|\bgt\s?\d{3,4}\b|geforce\s*(gtx\s*)?[6-7]\d{2}\b|geforce\s*(gtx\s*)?10[0-3]0\b|geforce\s*(8|9)\d{2}(m|mx)?\b|quadro\s*[kpmnv]?\d{2,4}\b|radeon\s*(hd\s*\d{4}|r[2-5]\b|r7\s*2\d{2})|nvidia\s*nvs|geforce\s*mx")
_DISCRETE = re.compile(r"nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|arc a\d|apple m\d|apple gpu")
_INTEGRATED = re.compile(r"intel|uhd|hd graphics|iris|mali|adreno|powervr|vega \d|radeon\(tm\) graphics|radeon graphics|videocore")


def tier_index(t):
    return TIER_ORDER.index(t)


def lower_of(a, b):
    return a if tier_index(a) <= tier_index(b) else b


def step_down(t, n=1):
    return TIER_ORDER[max(0, tier_index(t) - n)]


def detect_gpu_class(renderer=""):
    s = str(renderer).lower()
    if _SOFTWARE.search(s):
        return "software"
    if _ENTRY.search(s):
        return "entry"
    if _DISCRETE.search(s):
        return "discrete"
    if _INTEGRATED.search(s):
        return "integrated"
    return "unknown"


def _num(v, default=0.0):
    try:
        return float(v) if v is not None else default
    except (TypeError, ValueError):
        return default


def js_round(x):
    return int(math.floor(x + 0.5))


def normalize_facts(f):
    dpr = _num(f.get("dpr"))
    dpr = dpr if dpr > 0 else 1.0
    sw = _num(f.get("screenW")) or 1280.0
    sh = _num(f.get("screenH")) or 720.0
    nw, nh = js_round(sw * dpr), js_round(sh * dpr)
    return {
        "gpu": str(f.get("gpu") or ""), "dpr": dpr, "native": {"w": nw, "h": nh, "pixels": nw * nh},
        "deviceMemory": _num(f.get("deviceMemory")) or None, "cores": _num(f.get("cores")) or None,
        "touch": bool(f.get("touch")), "mobile": bool(f.get("mobile")), "saveData": bool(f.get("saveData")),
        "battery": f.get("battery"), "maxTexture": _num(f.get("maxTexture")) or None,
    }


def analyse_device(raw):
    f = normalize_facts(raw)
    cls = detect_gpu_class(f["gpu"])
    cap, start = CAP_BY_CLASS[cls], START_BY_CLASS[cls]

    def limit(c, tier):
        return lower_of(c, tier)

    mem, cores, tex = f["deviceMemory"], f["cores"], f["maxTexture"]
    if mem is not None:
        if mem <= 1: cap = limit(cap, "minimal")
        elif mem <= 2: cap = limit(cap, "low")
        elif mem <= 4: cap = limit(cap, "balanced")
        elif mem <= 6: cap = limit(cap, "high")
    if cores is not None:
        if cores <= 2: cap = limit(cap, "low")
        elif cores <= 4: cap = limit(cap, "high")
    if tex is not None:
        if tex < 4096: cap = limit(cap, "low")
        elif tex < 8192: cap = limit(cap, "high")
    if f["touch"] or f["mobile"]:
        cap = limit(cap, "high" if (mem and mem >= 6) else "balanced")
    if f["saveData"]:
        cap = limit(cap, "balanced")
    b = f["battery"]
    if b and b.get("charging") is False and b.get("level") is not None and b["level"] < 0.2:
        cap = limit(cap, step_down(cap))
    start = lower_of(start, cap)
    return {"gpuClass": cls, "cap": cap, "start": start, "native": f["native"]}


def render_size_for(tier, nw, nh, max_texture=16384):
    budget = BUDGET.get(tier, BUDGET["balanced"])
    fit = min(1.0, math.sqrt(budget / max(1, nw * nh)))
    fit = min(fit, max_texture / max(nw, nh))
    return {"w": max(1, js_round(nw * fit)), "h": max(1, js_round(nh * fit))}


def passes(m, refresh_hz=60):
    target = min(refresh_hz or 60, 60)
    return bool(m) and m["frames"] >= 8 and m["avgFps"] >= target * 0.9 and m["p95Ms"] <= 26


def calibrate_tiers(start, cap, measure, refresh_hz=60, max_probes=5):
    probes = []
    left = [max_probes]

    def run(tier):
        m = measure(tier)
        ok = passes(m, refresh_hz)
        probes.append({"tier": tier, "pass": ok, "conclusive": (m.get("frames") or 0) >= 8})
        left[0] -= 1
        return probes[-1]

    idx = tier_index(lower_of(start, cap))
    best = None
    p = run(TIER_ORDER[idx])
    if not p["conclusive"]:
        return {"tier": lower_of(start, cap), "probes": probes, "conclusive": False}
    if p["pass"]:
        best = idx
        while left[0] > 0 and idx < tier_index(cap):
            idx += 1
            p = run(TIER_ORDER[idx])
            if not p["conclusive"] or not p["pass"]:
                break
            best = idx
    else:
        while left[0] > 0 and idx > 0:
            idx -= 1
            p = run(TIER_ORDER[idx])
            if not p["conclusive"]:
                break
            if p["pass"]:
                best = idx
                break
        if best is None:
            best = idx if any(not q["conclusive"] for q in probes) else 0
    return {"tier": TIER_ORDER[best if best is not None else idx], "probes": probes, "conclusive": True}
