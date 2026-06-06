# Self-Host Quickstart

## Goal

Run PRPilot as a private GitHub App in a user-owned AWS account with one selected repository.

## Local Proof First

Run:

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run infra:synth
```

## Required Live Inputs

- GitHub App ID.
- GitHub webhook secret stored in Parameter Store.
- GitHub private key stored in Parameter Store.
- Runtime policy JSON stored in Parameter Store.
- One selected repository ID.
- AWS region.

## Deploy Shape

The CDK stack creates API Gateway, webhook Lambda, worker Lambda, SQS queue, DLQ, DynamoDB table, log groups, and alarms.

## First Live Check

Deploy the stack, copy the `WebhookUrl` output into the GitHub App webhook settings, then open a test PR in the selected repository.
