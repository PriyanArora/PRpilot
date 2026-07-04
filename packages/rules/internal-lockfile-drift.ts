import type { ChangedFile } from "./changed-file";
import type { Finding } from "./finding";
import type { Coverage } from "./coverage";

export type LockfileDriftResult = {
    findings: Finding[];
    coverage: Coverage;
};

const LOCKFILE_PATHS = ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "npm-shrinkwrap.json"];

export function evaluateLockfileDrift(changedFiles: ChangedFile[]): LockfileDriftResult{
    const findings: Finding[] = [];

    const packageJsonChanged = changedFiles.some((file) => file.path === "package.json");
    const changedLockfile = LOCKFILE_PATHS.find((lockfilePath) =>
        changedFiles.some((file) => file.path === lockfilePath)
    );

    if (packageJsonChanged && changedLockfile === undefined) {
        findings.push({
            lane: "fast",
            pack: "internal",
            scanner: "internal",
            rule_id: "internal.lockfile-drift",
            severity: "medium",
            blockability: "block",
            scope_basis: "changed_files",
            message: "package.json changed but no lockfile was updated — reinstall and commit the lockfile",
            path: "package.json",
            fingerprint: "internal.lockfile-drift:package.json"
        });
    }

    // The reverse direction is suspicious too: a lockfile edit with no manifest change
    // can mean a hand-edited lockfile or an unreviewed dependency bump.
    if (!packageJsonChanged && changedLockfile !== undefined) {
        findings.push({
            lane: "fast",
            pack: "internal",
            scanner: "internal",
            rule_id: "internal.lockfile-drift",
            severity: "medium",
            blockability: "warn",
            scope_basis: "changed_files",
            message: `${changedLockfile} changed without package.json — verify the dependency change is intentional`,
            path: changedLockfile,
            fingerprint: `internal.lockfile-drift:${changedLockfile}`
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
