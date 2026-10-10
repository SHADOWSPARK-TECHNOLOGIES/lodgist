const { test } = require("node:test");
const assert = require("node:assert/strict");
const { authSessionFromResponse } = require("./authSession");

const user = { id: 1, email: "a@b.test", name: "A", role: "TENANT", isHNW: false };

test("top-level shape (what /api/auth/login returns today)", () => {
  assert.deepEqual(authSessionFromResponse({ success: true, message: "Login successful", user, token: "t" }), { token: "t", user });
});

test("data-wrapped shape is still accepted", () => {
  assert.deepEqual(authSessionFromResponse({ success: true, data: { user, token: "t" } }), { token: "t", user });
});

test("failures and partial bodies give no session", () => {
  for (const body of [null, undefined, {}, { success: false, token: "t", user }, { success: true, user }, { success: true, token: "t" }, { success: true, token: "", user }, { success: true, data: {} }]) {
    assert.equal(authSessionFromResponse(body), null, JSON.stringify(body));
  }
});

test("completeLogin signs in from the top-level shape and rejects the old 'Login successful' trap", async () => {
  const { completeLogin, LOGIN_FAILED } = require("./authSession");
  let signedIn = null;
  const session = await completeLogin(async () => ({ success: true, message: "Login successful", user, token: "t", refreshToken: "r" }), (s) => { signedIn = s; });
  assert.deepEqual(signedIn, { token: "t", user });
  assert.equal(session.token, "t");
  assert.equal("refreshToken" in signedIn, false);
  await assert.rejects(completeLogin(async () => ({ success: false, error: "Invalid credentials" }), () => assert.fail("must not sign in")), { message: LOGIN_FAILED });
});

test("AuthContext.loginFn goes through completeLogin and stores the session", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const src = fs.readFileSync(path.join(__dirname, "..", "context", "AuthContext.tsx"), "utf8");
  const login = src.slice(src.indexOf("const loginFn"), src.indexOf("const logout"));
  assert.match(login, /completeLogin\(/);
  assert.match(login, /setToken\(session\.token\)/);
  assert.doesNotMatch(login, /res\.data/);
  assert.doesNotMatch(src, /refreshToken/);
});
