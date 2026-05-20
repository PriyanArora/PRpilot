import type { Lane, ScannerMode } from "../config/runtime-policy";

export type ScannerInputScope =
    | "diff"
    | "changed_files"
    | "workflow_files";

export type ScannerTrigger = "pull_request";

export type FastLaneScannerCatalogEntry = {
    scanner: "eslint" | "gitleaks" | "actionlint";
    lane: Lane;
    trigger: ScannerTrigger;
    inputScope: ScannerInputScope;
    mode: ScannerMode;
    enabledByDefault: boolean;
    canBlockMerge: boolean;
};

export const fastLaneScannerCatalog: FastLaneScannerCatalogEntry[] = [
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
    }
];
