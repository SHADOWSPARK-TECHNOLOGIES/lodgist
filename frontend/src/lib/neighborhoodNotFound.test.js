// /listings/<id>/neighborhood must be a real 404 (with layout and <main>) for an
// invalid id or a definite API 404, and keep its error state for API failures.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");

test("the proxy covers the neighborhood route", () => {
  const proxy = read("proxy.ts");
  assert.match(proxy, /"\/listings\/:id\/neighborhood"/);
});

test("the neighborhood page never calls notFound() inside its try block", () => {
  const page = read("app/listings/[id]/neighborhood/page.tsx");
  // The fetch lives in neighborhoodLoad.js; any try block left in the page
  // must not contain notFound().
  const start = page.indexOf("try {");
  if (start !== -1) assert.doesNotMatch(page.slice(start, page.indexOf("} catch", start)), /notFound\(\)/);
  // API failures still render the error state.
  assert.match(page, /We could not load this home\./);
});
