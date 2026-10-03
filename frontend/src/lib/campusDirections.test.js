const { test } = require("node:test");
const assert = require("node:assert/strict");
const { campusDirections } = require("./campusDirections");

const NEKEDE_PIN = { lat: 5.4693523, lng: 7.0339554, radius_m: 500 };

test("a Nekede pin gets an area-to-campus map and an approximate distance", () => {
  const result = campusDirections({
    place: "Nekede, Owerri West, Imo",
    approx: NEKEDE_PIN,
  });
  assert.equal(result.placeText, "Nekede, Owerri West, Imo");
  assert.match(result.mapUrl, /^https:\/\/www\.openstreetmap\.org\/directions\?/);
  assert.match(result.mapUrl, /5\.4693523,7\.0339554/);
  assert.match(result.mapUrl, /5\.4333523,7\.0339554/);
  assert.equal(
    result.distanceText,
    "About 4 km from the 500 m area to Federal Polytechnic Nekede. This is not a door-to-gate measurement."
  );
  assert.match(result.pinNote, /500 m/);
  assert.equal(/walking time/i.test(result.distanceText), false);
});

test("a Nekede home with no pin stays on text", () => {
  const result = campusDirections({ place: "Nekede, Owerri", approx: null });
  assert.equal(result.mapUrl, null);
  assert.equal(result.pinNote, "No map pin is on file.");
  assert.equal(result.distanceText, "Distance to campus is not measured yet.");
});

test("a pin outside Nekede does not invent a Nekede distance", () => {
  const result = campusDirections({
    place: "Yaba, Lagos",
    approx: { lat: 6.5, lng: 3.37, radius_m: 500 },
  });
  assert.match(result.mapUrl, /^https:\/\/www\.openstreetmap\.org\/\?mlat=6\.5/);
  assert.equal(result.distanceText, "Distance to campus is not measured for this area yet.");
  assert.equal(result.mapUrl.includes("5.4333523"), false);
});

test("missing area and a bad pin are marked unknown", () => {
  const result = campusDirections({
    place: "",
    approx: { lat: "5.43", lng: 7.03, radius_m: 500 },
  });
  assert.equal(result.placeText, "Area is not listed.");
  assert.equal(result.mapUrl, null);
  assert.equal(result.distanceText, "Distance to campus is not measured yet.");
});
