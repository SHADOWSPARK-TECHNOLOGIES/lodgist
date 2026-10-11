// The neighborhood page's server fetch uses the app's request timeout and
// tells missing, timed-out, failed and loaded listings apart.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadNeighborhoodListing } = require("./neighborhoodLoad");
const { REQUEST_TIMEOUT_MS } = require("./requestTimeout");

const res = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });

test("a definite 404 is missing", async () => {
  assert.deepEqual(await loadNeighborhoodListing("4", "http://api", res(404, {})), { kind: "missing" });
});

test("a 5xx or a 200 without data is an error, never missing", async () => {
  assert.deepEqual(await loadNeighborhoodListing("4", "http://api", res(503, {})), { kind: "error" });
  assert.deepEqual(await loadNeighborhoodListing("4", "http://api", res(200, {})), { kind: "error" });
  assert.deepEqual(await loadNeighborhoodListing("4", "http://api", async () => { throw new TypeError("fetch failed"); }), { kind: "error" });
});

test("a 200 with data is ok and the URL is the public listing", async () => {
  let url;
  const out = await loadNeighborhoodListing("4", "http://api/", async (u) => { url = u; return res(200, { data: { id: 4 } })(); });
  assert.deepEqual(out, { kind: "ok", listing: { id: 4 } });
  assert.equal(url, "http://api/api/listings/4");
});

test("a hung API times out", async () => {
  const hang = (_url, init) => new Promise((_, reject) => {
    init.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })));
  });
  const started = Date.now();
  assert.deepEqual(await loadNeighborhoodListing("4", "http://api", hang, 50), { kind: "timeout" });
  assert.ok(Date.now() - started < 2000);
});

test("the default timeout is the app standard", () => {
  assert.equal(REQUEST_TIMEOUT_MS, 15000);
  const src = fs.readFileSync(path.join(__dirname, "neighborhoodLoad.js"), "utf8");
  assert.match(src, /ms = REQUEST_TIMEOUT_MS/);
});

test("the page uses the loader, shows timeout and no-location states, and has no bare notFound after loading", () => {
  const page = fs.readFileSync(path.join(__dirname, "..", "app", "listings", "[id]", "neighborhood", "page.tsx"), "utf8");
  assert.match(page, /loadNeighborhoodListing/);
  assert.match(page, /TIMEOUT_MESSAGE/);
  assert.doesNotMatch(page, /if \(!context\) notFound\(\)/);
  assert.doesNotMatch(page, /if \(!listing\) notFound\(\)/);
  assert.match(page, /neighborhoodCopy\.noLocation/);
});
