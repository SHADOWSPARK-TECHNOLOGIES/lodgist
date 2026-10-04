const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const createWhatsAppRouter = require("../src/routes/whatsapp");
const { getListingDetails, requestViewing } = require("../src/services/whatsapp/tools");

const ENV_KEYS = [
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_PUBLIC_URL",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_API_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "GCP_PROJECT_ID",
  "GCP_PROJECT_LOCATION",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "NODE_ENV",
];

const CANARY_APP_SECRET = "canary-app-secret-value";
const CANARY_API_TOKEN = "canary-api-token-value";
const CANARY_ANTHROPIC = "canary-anthropic-key-value";

let saved;
let logLines;
let originalLog;
let originalWarn;
let originalError;

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function sign(secret, buf) {
  return `sha256=${crypto.createHmac("sha256", secret).update(buf).digest("hex")}`;
}

function rawApp(prisma, options) {
  const app = express();
  app.use("/api/whatsapp/webhook", express.raw({ type: "application/json" }));
  app.use("/api/whatsapp", createWhatsAppRouter(prisma, options));
  return app;
}

function messageBody(from, text, id) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "100" },
              contacts: [{ profile: { name: "Ada" }, wa_id: from }],
              messages: [
                {
                  id,
                  from,
                  type: "text",
                  timestamp: "1710000000",
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

async function postWebhook(server, body, secret) {
  const buf = Buffer.from(JSON.stringify(body));
  const headers = { "Content-Type": "application/json" };
  if (secret) headers["X-Hub-Signature-256"] = sign(secret, buf);
  const { port } = server.address();
  return fetch(`http://127.0.0.1:${port}/api/whatsapp/webhook`, {
    method: "POST",
    headers,
    body: buf,
  });
}

function createMemoryPrisma(seed = {}) {
  const state = {
    users: seed.users || [],
    sessions: seed.sessions || [],
    messages: [],
    listings: seed.listings || [],
    bookings: seed.bookings || [],
    viewingRequests: [],
  };
  let sessionNum = 1;
  let messageNum = 1;
  let viewingNum = 1;

  function decorate(session) {
    return {
      ...session,
      messages: session.messages,
      listing: null,
      user: state.users.find((user) => user.id === session.userId) || null,
    };
  }

  function matchesSession(session, where = {}) {
    if (where.contactId !== undefined && session.contactId !== where.contactId) return false;
    if (where.phone !== undefined && session.phone !== where.phone) return false;
    if (where.userId === null && session.userId != null) return false;
    if (where.isActive !== undefined && Boolean(session.isActive) !== Boolean(where.isActive)) return false;
    return true;
  }

  return {
    state,
    user: {
      findFirst: async ({ where } = {}) => {
        return (
          state.users.find((user) => {
            if (where?.OR) {
              return where.OR.some(
                (clause) =>
                  (clause.phone && user.phone === clause.phone) ||
                  (clause.whatsappId && user.whatsappId === clause.whatsappId)
              );
            }
            return where?.phone && user.phone === where.phone;
          }) || null
        );
      },
    },
    whatsAppSession: {
      findFirst: async ({ where } = {}) => {
        const found = state.sessions.find((session) => matchesSession(session, where));
        return found ? decorate(found) : null;
      },
      create: async ({ data }) => {
        const session = {
          id: `ses_${sessionNum++}`,
          userId: data.userId ?? null,
          contactId: data.contactId ?? null,
          phone: data.phone ?? null,
          contactName: data.contactName ?? null,
          platform: data.platform || "whatsapp",
          isActive: data.isActive !== false,
          handoffRequested: false,
          listingId: data.listingId ?? null,
          messages: [],
          createdAt: new Date(),
        };
        state.sessions.push(session);
        return decorate(session);
      },
      update: async ({ where, data }) => {
        const session = state.sessions.find((item) => item.id === where.id);
        if (!session) throw new Error("session missing");
        Object.assign(session, data);
        return session;
      },
    },
    whatsAppMessage: {
      findFirst: async () => null,
      create: async ({ data }) => {
        const message = { id: messageNum++, ...data };
        state.messages.push(message);
        const session = state.sessions.find((item) => item.id === data.sessionId);
        if (session) session.messages.push(message);
        return message;
      },
    },
    listing: {
      findMany: async () =>
        state.listings.filter((listing) => listing.status === "VERIFIED" && listing.isFlaggedForFraud !== true),
      findUnique: async ({ where }) => state.listings.find((listing) => listing.id === where.id) || null,
      update: async () => ({}),
    },
    booking: {
      findMany: async ({ where } = {}) =>
        state.bookings.filter((booking) => !where.tenantId || booking.tenantId === where.tenantId),
      findFirst: async ({ where } = {}) =>
        state.bookings.find(
          (booking) =>
            (!where.id || booking.id === where.id) &&
            (!where.tenantId || booking.tenantId === where.tenantId)
        ) || null,
    },
    viewingRequest: {
      create: async ({ data }) => {
        const row = { id: viewingNum++, ...data };
        state.viewingRequests.push(row);
        return row;
      },
    },
    aIFraudSignal: { create: async (data) => data },
    referral: {
      findUnique: async () => null,
      update: async () => ({ rewardClaimed: true }),
      upsert: async () => ({ count: 1, rewardClaimed: false }),
    },
  };
}

const VERIFIED_FLAT = {
  id: 42,
  title: "Owerri Verified Flat",
  description: "Two bedroom flat",
  price: 850000,
  currency: "NGN",
  status: "VERIFIED",
  reviewStatus: "APPROVED",
  isFlaggedForFraud: false,
  riskState: "VERIFIED",
  truthIndex: 80,
  category: "RESIDENTIAL",
  property: { city: "Owerri", state: "Imo", lga: "Owerri Municipal", bedrooms: 2 },
};

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  for (const key of ENV_KEYS) delete process.env[key];
  logLines = [];
  originalLog = console.log;
  originalWarn = console.warn;
  originalError = console.error;
  const capture = (level) => (...args) => {
    logLines.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "));
    if (level === "error") originalError.apply(console, args);
  };
  console.log = capture("log");
  console.warn = capture("warn");
  console.error = capture("error");
});

afterEach(() => {
  console.log = originalLog;
  console.warn = originalWarn;
  console.error = originalError;
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

test("invalid signature returns 403 and does not open a session", async () => {
  process.env.WHATSAPP_APP_SECRET = CANARY_APP_SECRET;
  const prisma = createMemoryPrisma();
  const app = rawApp(prisma, { complete: async () => "{\"intent\":\"GENERAL_HELP\",\"arguments\":{}}" });
  const server = await listen(app);
  try {
    const buf = Buffer.from(JSON.stringify(messageBody("2348011111111", "hello", "wamid.bad-sig")));
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/whatsapp/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": "sha256=deadbeef",
      },
      body: buf,
    });
    assert.equal(res.status, 403);
    assert.equal(prisma.state.sessions.length, 0);
  } finally {
    server.close();
  }
});

test("valid signed webhook runs SEARCH_LISTINGS from Gemini output against database rows", async () => {
  process.env.WHATSAPP_APP_SECRET = CANARY_APP_SECRET;
  const prisma = createMemoryPrisma({ listings: [VERIFIED_FLAT] });
  const calls = [];
  const complete = async (input) => {
    calls.push(input);
    return JSON.stringify({
      intent: "SEARCH_LISTINGS",
      arguments: { area: "Owerri" },
      userMessage: "Palm Court is available for NGN 1",
    });
  };
  const app = rawApp(prisma, { complete });
  const server = await listen(app);
  try {
    const res = await postWebhook(
      server,
      messageBody("2348011111111", "2 bedroom in Owerri", "wamid.search-1"),
      CANARY_APP_SECRET
    );
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    const outbound = prisma.state.messages.find((message) => message.direction === "OUTBOUND");
    assert.ok(outbound);
    assert.match(outbound.content, /Owerri Verified Flat/);
    assert.match(outbound.content, /850000/);
    assert.equal(outbound.content.includes("Palm Court"), false);
    assert.equal(outbound.content.includes("NGN 1"), false);
  } finally {
    server.close();
  }
});

test("duplicate Meta message id is ignored", async () => {
  const prisma = createMemoryPrisma({ listings: [VERIFIED_FLAT] });
  let calls = 0;
  const complete = async () => {
    calls += 1;
    return JSON.stringify({ intent: "GENERAL_HELP", arguments: {} });
  };
  const app = rawApp(prisma, { complete });
  const server = await listen(app);
  try {
    const body = messageBody("2348011111111", "hello there", "wamid.dup-ai");
    const first = await postWebhook(server, body);
    const second = await postWebhook(server, body);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(calls, 1);
    assert.equal(prisma.state.messages.filter((message) => message.direction === "INBOUND").length, 1);
  } finally {
    server.close();
  }
});

test("missing GCP credentials use the deterministic menu", async () => {
  const prisma = createMemoryPrisma();
  const app = rawApp(prisma);
  const server = await listen(app);
  try {
    const res = await postWebhook(server, messageBody("2348011111111", "hello", "wamid.no-gcp"));
    assert.equal(res.status, 200);
    const outbound = prisma.state.messages.find((message) => message.direction === "OUTBOUND");
    assert.match(outbound.content, /Welcome to Lodgist/);
  } finally {
    server.close();
  }
});

test("model unavailable falls back to the deterministic menu", async () => {
  const prisma = createMemoryPrisma();
  let calls = 0;
  const complete = async () => {
    calls += 1;
    throw new Error("model down");
  };
  const app = rawApp(prisma, { complete });
  const server = await listen(app);
  try {
    const res = await postWebhook(server, messageBody("2348011111111", "hello", "wamid.fallback"));
    assert.equal(res.status, 200);
    assert.equal(calls, 1);
    const outbound = prisma.state.messages.find((message) => message.direction === "OUTBOUND");
    assert.match(outbound.content, /Welcome to Lodgist/);
    assert.match(outbound.content, /Listings/);
  } finally {
    server.close();
  }
});

test("tool layer rejects a hallucinated listing id", async () => {
  const prisma = createMemoryPrisma({ listings: [VERIFIED_FLAT] });
  const missing = await getListingDetails(prisma, { listingId: 99999 });
  assert.equal(missing.ok, false);
  assert.equal(missing.code, "not_found");
  assert.equal(missing.listing, null);

  const complete = async () =>
    JSON.stringify({
      intent: "GET_LISTING_DETAILS",
      arguments: { listingId: 99999 },
      userMessage: "Palm Court is verified and costs 50000000",
    });
  const app = rawApp(prisma, { complete });
  const server = await listen(app);
  try {
    const res = await postWebhook(
      server,
      messageBody("2348011111111", "details for 99999", "wamid.fake-listing")
    );
    assert.equal(res.status, 200);
    const outbound = prisma.state.messages.find((message) => message.direction === "OUTBOUND");
    assert.match(outbound.content, /not a verified Lodgist home/);
    assert.equal(outbound.content.includes("Palm Court"), false);
    assert.equal(outbound.content.includes("50000000"), false);
    assert.equal(prisma.state.viewingRequests.length, 0);
  } finally {
    server.close();
  }
});

test("unknown sender creates a lead session without a User row", async () => {
  const prisma = createMemoryPrisma({ users: [] });
  const complete = async () => JSON.stringify({ intent: "GENERAL_HELP", arguments: {} });
  const app = rawApp(prisma, { complete });
  const server = await listen(app);
  try {
    const res = await postWebhook(
      server,
      messageBody("2348099990000", "I need a home", "wamid.lead-1")
    );
    assert.equal(res.status, 200);
    assert.equal(prisma.state.users.length, 0);
    assert.equal(prisma.state.sessions.length, 1);
    assert.equal(prisma.state.sessions[0].phone, "2348099990000");
    assert.equal(prisma.state.sessions[0].userId, null);
    assert.equal(prisma.state.sessions[0].contactId, null);
    const directions = prisma.state.messages.map((message) => message.direction).sort();
    assert.deepEqual(directions, ["INBOUND", "OUTBOUND"]);
    assert.equal(prisma.state.messages.every((message) => message.senderId == null), true);
  } finally {
    server.close();
  }
});

test("session history is passed to the model", async () => {
  const prisma = createMemoryPrisma({
    sessions: [
      {
        id: "ses_existing",
        userId: null,
        contactId: null,
        phone: "2348011111111",
        isActive: true,
        handoffRequested: false,
        messages: [
          { direction: "INBOUND", content: "earlier question", sentAt: new Date("2026-01-01T00:00:00Z") },
          { direction: "OUTBOUND", content: "earlier answer", sentAt: new Date("2026-01-01T00:01:00Z") },
        ],
      },
    ],
  });
  const calls = [];
  const complete = async (input) => {
    calls.push(input);
    return JSON.stringify({ intent: "GENERAL_HELP", arguments: {} });
  };
  const app = rawApp(prisma, { complete });
  const server = await listen(app);
  try {
    const res = await postWebhook(
      server,
      messageBody("2348011111111", "what did we discuss", "wamid.history-1")
    );
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].history, [
      { role: "user", content: "earlier question" },
      { role: "assistant", content: "earlier answer" },
    ]);
  } finally {
    server.close();
  }
});

test("logs do not contain secret values", async () => {
  process.env.WHATSAPP_APP_SECRET = CANARY_APP_SECRET;
  process.env.WHATSAPP_API_TOKEN = CANARY_API_TOKEN;
  process.env.WHATSAPP_PHONE_NUMBER_ID = "123456";
  process.env.ANTHROPIC_API_KEY = CANARY_ANTHROPIC;
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    if (String(url).includes("graph.facebook.com")) {
      return { ok: true, json: async () => ({ messages: [{ id: "sent" }] }), text: async () => "" };
    }
    return originalFetch(url, init);
  };
  const prisma = createMemoryPrisma();
  const complete = async () => {
    throw new Error(`provider rejected ${CANARY_ANTHROPIC} using ${CANARY_API_TOKEN}`);
  };
  const app = rawApp(prisma, { complete });
  const server = await listen(app);
  try {
    const res = await postWebhook(
      server,
      messageBody("2348099990000", "hello", "wamid.secrets"),
      CANARY_APP_SECRET
    );
    assert.equal(res.status, 200);
    const logs = logLines.join("\n");
    assert.equal(logs.includes(CANARY_APP_SECRET), false);
    assert.equal(logs.includes(CANARY_API_TOKEN), false);
    assert.equal(logs.includes(CANARY_ANTHROPIC), false);
    assert.equal(logs.includes("2348099990000"), false);
  } finally {
    global.fetch = originalFetch;
    server.close();
  }
});

test("REQUEST_VIEWING creates a ViewingRequest only for a real listing and user", async () => {
  const prisma = createMemoryPrisma({
    listings: [VERIFIED_FLAT],
    users: [{ id: 7, name: "Ada", phone: "2348011111111" }],
  });
  const saved = await requestViewing(
    prisma,
    { id: 7 },
    { listingId: 42, preferredDate: "2026-10-10", preferredTime: "10:00" }
  );
  assert.equal(saved.ok, true);
  assert.equal(saved.viewingRequest.status, "REQUESTED");
  assert.equal(saved.viewingRequest.listingId, 42);
  assert.equal(prisma.state.viewingRequests.length, 1);
  assert.equal(prisma.state.viewingRequests[0].requesterId, 7);

  const rejected = await requestViewing(
    prisma,
    null,
    { listingId: 99999, preferredDate: "2026-10-10" }
  );
  assert.equal(rejected.ok, false);
  assert.equal(rejected.code, "listing_not_found");
  assert.equal(prisma.state.viewingRequests.length, 1);
});
