import type { ChangedFile } from "../rules/changed-file";
import type { ReviewJob } from "../queue/review-job";
import type { ReviewJobProcessor } from "../../apps/worker/handler";
import type { SyncCheckRunStore } from "../checks/sync-check-publisher";
import { runInternalFastLaneReview } from "../rules/internal-fast-lane-review";
import { publishReviewJobFindings } from "./review-publisher";

export type ChangedFilesFetcher = (job: ReviewJob) => Promise<ChangedFile[]>;

export type InternalReviewProcessorInput = {
    fetchChangedFiles: ChangedFilesFetcher;
    checkRunStore: SyncCheckRunStore;
    annotationCap?: number;
    policyAllowsDeepScan?: boolean;
};

// The end-to-end review step the worker runs per job: fetch the PR's changed files,
// run the internal fast-lane rules, and publish the resulting check run. A thrown
// fetch error propagates so the queue's retry/DLQ path handles it.
export function createInternalReviewProcessor(input: InternalReviewProcessorInput): ReviewJobProcessor {
    return async (job) => {
        const changedFiles = await input.fetchChangedFiles(job);
        const review = runInternalFastLaneReview(changedFiles);

        const published = publishReviewJobFindings({
            job,
            findings: review.findings,
            coverage: review.coverage,
            checkRunStore: input.checkRunStore,
            annotationCap: input.annotationCap ?? 50,
            policyAllowsDeepScan: input.policyAllowsDeepScan ?? false
        });

        return {
            summary: `${published.checkRun.conclusion}: ${review.findings.length} finding(s) on PR #${job.prNumber}`
        };
    };
}
