import { seededFor } from "./rng.js";
import { generateQuestion, listQuestionSubjects } from "./question-generator.js";

/**
 * Stateless, reproducible questions: the same (seed, index, subject, level) always gives the same question, in JavaScript
 * (here), in Python (native/python/questions.py) and therefore on the server.  That lets the backend re-create a question
 * from a few numbers and check an answer without storing anything and without trusting the browser.
 */
export function questionAt({ seed = 1, index = 0, subject = "math", level = 1 } = {}) {
  const rng = seededFor(seed, index);
  const q = generateQuestion({ subject, level, rng });
  return { subject: q.subject, level: q.level, text: q.text, options: q.options.map((o) => ({ label: o.label, value: o.value })), correctIndex: q.correctIndex, explanation: q.explanation, spoken: q.spoken, meta: q.meta };
}

export function verifyAnswer({ seed, index, subject, level, chosenIndex }) {
  const q = questionAt({ seed, index, subject, level });
  const chosen = Number(chosenIndex);
  return { correct: chosen === q.correctIndex, correctIndex: q.correctIndex, explanation: q.explanation };
}

export const questionSubjects = () => listQuestionSubjects();
