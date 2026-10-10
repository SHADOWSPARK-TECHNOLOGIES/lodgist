// ownerId, owner.id, fraudReason and latestFraudSignal are internal listing
// fields. Public list and detail responses omit them; the listing owner and a
// STUDIO_ADMIN still receive them.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const listingsRouter = require("../src/routes/listings");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const LISTING = {
  id: 31,
  title: "Two bedroom flat",
  description: "Quiet compound",
  status: "VERIFIED",
  reviewStatus: "APPROVED",
  riskState: "UNVERIFIED",
  isFlaggedForFraud: false,
  fraudReason: "INTERNAL-FRAUD-REASON",
  ownerId: 8,
  price: 900000,
  images: [],
  property: { id: 4, city: "Owerri", state: "Imo", lga: "Owerri Municipal", latitude: 5.49, longitude: 7.03 },
  owner: { id: 8, name: "Ada", truthIndex: 70, isVerified: false },
  fraudSignals: [{ score: 0.2, reasoning: "INTERNAL-SIGNAL-REASONING", createdAt: new Date(0) }],
  _count: { reviews: 0, bookings: 0 },
};

const prisma = {
  listing: {
    count: async () => 1,
    findMany: async () => [LISTING],
    findUnique: async () => LISTING,
  },
  review: {
    groupBy: async () => [],
    aggregate: async () => ({ _avg: { rating: null }, _count: 0 }),
  },
};

function token(id, role) {
  return jwt.sign({ id, email: `u${id}@example.com`, name: "U", role }, process.env.JWT_SECRET);
}

async function get(path, auth) {
  const app = express();
  app.use(express.json());
  app.use("/api/listings", listingsRouter(prisma));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const { port } = server.address();
    const headers = auth ? { Authorization: "Bearer " + auth } : {};
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
    const text = await res.text();
    return { status: res.status, text, body: JSON.parse(text) };
  } finally {
    server.close();
  }
}

function assertRedacted(item, text) {
  assert.equal("ownerId" in item, false);
  assert.equal("fraudReason" in item, false);
  assert.equal("latestFraudSignal" in item, false);
  if (item.owner) assert.equal("id" in item.owner, false);
  assert.equal(text.includes("INTERNAL-FRAUD-REASON"), false);
  assert.equal(text.includes("INTERNAL-SIGNAL-REASONING"), false);
}

test("public listing detail omits ownerId, fraudReason and fraud signal reasoning", async () => {
  for (const auth of [null, token(9, "USER"), token(9, "LANDLORD")]) {
    const res = await get("/api/listings/31", auth);
    assert.equal(res.status, 200);
    assertRedacted(res.body.data, res.text);
    assert.equal(res.body.data.title, "Two bedroom flat");
  }
});

test("public listing list omits ownerId and fraudReason", async () => {
  const res = await get("/api/listings");
  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 1);
  assertRedacted(res.body.data[0], res.text);
});

test("listing detail keeps internals for the owner and a STUDIO_ADMIN", async () => {
  for (const auth of [token(8, "LANDLORD"), token(1, "STUDIO_ADMIN")]) {
    const res = await get("/api/listings/31", auth);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.ownerId, 8);
    assert.equal(res.body.data.owner.id, 8);
    assert.equal(res.body.data.latestFraudSignal.reasoning, "INTERNAL-SIGNAL-REASONING");
  }
});
