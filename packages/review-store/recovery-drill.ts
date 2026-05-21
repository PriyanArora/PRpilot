import { InMemoryReviewStore, type ReviewStoreBackup } from "./in-memory-review-store";

export const p7LowCostRecoveryPlan = {
    chosenPath: "DynamoDB on-demand export when live, local JSON export for the repo proof",
    why: "The MVP stores short-retention operational data, so expensive point-in-time recovery is not required before traffic proves the need.",
    restoreCheck: "Restore the exported records into an empty table copy and query one PR partition before trusting the drill."
} as const;

export type RecoveryDrillResult = {
    strategy: ReviewStoreBackup["strategy"];
    exportedItemCount: number;
    restoredItemCount: number;
    queriedPrRecordCount: number;
    ok: boolean;
};

export function rehearseLocalRecoveryDrill(input: {
    backup: ReviewStoreBackup;
    repositoryId: number;
    prNumber: number;
}): RecoveryDrillResult {
    const restored = InMemoryReviewStore.restoreFromBackup(input.backup);
    const restoredItems = restored.getAllRecords();
    const queriedPrRecords = restored.queryPrRecords({
        repositoryId: input.repositoryId,
        prNumber: input.prNumber
    });

    return {
        strategy: input.backup.strategy,
        exportedItemCount: input.backup.itemCount,
        restoredItemCount: restoredItems.length,
        queriedPrRecordCount: queriedPrRecords.length,
        ok: restoredItems.length === input.backup.itemCount && queriedPrRecords.length > 0
    };
}
