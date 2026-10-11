/**
 * Server-side provider fetch. Reimplemented from the God's Eye View proxy
 * rules in SECURITY.md (pinned hosts, no arbitrary URL, redirect checks,
 * private-network refusal, size caps, sanitized errors, timeouts).
 * The byte cap reader is the only copied GEV function.
 */
const { readCappedResponseText } = require("./readCappedResponseText.cjs");

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 8000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function fail(code) {
  return {
    ok: false,
    status: 0,
    code,
    json: async () => null,
  };
}

function ipv4ToInt(address) {
  const parts = String(address || "").split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const number = Number(part);
    if (number > 255) return null;
    value = ((value << 8) + number) >>> 0;
  }
  return value;
}

function inCidr(ip, base, bits) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ip & mask) === (base & mask);
}

function isPublicIpv4(address) {
  const ip = ipv4ToInt(address);
  if (ip == null) return false;
  const blocked = [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ];
  return !blocked.some(([base, bits]) => inCidr(ip, ipv4ToInt(base), bits));
}

function isPublicAddress(address) {
  const value = String(address || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!value) return false;
  if (value.includes(":")) {
    if (value === "::1" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return false;
    if (value.startsWith("::ffff:")) return isPublicIpv4(value.slice(7));
    return /^[0-9a-f:]+$/.test(value);
  }
  return isPublicIpv4(value);
}

function blockedHostname(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "metadata.google.internal" || host === "metadata.google.com") return true;
  return false;
}

function headerValue(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  const found = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  return found ? headers[found] : "";
}

async function defaultLookup(hostname) {
  const dns = require("node:dns").promises;
  return dns.lookup(hostname, { all: true, verbatim: true });
}

function addressesOf(resolved) {
  const rows = Array.isArray(resolved) ? resolved : [resolved];
  return rows
    .map((row) => (typeof row === "string" ? row : row && row.address))
    .filter(Boolean);
}

async function fetchAllowlisted(options) {
  let target;
  try {
    target = new URL(options.url);
  } catch {
    return fail("forbidden");
  }
  if (target.protocol !== "https:" || target.username || target.password || target.hash) return fail("forbidden");
  const host = target.hostname.toLowerCase();
  const allowed = (options.allowedHosts || []).map((item) => String(item || "").toLowerCase());
  if (!allowed.includes(host) || blockedHostname(host)) return fail("forbidden");
  if (ipv4ToInt(host) != null && !isPublicAddress(host)) return fail("forbidden");
  let resolved;
  try {
    resolved = await (options.lookup || defaultLookup)(host);
  } catch {
    return fail("forbidden");
  }
  const addresses = addressesOf(resolved);
  if (!addresses.length || addresses.some((address) => !isPublicAddress(address))) return fail("forbidden");

  const timeoutMs = typeof options.timeoutMs === "number" && options.timeoutMs > 0 ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const maxBytes = typeof options.maxBytes === "number" && options.maxBytes > 0 ? options.maxBytes : DEFAULT_MAX_BYTES;
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  let limitTimer;
  const limited = new Promise((_, reject) => {
    limitTimer = setTimeout(() => {
      if (controller) controller.abort();
      const error = new Error("timeout");
      error.code = "timeout";
      reject(error);
    }, timeoutMs);
  });
  try {
    const response = await Promise.race([
      options.fetchImpl(target.href, Object.assign({}, options.init, {
        redirect: "manual",
        signal: controller ? controller.signal : undefined,
      })),
      limited,
    ]);
    const status = response && typeof response.status === "number" ? response.status : 0;
    if (REDIRECT_STATUSES.has(status)) {
      const next = headerValue(response.headers, "location");
      const hops = options.redirectsLeft == null ? 1 : options.redirectsLeft;
      if (!next || hops <= 0) return fail("forbidden");
      let redirected;
      try {
        redirected = new URL(next, target);
      } catch {
        return fail("forbidden");
      }
      if (redirected.hostname.toLowerCase() !== host) return fail("forbidden");
      return fetchAllowlisted(Object.assign({}, options, {
        url: redirected.href,
        redirectsLeft: hops - 1,
      }));
    }
    const capped = await readCappedResponseText(response, maxBytes);
    if (!capped || capped.tooLarge) return fail("provider_failed");
    let payload = null;
    try {
      payload = JSON.parse(capped.text);
    } catch {
      payload = null;
    }
    return {
      ok: Boolean(response && response.ok),
      status,
      code: response && response.ok ? "ok" : "provider_failed",
      // Set by a host fetch wrapper that served this call from a fallback provider.
      servedBy: headerValue(response && response.headers, "x-spatial-provider") || null,
      json: async () => payload,
    };
  } catch (error) {
    if (error && (error.code === "timeout" || error.name === "AbortError")) return fail("timeout");
    return fail("provider_unavailable");
  } finally {
    clearTimeout(limitTimer);
  }
}

module.exports = {
  DEFAULT_MAX_BYTES,
  DEFAULT_TIMEOUT_MS,
  isPublicAddress,
  fetchAllowlisted,
};
