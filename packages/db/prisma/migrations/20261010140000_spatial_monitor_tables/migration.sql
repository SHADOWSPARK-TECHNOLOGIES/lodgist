-- Additive spatial monitoring tables.
-- Creates SpatialMonitor and SpatialMonitorObservation only.
-- Does not alter Listing, User, Booking, Property, or any earlier table.

CREATE TABLE "SpatialMonitor" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "target" JSONB NOT NULL,
    "providers" JSONB NOT NULL,
    "observationType" TEXT NOT NULL,
    "baseline" JSONB,
    "conditions" JSONB NOT NULL,
    "schedule" JSONB NOT NULL,
    "lastObservedAt" TIMESTAMP(3),
    "state" TEXT NOT NULL,
    "provenance" JSONB,
    "privacy" TEXT NOT NULL DEFAULT 'APPROXIMATE',
    "monitoringBeganAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SpatialMonitor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SpatialMonitorObservation" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "envelope" JSONB NOT NULL,
    "freshness" TEXT NOT NULL,
    "classification" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpatialMonitorObservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SpatialMonitorObservation_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "SpatialMonitor"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SpatialMonitor_targetType_idx" ON "SpatialMonitor"("targetType");
CREATE INDEX "SpatialMonitor_state_idx" ON "SpatialMonitor"("state");
CREATE INDEX "SpatialMonitorObservation_monitorId_idx" ON "SpatialMonitorObservation"("monitorId");
CREATE INDEX "SpatialMonitorObservation_observedAt_idx" ON "SpatialMonitorObservation"("observedAt");
