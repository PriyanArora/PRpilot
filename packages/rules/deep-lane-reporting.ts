export type DeepLaneReportCase = {
    caseId: string;
    outcome: "neutral";
    summaryOnly: boolean;
    reason: string;
};

export const deepLaneReportingRules: DeepLaneReportCase[] = [
    {
        caseId: "partial_coverage",
        outcome: "neutral",
        summaryOnly: true,
        reason: "Deep-lane scanners may report partial coverage, but the missing coverage must be disclosed in the summary."
    },
    {
        caseId: "denied_by_policy",
        outcome: "neutral",
        summaryOnly: true,
        reason: "A denied deep scan stays advisory and must be reported in the summary without affecting the fast-lane result."
    },
    {
        caseId: "denied_by_quota",
        outcome: "neutral",
        summaryOnly: true,
        reason: "Deep-lane quota denial stays advisory and must be reported in the summary."
    },
    {
        caseId: "repo_wide_summary_only_finding",
        outcome: "neutral",
        summaryOnly: true,
        reason: "Repo-wide deep findings that are not tied to changed lines belong in the summary, not inline annotations."
    }
];
