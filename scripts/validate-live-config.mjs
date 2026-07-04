import { fileURLToPath } from "node:url";

const requiredLiveEnvKeys = [
  "AWS_REGION",
  "GITHUB_APP_ID",
  "GITHUB_WEBHOOK_SECRET_PARAM",
  "GITHUB_PRIVATE_KEY_PARAM",
  "PRPILOT_RUNTIME_POLICY_PARAM",
  "DYNAMODB_TABLE_NAME",
  "SQS_QUEUE_URL"
];

export function validateLiveConfig(env) {
  const errors = [];
  const warnings = [];

  for (const key of requiredLiveEnvKeys) {
    if (env[key] === undefined || env[key].trim() === "") {
      errors.push(`${key} is required`);
    }
  }

  for (const key of [
    "GITHUB_WEBHOOK_SECRET_PARAM",
    "GITHUB_PRIVATE_KEY_PARAM",
    "PRPILOT_RUNTIME_POLICY_PARAM"
  ]) {
    const value = env[key];
    if (value !== undefined && !value.startsWith("/")) {
      errors.push(`${key} must be an SSM Parameter Store name, not a secret value`);
    }
  }

  if (env.GITHUB_PRIVATE_KEY_PARAM?.includes("BEGIN")) {
    errors.push("GITHUB_PRIVATE_KEY_PARAM appears to contain a private key value");
  }

  if (env.AWS_REGION !== undefined && !/^[a-z]{2}-[a-z]+-\d$/.test(env.AWS_REGION)) {
    errors.push("AWS_REGION must look like an AWS region, for example us-east-1");
  }

  if (env.SQS_QUEUE_URL !== undefined && !env.SQS_QUEUE_URL.startsWith("https://sqs.")) {
    errors.push("SQS_QUEUE_URL must look like an SQS queue URL");
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings
  };
}

// Run only when executed directly (npm run deploy:validate-config), not on import.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = validateLiveConfig(process.env);
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.ok ? 0 : 1);
}
