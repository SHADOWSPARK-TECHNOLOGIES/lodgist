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
  adaptSpatialListing,
  anonymousListingRequest,
  exactPinPermitted,
  publicTileTemplate,
  publicSubject,
  nextDialogFocus,
  FIXTURE_AMENITIES,
  CAMPUSES,
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

  const unreviewed = publicHome({ reviewStatus: "NOT_REVIEWED", status: "PENDING" });
  assert.equal(spatialPublicationDecision(unreviewed).published, false);
  assert.equal(buildPublicSpatialContext(unreviewed), null);

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
  assert.equal(missing.focus.precision, "area-only");
  assert.equal(missing.focus.label, "Owerri, Imo");
  assert.equal("lat" in missing.focus, false);
  assert.equal(mapGeometry(missing.focus).kind, "none");
  assert.equal(JSON.stringify(missing).includes("5.497123"), false);

  const bad = buildPublicSpatialContext(publicHome({ approxLocation: { lat: "5.495", lng: "7.035", radius_m: 500 } }));
  assert.equal(bad.focus.precision, "area-only");
  assert.equal("lat" in bad.focus, false);
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
});

test("straight-line distance is labelled straight-line and has no travel time", () => {
  const campus = CAMPUSES[0];
  const meters = straightLineMeters({ lat: 5.4214, lng: 7.0419 }, campus);
  const label = straightLineLabel(meters);
  assert.match(label, /straight-line/);
  assert.equal(/min|hour|km\/h|speed/i.test(label), false);
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

  const ok = await loadRoute({
    focus,
    campus,
    config: { osrmBaseUrl: "https://routing.example", overpassUrl: null, tileUrl: null },
    fetchImpl: async () => ({ ok: true, json: async () => ({ code: "Ok", routes: [{ distance: 2400, duration: 480 }] }) }),
  });
  assert.equal(ok.status, "ok");
  assert.equal(ok.distanceM, 2400);
  assert.equal(ok.durationS, 480);

  const negative = await loadRoute({
    focus,
    campus,
    config: { osrmBaseUrl: "https://routing.example", overpassUrl: null, tileUrl: null },
    fetchImpl: async () => ({ ok: true, json: async () => ({ code: "Ok", routes: [{ distance: -1, duration: 480 }] }) }),
  });
  assert.equal(negative.status, "failed");
  assert.equal(negative.distanceM, null);
  assert.equal(negative.durationS, null);
  assert.equal(describeRoute(negative).primary, "Routing unavailable");

  const noRoute = await loadRoute({
    focus,
    campus,
    config: { osrmBaseUrl: "https://routing.example", overpassUrl: null, tileUrl: null },
    fetchImpl: async () => ({ ok: true, json: async () => ({ code: "NoRoute", routes: [] }) }),
  });
  assert.equal(noRoute.status, "failed");
  assert.equal(noRoute.durationS, null);
});

test("the four location states stay distinct and do not invent coordinates", async () => {
  const exactAttempt = buildPublicSpatialContext(publicHome({
    locationState: "EXACT",
    exactLat: PRIVATE.lat,
    exactLng: PRIVATE.lng,
    authorizedLocation: PRIVATE,
  }));
  assert.equal(exactAttempt.focus.precision, "approximate");
  assert.equal(exactAttempt.allowExactOrigin, false);
  assert.equal(exactAttempt.locationState, "approximate");
  assert.equal(exactPinPermitted(exactAttempt.focus, exactAttempt.allowExactOrigin), false);
  assert.equal(mapGeometry(exactAttempt.focus).kind, "area");
  assert.equal(JSON.stringify(exactAttempt).includes(String(PRIVATE.lat)), false);

  const approximate = buildPublicSpatialContext(publicHome());
  assert.equal(approximate.focus.precision, "approximate");
  assert.equal(mapGeometry(approximate.focus).kind, "area");

  const areaOnly = buildPublicSpatialContext(publicHome({
    approxLocation: null,
    property: { lga: "Owerri West", city: "Owerri", state: "Imo", latitude: PRIVATE.lat, longitude: PRIVATE.lng, address: "12 Hidden Road" },
  }));
  assert.equal(areaOnly.focus.precision, "area-only");
  assert.equal(areaOnly.focus.label, "Owerri West, Owerri, Imo");
  assert.equal(mapGeometry(areaOnly.focus).kind, "none");
  assert.equal(JSON.stringify(areaOnly).includes("12 Hidden Road"), false);
  assert.equal(JSON.stringify(areaOnly).includes(String(PRIVATE.lat)), false);
  const areaRoute = await loadRoute({
    focus: areaOnly.focus,
    campus: campusById("fpno"),
    config: { osrmBaseUrl: "https://routing.example", overpassUrl: null, tileUrl: null },
    fetchImpl: async () => { throw new Error("should not be called"); },
  });
  assert.equal(areaRoute.status, "unavailable");
  assert.equal(areaRoute.distanceM, null);
  assert.equal(areaRoute.durationS, null);
  assert.equal(describeRoute(areaRoute).primary, "Routing unavailable");
  assert.match(describeRoute(areaRoute).detail, /no coordinate/);

  const unknown = buildPublicSpatialContext(publicHome({
    approxLocation: null,
    property: { latitude: PRIVATE.lat, longitude: PRIVATE.lng, address: "12 Hidden Road" },
  }));
  assert.equal(unknown.focus.precision, "unknown");
  assert.equal(unknown.focus.label, "Location not published");
  assert.equal(mapGeometry(unknown.focus).kind, "none");
  assert.equal(JSON.stringify(unknown).includes(String(PRIVATE.lng)), false);
  const unknownRoute = describeRoute(await loadRoute({
    focus: unknown.focus,
    campus: campusById("fpno"),
    config: { osrmBaseUrl: "https://routing.example", overpassUrl: null, tileUrl: null },
    fetchImpl: async () => { throw new Error("should not be called"); },
  }));
  assert.equal(unknownRoute.primary, "Routing unavailable");
  assert.equal(unknownRoute.durationS, null);

  const previewExact = buildPreviewModel("exact");
  assert.equal(previewExact.focus.precision, "exact");
  assert.equal(exactPinPermitted(previewExact.focus, previewExact.allowExactOrigin), true);
  assert.equal(mapGeometry(previewExact.focus).kind, "pin");
  const previewArea = buildPreviewModel("area-only");
  assert.equal(previewArea.focus.precision, "area-only");
  assert.equal("lat" in previewArea.focus, false);
  assert.equal(previewArea.amenities.items.length, 0);
  assert.equal(previewArea.route.durationS, null);
});

test("public adapter drops unpublished rows, fixtures, and authorized coordinates", () => {
  const adapted = adaptSpatialListing({ purpose: "rent", listing: publicHome({ category: "RESIDENTIAL" }), authorizedLocation: PRIVATE });
  assert.equal(adapted.purpose, "rent");
  assert.equal(adapted.category, "RESIDENTIAL");
  assert.equal(adapted.locationState, "approximate");
  assert.equal(JSON.stringify(adapted).includes("authorizedLocation"), false);
  assert.equal(JSON.stringify(adapted).includes(String(PRIVATE.lat)), false);
  assert.equal(adaptSpatialListing({ purpose: "buy", listing: publicHome({ reviewStatus: "NOT_REVIEWED" }) }), null);
  assert.equal(adaptSpatialListing(publicHome()).purpose, "unspecified");
  assert.equal(adaptSpatialListing({ ...publicHome(), fixture: true }), null);

  const request = anonymousListingRequest("https://api.example/", "42");
  assert.equal(request.url, "https://api.example/api/listings/42");
  assert.equal(request.init.cache, "no-store");
  assert.equal(Object.keys(request.init.headers).some((key) => /authorization/i.test(key)), false);
});

test("shared copy and imagery stay fail-closed without a marketplace contract", () => {
  assert.equal(publicSubject(undefined), "home");
  assert.equal(publicSubject("Land"), "land");
  assert.equal(publicSubject("buy property"), "home");
  const first = { id: "close" };
  const last = { id: "return" };
  assert.equal(nextDialogFocus([first, last], first, false), last);
  assert.equal(nextDialogFocus([first, last], last, false), first);
  assert.equal(nextDialogFocus([first, last], last, true), first);
  assert.equal(nextDialogFocus([first, last], null, true), last);
  assert.equal(nextDialogFocus([], first, false), null);
  assert.equal(publicTileTemplate({}), null);
  assert.equal(publicTileTemplate({ NEXT_PUBLIC_MAP_TILE_URL: "https://tiles.example/{z}/{x}/{y}.png" }), null);
  assert.equal(
    publicTileTemplate({
      NEXT_PUBLIC_MAP_TILE_URL: "https://tiles.example/{z}/{x}/{y}.png",
      NEXT_PUBLIC_MAP_ATTRIBUTION: "OpenStreetMap",
    }),
    "https://tiles.example/{z}/{x}/{y}.png",
  );
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
