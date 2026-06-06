# CI Free-Tier Plan

## Default PR Path

The PR workflow runs one validation job:

- `npm ci`
- lint
- typecheck
- tests
- latency guard
- scanner drift guard
- deterministic required-path guard
- CDK synth

This keeps deploy work out of pull requests.

## Deploy Path

Deploy is manual through `workflow_dispatch`. It runs validation first, then assumes AWS credentials through GitHub OIDC. Static AWS access keys are not required.

## Limit Response

If GitHub Actions minutes become a constraint, move deployment to a self-hosted runner first. Keep PR validation small and deterministic.
