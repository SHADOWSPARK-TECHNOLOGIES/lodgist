const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const createHealthRouter = require("../src/routes/health");

function appWith(prisma) {
  const app = express();
  app.use("/api/health", createHealthRouter(prisma));
  return app;
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function getJson(server) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/api/health`);
  const body = await res.json();
  return { status: res.status, body };
}

describe("GET /api/health", () => {
  it("reports ok when the database answers", async () => {
    const server = await listen(appWith({ user: { count: async () => 1 } }));
    try {
      const { status, body } = await getJson(server);
      assert.equal(status, 200);
      assert.equal(body.status, "ok");
      assert.equal(body.database, "connected");
      assert.deepEqual(Object.keys(body).sort(), ["database", "status"]);
    } finally {
      server.close();
    }
  });

  it("reports degraded when the database is unreachable", async () => {
    const server = await listen(
      appWith({
        user: {
          count: async () => {
            throw new Error("connect ECONNREFUSED");
          },
        },
      })
    );
    try {
      const { status, body } = await getJson(server);
      assert.equal(status, 200);
      assert.equal(body.status, "degraded");
      assert.equal(body.database, "disconnected");
      assert.deepEqual(Object.keys(body).sort(), ["database", "status"]);
    } finally {
      server.close();
    }
  });

  it("does not expose memory, uptime, version, or env details", async () => {
    const server = await listen(appWith({ user: { count: async () => 1 } }));
    try {
      const { status, body } = await getJson(server);
      assert.equal(status, 200);
      for (const key of ["memory", "uptime", "version", "env", "service", "timestamp"]) {
        assert.equal(body[key], undefined, key);
      }
      const serialized = JSON.stringify(body);
      assert.equal(serialized.includes("heap"), false);
      assert.equal(serialized.includes("rss"), false);
      assert.equal(serialized.includes("NODE_ENV"), false);
      assert.equal(serialized.includes("latencyMs"), false);
    } finally {
      server.close();
    }
  });
});
