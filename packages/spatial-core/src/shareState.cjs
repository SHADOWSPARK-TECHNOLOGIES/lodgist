/**
 * Phase 12E map share state (GEV src/sharelink.js / director/sharing pattern,
 * reimplemented). Only public state is serialized: center, zoom, pitch,
 * bearing, a public entity, allowed layers, a safe route and safe
 * annotations. Never protected/AUTHORIZED_EXACT coordinates, private
 * destinations, tokens, keys or sessions. Opening a share always
 * deserializes -> validates schema -> re-runs the privacy gate -> resolves
 * current state; any embedded privacy/precision claim is ignored.
 */
const crypto = require("node:crypto");
const { focusFromPublicListing } = require("./core.cjs");
const { campusById } = require("./campuses.cjs");
const { ALLOWED_LAYERS } = require("./catalog.cjs");

const SHARE_VERSION = 1;
const SHARE_KEYS = new Set(["v", "center", "zoom", "pitch", "bearing", "entity", "layers", "route", "annotations"]);
const MAX_SERIALIZED = 4096;
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const UNANCHORED_GRID = 0.01;
const UNANCHORED_MAX_ZOOM = 14;
const COORD_TEXT = /-?\d{1,3}\.\d{3,}/;
const UNSAFE_TEXT = /(<|>|javascript:|https?:\/\/|token|session|apikey|api_key|secret)/i;

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function snap(value, grid) {
  return Number((Math.round(value / grid) * grid).toFixed(4));
}

function listingOf(ctx, id) {
  const rows = ctx && Array.isArray(ctx.listings) ? ctx.listings : [];
  const listing = rows.find((item) => item && String(item.id) === String(id)) || null;
  if (!listing || typeof ctx.isPublicListing !== "function" || ctx.isPublicListing(listing) !== true) return null;
  return listing;
}

/** Privacy gate + resolution. Returns {ok, state, dropped[]} built only from current public data. */
function gateShareState(input = {}, ctx = {}) {
  const raw = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const dropped = [];
  Object.keys(raw).forEach((key) => { if (!SHARE_KEYS.has(key)) dropped.push(key); });
  const state = {
    v: SHARE_VERSION,
    zoom: clamp(raw.zoom, 1, 18, 12),
    pitch: clamp(raw.pitch, 0, 60, 0),
    bearing: clamp(raw.bearing, -180, 180, 0),
    center: null,
    entity: null,
    layers: [],
    route: null,
    annotations: [],
  };
  let anchored = false;
  if (raw.entity && typeof raw.entity === "object") {
    if (raw.entity.type === "listing") {
      const listing = listingOf(ctx, raw.entity.id);
      const focus = listing ? focusFromPublicListing(listing) : null;
      if (focus && focus.precision === "approximate") {
        state.entity = { type: "listing", id: listing.id };
        state.center = { lat: focus.lat, lng: focus.lng };
        state.zoom = Math.min(state.zoom, 15);
        anchored = true;
      } else dropped.push("entity");
    } else if (raw.entity.type === "campus" && campusById(String(raw.entity.id || ""))) {
      const campus = campusById(String(raw.entity.id));
      state.entity = { type: "campus", id: campus.id };
      state.center = { lat: campus.lat, lng: campus.lng };
      anchored = true;
    } else dropped.push("entity");
  }
  if (!anchored) {
    const lat = Number(raw.center && raw.center.lat);
    const lng = Number(raw.center && raw.center.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      state.center = { lat: snap(lat, UNANCHORED_GRID), lng: snap(lng, UNANCHORED_GRID) };
      state.zoom = Math.min(state.zoom, UNANCHORED_MAX_ZOOM);
    }
  }
  (Array.isArray(raw.layers) ? raw.layers : []).forEach((layer) => {
    if (ALLOWED_LAYERS.includes(layer) && !state.layers.includes(layer)) state.layers.push(layer);
    else dropped.push(`layer:${String(layer).slice(0, 32)}`);
  });
  if (raw.route && typeof raw.route === "object") {
    const listing = listingOf(ctx, raw.route.listingId);
    const campus = campusById(String(raw.route.campusId || ""));
    if (listing && campus && Object.keys(raw.route).every((k) => k === "listingId" || k === "campusId")) {
      state.route = { listingId: listing.id, campusId: campus.id };
    } else dropped.push("route");
  }
  (Array.isArray(raw.annotations) ? raw.annotations : []).slice(0, 5).forEach((note) => {
    const text = note && typeof note.text === "string" ? note.text.trim().slice(0, 140) : "";
    if (!text || COORD_TEXT.test(text) || UNSAFE_TEXT.test(text)) {
      dropped.push("annotation");
      return;
    }
    state.annotations.push({ text });
  });
  return { ok: true, state, dropped };
}

function serializeShareState(state) {
  const json = JSON.stringify(state);
  return Buffer.from(json, "utf8").toString("base64url");
}

function deserializeShareState(serialized) {
  if (typeof serialized !== "string" || !serialized || serialized.length > MAX_SERIALIZED) return { ok: false, code: "malformed" };
  try {
    const parsed = JSON.parse(Buffer.from(serialized, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || parsed.v !== SHARE_VERSION) return { ok: false, code: "malformed" };
    return { ok: true, raw: parsed };
  } catch {
    return { ok: false, code: "malformed" };
  }
}

/** Opaque server-side share links: the URL carries only a random token. */
function createShareStore(options = {}) {
  const clock = typeof options.now === "function" ? options.now : () => Date.now();
  const rows = new Map();
  return {
    create(input, ctx, ttlMs) {
      const gated = gateShareState(input, ctx);
      const token = crypto.randomBytes(16).toString("base64url");
      const expiresAt = clock() + (Number.isFinite(ttlMs) && ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS);
      rows.set(token, { serialized: serializeShareState(gated.state), expiresAt });
      return { ok: true, token, path: `/s/${token}`, expiresAt: new Date(expiresAt).toISOString(), dropped: gated.dropped };
    },
    open(token, ctx) {
      const row = rows.get(token);
      if (!row) return { ok: false, code: "not_found" };
      if (clock() >= row.expiresAt) return { ok: false, code: "expired" };
      return openShareState(row.serialized, ctx);
    },
  };
}

/** deserialize -> validate -> re-run privacy gate -> resolve current state. */
function openShareState(serialized, ctx = {}) {
  const parsed = deserializeShareState(serialized);
  if (!parsed.ok) return parsed;
  const gated = gateShareState(parsed.raw, ctx);
  return { ok: true, code: gated.dropped.length ? "resolved_with_drops" : "ok", state: gated.state, dropped: gated.dropped };
}

module.exports = {
  SHARE_VERSION,
  gateShareState,
  serializeShareState,
  deserializeShareState,
  openShareState,
  createShareStore,
};
