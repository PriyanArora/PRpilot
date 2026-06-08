import {createHmac, timingSafeEqual} from "node:crypto";
import { buildReviewJob, type ReviewJob, type ReviewJobTrigger } from "../../packages/queue/review-job";
import type { DurableReviewQueue, ReviewQueueSendResult } from "../../packages/queue/review-queue";
import type { Lane } from "../../packages/config/runtime-policy";

// Confirm the request really came from GitHub: recompute the HMAC over the raw body
// with our shared secret and compare it to the signature header. The comparison is
// constant-time to avoid leaking the expected signature through timing differences.
const verifyWebhookSignature = (rawBody: string, signature: string, secret: string): boolean => {
    const expectedSignature = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    const expected = Buffer.from(expectedSignature);
    const received = Buffer.from(signature);

    // timingSafeEqual requires equal-length buffers; a length mismatch is already a mismatch.
    return expected.length === received.length && timingSafeEqual(expected, received);
};

// Only process events from repositories this installation is scoped to.
const isRepositoryAllowed = (repositoryId: number, selectedRepositoryIds: number[]): boolean => {
    return selectedRepositoryIds.includes(repositoryId);
}

// Normalized shape for the webhook payloads we handle.
export type NormalizedWebhookEvent = {
    deliveryId: string;
    eventName: "pull_request" | "check_suite" | "check_run" | "installation" | "installation_repositories";
    action: string;
    repositoryId: number;
    repositoryFullName: string;
    installationId: number;
    receivedAt: string;
    requestedActionId?: string;
    // Absent on non-PR events (e.g. installation events).
    pullRequest?: {
        number: number;
        headSha: string; // latest commit on the PR branch
        baseSha: string; // commit on the branch being merged into
        headRef: string; // PR branch name, e.g. feature-branch
        baseRef: string; // target branch name, e.g. main
    };
};

export type WebhookQueueHandoffResult = {
    statusCode: 202;
    acknowledged: true;
    job: ReviewJob;
    queueResult: ReviewQueueSendResult;
};

// RECEIVED: arrived but not yet queued. ENQUEUED: safely handed off. FAILED: handoff failed.
type DeliveryState = "RECEIVED" | "ENQUEUED" | "FAILED";

// DynamoDB record for a webhook delivery, used to dedupe repeat deliveries of the same event.
export type DeliveryItem = {
    pk: string; // DynamoDB partition key
    sk: string; // DynamoDB sort key
    deliveryId: string; // GitHub delivery ID
    state: DeliveryState;
    eventName: string; // e.g. pull_request
    action: string; // e.g. opened
    repositoryId: number;
    installationId: number;
    receivedAt: string;
    enqueuedAt?: string; // set once the delivery reaches the queue
    ttl: number; // Unix epoch seconds after which DynamoDB may expire the record
};

// Lookup used for deduplication: returns the stored delivery for an ID, or null if unseen.
export type DeliveryStore = {
    getDelivery(deliveryId: string): Promise<DeliveryItem | null>;
};

const hasDeliveryBeenSeen = async(deliveryId: string, store: DeliveryStore): Promise<boolean> => {
    const existingDelivery = await store.getDelivery(deliveryId);
    return existingDelivery !== null;
};

export function buildReviewJobFromNormalizedEvent(
    event: NormalizedWebhookEvent,
    lane: Lane,
    trigger: ReviewJobTrigger,
    now = new Date()
): ReviewJob | null {
    if (event.pullRequest === undefined) {
        return null;
    }

    return buildReviewJob({
        deliveryId: event.deliveryId,
        lane,
        trigger,
        repositoryId: event.repositoryId,
        repositoryFullName: event.repositoryFullName,
        installationId: event.installationId,
        prNumber: event.pullRequest.number,
        headSha: event.pullRequest.headSha,
        baseSha: event.pullRequest.baseSha,
        enqueuedAt: now.toISOString(),
        requestedActionId: event.requestedActionId
    });
}

export async function enqueueReviewJobFromWebhook(input: {
    event: NormalizedWebhookEvent;
    lane: Lane;
    trigger: ReviewJobTrigger;
    queue: DurableReviewQueue;
    now?: Date;
}): Promise<WebhookQueueHandoffResult | { statusCode: 204; acknowledged: false; reason: "not_review_event" }> {
    const now = input.now ?? new Date();
    const job = buildReviewJobFromNormalizedEvent(input.event, input.lane, input.trigger, now);

    if (job === null) {
        return {
            statusCode: 204,
            acknowledged: false,
            reason: "not_review_event"
        };
    }

    try {
        const queueResult = await input.queue.send(job, now);

        return {
            statusCode: 202,
            acknowledged: true,
            job,
            queueResult
        };
    } catch (error) {
        throw new Error("Failed to hand off review job to durable queue", { cause: error });
    }
}

export {verifyWebhookSignature, isRepositoryAllowed, hasDeliveryBeenSeen};
