/**
 * Deterministic spatial anomaly engine.
 * observation -> normalize -> baseline -> rule/statistical evaluation ->
 * evidence -> severity -> confidence -> optional explanation.
 * An explanation can describe the decision. It cannot change it.
 * SPATIAL_ANOMALIES defaults off. No notification is sent.
 */
const { evidenceEnvelope, finiteTimestamp, DEFAULT_STALE_AFTER_MS } = require("./evidence.cjs");
const { evaluateConditions } = require("./monitor.cjs");
const { crossReference } = require("./crossReference.cjs");
const { getSpatialHistory } = require("./history.cjs");
const { assertNoPrivateLocationKeys, stripPrivateLocationKeys } = require("./privacy.cjs");

const ANOMALY_FLAG = "SPATIAL_ANOMALIES";
const ANOMALY_FAMILIES = Object.freeze([
  "ACCESS_CHANGE",
  "FLOOD_RISK_CHANGE",
  "TRAFFIC_DISRUPTION",
  "TRANSIT_CHANGE",
  "AMENITY_CHANGE",
  "ENVIRONMENT_EVENT",
  "LISTING_LOCATION_CONFLICT",
  "SOURCE_CONFLICT",
  "VERIFICATION_CHANGE",
  "PROVIDER_STALENESS",
]);
const SEVERITIES = Object.freeze(["low", "medium", "high"]);
const LOCATION_FACTS = new Set(["areaLabel", "locationState"]);
const THRESHOLDS = Object.freeze({
  floodRiskMinDelta: 0.2,
  trafficMinDelayMin: 20,
  trafficMinDeltaMin: 15,
  amenityMinAbsDelta: 2,
  staleAfterMs: DEFAULT_STALE_AFTER_MS,
});
const CONFIDENCE_BY_CLASS = Object.freeze({
  VERIFIED: 0.9,
  OBSERVED: 0.8,
  DERIVED: 0.7,
  ESTIMATED: 0.55,
});

function anomaliesEnabled(env) {
  const source = env && typeof env === "object" ? env : {};
  const raw = source[ANOMALY_FLAG];
  if (typeof raw !== "string") return false;
  return ["1", "true", "on", "yes"].includes(raw.trim().toLowerCase());
}

function round3(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.round(value * 1000) / 1000;
}

function flagOff() {
  return {
    ok: true,
    code: "flag_off",
    anomalies: [],
    skipped: [],
    alerts: [],
    explanation: null,
    decidedBy: "rule",
  };
}

function emptyResult(code, began, skipped, now) {
  return {
    ok: true,
    code,
    historyBeganAt: began,
    anomalies: [],
    skipped,
    alerts: [],
    explanation: null,
    decidedBy: "rule",
    provenance: {
      source: "lodgist-anomaly",
      historyBeganAt: began,
      observedAt: null,
      retrievedAt: now,
    },
  };
}

function baselineFacts(monitor) {
  const baseline = monitor && monitor.baseline;
  if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) return {};
  if (baseline.facts && typeof baseline.facts === "object" && !Array.isArray(baseline.facts)) {
    return baseline.facts;
  }
  if (typeof baseline.fact === "string" && Object.prototype.hasOwnProperty.call(baseline, "value")) {
    return { [baseline.fact]: baseline.value };
  }
  return {};
}

function factOf(event, monitor) {
  if (event && typeof event.fact === "string" && event.fact) return event.fact;
  if (monitor && typeof monitor.observationType === "string" && monitor.observationType) {
    return monitor.observationType;
  }
  return null;
}

function publicValue(value) {
  const stripped = stripPrivateLocationKeys(value);
  if (!stripped || typeof stripped !== "object" || Array.isArray(stripped)) return stripped;
  const out = {};
  Object.keys(stripped).sort().forEach((key) => {
    if (["lat", "lng", "lon", "coordinates", "bbox"].includes(key)) return;
    out[key] = publicValue(stripped[key]);
  });
  return out;
}

function locationLabel(value) {
  const stripped = publicValue(value);
  if (typeof stripped === "string" && stripped) return stripped;
  if (!stripped || typeof stripped !== "object") return null;
  if (typeof stripped.areaLabel === "string" && stripped.areaLabel) return stripped.areaLabel;
  if (typeof stripped.locationState === "string" && stripped.locationState) return stripped.locationState;
  return null;
}

function factNumber(value, fact) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const stripped = publicValue(value);
  if (!stripped || typeof stripped !== "object") return null;
  if (fact === "amenityCount" && typeof stripped.count === "number" && Number.isFinite(stripped.count)) {
    return stripped.count;
  }
  if (typeof stripped[fact] === "number" && Number.isFinite(stripped[fact])) return stripped[fact];
  return null;
}

function factString(value, fact) {
  if (typeof value === "string" && value) return value;
  const stripped = publicValue(value);
  if (!stripped || typeof stripped !== "object") return null;
  if (typeof stripped[fact] === "string" && stripped[fact]) return stripped[fact];
  if (fact === "environmentEvent" && typeof stripped.event === "string" && stripped.event) return stripped.event;
  return null;
}

function familiesOf(input) {
  if (!Array.isArray(input.families) || !input.families.length) return ANOMALY_FAMILIES.slice();
  return ANOMALY_FAMILIES.filter((family) => input.families.includes(family));
}

function normalizeEvents(input, ctx, now) {
  const history = getSpatialHistory({
    monitor: input.monitor,
    observations: input.observations,
    snapshots: input.snapshots,
    from: finiteTimestamp(input.monitor && input.monitor.monitoringBeganAt),
    to: now,
  }, {
    env: Object.assign({}, ctx.env, { SPATIAL_HISTORY: "1" }),
    authorized: ctx.authorized,
    authorization: ctx.authorization,
  });
  const events = (history.events || []).map((event) => {
    const fact = factOf(event, input.monitor);
    const envelope = evidenceEnvelope({
      value: publicValue(event.value),
      source: event.source,
      provider: event.provider,
      observedAt: event.observedAt,
      retrievedAt: event.retrievedAt,
      confidence: event.confidence,
      classification: event.classification,
      attribution: event.attribution,
      license: event.license,
      coverage: event.coverage,
    }, { now, staleAfterMs: THRESHOLDS.staleAfterMs });
    return Object.assign({}, envelope, {
      id: event.id,
      fact,
      subjectId: event.subjectId || (input.monitor && input.monitor.target && input.monitor.target.listingId != null
        ? `listing:${input.monitor.target.listingId}`
        : "monitor"),
      provenance: event.provenance || null,
    });
  }).filter((event) => event.observedAt != null && event.observedAt <= now);
  events.sort((left, right) => {
    if (left.observedAt !== right.observedAt) return left.observedAt - right.observedAt;
    const lp = left.provider || "";
    const rp = right.provider || "";
    if (lp < rp) return -1;
    if (lp > rp) return 1;
    const li = left.id || "";
    const ri = right.id || "";
    if (li < ri) return -1;
    if (li > ri) return 1;
    return 0;
  });
  return { history, events };
}

function confidenceFor(event, options = {}) {
  if (!event) return null;
  const base = CONFIDENCE_BY_CLASS[event.classification];
  if (base == null) return null;
  if (event.observedAt == null || event.freshness === "unknown") return null;
  let score = base;
  if (event.freshness === "stale" || options.stale) score = Math.min(score, 0.5);
  if (typeof event.confidence === "number") score = Math.min(score, event.confidence);
  return round3(score);
}

function usable(event) {
  return Boolean(event && event.freshness !== "unknown" && event.observedAt != null && event.value != null);
}

function latestFor(events, fact) {
  const rows = events.filter((event) => event.fact === fact && usable(event));
  return rows.length ? rows[rows.length - 1] : null;
}

function median(values) {
  const sorted = values.slice().sort((left, right) => left - right);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function series(events, fact) {
  return events.filter((event) => event.fact === fact && usable(event)).map((event) => ({
    event,
    n: factNumber(event.value, fact),
  })).filter((row) => row.n != null);
}

function anomalyFrom(family, severity, event, extras) {
  const confidence = extras.confidence == null ? confidenceFor(event, extras) : extras.confidence;
  if (!SEVERITIES.includes(severity) || confidence == null) return null;
  const ids = (extras.observationIds || [event.id]).filter((id) => typeof id === "string" && id);
  ids.sort();
  return {
    family,
    severity,
    confidence,
    reason: extras.reason,
    observationIds: ids,
    rule: extras.rule,
    provider: extras.provider || event.provider || null,
    triggeredAt: extras.triggeredAt || event.observedAt,
    evidence: evidenceEnvelope(event, { now: extras.now, staleAfterMs: THRESHOLDS.staleAfterMs }),
    provenance: {
      source: event.source || null,
      provider: event.provider || null,
      observedAt: event.observedAt,
      retrievedAt: event.retrievedAt,
      freshness: event.freshness,
      classification: event.classification,
      attribution: event.attribution || null,
      license: event.license || null,
      historyBeganAt: extras.historyBeganAt,
      rule: extras.rule.name,
    },
    explanation: null,
  };
}

function skip(family, code, reason) {
  return { family, code, reason };
}

function enumRule(family, events, facts, fact, allowed, severityFor, ruleName) {
  if (!Object.prototype.hasOwnProperty.call(facts, fact)) {
    return { anomaly: null, skip: skip(family, "insufficient_evidence", "no_baseline") };
  }
  const latest = latestFor(events, fact);
  if (!latest) return { anomaly: null, skip: skip(family, "insufficient_evidence", "no_observation") };
  const value = factString(latest.value, fact);
  if (!value || !allowed.includes(value)) {
    return { anomaly: null, skip: skip(family, "insufficient_evidence", "unreadable_value") };
  }
  const compared = evaluateConditions({ value: facts[fact] }, value, [{ op: "neq" }])[0];
  if (compared.reason === "no_baseline") {
    return { anomaly: null, skip: skip(family, "insufficient_evidence", "no_baseline") };
  }
  if (!compared.met) return { anomaly: null, skip: skip(family, "unchanged", "unchanged") };
  const confidence = confidenceFor(latest);
  if (confidence == null) return { anomaly: null, skip: skip(family, "insufficient_evidence", "unknown_confidence") };
  return {
    anomaly: anomalyFrom(family, severityFor(facts[fact], value), latest, {
      confidence,
      reason: `${fact} changed from ${facts[fact]} to ${value}`,
      rule: { name: ruleName, threshold: { op: "neq", allowed } },
      observationIds: [latest.id],
    }),
    skip: null,
  };
}

function numericRule(family, events, facts, fact, predicate, rule) {
  if (!Object.prototype.hasOwnProperty.call(facts, fact) || typeof facts[fact] !== "number") {
    return { anomaly: null, skip: skip(family, "insufficient_evidence", "no_baseline") };
  }
  const points = series(events, fact);
  if (!points.length) return { anomaly: null, skip: skip(family, "insufficient_evidence", "no_observation") };
  const latest = points[points.length - 1];
  const compared = evaluateConditions({ value: facts[fact] }, latest.n, [{ op: "neq" }])[0];
  if (compared.reason === "not_numeric" || compared.reason === "no_baseline") {
    return { anomaly: null, skip: skip(family, "insufficient_evidence", compared.reason) };
  }
  const prior = points.slice(0, -1).map((row) => row.n);
  const med = prior.length ? median(prior) : null;
  const delta = round3(latest.n - facts[fact]);
  const residual = med == null ? null : round3(latest.n - med);
  const decision = predicate({
    baseline: facts[fact],
    latest: latest.n,
    delta,
    residual,
    changed: compared.met,
  });
  if (!decision.met) return { anomaly: null, skip: skip(family, "unchanged", "within_threshold") };
  const confidence = confidenceFor(latest.event);
  if (confidence == null) return { anomaly: null, skip: skip(family, "insufficient_evidence", "unknown_confidence") };
  const ids = [latest.event.id];
  if (decision.method === "median_residual") {
    points.slice(0, -1).forEach((row) => { if (row.event.id) ids.push(row.event.id); });
  }
  return {
    anomaly: anomalyFrom(family, decision.severity, latest.event, {
      confidence,
      reason: decision.reason,
      observationIds: ids,
      rule: {
        name: rule.name,
        threshold: rule.threshold,
        statistic: {
          method: decision.method,
          baseline: facts[fact],
          latest: round3(latest.n),
          delta,
          median: med == null ? null : round3(med),
          residual,
        },
      },
    }),
    skip: null,
  };
}

function environmentRule(events, facts) {
  const family = "ENVIRONMENT_EVENT";
  if (!Object.prototype.hasOwnProperty.call(facts, "environmentEvent")) {
    return { anomaly: null, skip: skip(family, "insufficient_evidence", "no_baseline") };
  }
  const latest = latestFor(events, "environmentEvent");
  if (!latest) return { anomaly: null, skip: skip(family, "insufficient_evidence", "no_observation") };
  const value = factString(latest.value, "environmentEvent");
  if (!value) return { anomaly: null, skip: skip(family, "insufficient_evidence", "no_event") };
  const baseline = facts.environmentEvent == null ? null : String(facts.environmentEvent);
  if (baseline === value) return { anomaly: null, skip: skip(family, "unchanged", "unchanged") };
  const confidence = confidenceFor(latest);
  if (confidence == null) return { anomaly: null, skip: skip(family, "insufficient_evidence", "unknown_confidence") };
  const severity = value.toLowerCase().includes("flood") ? "high" : "medium";
  return {
    anomaly: anomalyFrom(family, severity, latest, {
      confidence,
      reason: baseline
        ? `environment event changed from ${baseline} to ${value}`
        : `environment event ${value} is present`,
      rule: { name: "environment_event_present", threshold: { requiresEvent: true } },
      observationIds: [latest.id],
    }),
    skip: null,
  };
}

function comparableFactValue(event) {
  if (LOCATION_FACTS.has(event.fact)) return locationLabel(event.value);
  const number = factNumber(event.value, event.fact);
  if (number != null && (event.fact === "amenityCount" || event.fact === "floodRisk" || event.fact === "trafficDelayMin")) {
    return number;
  }
  const text = factString(event.value, event.fact);
  if (text) return text;
  return publicValue(event.value);
}

function conflictReport(events) {
  const byProvider = new Map();
  events.filter(usable).forEach((event) => {
    const provider = event.provider || "unknown";
    const fact = event.fact;
    if (!fact) return;
    const value = comparableFactValue(event);
    if (value == null) return;
    const rows = byProvider.get(provider) || [];
    rows.push({
      provider,
      subjectId: event.subjectId,
      fact,
      value,
      observedAt: event.observedAt,
      retrievedAt: event.retrievedAt,
      source: event.source,
      license: event.license,
      classification: event.classification,
      confidence: event.confidence,
      observationId: event.id,
    });
    byProvider.set(provider, rows);
  });
  const providers = Array.from(byProvider.keys()).sort().map((id) => ({ id, observations: byProvider.get(id) }));
  if (providers.length < 2) return { conflicts: [], insufficient: true };
  try {
    const report = crossReference({ providers, now: events[events.length - 1].observedAt });
    return { conflicts: report.conflicts || [], insufficient: false };
  } catch {
    return { conflicts: [], insufficient: true };
  }
}

function conflictAnomalies(family, conflicts, events, began) {
  const rows = conflicts.filter((conflict) => {
    const location = LOCATION_FACTS.has(conflict.fact);
    if (family === "LISTING_LOCATION_CONFLICT") return location;
    return !location;
  });
  const anomalies = [];
  const seen = new Set();
  rows.forEach((conflict) => {
    const providers = Array.from(new Set(conflict.values.map((item) => item.provider).filter(Boolean))).sort();
    if (providers.length < 2) return;
    const matched = events.filter((event) => event.fact === conflict.fact && providers.includes(event.provider) && usable(event));
    const ids = matched.map((event) => event.id).filter(Boolean);
    const key = `${family}\0${conflict.fact}\0${ids.slice().sort().join(",")}`;
    if (seen.has(key)) return;
    seen.add(key);
    const anchor = matched[matched.length - 1] || events[events.length - 1];
    const confidence = confidenceFor(anchor);
    if (confidence == null || !anchor) return;
    const rendered = conflict.values.map((item) => `${item.provider}=${JSON.stringify(item.value)}`).sort();
    const built = anomalyFrom(family, "high", anchor, {
      confidence,
      historyBeganAt: began,
      provider: providers.join(","),
      reason: `${conflict.fact} conflicts across ${providers.join(", ")}: ${rendered.join("; ")}`,
      observationIds: ids,
      rule: {
        name: family === "LISTING_LOCATION_CONFLICT" ? "listing_location_conflict" : "source_value_conflict",
        threshold: { minProviders: 2, fact: conflict.fact },
      },
      triggeredAt: anchor.observedAt,
    });
    if (built) anomalies.push(built);
  });
  return anomalies;
}

function staleness(events) {
  const family = "PROVIDER_STALENESS";
  const byProvider = new Map();
  events.forEach((event) => {
    if (!event.provider || event.observedAt == null) return;
    const current = byProvider.get(event.provider);
    if (!current || event.observedAt > current.observedAt) byProvider.set(event.provider, event);
  });
  if (!byProvider.size) return { anomalies: [], skip: skip(family, "insufficient_evidence", "no_observation") };
  const anomalies = [];
  const staleProviders = Array.from(byProvider.keys()).sort();
  staleProviders.forEach((provider) => {
    const event = byProvider.get(provider);
    if (event.freshness === "unknown") return;
    if (event.freshness !== "stale") return;
    const confidence = confidenceFor(event, { stale: true });
    if (confidence == null) return;
    const built = anomalyFrom(family, "medium", event, {
      confidence,
      provider,
      reason: `${provider} observation at ${event.observedAt} is older than ${THRESHOLDS.staleAfterMs}ms`,
      observationIds: [event.id],
      rule: { name: "provider_stale", threshold: { staleAfterMs: THRESHOLDS.staleAfterMs } },
    });
    if (built) anomalies.push(built);
  });
  if (!anomalies.length) {
    const unknown = staleProviders.every((provider) => byProvider.get(provider).freshness === "unknown");
    const staleWithoutConfidence = staleProviders.some((provider) => byProvider.get(provider).freshness === "stale");
    if (unknown) return { anomalies: [], skip: skip(family, "insufficient_evidence", "unknown_freshness") };
    if (staleWithoutConfidence) return { anomalies: [], skip: skip(family, "insufficient_evidence", "unknown_confidence") };
    return { anomalies: [], skip: skip(family, "unchanged", "fresh") };
  }
  return { anomalies, skip: null };
}

function evaluateFamily(family, events, facts, conflictState) {
  if (family === "ACCESS_CHANGE") {
    return enumRule(family, events, facts, "access", ["open", "restricted", "closed"], (from, to) => (
      to === "closed" || from === "closed" ? "high" : "medium"
    ), "access_state_changed");
  }
  if (family === "FLOOD_RISK_CHANGE") {
    return numericRule(family, events, facts, "floodRisk", (stat) => {
      const hit = stat.changed && (Math.abs(stat.delta) >= THRESHOLDS.floodRiskMinDelta
        || (stat.residual != null && Math.abs(stat.residual) >= THRESHOLDS.floodRiskMinDelta));
      const method = stat.residual != null && Math.abs(stat.residual) >= THRESHOLDS.floodRiskMinDelta
        ? "median_residual"
        : "baseline_delta";
      return {
        met: hit,
        method,
        severity: Math.abs(stat.delta) >= 0.5 || (stat.residual != null && Math.abs(stat.residual) >= 0.5) ? "high" : "medium",
        reason: `floodRisk delta ${stat.delta} against baseline ${stat.baseline} (median residual ${stat.residual}) exceeds ${THRESHOLDS.floodRiskMinDelta}`,
      };
    }, { name: "flood_risk_delta", threshold: { minAbsDelta: THRESHOLDS.floodRiskMinDelta } });
  }
  if (family === "TRAFFIC_DISRUPTION") {
    return numericRule(family, events, facts, "trafficDelayMin", (stat) => {
      const delay = stat.latest >= THRESHOLDS.trafficMinDelayMin;
      const deltaHit = stat.changed && Math.abs(stat.delta) >= THRESHOLDS.trafficMinDeltaMin;
      const residualHit = stat.residual != null && Math.abs(stat.residual) >= THRESHOLDS.trafficMinDeltaMin;
      return {
        met: delay && (deltaHit || residualHit),
        method: residualHit ? "median_residual" : "baseline_delta",
        severity: stat.latest >= 45 || Math.abs(stat.delta) >= 30 ? "high" : "medium",
        reason: `traffic delay ${stat.latest}min is at least ${THRESHOLDS.trafficMinDelayMin}min and moved ${stat.delta} from baseline ${stat.baseline}`,
      };
    }, {
      name: "traffic_delay_delta",
      threshold: { minDelayMin: THRESHOLDS.trafficMinDelayMin, minAbsDelta: THRESHOLDS.trafficMinDeltaMin },
    });
  }
  if (family === "TRANSIT_CHANGE") {
    return enumRule(family, events, facts, "transitStatus", ["normal", "reduced", "suspended"], (from, to) => (
      to === "suspended" || from === "suspended" ? "high" : "medium"
    ), "transit_status_changed");
  }
  if (family === "AMENITY_CHANGE") {
    return numericRule(family, events, facts, "amenityCount", (stat) => {
      const hit = stat.changed && (Math.abs(stat.delta) >= THRESHOLDS.amenityMinAbsDelta
        || (stat.residual != null && Math.abs(stat.residual) >= THRESHOLDS.amenityMinAbsDelta));
      return {
        met: hit,
        method: stat.residual != null && Math.abs(stat.residual) >= THRESHOLDS.amenityMinAbsDelta ? "median_residual" : "baseline_delta",
        severity: Math.abs(stat.delta) >= 5 ? "high" : "medium",
        reason: `amenityCount delta ${stat.delta} from baseline ${stat.baseline} exceeds ${THRESHOLDS.amenityMinAbsDelta}`,
      };
    }, { name: "amenity_count_delta", threshold: { minAbsDelta: THRESHOLDS.amenityMinAbsDelta } });
  }
  if (family === "ENVIRONMENT_EVENT") return environmentRule(events, facts);
  if (family === "VERIFICATION_CHANGE") {
    return enumRule(family, events, facts, "verification", ["verified", "unverified", "pending", "rejected"], (from, to) => (
      to === "rejected" || from === "verified" ? "high" : "medium"
    ), "verification_state_changed");
  }
  if (family === "LISTING_LOCATION_CONFLICT" || family === "SOURCE_CONFLICT") {
    if (conflictState.insufficient) {
      return { anomaly: null, anomalies: [], skip: skip(family, "insufficient_evidence", "need_two_providers") };
    }
    const anomalies = conflictAnomalies(family, conflictState.conflicts, events);
    if (!anomalies.length) return { anomaly: null, anomalies: [], skip: skip(family, "unchanged", "no_conflict") };
    return { anomaly: null, anomalies, skip: null };
  }
  if (family === "PROVIDER_STALENESS") {
    const found = staleness(events);
    return { anomaly: null, anomalies: found.anomalies, skip: found.skip };
  }
  return { anomaly: null, skip: skip(family, "insufficient_evidence", "unknown_family") };
}

function sortAnomalies(anomalies) {
  return anomalies.slice().sort((left, right) => {
    if (left.family < right.family) return -1;
    if (left.family > right.family) return 1;
    const lp = left.provider || "";
    const rp = right.provider || "";
    if (lp < rp) return -1;
    if (lp > rp) return 1;
    if (left.triggeredAt !== right.triggeredAt) return left.triggeredAt - right.triggeredAt;
    const li = left.observationIds.join(",");
    const ri = right.observationIds.join(",");
    if (li < ri) return -1;
    if (li > ri) return 1;
    return 0;
  });
}

function explanationText(produced) {
  if (typeof produced === "string") return produced;
  if (produced && typeof produced.explanation === "string") return produced.explanation;
  return null;
}

function attachAnomalyExplanation(result, produced) {
  const source = result && typeof result === "object" ? result : emptyResult("insufficient_evidence", null, [], null);
  const locked = (source.anomalies || []).map((anomaly) => ({
    family: anomaly.family,
    severity: anomaly.severity,
    confidence: anomaly.confidence,
    reason: anomaly.reason,
    observationIds: anomaly.observationIds.slice(),
    provider: anomaly.provider,
    triggeredAt: anomaly.triggeredAt,
    rule: anomaly.rule,
  }));
  const explanation = locked.length ? explanationText(produced) : null;
  const anomalies = (source.anomalies || []).map((anomaly, index) => Object.assign({}, anomaly, {
    family: locked[index].family,
    severity: locked[index].severity,
    confidence: locked[index].confidence,
    reason: locked[index].reason,
    observationIds: locked[index].observationIds,
    provider: locked[index].provider,
    triggeredAt: locked[index].triggeredAt,
    rule: locked[index].rule,
    explanation,
  }));
  return Object.assign({}, source, {
    anomalies,
    explanation,
    alerts: [],
    decidedBy: "rule",
  });
}

function evaluateAnomalies(input = {}, ctx = {}) {
  if (!anomaliesEnabled(ctx.env)) return flagOff();
  const now = finiteTimestamp(input.now);
  const began = finiteTimestamp(input.monitor && input.monitor.monitoringBeganAt);
  const families = familiesOf(input);
  if (!began || now == null || now < began) {
    return emptyResult("history_unavailable_before", began, families.map((family) => skip(family, "insufficient_evidence", "before_monitoring_began")), now);
  }
  const { history, events } = normalizeEvents(input, ctx, now);
  if (history.code === "history_unavailable_before") {
    return emptyResult("history_unavailable_before", began, families.map((family) => skip(family, "insufficient_evidence", "before_monitoring_began")), now);
  }
  const facts = baselineFacts(input.monitor);
  const wantsConflict = families.includes("LISTING_LOCATION_CONFLICT") || families.includes("SOURCE_CONFLICT");
  const conflictState = wantsConflict ? conflictReport(events) : { conflicts: [], insufficient: false };
  const anomalies = [];
  const skipped = [];
  families.forEach((family) => {
    const found = evaluateFamily(family, events, facts, conflictState);
    const rows = found.anomalies || (found.anomaly ? [found.anomaly] : []);
    rows.forEach((row) => {
      if (!row) return;
      row.provenance.historyBeganAt = began;
      row.evidence = evidenceEnvelope(row.evidence, { now, staleAfterMs: THRESHOLDS.staleAfterMs });
      anomalies.push(row);
    });
    if (!rows.length && found.skip) skipped.push(found.skip);
  });
  skipped.sort((left, right) => (left.family < right.family ? -1 : left.family > right.family ? 1 : 0));
  const code = anomalies.length
    ? "ok"
    : skipped.every((item) => item.code === "insufficient_evidence")
      ? "insufficient_evidence"
      : "ok";
  let result = {
    ok: true,
    code,
    historyBeganAt: began,
    anomalies: sortAnomalies(anomalies),
    skipped,
    alerts: [],
    explanation: null,
    decidedBy: "rule",
    provenance: {
      source: "lodgist-anomaly",
      historyBeganAt: began,
      observedAt: null,
      retrievedAt: now,
    },
  };
  if (typeof ctx.explain === "function" && result.anomalies.length) {
    let produced = null;
    try {
      produced = ctx.explain({
        decidedBy: "rule",
        anomalies: result.anomalies.map((anomaly) => ({
          family: anomaly.family,
          severity: anomaly.severity,
          confidence: anomaly.confidence,
          reason: anomaly.reason,
        })),
      });
    } catch {
      produced = null;
    }
    if (produced && typeof produced.then === "function") produced = null;
    result = attachAnomalyExplanation(result, produced);
  }
  return assertNoPrivateLocationKeys(stripPrivateLocationKeys(result));
}

module.exports = {
  ANOMALY_FLAG,
  ANOMALY_FAMILIES,
  THRESHOLDS,
  anomaliesEnabled,
  evaluateAnomalies,
  attachAnomalyExplanation,
};
