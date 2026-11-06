const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("Gemini auth uses ADC without a repository-local key file", async () => {
  let authOptions;
  class FakeAuth {
    constructor(options) {
      authOptions = options;
    }
  }

  class FakeVertexAI {
    constructor(options) {
      assert.ok(options.googleAuth instanceof FakeAuth);
    }
    models = {
      generateContent: async () => ({
        text: JSON.stringify({ risk_score: 0, red_flags: [], summary: "ok" }),
      }),
    };
  }

  const source = fs.readFileSync(
    path.join(__dirname, "../src/services/geminiService.js"),
    "utf8"
  );
  const context = {
    module: { exports: {} },
    process: {
      env: {
        GCP_PROJECT_ID: "adc-test-project",
        GCP_PROJECT_LOCATION: "us-central1",
      },
    },
    console: { warn() {}, error() {} },
    require(name) {
      if (name === "@google-cloud/vertexai") return { VertexAI: FakeVertexAI };
      if (name === "google-auth-library") return { GoogleAuth: FakeAuth };
      throw new Error("Unexpected import: " + name);
    },
  };

  vm.runInNewContext(source, context, { filename: "geminiService.js" });
  const result = await context.module.exports.analyzeScamText(
    "Test listing",
    "Test description"
  );

  assert.equal(result.summary, "ok");
  assert.equal(authOptions.scopes, "https://www.googleapis.com/auth/cloud-platform");
  assert.equal(Object.prototype.hasOwnProperty.call(authOptions, "keyFile"), false);
  assert.equal(source.includes("lodgist-deploy-key.json"), false);
});
