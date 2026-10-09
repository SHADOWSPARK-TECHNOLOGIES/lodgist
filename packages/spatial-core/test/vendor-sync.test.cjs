const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const SOURCE = path.resolve(__dirname, "..");
const VENDOR = path.resolve(__dirname, "../../../frontend/vendor/spatial-core");

function filesIn(root, dir = root) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "test" || entry.name === "pnpm-lock.yaml" || entry.name === "pnpm-workspace.yaml") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...filesIn(root, full));
    else out.push(path.relative(root, full));
  }
  return out.sort();
}

function hash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

test("frontend vendor copy matches packages/spatial-core", () => {
  const sourceFiles = filesIn(SOURCE);
  const vendorFiles = filesIn(VENDOR);
  assert.deepEqual(vendorFiles, sourceFiles);
  for (const relative of sourceFiles) {
    assert.equal(hash(path.join(VENDOR, relative)), hash(path.join(SOURCE, relative)), relative);
  }
});
