const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const createWhatsAppRouter = require("../src/routes/whatsapp");

const ENV_KEYS = [
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_PUBLIC_URL",
  "WHATSAPP_APP_SECRET",
  "NODE_ENV",
];
let saved;

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function rawApp(prisma) {
  const app = express();
  app.use("/api/whatsapp/webhook", express.raw({ type: "application/json" }));
  app.use("/api/whatsapp", createWhatsAppRouter(prisma || {}));
  return app;
}

function sign(secret, buf) {
  return `sha256=${crypto.createHmac("sha256", secret).update(buf).digest("hex")}`;
}

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

test("site links stay empty until WHATSAPP_PUBLIC_URL is set", () => {
  assert.equal(createWhatsAppRouter.sitePath("/listings"), "");
  assert.equal(createWhatsAppRouter.listingsReply().includes("lodgist.ng"), false);
  assert.equal(createWhatsAppRouter.listingsReply().includes("Admiralty"), false);
  process.env.WHATSAPP_PUBLIC_URL = "https://example.test/";
  assert.equal(createWhatsAppRouter.sitePath("/listings"), "https://example.test/listings");
});

test("GET /api/whatsapp/webhook rejects verification without WHATSAPP_VERIFY_TOKEN", async () => {
  const app = express();
  app.use("/api/whatsapp", createWhatsAppRouter({}));
  const server = await listen(app);
  try {
    const { port } = server.address();
    const res = await fetch(
      `http://127.0.0.1:${port}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=anything&hub.challenge=123`
    );
    assert.equal(res.status, 403);
  } finally {
    server.close();
  }
});

test("GET /api/whatsapp/webhook echoes the challenge only when the token matches", async () => {
  process.env.WHATSAPP_VERIFY_TOKEN = "test-verify-token";
  const app = express();
  app.use("/api/whatsapp", createWhatsAppRouter({}));
  const server = await listen(app);
  try {
    const { port } = server.address();
    const ok = await fetch(
      `http://127.0.0.1:${port}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=abc`
    );
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), "abc");
    const bad = await fetch(
      `http://127.0.0.1:${port}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=other&hub.challenge=abc`
    );
    assert.equal(bad.status, 403);
  } finally {
    server.close();
  }
});

test("POST Buffer body is parsed and acked when there are no messages", async () => {
  const app = rawApp({});
  const server = await listen(app);
  try {
    const { port } = server.address();
    const buf = Buffer.from(JSON.stringify({ object: "whatsapp_business_account", entry: [] }));
    const res = await fetch(`http://127.0.0.1:${port}/api/whatsapp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: buf,
    });
    assert.equal(res.status, 200);
  } finally {
    server.close();
  }
});

test("POST requires signature when WHATSAPP_APP_SECRET is set", async () => {
  process.env.WHATSAPP_APP_SECRET = "test-app-secret";
  const app = rawApp({});
  const server = await listen(app);
  try {
    const { port } = server.address();
    const buf = Buffer.from(JSON.stringify({ entry: [] }));
    const res = await fetch(`http://127.0.0.1:${port}/api/whatsapp/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: buf,
    });
    assert.equal(res.status, 403);
  } finally {
    server.close();
  }
});

test("POST accepts Buffer payload with matching X-Hub-Signature-256", async () => {
  process.env.WHATSAPP_APP_SECRET = "test-app-secret";
  const app = rawApp({});
  const server = await listen(app);
  try {
    const { port } = server.address();
    const buf = Buffer.from(JSON.stringify({ object: "whatsapp_business_account", entry: [] }));
    const res = await fetch(`http://127.0.0.1:${port}/api/whatsapp/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": sign("test-app-secret", buf),
      },
      body: buf,
    });
    assert.equal(res.status, 200);
  } finally {
    server.close();
  }
});

test("POST skips duplicate msg.id before user lookup", async () => {
  let lookups = 0;
  const prisma = {
    user: {
      findFirst: async () => {
        lookups += 1;
        return null;
      },
    },
  };
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "1" },
              messages: [
                {
                  id: "wamid.dup-1",
                  from: "234000",
                  type: "text",
                  timestamp: "1",
                  text: { body: "hi" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
  const buf = Buffer.from(JSON.stringify(payload));
  const app = rawApp(prisma);
  const server = await listen(app);
  try {
    const { port } = server.address();
    const url = `http://127.0.0.1:${port}/api/whatsapp/webhook`;
    const first = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: buf,
    });
    const second = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: buf,
    });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal(lookups, 1);
  } finally {
    server.close();
  }
});
