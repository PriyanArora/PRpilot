export type FastLanePartialCoverageCase = {
    caseId: string;
    allowed: boolean;
    outcome: "summary_only" | "action_required";
    reason: string;
};

export const fastLanePartialCoverageRules: FastLanePartialCoverageCase[] = [
    {
        caseId: "annotation_cap_exceeded",
        allowed: true,
        outcome: "summary_only",
        reason: "Required scanners still completed honestly; only inline presentation was reduced."
    },
    {
        caseId: "summary_detail_reduced",
        allowed: true,
        outcome: "summary_only",
        reason: "Required scanners still completed honestly; only non-essential detail was reduced."
    },
    {
        caseId: "scanner_timed_out",
        allowed: false,
        outcome: "action_required",
        reason: "An applicable fast-lane scanner did not complete, so required-path coverage is incomplete."
    },
    {
        caseId: "scanner_failed",
        allowed: false,
        outcome: "action_required",
        reason: "An applicable fast-lane scanner failed, so PRPilot cannot claim an honest required review."
    },
    {
        caseId: "scanner_denied_by_limit",
        allowed: false,
        outcome: "action_required",
        reason: "A required scanner was not allowed to run, so required-path coverage is missing."
    },
    {
        caseId: "partial_input",
        allowed: false,
        outcome: "action_required",
        reason: "The fast lane did not receive complete changed-file or diff input."
    }
];
