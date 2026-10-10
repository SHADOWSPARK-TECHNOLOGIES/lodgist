/**
 * Spatial monitoring schedule and condition checks.
 * Observations and alerts are added by later functions in this module.
 * Rate limits come from the provider registry. freshnessPolicy.minIntervalMs
 * is an extra floor. staleAfterMs marks evidence stale and is not a poll floor:
 * Overpass data is allowed to be a week old, and using that as the minimum
 * schedule would block monitoring.
 */
const { providerRegistry } = require("./registry.cjs");
const { finiteTimestamp } = require("./evidence.cjs");

const TARGET_TYPES = Object.freeze([
  "location",
  "listing",
  "neighborhood",
  "provider",
  "layer",
  "event",
]);
const CONDITION_OPS = Object.freeze(["eq", "neq", "gt", "gte", "lt", "lte", "changed"]);
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

module.exports = {
  TARGET_TYPES,
  CONDITION_OPS,
  MONITORING_FLAG,
  monitoringEnabled,
  minimumScheduleMs,
  assertSchedule,
  evaluateConditions,
  beginMonitor,
};
