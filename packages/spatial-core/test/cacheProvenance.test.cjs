const { test } = require("node:test");
const assert = require("node:assert/strict");
const { callTool, createSafeguardState } = require("../src/index.cjs");

const SELF = "https://overpass.self.example/api/interpreter";
const registry = [
  { id: "overpass-selfhosted", status: "cleared", env: "OVERPASS_SELFHOSTED_URL", commercialUse: "APPROVED_FOR_COMMERCIAL_USE", attribution: "Primary attribution" },
  { id: "overpass-public", status: "cleared", env: "OVERPASS_INTERPRETER_URL", commercialUse: "DEVELOPMENT_ONLY", attribution: "© OpenStreetMap contributors" },
];
const listing = { id: 42, title: "Flat", public: true, property: { lga: "Owerri West", city: "Owerri", state: "Imo" }, approxLocation: { lat: 5.495, lng: 7.035, radius_m: 500 } };
const body = { elements: [{ type: "node", id: 1, lat: 5.4951, lon: 7.0351, tags: { amenity: "pharmacy", name: "Chemist" } }] };

// A host fetch wrapper that served the call from a fallback provider says so.
function hostFetch(servedBy) {
  const calls = [];
  const fn = async (url) => {
    calls.push(String(url));
    const headers = { "Content-Type": "application/json" };
    if (servedBy) headers["X-Spatial-Provider"] = servedBy;
    return new Response(JSON.stringify(body), { status: 200, headers });
  };
  fn.calls = calls;
  return fn;
}

function ctx(fetchImpl, safeguardState) {
  return {
    listings: [listing], isPublicListing: (l) => l && l.public === true,
    env: { OVERPASS_SELFHOSTED_URL: SELF }, registry, fetchImpl, safeguardState,
    lookup: async () => [{ address: "1.1.1.1", family: 4 }], now: () => Date.parse("2026-10-10T12:00:00Z"),
  };
}

test("cache entries store the provider that actually served the data", async () => {
  const state = createSafeguardState();
  const fetchImpl = hostFetch("overpass-public");
  const miss = await callTool("lodgist.nearby_amenities", { listingId: 42 }, ctx(fetchImpl, state));
  assert.equal(miss.ok, true, JSON.stringify(miss));
  assert.deepEqual(miss.meta.cache, { hit: false, servedBy: { provider: "overpass-public", commercialUse: "DEVELOPMENT_ONLY", attribution: "© OpenStreetMap contributors" } });
  const entry = [...state.cache.values()][0];
  assert.equal(entry.servedBy.provider, "overpass-public");
  assert.equal(entry.servedBy.commercialUse, "DEVELOPMENT_ONLY");
  assert.equal(entry.servedBy.attribution, "© OpenStreetMap contributors");
});

test("a fallback-fetched result served from cache never names the primary provider", async () => {
  const state = createSafeguardState();
  const fetchImpl = hostFetch("overpass-public");
  await callTool("lodgist.nearby_amenities", { listingId: 42 }, ctx(fetchImpl, state));
  const hit = await callTool("lodgist.nearby_amenities", { listingId: 42 }, ctx(fetchImpl, state));
  assert.equal(fetchImpl.calls.length, 1, "served from cache");
  assert.equal(hit.ok, true);
  assert.deepEqual(hit.meta.cache, { hit: true, servedBy: { provider: "overpass-public", commercialUse: "DEVELOPMENT_ONLY", attribution: "© OpenStreetMap contributors" } });
  assert.equal(hit.provenance.provider, "overpass-public");
  assert.equal(hit.provenance.commercialUse, "DEVELOPMENT_ONLY");
  assert.equal(hit.provenance.attribution, "© OpenStreetMap contributors");
  assert.equal(hit.provenance.fallbackFrom, "overpass-selfhosted");
  assert.deepEqual(hit.servedBy, { provider: "overpass-public", requestedProvider: "overpass-selfhosted", fallback: true, commercialUse: "DEVELOPMENT_ONLY", attribution: "© OpenStreetMap contributors" });
  assert.equal(hit.dataQuality.servedBy, "overpass-public");
  assert.ok(hit.dataQuality.ruleIds.includes("dq.provider.fallback"));
  assert.ok(hit.dataQuality.warnings.some((w) => /fallback/i.test(w)));
  assert.ok(hit.warnings.some((w) => w.includes("overpass-public")));
  const scrubbed = JSON.stringify(Object.assign({}, hit, {
    servedBy: Object.assign({}, hit.servedBy, { requestedProvider: null }),
    provenance: Object.assign({}, hit.provenance, { fallbackFrom: null }),
    warnings: [], dataQuality: null,
  }));
  assert.ok(!scrubbed.includes("overpass-selfhosted") && !scrubbed.includes("Primary attribution"), scrubbed);
});

test("a direct cache hit names the primary with no fallback warning", async () => {
  const state = createSafeguardState();
  const fetchImpl = hostFetch(null);
  await callTool("lodgist.nearby_amenities", { listingId: 42 }, ctx(fetchImpl, state));
  const hit = await callTool("lodgist.nearby_amenities", { listingId: 42 }, ctx(fetchImpl, state));
  assert.equal(hit.meta.cache.hit, true);
  assert.equal(hit.meta.cache.servedBy.provider, "overpass-selfhosted");
  assert.equal(hit.provenance.provider, "overpass-selfhosted");
  assert.equal(hit.servedBy.fallback, false);
  assert.ok(!hit.dataQuality.ruleIds.includes("dq.provider.fallback"));
});

test("an unknown X-Spatial-Provider header cannot rewrite provenance", async () => {
  const state = createSafeguardState();
  const miss = await callTool("lodgist.nearby_amenities", { listingId: 42 }, ctx(hostFetch("evil-provider"), state));
  assert.equal(miss.meta.cache.servedBy.provider, "overpass-selfhosted");
});
