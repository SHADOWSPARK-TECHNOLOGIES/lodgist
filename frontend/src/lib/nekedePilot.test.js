const fs = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { publicListings } = require("./listingHonesty");
const {
  ADVERTISE_HREF,
  ARTICLE_HREF,
  nekedePage,
  supplyArticle,
  publicListingRows,
} = require("./nekedePilot");
const { loadFacts, planOwerriSeed } = require("../../../packages/db/prisma/seed-owerri-home");

const pageSource = fs.readFileSync(path.join(__dirname, "../app/nekede/page.tsx"), "utf8");
const articleSource = fs.readFileSync(path.join(__dirname, "../app/nekede/supply/page.tsx"), "utf8");

function joined(value) {
  return JSON.stringify(value);
}

test("the Nekede page states the pilot rules and is not a listing", () => {
  const text = joined(nekedePage);
  assert.match(nekedePage.intro, /This page is not a listing/);
  assert.match(nekedePage.intro, /one Owerri campus pilot/);
  assert.match(text, /public list is only for Lodgist-reviewed homes that are not samples/);
  assert.match(text, /Live public listings are empty until a real home is approved/);
  assert.match(text, /Review for display is not verification/);
  assert.match(text, /Payment does not buy a badge/);
  assert.match(text, /Viewing stays verified-only/);
  assert.match(nekedePage.example.label, /not a home/);
  assert.match(nekedePage.example.label, /not available/);
  assert.match(nekedePage.example.body, /not available/);
  assert.match(nekedePage.sourceRule, /must name its source/);
  assert.match(nekedePage.sourceRule, /will not publish scraped or invented data/);
  assert.match(nekedePage.adsRule, /Google ads are not running/);
  assert.match(nekedePage.adsRule, /later way to earn/);
  assert.equal(nekedePage.articleLink.length > 0, true);
  assert.doesNotMatch(text, /₦\s*\d/);
  assert.doesNotMatch(text, /080\d{6,}/);
  assert.doesNotMatch(text, /registered with/i);
  assert.doesNotMatch(text, /Google ads are running/);
});

test("the article explains authority and publish facts in English and Pidgin", () => {
  assert.equal(supplyArticle.publishesHome, false);
  assert.equal(supplyArticle.advertiseHref, "/advertise");
  assert.equal(ADVERTISE_HREF, "/advertise");
  assert.equal(ARTICLE_HREF, "/nekede/supply");
  assert.match(supplyArticle.standfirst, /not a form/);
  assert.match(supplyArticle.standfirst, /does not publish a home/);

  for (const section of supplyArticle.sections) {
    assert.ok(section.english.length > 40, section.id);
    assert.ok(section.pidgin.length > 40, section.id);
    assert.notEqual(section.english, section.pidgin);
  }

  const text = joined(supplyArticle);
  assert.match(text, /actually controls a house/);
  assert.match(text, /allowed to manage/);
  assert.match(text, /agent has that authority/i);
  assert.match(text, /CONTROLS or AUTHORIZED/);
  for (const label of [
    "Landlord name",
    "Email",
    "Phone",
    "Photo permission",
    "Availability",
    "Owerri, Imo, and the LGA",
    "Rent period",
    "Rent amount",
    "Move-in fees",
    "Title",
    "Description",
    "a person approves display",
  ]) {
    assert.match(text, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(text, /must name its source/);
  assert.match(text, /will not publish scraped or invented data/);
  assert.match(text, /Google ads are not running/);
  assert.match(text, /later way to earn/);
  assert.match(text, /Review for display is not verification/);
  assert.match(text, /Payment does not buy a badge/);
  assert.match(text, /Viewing stays verified-only/);
  assert.match(supplyArticle.factsIntro.pidgin, /CONTROLS or AUTHORIZED/);
  assert.match(supplyArticle.factsIntro.pidgin, /no be form/);
  assert.doesNotMatch(text, /₦\s*\d/);
  assert.doesNotMatch(text, /080\d{6,}/);
  assert.doesNotMatch(text, /Google ads are running/);
});

test("the pages render the copy and the article is not a publish form", () => {
  assert.match(pageSource, /nekedePage/);
  assert.match(pageSource, /nekedePage\.title/);
  assert.equal(nekedePage.title, "Nothing to rent here yet.");
  assert.match(pageSource, /ARTICLE_HREF/);
  assert.match(pageSource, /ADVERTISE_HREF/);
  assert.doesNotMatch(pageSource, /listingsApi/);
  assert.doesNotMatch(pageSource, /prisma/);

  assert.match(articleSource, /supplyArticle/);
  assert.match(articleSource, /<article/);
  assert.match(articleSource, /lang="pcm"/);
  assert.match(articleSource, /advertiseHref/);
  assert.doesNotMatch(articleSource, /<form[\s>]/i);
  assert.doesNotMatch(articleSource, /<input[\s>]/i);
  assert.doesNotMatch(articleSource, /<textarea[\s>]/i);
  assert.doesNotMatch(articleSource, /listingsApi/);
  assert.doesNotMatch(articleSource, /prisma/);
});

test("no public listing query from this content returns a home", () => {
  assert.deepEqual(publicListingRows(), []);
  assert.deepEqual(publicListings(publicListingRows()), []);

  const facts = loadFacts();
  assert.equal(facts.landlord.name, null);
  assert.equal(facts.priceNgn, null);
  assert.equal(facts.title, null);
  assert.deepEqual(facts.photos, []);
  const plan = planOwerriSeed(facts);
  assert.equal(plan.publicDiscoverable, false);
  assert.equal(plan.mode, "unpublished");
  assert.deepEqual(publicListings([plan.listing]), []);
});
