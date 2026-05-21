export const p6QueueConcepts = {
    sqs: "SQS is the durable waiting room for review jobs after webhook ingress accepts them.",
    durableHandoff: "The webhook can acknowledge GitHub only after the review job is safely written to the queue.",
    visibilityTimeout: "A received message becomes hidden for a short window while one worker owns the attempt.",
    retries: "A failed message becomes visible again until the retry policy sends it to the DLQ.",
    deadLetterQueue: "The DLQ stores messages that exceeded retry limits so an operator can inspect or replay them."
} as const;

export const p6QueueLifecycle = [
    "webhook_builds_review_job",
    "webhook_sends_job_to_durable_queue",
    "webhook_acknowledges_after_queue_send",
    "worker_receives_visible_job",
    "worker_checks_lane_admission_and_head_sha_freshness",
    "worker_processes_or_retries_job",
    "failed_job_moves_to_dlq_after_retry_limit",
    "operator_inspects_or_replays_dlq_message"
] as const;

export const p6RequiredProofArtifacts = [
    "enqueue_log",
    "worker_log",
    "dlq_record",
    "timeout_coverage",
    "rerun_throttle_decision",
    "deep_lane_denial",
    "superseded_job_decision"
] as const;
