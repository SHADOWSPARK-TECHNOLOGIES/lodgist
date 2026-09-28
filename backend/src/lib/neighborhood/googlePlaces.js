// N4: Google Places API (New) Nearby Search adapter. Plain fetch, server-side key only.
const ENDPOINT = "https://places.googleapis.com/v1/places:searchNearby";
// Every field here is billed at the "Nearby Search Pro" SKU, the lowest tier for
// Nearby Search. rating, userRatingCount and currentOpeningHours would bump the
// request to "Nearby Search Enterprise"; don't add them back.
// https://developers.google.com/maps/documentation/places/web-service/data-fields
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
  "places.types",
].join(",");
const MAX_RESULTS = 20;
const DEFAULT_TIMEOUT_MS = 5000;

class PlacesError extends Error {
  constructor(kind, message, status) {
    super(message);
    this.name = "PlacesError";
    this.kind = kind; // "no_key" | "timeout" | "upstream"
    this.status = status;
  }
}

async function searchNearby({ apiKey, lat, lng, radiusM, includedTypes, fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  if (!apiKey) throw new PlacesError("no_key", "GOOGLE_PLACES_API_KEY is not set");

  const body = {
    includedTypes,
    maxResultCount: MAX_RESULTS,
    rankPreference: "DISTANCE",
    locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: radiusM } },
  };

  let res;
  try {
    res = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new PlacesError("timeout", "Google Places timed out");
    }
    throw new PlacesError("upstream", "Google Places request failed");
  }

  if (!res.ok) throw new PlacesError("upstream", `Google Places returned ${res.status}`, res.status);

  let json;
  try {
    json = await res.json();
  } catch {
    throw new PlacesError("upstream", "Google Places returned invalid JSON", res.status);
  }
  return Array.isArray(json && json.places) ? json.places : [];
}

module.exports = { ENDPOINT, FIELD_MASK, MAX_RESULTS, PlacesError, searchNearby };
