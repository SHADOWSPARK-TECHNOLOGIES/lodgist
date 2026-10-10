const { test } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../src/index.cjs");
const { runEvals } = require("../evals/harness.cjs");
const reference = require("../evals/referenceAgent.cjs");

test("12J: claims resolve to real evidence or become UNKNOWN", () => {
  const toolResults = [{ name: "spatial.nearby", result: { ok: true, data: {}, provenance: { provider: "overpass-selfhosted" } } }];
  const out = core.firewallClaims([
    { text: "3 clinics nearby", evidence: { kind: "TOOL_RESULT", ref: "tool:spatial.nearby" } },
    { text: "Imo State University campus area", evidence: { kind: "APPROVED_STATIC_DATA", ref: "static:campus:imsu" } },
    { text: "Data from provider", evidence: { kind: "PROVIDER_EVIDENCE", ref: "provider:overpass-selfhosted" } },
    { text: "Travel time unknown", evidence: { kind: "DATA_UNAVAILABLE" } },
    { text: "Mapped data may be incomplete", evidence: { kind: "COVERAGE_INCOMPLETE" } },
    { text: "Route takes 12 minutes", evidence: { kind: "TOOL_RESULT", ref: "tool:spatial.route" } },
    { text: "This is a very safe area" },
    { text: "Welcome!", factual: false },
    { text: "Best schools in Owerri", factual: false },
    { text: "Listed in db", evidence: { kind: "DATABASE_EVIDENCE", ref: "tool:spatial.nearby" } },
  ], { toolResults });
  assert.deepEqual(out.claims.map((c) => c.status), ["SUPPORTED", "SUPPORTED", "SUPPORTED", "DATA_UNAVAILABLE", "COVERAGE_INCOMPLETE", "UNKNOWN", "UNKNOWN", "NON_FACTUAL", "UNKNOWN", "UNKNOWN"]);
  assert.equal(out.unsupported, 4);
  assert.equal(out.ok, false);
  assert.ok(out.claims[6].text.startsWith("UNKNOWN"));
});

test("12I: reference agent passes every golden case with zero privacy violations", async () => {
  const { summary } = await runEvals(reference);
  assert.equal(summary.cases, 8);
  assert.equal(summary.score, 1);
  assert.equal(summary.privacyViolations, 0);
  assert.equal(summary.unsupportedClaims, 0);
  assert.equal(summary.providerGateCompliance, 1);
});

test("12I harness self-test: a hallucinating, leaky, wrong-tool agent fails", async () => {
  const bad = {
    name: "bad-agent",
    plan: (prompt, input) => [{ name: "spatial.inspect", args: { listingId: input.listingId || 1 } }],
    answer: () => ({ claims: [{ text: "There are 4 hospitals within 1 km and the area is very safe; gate at 5.5123456" }] }),
  };
  const { summary, results } = await runEvals(bad);
  assert.equal(summary.score, 0);
  assert.ok(summary.toolAcc < 1);
  assert.ok(summary.unsupportedClaims >= summary.cases);
  assert.ok(summary.privacyViolations >= 1);
  results.forEach((r) => assert.equal(r.passed, false));
});

test("12I regression threshold: unsupported factual answer = fail even if tools are right", async () => {
  const sneaky = Object.assign({}, reference, {
    name: "sneaky",
    answer: (calls) => ({ claims: reference.answer(calls).claims.concat([{ text: "Flood-free all year" }]) }),
  });
  const { summary } = await runEvals(sneaky);
  assert.equal(summary.passed, 0);
  assert.equal(summary.toolAcc, 1);
});
