const { test } = require("node:test");
const assert = require("node:assert/strict");
const { viewingStatusText } = require("./viewingStatus");

test("known viewing statuses stay factual", () => {
  assert.equal(
    viewingStatusText("REQUESTED"),
    "Waiting for a response. This is not a confirmed viewing."
  );
  assert.equal(
    viewingStatusText("SCHEDULED"),
    "Accepted for the requested time. Walk the house before you send rent."
  );
  assert.equal(viewingStatusText("CANCELLED"), "This request was declined or cancelled.");
  assert.equal(viewingStatusText("COMPLETED"), "This viewing is marked complete.");
  assert.equal(viewingStatusText("NO_SHOW"), "This viewing was marked as a no-show.");
});

test("an unknown viewing status is marked unknown", () => {
  assert.equal(viewingStatusText("PAID"), "Status is not one Lodgist explains yet.");
  assert.equal(viewingStatusText(""), "Status is not one Lodgist explains yet.");
  assert.equal(viewingStatusText(null), "Status is not one Lodgist explains yet.");
});
