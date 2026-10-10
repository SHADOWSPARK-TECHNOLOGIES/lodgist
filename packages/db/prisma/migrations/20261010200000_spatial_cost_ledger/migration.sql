-- Additive spatial cost governor ledger (Phase 12L).
-- Creates SpatialCostLedger only. Does not alter any existing table.

CREATE TABLE "SpatialCostLedger" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "tenant" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "window" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cacheHits" INTEGER NOT NULL DEFAULT 0,
    "fallbackCalls" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpatialCostLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpatialCostLedger_provider_tenant_agent_windowStart_key" ON "SpatialCostLedger"("provider", "tenant", "agent", "windowStart");
CREATE INDEX "SpatialCostLedger_windowStart_idx" ON "SpatialCostLedger"("windowStart");
