import type { Coverage } from "../rules/coverage";
import type { CheckRunConclusion } from "../rules/check-run-payload-input";

export const RUN_DEEP_SCAN_ACTION_ID = "run_deep_scan";
export const RERUN_DEEP_SCAN_ACTION_ID = "rerun_deep_scan";

export type DeepScanActionInput = {
    lane: "fast" | "deep";
    conclusion: CheckRunConclusion;
    coverage: Coverage[];
    policyAllowsDeepScan: boolean;
};

function hasHonestFastLaneCoverage(coverage: Coverage[]): boolean {
    return coverage.every((coverageRecord) =>
        coverageRecord.status === "completed" || coverageRecord.status === "not_applicable"
    );
}

export function shouldExposeDeepScanAction(input: DeepScanActionInput): boolean {
    return input.lane === "fast"
        && input.policyAllowsDeepScan
        && input.conclusion !== "action_required"
        && hasHonestFastLaneCoverage(input.coverage);
}

export function getPublishedCheckActions(input: DeepScanActionInput): string[] {
    if (shouldExposeDeepScanAction(input)) {
        return [RUN_DEEP_SCAN_ACTION_ID];
    }

    if (input.lane === "deep" && input.policyAllowsDeepScan) {
        return [RERUN_DEEP_SCAN_ACTION_ID];
    }

    return [];
}
