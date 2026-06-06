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
