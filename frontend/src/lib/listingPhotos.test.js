const { test } = require("node:test");
const assert = require("node:assert/strict");
const { storedPhotos, photoAlt, MAX_LISTING_PHOTOS } = require("./listingPhotos");

test("stored photos prefer the primary image and keep a url", () => {
  const photos = storedPhotos([
    { id: 2, url: "https://cdn.example/b.jpg", isPrimary: false, order: 1 },
    { id: 1, url: "https://cdn.example/a.jpg", isPrimary: true, order: 0 },
    { id: 3, url: "", isPrimary: false },
  ]);
  assert.equal(photos.length, 2);
  assert.equal(photos[0].id, 1);
  assert.equal(photos[1].url, "https://cdn.example/b.jpg");
  assert.equal(storedPhotos(null).length, 0);
  assert.equal(MAX_LISTING_PHOTOS, 8);
});

test("photo alt uses stored text, then the listing title", () => {
  assert.equal(photoAlt({ altText: " Kitchen " }, "House"), "Kitchen");
  assert.equal(photoAlt({ caption: "Hall" }, "House"), "Hall");
  assert.equal(photoAlt({}, "House"), "House");
});
