// Next.js serves an empty server HTML shell (no root layout, no <main>, no lang)
// when a matched page calls notFound() (vercel/next.js#99793). Missing listings
// are therefore resolved in src/proxy.ts and rewritten, with a 404 status, to a
// route that server-renders the full layout.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { listingRouteDecision, MISSING_LISTING_PATH, lookupStatus } = require("./listingNotFoundRoute");

test("an invalid id is rewritten to the missing page without an API call", async () => {
  let calls = 0;
  const decision = await listingRouteDecision("abc", async () => { calls += 1; return 200; });
  assert.deepEqual(decision, { rewrite: `${MISSING_LISTING_PATH}/invalid`, status: 404 });
  assert.equal(calls, 0);
  for (const bad of ["0", "01", "-1", "1.5", "", "1e3"]) {
    assert.equal((await listingRouteDecision(bad, async () => 200)).status, 404, bad);
  }
});

test("a definite API 404 is rewritten to the missing page for that id", async () => {
  assert.deepEqual(await listingRouteDecision("42", async () => 404), { rewrite: `${MISSING_LISTING_PATH}/42`, status: 404 });
});

test("found, API errors, and timeouts fall through to the normal page", async () => {
  assert.equal(await listingRouteDecision("42", async () => 200), null);
  assert.equal(await listingRouteDecision("42", async () => 500), null);
  assert.equal(await listingRouteDecision("42", async () => { throw new Error("timeout"); }), null);
});

test("lookupStatus asks the public API anonymously with a timeout", async () => {
  let seen;
  const status = await lookupStatus("7", "http://api.test/", async (url, init) => { seen = { url, init }; return { status: 404 }; });
  assert.equal(status, 404);
  assert.equal(seen.url, "http://api.test/api/listings/7");
  assert.equal(seen.init.headers, undefined);
  assert.ok(seen.init.signal instanceof AbortSignal);
});

test("the proxy and the missing page are wired up", () => {
  const root = path.join(__dirname, "..");
  const proxy = fs.readFileSync(path.join(root, "proxy.ts"), "utf8");
  assert.match(proxy, /matcher:\s*\[\s*"\/listings\/:id"/);
  assert.match(proxy, /listingRouteDecision/);
  const page = fs.readFileSync(path.join(root, "app", "listing-not-found", "[id]", "page.tsx"), "utf8");
  assert.match(page, /ListingNotFound/);
  assert.match(page, /index:\s*false/);
});
