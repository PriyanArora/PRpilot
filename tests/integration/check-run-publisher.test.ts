import { describe, expect, it } from "vitest";
import type { Coverage } from "../../packages/rules/coverage";
import type { Finding } from "../../packages/rules/finding";
import { buildCheckRunPayload } from "../../packages/checks/check-run-payload-builder";
import { buildCheckRunExternalId, getCheckRunName } from "../../packages/checks/check-run-identity";
import { p5SynchronousProofScope, githubChecksLifecycle } from "../../packages/checks/p5-synchronous-proof";
import { prepareAnnotations } from "../../packages/checks/check-run-annotations";
import { RUN_DEEP_SCAN_ACTION_ID, RERUN_DEEP_SCAN_ACTION_ID } from "../../packages/checks/deep-scan-action";
import { createSyncCheckRunStore, publishCheckRunSync } from "../../packages/checks/sync-check-publisher";
import {
    buildDeepLaneDenialProof,
    buildDegradedFastLaneProof,
    buildFailingFastLaneProof
} from "../../packages/checks/p5-proof-scenarios";

function coverage(overrides: Partial<Coverage> = {}): Coverage {
    const lane = overrides.lane ?? "fast";

    return {
        lane,
        scanner: lane === "fast" ? "internal" : "osv-scanner",
        applicability: "applicable",
        status: "completed",
        scope_expected: lane === "fast" ? "changed_files" : "repo_context",
        scope_completed: lane === "fast" ? "changed_files" : "repo_context",
        duration_ms: 1,
        budget_ms: 1000,
        ...overrides
    };
}

function finding(overrides: Partial<Finding> = {}): Finding {
    const lane = overrides.lane ?? "fast";
    const blockability = overrides.blockability ?? "block";
    const path = overrides.path ?? (lane === "fast" ? ".github/workflows/deploy.yml" : "package-lock.json");
    const startLine = overrides.start_line ?? 1;

    return {
        lane,
        pack: lane === "fast" ? "internal" : "deep",
        scanner: lane === "fast" ? "internal" : "osv-scanner",
        rule_id: lane === "fast" ? "internal.sensitive-file-change" : "osv-scanner.advisory",
        severity: blockability === "block" ? "high" : "medium",
        blockability,
        scope_basis: lane === "fast" ? "changed_files" : "repo_context",
        path,
        start_line: startLine,
        end_line: overrides.end_line ?? startLine,
        message: blockability === "block" ? "Blocking finding" : "Advisory finding",
        fingerprint: `${lane}:${blockability}:${path}:${startLine}`,
        ...overrides
    };
}

function payload(input: {
    lane?: "fast" | "deep";
    findings?: Finding[];
    coverage?: Coverage[];
    headSha?: string;
}) {
    const lane = input.lane ?? "fast";

    return buildCheckRunPayload({
        lane,
        repositoryFullName: "owner/repo",
        prNumber: 42,
        headSha: input.headSha ?? "abc123",
        findings: input.findings ?? [],
        coverage: input.coverage ?? [coverage({ lane })]
    });
}

describe("P5 synchronous proof scope", () => {
    it("keeps P5 scoped to the reusable check publisher before P6 wires SQS", () => {
        expect(p5SynchronousProofScope).toEqual({
            proofMode: "synchronous_local_caller",
            queueWiringPhase: "P6",
            purpose: "Prove the reusable check publisher before SQS worker invocation exists."
        });

        expect(githubChecksLifecycle).toEqual([
            "create_or_update_check_for_head_sha",
            "resolve_conclusion",
            "rank_dedupe_and_cap_annotations",
            "build_summary_sections",
            "expose_rerun_or_deep_scan_actions_when_allowed"
        ]);
    });
});

describe("P5 check-run identity", () => {
    it("uses separate names for fast and deep check runs", () => {
        expect(getCheckRunName("fast")).toBe("PRPilot Fast");
        expect(getCheckRunName("deep")).toBe("PRPilot Deep");
    });

    it("builds a deterministic external id for create-or-update behavior", () => {
        expect(buildCheckRunExternalId({
            repositoryId: 123,
            prNumber: 42,
            lane: "fast",
            headSha: "abc123"
        })).toBe("prpilot:123:42:fast:abc123");
    });
});

describe("P5 check-run create and update behavior", () => {
    it("creates and then updates the same fast-lane check run for the same head SHA", () => {
        const store = createSyncCheckRunStore();
        const fastPayload = payload({ findings: [], coverage: [coverage()] });

        const created = publishCheckRunSync(store, {
            repositoryId: 123,
            payload: fastPayload,
            annotationCap: 20,
            policyAllowsDeepScan: true
        });
        const updated = publishCheckRunSync(store, {
            repositoryId: 123,
            payload: fastPayload,
            annotationCap: 20,
            policyAllowsDeepScan: true
        });

        expect(created.operation).toBe("created");
        expect(updated.operation).toBe("updated");
        expect(store).toHaveLength(1);
        expect(updated.checkRun.name).toBe("PRPilot Fast");
        expect(updated.checkRun.headSha).toBe("abc123");
    });

    it("creates or updates deep-lane results without changing the fast-lane result", () => {
        const store = createSyncCheckRunStore();
        const fast = publishCheckRunSync(store, {
            repositoryId: 123,
            payload: payload({ lane: "fast", coverage: [coverage()] }),
            annotationCap: 20,
            policyAllowsDeepScan: true
        });
        const deep = publishCheckRunSync(store, {
            repositoryId: 123,
            payload: payload({
                lane: "deep",
                coverage: [coverage({ lane: "deep" })]
            }),
            annotationCap: 20,
            policyAllowsDeepScan: true
        });

        expect(store).toHaveLength(2);
        expect(fast.checkRun.externalId).toContain(":fast:");
        expect(deep.checkRun.externalId).toContain(":deep:");
        expect(store.get(fast.checkRun.externalId)?.name).toBe("PRPilot Fast");
        expect(store.get(deep.checkRun.externalId)?.name).toBe("PRPilot Deep");
    });
});

describe("P5 lane-specific conclusion mapping", () => {
    it("maps blocking fast-lane findings to failure", () => {
        expect(payload({
            findings: [finding({ blockability: "block" })],
            coverage: [coverage()]
        }).conclusion).toBe("failure");
    });

    it("maps warn-only fast-lane findings with complete coverage to success", () => {
        expect(payload({
            findings: [finding({ blockability: "warn" })],
            coverage: [coverage()]
        }).conclusion).toBe("success");
    });

    it("maps degraded fast-lane coverage to action_required", () => {
        expect(payload({
            findings: [],
            coverage: [coverage({
                status: "failed",
                scope_completed: "partial_scope",
                reason: "scanner failed"
            })]
        }).conclusion).toBe("action_required");
    });

    it("maps clean deep-lane runs to success", () => {
        expect(payload({
            lane: "deep",
            findings: [],
            coverage: [coverage({ lane: "deep" })]
        }).conclusion).toBe("success");
    });

    it("maps deep-lane advisory findings and coverage denials to neutral", () => {
        expect(payload({
            lane: "deep",
            findings: [finding({ lane: "deep", blockability: "warn" })],
            coverage: [coverage({
                lane: "deep",
                status: "denied_by_limit",
                scope_completed: "not_run",
                reason: "deep lane disabled by policy"
            })]
        }).conclusion).toBe("neutral");
    });
});

describe("P5 annotation preparation", () => {
    it("ranks annotations by blockability, lane, and scanner priority before truncation", () => {
        const prepared = prepareAnnotations([
            finding({
                blockability: "warn",
                scanner: "gitleaks",
                fingerprint: "warn-fast-gitleaks"
            }),
            finding({
                lane: "deep",
                blockability: "block",
                scanner: "eslint",
                fingerprint: "block-deep-eslint"
            }),
            finding({
                blockability: "block",
                scanner: "actionlint",
                fingerprint: "block-fast-actionlint"
            }),
            finding({
                blockability: "block",
                scanner: "gitleaks",
                fingerprint: "block-fast-gitleaks"
            })
        ], 10);

        expect(prepared.inlineAnnotations.map((annotation) => annotation.fingerprint)).toEqual([
            "block-fast-gitleaks",
            "block-fast-actionlint",
            "block-deep-eslint",
            "warn-fast-gitleaks"
        ]);
    });

    it("dedupes annotations by finding fingerprint and location", () => {
        const duplicate = finding({
            fingerprint: "same-fingerprint",
            path: "src/file.ts",
            start_line: 5,
            end_line: 5
        });

        const prepared = prepareAnnotations([
            duplicate,
            {
                ...duplicate,
                message: "Same finding reported twice"
            }
        ], 10);

        expect(prepared.inlineAnnotations).toHaveLength(1);
    });

    it("chunks inline annotations into GitHub-sized groups of 50", () => {
        const findings = Array.from({ length: 55 }, (_, index) => finding({
            fingerprint: `chunk-${index}`,
            path: `src/chunk-${index}.ts`,
            start_line: index + 1,
            end_line: index + 1
        }));

        const prepared = prepareAnnotations(findings, 55);

        expect(prepared.chunks).toHaveLength(2);
        expect(prepared.chunks[0]).toHaveLength(50);
        expect(prepared.chunks[1]).toHaveLength(5);
    });

    it("enforces the total annotation cap and keeps overflow findings for the summary", () => {
        const findings = Array.from({ length: 25 }, (_, index) => finding({
            fingerprint: `cap-${index}`,
            path: `src/cap-${index}.ts`,
            start_line: index + 1,
            end_line: index + 1
        }));

        const prepared = prepareAnnotations(findings, 20);

        expect(prepared.inlineAnnotations).toHaveLength(20);
        expect(prepared.overflowAnnotations).toHaveLength(5);
    });
});

describe("P5 published summary and manual actions", () => {
    it("summarizes blocking findings, advisory findings, coverage gaps, applied limits, and overflow", () => {
        const result = publishCheckRunSync(createSyncCheckRunStore(), {
            repositoryId: 123,
            payload: payload({
                findings: [
                    finding({ blockability: "block", fingerprint: "summary-block" }),
                    finding({ blockability: "warn", fingerprint: "summary-warn" })
                ],
                coverage: [coverage()]
            }),
            annotationCap: 1,
            policyAllowsDeepScan: true,
            appliedLimits: ["annotation_cap"]
        });

        expect(result.checkRun.summary).toContain("Blocking findings: 1");
        expect(result.checkRun.summary).toContain("Advisory findings: 1");
        expect(result.checkRun.summary).toContain("Coverage gaps: 0");
        expect(result.checkRun.summary).toContain("Overflow findings in summary: 1");
        expect(result.checkRun.summary).toContain("Applied limits: annotation_cap");
        expect(result.checkRun.summary).toContain("Deep scan available: yes");
    });

    it("exposes deep scan only when fast-lane coverage is honest and policy allows it", () => {
        const allowed = publishCheckRunSync(createSyncCheckRunStore(), {
            repositoryId: 123,
            payload: payload({
                findings: [],
                coverage: [coverage()]
            }),
            annotationCap: 20,
            policyAllowsDeepScan: true
        });
        const denied = publishCheckRunSync(createSyncCheckRunStore(), {
            repositoryId: 123,
            payload: payload({
                findings: [],
                coverage: [coverage({
                    status: "failed",
                    scope_completed: "partial_scope",
                    reason: "scanner failed"
                })]
            }),
            annotationCap: 20,
            policyAllowsDeepScan: true
        });
        const deep = publishCheckRunSync(createSyncCheckRunStore(), {
            repositoryId: 123,
            payload: payload({
                lane: "deep",
                coverage: [coverage({ lane: "deep" })]
            }),
            annotationCap: 20,
            policyAllowsDeepScan: true
        });

        expect(allowed.checkRun.actions).toEqual([RUN_DEEP_SCAN_ACTION_ID]);
        expect(denied.checkRun.actions).toEqual([]);
        expect(deep.checkRun.actions).toEqual([RERUN_DEEP_SCAN_ACTION_ID]);
    });
});

describe("P5 local proof scenarios", () => {
    it("shows a failing fast-lane proof run", () => {
        const result = buildFailingFastLaneProof();

        expect(result.operation).toBe("created");
        expect(result.checkRun.conclusion).toBe("failure");
        expect(result.checkRun.summary).toContain("Blocking findings: 1");
    });

    it("shows a degraded fast-lane proof run", () => {
        const result = buildDegradedFastLaneProof();

        expect(result.checkRun.conclusion).toBe("action_required");
        expect(result.checkRun.summary).toContain("Coverage gaps: 1");
        expect(result.checkRun.summary).toContain("Applied limits: scanner_failed");
    });

    it("shows an optional deep-lane denial proof run", () => {
        const result = buildDeepLaneDenialProof();

        expect(result.checkRun.conclusion).toBe("neutral");
        expect(result.checkRun.name).toBe("PRPilot Deep");
        expect(result.checkRun.summary).toContain("Applied limits: deep_lane_denied_by_limit");
    });
});
