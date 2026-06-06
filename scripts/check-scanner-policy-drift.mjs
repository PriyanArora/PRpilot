import { readFileSync } from "node:fs";

const baseline = JSON.parse(readFileSync("ci/scanner-policy-baseline.json", "utf8"));
const source = readFileSync("packages/rules/scanner-catalog-snapshot.ts", "utf8");
const entryPattern = /\{\s*scanner: "([^"]+)",\s*lane: "([^"]+)",\s*trigger: "([^"]+)",\s*inputScope: "([^"]+)",\s*mode: "([^"]+)",\s*enabledByDefault: (true|false),\s*canBlockMerge: (true|false)\s*\}/g;
const current = [...source.matchAll(entryPattern)].map((match) => ({
  scanner: match[1],
  lane: match[2],
  trigger: match[3],
  inputScope: match[4],
  mode: match[5],
  enabledByDefault: match[6] === "true",
  canBlockMerge: match[7] === "true"
}));

const errors = [];
if (current.length === 0) {
  errors.push("No scanner catalog entries were parsed");
}

if (JSON.stringify(current, null, 2) !== JSON.stringify(baseline, null, 2)) {
  errors.push("Scanner catalog snapshot drifted from ci/scanner-policy-baseline.json");
}

const report = {
  ok: errors.length === 0,
  scannerCount: current.length,
  errors
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
