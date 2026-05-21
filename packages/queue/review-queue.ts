import type { Lane } from "../config/runtime-policy";
import type { ReviewJob } from "./review-job";

export type ReviewQueueRetryPolicy = {
    maxReceiveCount: number;
    visibilityTimeoutMs: number;
    dlqName: string;
};

export const DEFAULT_REVIEW_QUEUE_RETRY_POLICY: ReviewQueueRetryPolicy = {
    maxReceiveCount: 3,
    visibilityTimeoutMs: 30_000,
    dlqName: "prpilot-review-jobs-dlq"
};

export type ReviewQueueSendResult = {
    messageId: string;
    sentAt: string;
};

export type ReviewQueueMessage = {
    messageId: string;
    receiptHandle: string;
    job: ReviewJob;
    receiveCount: number;
    sentAt: string;
    visibleAt: string;
};

export type ReviewQueueFailureResult = {
    movedToDlq: boolean;
    receiveCount: number;
    nextVisibleAt?: string;
};

export type ReviewQueueLaneCounts = Record<Lane, number>;

export type ReviewQueueBacklogSnapshot = {
    visible: ReviewQueueLaneCounts;
    inFlight: ReviewQueueLaneCounts;
    dlq: number;
};

export type ReviewQueueDlqRecord = {
    messageId: string;
    job: ReviewJob;
    failedAt: string;
    reason: string;
    receiveCount: number;
    sourceQueue: "review-jobs";
};

export type DurableReviewQueue = {
    send(job: ReviewJob, now?: Date): Promise<ReviewQueueSendResult>;
    receive(now?: Date): Promise<ReviewQueueMessage | null>;
    acknowledge(receiptHandle: string): Promise<void>;
    fail(receiptHandle: string, reason: string, now?: Date): Promise<ReviewQueueFailureResult>;
    getBacklogSnapshot(now?: Date): ReviewQueueBacklogSnapshot;
    inspectDlq(): ReviewQueueDlqRecord[];
    replayDlq(messageId: string, now?: Date): Promise<ReviewQueueSendResult>;
};

type InternalQueueMessage = {
    messageId: string;
    receiptHandle: string;
    job: ReviewJob;
    receiveCount: number;
    sentAtMs: number;
    visibleAtMs: number;
    inFlight: boolean;
};

function createEmptyLaneCounts(): ReviewQueueLaneCounts {
    return {
        fast: 0,
        deep: 0
    };
}

function getLanePriority(lane: Lane): number {
    return lane === "fast" ? 0 : 1;
}

function copyJobForReplay(job: ReviewJob): ReviewJob {
    return {
        ...job,
        attempt: job.attempt + 1
    };
}

export class InMemoryReviewQueue implements DurableReviewQueue {
    private readonly retryPolicy: ReviewQueueRetryPolicy;
    private readonly messages: InternalQueueMessage[] = [];
    private readonly dlqRecords: ReviewQueueDlqRecord[] = [];
    private nextMessageNumber = 1;

    constructor(retryPolicy: ReviewQueueRetryPolicy = DEFAULT_REVIEW_QUEUE_RETRY_POLICY) {
        this.retryPolicy = retryPolicy;
    }

    async send(job: ReviewJob, now = new Date()): Promise<ReviewQueueSendResult> {
        const messageId = `review-message-${this.nextMessageNumber}`;
        this.nextMessageNumber += 1;

        this.messages.push({
            messageId,
            receiptHandle: `${messageId}:r0`,
            job,
            receiveCount: 0,
            sentAtMs: now.getTime(),
            visibleAtMs: now.getTime(),
            inFlight: false
        });

        return {
            messageId,
            sentAt: now.toISOString()
        };
    }

    async receive(now = new Date()): Promise<ReviewQueueMessage | null> {
        const nowMs = now.getTime();
        const message = this.messages
            .filter((candidate) => !candidate.inFlight && candidate.visibleAtMs <= nowMs)
            .sort((left, right) => {
                const laneRank = getLanePriority(left.job.lane) - getLanePriority(right.job.lane);
                if (laneRank !== 0) {
                    return laneRank;
                }

                return left.sentAtMs - right.sentAtMs;
            })[0];

        if (message === undefined) {
            return null;
        }

        message.receiveCount += 1;
        message.receiptHandle = `${message.messageId}:r${message.receiveCount}`;
        message.inFlight = true;
        message.visibleAtMs = nowMs + this.retryPolicy.visibilityTimeoutMs;

        return {
            messageId: message.messageId,
            receiptHandle: message.receiptHandle,
            job: message.job,
            receiveCount: message.receiveCount,
            sentAt: new Date(message.sentAtMs).toISOString(),
            visibleAt: new Date(message.visibleAtMs).toISOString()
        };
    }

    async acknowledge(receiptHandle: string): Promise<void> {
        const index = this.messages.findIndex((message) => message.receiptHandle === receiptHandle);
        if (index === -1) {
            throw new Error(`Cannot acknowledge missing review queue receipt: ${receiptHandle}`);
        }

        this.messages.splice(index, 1);
    }

    async fail(receiptHandle: string, reason: string, now = new Date()): Promise<ReviewQueueFailureResult> {
        const message = this.messages.find((candidate) => candidate.receiptHandle === receiptHandle);
        if (message === undefined) {
            throw new Error(`Cannot fail missing review queue receipt: ${receiptHandle}`);
        }

        if (message.receiveCount >= this.retryPolicy.maxReceiveCount) {
            this.messages.splice(this.messages.indexOf(message), 1);
            this.dlqRecords.push({
                messageId: message.messageId,
                job: message.job,
                failedAt: now.toISOString(),
                reason,
                receiveCount: message.receiveCount,
                sourceQueue: "review-jobs"
            });

            return {
                movedToDlq: true,
                receiveCount: message.receiveCount
            };
        }

        message.inFlight = false;
        message.visibleAtMs = now.getTime() + this.retryPolicy.visibilityTimeoutMs;

        return {
            movedToDlq: false,
            receiveCount: message.receiveCount,
            nextVisibleAt: new Date(message.visibleAtMs).toISOString()
        };
    }

    getBacklogSnapshot(now = new Date()): ReviewQueueBacklogSnapshot {
        const nowMs = now.getTime();
        const visible = createEmptyLaneCounts();
        const inFlight = createEmptyLaneCounts();

        for (const message of this.messages) {
            if (message.inFlight && message.visibleAtMs > nowMs) {
                inFlight[message.job.lane] += 1;
            } else {
                visible[message.job.lane] += 1;
            }
        }

        return {
            visible,
            inFlight,
            dlq: this.dlqRecords.length
        };
    }

    inspectDlq(): ReviewQueueDlqRecord[] {
        return this.dlqRecords.map((record) => ({
            ...record,
            job: {
                ...record.job
            }
        }));
    }

    async replayDlq(messageId: string, now = new Date()): Promise<ReviewQueueSendResult> {
        const index = this.dlqRecords.findIndex((record) => record.messageId === messageId);
        if (index === -1) {
            throw new Error(`Cannot replay missing DLQ message: ${messageId}`);
        }

        const [record] = this.dlqRecords.splice(index, 1);
        return this.send(copyJobForReplay(record.job), now);
    }
}
