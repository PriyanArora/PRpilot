import { readFileSync } from "node:fs";

const requiredPathFiles = [
  "apps/webhook/handler.ts",
  "apps/worker/handler.ts",
  "packages/rules/internal-large-change.ts",
  "packages/rules/internal-lockfile-drift.ts",
  "packages/rules/internal-sensitive-file-change.ts",
  "packages/checks/check-run-conclusion.ts",
  "packages/checks/check-run-payload-builder.ts"
];

const forbiddenPatterns = [
  { name: "openai", pattern: /openai/i },
  { name: "anthropic", pattern: /anthropic/i },
  { name: "llm", pattern: /\bllm\b/i },
  { name: "chatgpt", pattern: /chatgpt/i },
  { name: "Math.random", pattern: /Math\.random/ }
];

const errors = [];

for (const file of requiredPathFiles) {
  const source = readFileSync(file, "utf8");
  for (const forbidden of forbiddenPatterns) {
    if (forbidden.pattern.test(source)) {
      errors.push(`${file} contains forbidden non-deterministic or AI dependency marker: ${forbidden.name}`);
    }
  }
}

const report = {
  ok: errors.length === 0,
  checkedFiles: requiredPathFiles,
  errors
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.ok ? 0 : 1);
