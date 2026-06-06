import type { ChangedFile } from "./changed-file";
import type { Finding } from "./finding";
import type { Coverage } from "./coverage";

export type LargeChangeRuleResult = {
    findings: Finding[];
    coverage: Coverage;
};

const LARGE_CHANGE_THRESHOLD = 200;

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
