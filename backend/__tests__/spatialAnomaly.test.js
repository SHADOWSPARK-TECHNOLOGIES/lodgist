const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const createSpatialRouter = require("../src/routes/spatial");

const migrationPath = path.resolve(
  __dirname,
  "../../packages/db/prisma/migrations/20261010180000_spatial_anomaly_tables/migration.sql",
);

test("the spatial anomaly migration only creates a new table", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  assert.equal(/\bALTER\s+TABLE\b/i.test(sql), false);
  assert.equal(/\bDROP\b/i.test(sql), false);
  assert.equal(/^\s*UPDATE\b/im.test(sql), false);
  assert.equal(sql.includes('CREATE TABLE "SpatialAnomaly"'), true);
  ["User", "Listing", "Booking", "Property", "RentalCheck", "Lead", "SpatialMonitorObservation", "SpatialReportSnapshot"].forEach((name) => {
    assert.equal(sql.includes(`"${name}"`), false, name);
  });
  assert.equal(sql.includes('REFERENCES "SpatialMonitor"("id")'), true);
});

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function post(server, body) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/api/spatial/anomalies`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

function appWith(options) {
  const app = express();
  app.use(express.json());
  app.use("/api/spatial", createSpatialRouter(options));
  return app;
}

const began = new Date(1_000);
const monitor = {
  id: "mon-1",
  monitoringBeganAt: began,
  targetType: "listing",
  target: { listingId: 42 },
  observationType: "amenityCount",
  baseline: { facts: { amenityCount: 1 } },
  privacy: "APPROXIMATE",
};

test("POST /api/spatial/anomalies is a no-op while SPATIAL_ANOMALIES is off", async () => {
  let reads = 0;
  const server = await listen(appWith({
    env: { SPATIAL_MONITORING: "1", SPATIAL_HISTORY: "1" },
    prisma: {
      spatialMonitor: { findUnique: async () => { reads += 1; return monitor; } },
      spatialMonitorObservation: { findMany: async () => { reads += 1; return []; } },
      spatialReportSnapshot: { findMany: async () => { reads += 1; return []; } },
      spatialAnomaly: { create: async () => { reads += 1; } },
    },
  }));
  try {
    const { status, body } = await post(server, {
      monitorId: "mon-1",
      observations: [{ envelope: { value: { address: "12 Hidden Road" }, observedAt: 40_000 } }],
      authorized: true,
      authorization: "AUTHORIZED_EXACT",
    });
    assert.equal(status, 200);
    assert.equal(body.code, "flag_off");
    assert.deepEqual(body.anomalies, []);
    assert.deepEqual(body.alerts, []);
    assert.equal(reads, 0);
    assert.equal(JSON.stringify(body).includes("Hidden Road"), false);
  } finally {
    server.close();
  }
});

test("a flagged anomaly run stores the rule decision and ignores a client observation", async () => {
  const created = [];
  const server = await listen(appWith({
    env: { SPATIAL_ANOMALIES: "1" },
    now: () => 50_000,
    explain: async () => ({ explanation: "Count moved.", severity: "low", anomalies: [] }),
    prisma: {
      spatialMonitor: { findUnique: async () => monitor },
      spatialMonitorObservation: {
        findMany: async () => [{
          id: "obs-1",
          observedAt: new Date(40_000),
          envelope: {
            fact: "amenityCount",
            value: { count: 9, latitude: 5.497123, address: "12 Hidden Road" },
            provider: "overpass",
            source: "OpenStreetMap",
            license: "ODbL-1.0",
            classification: "OBSERVED",
            observedAt: 40_000,
            retrievedAt: 40_010,
          },
        }],
      },
      spatialReportSnapshot: { findMany: async () => [] },
      spatialAnomaly: {
        create: async ({ data }) => {
          created.push(data);
          return data;
        },
      },
    },
  }));
  try {
    const { status, body } = await post(server, {
      monitorId: "mon-1",
      families: ["AMENITY_CHANGE"],
      observations: [{ envelope: { fact: "amenityCount", value: 1, observedAt: 40_000 } }],
      now: 1,
      explain: "client text",
    });
    assert.equal(status, 200);
    assert.equal(body.code, "ok");
    assert.equal(body.anomalies.length, 1);
    assert.equal(body.anomalies[0].severity, "high");
    assert.equal(body.anomalies[0].explanation, "Count moved.");
    assert.equal(body.decidedBy, "rule");
    assert.deepEqual(body.alerts, []);
    const encoded = JSON.stringify(body);
    assert.equal(encoded.includes("Hidden Road"), false);
    assert.equal(encoded.includes("latitude"), false);
    assert.equal(encoded.includes("5.497123"), false);
    assert.equal(created.length, 1);
    assert.equal(created[0].family, "AMENITY_CHANGE");
    assert.equal(created[0].severity, "high");
    assert.equal(created[0].confidence, body.anomalies[0].confidence);
    assert.equal(created[0].triggeredAt.getTime(), 40_000);
    assert.equal(created[0].explanation, "Count moved.");
    assert.equal(created[0].provenance.license, "ODbL-1.0");
    assert.deepEqual(created[0].observationIds, ["obs-1"]);
  } finally {
    server.close();
  }
});
