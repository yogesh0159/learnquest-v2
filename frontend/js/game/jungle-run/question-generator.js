import { pick, range, shuffle } from "./rng.js";
import { SUBJECT_BANKS } from "./question-banks.js";

/**
 * Reusable, subject-agnostic question generation.
 *
 * A generator is `(ctx) => { text, answer, distractors, explanation, meta? }`
 * where `ctx = { rng, level }`. `generateQuestion()` wraps the generator output into the
 * shape the runner consumes: exactly three options and exactly one correct answer.
 * Register new subjects (spelling, science, ...) with `registerQuestionGenerator`.
 */
const generators = new Map();
let serial = 0;

export function registerQuestionGenerator(subject, fn) {
  if (typeof fn !== "function") throw new TypeError("Question generator must be a function");
  generators.set(subject, fn);
}
export const listQuestionSubjects = () => [...generators.keys()];

const int = (rng, lo, hi) => Math.floor(range(rng, lo, hi + 1));

function mathGenerator({ rng, level }) {
  const L = Math.max(1, Math.min(4, level));
  const kinds = ["add", "sub", "mul"];
  // Level 1 is gentle: mostly add/sub with the occasional easy times-table.
  const kind = L === 1 ? pick(rng, ["add", "add", "sub", "sub", "mul"]) : pick(rng, kinds);
  let a; let b; let answer; let text; let sign;
  if (kind === "add") {
    const max = [9, 20, 50, 99][L - 1];
    a = int(rng, 1, max); b = int(rng, 1, max); answer = a + b; sign = "+";
  } else if (kind === "sub") {
    const max = [12, 20, 60, 99][L - 1];
    a = int(rng, 3, max); b = int(rng, 1, a - 1); answer = a - b; sign = "\u2212";
  } else {
    const maxA = [5, 6, 9, 12][L - 1];
    const maxB = [5, 9, 10, 12][L - 1];
    a = int(rng, 2, maxA); b = int(rng, 2, maxB); answer = a * b; sign = "\u00d7";
  }
  text = `${a} ${sign} ${b} = ?`;

  // Distractors: plausible near-misses first, then widening, never negative or equal to the answer.
  const near = [1, 2, 3, 4, 5, 10].flatMap((d) => [answer + d, answer - d]);
  const slips = kind === "mul" ? [a * (b + 1), a * (b - 1), (a + 1) * b, (a - 1) * b, a + b]
    : kind === "add" ? [a + b + 10, a + b - 10, Math.abs(a - b)] : [a + b, answer + 10, answer - 10];
  const pool = shuffle(rng, [...slips.filter((v) => Math.abs(v - answer) <= Math.max(6, answer * 0.5)), ...near.slice(0, 8)]);
  const distractors = [];
  for (const v of pool) {
    if (v >= 0 && v !== answer && !distractors.includes(v)) distractors.push(v);
    if (distractors.length === 2) break;
  }
  for (let k = 1; distractors.length < 2; k++) {
    const v = answer + k * 7;
    if (v !== answer && !distractors.includes(v)) distractors.push(v);
  }
  const word = { "+": "plus", "\u2212": "minus", "\u00d7": "times" }[sign];
  return { text, answer, distractors, explanation: `${a} ${sign} ${b} = ${answer}`, spoken: `${a} ${word} ${b} equals?`, meta: { kind, a, b } };
}
registerQuestionGenerator("math", mathGenerator);


const distinct = (answer, candidates, n = 2) => { const out = []; for (const v of candidates) if (v !== answer && !out.includes(v)) { out.push(v); if (out.length === n) break; } return out; };

// "2, 4, 6, ?"  - number patterns (steps grow with level)
registerQuestionGenerator("patterns", ({ rng, level }) => {
  const step = int(rng, 1, [3, 5, 8, 12][Math.min(3, level - 1)]); const start = int(rng, 1, 12); const grow = level >= 3 && rng() > 0.6;
  const seq = [start]; for (let i = 1; i < 4; i++) seq.push(seq[i - 1] + (grow ? step + i : step)); const next = seq[3] + (grow ? step + 4 : step);
  const d = grow ? step + 4 : step;
  const distractors = distinct(next, shuffle(rng, [next + 1, next - 1, next + d, next - d, next + 2, seq[3] + 1]).filter((v) => v > 0));
  return { text: `${seq.slice(0, 4).join(", ")}, ?`, answer: next, distractors, explanation: `The pattern adds ${grow ? "a little more each time" : step}: next is ${next}`, spoken: `What comes next? ${seq.join(", ")}`, meta: { kind: "pattern", step, grow, next, seq } };
});

// biggest / smallest number
registerQuestionGenerator("compare", ({ rng, level }) => {
  const max = [20, 50, 100, 999][Math.min(3, level - 1)]; const nums = new Set(); while (nums.size < 3) nums.add(int(rng, 1, max));
  const list = [...nums]; const big = rng() > 0.5; const answer = big ? Math.max(...list) : Math.min(...list);
  return { text: big ? "Which is the BIGGEST?" : "Which is the SMALLEST?", answer, distractors: list.filter((v) => v !== answer), explanation: `${answer} is the ${big ? "biggest" : "smallest"} of ${list.join(", ")}`, meta: { kind: "compare", big, list } };
});

const pickSubjectBank = (rng, level, key) => { const bank = SUBJECT_BANKS[key]; const tier = bank.filter((q) => q.level <= level); return pick(rng, tier.length ? tier : bank); };

registerQuestionGenerator("spelling", ({ rng, level }) => {
  const w = pickSubjectBank(rng, level, "spelling").word; const i = int(rng, 0, w.length - 1); const letter = w[i];
  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("").filter((c) => c !== letter);
  // For a vowel, prefer other vowels as distractors (they look more alike); a Set removes duplicates.
  const prefer = "aeiou".includes(letter) ? shuffle(rng, alphabet.filter((c) => "aeiou".includes(c))) : [];
  const wrong = [...new Set([...prefer, ...shuffle(rng, alphabet)])].slice(0, 2);
  const shown = w.split("").map((c, k) => (k === i ? "_" : c)).join(" ").toUpperCase();
  return { text: shown, answer: letter.toUpperCase(), distractors: wrong.map((c) => c.toUpperCase()), explanation: `${w.toUpperCase()} - the missing letter is ${letter.toUpperCase()}`, spoken: `Which letter is missing in ${w.split("").map((c, k) => (k === i ? "blank" : c)).join(", ")}?`, meta: { kind: "spelling", word: w, letter: letter.toUpperCase(), index: i } };
});

registerQuestionGenerator("science", ({ rng, level }) => {
  const q = pickSubjectBank(rng, level, "science");
  return { text: q.q, answer: q.a, distractors: shuffle(rng, q.wrong).slice(0, 2), explanation: `${q.q} ${q.a}`, meta: { kind: "science" } };
});

registerQuestionGenerator("shapes", ({ rng, level }) => {
  const sh = pickSubjectBank(rng, level, "shapes"); const ask = sh.sides;
  const cand = shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 8].filter((n) => n !== ask));
  return { text: `Sides of a ${sh.name}?`, answer: ask, distractors: cand.slice(0, 2), explanation: `A ${sh.name} has ${ask} ${ask === 1 ? "side" : "sides"}`, spoken: `How many sides does a ${sh.name} have?`, meta: { kind: "shapes", name: sh.name, sides: ask } };
});

/**
 * @param {{subject?:string, level?:number, rng?:()=>number, avoidText?:string}} opts
 * @returns {{id:string, subject:string, level:number, text:string, options:{label:string,value:number|string}[], correctIndex:number, explanation:string}}
 */
export function generateQuestion({ subject = "math", level = 1, rng = Math.random, avoidText = "" } = {}) {
  const gen = generators.get(subject);
  if (!gen) throw new Error(`No question generator registered for subject "${subject}"`);
  let raw = gen({ rng, level });
  for (let tries = 0; tries < 6 && raw.text === avoidText; tries++) raw = gen({ rng, level });
  const values = shuffle(rng, [raw.answer, ...raw.distractors.slice(0, 2)]);
  const correctIndex = values.findIndex((v) => v === raw.answer);
  return {
    id: `q${++serial}`,
    subject,
    level,
    text: raw.text,
    options: values.map((v) => ({ label: String(v), value: v })),
    correctIndex,
    explanation: raw.explanation || "",
    spoken: raw.spoken || raw.text,
    meta: raw.meta || null,
  };
}

/** Difficulty ramps slowly with correct answers so young players stay in the comfortable zone. */
export const levelForProgress = (correctAnswers, grade = 1) => Math.min(4, Math.max(1, grade) + Math.floor(Math.max(0, correctAnswers) / 4));

/** Choose a subject from the player's selection, avoiding the same one twice in a row when there is a choice. */
export function pickSubject(rng, subjects, last = "") {
  const list = (subjects || []).filter((s) => generators.has(s)); const pool = list.length > 1 ? list.filter((s) => s !== last) : list;
  return pool.length ? pool[Math.floor(rng() * pool.length) % pool.length] : "math";
}
