import { describe, expect, it } from "vitest";
import type { Finding } from "../../packages/rules/finding";
import { diffFindingFingerprints } from "../../packages/checks/finding-delta";
import { buildCheckRunPayload } from "../../packages/checks/check-run-payload-builder";
import { createSyncCheckRunStore, publishCheckRunSync } from "../../packages/checks/sync-check-publisher";

function finding(fingerprint: string): Finding {
    return {
        lane: "fast",
        pack: "internal",
        scanner: "internal",
        rule_id: "internal.large-change",
        severity: "medium",
        blockability: "warn",
        scope_basis: "changed_files",
        path: `src/${fingerprint}.ts`,
        start_line: 1,
        message: "A finding",
        fingerprint
    };
}

function publish(store: ReturnType<typeof createSyncCheckRunStore>, headSha: string, findings: Finding[]) {
    return publishCheckRunSync(store, {
        repositoryId: 123,
        payload: buildCheckRunPayload({
            lane: "fast",
            repositoryFullName: "owner/repo",
            prNumber: 42,
            headSha,
            findings,
            coverage: []
        }),
        annotationCap: 50,
        policyAllowsDeepScan: false
    });
}

describe("diffFindingFingerprints", () => {
    it("splits fingerprints into new, resolved, and persisting", () => {
        expect(diffFindingFingerprints(["a", "b", "c"], ["b", "c", "d"])).toEqual({
            newCount: 1,
            resolvedCount: 1,
            persistingCount: 2
        });
    });

    it("counts duplicate fingerprints once", () => {
        expect(diffFindingFingerprints(["a", "a"], ["a", "b", "b"])).toEqual({
            newCount: 1,
            resolvedCount: 0,
            persistingCount: 1
        });
    });
});

describe("delta across pushes on the same PR", () => {
    it("reports what a new push fixed and introduced", () => {
        const store = createSyncCheckRunStore();

        publish(store, "sha-1", [finding("kept"), finding("fixed-1"), finding("fixed-2")]);
        const second = publish(store, "sha-2", [finding("kept"), finding("introduced")]);

        expect(second.checkRun.summary).toContain("**Since last push:** 1 new, 2 resolved, 1 persisting");
    });

    it("omits the delta line on the first run of a PR", () => {
        const store = createSyncCheckRunStore();

        const first = publish(store, "sha-1", [finding("only")]);

        expect(first.checkRun.summary).not.toContain("Since last push");
    });

    it("does not treat a republish of the same head SHA as a previous push", () => {
        const store = createSyncCheckRunStore();

        publish(store, "sha-1", [finding("a")]);
        const republished = publish(store, "sha-1", [finding("a")]);

        expect(republished.operation).toBe("updated");
        expect(republished.checkRun.summary).not.toContain("Since last push");
    });

    it("ignores runs from a different PR", () => {
        const store = createSyncCheckRunStore();

        publishCheckRunSync(store, {
            repositoryId: 123,
            payload: buildCheckRunPayload({
                lane: "fast",
                repositoryFullName: "owner/repo",
                prNumber: 7,
                headSha: "other-sha",
                findings: [finding("other-pr")],
                coverage: []
            }),
            annotationCap: 50,
            policyAllowsDeepScan: false
        });

        const run = publish(store, "sha-1", [finding("a")]);

        expect(run.checkRun.summary).not.toContain("Since last push");
    });
});
