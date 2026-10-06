/**
 * Language-neutral question content (maths, patterns, spelling letters) is shown as is; the *wording* around it
 * (prompts such as "Which is the BIGGEST?", explanations, and the spoken text) is localised here from the question's `meta`.
 * Science facts and spelling words are English-language content and stay in English on purpose.
 */
function localizeBase(q, t, lang = "en") {
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

/* ------------------------------------------------------------------------------------------------------------------------------------
 * Exciting wording: every question is a "gate" of the jungle with a little story.  The question board keeps the short sum (9 - 6 = ?);
 * the banner and the voice tell the story.  The variant is chosen from the numbers of the question, so it is always the same for the same question.
 * {a} {b} = the numbers, {text} = the short question, {shape} = the localised shape name
 * ------------------------------------------------------------------------------------------------------------------------------------ */
const STORY = {
  en: {
    add: ["\u{1F412} Monkey Maths: {a} monkeys sit on a branch and {b} more jump on. How many monkeys now?", "\u{1FA99} Treasure Gate: you find {a} gold coins, then {b} more. How many coins in the chest?", "\u{1F34C} Banana Bridge: {a} bananas in one basket and {b} in the other. How many bananas?", "\u{1F99C} Parrot Post: {a} parrots in the tree and {b} fly in. How many parrots?"],
    sub: ["\u{1F412} Monkey Maths: {a} monkeys on a branch, {b} swing away. How many are left?", "\u{1FA99} Treasure Gate: {a} coins in the chest, you spend {b}. How many are left?", "\u{1F34C} Banana Bridge: {a} bananas, the monkeys eat {b}. How many are left?", "\u{1F99C} Parrot Post: {a} parrots in the tree, {b} fly away. How many stay?"],
    mul: ["\u{1F42F} Tiger Gate: {a} baskets with {b} mangoes in each. How many mangoes in all?", "\u{1FA99} Treasure Gate: {a} chests with {b} coins in each. How many coins?", "\u{1F99C} Parrot Post: {a} nests with {b} eggs in each. How many eggs?"],
    pattern: ["\u{1F300} Mystery Path: what comes next?  {text}", "\u{1F5DD}\uFE0F Secret Code: find the next number.  {text}"],
    compare_big: ["\u{1F3C6} Giant's Choice: pick the BIGGEST number to open the gate!"], compare_small: ["\u{1F41C} Tiny Gate: pick the SMALLEST number to squeeze through!"],
    shapes: ["\u{1F537} Shape Gate: {text}"], spelling: ["\u{1F524} Word Gate: which letter is missing?  {text}"], science: ["\u{1F52C} Science Gate: {text}"],
  },
  hi: {
    add: ["\u{1F412} बंदर गणित: डाल पर {a} बंदर बैठे हैं और {b} और कूद आए। अब कुल कितने बंदर?", "\u{1FA99} ख़ज़ाने का दरवाज़ा: तुम्हें {a} सोने के सिक्के मिले, फिर {b} और। संदूक में कुल कितने सिक्के?", "\u{1F34C} केला पुल: एक टोकरी में {a} केले और दूसरी में {b}। कुल कितने केले?", "\u{1F99C} तोता चौकी: पेड़ पर {a} तोते हैं, {b} और आ गए। कुल कितने तोते?"],
    sub: ["\u{1F412} बंदर गणित: डाल पर {a} बंदर थे, {b} झूलकर चले गए। कितने बचे?", "\u{1FA99} ख़ज़ाने का दरवाज़ा: संदूक में {a} सिक्के हैं, तुमने {b} खर्च किए। कितने बचे?", "\u{1F34C} केला पुल: {a} केले थे, बंदरों ने {b} खा लिए। कितने बचे?", "\u{1F99C} तोता चौकी: पेड़ पर {a} तोते थे, {b} उड़ गए। कितने रुके?"],
    mul: ["\u{1F42F} बाघ का दरवाज़ा: {a} टोकरियाँ हैं और हर टोकरी में {b} आम। कुल कितने आम?", "\u{1FA99} ख़ज़ाने का दरवाज़ा: {a} संदूक, हर संदूक में {b} सिक्के। कुल कितने सिक्के?", "\u{1F99C} तोता चौकी: {a} घोंसले, हर घोंसले में {b} अंडे। कुल कितने अंडे?"],
    pattern: ["\u{1F300} रहस्य का रास्ता: अगला क्या आएगा?  {text}", "\u{1F5DD}\uFE0F गुप्त कोड: अगली संख्या खोजो।  {text}"],
    compare_big: ["\u{1F3C6} दानव की पसंद: दरवाज़ा खोलने के लिए सबसे बड़ी संख्या चुनो!"], compare_small: ["\u{1F41C} नन्हा दरवाज़ा: निकलने के लिए सबसे छोटी संख्या चुनो!"],
    shapes: ["\u{1F537} आकृति का दरवाज़ा: {text}"], spelling: ["\u{1F524} शब्द का दरवाज़ा: कौन सा अक्षर छूट गया है?  {text}"], science: ["\u{1F52C} विज्ञान का दरवाज़ा: {text}"],
  },
  mr: {
    add: ["\u{1F412} माकड गणित: फांदीवर {a} माकडे बसली आहेत आणि {b} आणखी उडी मारून आली. आता एकूण किती माकडे?", "\u{1FA99} खजिन्याचे दार: तुम्हाला {a} सोन्याची नाणी मिळाली, मग {b} आणखी. पेटीत एकूण किती नाणी?", "\u{1F34C} केळ्यांचा पूल: एका टोपलीत {a} केळी आणि दुसऱ्यात {b}. एकूण किती केळी?", "\u{1F99C} पोपट चौकी: झाडावर {a} पोपट आहेत, {b} आणखी आले. एकूण किती पोपट?"],
    sub: ["\u{1F412} माकड गणित: फांदीवर {a} माकडे होती, {b} झोके घेत गेली. किती उरली?", "\u{1FA99} खजिन्याचे दार: पेटीत {a} नाणी आहेत, तुम्ही {b} खर्च केली. किती उरली?", "\u{1F34C} केळ्यांचा पूल: {a} केळी होती, माकडांनी {b} खाल्ली. किती उरली?", "\u{1F99C} पोपट चौकी: झाडावर {a} पोपट होते, {b} उडून गेले. किती राहिले?"],
    mul: ["\u{1F42F} वाघाचे दार: {a} टोपल्या आहेत आणि प्रत्येकीत {b} आंबे. एकूण किती आंबे?", "\u{1FA99} खजिन्याचे दार: {a} पेट्या, प्रत्येकीत {b} नाणी. एकूण किती नाणी?", "\u{1F99C} पोपट चौकी: {a} घरटी, प्रत्येकात {b} अंडी. एकूण किती अंडी?"],
    pattern: ["\u{1F300} गूढ वाट: पुढे काय येईल?  {text}", "\u{1F5DD}\uFE0F गुप्त कोड: पुढची संख्या शोधा.  {text}"],
    compare_big: ["\u{1F3C6} राक्षसाची निवड: दार उघडण्यासाठी सर्वात मोठी संख्या निवडा!"], compare_small: ["\u{1F41C} लहान दार: बाहेर पडण्यासाठी सर्वात लहान संख्या निवडा!"],
    shapes: ["\u{1F537} आकाराचे दार: {text}"], spelling: ["\u{1F524} शब्दाचे दार: कोणते अक्षर राहिले आहे?  {text}"], science: ["\u{1F52C} विज्ञानाचे दार: {text}"],
  },
};
const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ""));

export function localizeQuestion(q, t, lang = "en") {
  const res = localizeBase(q, t, lang); const m = q.meta || {}; const S = STORY[lang] || STORY.en;
  const kind = m.kind === "add" || m.kind === "sub" || m.kind === "mul" ? m.kind : m.kind === "compare" ? (m.big ? "compare_big" : "compare_small") : m.kind === "pattern" ? "pattern" : m.kind === "shapes" ? "shapes" : m.kind === "spelling" ? "spelling" : "science";
  const list = S[kind] || STORY.en[kind]; const pick = list[(Math.abs(m.a | 0) + Math.abs(m.b | 0) + Math.abs(m.next | 0) + Math.abs(m.step | 0) + (q.text || "").length) % list.length];
  const story = fill(pick, { a: m.a, b: m.b, text: res.text });
  return { ...res, story, spokenStory: story.replace(/^[^\p{L}\p{N}]+/u, "").replace(/\s{2,}/g, " ") };
}
