# P14 Free-Tier-Safe Observability and Performance Walkthrough

## Manual Actions Still Needed

P14 is locally implemented and tested. Manual follow-up remains:

- Capture live webhook-to-check latency values from deployed runs.
- Show a CloudWatch Logs Insights query or console view using the structured fields.
- Confirm live CloudWatch metric volume stays within the intended free-tier-safe plan.
- Confirm alarm thresholds are acceptable for the deployed traffic pattern.

## P14.0 Observability Boundary Walkthrough

The observability plan keeps high-cardinality values in logs and low-cardinality values in metrics.

Logs may include delivery ID, repository ID, repository name, PR number, and head SHA because logs are searched when investigating one event.

Metrics must avoid those values. Metrics use bounded dimensions such as lane, scanner, status, budget mode, decision, and pack.

File: `packages/observability/free-tier-observability.ts`

## P14.1 Structured Logs

`buildStructuredReviewLog` creates a stable JSON shape with:

- Delivery ID.
- Repository ID and full name.
- PR number.
- Lane.
- Head SHA.
- Run status.
- Budget mode.

`serializeStructuredReviewLog` emits the JSON string for Lambda logs.

## P14.2 Low-Cardinality Metrics

The metric helpers collect:

- Scanner runtime.
- Scanner finding volume.
- Lane admission and denial counts.
- Coverage gap counts.
- Pack-level budget usage.

`validateMetricCardinality` rejects metrics that include repository, PR, SHA, or delivery dimensions.

## P14.3, P14.7, and P14.8 Alarm Thresholds

`observabilityAlarmThresholds` maps each threshold to an operator action for:

- Error count.
- Throttle count.
- Queue depth.
- Latency p95.
- Budget mode.

P12 defines the concrete AWS alarms for the stack; P14 defines the operational thresholds and actions.

## P14.4-P14.6 Latency Baseline and Improvement Tracking

`calculateLatencyStats` records p50 and p95. `compareLatencySamples` compares baseline and after-change samples and reports p50 and p95 improvement.

Live latency evidence still needs deployed webhook-to-check timestamps and is tracked in `MANUAL_TASKS_CHECKLIST.md`.

## P14.9-P14.12 Scanner, Lane, and Pack Metrics

`collectScannerMetrics` emits per-scanner runtime and finding-volume metrics.

`collectLaneMetrics` emits lane-admission, lane-denial, and coverage-gap metrics separately for fast and deep lanes.

`collectPackBudgetMetrics` emits budget-used percentages for Pack 1 and deep-lane runs.

## P14.13 Free-Tier Safety

`freeTierObservabilityPlan` sets:

- Seven-day log retention.
- `PRPilot` metric namespace.
- Maximum three metric dimensions.
- No paid observability product requirement.

## P14.14 Log Query

`cloudWatchLogsInsightsQuery` is ready for CloudWatch Logs Insights:

```sql
fields @timestamp, message, deliveryId, repositoryFullName, prNumber, lane, headSha, runStatus, budgetMode
filter service = "prpilot"
sort @timestamp desc
limit 50
```

Showing this query against live logs remains a manual task.

## Local Proof

Run:

```bash
npm test -- tests/unit/free-tier-observability.test.ts
npm run typecheck
npm run lint
npm test
```
