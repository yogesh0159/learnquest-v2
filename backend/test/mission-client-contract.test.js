const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (relative) => fs.readFileSync(path.join(__dirname, "..", "..", relative), "utf8");

test("mission client uses the reusable mission system and accessible controls", () => {
  const page = read("frontend/realworld-missions.html");
  const client = read("frontend/js/realworld-missions.js");
  assert.match(page, /aria-live="polite"/);
  assert.match(client, /new MissionSystem/);
  assert.match(client, /\^\[1-3\]\$/);
  assert.match(client, /ArrowDown/);
  assert.match(client, /button\.onclick = \(\) => system\.answer/);
});

test("mission UI explains mistakes and displays measurable evidence", () => {
  const client = read("frontend/js/realworld-missions.js");
  assert.match(client, /Attempts \$\{progress\.attempts/);
  assert.match(client, /Correct \$\{progress\.correct/);
  assert.match(client, /Mistakes \$\{progress\.mistakes/);
  assert.match(client, /result\.explanation/);
  assert.match(client, /correct choice: \$\{result\.correctAnswer\}/);
});
