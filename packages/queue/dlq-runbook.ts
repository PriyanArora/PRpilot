import type { ReviewQueueDlqRecord } from "./review-queue";

export const dlqInvestigationSteps = [
    "Read the DLQ message body and note the job id, lane, repository, PR number, and head SHA.",
    "Check the failure reason and receive count to separate code bugs from transient dependency failures.",
    "Confirm whether the PR head SHA is still current before replaying work.",
    "Replay only one inspected message at a time so the retry does not hide a repeated failure pattern.",
    "Keep the DLQ record evidence with the incident notes until the phase proof is complete."
] as const;

export type DlqReplayPlan = {
    sourceMessageId: string;
    jobId: string;
    lane: ReviewQueueDlqRecord["job"]["lane"];
    repositoryFullName: string;
    prNumber: number;
    headSha: string;
    replaySafetyCheck: "confirm_current_head_sha_before_replay";
};

export function buildDlqReplayPlan(record: ReviewQueueDlqRecord): DlqReplayPlan {
    return {
        sourceMessageId: record.messageId,
        jobId: record.job.jobId,
        lane: record.job.lane,
        repositoryFullName: record.job.repositoryFullName,
        prNumber: record.job.prNumber,
        headSha: record.job.headSha,
        replaySafetyCheck: "confirm_current_head_sha_before_replay"
    };
}
