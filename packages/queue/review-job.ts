import type { Lane } from "../config/runtime-policy";

export type ReviewJobTrigger =
    | "pull_request"
    | "check_suite_rerequested"
    | "manual_fast_rerun"
    | "manual_deep_scan";

export type ReviewJob = {
    jobId: string;
    deliveryId: string;
    lane: Lane;
    trigger: ReviewJobTrigger;
    repositoryId: number;
    repositoryFullName: string;
    installationId: number;
    prNumber: number;
    headSha: string;
    baseSha: string;
    enqueuedAt: string;
    attempt: number;
    requestedActionId?: string;
};

export type BuildReviewJobInput = {
    deliveryId: string;
    lane: Lane;
    trigger: ReviewJobTrigger;
    repositoryId: number;
    repositoryFullName: string;
    installationId: number;
    prNumber: number;
    headSha: string;
    baseSha: string;
    enqueuedAt: string;
    requestedActionId?: string;
};

export function buildReviewJob(input: BuildReviewJobInput): ReviewJob {
    return {
        jobId: `review:${input.repositoryId}:${input.prNumber}:${input.lane}:${input.headSha}:${input.deliveryId}`,
        deliveryId: input.deliveryId,
        lane: input.lane,
        trigger: input.trigger,
        repositoryId: input.repositoryId,
        repositoryFullName: input.repositoryFullName,
        installationId: input.installationId,
        prNumber: input.prNumber,
        headSha: input.headSha,
        baseSha: input.baseSha,
        enqueuedAt: input.enqueuedAt,
        attempt: 0,
        requestedActionId: input.requestedActionId
    };
}

export function isManualRerunTrigger(trigger: ReviewJobTrigger): boolean {
    return trigger === "check_suite_rerequested"
        || trigger === "manual_fast_rerun"
        || trigger === "manual_deep_scan";
}
