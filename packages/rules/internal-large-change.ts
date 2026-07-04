import type { ChangedFile } from "./changed-file";
import type { Finding } from "./finding";
import type { Coverage } from "./coverage";

export type LargeChangeRuleResult = {
    findings: Finding[];
    coverage: Coverage;
};

const LARGE_CHANGE_THRESHOLD = 200;

// Lockfiles and generated files routinely produce huge, auto-generated diffs; a
// large diff there is expected noise, not hand-written code worth flagging.
// package.json/package-lock.json drift is covered separately by internal.lockfile-drift.
const GENERATED_FILE_PATHS = new Set<string>([
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "npm-shrinkwrap.json"
]);

export type LargeChangeRuleOptions = {
    thresholdLines?: number;
};

export function evaluateLargeChange(
    changedFiles: ChangedFile[],
    options: LargeChangeRuleOptions = {}
): LargeChangeRuleResult {
    const findings: Finding[] = [];
    const thresholdLines = options.thresholdLines ?? LARGE_CHANGE_THRESHOLD;

    for (const changedFile of changedFiles) {
        if (GENERATED_FILE_PATHS.has(changedFile.path)) {
            continue;
        }

        const changedLines = changedFile.additions + changedFile.deletions;

        if(changedLines > thresholdLines) {
            findings.push({
                lane: "fast",
                pack: "internal",
                scanner: "internal",
                rule_id: "internal.large-change",
                scope_basis: "changed_files",
                severity: "medium",
                blockability: "warn",
                message: `Large file change: ${changedLines} changed lines`,
                path: changedFile.path,
                fingerprint: `internal.large-change:${changedFile.path}`
            });
        }
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
