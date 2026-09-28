// Neighborhood View N1–N7: GET /api/neighborhood/nearby with a mocked DB and mocked Google fetch.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const neighborhoodRouter = require("../src/routes/neighborhood");
const { CATEGORIES, typesFor, categoryForTypes, isCategory } = require("../src/lib/neighborhood/categories");
const { parseNearbyQuery, isUsableCoordinate } = require("../src/lib/neighborhood/validation");
const { haversineMeters, roundDistanceMeters, distanceLabel, snapToApproxGrid } = require("../src/lib/neighborhood/distance");
const { normalizePlaces } = require("../src/lib/neighborhood/normalize");
const { searchNearby, FIELD_MASK, ENDPOINT } = require("../src/lib/neighborhood/googlePlaces");

// Exact pin (never public) and its 0.005° snap.
const EXACT = { latitude: 5.49712, longitude: 7.03388 };
const SNAPPED = { lat: 5.495, lng: 7.035 };

function place(i, overrides = {}) {
  return {
    id: `place-${i}`,
    displayName: { text: `Place ${i}`, languageCode: "en" },
    formattedAddress: `${i} Wetheral Rd, Owerri`,
    location: { latitude: SNAPPED.lat + i * 0.0005, longitude: SNAPPED.lng },
    primaryType: "pharmacy",
    types: ["pharmacy", "health", "point_of_interest", "establishment"],
    rating: 4.2,
    userRatingCount: 17,
    currentOpeningHours: { openNow: true, periods: [{ secret: "raw" }] },
    googleMapsUri: "https://maps.google.com/?cid=raw",
    photos: [{ name: "raw-photo" }],
    ...overrides,
  };
}

function mockPrisma(listing, seen = {}) {
  return {
    listing: {
      findUnique: async (args) => {
        seen.calls = (seen.calls || 0) + 1;
        seen.args = args;
        return typeof listing === "function" ? listing(args) : listing;
      },
    },
  };
}

function mockFetch(handler) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return handler(url, init);
  };
  fn.calls = calls;
  return fn;
}

const okJson = (json) => ({ ok: true, status: 200, json: async () => json });

async function call(router, path) {
  const app = express();
  app.use("/api/neighborhood", router);
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`);
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text) };
  } finally {
    server.close();
  }
}

const LISTING = { id: 1, status: "VERIFIED", property: { ...EXACT } };
const make = (opts = {}) => {
  const seen = {};
  const fetchMock = opts.fetch || mockFetch(async () => okJson({ places: [place(1), place(2)] }));
  const router = neighborhoodRouter(mockPrisma(opts.listing === undefined ? LISTING : opts.listing, seen), {
    apiKey: "apiKey" in opts ? opts.apiKey : "test-key",
    fetch: fetchMock,
    timeoutMs: opts.timeoutMs,
    rateLimitMax: 1000,
  });
  return { router, seen, fetchMock };
};

// ── Unit: categories, validation, distance, normalization ────────────────────

test("categories: nine whitelisted categories map to Google types", () => {
  assert.deepEqual(CATEGORIES, ["groceries", "healthcare", "pharmacy", "education", "banking", "restaurants", "shopping", "fuel", "fitness"]);
  assert.deepEqual(typesFor("fuel"), ["gas_station"]);
  assert.equal(new Set(typesFor(null)).size, typesFor(null).length);
  assert.ok(typesFor(null).length <= 50, "Nearby Search accepts at most 50 types");
  assert.equal(categoryForTypes("atm", []), "banking");
  assert.equal(categoryForTypes("lodging", ["supermarket"]), "groceries");
  assert.equal(categoryForTypes("church", ["place_of_worship"]), null);
  assert.equal(isCategory("toString"), false);
  assert.equal(isCategory("police"), false);
});

test("haversine: known distances", () => {
  assert.equal(haversineMeters(5.495, 7.035, 5.495, 7.035), 0);
  const oneDegLat = haversineMeters(0, 0, 1, 0);
  assert.ok(Math.abs(oneDegLat - 111195) < 5, `1° lat ≈ 111.2 km, got ${oneDegLat}`);
  const d = haversineMeters(5.495, 7.035, 5.505, 7.035);
  assert.ok(Math.abs(d - 1112) < 2, `0.01° lat ≈ 1112 m, got ${d}`);
});

test("distance rounding: under 200 m, 100 m steps under 1 km, 0.5 km steps above", () => {
  const cases = [
    [0, 200, "under 200 m"], [150, 200, "under 200 m"], [199.9, 200, "under 200 m"], [200, 200, "200 m"],
    [249, 200, "200 m"], [251, 300, "300 m"], [949, 900, "900 m"], [951, 1000, "1 km"], [999, 1000, "1 km"],
    [1000, 1000, "1 km"], [1249, 1000, "1 km"], [1251, 1500, "1.5 km"], [1749, 1500, "1.5 km"], [1751, 2000, "2 km"], [2987, 3000, "3 km"],
  ];
  for (const [input, meters, label] of cases) {
    assert.equal(roundDistanceMeters(input), meters, `${input} meters`);
    assert.equal(distanceLabel(input), label, `${input} label`);
  }
  for (const bad of [NaN, -1, Infinity]) {
    assert.equal(roundDistanceMeters(bad), null);
    assert.equal(distanceLabel(bad), null);
  }
});

test("snapping reuses the PR #18 0.005° grid", () => {
  const { approxLocation } = require("../src/routes/listings");
  assert.deepEqual(snapToApproxGrid(EXACT.latitude, EXACT.longitude), { ...SNAPPED, radius_m: 500 });
  assert.deepEqual(snapToApproxGrid(5.4876, 7.0124), approxLocation(5.4876, 7.0124));
  assert.equal(snapToApproxGrid(NaN, 7), null);
});

test("coordinate validation", () => {
  assert.equal(isUsableCoordinate(5.49, 7.03), true);
  for (const [lat, lng] of [[NaN, 7], [5, Infinity], [-Infinity, 7], [91, 7], [5, 181], [-90.1, 0], [null, 7], [5, undefined], [undefined, undefined], ["5.4", "7.0"], [0, 0]]) {
    assert.equal(isUsableCoordinate(lat, lng), false, `${lat},${lng}`);
  }
});

test("query validation", () => {
  assert.deepEqual(parseNearbyQuery({ listingId: "7" }), { ok: true, listingId: 7, radiusM: 1500, category: null });
  for (const radius of [500, 1000, 1500, 3000]) {
    assert.deepEqual(parseNearbyQuery({ listingId: "7", radiusM: String(radius), category: "banking" }), { ok: true, listingId: 7, radiusM: radius, category: "banking" });
  }
  for (const q of [
    {}, { listingId: "abc" }, { listingId: "0" }, { listingId: "-1" }, { listingId: "1.5" }, { listingId: ["1", "2"] },
    { listingId: "1", radiusM: "250" }, { listingId: "1", radiusM: "750" }, { listingId: "1", radiusM: "2000" }, { listingId: "1", radiusM: "3001" },
    { listingId: "1", radiusM: "1e3" }, { listingId: "1", radiusM: "01500" }, { listingId: "1", radiusM: "1500.0" }, { listingId: "1", radiusM: "" }, { listingId: "1", radiusM: ["1500", "500"] },
    { listingId: "1", category: "police" }, { listingId: "1", lat: "5.4" }, { listingId: "1", lng: "7.0" }, { listingId: "1", latitude: "5.4", longitude: "7" },
  ]) {
    const r = parseNearbyQuery(q);
    assert.equal(r.ok, false, JSON.stringify(q));
    assert.equal(r.status, 400);
  }
});

test("normalization: DTO only, measured from the given origin, sorted and capped at 20", () => {
  const raw = [place(3), place(1), place(1), place(2, { displayName: { text: "" } }), place(4, { location: { latitude: NaN, longitude: 7 } }), place(5, { primaryType: "church", types: ["church"] })];
  for (let i = 10; i < 40; i++) raw.push(place(i));
  const out = normalizePlaces(raw, SNAPPED);
  assert.equal(out.length, 20);
  assert.deepEqual(out.slice(0, 2).map((p) => p.id), ["place-1", "place-3"], "sorted by distance, deduped, invalid dropped");
  assert.deepEqual(out[0], {
    id: "place-1", name: "Place 1", category: "pharmacy", distanceMeters: 200, distanceLabel: "under 200 m",
    lat: SNAPPED.lat + 0.0005, lng: SNAPPED.lng, address: "1 Wetheral Rd, Owerri",
  });
  assert.equal(out.find((p) => p.id === "place-10").distanceLabel, "600 m");
  const json = JSON.stringify(out);
  for (const leaked of ["displayName", "googleMapsUri", "photos", "periods", "types", "primaryType", "currentOpeningHours", "rating", "reviewCount", "userRatingCount", "openNow"]) {
    assert.equal(json.includes(leaked), false, `${leaked} must not pass through`);
  }
  const bare = normalizePlaces([{ id: "x", displayName: { text: "X" }, location: { latitude: 5.5, longitude: 7.035 }, types: ["atm"] }], SNAPPED);
  assert.deepEqual(Object.keys(bare[0]).sort(), ["category", "distanceLabel", "distanceMeters", "id", "lat", "lng", "name"]);
  assert.equal(normalizePlaces([place(1)], SNAPPED, "healthcare")[0].category, "healthcare");
});

test("Google adapter: POSTs to searchNearby with key header, field mask and the given point", async () => {
  const fetchMock = mockFetch(async () => okJson({ places: [place(1)] }));
  const places = await searchNearby({ apiKey: "k", lat: 5.495, lng: 7.035, radiusM: 900, includedTypes: ["bank"], fetchImpl: fetchMock });
  assert.equal(places.length, 1);
  const [c] = fetchMock.calls;
  assert.equal(c.url, "https://places.googleapis.com/v1/places:searchNearby");
  assert.equal(c.url, ENDPOINT);
  assert.equal(c.init.method, "POST");
  assert.equal(c.init.headers["X-Goog-Api-Key"], "k");
  assert.equal(c.init.headers["X-Goog-FieldMask"], FIELD_MASK);
  // Nearby Search Pro fields only; any of these would bill as Nearby Search Enterprise.
  assert.equal(FIELD_MASK, "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types");
  for (const enterprise of ["rating", "userRatingCount", "OpeningHours", "priceLevel", "websiteUri", "PhoneNumber"]) {
    assert.equal(FIELD_MASK.includes(enterprise), false, `${enterprise} is an Enterprise field`);
  }
  assert.deepEqual(c.body, {
    includedTypes: ["bank"], maxResultCount: 20, rankPreference: "DISTANCE",
    locationRestriction: { circle: { center: { latitude: 5.495, longitude: 7.035 }, radius: 900 } },
  });
  await assert.rejects(searchNearby({ apiKey: "", lat: 1, lng: 1, radiusM: 500, includedTypes: [], fetchImpl: fetchMock }), { kind: "no_key" });
  assert.equal(fetchMock.calls.length, 1);
});

// ── Route ────────────────────────────────────────────────────────────────────

test("route: searches and measures from the snapped point, never returns exact coordinates", async () => {
  const { router, seen, fetchMock } = make();
  const res = await call(router, "/api/neighborhood/nearby?listingId=1&radiusM=1000&category=pharmacy");
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.deepEqual(res.body.data.approxLocation, { ...SNAPPED, radius_m: 500 });
  assert.equal(res.body.data.radiusM, 1000);
  assert.deepEqual(res.body.data.attribution, { provider: "Google Maps", required: true });
  assert.equal(res.body.data.category, "pharmacy");
  assert.equal(seen.args.where.id, 1);
  assert.deepEqual(fetchMock.calls[0].body.locationRestriction.circle, { center: { latitude: SNAPPED.lat, longitude: SNAPPED.lng }, radius: 1000 });
  assert.deepEqual(fetchMock.calls[0].body.includedTypes, typesFor("pharmacy"));
  assert.deepEqual(res.body.data.places.map((p) => [p.distanceMeters, p.distanceLabel]), [[200, "under 200 m"], [200, "under 200 m"]]);
  for (const dropped of ["rating", "reviewCount", "openNow"]) assert.equal(res.text.includes(dropped), false);
  for (const exact of ["5.49712", "7.03388", "latitude", "longitude"]) assert.equal(res.text.includes(exact), false, `${exact} leaked`);
});

test("route: lat/lng params are rejected before any DB or Google call", async () => {
  for (const qs of ["listingId=1&lat=5.4&lng=7.0", "listingId=1&lat=5.4", "lat=5.4&lng=7.0", "listingId=1&latitude=5&longitude=7"]) {
    const { router, seen, fetchMock } = make();
    const res = await call(router, `/api/neighborhood/nearby?${qs}`);
    assert.equal(res.status, 400, qs);
    assert.equal(res.body.success, false);
    assert.equal(seen.calls, undefined);
    assert.equal(fetchMock.calls.length, 0);
  }
});

test("route: non-preset radius, bad listingId and unknown category are 400", async () => {
  for (const qs of ["listingId=1&radiusM=100", "listingId=1&radiusM=250", "listingId=1&radiusM=1200", "listingId=1&radiusM=3001", "listingId=1&radiusM=50000", "listingId=abc", "", "listingId=1&category=nightlife"]) {
    const { router, fetchMock } = make();
    const res = await call(router, `/api/neighborhood/nearby?${qs}`);
    assert.equal(res.status, 400, qs);
    assert.equal(fetchMock.calls.length, 0);
  }
  for (const radius of [500, 1000, 1500, 3000]) {
    const { router, fetchMock } = make();
    assert.equal((await call(router, `/api/neighborhood/nearby?listingId=1&radiusM=${radius}`)).status, 200);
    assert.equal(fetchMock.calls[0].body.locationRestriction.circle.radius, radius);
  }
  const def = make();
  await call(def.router, "/api/neighborhood/nearby?listingId=1");
  assert.equal(def.fetchMock.calls[0].body.locationRestriction.circle.radius, 1500);
});

test("route: at most 20 places", async () => {
  const many = Array.from({ length: 30 }, (_, i) => place(i + 1));
  const { router, fetchMock } = make({ fetch: mockFetch(async () => okJson({ places: many })) });
  const res = await call(router, "/api/neighborhood/nearby?listingId=1");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.places.length, 20);
  assert.equal(fetchMock.calls[0].body.maxResultCount, 20);
});

test("route: unknown listing is 404", async () => {
  const { router, fetchMock } = make({ listing: null });
  const res = await call(router, "/api/neighborhood/nearby?listingId=999");
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(fetchMock.calls.length, 0);
});

test("route: listings that are not VERIFIED (published) are 404", async () => {
  for (const status of ["PENDING", "REJECTED", "ARCHIVED", undefined]) {
    const { router, fetchMock } = make({ listing: { ...LISTING, status } });
    const res = await call(router, "/api/neighborhood/nearby?listingId=1");
    assert.equal(res.status, 404, String(status));
    assert.equal(res.body.code, "LISTING_NOT_FOUND");
    assert.equal(fetchMock.calls.length, 0);
  }
  const { router, seen } = make();
  assert.equal((await call(router, "/api/neighborhood/nearby?listingId=1")).status, 200);
  assert.equal(seen.args.select.status, true);
});

test("route: no usable property coordinates is PROPERTY_LOCATION_UNAVAILABLE", async () => {
  for (const listing of [
    { id: 1, status: "VERIFIED", property: null },
    { id: 1, status: "VERIFIED", property: { latitude: null, longitude: null } },
    { id: 1, status: "VERIFIED", property: { latitude: 5.49, longitude: null } },
    { id: 1, status: "VERIFIED", property: { latitude: NaN, longitude: 7.03 } },
    { id: 1, status: "VERIFIED", property: { latitude: 95, longitude: 7.03 } },
  ]) {
    const { router, fetchMock } = make({ listing });
    const res = await call(router, "/api/neighborhood/nearby?listingId=1");
    assert.equal(res.status, 422, JSON.stringify(listing));
    assert.deepEqual({ success: res.body.success, code: res.body.code }, { success: false, code: "PROPERTY_LOCATION_UNAVAILABLE" });
    assert.equal(fetchMock.calls.length, 0);
  }
});

test("route: no API key is a controlled 503 NEIGHBORHOOD_UNAVAILABLE", async () => {
  const { router, fetchMock } = make({ apiKey: undefined });
  const res = await call(router, "/api/neighborhood/nearby?listingId=1");
  assert.equal(res.status, 503);
  assert.deepEqual({ success: res.body.success, code: res.body.code }, { success: false, code: "NEIGHBORHOOD_UNAVAILABLE" });
  assert.equal(fetchMock.calls.length, 0);
});

test("route: Google error, network failure, bad JSON and timeout are controlled", async () => {
  const cases = [
    [async () => ({ ok: false, status: 403, json: async () => ({ error: { message: "API key not valid. key=secret" } }) }), 502],
    [async () => { throw new TypeError("fetch failed"); }, 502],
    [async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad"); } }), 502],
    [(_url, init) => new Promise((_r, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason))), 504],
  ];
  for (const [handler, status] of cases) {
    const { router } = make({ fetch: mockFetch(handler), timeoutMs: 20 });
    const res = await call(router, "/api/neighborhood/nearby?listingId=1");
    assert.equal(res.status, status);
    assert.deepEqual({ success: res.body.success, code: res.body.code }, { success: false, code: "NEIGHBORHOOD_UNAVAILABLE" });
    assert.equal(res.text.includes("secret"), false, "Google error text must not pass through");
  }
});

test("route: Google content is never cached (Maps ToS) and responses are no-store", async () => {
  const { router, seen, fetchMock } = make();
  const app = express();
  app.use("/api/neighborhood", router);
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/neighborhood/nearby?listingId=1&category=pharmacy`;
    const first = await fetch(url);
    const second = await fetch(url);
    assert.equal(first.status, 200);
    assert.equal(first.headers.get("cache-control"), "no-store");
    assert.equal(second.headers.get("cache-control"), "no-store");
    assert.equal(fetchMock.calls.length, 2, "each request goes to Google; nothing is served from a cache");
    assert.equal(seen.calls, 2);
  } finally {
    server.close();
  }
});
