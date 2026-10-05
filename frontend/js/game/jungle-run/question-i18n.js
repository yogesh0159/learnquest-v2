/**
 * Language-neutral question content (maths, patterns, spelling letters) is shown as is; the *wording* around it
 * (prompts such as "Which is the BIGGEST?", explanations, and the spoken text) is localised here from the question's `meta`.
 * Science facts and spelling words are English-language content and stay in English on purpose.
 */
export function localizeQuestion(q, t, lang = "en") {
  const base = { text: q.text, explanation: q.explanation, spoken: q.spoken || q.text };
  if (lang === "en" || !q.meta) return base;
  const m = q.meta;
  switch (m.kind) {
    case "add": case "sub": case "mul": {
      const w = t(m.kind === "add" ? "sp.plus" : m.kind === "sub" ? "sp.minus" : "sp.times");
      return { ...base, spoken: `${m.a} ${w} ${m.b} ${t("sp.equals")}?` };
    }
    case "compare":
      return { text: t(m.big ? "q.biggest" : "q.smallest"), explanation: t(m.big ? "exp.compare.big" : "exp.compare.small", { n: q.options[q.correctIndex].label, list: m.list.join(", ") }), spoken: `${t(m.big ? "sp.biggest" : "sp.smallest")} ${m.list.join(", ")}` };
    case "shapes": {
      const shape = t(`shape.${m.name}`);
      return { text: t("q.sides", { shape }), explanation: t("exp.shape", { shape, n: m.sides }), spoken: t("sp.sides", { shape }) };
    }
    case "pattern":
      return { ...base, explanation: t(m.grow ? "exp.pattern" : "exp.pattern.step", { step: m.step, n: m.next }), spoken: `${t("sp.next")} ${m.seq.join(", ")}` };
    case "spelling":
      return { ...base, explanation: t("exp.spelling", { word: m.word.toUpperCase(), letter: m.letter }), spoken: t("sp.spell", { word: m.word.split("").map((c, k) => (k === m.index ? "_" : c)).join(", ") }) };
    default: return base;
  }
}
