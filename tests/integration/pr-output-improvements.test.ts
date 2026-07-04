import { describe, expect, it } from "vitest";
import type { Coverage } from "../../packages/rules/coverage";
import type { Finding, FindingSeverity } from "../../packages/rules/finding";
import { prepareAnnotations } from "../../packages/checks/check-run-annotations";
import { buildCheckRunPayload } from "../../packages/checks/check-run-payload-builder";
import {
    createSyncCheckRunStore,
    publishCheckRunSync,
    publishQueuedCheckRun
} from "../../packages/checks/sync-check-publisher";
import { enqueueReviewJobFromWebhook } from "../../apps/webhook/handler";
import type { NormalizedWebhookEvent } from "../../apps/webhook/handler";
import type {
    DurableReviewQueue,
    ReviewQueueSendResult
} from "../../packages/queue/review-queue";

function finding(overrides: Partial<Finding> = {}): Finding {
    const path = overrides.path ?? "src/file.ts";
    const startLine = overrides.start_line ?? 1;

    return {
        lane: "fast",
        pack: "internal",
        scanner: "internal",
        rule_id: "internal.large-change",
        severity: "medium",
        blockability: "block",
        scope_basis: "changed_files",
        path,
        start_line: startLine,
        end_line: overrides.end_line ?? startLine,
        message: "A finding",
        fingerprint: `fp:${path}:${startLine}`,
        ...overrides
    };
}

function coverage(overrides: Partial<Coverage> = {}): Coverage {
    return {
        lane: "fast",
        scanner: "internal",
        applicability: "applicable",
        status: "completed",
        scope_expected: "changed_files",
        scope_completed: "changed_files",
        duration_ms: 1,
        budget_ms: 1000,
        ...overrides
    };
}

// A: severity must decide ordering before scanner/path, so the cap keeps the worst.
describe("annotation ranking by severity", () => {
    it("keeps a higher-severity finding over a lower one when the cap truncates", () => {
        const low = finding({
            severity: "low",
            path: "a-first-alphabetically.ts",
            fingerprint: "low"
        });
        const critical = finding({
            severity: "critical",
            path: "z-last-alphabetically.ts",
            fingerprint: "critical"
        });

        const prepared = prepareAnnotations([low, critical], 1);

        expect(prepared.inlineAnnotations).toHaveLength(1);
        expect(prepared.inlineAnnotations[0]?.fingerprint).toBe("critical");
        expect(prepared.overflowAnnotations[0]?.fingerprint).toBe("low");
    });
});

// B: annotations carry title and raw_details when available; raw_details omitted otherwise.
describe("annotation enrichment", () => {
    it("adds a scanner:rule_id title and raw_details from raw_reference", () => {
        const prepared = prepareAnnotations([
            finding({ scanner: "gitleaks", rule_id: "aws-key", raw_reference: "ref://x" })
        ], 10);

        expect(prepared.inlineAnnotations[0]?.title).toBe("gitleaks: aws-key");
        expect(prepared.inlineAnnotations[0]?.raw_details).toBe("ref://x");
    });

    it("omits raw_details when the finding has no raw_reference", () => {
        const prepared = prepareAnnotations([finding()], 10);

        expect(prepared.inlineAnnotations[0]?.raw_details).toBeUndefined();
    });
});

// C: summary renders the sections the UI contract promises and spills overflow.
describe("rich markdown summary", () => {
    function publishWithFindings(findings: Finding[], coverageRecords: Coverage[], cap: number) {
        return publishCheckRunSync(createSyncCheckRunStore(), {
            repositoryId: 123,
            payload: buildCheckRunPayload({
                lane: "fast",
                repositoryFullName: "owner/repo",
                prNumber: 42,
                headSha: "abc123",
                findings,
                coverage: coverageRecords
            }),
            annotationCap: cap,
            policyAllowsDeepScan: true
        });
    }

    it("lists blocking findings with location and a coverage table with reasons", () => {
        const result = publishWithFindings(
            [finding({ path: "src/api.ts", start_line: 42, message: "hardcoded key" })],
            [coverage({ scanner: "eslint", status: "timed_out", reason: "budget exceeded" })],
            20
        );

        expect(result.checkRun.summary).toContain("**Blocking findings (1)**");
        expect(result.checkRun.summary).toContain("`src/api.ts:42` — hardcoded key");
        expect(result.checkRun.summary).toContain("| scanner | status | reason |");
        expect(result.checkRun.summary).toContain("| eslint | timed_out | budget exceeded |");
    });

    it("spills findings past the annotation cap into the summary body", () => {
        const findings = Array.from({ length: 3 }, (_, index) => finding({
            path: `src/f${index}.ts`,
            start_line: index + 1,
            fingerprint: `spill-${index}`,
            message: `finding ${index}`
        }));

        const result = publishWithFindings(findings, [coverage()], 1);

        expect(result.checkRun.summary).toContain("Additional findings not shown inline (2)");
        expect(result.checkRun.overflowAnnotations).toHaveLength(2);
    });

    it("keeps the body under GitHub's summary size limit on a large finding set", () => {
        const findings = Array.from({ length: 5000 }, (_, index) => finding({
            path: `src/f${index}.ts`,
            start_line: index + 1,
            fingerprint: `big-${index}`,
            message: `finding number ${index} with some descriptive text`
        }));

        const result = publishWithFindings(findings, [coverage()], 50);

        expect(result.checkRun.summary.length).toBeLessThanOrEqual(65000);
    });
});

// F: an in_progress check is created at ingress, then updated to completed by the worker.
describe("immediate in_progress check at ingress", () => {
    function prEvent(headSha: string): NormalizedWebhookEvent {
        return {
            deliveryId: "d1",
            eventName: "pull_request",
            action: "opened",
            repositoryId: 123,
            repositoryFullName: "owner/repo",
            installationId: 9,
            receivedAt: new Date().toISOString(),
            pullRequest: {
                number: 42,
                headSha,
                baseSha: "base",
                headRef: "feature",
                baseRef: "main"
            }
        };
    }

    const stubQueue = {
        async send(): Promise<ReviewQueueSendResult> {
            return { messageId: "m1", sentAt: new Date().toISOString() };
        }
    } as unknown as DurableReviewQueue;

    it("publishes an in_progress check at ingress that the worker later completes under the same id", async () => {
        const store = createSyncCheckRunStore();

        await enqueueReviewJobFromWebhook({
            event: prEvent("abc123"),
            lane: "fast",
            trigger: "pull_request",
            queue: stubQueue,
            checkRunStore: store
        });

        expect(store.size).toBe(1);
        const [queued] = [...store.values()];
        expect(queued?.status).toBe("in_progress");
        expect(queued?.conclusion).toBeNull();
        expect(queued?.externalId).toBe("prpilot:123:42:fast:abc123");

        // Worker completes the same external id: one entry, updated in place.
        const completed = publishCheckRunSync(store, {
            repositoryId: 123,
            payload: buildCheckRunPayload({
                lane: "fast",
                repositoryFullName: "owner/repo",
                prNumber: 42,
                headSha: "abc123",
                findings: [],
                coverage: [coverage()]
            }),
            annotationCap: 20,
            policyAllowsDeepScan: true
        });

        expect(completed.operation).toBe("updated");
        expect(store.size).toBe(1);
        expect(store.get(completed.checkRun.externalId)?.status).toBe("completed");
    });

    it("does not publish a check when no store is provided (backward compatible)", async () => {
        const result = await enqueueReviewJobFromWebhook({
            event: prEvent("abc123"),
            lane: "fast",
            trigger: "pull_request",
            queue: stubQueue
        });

        expect(result.statusCode).toBe(202);
    });
});
