/**
 * Phase 12C spatial.reconstruct_event. Assembles a RECONSTRUCTED SpatialEvent
 * from recorded evidence only (GEV src/scenes/nepalEvidencePack.js pattern:
 * label, link sources, never bundle media). Never claims live observation.
 * No evidence -> no event. Gaps stay visible as UNKNOWN entries.
 */
const { evidenceEnvelope, finiteTimestamp, spatialDataQuality } = require("./evidence.cjs");
const { stripPrivateLocationKeys, assertNoPrivateLocationKeys } = require("./privacy.cjs");

const EVENT_TYPES = Object.freeze([
  "FLOOD",
  "WEATHER_EVENT",
  "ROAD_DISRUPTION",
  "TRANSIT_DISRUPTION",
  "ENVIRONMENTAL_EVENT",
  "INFRASTRUCTURE_CHANGE",
]);
const TIMELINE_KINDS = Object.freeze(["OBSERVED", "DERIVED", "ESTIMATED", "UNKNOWN"]);
const DEFAULT_GAP_MS = 6 * 60 * 60 * 1000;
const LIVE_WARNING = "Reconstructed from recorded evidence after the fact; this is not a live observation.";
const SEVERITY_RANK = { low: 1, medium: 2, high: 3 };

const COORD_KEYS = new Set(["lat", "lng", "lon", "coordinates", "bbox", "geometry"]);

function dropCoordinates(value) {
  if (Array.isArray(value)) return value.map(dropCoordinates);
  if (!value || typeof value !== "object") return value;
  const out = {};
  Object.keys(value).forEach((key) => {
    if (COORD_KEYS.has(key)) return;
    out[key] = dropCoordinates(value[key]);
  });
  return out;
}

function publicArea(area) {
  if (!area || typeof area !== "object" || Array.isArray(area)) return null;
  const stripped = stripPrivateLocationKeys(area) || {};
  const out = {};
  ["areaLabel", "label", "city", "state", "lga", "campusId", "geography"].forEach((key) => {
    if (typeof stripped[key] === "string" && stripped[key]) out[key] = stripped[key].slice(0, 120);
  });
  if (stripped.precision === "APPROXIMATE" || stripped.precision === "PUBLIC_EXACT") out.precision = stripped.precision;
  return Object.keys(out).length ? out : null;
}

function kindOf(classification) {
  if (classification === "OBSERVED" || classification === "VERIFIED") return "OBSERVED";
  if (classification === "DERIVED") return "DERIVED";
  if (classification === "ESTIMATED") return "ESTIMATED";
  return "UNKNOWN";
}

function eventId(type, area, from, to) {
  const label = (area && (area.areaLabel || area.label || area.geography)) || "area";
  return `evt:${type}:${String(label).toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${from || "na"}:${to || "na"}`;
}

function reconstructEvent(input = {}, options = {}) {
  const row = input && typeof input === "object" ? input : {};
  const now = finiteTimestamp(typeof options.now === "function" ? options.now() : options.now);
  if (!EVENT_TYPES.includes(row.type)) return { ok: false, code: "unsupported_type", event: null };
  const area = publicArea(row.area);
  if (!area) return { ok: false, code: "missing_public_area", event: null };
  const range = row.timeRange && typeof row.timeRange === "object" ? row.timeRange : {};
  const from = finiteTimestamp(range.from);
  const to = finiteTimestamp(range.to);
  if (from != null && to != null && to < from) return { ok: false, code: "invalid_range", event: null };
  const inRange = (t) => t != null && (from == null || t >= from) && (to == null || t <= to);

  const envelopes = (Array.isArray(row.observations) ? row.observations : [])
    .map((item) => Object.assign(evidenceEnvelope(dropCoordinates(stripPrivateLocationKeys(item)), { now }), {
      id: item && typeof item.id === "string" ? item.id : null,
      fact: item && typeof item.fact === "string" ? item.fact : null,
    }))
    .filter((env) => inRange(env.observedAt));
  const anomalies = (Array.isArray(row.anomalies) ? row.anomalies : [])
    .filter((a) => a && inRange(finiteTimestamp(a.triggeredAt)))
    .map((a) => ({
      family: a.family || null,
      severity: SEVERITY_RANK[a.severity] ? a.severity : null,
      confidence: typeof a.confidence === "number" ? a.confidence : null,
      reason: typeof a.reason === "string" ? a.reason : null,
      triggeredAt: finiteTimestamp(a.triggeredAt),
      provider: a.provider || null,
    }));

  if (!envelopes.length && !anomalies.length) {
    return {
      ok: true,
      code: "no_evidence",
      event: null,
      warnings: ["No recorded evidence for this area and time range; no event was reconstructed."],
      dataQuality: spatialDataQuality({ now }),
    };
  }

  let timeline = envelopes.map((env) => ({
    at: env.observedAt,
    kind: kindOf(env.classification),
    fact: env.fact,
    value: env.value,
    provider: env.provider,
    evidenceId: env.id,
    confidence: env.confidence,
  })).concat(anomalies.map((a) => ({
    at: a.triggeredAt,
    kind: "DERIVED",
    fact: a.family,
    value: a.reason,
    provider: a.provider || "lodgist-anomaly",
    evidenceId: null,
    confidence: a.confidence,
  })));
  timeline.sort((l, r) => l.at - r.at || String(l.provider).localeCompare(String(r.provider)));
  const gapMs = typeof options.gapMs === "number" && options.gapMs > 0 ? options.gapMs : DEFAULT_GAP_MS;
  const withGaps = [];
  timeline.forEach((entry, index) => {
    if (index > 0 && entry.at - timeline[index - 1].at > gapMs) {
      withGaps.push({ at: timeline[index - 1].at + 1, until: entry.at - 1, kind: "UNKNOWN", fact: "gap", value: null, provider: null, evidenceId: null, confidence: null });
    }
    withGaps.push(entry);
  });
  timeline = withGaps.map((entry) => Object.assign({}, entry, { at: new Date(entry.at).toISOString(), until: entry.until ? new Date(entry.until).toISOString() : undefined }));

  const sourceMap = new Map();
  envelopes.forEach((env) => {
    const key = env.provider || env.source || "unknown";
    if (!sourceMap.has(key)) sourceMap.set(key, { provider: key, attribution: env.attribution, license: env.license, count: 0 });
    sourceMap.get(key).count += 1;
  });
  if (anomalies.length) sourceMap.set("lodgist-anomaly", { provider: "lodgist-anomaly", attribution: null, license: null, count: anomalies.length });

  const dq = spatialDataQuality({ observations: envelopes, now });
  const anomalyConf = anomalies.map((a) => a.confidence).filter((v) => typeof v === "number");
  const confList = (dq.confidence == null ? [] : [dq.confidence]).concat(anomalyConf);
  const confidence = confList.length ? Math.min(...confList) : null;
  const severities = anomalies.map((a) => a.severity).filter(Boolean);
  const severity = severities.length ? severities.reduce((m, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[m] ? s : m)) : "unknown";
  const warnings = [LIVE_WARNING];
  if (timeline.some((e) => e.kind === "UNKNOWN")) warnings.push("The timeline has gaps with no recorded evidence.");
  if (!timeline.some((e) => e.kind === "OBSERVED")) warnings.push("No directly observed evidence; entries are derived or estimated.");

  const times = envelopes.map((e) => e.observedAt).concat(anomalies.map((a) => a.triggeredAt));
  const event = {
    id: eventId(row.type, area, from, to),
    type: row.type,
    area,
    timeRange: {
      from: new Date(from != null ? from : Math.min(...times)).toISOString(),
      to: new Date(to != null ? to : Math.max(...times)).toISOString(),
    },
    timeline,
    observations: envelopes,
    anomalies,
    sources: Array.from(sourceMap.values()),
    confidence,
    impact: { severity, basis: severities.length ? "anomaly rules" : "no rule-based severity", area: area.areaLabel || area.label || null },
    warnings,
    label: "RECONSTRUCTED",
  };
  assertNoPrivateLocationKeys(event);
  return { ok: true, code: "ok", event, dataQuality: Object.assign(dq, { confidence }) };
}

module.exports = {
  EVENT_TYPES,
  TIMELINE_KINDS,
  LIVE_WARNING,
  reconstructEvent,
};
