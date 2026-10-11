const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

function freshRouter() {
  delete require.cache[require.resolve("../src/routes/agreements")];
  return require("../src/routes/agreements");
}

const tok = (id, role = "USER") =>
  jwt.sign({ id, email: `u${id}@example.com`, name: `U${id}`, role }, process.env.JWT_SECRET);
const TENANT = tok(1);
const LANDLORD = tok(2, "LANDLORD");
const OTHER = tok(3);
const OTHER_LANDLORD = tok(4, "LANDLORD");
const ADMIN = tok(99, "STUDIO_ADMIN");

let base;
let server;

async function call(method, path, token, body) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, body: json };
}

async function withApp(fn) {
  const app = express();
  app.use(express.json());
  app.use("/api/agreements", freshRouter());
  server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(); } finally { server.close(); }
}

async function createExecuted() {
  const created = await call("POST", "/api/agreements", TENANT, {
    tenantName: "Ada", landlordName: "Bayo", propertyAddress: "12 Secret Close, Ikoyi",
    rentAmount: 1000000, startDate: "2026-11-01", endDate: "2027-10-31",
    landlordUserId: 2,
  });
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.equal((await call("POST", `/api/agreements/${id}/sign`, TENANT, { party: "tenant" })).status, 200);
  assert.equal((await call("POST", `/api/agreements/${id}/sign`, LANDLORD, { party: "landlord" })).status, 200);
  return id;
}

test("non-party user gets 404 on detail, certificate and sign; nothing leaks", () => withApp(async () => {
  const id = await createExecuted();
  for (const t of [OTHER, OTHER_LANDLORD]) {
    const d = await call("GET", `/api/agreements/${id}`, t);
    assert.equal(d.status, 404);
    assert.ok(!JSON.stringify(d.body).includes("Secret Close"));
    const c = await call("GET", `/api/agreements/${id}/certificate`, t);
    assert.equal(c.status, 404);
    assert.ok(!JSON.stringify(c.body).includes("Secret Close"));
    const s = await call("POST", `/api/agreements/${id}/sign`, t, { party: "tenant" });
    assert.equal(s.status, 404);
  }
  // Same response as for an id that does not exist
  const missing = await call("GET", "/api/agreements/99999", OTHER);
  const d = await call("GET", `/api/agreements/${id}`, OTHER);
  assert.deepEqual(d.body, missing.body);
}));

test("non-party cannot sign a draft agreement (404, no state change)", () => withApp(async () => {
  const created = await call("POST", "/api/agreements", TENANT, {
    tenantName: "Ada", landlordName: "Bayo", propertyAddress: "1 A St",
    rentAmount: 5, startDate: "2026-11-01", endDate: "2027-10-31", landlordUserId: 2,
  });
  const id = created.body.id;
  assert.equal((await call("POST", `/api/agreements/${id}/sign`, OTHER, { party: "landlord" })).status, 404);
  const d = await call("GET", `/api/agreements/${id}`, TENANT);
  assert.equal(d.body.landlordSigned, false);
}));

test("a party cannot sign for the other side", () => withApp(async () => {
  const created = await call("POST", "/api/agreements", TENANT, {
    tenantName: "Ada", landlordName: "Bayo", propertyAddress: "1 A St",
    rentAmount: 5, startDate: "2026-11-01", endDate: "2027-10-31", landlordUserId: 2,
  });
  const id = created.body.id;
  assert.equal((await call("POST", `/api/agreements/${id}/sign`, TENANT, { party: "landlord" })).status, 403);
  assert.equal((await call("POST", `/api/agreements/${id}/sign`, LANDLORD, { party: "tenant" })).status, 403);
}));

test("parties (tenant and landlord) can read detail and certificate", () => withApp(async () => {
  const id = await createExecuted();
  for (const t of [TENANT, LANDLORD]) {
    const d = await call("GET", `/api/agreements/${id}`, t);
    assert.equal(d.status, 200);
    assert.equal(d.body.propertyAddress, "12 Secret Close, Ikoyi");
    assert.equal((await call("GET", `/api/agreements/${id}/certificate`, t)).status, 200);
  }
}));

test("STUDIO_ADMIN can read detail, certificate and list", () => withApp(async () => {
  const id = await createExecuted();
  assert.equal((await call("GET", `/api/agreements/${id}`, ADMIN)).status, 200);
  assert.equal((await call("GET", `/api/agreements/${id}/certificate`, ADMIN)).status, 200);
  const l = await call("GET", "/api/agreements", ADMIN);
  assert.equal(l.status, 200);
  assert.equal(l.body.length, 1);
}));

test("list is admin-only for non-admins and does not leak", () => withApp(async () => {
  await createExecuted();
  const l = await call("GET", "/api/agreements", OTHER);
  assert.notEqual(l.status, 200);
  assert.ok(!JSON.stringify(l.body).includes("Secret Close"));
}));

test("anonymous is denied on every route", () => withApp(async () => {
  const id = await createExecuted();
  for (const [m, p, b] of [
    ["GET", "/api/agreements"], ["GET", `/api/agreements/${id}`],
    ["GET", `/api/agreements/${id}/certificate`], ["POST", `/api/agreements/${id}/sign`, { party: "tenant" }],
    ["POST", "/api/agreements", {}],
  ]) {
    const r = await call(m, p, null, b);
    assert.equal(r.status, 401, `${m} ${p}`);
    assert.ok(!JSON.stringify(r.body).includes("Secret Close"));
  }
}));
