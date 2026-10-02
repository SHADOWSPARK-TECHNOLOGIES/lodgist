const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { listingState, allowsViewing } = require("../src/services/listingState");

test("status VERIFIED does not promote verification or invent availability", () => {
  const state = listingState({
    status: "VERIFIED",
    riskState: "VERIFIED",
    isFlaggedForFraud: false,
    availableFrom: "2026-10-01",
  });
  assert.equal(state.origin, "DIRECT_SUBMISSION");
  assert.equal(state.publication, "PUBLISHED");
  assert.equal(state.availability, "UNKNOWN");
  assert.equal(state.verification, "NOT_CHECKED");
  assert.equal(state.locationPrecision, "UNKNOWN");
  assert.equal(state.actionEligibility, "VIEWING_REQUEST");
  assert.equal(state.labels.origin, "Direct submission");
  assert.equal(state.labels.verification, "Not checked");
  assert.equal(allowsViewing({ status: "VERIFIED", riskState: "VERIFIED", isFlaggedForFraud: false }), true);
});

test("a pending published home is an enquiry and is not checked", () => {
  const state = listingState({ status: "PENDING", riskState: "UNVERIFIED", isFlaggedForFraud: false });
  assert.equal(state.publication, "PUBLISHED");
  assert.equal(state.verification, "NOT_CHECKED");
  assert.equal(state.actionEligibility, "ENQUIRY");
  assert.equal(allowsViewing({ status: "PENDING", riskState: "UNVERIFIED" }), false);
});

test("under review becomes pending verification, not checks completed", () => {
  const state = listingState({ status: "PENDING", riskState: "UNDER_REVIEW" });
  assert.equal(state.verification, "PENDING");
  assert.equal(state.labels.verification, "Pending");
  assert.notEqual(state.verification, "CHECKS_COMPLETED");
});

test("rejected, flagged, and fraud map without opening a viewing", () => {
  assert.equal(listingState({ status: "REJECTED", riskState: "UNVERIFIED" }).publication, "REMOVED");
  assert.equal(listingState({ status: "ARCHIVED" }).actionEligibility, "SOURCE_LINK_ONLY");
  assert.equal(listingState({ status: "VERIFIED", riskState: "FLAGGED" }).publication, "SUSPENDED");
  assert.equal(listingState({ status: "PENDING", riskState: "SUSPENDED" }).publication, "SUSPENDED");
  const fraud = listingState({ status: "VERIFIED", isFlaggedForFraud: true, riskState: "VERIFIED" });
  assert.equal(fraud.publication, "SUSPENDED");
  assert.equal(fraud.actionEligibility, "SOURCE_LINK_ONLY");
  assert.equal(fraud.verification, "NOT_CHECKED");
  assert.equal(allowsViewing({ status: "VERIFIED", isFlaggedForFraud: true }), false);
});

test("stored dimensions win, and a sample cannot request a viewing", () => {
  const state = listingState({
    status: "PENDING",
    origin: "EXTERNAL_REFERENCE",
    publication: "REVIEW",
    availability: "REPORTED_AVAILABLE",
    verification: "PARTIALLY_CHECKED",
    locationPrecision: "APPROXIMATE",
    actionEligibility: "SOURCE_LINK_ONLY",
  });
  assert.equal(state.origin, "EXTERNAL_REFERENCE");
  assert.equal(state.labels.origin, "External reference");
  assert.equal(state.publication, "REVIEW");
  assert.equal(state.availability, "REPORTED_AVAILABLE");
  assert.equal(state.verification, "PARTIALLY_CHECKED");
  assert.equal(state.locationPrecision, "APPROXIMATE");
  assert.equal(state.actionEligibility, "SOURCE_LINK_ONLY");
  assert.equal(
    allowsViewing({
      status: "VERIFIED",
      actionEligibility: "VIEWING_REQUEST",
      totalMoveInCost: { sample: true },
    }),
    false
  );
});

test("migration backfill does not promote verification or invent inventory", () => {
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      "../../packages/db/prisma/migrations/20261002223000_listing_state_dimensions/migration.sql"
    ),
    "utf8"
  );
  assert.doesNotMatch(sql, /THEN 'CHECKS_COMPLETED'/);
  assert.doesNotMatch(sql, /THEN 'PARTIALLY_CHECKED'/);
  assert.doesNotMatch(sql, /THEN 'REPORTED_AVAILABLE'/);
  assert.doesNotMatch(sql, /THEN 'RECENTLY_CONFIRMED'/);
  assert.doesNotMatch(sql, /THEN 'AUTHORIZED_IMPORT'/);
  assert.doesNotMatch(sql, /THEN 'EXTERNAL_REFERENCE'/);
  assert.doesNotMatch(sql, /THEN 'EXACT'/);
  assert.match(sql, /ELSE 'NOT_CHECKED'::"ListingVerification"/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "origin"/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "actionEligibility"/);
});
