import type { ScannerMode } from "../config/runtime-policy";

export type GovernanceToolTrigger = "ci" | "scheduled";

export type GovernanceToolCatalogEntry = {
    tool: "OpenSSF Scorecard" | "commitlint" | "Danger JS";
    trigger: GovernanceToolTrigger;
    mode: ScannerMode;
    excludedFromPrWorkerRuntime: true;
    reason: string;
};

export const governanceToolCatalog: GovernanceToolCatalogEntry[] = [
    {
        tool: "OpenSSF Scorecard",
        trigger: "scheduled",
        mode: "warn",
        excludedFromPrWorkerRuntime: true,
        reason: "Repository posture checks are broader than one pull request and belong in scheduled governance."
    },
    {
        tool: "commitlint",
        trigger: "ci",
        mode: "warn",
        excludedFromPrWorkerRuntime: true,
        reason: "Commit message policy belongs in CI and should not consume PR worker runtime."
    },
    {
        tool: "Danger JS",
        trigger: "ci",
        mode: "warn",
        excludedFromPrWorkerRuntime: true,
        reason: "PR automation overlaps with check publishing and should stay outside the default worker path."
    }
];
