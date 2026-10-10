const { randomUUID } = require("crypto");

function epoch(value) {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function at(value) {
  const millis = epoch(value);
  if (millis == null) return null;
  const date = new Date(millis);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toHistoryInput(monitor, observations, snapshots) {
  return {
    monitor: {
      id: monitor.id,
      monitoringBeganAt: epoch(monitor.monitoringBeganAt),
      targetType: monitor.targetType,
      target: monitor.target,
      privacy: monitor.privacy,
    },
    observations: (observations || []).map((row) => ({
      id: row.id,
      observedAt: epoch(row.observedAt),
      retrievedAt: epoch(row.retrievedAt),
      envelope: row.envelope,
    })),
    snapshots: (snapshots || []).map((row) => ({
      id: row.id,
      capturedAt: epoch(row.capturedAt),
      report: row.report,
      provenance: row.provenance,
    })),
  };
}

async function loadStoredHistory(prisma, monitorId) {
  if (!prisma || typeof monitorId !== "string" || !monitorId) return null;
  const monitor = await prisma.spatialMonitor.findUnique({ where: { id: monitorId } });
  if (!monitor) return null;
  const observations = await prisma.spatialMonitorObservation.findMany({ where: { monitorId } });
  const snapshots = await prisma.spatialReportSnapshot.findMany({ where: { monitorId } });
  return toHistoryInput(monitor, observations, snapshots);
}

async function saveReportSnapshot(prisma, monitorId, snapshot, beganAt) {
  if (!prisma || typeof monitorId !== "string" || !monitorId || !snapshot) return { stored: false };
  const capturedAt = at(snapshot.capturedAt);
  const began = at(beganAt);
  if (!capturedAt || !began || capturedAt.getTime() < began.getTime()) {
    return { stored: false, reason: "history_unavailable_before" };
  }
  await prisma.spatialReportSnapshot.create({
    data: {
      id: typeof snapshot.id === "string" && snapshot.id ? snapshot.id : randomUUID(),
      monitorId,
      capturedAt,
      report: snapshot.report || {},
      privacy: snapshot.privacy || "APPROXIMATE",
      provenance: snapshot.provenance || null,
    },
  });
  return { stored: true };
}

module.exports = { loadStoredHistory, saveReportSnapshot };
