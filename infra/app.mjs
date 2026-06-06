import {
  App,
  CfnOutput,
  CfnParameter,
  Duration,
  RemovalPolicy,
  Stack,
  aws_apigateway as apigateway,
  aws_cloudwatch as cloudwatch,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
  aws_lambda_event_sources as eventSources,
  aws_logs as logs,
  aws_ssm as ssm,
  aws_sqs as sqs
} from "aws-cdk-lib";

const lambdaRuntime = lambda.Runtime.NODEJS_20_X;
const environmentName = "prod";

const webhookInlineCode = `
exports.handler = async (event) => {
  console.log(JSON.stringify({
    message: "PRPilot webhook placeholder invoked",
    deliveryId: event.headers?.["x-github-delivery"] ?? event.headers?.["X-GitHub-Delivery"] ?? "unknown"
  }));

  return {
    statusCode: 202,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accepted: true })
  };
};
`;

const workerInlineCode = `
exports.handler = async (event) => {
  console.log(JSON.stringify({
    message: "PRPilot worker placeholder invoked",
    recordCount: event.Records?.length ?? 0
  }));

  return { batchItemFailures: [] };
};
`;

class PRPilotStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const githubAppId = new CfnParameter(this, "GithubAppId", {
      type: "String",
      description: "GitHub App ID. This is not secret."
    });

    const githubWebhookSecretParam = new CfnParameter(this, "GithubWebhookSecretParam", {
      type: "String",
      default: "/prpilot/prod/github/webhook-secret",
      description: "SSM Parameter Store name for the GitHub webhook secret."
    });

    const githubPrivateKeyParam = new CfnParameter(this, "GithubPrivateKeyParam", {
      type: "String",
      default: "/prpilot/prod/github/private-key",
      description: "SSM Parameter Store name for the GitHub App private key."
    });

    const runtimePolicyParam = new CfnParameter(this, "RuntimePolicyParam", {
      type: "String",
      default: "/prpilot/prod/runtime-policy",
      description: "SSM Parameter Store name for deployment-owner runtime policy JSON."
    });

    const defaultBudgetMode = new CfnParameter(this, "DefaultBudgetMode", {
      type: "String",
      default: "normal",
      allowedValues: ["normal", "conserve", "emergency"],
      description: "Default runtime budget mode before owner policy overrides are loaded."
    });

    const maxFastLaneScannerSeconds = new CfnParameter(this, "MaxFastLaneScannerSeconds", {
      type: "Number",
      default: 60,
      minValue: 1,
      maxValue: 300,
      description: "Hard cap for fast-lane scanner runtime."
    });

    const maxChangedFiles = new CfnParameter(this, "MaxChangedFiles", {
      type: "Number",
      default: 200,
      minValue: 1,
      maxValue: 1000,
      description: "Changed-file cap before the run must report an honest oversized outcome."
    });

    const maxAnnotations = new CfnParameter(this, "MaxAnnotations", {
      type: "Number",
      default: 50,
      minValue: 1,
      maxValue: 50,
      description: "GitHub inline annotation cap for a single check run."
    });

    const commonEnvironment = {
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
      ENVIRONMENT_NAME: environmentName,
      GITHUB_APP_ID: githubAppId.valueAsString,
      GITHUB_WEBHOOK_SECRET_PARAM: githubWebhookSecretParam.valueAsString,
      GITHUB_PRIVATE_KEY_PARAM: githubPrivateKeyParam.valueAsString,
      PRPILOT_RUNTIME_POLICY_PARAM: runtimePolicyParam.valueAsString,
      PRPILOT_BUDGET_MODE: defaultBudgetMode.valueAsString,
      PRPILOT_MAX_FAST_LANE_SCANNER_SECONDS: maxFastLaneScannerSeconds.valueAsString,
      PRPILOT_MAX_CHANGED_FILES: maxChangedFiles.valueAsString,
      PRPILOT_MAX_ANNOTATIONS: maxAnnotations.valueAsString,
      PRPILOT_POLICY_CACHE_TTL_SECONDS: "60",
      PRPILOT_SECRET_CACHE_TTL_SECONDS: "300",
      LOG_LEVEL: "info"
    };

    const table = new dynamodb.Table(this, "ReviewStateTable", {
      tableName: `prpilot-${environmentName}-review-state`,
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "ttl",
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: false
      },
      removalPolicy: RemovalPolicy.RETAIN
    });

    const deadLetterQueue = new sqs.Queue(this, "ReviewJobsDeadLetterQueue", {
      queueName: `prpilot-${environmentName}-review-jobs-dlq`,
      retentionPeriod: Duration.days(14)
    });

    const reviewQueue = new sqs.Queue(this, "ReviewJobsQueue", {
      queueName: `prpilot-${environmentName}-review-jobs`,
      visibilityTimeout: Duration.seconds(90),
      retentionPeriod: Duration.days(4),
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 3
      }
    });

    const webhookLogGroup = new logs.LogGroup(this, "WebhookLogGroup", {
      logGroupName: `/aws/lambda/prpilot-${environmentName}-webhook`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const workerLogGroup = new logs.LogGroup(this, "WorkerLogGroup", {
      logGroupName: `/aws/lambda/prpilot-${environmentName}-worker`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const webhookFunction = new lambda.Function(this, "WebhookFunction", {
      functionName: `prpilot-${environmentName}-webhook`,
      runtime: lambdaRuntime,
      handler: "index.handler",
      code: lambda.Code.fromInline(webhookInlineCode),
      timeout: Duration.seconds(10),
      memorySize: 256,
      reservedConcurrentExecutions: 2,
      logGroup: webhookLogGroup,
      environment: {
        ...commonEnvironment,
        DYNAMODB_TABLE_NAME: table.tableName,
        SQS_QUEUE_URL: reviewQueue.queueUrl
      }
    });

    const workerFunction = new lambda.Function(this, "WorkerFunction", {
      functionName: `prpilot-${environmentName}-worker`,
      runtime: lambdaRuntime,
      handler: "index.handler",
      code: lambda.Code.fromInline(workerInlineCode),
      timeout: Duration.seconds(60),
      memorySize: 512,
      reservedConcurrentExecutions: 1,
      logGroup: workerLogGroup,
      environment: {
        ...commonEnvironment,
        DYNAMODB_TABLE_NAME: table.tableName,
        SQS_QUEUE_URL: reviewQueue.queueUrl
      }
    });

    workerFunction.addEventSource(new eventSources.SqsEventSource(reviewQueue, {
      batchSize: 1,
      reportBatchItemFailures: true
    }));

    table.grantReadWriteData(webhookFunction);
    table.grantReadWriteData(workerFunction);
    reviewQueue.grantSendMessages(webhookFunction);
    reviewQueue.grantConsumeMessages(workerFunction);

    const webhookSecret = ssm.StringParameter.fromSecureStringParameterAttributes(this, "WebhookSecretParameter", {
      parameterName: githubWebhookSecretParam.valueAsString,
      simpleName: false
    });
    const privateKey = ssm.StringParameter.fromSecureStringParameterAttributes(this, "GithubPrivateKeyParameter", {
      parameterName: githubPrivateKeyParam.valueAsString,
      simpleName: false
    });
    const runtimePolicy = ssm.StringParameter.fromStringParameterAttributes(this, "RuntimePolicyParameter", {
      parameterName: runtimePolicyParam.valueAsString,
      simpleName: false
    });

    webhookSecret.grantRead(webhookFunction);
    runtimePolicy.grantRead(webhookFunction);
    privateKey.grantRead(workerFunction);
    runtimePolicy.grantRead(workerFunction);

    const api = new apigateway.RestApi(this, "WebhookApi", {
      restApiName: `prpilot-${environmentName}-webhook-api`,
      deployOptions: {
        stageName: environmentName,
        metricsEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.ERROR,
        dataTraceEnabled: false
      }
    });

    api.root
      .addResource("webhooks")
      .addResource("github")
      .addMethod("POST", new apigateway.LambdaIntegration(webhookFunction));

    new cloudwatch.Alarm(this, "DlqHasMessagesAlarm", {
      alarmDescription: "PRPilot review jobs reached the DLQ and need manual inspection.",
      metric: deadLetterQueue.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(5)
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
    });

    new cloudwatch.Alarm(this, "WebhookFunctionErrorsAlarm", {
      alarmDescription: "Webhook Lambda is returning errors.",
      metric: webhookFunction.metricErrors({
        period: Duration.minutes(5)
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
    });

    new cloudwatch.Alarm(this, "WorkerFunctionErrorsAlarm", {
      alarmDescription: "Worker Lambda is returning errors.",
      metric: workerFunction.metricErrors({
        period: Duration.minutes(5)
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
    });

    new cloudwatch.Alarm(this, "WorkerFunctionThrottlesAlarm", {
      alarmDescription: "Worker Lambda throttling may delay required PR checks.",
      metric: workerFunction.metricThrottles({
        period: Duration.minutes(5)
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
    });

    new cloudwatch.Alarm(this, "ReviewQueueAgeAlarm", {
      alarmDescription: "Old review jobs indicate worker backlog or stuck processing.",
      metric: reviewQueue.metricApproximateAgeOfOldestMessage({
        period: Duration.minutes(5)
      }),
      threshold: 300,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD
    });

    new CfnOutput(this, "WebhookUrl", {
      value: api.urlForPath("/webhooks/github"),
      description: "GitHub App webhook URL."
    });
    new CfnOutput(this, "ReviewStateTableName", {
      value: table.tableName,
      description: "DynamoDB table for PRPilot review state."
    });
    new CfnOutput(this, "ReviewQueueUrl", {
      value: reviewQueue.queueUrl,
      description: "SQS queue URL for review jobs."
    });
    new CfnOutput(this, "ReviewJobsDlqUrl", {
      value: deadLetterQueue.queueUrl,
      description: "SQS DLQ URL for failed review jobs."
    });
  }
}

const app = new App();
new PRPilotStack(app, "PRPilotStack", {
  description: "Self-hosted PRPilot infrastructure for one low-cost GitHub App environment."
});
