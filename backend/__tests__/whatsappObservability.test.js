const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const createWhatsAppRouter = require("../src/routes/whatsapp");
const { phoneLast4, mapGraphError, logWebhookEvent } = require("../src/services/whatsapp/redact");

const ENV_KEYS = [
  "WHATSAPP_API_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_APP_SECRET",
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_PUBLIC_URL",
  "GEMINI_API_KEY",
  "GCP_PROJECT_ID",
  "GCP_PROJECT_LOCATION",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "ANTHROPIC_API_KEY",
  "JWT_SECRET",
];
const PHONE = "2348031234572";
const BODY = "secret body text please do not log";
const TOKEN = "tok-super-secret-value";
let saved;
let lines;
let restore;

beforeEach(() => {
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.JWT_SECRET = "test-secret";
  lines = [];
  const log = console.log;
  const err = console.error;
  const warn = console.warn;
  const capture = (...a) => lines.push(a.map(String).join(" "));
  console.log = capture;
  console.error = capture;
  console.warn = capture;
  restore = () => {
    console.log = log;
    console.error = err;
    console.warn = warn;
  };
});

afterEach(() => {
  restore();
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

function events() {
  return lines
    .filter((l) => l.startsWith("[WhatsAppEvent] "))
    .map((l) => JSON.parse(l.slice("[WhatsAppEvent] ".length)));
}

function assertNoLeak() {
  const all = lines.join("\n");
  assert.equal(all.includes(PHONE), false, "full phone leaked");
  assert.equal(all.includes(BODY), false, "message body leaked");
  assert.equal(all.includes(TOKEN), false, "token leaked");
  assert.equal(all.includes("test-app-secret"), false, "app secret leaked");
  assert.equal(all.includes("sha256="), false, "signature leaked");
}

function fakePrisma({ failCreate } = {}) {
  const rows = [];
  return {
    rows,
    user: { findFirst: async () => null },
    whatsAppSession: {
      findFirst: async () => null,
      create: async ({ data }) => ({ id: "ses_1", messages: [], userId: null, contactId: null, ...data }),
    },
    whatsAppMessage: {
      create: async ({ data }) => {
        if (failCreate) {
          const e = new Error("db down");
          e.code = "P1001";
          throw e;
        }
        rows.push(data);
        return data;
      },
    },
  };
}

function graph(status, json, headers = {}) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => json,
      headers: { get: (k) => headers[k.toLowerCase()] || null },
    };
  };
  fn.calls = calls;
  return fn;
}

const aiDown = async () => {
  const e = new Error("AI off");
  e.code = "AI_UNAVAILABLE";
  throw e;
};

async function withServer(prisma, opts, fn) {
  const app = express();
  app.use("/api/whatsapp/webhook", express.raw({ type: "application/json" }));
  app.use(express.json());
  app.use("/api/whatsapp", createWhatsAppRouter(prisma, { complete: aiDown, ...opts }));
  const server = await new Promise((r) => {
    const s = app.listen(0, "127.0.0.1", () => r(s));
  });
  try {
    return await fn(`http://127.0.0.1:${server.address().port}/api/whatsapp`);
  } finally {
    server.close();
  }
}

function inbound(id, extra = {}) {
  return {
    entry: [{ changes: [{ value: {
      metadata: { phone_number_id: "15550001111" },
      contacts: [{ profile: { name: "Ada Secret" } }],
      messages: [{ id, from: PHONE, type: "text", timestamp: "1", text: { body: BODY }, ...extra }],
    } }] }],
  };
}

function post(base, payload, headers = {}) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return fetch(`${base}/webhook`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body });
}

test("phoneLast4 and mapGraphError", () => {
  assert.equal(phoneLast4("+234 803 123 4572"), "4572");
  assert.equal(phoneLast4("12"), null);
  assert.equal(phoneLast4(null), null);
  assert.equal(mapGraphError({ httpStatus: 401 }), "META_AUTH");
  assert.equal(mapGraphError({ httpStatus: 400, code: 190 }), "META_AUTH");
  assert.equal(mapGraphError({ httpStatus: 429 }), "META_RATE_LIMIT");
  assert.equal(mapGraphError({ httpStatus: 400, code: 130429 }), "META_RATE_LIMIT");
  assert.equal(mapGraphError({ httpStatus: 400, code: 131047 }), "META_RECIPIENT");
  assert.equal(mapGraphError({ httpStatus: 400, code: 100 }), "META_BAD_REQUEST");
  assert.equal(mapGraphError({ httpStatus: 503 }), "META_SERVER");
});

test("logWebhookEvent drops unknown keys and redacts secrets", () => {
  process.env.WHATSAPP_API_TOKEN = TOKEN;
  logWebhookEvent({ outcome: "replied", body: BODY, phone: PHONE, reply: { httpStatus: 200, raw: "x" }, route: TOKEN });
  const [e] = events();
  assert.equal(e.evt, "whatsapp_webhook");
  assert.equal(e.body, undefined);
  assert.equal(e.phone, undefined);
  assert.deepEqual(e.reply, { httpStatus: 200 });
  assert.equal(e.errorCode, null);
  assertNoLeak();
});

test("rejected_signature: missing and invalid", async () => {
  process.env.WHATSAPP_APP_SECRET = "test-app-secret";
  await withServer(fakePrisma(), {}, async (base) => {
    assert.equal((await post(base, inbound("wamid.s1"))).status, 403);
    assert.equal((await post(base, inbound("wamid.s1"), { "X-Hub-Signature-256": "sha256=deadbeef" })).status, 403);
  });
  const ev = events();
  assert.equal(ev.length, 2);
  assert.deepEqual(ev.map((e) => [e.outcome, e.errorCode]), [
    ["rejected_signature", "SIGNATURE_MISSING"],
    ["rejected_signature", "SIGNATURE_INVALID"],
  ]);
  assert.equal(typeof ev[0].durationMs, "number");
  assertNoLeak();
});

test("ignored_unparseable, ignored_no_messages, ignored_status_update", async () => {
  await withServer(fakePrisma(), {}, async (base) => {
    assert.equal((await post(base, "{not json")).status, 200);
    assert.equal((await post(base, { entry: [] })).status, 200);
    const statuses = { entry: [{ changes: [{ value: {
      metadata: { phone_number_id: "15550001111" },
      statuses: [{ id: "wamid.st1", status: "delivered", recipient_id: PHONE }, { id: "wamid.st2", status: "read", recipient_id: PHONE }],
    } }] }] };
    assert.equal((await post(base, statuses)).status, 200);
  });
  const ev = events();
  assert.equal(ev.length, 3);
  assert.equal(ev[0].outcome, "ignored_unparseable");
  assert.equal(ev[0].errorCode, "BODY_UNPARSEABLE");
  assert.equal(ev[1].outcome, "ignored_no_messages");
  assert.equal(ev[2].outcome, "ignored_status_update");
  assert.equal(ev[2].statusCount, 2);
  assert.deepEqual(ev[2].statuses, ["delivered", "read"]);
  assert.deepEqual(ev[2].metaMessageIds, ["wamid.st1", "wamid.st2"]);
  assertNoLeak();
});

test("ignored_other_number logs last 4 of both ids only", async () => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = "15550001111";
  const prisma = fakePrisma();
  const payload = inbound("wamid.o1");
  payload.entry[0].changes[0].value.metadata.phone_number_id = "15559999999";
  await withServer(prisma, {}, async (base) => {
    assert.equal((await post(base, payload)).status, 200);
  });
  const [e] = events();
  assert.equal(e.outcome, "ignored_other_number");
  assert.equal(e.phoneNumberIdMatch, false);
  assert.equal(e.phoneNumberIdLast4, "9999");
  assert.equal(e.configuredLast4, "1111");
  assert.equal(lines.join("").includes("15559999999"), false);
  assert.equal(prisma.rows.length, 0);
  assertNoLeak();
});

test("replied stores the Meta id; duplicate logs ignored_duplicate", async () => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = "15550001111";
  process.env.WHATSAPP_API_TOKEN = TOKEN;
  const prisma = fakePrisma();
  const fetchImpl = graph(200, { messages: [{ id: "wamid.out1" }] });
  await withServer(prisma, { fetch: fetchImpl }, async (base) => {
    assert.equal((await post(base, inbound("wamid.in1"))).status, 200);
    assert.equal((await post(base, inbound("wamid.in1"))).status, 200);
  });
  const ev = events();
  assert.equal(ev.length, 2);
  assert.equal(ev[0].outcome, "replied");
  assert.deepEqual(ev[0].metaMessageIds, ["wamid.in1"]);
  assert.deepEqual(ev[0].msgTypes, ["text"]);
  assert.equal(ev[0].phoneLast4, "4572");
  assert.equal(ev[0].isLead, true);
  assert.equal(ev[0].aiOutcome, "unavailable");
  assert.equal(ev[0].reply.metaMessageId, "wamid.out1");
  assert.equal(ev[0].reply.httpStatus, 200);
  assert.equal(ev[0].errorCode, null);
  assert.equal(ev[1].outcome, "ignored_duplicate");
  assert.equal(fetchImpl.calls.length, 1);
  const out = prisma.rows.find((r) => r.direction === "OUTBOUND");
  assert.deepEqual(out.metadata, { metaMessageId: "wamid.out1", deliveryStatus: "accepted", errorCode: null });
  assertNoLeak();
});

test("reply_skipped_unconfigured never calls Meta and records not_sent", async () => {
  const prisma = fakePrisma();
  const fetchImpl = graph(200, {});
  await withServer(prisma, { fetch: fetchImpl }, async (base) => {
    await post(base, inbound("wamid.u1"));
  });
  const [e] = events();
  assert.equal(e.outcome, "reply_skipped_unconfigured");
  assert.equal(e.errorCode, "WA_NOT_CONFIGURED");
  assert.equal(fetchImpl.calls.length, 0);
  assert.equal(prisma.rows.find((r) => r.direction === "OUTBOUND").metadata.deliveryStatus, "not_sent");
  assertNoLeak();
});

test("reply_failed maps Meta error and records failed", async () => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = "15550001111";
  process.env.WHATSAPP_API_TOKEN = TOKEN;
  const prisma = fakePrisma();
  const fetchImpl = graph(400, { error: { code: 131047, error_subcode: 2494010, message: `body ${BODY}` } });
  await withServer(prisma, { fetch: fetchImpl }, async (base) => {
    await post(base, inbound("wamid.f1"));
  });
  const [e] = events();
  assert.equal(e.outcome, "reply_failed");
  assert.equal(e.errorCode, "META_RECIPIENT");
  assert.deepEqual(e.reply, { httpStatus: 400, metaErrorCode: 131047, deliveryStatus: "failed" });
  assert.deepEqual(prisma.rows.find((r) => r.direction === "OUTBOUND").metadata, {
    metaMessageId: null, deliveryStatus: "failed", errorCode: "META_RECIPIENT",
  });
  assert.ok(lines.some((l) => l.includes("WhatsApp send failed") && l.includes("2494010")));
  assertNoLeak();
});

test("ignored_no_sender and error_internal (DB_ERROR)", async () => {
  await withServer(fakePrisma(), {}, async (base) => {
    await post(base, inbound("wamid.n1", { from: undefined }));
  });
  await withServer(fakePrisma({ failCreate: true }), {}, async (base) => {
    assert.equal((await post(base, inbound("wamid.e1"))).status, 200);
  });
  const ev = events();
  assert.equal(ev.length, 2);
  assert.equal(ev[0].outcome, "ignored_no_sender");
  assert.equal(ev[1].outcome, "error_internal");
  assert.equal(ev[1].errorCode, "DB_ERROR");
  assert.deepEqual(ev[1].metaMessageIds, ["wamid.e1"]);
  assertNoLeak();
});

function admin() {
  return jwt.sign({ id: 1, email: "a@example.com", name: "A", role: "STUDIO_ADMIN" }, process.env.JWT_SECRET);
}

async function send(base, body = { to: PHONE, message: BODY, sessionId: "ses_1" }) {
  const res = await fetch(`${base}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${admin()}` },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json(), headers: res.headers };
}

test("/send 503 when not configured, no row written", async () => {
  const prisma = fakePrisma();
  await withServer(prisma, { fetch: graph(200, {}) }, async (base) => {
    const r = await send(base);
    assert.equal(r.status, 503);
    assert.deepEqual(r.body, { success: false, errorCode: "WA_NOT_CONFIGURED" });
  });
  assert.equal(prisma.rows.length, 0);
});

test("/send success returns metaMessageId and stores it", async () => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = "15550001111";
  process.env.WHATSAPP_API_TOKEN = TOKEN;
  const prisma = fakePrisma();
  await withServer(prisma, { fetch: graph(200, { messages: [{ id: "wamid.s1" }] }) }, async (base) => {
    const r = await send(base);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { success: true, metaMessageId: "wamid.s1" });
  });
  assert.equal(prisma.rows[0].metadata.deliveryStatus, "accepted");
  assert.ok(lines.some((l) => l.includes("WhatsApp send ok") && l.includes("wamid.s1")));
  assertNoLeak();
});

test("/send success with DB failure returns recorded:false", async () => {
  process.env.WHATSAPP_PHONE_NUMBER_ID = "15550001111";
  process.env.WHATSAPP_API_TOKEN = TOKEN;
  await withServer(fakePrisma({ failCreate: true }), { fetch: graph(200, { messages: [{ id: "wamid.s2" }] }) }, async (base) => {
    const r = await send(base);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { success: true, metaMessageId: "wamid.s2", recorded: false });
  });
});

const FAILURES = [
  ["META_AUTH 401", graph(401, { error: { code: 190 } }), 502, "META_AUTH"],
  ["META_AUTH code 190", graph(400, { error: { code: 190 } }), 502, "META_AUTH"],
  ["META_RATE_LIMIT", graph(429, { error: { code: 130429 } }, { "retry-after": "30" }), 429, "META_RATE_LIMIT"],
  ["META_RECIPIENT 24h", graph(400, { error: { code: 131047 } }), 422, "META_RECIPIENT"],
  ["META_BAD_REQUEST", graph(400, { error: { code: 100 } }), 502, "META_BAD_REQUEST"],
  ["META_SERVER", graph(500, null), 502, "META_SERVER"],
  ["META_NETWORK", async () => { throw new Error(`network down ${TOKEN}`); }, 504, "META_NETWORK"],
];

for (const [name, fetchImpl, status, code] of FAILURES) {
  test(`/send ${name} -> ${status}, records failed row, no raw error`, async () => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = "15550001111";
    process.env.WHATSAPP_API_TOKEN = TOKEN;
    const prisma = fakePrisma();
    await withServer(prisma, { fetch: fetchImpl }, async (base) => {
      const r = await send(base);
      assert.equal(r.status, status);
      assert.deepEqual(r.body, { success: false, errorCode: code });
      if (code === "META_RATE_LIMIT") assert.equal(r.headers.get("retry-after"), "30");
    });
    assert.equal(prisma.rows.length, 1);
    assert.equal(prisma.rows[0].metadata.deliveryStatus, "failed");
    assert.equal(prisma.rows[0].metadata.errorCode, code);
    assertNoLeak();
  });
}
