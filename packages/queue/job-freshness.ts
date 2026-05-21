import type { ReviewJob } from "./review-job";

export type HeadShaLookupResult =
    | {
        ok: true;
        currentHeadSha: string;
    }
    | {
        ok: false;
        error: string;
    };

export type JobFreshnessDecision =
    | {
        fresh: true;
    }
    | {
        fresh: false;
        action:
            | "drop_stale_fast"
            | "drop_stale_deep"
            | "publish_action_required";
        reason: string;
    };

export function decideJobFreshness(job: ReviewJob, lookup: HeadShaLookupResult): JobFreshnessDecision {
    if (!lookup.ok) {
        return {
            fresh: false,
            action: job.lane === "fast" ? "publish_action_required" : "drop_stale_deep",
            reason: `freshness_check_failed:${lookup.error}`
        };
    }

    if (lookup.currentHeadSha === job.headSha) {
        return {
            fresh: true
        };
    }

    return {
        fresh: false,
        action: job.lane === "fast" ? "drop_stale_fast" : "drop_stale_deep",
        reason: `superseded_by:${lookup.currentHeadSha}`
    };
}
