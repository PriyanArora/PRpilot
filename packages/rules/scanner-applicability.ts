export type ScannerApplicabilityScope =
    | "diff_only"
    | "changed_file_only"
    | "repo_context";

export type ScannerApplicabilityRule = {
    scanner: string;
    applicabilityScope: ScannerApplicabilityScope;
    allowedInFastLane: boolean;
    reason: string;
};

export const scannerApplicabilityRules: ScannerApplicabilityRule[] = [
    {
        scanner: "internal.large-change",
        applicabilityScope: "changed_file_only",
        allowedInFastLane: true,
        reason: "The rule only needs changed-file metadata such as path, additions, and deletions."
    },
    {
        scanner: "internal.sensitive-file-change",
        applicabilityScope: "changed_file_only",
        allowedInFastLane: true,
        reason: "The rule only needs changed-file paths and rename metadata."
    },
    {
        scanner: "internal.lockfile-drift",
        applicabilityScope: "changed_file_only",
        allowedInFastLane: true,
        reason: "The rule only needs to know whether package.json and package-lock.json changed."
    },
    {
        scanner: "gitleaks",
        applicabilityScope: "diff_only",
        allowedInFastLane: true,
        reason: "Secret detection can run against diff content in the required fast lane."
    },
    {
        scanner: "eslint",
        applicabilityScope: "changed_file_only",
        allowedInFastLane: true,
        reason: "The MVP ESLint path checks changed JS/TS files using PRPilot-owned baseline config."
    },
    {
        scanner: "actionlint",
        applicabilityScope: "changed_file_only",
        allowedInFastLane: true,
        reason: "Workflow checks apply to changed GitHub Actions workflow files."
    },
    {
        scanner: "osv-scanner",
        applicabilityScope: "repo_context",
        allowedInFastLane: false,
        reason: "Dependency vulnerability scanning needs broader manifest or lockfile context and stays deep or CI."
    },
    {
        scanner: "zizmor",
        applicabilityScope: "repo_context",
        allowedInFastLane: false,
        reason: "Repository-wide workflow security scanning belongs in the deep lane or CI."
    },
    {
        scanner: "typos",
        applicabilityScope: "repo_context",
        allowedInFastLane: false,
        reason: "Repo-wide text scanning is advisory and belongs in deep or CI."
    },
    {
        scanner: "markdownlint-cli2",
        applicabilityScope: "repo_context",
        allowedInFastLane: false,
        reason: "Repo-wide Markdown linting is advisory and belongs in deep or CI."
    }
];
