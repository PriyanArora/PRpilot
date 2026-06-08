export type BudgetMode = "normal" | "conserve" | "emergency";
export type ScannerMode = "off" | "warn" | "block";
export type Lane = "fast" | "deep";

export type RuntimePolicy = {
    version: number; // policy format version, for safe future migrations
    updatedAt: string; // when the deployment owner last changed the policy
    budgetMode: BudgetMode; // controls cost behavior
    selectedRepositoryIds: number[]; // repos this PRPilot instance may review
    fastLaneEnabled: boolean; // required review path on/off
    manualDeepScanEnabled: boolean; // allow users to request optional deep scans
    maxAnnotationsPerRun: number; // cap on inline GitHub annotations
    maxRunsPerRepoPerDay: number; // per-repo daily quota
    maxRunsPerDayGlobal: number; // whole-instance daily quota
    maxManualRerunsPerPrPerDay?: number;
    maxDeepScansPerRepoPerDay?: number;
    scannerTimeoutMsCap?: number;
    autoDeepScanEnabled?: boolean;
    autoDeepScanRepositoryIds?: number[];
};

// Result of loading the runtime policy. On success it carries a cache TTL so callers can
// reuse the policy instead of fetching it on every webhook, refreshing once the TTL lapses.
export type RuntimePolicyLoadResult =
    | {
        ok: true;
        policy: RuntimePolicy;
        loadedAt: string;
        cacheTtlSeconds: number;
    }
    | {
        ok: false;
        error: string;
    };

export type RuntimePolicyLoader = {
    loadRuntimePolicy: () => Promise<RuntimePolicyLoadResult>;
};
