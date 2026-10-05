const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");

test("CSP blocks framing and constrains base tags and form submissions", () => {
  assert.match(source, /baseUri: \["'self'"\]/);
  assert.match(source, /formAction: \["'self'"\]/);
  assert.match(source, /frameAncestors: \["'none'"\]/);
});

test("child-sensitive APIs are non-cacheable and invasive browser capabilities are disabled", () => {
  assert.match(source, /Cache-Control", "no-store"/);
  assert.match(source, /camera=\(\), microphone=\(\), geolocation=\(\)/);
});
