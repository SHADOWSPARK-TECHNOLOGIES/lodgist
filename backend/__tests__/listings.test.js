const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const listingsRouter = require("../src/routes/listings");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

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
        assert.equal(args.select.riskState, true);
        assert.equal(args.select.truthIndex, true);
        assert.equal(args.select.owner.select.email, undefined);
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

test("GET /api/listings honours limit, state, area and sort", async () => {
  let seen;
  const prisma = {
    listing: {
      count: async () => 30,
      findMany: async (args) => { seen = args; return []; },
    },
    review: { groupBy: async () => [] },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings?limit=5&page=2&state=Imo&area=Owerri&sort=price_asc`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(seen.take, 5);
    assert.equal(seen.skip, 5);
    assert.deepEqual(seen.orderBy, { price: "asc" });
    assert.deepEqual(seen.where.property.is.state, { equals: "Imo", mode: "insensitive" });
    assert.equal(seen.where.property.is.OR.length, 3);
    assert.deepEqual(body.pagination, { total: 30, page: 2, pages: 6, totalPages: 6, limit: 5, pageSize: 5 });
  } finally {
    server.close();
  }
});

test("GET /api/listings clamps limit and ignores unknown sort", async () => {
  let seen;
  const prisma = {
    listing: {
      count: async () => 0,
      findMany: async (args) => { seen = args; return []; },
    },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings?limit=999&sort=drop_table`);
    assert.equal(res.status, 200);
    assert.equal(seen.take, 50);
    assert.deepEqual(seen.orderBy, { createdAt: "desc" });
  } finally {
    server.close();
  }
});

test("GET /api/listings/:id does not expose owner email or phone", async () => {
  let ownerSelect;
  const prisma = new Proxy({}, {
    get: () => new Proxy({}, {
      get: (_, fn) => async (args) => {
        if (args?.select?.owner) ownerSelect = args.select.owner.select;
        if (args?.include?.owner) ownerSelect = args.include.owner.select;
        return fn === "findMany" || fn === "groupBy" ? [] : fn === "count" ? 0 : null;
      },
    }),
  });
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    await fetch(`http://127.0.0.1:${port}/api/listings/1`);
    assert.ok(ownerSelect, "owner select captured");
    assert.equal(ownerSelect.email, undefined);
    assert.equal(ownerSelect.phone, undefined);
  } finally {
    server.close();
  }
});

function detailPrisma(property, seen = {}) {
  return {
    listing: {
      findUnique: async (args) => {
        seen.select = args.select;
        return {
          id: 1,
          title: "Two bedroom in Owerri",
          status: "VERIFIED",
          riskState: "VERIFIED",
          isFlaggedForFraud: false,
          price: 1200000,
          images: [],
          property,
          owner: { id: 1, name: "Ada", truthIndex: 80, isVerified: false },
          fraudSignals: [],
          _count: { reviews: 0, bookings: 0 },
        };
      },
    },
    review: { aggregate: async () => ({ _avg: { rating: null }, _count: 0 }) },
  };
}

const EXACT_KEYS = ["address", "landmark", "latitude", "longitude"];

test("GET /api/listings/:id returns a 500 m approxLocation, never the exact pin", async () => {
  const seen = {};
  const prisma = detailPrisma({
    id: 9, city: "Owerri", state: "Imo", lga: "Owerri Municipal",
    latitude: 5.497123, longitude: 7.033812, propertyType: "Apartment",
  }, seen);
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings/1`);
    const text = await res.text();
    const body = JSON.parse(text);
    assert.equal(res.status, 200);
    assert.equal(seen.select.property.select.address, undefined);
    assert.equal(seen.select.property.select.landmark, undefined);
    for (const key of EXACT_KEYS) {
      assert.equal(text.includes(`"${key}"`), false, `${key} must not be in the response`);
    }
    assert.equal(text.includes("5.497123"), false);
    assert.equal(text.includes("7.033812"), false);
    assert.deepEqual(body.data.approxLocation, { lat: 5.495, lng: 7.035, radius_m: 500 });
    assert.equal(body.data.property.city, "Owerri");
    assert.equal(body.data.property.lga, "Owerri Municipal");
  } finally {
    server.close();
  }
});

test("GET /api/listings/:id returns approxLocation null without coordinates", async () => {
  const prisma = detailPrisma({ id: 1, city: "Owerri", state: "Imo", lga: "Owerri Municipal", latitude: null, longitude: null });
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings/1`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.approxLocation, null);
    assert.equal(body.data.property.city, "Owerri");
    for (const key of EXACT_KEYS) assert.equal(key in body.data.property, false);
  } finally {
    server.close();
  }
});

test("GET /api/listings/:id handles a listing without a property", async () => {
  const server = await listen(buildApp(detailPrisma(null)));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings/1`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.property, null);
    assert.equal(body.data.approxLocation, null);
  } finally {
    server.close();
  }
});

test("GET /api/listings never selects exact location fields", async () => {
  let seen;
  const prisma = {
    listing: { count: async () => 0, findMany: async (args) => { seen = args; return []; } },
    review: { groupBy: async () => [] },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    await fetch(`http://127.0.0.1:${port}/api/listings`);
    for (const key of EXACT_KEYS) assert.equal(seen.select.property.select[key], undefined);
  } finally {
    server.close();
  }
});

function browsePrisma() {
  const seen = {};
  const prisma = {
    listing: {
      count: async () => 2,
      findMany: async (args) => {
        seen.args = args;
        return [
          {
            id: 1,
            title: "Checked flat",
            status: "VERIFIED",
            riskState: "VERIFIED",
            totalMoveInCost: { total: 1000 },
            images: [],
            property: { city: "Owerri", state: "Imo" },
            owner: { id: 1, name: "Ada", truthIndex: 80 },
            fraudSignals: [],
            _count: { reviews: 0, bookings: 0 },
          },
          {
            id: 2,
            title: "Sample flat",
            status: "VERIFIED",
            riskState: "VERIFIED",
            totalMoveInCost: { sample: true, total: 1 },
            images: [],
            property: { city: "Owerri", state: "Imo" },
            owner: { id: 1, name: "Ada", truthIndex: 0 },
            fraudSignals: [],
            _count: { reviews: 0, bookings: 0 },
          },
          {
            id: 3,
            title: "Pending flat",
            status: "PENDING",
            riskState: "UNVERIFIED",
            isFlaggedForFraud: false,
            totalMoveInCost: { total: 800000 },
            images: [],
            property: { city: "Owerri", state: "Imo" },
            owner: { id: 1, name: "Ada", truthIndex: 0 },
            fraudSignals: [],
            _count: { reviews: 0, bookings: 0 },
          },
        ];
      },
    },
    review: { groupBy: async () => [] },
  };
  return { prisma, seen };
}

const PUBLIC_RISK_FILTER = {
  OR: [
    { riskState: { equals: null } },
    { riskState: { in: ["UNVERIFIED", "UNDER_REVIEW", "VERIFIED"] } },
  ],
};
const PUBLIC_STATUS_FILTER = { in: ["PENDING", "VERIFIED"] };

// Mirrors Prisma 7.8 enum validation for this field. The generated client
// throws these before the query is sent, which is what 500s public browse.
function rejectInvalidRiskStateWhere(where) {
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(node, "riskState")) {
      const value = node.riskState;
      if (value === null) {
        const err = new Error("Argument `riskState` is missing.");
        err.name = "PrismaClientValidationError";
        throw err;
      }
      if (value && typeof value === "object" && Array.isArray(value.in) && value.in.some((item) => item == null)) {
        const err = new Error(
          "Argument `in`: Invalid value provided. Expected ListEnumRiskStateFieldRefInput or Null, provided (Null, String).",
        );
        err.name = "PrismaClientValidationError";
        throw err;
      }
    }
    for (const value of Object.values(node)) walk(value);
  };
  walk(where);
}

test("GET /api/listings returns eligible pending homes and hides samples", async () => {
  const { prisma, seen } = browsePrisma();
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings?status=PENDING`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual(seen.args.where.status, PUBLIC_STATUS_FILTER);
    assert.equal(seen.args.where.isFlaggedForFraud, false);
    assert.deepEqual(seen.args.where.AND, [PUBLIC_RISK_FILTER]);
    rejectInvalidRiskStateWhere(seen.args.where);
    assert.equal(JSON.stringify(seen.args.where).includes('"riskState":null'), false);
    assert.deepEqual(body.data.map((row) => row.id), [1, 3]);
    assert.equal(JSON.stringify(body).includes("Sample flat"), false);
    const pending = body.data.find((row) => row.id === 3);
    assert.equal(pending.status, "PENDING");
    assert.equal(pending.verificationLabel, "Not verified by Lodgist");
    assert.equal(pending.sourceLabel, "Direct submission");
    assert.equal(pending.actions.enquiry, true);
    assert.equal(pending.actions.viewing, false);
    const verified = body.data.find((row) => row.id === 1);
    assert.equal(verified.verificationLabel, "Verified by Lodgist");
    assert.equal(verified.actions.viewing, true);
  } finally {
    server.close();
  }
});

test("GET /api/listings builds a public query that keeps null riskState rows", async () => {
  let seen;
  const rows = [
    {
      id: 11,
      title: "Unscored verified flat",
      status: "VERIFIED",
      riskState: null,
      totalMoveInCost: { total: 1000 },
      images: [],
      property: { city: "Owerri", state: "Imo" },
      owner: { id: 1, name: "Ada", truthIndex: 0 },
      fraudSignals: [],
      _count: { reviews: 0, bookings: 0 },
    },
    {
      id: 12,
      title: "Sample unscored flat",
      status: "VERIFIED",
      riskState: null,
      totalMoveInCost: { sample: true, total: 1 },
      images: [],
      property: { city: "Owerri", state: "Imo" },
      owner: { id: 1, name: "Ada", truthIndex: 0 },
      fraudSignals: [],
      _count: { reviews: 0, bookings: 0 },
    },
  ];
  const prisma = {
    listing: {
      count: async (args) => {
        rejectInvalidRiskStateWhere(args.where);
        return rows.length;
      },
      findMany: async (args) => {
        seen = args;
        rejectInvalidRiskStateWhere(args.where);
        return rows;
      },
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
    assert.deepEqual(seen.where.status, PUBLIC_STATUS_FILTER);
    assert.equal(seen.where.isFlaggedForFraud, false);
    assert.deepEqual(seen.where.AND, [PUBLIC_RISK_FILTER]);
    assert.deepEqual(body.data.map((row) => row.id), [11]);
    assert.equal(body.data[0].riskState, null);
    assert.equal(JSON.stringify(body).includes("Sample unscored flat"), false);
  } finally {
    server.close();
  }
});

test("public browse riskState filter is accepted by the Prisma 7.8 client", async () => {
  const where = {};
  listingsRouter.applyPublicBrowseFilter(where, undefined, undefined);
  assert.deepEqual(where.status, PUBLIC_STATUS_FILTER);
  assert.equal(where.isFlaggedForFraud, false);
  assert.deepEqual(where.AND, [PUBLIC_RISK_FILTER]);
  rejectInvalidRiskStateWhere(where);

  let PrismaClient;
  let PrismaPg;
  let pg;
  try {
    ({ PrismaClient } = require("../../packages/db/node_modules/@prisma/client"));
    ({ PrismaPg } = require("../../packages/db/node_modules/@prisma/adapter-pg"));
    pg = require("../../packages/db/node_modules/pg");
  } catch {
    return;
  }

  const pool = new pg.Pool({
    host: "127.0.0.1",
    port: 1,
    database: "db",
    user: "u",
    password: "p",
    connectionTimeoutMillis: 200,
    max: 1,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    await prisma.listing.findMany({ where, take: 1 });
    assert.fail("expected the unreachable database, not a skipped query");
  } catch (error) {
    assert.notEqual(error.name, "PrismaClientValidationError", error.message);
    assert.match(error.message, /Can't reach database server/);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
});

test("GET /api/listings lets an admin request a non-verified status", async () => {
  const { prisma, seen } = browsePrisma();
  const token = jwt.sign({ id: 9, email: "admin@example.com", name: "Admin", role: "STUDIO_ADMIN" }, process.env.JWT_SECRET);
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings?status=PENDING`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(seen.args.where.status, "PENDING");
    assert.equal(seen.args.where.AND, undefined);
    assert.equal(seen.args.where.isFlaggedForFraud, undefined);
    assert.deepEqual(body.data.map((row) => row.id), [1, 2, 3]);
  } finally {
    server.close();
  }
});

test("GET /api/listings/:id returns a non-sample pending home with a not-verified label", async () => {
  const prisma = {
    listing: {
      findUnique: async () => ({
        id: 4,
        title: "Pending bungalow",
        status: "PENDING",
        riskState: "UNVERIFIED",
        isFlaggedForFraud: false,
        price: 400000,
        totalMoveInCost: { total: 400000 },
        images: [],
        property: null,
        owner: { id: 1, name: "Ada", truthIndex: 0, isVerified: false },
        fraudSignals: [],
        _count: { reviews: 0, bookings: 0 },
      }),
    },
    review: { aggregate: async () => ({ _avg: { rating: null }, _count: 0 }) },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings/4`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.status, "PENDING");
    assert.equal(body.data.verificationLabel, "Not verified by Lodgist");
    assert.equal(body.data.sourceLabel, "Direct submission");
    assert.equal(body.data.actions.enquiry, true);
    assert.equal(body.data.actions.viewing, false);
  } finally {
    server.close();
  }
});

test("GET /api/listings/:id hides sample listings from anonymous discovery", async () => {
  const prisma = {
    listing: {
      findUnique: async () => ({
        id: 5,
        title: "Sample flat",
        status: "VERIFIED",
        riskState: "VERIFIED",
        isFlaggedForFraud: false,
        totalMoveInCost: { sample: true, total: 1 },
        images: [],
        property: null,
        owner: { id: 1, name: "Ada", truthIndex: 0, isVerified: false },
        fraudSignals: [],
        _count: { reviews: 0, bookings: 0 },
      }),
    },
    review: { aggregate: async () => ({ _avg: { rating: null }, _count: 0 }) },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings/5`);
    const body = await res.json();
    assert.equal(res.status, 404);
    assert.equal(body.error, "Listing not found");
    assert.equal(JSON.stringify(body).includes("Sample flat"), false);
  } finally {
    server.close();
  }
});

test("approxLocation snaps to a 0.005° grid and rejects bad input", () => {
  const { approxLocation } = listingsRouter;
  assert.deepEqual(approxLocation(5.4836, 7.0333), { lat: 5.485, lng: 7.035, radius_m: 500 });
  assert.deepEqual(approxLocation(5.4824, 7.0324), { lat: 5.48, lng: 7.03, radius_m: 500 });
  assert.equal(approxLocation(null, 7.03), null);
  assert.equal(approxLocation(5.48, undefined), null);
  assert.equal(approxLocation("5.48", "7.03"), null);
  assert.equal(approxLocation(NaN, 7.03), null);
  assert.equal(approxLocation(91, 7.03), null);
  assert.equal(approxLocation(5.48, 181), null);
});
