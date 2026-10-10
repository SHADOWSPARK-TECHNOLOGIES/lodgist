// Lightweight liveness payload for the frontend service. No DB, no network.
const COMMIT_VARS = ["RAILWAY_GIT_COMMIT_SHA", "GIT_COMMIT_SHA", "SOURCE_COMMIT"];

function healthPayload(env) {
  const source = env || {};
  let commit = null;
  for (const name of COMMIT_VARS) {
    const value = typeof source[name] === "string" ? source[name].trim() : "";
    if (/^[0-9a-f]{7,40}$/i.test(value)) {
      commit = value.toLowerCase();
      break;
    }
  }
  return { status: "ok", service: "lodgist-frontend", commit };
}

module.exports = { COMMIT_VARS, healthPayload };
