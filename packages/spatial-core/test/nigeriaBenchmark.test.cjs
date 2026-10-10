const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SCRIPT = path.resolve(__dirname, "../../../scripts/nigeria_benchmark.py");
const FIXTURE = path.resolve(__dirname, "fixtures/nigeria-mini.osm");

function runHarness(extra = []) {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "ngbench-")), "benchmark.json");
  const res = spawnSync("python3", [SCRIPT, "--input", FIXTURE, "--output", out, "--generated-at", "2026-10-10T00:00:00Z", ...extra], { encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr);
  return JSON.parse(fs.readFileSync(out, "utf8"));
}

test("benchmark carries ODbL attribution, provider and extract date", () => {
  const report = runHarness();
  assert.equal(report.license, "ODbL-1.0");
  assert.equal(report.attribution, "\u00a9 OpenStreetMap contributors");
  assert.equal(report.provider.commercialUse, "APPROVED_WITH_ATTRIBUTION");
  assert.equal(report.extractDate, "2026-10-09T20:21:04Z");
  assert.equal(report.method.radiusM, 3000);
  assert.equal(report.points.length, 11);
});

test("counts features within 3 km only, including way-based amenities", () => {
  const uniport = runHarness().points.find((p) => p.id === "uniport-choba");
  assert.equal(uniport.counts.hospital, 1, "hospital 5.5 km north is excluded");
  assert.equal(uniport.counts.pharmacy, 1);
  assert.equal(uniport.counts.supermarket, 1);
  assert.equal(uniport.counts.bank, 1);
  assert.equal(uniport.counts.school, 1, "school mapped as a closed way");
  assert.equal(uniport.poiTotal, 5);
  assert.equal(uniport.highwayWays, 3);
  assert.equal(uniport.namedHighwayWays, 1);
  assert.equal(uniport.namedRoadPct, 33.3);
  assert.equal(uniport.coverageGrade, "POOR");
});

test("empty areas grade EMPTY and unverified coordinates are flagged", () => {
  const report = runHarness();
  const nekede = report.points.find((p) => p.id === "nekede-poly");
  assert.equal(nekede.poiTotal, 0);
  assert.equal(nekede.coverageGrade, "EMPTY");
  assert.equal(nekede.coordsVerifiedAgainstOSM, false);
  const rumu = report.points.find((p) => p.id === "rumuokoro");
  assert.equal(rumu.counts.fuel, 1);
});

test("extract date can be overridden and a missing input fails", () => {
  assert.equal(runHarness(["--extract-date", "2026-01-01T00:00:00Z"]).extractDate, "2026-01-01T00:00:00Z");
  const res = spawnSync("python3", [SCRIPT, "--input", "/nonexistent.osm.pbf"], { encoding: "utf8" });
  assert.notEqual(res.status, 0);
});
