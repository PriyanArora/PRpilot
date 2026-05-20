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
            pack: "internal",
            scanner: "internal",
            rule_id: "internal.lockfile-drift",
            severity: "medium",
            blockability: "block",
            scope_basis: "changed_files",
            message: "A lockfile drifted",
            path: "package.json",
            fingerprint: "internal.lockfile-drift:package.json"
        });
    }

    return {
        findings,
        coverage: {
            lane: "fast",
            scanner: "internal",
            applicability: "applicable",
            status: "completed",
            scope_expected: "changed_files",
            scope_completed: "changed_files",
            duration_ms: 0,
            budget_ms: 0
        }
    };
}

