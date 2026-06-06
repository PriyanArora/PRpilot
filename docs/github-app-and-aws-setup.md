# GitHub App and AWS Setup

## GitHub App

Use a private GitHub App with least privilege:

- Repository metadata: read.
- Contents: read.
- Pull requests: read.
- Checks: write.

Allowed events:

- `pull_request`
- `check_suite`
- `check_run`
- `installation`
- `installation_repositories`

Install the app on selected repositories only.

## AWS

Use CDK for API Gateway, Lambda, SQS, DynamoDB, IAM, log groups, and alarms.

Secrets stay in Parameter Store. Lambda environment values should contain Parameter Store names, not secret contents.
