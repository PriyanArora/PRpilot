# P17 CI/CD Walkthrough

## Manual Actions Still Needed

P17 is locally implemented and tested. Manual follow-up remains:

- Configure repository variables `AWS_ROLE_TO_ASSUME` and `AWS_REGION`.
- Create the AWS IAM role trusted by GitHub OIDC.
- Run one passing and one failing PR workflow.
- Run one OIDC-based deploy workflow.
- Show each guard failing intentionally in a controlled branch or copied run.
- Confirm GitHub Actions usage stays within free limits or move deploy to a self-hosted runner.

## P17.0 CI/CD Boundary Walkthrough

The PR workflow is cheap and deterministic. It does not deploy.

The deploy workflow is manual, validates first, and uses GitHub OIDC to assume an AWS role. Static AWS keys are not required.

## P17.1-P17.6 Pull Request Workflow

`.github/workflows/pr.yml` runs:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run ci:latency`
- `npm run ci:scanner-drift`
- `npm run ci:deterministic`
- `npm run infra:synth`

## P17.7-P17.8 Deploy Workflow and OIDC

`.github/workflows/deploy.yml` is manual through `workflow_dispatch`.

Deploy waits for validation with `needs: validate`, then uses `aws-actions/configure-aws-credentials` with `id-token: write` and `role-to-assume`.

## P17.9-P17.10 Latency Guard

`ci/latency-baseline.json` stores the baseline and tolerance.

`scripts/check-latency-baseline.mjs` compares current p50 and p95 values against the baseline plus tolerance.

## P17.11-P17.12 Scanner Drift Guard

`ci/scanner-policy-baseline.json` stores the enforced scanner catalog baseline.

`scripts/check-scanner-policy-drift.mjs` compares it to `packages/rules/scanner-catalog-snapshot.ts`.

## P17.13 Deterministic Required-Path Guard

`scripts/check-required-path-deterministic.mjs` checks required-path source files for AI dependency markers and `Math.random`.

## P17.14-P17.15 Free-Tier Job Boundaries

`ci/free-tier-plan.md` documents the default PR path, manual deploy path, and response if GitHub Actions minutes become a constraint.

## P17.16 Live Workflow Proof

Live passing/failing workflow runs and OIDC deploy evidence remain manual and are tracked in `MANUAL_TASKS_CHECKLIST.md`.

## Local Proof

Run:

```bash
npm run ci:latency
npm run ci:scanner-drift
npm run ci:deterministic
npm test -- tests/unit/ci-readiness.test.ts
npm run typecheck
npm run lint
npm test
```
