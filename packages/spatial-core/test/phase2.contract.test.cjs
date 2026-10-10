const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  ENVELOPE_KEYS,
  callTool,
  createSafeguardState,
  crossReference,
  evidenceEnvelope,
  loadAmenities,
  parseCoordinate,
  providerCanRun,
  providerFallback,
} = require("../src/index.cjs");
const { fetchAllowlisted } = require("../src/proxy.cjs");

const publicLookup = async () => [{ address: "1.1.1.1", family: 4 }];
const SHA = "591f299d11f38a612629a274463196d57ae3862e";

function home() {
  return {
    id: 42,
    title: "Flat near Nekede",
    public: true,
    property: { lga: "Owerri West", city: "Owerri", state: "Imo", latitude: 5.497123, longitude: 7.033812, address: "12 Hidden Road" },
    approxLocation: { lat: 5.495, lng: 7.035, radius_m: 500 },
  };
}

function cleared(extra = {}) {
  return Object.assign({
    listings: [home()],
    isPublicListing: (listing) => Boolean(listing && listing.public === true),
    env: { OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter" },
    registry: [{ id: "overpass", status: "cleared", commercialUse: "APPROVED_WITH_ATTRIBUTION" }],
    lookup: publicLookup,
    safeguardState: createSafeguardState(),
  }, extra);
}

test("successful provider call", async () => {
  const result = await callTool("spatial.nearby", { listingId: 42 }, cleared({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ elements: [{ type: "node", id: 3, lat: 5.496, lon: 7.036, tags: { amenity: "pharmacy", name: "Test Chemist" } }] }),
    }),
  }));
  assert.equal(result.ok, true);
  assert.equal(result.data.items[0].name, "Test Chemist");
});

test("provider unavailable", async () => {
  const result = await callTool("spatial.nearby", { listingId: 42 }, cleared({
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ error: "secret upstream" }) }),
  }));
  assert.equal(result.ok, false);
  assert.equal(result.code, "provider_unavailable");
  assert.equal(JSON.stringify(result).includes("secret upstream"), false);
});

test("provider timeout", async () => {
  const result = await callTool("spatial.nearby", { listingId: 42 }, cleared({
    timeoutMs: 30,
    fetchImpl: () => new Promise(() => {}),
  }));
  assert.equal(result.code, "timeout");
});

test("invalid coordinates", () => {
  assert.equal(parseCoordinate("5.5", 7), null);
  assert.equal(parseCoordinate(95, 7), null);
  assert.throws(() => crossReference({ location: { lat: 5.495, lng: 7.035 } }), /raw coordinates/);
});

test("conflicting providers", () => {
  const report = crossReference({
    location: { listingId: 42 },
    subjects: ["listing:42"],
    now: 1_000,
    providers: [
      { id: "overpass", observations: [{ subjectId: "listing:42", fact: "amenityCount", value: 2, observedAt: 900 }] },
      { id: "second", observations: [{ subjectId: "listing:42", fact: "amenityCount", value: 4, observedAt: 900 }] },
    ],
  });
  assert.equal(report.conflicts.length, 1);
  assert.deepEqual(report.conflicts[0].values.map((item) => item.provider), ["overpass", "second"]);
});

test("stale source", () => {
  const envelope = evidenceEnvelope({
    value: 1,
    provider: "overpass",
    observedAt: 1_000,
    retrievedAt: 50_000,
    coverage: "500m",
  }, { now: 50_000, staleAfterMs: 10_000 });
  assert.equal(envelope.freshness, "stale");
  assert.equal(envelope.coverage, "500m");
});

test("missing API key", () => {
  const decision = providerCanRun("places-commercial", {
    production: true,
    env: {},
    registry: [{
      id: "places-commercial",
      status: "cleared",
      category: "places",
      commercialUse: "APPROVED_COMMERCIAL",
      authentication: { required: true, env: "PLACES_API_KEY" },
    }],
  });
  assert.equal(decision.code, "missing_api_key");
  assert.equal(decision.ok, false);
});

test("protected listing", async () => {
  const result = await callTool("spatial.inspect", { listingId: 7 }, {
    listings: [{ id: 7, title: "Hidden", public: false }],
    isPublicListing: (listing) => Boolean(listing && listing.public === true),
  });
  assert.equal(result.code, "forbidden");
});

test("approximate listing location", async () => {
  const result = await callTool("lodgist.inspect_property", { listingId: 42 }, {
    listings: [home()],
    isPublicListing: (listing) => Boolean(listing && listing.public === true),
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.approxLocation.lat, 5.495);
  assert.equal(JSON.stringify(result).includes("12 Hidden Road"), false);
  assert.equal(JSON.stringify(result).includes("latitude"), false);
});

test("malformed MCP input", async () => {
  const result = await callTool("spatial.inspect", { listingId: "42" }, { listings: [home()] });
  assert.equal(result.code, "malformed");
});

test("forbidden MCP action", async () => {
  const result = await callTool("spatial.inspect", { listingId: 42, action: "delete" }, {
    listings: [home()],
    isPublicListing: () => true,
  });
  assert.equal(result.code, "forbidden");
});

test("provider fallback", () => {
  const chain = providerFallback("places", {
    production: true,
    registry: [
      { id: "places-a", status: "cleared", category: "places", commercialUse: "APPROVED_COMMERCIAL", health: "down", fallbackPriority: 1 },
      { id: "places-b", status: "cleared", category: "places", commercialUse: "APPROVED_WITH_ATTRIBUTION", health: "ok", fallbackPriority: 2 },
    ],
  });
  assert.deepEqual(chain.map((row) => row.id), ["places-b"]);
});

test("provenance retention", async () => {
  const result = await callTool("spatial.nearby", { listingId: 42 }, cleared({
    now: 9_000,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ elements: [] }),
    }),
  }));
  assert.equal(result.ok, true);
  ENVELOPE_KEYS.forEach((key) => assert.equal(Object.prototype.hasOwnProperty.call(result.provenance, key), true, key));
  assert.equal(result.provenance.source, "OpenStreetMap");
  assert.equal(result.provenance.license, "ODbL-1.0");
  assert.equal(result.provenance.retrievedAt, 9_000);
  assert.equal(result.provenance.observedAt, null);
  assert.equal(result.provenance.freshness, "unknown");
});

test("proxy allowlist rejection", async () => {
  let calls = 0;
  const result = await fetchAllowlisted({
    url: "https://evil.example/interpreter",
    allowedHosts: ["overpass.example"],
    lookup: publicLookup,
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => ({}) };
    },
  });
  assert.equal(result.code, "forbidden");
  assert.equal(calls, 0);
  assert.equal(JSON.stringify(result).includes("evil.example"), false);
});

test("unset map env does not fetch and keeps the legacy amenity shape", async () => {
  let calls = 0;
  const result = await loadAmenities({
    focus: { lat: 5.495, lng: 7.035, precision: "approximate", radiusM: 500, label: "Near Nekede" },
    env: {},
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => ({ elements: [] }) };
    },
  });
  assert.equal(calls, 0);
  assert.equal(result.status, "unconfigured");
  assert.deepEqual(Object.keys(result).sort(), ["items", "provenance", "status"]);
});

test("the adoption ledger lists all 94 features at the pinned commit", () => {
  const doc = fs.readFileSync(path.resolve(__dirname, "../../../docs/GEV_ADOPTION.md"), "utf8");
  for (let n = 1; n <= 94; n += 1) {
    const id = `F${String(n).padStart(2, "0")}`;
    assert.equal(doc.includes(`| ${id} `), true, id);
  }
  assert.equal(doc.split(SHA).length - 1, 95);
  assert.equal(doc.includes("6be25595b16491ce01ffd8d81e66921f321ee200"), false);
  assert.equal(doc.includes("| F45 Monitoring surfaces |"), true);
  assert.match(doc, /\| F45 .+\| IMPLEMENTED \|/);
  assert.match(doc, /\| F49 .+\| IMPLEMENTED \|/);
  assert.match(doc, /\| F93 .+\| REJECTED \|/);
  assert.match(doc, /\| F94 .+\| PATTERN_REUSE \|/);
});
