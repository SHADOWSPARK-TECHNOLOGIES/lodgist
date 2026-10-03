const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const advertiserLeadsRouter = require("../src/routes/advertiserLeads");
const {
  validateAdvertiserLead,
  ADVERTISER_SAVED_MESSAGE,
} = require("../src/routes/advertiserLeads");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

function buildApp(prisma) {
  const app = express();
  app.use(express.json());
  app.use("/api/advertiser-leads", advertiserLeadsRouter(prisma));
  return app;
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const validBody = {
  name: "Chioma Okonkwo",
  phone: "08031234567",
  area: "Nekede",
  propertyCount: 4,
  notes: "Hostel rooms near campus gate",
  email: "chioma@example.com",
  authority: "CONTROLS",
  photoPublicationAllowed: true,
  availability: "AVAILABLE_NOW",
  rentPeriod: "YEAR",
  moveInFees: {
    baseRent: { known: true, amountNgn: 250000 },
    agency: { known: true, amountNgn: 250000 },
    legal: { known: false },
    caution: { known: true, amountNgn: 0 },
    inspection: { known: false },
  },
};

test("validateAdvertiserLead rejects a short name and a bad phone", () => {
  const missing = validateAdvertiserLead({ ...validBody, phone: "123" });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.includes("phone"));

  const name = validateAdvertiserLead({ ...validBody, name: "A" });
  assert.equal(name.ok, false);
  assert.ok(name.errors.includes("name"));

  const empty = validateAdvertiserLead({});
  assert.equal(empty.ok, false);
  assert.ok(empty.errors.includes("name"));
  assert.ok(empty.errors.includes("phone"));
  assert.ok(empty.errors.includes("area"));
  assert.ok(empty.errors.includes("authority"));
  assert.ok(empty.errors.includes("photoPublicationAllowed"));
  assert.ok(empty.errors.includes("availability"));
  assert.ok(empty.errors.includes("rentPeriod"));
  assert.ok(empty.errors.includes("moveInFees"));
});

test("POST /api/advertiser-leads rejects invalid input and does not write", async () => {
  let created = false;
  const prisma = {
    advertiserLead: {
      create: async () => {
        created = true;
        return { id: 1 };
      },
    },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/advertiser-leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Chioma" }),
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.success, false);
    assert.equal(created, false);
    assert.ok(body.fields.includes("phone"));
  } finally {
    server.close();
  }
});

test("POST /api/advertiser-leads saves interest without promising verification", async () => {
  let saved;
  const prisma = {
    advertiserLead: {
      create: async ({ data }) => {
        saved = data;
        return { id: 7, ...data };
      },
    },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/advertiser-leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, email: "" }),
    });
    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.message, ADVERTISER_SAVED_MESSAGE);
    assert.equal(body.data.id, 7);
    assert.equal(saved.name, "Chioma Okonkwo");
    assert.equal(saved.area, "Nekede");
    assert.equal(saved.propertyCount, 4);
    assert.equal(saved.email, null);
    const lower = JSON.stringify(body).toLowerCase();
    assert.equal(lower.includes("verification badge"), true);
    assert.equal(lower.includes("payment never buys"), true);
    assert.equal(lower.includes("does not verify"), true);
    assert.equal(lower.includes("submission is not publication"), true);
    assert.equal(lower.includes("listing created"), false);
    assert.equal(saved.authority, "CONTROLS");
    assert.equal(saved.photoPublicationAllowed, true);
    assert.equal(saved.availability, "AVAILABLE_NOW");
    assert.equal(saved.availableFrom, null);
    assert.equal(saved.rentPeriod, "YEAR");
    assert.equal(saved.moveInFees.legal.known, false);
    assert.equal(saved.moveInFees.caution.amountNgn, 0);
    assert.equal(Object.hasOwn(body.data, "listingId"), false);
  } finally {
    server.close();
  }
});

test("GET /api/advertiser-leads is unauthorized without a token", async () => {
  let read = false;
  const prisma = {
    advertiserLead: {
      findMany: async () => {
        read = true;
        return [];
      },
    },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/advertiser-leads`);
    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.success, false);
    assert.equal(read, false);
  } finally {
    server.close();
  }
});

test("GET /api/advertiser-leads rejects a signed-in landlord", async () => {
  const token = jwt.sign(
    { id: 9, email: "landlord@example.com", name: "Emeka", role: "LANDLORD" },
    process.env.JWT_SECRET
  );
  const prisma = { advertiserLead: { findMany: async () => [] } };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/advertiser-leads`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 403);
  } finally {
    server.close();
  }
});

test("publish facts reject unknown authority, a date without FROM_DATE, and a negative fee", () => {
  const authority = validateAdvertiserLead({ ...validBody, authority: "OWNER" });
  assert.equal(authority.ok, false);
  assert.ok(authority.errors.includes("authority"));

  const photos = validateAdvertiserLead({ ...validBody, photoPublicationAllowed: "yes" });
  assert.equal(photos.ok, false);
  assert.ok(photos.errors.includes("photoPublicationAllowed"));

  const strayDate = validateAdvertiserLead({
    ...validBody,
    availability: "AVAILABLE_NOW",
    availableFrom: "2026-11-01",
  });
  assert.equal(strayDate.ok, false);
  assert.ok(strayDate.errors.includes("availableFrom"));

  const missingDate = validateAdvertiserLead({
    ...validBody,
    availability: "FROM_DATE",
  });
  assert.equal(missingDate.ok, false);
  assert.ok(missingDate.errors.includes("availableFrom"));

  const badFee = validateAdvertiserLead({
    ...validBody,
    moveInFees: {
      ...validBody.moveInFees,
      inspection: { known: true, amountNgn: -1 },
    },
  });
  assert.equal(badFee.ok, false);
  assert.ok(badFee.errors.includes("moveInFees.inspection"));
});

test("POST stores a Nekede area as text and does not publish a home", async () => {
  let saved;
  const prisma = {
    advertiserLead: {
      create: async ({ data }) => {
        saved = data;
        return { id: 3, ...data };
      },
    },
    listing: {
      create: async () => {
        throw new Error("listing create must not run");
      },
    },
  };
  const server = await listen(buildApp(prisma));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/advertiser-leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...validBody,
        area: "Nekede",
        authority: "AUTHORIZED",
        photoPublicationAllowed: false,
        availability: "FROM_DATE",
        availableFrom: "2026-11-02",
        rentPeriod: "SEMESTER",
        moveInFees: {
          baseRent: { known: false },
          agency: { known: false },
          legal: { known: false },
          caution: { known: false },
          inspection: { known: false },
        },
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.data.id, 3);
    assert.equal(saved.area, "Nekede");
    assert.equal(saved.authority, "AUTHORIZED");
    assert.equal(saved.photoPublicationAllowed, false);
    assert.equal(saved.availability, "FROM_DATE");
    assert.equal(saved.availableFrom.toISOString(), "2026-11-02T00:00:00.000Z");
    assert.equal(saved.rentPeriod, "SEMESTER");
    for (const key of ["baseRent", "agency", "legal", "caution", "inspection"]) {
      assert.deepEqual(saved.moveInFees[key], { known: false });
    }
    assert.equal(Object.hasOwn(body, "listing"), false);
    assert.match(body.message, /Payment never buys a verification badge/);
    assert.match(body.message, /Submission is not publication/);
  } finally {
    server.close();
  }
});
