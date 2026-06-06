# P13 Reliability Hardening Walkthrough

## Manual Actions Still Needed

P13 is locally implemented and tested. Manual follow-up remains:

- Run repeated-delivery and burst checks against the deployed AWS/GitHub path.
- Show live evidence that duplicate deliveries do not create duplicate check runs or queue side effects.
- Force or simulate live alarm states for failures, DLQ depth, throttling, queue age, and budget-mode transitions.
- Practice one GitHub failed-delivery redelivery from the GitHub UI.
- Confirm deployment-owner approval before enabling any optional AGPL or GPL scanner.

## P13.1-P13.2 Repeated Delivery and Idempotency

The local P6 tests already prove duplicate delivery handling and durable queue behavior before side effects. P13 keeps that contract and adds burst-level checks around queue admission and processing order.

Files:

- `packages/queue/reliability-hardening.ts`
- `tests/integration/reliability-hardening.test.ts`

## P13.3-P13.4 Retry and Visibility Timeout

`buildBoundedRetryPolicy` derives a queue visibility timeout from the scanner timeout cap, enforces a minimum visibility timeout, and caps receive count to bound retry cost.

File: `packages/queue/reliability-hardening.ts`

## P13.5 Alarm Plan

`reliabilityAlarmPlan` defines the alarm names, metrics, thresholds, and operator actions for:

- DLQ messages.
- Webhook errors.
- Worker errors.
- Worker throttles.
- Queue oldest-message age.
- Budget-mode transition signals.

P12 encodes the AWS-side alarms for the concrete stack. P13 adds the operational action mapping.

## P13.6-P13.8 Synthetic Burst and Concurrency

`simulateSyntheticBurst` proves fast-lane jobs are processed before optional deep-lane jobs. `validateLowConcurrencySettings` keeps the MVP worker at reserved concurrency `1` and SQS batch size `1`.

## P13.9-P13.11 Budget Modes and Deep Denial

`decideBudgetModeFromQuota` maps quota and failure signals to:

- `normal`
- `conserve`
- `emergency`

`decideBudgetShedding` applies the phase rule:

1. Deny optional deep-lane work.
2. Reduce presentation volume.
3. Report required-path gaps as `action_required` when the fast lane cannot stay honest.

Dollar-based budget response is handled through AWS Budgets alarms or direct deployment-owner runtime-policy intervention. Local code models the runtime-policy result; live AWS Budget proof remains manual.

## P13.12-P13.18 Runbook Mappings

`reliabilityRunbookSteps` maps these outcomes to operator actions:

- Scanner timeout.
- Scanner failure.
- Oversized run.
- Unsupported repo.
- Quota exhaustion.
- Partial coverage.
- GitHub failed delivery.

## P13.19-P13.20 GitHub Failed-Delivery Redelivery

The runbook mapping now documents when to use GitHub failed-delivery redelivery. Practicing it requires a live GitHub App delivery and is tracked in `MANUAL_TASKS_CHECKLIST.md`.

## P13.21 License Boundaries

`cautiousLicenseBoundaries` keeps AGPL and GPL tools disabled by default. Optional use requires deployment-owner approval and isolated process execution without linking, importing, vendoring, or modifying the tool code in the PRPilot runtime.

## Local Proof

Run:

```bash
npm test -- tests/integration/reliability-hardening.test.ts
npm run typecheck
npm run lint
npm test
```
