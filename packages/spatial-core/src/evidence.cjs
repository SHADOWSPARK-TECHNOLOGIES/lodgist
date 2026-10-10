/**
 * Evidence envelope. Freshness is computed from observedAt only. A missing
 * observation timestamp is unknown. retrievedAt is stored and is never used
 * as a substitute. Coverage is a separate field and does not change freshness.
 *
 * Reimplemented from the God's Eye View live-source contract
 * (src/sources/live/contract.js). That module is coupled to aircraft records
 * and uses freshness "current", so it was not copied.
 */
const FRESHNESS = Object.freeze(["fresh", "stale", "unknown"]);
const CLASSIFICATIONS = Object.freeze(["VERIFIED", "OBSERVED", "DERIVED", "ESTIMATED", "UNKNOWN"]);
const DEFAULT_STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const ENVELOPE_KEYS = Object.freeze([
  "value",
  "source",
  "provider",
  "observedAt",
  "retrievedAt",
  "freshness",
  "confidence",
  "classification",
  "attribution",
  "license",
]);

function finiteTimestamp(value) {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return number;
}

function classificationOf(value) {
  return CLASSIFICATIONS.includes(value) ? value : "UNKNOWN";
}

function confidenceOf(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < 0 || value > 1) return null;
  return value;
}

function freshnessOf(observedAt, now, staleAfterMs) {
  if (observedAt == null || now == null) return "unknown";
  if (now - observedAt > staleAfterMs) return "stale";
  return "fresh";
}

function evidenceEnvelope(input = {}, options = {}) {
  const row = input && typeof input === "object" ? input : {};
  const observedAt = finiteTimestamp(row.observedAt);
  const retrievedAt = finiteTimestamp(row.retrievedAt);
  const now = finiteTimestamp(options.now);
  const staleAfterMs = typeof options.staleAfterMs === "number" && options.staleAfterMs >= 0
    ? options.staleAfterMs
    : DEFAULT_STALE_AFTER_MS;
  const coverage = typeof row.coverage === "string" ? row.coverage : null;
  return {
    value: row.value === undefined ? null : row.value,
    source: typeof row.source === "string" ? row.source : null,
    provider: typeof row.provider === "string" && row.provider ? row.provider : null,
    observedAt,
    retrievedAt,
    freshness: freshnessOf(observedAt, now, staleAfterMs),
    confidence: confidenceOf(row.confidence),
    classification: classificationOf(row.classification),
    attribution: typeof row.attribution === "string" ? row.attribution : null,
    license: typeof row.license === "string" ? row.license : null,
    coverage,
  };
}

module.exports = {
  FRESHNESS,
  CLASSIFICATIONS,
  DEFAULT_STALE_AFTER_MS,
  ENVELOPE_KEYS,
  finiteTimestamp,
  evidenceEnvelope,
};
