const { randomUUID } = require("crypto");

function at(value) {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

async function saveMonitorRun(prisma, monitor, result) {
  if (!prisma || !monitor || !result || result.code !== "observed") return { stored: false };
  if (typeof monitor.id !== "string" || !monitor.id) return { stored: false, reason: "missing_id" };
  const began = at(monitor.monitoringBeganAt);
  if (!began) return { stored: false, reason: "missing_start" };
  const lastObservedAt = at(result.lastObservedAt);
  await prisma.spatialMonitor.upsert({
    where: { id: monitor.id },
    create: {
      id: monitor.id,
      targetType: monitor.targetType,
      target: monitor.target || {},
      providers: monitor.providers || [],
      observationType: monitor.observationType || "value",
      baseline: monitor.baseline == null ? null : monitor.baseline,
      conditions: monitor.conditions || [],
      schedule: monitor.schedule,
      lastObservedAt,
      state: result.state || "observed",
      provenance: result.provenance || null,
      privacy: monitor.privacy || "APPROXIMATE",
      monitoringBeganAt: began,
    },
    update: {
      lastObservedAt,
      state: result.state || "observed",
      provenance: result.provenance || null,
    },
  });
  const observations = Array.isArray(result.observations) ? result.observations : [];
  for (const envelope of observations) {
    const observedAt = at(envelope.observedAt);
    if (observedAt && observedAt.getTime() < began.getTime()) continue;
    await prisma.spatialMonitorObservation.create({
      data: {
        id: randomUUID(),
        monitorId: monitor.id,
        envelope,
        freshness: envelope.freshness || "unknown",
        classification: envelope.classification || "UNKNOWN",
        observedAt,
        retrievedAt: at(envelope.retrievedAt),
      },
    });
  }
  return { stored: true, observations: observations.length };
}

module.exports = { saveMonitorRun };
