import type { BudgetMode, RuntimePolicy } from "../config/runtime-policy";

export type ValidationReport = {
    ok: boolean;
    errors: string[];
    warnings: string[];
};

export type SelectedRepositoryScopeInput = {
    runtimePolicy: RuntimePolicy;
    installedRepositoryIds: number[];
};

export type DeepScanDefaultInput = {
    runtimePolicy: RuntimePolicy;
};

export type CostControlInput = {
    runtimePolicy: RuntimePolicy;
};

export type RolloutPlan = {
    targetRepositoryId: number;
    targetRepositoryFullName: string;
    scannerPack: ScannerPack;
    mode: "warn";
    rollbackTrigger: string;
};

export type ScannerPack = "pack1" | "pack2" | "pack3";

export type ScannerPackState = {
    pack: ScannerPack;
    state: "disabled" | "warn" | "enforced";
};

export type ScannerPackPromotionInput = {
    pack: ScannerPack;
    states: ScannerPackState[];
    representativeRuns: number;
    observationDays: number;
    stabilityEvidence: boolean;
    budgetEvidence: boolean;
};

export type RollbackPlan = {
    trigger: string;
    firstAction: "set_runtime_policy_to_previous_safe_version";
    fallbackAction: "redeploy_previous_stack_or_disable_scanner_pack";
    expectedControlPlane: "Parameter Store runtime policy";
};

export type RollbackTiming = {
    startedAt: string;
    completedAt: string;
    durationMs: number;
    meetsFiveMinuteTarget: boolean;
};

// Live env validation lives in scripts/validate-live-config.mjs (the executable
// deploy:validate-config path) — one owner, no drift.

export const scannerPackRolloutOrder: ScannerPack[] = ["pack1", "pack2", "pack3"];

export function validateSelectedRepositoryScope(input: SelectedRepositoryScopeInput): ValidationReport {
    const installed = new Set(input.installedRepositoryIds);
    const missing = input.runtimePolicy.selectedRepositoryIds.filter((repositoryId) => !installed.has(repositoryId));
    const errors = missing.map((repositoryId) => (
        `selected repository ${repositoryId} is not installed for this GitHub App`
    ));

    if (input.runtimePolicy.selectedRepositoryIds.length === 0) {
        errors.push("runtime policy must select at least one repository");
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings: []
    };
}

export function validateDeepScanDefaults(input: DeepScanDefaultInput): ValidationReport {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (input.runtimePolicy.autoDeepScanEnabled === true) {
        errors.push("auto deep scan must stay disabled for the self-hosted MVP");
    }

    if (input.runtimePolicy.manualDeepScanEnabled) {
        warnings.push("manual deep scan is enabled; prove quota and budget controls before live use");
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings
    };
}

export function validateCostControls(input: CostControlInput): ValidationReport {
    const errors: string[] = [];

    if (input.runtimePolicy.maxAnnotationsPerRun > 50) {
        errors.push("maxAnnotationsPerRun cannot exceed the GitHub annotation cap of 50");
    }
    if (input.runtimePolicy.maxRunsPerRepoPerDay < 1) {
        errors.push("maxRunsPerRepoPerDay must allow at least one run");
    }
    if (input.runtimePolicy.maxRunsPerDayGlobal < input.runtimePolicy.maxRunsPerRepoPerDay) {
        errors.push("maxRunsPerDayGlobal must be greater than or equal to maxRunsPerRepoPerDay");
    }
    if (input.runtimePolicy.budgetMode === "emergency" && input.runtimePolicy.manualDeepScanEnabled) {
        errors.push("manual deep scans must be disabled in emergency mode");
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings: []
    };
}

export function createWarnFirstRolloutPlan(input: {
    targetRepositoryId: number;
    targetRepositoryFullName: string;
    scannerPack: ScannerPack;
    rollbackTrigger: string;
}): RolloutPlan {
    return {
        targetRepositoryId: input.targetRepositoryId,
        targetRepositoryFullName: input.targetRepositoryFullName,
        scannerPack: input.scannerPack,
        mode: "warn",
        rollbackTrigger: input.rollbackTrigger
    };
}

export function validateScannerPackPromotion(input: ScannerPackPromotionInput): ValidationReport {
    const errors: string[] = [];
    const packIndex = scannerPackRolloutOrder.indexOf(input.pack);

    for (const priorPack of scannerPackRolloutOrder.slice(0, packIndex)) {
        const state = input.states.find((candidate) => candidate.pack === priorPack);
        if (state?.state !== "enforced") {
            errors.push(`${priorPack} must be enforced before promoting ${input.pack}`);
        }
    }

    const targetState = input.states.find((candidate) => candidate.pack === input.pack);
    if (targetState?.state !== "warn") {
        errors.push(`${input.pack} must run in warn mode before promotion`);
    }

    if (input.representativeRuns < 10 && input.observationDays < 7) {
        errors.push("promotion requires at least 10 representative runs or 7 observation days");
    }
    if (!input.stabilityEvidence) {
        errors.push("promotion requires stability evidence");
    }
    if (!input.budgetEvidence) {
        errors.push("promotion requires budget evidence");
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings: []
    };
}

export function buildRuntimePolicyRollbackPlan(trigger: string): RollbackPlan {
    return {
        trigger,
        firstAction: "set_runtime_policy_to_previous_safe_version",
        fallbackAction: "redeploy_previous_stack_or_disable_scanner_pack",
        expectedControlPlane: "Parameter Store runtime policy"
    };
}

export function measureRollbackTiming(startedAt: Date, completedAt: Date): RollbackTiming {
    const durationMs = completedAt.getTime() - startedAt.getTime();

    return {
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
        durationMs,
        meetsFiveMinuteTarget: durationMs <= 300_000
    };
}

export function isBudgetModeSafeForPromotion(mode: BudgetMode): boolean {
    return mode === "normal";
}
