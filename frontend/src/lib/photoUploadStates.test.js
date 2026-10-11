const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { validatePhotoFile, photoErrorMessage, PHOTO_MESSAGES, MAX_PHOTO_BYTES, MAX_LISTING_PHOTOS } = require("./listingPhotos");

const file = (type, size, name = "x") => ({ type, size, name });

test("accepts JPEG, PNG and WebP up to 8 MB", () => {
  for (const t of ["image/jpeg", "image/png", "image/webp"]) assert.equal(validatePhotoFile(file(t, 1000), 0), null);
  assert.equal(validatePhotoFile(file("image/jpeg", MAX_PHOTO_BYTES), 0), null);
});

test("an empty MIME type falls back to the file extension", () => {
  assert.equal(validatePhotoFile(file("", 10, "room.JPG"), 0), null);
  assert.equal(validatePhotoFile(file("", 10, "room.heic"), 0), PHOTO_MESSAGES.wrongType);
});

test("rejects other types, oversize files, empty files and a full gallery before upload", () => {
  assert.equal(validatePhotoFile(file("image/gif", 10), 0), PHOTO_MESSAGES.wrongType);
  assert.equal(validatePhotoFile(file("application/pdf", 10, "a.pdf"), 0), PHOTO_MESSAGES.wrongType);
  assert.equal(validatePhotoFile(file("image/jpeg", MAX_PHOTO_BYTES + 1), 0), PHOTO_MESSAGES.tooLarge);
  assert.equal(validatePhotoFile(file("image/jpeg", 0), 0), PHOTO_MESSAGES.empty);
  assert.equal(validatePhotoFile(file("image/jpeg", 10), MAX_LISTING_PHOTOS), PHOTO_MESSAGES.full);
  assert.equal(validatePhotoFile(null, 0), PHOTO_MESSAGES.empty);
});

test("server errors map to plain messages; raw storage text is never shown", () => {
  const err = (status, message) => Object.assign(new Error(message), { status });
  assert.equal(photoErrorMessage(err(503, "storage not configured")), PHOTO_MESSAGES.storageOff);
  assert.doesNotMatch(PHOTO_MESSAGES.storageOff, /storage not configured/);
  assert.equal(photoErrorMessage(err(413, "too big")), PHOTO_MESSAGES.tooLarge);
  assert.equal(photoErrorMessage(err(415, "bad type")), PHOTO_MESSAGES.wrongType);
  assert.equal(photoErrorMessage(err(408, "The request took too long. Check your connection and try again.")), "The request took too long. Check your connection and try again.");
  assert.equal(photoErrorMessage(new TypeError("Failed to fetch")), PHOTO_MESSAGES.network);
  assert.equal(photoErrorMessage(err(500, "Prisma blew up")), PHOTO_MESSAGES.failed);
  assert.equal(photoErrorMessage(undefined), PHOTO_MESSAGES.failed);
});

test("ListingPhotos wires the helper, links the hint, and announces status", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "components", "ListingPhotos.tsx"), "utf8");
  assert.match(src, /validatePhotoFile\(/);
  assert.match(src, /photoErrorMessage\(/);
  assert.doesNotMatch(src, /storage not configured/);
  const input = src.match(/<input[\s\S]*?\/>/)[0];
  assert.match(input, /aria-describedby=\{describedBy\}/);
  assert.match(src, /id="listing-photo-hint"/);
  assert.match(src, /id="listing-photo-error"[^>]*role="alert"|role="alert"[^>]*id="listing-photo-error"/);
  assert.match(src, /role="status" aria-live="polite"/);
  assert.match(src, /PHOTO_MESSAGES\.(added|removed)/);
});
