# P7 Persistence Layer Walkthrough

## Manual Actions Still Needed

The P7 code below is a local DynamoDB-style proof. Before declaring the live P7 gate fully proven, the following manual evidence is still needed:

- Create or deploy the real DynamoDB table with `pk`, `sk`, and TTL enabled on the `ttl` attribute.
- Run the persistence path against a real PR with multiple runs, then show DynamoDB query output for `PK = REPO#<repositoryId>#PR#<prNumber>`.
- Show live counter or deep-lane lock records, including a denied counter increment or held-lock denial.
- Run the chosen low-cost recovery drill against exported live table data or a safe table copy.

## P7.0 Walk through DynamoDB persistence concepts

P7 uses one DynamoDB-style table for short-lived operational state. The important ideas are the single-table model, partition keys, sort keys, TTL, conditional writes, and a low-cost recovery path.

Code:

```ts
export const p7DynamoDbConcepts = {
    singleTableModel: "One DynamoDB table stores delivery, run, attempt, counter, and lock items with typed key prefixes.",
    partitionKey: "The partition key groups records by access pattern, especially all records for one repository pull request.",
    sortKey: "The sort key orders typed records inside a partition, such as RUN before RUN#ATTEMPT records.",
    ttl: "TTL stores an epoch-seconds expiry so DynamoDB can delete short-retention operational records automatically.",
    conditionalWrites: "Conditional writes protect idempotency, quota counters, and deep-lane lock ownership from races.",
    lowCostRecovery: "The MVP recovery path uses on-demand export or a small JSON backup in local proof before paid backup features are needed."
} as const;
```

File: `packages/review-store/p7-dynamodb-concepts.ts`

## P7.1 Lock the MVP to one DynamoDB table

The MVP persistence design uses one table named `PRPilotReviewState`. Every item has `pk`, `sk`, `entityType`, and `ttl`.

Code:

```ts
export const p7SingleTableDesign = {
    tableName: "PRPilotReviewState",
    keyAttributes: ["pk", "sk"],
    recordTypes: ["DELIVERY", "RUN", "ATTEMPT", "COUNTER", "LOCK"],
    ttlAttribute: "ttl",
    primaryPrQuery: "PK = REPO#<repositoryId>#PR#<prNumber>"
} as const;
```

File: `packages/review-store/p7-dynamodb-concepts.ts`

## P7.2 Extend delivery records with audit fields

Delivery records now carry the full audit context needed after webhook ingress: GitHub delivery ID, event, action, trigger, repository, installation, PR number, lane, SHAs, sender, request ID, timestamps, duplicate count, TTL, and transition history.

Code:

```ts
export type DeliveryItem = ReviewStoreBaseItem & {
    entityType: "DELIVERY";
    deliveryId: string;
    state: DeliveryState;
    eventName: string;
    action: string;
    trigger: ReviewJobTrigger;
    repositoryId: number;
    repositoryFullName: string;
    installationId: number;
    prNumber: number;
    lane: Lane;
    headSha: string;
    baseSha: string;
    duplicateCount: number;
    transitionHistory: DeliveryTransition[];
};
```

File: `packages/review-store/persistence-records.ts`

## P7.3 Define the `RUN` item key shape

Run records live under the PR partition and are keyed by lane plus head SHA.

Code:

```ts
export function buildRunSortKey(input: RunIdentityInput): string {
    return `RUN#${input.lane}#${input.headSha}`;
}
```

File: `packages/review-store/persistence-records.ts`

## P7.4 Define the `ATTEMPT` item key shape

Attempt records sit under the same PR partition and under their parent run prefix. The attempt number is padded so records sort correctly.

Code:

```ts
export function buildAttemptSortKey(input: RunIdentityInput & { attemptNumber: number }): string {
    return `${buildRunSortKey(input)}#ATTEMPT#${String(input.attemptNumber).padStart(6, "0")}`;
}
```

File: `packages/review-store/persistence-records.ts`

## P7.5 Define quota `COUNTER` item keys

Counters use their own partitions because quota checks are day-scoped and should not require scanning PR history.

Code:

```ts
export function buildCounterPartitionKey(input: {
    scope: CounterScope;
    day: string;
    repositoryId?: number;
}): string {
    if (input.scope === "repo_day") {
        return `COUNTER#REPO#${input.repositoryId}#DAY#${input.day}`;
    }

    return `COUNTER#${input.scope.toUpperCase()}#DAY#${input.day}`;
}
```

File: `packages/review-store/persistence-records.ts`

## P7.6 Define the deep-lane `LOCK` key

The MVP allows only one active deep-lane job globally. The lock has one stable key.

Code:

```ts
export function buildDeepLaneLockKey(): Pick<LockItem, "pk" | "sk"> {
    return {
        pk: "LOCK#DEEP_LANE",
        sk: "LOCK#GLOBAL"
    };
}
```

File: `packages/review-store/persistence-records.ts`

## P7.7 Add TTL fields to every record type

All persisted records include `ttl` and `retentionDays`, so live DynamoDB can expire records automatically.

Code:

```ts
export type ReviewStoreBaseItem = {
    pk: string;
    sk: string;
    entityType: ReviewStoreRecordKind;
    createdAt: string;
    updatedAt: string;
    ttl: number;
    retentionDays: number;
};
```

File: `packages/review-store/persistence-records.ts`

## P7.8 Persist duplicate-delivery audit records

A repeated GitHub delivery ID does not create duplicate side effects. The original delivery gets a duplicate transition, and a separate duplicate audit record is written.

Code:

```ts
const updatedOriginal: DeliveryItem = {
    ...original,
    duplicateCount: original.duplicateCount + 1,
    lastSeenAt: input.receivedAt,
    updatedAt: input.receivedAt,
    transitionHistory: [
        ...original.transitionHistory,
        {
            state: "DUPLICATE",
            at: input.receivedAt,
            reason: "repeat_github_delivery_id"
        }
    ]
};
```

File: `packages/review-store/in-memory-review-store.ts`

## P7.9 Persist delivery state transitions

Delivery transitions are appended in order, so operators can see how a delivery moved from received to enqueued, processing, published, or failed.

Code:

```ts
transitionHistory: [
    ...delivery.transitionHistory,
    {
        state: input.state,
        at: input.at,
        reason: input.reason
    }
]
```

File: `packages/review-store/in-memory-review-store.ts`

## P7.10 Persist review timing metrics

Run and attempt records store queue latency, attempt duration, worker request IDs, and receive counts.

Code:

```ts
timing: {
    queuedAt: input.job.enqueuedAt,
    startedAt,
    queueLatencyMs: new Date(startedAt).getTime() - new Date(input.job.enqueuedAt).getTime()
}
```

File: `packages/review-store/in-memory-review-store.ts`

## P7.11 Persist final conclusions and coverage metadata

When a run finishes, the store persists status, conclusion, check-run external ID, summary counts, and normalized coverage counts by status.

Code:

```ts
const updated: RunItem = {
    ...existing,
    status: input.status,
    conclusion: input.conclusion,
    checkRunExternalId: input.checkRunExternalId,
    summaryCounts: input.summaryCounts,
    coverageSummary: summarizeCoverage(input.coverage)
};
```

File: `packages/review-store/in-memory-review-store.ts`

## P7.12 Persist limits, denials, and budget mode

Run records keep the operational reasons behind the result, including applied limits, denial reasons, and the budget mode active when the run finished.

Code:

```ts
appliedLimits: input.appliedLimits ?? [],
denialReasons: input.denialReasons ?? [],
budgetMode: input.budgetMode ?? existing.budgetMode
```

File: `packages/review-store/in-memory-review-store.ts`

## P7.13 Implement atomic quota counters

The local store models DynamoDB conditional counter behavior. If the next increment would exceed the limit, it returns `quota_exhausted` and does not mutate the count.

Code:

```ts
if (item.count + input.amount > input.limit) {
    return {
        accepted: false,
        reason: "quota_exhausted",
        item: cloneItem(item)
    };
}
```

File: `packages/review-store/in-memory-review-store.ts`

## P7.14 Implement deep-lane lock acquire, release, and expiry

The lock can be acquired when no current unexpired lock exists. A held lock denies other deep jobs. Release clears ownership, and expiry allows a later acquire.

Code:

```ts
if (existing?.entityType === "LOCK"
    && existing.state === "held"
    && new Date(existing.expiresAt).getTime() > input.now.getTime()) {
    return {
        acquired: false,
        reason: "lock_held",
        item: cloneItem(existing)
    };
}
```

File: `packages/review-store/in-memory-review-store.ts`

## P7.15 Document retention windows

Retention is intentionally short because this is operational state, not product analytics.

Code:

```ts
export const P7_RETENTION_DAYS: RetentionPolicy = {
    DELIVERY: 14,
    RUN: 30,
    ATTEMPT: 14,
    COUNTER: 2,
    LOCK: 1
};
```

File: `packages/review-store/retention-policy.ts`

## P7.16 Enable automatic expiry using TTL

The local proof includes a TTL purge method. In live DynamoDB, the same `ttl` field should be configured as the table TTL attribute.

Code:

```ts
if (item.ttl <= nowEpochSeconds) {
    this.items.delete(key);
    removed += 1;
}
```

File: `packages/review-store/in-memory-review-store.ts`

## P7.17 Choose the low-cost recovery path

The selected recovery path is DynamoDB on-demand export in live AWS, with a local JSON export used for the repository proof.

Code:

```ts
export const p7LowCostRecoveryPlan = {
    chosenPath: "DynamoDB on-demand export when live, local JSON export for the repo proof",
    why: "The MVP stores short-retention operational data, so expensive point-in-time recovery is not required before traffic proves the need.",
    restoreCheck: "Restore the exported records into an empty table copy and query one PR partition before trusting the drill."
} as const;
```

File: `packages/review-store/recovery-drill.ts`

## P7.18 Rehearse one recovery drill

The local recovery drill exports records, restores them into a fresh store, and queries the target PR partition.

Code:

```ts
const restored = InMemoryReviewStore.restoreFromBackup(input.backup);
const queriedPrRecords = restored.queryPrRecords({
    repositoryId: input.repositoryId,
    prNumber: input.prNumber
});
```

File: `packages/review-store/recovery-drill.ts`

## P7.19 Show PR query output with multiple runs and related records

The query helper returns all records under one PR partition. The integration proof creates fast and deep runs, delivery records, and attempt records, then queries them together.

Code:

```ts
queryPrRecords(input: { repositoryId: number; prNumber: number }): ReviewStoreItem[] {
    const pk = buildPrPartitionKey(input);

    return [...this.items.values()]
        .filter((item) => item.pk === pk)
        .sort((left, right) => left.sk.localeCompare(right.sk))
        .map((item) => cloneItem(item));
}
```

File: `packages/review-store/in-memory-review-store.ts`

Local proof:

```bash
npm test -- tests/integration/persistence-layer.test.ts
```
