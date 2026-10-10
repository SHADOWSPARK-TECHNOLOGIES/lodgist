/**
 * Phase 12F-H scene director (GEV src/director/document pattern,
 * reimplemented; spatial-lab catalog ALLOWED_LAYERS). Scenes are
 * declarative data only: no executable JS, no URLs, no raw coordinates.
 * Focus targets are public listings (approximate area), campuses or area
 * labels. Every factual caption cites evidence (DATABASE_EVIDENCE,
 * PROVIDER_EVIDENCE, TOOL_RESULT, APPROVED_STATIC_DATA) or states
 * UNKNOWN / DATA_UNAVAILABLE / COVERAGE_INCOMPLETE. Tools decide facts;
 * the director only arranges them. 2D fallback is always allowed.
 */
const { ALLOWED_LAYERS } = require("./catalog.cjs");
const { campusById } = require("./campuses.cjs");
const { CLAIM_EVIDENCE_KINDS, CLAIM_FALLBACKS, spatialDataQuality } = require("./evidence.cjs");

const SCENE_VERSION = 1;
const SCENE_TYPES = Object.freeze([
  "PROPERTY_OVERVIEW",
  "NEIGHBORHOOD_OVERVIEW",
  "COMMUTE_TOUR",
  "AMENITY_TOUR",
  "PROPERTY_COMPARISON",
  "ENVIRONMENT_CONTEXT",
  "AREA_EVENT_REPLAY",
]);
const STEP_KINDS = Object.freeze(["camera", "focus", "orbit", "route", "annotation", "layer", "caption", "hold", "transition"]);
const MAX_STEPS = 40;
const EXECUTABLE = /(<\s*script|javascript:|=>|\bfunction\s*\(|\beval\s*\(|new\s+Function|on[a-z]+\s*=|https?:\/\/)/i;
const COORD_TEXT = /-?\d{1,3}\.\d{4,}/;
const STEP_FIELDS = {
  camera: ["kind", "zoom", "pitch", "bearing", "durationMs"],
  focus: ["kind", "target"],
  orbit: ["kind", "degrees", "durationMs"],
  route: ["kind", "listingId", "campusId", "status"],
  annotation: ["kind", "text", "target", "evidence"],
  layer: ["kind", "layerId", "visible", "quality"],
  caption: ["kind", "text", "factual", "evidence"],
  hold: ["kind", "durationMs"],
  transition: ["kind", "style", "durationMs"],
};

function num(v, min, max) {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
}

function checkText(text, errors, where) {
  if (typeof text !== "string" || !text.trim() || text.length > 280) errors.push(`${where}: text required (<=280)`);
  else {
    if (EXECUTABLE.test(text)) errors.push(`${where}: executable or URL content refused`);
    if (COORD_TEXT.test(text)) errors.push(`${where}: coordinates refused in text`);
  }
}

function checkEvidence(evidence, errors, where) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    errors.push(`${where}: evidence required`);
    return;
  }
  const ok = CLAIM_EVIDENCE_KINDS.includes(evidence.kind) || CLAIM_FALLBACKS.includes(evidence.kind);
  if (!ok) errors.push(`${where}: unknown evidence kind`);
  if (CLAIM_EVIDENCE_KINDS.includes(evidence.kind) && (typeof evidence.ref !== "string" || !evidence.ref)) {
    errors.push(`${where}: evidence ref required`);
  }
}

function checkTarget(target, ctx, errors, where) {
  if (!target || typeof target !== "object") {
    errors.push(`${where}: target required`);
    return;
  }
  const keys = Object.keys(target);
  if (keys.some((k) => !["type", "id", "label"].includes(k))) errors.push(`${where}: target has extra keys`);
  if (target.type === "listing") {
    const rows = ctx && Array.isArray(ctx.listings) ? ctx.listings : [];
    const listing = rows.find((l) => l && String(l.id) === String(target.id));
    if (!listing || typeof ctx.isPublicListing !== "function" || ctx.isPublicListing(listing) !== true) {
      errors.push(`${where}: protected or unknown listing focus refused`);
    }
  } else if (target.type === "campus") {
    if (!campusById(String(target.id || ""))) errors.push(`${where}: unknown campus`);
  } else if (target.type === "area") {
    checkText(target.label, errors, `${where}.label`);
  } else errors.push(`${where}: unsupported target type`);
}

function validateScene(doc, ctx = {}) {
  const errors = [];
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return { ok: false, errors: ["scene must be an object"] };
  Object.keys(doc).forEach((k) => { if (!["version", "type", "title", "steps", "fallback2d", "dataQuality"].includes(k)) errors.push(`unexpected ${k}`); });
  if (doc.version !== SCENE_VERSION) errors.push("unsupported version");
  if (!SCENE_TYPES.includes(doc.type)) errors.push("unsupported scene type");
  checkText(doc.title, errors, "title");
  if (!Array.isArray(doc.steps) || !doc.steps.length || doc.steps.length > MAX_STEPS) {
    errors.push(`steps must be 1..${MAX_STEPS}`);
    return { ok: false, errors };
  }
  doc.steps.forEach((step, i) => {
    const where = `steps[${i}]`;
    if (!step || typeof step !== "object" || !STEP_KINDS.includes(step.kind)) {
      errors.push(`${where}: unknown step kind`);
      return;
    }
    Object.keys(step).forEach((k) => { if (!STEP_FIELDS[step.kind].includes(k)) errors.push(`${where}: unexpected ${k}`); });
    Object.values(step).forEach((v) => { if (typeof v === "function") errors.push(`${where}: functions refused`); });
    switch (step.kind) {
      case "camera":
        if (!num(step.zoom, 1, 17) || !num(step.pitch ?? 0, 0, 60) || !num(step.bearing ?? 0, -180, 180)) errors.push(`${where}: camera out of bounds`);
        break;
      case "focus":
        checkTarget(step.target, ctx, errors, where);
        break;
      case "orbit":
        if (!num(step.degrees, -360, 360) || !num(step.durationMs, 0, 60000)) errors.push(`${where}: orbit out of bounds`);
        break;
      case "route": {
        const rows = Array.isArray(ctx.listings) ? ctx.listings : [];
        const listing = rows.find((l) => l && String(l.id) === String(step.listingId));
        if (!listing || typeof ctx.isPublicListing !== "function" || ctx.isPublicListing(listing) !== true || !campusById(String(step.campusId || ""))) {
          errors.push(`${where}: route must join a public listing area and a campus`);
        }
        break;
      }
      case "annotation":
        checkText(step.text, errors, where);
        checkTarget(step.target, ctx, errors, where);
        checkEvidence(step.evidence, errors, where);
        break;
      case "layer":
        if (!ALLOWED_LAYERS.includes(step.layerId)) errors.push(`${where}: layer not allowed`);
        break;
      case "caption":
        checkText(step.text, errors, where);
        if (step.factual !== false) checkEvidence(step.evidence, errors, where);
        break;
      case "hold":
        if (!num(step.durationMs, 0, 30000)) errors.push(`${where}: hold out of bounds`);
        break;
      case "transition":
        if (!["fly", "fade", "cut"].includes(step.style)) errors.push(`${where}: unknown transition`);
        break;
      default:
        break;
    }
  });
  return { ok: errors.length === 0, errors };
}

function caption(text, evidence) {
  return { kind: "caption", text, factual: true, evidence };
}

function finalize(doc, ctx, inputs) {
  const scene = Object.assign({ fallback2d: true }, doc, {
    dataQuality: spatialDataQuality({ inputs: inputs.filter(Boolean), now: typeof ctx.now === "function" ? ctx.now() : ctx.now }),
  });
  const checked = validateScene(scene, ctx);
  if (!checked.ok) return { ok: false, code: "invalid_scene", errors: checked.errors, scene: null };
  return { ok: true, code: "ok", scene };
}

const CATEGORY_WORD = { clinic: "clinics", pharmacy: "pharmacies", shop: "shops", transport: "transport stops" };

function amenityCaption(nearby, category) {
  const word = CATEGORY_WORD[category] || "places";
  if (!nearby || !nearby.ok) return caption(`Nearby ${word}: data is unavailable for this area right now.`, { kind: "DATA_UNAVAILABLE" });
  const data = nearby.data;
  if (data.status !== "ok" && data.status !== "empty") {
    return caption(`Nearby ${word}: no approved places provider is connected, so we cannot list them.`, { kind: "DATA_UNAVAILABLE" });
  }
  const count = (data.items || []).filter((item) => !category || item.category === category).length;
  if (data.coverage !== "GOOD") {
    return caption(`We found ${count} mapped ${word} nearby, but mapped data here may be incomplete; we may not know every one.`, { kind: "COVERAGE_INCOMPLETE", ref: "tool:spatial.nearby" });
  }
  return caption(`We found ${count} mapped ${word} nearby (OpenStreetMap sample).`, { kind: "TOOL_RESULT", ref: "tool:spatial.nearby" });
}

/** 12G: inspect -> privacy gate -> neighbourhood -> amenities -> routing -> environment -> validated scene. */
async function createPropertyTour(input, ctx, callTool) {
  const listingId = input.listingId;
  const inspect = await callTool("lodgist.inspect_property", { listingId }, ctx);
  if (!inspect.ok) return { ok: false, code: inspect.code || "forbidden", scene: null };
  const context = await callTool("lodgist.property_context", { listingId }, ctx);
  const nearby = await callTool("lodgist.nearby_amenities", { listingId, category: "all" }, ctx);
  const route = input.destination ? await callTool("lodgist.calculate_commute", { listingId, campusId: input.destination }, ctx) : null;
  const area = inspect.data.areaLabel || "the published area";
  const emphasis = ["amenities", "commute", "environment"].includes(input.emphasis) ? input.emphasis : null;
  const steps = [
    { kind: "focus", target: { type: "listing", id: listingId } },
    { kind: "camera", zoom: 14, pitch: 30, bearing: 0, durationMs: 2000 },
    caption(`${inspect.data.title} is shown at its published approximate area, ${area}. The exact location is not shared.`, { kind: "TOOL_RESULT", ref: "tool:lodgist.inspect_property" }),
  ];
  if (context.ok) steps.push(caption(`Neighbourhood: ${area}.`, { kind: "TOOL_RESULT", ref: "tool:lodgist.property_context" }));
  else steps.push(caption("Neighbourhood context is unavailable.", { kind: "DATA_UNAVAILABLE" }));
  const amenitySteps = [{ kind: "layer", layerId: "pharmacies", visible: true, quality: nearby.ok ? nearby.data.coverage : "UNKNOWN" }, amenityCaption(nearby, "clinic"), amenityCaption(nearby, "shop")];
  let routeSteps = [];
  if (input.destination) {
    if (route && route.ok && campusById(input.destination)) {
      const travel = route.data.route && route.data.route.durationS != null ? null : "Travel time is unknown because no approved routing provider is connected.";
      routeSteps = [
        { kind: "route", listingId, campusId: input.destination, status: route.data.route ? route.data.route.status : "unknown" },
        caption(`${route.data.straightLineLabel || "Distance unknown"} to ${campusById(input.destination).name}.`, { kind: "TOOL_RESULT", ref: "tool:lodgist.calculate_commute" }),
      ];
      if (travel) routeSteps.push(caption(travel, { kind: "DATA_UNAVAILABLE" }));
    } else routeSteps = [caption("The commute could not be calculated for this destination.", { kind: "DATA_UNAVAILABLE" })];
  }
  const envSteps = [caption("Environmental conditions (flood, weather) have no approved provider here, so none are shown.", { kind: "DATA_UNAVAILABLE" })];
  const ordered = emphasis === "commute" ? routeSteps.concat(amenitySteps, envSteps)
    : emphasis === "environment" ? envSteps.concat(amenitySteps, routeSteps)
      : amenitySteps.concat(routeSteps, envSteps);
  steps.push(...ordered, { kind: "transition", style: "fade", durationMs: 800 }, { kind: "hold", durationMs: 1500 });
  return finalize({ version: SCENE_VERSION, type: input.destination ? "COMMUTE_TOUR" : "PROPERTY_OVERVIEW", title: `Tour: ${inspect.data.title}`.slice(0, 120), steps }, ctx, [inspect.dataQuality, context.dataQuality, nearby.dataQuality, route && route.dataQuality]);
}

/** 12H: overview, roads, schools, healthcare, shopping, transport, environment, verified listings, closing. */
async function createNeighborhoodTour(input, ctx, callTool) {
  const listingId = input.listingId;
  const inspect = await callTool("lodgist.inspect_property", { listingId }, ctx);
  if (!inspect.ok) return { ok: false, code: inspect.code || "forbidden", scene: null };
  const nearby = await callTool("spatial.nearby", { listingId, category: "all" }, ctx);
  const area = inspect.data.areaLabel || "this area";
  const quality = nearby.ok ? nearby.data.coverage : "UNKNOWN";
  const rows = Array.isArray(ctx.listings) ? ctx.listings : [];
  const verified = rows.filter((l) => typeof ctx.isPublicListing === "function" && ctx.isPublicListing(l) === true).length;
  const steps = [
    { kind: "focus", target: { type: "listing", id: listingId } },
    { kind: "camera", zoom: 13, pitch: 0, bearing: 0, durationMs: 1500 },
    caption(`Overview of ${area}.`, { kind: "TOOL_RESULT", ref: "tool:spatial.inspect" }),
    { kind: "layer", layerId: "roads", visible: true, quality: "UNKNOWN" },
    caption("Roads: no approved road dataset is connected, so road detail is not described.", { kind: "DATA_UNAVAILABLE" }),
    { kind: "layer", layerId: "schools", visible: true, quality: "UNKNOWN" },
    caption("Schools: no approved schools dataset is connected for this area.", { kind: "DATA_UNAVAILABLE" }),
    { kind: "layer", layerId: "hospitals", visible: true, quality },
    amenityCaption(nearby, "clinic"),
    { kind: "layer", layerId: "markets", visible: true, quality },
    amenityCaption(nearby, "shop"),
    amenityCaption(nearby, "transport"),
    caption("Environment: no approved environmental provider is connected; no conditions are claimed.", { kind: "DATA_UNAVAILABLE" }),
    caption(`${verified} verified public listing${verified === 1 ? "" : "s"} available in this view.`, { kind: "DATABASE_EVIDENCE", ref: "db:listing.public" }),
    { kind: "transition", style: "fade", durationMs: 800 },
    { kind: "caption", text: "End of neighbourhood tour.", factual: false },
  ];
  return finalize({ version: SCENE_VERSION, type: "NEIGHBORHOOD_OVERVIEW", title: `Neighbourhood: ${area}`.slice(0, 120), steps }, ctx, [inspect.dataQuality, nearby.dataQuality]);
}

module.exports = {
  SCENE_VERSION,
  SCENE_TYPES,
  STEP_KINDS,
  validateScene,
  createPropertyTour,
  createNeighborhoodTour,
};
