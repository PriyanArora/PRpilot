# Setup Automation Ideas

These ideas are for later phases. Do not implement them early unless the active phase asks for setup, deployment, or docs work.

## Goal
Make PRPilot easier for a self-hosting user to install, configure, deploy, validate, and operate without hiding security-critical decisions.

## Suggested Automation Layers

### 1. Local Setup Check
Add a local setup command later, such as `npm run setup:local`.

It can verify:
- Node and npm versions
- dependencies are installed
- required local environment keys exist
- `npm run typecheck` passes
- tests can run

This is safe early because it does not touch cloud resources or secrets.

### 2. Guided Config Generator
Add an interactive setup command later, such as `npm run init`.

It can ask for:
- GitHub App ID
- AWS region
- selected repository IDs
- budget mode
- annotation cap
- quota limits

It should not write secrets into the repo.

### 3. CDK Deploy Command
In the infrastructure phase, CDK should create the core AWS resources.

Target command shape:
- `npm run deploy`

Expected resources:
- Lambda webhook handler
- worker Lambda
- API Gateway webhook URL
- SQS queue
- dead-letter queue
- DynamoDB table
- IAM roles
- Parameter Store names
- CloudWatch logs and alarms

This is the highest-value setup automation.

### 4. GitHub App Setup Guide
Full GitHub App creation may stay manual, but the docs should make it precise.

Include:
- exact permission matrix
- exact webhook event list
- webhook secret instructions
- private key instructions
- selected-repository installation guidance
- CDK output showing the webhook URL to paste into GitHub

Later validation can check whether the app config appears usable.

### 5. Parameter Store Helper
Add a helper command later, such as `npm run configure:aws`.

It can write:
- GitHub webhook secret
- GitHub App private key
- runtime policy JSON
- selected repository IDs
- budget and quota settings

Secrets must go to Parameter Store or another secure AWS secret path, not committed files.

### 6. Doctor Command
Add a validation command later, such as `npm run doctor`.

It can verify:
- AWS credentials work
- Parameter Store values exist
- runtime policy is valid
- deployed webhook URL exists
- SQS and DynamoDB resources exist
- GitHub App ID is configured
- required environment references are present

This should be the main troubleshooting tool for self-hosted users.

## Practical Phase Order
- P12: CDK deploy automation
- P15: live setup validation and doctor checks
- P16: quickstart docs and setup guide
- P17: CI/CD automation

## Preferred User Experience
The long-term setup should feel like:

```bash
npm run setup:local
npm run init
npm run deploy
npm run configure:aws
npm run doctor
```

GitHub App creation and installation may remain a guided manual step because it requires owner-level choices and secret handling.
