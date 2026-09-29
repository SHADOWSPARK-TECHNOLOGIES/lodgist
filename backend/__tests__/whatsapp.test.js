const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const createWhatsAppRouter = require("../src/routes/whatsapp");

const ENV_KEYS = ["WHATSAPP_VERIFY_TOKEN", "WHATSAPP_PUBLIC_URL", "WHATSAPP_APP_SECRET"];
let saved;

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
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
