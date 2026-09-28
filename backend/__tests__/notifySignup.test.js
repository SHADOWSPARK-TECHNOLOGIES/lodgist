const test = require("node:test");
const assert = require("node:assert");
const { notifySignup } = require("../src/utils/notifySignup");

test("no-op without SIGNUP_WEBHOOK_URL", async () => {
  delete process.env.SIGNUP_WEBHOOK_URL;
  let called = false;
  assert.strictEqual(await notifySignup({ role: "USER" }, () => { called = true; }), false);
  assert.strictEqual(called, false);
});

test("posts role/method only, never personal data", async () => {
  process.env.SIGNUP_WEBHOOK_URL = "https://example.test/hook";
  process.env.SIGNUP_WEBHOOK_KEY = "k";
  let sent;
  const ok = await notifySignup({ role: "USER", method: "password" }, async (url, opts) => { sent = { url, opts }; });
  assert.strictEqual(ok, true);
  const body = JSON.parse(sent.opts.body);
  assert.deepStrictEqual(Object.keys(body).sort(), ["at", "event", "method", "role"]);
  assert.strictEqual(sent.opts.headers.authorization, "Bearer k");
});

test("swallows network errors", async () => {
  process.env.SIGNUP_WEBHOOK_URL = "https://example.test/hook";
  assert.strictEqual(await notifySignup({ role: "USER" }, async () => { throw new Error("down"); }), false);
});
