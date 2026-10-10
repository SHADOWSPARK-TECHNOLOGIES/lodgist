const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const createSpatialRouter = require("../src/routes/spatial");

const migrationPath = path.resolve(
  __dirname,
  "../../packages/db/prisma/migrations/20261010160000_spatial_report_snapshots/migration.sql",
);

test("the spatial report snapshot migration only creates a new table", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  assert.equal(/\bALTER\s+TABLE\b/i.test(sql), false);
  assert.equal(/\bDROP\b/i.test(sql), false);
  assert.equal(/^\s*UPDATE\b/im.test(sql), false);
  assert.equal(sql.includes('CREATE TABLE "SpatialReportSnapshot"'), true);
  ["User", "Listing", "Booking", "Property", "RentalCheck", "Lead", "SpatialMonitorObservation"].forEach((name) => {
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
  const res = await fetch(`http://127.0.0.1:${port}/api/spatial/history`, {
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

function storedPrisma(state) {
  return {
    spatialMonitor: {
      findUnique: async () => state.monitor,
    },
    spatialMonitorObservation: {
      findMany: async () => state.observations,
    },
    spatialReportSnapshot: {
      findMany: async () => state.snapshots,
      create: async ({ data }) => {
        state.created.push(data);
        return data;
      },
    },
  };
}

const began = new Date(1_000);
const monitor = { id: "mon-1", monitoringBeganAt: began, targetType: "listing", target: { listingId: 42 }, privacy: "APPROXIMATE" };

test("POST /api/spatial/history is a no-op while SPATIAL_HISTORY is off", async () => {
  let reads = 0;
  const server = await listen(appWith({
    env: { SPATIAL_MONITORING: "1" },
    prisma: {
      spatialMonitor: { findUnique: async () => { reads += 1; return monitor; } },
      spatialMonitorObservation: { findMany: async () => { reads += 1; return []; } },
      spatialReportSnapshot: { findMany: async () => { reads += 1; return []; } },
    },
  }));
  try {
    const { status, body } = await post(server, {
      action: "history",
      monitorId: "mon-1",
      observations: [{ envelope: { value: { address: "12 Hidden Road" }, observedAt: 2_000 } }],
    });
    assert.equal(status, 200);
    assert.equal(body.code, "flag_off");
    assert.deepEqual(body.events, []);
    assert.equal(body.context, null);
    assert.equal(reads, 0);
    assert.equal(JSON.stringify(body).includes("Hidden Road"), false);
  } finally {
    server.close();
  }
});

test("history reads stored rows and refuses a range before monitoring began", async () => {
  const state = {
    monitor,
    observations: [
      { id: "early", observedAt: new Date(500), envelope: { value: 1, provider: "overpass", observedAt: 500, source: "OpenStreetMap", license: "ODbL-1.0" } },
      { id: "later", observedAt: new Date(2_000), envelope: { value: { count: 4, latitude: 5.497123, address: "12 Hidden Road", area: { lat: 5.495, lng: 7.035, radius_m: 500 } }, provider: "overpass", observedAt: 2_000, source: "OpenStreetMap", license: "ODbL-1.0", freshness: "fresh", classification: "OBSERVED" } },
    ],
    snapshots: [],
    created: [],
  };
  const server = await listen(appWith({
    env: { SPATIAL_HISTORY: "1" },
    prisma: storedPrisma(state),
  }));
  try {
    const early = await post(server, {
      action: "history",
      monitorId: "mon-1",
      from: 1,
      to: 500,
      observations: [{ envelope: { value: 9, observedAt: 200 } }],
      authorized: true,
      authorization: "AUTHORIZED_EXACT",
    });
    assert.equal(early.status, 200);
    assert.equal(early.body.code, "history_unavailable_before");
    assert.equal(early.body.historyBeganAt, 1_000);
    assert.deepEqual(early.body.events, []);
    assert.equal(JSON.stringify(early.body).includes('"value":9'), false);

    const history = await post(server, { action: "history", monitorId: "mon-1", from: 0, to: 5_000 });
    assert.equal(history.body.code, "ok");
    assert.equal(history.body.events.length, 1);
    assert.equal(history.body.events[0].value.count, 4);
    assert.equal(history.body.events[0].provenance.license, "ODbL-1.0");
    const encoded = JSON.stringify(history.body);
    assert.equal(encoded.includes("Hidden Road"), false);
    assert.equal(encoded.includes("latitude"), false);
    assert.equal(encoded.includes("5.497123"), false);
  } finally {
    server.close();
  }
});

test("snapshot comparison uses stored snapshots and record ignores a client report", async () => {
  const state = {
    monitor,
    observations: [],
    snapshots: [
      { id: "a", capturedAt: new Date(2_000), report: { observations: [{ provider: "overpass", subjectId: "listing:42", fact: "amenityCount", value: 3, observedAt: 2_000 }] } },
      { id: "b", capturedAt: new Date(4_000), report: { observations: [{ provider: "overpass", subjectId: "listing:42", fact: "amenityCount", value: 5, observedAt: 4_000 }] } },
    ],
    created: [],
  };
  const server = await listen(appWith({
    env: { SPATIAL_HISTORY: "1" },
    now: () => 2_500,
    reportFor: async () => ({ observations: [{ provider: "overpass", fact: "amenityCount", value: 4 }] }),
    prisma: storedPrisma(state),
  }));
  try {
    const diff = await post(server, { action: "compare", monitorId: "mon-1", beforeId: "a", afterId: "b" });
    assert.equal(diff.status, 200);
    assert.equal(diff.body.changed.length, 1);
    assert.equal(diff.body.changed[0].before.value, 3);
    assert.equal(diff.body.changed[0].after.value, 5);
    const again = await post(server, { action: "compare", monitorId: "mon-1", beforeId: "a", afterId: "b" });
    assert.deepEqual(diff.body, again.body);

    const recorded = await post(server, {
      action: "record",
      monitorId: "mon-1",
      report: { summary: "fabricated", address: "12 Hidden Road" },
      capturedAt: 100,
    });
    assert.equal(recorded.body.code, "ok");
    assert.equal(recorded.body.snapshot.capturedAt, 2_500);
    assert.equal(state.created.length, 1);
    assert.equal(state.created[0].capturedAt.getTime(), 2_500);
    assert.equal(JSON.stringify(recorded.body).includes("fabricated"), false);
    assert.equal(JSON.stringify(recorded.body).includes("Hidden Road"), false);
  } finally {
    server.close();
  }
});
