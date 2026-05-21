//check if p5 pripilot will even work, i.e once it has findings and coverage can it correctly build and publish a github check result
export const p5SynchronousProofScope = {
    proofMode: "synchronous_local_caller",
    queueWiringPhase: "P6",
    purpose: "Prove the reusable check publisher before SQS worker invocation exists."
} as const;

/**
"create_or_update_check_for_head_sha", - Publish the result for the exact commit currently in the PR.
"resolve_conclusion", - Decide whether GitHub should show success, failure, action_required, or neutral.
"rank_dedupe_and_cap_annotations", - Decide which inline comments appear on changed lines, remove duplicates, and avoid flooding the PR.
"build_summary_sections", - Build the text shown inside the GitHub check summary.
"expose_rerun_or_deep_scan_actions_when_allowed" - Show buttons like “Run deep scan” only if the current result is honest and policy allows it.
 */
export const githubChecksLifecycle = [
    "create_or_update_check_for_head_sha",
    "resolve_conclusion",
    "rank_dedupe_and_cap_annotations",
    "build_summary_sections",
    "expose_rerun_or_deep_scan_actions_when_allowed"
] as const;

