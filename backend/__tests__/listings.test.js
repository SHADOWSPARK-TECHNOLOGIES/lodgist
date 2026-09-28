const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const listingsRouter = require("../src/routes/listings");

function buildApp(prisma) {
  const app = express();
  app.use(express.json());
  app.use("/api/listings", listingsRouter(prisma));
  return app;
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("GET /api/listings returns an empty list", async () => {
  const prisma = {
    listing: {
      count: async () => 0,
      findMany: async () => [],
    },
    review: { groupBy: async () => [] },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(body.data, []);
    assert.equal(body.pagination.total, 0);
    assert.equal(body.pagination.pages, 0);
  } finally {
    server.close();
  }
});

test("GET /api/listings returns a listing without database internals", async () => {
  const prisma = {
    listing: {
      count: async () => 1,
      findMany: async (args) => {
        assert.equal(args.select.riskState, undefined);
        assert.equal(args.select.truthIndex, undefined);
        return [{
          id: 7,
          title: "Two bedroom in Owerri",
          price: 1200000,
          images: [],
          property: { city: "Owerri", state: "Imo" },
          owner: { id: 1, name: "Ada", truthIndex: 80 },
          fraudSignals: [],
          _count: { reviews: 2, bookings: 0 },
        }];
      },
    },
    review: {
      groupBy: async () => [{ listingId: 7, _avg: { rating: 4 } }],
    },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings?search=owerri`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].title, "Two bedroom in Owerri");
    assert.equal(body.data[0].averageRating, 4);
    assert.equal(body.data[0].reviewCount, 2);
    assert.equal(JSON.stringify(body).includes("SELECT"), false);
  } finally {
    server.close();
  }
});

test("GET /api/listings hides database failures", async () => {
  const prisma = {
    listing: {
      count: async () => {
        const err = new Error('column "Listing.riskState" does not exist');
        err.code = "P2022";
        throw err;
      },
      findMany: async () => [],
    },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings`);
    const body = await res.json();
    assert.equal(res.status, 500);
    assert.equal(body.success, false);
    assert.equal(body.error, "We could not load listings. Try again.");
    assert.equal(JSON.stringify(body).includes("riskState"), false);
    assert.equal(body.stack, undefined);
  } finally {
    server.close();
  }
});
