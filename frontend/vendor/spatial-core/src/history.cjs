/**
 * Temporal spatial history over stored monitor observations and report
 * snapshots. Nothing is invented for the period before monitoringBeganAt.
 * SPATIAL_HISTORY defaults off.
 */
const { finiteTimestamp } = require("./evidence.cjs");
const { assertNoPrivateLocationKeys, stripPrivateLocationKeys } = require("./privacy.cjs");

const HISTORY_FLAG = "SPATIAL_HISTORY";

function historyEnabled(env) {
  const source = env && typeof env === "object" ? env : {};
  const raw = source[HISTORY_FLAG];
  if (typeof raw !== "string") return false;
  return ["1", "true", "on", "yes"].includes(raw.trim().toLowerCase());
}

function beganAt(monitor) {
  return finiteTimestamp(monitor && monitor.monitoringBeganAt);
}

function flagOff() {
  return {
    ok: true,
    code: "flag_off",
    historyBeganAt: null,
    events: [],
    snapshots: [],
    undated: [],
    changes: [],
    context: null,
  };
}

function unavailable(began) {
  return {
    ok: true,
    code: "history_unavailable_before",
    historyBeganAt: began,
    unavailableBefore: began,
    events: [],
    snapshots: [],
    undated: [],
    changes: [],
    context: null,
  };
}

function exactAllowed(ctx) {
  return Boolean(ctx && ctx.authorized === true && ctx.authorization === "AUTHORIZED_EXACT");
}

function redact(value, ctx) {
  if (exactAllowed(ctx)) return value;
  return assertNoPrivateLocationKeys(stripPrivateLocationKeys(value));
}

function envelopeOf(row) {
  if (!row || typeof row !== "object") return {};
  if (row.envelope && typeof row.envelope === "object") return row.envelope;
  return row;
}

function eventFrom(row, ctx) {
  const envelope = envelopeOf(row);
  const observedAt = finiteTimestamp(envelope.observedAt != null ? envelope.observedAt : row.observedAt);
  const retrievedAt = finiteTimestamp(envelope.retrievedAt != null ? envelope.retrievedAt : row.retrievedAt);
  const event = {
    id: typeof row.id === "string" ? row.id : null,
    observedAt,
    retrievedAt,
    value: redact(envelope.value === undefined ? null : envelope.value, ctx),
    source: typeof envelope.source === "string" ? envelope.source : null,
    provider: typeof envelope.provider === "string" ? envelope.provider : null,
    freshness: typeof envelope.freshness === "string" ? envelope.freshness : "unknown",
    confidence: typeof envelope.confidence === "number" ? envelope.confidence : null,
    classification: typeof envelope.classification === "string" ? envelope.classification : "UNKNOWN",
    attribution: typeof envelope.attribution === "string" ? envelope.attribution : null,
    license: typeof envelope.license === "string" ? envelope.license : null,
    coverage: typeof envelope.coverage === "string" ? envelope.coverage : null,
    subjectId: envelope.subjectId == null ? null : String(envelope.subjectId),
    fact: typeof envelope.fact === "string" ? envelope.fact : null,
    provenance: {
      source: typeof envelope.source === "string" ? envelope.source : null,
      provider: typeof envelope.provider === "string" ? envelope.provider : null,
      observedAt,
      retrievedAt,
      freshness: typeof envelope.freshness === "string" ? envelope.freshness : "unknown",
      classification: typeof envelope.classification === "string" ? envelope.classification : "UNKNOWN",
      attribution: typeof envelope.attribution === "string" ? envelope.attribution : null,
      license: typeof envelope.license === "string" ? envelope.license : null,
    },
  };
  return exactAllowed(ctx) ? event : assertNoPrivateLocationKeys(stripPrivateLocationKeys(event));
}

function snapshotFrom(row, ctx) {
  const capturedAt = finiteTimestamp(row && (row.capturedAt != null ? row.capturedAt : row.observedAt));
  const report = row && row.report ? row.report : null;
  return {
    id: row && typeof row.id === "string" ? row.id : null,
    capturedAt,
    report: redact(report, ctx),
    privacy: exactAllowed(ctx) ? "AUTHORIZED_EXACT" : "APPROXIMATE",
    provenance: {
      source: "lodgist-history",
      capturedAt,
      historyBeganAt: null,
      license: row && row.provenance && row.provenance.license ? row.provenance.license : null,
    },
  };
}

function byTime(left, right) {
  if (left.time !== right.time) return left.time - right.time;
  if (left.key < right.key) return -1;
  if (left.key > right.key) return 1;
  return 0;
}

function collect(input, ctx, began) {
  const rows = Array.isArray(input.observations) ? input.observations : [];
  const shots = Array.isArray(input.snapshots) ? input.snapshots : [];
  const dated = [];
  const undated = [];
  rows.forEach((row) => {
    const event = eventFrom(row, ctx);
    if (event.observedAt == null) {
      undated.push(event);
      return;
    }
    if (event.observedAt < began) return;
    dated.push(event);
  });
  const snapshots = [];
  shots.forEach((row) => {
    const snapshot = snapshotFrom(row, ctx);
    if (snapshot.capturedAt == null || snapshot.capturedAt < began) return;
    snapshot.provenance.historyBeganAt = began;
    snapshots.push(snapshot);
  });
  dated.sort((left, right) => byTime(
    { time: left.observedAt, key: `${left.provider || ""}\u0000${left.id || ""}` },
    { time: right.observedAt, key: `${right.provider || ""}\u0000${right.id || ""}` },
  ));
  snapshots.sort((left, right) => byTime(
    { time: left.capturedAt, key: left.id || "" },
    { time: right.capturedAt, key: right.id || "" },
  ));
  return { dated, undated, snapshots };
}

function inWindow(time, start, end) {
  if (time == null) return false;
  if (start != null && time < start) return false;
  if (end != null && time > end) return false;
  return true;
}

function getSpatialHistory(input = {}, ctx = {}) {
  if (!historyEnabled(ctx.env)) return flagOff();
  const began = beganAt(input.monitor);
  if (!began) return unavailable(null);
  const from = finiteTimestamp(input.from);
  const to = finiteTimestamp(input.to);
  if (to != null && to < began) return unavailable(began);
  if (from != null && to != null && to < from) {
    return { ok: false, code: "invalid_range", historyBeganAt: began, events: [], snapshots: [] };
  }
  const { dated, undated, snapshots } = collect(input, ctx, began);
  const start = from == null ? began : Math.max(from, began);
  const events = dated.filter((event) => inWindow(event.observedAt, start, to));
  const visibleShots = snapshots.filter((shot) => inWindow(shot.capturedAt, start, to));
  const code = events.length || visibleShots.length ? "ok" : "empty_history";
  return {
    ok: true,
    code,
    historyBeganAt: began,
    unavailableBefore: began,
    from: start,
    to,
    events,
    snapshots: visibleShots,
    undated: from == null && to == null ? undated : [],
    provenance: {
      source: "lodgist-history",
      historyBeganAt: began,
      observedAt: null,
      retrievedAt: null,
    },
  };
}

function rowsOf(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return [];
  const report = snapshot.report && typeof snapshot.report === "object" ? snapshot.report : null;
  if (report && Array.isArray(report.observations)) return report.observations;
  if (Array.isArray(snapshot.observations)) return snapshot.observations;
  if (snapshot.envelope || snapshot.provider || Object.prototype.hasOwnProperty.call(snapshot, "value")) {
    return [snapshot.envelope || snapshot];
  }
  return [];
}

function factKey(row) {
  const provider = row && row.provider ? String(row.provider) : "";
  const subject = row && row.subjectId != null ? String(row.subjectId) : "";
  const fact = row && row.fact ? String(row.fact) : "value";
  return `${provider}\u0000${subject}\u0000${fact}`;
}

function factView(row, ctx) {
  const source = row && typeof row === "object" ? row : {};
  return redact({
    value: source.value === undefined ? null : source.value,
    observedAt: finiteTimestamp(source.observedAt),
    freshness: source.freshness || "unknown",
    classification: source.classification || "UNKNOWN",
    source: source.source || null,
    provider: source.provider || null,
    license: source.license || null,
  }, ctx);
}

function compareSpatialSnapshots(before, after, ctx = {}) {
  if (!historyEnabled(ctx.env)) return flagOff();
  const left = new Map();
  const right = new Map();
  rowsOf(before).forEach((row) => left.set(factKey(row), factView(row, ctx)));
  rowsOf(after).forEach((row) => right.set(factKey(row), factView(row, ctx)));
  const keys = Array.from(new Set([...left.keys(), ...right.keys()])).sort();
  const added = [];
  const removed = [];
  const changed = [];
  const unchanged = [];
  keys.forEach((key) => {
    const earlier = left.get(key) || null;
    const later = right.get(key) || null;
    if (!earlier) {
      added.push({ key, after: later });
      return;
    }
    if (!later) {
      removed.push({ key, before: earlier });
      return;
    }
    if (JSON.stringify(earlier) === JSON.stringify(later)) unchanged.push({ key, value: later });
    else changed.push({ key, before: earlier, after: later });
  });
  return { ok: true, code: "ok", added, removed, changed, unchanged };
}

function getChangesSince(input = {}, ctx = {}) {
  if (!historyEnabled(ctx.env)) return flagOff();
  const began = beganAt(input.monitor);
  if (!began) return unavailable(null);
  const since = finiteTimestamp(input.since);
  if (since == null) return { ok: false, code: "invalid_since", historyBeganAt: began, changes: [] };
  const to = finiteTimestamp(input.to);
  if (to != null && to < began) return unavailable(began);
  if (to != null && since > to) return { ok: false, code: "invalid_range", historyBeganAt: began, changes: [] };
  const history = getSpatialHistory({
    monitor: input.monitor,
    observations: input.observations,
    snapshots: input.snapshots,
    from: began,
    to,
  }, ctx);
  const prior = [...history.events].reverse().find((event) => event.observedAt < since && event.observedAt >= began) || null;
  const events = history.events.filter((event) => event.observedAt >= Math.max(since, began));
  const changes = [];
  if (prior && events.length) changes.push(compareSpatialSnapshots(prior, events[0], ctx));
  for (let index = 1; index < events.length; index += 1) {
    changes.push(compareSpatialSnapshots(events[index - 1], events[index], ctx));
  }
  return {
    ok: true,
    code: events.length ? "ok" : "empty_history",
    historyBeganAt: began,
    unavailableBefore: began,
    since: Math.max(since, began),
    events,
    changes,
    provenance: history.provenance,
  };
}

function replaySpatialContext(input = {}, ctx = {}) {
  if (!historyEnabled(ctx.env)) return flagOff();
  const began = beganAt(input.monitor);
  const at = finiteTimestamp(input.at);
  if (!began || at == null || at < began) return unavailable(began);
  const { dated, snapshots } = collect(input, ctx, began);
  const observation = [...dated].reverse().find((event) => event.observedAt <= at) || null;
  const report = [...snapshots].reverse().find((shot) => shot.capturedAt <= at) || null;
  if (!observation && !report) {
    return {
      ok: true,
      code: "empty_history",
      historyBeganAt: began,
      unavailableBefore: began,
      at,
      context: null,
    };
  }
  return {
    ok: true,
    code: "ok",
    historyBeganAt: began,
    unavailableBefore: began,
    at,
    context: {
      observation,
      report: report ? report.report : null,
      provenance: {
        source: "lodgist-history",
        historyBeganAt: began,
        observedAt: observation ? observation.observedAt : null,
        capturedAt: report ? report.capturedAt : null,
        observation: observation ? observation.provenance : null,
        report: report ? report.provenance : null,
      },
    },
  };
}

function recordReportSnapshot(monitor, report, capturedAt, ctx = {}) {
  if (!historyEnabled(ctx.env)) return flagOff();
  const began = beganAt(monitor);
  const at = finiteTimestamp(capturedAt);
  if (!began || at == null || at < began) return unavailable(began);
  if (!report || typeof report !== "object") return { ok: false, code: "missing_report", historyBeganAt: began };
  const snapshot = snapshotFrom({ capturedAt: at, report, provenance: report.provenance }, ctx);
  snapshot.provenance.historyBeganAt = began;
  return { ok: true, code: "ok", historyBeganAt: began, snapshot: redact(snapshot, ctx) };
}

module.exports = {
  HISTORY_FLAG,
  historyEnabled,
  getSpatialHistory,
  compareSpatialSnapshots,
  getChangesSince,
  replaySpatialContext,
  recordReportSnapshot,
};
