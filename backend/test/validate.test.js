const test = require("node:test");
const assert = require("node:assert/strict");
const { isValidEmail, isValidPin, isValidPassword, isNonEmptyString, clampInt, isOneOf, asString } = require("../utils/validate");

test("isValidEmail accepts well-formed addresses", () => {
  assert.equal(isValidEmail("parent@example.com"), true);
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail(""), false);
});

test("isValidPin requires exactly 4 digits", () => {
  assert.equal(isValidPin("1234"), true);
  assert.equal(isValidPin("12a4"), false);
  assert.equal(isValidPin("123"), false);
  assert.equal(isValidPin("12345"), false);
});

test("isValidPassword enforces minimum length", () => {
  assert.equal(isValidPassword("secret1"), true);
  assert.equal(isValidPassword("abc"), false);
});

test("isNonEmptyString respects bounds", () => {
  assert.equal(isNonEmptyString("hi"), true);
  assert.equal(isNonEmptyString(""), false);
  assert.equal(isNonEmptyString("x".repeat(10), { maxLength: 5 }), false);
});

test("clampInt clamps to range and falls back on NaN", () => {
  assert.equal(clampInt(5, 0, 10), 5);
  assert.equal(clampInt(50, 0, 10), 10);
  assert.equal(clampInt(-5, 0, 10), 0);
  assert.equal(clampInt("not-a-number", 0, 10, 3), 3);
});

test("isOneOf checks membership", () => {
  assert.equal(isOneOf("hi", ["en", "hi", "mr"]), true);
  assert.equal(isOneOf("fr", ["en", "hi", "mr"]), false);
});

test("asString trims and truncates", () => {
  assert.equal(asString("  hello  "), "hello");
  assert.equal(asString("abcdef", { maxLength: 3 }), "abc");
  assert.equal(asString(null), "");
});
