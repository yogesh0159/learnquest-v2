const test = require("node:test");
const assert = require("node:assert/strict");

// utils/auth.js throws at require-time if NODE_ENV=production without
// JWT_SECRET, so make sure the test env looks like local dev.
delete process.env.NODE_ENV;
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_secret";

const { hashPin, verifyPin, isBcryptHash, signToken, requireAuth } = require("../utils/auth");

test("hashPin produces a bcrypt hash, not the raw PIN", async () => {
  const hash = await hashPin("1234");
  assert.notEqual(hash, "1234");
  assert.equal(isBcryptHash(hash), true);
});

test("verifyPin matches the correct PIN against its hash", async () => {
  const hash = await hashPin("4321");
  assert.equal(await verifyPin("4321", hash), true);
  assert.equal(await verifyPin("0000", hash), false);
});

test("verifyPin still accepts legacy plaintext PINs (pre-migration)", async () => {
  assert.equal(await verifyPin("1234", "1234"), true);
  assert.equal(await verifyPin("9999", "1234"), false);
});

test("signToken + requireAuth round-trip via a fake request", () => {
  const token = signToken({ id: "child_1", role: "child", name: "Test" });
  const middleware = requireAuth("child");
  const req = { headers: { authorization: `Bearer ${token}` } };
  let nextCalled = false;
  const res = { status: () => res, json: () => res };
  middleware(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(req.user.id, "child_1");
});

test("requireAuth rejects a missing token", () => {
  const middleware = requireAuth("child");
  const req = { headers: {} };
  let statusCode = null;
  const res = {
    status(code) { statusCode = code; return this; },
    json() { return this; },
  };
  middleware(req, res, () => { throw new Error("next() should not be called"); });
  assert.equal(statusCode, 401);
});
