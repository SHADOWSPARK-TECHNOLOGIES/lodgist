#!/usr/bin/env node
/**
 * One-shot monitor runner. There is no worker loop. With SPATIAL_MONITORING
 * unset this prints flag_off and exits. With the flag set and no JSON file
 * it refuses to start a background loop.
 */
const fs = require("fs");
const spatial = require("../../packages/spatial-core");

function write(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function main() {
  if (!spatial.monitoringEnabled(process.env)) {
    write({ ok: true, code: "flag_off", observations: [], alerts: [] });
    return;
  }
  const file = process.argv[2];
  if (!file) {
    write({ ok: true, code: "worker_not_deployed", observations: [], alerts: [] });
    return;
  }
  const monitor = JSON.parse(fs.readFileSync(file, "utf8"));
  write(spatial.runMonitor(monitor, Date.now(), { env: process.env }));
}

main();
