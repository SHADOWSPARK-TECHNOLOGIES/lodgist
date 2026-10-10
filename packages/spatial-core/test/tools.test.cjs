const { test } = require("node:test");
const assert = require("node:assert/strict");
const { callTool, listTools, createSafeguardState } = require("../src/index.cjs");

const isPublic = (listing) => listing && listing.public === true;
const publicLookup = async () => [{ address: "1.1.1.1", family: 4 }];

function home(extra = {}) {
  return {
    id: 42,
    title: "Flat near Nekede",
    category: "residential",
    public: true,
    property: {
      lga: "Owerri West",
      city: "Owerri",
      state: "Imo",
      latitude: 5.497123,
      longitude: 7.033812,
      address: "12 Hidden Road",
    },
    approxLocation: { lat: 5.495, lng: 7.035, radius_m: 500 },
    ...extra,
  };
}

function ctx(extra = {}) {
  return Object.assign({
    listings: [home(), home({ id: 7, title: "Shop near IMSU", category: "commercial", public: false })],
    isPublicListing: isPublic,
  }, extra);
}

test("tool list exposes spatial tools and lodgist wrappers", () => {
  const names = listTools().map((item) => item.name);
  ["spatial.search", "spatial.navigate", "spatial.inspect", "spatial.nearby", "spatial.route", "spatial.measure", "spatial.compare", "spatial.cross_reference", "spatial.visualize", "spatial.context", "lodgist.search_properties", "lodgist.inspect_property", "lodgist.property_context", "lodgist.nearby_amenities", "lodgist.calculate_commute", "lodgist.compare_properties", "lodgist.spatial_report"].forEach((name) => {
    assert.equal(names.includes(name), true, name);
  });
});

test("malformed input and forbidden actions stay distinct", async () => {
  const malformed = await callTool("spatial.inspect", { listingId: "42" }, ctx());
  assert.equal(malformed.code, "malformed");
  const extra = await callTool("spatial.inspect", { listingId: 42, url: "https://evil.example" }, ctx());
  assert.equal(extra.code, "malformed");
  const unknown = await callTool("spatial.delete", {}, ctx());
  assert.equal(unknown.code, "forbidden");
  const write = await callTool("lodgist.inspect_property", { listingId: 42, action: "delete" }, ctx());
  assert.equal(write.code, "forbidden");
  const banned = await callTool("spatial.nearby", { listingId: 42, layer: "cctv" }, ctx());
  assert.equal(banned.code, "forbidden");
});

test("a protected listing is forbidden and a public one stays approximate", async () => {
  const hidden = await callTool("spatial.inspect", { listingId: 7 }, ctx());
  assert.equal(hidden.code, "forbidden");
  const visible = await callTool("lodgist.inspect_property", { listingId: 42 }, ctx());
  assert.equal(visible.ok, true);
  assert.equal(visible.data.locationState, "approximate");
  assert.equal(visible.data.approxLocation.lat, 5.495);
  assert.equal(JSON.stringify(visible).includes("12 Hidden Road"), false);
  assert.equal(JSON.stringify(visible).includes("5.497123"), false);
  assert.equal(visible.provenance.freshness, "unknown");
});

test("measure and commute keep straight-line separate from travel time", async () => {
  const measured = await callTool("spatial.measure", { listingId: 42, campusId: "fpno" }, ctx());
  assert.equal(measured.ok, true);
  assert.match(measured.data.straightLineLabel, /straight-line/);
  assert.equal(measured.data.travelTime, null);
  assert.equal(/min/.test(JSON.stringify(measured.data)), false);
  let calls = 0;
  const commute = await callTool("lodgist.calculate_commute", { listingId: 42, campusId: "fpno" }, ctx({
    fetchImpl: async () => {
      calls += 1;
      throw new Error("should not be called");
    },
  }));
  assert.equal(calls, 0);
  assert.equal(commute.data.travelTime, null);
  assert.equal(commute.data.route.status, "unconfigured");
});

test("nearby does not fetch while provider env is unset", async () => {
  let calls = 0;
  const result = await callTool("lodgist.nearby_amenities", { listingId: 42 }, ctx({
    env: {},
    fetchImpl: async () => {
      calls += 1;
      return { ok: true, status: 200, json: async () => ({ elements: [] }) };
    },
  }));
  assert.equal(calls, 0);
  assert.equal(result.data.status, "unconfigured");
});

test("a cleared provider call returns amenities and logs without coordinates", async () => {
  const logs = [];
  const result = await callTool("spatial.nearby", { listingId: 42 }, ctx({
    env: { OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter" },
    registry: [{ id: "overpass", status: "cleared" }],
    lookup: publicLookup,
    safeguardState: createSafeguardState(),
    log: (event) => logs.push(event),
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        elements: [{ type: "node", id: 9, lat: 5.496, lon: 7.036, tags: { amenity: "pharmacy", name: "Test Chemist" } }],
      }),
    }),
  }));
  assert.equal(result.ok, true);
  assert.equal(result.data.items[0].name, "Test Chemist");
  assert.equal(result.provenance.source, "OpenStreetMap");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].tool, "spatial.nearby");
  assert.equal(JSON.stringify(logs).includes("5.495"), false);
});

test("provider failure and timeout are reported without upstream text", async () => {
  const failed = await callTool("spatial.nearby", { listingId: 42 }, ctx({
    env: { OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter" },
    registry: [{ id: "overpass", status: "cleared" }],
    lookup: publicLookup,
    safeguardState: createSafeguardState(),
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ error: "secret upstream" }) }),
  }));
  assert.equal(failed.code, "provider_unavailable");
  assert.equal(JSON.stringify(failed).includes("secret upstream"), false);
  const timed = await callTool("spatial.search", { query: "nekede" }, ctx({
    timeoutMs: 20,
    listings: [home()],
  }));
  assert.equal(timed.ok, true);
  const hung = await callTool("spatial.nearby", { listingId: 42 }, {
    ...ctx(),
    timeoutMs: 30,
    env: { OVERPASS_INTERPRETER_URL: "https://overpass.example/interpreter" },
    registry: [{ id: "overpass", status: "cleared" }],
    lookup: publicLookup,
    safeguardState: createSafeguardState(),
    fetchImpl: () => new Promise(() => {}),
  });
  assert.equal(hung.code, "timeout");
  assert.equal(hung.message, "timed out");
});
