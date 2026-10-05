const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("homepage asks people to check a rental before they pay", () => {
  const page = read("src/app/page.tsx");
  const copy = read("src/lib/copy.ts");
  assert.match(page, /href="\/check"/);
  assert.match(copy, /CHECK A RENTAL BEFORE I PAY/);
  assert.match(copy, /Found a house online\? Before you send money, let Lodgist check it\./);
});

test("report wording stays on the three locked recommendations", () => {
  const source = read("src/lib/rentalCheck.ts");
  assert.match(source, /LOWER RISK — PROCEED WITH NORMAL PRECAUTIONS/);
  assert.match(source, /UNCERTAIN — VERIFY THESE ITEMS FIRST/);
  assert.match(source, /HIGH RISK — DO NOT PAY YET/);
  assert.equal(/fraud-free|100% verified|guaranteed|\bsafe\b/i.test(source), false);
});
