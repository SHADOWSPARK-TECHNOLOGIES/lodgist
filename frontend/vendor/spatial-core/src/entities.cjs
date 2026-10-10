/**
 * Phase 12D spatial entity lifecycle (GEV src/data/lifecycle.js pattern,
 * reimplemented). Lodgist entity types only: transit status, road incidents,
 * environmental events, service availability, inspections and temporary
 * conditions. Aircraft, vessels, military assets, people and vehicles are
 * refused. Positions are public (PUBLIC_EXACT for public places, APPROXIMATE
 * otherwise). An empty authoritative feed is a valid answer; entities are
 * never invented.
 */
const { finiteTimestamp, DEFAULT_STALE_AFTER_MS } = require("./evidence.cjs");
const { stripPrivateLocationKeys } = require("./privacy.cjs");

const ENTITY_TYPES = Object.freeze([
  "TRANSIT_STATUS",
  "ROAD_INCIDENT",
  "ENVIRONMENTAL_EVENT",
  "SERVICE_AVAILABILITY",
  "INSPECTION",
  "TEMPORARY_CONDITION",
]);
const REFUSED_TYPE_PATTERN = /(aircraft|flight|adsb|vessel|ship|ais|military|person|people|face|vehicle|plate|alpr|track)/i;
const ENTITY_STATES = Object.freeze(["ACTIVE", "RESOLVED", "EXPIRED"]);
const POSITION_PRECISIONS = new Set(["PUBLIC_EXACT", "APPROXIMATE"]);
const APPROX_GRID = 0.005;

function snap(value) {
  return Math.round(value / APPROX_GRID) * APPROX_GRID;
}

function publicPosition(position) {
  if (!position || typeof position !== "object") return { ok: false, code: "missing_position" };
  const precision = position.precision;
  if (!POSITION_PRECISIONS.has(precision)) return { ok: false, code: "protected_position" };
  const out = { precision };
  if (typeof position.areaLabel === "string" && position.areaLabel) out.areaLabel = position.areaLabel.slice(0, 120);
  const lat = Number(position.lat);
  const lng = Number(position.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { ok: false, code: "invalid_position" };
    out.lat = precision === "APPROXIMATE" ? Number(snap(lat).toFixed(3)) : lat;
    out.lng = precision === "APPROXIMATE" ? Number(snap(lng).toFixed(3)) : lng;
  } else if (!out.areaLabel) {
    return { ok: false, code: "missing_position" };
  }
  return { ok: true, position: out };
}

function entityFreshness(entity, now) {
  if (entity.state === "EXPIRED") return "STALE";
  if (entity.observedAt == null || now == null) return "UNKNOWN";
  if (entity.expiresAt != null && now >= entity.expiresAt) return "STALE";
  if (now - entity.observedAt > DEFAULT_STALE_AFTER_MS) return "STALE";
  if (now - entity.observedAt > DEFAULT_STALE_AFTER_MS / 2) return "AGING";
  return "FRESH";
}

function cleanMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const stripped = stripPrivateLocationKeys(metadata) || {};
  const out = {};
  Object.keys(stripped).slice(0, 32).forEach((key) => {
    if (["lat", "lng", "lon", "latitude", "longitude", "coordinates", "token", "apiKey", "secret"].includes(key)) return;
    const value = stripped[key];
    if (value == null || ["string", "number", "boolean"].includes(typeof value)) out[key] = value;
  });
  return out;
}

function validateEntity(input) {
  const row = input && typeof input === "object" ? input : {};
  if (typeof row.type !== "string" || REFUSED_TYPE_PATTERN.test(row.type)) return { ok: false, code: "refused_type" };
  if (!ENTITY_TYPES.includes(row.type)) return { ok: false, code: "unsupported_type" };
  if (typeof row.id !== "string" || !row.id || row.id.length > 128) return { ok: false, code: "malformed" };
  if (typeof row.source !== "string" || !row.source) return { ok: false, code: "missing_source" };
  const observedAt = finiteTimestamp(row.observedAt);
  if (observedAt == null) return { ok: false, code: "missing_observed_at" };
  const position = publicPosition(row.position);
  if (!position.ok) return position;
  const expiresAt = finiteTimestamp(row.expiresAt);
  if (expiresAt != null && expiresAt <= observedAt) return { ok: false, code: "invalid_expiry" };
  return {
    ok: true,
    entity: {
      id: row.id,
      type: row.type,
      position: position.position,
      source: row.source,
      observedAt,
      expiresAt,
      state: ENTITY_STATES.includes(row.state) && row.state !== "EXPIRED" ? row.state : "ACTIVE",
      metadata: cleanMetadata(row.metadata),
    },
  };
}

function view(entity, now) {
  return Object.assign({}, entity, {
    position: Object.assign({}, entity.position),
    metadata: Object.assign({}, entity.metadata),
    freshness: entityFreshness(entity, now),
  });
}

/** In-memory lifecycle store. Backends may persist the same records. */
function createEntityStore(options = {}) {
  const clock = typeof options.now === "function" ? options.now : () => Date.now();
  const current = new Map();
  const log = [];
  const record = (action, entity) => log.push({ action, at: clock(), entity: view(entity, clock()) });
  const sweep = () => {
    const now = clock();
    current.forEach((entity) => {
      if (entity.state !== "EXPIRED" && entity.expiresAt != null && now >= entity.expiresAt) {
        entity.state = "EXPIRED";
        record("expire", entity);
      }
    });
  };
  return {
    ingest(input) {
      const checked = validateEntity(input);
      if (!checked.ok) return checked;
      if (current.has(checked.entity.id)) return { ok: false, code: "duplicate" };
      current.set(checked.entity.id, checked.entity);
      record("ingest", checked.entity);
      return { ok: true, entity: view(checked.entity, clock()) };
    },
    update(id, patch) {
      sweep();
      const existing = current.get(id);
      if (!existing) return { ok: false, code: "not_found" };
      if (existing.state === "EXPIRED") return { ok: false, code: "expired" };
      const merged = Object.assign({}, existing, patch || {}, { id, type: existing.type });
      const checked = validateEntity(merged);
      if (!checked.ok) return checked;
      if (checked.entity.observedAt < existing.observedAt) return { ok: false, code: "out_of_order" };
      if (patch && patch.state === "RESOLVED") checked.entity.state = "RESOLVED";
      current.set(id, checked.entity);
      record("update", checked.entity);
      return { ok: true, entity: view(checked.entity, clock()) };
    },
    expire(id) {
      const existing = current.get(id);
      if (!existing) return { ok: false, code: "not_found" };
      if (existing.state !== "EXPIRED") {
        existing.state = "EXPIRED";
        record("expire", existing);
      }
      return { ok: true, entity: view(existing, clock()) };
    },
    inspect(id) {
      sweep();
      const existing = current.get(id);
      if (!existing) return { ok: false, code: "not_found" };
      return { ok: true, entity: view(existing, clock()) };
    },
    history(id) {
      return { ok: true, entries: log.filter((item) => item.entity.id === id).map((item) => Object.assign({}, item)) };
    },
    list(filter = {}) {
      sweep();
      const rows = Array.from(current.values())
        .filter((entity) => !filter.type || entity.type === filter.type)
        .filter((entity) => filter.includeExpired === true || entity.state !== "EXPIRED")
        .map((entity) => view(entity, clock()));
      return {
        ok: true,
        entities: rows,
        coverage: rows.length ? "observed" : (options.authoritative === true ? "authoritative_empty" : "unknown"),
      };
    },
  };
}

module.exports = {
  ENTITY_TYPES,
  ENTITY_STATES,
  validateEntity,
  entityFreshness,
  createEntityStore,
};
