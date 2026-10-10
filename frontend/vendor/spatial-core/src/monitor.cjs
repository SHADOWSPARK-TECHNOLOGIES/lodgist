/**
 * Spatial monitoring schedule and condition checks.
 * Observations and alerts are added by later functions in this module.
 * Rate limits come from the provider registry. freshnessPolicy.minIntervalMs
 * is an extra floor. staleAfterMs marks evidence stale and is not a poll floor:
 * Overpass data is allowed to be a week old, and using that as the minimum
 * schedule would block monitoring.
 */
const { providerRegistry, providerCanRun } = require("./registry.cjs");
const { evidenceEnvelope, finiteTimestamp, ENVELOPE_KEYS } = require("./evidence.cjs");
const { assertNoPrivateLocationKeys, stripPrivateLocationKeys } = require("./privacy.cjs");
const { crossReference } = require("./crossReference.cjs");

const TARGET_TYPES = Object.freeze([
  "location",
  "listing",
  "neighborhood",
  "provider",
  "layer",
  "event",
]);
const CONDITION_OPS = Object.freeze(["eq", "neq", "gt", "gte", "lt", "lte", "changed"]);
const PRIVACY_GATES = Object.freeze(["PUBLIC_EXACT", "AUTHORIZED_EXACT", "APPROXIMATE", "HIDDEN"]);
const MONITORING_FLAG = "SPATIAL_MONITORING";

function monitoringEnabled(env) {
  const source = env && typeof env === "object" ? env : {};
  const raw = source[MONITORING_FLAG];
  if (typeof raw !== "string") return false;
  return ["1", "true", "on", "yes"].includes(raw.trim().toLowerCase());
}

function minimumScheduleMs(row) {
  if (!row || typeof row !== "object") return null;
  const rate = row.rateLimits || {};
  const fresh = row.freshnessPolicy || {};
  const floors = [];
  if (typeof rate.minIntervalMs === "number" && rate.minIntervalMs > 0) floors.push(rate.minIntervalMs);
  if (typeof rate.perMinuteDefault === "number" && rate.perMinuteDefault > 0) {
    floors.push(Math.ceil(60000 / rate.perMinuteDefault));
  }
  if (typeof fresh.minIntervalMs === "number" && fresh.minIntervalMs > 0) floors.push(fresh.minIntervalMs);
  if (!floors.length) return null;
  return Math.max(...floors);
}

function assertSchedule(monitor, registry) {
  const interval = monitor && monitor.schedule ? monitor.schedule.intervalMs : null;
  if (!Number.isInteger(interval) || interval <= 0) {
    return { ok: false, code: "invalid_schedule" };
  }
  const providers = monitor && Array.isArray(monitor.providers) ? monitor.providers : [];
  if (!providers.length) return { ok: false, code: "missing_provider" };
  const rows = providerRegistry(registry);
  let minimum = 0;
  for (const id of providers) {
    const row = rows.find((item) => item.id === id);
    if (!row) return { ok: false, code: "unknown_provider", provider: id };
    const floor = minimumScheduleMs(row);
    if (floor == null) {
      return { ok: false, code: "schedule_too_fast", provider: id, reason: "no_rate_limit" };
    }
    if (interval < floor) {
      return { ok: false, code: "schedule_too_fast", provider: id, minimumIntervalMs: floor };
    }
    if (floor > minimum) minimum = floor;
  }
  return { ok: true, code: "ok", minimumIntervalMs: minimum };
}

function baselineValue(baseline) {
  if (!baseline || typeof baseline !== "object") return { present: false, value: null };
  if (!Object.prototype.hasOwnProperty.call(baseline, "value") || baseline.value == null) {
    return { present: false, value: null };
  }
  return { present: true, value: baseline.value };
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function evaluateConditions(baseline, value, conditions) {
  const rules = Array.isArray(conditions) ? conditions : [];
  const base = baselineValue(baseline);
  return rules.map((rule, index) => {
    const op = rule && typeof rule.op === "string" ? rule.op : null;
    if (!CONDITION_OPS.includes(op)) {
      return { index, op, met: false, reason: "invalid_condition" };
    }
    if (!base.present) return { index, op, met: false, reason: "no_baseline" };
    if (op === "eq" || op === "neq" || op === "changed") {
      const same = sameJson(value, base.value);
      const met = op === "eq" ? same : !same;
      return { index, op, met, reason: "compared" };
    }
    if (typeof value !== "number" || typeof base.value !== "number") {
      return { index, op, met: false, reason: "not_numeric" };
    }
    let met = false;
    if (op === "gt") met = value > base.value;
    if (op === "gte") met = value >= base.value;
    if (op === "lt") met = value < base.value;
    if (op === "lte") met = value <= base.value;
    return { index, op, met, reason: "compared" };
  });
}

function beginMonitor(input, now) {
  const started = finiteTimestamp(now);
  if (!started) return { ok: false, code: "missing_start" };
  const body = input && typeof input === "object" ? input : {};
  if (!TARGET_TYPES.includes(body.targetType)) return { ok: false, code: "invalid_target" };
  if (body.lastObservedAt != null) return { ok: false, code: "fabricated_history" };
  if (Array.isArray(body.observations) && body.observations.length) {
    return { ok: false, code: "fabricated_history" };
  }
  const declared = finiteTimestamp(body.monitoringBeganAt);
  if (body.monitoringBeganAt != null && declared == null) return { ok: false, code: "invalid_start" };
  if (declared != null && declared > started) return { ok: false, code: "invalid_start" };
  const schedule = assertSchedule(body, body.registry);
  if (!schedule.ok) return schedule;
  return {
    ok: true,
    monitor: {
      id: typeof body.id === "string" && body.id ? body.id : null,
      target: body.target && typeof body.target === "object" ? body.target : {},
      targetType: body.targetType,
      providers: body.providers.slice(),
      observationType: typeof body.observationType === "string" ? body.observationType : "value",
      baseline: body.baseline == null ? null : body.baseline,
      conditions: Array.isArray(body.conditions) ? body.conditions : [],
      schedule: { intervalMs: body.schedule.intervalMs },
      lastObservedAt: null,
      state: "idle",
      provenance: null,
      monitoringBeganAt: declared || started,
    },
  };
}

function privacyFor(monitor, ctx) {
  const requested = ctx && PRIVACY_GATES.includes(ctx.authorization) ? ctx.authorization : "APPROXIMATE";
  if (monitor.targetType !== "listing" && monitor.targetType !== "location") return requested;
  if (requested === "AUTHORIZED_EXACT" && ctx && ctx.authorized === true) return "AUTHORIZED_EXACT";
  if (requested === "PUBLIC_EXACT" && ctx && ctx.authorized === true && ctx.listing && ctx.listing.publicExact === true) {
    return "PUBLIC_EXACT";
  }
  if (monitor.targetType === "listing" && (!ctx || !ctx.listing || ctx.listing.public !== true)) return "HIDDEN";
  if (requested === "HIDDEN") return "HIDDEN";
  return "APPROXIMATE";
}

function publishedArea(ctx) {
  const approx = ctx && ctx.listing && ctx.listing.approxLocation;
  if (!approx || typeof approx.lat !== "number" || typeof approx.lng !== "number") return null;
  const radius = approx.radius_m != null ? approx.radius_m : approx.radiusM;
  return { lat: approx.lat, lng: approx.lng, radius_m: typeof radius === "number" ? radius : null };
}

function privatizeValue(value, gate, area) {
  if (gate === "AUTHORIZED_EXACT" || gate === "PUBLIC_EXACT") return value;
  if (gate === "HIDDEN") return { privacy: "HIDDEN", area: null };
  if (value == null || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.assign({}, stripPrivateLocationKeys(value), { area, privacy: "APPROXIMATE" });
}

function readingFor(ctx, providerId) {
  const rows = ctx && Array.isArray(ctx.readings) ? ctx.readings : [];
  return rows.find((row) => row && row.provider === providerId) || null;
}

function envelopeFor(reading, providerId, now, staleAfterMs) {
  const source = reading || {};
  return evidenceEnvelope({
    value: source.value === undefined ? null : source.value,
    source: source.source,
    provider: providerId,
    observedAt: source.observedAt,
    retrievedAt: now,
    confidence: source.confidence,
    classification: source.classification || (source.value == null ? "UNKNOWN" : "OBSERVED"),
    attribution: source.attribution,
    license: source.license,
    coverage: source.coverage,
  }, { now, staleAfterMs });
}

function emptyEnvelope(providerId, now, staleAfterMs) {
  return envelopeFor({ value: null, classification: "UNKNOWN" }, providerId, now, staleAfterMs);
}

function runMonitor(monitor, now, ctx = {}) {
  if (!monitoringEnabled(ctx.env)) {
    return { ok: true, code: "flag_off", observations: [], evaluated: [], report: null, ignored: [] };
  }
  const clock = finiteTimestamp(now);
  if (!clock) return { ok: false, code: "invalid_now", observations: [] };
  const schedule = assertSchedule(monitor, ctx.registry);
  if (!schedule.ok) return Object.assign({ observations: [], evaluated: [], report: null }, schedule);
  const began = finiteTimestamp(monitor.monitoringBeganAt);
  if (!began) return { ok: false, code: "missing_start", observations: [] };
  if (clock < began) return { ok: false, code: "before_start", observations: [] };
  const last = finiteTimestamp(monitor.lastObservedAt);
  if (last != null && clock < last + monitor.schedule.intervalMs) {
    return { ok: true, code: "not_due", observations: [], evaluated: [], report: null, ignored: [] };
  }
  const rows = providerRegistry(ctx.registry);
  const gate = privacyFor(monitor, ctx);
  const area = publishedArea(ctx);
  const observations = [];
  const providerResults = [];
  const ignored = [];
  for (const providerId of monitor.providers) {
    const row = rows.find((item) => item.id === providerId) || null;
    const staleAfterMs = row && row.freshnessPolicy ? row.freshnessPolicy.staleAfterMs : undefined;
    const decision = providerCanRun(providerId, {
      registry: ctx.registry,
      env: ctx.env,
      production: ctx.production,
    });
    if (!decision.ok) {
      const envelope = emptyEnvelope(providerId, clock, staleAfterMs);
      observations.push(gate === "AUTHORIZED_EXACT" ? envelope : assertNoPrivateLocationKeys(stripPrivateLocationKeys(envelope)));
      providerResults.push({ provider: providerId, code: decision.code });
      continue;
    }
    const reading = readingFor(ctx, providerId);
    if (!reading) {
      observations.push(emptyEnvelope(providerId, clock, staleAfterMs));
      providerResults.push({ provider: providerId, code: "no_reading" });
      continue;
    }
    const observedAt = finiteTimestamp(reading.observedAt);
    if (observedAt != null && observedAt < began) {
      ignored.push({ provider: providerId, reason: "before_monitoring_began" });
      providerResults.push({ provider: providerId, code: "before_monitoring_began" });
      continue;
    }
    const raw = envelopeFor(reading, providerId, clock, staleAfterMs);
    raw.value = privatizeValue(raw.value, gate, area);
    const safe = gate === "AUTHORIZED_EXACT" || gate === "PUBLIC_EXACT"
      ? raw
      : assertNoPrivateLocationKeys(stripPrivateLocationKeys(raw));
    observations.push(safe);
    providerResults.push({ provider: providerId, code: safe.freshness === "stale" ? "stale" : "ok" });
  }
  const evaluated = observations.map((item) => ({
    provider: item.provider,
    results: evaluateConditions(monitor.baseline, item.value, monitor.conditions),
  }));
  let report = null;
  if (monitor.targetType === "listing" && monitor.target && monitor.target.listingId != null) {
    report = crossReference({
      location: { listingId: monitor.target.listingId },
      subjects: [`listing:${monitor.target.listingId}`],
      providers: monitor.providers.map((id) => ({
        id,
        observations: observations.filter((item) => item.provider === id).map((item) => ({
          subjectId: `listing:${monitor.target.listingId}`,
          fact: monitor.observationType || "value",
          value: item.value,
          observedAt: item.observedAt,
          retrievedAt: item.retrievedAt,
          classification: item.classification,
          source: item.source,
          license: item.license,
          coverage: item.coverage,
        })),
      })),
      now: clock,
    });
  }
  const blocked = providerResults.some((item) => item.code === "missing_api_key" || item.code === "commercial_class_blocked");
  return {
    ok: true,
    code: "observed",
    observations,
    providerResults,
    evaluated,
    report,
    ignored,
    state: blocked ? "blocked" : "observed",
    lastObservedAt: clock,
    provenance: {
      monitoringBeganAt: began,
      source: "lodgist-monitor",
      retrievedAt: clock,
      observedAt: null,
      freshness: "unknown",
    },
    envelopeKeys: ENVELOPE_KEYS,
  };
}

module.exports = {
  TARGET_TYPES,
  CONDITION_OPS,
  PRIVACY_GATES,
  MONITORING_FLAG,
  monitoringEnabled,
  minimumScheduleMs,
  assertSchedule,
  evaluateConditions,
  beginMonitor,
  runMonitor,
};
