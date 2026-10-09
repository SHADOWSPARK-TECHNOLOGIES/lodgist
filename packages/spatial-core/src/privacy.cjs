const PRIVATE_LOCATION_KEYS = new Set([
  "latitude",
  "longitude",
  "address",
  "landmark",
  "exactLat",
  "exactLng",
  "exactLatitude",
  "exactLongitude",
]);

function ownKeys(value, into) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => ownKeys(item, into));
    return;
  }
  Object.keys(value).forEach((key) => {
    into.add(key);
    ownKeys(value[key], into);
  });
}

function assertNoPrivateLocationKeys(value) {
  const keys = new Set();
  ownKeys(value, keys);
  PRIVATE_LOCATION_KEYS.forEach((key) => {
    if (keys.has(key)) {
      throw new Error("public spatial context exposed a private location field");
    }
  });
  return value;
}

function stripPrivateLocationKeys(value) {
  if (Array.isArray(value)) return value.map((item) => stripPrivateLocationKeys(item));
  if (!value || typeof value !== "object") return value;
  const out = {};
  Object.keys(value).forEach((key) => {
    if (PRIVATE_LOCATION_KEYS.has(key)) return;
    out[key] = stripPrivateLocationKeys(value[key]);
  });
  return out;
}

module.exports = {
  PRIVATE_LOCATION_KEYS,
  assertNoPrivateLocationKeys,
  stripPrivateLocationKeys,
};
