export const sampleNormalizedFinding = {
    lane: "fast",
    pack: "internal",
    scanner: "internal",
    rule_id: "internal.sensitive-file-change",
    severity: "medium",
    blockability: "block",
    scope_basis: "changed_files",
    path: ".github/workflows/deploy.yml",
    start_line: 1,
    end_line: 1,
    message: "A sensitive file changed",
    fingerprint: "internal.sensitive-file-change:.github/workflows/deploy.yml",
    raw_reference: "sample://internal.sensitive-file-change"
};

export const sampleNormalizedCoverage = {
    lane: "fast",
    scanner: "internal",
    applicability: "applicable",
    status: "completed",
    scope_expected: "changed_files",
    scope_completed: "changed_files",
    reason: "Sample normalized coverage for documentation and contract checks.",
    duration_ms: 0,
    budget_ms: 0
};
