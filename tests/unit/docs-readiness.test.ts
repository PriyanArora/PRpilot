import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const docs = [
    ["docs/self-host-quickstart.md", "WebhookUrl"],
    ["docs/local-setup.md", "npm run preflight"],
    ["docs/live-deployment.md", "cdk diff"],
    ["docs/github-app-and-aws-setup.md", "Checks"],
    ["docs/security-architecture.md", "X-Hub-Signature-256"],
    ["docs/cost-control.md", "emergency"],
    ["docs/reliability-architecture.md", "Policy Precedence"],
    ["docs/five-minute-demo.md", "PRPilot Fast"],
    ["docs/operations-runbook.md", "DLQ Messages"],
    ["docs/recovery-drill.md", "REPO#<repositoryId>#PR#<prNumber>"],
    ["docs/secret-rotation.md", "Do not record secret values"],
    ["docs/approaching-limits-policy.md", "Deny optional deep scans"],
    ["docs/incident-rehearsal.md", "Timeline Template"]
] as const;

describe("P16 documentation readiness", () => {
    it("creates each required guide with its core operational term", () => {
        for (const [path, requiredText] of docs) {
            const absolutePath = join(process.cwd(), path);
            expect(existsSync(absolutePath), path).toBe(true);
            expect(readFileSync(absolutePath, "utf8"), path).toContain(requiredText);
        }
    });
});
