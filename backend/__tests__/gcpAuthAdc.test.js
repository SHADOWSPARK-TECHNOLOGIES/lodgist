const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("all Gemini analysis paths use Gen AI SDK + ADC without a local key file", async () => {
  const instances = [];
  const requests = [];

  class FakeGenAI {
    constructor(options) {
      instances.push(options);
      this.models = {
        generateContent: async (request) => {
          requests.push(request);
          return {
            text: JSON.stringify({
              risk_score: 0, red_flags: [], summary: "ok",
              is_fraud: false, explanation: "ok",
              rating: 0, verified: false, recommendations: [],
            }),
          };
        },
      };
    }
  }

  const source = fs.readFileSync(
    path.join(__dirname, "../src/services/geminiService.js"),
    "utf8"
  );
  const context = {
    module: { exports: {} },
    process: { env: {
      GCP_PROJECT_ID: "adc-test-project",
      GCP_PROJECT_LOCATION: "us-central1",
    }},
    console: { warn() {}, error() {} },
    require(name) {
      if (name === "@google/genai") return { GoogleGenAI: FakeGenAI };
      throw new Error("Unexpected import: " + name);
    },
  };

  vm.runInNewContext(source, context, { filename: "geminiService.js" });
  const ai = context.module.exports;
  assert.equal((await ai.analyzeVisualFraud("image")).summary, "ok");
  assert.equal((await ai.analyzeScamText("title", "description")).summary, "ok");
  assert.equal((await ai.extractLandDocument("document")).success, true);
  assert.equal((await ai.detectChatFraud([{role:"user",content:"Hello"}])).explanation, "ok");
  assert.equal((await ai.auditArtisan({name:"Artisan"})).summary, "ok");

  assert.equal(instances.length, 5);
  for (const options of instances) {
    assert.equal(options.vertexai, true);
    assert.equal(options.project, "adc-test-project");
    assert.equal(options.location, "us-central1");
    assert.equal(Object.hasOwn(options, "keyFile"), false);
    assert.equal(Object.hasOwn(options, "apiKey"), false);
  }
  assert.equal(requests.length, 5);
  for (const request of requests) {
    assert.equal(request.model, "gemini-2.5-flash");
    assert.equal(request.config.responseMimeType, "application/json");
  }
  assert.equal(source.includes("lodgist-deploy-key.json"), false);
  assert.equal(source.includes("@google-cloud/vertexai"), false);
});

test("billable AI endpoints reject unauthenticated and non-admin calls", async () => {
  const express = require("express");
  const jwt = require("jsonwebtoken");
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "ci-test-only-authorization-secret";
  const app = express();
  app.use(express.json());
  app.use("/api/ai-analysis", require("../src/routes/ai-analysis"));

  const server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  try {
    const url = `http://127.0.0.1:${server.address().port}/api/ai-analysis`;
    const tenant = jwt.sign({ id: 1, role: "TENANT" }, process.env.JWT_SECRET);
    for (const path of ["/analyze-scam", "/analyze-visual", "/verify-land", "/chat-fraud", "/audit-artisan"]) {
      const options = { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" };
      assert.equal((await fetch(url + path, options)).status, 401, path);
      assert.equal((await fetch(url + path, { ...options, headers: { ...options.headers, Authorization: `Bearer ${tenant}` } })).status, 403, path);
    }
    assert.equal((await fetch(url + "/health")).status, 200);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});
