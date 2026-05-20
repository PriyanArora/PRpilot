export type ScannerCatalogSnapshotEntry = {
    scanner: string;
    lane: "fast" | "deep";
    trigger: string;
    inputScope: string;
    mode: string;
    enabledByDefault: boolean;
    canBlockMerge: boolean;
};

export const scannerCatalogSnapshot: ScannerCatalogSnapshotEntry[] = [
    {
        scanner: "eslint",
        lane: "fast",
        trigger: "pull_request",
        inputScope: "changed_files",
        mode: "warn",
        enabledByDefault: true,
        canBlockMerge: false
    },
    {
        scanner: "gitleaks",
        lane: "fast",
        trigger: "pull_request",
        inputScope: "diff",
        mode: "block",
        enabledByDefault: true,
        canBlockMerge: true
    },
    {
        scanner: "actionlint",
        lane: "fast",
        trigger: "pull_request",
        inputScope: "workflow_files",
        mode: "block",
        enabledByDefault: true,
        canBlockMerge: true
    },
    {
        scanner: "osv-scanner",
        lane: "deep",
        trigger: "manual",
        inputScope: "repo_manifests",
        mode: "warn",
        enabledByDefault: false,
        canBlockMerge: false
    },
    {
        scanner: "zizmor",
        lane: "deep",
        trigger: "manual",
        inputScope: "repo_workflows",
        mode: "warn",
        enabledByDefault: false,
        canBlockMerge: false
    },
    {
        scanner: "typos",
        lane: "deep",
        trigger: "manual",
        inputScope: "repo_text",
        mode: "warn",
        enabledByDefault: false,
        canBlockMerge: false
    },
    {
        scanner: "markdownlint-cli2",
        lane: "deep",
        trigger: "manual",
        inputScope: "repo_markdown",
        mode: "warn",
        enabledByDefault: false,
        canBlockMerge: false
    }
];
