const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const listingsRouter = require("../src/routes/listings");
const adminListingsRouter = require("../src/routes/adminListings");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

function token(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET);
}

function buildApp(prisma) {
  const app = express();
  app.use(express.json());
  app.use("/api/listings", listingsRouter(prisma));
  app.use("/api/admin/listings", adminListingsRouter(prisma));
  return app;
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function isSampleWhere(where) {
  const cost = where && where.totalMoveInCost;
  return Boolean(cost && Array.isArray(cost.path) && cost.equals === true);
}

function matches(where, row) {
  if (!where || typeof where !== "object") return true;
  if (typeof where.status === "string" && row.status !== where.status) return false;
  if (where.status && Array.isArray(where.status.in) && !where.status.in.includes(row.status)) return false;
  if (typeof where.reviewStatus === "string" && row.reviewStatus !== where.reviewStatus) return false;
  if (typeof where.isFlaggedForFraud === "boolean" && Boolean(row.isFlaggedForFraud) !== where.isFlaggedForFraud) return false;
  if (where.id != null && row.id !== where.id) return false;
  if (where.ownerId != null && row.ownerId !== where.ownerId) return false;
  if (where.riskState && where.riskState.equals === null && row.riskState != null) return false;
  if (where.riskState && Array.isArray(where.riskState.in) && !where.riskState.in.includes(row.riskState)) return false;
  if (isSampleWhere(where) && !(row.totalMoveInCost && row.totalMoveInCost.sample === true)) return false;
  if (Array.isArray(where.AND) && !where.AND.every((clause) => matches(clause, row))) return false;
  if (Array.isArray(where.OR) && !where.OR.some((clause) => matches(clause, row))) return false;
  return true;
}

function memory(initial) {
  const rows = initial.map((row) => ({ ...row }));
  const calls = { update: 0, create: 0 };
  const prisma = {
    listing: {
      findMany: async ({ where }) => rows.filter((row) => matches(where, row)).map((row) => ({ ...row })),
      findUnique: async ({ where }) => {
        const row = rows.find((item) => item.id === where.id);
        return row ? { ...row } : null;
      },
      update: async ({ where, data }) => {
        calls.update += 1;
        const index = rows.findIndex((item) => item.id === where.id);
        rows[index] = { ...rows[index], ...data };
        return { ...rows[index] };
      },
      count: async ({ where }) => rows.filter((row) => matches(where, row)).length,
      create: async ({ data }) => {
        calls.create += 1;
        calls.created = data;
        return { id: 50, ...data };
      },
    },
    review: {
      groupBy: async () => [],
      aggregate: async () => ({ _avg: { rating: null }, _count: 0 }),
    },
  };
  return { rows, calls, prisma };
}

function home(overrides) {
  return {
    id: 4,
    title: "Two bedroom in Nekede",
    description: "A real home waiting for review.",
    price: 450000,
    currency: "NGN",
    status: "PENDING",
    reviewStatus: "NOT_REVIEWED",
    riskState: "UNVERIFIED",
    isFlaggedForFraud: false,
    totalMoveInCost: { total: 450000 },
    evidenceVerified: null,
    verifiedAt: null,
    verifiedById: null,
    rejectionReason: null,
    adminAudit: null,
    ownerId: 8,
    images: [],
    property: { city: "Owerri", state: "Imo", lga: "Nekede" },
    owner: { id: 8, name: "Ada" },
    fraudSignals: [],
    _count: { reviews: 0, bookings: 0 },
    ...overrides,
  };
}

const ADMIN = token({ id: 2, email: "admin@example.com", name: "Admin", role: "STUDIO_ADMIN" });
const OWNER = token({ id: 8, email: "ada@example.com", name: "Ada", role: "LANDLORD" });
const REFRESH = token({ id: 2, type: "refresh" });

async function call(server, method, path, { body, bearer, timeoutMs } = {}) {
  const { port } = server.address();
  const headers = { "Content-Type": "application/json" };
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: timeoutMs ? AbortSignal.timeout(timeoutMs) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, text };
}

test("listing approval is STUDIO_ADMIN only", async () => {
  const { calls, prisma } = memory([home()]);
  const server = await listen(buildApp(prisma));
  try {
    const missing = await call(server, "GET", "/api/admin/listings/pending");
    assert.equal(missing.status, 401);

    const owner = await call(server, "POST", "/api/admin/listings/4/approve", { bearer: OWNER });
    assert.equal(owner.status, 403);
    assert.equal(calls.update, 0);

    const selfVerify = await call(server, "POST", "/api/admin/listings/4/verify", { bearer: OWNER });
    assert.equal(selfVerify.status, 403);
    assert.equal(calls.update, 0);

    const pending = await call(server, "GET", "/api/admin/listings/pending", { bearer: ADMIN });
    assert.equal(pending.status, 200);
    assert.equal(pending.body.data.length, 1);
    assert.equal(pending.body.data[0].publicationState, "pending_review");
    assert.equal(pending.body.data[0].evidenceVerified, false);
    assert.equal(pending.body.data[0].verificationLabel, "Not verified by Lodgist");
  } finally {
    server.close();
  }
});

test("approve publishes without verifying, verify sets the badge, reject removes the home", async () => {
  const { rows, prisma } = memory([home()]);
  const server = await listen(buildApp(prisma));
  try {
    const before = await call(server, "GET", "/api/listings");
    assert.deepEqual(before.body.data, []);

    const approved = await call(server, "POST", "/api/admin/listings/4/approve", { bearer: ADMIN });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.data.publicationState, "published");
    assert.equal(approved.body.data.publiclyListed, true);
    assert.equal(approved.body.data.reviewStatus, "APPROVED");
    assert.equal(approved.body.data.reviewLabel, "Lodgist-reviewed");
    assert.equal(approved.body.data.status, "PENDING");
    assert.equal(approved.body.data.evidenceVerified, false);
    assert.equal(approved.body.data.verificationLabel, "Not verified by Lodgist");
    assert.equal(approved.body.data.latestAudit.action, "approve");
    assert.equal(approved.body.data.latestAudit.adminId, 2);
    assert.equal(approved.body.data.latestAudit.evidenceVerified, false);

    const published = await call(server, "GET", "/api/listings");
    assert.deepEqual(published.body.data.map((row) => row.id), [4]);
    assert.equal(published.body.data[0].verificationLabel, "Not verified by Lodgist");
    assert.equal(published.body.data[0].reviewLabel, "Lodgist-reviewed");
    assert.equal(published.body.data[0].evidenceVerified, false);
    assert.equal(published.body.pagination.total, 1);
    assert.equal(published.text.includes("verifiedById"), false);
    assert.equal(published.text.includes("adminAudit"), false);
    assert.equal(published.text.includes("rejectionReason"), false);

    const again = await call(server, "POST", "/api/admin/listings/4/approve", { bearer: ADMIN });
    assert.equal(again.body.unchanged, true);
    assert.equal(rows[0].adminAudit.length, 1);

    const verified = await call(server, "POST", "/api/admin/listings/4/verify", { bearer: ADMIN });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.data.evidenceVerified, true);
    assert.equal(verified.body.data.verificationLabel, "Verified by Lodgist");
    assert.equal(verified.body.data.verifiedById, 2);
    assert.ok(verified.body.data.verifiedAt);
    assert.equal(verified.body.data.reviewStatus, "APPROVED");
    assert.equal(verified.body.data.latestAudit.action, "verify");

    const badged = await call(server, "GET", "/api/listings/4");
    assert.equal(badged.status, 200);
    assert.equal(badged.body.data.verificationLabel, "Verified by Lodgist");
    assert.equal(badged.body.data.evidenceVerified, true);
    assert.equal(badged.body.data.reviewLabel, "Lodgist-reviewed");
    assert.equal(badged.text.includes("verifiedById"), false);

    const cleared = await call(server, "POST", "/api/admin/listings/4/unverify", { bearer: ADMIN });
    assert.equal(cleared.body.data.evidenceVerified, false);
    assert.equal(cleared.body.data.verificationLabel, "Not verified by Lodgist");
    assert.equal(cleared.body.data.publiclyListed, true);
    const stillPublic = await call(server, "GET", "/api/listings");
    assert.equal(stillPublic.body.data[0].verificationLabel, "Not verified by Lodgist");
    assert.equal(stillPublic.body.data[0].reviewLabel, "Lodgist-reviewed");

    const missingReason = await call(server, "POST", "/api/admin/listings/4/reject", { bearer: ADMIN, body: {} });
    assert.equal(missingReason.status, 400);

    const rejected = await call(server, "POST", "/api/admin/listings/4/reject", {
      bearer: ADMIN,
      body: { reason: "Photos do not match the address." },
    });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.data.publicationState, "rejected");
    assert.equal(rejected.body.data.publiclyListed, false);
    assert.equal(rejected.body.data.status, "REJECTED");
    assert.equal(rejected.body.data.reviewStatus, "NOT_REVIEWED");
    assert.equal(rejected.body.data.rejectionReason, "Photos do not match the address.");
    assert.equal(rejected.body.data.evidenceVerified, false);
    assert.equal(rejected.body.data.latestAudit.action, "reject");
    assert.equal(rejected.body.data.latestAudit.reason, "Photos do not match the address.");

    const hidden = await call(server, "GET", "/api/listings");
    assert.deepEqual(hidden.body.data, []);
    assert.equal(hidden.body.pagination.total, 0);
    const detail = await call(server, "GET", "/api/listings/4");
    assert.equal(detail.status, 404);
  } finally {
    server.close();
  }
});

test("a verified flag without a reviewer does not become the public badge", async () => {
  const { prisma } = memory([
    home({
      reviewStatus: "APPROVED",
      evidenceVerified: true,
      verifiedAt: null,
      verifiedById: null,
    }),
  ]);
  const server = await listen(buildApp(prisma));
  try {
    const res = await call(server, "GET", "/api/listings");
    assert.equal(res.body.data[0].evidenceVerified, false);
    assert.equal(res.body.data[0].verificationLabel, "Not verified by Lodgist");
    assert.equal(res.body.data[0].reviewLabel, "Lodgist-reviewed");
  } finally {
    server.close();
  }
});

test("example listings cannot be published or marked verified", async () => {
  const { calls, prisma } = memory([
    home({
      id: 9,
      title: "Sample flat",
      totalMoveInCost: { sample: true, total: 1 },
    }),
  ]);
  const server = await listen(buildApp(prisma));
  try {
    const approved = await call(server, "POST", "/api/admin/listings/9/approve", { bearer: ADMIN });
    assert.equal(approved.status, 409);
    const verified = await call(server, "POST", "/api/admin/listings/9/verify", { bearer: ADMIN });
    assert.equal(verified.status, 409);
    assert.equal(calls.update, 0);
    const res = await call(server, "GET", "/api/listings");
    assert.deepEqual(res.body.data, []);
  } finally {
    server.close();
  }
});

test("owners cannot publish or verify through the listing write routes", async () => {
  const { calls, prisma } = memory([home()]);
  const server = await listen(buildApp(prisma));
  try {
    const created = await call(server, "POST", "/api/listings", {
      bearer: OWNER,
      body: {
        title: "Ada's flat",
        description: "Two rooms near campus.",
        price: 300000,
        reviewStatus: "APPROVED",
        evidenceVerified: true,
        status: "VERIFIED",
      },
    });
    assert.equal(created.status, 201);
    assert.equal(calls.created.reviewStatus, "NOT_REVIEWED");
    assert.equal(calls.created.evidenceVerified, undefined);
    assert.equal(calls.created.status, undefined);
    assert.equal(calls.created.ownerId, 8);

    const updated = await call(server, "PUT", "/api/listings/4", {
      bearer: OWNER,
      body: { evidenceVerified: true, reviewStatus: "APPROVED", status: "VERIFIED" },
    });
    assert.equal(updated.status, 400);
    assert.equal(calls.update, 0);
  } finally {
    server.close();
  }
});

test("a refresh token is rejected as an access token", async () => {
  const { calls, prisma } = memory([home()]);
  const server = await listen(buildApp(prisma));
  try {
    const pending = await call(server, "GET", "/api/admin/listings/pending", { bearer: REFRESH });
    assert.equal(pending.status, 401);
    const approve = await call(server, "POST", "/api/admin/listings/4/approve", { bearer: REFRESH });
    assert.equal(approve.status, 401);
    const create = await call(server, "POST", "/api/listings", {
      bearer: REFRESH,
      body: { title: "Nope", description: "Nope nope nope.", price: 1 },
    });
    assert.equal(create.status, 401);
    assert.equal(calls.create, 0);
    assert.equal(calls.update, 0);

    const browse = await call(server, "GET", "/api/listings?status=REJECTED", { bearer: REFRESH });
    assert.equal(browse.status, 200);
    assert.deepEqual(browse.body.data, []);
    const seen = prisma.listing.findMany;
    assert.equal(typeof seen, "function");
  } finally {
    server.close();
  }
});

function verifiedHome(overrides) {
  return home({
    reviewStatus: "APPROVED",
    evidenceVerified: true,
    verifiedAt: "2026-04-01T12:00:00.000Z",
    verifiedById: 2,
    adminAudit: [
      {
        action: "verify",
        adminId: 2,
        listingId: 4,
        at: "2026-04-01T12:00:00.000Z",
        reason: null,
        publicationState: "published",
        evidenceVerified: true,
      },
    ],
    ...overrides,
  });
}

test("owner edits of price, description, or move-in cost clear verification and review", async () => {
  const { rows, prisma } = memory([
    verifiedHome(),
    verifiedHome({ id: 5, description: "Original description for this home." }),
    verifiedHome({ id: 6, totalMoveInCost: { total: 450000, currency: "NGN" } }),
  ]);
  const server = await listen(buildApp(prisma));
  try {
    const before = await call(server, "GET", "/api/listings");
    assert.deepEqual(before.body.data.map((row) => row.id), [4, 5, 6]);
    assert.equal(before.body.data.every((row) => row.verificationLabel === "Verified by Lodgist"), true);

    const priceEdit = await call(server, "PUT", "/api/listings/4", {
      bearer: OWNER,
      body: { price: 900000 },
    });
    assert.equal(priceEdit.status, 200);
    assert.equal(rows[0].price, 900000);
    assert.equal(rows[0].reviewStatus, "NOT_REVIEWED");
    assert.equal(rows[0].evidenceVerified, false);
    assert.equal(rows[0].verifiedAt, null);
    assert.equal(rows[0].verifiedById, null);
    assert.equal(rows[0].adminAudit[rows[0].adminAudit.length - 1].action, "owner_content_edit");
    assert.deepEqual(rows[0].adminAudit[rows[0].adminAudit.length - 1].changedFields, ["price"]);
    assert.equal(rows[0].adminAudit[rows[0].adminAudit.length - 1].evidenceVerified, false);
    assert.equal(rows[0].adminAudit[rows[0].adminAudit.length - 1].actorId, 8);

    const descriptionEdit = await call(server, "PUT", "/api/listings/5", {
      bearer: OWNER,
      body: { description: "Original description for this home. Rent is now different." },
    });
    assert.equal(descriptionEdit.status, 200);
    assert.equal(rows[1].reviewStatus, "NOT_REVIEWED");
    assert.equal(rows[1].evidenceVerified, false);
    assert.equal(rows[1].verifiedAt, null);
    assert.equal(rows[1].verifiedById, null);
    assert.deepEqual(rows[1].adminAudit[rows[1].adminAudit.length - 1].changedFields, ["description"]);

    const costEdit = await call(server, "PUT", "/api/listings/6", {
      bearer: OWNER,
      body: { totalMoveInCost: { total: 800000, currency: "NGN" } },
    });
    assert.equal(costEdit.status, 200);
    assert.equal(rows[2].reviewStatus, "NOT_REVIEWED");
    assert.equal(rows[2].evidenceVerified, false);
    assert.equal(rows[2].verifiedAt, null);
    assert.equal(rows[2].verifiedById, null);
    assert.deepEqual(rows[2].adminAudit[rows[2].adminAudit.length - 1].changedFields, ["totalMoveInCost"]);

    const listed = await call(server, "GET", "/api/listings");
    assert.deepEqual(listed.body.data, []);
    assert.equal(listed.text.includes("Verified by Lodgist"), false);

    for (const id of [4, 5, 6]) {
      const hidden = await call(server, "GET", `/api/listings/${id}`);
      assert.equal(hidden.status, 404);
      const ownerView = await call(server, "GET", `/api/listings/${id}`, { bearer: OWNER });
      assert.equal(ownerView.status, 200);
      assert.equal(ownerView.body.data.verificationLabel, "Not verified by Lodgist");
      assert.equal(ownerView.body.data.evidenceVerified, false);
      assert.equal(ownerView.body.data.reviewStatus, "NOT_REVIEWED");
      assert.equal(ownerView.body.data.reviewLabel, "Not reviewed by Lodgist");
      assert.equal(ownerView.text.includes("Verified by Lodgist"), false);
      assert.equal(ownerView.text.includes("verifiedById"), false);
      assert.equal(ownerView.text.includes("adminAudit"), false);
    }

    const pending = await call(server, "GET", "/api/admin/listings/pending", { bearer: ADMIN });
    assert.deepEqual(pending.body.data.map((row) => row.id), [4, 5, 6]);
    assert.equal(pending.body.data.every((row) => row.evidenceVerified === false), true);
    assert.equal(pending.body.data.every((row) => row.verificationLabel === "Not verified by Lodgist"), true);
    assert.equal(pending.body.data.every((row) => row.latestAudit.action === "owner_content_edit"), true);
  } finally {
    server.close();
  }
});

test("a no-op owner edit does not clear verification or review", async () => {
  const originalCost = { currency: "NGN", total: 450000 };
  const { rows, prisma } = memory([
    verifiedHome({ totalMoveInCost: { total: 450000, currency: "NGN" } }),
  ]);
  const server = await listen(buildApp(prisma));
  try {
    const same = await call(server, "PUT", "/api/listings/4", {
      bearer: OWNER,
      body: {
        price: 450000,
        description: "A real home waiting for review.",
        totalMoveInCost: originalCost,
      },
    });
    assert.equal(same.status, 200);
    assert.equal(rows[0].reviewStatus, "APPROVED");
    assert.equal(rows[0].evidenceVerified, true);
    assert.equal(rows[0].verifiedById, 2);
    assert.equal(rows[0].verifiedAt, "2026-04-01T12:00:00.000Z");
    assert.equal(rows[0].adminAudit.length, 1);
    assert.equal(rows[0].adminAudit[0].action, "verify");

    const samePriceAsText = await call(server, "PUT", "/api/listings/4", {
      bearer: OWNER,
      body: { price: "450000" },
    });
    assert.equal(samePriceAsText.status, 200);
    assert.equal(rows[0].reviewStatus, "APPROVED");
    assert.equal(rows[0].evidenceVerified, true);
    assert.equal(rows[0].verifiedById, 2);
    assert.equal(rows[0].adminAudit.length, 1);

    const publicListing = await call(server, "GET", "/api/listings/4");
    assert.equal(publicListing.status, 200);
    assert.equal(publicListing.body.data.verificationLabel, "Verified by Lodgist");
    assert.equal(publicListing.body.data.evidenceVerified, true);
    assert.equal(publicListing.body.data.reviewStatus, "APPROVED");
    assert.equal(publicListing.body.data.reviewLabel, "Lodgist-reviewed");
  } finally {
    server.close();
  }
});

test("admin listing actions return JSON 5xx when the database update fails", async () => {
  const unhandled = [];
  function onUnhandled(reason) {
    unhandled.push(reason);
  }
  process.on("unhandledRejection", onUnhandled);
  const store = memory([home()]);
  store.prisma.listing.update = async () => {
    throw new Error("database write failed");
  };
  const server = await listen(buildApp(store.prisma));
  try {
    const actions = [
      ["/api/admin/listings/4/approve", undefined],
      ["/api/admin/listings/4/reject", { reason: "Photos do not match the address." }],
      ["/api/admin/listings/4/verify", undefined],
    ];
    for (const [path, body] of actions) {
      const res = await call(server, "POST", path, { bearer: ADMIN, body, timeoutMs: 2000 });
      assert.equal(res.status, 500, path);
      assert.equal(res.body.success, false);
      assert.equal(typeof res.body.error, "string");
      assert.equal(res.body.error.length > 0, true);
      assert.equal(JSON.stringify(res.body).includes("database write failed"), false);
    }

    store.rows[0].evidenceVerified = true;
    store.rows[0].verifiedAt = "2026-04-01T12:00:00.000Z";
    store.rows[0].verifiedById = 2;
    const unverify = await call(server, "POST", "/api/admin/listings/4/unverify", {
      bearer: ADMIN,
      timeoutMs: 2000,
    });
    assert.equal(unverify.status, 500);
    assert.equal(unverify.body.success, false);
    assert.equal(typeof unverify.body.error, "string");
    assert.equal(JSON.stringify(unverify.body).includes("database write failed"), false);

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(unhandled.length, 0);

    const stillUp = await call(server, "GET", "/api/admin/listings/pending", { bearer: ADMIN });
    assert.equal(stillUp.status, 200);
  } finally {
    process.removeListener("unhandledRejection", onUnhandled);
    server.close();
  }
});

test("refresh token does not open the management listing filter", async () => {
  let seen;
  const prisma = {
    listing: {
      count: async () => 0,
      findMany: async (args) => {
        seen = args;
        return [];
      },
    },
    review: { groupBy: async () => [] },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings?status=REJECTED`, {
      headers: { Authorization: `Bearer ${REFRESH}` },
    });
    assert.equal(res.status, 200);
    assert.equal(seen.where.reviewStatus, "APPROVED");
    assert.notEqual(seen.where.status, "REJECTED");
  } finally {
    server.close();
  }
});

function assertNoPublicInternals(row) {
  assert.equal(Object.hasOwn(row, "ownerId"), false);
  assert.equal(Object.hasOwn(row, "fraudReason"), false);
  if (row.owner && typeof row.owner === "object") {
    assert.equal(Object.hasOwn(row.owner, "id"), false);
  }
}

test("public list, search, and detail omit ownerId, owner.id, and fraudReason", async () => {
  const { prisma } = memory([
    home({
      id: 4,
      reviewStatus: "APPROVED",
      fraudReason: "price far below area",
      owner: { id: 8, name: "Ada", truthIndex: 40 },
    }),
    home({
      id: 5,
      ownerId: 9,
      reviewStatus: "APPROVED",
      fraudReason: "duplicate photos",
      owner: { id: 9, name: "Emeka", truthIndex: 10 },
      title: "Flat near campus",
    }),
  ]);
  const server = await listen(buildApp(prisma));
  try {
    const list = await call(server, "GET", "/api/listings");
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.data.map((row) => row.id).sort(), [4, 5]);
    for (const row of list.body.data) assertNoPublicInternals(row);

    const search = await call(server, "GET", "/api/listings?search=campus");
    assert.equal(search.status, 200);
    for (const row of search.body.data) assertNoPublicInternals(row);

    const query = await call(server, "GET", "/api/listings?q=Nekede");
    assert.equal(query.status, 200);
    for (const row of query.body.data) assertNoPublicInternals(row);

    const detail = await call(server, "GET", "/api/listings/4");
    assert.equal(detail.status, 200);
    assertNoPublicInternals(detail.body.data);
    assert.equal(detail.body.data.owner.name, "Ada");

    const other = await call(server, "GET", "/api/listings/5", {
      bearer: token({ id: 8, email: "ada@example.com", name: "Ada", role: "LANDLORD" }),
    });
    assert.equal(other.status, 200);
    assertNoPublicInternals(other.body.data);

    const owner = await call(server, "GET", "/api/listings/4", { bearer: OWNER });
    assert.equal(owner.status, 200);
    assert.equal(owner.body.data.ownerId, 8);
    assert.equal(owner.body.data.owner.id, 8);
    assert.equal(owner.body.data.fraudReason, "price far below area");

    const admin = await call(server, "GET", "/api/listings/5", { bearer: ADMIN });
    assert.equal(admin.status, 200);
    assert.equal(admin.body.data.ownerId, 9);
    assert.equal(admin.body.data.owner.id, 9);
    assert.equal(admin.body.data.fraudReason, "duplicate photos");
  } finally {
    server.close();
  }
});

test("a landlord status filter returns only that landlord's listings", async () => {
  const { prisma } = memory([
    home({ id: 4, ownerId: 8, status: "PENDING", reviewStatus: "NOT_REVIEWED" }),
    home({ id: 5, ownerId: 9, status: "PENDING", reviewStatus: "NOT_REVIEWED", title: "Other pending flat" }),
    home({ id: 6, ownerId: 8, status: "REJECTED", reviewStatus: "NOT_REVIEWED", title: "Ada rejected" }),
  ]);
  const otherLandlord = token({ id: 9, email: "emeka@example.com", name: "Emeka", role: "LANDLORD" });
  const tenant = token({ id: 3, email: "t@example.com", name: "T", role: "TENANT" });
  const server = await listen(buildApp(prisma));
  try {
    const ownPending = await call(server, "GET", "/api/listings?status=PENDING", { bearer: OWNER });
    assert.equal(ownPending.status, 200);
    assert.deepEqual(ownPending.body.data.map((row) => row.id), [4]);
    assert.equal(ownPending.body.data[0].ownerId, 8);

    const ownRejected = await call(server, "GET", "/api/listings?status=REJECTED", { bearer: OWNER });
    assert.deepEqual(ownRejected.body.data.map((row) => row.id), [6]);

    const otherPending = await call(server, "GET", "/api/listings?status=PENDING", { bearer: otherLandlord });
    assert.deepEqual(otherPending.body.data.map((row) => row.id), [5]);

    const adminPending = await call(server, "GET", "/api/listings?status=PENDING", { bearer: ADMIN });
    assert.deepEqual(adminPending.body.data.map((row) => row.id).sort(), [4, 5]);

    const anon = await call(server, "GET", "/api/listings?status=PENDING");
    assert.deepEqual(anon.body.data, []);
    const tenantRejected = await call(server, "GET", "/api/listings?status=REJECTED", { bearer: tenant });
    assert.deepEqual(tenantRejected.body.data, []);
  } finally {
    server.close();
  }
});

test("non-public listing detail is visible only to its owner or a STUDIO_ADMIN", async () => {
  const { prisma } = memory([
    home({ id: 4, ownerId: 8, status: "PENDING", reviewStatus: "NOT_REVIEWED", fraudReason: "held" }),
  ]);
  const otherLandlord = token({ id: 9, email: "emeka@example.com", name: "Emeka", role: "LANDLORD" });
  const tenant = token({ id: 3, email: "t@example.com", name: "T", role: "TENANT" });
  const server = await listen(buildApp(prisma));
  try {
    const missing = await call(server, "GET", "/api/listings/404");
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error, "Listing not found");

    for (const bearer of [undefined, otherLandlord, tenant]) {
      const hidden = await call(server, "GET", "/api/listings/4", bearer ? { bearer } : {});
      assert.equal(hidden.status, 404);
      assert.equal(hidden.body.error, "Listing not found");
    }

    const owner = await call(server, "GET", "/api/listings/4", { bearer: OWNER });
    assert.equal(owner.status, 200);
    assert.equal(owner.body.data.id, 4);
    assert.equal(owner.body.data.ownerId, 8);
    assert.equal(owner.body.data.fraudReason, "held");

    const admin = await call(server, "GET", "/api/listings/4", { bearer: ADMIN });
    assert.equal(admin.status, 200);
    assert.equal(admin.body.data.id, 4);
    assert.equal(admin.body.data.owner.id, 8);
  } finally {
    server.close();
  }
});

test("a token with any type claim is rejected as an access token", async () => {
  const { calls, prisma } = memory([home()]);
  const server = await listen(buildApp(prisma));
  try {
    const typedAdmin = token({ id: 2, role: "STUDIO_ADMIN", type: "refresh" });
    const service = token({ id: 2, role: "STUDIO_ADMIN", type: "service" });
    const pending = await call(server, "GET", "/api/admin/listings/pending", { bearer: typedAdmin });
    assert.equal(pending.status, 401);
    const approve = await call(server, "POST", "/api/admin/listings/4/approve", { bearer: service });
    assert.equal(approve.status, 401);
    assert.equal(calls.update, 0);
  } finally {
    server.close();
  }
});
