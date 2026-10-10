const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const express = require("express");
const createSpatialRouter = require("../src/routes/spatial");

const migrationPath = path.resolve(
  __dirname,
  "../../packages/db/prisma/migrations/20261010140000_spatial_monitor_tables/migration.sql",
);

test("the spatial monitor migration only creates new tables", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  assert.equal(/\bALTER\s+TABLE\b/i.test(sql), false);
  assert.equal(/\bDROP\b/i.test(sql), false);
  assert.equal(/^\s*UPDATE\b/im.test(sql), false);
  assert.equal(sql.includes('CREATE TABLE "SpatialMonitor"'), true);
  assert.equal(sql.includes('CREATE TABLE "SpatialMonitorObservation"'), true);
  ["User", "Listing", "Booking", "Property", "RentalCheck", "Lead"].forEach((name) => {
    assert.equal(sql.includes(`"${name}"`), false, name);
  });
});

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function post(server, body) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/api/spatial/monitors/run`, {
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

const monitor = {
  id: "mon-1",
  targetType: "listing",
  target: { listingId: 42 },
  providers: ["overpass"],
  observationType: "amenityCount",
  baseline: null,
  conditions: [{ op: "gt" }],
  schedule: { intervalMs: 5000 },
  monitoringBeganAt: 1_000,
};

const registry = [{
  id: "overpass",
  status: "cleared",
  commercialUse: "APPROVED_WITH_ATTRIBUTION",
  rateLimits: { perMinuteDefault: 30 },
  freshnessPolicy: { staleAfterMs: 1_000, minIntervalMs: 5_000 },
}];

test("POST /api/spatial/monitors/run is a no-op while the flag is off", async () => {
  let writes = 0;
  let reads = 0;
  const server = await listen(appWith({
    env: {},
    registry,
    readingsFor: async () => {
      reads += 1;
      return [{ provider: "overpass", value: { address: "12 Hidden Road" }, observedAt: 19_000 }];
    },
    prisma: {
      spatialMonitor: { upsert: async () => { writes += 1; } },
      spatialMonitorObservation: { create: async () => { writes += 1; } },
    },
  }));
  try {
    const { status, body } = await post(server, { monitor, readings: [{ provider: "overpass", value: 9 }] });
    assert.equal(status, 200);
    assert.equal(body.code, "flag_off");
    assert.deepEqual(body.observations, []);
    assert.equal(writes, 0);
    assert.equal(reads, 0);
    assert.equal(JSON.stringify(body).includes("Hidden Road"), false);
  } finally {
    server.close();
  }
});

test("a flagged monitor run stores the envelope and keeps the approximate area", async () => {
  const stored = [];
  const server = await listen(appWith({
    env: { SPATIAL_MONITORING: "1" },
    registry,
    now: () => 20_000,
    loadListing: async () => ({
      id: 42,
      public: true,
      approxLocation: { lat: 5.495, lng: 7.035, radius_m: 500 },
      property: { latitude: 5.497123, longitude: 7.033812, address: "12 Hidden Road" },
    }),
    readingsFor: async () => [{
      provider: "overpass",
      value: { count: 4, latitude: 5.497123, address: "12 Hidden Road" },
      observedAt: 19_000,
      source: "OpenStreetMap",
      license: "ODbL-1.0",
    }],
    prisma: {
      spatialMonitor: {
        upsert: async ({ create, update }) => {
          stored.push({ create, update });
          assert.equal(create.baseline, null);
          assert.equal(create.monitoringBeganAt.getTime(), 1_000);
          assert.equal(update.baseline, undefined);
        },
      },
      spatialMonitorObservation: {
        create: async ({ data }) => {
          stored.push(data);
        },
      },
    },
  }));
  try {
    const { status, body } = await post(server, {
      monitor,
      authorized: true,
      authorization: "AUTHORIZED_EXACT",
      now: 1,
    });
    assert.equal(status, 200);
    assert.equal(body.code, "observed");
    assert.equal(body.observations[0].value.area.lat, 5.495);
    assert.equal(body.observations[0].value.privacy, "APPROXIMATE");
    assert.equal(body.alerts[0].notify, false);
    assert.equal(JSON.stringify(body).includes("12 Hidden Road"), false);
    assert.equal(JSON.stringify(body).includes("latitude"), false);
    assert.equal(stored.length, 2);
    assert.equal(stored[1].envelope.value.count, 4);
    assert.equal(stored[1].observedAt.getTime() >= 1_000, true);
  } finally {
    server.close();
  }
});

test("the monitor script does not run while the flag is unset", () => {
  const env = Object.assign({}, process.env);
  delete env.SPATIAL_MONITORING;
  const result = spawnSync(process.execPath, ["scripts/run-spatial-monitor.js"], {
    cwd: path.resolve(__dirname, ".."),
    env,
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.code, "flag_off");
  assert.deepEqual(payload.observations, []);
});
