import { describe, expect, it } from "vitest";
import type { ChangedFile } from "../../packages/rules/changed-file";
import type { NormalizedWebhookEvent } from "../../apps/webhook/handler";
import { enqueueReviewJobFromWebhook } from "../../apps/webhook/handler";
import { consumeOneReviewJob } from "../../apps/worker/handler";
import { InMemoryReviewQueue } from "../../packages/queue/review-queue";
import { createSyncCheckRunStore } from "../../packages/checks/sync-check-publisher";
import { createInternalReviewProcessor } from "../../packages/worker/process-review-job";
import { publishReviewJobFindings } from "../../packages/worker/review-publisher";
import { runInternalFastLaneReview } from "../../packages/rules/internal-fast-lane-review";

const NOW = new Date("2026-07-04T12:00:00.000Z");

function event(): NormalizedWebhookEvent {
    return {
        deliveryId: "delivery-1",
        eventName: "pull_request",
        action: "opened",
        repositoryId: 123,
        repositoryFullName: "owner/repo",
        installationId: 456,
        receivedAt: NOW.toISOString(),
        pullRequest: {
            number: 42,
            headSha: "abc123",
            baseSha: "base123",
            headRef: "feature",
            baseRef: "main"
        }
    };
}

async function runPipeline(changedFiles: ChangedFile[]) {
    const queue = new InMemoryReviewQueue();
    const store = createSyncCheckRunStore();

    await enqueueReviewJobFromWebhook({
        event: event(),
        lane: "fast",
        trigger: "pull_request",
        queue,
        now: NOW,
        checkRunStore: store
    });

    const result = await consumeOneReviewJob({
        queue,
        processJob: createInternalReviewProcessor({
            fetchChangedFiles: async () => changedFiles,
            checkRunStore: store
        }),
        now: NOW,
        manualDeepScanEnabled: false,
        deepRunsStartedToday: 0,
        maxDeepRunsPerDay: 1,
        getCurrentHeadSha: async () => ({ ok: true, currentHeadSha: "abc123" })
    });

    return { result, store };
}

describe("internal review pipeline (webhook → queue → worker → check run)", () => {
    it("publishes a completed failing check when a blocking rule fires", async () => {
        const { result, store } = await runPipeline([
            { path: "package.json", status: "modified", additions: 2, deletions: 1 }
        ]);

        expect(result.status).toBe("processed");

        const checkRun = store.get("prpilot:123:42:fast:abc123");
        expect(checkRun).toMatchObject({ status: "completed", conclusion: "failure" });
        // lockfile drift (block) + sensitive dependency manifest (block)
        expect(checkRun?.summary).toContain("Blocking findings (2)");
        expect(checkRun?.summary).toContain("no lockfile was updated");
    });

    it("publishes a success check for an unremarkable change", async () => {
        const { result, store } = await runPipeline([
            { path: "src/app.ts", status: "modified", additions: 10, deletions: 2 }
        ]);

        expect(result.status).toBe("processed");
        if (result.status === "processed") {
            expect(result.processorResult.summary).toBe("success: 0 finding(s) on PR #42");
        }
        expect(store.get("prpilot:123:42:fast:abc123")?.conclusion).toBe("success");
    });

    it("fails closed with action_required when a rule throws", async () => {
        // A malformed changed file (additions undefined) makes large-change produce NaN,
        // not throw — so force a throw via a poisoned array method the rules iterate.
        const poisoned: ChangedFile[] = [
            { path: "src/app.ts", status: "modified", additions: 1, deletions: 1 }
        ];
        const originalSome = poisoned.some.bind(poisoned);
        poisoned.some = () => {
            throw new Error("scanner exploded");
        };

        const review = runInternalFastLaneReview(poisoned);

        expect(review.coverage[0]).toMatchObject({ status: "failed", reason: "scanner exploded" });
        poisoned.some = originalSome;

        const { store } = await runPipelineWithReview(review);
        expect(store.get("prpilot:123:42:fast:abc123")?.conclusion).toBe("action_required");
    });
});

// Publishes a precomputed review through the same worker path, for the fail-closed case.
async function runPipelineWithReview(review: ReturnType<typeof runInternalFastLaneReview>) {
    const queue = new InMemoryReviewQueue();
    const store = createSyncCheckRunStore();

    await enqueueReviewJobFromWebhook({
        event: event(),
        lane: "fast",
        trigger: "pull_request",
        queue,
        now: NOW,
        checkRunStore: store
    });

    await consumeOneReviewJob({
        queue,
        processJob: async (job) => {
            publishReviewJobFindings({
                job,
                findings: review.findings,
                coverage: review.coverage,
                checkRunStore: store,
                annotationCap: 50,
                policyAllowsDeepScan: false
            });
            return { summary: "done" };
        },
        now: NOW,
        manualDeepScanEnabled: false,
        deepRunsStartedToday: 0,
        maxDeepRunsPerDay: 1,
        getCurrentHeadSha: async () => ({ ok: true, currentHeadSha: "abc123" })
    });

    return { store };
}
