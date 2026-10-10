// Contact details (email, phone, whatsappId) and passwordHash must never
// reach anyone other than the user themselves or a STUDIO_ADMIN.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const usersRouter = require("../src/routes/users");
const createEscrowRouter = require("../src/routes/escrow");
const authRouter = require("../src/routes/auth");

const FULL_USER = {
  id: 3,
  name: "Ada",
  email: "ada@example.com",
  phone: "+2348000000000",
  whatsappId: "2348000000000",
  passwordHash: "$2a$hash",
  role: "LANDLORD",
  isVerified: true,
  isHNW: true,
  hnwVerifiedAt: "2026-09-01T00:00:00.000Z",
  truthIndex: 80,
  avatarUrl: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};
const CONTACT = ["email", "phone", "whatsappId", "passwordHash"];

function token(user) {
  return `Bearer ${jwt.sign(user, process.env.JWT_SECRET)}`;
}

// Mimics Prisma: with `select`, only the selected scalars come back.
function userPrisma(seen) {
  return {
    user: {
      findUnique: async (args) => {
        seen.args = args;
        if (!args.select) return { ...FULL_USER };
        const out = {};
        for (const [k, v] of Object.entries(args.select)) if (v && k in FULL_USER) out[k] = FULL_USER[k];
        return out;
      },
    },
  };
}

async function call(router, mount, path, { method = "GET", headers = {}, body } = {}) {
  const app = express();
  app.use(express.json());
  app.use(mount, router);
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
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

test("GET /api/users/:id hides contact details from anonymous callers", async () => {
  const seen = {};
  const res = await call(usersRouter(userPrisma(seen)), "/api/users", "/api/users/3?include=passkeys");
  assert.equal(res.status, 200);
  assert.ok(seen.args.select, "public profile must use an explicit select");
  const data = JSON.parse(res.text).data;
  for (const key of [...CONTACT, "isHNW", "hnwVerifiedAt", "_count"]) {
    assert.equal(key in data, false, `${key} must not be public`);
  }
  assert.deepEqual(Object.keys(data).sort(), ["avatarUrl", "createdAt", "id", "isVerified", "name", "role", "truthIndex"]);
});

test("GET /api/users/:id hides contact details from another signed-in user", async () => {
  const seen = {};
  const res = await call(usersRouter(userPrisma(seen)), "/api/users", "/api/users/3", {
    headers: { Authorization: token({ id: 99, role: "USER" }) },
  });
  assert.equal(res.status, 200);
  for (const key of CONTACT) assert.equal(res.text.includes(`"${key}"`), false);
});

test("GET /api/users/:id returns the full record (minus passwordHash) to the user and to admins", async () => {
  for (const viewer of [{ id: 3, role: "LANDLORD" }, { id: 1, role: "STUDIO_ADMIN" }]) {
    const res = await call(usersRouter(userPrisma({})), "/api/users", "/api/users/3", {
      headers: { Authorization: token(viewer) },
    });
    const data = JSON.parse(res.text).data;
    assert.equal(res.status, 200);
    assert.equal(data.email, FULL_USER.email);
    assert.equal("passwordHash" in data, false);
  }
});

test("GET /api/users/:id ignores an invalid token and serves the public profile", async () => {
  const res = await call(usersRouter(userPrisma({})), "/api/users", "/api/users/3", {
    headers: { Authorization: "Bearer not-a-jwt" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.text.includes("ada@example.com"), false);
});

test("GET /api/escrow/:id is limited to the tenant, the landlord and admins", async () => {
  const tx = {
    id: "tx1", tenantId: 5, landlordId: 6,
    tenant: { id: 5, name: "T", email: "t@example.com" },
    landlord: { id: 6, name: "L", email: "l@example.com" },
  };
  const prisma = { escrowTransaction: { findUnique: async () => tx } };
  const router = createEscrowRouter(prisma, {});
  const stranger = await call(router, "/api/escrow", "/api/escrow/tx1", { headers: { Authorization: token({ id: 7, role: "USER" }) } });
  assert.equal(stranger.status, 403);
  assert.equal(stranger.text.includes("@example.com"), false);
  for (const viewer of [{ id: 5, role: "USER" }, { id: 6, role: "LANDLORD" }, { id: 1, role: "STUDIO_ADMIN" }]) {
    const ok = await call(router, "/api/escrow", "/api/escrow/tx1", { headers: { Authorization: token(viewer) } });
    assert.equal(ok.status, 200);
  }
});

test("optionalAuth calls next once for a refresh token", () => {
  const { optionalAuth } = require("../src/middleware/auth");
  const refresh = jwt.sign({ id: 3, type: "refresh" }, process.env.JWT_SECRET);
  const req = { headers: { authorization: `Bearer ${refresh}` } };
  let calls = 0;
  assert.throws(() => {
    optionalAuth(req, {}, () => {
      calls += 1;
      throw new Error("downstream");
    });
  }, /downstream/);
  assert.equal(calls, 1);
  assert.equal(req.user, undefined);
});

test("passkey list and delete reject refresh, bad, and expired tokens", async () => {
  const rows = [{
    id: 1,
    credentialId: "cred-1",
    userId: 3,
    name: "Phone",
    deviceType: "singleDevice",
    backedUp: false,
    createdAt: "2026-10-01T00:00:00.000Z",
    lastUsedAt: null,
  }];
  let deleted = 0;
  const prisma = {
    passkeyCredential: {
      findMany: async ({ where }) => rows.filter((row) => row.userId === where.userId),
      findUnique: async ({ where }) => rows.find((row) => row.credentialId === where.credentialId) || null,
      delete: async () => {
        deleted += 1;
        return {};
      },
    },
  };
  const router = authRouter(prisma);
  const refresh = `Bearer ${jwt.sign({ id: 3, type: "refresh" }, process.env.JWT_SECRET)}`;
  const bad = "Bearer not-a-jwt";
  const expired = `Bearer ${jwt.sign({ id: 3, role: "LANDLORD", exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET)}`;
  const typed = `Bearer ${jwt.sign({ id: 3, role: "LANDLORD", type: "access" }, process.env.JWT_SECRET)}`;
  const access = token({ id: 3, email: "ada@example.com", name: "Ada", role: "LANDLORD" });

  const listRefresh = await call(router, "/api/auth", "/api/auth/passkeys", { headers: { Authorization: refresh } });
  assert.equal(listRefresh.status, 401);
  const deleteRefresh = await call(router, "/api/auth", "/api/auth/passkeys/cred-1", {
    method: "DELETE",
    headers: { Authorization: refresh },
  });
  assert.equal(deleteRefresh.status, 401);
  assert.equal(deleted, 0);

  for (const authorization of [bad, expired, typed]) {
    const listed = await call(router, "/api/auth", "/api/auth/passkeys", { headers: { Authorization: authorization } });
    assert.equal(listed.status, 401, authorization.slice(0, 16));
    const removed = await call(router, "/api/auth", "/api/auth/passkeys/cred-1", {
      method: "DELETE",
      headers: { Authorization: authorization },
    });
    assert.equal(removed.status, 401);
  }
  assert.equal(deleted, 0);

  const listed = await call(router, "/api/auth", "/api/auth/passkeys", { headers: { Authorization: access } });
  assert.equal(listed.status, 200);
  assert.equal(JSON.parse(listed.text).data.length, 1);
  const removed = await call(router, "/api/auth", "/api/auth/passkeys/cred-1", {
    method: "DELETE",
    headers: { Authorization: access },
  });
  assert.equal(removed.status, 200);
  assert.equal(deleted, 1);
});

test("passkey registration requires sign-in and only for your own account", async () => {
  let touched = false;
  const prisma = new Proxy({}, { get: () => new Proxy({}, { get: () => async () => { touched = true; return null; } }) });
  const router = authRouter(prisma);
  for (const path of ["/api/auth/passkey/register/options", "/api/auth/passkey/register/verify"]) {
    const anon = await call(router, "/api/auth", path, { method: "POST", body: { userId: 3, credential: {} } });
    assert.equal(anon.status, 401, `${path} anonymous`);
    const other = await call(router, "/api/auth", path, {
      method: "POST",
      headers: { Authorization: token({ id: 99, role: "USER" }) },
      body: { userId: 3, credential: {} },
    });
    assert.equal(other.status, 403, `${path} other user`);
    assert.equal(other.text.includes("@"), false);
  }
  assert.equal(touched, false, "the database must not be queried for someone else's account");
});

test("GET /api/bookings: admins see all bookings, landlords only their own listings without tenant contact", async () => {
  const createBookingsRouter = require("../src/routes/bookings");
  let args;
  const prisma = { booking: { count: async () => 0, findMany: async (a) => { args = a; return []; } } };
  const router = createBookingsRouter(prisma);

  const admin = await call(router, "/api/bookings", "/api/bookings", { headers: { Authorization: token({ id: 1, role: "STUDIO_ADMIN" }) } });
  assert.equal(admin.status, 200);
  assert.equal("listing" in args.where, false);
  assert.equal(args.include.tenant.select.email, true);

  const landlord = await call(router, "/api/bookings", "/api/bookings", { headers: { Authorization: token({ id: 6, role: "LANDLORD" }) } });
  assert.equal(landlord.status, 200);
  assert.deepEqual(args.where.listing, { ownerId: 6 });
  assert.ok(!args.include.tenant.select.email && !args.include.tenant.select.phone, "landlords must not get tenant contact details");

  const user = await call(router, "/api/bookings", "/api/bookings", { headers: { Authorization: token({ id: 5, role: "USER" }) } });
  assert.equal(user.status, 403);
});

test("GET /api/truth-index/:userId does not expose isHNW", async () => {
  const truthIndexRouter = require("../src/routes/truthIndex");
  const prisma = {
    user: { findUnique: async ({ select }) => { const out = {}; for (const k of Object.keys(select)) out[k] = FULL_USER[k]; return out; } },
    truthIndexScore: { findFirst: async () => null },
  };
  const res = await call(truthIndexRouter(prisma), "/api/truth-index", "/api/truth-index/3");
  assert.equal(res.status, 200);
  assert.equal(res.text.includes("isHNW"), false);
});

test("the Express app trusts the Railway proxy for client IPs", () => {
  const src = require("node:fs").readFileSync(require.resolve("../src/index.js"), "utf8");
  assert.match(src, /app\.set\(\s*["']trust proxy["']\s*,\s*1\s*\)/);
});

// Booking bk1 is on listing 10 (owned by landlord 6), tenant 5.
function bookingPrisma(state = {}) {
  const booking = {
    id: "bk1", tenantId: 5, listingId: 10, status: "PENDING_VERIFICATION", adminNotes: "internal note",
    listing: { id: 10, title: "Flat", price: 1, ownerId: 6 },
  };
  return {
    booking: {
      count: async () => 1,
      findMany: async () => [{ ...booking }],
      findUnique: async () => ({ ...booking, status: state.status || booking.status }),
      update: async ({ data }) => { state.updated = true; return { ...booking, ...data }; },
      create: async ({ data }) => { state.created = true; return { id: "bk2", ...data }; },
    },
    listing: { findUnique: async () => ({ id: 10, ownerId: 6 }) },
    user: { findUnique: async () => ({ id: 5, role: "USER" }) },
    viewingRequest: { findFirst: async () => (state.noViewing ? null : { id: 1 }) },
  };
}
const ADMIN = { id: 1, role: "STUDIO_ADMIN" };
const OWNER = { id: 6, role: "LANDLORD" };
const OTHER_LANDLORD = { id: 7, role: "LANDLORD" };
const TENANT = { id: 5, role: "USER" };
const auth = (u) => ({ Authorization: token(u) });

test("GET /api/bookings/:id: admin, tenant and owning landlord only; adminNotes admin-only", async () => {
  const router = require("../src/routes/bookings")(bookingPrisma());
  const get = (u) => call(router, "/api/bookings", "/api/bookings/bk1", { headers: auth(u) });
  assert.equal((await get(OTHER_LANDLORD)).status, 403);
  assert.equal((await get({ id: 8, role: "USER" })).status, 403);
  for (const u of [OWNER, TENANT]) {
    const res = await get(u);
    assert.equal(res.status, 200);
    assert.equal(res.text.includes("internal note"), false);
  }
  const admin = await get(ADMIN);
  assert.equal(admin.status, 200);
  assert.equal(admin.text.includes("internal note"), true);
});

test("GET /api/bookings list hides adminNotes from landlords", async () => {
  const router = require("../src/routes/bookings")(bookingPrisma());
  const res = await call(router, "/api/bookings", "/api/bookings", { headers: auth(OWNER) });
  assert.equal(res.status, 200);
  assert.equal(res.text.includes("adminNotes"), false);
});

test("booking verify-payment and admin-notes are STUDIO_ADMIN only", async () => {
  for (const [path, body] of [["/api/bookings/bk1/verify-payment", { action: "approve" }], ["/api/bookings/bk1/admin-notes", { adminNotes: "x" }]]) {
    for (const u of [OWNER, OTHER_LANDLORD, TENANT]) {
      const state = {};
      const res = await call(require("../src/routes/bookings")(bookingPrisma(state)), "/api/bookings", path, { method: "PATCH", headers: auth(u), body });
      assert.equal(res.status, 403, `${path} ${u.id}`);
      assert.equal(state.updated, undefined);
    }
    const res = await call(require("../src/routes/bookings")(bookingPrisma()), "/api/bookings", path, { method: "PATCH", headers: auth(ADMIN), body });
    assert.equal(res.status, 200, `${path} admin`);
  }
});

test("booking cancel: tenant and admin only, not landlords", async () => {
  for (const [u, status] of [[OWNER, 403], [OTHER_LANDLORD, 403], [TENANT, 200], [ADMIN, 200]]) {
    const res = await call(require("../src/routes/bookings")(bookingPrisma({ status: "PENDING" })), "/api/bookings", "/api/bookings/bk1/cancel", { method: "PATCH", headers: auth(u) });
    assert.equal(res.status, status, `cancel as ${u.id}`);
  }
});

test("POST /api/bookings: landlords only for their own listings", async () => {
  const body = {
    listingId: 10,
    tenantId: 5,
    startDate: "2030-06-01",
    endDate: "2030-07-01",
    totalAmount: 1,
  };
  for (const [u, status] of [[OTHER_LANDLORD, 403], [TENANT, 403], [OWNER, 201], [ADMIN, 201]]) {
    const state = {};
    const res = await call(require("../src/routes/bookings")(bookingPrisma(state)), "/api/bookings", "/api/bookings", { method: "POST", headers: auth(u), body });
    assert.equal(res.status, status, `create as ${u.id}`);
    assert.equal(!!state.created, status === 201);
  }
});

test("POST /api/bookings by a landlord: server-computed amount, sane dates, existing tenant", async () => {
  const make = (overrides = {}) => {
    const state = {};
    const prisma = bookingPrisma(state);
    prisma.listing.findUnique = async () => ({ id: 10, ownerId: 6, price: 36500, currency: "NGN" });
    Object.assign(prisma.user, overrides.user || {});
    prisma.booking.create = async ({ data }) => { state.data = data; return { id: "bk2", ...data }; };
    return { state, router: require("../src/routes/bookings")(prisma) };
  };
  const post = (router, body) => call(router, "/api/bookings", "/api/bookings", { method: "POST", headers: auth(OWNER), body });
  const base = { listingId: 10, tenantId: 5, startDate: "2030-01-01", endDate: "2031-01-01" };

  let t = make();
  let res = await post(t.router, { ...base, totalAmount: 1 });
  assert.equal(res.status, 201);
  assert.equal(t.state.data.totalAmount, 36500, "landlord-supplied amount must be ignored");

  t = make();
  res = await post(t.router, base);
  assert.equal(res.status, 201, "landlords need not send totalAmount");
  assert.equal(t.state.data.totalAmount, 36500);

  for (const dates of [{ startDate: "2031-01-01", endDate: "2030-01-01" }, { startDate: "2020-01-01", endDate: "2020-06-01" }, { startDate: "nope", endDate: "2031-01-01" }]) {
    t = make();
    res = await post(t.router, { ...base, ...dates, totalAmount: 1 });
    assert.equal(res.status, 400, JSON.stringify(dates));
    assert.equal(t.state.data, undefined);
  }

  t = make({ user: { findUnique: async () => null } });
  res = await post(t.router, { ...base, totalAmount: 1 });
  assert.equal(res.status, 404);
  assert.equal(t.state.data, undefined);
});

test("POST /api/bookings by a landlord: tenant must be a USER with a viewing request on the listing", async () => {
  const body = { listingId: 10, tenantId: 5, startDate: "2030-01-01", endDate: "2031-01-01" };
  const post = (prisma) => call(require("../src/routes/bookings")(prisma), "/api/bookings", "/api/bookings", { method: "POST", headers: auth(OWNER), body });

  let state = { noViewing: true };
  let res = await post(bookingPrisma(state));
  assert.equal(res.status, 403, "no viewing request");
  assert.equal(state.created, undefined);

  for (const role of ["LANDLORD", "STUDIO_ADMIN", "AGENT"]) {
    state = {};
    const prisma = bookingPrisma(state);
    prisma.user.findUnique = async () => ({ id: 5, role });
    res = await post(prisma);
    assert.equal(res.status, 400, `tenant role ${role}`);
    assert.equal(state.created, undefined);
  }

  state = {};
  let seen;
  const prisma = bookingPrisma(state);
  prisma.viewingRequest.findFirst = async (args) => { seen = args; return { id: 1 }; };
  res = await post(prisma);
  assert.equal(res.status, 201);
  assert.equal(seen.where.listingId, 10);
  assert.equal(seen.where.requesterId, 5);
  assert.ok(!seen.where.status.in.includes("CANCELLED"));

  // Admins are not subject to the viewing-request rule.
  state = { noViewing: true };
  res = await call(require("../src/routes/bookings")(bookingPrisma(state)), "/api/bookings", "/api/bookings", { method: "POST", headers: auth(ADMIN), body: { ...body, totalAmount: 1 } });
  assert.equal(res.status, 201);
});

test("POST /api/bookings by an admin: same date validation as landlords", async () => {
  const base = { listingId: 10, tenantId: 5, totalAmount: 1000 };
  for (const dates of [{ startDate: "2031-01-01", endDate: "2030-01-01" }, { startDate: "2030-01-01", endDate: "2030-01-01" }, { startDate: "2020-01-01", endDate: "2020-06-01" }, { startDate: "nope", endDate: "2031-01-01" }]) {
    const state = {};
    const res = await call(require("../src/routes/bookings")(bookingPrisma(state)), "/api/bookings", "/api/bookings", { method: "POST", headers: auth(ADMIN), body: { ...base, ...dates } });
    assert.equal(res.status, 400, JSON.stringify(dates));
    assert.equal(state.created, undefined);
  }
  const state = {};
  const res = await call(require("../src/routes/bookings")(bookingPrisma(state)), "/api/bookings", "/api/bookings", { method: "POST", headers: auth(ADMIN), body: { ...base, startDate: "2030-01-01", endDate: "2031-01-01" } });
  assert.equal(res.status, 201);
  assert.equal(JSON.parse(res.text).booking.totalAmount, 1000, "admin keeps the supplied amount");
});

test("POST /api/truth-index/recalculate coerces a string userId", async () => {
  const truthIndexRouter = require("../src/routes/truthIndex");
  const seen = [];
  const prisma = {
    user: {
      findUnique: async ({ where }) => { seen.push(where.id); return { id: where.id, isVerified: true, reviews: [], listings: [], profile: null }; },
      update: async () => ({}),
    },
    truthIndexScore: { create: async ({ data }) => ({ ...data, createdAt: new Date() }) },
  };
  const post = (u, body) => call(truthIndexRouter(prisma), "/api/truth-index", "/api/truth-index/recalculate", { method: "POST", headers: auth(u), body });

  assert.equal((await post({ id: 3, role: "USER" }, { userId: "3" })).status, 200, "self with a string id");
  assert.equal((await post({ id: 4, role: "USER" }, { userId: "3" })).status, 403, "someone else");
  assert.equal((await post(ADMIN, { userId: "3" })).status, 200, "admin with a string id");
  assert.equal((await post(ADMIN, { userId: "abc" })).status, 400, "admin with a junk id");
  assert.deepEqual(seen, [3, 3]);
});
