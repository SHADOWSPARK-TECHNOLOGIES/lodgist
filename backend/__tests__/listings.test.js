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


function isSampleMatchWhere(where) {
  const sample = listingsRouter.publicSampleMatchFilter();
  const and = where && where.AND;
  if (!Array.isArray(and)) return false;
  return and.some((clause) => JSON.stringify(clause) === JSON.stringify(sample));
}

/** Mock count that mirrors countPublicBrowse: raw = eligible+samples, sample query = samples. */
function publicListCount({ eligible, samples = 0 }) {
  return async (args) => {
    if (isSampleMatchWhere(args.where)) return samples;
    return eligible + samples;
  };
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
      count: publicListCount({ eligible: 1 }),
      findMany: async (args) => {
        assert.equal(args.select.riskState, true);
        assert.equal(args.select.truthIndex, true);
        assert.equal(args.select.reviewStatus, true);
        assert.equal(args.select.owner.select.email, undefined);
        return [{
          id: 7,
          title: "Two bedroom in Owerri",
          status: "PENDING",
          reviewStatus: "APPROVED",
          riskState: "UNVERIFIED",
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
      count: publicListCount({ eligible: 30 }),
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
    assert.deepEqual(seen.where.property.is.OR, [
      { city: { contains: "Owerri", mode: "insensitive" } },
      { lga: { contains: "Owerri", mode: "insensitive" } },
      { state: { contains: "Owerri", mode: "insensitive" } },
    ]);
    assert.deepEqual(body.pagination, { total: 30, page: 2, pages: 6, totalPages: 6, limit: 5, pageSize: 5 });
  } finally {
    server.close();
  }
});

function textContains(value, needle) {
  return typeof value === "string"
    && typeof needle === "string"
    && value.toLowerCase().includes(needle.toLowerCase());
}

function clauseMatchesRecord(record, clause) {
  const field = Object.keys(clause)[0];
  const cond = clause[field];
  if (!cond || typeof cond !== "object" || typeof cond.contains !== "string") return false;
  return textContains(record[field], cond.contains);
}

function listingMatchesBrowseWhere(listing, where) {
  if (Array.isArray(where && where.OR) && where.OR.length > 0) {
    const hit = where.OR.some((clause) =>
      clauseMatchesRecord(listing, clause) || clauseMatchesRecord(listing.property || {}, clause)
    );
    if (!hit) return false;
  }
  const propertyWhere = where && where.property && where.property.is;
  if (propertyWhere && Array.isArray(propertyWhere.OR)) {
    const hit = propertyWhere.OR.some((clause) => clauseMatchesRecord(listing.property || {}, clause));
    if (!hit) return false;
  }
  return true;
}

const PRIVATE_LOCATION_LISTING = {
  id: 21,
  title: "Two bedroom flat",
  description: "Quiet compound",
  status: "VERIFIED",
  reviewStatus: "APPROVED",
  riskState: "UNVERIFIED",
  isFlaggedForFraud: false,
  price: 900000,
  images: [],
  property: {
    id: 4,
    city: "Owerri",
    state: "Imo",
    lga: "Owerri Municipal",
    address: "14 Secret Close",
    landmark: "Behind the old post office",
    bedrooms: 2,
    bathrooms: 1,
    propertyType: "Apartment",
  },
  owner: { id: 3, name: "Ada", truthIndex: 70, isVerified: false },
  fraudSignals: [],
  _count: { reviews: 0, bookings: 0 },
};

function privateLocationPrisma() {
  const listing = PRIVATE_LOCATION_LISTING;
  return {
    listing: {
      count: async (args) => {
        if (isSampleMatchWhere(args.where)) return 0;
        return listingMatchesBrowseWhere(listing, args.where) ? 1 : 0;
      },
      findMany: async (args) => (listingMatchesBrowseWhere(listing, args.where) ? [listing] : []),
    },
    review: { groupBy: async () => [] },
  };
}

async function listingsFor(query) {
  const server = await listen(buildApp(privateLocationPrisma()));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings?${query}`);
    const body = await res.json();
    assert.equal(res.status, 200);
    return body.data;
  } finally {
    server.close();
  }
}

test("GET /api/listings?area= returns nothing when the query matches only the street address", async () => {
  const data = await listingsFor("area=14%20Secret%20Close");
  assert.deepEqual(data, []);
});

test("GET /api/listings?area= returns nothing when the query matches only a landmark", async () => {
  const data = await listingsFor("area=Behind%20the%20old%20post%20office");
  assert.deepEqual(data, []);
});

test("GET /api/listings?area= returns the listing when the query matches the public city or area", async () => {
  const byCity = await listingsFor("area=Owerri");
  assert.equal(byCity.length, 1);
  assert.equal(byCity[0].id, 21);
  assert.equal(byCity[0].property.address, undefined);
  assert.equal(byCity[0].property.landmark, undefined);

  const byArea = await listingsFor("area=Owerri%20Municipal");
  assert.equal(byArea.length, 1);
  assert.equal(byArea[0].id, 21);
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
          reviewStatus: "APPROVED",
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
      count: publicListCount({ eligible: 2, samples: 1 }),
      findMany: async (args) => {
        seen.args = args;
        return [
          {
            id: 1,
            title: "Checked flat",
            status: "VERIFIED",
            reviewStatus: "APPROVED",
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
            reviewStatus: "APPROVED",
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
            reviewStatus: "NOT_REVIEWED",
            riskState: "UNVERIFIED",
            isFlaggedForFraud: false,
            totalMoveInCost: { total: 800000 },
            images: [],
            property: { city: "Owerri", state: "Imo" },
            owner: { id: 1, name: "Ada", truthIndex: 0 },
            fraudSignals: [],
            _count: { reviews: 0, bookings: 0 },
          },
          {
            id: 4,
            title: "Reviewed pending flat",
            status: "PENDING",
            reviewStatus: "APPROVED",
            riskState: "UNVERIFIED",
            isFlaggedForFraud: false,
            totalMoveInCost: { total: 700000 },
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
    assert.equal(seen.args.where.reviewStatus, "APPROVED");
    assert.deepEqual(body.data.map((row) => row.id), [1, 4]);
    assert.equal(body.pagination.total, 2);
    assert.equal(JSON.stringify(body).includes("Sample flat"), false);
    assert.equal(JSON.stringify(body).includes("Pending flat"), false);
    const pending = body.data.find((row) => row.id === 4);
    assert.equal(pending.status, "PENDING");
    assert.equal(pending.verificationLabel, "Not verified by Lodgist");
    assert.equal(pending.reviewLabel, "Lodgist-reviewed");
    assert.equal(pending.reviewStatus, "APPROVED");
    assert.equal(pending.sourceLabel, "Direct submission");
    assert.equal(pending.actions.enquiry, true);
    assert.equal(pending.actions.viewing, false);
    const verified = body.data.find((row) => row.id === 1);
    assert.equal(verified.verificationLabel, "Not verified by Lodgist");
    assert.equal(verified.reviewLabel, "Lodgist-reviewed");
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
      reviewStatus: "APPROVED",
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
        return publicListCount({ eligible: 1, samples: 1 })(args);
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
    assert.equal(seen.where.reviewStatus, "APPROVED");
    assert.deepEqual(seen.where.AND, [PUBLIC_RISK_FILTER]);
    assert.deepEqual(body.data.map((row) => row.id), [11]);
    assert.equal(body.pagination.total, 1);
    assert.equal(body.data[0].riskState, null);
    assert.equal(JSON.stringify(body).includes("Sample unscored flat"), false);
  } finally {
    server.close();
  }
});


test("anonymous public count is 0 when only samples exist", async () => {
  const samples = [1, 2, 3, 4].map((id) => ({
    id,
    title: `Sample ${id}`,
    status: "PENDING",
    reviewStatus: "APPROVED",
    riskState: "UNVERIFIED",
    isFlaggedForFraud: false,
    totalMoveInCost: { sample: true, total: id },
    images: [],
    property: { city: "Owerri", state: "Imo" },
    owner: { id: 1, name: "Demo", truthIndex: 0 },
    fraudSignals: [],
    _count: { reviews: 0, bookings: 0 },
  }));
  let countCalls = 0;
  const prisma = {
    listing: {
      count: async (args) => {
        countCalls += 1;
        rejectInvalidRiskStateWhere(args.where);
        assert.deepEqual(args.where.status, PUBLIC_STATUS_FILTER);
        assert.equal(args.where.isFlaggedForFraud, false);
        return publicListCount({ eligible: 0, samples: samples.length })(args);
      },
      findMany: async (args) => {
        assert.deepEqual(args.where.status, PUBLIC_STATUS_FILTER);
        return samples;
      },
    },
    review: { groupBy: async () => [] },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings?limit=5`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(countCalls, 2);
    assert.deepEqual(body.data, []);
    assert.equal(body.pagination.total, 0);
    assert.equal(body.pagination.pages, 0);
    assert.equal(body.pagination.totalPages, 0);
    assert.equal(JSON.stringify(body).includes("Sample "), false);
  } finally {
    server.close();
  }
});

test("anonymous public count matches eligible PENDING rows", async () => {
  const rows = [
    {
      id: 21,
      title: "Pending A",
      status: "PENDING",
      reviewStatus: "APPROVED",
      riskState: "UNVERIFIED",
      isFlaggedForFraud: false,
      totalMoveInCost: { total: 500000 },
      images: [],
      property: { city: "Owerri", state: "Imo" },
      owner: { id: 1, name: "Ada", truthIndex: 0 },
      fraudSignals: [],
      _count: { reviews: 0, bookings: 0 },
    },
    {
      id: 22,
      title: "Sample B",
      status: "PENDING",
      riskState: "UNVERIFIED",
      isFlaggedForFraud: false,
      totalMoveInCost: { sample: true, total: 1 },
      images: [],
      property: { city: "Owerri", state: "Imo" },
      owner: { id: 1, name: "Ada", truthIndex: 0 },
      fraudSignals: [],
      _count: { reviews: 0, bookings: 0 },
    },
    {
      id: 23,
      title: "Pending C",
      status: "PENDING",
      reviewStatus: "APPROVED",
      riskState: "UNDER_REVIEW",
      isFlaggedForFraud: false,
      totalMoveInCost: { total: 700000 },
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
        assert.deepEqual(args.where.status, PUBLIC_STATUS_FILTER);
        assert.equal(args.where.isFlaggedForFraud, false);
        assert.deepEqual(
          args.where.AND.slice(0, 1),
          [PUBLIC_RISK_FILTER],
        );
        return publicListCount({ eligible: 2, samples: 1 })(args);
      },
      findMany: async () => rows,
    },
    review: { groupBy: async () => [] },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings?limit=5`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual(body.data.map((row) => row.id), [21, 23]);
    assert.equal(body.pagination.total, body.data.length);
    assert.equal(body.pagination.total, 2);
    assert.equal(body.data.every((row) => row.status === "PENDING"), true);
    assert.equal(body.data.every((row) => row.reviewStatus === "APPROVED"), true);
    assert.equal(body.data.every((row) => row.verificationLabel === "Not verified by Lodgist"), true);
    assert.equal(JSON.stringify(body).includes("Sample B"), false);
  } finally {
    server.close();
  }
});

test("countPublicBrowse subtracts sample match for public mode only", async () => {
  const where = {};
  listingsRouter.applyPublicBrowseFilter(where, undefined, undefined);
  const calls = [];
  const prisma = {
    listing: {
      count: async (args) => {
        calls.push(args.where);
        return publicListCount({ eligible: 3, samples: 4 })(args);
      },
    },
  };
  const total = await listingsRouter.countPublicBrowse(prisma, where, "public");
  assert.equal(total, 3);
  assert.equal(calls.length, 2);
  assert.equal(isSampleMatchWhere(calls[0]), false);
  assert.equal(isSampleMatchWhere(calls[1]), true);
  assert.deepEqual(calls[1].AND.slice(0, -1), calls[0].AND);
  assert.deepEqual(calls[1].AND.at(-1), listingsRouter.publicSampleMatchFilter());

  const managementTotal = await listingsRouter.countPublicBrowse(prisma, { status: "PENDING" }, "management");
  assert.equal(managementTotal, 7);
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
    assert.deepEqual(body.data.map((row) => row.id), [1, 2, 3, 4]);
  } finally {
    server.close();
  }
});

test("GET /api/listings/:id hides an unreviewed home from anonymous discovery", async () => {
  const prisma = {
    listing: {
      findUnique: async () => ({
        id: 4,
        title: "Pending bungalow",
        status: "PENDING",
        reviewStatus: "NOT_REVIEWED",
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
    assert.equal(res.status, 404);
    assert.equal(body.error, "Listing not found");
    assert.equal(JSON.stringify(body).includes("Pending bungalow"), false);
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

test("GET /api/listings/:id can be Lodgist-reviewed without a verified badge", async () => {
  const prisma = {
    listing: {
      findUnique: async () => ({
        id: 8,
        title: "Reviewed flat",
        status: "VERIFIED",
        riskState: "VERIFIED",
        reviewStatus: "APPROVED",
        isFlaggedForFraud: false,
        price: 800000,
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
    const res = await fetch(`http://127.0.0.1:${port}/api/listings/8`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.reviewStatus, "APPROVED");
    assert.equal(body.data.reviewLabel, "Lodgist-reviewed");
    assert.equal(body.data.verificationLabel, "Not verified by Lodgist");
    assert.equal(body.data.actions.viewing, true);
  } finally {
    server.close();
  }
});

test("sample and unreviewed seed rows stay out of GET /api/listings", async () => {
  const { planOwerriSeed, loadFacts } = require("../../packages/db/prisma/seed-owerri-home");
  const unpublished = planOwerriSeed(loadFacts());
  assert.equal(unpublished.publicDiscoverable, false);
  const rows = [
    {
      id: 101,
      ...unpublished.listing,
      images: [],
      property: unpublished.property,
      owner: { id: 1, name: unpublished.user.name, truthIndex: 0, isVerified: false },
      fraudSignals: [],
      _count: { reviews: 0, bookings: 0 },
    },
    {
      id: 102,
      title: "Unreviewed Nekede room",
      description: "Not reviewed",
      status: "PENDING",
      reviewStatus: "NOT_REVIEWED",
      riskState: "UNVERIFIED",
      isFlaggedForFraud: false,
      price: 1,
      totalMoveInCost: { total: 1 },
      images: [],
      property: { city: "Owerri", state: "Imo" },
      owner: { id: 1, name: "Ada", truthIndex: 0, isVerified: false },
      fraudSignals: [],
      _count: { reviews: 0, bookings: 0 },
    },
    {
      id: 103,
      title: "Reviewed sample",
      status: "VERIFIED",
      reviewStatus: "APPROVED",
      riskState: "UNVERIFIED",
      isFlaggedForFraud: false,
      totalMoveInCost: { sample: true },
      images: [],
      property: { city: "Owerri", state: "Imo" },
      owner: { id: 1, name: "Ada", truthIndex: 0, isVerified: false },
      fraudSignals: [],
      _count: { reviews: 0, bookings: 0 },
    },
    {
      id: 104,
      title: "Reviewed pending home",
      status: "PENDING",
      reviewStatus: "APPROVED",
      riskState: "UNVERIFIED",
      isFlaggedForFraud: false,
      price: 450000,
      totalMoveInCost: { total: 450000 },
      images: [],
      property: { city: "Owerri", state: "Imo" },
      owner: { id: 1, name: "Ada", truthIndex: 0, isVerified: false },
      fraudSignals: [],
      _count: { reviews: 0, bookings: 0 },
    },
  ];
  let seen;
  const prisma = {
    listing: {
      count: publicListCount({ eligible: 1, samples: 1 }),
      findMany: async (args) => {
        seen = args;
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
    assert.equal(seen.where.reviewStatus, "APPROVED");
    assert.deepEqual(body.data.map((row) => row.id), [104]);
    assert.equal(body.data[0].reviewLabel, "Lodgist-reviewed");
    assert.equal(body.data[0].verificationLabel, "Not verified by Lodgist");
    assert.equal(body.data[0].actions.viewing, false);
    assert.equal(body.pagination.total, 1);
    const json = JSON.stringify(body);
    assert.equal(json.includes("Unpublished seed"), false);
    assert.equal(json.includes("Unreviewed Nekede room"), false);
    assert.equal(json.includes("Reviewed sample"), false);
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

test("signed-in and anonymous callers do not receive exact coordinates", async () => {
  const property = {
    id: 9,
    city: "Owerri",
    state: "Imo",
    lga: "Owerri West",
    latitude: 5.497123,
    longitude: 7.033812,
    address: "12 Hidden Road",
  };
  const seen = {};
  function appFor(listing) {
    return buildApp({
      listing: {
        findUnique: async (args) => {
          seen.select = args.select;
          const selected = args.select && args.select.property && args.select.property.select;
          const projected = {};
          if (selected && listing.property) {
            Object.keys(selected).forEach((key) => {
              if (selected[key]) projected[key] = listing.property[key];
            });
          }
          return { ...listing, property: listing.property ? projected : null };
        },
      },
      review: { aggregate: async () => ({ _avg: { rating: null }, _count: 0 }) },
    });
  }
  const published = {
    id: 1,
    title: "Home",
    status: "VERIFIED",
    reviewStatus: "APPROVED",
    riskState: "UNVERIFIED",
    isFlaggedForFraud: false,
    price: 1,
    images: [],
    property,
    owner: { id: 1, name: "Ada" },
    fraudSignals: [],
    _count: { reviews: 0, bookings: 0 },
  };
  const unpublished = { ...published, reviewStatus: "NOT_REVIEWED", status: "PENDING" };
  const renter = jwt.sign({ id: 5, email: "renter@example.com", name: "Renter", role: "USER" }, process.env.JWT_SECRET);
  const admin = jwt.sign({ id: 9, email: "admin@example.com", name: "Admin", role: "STUDIO_ADMIN" }, process.env.JWT_SECRET);

  async function hit(listing, token) {
    const server = await listen(appFor(listing));
    try {
      const { port } = server.address();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`http://127.0.0.1:${port}/api/listings/1`, { headers });
      const text = await res.text();
      return { status: res.status, text, body: JSON.parse(text) };
    } finally {
      server.close();
    }
  }

  function assertNoExact(text, body) {
    assert.equal(text.includes("5.497123"), false);
    assert.equal(text.includes("7.033812"), false);
    assert.equal(text.includes("\"latitude\""), false);
    assert.equal(text.includes("\"longitude\""), false);
    assert.equal(text.includes("12 Hidden Road"), false);
    if (body && body.data && body.data.property) {
      assert.equal(body.data.property.latitude, undefined);
      assert.equal(body.data.property.longitude, undefined);
      assert.equal(body.data.property.address, undefined);
    }
  }

  const anonHidden = await hit(unpublished, null);
  assert.equal(anonHidden.status, 404);
  assertNoExact(anonHidden.text, anonHidden.body);

  const renterHidden = await hit(unpublished, renter);
  assert.equal(renterHidden.status, 404);
  assertNoExact(renterHidden.text, renterHidden.body);

  const renterPublic = await hit(published, renter);
  assert.equal(renterPublic.status, 200);
  assertNoExact(renterPublic.text, renterPublic.body);
  assert.equal(renterPublic.body.data.property.city, "Owerri");

  const adminPublic = await hit(published, admin);
  assert.equal(adminPublic.status, 200);
  assertNoExact(adminPublic.text, adminPublic.body);

  const adminHidden = await hit(unpublished, admin);
  assert.equal(adminHidden.status, 200);
  assertNoExact(adminHidden.text, adminHidden.body);
  assert.equal(seen.select.property.select.address, undefined);
  assert.equal(seen.select.property.select.landmark, undefined);
  assert.equal(adminHidden.body.data.property.city, "Owerri");
  assert.deepEqual(adminHidden.body.data.approxLocation, { lat: 5.495, lng: 7.035, radius_m: 500 });
});

test("an owning landlord can open an unpublished listing without exact coordinates", async () => {
  const property = {
    id: 9,
    city: "Owerri",
    state: "Imo",
    lga: "Owerri West",
    latitude: 5.497123,
    longitude: 7.033812,
    address: "12 Hidden Road",
  };
  const unpublished = {
    id: 1,
    title: "Home",
    status: "PENDING",
    reviewStatus: "NOT_REVIEWED",
    riskState: "UNVERIFIED",
    isFlaggedForFraud: false,
    price: 1,
    ownerId: 8,
    images: [],
    property,
    owner: { id: 8, name: "Ada" },
    fraudSignals: [],
    _count: { reviews: 0, bookings: 0 },
  };
  function appFor() {
    return buildApp({
      listing: {
        findUnique: async (args) => {
          const selected = args.select && args.select.property && args.select.property.select;
          const projected = {};
          if (selected) {
            Object.keys(selected).forEach((key) => {
              if (selected[key]) projected[key] = property[key];
            });
          }
          return { ...unpublished, property: projected };
        },
      },
      review: { aggregate: async () => ({ _avg: { rating: null }, _count: 0 }) },
    });
  }
  const owner = jwt.sign({ id: 8, email: "owner@example.com", name: "Ada", role: "LANDLORD" }, process.env.JWT_SECRET);
  const other = jwt.sign({ id: 9, email: "other@example.com", name: "Other", role: "LANDLORD" }, process.env.JWT_SECRET);
  async function hit(token) {
    const server = await listen(appFor());
    try {
      const { port } = server.address();
      const res = await fetch(`http://127.0.0.1:${port}/api/listings/1`, {
        headers: { Authorization: "Bearer " + token },
      });
      const text = await res.text();
      return { status: res.status, text, body: JSON.parse(text) };
    } finally {
      server.close();
    }
  }
  const denied = await hit(other);
  assert.equal(denied.status, 404);
  assert.equal(denied.text.includes("5.497123"), false);
  assert.equal(denied.text.includes("12 Hidden Road"), false);
  const allowed = await hit(owner);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.text.includes("5.497123"), false);
  assert.equal(allowed.text.includes("7.033812"), false);
  assert.equal(allowed.body.data.property.latitude, undefined);
  assert.equal(allowed.body.data.property.address, undefined);
  assert.deepEqual(allowed.body.data.approxLocation, { lat: 5.495, lng: 7.035, radius_m: 500 });
});
