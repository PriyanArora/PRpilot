import type { ReviewJob } from "./review-job";
import { isManualRerunTrigger } from "./review-job";

export type RerunThrottleInput = {
    job: ReviewJob;
    now: Date;
    cooldownMs: number;
    lastStartedAt?: string;
};

export type RerunThrottleDecision =
    | {
        throttled: false;
    }
    | {
        throttled: true;
        reason: "manual_rerun_cooldown";
        retryAfterMs: number;
    };

export function buildRerunThrottleKey(job: ReviewJob): string {
    return `${job.repositoryId}:${job.prNumber}:${job.lane}:${job.headSha}`;
}

export function decideRerunThrottle(input: RerunThrottleInput): RerunThrottleDecision {
    if (!isManualRerunTrigger(input.job.trigger) || input.lastStartedAt === undefined) {
        return {
            throttled: false
        };
    }

    const lastStartedAtMs = new Date(input.lastStartedAt).getTime();
    const elapsedMs = input.now.getTime() - lastStartedAtMs;

    if (elapsedMs >= input.cooldownMs) {
        return {
            throttled: false
        };
    }

    return {
        throttled: true,
        reason: "manual_rerun_cooldown",
        retryAfterMs: input.cooldownMs - elapsedMs
    };
}
