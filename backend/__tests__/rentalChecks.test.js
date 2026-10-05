const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const createRentalChecksRouter = require("../src/routes/rentalChecks");
const createPaymentsRouter = require("../src/routes/payments");
const createWhatsAppRouter = require("../src/routes/whatsapp");
const rentalCheck = require("../src/services/rentalCheck");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const intake = {
  location: "Nekede, Owerri",
  askingRent: 450000,
  customerPhone: "08031234567",
  listingUrl: "https://example.test/listing/1",
  agentName: "Ada Agent",
  agentPhone: "08039998888",
  customerNotes: "Asked me to pay before viewing.",
  paymentDetails: { bankName: "Test Bank", accountName: "Ada Agent", accountNumber: "0123456789" },
};

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function adminToken() {
  return jwt.sign({ id: 1, email: "a@example.com", name: "Admin", role: "STUDIO_ADMIN" }, process.env.JWT_SECRET);
}

function memoryPrisma(seed = []) {
  const rows = seed.map((row) => ({ ...row }));
  return {
    rows,
    rentalCheck: {
      create: async ({ data }) => {
        if (rows.some((row) => row.publicReference === data.publicReference)) {
          const error = new Error("unique");
          error.code = "P2002";
          throw error;
        }
        const row = { id: `rc_${rows.length + 1}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        rows.push(row);
        return row;
      },
      findUnique: async ({ where }) => rows.find((row) => (
        (where.publicReference && row.publicReference === where.publicReference)
        || (where.paystackReference && row.paystackReference === where.paystackReference)
        || (where.id && row.id === where.id)
      )) || null,
      findMany: async () => rows.map((row) => ({ ...row })),
      update: async ({ where, data }) => {
        const row = rows.find((item) => item.id === where.id);
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      },
    },
  };
}

function appFor(prisma, paystack) {
  const app = express();
  app.use(express.json());
  app.use("/api/rental-checks", createRentalChecksRouter(prisma, { paystack }));
  return app;
}

test("invalid submissions are rejected and do not write", async () => {
  const bad = rentalCheck.validateIntake({ location: "N", askingRent: 0, customerPhone: "12" });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.includes("location"));
  assert.ok(bad.errors.includes("askingRent"));
  assert.ok(bad.errors.includes("customerPhone"));

  const card = rentalCheck.validateIntake({
    ...intake,
    paymentDetails: { cardNumber: "4242424242424242", cvv: "123" },
  });
  assert.equal(card.ok, false);
  assert.ok(card.errors.includes("paymentDetails"));

  const photos = rentalCheck.validateIntake({ ...intake, screenshots: ["a.jpg"] });
  assert.equal(photos.ok, false);
  assert.ok(photos.errors.includes("screenshots"));

  let writes = 0;
  const prisma = { rentalCheck: { create: async () => { writes += 1; return {}; } } };
  const server = await listen(appFor(prisma));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/rental-checks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: "Nekede" }),
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.success, false);
    assert.equal(writes, 0);
  } finally {
    server.close();
  }
});

test("creation assigns a unique reference and does not mark the home verified", async () => {
  const seen = new Set();
  for (let i = 0; i < 40; i += 1) seen.add(rentalCheck.newPublicReference());
  assert.equal(seen.size, 40);
  for (const ref of seen) assert.match(ref, /^RSC-[A-Z2-9]{8}$/);

  const prisma = memoryPrisma();
  const server = await listen(appFor(prisma));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/rental-checks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(intake),
    });
    const body = await res.json();
    assert.equal(res.status, 201);
    assert.match(body.data.publicReference, /^RSC-/);
    assert.equal(body.data.status, "SUBMITTED");
    assert.equal(body.data.paymentStatus, "UNPAID");
    assert.equal(body.data.amountNgn, 5000);
    assert.equal(typeof body.data.accessToken, "string");
    assert.equal(JSON.stringify(body).includes("VERIFIED"), false);
    assert.equal(prisma.rows[0].paymentDetails.accountNumber, "0123456789");
    assert.equal(prisma.rows[0].paymentDetails.cvv, undefined);
  } finally {
    server.close();
  }
});

test("report access requires the case token", async () => {
  const prisma = memoryPrisma([{
    id: "rc_1",
    publicReference: "RSC-TESTCASE",
    accessToken: "token-ok",
    customerPhone: "2348031234567",
    location: "Nekede",
    askingRent: 450000,
    amountKobo: 500000,
    status: "REPORT_READY",
    paymentStatus: "PAID",
    reviewStatus: "COMPLETE",
    riskScore: 40,
    confidence: "LOW",
    recommendation: "UNCERTAIN",
    evidence: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  }]);
  const server = await listen(appFor(prisma));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/rental-checks/RSC-TESTCASE`;
    const hidden = await fetch(base);
    assert.equal(hidden.status, 401);
    assert.equal(JSON.stringify(await hidden.json()).includes("UNCERTAIN"), false);

    const wrong = await fetch(`${base}?token=nope`);
    assert.equal(wrong.status, 401);

    const ok = await fetch(`${base}?token=token-ok`);
    const body = await ok.json();
    assert.equal(ok.status, 200);
    assert.equal(body.data.report.recommendationLabel, rentalCheck.RECOMMENDATION_LABEL.UNCERTAIN);
    assert.equal(body.data.status, "DELIVERED");
    assert.equal(body.data.report.neighborhood.available, false);
    assert.equal(body.data.report.neighborhood.travelTime, null);
    assert.equal(JSON.stringify(body.data.report).toLowerCase().includes("guaranteed"), false);
    assert.equal(/\bsafe\b/i.test(JSON.stringify(body.data.report)), false);
  } finally {
    server.close();
  }
});

test("payment becomes paid only after server-side confirmation and ignores a success flag", async () => {
  const prisma = memoryPrisma();
  const paystack = {
    initializeRentalCheckPayment: async ({ reference, amountKobo }) => ({
      authorization_url: "https://paystack.test/pay",
      reference,
      amountKobo,
    }),
    verifyRentalCheckPayment: async () => ({ status: "abandoned", reference: "nope", amountKobo: 500000, currency: "NGN" }),
  };
  process.env.PAYSTACK_SECRET_KEY = "test-secret-key";
  const server = await listen(appFor(prisma, paystack));
  try {
    const created = await fetch(`http://127.0.0.1:${server.address().port}/api/rental-checks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(intake),
    }).then((res) => res.json());
    const token = created.data.accessToken;
    const reference = created.data.publicReference;

    const pay = await fetch(`http://127.0.0.1:${server.address().port}/api/rental-checks/${reference}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, success: true }),
    });
    const payBody = await pay.json();
    assert.equal(pay.status, 200);
    assert.equal(payBody.data.authorizationUrl, "https://paystack.test/pay");
    assert.equal(prisma.rows[0].status, "AWAITING_PAYMENT");
    assert.equal(prisma.rows[0].paymentStatus, "PENDING");
    assert.equal(prisma.rows[0].paystackReference.startsWith("LODG-RSC-"), true);

    const denied = await fetch(`http://127.0.0.1:${server.address().port}/api/rental-checks/${reference}/confirm-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, success: true, status: "success" }),
    });
    assert.equal(denied.status, 402);
    assert.notEqual(prisma.rows[0].paymentStatus, "PAID");

    paystack.verifyRentalCheckPayment = async (ref) => ({
      status: "success",
      reference: ref,
      amountKobo: 100,
      currency: "NGN",
    });
    const wrongAmount = await fetch(`http://127.0.0.1:${server.address().port}/api/rental-checks/${reference}/confirm-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    assert.equal(wrongAmount.status, 402);
    assert.notEqual(prisma.rows[0].paymentStatus, "PAID");

    paystack.verifyRentalCheckPayment = async (ref) => ({
      status: "success",
      reference: ref,
      amountKobo: 500000,
      currency: "NGN",
    });
    const confirmed = await fetch(`http://127.0.0.1:${server.address().port}/api/rental-checks/${reference}/confirm-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const confirmedBody = await confirmed.json();
    assert.equal(confirmed.status, 200);
    assert.equal(confirmedBody.data.paymentStatus, "PAID");
    assert.equal(confirmedBody.data.status, "UNDER_REVIEW");
  } finally {
    delete process.env.PAYSTACK_SECRET_KEY;
    server.close();
  }
});

test("webhook marks a rental check paid once and does not touch a listing", async () => {
  const check = {
    id: "rc_1",
    publicReference: "RSC-WEBHOOK1",
    accessToken: "tok",
    paystackReference: "LODG-RSC-RSC-WEBHOOK1",
    amountKobo: 500000,
    paymentStatus: "PENDING",
    status: "AWAITING_PAYMENT",
    paidAt: null,
  };
  let updates = 0;
  let listingWrites = 0;
  const events = [];
  const prisma = {
    processedWebhookEvent: {
      create: async ({ data }) => {
        if (events.includes(data.id)) {
          const error = new Error("dup");
          error.code = "P2002";
          throw error;
        }
        events.push(data.id);
        return data;
      },
    },
    rentalCheck: {
      findUnique: async () => check,
      update: async ({ data }) => {
        updates += 1;
        Object.assign(check, data);
        return check;
      },
    },
    listing: { update: async () => { listingWrites += 1; } },
    escrowTransaction: { findFirst: async () => { throw new Error("escrow lookup"); } },
  };
  const event = {
    event: "charge.success",
    data: { id: 4242, reference: check.paystackReference, amount: 500000, currency: "NGN" },
  };
  const raw = JSON.stringify(event);
  const secret = "whsec-test";
  process.env.PAYSTACK_SECRET_KEY = secret;
  const app = express();
  app.use(express.raw({ type: "application/json" }));
  app.use("/api/payments", createPaymentsRouter(prisma));
  const server = await listen(app);
  try {
    const headers = {
      "Content-Type": "application/json",
      "x-paystack-signature": crypto.createHmac("sha256", secret).update(raw).digest("hex"),
    };
    const first = await fetch(`http://127.0.0.1:${server.address().port}/api/payments/webhook`, {
      method: "POST",
      headers,
      body: raw,
    });
    const second = await fetch(`http://127.0.0.1:${server.address().port}/api/payments/webhook`, {
      method: "POST",
      headers,
      body: raw,
    });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal((await second.json()).message, "Already processed");
    assert.equal(updates, 1);
    assert.equal(check.paymentStatus, "PAID");
    assert.equal(check.status, "UNDER_REVIEW");
    assert.equal(listingWrites, 0);
  } finally {
    delete process.env.PAYSTACK_SECRET_KEY;
    server.close();
  }
});

test("status moves to a published report only after a paid review, and missing evidence is not fraud", () => {
  const check = {
    paymentStatus: "UNPAID",
    status: "SUBMITTED",
    listingUrl: "https://lodgist.online/listings/9",
  };
  const review = rentalCheck.validateReview({
    riskScore: 25,
    confidence: "LOW",
    recommendation: "LOWER_RISK",
    evidence: {},
  });
  assert.equal(review.ok, true);
  assert.equal(review.data.evidence.propertyEvidence.state, "unconfirmed");
  assert.equal(rentalCheck.publishReview(check, review.data).ok, false);

  check.paymentStatus = "PAID";
  check.status = "UNDER_REVIEW";
  const published = rentalCheck.publishReview(check, review.data);
  assert.equal(published.ok, true);
  assert.equal(published.data.status, "REPORT_READY");
  assert.equal(published.data.recommendation, "LOWER_RISK");
  assert.equal(published.data.neighborhoodContext.available, false);
  assert.equal(published.data.neighborhoodContext.coordinates, null);
  assert.equal(published.data.neighborhoodContext.listingPath, "/listings/9/neighborhood");

  const forbidden = rentalCheck.validateReview({
    riskScore: 90,
    confidence: "HIGH",
    recommendation: "HIGH_RISK",
    reviewNotes: "This home is safe and guaranteed.",
  });
  assert.equal(forbidden.ok, false);
  assert.ok(forbidden.errors.includes("forbiddenClaim"));
});

test("metrics count submitted, paid, delivered, revenue, and completion time", () => {
  const created = new Date("2026-10-05T10:00:00.000Z");
  const delivered = new Date("2026-10-05T12:00:00.000Z");
  const summary = rentalCheck.summarizeMetrics([
    { status: "SUBMITTED", paymentStatus: "UNPAID", amountKobo: 500000, createdAt: created },
    { status: "DELIVERED", paymentStatus: "PAID", amountKobo: 500000, createdAt: created, deliveredAt: delivered },
  ]);
  assert.equal(summary.submitted, 2);
  assert.equal(summary.paid, 1);
  assert.equal(summary.reportsDelivered, 1);
  assert.equal(summary.revenueNgn, 5000);
  assert.equal(summary.averageCompletionMs, 2 * 60 * 60 * 1000);
});

test("payment start is blocked when Paystack is not configured", async () => {
  delete process.env.PAYSTACK_SECRET_KEY;
  const prisma = memoryPrisma([{
    id: "rc_1",
    publicReference: "RSC-NOPAYKEY",
    accessToken: "tok",
    status: "SUBMITTED",
    paymentStatus: "UNPAID",
    amountKobo: 500000,
    paystackAuthorizationUrl: null,
    paystackReference: null,
  }]);
  const server = await listen(appFor(prisma, {}));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/rental-checks/RSC-NOPAYKEY/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "tok" }),
    });
    const body = await res.json();
    assert.equal(res.status, 503);
    assert.deepEqual(body.missing, ["PAYSTACK_SECRET_KEY"]);
    assert.equal(prisma.rows[0].paymentStatus, "UNPAID");
  } finally {
    server.close();
  }
});

test("admin review is rejected without a staff token", async () => {
  const prisma = memoryPrisma([{
    id: "rc_1",
    publicReference: "RSC-ADMIN001",
    accessToken: "tok",
    paymentStatus: "PAID",
    status: "UNDER_REVIEW",
    amountKobo: 500000,
  }]);
  const server = await listen(appFor(prisma));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/rental-checks/RSC-ADMIN001/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riskScore: 10, confidence: "LOW", recommendation: "UNCERTAIN" }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("admin can publish a paid report", async () => {
  const prisma = memoryPrisma([{
    id: "rc_1",
    publicReference: "RSC-ADMIN002",
    accessToken: "tok",
    customerPhone: "08031234567",
    location: "Nekede",
    askingRent: 450000,
    paymentStatus: "PAID",
    status: "UNDER_REVIEW",
    amountKobo: 500000,
    listingUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }]);
  const server = await listen(appFor(prisma));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/rental-checks/RSC-ADMIN002/review`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken()}`,
      },
      body: JSON.stringify({
        riskScore: 80,
        confidence: "MEDIUM",
        recommendation: "HIGH_RISK",
        reviewNotes: "Phone on the advert does not match the account name supplied.",
        evidence: {
          phoneInconsistencies: { state: "checked", notes: "Advert phone and account name differ." },
        },
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.data.status, "REPORT_READY");
    assert.equal(body.data.report.recommendationLabel, "HIGH RISK — DO NOT PAY YET");
    assert.equal(body.data.report.couldNotVerify.some((item) => item.key === "propertyEvidence"), true);
  } finally {
    server.close();
  }
});

function whatsappPayload(id, body) {
  return {
    entry: [{
      changes: [{
        value: {
          metadata: { phone_number_id: "1" },
          messages: [{ id, from: "2348031234567", type: "text", timestamp: "1", text: { body } }],
        },
      }],
    }],
  };
}

test("WhatsApp CHECK collects a case and duplicate events do not create two", async () => {
  const prisma = memoryPrisma();
  let updates = 0;
  prisma.user = { findFirst: async () => null };
  prisma.whatsAppSession = {
    findFirst: async () => null,
    create: async ({ data }) => ({ id: "ses_1", messages: [], context: null, ...data }),
    update: async ({ data }) => {
      updates += 1;
      return data;
    },
  };
  prisma.whatsAppMessage = { create: async () => ({}) };
  const app = express();
  app.use("/api/whatsapp/webhook", express.raw({ type: "application/json" }));
  app.use("/api/whatsapp", createWhatsAppRouter(prisma));
  const server = await listen(app);
  try {
    const raw = Buffer.from(JSON.stringify(whatsappPayload("wamid.check-1", "CHECK")));
    const url = `http://127.0.0.1:${server.address().port}/api/whatsapp/webhook`;
    const first = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw });
    const second = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: raw });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(updates, 1);
    assert.equal(prisma.rows.length, 0);
  } finally {
    server.close();
  }
});

test("WhatsApp STATUS and REPORT stay closed to a different phone", async () => {
  const check = {
    id: "rc_1",
    publicReference: "RSC-WAPHONE1",
    accessToken: "secret-token",
    customerPhone: "08030000000",
    status: "REPORT_READY",
    paymentStatus: "PAID",
    recommendation: "UNCERTAIN",
    riskScore: 50,
    confidence: "LOW",
    evidence: {},
    amountKobo: 500000,
  };
  const session = { id: "ses_1", messages: [], context: null, phone: "2348099999999", userId: null };
  const result = await rentalCheck.handleWhatsAppRentalCheck({
    rentalCheck: { findUnique: async () => check, update: async () => check },
  }, { text: "REPORT RSC-WAPHONE1", phone: "2348099999999", session });
  assert.equal(result.handled, true);
  assert.equal(result.reply, "We cannot show that case.");
  assert.equal(result.reply.includes("secret-token"), false);

  const status = await rentalCheck.handleWhatsAppRentalCheck({
    rentalCheck: { findUnique: async () => check },
  }, { text: "STATUS RSC-WAPHONE1", phone: "2348030000000", session });
  assert.equal(status.reply.includes("Report ready"), true);
  assert.equal(status.reply.includes("secret-token"), false);
});
