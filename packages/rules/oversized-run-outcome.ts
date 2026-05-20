import type { Coverage } from "./coverage";
import type { Finding } from "./finding";

export type OversizedRunReason =
    | "changed_file_limit_exceeded"
    | "diff_size_limit_exceeded"
    | "patch_truncated";

export type OversizedRunOutcome = {
    oversized: true;
    conclusion: "action_required";
    reason: OversizedRunReason;
    message: string;
    findings: Finding[];
    coverage: Coverage;
};

export function buildOversizedRunOutcome(reason: OversizedRunReason): OversizedRunOutcome {
    return {
        oversized: true,
        conclusion: "action_required",
        reason,
        message: "PRPilot cannot honestly complete the required fast-lane review because this pull request exceeds the MVP review limits.",
        findings: [],
        coverage: {
            lane: "fast",
            scanner: "internal",
            applicability: "applicable",
            status: "partial_input",
            scope_expected: "complete changed-file and diff input",
            scope_completed: "partial or oversized input only",
            reason: "The pull request is too large or truncated for an honest required-path review.",
            duration_ms: 0,
            budget_ms: 0
        }
    };
}
