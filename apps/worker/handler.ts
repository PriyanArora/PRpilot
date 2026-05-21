import type { ReviewJob } from "../../packages/queue/review-job";
import type { DurableReviewQueue, ReviewQueueMessage } from "../../packages/queue/review-queue";
import { decideLaneAdmission } from "../../packages/queue/lane-admission";
import type { HeadShaLookupResult, JobFreshnessDecision } from "../../packages/queue/job-freshness";
import { decideJobFreshness } from "../../packages/queue/job-freshness";
import { decideRerunThrottle, type RerunThrottleDecision } from "../../packages/queue/rerun-throttle";

export type ReviewJobProcessorResult = {
    summary: string;
};

export type ReviewJobProcessor = (job: ReviewJob) => Promise<ReviewJobProcessorResult>;

export type WorkerHandlerInput = {
    queue: DurableReviewQueue;
    processJob: ReviewJobProcessor;
    now?: Date;
    manualDeepScanEnabled: boolean;
    deepRunsStartedToday: number;
    maxDeepRunsPerDay: number;
    getCurrentHeadSha: (job: ReviewJob) => Promise<HeadShaLookupResult>;
    rerunLastStartedAt?: string;
    rerunCooldownMs?: number;
};

export type WorkerConsumeResult =
    | {
        status: "idle";
    }
    | {
        status: "processed";
        message: ReviewQueueMessage;
        processorResult: ReviewJobProcessorResult;
    }
    | {
        status: "denied";
        message: ReviewQueueMessage;
        reason: string;
    }
    | {
        status: "throttled";
        message: ReviewQueueMessage;
        throttle: RerunThrottleDecision;
    }
    | {
        status: "superseded";
        message: ReviewQueueMessage;
        freshness: JobFreshnessDecision;
    }
    | {
        status: "action_required";
        message: ReviewQueueMessage;
        freshness: JobFreshnessDecision;
    }
    | {
        status: "retrying";
        message: ReviewQueueMessage;
        reason: string;
        receiveCount: number;
    }
    | {
        status: "sent_to_dlq";
        message: ReviewQueueMessage;
        reason: string;
        receiveCount: number;
    };

function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "unknown worker failure";
}

export async function consumeOneReviewJob(input: WorkerHandlerInput): Promise<WorkerConsumeResult> {
    const now = input.now ?? new Date();
    const message = await input.queue.receive(now);

    if (message === null) {
        return {
            status: "idle"
        };
    }

    const snapshot = input.queue.getBacklogSnapshot(now);
    const admission = decideLaneAdmission({
        job: message.job,
        manualDeepScanEnabled: input.manualDeepScanEnabled,
        fastBacklogCount: snapshot.visible.fast,
        fastInFlightCount: snapshot.inFlight.fast - (message.job.lane === "fast" ? 1 : 0),
        deepInFlightCount: snapshot.inFlight.deep - (message.job.lane === "deep" ? 1 : 0),
        deepRunsStartedToday: input.deepRunsStartedToday,
        maxDeepRunsPerDay: input.maxDeepRunsPerDay
    });

    if (!admission.admitted) {
        await input.queue.acknowledge(message.receiptHandle);
        return {
            status: "denied",
            message,
            reason: admission.reason
        };
    }

    const throttle = decideRerunThrottle({
        job: message.job,
        now,
        cooldownMs: input.rerunCooldownMs ?? 60_000,
        lastStartedAt: input.rerunLastStartedAt
    });

    if (throttle.throttled) {
        await input.queue.acknowledge(message.receiptHandle);
        return {
            status: "throttled",
            message,
            throttle
        };
    }

    const freshness = decideJobFreshness(message.job, await input.getCurrentHeadSha(message.job));

    if (!freshness.fresh) {
        await input.queue.acknowledge(message.receiptHandle);

        if (freshness.action === "publish_action_required") {
            return {
                status: "action_required",
                message,
                freshness
            };
        }

        return {
            status: "superseded",
            message,
            freshness
        };
    }

    try {
        const processorResult = await input.processJob(message.job);
        await input.queue.acknowledge(message.receiptHandle);

        return {
            status: "processed",
            message,
            processorResult
        };
    } catch (error) {
        const reason = getErrorMessage(error);
        const failure = await input.queue.fail(message.receiptHandle, reason, now);

        if (failure.movedToDlq) {
            return {
                status: "sent_to_dlq",
                message,
                reason,
                receiveCount: failure.receiveCount
            };
        }

        return {
            status: "retrying",
            message,
            reason,
            receiveCount: failure.receiveCount
        };
    }
}
