const express = require("express");
const spatial = require("../../../packages/spatial-core");
const { approxLocation, isEligiblePublicListing } = require("./listings");
const { saveMonitorRun } = require("../services/spatialMonitorStore");
const { loadStoredHistory, saveReportSnapshot } = require("../services/spatialHistoryStore");
const { saveAnomalies } = require("../services/spatialAnomalyStore");
const {
  createResilientCostLedger,
  createGovernedFetch,
  attributeServedProvider,
  recordCacheHits,
} = require("../services/spatialCostGovernor");

const URL_KEYS = ["url", "providerUrl", "userUrl", "endpoint", "baseUrl", "tileUrl", "interpreterUrl"];
const MAX_BODY_CHARS = 32 * 1024;

function hasUrlKey(value) {
  if (!value || typeof value !== "object") return false;
  return URL_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key) && value[key] != null && value[key] !== "");
}

async function loadListingFromPrisma(prisma, id) {
  const listingId = Number(id);
  if (!Number.isInteger(listingId) || listingId <= 0) return null;
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
    select: {
      id: true,
      title: true,
      status: true,
      reviewStatus: true,
      riskState: true,
      isFlaggedForFraud: true,
      category: true,
      totalMoveInCost: true,
      property: { select: { city: true, state: true, lga: true, latitude: true, longitude: true } },
    },
  });
  if (!listing || !isEligiblePublicListing(listing)) return null;
  const property = listing.property || {};
  return {
    id: listing.id,
    title: listing.title,
    status: listing.status,
    reviewStatus: listing.reviewStatus,
    riskState: listing.riskState,
    category: listing.category,
    public: true,
    property: { city: property.city, state: property.state, lga: property.lga },
    approxLocation: approxLocation(property.latitude, property.longitude),
  };
}

function monitorEnv(options) {
  if (options && Object.prototype.hasOwnProperty.call(options, "env")) {
    return options.env && typeof options.env === "object" ? options.env : {};
  }
  return process.env;
}

function createSpatialRouter(options = {}) {
  const router = express.Router();
  // Phase 12L: every spatial provider call is metered by the persisted cost ledger
  // (Prisma SpatialCostLedger, in-memory until that table exists).
  const costLedger = options.costLedger || createResilientCostLedger(options.prisma, { log: options.log });
  // Router-owned cache state so cache hits can be observed and metered.
  const safeguardState = options.safeguardState || spatial.createSafeguardState();

  // Phase 12B: every spatial response carries DataQuality (tool results already do).
  router.use((req, res, next) => {
    const send = res.json.bind(res);
    res.json = (body) => {
      if (!body || typeof body !== "object" || Array.isArray(body) || body.dataQuality) return send(body);
      const now = typeof options.now === "function" ? options.now() : Date.now();
      return send(spatial.withDataQuality(body, { now }));
    };
    next();
  });

  router.post("/tool", async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ ok: false, code: "malformed" });
    }
    if (JSON.stringify(body).length > MAX_BODY_CHARS || hasUrlKey(body) || hasUrlKey(body.input)) {
      return res.status(400).json({ ok: false, code: "forbidden" });
    }
    try {
      const input = body.input && typeof body.input === "object" && !Array.isArray(body.input) ? body.input : {};
      const ids = [];
      if (input.listingId != null) ids.push(input.listingId);
      if (Array.isArray(input.listingIds)) ids.push(...input.listingIds);
      const listings = [];
      for (const id of ids) {
        const listing = typeof options.loadListing === "function"
          ? await options.loadListing(id)
          : options.prisma
            ? await loadListingFromPrisma(options.prisma, id)
            : null;
        if (listing) listings.push(listing);
      }
      const governedFetch = options.fetchImpl
        ? createGovernedFetch(options.fetchImpl, {
          env: options.env || {},
          ledger: costLedger,
          registry: options.registry,
          production: options.production,
          lookup: options.lookup,
          tenant: options.costTenant,
          agent: options.costAgent,
          budgets: options.costBudgets,
          paid: options.costPaid,
          estimatedCost: options.costEstimates,
          throttleDelayMs: options.throttleDelayMs,
          now: options.now,
        })
        : undefined;
      const raw = await spatial.callTool(String(body.name || ""), input, {
        listings,
        isPublicListing: (listing) => Boolean(listing && listing.public === true),
        env: options.env || {},
        fetchImpl: governedFetch,
        lookup: options.lookup,
        registry: options.registry,
        safeguardState,
        log: options.log,
      });
      // spatial-core says explicitly when data came from its cache and which
      // provider originally fetched it (a fallback included); no inference here.
      const cache = raw && raw.meta && raw.meta.cache;
      const cacheHit = Boolean(cache && cache.hit === true && cache.servedBy && cache.servedBy.provider);
      if (governedFetch && raw.ok && cacheHit) {
        await recordCacheHits(costLedger, [cache.servedBy.provider], { tenant: options.costTenant, agent: options.costAgent, now: options.now });
      }
      // A cache hit is already attributed by spatial-core to its stored serving provider.
      const result = governedFetch && !cacheHit
        ? attributeServedProvider(raw, governedFetch.served, { registry: options.registry, now: options.now })
        : raw;
      const status = result.ok ? 200 : (result.code === "malformed" || result.code === "forbidden" ? 400 : 502);
      return res.status(status).json(result);
    } catch {
      return res.status(502).json({ ok: false, code: "unavailable" });
    }
  });

  // Phase 12K: read-only provider health for agent planning. No secrets, no URLs.
  router.get("/providers/health", (req, res) => {
    const env = monitorEnv(options);
    if (!["1", "true", "on", "yes"].includes(String(env.SPATIAL_PROVIDER_HEALTH || "").trim().toLowerCase())) {
      return res.status(200).json({ ok: true, code: "flag_off", providers: [] });
    }
    const now = typeof options.now === "function" ? options.now() : Date.now();
    const providers = spatial.allProviderHealth({
      env,
      registry: options.registry,
      production: options.production,
      state: options.healthState,
      now,
    });
    return res.status(200).json({ ok: true, code: "ok", providers });
  });

  router.post("/monitors/run", async (req, res) => {
    const env = monitorEnv(options);
    if (!spatial.monitoringEnabled(env)) {
      return res.status(200).json({ ok: true, code: "flag_off", observations: [], alerts: [] });
    }
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ ok: false, code: "malformed" });
    }
    if (JSON.stringify(body).length > MAX_BODY_CHARS || hasUrlKey(body) || hasUrlKey(body.monitor)) {
      return res.status(400).json({ ok: false, code: "forbidden" });
    }
    const monitor = body.monitor && typeof body.monitor === "object" && !Array.isArray(body.monitor) ? body.monitor : null;
    if (!monitor) return res.status(400).json({ ok: false, code: "malformed" });
    try {
      let listing = null;
      if (monitor.targetType === "listing") {
        const listingId = monitor.target && monitor.target.listingId;
        if (typeof options.loadListing === "function") listing = await options.loadListing(listingId);
        else if (options.prisma) listing = await loadListingFromPrisma(options.prisma, listingId);
      }
      const readings = typeof options.readingsFor === "function" ? await options.readingsFor(monitor) : [];
      const now = typeof options.now === "function" ? options.now() : Date.now();
      const result = await spatial.runMonitor(monitor, now, {
        env,
        registry: options.registry,
        readings,
        listing,
        production: options.production,
        policy: options.policy,
      });
      if (result.code === "observed" && options.prisma) {
        await saveMonitorRun(options.prisma, monitor, result);
      }
      const status = result.ok ? 200 : 400;
      return res.status(status).json(result);
    } catch {
      return res.status(502).json({ ok: false, code: "unavailable" });
    }
  });

  router.post("/history", async (req, res) => {
    const env = monitorEnv(options);
    if (!spatial.historyEnabled(env)) {
      return res.status(200).json({
        ok: true,
        code: "flag_off",
        historyBeganAt: null,
        events: [],
        snapshots: [],
        changes: [],
        context: null,
      });
    }
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ ok: false, code: "malformed" });
    }
    if (JSON.stringify(body).length > MAX_BODY_CHARS || hasUrlKey(body)) {
      return res.status(400).json({ ok: false, code: "forbidden" });
    }
    const action = typeof body.action === "string" ? body.action : "";
    const monitorId = typeof body.monitorId === "string" ? body.monitorId : "";
    if (!monitorId || !["history", "changes", "replay", "compare", "record"].includes(action)) {
      return res.status(400).json({ ok: false, code: "malformed" });
    }
    if (!options.prisma) return res.status(503).json({ ok: false, code: "store_unavailable", events: [], context: null });
    try {
      const stored = await loadStoredHistory(options.prisma, monitorId);
      if (!stored) return res.status(404).json({ ok: false, code: "monitor_not_found", events: [], context: null });
      const ctx = { env };
      if (options.authorized === true && options.authorization === "AUTHORIZED_EXACT") {
        ctx.authorized = true;
        ctx.authorization = "AUTHORIZED_EXACT";
      }
      if (action === "record") {
        const report = typeof options.reportFor === "function" ? await options.reportFor(stored.monitor) : null;
        const capturedAt = typeof options.now === "function" ? options.now() : Date.now();
        const recorded = spatial.recordReportSnapshot(stored.monitor, report, capturedAt, ctx);
        if (recorded.code === "ok" && recorded.snapshot) {
          await saveReportSnapshot(options.prisma, monitorId, recorded.snapshot, stored.monitor.monitoringBeganAt);
        }
        const status = recorded.ok ? 200 : 400;
        return res.status(status).json(recorded);
      }
      if (action === "compare") {
        const before = stored.snapshots.find((row) => row.id === body.beforeId) || null;
        const after = stored.snapshots.find((row) => row.id === body.afterId) || null;
        if (!before || !after) {
          return res.status(404).json({ ok: false, code: "snapshot_not_found", added: [], removed: [], changed: [], unchanged: [] });
        }
        return res.status(200).json(spatial.compareSpatialSnapshots(before, after, ctx));
      }
      const input = {
        monitor: stored.monitor,
        observations: stored.observations,
        snapshots: stored.snapshots,
        from: body.from,
        to: body.to,
        since: body.since,
        at: body.at,
      };
      const result = action === "changes"
        ? spatial.getChangesSince(input, ctx)
        : action === "replay"
          ? spatial.replaySpatialContext(input, ctx)
          : spatial.getSpatialHistory(input, ctx);
      const status = result.ok ? 200 : 400;
      return res.status(status).json(result);
    } catch {
      return res.status(502).json({ ok: false, code: "unavailable" });
    }
  });

  router.post("/anomalies", async (req, res) => {
    const env = monitorEnv(options);
    if (!spatial.anomaliesEnabled(env)) {
      return res.status(200).json({
        ok: true,
        code: "flag_off",
        anomalies: [],
        alerts: [],
        explanation: null,
        decidedBy: "rule",
      });
    }
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({ ok: false, code: "malformed" });
    }
    if (JSON.stringify(body).length > MAX_BODY_CHARS || hasUrlKey(body)) {
      return res.status(400).json({ ok: false, code: "forbidden" });
    }
    const monitorId = typeof body.monitorId === "string" ? body.monitorId : "";
    if (!monitorId) return res.status(400).json({ ok: false, code: "malformed" });
    if (!options.prisma) {
      return res.status(503).json({ ok: false, code: "store_unavailable", anomalies: [], alerts: [] });
    }
    try {
      const stored = await loadStoredHistory(options.prisma, monitorId);
      if (!stored) return res.status(404).json({ ok: false, code: "monitor_not_found", anomalies: [], alerts: [] });
      const now = typeof options.now === "function" ? options.now() : Date.now();
      const ctx = { env };
      if (options.authorized === true && options.authorization === "AUTHORIZED_EXACT") {
        ctx.authorized = true;
        ctx.authorization = "AUTHORIZED_EXACT";
      }
      let result = spatial.evaluateAnomalies({
        monitor: stored.monitor,
        observations: stored.observations,
        snapshots: stored.snapshots,
        now,
      }, ctx);
      if (typeof options.explain === "function" && result.anomalies.length) {
        let produced = null;
        try {
          produced = await options.explain({
            decidedBy: "rule",
            anomalies: result.anomalies.map((anomaly) => ({
              family: anomaly.family,
              severity: anomaly.severity,
              confidence: anomaly.confidence,
              reason: anomaly.reason,
            })),
          });
        } catch {
          produced = null;
        }
        result = spatial.attachAnomalyExplanation(result, produced);
      }
      if (result.code === "ok" && result.anomalies.length) {
        await saveAnomalies(options.prisma, monitorId, result, stored.monitor.monitoringBeganAt);
      }
      return res.status(200).json(result);
    } catch {
      return res.status(502).json({ ok: false, code: "unavailable" });
    }
  });

  return router;
}

module.exports = createSpatialRouter;
module.exports.loadListingFromPrisma = loadListingFromPrisma;
