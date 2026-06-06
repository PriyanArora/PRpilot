# P15 Self-Hosted Deployment Validation Walkthrough

## Manual Actions Still Needed

P15 is locally implemented and tested. Manual follow-up remains:

- Deploy the CDK stack in the intended AWS account.
- Create the Parameter Store values for webhook secret, GitHub private key, and runtime policy.
- Install the private GitHub App on one selected repository.
- Prove the live webhook endpoint receives GitHub deliveries.
- Prove one end-to-end live PR review.
- Show live selected-repository scope, budget-mode, rollout, deep-lane result or denial, and rollback evidence.

## P15.0 Deployment Boundary Walkthrough

The live deployment path must stay user-owned:

- AWS resources are created through CDK.
- Secrets are stored in Parameter Store, not source code or Lambda environment values.
- The private GitHub App is installed on selected repositories only.
- Rollback should use runtime policy first before redeploying infrastructure.

Files:

- `packages/deployment/deployment-validation.ts`
- `scripts/validate-live-config.mjs`

## P15.1-P15.3 Stack Deploy, Parameter Store, and Webhook Health

`npm run deploy:validate-config` checks that the runtime environment contains required stack outputs and Parameter Store names.

The script validates:

- `AWS_REGION`
- `GITHUB_APP_ID`
- `GITHUB_WEBHOOK_SECRET_PARAM`
- `GITHUB_PRIVATE_KEY_PARAM`
- `PRPILOT_RUNTIME_POLICY_PARAM`
- `DYNAMODB_TABLE_NAME`
- `SQS_QUEUE_URL`

Live deploy and webhook reachability remain manual proof.

## P15.4-P15.8 Installation Scope, Deep Defaults, and Cost Controls

The validation helpers check:

- Selected repository IDs are included in the GitHub App installation.
- Auto deep scans stay disabled for the self-hosted MVP.
- Manual deep scans warn until quota and budget proof exists.
- Annotation caps do not exceed GitHub limits.
- Global run quota is not lower than per-repo quota.
- Emergency mode disables manual deep scans.

## P15.9-P15.12 Live Deep-Lane and Warn-First Rollout

`createWarnFirstRolloutPlan` records the low-risk target repository, scanner pack, warn mode, and rollback trigger before scanner behavior changes.

Applying the rollout and observing live stability remains manual proof.

## P15.13-P15.14 Rollback

`buildRuntimePolicyRollbackPlan` makes Parameter Store runtime policy the first rollback path.

`measureRollbackTiming` records whether rollback completes within the five-minute target.

## P15.15-P15.17 Scanner Pack Promotion

`validateScannerPackPromotion` enforces:

- Pack rollout order: Pack 1, then Pack 2, then Pack 3.
- Warn mode before promotion.
- At least 10 representative runs or 7 observation days.
- Stability evidence.
- Budget evidence.

## P15.18 Live Evidence

The final P15 proof requires live webhook health, live PR evidence, rollout evidence, and budget-mode or selected-repository scope evidence. These items are tracked in `MANUAL_TASKS_CHECKLIST.md`.

## Local Proof

Run:

```bash
npm test -- tests/unit/deployment-validation.test.ts
npm run deploy:validate-config
npm run typecheck
npm run lint
npm test
```
