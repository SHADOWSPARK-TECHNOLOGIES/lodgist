/**
 * Layer allow/ban catalog from spatial-lab src/neighborhood/catalog.js
 * at a922a3bfa86683ab008dbada0a37a3c956760eb7.
 * Lodgist amenity categories (shop, pharmacy, clinic, transport) are a
 * separate list. Mapping them onto these layers is deferred.
 */
const ALLOWED_LAYERS = Object.freeze([
  "hospitals",
  "schools",
  "markets",
  "pharmacies",
  "roads",
]);

const BANNED_LAYERS = Object.freeze([
  "flights",
  "military",
  "vessels",
  "satellites",
  "cctv",
  "alpr",
  "radio",
  "cables",
  "firms",
  "earthquakes",
]);

const ALLOWED = new Set(ALLOWED_LAYERS);
const BANNED = new Set(BANNED_LAYERS);

function assertLayerId(id) {
  if (typeof id !== "string" || !id.trim()) {
    throw new Error("layer not allowed");
  }
  const layer = id.trim();
  if (BANNED.has(layer)) {
    throw new Error(`refusing banned layer: ${layer}`);
  }
  if (!ALLOWED.has(layer)) {
    throw new Error(`layer not allowed: ${layer}`);
  }
  return layer;
}

module.exports = { ALLOWED_LAYERS, BANNED_LAYERS, assertLayerId };
