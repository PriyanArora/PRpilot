import { readFileSync } from "node:fs";

const baselinePath = process.argv[2] ?? "ci/latency-baseline.json";
const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));

const currentP50Ms = Number(process.env.LATENCY_CURRENT_P50_MS ?? baseline.currentP50Ms);
const currentP95Ms = Number(process.env.LATENCY_CURRENT_P95_MS ?? baseline.currentP95Ms);
const allowedP50Ms = baseline.baselineP50Ms * (1 + baseline.tolerancePercent / 100);
const allowedP95Ms = baseline.baselineP95Ms * (1 + baseline.tolerancePercent / 100);
const errors = [];

if (!Number.isFinite(currentP50Ms) || !Number.isFinite(currentP95Ms)) {
  errors.push("Current latency values must be finite numbers");
}

if (currentP50Ms > allowedP50Ms) {
  errors.push(`p50 latency ${currentP50Ms}ms exceeds allowed ${allowedP50Ms}ms`);
}

if (currentP95Ms > allowedP95Ms) {
  errors.push(`p95 latency ${currentP95Ms}ms exceeds allowed ${allowedP95Ms}ms`);
}

const report = {
  ok: errors.length === 0,
  metric: baseline.metric,
  currentP50Ms,
  currentP95Ms,
  allowedP50Ms,
  allowedP95Ms,
  errors
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
