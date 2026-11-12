/**
 * Non-mutating public reachability check for the controlled-beta release gate.
 * This checks the currently live service, not the commit in a preview PR.
 * Never POST, create customer records, or log response bodies or credentials.
 */
const probes = [
  { name: "Homepage", url: "https://lodgist.online/", type: "html" },
  { name: "Rental-check page", url: "https://lodgist.online/check", type: "html" },
  { name: "Listings page", url: "https://lodgist.online/listings", type: "html" },
  { name: "API and database health", url: "https://lodgist-api-production.up.railway.app/api/health", type: "db" },
  { name: "AI route reachability (not model authentication)", url: "https://lodgist-api-production.up.railway.app/api/ai-analysis/health", type: "ai" },
];

import dns from "node:dns/promises";

try {
  const addresses = await dns.lookup("lodgist.online", { all: true });
  console.log(`Public site DNS lookup: ${addresses.length} address(es), families ${addresses.map(x => x.family).join(",")}`);
} catch (error) {
  console.error(`Public site DNS lookup error: ${error.code ?? error.message}`);
}

let failures = 0;
for (const probe of probes) {
  try {
    const response = await fetch(probe.url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: probe.type === "html" ? "text/html" : "application/json",
        "User-Agent": "LodgistReadOnlyReleaseCheck/1.0",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (probe.type === "html") {
      if (!contentType.includes("text/html")) throw new Error("not an HTML response");
      const page = await response.text();
      if (!page.includes("Lodgist")) throw new Error("Lodgist page marker absent");
    } else {
      if (!contentType.includes("json")) throw new Error("not a JSON response");
      const data = await response.json();
      if (probe.type === "db" && (data.status !== "ok" || data.database !== "connected")) {
        throw new Error("API reports unhealthy database");
      }
      if (probe.type === "ai" && (data.status !== "ok" || data.service !== "ai-analysis")) {
        throw new Error("AI route health mismatch");
      }
    }
    console.log(`PASS ${probe.name}: HTTP ${response.status}`);
  } catch (error) {
    failures += 1;
    const causeCode = error.cause?.code ?? error.code ?? "no-cause-code";
    const causeText = error.cause?.message ?? "";
    console.error(`FAIL ${probe.name}: ${error.message} [${causeCode}] ${causeText.slice(0, 180)}`);
  }
}
if (failures > 0) {
  console.error(`FAIL ${failures}/${probes.length} public reachability probes`);
  process.exitCode = 1;
} else {
  console.log(`PASS all ${probes.length} public read-only probes`);
}
