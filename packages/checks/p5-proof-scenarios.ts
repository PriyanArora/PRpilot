import type { Coverage } from "../rules/coverage";
import type { Finding, FindingBlockability } from "../rules/finding";
import { buildCheckRunPayload } from "./check-run-payload-builder";
import { createSyncCheckRunStore, publishCheckRunSync } from "./sync-check-publisher";

function buildCoverage(status: Coverage["status"], lane: Coverage["lane"] = "fast"): Coverage {
    return {
        lane,
        scanner: lane === "fast" ? "internal" : "osv-scanner",
        applicability: "applicable",
        status,
        scope_expected: lane === "fast" ? "changed_files" : "repo_context",
        scope_completed: status === "completed" ? "full_scope" : "partial_scope",
        reason: status === "completed" ? undefined : "P5 local proof scenario.",
        duration_ms: 1,
        budget_ms: 1000
    };
}

function buildFinding(blockability: FindingBlockability, lane: Finding["lane"] = "fast"): Finding {
    return {
        lane,
        pack: lane === "fast" ? "internal" : "deep",
        scanner: lane === "fast" ? "internal" : "osv-scanner",
        rule_id: lane === "fast" ? "internal.sensitive-file-change" : "osv-scanner.advisory",
        severity: blockability === "block" ? "high" : "medium",
        blockability,
        scope_basis: lane === "fast" ? "changed_files" : "repo_context",
        path: lane === "fast" ? ".github/workflows/deploy.yml" : "package-lock.json",
        start_line: 1,
        end_line: 1,
        message: blockability === "block" ? "Blocking fast-lane finding." : "Advisory finding.",
        fingerprint: `${lane}:${blockability}:sample`
    };
}

export function buildFailingFastLaneProof() {
    const store = createSyncCheckRunStore();
    const payload = buildCheckRunPayload({
        lane: "fast",
        repositoryFullName: "owner/repo",
        prNumber: 1,
        headSha: "abc123",
        findings: [buildFinding("block")],
        coverage: [buildCoverage("completed")]
    });

    return publishCheckRunSync(store, {
        repositoryId: 123,
        payload,
        annotationCap: 20,
        policyAllowsDeepScan: true
    });
}

export function buildDegradedFastLaneProof() {
    const store = createSyncCheckRunStore();
    const payload = buildCheckRunPayload({
        lane: "fast",
        repositoryFullName: "owner/repo",
        prNumber: 1,
        headSha: "def456",
        findings: [],
        coverage: [buildCoverage("failed")]
    });

    return publishCheckRunSync(store, {
        repositoryId: 123,
        payload,
        annotationCap: 20,
        policyAllowsDeepScan: true,
        appliedLimits: ["scanner_failed"]
    });
}

export function buildDeepLaneDenialProof() {
    const store = createSyncCheckRunStore();
    const payload = buildCheckRunPayload({
        lane: "deep",
        repositoryFullName: "owner/repo",
        prNumber: 1,
        headSha: "abc123",
        findings: [buildFinding("warn", "deep")],
        coverage: [buildCoverage("denied_by_limit", "deep")]
    });

    return publishCheckRunSync(store, {
        repositoryId: 123,
        payload,
        annotationCap: 20,
        policyAllowsDeepScan: true,
        appliedLimits: ["deep_lane_denied_by_limit"]
    });
}
