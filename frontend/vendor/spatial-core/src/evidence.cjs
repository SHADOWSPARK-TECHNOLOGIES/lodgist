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

const CONFIDENCE_RULES = Object.freeze({
  "freshness.unknown": "An observation has no timestamp, so freshness is unknown.",
  "freshness.stale": "An observation is older than the stale window.",
  "confidence.missing": "An observation has no confidence value.",
  "completeness.silent-provider": "A provider returned no observations.",
  "completeness.missing-subject": "A requested subject has no observation.",
  "completeness.missing-fact": "A required fact has no observation.",
  "conflict.sources": "Sources disagree and were not merged.",
});

function dataQuality(input = {}) {
  const row = input && typeof input === "object" ? input : {};
  const observations = Array.isArray(row.observations) ? row.observations : [];
  const conflicts = Array.isArray(row.conflicts) ? row.conflicts : [];
  const missing = Array.isArray(row.missing) ? row.missing : [];
  const ruleIds = [];
  if (!observations.length || observations.some((item) => !item || item.freshness === "unknown")) {
    ruleIds.push("freshness.unknown");
  }
  if (observations.some((item) => item && item.freshness === "stale")) ruleIds.push("freshness.stale");
  if (!observations.length || observations.some((item) => !item || item.confidence == null)) {
    ruleIds.push("confidence.missing");
  }
  if (missing.some((item) => item && item.reason === "provider-silent")) ruleIds.push("completeness.silent-provider");
  if (missing.some((item) => item && item.reason === "subject-missing")) ruleIds.push("completeness.missing-subject");
  if (missing.some((item) => item && item.reason === "fact-missing")) ruleIds.push("completeness.missing-fact");
  if (conflicts.length) ruleIds.push("conflict.sources");
  let completeness = "empty";
  if (observations.length && !missing.length && !conflicts.length) completeness = "complete";
  else if (observations.length || missing.length || conflicts.length) completeness = "partial";
  return {
    freshness: row.freshness === "fresh" || row.freshness === "stale" || row.freshness === "unknown"
      ? row.freshness
      : "unknown",
    confidenceRuleIds: ruleIds,
    completeness,
    sourceConflicts: conflicts.length,
    warnings: ruleIds.map((id) => CONFIDENCE_RULES[id]),
  };
}

/**
 * Universal DataQuality (Phase 12B). Attached to every spatial result.
 * Coverage describes the data we hold, never the neighbourhood: a POOR grade
 * means "may not know every hospital", not "poor healthcare".
 * Confidence of a derived result is never higher than its inputs (min rule).
 */
const DQ_COVERAGE = Object.freeze(["GOOD", "PARTIAL", "POOR", "UNKNOWN"]);
const DQ_FRESHNESS = Object.freeze(["FRESH", "AGING", "STALE", "UNKNOWN"]);
const DQ_RULES = Object.freeze({
  "dq.no-evidence": "No evidence backs this result.",
  "dq.freshness.unknown": "At least one observation has no timestamp.",
  "dq.freshness.aging": "At least one observation is past half of its stale window.",
  "dq.freshness.stale": "At least one observation is older than its stale window.",
  "dq.confidence.missing": "No observation carries a confidence value.",
  "dq.confidence.inherited": "Confidence is capped by the weakest input.",
  "dq.coverage.unknown": "Coverage for this area is unknown.",
  "dq.coverage.incomplete": "Mapped data may be incomplete here; a missing place is not proof it is absent.",
  "dq.conflict": "Sources disagree and were not merged.",
  "dq.completeness.partial": "Some requested facts are missing.",
});
const FRESH_RANK = { FRESH: 0, AGING: 1, STALE: 2, UNKNOWN: 3 };
const COVER_RANK = { UNKNOWN: 0, POOR: 1, PARTIAL: 2, GOOD: 3 };

function isEnvelopeLike(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, "freshness")
    && Object.prototype.hasOwnProperty.call(value, "classification"));
}

function collectEnvelopes(value, out, depth) {
  if (!value || typeof value !== "object" || depth > 6 || out.length > 500) return out;
  if (Array.isArray(value)) {
    value.forEach((item) => collectEnvelopes(item, out, depth + 1));
    return out;
  }
  if (isEnvelopeLike(value)) out.push(value);
  Object.keys(value).forEach((key) => {
    if (key === "dataQuality") return;
    collectEnvelopes(value[key], out, depth + 1);
  });
  return out;
}

function envelopeFreshness(envelope, now, staleAfterMs) {
  const observedAt = finiteTimestamp(envelope && envelope.observedAt);
  const base = String((envelope && envelope.freshness) || "unknown").toUpperCase();
  if (base === "UNKNOWN" || observedAt == null) return "UNKNOWN";
  if (base === "STALE") return "STALE";
  if (now != null && now - observedAt > staleAfterMs / 2) return "AGING";
  return "FRESH";
}

function normalizeCoverage(value) {
  const upper = typeof value === "string" ? value.toUpperCase() : "";
  return DQ_COVERAGE.includes(upper) ? upper : "UNKNOWN";
}

function weakest(list, rank, fallback) {
  if (!list.length) return fallback;
  return list.reduce((acc, item) => (rank[item] < rank[acc] ? item : acc), list[0]);
}

function worstFreshness(list) {
  if (!list.length) return "UNKNOWN";
  return list.reduce((acc, item) => (FRESH_RANK[item] > FRESH_RANK[acc] ? item : acc), list[0]);
}

/**
 * Build DataQuality from envelopes and optional prior DataQuality inputs.
 * input: {observations?, inputs?, coverage?, conflicts?, missing?, expected?, warnings?, now?, staleAfterMs?}
 */
function spatialDataQuality(input = {}) {
  const row = input && typeof input === "object" ? input : {};
  const now = finiteTimestamp(row.now);
  const staleAfterMs = typeof row.staleAfterMs === "number" && row.staleAfterMs > 0 ? row.staleAfterMs : DEFAULT_STALE_AFTER_MS;
  const observations = Array.isArray(row.observations) ? row.observations.filter(Boolean) : [];
  const inputs = Array.isArray(row.inputs) ? row.inputs.filter((item) => item && typeof item === "object") : [];
  const conflicts = (Array.isArray(row.conflicts) ? row.conflicts : []).concat(
    ...inputs.map((item) => (Array.isArray(item.conflicts) ? item.conflicts : [])),
  );
  const missing = Array.isArray(row.missing) ? row.missing : [];
  const ruleIds = [];

  const freshList = observations.map((item) => envelopeFreshness(item, now, staleAfterMs))
    .concat(inputs.map((item) => (DQ_FRESHNESS.includes(item.freshness) ? item.freshness : "UNKNOWN")));
  const freshness = worstFreshness(freshList);

  const confidences = observations.map((item) => confidenceOf(item.confidence)).filter((v) => v != null);
  const inherited = inputs.map((item) => confidenceOf(item.confidence)).filter((v) => v != null);
  const all = confidences.concat(inherited);
  const confidence = all.length ? Math.min(...all) : null;

  const coverageList = [];
  if (row.coverage != null) coverageList.push(normalizeCoverage(row.coverage));
  inputs.forEach((item) => coverageList.push(normalizeCoverage(item.coverage)));
  const coverage = weakest(coverageList, COVER_RANK, "UNKNOWN");

  const expected = Number.isInteger(row.expected) && row.expected > 0 ? row.expected : null;
  let completeness = null;
  if (expected != null) {
    const found = Math.max(0, expected - missing.length);
    completeness = Math.round((found / expected) * 1000) / 1000;
  } else if (observations.length || inputs.length) {
    const ratios = inputs.map((item) => item.completeness).filter((v) => typeof v === "number");
    const own = observations.length ? (missing.length ? observations.length / (observations.length + missing.length) : 1) : null;
    const list = own == null ? ratios : ratios.concat([own]);
    completeness = list.length ? Math.round(Math.min(...list) * 1000) / 1000 : null;
  }

  if (!observations.length && !inputs.length) ruleIds.push("dq.no-evidence");
  if (freshness === "UNKNOWN") ruleIds.push("dq.freshness.unknown");
  if (freshness === "AGING") ruleIds.push("dq.freshness.aging");
  if (freshness === "STALE") ruleIds.push("dq.freshness.stale");
  if (confidence == null) ruleIds.push("dq.confidence.missing");
  if (inherited.length) ruleIds.push("dq.confidence.inherited");
  if (coverage === "UNKNOWN") ruleIds.push("dq.coverage.unknown");
  if (coverage === "POOR" || coverage === "PARTIAL") ruleIds.push("dq.coverage.incomplete");
  if (conflicts.length) ruleIds.push("dq.conflict");
  if (completeness != null && completeness < 1) ruleIds.push("dq.completeness.partial");
  inputs.forEach((item) => (Array.isArray(item.ruleIds) ? item.ruleIds : []).forEach((id) => {
    if (DQ_RULES[id] && !ruleIds.includes(id)) ruleIds.push(id);
  }));

  const warnings = [];
  ruleIds.forEach((id) => { if (DQ_RULES[id] && !warnings.includes(DQ_RULES[id])) warnings.push(DQ_RULES[id]); });
  (Array.isArray(row.warnings) ? row.warnings : []).forEach((text) => {
    if (typeof text === "string" && text && !warnings.includes(text)) warnings.push(text);
  });

  return {
    coverage,
    freshness,
    confidence,
    completeness,
    conflicts: conflicts.length,
    warnings,
    ruleIds,
    computedAt: now != null ? new Date(now).toISOString() : null,
  };
}

/** Derive DataQuality from any spatial result object (tool data, history, anomalies, monitors). */
function dataQualityFromResult(result, options = {}) {
  const data = result && typeof result === "object" ? result : {};
  const observations = collectEnvelopes(data, [], 0);
  const coverage = typeof data.coverage === "string" ? data.coverage
    : (data.data && typeof data.data.coverage === "string" ? data.data.coverage : null);
  const conflicts = Array.isArray(data.conflicts) ? data.conflicts
    : (data.data && Array.isArray(data.data.conflicts) ? data.data.conflicts : []);
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];
  return spatialDataQuality({
    observations,
    inputs: Array.isArray(options.inputs) ? options.inputs : [],
    coverage: coverage == null ? "UNKNOWN" : coverage,
    conflicts,
    warnings,
    now: options.now,
    staleAfterMs: options.staleAfterMs,
  });
}

function withDataQuality(result, options = {}) {
  if (!result || typeof result !== "object" || Array.isArray(result)) return result;
  return Object.assign({}, result, { dataQuality: dataQualityFromResult(result, options) });
}

/** Phase 12J claim grounding vocabulary (shared by scenes, tours, firewall). */
const CLAIM_EVIDENCE_KINDS = Object.freeze(["DATABASE_EVIDENCE", "PROVIDER_EVIDENCE", "TOOL_RESULT", "APPROVED_STATIC_DATA"]);
const CLAIM_FALLBACKS = Object.freeze(["UNKNOWN", "DATA_UNAVAILABLE", "COVERAGE_INCOMPLETE"]);

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
  CONFIDENCE_RULES,
  DQ_COVERAGE,
  CLAIM_EVIDENCE_KINDS,
  CLAIM_FALLBACKS,
  DQ_FRESHNESS,
  DQ_RULES,
  spatialDataQuality,
  dataQualityFromResult,
  withDataQuality,
  finiteTimestamp,
  dataQuality,
  evidenceEnvelope,
};
