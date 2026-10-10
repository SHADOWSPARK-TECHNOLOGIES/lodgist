/**
 * Phase 12J hallucination firewall. Every factual claim must resolve to
 * DATABASE_EVIDENCE, PROVIDER_EVIDENCE, TOOL_RESULT or APPROVED_STATIC_DATA
 * that actually exists in this turn's evidence index; otherwise it is
 * rewritten as UNKNOWN / DATA_UNAVAILABLE / COVERAGE_INCOMPLETE.
 * Deterministic: no model scoring.
 */
const { CLAIM_EVIDENCE_KINDS, CLAIM_FALLBACKS } = require("./evidence.cjs");
const { CAMPUSES } = require("./campuses.cjs");
const { COVERAGE_DATASETS } = require("./coverage.cjs");

const FACTUAL_HINT = /(\d|\bsafe\b|\bunsafe\b|danger|crime|flood|secure|best|worst|cheap|expensive|minutes?|\bkm\b|hospital|school|clinic|pharmac|market|shop|road|bus|near|far|quiet|noisy|good|poor|bad|always|never|guarantee)/i;
const REF_PREFIX = { DATABASE_EVIDENCE: "db:", PROVIDER_EVIDENCE: "provider:", TOOL_RESULT: "tool:", APPROVED_STATIC_DATA: "static:" };

function approvedStaticRefs() {
  return CAMPUSES.map((c) => `static:campus:${c.id}`).concat(COVERAGE_DATASETS.map((d) => `static:coverage:${d.datasetId}`));
}

/** Build the evidence index from this turn's tool results (and optional DB refs). */
function evidenceIndex(input = {}) {
  const refs = new Set(approvedStaticRefs());
  (Array.isArray(input.toolResults) ? input.toolResults : []).forEach((call) => {
    if (!call || !call.result || call.result.ok !== true) return;
    refs.add(`tool:${call.name}`);
    const prov = call.result.provenance;
    if (prov && typeof prov.provider === "string" && prov.provider) refs.add(`provider:${prov.provider}`);
    // Nested refs reported by a core composite tool (tours) for sub-calls it ran this turn.
    const data = call.result.data || {};
    const nested = (Array.isArray(data.evidenceRefs) ? data.evidenceRefs : [])
      .concat(data.scene && Array.isArray(data.scene.evidenceRefs) ? data.scene.evidenceRefs : []);
    nested.forEach((ref) => {
      if (typeof ref !== "string") return;
      if (ref.startsWith("tool:") && knownTool(ref.slice(5))) refs.add(ref);
      if (ref.startsWith("db:") && input.allowNestedDatabaseRefs !== false) refs.add(ref);
    });
  });
  (Array.isArray(input.databaseRefs) ? input.databaseRefs : []).forEach((ref) => refs.add(`db:${ref}`));
  return refs;
}

function knownTool(name) {
  const { listTools } = require("./tools.cjs");
  return listTools().some((t) => t.name === name);
}

function looksFactual(claim) {
  if (claim.factual === true) return true;
  if (claim.factual === false) return FACTUAL_HINT.test(claim.text || "");
  return true;
}

function checkClaim(claim, refs) {
  const text = claim && typeof claim.text === "string" ? claim.text : "";
  const ev = claim && claim.evidence && typeof claim.evidence === "object" ? claim.evidence : null;
  if (!looksFactual(claim || {})) return { text, status: "NON_FACTUAL", kind: null, ref: null };
  if (ev && CLAIM_FALLBACKS.includes(ev.kind)) return { text, status: ev.kind, kind: ev.kind, ref: ev.ref || null };
  if (ev && CLAIM_EVIDENCE_KINDS.includes(ev.kind) && typeof ev.ref === "string"
    && ev.ref.startsWith(REF_PREFIX[ev.kind]) && refs.has(ev.ref)) {
    return { text, status: "SUPPORTED", kind: ev.kind, ref: ev.ref };
  }
  return { text: "UNKNOWN: this could not be verified from available evidence.", status: "UNKNOWN", kind: null, ref: null, original: text, unsupported: true };
}

function firewallClaims(claims, input = {}) {
  const refs = input.refs instanceof Set ? input.refs : evidenceIndex(input);
  const checked = (Array.isArray(claims) ? claims : []).map((claim) => checkClaim(claim, refs));
  const unsupported = checked.filter((c) => c.unsupported).length;
  return { ok: unsupported === 0, claims: checked, unsupported, total: checked.length };
}

module.exports = {
  evidenceIndex,
  firewallClaims,
  approvedStaticRefs,
};
