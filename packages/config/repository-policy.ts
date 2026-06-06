import type { ChangedFile } from "../rules/changed-file";
import { deepScannerCatalog } from "../rules/deep-scanner-catalog";
import { fastLaneScannerCatalog } from "../rules/fast-lane-scanner-catalog";
import type { Lane, RuntimePolicy } from "./runtime-policy";

export type DraftBehavior = "skip_until_ready" | "advisory_only";
export type RepositoryScannerMode = "block" | "warn" | "report_only";
export type ScannerRolloutState = "enforced" | "warn_first";

export type RepositoryPolicy = {
    version: number;
    review?: {
        include_paths?: string[];
        ignore_paths?: string[];
        draft_behavior?: DraftBehavior;
        large_change_threshold_lines?: number;
    };
    scanners?: Record<string, {
        enabled?: boolean;
        mode?: RepositoryScannerMode;
        timeout_ms?: number;
        lane?: Lane;
        warn_first?: boolean;
    }>;
    deep?: {
        manual_enabled?: boolean;
        auto_on_pull_request?: boolean;
    };
    quotas?: {
        manual_deep_scans_per_day?: number;
        manual_fast_reruns_per_pr_per_day?: number;
        max_fast_runs_per_repo_per_day?: number;
    };
};

export type RepositoryPolicyParseResult =
    | { ok: true; policy: RepositoryPolicy | null }
    | { ok: false; errors: string[] };

export type RuntimePolicyValidationResult =
    | { ok: true; policy: RuntimePolicy }
    | { ok: false; errors: string[] };

export type EffectiveScannerPolicy = {
    scanner: string;
    enabled: boolean;
    mode: RepositoryScannerMode;
    lane: Lane;
    timeoutMs: number;
    rollout: ScannerRolloutState;
};

export type EffectiveRepositoryPolicy = {
    ownerPolicy: RuntimePolicy;
    repositoryPolicy: RepositoryPolicy | null;
    draftBehavior: DraftBehavior;
    includePaths: string[];
    ignorePaths: string[];
    largeChangeThresholdLines: number;
    deepManualEnabled: boolean;
    deepAutoOnPullRequest: boolean;
    quotas: {
        manualDeepScansPerDay: number;
        manualFastRerunsPerPrPerDay: number;
        maxFastRunsPerRepoPerDay: number;
    };
    scanners: Record<string, EffectiveScannerPolicy>;
};

export type RepositoryPolicyResolutionResult =
    | { ok: true; effectivePolicy: EffectiveRepositoryPolicy }
    | { ok: false; errors: string[] };

const DEFAULT_LARGE_CHANGE_THRESHOLD_LINES = 200;
const DEFAULT_SCANNER_TIMEOUT_MS = 1000;
const DEFAULT_MANUAL_FAST_RERUNS_PER_PR_PER_DAY = 2;
const DEFAULT_DEEP_SCANS_PER_REPO_PER_DAY = 1;

const DRAFT_BEHAVIORS = ["skip_until_ready", "advisory_only"] as const;
const SCANNER_MODES = ["block", "warn", "report_only"] as const;
const LANES = ["fast", "deep"] as const;
const BUDGET_MODES = ["normal", "conserve", "emergency"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function parseScalar(value: string): unknown {
    const trimmed = value.trim();
    if (trimmed === "true") {
        return true;
    }
    if (trimmed === "false") {
        return false;
    }
    if (/^-?\d+$/.test(trimmed)) {
        return Number(trimmed);
    }
    if ((trimmed.startsWith("\"") && trimmed.endsWith("\""))
        || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        const body = trimmed.slice(1, -1).trim();
        if (body === "") {
            return [];
        }
        return body.split(",").map((part) => parseScalar(part));
    }
    return trimmed;
}

function parseYamlSubset(content: string): unknown {
    const root: Record<string, unknown> = {};
    const stack: Array<{ indent: number; value: Record<string, unknown> }> = [
        { indent: -1, value: root }
    ];

    for (const rawLine of content.split(/\r?\n/)) {
        const withoutComment = rawLine.replace(/\s+#.*$/, "");
        if (withoutComment.trim() === "" || withoutComment.trim().startsWith("#")) {
            continue;
        }

        const indent = withoutComment.match(/^ */)?.[0].length ?? 0;
        const trimmed = withoutComment.trim();
        const separatorIndex = trimmed.indexOf(":");
        if (separatorIndex === -1) {
            throw new Error(`Invalid repository policy line: ${trimmed}`);
        }

        const key = trimmed.slice(0, separatorIndex).trim();
        const valueText = trimmed.slice(separatorIndex + 1).trim();
        while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
            stack.pop();
        }

        const parent = stack[stack.length - 1].value;
        if (valueText === "") {
            const nested: Record<string, unknown> = {};
            parent[key] = nested;
            stack.push({ indent, value: nested });
        } else {
            parent[key] = parseScalar(valueText);
        }
    }

    return root;
}

export function parseRepositoryPolicyConfig(content: string | undefined): RepositoryPolicyParseResult {
    if (content === undefined || content.trim() === "") {
        return { ok: true, policy: null };
    }

    try {
        const parsed = content.trim().startsWith("{")
            ? JSON.parse(content) as unknown
            : parseYamlSubset(content);
        return validateRepositoryPolicy(parsed);
    } catch (error) {
        return {
            ok: false,
            errors: [error instanceof Error ? error.message : "Invalid repository policy"]
        };
    }
}

export function validateRuntimePolicy(policy: unknown): RuntimePolicyValidationResult {
    const errors: string[] = [];
    if (!isRecord(policy)) {
        return { ok: false, errors: ["Runtime policy must be an object"] };
    }

    if (!isPositiveInteger(policy.version)) {
        errors.push("Runtime policy version must be a positive integer");
    }
    if (typeof policy.updatedAt !== "string") {
        errors.push("Runtime policy updatedAt must be a string");
    }
    if (!BUDGET_MODES.includes(policy.budgetMode as never)) {
        errors.push("Runtime policy budgetMode must be normal, conserve, or emergency");
    }
    if (!Array.isArray(policy.selectedRepositoryIds) || policy.selectedRepositoryIds.length === 0
        || !policy.selectedRepositoryIds.every(isPositiveInteger)) {
        errors.push("Runtime policy selectedRepositoryIds must be a non-empty number array");
    }
    for (const key of ["fastLaneEnabled", "manualDeepScanEnabled"] as const) {
        if (typeof policy[key] !== "boolean") {
            errors.push(`Runtime policy ${key} must be boolean`);
        }
    }
    for (const key of ["maxAnnotationsPerRun", "maxRunsPerRepoPerDay", "maxRunsPerDayGlobal"] as const) {
        if (!isPositiveInteger(policy[key])) {
            errors.push(`Runtime policy ${key} must be a positive integer`);
        }
    }
    if (policy.autoDeepScanRepositoryIds !== undefined
        && (!Array.isArray(policy.autoDeepScanRepositoryIds)
            || !policy.autoDeepScanRepositoryIds.every(isPositiveInteger))) {
        errors.push("Runtime policy autoDeepScanRepositoryIds must be a number array");
    }

    return errors.length === 0
        ? { ok: true, policy: policy as RuntimePolicy }
        : { ok: false, errors };
}

function validateStringArray(value: unknown, fieldName: string, errors: string[]): string[] | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
        errors.push(`${fieldName} must be a string array`);
        return undefined;
    }
    return value;
}

export function validateRepositoryPolicy(value: unknown): RepositoryPolicyParseResult {
    const errors: string[] = [];
    if (!isRecord(value)) {
        return { ok: false, errors: ["Repository policy must be an object"] };
    }

    if (!isPositiveInteger(value.version)) {
        errors.push("Repository policy version must be a positive integer");
    }

    const review = value.review;
    if (review !== undefined) {
        if (!isRecord(review)) {
            errors.push("review must be an object");
        } else {
            validateStringArray(review.include_paths, "review.include_paths", errors);
            validateStringArray(review.ignore_paths, "review.ignore_paths", errors);
            if (review.draft_behavior !== undefined && !DRAFT_BEHAVIORS.includes(review.draft_behavior as never)) {
                errors.push("review.draft_behavior must be skip_until_ready or advisory_only");
            }
            if (review.large_change_threshold_lines !== undefined && !isPositiveInteger(review.large_change_threshold_lines)) {
                errors.push("review.large_change_threshold_lines must be a positive integer");
            }
        }
    }

    const scanners = value.scanners;
    if (scanners !== undefined) {
        if (!isRecord(scanners)) {
            errors.push("scanners must be an object");
        } else {
            for (const [scanner, config] of Object.entries(scanners)) {
                if (!isRecord(config)) {
                    errors.push(`scanners.${scanner} must be an object`);
                    continue;
                }
                if (config.enabled !== undefined && typeof config.enabled !== "boolean") {
                    errors.push(`scanners.${scanner}.enabled must be boolean`);
                }
                if (config.mode !== undefined && !SCANNER_MODES.includes(config.mode as never)) {
                    errors.push(`scanners.${scanner}.mode must be block, warn, or report_only`);
                }
                if (config.timeout_ms !== undefined && !isPositiveInteger(config.timeout_ms)) {
                    errors.push(`scanners.${scanner}.timeout_ms must be a positive integer`);
                }
                if (config.lane !== undefined && !LANES.includes(config.lane as never)) {
                    errors.push(`scanners.${scanner}.lane must be fast or deep`);
                }
                if (config.warn_first !== undefined && typeof config.warn_first !== "boolean") {
                    errors.push(`scanners.${scanner}.warn_first must be boolean`);
                }
            }
        }
    }

    const deep = value.deep;
    if (deep !== undefined && !isRecord(deep)) {
        errors.push("deep must be an object");
    }
    const quotas = value.quotas;
    if (quotas !== undefined) {
        if (!isRecord(quotas)) {
            errors.push("quotas must be an object");
        } else {
            for (const key of [
                "manual_deep_scans_per_day",
                "manual_fast_reruns_per_pr_per_day",
                "max_fast_runs_per_repo_per_day"
            ]) {
                if (quotas[key] !== undefined && !isPositiveInteger(quotas[key])) {
                    errors.push(`quotas.${key} must be a positive integer`);
                }
            }
        }
    }

    return errors.length === 0
        ? { ok: true, policy: value as RepositoryPolicy }
        : { ok: false, errors };
}

function matchesPathPattern(path: string, pattern: string): boolean {
    if (pattern.endsWith("/**")) {
        return path.startsWith(pattern.slice(0, -3));
    }
    if (!pattern.includes("*")) {
        return path === pattern;
    }
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`).test(path);
}

export function filterChangedFilesByRepositoryPolicy(
    changedFiles: ChangedFile[],
    policy: Pick<EffectiveRepositoryPolicy, "includePaths" | "ignorePaths">
): ChangedFile[] {
    return changedFiles.filter((file) => {
        const included = policy.includePaths.length === 0
            || policy.includePaths.some((pattern) => matchesPathPattern(file.path, pattern));
        const ignored = policy.ignorePaths.some((pattern) => matchesPathPattern(file.path, pattern));
        return included && !ignored;
    });
}

function defaultScanners(): Record<string, EffectiveScannerPolicy> {
    const scanners: Record<string, EffectiveScannerPolicy> = {};
    for (const entry of [...fastLaneScannerCatalog, ...deepScannerCatalog]) {
        scanners[entry.scanner] = {
            scanner: entry.scanner,
            enabled: entry.enabledByDefault,
            mode: entry.mode === "off" ? "report_only" : entry.mode,
            lane: entry.lane,
            timeoutMs: DEFAULT_SCANNER_TIMEOUT_MS,
            rollout: "enforced"
        };
    }
    return scanners;
}

export function resolveRepositoryPolicy(input: {
    ownerPolicy: RuntimePolicy;
    repositoryId: number;
    repositoryPolicy: RepositoryPolicy | null;
}): RepositoryPolicyResolutionResult {
    const ownerValidation = validateRuntimePolicy(input.ownerPolicy);
    if (!ownerValidation.ok) {
        return ownerValidation;
    }

    const errors: string[] = [];
    const repositoryPolicy = input.repositoryPolicy;
    const includePaths = repositoryPolicy?.review?.include_paths ?? [];
    const ignorePaths = repositoryPolicy?.review?.ignore_paths ?? [];
    const scanners = defaultScanners();

    for (const [scanner, config] of Object.entries(repositoryPolicy?.scanners ?? {})) {
        const existing = scanners[scanner] ?? {
            scanner,
            enabled: false,
            mode: "report_only" as const,
            lane: "deep" as const,
            timeoutMs: DEFAULT_SCANNER_TIMEOUT_MS,
            rollout: "enforced" as const
        };

        const requestedLane = config.lane ?? existing.lane;
        if (existing.lane === "deep" && requestedLane === "fast") {
            errors.push(`scanners.${scanner}.lane cannot promote a deep scanner into the required fast lane`);
        }
        if (existing.lane === "fast" && existing.mode === "block" && requestedLane === "deep") {
            errors.push(`scanners.${scanner}.lane cannot move a blocking fast scanner out of the required fast lane`);
        }
        if (requestedLane === "deep" && !input.ownerPolicy.manualDeepScanEnabled) {
            errors.push(`scanners.${scanner}.lane cannot use deep lane when owner deep scans are disabled`);
        }

        const requestedTimeout = config.timeout_ms ?? existing.timeoutMs;
        const timeoutCap = input.ownerPolicy.scannerTimeoutMsCap ?? existing.timeoutMs;
        if (requestedTimeout > timeoutCap) {
            errors.push(`scanners.${scanner}.timeout_ms cannot exceed owner timeout cap`);
        }

        const requestedMode = config.mode ?? existing.mode;
        if (requestedLane === "deep" && requestedMode === "block") {
            errors.push(`scanners.${scanner}.mode cannot block merge in the deep lane`);
        }

        scanners[scanner] = {
            ...existing,
            enabled: config.enabled ?? existing.enabled,
            mode: config.warn_first === true && requestedMode === "block" ? "warn" : requestedMode,
            lane: requestedLane,
            timeoutMs: Math.min(requestedTimeout, timeoutCap),
            rollout: config.warn_first === true ? "warn_first" : "enforced"
        };
    }

    const ownerDeepQuota = input.ownerPolicy.maxDeepScansPerRepoPerDay ?? DEFAULT_DEEP_SCANS_PER_REPO_PER_DAY;
    const repoDeepQuota = repositoryPolicy?.quotas?.manual_deep_scans_per_day ?? ownerDeepQuota;
    if (repoDeepQuota > ownerDeepQuota) {
        errors.push("quotas.manual_deep_scans_per_day cannot exceed owner cap");
    }

    const ownerRerunQuota = input.ownerPolicy.maxManualRerunsPerPrPerDay ?? DEFAULT_MANUAL_FAST_RERUNS_PER_PR_PER_DAY;
    const repoRerunQuota = repositoryPolicy?.quotas?.manual_fast_reruns_per_pr_per_day ?? ownerRerunQuota;
    if (repoRerunQuota > ownerRerunQuota) {
        errors.push("quotas.manual_fast_reruns_per_pr_per_day cannot exceed owner cap");
    }

    const repoFastQuota = repositoryPolicy?.quotas?.max_fast_runs_per_repo_per_day ?? input.ownerPolicy.maxRunsPerRepoPerDay;
    if (repoFastQuota > input.ownerPolicy.maxRunsPerRepoPerDay) {
        errors.push("quotas.max_fast_runs_per_repo_per_day cannot exceed owner cap");
    }

    const autoDeepRequested = repositoryPolicy?.deep?.auto_on_pull_request === true;
    const autoDeepAllowed = input.ownerPolicy.autoDeepScanEnabled === true
        && (input.ownerPolicy.autoDeepScanRepositoryIds ?? []).includes(input.repositoryId);
    if (autoDeepRequested && !autoDeepAllowed) {
        errors.push("deep.auto_on_pull_request requires owner auto-deep allowlist");
    }

    if (errors.length > 0) {
        return { ok: false, errors };
    }

    return {
        ok: true,
        effectivePolicy: {
            ownerPolicy: input.ownerPolicy,
            repositoryPolicy,
            draftBehavior: repositoryPolicy?.review?.draft_behavior ?? "skip_until_ready",
            includePaths,
            ignorePaths,
            largeChangeThresholdLines: repositoryPolicy?.review?.large_change_threshold_lines
                ?? DEFAULT_LARGE_CHANGE_THRESHOLD_LINES,
            deepManualEnabled: input.ownerPolicy.manualDeepScanEnabled
                && repositoryPolicy?.deep?.manual_enabled !== false,
            deepAutoOnPullRequest: autoDeepRequested && autoDeepAllowed,
            quotas: {
                manualDeepScansPerDay: Math.min(repoDeepQuota, ownerDeepQuota),
                manualFastRerunsPerPrPerDay: Math.min(repoRerunQuota, ownerRerunQuota),
                maxFastRunsPerRepoPerDay: Math.min(repoFastQuota, input.ownerPolicy.maxRunsPerRepoPerDay)
            },
            scanners
        }
    };
}
