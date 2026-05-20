import type { Lane, ScannerMode } from "../config/runtime-policy";

export type DeepScannerInputScope =
    | "repo_manifests"
    | "repo_workflows"
    | "repo_text"
    | "repo_markdown";

export type DeepScannerTrigger = "manual" | "ci";

export type DeepScannerCatalogEntry = {
    scanner: "osv-scanner" | "zizmor" | "typos" | "markdownlint-cli2";
    lane: Lane;
    trigger: DeepScannerTrigger;
    inputScope: DeepScannerInputScope;
    mode: ScannerMode;
    enabledByDefault: boolean;
    canBlockMerge: boolean;
};

const DEEP_LANE_DEFAULT_MODE: ScannerMode = "warn";
const DEEP_LANE_CAN_BLOCK_MERGE = false;

export const deepScannerCatalog: DeepScannerCatalogEntry[] = [
    {
        scanner: "osv-scanner",
        lane: "deep",
        trigger: "manual",
        inputScope: "repo_manifests",
        mode: DEEP_LANE_DEFAULT_MODE,
        enabledByDefault: false,
        canBlockMerge: DEEP_LANE_CAN_BLOCK_MERGE
    },
    {
        scanner: "zizmor",
        lane: "deep",
        trigger: "manual",
        inputScope: "repo_workflows",
        mode: DEEP_LANE_DEFAULT_MODE,
        enabledByDefault: false,
        canBlockMerge: DEEP_LANE_CAN_BLOCK_MERGE
    },
    {
        scanner: "typos",
        lane: "deep",
        trigger: "manual",
        inputScope: "repo_text",
        mode: DEEP_LANE_DEFAULT_MODE,
        enabledByDefault: false,
        canBlockMerge: DEEP_LANE_CAN_BLOCK_MERGE
    },
    {
        scanner: "markdownlint-cli2",
        lane: "deep",
        trigger: "manual",
        inputScope: "repo_markdown",
        mode: DEEP_LANE_DEFAULT_MODE,
        enabledByDefault: false,
        canBlockMerge: DEEP_LANE_CAN_BLOCK_MERGE
    }
];
