const { test } = require("node:test");
const assert = require("node:assert/strict");
const { safeNextPath } = require("./returnPath");

test("login return path stays on a listing detail url", () => {
  assert.equal(safeNextPath("/listings/12"), "/listings/12");
  assert.equal(safeNextPath("/listings/1"), "/listings/1");
  assert.equal(safeNextPath("https://evil.example/listings/1"), null);
  assert.equal(safeNextPath("//evil.example"), null);
  assert.equal(safeNextPath("/listings/1/edit"), null);
  assert.equal(safeNextPath("/listings/1?next=/admin"), null);
  assert.equal(safeNextPath("/login"), null);
  assert.equal(safeNextPath("/listings/0"), null);
  assert.equal(safeNextPath(""), null);
  assert.equal(safeNextPath(null), null);
});
