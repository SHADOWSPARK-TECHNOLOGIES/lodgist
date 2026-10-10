const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const createSpatialRouter = require("../src/routes/spatial");

function appWith(options) {
  const app = express();
  app.use(express.json());
  app.use("/api/spatial", createSpatialRouter(options));
  return app;
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function post(server, body) {
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/api/spatial/tool`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await res.json();
  return { status: res.status, body: payload };
}

const home = {
  id: 42,
  title: "Flat near Nekede",
  public: true,
  property: { lga: "Owerri West", city: "Owerri", state: "Imo" },
  approxLocation: { lat: 5.495, lng: 7.035, radius_m: 500 },
};

describe("POST /api/spatial/tool", () => {
  it("refuses a caller-supplied provider URL and does not fetch", async () => {
    let calls = 0;
    const server = await listen(appWith({
      fetchImpl: async () => {
        calls += 1;
        return { ok: true, status: 200, json: async () => ({}) };
      },
      loadListing: async () => home,
    }));
    try {
      const { status, body } = await post(server, {
        name: "lodgist.nearby_amenities",
        input: { listingId: 42, url: "https://evil.example/interpreter" },
      });
      assert.equal(status, 400);
      assert.equal(body.code, "forbidden");
      assert.equal(calls, 0);
      assert.equal(JSON.stringify(body).includes("evil.example"), false);
    } finally {
      server.close();
    }
  });

  it("inspects a public listing by id and omits exact coordinates", async () => {
    const server = await listen(appWith({
      loadListing: async (id) => (String(id) === "42" ? {
        ...home,
        property: { ...home.property, latitude: 5.497123, longitude: 7.033812, address: "12 Hidden Road" },
      } : null),
    }));
    try {
      const { status, body } = await post(server, {
        name: "lodgist.inspect_property",
        input: { listingId: 42 },
      });
      assert.equal(status, 200);
      assert.equal(body.ok, true);
      assert.equal(body.data.approxLocation.lat, 5.495);
      assert.equal(JSON.stringify(body).includes("12 Hidden Road"), false);
      assert.equal(JSON.stringify(body).includes("latitude"), false);
    } finally {
      server.close();
    }
  });

  it("rejects an unknown tool", async () => {
    const server = await listen(appWith({}));
    try {
      const { status, body } = await post(server, { name: "spatial.fetch_url", input: {} });
      assert.equal(status, 400);
      assert.equal(body.code, "forbidden");
    } finally {
      server.close();
    }
  });
});
