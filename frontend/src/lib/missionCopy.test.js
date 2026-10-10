const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const copy = readFileSync(join(__dirname, "copy.ts"), "utf8");
const start = copy.indexOf("export const mission = {");
const end = copy.indexOf("export const trustCenter", start);
const mission = copy.slice(start, end);

test("mission copy admits there is no reviewed Nekede room", () => {
  assert.ok(start > 0);
  assert.match(mission, /Not yet/);
  assert.match(mission, /nothing to rent/);
  assert.match(mission, /portal ad is not a Lodgist listing/);
  assert.doesNotMatch(mission, /100%|thousands|guaranteed|0% Fraud/i);
});
