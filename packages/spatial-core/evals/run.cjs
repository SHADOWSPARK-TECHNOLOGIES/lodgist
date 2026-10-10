#!/usr/bin/env node
const { runEvals } = require("./harness.cjs");
const agent = require("./referenceAgent.cjs");

runEvals(agent).then(({ summary, results }) => {
  process.stdout.write(`${JSON.stringify({ summary, results: results.map((r) => ({ id: r.id, passed: r.passed, metrics: r.metrics })) }, null, 2)}\n`);
  if (summary.score < 1 || summary.privacyViolations > 0) process.exitCode = 1;
});
