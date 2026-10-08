const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const listingPhotosRouter = require("../src/routes/listingPhotos");
const {
  loadConfig,
  objectKeyFromStoredUrl,
  createStorage,
  presentListingImages,
} = require("../src/services/objectStorage");
const { MAX_PHOTO_BYTES, validatePhoto } = require("../src/services/photoUpload");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const STORAGE_ENV = {
  AWS_S3_BUCKET_NAME: "lodgist-photos-test",
  AWS_ENDPOINT_URL: "https://t3.storageapi.dev",
  AWS_DEFAULT_REGION: "auto",
  AWS_ACCESS_KEY_ID: "tid_test",
  AWS_SECRET_ACCESS_KEY: "tsec_test",
  AWS_S3_URL_STYLE: "virtual",
};

function token(user) {
  return jwt.sign(user, process.env.JWT_SECRET);
}

function jpeg(bytes = 16) {
  const buffer = Buffer.alloc(3 + bytes, 0x11);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  return buffer;
}

function png() {
  const buffer = Buffer.alloc(12, 0x22);
  buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return buffer;
}

function webp() {
  const buffer = Buffer.alloc(16, 0);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(8, 4);
  buffer.write("WEBP", 8);
  return buffer;
}

function formBody({ filename, mime, buffer, field = "photo" }) {
  const boundary = "lodgistboundary";
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
      "utf8"
    ),
    buffer,
    Buffer.from(`\r\n--${boundary}--\r\n`, "utf8"),
  ]);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function photoStore(listing, { count = 0, images = [] } = {}) {
  const rows = images.map((image) => ({ ...image }));
  const created = [];
  const deleted = [];
  const prisma = {
    listing: {
      findUnique: async ({ where }) => (listing && where.id === listing.id ? listing : null),
    },
    listingImage: {
      count: async () => count + created.length,
      create: async ({ data }) => {
        const row = { id: 80 + created.length, altText: null, ...data };
        created.push(row);
        rows.push(row);
        return row;
      },
      findFirst: async ({ where }) => rows.find((row) => {
        if (where.id != null && row.id !== where.id) return false;
        if (where.listingId != null && row.listingId !== where.listingId) return false;
        return true;
      }) || null,
      delete: async ({ where }) => {
        const index = rows.findIndex((row) => row.id === where.id);
        if (index < 0) throw new Error("missing");
        const [row] = rows.splice(index, 1);
        deleted.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = rows.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      },
    },
  };
  return { prisma, created, deleted, rows };
}

function mockS3() {
  const sent = [];
  return {
    sent,
    client: {
      send: async (command) => {
        sent.push(command);
        return {};
      },
    },
  };
}

function configuredStorage(s3, extraEnv = {}) {
  return createStorage({
    env: { ...STORAGE_ENV, ...extraEnv },
    client: s3.client,
    signGetUrl: async ({ bucket, key }) => `https://signed.example/${bucket}/${key}?sig=1`,
  });
}

function buildApp(prisma, storage) {
  const app = express();
  app.use(express.json());
  app.use("/api/listings", listingPhotosRouter(prisma, { storage }));
  return app;
}

async function postPhoto(port, { auth, file, listingId = 4 }) {
  const payload = formBody(file);
  return fetch(`http://127.0.0.1:${port}/api/listings/${listingId}/photos`, {
    method: "POST",
    headers: {
      ...(auth ? { authorization: `Bearer ${auth}` } : {}),
      "content-type": payload.contentType,
    },
    body: payload.body,
  });
}

const owner = { id: 4, email: "ada@example.com", name: "Ada", role: "LANDLORD" };
const stranger = { id: 9, email: "gb@example.com", name: "Gbemi", role: "LANDLORD" };
const admin = { id: 1, email: "admin@example.com", name: "Admin", role: "STUDIO_ADMIN" };

test("storage config accepts Railway credential names and raw bucket references", () => {
  const fromPreset = loadConfig(STORAGE_ENV);
  assert.equal(fromPreset.configured, true);
  assert.equal(fromPreset.bucket, "lodgist-photos-test");
  assert.equal(fromPreset.endpoint, "https://t3.storageapi.dev");
  assert.equal(fromPreset.region, "auto");
  assert.equal(fromPreset.urlStyle, "virtual");

  const fromRefs = loadConfig({
    BUCKET: "lodgist-photos-ref",
    ENDPOINT: "https://t3.storageapi.dev",
    REGION: "auto",
    ACCESS_KEY_ID: "tid_ref",
    SECRET_ACCESS_KEY: "tsec_ref",
  });
  assert.equal(fromRefs.configured, true);
  assert.equal(fromRefs.bucket, "lodgist-photos-ref");
  assert.equal(loadConfig({}).configured, false);
  assert.equal(loadConfig({ ...STORAGE_ENV, AWS_ENDPOINT_URL: "http://169.254.169.254" }).configured, false);
});

test("validatePhoto accepts jpeg, png, and webp and rejects mismatches", () => {
  assert.equal(validatePhoto({ buffer: jpeg(), mime: "image/jpeg", filename: "room.jpg" }).ok, true);
  assert.equal(validatePhoto({ buffer: jpeg(), mime: "image/jpg", filename: "room.jpeg" }).extension, "jpg");
  assert.equal(validatePhoto({ buffer: png(), mime: "image/png", filename: "room.png" }).ok, true);
  assert.equal(validatePhoto({ buffer: webp(), mime: "image/webp", filename: "room.webp" }).ok, true);

  const text = validatePhoto({ buffer: Buffer.from("not-a-photo"), mime: "image/jpeg", filename: "room.jpg" });
  assert.equal(text.ok, false);
  assert.equal(text.status, 400);

  const mismatch = validatePhoto({ buffer: png(), mime: "image/jpeg", filename: "room.jpg" });
  assert.equal(mismatch.ok, false);

  const extension = validatePhoto({ buffer: jpeg(), mime: "image/jpeg", filename: "room.gif" });
  assert.equal(extension.ok, false);

  const named = validatePhoto({ buffer: jpeg(), mime: "image/jpeg", filename: "../secrets/house.jpg" });
  assert.equal(named.ok, true);
  assert.equal(named.extension, "jpg");

  const huge = Buffer.alloc(MAX_PHOTO_BYTES + 1);
  huge[0] = 0xff;
  huge[1] = 0xd8;
  huge[2] = 0xff;
  const tooBig = validatePhoto({ buffer: huge, mime: "image/jpeg", filename: "room.jpg" });
  assert.equal(tooBig.ok, false);
  assert.equal(tooBig.status, 413);
});

test("POST /api/listings/:id/photos requires auth", async () => {
  const { prisma } = photoStore({ id: 4, ownerId: 4 });
  const s3 = mockS3();
  const server = await listen(buildApp(prisma, configuredStorage(s3)));
  try {
    const { port } = server.address();
    const res = await postPhoto(port, {
      file: { filename: "room.jpg", mime: "image/jpeg", buffer: jpeg() },
    });
    assert.equal(res.status, 401);
    assert.equal(s3.sent.length, 0);
  } finally {
    server.close();
  }
});

test("POST /api/listings/:id/photos rejects a non-owner", async () => {
  const { prisma, created } = photoStore({ id: 4, ownerId: 4 });
  const s3 = mockS3();
  const server = await listen(buildApp(prisma, configuredStorage(s3)));
  try {
    const { port } = server.address();
    const res = await postPhoto(port, {
      auth: token(stranger),
      file: { filename: "room.jpg", mime: "image/jpeg", buffer: jpeg() },
    });
    const body = await res.json();
    assert.equal(res.status, 403);
    assert.equal(body.success, false);
    assert.equal(created.length, 0);
    assert.equal(s3.sent.length, 0);
  } finally {
    server.close();
  }
});

test("POST /api/listings/:id/photos stores a signed URL for the owner", async () => {
  const { prisma, created } = photoStore({ id: 4, ownerId: 4 });
  const s3 = mockS3();
  const server = await listen(buildApp(prisma, configuredStorage(s3)));
  try {
    const { port } = server.address();
    const res = await postPhoto(port, {
      auth: token(owner),
      file: { filename: "my house.jpg", mime: "image/jpeg", buffer: jpeg() },
    });
    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(s3.sent.length, 1);
    assert.ok(s3.sent[0] instanceof PutObjectCommand);
    const key = s3.sent[0].input.Key;
    assert.match(key, /^listings\/4\/[0-9a-f-]{36}\.jpg$/);
    assert.equal(key.includes("house"), false);
    assert.equal(key.includes("my"), false);
    assert.equal(s3.sent[0].input.Bucket, "lodgist-photos-test");
    assert.equal(s3.sent[0].input.ContentType, "image/jpeg");
    assert.equal(s3.sent[0].input.ACL, undefined);
    assert.equal(created.length, 1);
    assert.equal(created[0].url, `https://signed.example/lodgist-photos-test/${key}?sig=1`);
    assert.equal(created[0].isPrimary, true);
    assert.equal(created[0].listingId, 4);
    assert.equal(body.data.url, created[0].url);
    assert.equal(objectKeyFromStoredUrl(body.data.url), key);
  } finally {
    server.close();
  }
});

test("POST /api/listings/:id/photos allows STUDIO_ADMIN on another owner's listing", async () => {
  const { prisma, created } = photoStore({ id: 4, ownerId: 4 });
  const s3 = mockS3();
  const server = await listen(buildApp(prisma, configuredStorage(s3)));
  try {
    const { port } = server.address();
    const res = await postPhoto(port, {
      auth: token(admin),
      file: { filename: "room.png", mime: "image/png", buffer: png() },
    });
    assert.equal(res.status, 201);
    assert.equal(created.length, 1);
    assert.match(s3.sent[0].input.Key, /\.png$/);
  } finally {
    server.close();
  }
});

test("POST /api/listings/:id/photos rejects a file whose bytes are not an image", async () => {
  const { prisma, created } = photoStore({ id: 4, ownerId: 4 });
  const s3 = mockS3();
  const server = await listen(buildApp(prisma, configuredStorage(s3)));
  try {
    const { port } = server.address();
    const res = await postPhoto(port, {
      auth: token(owner),
      file: { filename: "room.jpg", mime: "image/jpeg", buffer: Buffer.from("hello") },
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.match(body.error, /does not match/);
    assert.equal(created.length, 0);
    assert.equal(s3.sent.length, 0);
  } finally {
    server.close();
  }
});

test("POST /api/listings/:id/photos rejects a mismatched extension", async () => {
  const { prisma, created } = photoStore({ id: 4, ownerId: 4 });
  const s3 = mockS3();
  const server = await listen(buildApp(prisma, configuredStorage(s3)));
  try {
    const { port } = server.address();
    const res = await postPhoto(port, {
      auth: token(owner),
      file: { filename: "room.gif", mime: "image/jpeg", buffer: jpeg() },
    });
    assert.equal(res.status, 400);
    assert.equal(created.length, 0);
    assert.equal(s3.sent.length, 0);
  } finally {
    server.close();
  }
});

test("POST /api/listings/:id/photos rejects the ninth photo", async () => {
  const { prisma, created } = photoStore({ id: 4, ownerId: 4 }, { count: 8 });
  const s3 = mockS3();
  const server = await listen(buildApp(prisma, configuredStorage(s3)));
  try {
    const { port } = server.address();
    const res = await postPhoto(port, {
      auth: token(owner),
      file: { filename: "room.jpg", mime: "image/jpeg", buffer: jpeg() },
    });
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.match(body.error, /8 photos/);
    assert.equal(created.length, 0);
    assert.equal(s3.sent.length, 0);
  } finally {
    server.close();
  }
});

test("POST /api/listings/:id/photos returns 503 when storage env is unset and stores nothing", async () => {
  const { prisma, created } = photoStore({ id: 4, ownerId: 4 });
  const s3 = mockS3();
  const storage = createStorage({
    env: {},
    client: s3.client,
    signGetUrl: async () => {
      throw new Error("should not sign");
    },
  });
  const server = await listen(buildApp(prisma, storage));
  try {
    const { port } = server.address();
    const res = await postPhoto(port, {
      auth: token(owner),
      file: { filename: "room.jpg", mime: "image/jpeg", buffer: jpeg() },
    });
    const body = await res.json();
    assert.equal(res.status, 503);
    assert.equal(body.error, "storage not configured");
    assert.equal(created.length, 0);
    assert.equal(s3.sent.length, 0);
  } finally {
    server.close();
  }
});

test("DELETE /api/listings/:id/photos/:imageId removes the object and the row", async () => {
  const key = "listings/4/11111111-1111-4111-8111-111111111111.jpg";
  const url = `https://signed.example/lodgist-photos-test/${key}?sig=1`;
  const { prisma, deleted, rows } = photoStore({ id: 4, ownerId: 4 }, {
    images: [{ id: 9, listingId: 4, url, isPrimary: true, order: 0 }],
  });
  const s3 = mockS3();
  const server = await listen(buildApp(prisma, configuredStorage(s3)));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings/4/photos/9`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token(owner)}` },
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(s3.sent.length, 1);
    assert.ok(s3.sent[0] instanceof DeleteObjectCommand);
    assert.equal(s3.sent[0].input.Key, key);
    assert.equal(deleted.length, 1);
    assert.equal(rows.length, 0);
  } finally {
    server.close();
  }
});

test("DELETE /api/listings/:id/photos/:imageId does not remove another owner's photo", async () => {
  const key = "listings/4/11111111-1111-4111-8111-111111111111.jpg";
  const { prisma, deleted } = photoStore({ id: 4, ownerId: 4 }, {
    images: [{ id: 9, listingId: 4, url: `https://signed.example/${key}`, isPrimary: false, order: 1 }],
  });
  const s3 = mockS3();
  const server = await listen(buildApp(prisma, configuredStorage(s3)));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings/4/photos/9`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token(stranger)}` },
    });
    assert.equal(res.status, 403);
    assert.equal(deleted.length, 0);
    assert.equal(s3.sent.length, 0);
  } finally {
    server.close();
  }
});

test("DELETE /api/listings/:id/photos/:imageId returns 503 when storage is unset", async () => {
  const key = "listings/4/11111111-1111-4111-8111-111111111111.jpg";
  const { prisma, deleted } = photoStore({ id: 4, ownerId: 4 }, {
    images: [{ id: 9, listingId: 4, url: `https://cdn.example/${key}`, isPrimary: false, order: 0 }],
  });
  const s3 = mockS3();
  const storage = createStorage({ env: {}, client: s3.client });
  const server = await listen(buildApp(prisma, storage));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings/4/photos/9`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token(owner)}` },
    });
    const body = await res.json();
    assert.equal(res.status, 503);
    assert.equal(body.error, "storage not configured");
    assert.equal(deleted.length, 0);
    assert.equal(s3.sent.length, 0);
  } finally {
    server.close();
  }
});

test("DELETE /api/listings/:id/photos/:imageId keeps the row when object storage rejects the delete", async () => {
  const key = "listings/4/11111111-1111-4111-8111-111111111111.jpg";
  const { prisma, deleted } = photoStore({ id: 4, ownerId: 4 }, {
    images: [{ id: 9, listingId: 4, url: `https://signed.example/${key}`, isPrimary: true, order: 0 }],
  });
  const s3 = {
    sent: [],
    client: {
      send: async (command) => {
        s3.sent.push(command);
        const error = new Error("bucket missing");
        error.code = "NoSuchBucket";
        throw error;
      },
    },
  };
  const server = await listen(buildApp(prisma, configuredStorage(s3)));
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}/api/listings/4/photos/9`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token(owner)}` },
    });
    const body = await res.json();
    assert.equal(res.status, 502);
    assert.match(body.error, /could not remove/i);
    assert.equal(deleted.length, 0);
    assert.equal(s3.sent.length, 1);
  } finally {
    server.close();
  }
});

test("presentListingImages refreshes managed URLs and leaves external photos alone", async () => {
  const s3 = mockS3();
  const storage = configuredStorage(s3);
  const key = "listings/7/22222222-2222-4222-8222-222222222222.webp";
  const images = [
    { id: 1, url: `https://bucket.t3.storageapi.dev/${key}?X-Amz-Signature=old`, isPrimary: true },
    { id: 2, url: "https://images.example/unsplash.jpg", isPrimary: false },
  ];
  const fresh = await presentListingImages(images, storage);
  assert.equal(fresh[0].url, `https://signed.example/lodgist-photos-test/${key}?sig=1`);
  assert.equal(fresh[1].url, images[1].url);
  const untouched = await presentListingImages(images, createStorage({ env: {} }));
  assert.equal(untouched[0].url, images[0].url);
});
