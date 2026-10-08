/**
 * Listing photo bytes: one multipart file, checked before anything is stored.
 * stripImageMetadata rotates to the EXIF orientation, then re-encodes without
 * metadata so GPS and other EXIF never reach the bucket.
 */

const crypto = require("crypto");
const sharp = require("sharp");

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_LISTING_PHOTOS = 8;
const HEADER_BUDGET = 16 * 1024;

const TYPES = {
  "image/jpeg": { ext: "jpg", exts: new Set(["jpg", "jpeg"]) },
  "image/png": { ext: "png", exts: new Set(["png"]) },
  "image/webp": { ext: "webp", exts: new Set(["webp"]) },
};

function normalizeMime(mime) {
  const base = String(mime || "").toLowerCase().split(";")[0].trim();
  if (base === "image/jpg") return "image/jpeg";
  return base;
}

function sniffImage(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
    && buffer[4] === 0x0d
    && buffer[5] === 0x0a
    && buffer[6] === 0x1a
    && buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12
    && buffer.toString("ascii", 0, 4) === "RIFF"
    && buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function fileExtension(filename) {
  if (typeof filename !== "string" || !filename.trim()) return "";
  const base = filename.split(/[/\\]/).pop() || "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function validatePhoto({ buffer, mime, filename }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { ok: false, status: 400, error: "A photo file is required." };
  }
  if (buffer.length > MAX_PHOTO_BYTES) {
    return { ok: false, status: 413, error: "Photo is larger than 8 MB." };
  }
  const declared = normalizeMime(mime);
  const sniffed = sniffImage(buffer);
  if (!TYPES[declared]) {
    return { ok: false, status: 400, error: "Photo must be a JPEG, PNG, or WebP file." };
  }
  if (!sniffed || sniffed !== declared) {
    return { ok: false, status: 400, error: "Photo type does not match the file contents." };
  }
  const ext = fileExtension(filename);
  if (!ext || !TYPES[sniffed].exts.has(ext)) {
    return { ok: false, status: 400, error: "Photo extension does not match the file contents." };
  }
  return { ok: true, contentType: sniffed, extension: TYPES[sniffed].ext };
}

async function stripImageMetadata(buffer, contentType) {
  let pipeline = sharp(buffer, { failOn: "none" }).rotate();
  if (contentType === "image/jpeg") pipeline = pipeline.jpeg();
  else if (contentType === "image/png") pipeline = pipeline.png();
  else if (contentType === "image/webp") pipeline = pipeline.webp();
  else {
    const error = new Error("unsupported image type");
    error.status = 400;
    throw error;
  }
  return pipeline.toBuffer();
}

function newObjectKey(listingId, extension) {
  return `listings/${listingId}/${crypto.randomUUID()}.${extension}`;
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;
    function done(result) {
      if (settled) return;
      settled = true;
      resolve(result);
    }
    req.on("data", (chunk) => {
      if (settled) return;
      total += chunk.length;
      if (total > maxBytes) {
        req.destroy();
        done({ tooBig: true, buffer: Buffer.alloc(0) });
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => done({ tooBig: false, buffer: Buffer.concat(chunks) }));
    req.on("error", (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

function headerValue(part, pattern) {
  const match = pattern.exec(part);
  return match ? match[1] : "";
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(String(contentType || ""));
  if (!boundaryMatch) {
    return { error: { status: 400, error: "Send the photo as multipart form data." } };
  }
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  if (!boundary || boundary.length > 200) {
    return { error: { status: 400, error: "Send the photo as multipart form data." } };
  }
  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  let start = buffer.indexOf(delimiter);
  if (start === -1) {
    return { error: { status: 400, error: "Send the photo as multipart form data." } };
  }
  while (start !== -1) {
    let partStart = start + delimiter.length;
    if (buffer[partStart] === 45 && buffer[partStart + 1] === 45) break;
    if (buffer[partStart] === 13 && buffer[partStart + 1] === 10) partStart += 2;
    const next = buffer.indexOf(delimiter, partStart);
    if (next === -1) break;
    let partEnd = next;
    if (partEnd >= 2 && buffer[partEnd - 2] === 13 && buffer[partEnd - 1] === 10) partEnd -= 2;
    parts.push(buffer.subarray(partStart, partEnd));
    start = next;
  }

  let file = null;
  let extra = false;
  for (const part of parts) {
    const sep = part.indexOf(Buffer.from("\r\n\r\n"));
    if (sep === -1) continue;
    const head = part.subarray(0, sep).toString("latin1");
    const name = headerValue(head, /content-disposition:[^\r\n]*\bname="([^"]*)"/i)
      || headerValue(head, /content-disposition:[^\r\n]*\bname=([^;\r\n]+)/i);
    if (name !== "photo" && name !== "image") continue;
    if (file) {
      extra = true;
      continue;
    }
    const filename = headerValue(head, /filename="([^"]*)"/i)
      || headerValue(head, /filename=([^;\r\n]+)/i);
    const mime = headerValue(head, /content-type:\s*([^\r\n]+)/i).trim();
    file = { filename, mime, buffer: part.subarray(sep + 4) };
  }
  if (extra) return { error: { status: 400, error: "Send one photo at a time." } };
  if (!file) return { error: { status: 400, error: "A photo file is required." } };
  return { file };
}

async function readPhoto(req) {
  const contentType = req.headers["content-type"] || "";
  if (!String(contentType).toLowerCase().includes("multipart/form-data")) {
    if (typeof req.resume === "function") req.resume();
    return { error: { status: 400, error: "Send the photo as multipart form data." } };
  }
  const received = await readBody(req, MAX_PHOTO_BYTES + HEADER_BUDGET);
  if (received.tooBig) {
    return { error: { status: 413, error: "Photo is larger than 8 MB." } };
  }
  return parseMultipart(received.buffer, contentType);
}

module.exports = {
  MAX_PHOTO_BYTES,
  MAX_LISTING_PHOTOS,
  validatePhoto,
  stripImageMetadata,
  newObjectKey,
  readPhoto,
  parseMultipart,
};
