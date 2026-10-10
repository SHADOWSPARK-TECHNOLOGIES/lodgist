const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "..");
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

function tsxFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsxFiles(rel));
    else if (entry.name.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

test("a skip link comes first and targets the single <main>", () => {
  const layout = read("src/app/layout.tsx");
  const skip = layout.indexOf('href="#main-content"');
  assert.ok(skip > 0, "skip link present");
  assert.ok(skip < layout.indexOf("<AuthProvider>"), "skip link before the nav");
  assert.match(layout, /Skip to main content/);
  assert.match(layout, /<main id="main-content"/);
  const mains = tsxFiles("src").filter((f) => /<main[\s>]/.test(read(f)));
  assert.deepEqual(mains, [path.join("src", "app", "layout.tsx")]);
  assert.match(read("src/app/globals.css"), /\.skip-link:focus/);
});

test("a missing or malformed listing id is a server 404 with a helpful page", () => {
  const page = read("src/app/listings/[id]/page.tsx");
  assert.equal(page.includes('"use client"') || page.includes("'use client'"), false);
  assert.match(page, /isValidListingId\(id\)\) notFound\(\)/);
  // A definite API 404 is rewritten by src/proxy.ts to a fully server-rendered
  // 404 page (see listingNotFoundRoute.test.js).
  assert.match(read("src/proxy.ts"), /listingRouteDecision/);
  assert.match(read("src/app/listing-not-found/[id]/page.tsx"), /<ListingNotFound \/>/);
  const notFound = read("src/app/listings/[id]/ListingNotFound.tsx");
  assert.match(notFound, /detail\.missing/);
  assert.match(notFound, /href="\/listings"/);
  assert.match(notFound, /href="\/search"/);
  assert.ok(fs.existsSync(path.join(root, "src/app/not-found.tsx")));
});

test("API requests time out and /listings drops stale responses", () => {
  const api = read("src/lib/api.ts");
  assert.match(api, /timeoutSignal\(options\.signal\)/);
  assert.match(api, /new ApiError\(TIMEOUT_MESSAGE, 408\)/);
  for (const rel of ["src/app/listings/page.tsx", "src/app/search/page.tsx"]) {
    const src = read(rel);
    assert.match(src, /new AbortController\(\)/, rel);
    assert.match(src, /controller\.abort\(\)/, rel);
    assert.match(src, /clearTimeout\(timer\)/, rel);
    assert.match(src, /signal: controller\.signal/, rel);
  }
});

test("destructive admin actions use the danger style", () => {
  const queue = read("src/components/admin/ListingReviewQueue.tsx");
  assert.match(queue, /className="btn btn-danger"[^>]*>Reject</);
  assert.match(queue, /className="btn btn-danger"[\s\S]{0,400}Remove verification/);
  assert.match(read("src/app/globals.css"), /\.btn-danger \{/);
});

test("footer links have a 44px tap height", () => {
  const footer = read("src/components/SiteFooter.tsx");
  assert.equal(footer.includes('fontSize: "0.8rem"'), false);
  assert.match(footer, /footer-link/);
  assert.match(read("src/app/globals.css"), /\.footer-link \{[^}]*min-height: 44px/);
});

test("list pages explain both labels in plain text and the search spinner has a status", () => {
  const legend = (read("src/lib/copy.ts").match(/labelsLegend: "([^"]+)"/) || [])[1] || "";
  assert.match(legend, /Lodgist-reviewed/);
  assert.match(legend, /Verified by Lodgist/);
  assert.match(legend, /Reviewed is not verified/);
  assert.match(legend, /neither label is a guarantee/);
  assert.match(read("src/app/listings/page.tsx"), /copy\.labelsLegend/);
  const search = read("src/app/search/page.tsx");
  assert.match(search, /browse\.labelsLegend/);
  assert.match(search, /role="status" aria-live="polite">\s*<div className="spinner" aria-hidden="true"/);
});
