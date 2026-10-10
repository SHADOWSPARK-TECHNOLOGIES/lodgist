const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const createSpatialRouter = require("../src/routes/spatial");

function listen(app) {
  return new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
}

test("every spatial route response carries DataQuality (12B)", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/spatial", createSpatialRouter({ env: {}, now: () => Date.parse("2026-10-10T12:00:00Z") }));
  const server = await listen(app);
  const { port } = server.address();
  try {
    for (const path of ["history", "anomalies", "monitors/run", "tool"]) {
      const res = await fetch(`http://127.0.0.1:${port}/api/spatial/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(path === "tool" ? { name: "spatial.inspect", input: { listingId: 1 } } : { monitorId: "m", action: "history" }),
      });
      const body = await res.json();
      assert.ok(body.dataQuality, path);
      assert.ok(["GOOD", "PARTIAL", "POOR", "UNKNOWN"].includes(body.dataQuality.coverage), path);
      assert.ok(["FRESH", "AGING", "STALE", "UNKNOWN"].includes(body.dataQuality.freshness), path);
    }
  } finally {
    server.close();
  }
});
