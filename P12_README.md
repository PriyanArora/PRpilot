# P12 Infrastructure as Code Walkthrough

## Manual Actions Still Needed

P12 is locally implemented and ready to synthesize. Manual follow-up remains:

- Run `npm run infra:synth` and `cdk diff` with the intended AWS account and region.
- Import or replace any previously created AWS resources so the live path is under CDK control.
- Deploy the stack and verify the API Gateway webhook URL, DynamoDB table, SQS queue, DLQ, Lambda concurrency, and log retention in AWS.
- Confirm Lambda environment variables contain Parameter Store names, not secret values.

## P12.0 Service and Cost Boundary Walkthrough

The CDK stack defines the minimum AWS services needed for the current PRPilot shape:

- API Gateway receives the GitHub webhook.
- Webhook Lambda validates and accepts ingress before handing work to SQS.
- SQS buffers review jobs and sends failed jobs to a DLQ.
- Worker Lambda processes one queued job at a time.
- DynamoDB stores delivery, run, attempt, quota, lock, and retention records.
- Parameter Store names are passed as environment values so secret contents stay outside CloudFormation.
- CloudWatch alarms cover errors, throttles, queue age, and DLQ depth.

The stack uses pay-per-request DynamoDB, low Lambda memory, reserved concurrency, seven-day Lambda log retention, and no paid observability products.

## P12.1 CDK App Entry Point

The CDK app entry point is:

```bash
npm run infra:synth
```

Files:

- `cdk.json`
- `infra/app.mjs`
- `package.json`

## P12.2-P12.5 Lambda, API Gateway, SQS, and Worker Mapping

The stack defines:

- `WebhookFunction` with reserved concurrency `2`.
- `WorkerFunction` with reserved concurrency `1`.
- API Gateway `POST /webhooks/github`.
- Review SQS queue.
- Review DLQ with `maxReceiveCount: 3`.
- Lambda SQS event source mapping with `batchSize: 1`.

File: `infra/app.mjs`

## P12.6 DynamoDB Table and TTL

The table uses:

- Partition key `pk`.
- Sort key `sk`.
- Pay-per-request billing.
- TTL attribute `ttl`.
- Retain-on-delete removal policy to avoid accidental data loss.

File: `infra/app.mjs`

## P12.7 Minimum IAM Permissions

The stack grants:

- Webhook Lambda read/write access to the review table.
- Worker Lambda read/write access to the review table.
- Webhook Lambda send access to the review queue.
- Worker Lambda consume access to the review queue.
- Parameter Store read access only for the parameter names each function needs.

File: `infra/app.mjs`

## P12.8-P12.10 Alarms, Concurrency, and Log Retention

The minimal alarm set covers:

- DLQ visible messages.
- Webhook Lambda errors.
- Worker Lambda errors.
- Worker throttles.
- Queue oldest-message age.

Both Lambda functions set seven-day log retention. Reserved concurrency is encoded directly in the functions.

## P12.11-P12.13 Runtime Config and One Live Environment

The stack uses one required live environment, `prod`, and exposes CloudFormation parameters for:

- GitHub App ID.
- GitHub webhook secret parameter name.
- GitHub private-key parameter name.
- Runtime-policy parameter name.
- Budget mode.
- Fast-lane scanner timeout cap.
- Changed-file cap.
- Annotation cap.

Additional environments are optional future work and should not be created until the single live path is stable.

## P12.14-P12.16 Manual AWS Proof

These tasks require a real AWS account:

- Bring any already-created AWS resources under CDK control.
- Run `cdk diff` against the target account and region.
- Review the diff before deployment.

They are tracked in `MANUAL_TASKS_CHECKLIST.md`.

## P12.17 Stack Outputs

The stack outputs:

- `WebhookUrl`
- `ReviewStateTableName`
- `ReviewQueueUrl`
- `ReviewJobsDlqUrl`

These are the values needed to wire the GitHub App webhook and runtime config after deployment.

## Local Proof

Run:

```bash
npm run infra:synth
npm run typecheck
npm run lint
npm test
```
