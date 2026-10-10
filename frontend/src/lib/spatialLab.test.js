const { test } = require("node:test");
const assert = require("node:assert/strict");
const { isPublicListing } = require("./listingHonesty");
const {
  parseCoordinate,
  buildPublicSpatialContext,
  spatialPublicationDecision,
  straightLineLabel,
  straightLineMeters,
  externalDirectionsUrl,
  urlLeaksCoordinates,
  loadRoute,
  loadAmenities,
  filterAmenities,
  describeRoute,
  buildPreviewModel,
  mapGeometry,
  campusById,
  FIXTURE_AMENITIES,
  CAMPUSES,
  tileLayer,
} = require("./spatialLab");

const PRIVATE = { lat: 5.497123, lng: 7.033812 };

function publicHome(extra = {}) {
  return {
    id: 42,
    title: "Flat near Nekede",
    status: "PENDING",
    riskState: "UNVERIFIED",
    reviewStatus: "APPROVED",
    property: { lga: "Owerri West", city: "Owerri", state: "Imo", latitude: PRIVATE.lat, longitude: PRIVATE.lng },
    approxLocation: { lat: 5.495, lng: 7.035, radius_m: 500 },
    ...extra,
  };
}

test("coordinate validation rejects strings, NaN, and out-of-range values", () => {
  assert.deepEqual(parseCoordinate(5.42, 7.04), { lat: 5.42, lng: 7.04 });
  assert.equal(parseCoordinate("5.42", "7.04"), null);
  assert.equal(parseCoordinate(NaN, 7), null);
  assert.equal(parseCoordinate(91, 7), null);
  assert.equal(parseCoordinate(5, 181), null);
  assert.equal(parseCoordinate(Infinity, 7), null);
  assert.equal(parseCoordinate(null, 7), null);
});

test("publication gate hides samples, fixtures, and blocked homes; review is not verification", () => {
  const reviewed = publicHome({ reviewStatus: "APPROVED", status: "VERIFIED", riskState: "VERIFIED" });
  assert.equal(spatialPublicationDecision(reviewed).published, true);
  const context = buildPublicSpatialContext(reviewed);
  assert.equal(context.evidenceVerified, false);
  assert.equal(context.reviewForDisplay, true);
  assert.equal(context.focus.precision, "approximate");

  const sample = publicHome({ totalMoveInCost: { sample: true, total: 1 }, reviewStatus: "APPROVED" });
  assert.equal(isPublicListing(sample), false);
  assert.equal(buildPublicSpatialContext(sample), null);

  const flagged = publicHome({ riskState: "FLAGGED" });
  const suspended = publicHome({ riskState: "SUSPENDED" });
  const rejected = publicHome({ status: "REJECTED" });
  const fraud = publicHome({ isFlaggedForFraud: true });
  const fixture = { ...publicHome(), fixture: true, inventory: "excluded" };
  assert.equal(buildPublicSpatialContext(flagged), null);
  assert.equal(buildPublicSpatialContext(suspended), null);
  assert.equal(buildPublicSpatialContext(rejected), null);
  assert.equal(buildPublicSpatialContext(fraud), null);
  assert.equal(spatialPublicationDecision(fixture).reason, "fixture");
  assert.equal(buildPublicSpatialContext(fixture), null);
});

test("public context keeps an approximate area and never an exact pin or private fields", () => {
  const context = buildPublicSpatialContext(publicHome());
  assert.equal(context.focus.precision, "approximate");
  assert.equal(context.allowExactOrigin, false);
  assert.deepEqual(mapGeometry(context.focus), { kind: "area", lat: 5.495, lng: 7.035, radiusM: 500 });
  const json = JSON.stringify(context);
  assert.equal(json.includes("latitude"), false);
  assert.equal(json.includes("longitude"), false);
  assert.equal(json.includes("5.497123"), false);
  assert.equal(json.includes("7.033812"), false);
  assert.equal(json.includes("address"), false);

  const missing = buildPublicSpatialContext(publicHome({ approxLocation: null, property: { city: "Owerri", state: "Imo", latitude: PRIVATE.lat, longitude: PRIVATE.lng } }));
  assert.equal(missing.focus.precision, "unknown");
  assert.equal(mapGeometry(missing.focus).kind, "none");
  assert.equal(JSON.stringify(missing).includes("5.497123"), false);

  const bad = buildPublicSpatialContext(publicHome({ approxLocation: { lat: "5.495", lng: "7.035", radius_m: 500 } }));
  assert.equal(bad.focus.precision, "unknown");
});

test("approximate directions omit private and snapped coordinates", () => {
  const campus = campusById("fpno");
  const context = buildPublicSpatialContext(publicHome());
  const url = externalDirectionsUrl({
    precision: context.focus.precision,
    originLabel: context.focus.label,
    originExact: PRIVATE,
    originApproximate: { lat: context.focus.lat, lng: context.focus.lng },
    allowExactOrigin: context.allowExactOrigin,
    fixturePin: false,
    destination: campus,
  });
  assert.match(url, /origin=/);
  assert.match(decodeURIComponent(url), /Owerri West/);
  assert.equal(urlLeaksCoordinates(url, [PRIVATE, { lat: 5.495, lng: 7.035 }, { lat: campus.lat, lng: campus.lng }]), false);
  assert.match(decodeURIComponent(url), new RegExp(campus.name));

  const exactUrl = externalDirectionsUrl({
    precision: "exact",
    originLabel: "ignored",
    originExact: PRIVATE,
    allowExactOrigin: true,
    fixturePin: false,
    destination: campus,
  });
  assert.equal(urlLeaksCoordinates(exactUrl, [PRIVATE]), false);

  const fixturePinUrl = externalDirectionsUrl({
    precision: "exact",
    originLabel: "DEV fixture pin",
    originExact: { lat: 5.4221, lng: 7.0426 },
    allowExactOrigin: true,
    fixturePin: true,
    destination: campus,
  });
  assert.match(decodeURIComponent(fixturePinUrl), new RegExp(campus.name));
  assert.equal(urlLeaksCoordinates(fixturePinUrl, [{ lat: campus.lat, lng: campus.lng }]), false);
  assert.match(fixturePinUrl, /5\.4221,7\.0426/);
});

test("straight-line distance is labelled straight-line and has no travel time", () => {
  const campus = CAMPUSES[0];
  const meters = straightLineMeters({ lat: 5.4214, lng: 7.0419 }, campus);
  const label = straightLineLabel(meters);
  assert.match(label, /straight-line to campus center/);
  assert.equal(/entrance|min|hour|km\/h|speed/i.test(label), false);
  assert.equal(straightLineLabel(null), null);
  assert.equal(straightLineMeters({ lat: "5.4", lng: 7 }, campus), null);
});

test("routing and amenity failures stay empty", async () => {
  const focus = { precision: "approximate", label: "Near Nekede", lat: 5.4214, lng: 7.0419, radiusM: 800 };
  const campus = campusById("fpno");
  const failed = await loadRoute({
    focus,
    campus,
    config: { osrmBaseUrl: "https://routing.example", overpassUrl: null, tileUrl: null },
    fetchImpl: async () => {
      throw new Error("down");
    },
  });
  const described = describeRoute(failed);
  assert.equal(failed.status, "failed");
  assert.equal(failed.durationS, null);
  assert.equal(described.primary, "Routing unavailable");
  assert.equal(/min/.test(described.primary), false);

  const missing = describeRoute(await loadRoute({
    focus,
    campus,
    config: { osrmBaseUrl: null, overpassUrl: null, tileUrl: null },
    fetchImpl: async () => {
      throw new Error("should not be called");
    },
  }));
  assert.equal(missing.primary, "Routing unavailable");

  const amenities = await loadAmenities({
    focus,
    config: { osrmBaseUrl: null, overpassUrl: "https://overpass.example", tileUrl: null },
    fetchImpl: async () => ({ ok: false, json: async () => ({}) }),
    allowFixtures: false,
  });
  assert.equal(amenities.status, "failed");
  assert.deepEqual(amenities.items, []);
  assert.equal(JSON.stringify(amenities).includes("DEV fixture"), false);

  const unconfigured = await loadAmenities({
    focus,
    config: { osrmBaseUrl: null, overpassUrl: null, tileUrl: null },
    fetchImpl: async () => {
      throw new Error("should not be called");
    },
  });
  assert.equal(unconfigured.status, "unconfigured");
  assert.deepEqual(unconfigured.items, []);
});

test("fixtures stay out of public spatial results", () => {
  const preview = buildPreviewModel("approximate", "fpno");
  assert.equal(preview.fixture, true);
  assert.equal(preview.inventory, "excluded");
  assert.equal(preview.listingId, null);
  assert.equal(preview.enquiry, false);
  assert.match(preview.title, /DEV fixture/);
  assert.equal(isPublicListing(preview), false);
  assert.equal(buildPublicSpatialContext(preview), null);
  assert.equal(filterAmenities(FIXTURE_AMENITIES, "all", false).length, 0);
  assert.equal(filterAmenities(preview.amenities.items, "pharmacy", true).every((item) => item.fixture === true), true);
  assert.equal(buildPreviewModel("unavailable", "fpno"), null);
  assert.equal(mapGeometry(buildPreviewModel("exact").focus).kind, "pin");
  assert.equal(mapGeometry(buildPreviewModel("unknown").focus).kind, "none");
  const merged = [preview, publicHome()].map((record) => buildPublicSpatialContext(record)).filter(Boolean);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].listingId, 42);
});

test("a configured tile template is a mercator grid of the public focus", () => {
  const template = "http://127.0.0.1:9/tiles/{z}/{x}/{y}.png";
  const focus = { precision: "approximate", label: "Near Nekede, Owerri West", lat: 5.495, lng: 7.035, radiusM: 500 };
  const layer = tileLayer({ focus, template, attribution: "© Example tiles", width: 640, height: 280 });
  assert.ok(layer);
  assert.equal(layer.attribution, "© Example tiles");
  assert.ok(layer.tiles.length >= 4);
  const center = { x: layer.width / 2, y: layer.height / 2 };
  const hit = layer.tiles.some((tile) => (
    center.x >= tile.left && center.x < tile.left + 256 &&
    center.y >= tile.top && center.y < tile.top + 256
  ));
  assert.equal(hit, true);
  const dumped = JSON.stringify(layer);
  assert.equal(dumped.includes("5.497123"), false);
  assert.equal(dumped.includes("7.033812"), false);
  assert.equal(dumped.includes("5.495"), false);
  layer.tiles.forEach((tile) => {
    assert.match(tile.url, /^http:\/\/127\.0\.0\.1:9\/tiles\/\d+\/\d+\/\d+\.png$/);
  });
  const xs = new Set(layer.tiles.map((tile) => tile.x));
  const ys = new Set(layer.tiles.map((tile) => tile.y));
  assert.ok(xs.size >= 2);
  assert.ok(ys.size >= 2);

  assert.equal(tileLayer({
    focus: { precision: "unknown", label: "Location not published" },
    template,
    attribution: "© Example tiles",
    width: 640,
    height: 280,
  }), null);
  assert.equal(tileLayer({ focus, template, attribution: "  ", width: 640, height: 280 }), null);
  assert.equal(tileLayer({
    focus,
    template: "http://tiles.example/{z}/{x}/{y}.png",
    attribution: "© Example tiles",
    width: 640,
    height: 280,
  }), null);
});

test("a road result names the campus area center and not an entrance", () => {
  const copy = describeRoute({ status: "ok", distanceM: 2100, durationS: 360, origin: "approximate" });
  assert.match(copy.primary, /2\.1 km by road, 6 min/);
  assert.match(copy.primary, /campus area center, not an entrance/);
  assert.match(copy.detail, /not a route to a campus entrance/);
  assert.equal(/to the campus entrance/i.test(copy.primary), false);
});
