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

async function saveAnomalies(prisma, monitorId, result, beganAt) {
  if (!prisma || typeof monitorId !== "string" || !monitorId || !result || result.code !== "ok") {
    return { stored: false };
  }
  const began = at(beganAt);
  if (!began) return { stored: false, reason: "missing_start" };
  const anomalies = Array.isArray(result.anomalies) ? result.anomalies : [];
  let stored = 0;
  for (const anomaly of anomalies) {
    const triggeredAt = at(anomaly.triggeredAt);
    if (!triggeredAt || triggeredAt.getTime() < began.getTime()) continue;
    await prisma.spatialAnomaly.create({
      data: {
        id: randomUUID(),
        monitorId,
        family: anomaly.family,
        severity: anomaly.severity,
        confidence: anomaly.confidence,
        reason: anomaly.reason,
        observationIds: anomaly.observationIds || [],
        rule: anomaly.rule || {},
        provider: anomaly.provider || null,
        triggeredAt,
        evidence: anomaly.evidence || {},
        explanation: typeof anomaly.explanation === "string" ? anomaly.explanation : null,
        provenance: anomaly.provenance || null,
      },
    });
    stored += 1;
  }
  return { stored: true, anomalies: stored };
}

module.exports = { saveAnomalies };
