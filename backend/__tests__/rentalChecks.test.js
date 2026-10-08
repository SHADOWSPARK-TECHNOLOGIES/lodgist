const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const rentalChecksRouter = require("../src/routes/rentalChecks");
const createPaymentsRouter = require("../src/routes/payments");
const createWhatsAppRouter = require("../src/routes/whatsapp");
const { validateIntake, validateReview, createRentalCheck, RECOMMENDATION_COPY } = require("../src/services/rentalCheck");
const { handleRentalCheckMessage } = require("../src/services/whatsapp/rentalCheck");

const ENV = ["JWT_SECRET", "PAYSTACK_SECRET_KEY", "WHATSAPP_PUBLIC_URL", "WHATSAPP_APP_SECRET", "FRONTEND_URL"];
let saved;

beforeEach(() => {
  saved = {};
  for (const key of ENV) saved[key] = process.env[key];
  process.env.JWT_SECRET = "test-secret";
  delete process.env.PAYSTACK_SECRET_KEY;
  delete process.env.FRONTEND_URL;
  process.env.WHATSAPP_PUBLIC_URL = "https://lodgist.test";
});

afterEach(() => {
  for (const key of ENV) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function memoryPrisma() {
  const checks = [];
  const drafts = [];
  const events = [];
  let listingWrites = 0;
  let failReferences = 0;
  return {
    checks,
    drafts,
    events,
    get listingWrites() {
      return listingWrites;
    },
    failNextReference() {
      failReferences += 1;
    },
    processedWebhookEvent: {
      create: async ({ data }) => {
        if (events.includes(data.id)) {
          const error = new Error("duplicate");
          error.code = "P2002";
          throw error;
        }
        events.push(data.id);
        return data;
      },
    },
    rentalCheck: {
      create: async ({ data }) => {
        if (failReferences > 0) {
          failReferences -= 1;
          const error = new Error("unique publicReference");
          error.code = "P2002";
          error.meta = { target: ["publicReference"] };
          throw error;
        }
        if (checks.some((row) => row.publicReference === data.publicReference)) {
          const error = new Error("unique publicReference");
          error.code = "P2002";
          error.meta = { target: ["publicReference"] };
          throw error;
        }
        const row = {
          id: `rc-${checks.length + 1}`,
          paidAt: null,
          riskScore: null,
          confidence: null,
          recommendation: null,
          reviewerNotes: null,
          reviewedBy: null,
          reviewedAt: null,
          reportPublishedAt: null,
          deliveredAt: null,
          paystackReference: null,
          customerEmail: null,
          createdAt: new Date("2026-10-05T12:00:00.000Z"),
          ...data,
        };
        checks.push(row);
        return row;
      },
      findUnique: async ({ where }) => {
        if (where.publicReference) return checks.find((row) => row.publicReference === where.publicReference) || null;
        if (where.id) return checks.find((row) => row.id === where.id) || null;
        return null;
      },
      findFirst: async ({ where }) => {
        if (where.paystackReference) return checks.find((row) => row.paystackReference === where.paystackReference) || null;
        if (where.publicReference) return checks.find((row) => row.publicReference === where.publicReference) || null;
        return null;
      },
      findMany: async ({ where } = {}) => {
        return checks.filter((row) => {
          if (where?.paymentStatus && row.paymentStatus !== where.paymentStatus) return false;
          if (where?.status && row.status !== where.status) return false;
          if (where?.customerPhone && row.customerPhone !== where.customerPhone) return false;
          if (where?.reportPublishedAt && row.reportPublishedAt == null) return false;
          return true;
        });
      },
      update: async ({ where, data }) => {
        const row = checks.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
      count: async (args = {}) => {
        const where = args.where;
        if (!where) return checks.length;
        if (where.paymentStatus) return checks.filter((row) => row.paymentStatus === where.paymentStatus).length;
        if (where.status) return checks.filter((row) => row.status === where.status).length;
        return checks.length;
      },
    },
    rentalCheckDraft: {
      findUnique: async ({ where }) => drafts.find((row) => row.phone === where.phone) || null,
      upsert: async ({ where, create, update }) => {
        let row = drafts.find((item) => item.phone === where.phone);
        if (!row) {
          row = { id: `draft-${drafts.length + 1}`, ...create };
          drafts.push(row);
        } else {
          Object.assign(row, update);
        }
        return row;
      },
      deleteMany: async ({ where }) => {
        const before = drafts.length;
        for (let i = drafts.length - 1; i >= 0; i -= 1) {
          if (drafts[i].phone === where.phone) drafts.splice(i, 1);
        }
        return { count: before - drafts.length };
      },
    },
    listing: {
      update: async () => {
        listingWrites += 1;
        throw new Error("payment must not update a listing");
      },
    },
    user: { findFirst: async () => null },
    whatsAppSession: {
      findFirst: async () => null,
      create: async ({ data }) => ({ id: "ses", messages: [], ...data }),
    },
    whatsAppMessage: { create: async () => ({}) },
  };
}

function appFor(prisma, paystack) {
  const app = express();
  app.use(express.json());
  app.use("/api/rental-checks", rentalChecksRouter(prisma, { paystack }));
  return app;
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function json(server, path, options = {}) {
  const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
  const body = await res.json();
  return { status: res.status, body };
}

const intake = {
  customerPhone: "08031234567",
  location: "Nekede, Owerri",
  askingRent: 450000,
  listingUrl: "https://example.test/house",
  agentName: "Ada Agent",
  agentPhone: "08039998888",
  customerNotes: "They asked for rent before a viewing.",
};

function adminToken() {
  return jwt.sign({ id: 1, email: "reviewer@example.com", name: "Reviewer", role: "STUDIO_ADMIN" }, process.env.JWT_SECRET);
}

function signPaystack(raw, secret) {
  return crypto.createHmac("sha512", secret).update(raw).digest("hex");
}

test("invalid intake is rejected and does not mention a verified home", () => {
  const missing = validateIntake({ location: "Owerri" });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.includes("customerPhone"));
  assert.ok(missing.errors.includes("askingRent"));

  const card = validateIntake({
    ...intake,
    paymentDetails: { method: "bank_transfer", narration: "4111111111111111" },
  });
  assert.equal(card.ok, false);
  assert.ok(card.errors.includes("paymentDetails"));

  const shots = validateIntake({ ...intake, screenshots: ["https://example.test/a.jpg"] });
  assert.equal(shots.ok, false);
  assert.ok(shots.errors.includes("screenshots"));
});

test("cases get distinct references and retry a reference collision", async () => {
  const prisma = memoryPrisma();
  prisma.failNextReference();
  const first = await createRentalCheck(prisma, validateIntake(intake).data);
  const second = await createRentalCheck(prisma, validateIntake({ ...intake, customerPhone: "08030000000" }).data);
  assert.match(first.check.publicReference, /^RSC-[A-Z2-9]{8}$/);
  assert.notEqual(first.check.publicReference, second.check.publicReference);
  assert.equal(first.check.accessTokenHash.includes(first.accessToken), false);
  assert.equal(prisma.checks.length, 2);
});

test("a WhatsApp arrangement reference waits for staff and does not mark the fee paid", async () => {
  const prisma = memoryPrisma();
  const server = await listen(appFor(prisma));
  try {
    const created = await json(server, "/api/rental-checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...intake, customerName: "Ada Okonkwo" }),
    });
    const ref = created.body.data.publicReference;
    const token = created.body.data.accessToken;
    const queued = await json(server, `/api/rental-checks/${ref}/payment-reference`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-rental-check-token": token },
      body: JSON.stringify({ manualPaymentRef: `WHATSAPP ${ref}` }),
    });
    assert.equal(queued.status, 200);
    assert.equal(queued.body.data.paymentStatus, "PENDING");
    assert.equal(queued.body.data.paymentReferenceSubmitted, true);
    assert.equal(queued.body.data.manualPaymentRef, undefined);
    assert.equal(prisma.checks[0].status, "AWAITING_PAYMENT");
    assert.equal(prisma.checks[0].paymentStatus, "PENDING");

    const named = await json(server, `/api/rental-checks/${ref}`, {
      headers: { "x-rental-check-token": token },
    });
    assert.equal(named.body.data.customerName, "Ada Okonkwo");
    assert.equal(named.body.data.location, "Nekede, Owerri");

    const confirmed = await json(server, `/api/rental-checks/${ref}/payment-review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken()}` },
      body: JSON.stringify({ action: "confirm", note: "Arranged on WhatsApp" }),
    });
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.body.data.paymentStatus, "PAID");
    assert.equal(prisma.checks[0].paymentStatus, "PAID");
  } finally {
    server.close();
  }
});

test("create, pay, verify, review, and report follow the paid path", async () => {
  const prisma = memoryPrisma();
  let verified = { status: "failed", amount: 5000, currency: "NGN", reference: "LODG-ESC-RSC-1" };
  const paystack = {
    initializePayment: async ({ amount, metadata }) => {
      assert.equal(amount, 5000);
      assert.equal(metadata.type, "rental_safety_check");
      return { authorization_url: "https://paystack.test/pay", reference: "LODG-ESC-RSC-1", access_code: "ac" };
    },
    verifyPayment: async () => verified,
  };
  const server = await listen(appFor(prisma, paystack));
  try {
    const created = await json(server, "/api/rental-checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(intake),
    });
    assert.equal(created.status, 201);
    const ref = created.body.data.publicReference;
    const token = created.body.data.accessToken;
    assert.equal(created.body.data.status, "SUBMITTED");
    assert.equal(created.body.data.customerName, undefined);
    assert.equal(created.body.data.location, undefined);
    assert.equal(JSON.stringify(created.body).toLowerCase().includes("verified home"), false);

    const owned = await json(server, `/api/rental-checks/${ref}`, {
      headers: { "x-rental-check-token": token },
    });
    assert.equal(owned.body.data.location, "Nekede, Owerri");
    assert.equal(owned.body.data.customerName, null);

    const bad = await json(server, "/api/rental-checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: "Owerri" }),
    });
    assert.equal(bad.status, 400);
    assert.equal(prisma.checks.length, 1);

    const hidden = await json(server, `/api/rental-checks/${ref}/report`);
    assert.equal(hidden.status, 401);
    const wrong = await json(server, `/api/rental-checks/${ref}/report?token=nope`);
    assert.equal(wrong.status, 401);

    const unpaid = await json(server, `/api/rental-checks/${ref}/pay`, { method: "POST", headers: { "Content-Type": "application/json", "x-rental-check-token": token }, body: "{}" });
    assert.equal(unpaid.status, 503);
    assert.equal(unpaid.body.code, "PAYSTACK_UNAVAILABLE");
    assert.equal(prisma.checks[0].paymentStatus, "UNPAID");

    process.env.PAYSTACK_SECRET_KEY = "sk_test_not_used";
    const stillClosed = await json(server, `/api/rental-checks/${ref}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-rental-check-token": token },
      body: JSON.stringify({ status: "success" }),
    });
    assert.equal(stillClosed.status, 503);
    assert.equal(prisma.checks[0].paymentStatus, "UNPAID");

    const lied = await json(server, "/api/rental-checks/pay/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-rental-check-token": token },
      body: JSON.stringify({ publicReference: ref, status: "success", token }),
    });
    assert.equal(lied.status, 409);
    assert.equal(lied.body.code, "MANUAL_REVIEW_REQUIRED");
    assert.equal(prisma.checks[0].paymentStatus, "UNPAID");

    const submitted = await json(server, `/api/rental-checks/${ref}/payment-reference`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-rental-check-token": token },
      body: JSON.stringify({ manualPaymentRef: "TRF-1001", success: true, screenshot: null }),
    });
    assert.equal(submitted.status, 200);
    assert.equal(submitted.body.data.paymentStatus, "PENDING");
    assert.equal(submitted.body.data.paymentReferenceSubmitted, true);
    assert.equal(submitted.body.data.manualPaymentRef, undefined);
    assert.equal(prisma.checks[0].status, "AWAITING_PAYMENT");
    const submittedAt = prisma.checks[0].paymentSubmittedAt;

    const againRef = await json(server, `/api/rental-checks/${ref}/payment-reference`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-rental-check-token": token },
      body: JSON.stringify({ manualPaymentRef: "TRF-1001" }),
    });
    assert.equal(againRef.body.alreadySubmitted, true);
    assert.equal(prisma.checks[0].paymentSubmittedAt, submittedAt);

    const renter = jwt.sign({ id: 9, email: "ada@example.com", name: "Ada", role: "TENANT" }, process.env.JWT_SECRET);
    const forbiddenPay = await json(server, `/api/rental-checks/${ref}/payment-review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${renter}` },
      body: JSON.stringify({ action: "confirm" }),
    });
    assert.equal(forbiddenPay.status, 403);
    assert.equal(prisma.checks[0].paymentStatus, "PENDING");

    const paid = await json(server, `/api/rental-checks/${ref}/payment-review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken()}` },
      body: JSON.stringify({ action: "confirm", note: "Transfer seen" }),
    });
    assert.equal(paid.status, 200);
    assert.equal(paid.body.data.paymentStatus, "PAID");
    assert.equal(paid.body.data.status, "UNDER_REVIEW");
    assert.equal(paid.body.data.paymentReviewedBy, 1);
    const paidAt = prisma.checks[0].paidAt;
    const again = await json(server, `/api/rental-checks/${ref}/payment-review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken()}` },
      body: JSON.stringify({ action: "confirm" }),
    });
    assert.equal(again.body.alreadyPaid, true);
    assert.equal(prisma.checks[0].paidAt, paidAt);

    const reloaded = await json(server, `/api/rental-checks/${ref}`);
    assert.equal(reloaded.status, 200);
    assert.equal(reloaded.body.data.paymentStatus, "PAID");
    assert.equal(reloaded.body.data.manualPaymentRef, undefined);
    assert.equal(reloaded.body.data.paymentReferenceSubmitted, true);

    const early = await json(server, `/api/rental-checks/${ref}/report?token=${encodeURIComponent(token)}`);
    assert.equal(early.status, 409);

    const forbidden = await json(server, `/api/rental-checks/${ref}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${renter}` },
      body: JSON.stringify({ publish: true, riskScore: 40, confidence: "LOW", recommendation: "HIGH_RISK" }),
    });
    assert.equal(forbidden.status, 403);

    const openItems = validateReview(
      { publish: true, riskScore: 20, confidence: "LOW", recommendation: "LOWER_RISK", evidence: null },
      prisma.checks[0],
    );
    assert.equal(openItems.ok, true);
    assert.equal(openItems.data.recommendation, "LOWER_RISK");

    const published = await json(server, `/api/rental-checks/${ref}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken()}` },
      body: JSON.stringify({
        publish: true,
        riskScore: 62,
        confidence: "MEDIUM",
        recommendation: "UNCERTAIN",
        reviewerNotes: "Internal only",
        evidence: {
          propertyEvidence: { state: "incomplete", note: "Photos do not show the street." },
          agentIdentity: { state: "not_checked", note: "" },
          phoneConsistency: { state: "unconfirmed", note: "Two numbers were given." },
          paymentRisk: { state: "checked", note: "Account name does not match the agent name." },
          askingPrice: { state: "unavailable", note: "No nearby rents on file." },
          neighborhood: { state: "not_checked", note: "", provenance: "unavailable" },
          suspiciousOrMissing: { state: "incomplete", note: "No viewing was offered." },
        },
      }),
    });
    assert.equal(published.status, 200);
    assert.equal(published.body.data.status, "REPORT_READY");
    assert.equal(published.body.data.accessTokenHash, undefined);
    assert.equal(published.body.data.preview.recommendationLabel, RECOMMENDATION_COPY.UNCERTAIN);

    const report = await json(server, `/api/rental-checks/${ref}/report?token=${encodeURIComponent(token)}`);
    assert.equal(report.status, 200);
    assert.equal(report.body.data.recommendationLabel, "UNCERTAIN — VERIFY THESE ITEMS FIRST");
    assert.equal(report.body.data.trustScore, 62);
    assert.ok(report.body.data.couldNotVerify.includes("Neighborhood"));
    assert.match(JSON.stringify(report.body.data.sections), /Spatial Lab was not used/);
    assert.equal(report.body.data.status, "DELIVERED");
    const text = JSON.stringify(report.body);
    assert.equal(/fraud-free|100%\s*verified|guaranteed|\bsafe\b/i.test(text), false);
    assert.equal(text.includes("Internal only"), false);

    const metrics = await json(server, "/api/rental-checks/metrics", {
      headers: { Authorization: `Bearer ${adminToken()}` },
    });
    assert.equal(metrics.status, 200);
    assert.equal(metrics.body.data.submitted, 1);
    assert.equal(metrics.body.data.paid, 1);
    assert.equal(metrics.body.data.reportsDelivered, 1);
    assert.equal(metrics.body.data.revenueNgn, 5000);
    assert.equal(typeof metrics.body.data.averageCompletionMs, "number");
  } finally {
    server.close();
  }
});

test("a rejected reference can be replaced, and a screenshot or another token cannot pay the fee", async () => {
  const prisma = memoryPrisma();
  const server = await listen(appFor(prisma));
  try {
    const created = await json(server, "/api/rental-checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(intake),
    });
    const ref = created.body.data.publicReference;
    const token = created.body.data.accessToken;
    const other = await json(server, "/api/rental-checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...intake, customerPhone: "08030000000" }),
    });
    const otherToken = other.body.data.accessToken;

    const stolen = await json(server, `/api/rental-checks/${ref}/payment-reference`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-rental-check-token": otherToken },
      body: JSON.stringify({ manualPaymentRef: "TRF-OTHER" }),
    });
    assert.equal(stolen.status, 401);
    assert.equal(prisma.checks[0].paymentStatus, "UNPAID");

    const shot = await json(server, `/api/rental-checks/${ref}/payment-reference`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-rental-check-token": token },
      body: JSON.stringify({ manualPaymentRef: "TRF-1", screenshot: "data:image/png;base64,abc" }),
    });
    assert.equal(shot.status, 400);
    assert.equal(prisma.checks[0].manualPaymentRef, undefined);

    const card = await json(server, `/api/rental-checks/${ref}/payment-reference`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-rental-check-token": token },
      body: JSON.stringify({ manualPaymentRef: "4111111111111111" }),
    });
    assert.equal(card.status, 400);

    const submitted = await json(server, `/api/rental-checks/${ref}/payment-reference`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-rental-check-token": token },
      body: JSON.stringify({ manualPaymentRef: "TRF-OLD" }),
    });
    assert.equal(submitted.status, 200);
    const rejected = await json(server, `/api/rental-checks/${ref}/payment-review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken()}` },
      body: JSON.stringify({ action: "reject", note: "Amount did not match" }),
    });
    assert.equal(rejected.status, 200);
    assert.equal(rejected.body.data.paymentStatus, "FAILED");
    assert.equal(rejected.body.data.manualPaymentRef, null);
    assert.match(rejected.body.data.paymentReviewNote, /TRF-OLD/);
    assert.match(rejected.body.data.paymentReviewNote, /Amount did not match/);

    const replaced = await json(server, `/api/rental-checks/${ref}/payment-reference`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken()}` },
      body: JSON.stringify({ manualPaymentRef: "TRF-NEW" }),
    });
    assert.equal(replaced.status, 200);
    assert.equal(replaced.body.data.paymentStatus, "PENDING");
    assert.equal(replaced.body.data.manualPaymentRef, "TRF-NEW");
    assert.equal(prisma.checks[0].paymentStatus, "PENDING");
  } finally {
    server.close();
  }
});

test("webhook accepts a signed rental charge once and rejects a bad signature or amount", async () => {
  const prisma = memoryPrisma();
  prisma.checks.push({
    id: "rc-1",
    publicReference: "RSC-TEST2345",
    paymentStatus: "PENDING",
    status: "AWAITING_PAYMENT",
    paystackReference: "LODG-ESC-RSC-TEST2345",
    paidAt: null,
  });
  const secret = "sk_test_rental";
  process.env.PAYSTACK_SECRET_KEY = secret;
  const app = express();
  app.use(express.raw({ type: "application/json" }));
  app.use("/api/payments", createPaymentsRouter(prisma));
  const server = await listen(app);
  try {
    const badAmount = JSON.stringify({
      event: "charge.success",
      data: { id: 1, amount: 100, currency: "NGN", reference: "LODG-ESC-RSC-TEST2345", metadata: { type: "rental_safety_check" } },
    });
    const rejectedAmount = await fetch(`http://127.0.0.1:${server.address().port}/api/payments/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-paystack-signature": signPaystack(badAmount, secret) },
      body: badAmount,
    });
    assert.equal(rejectedAmount.status, 200);
    assert.equal(prisma.checks[0].paymentStatus, "PENDING");

    const raw = JSON.stringify({
      event: "charge.success",
      data: { id: 2, amount: 500000, currency: "NGN", reference: "LODG-ESC-RSC-TEST2345", metadata: { type: "rental_safety_check" } },
    });
    const unsigned = await fetch(`http://127.0.0.1:${server.address().port}/api/payments/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-paystack-signature": "nope" },
      body: raw,
    });
    assert.equal(unsigned.status, 401);

    const ok = await fetch(`http://127.0.0.1:${server.address().port}/api/payments/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-paystack-signature": signPaystack(raw, secret) },
      body: raw,
    });
    assert.equal(ok.status, 200);
    assert.equal(prisma.checks[0].paymentStatus, "PENDING");
    assert.equal(prisma.checks[0].status, "AWAITING_PAYMENT");
    assert.equal(prisma.listingWrites, 0);

    const duplicate = await fetch(`http://127.0.0.1:${server.address().port}/api/payments/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-paystack-signature": signPaystack(raw, secret) },
      body: raw,
    });
    const duplicateBody = await duplicate.json();
    assert.equal(duplicateBody.message, "Already processed");
    assert.equal(prisma.checks[0].paymentStatus, "PENDING");
  } finally {
    server.close();
  }
});

test("whatsapp CHECK collects a case and REPORT stays behind the sender phone", async () => {
  const prisma = memoryPrisma();
  const phone = "2348031234567";
  const send = (text) => handleRentalCheckMessage(prisma, { text, phone, user: null, profileName: "Chioma" });

  const start = await send("CHECK");
  assert.match(start.replyText, /5,000/);
  await send("SKIP");
  await send("Nekede, Owerri");
  await send("450000");
  await send("SKIP");
  await send("SKIP");
  await send("SKIP");
  const done = await send("SKIP");
  assert.match(done.replyText, /RSC-/);
  assert.match(done.replyText, /https:\/\/lodgist\.test\/check\//);
  assert.equal(prisma.checks.length, 1);
  assert.equal(prisma.drafts.length, 0);
  const ref = prisma.checks[0].publicReference;

  const status = await send(`STATUS ${ref}`);
  assert.match(status.replyText, /SUBMITTED/);
  const other = await handleRentalCheckMessage(prisma, { text: `REPORT ${ref}`, phone: "2348000000000", user: null });
  assert.equal(other.replyText.includes("http"), false);

  prisma.checks[0].status = "REPORT_READY";
  prisma.checks[0].recommendation = "HIGH_RISK";
  prisma.checks[0].riskScore = 80;
  prisma.checks[0].confidence = "HIGH";
  const report = await send(`REPORT ${ref}`);
  assert.match(report.replyText, new RegExp(`https://lodgist\\.test/check/${ref}`));
  assert.equal(report.replyText.includes("DO NOT PAY YET"), false);

  const help = await send("HELP");
  assert.match(help.replyText, /CHECK/);
  assert.equal(/\bsafe\b/i.test(help.replyText), false);
});

test("whatsapp duplicate message id does not open two cases", async () => {
  const prisma = memoryPrisma();
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "1" },
              contacts: [{ profile: { name: "Chioma" } }],
              messages: [{ id: "wamid.check-1", from: "2348031234567", type: "text", timestamp: "1", text: { body: "CHECK" } }],
            },
          },
        ],
      },
    ],
  };
  const app = express();
  app.use("/api/whatsapp/webhook", express.raw({ type: "application/json" }));
  app.use("/api/whatsapp", createWhatsAppRouter(prisma));
  const server = await listen(app);
  try {
    const buf = Buffer.from(JSON.stringify(payload));
    const url = `http://127.0.0.1:${server.address().port}/api/whatsapp/webhook`;
    const first = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: buf });
    const second = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: buf });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(prisma.drafts.length, 1);
  } finally {
    server.close();
  }
});
