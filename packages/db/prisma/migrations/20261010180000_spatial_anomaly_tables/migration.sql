-- Additive spatial anomaly decisions.
-- Creates SpatialAnomaly only.
-- Does not alter SpatialMonitor, SpatialMonitorObservation, SpatialReportSnapshot,
-- Listing, User, Booking, Property, or any earlier table.

CREATE TABLE "SpatialAnomaly" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "observationIds" JSONB NOT NULL,
    "rule" JSONB NOT NULL,
    "provider" TEXT,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "evidence" JSONB NOT NULL,
    "explanation" TEXT,
    "provenance" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpatialAnomaly_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SpatialAnomaly_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "SpatialMonitor"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SpatialAnomaly_monitorId_idx" ON "SpatialAnomaly"("monitorId");
CREATE INDEX "SpatialAnomaly_family_idx" ON "SpatialAnomaly"("family");
CREATE INDEX "SpatialAnomaly_triggeredAt_idx" ON "SpatialAnomaly"("triggeredAt");
