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
      findFirst: async ({ where, orderBy }) => {
        const matched = rows.filter((row) => {
          if (where.id != null && row.id !== where.id) return false;
          if (where.listingId != null && row.listingId !== where.listingId) return false;
          if (where.requesterId != null && row.requesterId !== where.requesterId) return false;
          if (where.status && where.status.in && !where.status.in.includes(row.status)) return false;
          return true;
        });
        if (orderBy && orderBy.createdAt === "desc") {
          matched.sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            if (bTime !== aTime) return bTime - aTime;
            return (b.id || 0) - (a.id || 0);
          });
        }
        return matched[0] || null;
      },
      findMany: async ({ where }) =>
        rows.filter((row) => row.listingId === where.listingId),
      update: async ({ where, data }) => {
        const row = rows.find((item) => item.id === where.id);
        if (!row) throw new Error("missing viewing request");
        Object.assign(row, data);
        state.updated = { ...data };
        return row;
      },
      create: async ({ data }) => {
        const row = { id: nextId++, ...data, createdAt: new Date() };
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

function authed(prisma, method, path, user, body) {
  return call(prisma, path, {
    method,
    headers: user ? { Authorization: token(user) } : {},
    body,
  });
}

test("detail request then advertiser accept does not change verification", async () => {
  const state = {};
  const prisma = viewingPrisma(state);
  let listingWrites = 0;
  prisma.listing.update = async () => {
    listingWrites += 1;
    throw new Error("listing must not be updated");
  };
  const created = await post(prisma, "/api/listings/10/viewing-requests", TENANT, FUTURE);
  assert.equal(created.status, 201);
  const createdBody = JSON.parse(created.text);

  const stranger = { id: 9, role: "LANDLORD", email: "other@example.com", name: "Other" };
  const denied = await authed(prisma, "GET", "/api/listings/10/viewing-requests", stranger);
  assert.equal(denied.status, 403);

  const listed = await authed(prisma, "GET", "/api/listings/10/viewing-requests", LANDLORD);
  const listedBody = JSON.parse(listed.text);
  assert.equal(listed.status, 200);
  assert.equal(listedBody.data.length, 1);
  assert.equal(listedBody.data[0].id, createdBody.data.id);
  assert.equal(listedBody.data[0].status, "REQUESTED");
  assert.equal(listed.text.includes("08031234567"), false);

  const renterAnswer = await authed(
    prisma,
    "PATCH",
    `/api/listings/10/viewing-requests/${createdBody.data.id}`,
    TENANT,
    { decision: "accept" }
  );
  assert.equal(renterAnswer.status, 403);

  const accepted = await authed(
    prisma,
    "PATCH",
    `/api/listings/10/viewing-requests/${createdBody.data.id}`,
    LANDLORD,
    { decision: "accept" }
  );
  const acceptedBody = JSON.parse(accepted.text);
  assert.equal(accepted.status, 200);
  assert.equal(acceptedBody.data.status, "SCHEDULED");
  assert.equal(state.rows[0].status, "SCHEDULED");
  assert.equal(listingWrites, 0);
  assert.equal(state.rows[0].listingId, 10);

  const again = await authed(
    prisma,
    "PATCH",
    `/api/listings/10/viewing-requests/${createdBody.data.id}`,
    LANDLORD,
    { decision: "decline" }
  );
  assert.equal(again.status, 409);
});

test("advertiser decline cancels a requested viewing", async () => {
  const state = {};
  const prisma = viewingPrisma(state);
  const created = await post(prisma, "/api/listings/10/viewing-requests", TENANT, FUTURE);
  const id = JSON.parse(created.text).data.id;
  const bad = await authed(prisma, "PATCH", `/api/listings/10/viewing-requests/${id}`, LANDLORD, {
    decision: "maybe",
  });
  assert.equal(bad.status, 400);
  const declined = await authed(prisma, "PATCH", `/api/listings/10/viewing-requests/${id}`, LANDLORD, {
    decision: "decline",
  });
  assert.equal(declined.status, 200);
  assert.equal(JSON.parse(declined.text).data.status, "CANCELLED");
  const adminList = await authed(prisma, "GET", "/api/listings/10/viewing-requests", ADMIN);
  assert.equal(adminList.status, 200);
  assert.equal(JSON.parse(adminList.text).data[0].status, "CANCELLED");});

test("renter can read their own viewing request without notes", async () => {
  const state = {
    rows: [
      {
        id: 77,
        listingId: 10,
        requesterId: 5,
        status: "REQUESTED",
        preferredDate: new Date("2030-06-15T00:00:00.000Z"),
        preferredTime: "10:00",
        notes: "Call 08031234567",
        createdAt: new Date("2030-01-02T00:00:00.000Z"),
      },
    ],
  };
  const res = await call(viewingPrisma(state), "/api/listings/10/viewing-requests/mine", {
    method: "GET",
    headers: { Authorization: token(TENANT) },
  });
  assert.equal(res.status, 200);
  const body = JSON.parse(res.text);
  assert.equal(body.success, true);
  assert.equal(body.data.id, 77);
  assert.equal(body.data.status, "REQUESTED");
  assert.equal(body.data.preferredDate, "2030-06-15");
  assert.equal(body.data.notes, undefined);
  assert.equal(res.text.includes("08031234567"), false);
  assert.equal(state.created, undefined);
});

test("a renter cannot read another renter viewing request", async () => {
  const state = {
    rows: [
      {
        id: 77,
        listingId: 10,
        requesterId: 5,
        status: "REQUESTED",
        preferredDate: new Date("2030-06-15T00:00:00.000Z"),
        preferredTime: "10:00",
        notes: "Call 08031234567",
      },
    ],
  };
  const other = { id: 8, role: "TENANT", email: "other@example.com", name: "Other" };
  const res = await call(viewingPrisma(state), "/api/listings/10/viewing-requests/mine", {
    method: "GET",
    headers: { Authorization: token(other) },
  });
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(res.text).data, null);
  assert.equal(res.text.includes("08031234567"), false);
});

test("only a renter can read their viewing request", async () => {
  const state = {
    rows: [
      {
        id: 77,
        listingId: 10,
        requesterId: 6,
        status: "REQUESTED",
        preferredDate: new Date("2030-06-15T00:00:00.000Z"),
        notes: "Call 08031234567",
      },
    ],
  };
  for (const user of [LANDLORD, ADMIN, { id: 9, role: "AGENT" }]) {
    const res = await call(viewingPrisma(state), "/api/listings/10/viewing-requests/mine", {
      method: "GET",
      headers: { Authorization: token(user) },
    });
    assert.equal(res.status, 403, user.role);
    assert.equal(res.text.includes("08031234567"), false);
  }
  const missing = await call(viewingPrisma(state), "/api/listings/10/viewing-requests/mine", {
    method: "GET",
  });
  assert.equal(missing.status, 401);
  const badId = await call(viewingPrisma(state), "/api/listings/10abc/viewing-requests/mine", {
    method: "GET",
    headers: { Authorization: token(TENANT) },
  });
  assert.equal(badId.status, 400);
});

test("renter sees the latest viewing status, not an older row", async () => {
  const state = {
    rows: [
      {
        id: 70,
        listingId: 10,
        requesterId: 5,
        status: "CANCELLED",
        preferredDate: new Date("2030-06-01T00:00:00.000Z"),
        createdAt: new Date("2030-01-01T00:00:00.000Z"),
        notes: "old phone 08031111111",
      },
      {
        id: 80,
        listingId: 10,
        requesterId: 5,
        status: "SCHEDULED",
        preferredDate: new Date("2030-07-01T00:00:00.000Z"),
        preferredTime: "14:00",
        createdAt: new Date("2030-02-01T00:00:00.000Z"),
        notes: "new phone 08039999999",
      },
    ],
  };
  const res = await call(viewingPrisma(state), "/api/listings/10/viewing-requests/mine", {
    method: "GET",
    headers: { Authorization: token(TENANT) },
  });
  assert.equal(res.status, 200);
  const body = JSON.parse(res.text);
  assert.equal(body.data.id, 80);
  assert.equal(body.data.status, "SCHEDULED");
  assert.equal(body.data.preferredDate, "2030-07-01");
  assert.equal(res.text.includes("08039999999"), false);
  assert.equal(res.text.includes("08031111111"), false);
});
