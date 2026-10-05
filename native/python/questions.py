"""LearnQuest question engine, Python port of frontend/js/game/jungle-run (rng.js, question-banks.js, question-generator.js, question-service.js).

Stateless and reproducible: the same (seed, index, subject, level) gives exactly the question the JavaScript game gives, so the server can
re-create a question from four numbers and check an answer without trusting the browser.  Proven identical by test_golden.py
(960 golden questions, all subjects, levels 1-4)."""
import math

M = 0xFFFFFFFF


def imul(a, b):
    return (a * b) & M


def mulberry32(seed):
    a = seed & M

    def nxt():
        nonlocal a
        a = (a + 0x6D2B79F5) & M
        t = a
        t = imul(t ^ (t >> 15), t | 1)
        t ^= (t + imul(t ^ (t >> 7), t | 61)) & M
        return ((t ^ (t >> 14)) & M) / 4294967296.0

    return nxt


def seeded_for(run_seed, index):
    return mulberry32((imul(run_seed & M, 2654435761) ^ imul(index & M, 40503) ^ 0x9E3779B9) & M)


def _range(rng, lo, hi):
    return lo + (hi - lo) * rng()


def _int(rng, lo, hi):
    return int(math.floor(_range(rng, lo, hi + 1)))


def _pick(rng, lst):
    return lst[int(math.floor(rng() * len(lst))) % len(lst)]


def _shuffle(rng, lst):
    a = list(lst)
    for i in range(len(a) - 1, 0, -1):
        j = int(math.floor(rng() * (i + 1)))
        a[i], a[j] = a[j], a[i]
    return a


def _bank(words, level):
    return [{"word": w, "level": level} for w in words.split(" ")]


BANKS = {
    "spelling": _bank("cat dog sun hat bus pen cup bed fox pig ant egg", 1) + _bank("apple tiger mango house water table plant bread", 2)
    + _bank("banana jungle monkey parrot rabbit window", 3) + _bank("elephant squirrel crocodile", 4),
    "science": [
        {"q": "Which animal gives us milk?", "a": "Cow", "wrong": ["Lion", "Snake", "Eagle"], "level": 1},
        {"q": "What do plants need to grow?", "a": "Sunlight", "wrong": ["Candy", "Plastic", "Sand"], "level": 1},
        {"q": "Which one can fly?", "a": "Bird", "wrong": ["Fish", "Dog", "Turtle"], "level": 1},
        {"q": "What colour is the sky on a clear day?", "a": "Blue", "wrong": ["Green", "Pink", "Black"], "level": 1},
        {"q": "Which animal lives in water?", "a": "Fish", "wrong": ["Cat", "Horse", "Monkey"], "level": 1},
        {"q": "What do bees make?", "a": "Honey", "wrong": ["Bread", "Milk", "Juice"], "level": 1},
        {"q": "Ice is frozen...", "a": "Water", "wrong": ["Milk", "Sand", "Air"], "level": 2},
        {"q": "Which part of a plant is under the ground?", "a": "Roots", "wrong": ["Leaves", "Flowers", "Fruit"], "level": 2},
        {"q": "Which planet do we live on?", "a": "Earth", "wrong": ["Mars", "Jupiter", "Venus"], "level": 2},
        {"q": "How many legs does a spider have?", "a": "8", "wrong": ["6", "4", "10"], "level": 2},
        {"q": "What do we use to see?", "a": "Eyes", "wrong": ["Ears", "Nose", "Hands"], "level": 2},
        {"q": "Which is a mammal?", "a": "Whale", "wrong": ["Shark", "Frog", "Crab"], "level": 3},
        {"q": "What gas do we breathe in?", "a": "Oxygen", "wrong": ["Helium", "Smoke", "Steam"], "level": 3},
        {"q": "The Sun is a...", "a": "Star", "wrong": ["Planet", "Moon", "Cloud"], "level": 3},
        {"q": "What do caterpillars become?", "a": "Butterflies", "wrong": ["Beetles", "Birds", "Bees"], "level": 3},
        {"q": "Which is the biggest planet?", "a": "Jupiter", "wrong": ["Earth", "Mars", "Mercury"], "level": 4},
        {"q": "Water boils at...", "a": "100\u00b0C", "wrong": ["50\u00b0C", "0\u00b0C", "20\u00b0C"], "level": 4},
    ],
    "shapes": [
        {"name": "triangle", "sides": 3, "level": 1}, {"name": "square", "sides": 4, "level": 1}, {"name": "circle", "sides": 0, "level": 1}, {"name": "rectangle", "sides": 4, "level": 1},
        {"name": "pentagon", "sides": 5, "level": 2}, {"name": "hexagon", "sides": 6, "level": 2}, {"name": "octagon", "sides": 8, "level": 3}, {"name": "line", "sides": 1, "level": 4},
    ],
}
SUBJECTS = ["math", "patterns", "compare", "spelling", "science", "shapes"]


def _distinct(answer, candidates, n=2):
    out = []
    for v in candidates:
        if v != answer and v not in out:
            out.append(v)
            if len(out) == n:
                break
    return out


def _math(rng, level):
    L = max(1, min(4, level))
    kind = _pick(rng, ["add", "add", "sub", "sub", "mul"]) if L == 1 else _pick(rng, ["add", "sub", "mul"])
    if kind == "add":
        mx = [9, 20, 50, 99][L - 1]
        a = _int(rng, 1, mx); b = _int(rng, 1, mx); answer = a + b; sign = "+"
    elif kind == "sub":
        mx = [12, 20, 60, 99][L - 1]
        a = _int(rng, 3, mx); b = _int(rng, 1, a - 1); answer = a - b; sign = "\u2212"
    else:
        ma = [5, 6, 9, 12][L - 1]; mb = [5, 9, 10, 12][L - 1]
        a = _int(rng, 2, ma); b = _int(rng, 2, mb); answer = a * b; sign = "\u00d7"
    near = []
    for d in (1, 2, 3, 4, 5, 10):
        near += [answer + d, answer - d]
    if kind == "mul":
        slips = [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, a + b]
    elif kind == "add":
        slips = [a + b + 10, a + b - 10, abs(a - b)]
    else:
        slips = [a + b, answer + 10, answer - 10]
    pool = _shuffle(rng, [v for v in slips if abs(v - answer) <= max(6, answer * 0.5)] + near[:8])
    distractors = []
    for v in pool:
        if v >= 0 and v != answer and v not in distractors:
            distractors.append(v)
        if len(distractors) == 2:
            break
    k = 1
    while len(distractors) < 2:
        v = answer + k * 7
        if v != answer and v not in distractors:
            distractors.append(v)
        k += 1
    word = {"+": "plus", "\u2212": "minus", "\u00d7": "times"}[sign]
    return {"text": f"{a} {sign} {b} = ?", "answer": answer, "distractors": distractors, "explanation": f"{a} {sign} {b} = {answer}", "spoken": f"{a} {word} {b} equals?", "meta": {"kind": kind, "a": a, "b": b}}


def _patterns(rng, level):
    step = _int(rng, 1, [3, 5, 8, 12][min(3, level - 1)])
    start = _int(rng, 1, 12)
    grow = level >= 3 and rng() > 0.6
    seq = [start]
    for i in range(1, 4):
        seq.append(seq[i - 1] + (step + i if grow else step))
    nxt = seq[3] + (step + 4 if grow else step)
    d = step + 4 if grow else step
    distractors = _distinct(nxt, [v for v in _shuffle(rng, [nxt + 1, nxt - 1, nxt + d, nxt - d, nxt + 2, seq[3] + 1]) if v > 0])
    what = "a little more each time" if grow else str(step)
    return {"text": ", ".join(str(x) for x in seq[:4]) + ", ?", "answer": nxt, "distractors": distractors, "explanation": f"The pattern adds {what}: next is {nxt}", "spoken": "What comes next? " + ", ".join(str(x) for x in seq), "meta": {"kind": "pattern", "step": step, "grow": grow, "next": nxt, "seq": seq}}


def _compare(rng, level):
    mx = [20, 50, 100, 999][min(3, level - 1)]
    nums = []
    while len(nums) < 3:
        v = _int(rng, 1, mx)
        if v not in nums:
            nums.append(v)
    big = rng() > 0.5
    answer = max(nums) if big else min(nums)
    return {"text": "Which is the BIGGEST?" if big else "Which is the SMALLEST?", "answer": answer, "distractors": [v for v in nums if v != answer],
            "explanation": f"{answer} is the {'biggest' if big else 'smallest'} of {', '.join(str(x) for x in nums)}", "meta": {"kind": "compare", "big": big, "list": nums}}


def _tier(rng, level, key):
    bank = BANKS[key]
    tier = [q for q in bank if q["level"] <= level]
    return _pick(rng, tier if tier else bank)


def _spelling(rng, level):
    w = _tier(rng, level, "spelling")["word"]
    i = _int(rng, 0, len(w) - 1)
    letter = w[i]
    alphabet = [c for c in "abcdefghijklmnopqrstuvwxyz" if c != letter]
    prefer = _shuffle(rng, [c for c in alphabet if c in "aeiou"]) if letter in "aeiou" else []
    seen, merged = set(), []
    for c in prefer + _shuffle(rng, alphabet):
        if c not in seen:
            seen.add(c)
            merged.append(c)
    wrong = merged[:2]
    shown = " ".join("_" if k == i else c for k, c in enumerate(w)).upper()
    return {"text": shown, "answer": letter.upper(), "distractors": [c.upper() for c in wrong], "explanation": f"{w.upper()} - the missing letter is {letter.upper()}",
            "spoken": "Which letter is missing in " + ", ".join("blank" if k == i else c for k, c in enumerate(w)) + "?", "meta": {"kind": "spelling", "word": w, "letter": letter.upper(), "index": i}}


def _science(rng, level):
    q = _tier(rng, level, "science")
    return {"text": q["q"], "answer": q["a"], "distractors": _shuffle(rng, q["wrong"])[:2], "explanation": f"{q['q']} {q['a']}", "meta": {"kind": "science"}}


def _shapes(rng, level):
    sh = _tier(rng, level, "shapes")
    ask = sh["sides"]
    cand = _shuffle(rng, [n for n in (0, 1, 2, 3, 4, 5, 6, 8) if n != ask])
    return {"text": f"Sides of a {sh['name']}?", "answer": ask, "distractors": cand[:2], "explanation": f"A {sh['name']} has {ask} {'side' if ask == 1 else 'sides'}",
            "spoken": f"How many sides does a {sh['name']} have?", "meta": {"kind": "shapes", "name": sh["name"], "sides": ask}}


GENERATORS = {"math": _math, "patterns": _patterns, "compare": _compare, "spelling": _spelling, "science": _science, "shapes": _shapes}


def question_at(seed=1, index=0, subject="math", level=1):
    gen = GENERATORS.get(subject)
    if gen is None:
        raise ValueError(f'No question generator registered for subject "{subject}"')
    level = int(level)
    rng = seeded_for(int(seed), int(index))
    raw = gen(rng, level)
    values = _shuffle(rng, [raw["answer"]] + raw["distractors"][:2])
    correct = next(i for i, v in enumerate(values) if v == raw["answer"] and type(v) is type(raw["answer"]))
    return {"subject": subject, "level": level, "text": raw["text"], "options": [{"label": str(v), "value": v} for v in values], "correctIndex": correct,
            "explanation": raw.get("explanation") or "", "spoken": raw.get("spoken") or raw["text"], "meta": raw.get("meta")}


def verify_answer(seed, index, subject, level, chosen_index):
    q = question_at(seed, index, subject, level)
    return {"correct": int(chosen_index) == q["correctIndex"], "correctIndex": q["correctIndex"], "explanation": q["explanation"]}
