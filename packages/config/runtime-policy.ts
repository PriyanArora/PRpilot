export type BudgetMode = "normal" | "conserve" | "emergency";
export type ScannerMode = "off" | "warn" | "block";
export type Lane = "fast" | "deep";

export type RuntimePolicy = {
    version: number; //to change policy format later safely
    updatedAt: string; //when deployment owner last changed the policy
    budgetMode: BudgetMode; //controls cost behavior
    selectedRepositoryIds: number[]; //repos this PRPilot instance is allowed to review
    fastLaneEnabled: boolean; //required review path on/off
    manualDeepScanEnabled: boolean; //whether users can request optional deep scans
    maxAnnotationsPerRun: number; //cap inline GitHub annotations
    maxRunsPerRepoPerDay: number; //per-repo daily quota
    maxRunsPerDayGlobal: number; //whole-instance daily quota
    maxManualRerunsPerPrPerDay?: number;
    maxDeepScansPerRepoPerDay?: number;
    scannerTimeoutMsCap?: number;
    autoDeepScanEnabled?: boolean;
    autoDeepScanRepositoryIds?: number[];
};

//cache TTL (time to live) - how long the cached policy is allowed to be resued
//using it so every webhook doesnt have to pull the policy everytime, can reuse and if cannot pull a new one after TTL has passed, show failed
//runtime policy load result can be one of the following two shapes
export type RuntimePolicyLoadResult = 
    |{ 
        ok: true; //policy loaded successfully
        policy : RuntimePolicy; //the actual config
        loadedAt: string; //when it was loaded
        cacheTtlSeconds: number; //how long it may be reused
    }|{ 
        ok: false; //loading failed
        error: string; //why it failed
    };


export type RuntimePolicyLoader = {
    loadRuntimePolicy: () => Promise<RuntimePolicyLoadResult>; //function (expected to be async when ill implement it) that takes no param and returns a promise
};
