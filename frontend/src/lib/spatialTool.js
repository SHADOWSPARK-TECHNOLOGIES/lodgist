const { stripPrivateLocationKeys } = require("@lodgist/spatial-core");

function apiBase(env) {
  const source = env || process.env;
  const raw = source && typeof source.NEXT_PUBLIC_API_URL === "string" ? source.NEXT_PUBLIC_API_URL.trim() : "";
  return raw ? raw.replace(/\/$/, "") : "http://localhost:4000";
}

function amenitiesFromTool(payload) {
  if (!payload || payload.ok !== true || !payload.data || typeof payload.data !== "object") {
    const failed = payload && (payload.code === "provider_unavailable" || payload.code === "timeout");
    return { status: failed ? "failed" : "unconfigured", items: [], provenance: null };
  }
  const provenance = typeof payload.data.provenance === "string" ? payload.data.provenance : null;
  return stripPrivateLocationKeys({
    status: payload.data.status || "unconfigured",
    items: Array.isArray(payload.data.items) ? payload.data.items : [],
    provenance,
  });
}

function routeFromTool(payload, precision) {
  const origin = precision || undefined;
  if (!payload || payload.ok !== true || !payload.data || !payload.data.route) {
    const failed = payload && (payload.code === "provider_unavailable" || payload.code === "timeout");
    return { status: failed ? "failed" : "unconfigured", distanceM: null, durationS: null, origin };
  }
  const route = payload.data.route;
  return stripPrivateLocationKeys({
    status: route.status || "unconfigured",
    distanceM: typeof route.distanceM === "number" ? route.distanceM : null,
    durationS: typeof route.durationS === "number" ? route.durationS : null,
    origin,
  });
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function postTool(fetchImpl, base, name, input) {
  const response = await fetchImpl(`${base}/api/spatial/tool`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ name, input }),
    cache: "no-store",
  });
  return readJson(response);
}

async function loadListingSpatial(options) {
  const listingId = Number(options.listingId);
  const precision = options.precision;
  const fetchImpl = options.fetchImpl;
  const base = apiBase(options.env);
  let amenities = { status: "failed", items: [], provenance: null };
  try {
    amenities = amenitiesFromTool(await postTool(fetchImpl, base, "spatial.nearby", { listingId }));
  } catch {
    amenities = { status: "failed", items: [], provenance: null };
  }
  if (!options.campusId) {
    return {
      amenities,
      route: { status: "needs-campus", distanceM: null, durationS: null, origin: precision },
    };
  }
  let route = { status: "failed", distanceM: null, durationS: null, origin: precision };
  try {
    route = routeFromTool(
      await postTool(fetchImpl, base, "spatial.route", { listingId, campusId: options.campusId }),
      precision,
    );
  } catch {
    route = { status: "failed", distanceM: null, durationS: null, origin: precision };
  }
  return { amenities, route };
}

module.exports = {
  amenitiesFromTool,
  routeFromTool,
  loadListingSpatial,
};
