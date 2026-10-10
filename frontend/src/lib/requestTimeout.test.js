const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  REQUEST_TIMEOUT_MS,
  TIMEOUT_MESSAGE,
  timeoutSignal,
  isAbortError,
  isValidListingId,
} = require("./requestTimeout");

test("default request timeout is 15 seconds", () => {
  assert.equal(REQUEST_TIMEOUT_MS, 15000);
  assert.match(TIMEOUT_MESSAGE, /took too long/i);
});

test("timeoutSignal aborts after the given time and reports it timed out", async () => {
  const t = timeoutSignal(undefined, 20);
  assert.equal(t.signal.aborted, false);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(t.signal.aborted, true);
  assert.equal(t.timedOut(), true);
  t.cleanup();
});

test("cleanup stops the timer so a finished request is not aborted", async () => {
  const t = timeoutSignal(undefined, 20);
  t.cleanup();
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(t.signal.aborted, false);
  assert.equal(t.timedOut(), false);
});

test("a caller abort passes through and is not reported as a timeout", () => {
  const caller = new AbortController();
  const t = timeoutSignal(caller.signal, 1000);
  caller.abort();
  assert.equal(t.signal.aborted, true);
  assert.equal(t.timedOut(), false);
  t.cleanup();
});

test("an already-aborted caller signal aborts immediately", () => {
  const caller = new AbortController();
  caller.abort();
  const t = timeoutSignal(caller.signal, 1000);
  assert.equal(t.signal.aborted, true);
  assert.equal(t.timedOut(), false);
  t.cleanup();
});

test("isAbortError recognises abort errors only", () => {
  assert.equal(isAbortError({ name: "AbortError" }), true);
  assert.equal(isAbortError(new Error("network")), false);
  assert.equal(isAbortError(null), false);
});

test("listing ids must be positive integers without leading zeros or junk", () => {
  assert.equal(isValidListingId("1"), true);
  assert.equal(isValidListingId("999999"), true);
  for (const bad of ["0", "-1", "abc", "1.5", "01", "", "1e3", " 1", undefined]) {
    assert.equal(isValidListingId(bad), false, String(bad));
  }
});
