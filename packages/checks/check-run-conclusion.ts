import type { Lane } from "../config/runtime-policy";
import type { Coverage } from "../rules/coverage";
import type { Finding } from "../rules/finding";
import type { CheckRunConclusion } from "../rules/check-run-payload-input";

const REQUIRED_GAP_STATUSES = new Set<Coverage["status"]>([
    "failed",
    "timed_out",
    "denied_by_limit",
    "partial_input",
    "skipped_by_policy"
]);

export type CheckRunConclusionInput = {
    lane: Lane;
    findings: Finding[];
    coverage: Coverage[];
};

function hasFastLaneCoverageGap(coverage: Coverage[]): boolean {
    return coverage.some((coverageRecord) =>
        coverageRecord.lane === "fast"
        && coverageRecord.applicability === "applicable"
        && REQUIRED_GAP_STATUSES.has(coverageRecord.status)
    );
}

function hasBlockingFinding(findings: Finding[]): boolean {
    return findings.some((finding) => finding.blockability === "block");
}

function hasDeepLaneAdvisorySignal(input: CheckRunConclusionInput): boolean {
    return input.findings.length > 0 || input.coverage.some((coverageRecord) =>
        coverageRecord.status !== "completed" && coverageRecord.status !== "not_applicable"
    );
}

export function resolveCheckRunConclusion(input: CheckRunConclusionInput): CheckRunConclusion {
    if (input.lane === "fast") {
        if (hasFastLaneCoverageGap(input.coverage)) {
            return "action_required";
        }

        if (hasBlockingFinding(input.findings)) {
            return "failure";
        }

        return "success";
    }

    return hasDeepLaneAdvisorySignal(input) ? "neutral" : "success";
}
