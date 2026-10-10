// Fuzz: exact property coordinates read from the DB never leave the backend
// spatial REST surface (responses or logs). Seeded and offline.
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const createSpatialRouter = require("../src/routes/spatial");
const { loadListingFromPrisma } = require("../src/routes/spatial");
const { approxLocation } = require("../src/routes/listings");

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function coord(r) {
  const make = (base, span) => {
    const v = Number((base + r() * span).toFixed(7));
    return (String(v).split(".")[1] || "").length >= 5 ? v : Number((v + 0.0000013).toFixed(7));
  };
  return { lat: make(4, 9), lng: make(3, 11) };
}

function leaks(value, c) {
  const text = typeof value === "string" ? value : JSON.stringify(value) || "";
  return text.includes(String(c.lat)) || text.includes(String(c.lng));
}

function fakePrisma(c, extra = {}) {
  return {
    listing: {
      findUnique: async () => Object.assign({
        id: 7,
        title: "Fuzz flat",
        status: "VERIFIED",
        reviewStatus: "APPROVED",
        riskState: "VERIFIED",
        isFlaggedForFraud: false,
        category: "rent",
        totalMoveInCost: null,
        property: {
          city: "Owerri",
          state: "Imo",
          lga: "Owerri West",
          latitude: c.lat,
          longitude: c.lng,
          address: `No 3 Hidden Rd (${c.lat}, ${c.lng})`,
          landmark: `${c.lat},${c.lng}`,
        },
      }, extra),
    },
  };
}

describe("backend privacy fuzz", () => {
  it("approxLocation never returns the exact input and stays within the published radius", () => {
    const r = rng(31);
    for (let i = 0; i < 500; i += 1) {
      const c = coord(r);
      const approx = approxLocation(c.lat, c.lng);
      assert.equal(leaks(approx, c), false);
      assert.ok(Math.abs(approx.lat - c.lat) <= 0.0026 && Math.abs(approx.lng - c.lng) <= 0.0026);
      assert.equal(approx.radius_m > 0, true);
    }
  });

  it("loadListingFromPrisma drops exact coordinates, address and landmark", async () => {
    const r = rng(37);
    for (let i = 0; i < 200; i += 1) {
      const c = coord(r);
      const listing = await loadListingFromPrisma(fakePrisma(c), 7);
      assert.ok(listing);
      assert.equal(leaks(listing, c), false, JSON.stringify(listing));
    }
  });

  it("POST /api/spatial/tool responses and logs never carry the exact coordinate", async () => {
    const r = rng(41);
    for (let i = 0; i < 20; i += 1) {
      const c = coord(r);
      const logs = [];
      const app = express();
      app.use(express.json());
      app.use("/api/spatial", createSpatialRouter({ prisma: fakePrisma(c), env: {}, log: (e) => logs.push(e) }));
      const server = await new Promise((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
      try {
        const { port } = server.address();
        const calls = [
          { name: "spatial.inspect", input: { listingId: 7 } },
          { name: "spatial.visualize", input: { listingId: 7 } },
          { name: "spatial.context", input: { listingId: 7, campusId: "futo" } },
          { name: "lodgist.spatial_report", input: { listingId: 7 } },
          { name: "spatial.compare", input: { listingIds: [7, 7] } },
          { name: "spatial.search", input: { query: `${c.lat},${c.lng}` } },
        ];
        for (const body of calls) {
          const res = await fetch(`http://127.0.0.1:${port}/api/spatial/tool`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          const text = await res.text();
          assert.equal(leaks(text, c), false, `${body.name}: ${text}`);
        }
        assert.equal(leaks(logs, c), false);
      } finally {
        server.close();
      }
    }
  });
});
