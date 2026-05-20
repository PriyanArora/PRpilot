export type GitHubCheckUiContract = {
    lane: "fast" | "deep";
    checkName: string;
    requiredForMerge: boolean;
    summarySections: string[];
    inlineAnnotationPolicy: string;
    availableActions: string[];
};

export const githubCheckUiContracts: GitHubCheckUiContract[] = [
    {
        lane: "fast",
        checkName: "PRPilot Fast",
        requiredForMerge: true,
        summarySections: [
            "verdict",
            "blocking_findings",
            "advisory_findings",
            "coverage_table",
            "applied_limits",
            "deep_scan_availability"
        ],
        inlineAnnotationPolicy: "changed_lines_only",
        availableActions: ["run_deep_scan"]
    },
    {
        lane: "deep",
        checkName: "PRPilot Deep",
        requiredForMerge: false,
        summarySections: [
            "advisory_verdict",
            "coverage_notes",
            "denials",
            "repo_wide_findings",
            "stale_result_notes"
        ],
        inlineAnnotationPolicy: "changed_lines_only_summary_for_repo_wide",
        availableActions: ["rerun_deep_scan"]
    }
];
