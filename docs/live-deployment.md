# Live Deployment

## AWS Expectations

Use one AWS account and one required environment named `prod`.

The stack expects Parameter Store names for:

- `/prpilot/prod/github/webhook-secret`
- `/prpilot/prod/github/private-key`
- `/prpilot/prod/runtime-policy`

## Validate Config

Run with deployed outputs and Parameter Store names:

```bash
npm run deploy:validate-config
```

## Deploy

Run `npm run infra:synth`, review `cdk diff`, then deploy through CDK after confirming the diff only contains expected PRPilot resources.

## Outputs

Record:

- `WebhookUrl`
- `ReviewStateTableName`
- `ReviewQueueUrl`
- `ReviewJobsDlqUrl`
