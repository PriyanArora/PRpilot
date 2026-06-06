import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
    return readFileSync(join(process.cwd(), path), "utf8");
}

describe("P17 CI/CD readiness", () => {
    it("creates separate PR and deploy workflows", () => {
        expect(existsSync(join(process.cwd(), ".github/workflows/pr.yml"))).toBe(true);
        expect(existsSync(join(process.cwd(), ".github/workflows/deploy.yml"))).toBe(true);
        expect(read(".github/workflows/pr.yml")).toContain("npm run ci:deterministic");
        expect(read(".github/workflows/deploy.yml")).toContain("needs: validate");
        expect(read(".github/workflows/deploy.yml")).toContain("id-token: write");
        expect(read(".github/workflows/deploy.yml")).toContain("role-to-assume");
    });

    it("stores guard baselines and scripts", () => {
        expect(JSON.parse(read("ci/latency-baseline.json"))).toMatchObject({
            metric: "webhook_to_check_latency_ms",
            tolerancePercent: 20
        });
        expect(JSON.parse(read("ci/scanner-policy-baseline.json"))).toHaveLength(7);
        expect(read("scripts/check-latency-baseline.mjs")).toContain("LATENCY_CURRENT_P95_MS");
        expect(read("scripts/check-scanner-policy-drift.mjs")).toContain("scanner-policy-baseline.json");
        expect(read("scripts/check-required-path-deterministic.mjs")).toContain("Math.random");
        expect(read("ci/free-tier-plan.md")).toContain("workflow_dispatch");
    });
});
