import type { Coverage } from "./coverage";
import type { Finding } from "./finding";

export type SupportedRepoOutcome = {
    supported: true;
};

export type UnsupportedRepoOutcome = {
    supported: false;
    conclusion: "action_required";
    reason: "missing_supported_repo_files";
    message: string;
    findings: Finding[];
    coverage: Coverage;
};

export type RepositorySupportOutcome =
    | SupportedRepoOutcome
    | UnsupportedRepoOutcome;

export function buildSupportedRepoOutcome(): SupportedRepoOutcome {
    return {
        supported: true
    };
}

export function buildUnsupportedRepoOutcome(): UnsupportedRepoOutcome {
    return {
        supported: false,
        conclusion: "action_required",
        reason: "missing_supported_repo_files",
        message: "PRPilot supports MVP JavaScript or TypeScript repositories with root package.json and package-lock.json. This repository is missing one or both required files.",
        findings: [],
        coverage: {
            lane: "fast",
            scanner: "internal",
            applicability: "not_applicable",
            status: "not_applicable",
            scope_expected: "root package.json and package-lock.json",
            scope_completed: "repository support check",
            reason: "Repository is outside the MVP supported repo contract.",
            duration_ms: 0,
            budget_ms: 0
        }
    };
}
