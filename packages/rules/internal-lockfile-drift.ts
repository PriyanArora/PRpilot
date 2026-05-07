import type { ChangedFile } from "./changed-file";
import type { Finding } from "./finding";
import type { Coverage } from "./coverage";

export type LockfileDriftResult = {
    findings: Finding[];
    coverage: Coverage;
};

export function evaluateLockfileDrift(changedFiles: ChangedFile[]): LockfileDriftResult{
    const findings: Finding[] = [];

    const packageJsonChanged = changedFiles.some((file) => file.path === "package.json"); //.some returns true if any item matches
    const lockfileChanged = changedFiles.some((file) => file.path === "package-lock.json");

    if (packageJsonChanged && !lockfileChanged) {
        findings.push({
            lane: "fast",
            source: "internal",
            ruleId: "internal.lockfile-drift",
            severity: "medium",
            blockability: "warn",
            message: "A lockfile drifted",
            path: "package.json",
            fingerprint: "internal.lockfile-drift:package.json"
        });
    }

    return {
        findings,
        coverage: {
            lane: "fast",
            source: "internal",
            ruleId: "internal.lockfile-drift",
            applicability: "applicable",
            status: "completed",
            scopeExpected: "changed files",
            scopeCompleted: "changed files",
            durationMs: 0,
            budgetMs: 0
        }
    };
}



