# P6 Async Queue Pipeline Walkthrough

## Manual Actions Still Needed

The P6 code is locally proven with an in-memory SQS-like queue, but the live AWS/GitHub proof is still manual. Before declaring the external P6 gate fully proven, show:

- Real enqueue evidence from webhook ingress after durable SQS handoff.
- Real worker processing logs from an SQS-triggered worker.
- One DLQ failure record plus manual inspection or replay evidence.
- One timeout-handling example and one freshness, rerun-throttle, superseded-job, or deep-lane denial example.

This file explains the P6 work in order. P6 moves review work out of the webhook path and into a queue/worker path. The local proof uses an in-memory SQS-like queue so the behavior is testable before real AWS wiring.

## P6.0 Walk through SQS, durable handoff, visibility timeout, retries, and DLQ

SQS is like a reliable waiting room. The webhook puts review jobs into the room, then the worker takes jobs out one at a time. A visibility timeout means a worker temporarily owns a message. If it fails, the message can return for retry. After too many failures, it goes to the dead-letter queue.

Code:

```ts
export const p6QueueConcepts = {
    sqs: "SQS is the durable waiting room for review jobs after webhook ingress accepts them.",
    durableHandoff: "The webhook can acknowledge GitHub only after the review job is safely written to the queue.",
    visibilityTimeout: "A received message becomes hidden for a short window while one worker owns the attempt.",
    retries: "A failed message becomes visible again until the retry policy sends it to the DLQ.",
    deadLetterQueue: "The DLQ stores messages that exceeded retry limits so an operator can inspect or replay them."
} as const;
```

File: `packages/queue/sqs-concepts.ts`

## P6.1 Enqueue review jobs from the webhook handler

The webhook handler now turns a normalized PR event into a `ReviewJob` and sends it to the durable queue abstraction.

Code:

```ts
const job = buildReviewJobFromNormalizedEvent(input.event, input.lane, input.trigger, now);
const queueResult = await input.queue.send(job, now);
```

File: `apps/webhook/handler.ts`

## P6.2 Return webhook success only after safe queue handoff

GitHub should only get a success response after the queue send succeeds. If queue handoff fails, the helper throws with the original error preserved as `cause`.

Code:

```ts
try {
    const queueResult = await input.queue.send(job, now);
    return { statusCode: 202, acknowledged: true, job, queueResult };
} catch (error) {
    throw new Error("Failed to hand off review job to durable queue", { cause: error });
}
```

File: `apps/webhook/handler.ts`

## P6.3 Make the worker consume queued jobs

The worker receives one visible message, processes it, and acknowledges it only after processing succeeds.

Code:

```ts
const message = await input.queue.receive(now);
const processorResult = await input.processJob(message.job);
await input.queue.acknowledge(message.receiptHandle);
```

File: `apps/worker/handler.ts`

## P6.4 Define the queue-job contract

The queue job carries the lane, trigger, installation, repository, PR number, head SHA, base SHA, delivery ID, and enqueue time. That is the minimum identity the worker needs to do deterministic work.

Code:

```ts
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
```

File: `packages/queue/review-job.ts`

## P6.5 Route jobs by lane without deep bypassing fast

The local queue always returns visible fast-lane jobs before visible deep-lane jobs. Deep work cannot jump ahead of required fast work.

Code:

```ts
const laneRank = getLanePriority(left.job.lane) - getLanePriority(right.job.lane);
```

File: `packages/queue/review-queue.ts`

## P6.6 Configure retry behavior

Failed worker attempts call `queue.fail`. If the receive count is still below the max, the message becomes visible again after the visibility timeout.

Code:

```ts
message.inFlight = false;
message.visibleAtMs = now.getTime() + this.retryPolicy.visibilityTimeoutMs;
```

File: `packages/queue/review-queue.ts`

## P6.7 Configure the dead-letter queue

When a message reaches the retry limit, it moves to the DLQ with the job, failure reason, receive count, and timestamp.

Code:

```ts
this.dlqRecords.push({
    messageId: message.messageId,
    job: message.job,
    failedAt: now.toISOString(),
    reason,
    receiveCount: message.receiveCount,
    sourceQueue: "review-jobs"
});
```

File: `packages/queue/review-queue.ts`

## P6.8 Document how to inspect a failed DLQ message

The DLQ runbook lists what to inspect before replaying a failed message.

Code:

```ts
export const dlqInvestigationSteps = [
    "Read the DLQ message body and note the job id, lane, repository, PR number, and head SHA.",
    "Check the failure reason and receive count to separate code bugs from transient dependency failures.",
    "Confirm whether the PR head SHA is still current before replaying work."
] as const;
```

File: `packages/queue/dlq-runbook.ts`

## P6.9 Practice replaying one failed message

Replay removes one inspected DLQ record and sends a copied job back to the main queue with an incremented attempt.

Code:

```ts
const [record] = this.dlqRecords.splice(index, 1);
return this.send(copyJobForReplay(record.job), now);
```

File: `packages/queue/review-queue.ts`

## P6.10 Enforce scanner timeout handling

Timeouts become normalized coverage records. Fast-lane timeout coverage maps to `action_required`; deep-lane timeout coverage maps to advisory `neutral`.

Code:

```ts
export function buildScannerFailureCoverage(input: ScannerFailureCoverageInput): Coverage {
    return {
        lane: input.lane,
        scanner: input.scanner,
        applicability: "applicable",
        status: input.failureKind === "timeout" ? "timed_out" : "failed",
        scope_completed: "partial_scope",
        reason: input.reason,
        duration_ms: input.durationMs,
        budget_ms: input.budgetMs
    };
}
```

File: `packages/worker/scanner-timeout.ts`

## P6.11 Keep scanner parallelism low-cost

The worker clamps requested scanner parallelism to the project target of 2.

Code:

```ts
export function normalizeScannerParallelism(requestedParallelism: number): number {
    return Math.max(1, Math.min(Math.floor(requestedParallelism), DEFAULT_SCANNER_PARALLELISM));
}
```

File: `packages/worker/scanner-timeout.ts`

## P6.12 Enforce deep-lane disabled/default lock behavior

Deep jobs are denied when manual deep scan is disabled, or when another deep job is already active.

Code:

```ts
if (!input.manualDeepScanEnabled) {
    return { admitted: false, reason: "deep_scan_disabled" };
}

if (input.deepInFlightCount > 0) {
    return { admitted: false, reason: "deep_lane_lock_held" };
}
```

File: `packages/queue/lane-admission.ts`

## P6.12a Deny deep-lane admission while fast work exists

Even if deep scans are enabled, deep jobs are denied while fast-lane work is visible or in flight.

Code:

```ts
if (input.fastBacklogCount > 0 || input.fastInFlightCount > 0) {
    return { admitted: false, reason: "fast_lane_priority" };
}
```

File: `packages/queue/lane-admission.ts`

## P6.13 Drop stale fast-lane jobs for older PR SHAs

Before processing, the worker checks GitHub's current PR head SHA. If the queued fast job is for an old SHA, it is superseded and dropped.

Code:

```ts
return {
    fresh: false,
    action: job.lane === "fast" ? "drop_stale_fast" : "drop_stale_deep",
    reason: `superseded_by:${lookup.currentHeadSha}`
};
```

File: `packages/queue/job-freshness.ts`

## P6.14 Drop stale deep-lane jobs

Deep jobs are also dropped when a newer SHA exists, because publishing old optional results would confuse the PR.

Code:

```ts
action: job.lane === "fast" ? "drop_stale_fast" : "drop_stale_deep"
```

File: `packages/queue/job-freshness.ts`

## P6.14a Re-check the current PR head SHA before publishing

The worker receives a `getCurrentHeadSha` function and calls it before processing or publishing.

Code:

```ts
const freshness = decideJobFreshness(message.job, await input.getCurrentHeadSha(message.job));
```

File: `apps/worker/handler.ts`

## P6.14b Treat failed freshness checks as required-path failures when needed

If the fast lane cannot verify the current head SHA after bounded retries, P6 returns `action_required` behavior instead of pretending the required path is safe.

Code:

```ts
if (!lookup.ok) {
    return {
        fresh: false,
        action: job.lane === "fast" ? "publish_action_required" : "drop_stale_deep",
        reason: `freshness_check_failed:${lookup.error}`
    };
}
```

File: `packages/queue/job-freshness.ts`

## P6.15 Throttle manual reruns before work is spent

Manual reruns are checked against a cooldown before scanner work starts.

Code:

```ts
if (elapsedMs < input.cooldownMs) {
    return {
        throttled: true,
        reason: "manual_rerun_cooldown",
        retryAfterMs: input.cooldownMs - elapsedMs
    };
}
```

File: `packages/queue/rerun-throttle.ts`

## P6.16 Enforce deep-scan quota and denial behavior

Deep jobs are denied once the daily deep-scan quota is exhausted.

Code:

```ts
if (input.deepRunsStartedToday >= input.maxDeepRunsPerDay) {
    return { admitted: false, reason: "deep_quota_exhausted" };
}
```

File: `packages/queue/lane-admission.ts`

## P6.17 Publish all findings through one unified annotation path

The worker publisher builds the P5 check-run payload and calls the same P5 publisher. That keeps fast and deep findings on one diff-aware annotation path.

Code:

```ts
const payload = buildCheckRunPayload({
    lane: input.job.lane,
    repositoryFullName: input.job.repositoryFullName,
    prNumber: input.job.prNumber,
    headSha: input.job.headSha,
    findings: input.findings,
    coverage: input.coverage
});
```

File: `packages/worker/review-publisher.ts`

## P6.18 Show local enqueue, worker, DLQ, timeout, throttle, deep-denial, and superseded-job evidence

The integration proof covers the evidence P6 needs locally. Live AWS/GitHub proof is still separate, because this phase has not deployed real SQS or a real worker Lambda yet.

Code:

```ts
export const p6RequiredProofArtifacts = [
    "enqueue_log",
    "worker_log",
    "dlq_record",
    "timeout_coverage",
    "rerun_throttle_decision",
    "deep_lane_denial",
    "superseded_job_decision"
] as const;
```

File: `packages/queue/sqs-concepts.ts`
