/**
 * Deterministic reference agent used by the eval harness. It plans tools
 * from the prompt, calls Spatial Core, and answers only with claims that cite
 * this turn's tool results (or an explicit UNKNOWN/DATA_UNAVAILABLE state).
 */
const PLAN = [
  [/hospital|clinic|nearby/i, "spatial.nearby", (i) => ({ listingId: i.listingId, category: "clinic" })],
  [/compare/i, "lodgist.compare_properties", (i) => ({ listingIds: i.listingIds })],
  [/commute|route/i, "lodgist.calculate_commute", (i) => ({ listingId: i.listingId, campusId: i.campusId })],
  [/changed/i, "lodgist.area_changes", (i) => ({ listingId: i.listingId })],
  [/warning|why/i, "spatial.data_quality", (i) => ({ listingId: i.listingId })],
  [/tour/i, "lodgist.create_property_tour", (i) => ({ listingId: i.listingId })],
  [/map/i, "spatial.visualize", (i) => ({ listingId: i.listingId })],
];

function plan(prompt, input) {
  const hit = PLAN.find(([re]) => re.test(prompt));
  return hit ? [{ name: hit[1], args: hit[2](input) }] : [];
}

function answer(calls) {
  const claims = [];
  calls.forEach(({ name, result }) => {
    if (!result.ok) {
      claims.push({ text: "That listing's location is not available to share.", evidence: { kind: "DATA_UNAVAILABLE" } });
      return;
    }
    const d = result.data || {};
    const ref = `tool:${name}`;
    if (name === "spatial.nearby") {
      if (d.status === "unconfigured" || d.status === "failed") claims.push({ text: "Nearby hospitals cannot be listed: no approved places provider is connected.", evidence: { kind: "DATA_UNAVAILABLE" } });
      else claims.push({ text: `${(d.items || []).length} mapped clinics nearby; coverage ${d.coverage}.`, evidence: { kind: "TOOL_RESULT", ref } });
    } else if (name === "lodgist.calculate_commute") {
      claims.push({ text: `${d.straightLineLabel}.`, evidence: { kind: "TOOL_RESULT", ref } });
      if (!d.route || d.route.durationS == null) claims.push({ text: "Travel time is unknown: no approved routing provider.", evidence: { kind: "DATA_UNAVAILABLE" } });
    } else if (name === "lodgist.area_changes") {
      if (d.code === "history_unavailable" || d.code === "flag_off") claims.push({ text: "No recorded history is available for this area yet.", evidence: { kind: "DATA_UNAVAILABLE" } });
      else claims.push({ text: `${(d.changes || []).length} recorded changes.`, evidence: { kind: "TOOL_RESULT", ref } });
    } else if (name === "spatial.data_quality") {
      claims.push({ text: `The warning comes from data-quality rules: ${d.combined.ruleIds.join(", ")}.`, evidence: { kind: "TOOL_RESULT", ref } });
    } else if (name === "lodgist.compare_properties") {
      claims.push({ text: "Comparison of the two published areas, with coverage per listing.", evidence: { kind: "TOOL_RESULT", ref } });
    } else if (name === "lodgist.create_property_tour") {
      (d.scene ? d.scene.steps : []).filter((s) => s.kind === "caption").forEach((s) => claims.push({ text: s.text, factual: s.factual, evidence: s.evidence }));
    } else if (name === "spatial.visualize") {
      claims.push({ text: "Shown at its published approximate area.", evidence: { kind: "TOOL_RESULT", ref } });
    }
  });
  return { claims };
}

module.exports = { plan, answer, name: "reference-agent-v1" };
