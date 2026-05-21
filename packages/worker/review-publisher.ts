import type { Coverage } from "../rules/coverage";
import type { Finding } from "../rules/finding";
import type { ReviewJob } from "../queue/review-job";
import { buildCheckRunPayload } from "../checks/check-run-payload-builder";
import {
    publishCheckRunSync,
    type SyncCheckRunStore,
    type SyncCheckPublisherResult
} from "../checks/sync-check-publisher";

export type PublishReviewJobFindingsInput = {
    job: ReviewJob;
    findings: Finding[];
    coverage: Coverage[];
    checkRunStore: SyncCheckRunStore;
    annotationCap: number;
    policyAllowsDeepScan: boolean;
    appliedLimits?: string[];
};

export function publishReviewJobFindings(input: PublishReviewJobFindingsInput): SyncCheckPublisherResult {
    const payload = buildCheckRunPayload({
        lane: input.job.lane,
        repositoryFullName: input.job.repositoryFullName,
        prNumber: input.job.prNumber,
        headSha: input.job.headSha,
        findings: input.findings,
        coverage: input.coverage
    });

    return publishCheckRunSync(input.checkRunStore, {
        repositoryId: input.job.repositoryId,
        payload,
        annotationCap: input.annotationCap,
        policyAllowsDeepScan: input.policyAllowsDeepScan,
        appliedLimits: input.appliedLimits
    });
}
