-- Additive spatial report snapshots.
-- Creates SpatialReportSnapshot only.
-- Does not alter SpatialMonitor, SpatialMonitorObservation, Listing, User,
-- Booking, Property, or any earlier table.

CREATE TABLE "SpatialReportSnapshot" (
    "id" TEXT NOT NULL,
    "monitorId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "report" JSONB NOT NULL,
    "privacy" TEXT NOT NULL DEFAULT 'APPROXIMATE',
    "provenance" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpatialReportSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SpatialReportSnapshot_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "SpatialMonitor"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SpatialReportSnapshot_monitorId_idx" ON "SpatialReportSnapshot"("monitorId");
CREATE INDEX "SpatialReportSnapshot_capturedAt_idx" ON "SpatialReportSnapshot"("capturedAt");
