"""LearnQuest engine worker (Python).  The Node backend starts this process once and talks to it with one JSON object per line:

    -> {"id": 7, "method": "question.at", "params": {"seed": 42, "index": 3, "subject": "math", "level": 2}}
    <- {"id": 7, "result": {...}}            or   {"id": 7, "error": "message"}

Methods: ping, device.analyse, device.calibrate, question.at, question.verify, batch.
Standard library only (Python 3.8+).  Stops when stdin closes.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lq_core as C  # noqa: E402
import questions as Q  # noqa: E402

VERSION = "1"


def device_analyse(p):
    facts = p.get("facts") or {}
    a = C.analyse_device(facts)
    tex = C.normalize_facts(facts)["maxTexture"] or 16384
    sizes = {t: C.render_size_for(t, a["native"]["w"], a["native"]["h"], tex) for t in C.TIER_ORDER}
    return {"gpuClass": a["gpuClass"], "cap": a["cap"], "start": a["start"], "native": a["native"], "sizes": sizes}


def device_calibrate(p):
    probes = p.get("probes") or {}

    def measure(tier):
        m = probes.get(tier)
        if not m:
            return {"frames": 0, "avgFps": 0, "p95Ms": 0}
        return {"frames": float(m.get("frames", 0)), "avgFps": float(m.get("avgFps", 0)), "p95Ms": float(m.get("p95Ms", 0))}

    r = C.calibrate_tiers(p.get("start", "balanced"), p.get("cap", "high"), measure, float(p.get("refreshHz", 60)), int(p.get("maxProbes", 5)))
    return {"tier": r["tier"], "conclusive": r["conclusive"], "probed": [x["tier"] for x in r["probes"]]}


def question_at(p):
    return Q.question_at(p.get("seed", 1), p.get("index", 0), p.get("subject", "math"), p.get("level", 1))


def question_verify(p):
    return Q.verify_answer(p.get("seed", 1), p.get("index", 0), p.get("subject", "math"), p.get("level", 1), p.get("chosenIndex", -1))


def ping(_p):
    return {"engine": "python", "python": sys.version.split()[0], "version": VERSION}


METHODS = {"ping": ping, "device.analyse": device_analyse, "device.calibrate": device_calibrate, "question.at": question_at, "question.verify": question_verify}


def call(method, params):
    if method == "batch":
        return [call(c["method"], c.get("params") or {}) for c in (params.get("calls") or [])]
    fn = METHODS.get(method)
    if fn is None:
        raise ValueError(f"unknown method {method}")
    return fn(params or {})


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except ValueError:
            sys.stdout.write(json.dumps({"id": None, "error": "invalid JSON"}) + "\n"); sys.stdout.flush(); continue
        try:
            out = {"id": req.get("id"), "result": call(req.get("method"), req.get("params") or {})}
        except Exception as e:  # keep the worker alive whatever one request does
            out = {"id": req.get("id"), "error": f"{type(e).__name__}: {e}"}
        sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n"); sys.stdout.flush()


if __name__ == "__main__":
    main()
