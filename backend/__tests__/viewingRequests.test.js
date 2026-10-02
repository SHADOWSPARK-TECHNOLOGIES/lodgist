// POST /api/listings/:id/viewing-requests
// Duplicate rule: an open REQUESTED or SCHEDULED row for the same renter and
// listing is returned as-is (200, duplicate: true). CANCELLED, COMPLETED, and
// NO_SHOW do not block a new row. Requester id comes from the token only.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const listingsRouter = require("../src/routes/listings");

const TENANT = { id: 5, role: "USER", email: "tenant@example.com", name: "Tola" };
const LANDLORD = { id: 6, role: "LANDLORD", email: "land@example.com", name: "Ada" };
const ADMIN = { id: 1, role: "STUDIO_ADMIN", email: "admin@example.com", name: "Admin" };

function token(user) {
  return `Bearer ${jwt.sign(user, process.env.JWT_SECRET)}`;
}

function viewingPrisma(state = {}) {
  const listings = state.listings || [
    { id: 10, status: "VERIFIED", isFlaggedForFraud: false, ownerId: 6 },
  ];
  const rows = state.rows || [];
  let nextId = state.nextId || 100;
  return {
    listing: {
      findUnique: async ({ where }) => listings.find((row) => row.id === where.id) || null,
    },
    viewingRequest: {
      findFirst: async ({ where }) =>
        rows.find(
          (row) =>
            row.listingId === where.listingId &&
            row.requesterId === where.requesterId &&
            where.status.in.includes(row.status)
        ) || null,
      create: async ({ data }) => {
        const row = { id: nextId++, ...data };
        rows.push(row);
        state.created = data;
        state.rows = rows;
        return row;
      },
    },
  };
}

async function call(prisma, path, { method = "POST", headers = {}, body } = {}) {
  const app = express();
  app.use(express.json());
  app.use("/api/listings", listingsRouter(prisma));
  const server = await new Promise((resolve) => {
    const started = app.listen(0, "127.0.0.1", () => resolve(started));
  });
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, text: await res.text() };
  } finally {
    server.close();
  }
}

function post(prisma, path, user, body) {
  return call(prisma, path, {
    headers: user ? { Authorization: token(user) } : {},
    body,
  });
}

const FUTURE = { preferredDate: "2030-06-15", preferredTime: "10:00", notes: "Call 08031234567" };

test("tenant creates a viewing request on a verified listing", async () => {
  const state = {};
  const res = await post(viewingPrisma(state), "/api/listings/10/viewing-requests", TENANT, {
    ...FUTURE,
    requesterId: 999,
    listingId: 1,
  });
  const body = JSON.parse(res.text);
  assert.equal(res.status, 201);
  assert.equal(body.duplicate, false);
  assert.equal(body.data.id, 100);
  assert.equal(body.data.status, "REQUESTED");
  assert.equal(body.data.listingId, 10);
  assert.equal(body.data.preferredDate, "2030-06-15");
  assert.equal(body.data.preferredTime, "10:00");
  assert.equal(state.created.requesterId, 5);
  assert.equal(state.created.listingId, 10);
  assert.equal(state.created.status, "REQUESTED");
  assert.equal(state.created.notes, "Requested via web. Call 08031234567");
  assert.equal(state.created.preferredDate.toISOString().slice(0, 10), "2030-06-15");
  assert.equal(res.text.includes("08031234567"), false);
  assert.equal(res.text.includes("tenant@example.com"), false);
});

test("unauthorized viewing request is rejected before any write", async () => {
  const state = {};
  const prisma = viewingPrisma(state);
  prisma.listing.findUnique = async () => {
    throw new Error("should not read");
  };
  const missing = await post(prisma, "/api/listings/10/viewing-requests", null, FUTURE);
  assert.equal(missing.status, 401);
  const bad = await call(viewingPrisma(state), "/api/listings/10/viewing-requests", {
    headers: { Authorization: "Bearer not-a-token" },
    body: FUTURE,
  });
  assert.equal(bad.status, 401);
  assert.equal(state.created, undefined);
});

test("viewing request for a nonexistent listing is rejected", async () => {
  const state = {};
  const res = await post(viewingPrisma(state), "/api/listings/999/viewing-requests", TENANT, FUTURE);
  assert.equal(res.status, 404);
  assert.equal(JSON.parse(res.text).error, "Listing not found");
  assert.equal(state.created, undefined);
});

test("viewing follows action eligibility when it is stored", async () => {
  const enquiry = {
    listings: [{ id: 10, status: "VERIFIED", isFlaggedForFraud: false, ownerId: 6, actionEligibility: "ENQUIRY" }],
  };
  const closed = await post(viewingPrisma(enquiry), "/api/listings/10/viewing-requests", TENANT, FUTURE);
  assert.equal(closed.status, 403);
  assert.equal(JSON.parse(closed.text).code, "listing_not_verified");
  assert.equal(enquiry.created, undefined);

  const open = {
    listings: [{ id: 10, status: "PENDING", isFlaggedForFraud: false, ownerId: 6, actionEligibility: "VIEWING_REQUEST" }],
  };
  const res = await post(viewingPrisma(open), "/api/listings/10/viewing-requests", TENANT, FUTURE);
  assert.equal(res.status, 201);
  assert.equal(open.created.listingId, 10);
});

test("pending and fraud-flagged listings are not bookable for a viewing", async () => {
  for (const listing of [
    { id: 10, status: "PENDING", isFlaggedForFraud: false, ownerId: 6 },
    { id: 10, status: "VERIFIED", isFlaggedForFraud: true, ownerId: 6 },
    { id: 10, status: "REJECTED", isFlaggedForFraud: false, ownerId: 6 },
  ]) {
    const state = { listings: [listing] };
    const res = await post(viewingPrisma(state), "/api/listings/10/viewing-requests", TENANT, FUTURE);
    assert.equal(res.status, 403, listing.status);
    assert.equal(JSON.parse(res.text).code, "listing_not_verified");
    assert.equal(state.created, undefined);
  }
});

test("a TENANT role can create a viewing request", async () => {
  const state = {};
  const res = await post(
    viewingPrisma(state),
    "/api/listings/10/viewing-requests",
    { id: 8, role: "TENANT", email: "t@example.com", name: "Ngozi" },
    { preferredDate: "2030-09-01" }
  );
  assert.equal(res.status, 201);
  assert.equal(state.created.requesterId, 8);
  assert.equal(state.created.notes, "Requested via web");
});

test("duplicate open viewing request returns the existing reference", async () => {
  const state = {
    rows: [
      {
        id: 44,
        listingId: 10,
        requesterId: 5,
        status: "REQUESTED",
        preferredDate: new Date("2030-06-01T00:00:00.000Z"),
        preferredTime: "09:00",
        notes: "Requested via web",
      },
    ],
  };
  const res = await post(viewingPrisma(state), "/api/listings/10/viewing-requests", TENANT, {
    preferredDate: "2030-08-01",
    preferredTime: "18:00",
  });
  const body = JSON.parse(res.text);
  assert.equal(res.status, 200);
  assert.equal(body.duplicate, true);
  assert.equal(body.data.id, 44);
  assert.equal(body.data.preferredDate, "2030-06-01");
  assert.equal(body.data.preferredTime, "09:00");
  assert.equal(state.rows.length, 1);
  assert.equal(state.created, undefined);

  const scheduled = {
    rows: [
      {
        id: 45,
        listingId: 10,
        requesterId: 5,
        status: "SCHEDULED",
        preferredDate: new Date("2030-07-01T00:00:00.000Z"),
        preferredTime: "11:00",
      },
    ],
  };
  const again = await post(viewingPrisma(scheduled), "/api/listings/10/viewing-requests", TENANT, FUTURE);
  assert.equal(again.status, 200);
  assert.equal(JSON.parse(again.text).data.id, 45);
  assert.equal(scheduled.created, undefined);
});

test("a cancelled viewing request does not block a new one", async () => {
  const state = {
    rows: [
      {
        id: 44,
        listingId: 10,
        requesterId: 5,
        status: "CANCELLED",
        preferredDate: new Date("2030-06-01T00:00:00.000Z"),
        preferredTime: null,
      },
    ],
  };
  const res = await post(viewingPrisma(state), "/api/listings/10/viewing-requests", TENANT, {
    preferredDate: "2030-08-01",
  });
  assert.equal(res.status, 201);
  assert.equal(JSON.parse(res.text).duplicate, false);
  assert.equal(state.rows.length, 2);
  assert.equal(state.created.status, "REQUESTED");
});

test("landlords, admins, and the listing owner cannot create a viewing request", async () => {
  for (const user of [LANDLORD, ADMIN, { id: 9, role: "AGENT" }, { id: 8, role: "ARTISAN" }]) {
    const state = {};
    const res = await post(viewingPrisma(state), "/api/listings/10/viewing-requests", user, FUTURE);
    assert.equal(res.status, 403, user.role);
    assert.equal(state.created, undefined);
  }

  const state = {};
  const owner = await post(
    viewingPrisma(state),
    "/api/listings/10/viewing-requests",
    { id: 6, role: "USER", email: "owner@example.com", name: "Owner" },
    FUTURE
  );
  assert.equal(owner.status, 403);
  assert.equal(state.created, undefined);
});

test("viewing request rejects a bad date and does not write", async () => {
  for (const preferredDate of [undefined, "15-06-2030", "2030-02-31", "2020-01-01"]) {
    const state = {};
    const res = await post(viewingPrisma(state), "/api/listings/10/viewing-requests", TENANT, {
      preferredDate,
    });
    assert.equal(res.status, 400, String(preferredDate));
    assert.equal(state.created, undefined);
  }
  const badId = await post(viewingPrisma({}), "/api/listings/10abc/viewing-requests", TENANT, FUTURE);
  assert.equal(badId.status, 400);
});
