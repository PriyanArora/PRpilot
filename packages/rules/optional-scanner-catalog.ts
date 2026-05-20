import type { Lane, ScannerMode } from "../config/runtime-policy";

export type OptionalScannerInputScope =
    | "code_patterns"
    | "policy_files"
    | "kubernetes_manifests"
    | "sql_files"
    | "prose_docs"
    | "codebase"
    | "shell_scripts"
    | "yaml_files";

export type OptionalScannerCatalogEntry = {
    scanner:
        | "ast-grep"
        | "Conftest"
        | "KubeLinter"
        | "SQLFluff"
        | "Vale"
        | "Semgrep CE"
        | "ShellCheck"
        | "yamllint";
    lane: Lane;
    inputScope: OptionalScannerInputScope;
    mode: ScannerMode;
    enabledByDefault: boolean;
    canBlockMerge: boolean;
    optInOnly: boolean;
};

const OPTIONAL_SCANNER_DEFAULT_MODE: ScannerMode = "warn";
const OPTIONAL_SCANNER_CAN_BLOCK_MERGE = false;
const OPTIONAL_SCANNER_ENABLED_BY_DEFAULT = false;
const OPTIONAL_SCANNER_OPT_IN_ONLY = true;

export const optionalScannerCatalog: OptionalScannerCatalogEntry[] = [
    {
        scanner: "ast-grep",
        lane: "deep",
        inputScope: "code_patterns",
        mode: OPTIONAL_SCANNER_DEFAULT_MODE,
        enabledByDefault: OPTIONAL_SCANNER_ENABLED_BY_DEFAULT,
        canBlockMerge: OPTIONAL_SCANNER_CAN_BLOCK_MERGE,
        optInOnly: OPTIONAL_SCANNER_OPT_IN_ONLY
    },
    {
        scanner: "Conftest",
        lane: "deep",
        inputScope: "policy_files",
        mode: OPTIONAL_SCANNER_DEFAULT_MODE,
        enabledByDefault: OPTIONAL_SCANNER_ENABLED_BY_DEFAULT,
        canBlockMerge: OPTIONAL_SCANNER_CAN_BLOCK_MERGE,
        optInOnly: OPTIONAL_SCANNER_OPT_IN_ONLY
    },
    {
        scanner: "KubeLinter",
        lane: "deep",
        inputScope: "kubernetes_manifests",
        mode: OPTIONAL_SCANNER_DEFAULT_MODE,
        enabledByDefault: OPTIONAL_SCANNER_ENABLED_BY_DEFAULT,
        canBlockMerge: OPTIONAL_SCANNER_CAN_BLOCK_MERGE,
        optInOnly: OPTIONAL_SCANNER_OPT_IN_ONLY
    },
    {
        scanner: "SQLFluff",
        lane: "deep",
        inputScope: "sql_files",
        mode: OPTIONAL_SCANNER_DEFAULT_MODE,
        enabledByDefault: OPTIONAL_SCANNER_ENABLED_BY_DEFAULT,
        canBlockMerge: OPTIONAL_SCANNER_CAN_BLOCK_MERGE,
        optInOnly: OPTIONAL_SCANNER_OPT_IN_ONLY
    },
    {
        scanner: "Vale",
        lane: "deep",
        inputScope: "prose_docs",
        mode: OPTIONAL_SCANNER_DEFAULT_MODE,
        enabledByDefault: OPTIONAL_SCANNER_ENABLED_BY_DEFAULT,
        canBlockMerge: OPTIONAL_SCANNER_CAN_BLOCK_MERGE,
        optInOnly: OPTIONAL_SCANNER_OPT_IN_ONLY
    },
    {
        scanner: "Semgrep CE",
        lane: "deep",
        inputScope: "codebase",
        mode: OPTIONAL_SCANNER_DEFAULT_MODE,
        enabledByDefault: OPTIONAL_SCANNER_ENABLED_BY_DEFAULT,
        canBlockMerge: OPTIONAL_SCANNER_CAN_BLOCK_MERGE,
        optInOnly: OPTIONAL_SCANNER_OPT_IN_ONLY
    },
    {
        scanner: "ShellCheck",
        lane: "deep",
        inputScope: "shell_scripts",
        mode: OPTIONAL_SCANNER_DEFAULT_MODE,
        enabledByDefault: OPTIONAL_SCANNER_ENABLED_BY_DEFAULT,
        canBlockMerge: OPTIONAL_SCANNER_CAN_BLOCK_MERGE,
        optInOnly: OPTIONAL_SCANNER_OPT_IN_ONLY
    },
    {
        scanner: "yamllint",
        lane: "deep",
        inputScope: "yaml_files",
        mode: OPTIONAL_SCANNER_DEFAULT_MODE,
        enabledByDefault: OPTIONAL_SCANNER_ENABLED_BY_DEFAULT,
        canBlockMerge: OPTIONAL_SCANNER_CAN_BLOCK_MERGE,
        optInOnly: OPTIONAL_SCANNER_OPT_IN_ONLY
    }
];
