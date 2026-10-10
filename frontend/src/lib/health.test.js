const { test } = require("node:test");
const assert = require("node:assert/strict");
const { healthPayload } = require("./health");

test("health is ok with the Railway commit", () => {
  assert.deepEqual(healthPayload({ RAILWAY_GIT_COMMIT_SHA: "ABCDEF1234567" }), {
    status: "ok",
    service: "lodgist-frontend",
    commit: "abcdef1234567",
  });
});

test("health stays ok without a commit and never echoes other env", () => {
  const body = healthPayload({ DATABASE_URL: "postgres://secret", RAILWAY_GIT_COMMIT_SHA: "not a sha" });
  assert.deepEqual(body, { status: "ok", service: "lodgist-frontend", commit: null });
  assert.equal(JSON.stringify(body).includes("secret"), false);
  assert.equal(healthPayload(undefined).status, "ok");
});
