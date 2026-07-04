# Operations Runbook

## Webhook Errors

Check signature validation, GitHub delivery headers, selected repository scope, Parameter Store access, and SQS handoff.

## Worker Errors

Check scanner failure coverage, queue retry count, GitHub check publishing, and current PR head SHA.

## DLQ Messages

Inspect one DLQ message at a time. Confirm the PR head SHA is still current before replay.

## Throttling

Keep worker concurrency low by design. Deny optional deep scans first if backlog grows.

## Budget Mode

Change runtime policy in Parameter Store. Prefer runtime policy rollback before infrastructure rollback.

Shedding order when budget tightens: deny optional deep-lane work, reduce presentation volume, then report required-path gaps as `action_required`.

## Alarms

| Alarm | Metric | Threshold | Action |
|---|---|---|---|
| DlqHasMessages | SQS ApproximateNumberOfMessagesVisible | ≥ 1 for 5 min | Inspect the DLQ record; replay only after confirming the PR head SHA is current |
| WebhookFunctionErrors | Lambda Errors | ≥ 1 for 5 min | Check signature, selected-repo scope, Parameter Store access, queue handoff |
| WorkerFunctionErrors | Lambda Errors | ≥ 1 for 5 min | Check scanner failure coverage, queue retry count, GitHub publishing logs |
| WorkerFunctionThrottles | Lambda Throttles | ≥ 1 for 5 min | Confirm reserved concurrency is intentional; move to conserve if backlog grows |
| ReviewQueueAge | SQS ApproximateAgeOfOldestMessage | ≥ 300 s | Prioritize fast-lane backlog, deny optional deep work, inspect stuck attempts |
| BudgetModeTransition | budget/quota signal | ≥ 80% conserve, ≥ 100% emergency | Deny deep scans first, then reduce presentation volume |
| latency_p95 | webhook-to-check latency | p95 > 120 s | Check queue backlog, scanner runtime, GitHub publish latency, budget mode |

Observability stays free-tier: 7-day log retention, `PRPilot` metric namespace, at most 3 dimensions per metric (lane, scanner, status, budgetMode, pack only — repository, PR, SHA, and delivery IDs belong in logs, enforced by `validateMetricCardinality`).

Logs Insights starting query:

```
fields @timestamp, message, deliveryId, repositoryFullName, prNumber, lane, headSha, runStatus, budgetMode
| filter service = "prpilot"
| sort @timestamp desc
| limit 50
```

## Failure Scenarios

- **Scanner timeout:** publish honest timeout coverage; fast lane becomes `action_required`, deep lane stays advisory.
- **Scanner failure:** publish failed coverage, keep the raw scanner error out of annotations, inspect worker logs.
- **Oversized run:** stop expensive work and publish the oversized-run outcome with the configured changed-file cap.
- **Unsupported repo:** publish unsupported-repo coverage; don't spend scanner runtime.
- **Quota exhaustion:** deny optional work first, then report required-path gaps honestly if the fast lane cannot run.
- **Partial coverage:** separate completed scope from missing scope; `action_required` only for required-path gaps.
- **GitHub failed delivery:** use GitHub's failed-delivery redelivery after verifying webhook secret and endpoint health.

## License Boundaries

AGPL/GPL tools stay disabled by default: never link, import, vendor, or modify their code in the PRPilot runtime. Optional use requires owner approval and isolated process execution.
