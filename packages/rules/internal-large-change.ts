import type { ChangedFile } from "./changed-file";
import type { Finding } from "./finding";
import type { Coverage } from "./coverage";

export type LargeChangeRuleResult = {
    findings: Finding[];
    coverage: Coverage;
};

const LARGE_CHANGE_THRESHOLD = 200;
// A PR can dodge the per-file threshold with many medium files and still be
// unreviewable as a whole, so total size gets its own (higher) threshold.
const LARGE_TOTAL_THRESHOLD = 800;

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
    totalThresholdLines?: number;
};

export function evaluateLargeChange(
    changedFiles: ChangedFile[],
    options: LargeChangeRuleOptions = {}
): LargeChangeRuleResult {
    const findings: Finding[] = [];
    const thresholdLines = options.thresholdLines ?? LARGE_CHANGE_THRESHOLD;
    const totalThresholdLines = options.totalThresholdLines ?? LARGE_TOTAL_THRESHOLD;

    let totalChangedLines = 0;
    let countedFiles = 0;

    for (const changedFile of changedFiles) {
        if (GENERATED_FILE_PATHS.has(changedFile.path)) {
            continue;
        }

        const changedLines = changedFile.additions + changedFile.deletions;
        totalChangedLines += changedLines;
        countedFiles += 1;

        if(changedLines > thresholdLines) {
            findings.push({
                lane: "fast",
                pack: "internal",
                scanner: "internal",
                rule_id: "internal.large-change",
                scope_basis: "changed_files",
                severity: "medium",
                blockability: "warn",
                message: `Large file change: ${changedLines} changed lines (threshold ${thresholdLines})`,
                path: changedFile.path,
                fingerprint: `internal.large-change:${changedFile.path}`
            });
        }
    }

    if (totalChangedLines > totalThresholdLines) {
        findings.push({
            lane: "fast",
            pack: "internal",
            scanner: "internal",
            rule_id: "internal.large-change",
            scope_basis: "changed_files",
            severity: "medium",
            blockability: "warn",
            message: `Large PR: ${totalChangedLines} changed lines across ${countedFiles} files (threshold ${totalThresholdLines}) — consider splitting it`,
            path: ".",
            fingerprint: "internal.large-change:total"
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
