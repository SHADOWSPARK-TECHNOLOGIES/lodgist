const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const migrationPath = path.resolve(
  __dirname,
  "../../packages/db/prisma/migrations/20261010140000_spatial_monitor_tables/migration.sql",
);

test("the spatial monitor migration only creates new tables", () => {
  const sql = fs.readFileSync(migrationPath, "utf8");
  assert.equal(/\bALTER\s+TABLE\b/i.test(sql), false);
  assert.equal(/\bDROP\b/i.test(sql), false);
  assert.equal(/^\s*UPDATE\b/im.test(sql), false);
  assert.equal(sql.includes('CREATE TABLE "SpatialMonitor"'), true);
  assert.equal(sql.includes('CREATE TABLE "SpatialMonitorObservation"'), true);
  ["User", "Listing", "Booking", "Property", "RentalCheck", "Lead"].forEach((name) => {
    assert.equal(sql.includes(`"${name}"`), false, name);
  });
});
