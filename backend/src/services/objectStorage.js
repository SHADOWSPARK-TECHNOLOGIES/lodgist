/**
 * S3-compatible listing photo storage.
 *
 * Railway bucket credentials (CLI `railway bucket credentials`, and the AWS SDK
 * preset in the service Variables tab) use:
 *   AWS_ENDPOINT_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
 *   AWS_S3_BUCKET_NAME, AWS_DEFAULT_REGION, AWS_S3_URL_STYLE
 * Raw bucket variable references are also accepted:
 *   ENDPOINT, ACCESS_KEY_ID, SECRET_ACCESS_KEY, BUCKET, REGION
 *
 * Railway buckets are private. Unless S3_PUBLIC_BASE_URL is an https CDN/base,
 * stored values are presigned GET URLs and listing reads mint a fresh one.
 * Cloudflare R2 and AWS S3 use the same client; set AWS_S3_URL_STYLE=path when
 * the provider expects path-style URLs.
 *
 * Uploads are re-encoded without EXIF before PutObject. See photoUpload.stripImageMetadata.
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const KEY_IN_URL = /(?:^|\/)(listings\/[1-9]\d*\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|webp))$/i;

function firstValue(env, names) {
  for (const name of names) {
    const value = env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function httpsOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

function httpsBase(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function loadConfig(env = process.env) {
  const bucket = firstValue(env, ["AWS_S3_BUCKET_NAME", "BUCKET"]);
  const endpoint = httpsOrigin(firstValue(env, ["AWS_ENDPOINT_URL", "ENDPOINT"]));
  const region = firstValue(env, ["AWS_DEFAULT_REGION", "AWS_REGION", "REGION"]);
  const accessKeyId = firstValue(env, ["AWS_ACCESS_KEY_ID", "ACCESS_KEY_ID"]);
  const secretAccessKey = firstValue(env, ["AWS_SECRET_ACCESS_KEY", "SECRET_ACCESS_KEY"]);
  const urlStyle = (firstValue(env, ["AWS_S3_URL_STYLE"]) || "virtual").toLowerCase();
  const rawPublic = firstValue(env, ["S3_PUBLIC_BASE_URL"]);
  const publicBaseUrl = rawPublic ? httpsBase(rawPublic) : "";
  const publicBaseInvalid = Boolean(rawPublic) && !publicBaseUrl;
  const configured = Boolean(
    bucket && endpoint && region && accessKeyId && secretAccessKey && !publicBaseInvalid
  );
  return {
    bucket,
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    urlStyle: urlStyle === "path" ? "path" : "virtual",
    publicBaseUrl,
    configured,
  };
}

function buildS3Client(cfg) {
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: cfg.urlStyle === "path",
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    // Checksums are optional. R2 and other S3-compatible stores reject the
    // default flexible checksum headers from recent AWS SDK releases.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumCalculation: "WHEN_REQUIRED",
  });
}

function objectKeyFromStoredUrl(url) {
  if (typeof url !== "string" || !url) return null;
  let pathname = url;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const match = pathname.match(KEY_IN_URL);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function createStorage(options = {}) {
  const env = options.env || process.env;
  let client = options.client || null;

  function config() {
    return loadConfig(env);
  }

  function isConfigured() {
    return config().configured;
  }

  function usesPublicUrls() {
    return Boolean(config().publicBaseUrl);
  }

  function s3() {
    const cfg = config();
    if (!cfg.configured) {
      const error = new Error("storage not configured");
      error.status = 503;
      throw error;
    }
    if (!client) client = buildS3Client(cfg);
    return client;
  }

  async function urlForKey(key) {
    const cfg = config();
    if (!cfg.configured) {
      const error = new Error("storage not configured");
      error.status = 503;
      throw error;
    }
    if (cfg.publicBaseUrl) return `${cfg.publicBaseUrl}/${key}`;
    if (typeof options.signGetUrl === "function") {
      return options.signGetUrl({ bucket: cfg.bucket, key });
    }
    return getSignedUrl(
      s3(),
      new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
      { expiresIn: SIGNED_URL_TTL_SECONDS }
    );
  }

  async function putAndUrl({ key, body, contentType }) {
    const cfg = config();
    await s3().send(new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=86400",
    }));
    try {
      return await urlForKey(key);
    } catch (error) {
      try {
        await s3().send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
      } catch {
        // The row was not written. The orphaned object is logged by the route.
      }
      throw error;
    }
  }

  async function deleteObject(key) {
    const cfg = config();
    await s3().send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
  }

  return {
    isConfigured,
    usesPublicUrls,
    urlForKey,
    putAndUrl,
    deleteObject,
    config,
  };
}

const defaultStorage = createStorage();

async function presentListingImages(images, storage = defaultStorage) {
  const list = Array.isArray(images) ? images : [];
  if (!storage.isConfigured() || storage.usesPublicUrls()) return list;
  const next = [];
  for (const image of list) {
    if (!image || typeof image !== "object") {
      next.push(image);
      continue;
    }
    const key = objectKeyFromStoredUrl(image.url);
    if (!key) {
      next.push(image);
      continue;
    }
    try {
      next.push({ ...image, url: await storage.urlForKey(key) });
    } catch {
      next.push(image);
    }
  }
  return next;
}

module.exports = {
  SIGNED_URL_TTL_SECONDS,
  loadConfig,
  objectKeyFromStoredUrl,
  createStorage,
  defaultStorage,
  presentListingImages,
};
