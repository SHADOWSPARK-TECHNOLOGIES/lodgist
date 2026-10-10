// Every frontend unit test under src/lib must be listed in `pnpm test`,
// otherwise CI never runs it and regressions slip through silently.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");

test("every src/lib/*.test.js file is run by the test script", () => {
  const script = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts.test;
  const files = fs.readdirSync(path.join(root, "src", "lib")).filter((f) => f.endsWith(".test.js"));
  const missing = files.filter((f) => !script.includes(`src/lib/${f}`));
  assert.deepEqual(missing, []);
});
