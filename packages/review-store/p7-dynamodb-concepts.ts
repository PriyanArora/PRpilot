export const p7DynamoDbConcepts = {
    singleTableModel: "One DynamoDB table stores delivery, run, attempt, counter, and lock items with typed key prefixes.",
    partitionKey: "The partition key groups records by access pattern, especially all records for one repository pull request.",
    sortKey: "The sort key orders typed records inside a partition, such as RUN before RUN#ATTEMPT records.",
    ttl: "TTL stores an epoch-seconds expiry so DynamoDB can delete short-retention operational records automatically.",
    conditionalWrites: "Conditional writes protect idempotency, quota counters, and deep-lane lock ownership from races.",
    lowCostRecovery: "The MVP recovery path uses on-demand export or a small JSON backup in local proof before paid backup features are needed."
} as const;

export const p7SingleTableDesign = {
    tableName: "PRPilotReviewState",
    keyAttributes: ["pk", "sk"],
    recordTypes: ["DELIVERY", "RUN", "ATTEMPT", "COUNTER", "LOCK"],
    ttlAttribute: "ttl",
    primaryPrQuery: "PK = REPO#<repositoryId>#PR#<prNumber>",
    deliveryDedupeIndex: "deliveryId is conditionally indexed by the store so repeated GitHub deliveries cannot create duplicate side effects."
} as const;

export const p7RequiredProofArtifacts = [
    "single_table_record_keys",
    "delivery_audit_transitions",
    "run_and_attempt_records",
    "quota_counter_condition",
    "deep_lane_lock_condition",
    "ttl_purge",
    "recovery_drill",
    "pr_query_output"
] as const;
