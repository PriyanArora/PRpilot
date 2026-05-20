export type ExcludedRuntimeToolCatalogEntry = {
    tool: "TruffleHog" | "Syft" | "Grype";
    excludedFromDefaultRuntime: true;
    reason: string;
    reconsiderationPath: "explicit_later_justification";
};

export const excludedRuntimeToolCatalog: ExcludedRuntimeToolCatalogEntry[] = [
    {
        tool: "TruffleHog",
        excludedFromDefaultRuntime: true,
        reason: "Secret scanning is already covered by gitleaks in the fast lane; TruffleHog is heavier and needs explicit justification before runtime use.",
        reconsiderationPath: "explicit_later_justification"
    },
    {
        tool: "Syft",
        excludedFromDefaultRuntime: true,
        reason: "SBOM generation is broader than the MVP pull-request worker path and should stay outside default runtime unless supply-chain inventory becomes an explicit requirement.",
        reconsiderationPath: "explicit_later_justification"
    },
    {
        tool: "Grype",
        excludedFromDefaultRuntime: true,
        reason: "Vulnerability scanning from SBOMs is heavier than the default PR path and should stay out of runtime unless a later phase justifies the cost and scope.",
        reconsiderationPath: "explicit_later_justification"
    }
];
