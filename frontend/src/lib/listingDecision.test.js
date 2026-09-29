const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildDecision, whatsAppLink } = require("./listingDecision");

test("a pending sample does not invent verification or passed checks", () => {
  const view = buildDecision({
    status: "PENDING",
    price: 1200000,
    totalMoveInCost: { sample: true, total: 1560000 },
  });
  assert.equal(view.sample, true);
  assert.equal(view.verified, false);
  assert.equal(view.annualRent, 1200000);
  assert.equal(view.moveInTotal, 1560000);
  assert.equal(view.moveInIsExample, true);
  assert.equal(view.lastVerificationText, "No verification on record.");
  assert.match(view.checksDoneText, /None/);
  assert.equal(view.checksOutstanding.length, 6);
  assert.match(view.checksOutstanding[2], /Physical inspection/);
});

test("a verified listing still does not publish a check date or a fake pass list", () => {
  const view = buildDecision({
    status: "VERIFIED",
    price: 900000,
    updatedAt: "2026-09-01T00:00:00.000Z",
    totalMoveInCost: { total: 1100000 },
  });
  assert.equal(view.verified, true);
  assert.equal(view.sample, false);
  assert.equal(view.moveInIsExample, false);
  assert.match(view.lastVerificationText, /not published/);
  assert.doesNotMatch(view.lastVerificationText, /2026/);
  assert.match(view.checksDoneText, /not published/);
  assert.deepEqual(view.checksOutstanding, [
    "Physical inspection — walk the house before you pay.",
  ]);
});

test("a sample flag on a verified row is still not a live decision", () => {
  const view = buildDecision({
    status: "VERIFIED",
    price: 1,
    totalMoveInCost: { sample: true, total: 2 },
  });
  assert.equal(view.sample, true);
  assert.equal(view.checksDoneText.startsWith("None"), true);
});

test("WhatsApp link needs a real env value", () => {
  assert.equal(whatsAppLink(undefined, "inspect"), null);
  assert.equal(whatsAppLink("", "inspect"), null);
  assert.equal(
    whatsAppLink("2348000000000", "I want to inspect"),
    "https://wa.me/2348000000000?text=I%20want%20to%20inspect",
  );
});
