const DOCUMENT = require("../data/providers.json");

const USER_URL_KEYS = [
  "url",
  "providerUrl",
  "userUrl",
  "interpreterUrl",
  "tileUrl",
  "baseUrl",
  "endpoint",
];

function dataSources(registry) {
  const rows = Array.isArray(registry) ? registry : DOCUMENT.providers;
  return rows.map((row) => Object.assign({}, row));
}

function providerGate(id, registry) {
  const rows = Array.isArray(registry) ? registry : DOCUMENT.providers;
  const row = rows.find((item) => item && item.id === id) || null;
  if (!row) return { id, status: "absent", cleared: false };
  return { id: row.id, status: row.status, cleared: row.status === "cleared" };
}

/**
 * spatial-lab overpass.js refuses a caller-supplied interpreter URL.
 * Operator configuration stays in env / the server `config` object.
 */
function refuseUserSuppliedProviderUrl(input) {
  if (!input || typeof input !== "object") return;
  for (const key of USER_URL_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const value = input[key];
    if (value == null || value === "") continue;
    throw new Error("refusing user-supplied provider URL");
  }
}

function assertSameProviderUrl(envUrl, configUrl) {
  if (!envUrl || configUrl == null || configUrl === "") return;
  if (String(envUrl) !== String(configUrl)) {
    throw new Error("refusing user-supplied provider URL");
  }
}

module.exports = {
  DATA_SOURCE_REVISION: DOCUMENT.sourceRevision,
  dataSources,
  providerGate,
  refuseUserSuppliedProviderUrl,
  assertSameProviderUrl,
};
