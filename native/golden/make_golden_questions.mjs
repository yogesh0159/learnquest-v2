// Writes native/golden/golden_questions.jsonl: 1 JSON record per question made by the JavaScript generator. Python must reproduce each one exactly.
import fs from "node:fs";
import { questionAt, questionSubjects } from "../../frontend/js/game/jungle-run/question-service.js";
const out = []; const seeds = [1, 7, 42, 777, 123456, 2463534242, 4294967295, -5];
for (const subject of questionSubjects()) for (let level = 1; level <= 4; level++) for (const seed of seeds) for (let index = 0; index < 5; index++) out.push(JSON.stringify({ seed, index, subject, level, q: questionAt({ seed, index, subject, level }) }));
fs.writeFileSync(new URL("./golden_questions.jsonl", import.meta.url), out.join("\n") + "\n");
console.log(`golden_questions.jsonl: ${out.length} questions`);
