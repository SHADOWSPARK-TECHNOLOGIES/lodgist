/**
 * Schema-driven spatial tools. Reimplemented from the God's Eye View tool
 * pattern (define a schema, validate, then run). No GEV catalog, auth, or
 * browser globals. shadow-engine.spy should call `callTool` and not copy it.
 */
const {
  campusById,
  focusFromPublicListing,
  loadAmenities,
  loadRoute,
  mapGeometry,
  straightLineLabel,
} = require("./core.cjs");
const { BANNED_LAYERS } = require("./catalog.cjs");
const { assertNoPrivateLocationKeys, stripPrivateLocationKeys } = require("./privacy.cjs");
const {
  buildSpatialContext,
  compareListings,
  crossReference,
  relateListingToCampus,
} = require("./crossReference.cjs");
const { evidenceEnvelope } = require("./evidence.cjs");

const DEFAULT_TIMEOUT_MS = 8000;

function validate(schema, value, path) {
  const here = path || "input";
  if (!schema || typeof schema !== "object") return [];
  if (schema.type === "object") {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [`${here} must be an object`];
    const errors = [];
    (schema.required || []).forEach((key) => {
      if (value[key] == null || value[key] === "") errors.push(`missing ${key}`);
    });
    if (schema.additionalProperties === false) {
      Object.keys(value).forEach((key) => {
        if (!schema.properties || !Object.prototype.hasOwnProperty.call(schema.properties, key)) {
          errors.push(`unexpected ${key}`);
        }
      });
    }
    Object.entries(schema.properties || {}).forEach(([key, prop]) => {
      if (value[key] != null) errors.push(...validate(prop, value[key], key));
    });
    return errors;
  }
  if (schema.type === "string") {
    if (typeof value !== "string") return [`${here} must be a string`];
    if (schema.minLength != null && value.length < schema.minLength) return [`${here} is too short`];
    if (schema.maxLength != null && value.length > schema.maxLength) return [`${here} is too long`];
    if (schema.enum && !schema.enum.includes(value)) return [`${here} is not allowed`];
    return [];
  }
  if (schema.type === "integer") {
    if (!Number.isInteger(value)) return [`${here} must be an integer`];
    return [];
  }
  if (schema.type === "array") {
    if (!Array.isArray(value)) return [`${here} must be an array`];
    if (schema.minItems != null && value.length < schema.minItems) return [`${here} is too short`];
    if (schema.maxItems != null && value.length > schema.maxItems) return [`${here} is too long`];
    const errors = [];
    if (schema.items) {
      value.forEach((item, index) => errors.push(...validate(schema.items, item, `${here}[${index}]`)));
    }
    return errors;
  }
  return [];
}

function providerConfig(env) {
  if (!env || typeof env !== "object") return undefined;
  const read = (name) => (typeof env[name] === "string" ? env[name].trim() : "");
  return {
    osrmBaseUrl: read("OSRM_BASE_URL").replace(/\/$/, "") || null,
    overpassUrl: read("OVERPASS_INTERPRETER_URL") || null,
    tileUrl: read("NEXT_PUBLIC_MAP_TILE_URL") || null,
    attribution: read("NEXT_PUBLIC_MAP_ATTRIBUTION") || null,
  };
}

function listingById(ctx, id) {
  const rows = ctx && Array.isArray(ctx.listings) ? ctx.listings : [];
  return rows.find((item) => item && String(item.id) === String(id)) || null;
}

function requirePublic(input, ctx) {
  const listing = listingById(ctx, input.listingId);
  const predicate = ctx && ctx.isPublicListing;
  if (!listing || typeof predicate !== "function" || predicate(listing) !== true) {
    return { ok: false, code: "forbidden" };
  }
  return { ok: true, listing };
}

function idSchema(extra) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["listingId"],
    properties: Object.assign({
      listingId: { type: "integer" },
    }, extra || {}),
  };
}

const SEARCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: { query: { type: "string", minLength: 1, maxLength: 80 } },
};

const PAIR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["listingId", "campusId"],
  properties: {
    listingId: { type: "integer" },
    campusId: { type: "string", minLength: 1, maxLength: 32 },
  },
};

const COMPARE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["listingIds"],
  properties: {
    listingIds: { type: "array", minItems: 2, maxItems: 2, items: { type: "integer" } },
  },
};

const NEARBY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["listingId"],
  properties: {
    listingId: { type: "integer" },
    category: { type: "string", enum: ["shop", "pharmacy", "clinic", "transport", "all"] },
  },
};

const OBJECT_OUTPUT = { type: "object" };

function searchHandler(input, ctx) {
  const query = input.query.trim().toLowerCase();
  const rows = (ctx.listings || []).filter((listing) => {
    if (!ctx.isPublicListing || ctx.isPublicListing(listing) !== true) return false;
    const focus = focusFromPublicListing(listing);
    const haystack = `${listing.title || ""} ${focus.label || ""}`.toLowerCase();
    return haystack.includes(query);
  });
  return {
    matches: rows.map((listing) => ({
      listingId: listing.id,
      title: typeof listing.title === "string" ? listing.title : "Home",
    })),
  };
}

function navigateHandler(input, ctx) {
  return relateListingToCampus({
    listingId: input.listingId,
    campusId: input.campusId,
    listings: ctx.listings,
    isPublicListing: ctx.isPublicListing,
  });
}

function inspectHandler(input, ctx) {
  const listing = listingById(ctx, input.listingId);
  const focus = focusFromPublicListing(listing);
  return {
    listingId: listing.id,
    title: typeof listing.title === "string" ? listing.title : "Home",
    category: typeof listing.category === "string" ? listing.category : null,
    locationState: focus.precision,
    areaLabel: focus.label,
    approxLocation: focus.precision === "approximate"
      ? { lat: focus.lat, lng: focus.lng, radiusM: focus.radiusM }
      : null,
  };
}

async function nearbyHandler(input, ctx) {
  const listing = listingById(ctx, input.listingId);
  const focus = focusFromPublicListing(listing);
  if (!ctx.fetchImpl) {
    return { status: "unconfigured", items: [], provenance: null };
  }
  const payload = await loadAmenities({
    focus,
    env: ctx.env,
    config: providerConfig(ctx.env),
    registry: ctx.registry,
    fetchImpl: ctx.fetchImpl,
    safeguardState: ctx.safeguardState,
    now: ctx.now,
    lookup: ctx.lookup,
    timeoutMs: ctx.timeoutMs,
    allowFixtures: false,
  });
  const items = input.category && input.category !== "all"
    ? payload.items.filter((item) => item.category === input.category)
    : payload.items;
  return {
    status: payload.status,
    items,
    provenance: payload.provenance,
    source: "OpenStreetMap",
    license: "ODbL-1.0",
  };
}

async function routeHandler(input, ctx) {
  const listing = listingById(ctx, input.listingId);
  const focus = focusFromPublicListing(listing);
  const campus = campusById(input.campusId);
  const straight = relateListingToCampus({
    listingId: input.listingId,
    campusId: input.campusId,
    listings: ctx.listings,
    isPublicListing: ctx.isPublicListing,
  });
  if (!ctx.fetchImpl) {
    return {
      straightLineLabel: straight.straightLineLabel,
      travelTime: null,
      route: { status: "unconfigured", distanceM: null, durationS: null },
    };
  }
  const route = await loadRoute({
    focus,
    campus,
    env: ctx.env,
    config: providerConfig(ctx.env),
    registry: ctx.registry,
    fetchImpl: ctx.fetchImpl,
    safeguardState: ctx.safeguardState,
    now: ctx.now,
    lookup: ctx.lookup,
    timeoutMs: ctx.timeoutMs,
  });
  return {
    straightLineLabel: straight.straightLineLabel,
    travelTime: null,
    route: {
      status: route.status,
      distanceM: route.distanceM,
      durationS: route.durationS,
    },
  };
}

function measureHandler(input, ctx) {
  const related = relateListingToCampus({
    listingId: input.listingId,
    campusId: input.campusId,
    listings: ctx.listings,
    isPublicListing: ctx.isPublicListing,
  });
  return {
    listingId: input.listingId,
    campusId: input.campusId,
    straightLineLabel: related.straightLineLabel,
    travelTime: null,
    method: "straight-line",
  };
}

function compareHandler(input, ctx) {
  return compareListings({
    listingIds: input.listingIds,
    listings: ctx.listings,
    isPublicListing: ctx.isPublicListing,
  });
}

function crossHandler(input, ctx) {
  return crossReference({
    location: { listingId: input.listingId, campusId: input.campusId || null },
    subjects: [`listing:${input.listingId}`],
    providers: ctx.providers || [],
    constraints: ctx.constraints,
    now: typeof ctx.now === "function" ? ctx.now() : ctx.now,
  });
}

function visualizeHandler(input, ctx) {
  const listing = listingById(ctx, input.listingId);
  const focus = focusFromPublicListing(listing);
  const geometry = mapGeometry(focus);
  return {
    listingId: listing.id,
    geometry,
    label: straightLineLabel(0) ? focus.label : focus.label,
  };
}

function contextHandler(input, ctx) {
  const listing = listingById(ctx, input.listingId);
  return buildSpatialContext({
    listing,
    campusId: input.campusId || null,
    providers: ctx.providers || [],
    now: typeof ctx.now === "function" ? ctx.now() : ctx.now,
    isPublicListing: ctx.isPublicListing,
  });
}

function tool(name, inputSchema, authorize, handler) {
  return {
    name,
    inputSchema,
    outputSchema: OBJECT_OUTPUT,
    authorize,
    handler,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    permission: "read",
  };
}

const publicOne = (input, ctx) => requirePublic(input, ctx);
const publicPair = (input, ctx) => requirePublic(input, ctx);
const publicCompare = (input, ctx) => {
  const first = requirePublic({ listingId: input.listingIds[0] }, ctx);
  if (!first.ok) return first;
  return requirePublic({ listingId: input.listingIds[1] }, ctx);
};

const SPATIAL_TOOLS = [
  tool("spatial.search", SEARCH_SCHEMA, () => ({ ok: true }), searchHandler),
  tool("spatial.navigate", PAIR_SCHEMA, publicPair, navigateHandler),
  tool("spatial.inspect", idSchema(), publicOne, inspectHandler),
  tool("spatial.nearby", NEARBY_SCHEMA, publicOne, nearbyHandler),
  tool("spatial.route", PAIR_SCHEMA, publicPair, routeHandler),
  tool("spatial.measure", PAIR_SCHEMA, publicPair, measureHandler),
  tool("spatial.compare", COMPARE_SCHEMA, publicCompare, compareHandler),
  tool("spatial.cross_reference", idSchema({ campusId: { type: "string", minLength: 1, maxLength: 32 } }), publicOne, crossHandler),
  tool("spatial.visualize", idSchema(), publicOne, visualizeHandler),
  tool("spatial.context", idSchema({ campusId: { type: "string", minLength: 1, maxLength: 32 } }), publicOne, contextHandler),
];

const LODGIST_WRAPPERS = [
  ["lodgist.search_properties", "spatial.search"],
  ["lodgist.inspect_property", "spatial.inspect"],
  ["lodgist.property_context", "spatial.context"],
  ["lodgist.nearby_amenities", "spatial.nearby"],
  ["lodgist.calculate_commute", "spatial.route"],
  ["lodgist.compare_properties", "spatial.compare"],
  ["lodgist.spatial_report", "spatial.cross_reference"],
];

const TOOLS = SPATIAL_TOOLS.concat(LODGIST_WRAPPERS.map(([name, target]) => {
  const source = SPATIAL_TOOLS.find((item) => item.name === target);
  return tool(name, source.inputSchema, source.authorize, source.handler);
}));

function listTools() {
  return TOOLS.map((item) => ({
    name: item.name,
    permission: item.permission,
    inputSchema: item.inputSchema,
    outputSchema: item.outputSchema,
  }));
}

function withTimeout(work, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error("timed out");
      error.code = "timeout";
      reject(error);
    }, ms);
    Promise.resolve(work).then((value) => {
      clearTimeout(timer);
      resolve(value);
    }, (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function logCall(ctx, event) {
  if (!ctx || typeof ctx.log !== "function") return;
  ctx.log({
    tool: event.tool,
    ok: event.ok,
    code: event.code,
    ms: event.ms,
  });
}

function finish(ctx, started, name, result) {
  logCall(ctx, {
    tool: name,
    ok: result.ok,
    code: result.ok ? "ok" : result.code,
    ms: Date.now() - started,
  });
  return result;
}

async function callTool(name, input, ctx = {}) {
  const started = Date.now();
  const toolDef = TOOLS.find((item) => item.name === name);
  if (!toolDef) {
    return finish(ctx, started, name, { ok: false, code: "forbidden", message: "unknown tool" });
  }
  const body = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  if (Object.prototype.hasOwnProperty.call(body, "action") && body.action !== "read") {
    return finish(ctx, started, name, { ok: false, code: "forbidden", message: "read only" });
  }
  if (typeof body.layer === "string" && BANNED_LAYERS.includes(body.layer)) {
    return finish(ctx, started, name, { ok: false, code: "forbidden", message: "layer refused" });
  }
  const errors = validate(toolDef.inputSchema, body);
  if (errors.length) {
    return finish(ctx, started, name, { ok: false, code: "malformed", message: "invalid input" });
  }
  const auth = toolDef.authorize(body, ctx);
  if (!auth.ok) {
    return finish(ctx, started, name, { ok: false, code: auth.code || "forbidden", message: "not allowed" });
  }
  try {
    const data = await withTimeout(Promise.resolve(toolDef.handler(body, ctx)), ctx.timeoutMs || toolDef.timeoutMs);
    const safe = assertNoPrivateLocationKeys(stripPrivateLocationKeys(data));
    const outputErrors = validate(toolDef.outputSchema, safe);
    if (outputErrors.length) {
      return finish(ctx, started, name, { ok: false, code: "provider_error", message: "invalid provider result" });
    }
    if (safe && (safe.status === "failed" || (safe.route && safe.route.status === "failed"))) {
      return finish(ctx, started, name, {
        ok: false,
        code: "provider_unavailable",
        message: "provider unavailable",
        provenance: provenanceFor(safe, ctx),
      });
    }
    return finish(ctx, started, name, {
      ok: true,
      data: safe,
      provenance: provenanceFor(safe, ctx),
    });
  } catch (error) {
    const code = error && error.code === "timeout" ? "timeout" : "provider_unavailable";
    return finish(ctx, started, name, {
      ok: false,
      code,
      message: code === "timeout" ? "timed out" : "provider unavailable",
    });
  }
}

function provenanceFor(data, ctx) {
  const now = typeof ctx.now === "function" ? ctx.now() : (typeof ctx.now === "number" ? ctx.now : null);
  const prior = data && data.provenance && typeof data.provenance === "object" ? data.provenance : null;
  const provider = prior && typeof prior.provider === "string"
    ? prior.provider
    : (data && typeof data.provenance === "string" ? data.provenance : null);
  return evidenceEnvelope({
    value: data && Object.prototype.hasOwnProperty.call(data, "value") ? data.value : null,
    source: data && typeof data.source === "string" ? data.source : "lodgist",
    provider,
    observedAt: prior ? prior.observedAt : null,
    retrievedAt: now,
    confidence: prior ? prior.confidence : null,
    classification: prior && prior.classification ? prior.classification : "DERIVED",
    attribution: prior ? prior.attribution : null,
    license: data && typeof data.license === "string" ? data.license : null,
    coverage: prior ? prior.coverage : null,
  }, { now });
}

module.exports = {
  DEFAULT_TIMEOUT_MS,
  validate,
  listTools,
  callTool,
};
