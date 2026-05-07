import type { ChangedFile } from "./changed-file";
import type { Finding } from "./finding";
import type { Coverage } from "./coverage";

export type LargeChangeRuleResult = {
    findings: Finding[];
    coverage: Coverage;
};

const LARGE_CHANGE_THRESHOLD = 200;

export function evaluateLargeChange(changedFiles: ChangedFile[]): LargeChangeRuleResult {
    const findings: Finding[] = [];
    
    for (const changedFile of changedFiles) {
        const changedLines = changedFile.additions + changedFile.deletions;

        if(changedLines > LARGE_CHANGE_THRESHOLD) {
            findings.push({
                lane: "fast",
                source: "internal",
                ruleId: "internal.large-change",
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
            source: "internal",
            ruleId: "internal.large-change",
            applicability: "applicable",
            status: "completed",
            scopeExpected: "changed files",
            scopeCompleted: "changed files",
            durationMs: 0,
            budgetMs: 0
        }
    };
}
