import type { ReviewJob } from "./review-job";

export type LaneAdmissionInput = {
    job: ReviewJob;
    manualDeepScanEnabled: boolean;
    fastBacklogCount: number;
    fastInFlightCount: number;
    deepInFlightCount: number;
    deepRunsStartedToday: number;
    maxDeepRunsPerDay: number;
};

export type LaneAdmissionDecision =
    | {
        admitted: true;
    }
    | {
        admitted: false;
        reason:
            | "deep_scan_disabled"
            | "fast_lane_priority"
            | "deep_lane_lock_held"
            | "deep_quota_exhausted";
    };

export function decideLaneAdmission(input: LaneAdmissionInput): LaneAdmissionDecision {
    if (input.job.lane === "fast") {
        return {
            admitted: true
        };
    }

    if (!input.manualDeepScanEnabled) {
        return {
            admitted: false,
            reason: "deep_scan_disabled"
        };
    }

    if (input.fastBacklogCount > 0 || input.fastInFlightCount > 0) {
        return {
            admitted: false,
            reason: "fast_lane_priority"
        };
    }

    if (input.deepInFlightCount > 0) {
        return {
            admitted: false,
            reason: "deep_lane_lock_held"
        };
    }

    if (input.deepRunsStartedToday >= input.maxDeepRunsPerDay) {
        return {
            admitted: false,
            reason: "deep_quota_exhausted"
        };
    }

    return {
        admitted: true
    };
}
