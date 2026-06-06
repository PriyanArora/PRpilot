# P5 GitHub Check Runs Walkthrough

## Manual Actions Still Needed

The P5 code is locally proven, but the live GitHub PR proof is still manual. Before declaring the external P5 gate fully proven, show:

- A real test PR with `PRPilot Fast` publishing `failure` for a blocking fast-lane finding.
- A real or controlled degraded fast-lane run publishing `action_required`.
- One optional `PRPilot Deep` result or an explicit deep-lane denial summary.
- GitHub UI evidence for annotation preview, dedupe behavior, and annotation-cap overflow.

This file explains the P5 work in order. P5 proves the check-run publisher locally with a synchronous caller. P6 will later connect the same publisher to the SQS worker path.

## P5.1 Define the check-run payload builder input

The payload input is the object every check publisher receives. Think of it like the label on a package: it tells the publisher which lane ran, which repository and PR it belongs to, which commit SHA it is for, what conclusion GitHub should show, and what findings and coverage records explain that conclusion.

Code:

```ts
export type CheckRunPayloadInput = {
    lane: "fast" | "deep";
    repositoryFullName: string;
    prNumber: number;
    headSha: string;
    checkName: string;
    conclusion: CheckRunConclusion;
    findings: Finding[];
    coverage: Coverage[];
};
```

File: `packages/rules/check-run-payload-input.ts`

## P5.1a Document the synchronous P5 proof path

P5 is not wiring the full queue worker yet. It proves the reusable publisher through a local synchronous caller first, so the publisher can be tested before P6 adds SQS.

Code:

```ts
export const p5SynchronousProofScope = {
    proofMode: "synchronous_local_caller",
    queueWiringPhase: "P6",
    purpose: "Prove the reusable check publisher before SQS worker invocation exists."
} as const;
```

File: `packages/checks/p5-synchronous-proof.ts`

## P5.1b Walk through the GitHub Checks lifecycle

The lifecycle list records the exact GitHub Checks behaviors P5 owns: create or update the check, decide the conclusion, prepare annotations, build the summary, and expose manual actions only when allowed.

Code:

```ts
export const githubChecksLifecycle = [
    "create_or_update_check_for_head_sha",
    "resolve_conclusion",
    "rank_dedupe_and_cap_annotations",
    "build_summary_sections",
    "expose_rerun_or_deep_scan_actions_when_allowed"
] as const;
```

File: `packages/checks/p5-synchronous-proof.ts`

## P5.2 Define separate check-run identities

Fast and deep results must be separate GitHub checks. The fast lane is the required path. The deep lane is optional/advisory, so it must not overwrite or confuse the fast result.

Code:

```ts
export const CHECK_RUN_NAMES: Record<Lane, CheckRunName> = {
    fast: "PRPilot Fast",
    deep: "PRPilot Deep"
};
```

File: `packages/checks/check-run-identity.ts`

## P5.3 Define deterministic GitHub check external IDs

The `external_id` is a stable key. If the same lane runs again for the same repo, PR, and head SHA, the publisher updates the same check instead of creating noisy duplicates.

Code:

```ts
export function buildCheckRunExternalId(input: CheckRunIdentityInput): string {
    return `prpilot:${input.repositoryId}:${input.prNumber}:${input.lane}:${input.headSha}`;
}
```

File: `packages/checks/check-run-identity.ts`

## P5.4 Create a fast-lane check run for the current head SHA

The synchronous publisher stores a published check run by deterministic external ID. In the real GitHub path, this store behavior maps to "find the check for this head SHA, then create it if missing."

Code:

```ts
const operation = store.has(externalId) ? "updated" : "created";
store.set(externalId, checkRun);
```

File: `packages/checks/sync-check-publisher.ts`

## P5.5 Update the same fast-lane check run on rerun

When the same fast-lane payload is published again, the same `externalId` is used. That makes the operation `updated`, not a second duplicate check.

Code:

```ts
const externalId = buildCheckRunExternalId({
    repositoryId: input.repositoryId,
    prNumber: input.payload.prNumber,
    lane: input.payload.lane,
    headSha: input.payload.headSha
});
```

File: `packages/checks/sync-check-publisher.ts`

## P5.6 Create or update optional deep-lane checks separately

Deep uses the same publisher, but its lane is `deep`. Because the lane is part of the external ID and the check name, deep runs do not change the fast-lane result.

Code:

```ts
export function getCheckRunName(lane: Lane): CheckRunName {
    return CHECK_RUN_NAMES[lane];
}
```

File: `packages/checks/check-run-identity.ts`

## P5.7 Map critical fast-lane findings to failure

A blocking fast-lane finding means the required review found a real merge-blocking issue, so GitHub should show `failure`.

Code:

```ts
function hasBlockingFinding(findings: Finding[]): boolean {
    return findings.some((finding) => finding.blockability === "block");
}
```

File: `packages/checks/check-run-conclusion.ts`

## P5.8 Map warn-only fast-lane runs to passing

Warn-only findings are visible, but they do not block the required fast lane. If coverage completed honestly and there are only warnings, the conclusion is `success`.

Code:

```ts
if (hasBlockingFinding(input.findings)) {
    return "failure";
}

return "success";
```

File: `packages/checks/check-run-conclusion.ts`

## P5.9 Map degraded fast-lane runs to action_required

If a required fast-lane scanner failed, timed out, was denied by limit, or only partially checked required input, the check cannot honestly pass. It becomes `action_required`.

Code:

```ts
if (hasFastLaneCoverageGap(input.coverage)) {
    return "action_required";
}
```

File: `packages/checks/check-run-conclusion.ts`

## P5.10 Map clean deep-lane runs to passing

A clean deep-lane run is optional and non-blocking. If it has no advisory signal and coverage completed, it can be `success`.

Code:

```ts
return hasDeepLaneAdvisorySignal(input) ? "neutral" : "success";
```

File: `packages/checks/check-run-conclusion.ts`

## P5.11 Map deep-lane advisory and denial results to neutral

Deep-lane findings, denials, partial coverage, or timeouts should be visible but not required. P5 maps those to `neutral`, which is a non-required advisory result.

Code:

```ts
function hasDeepLaneAdvisorySignal(input: CheckRunConclusionInput): boolean {
    return input.findings.length > 0 || input.coverage.some((coverageRecord) =>
        coverageRecord.status !== "completed" && coverageRecord.status !== "not_applicable"
    );
}
```

File: `packages/checks/check-run-conclusion.ts`

## P5.12 Add integration tests for lane-specific conclusion mapping

The integration test proves fast blocking, fast warning, fast degraded, clean deep, and advisory deep conclusions.

Code:

```ts
expect(payload({
    findings: [finding({ blockability: "block" })],
    coverage: [coverage()]
}).conclusion).toBe("failure");
```

File: `tests/integration/check-run-publisher.test.ts`

## P5.13 Rank annotations before truncation

Annotations are sorted before caps are applied. Blocking issues come first, fast-lane issues come before deep-lane issues, and known scanner priority breaks ties.

Code:

```ts
const blockabilityRank = getBlockabilityRank(left.blockability) - getBlockabilityRank(right.blockability);
const laneRank = (left.lane === "fast" ? 0 : 1) - (right.lane === "fast" ? 0 : 1);
const scannerRank = (SCANNER_PRIORITY[left.scanner] ?? 99) - (SCANNER_PRIORITY[right.scanner] ?? 99);
```

File: `packages/checks/check-run-annotations.ts`

## P5.14 Dedupe annotations by fingerprint and location

If two scanners report the same finding at the same file and line, P5 keeps one annotation. This prevents duplicate comments in GitHub.

Code:

```ts
const key = `${annotation.fingerprint}:${annotation.path}:${annotation.start_line}:${annotation.end_line}`;
```

File: `packages/checks/check-run-annotations.ts`

## P5.15 Add GitHub-safe annotation chunking

GitHub accepts only 50 annotations per request. P5 splits inline annotations into chunks of 50.

Code:

```ts
for (let index = 0; index < annotations.length; index += chunkSize) {
    chunks.push(annotations.slice(index, index + chunkSize));
}
```

File: `packages/checks/check-run-annotations.ts`

## P5.16 Enforce the total annotation cap per run

The publisher applies a total inline annotation cap. This keeps the check useful without flooding the PR.

Code:

```ts
const inlineAnnotations = rankedAnnotations.slice(0, annotationCap);
const overflowAnnotations = rankedAnnotations.slice(annotationCap);
```

File: `packages/checks/check-run-annotations.ts`

## P5.17 Move overflow findings into the summary

Findings that do not fit inline are not lost. They are counted as overflow in the check summary.

Code:

```ts
formatCount("Overflow findings in summary", input.overflowAnnotationCount)
```

File: `packages/checks/check-run-summary.ts`

## P5.18 Split the summary into useful sections

The summary is split into the pieces a user needs to understand: verdict, blocking findings, advisory findings, coverage gaps, inline annotations, overflow findings, applied limits, and deep-scan availability.

Code:

```ts
const body = [
    `Verdict: ${input.payload.conclusion}`,
    formatCount("Blocking findings", blockingFindings.length),
    formatCount("Advisory findings", advisoryFindings.length),
    formatCount("Coverage gaps", coverageGaps.length),
    formatCount("Inline annotations", input.inlineAnnotationCount),
    formatCount("Overflow findings in summary", input.overflowAnnotationCount),
    `Applied limits: ${input.appliedLimits.length === 0 ? "none" : input.appliedLimits.join(", ")}`,
    `Deep scan available: ${input.deepScanAvailable ? "yes" : "no"}`
].join("\n");
```

File: `packages/checks/check-run-summary.ts`

## P5.19 Expose deep-scan action only when honest and allowed

The manual deep-scan button appears only when the fast-lane result is based on complete enough coverage and the runtime policy allows deep scans.

Code:

```ts
return input.lane === "fast"
    && input.policyAllowsDeepScan
    && input.conclusion !== "action_required"
    && hasHonestFastLaneCoverage(input.coverage);
```

File: `packages/checks/deep-scan-action.ts`

## P5.20 Show a failing fast-lane PR run

The local proof scenario creates a fast-lane payload with a blocking finding and publishes it. The expected conclusion is `failure`.

Code:

```ts
export function buildFailingFastLaneProof() {
    const payload = buildCheckRunPayload({
        lane: "fast",
        findings: [buildFinding("block")],
        coverage: [buildCoverage("completed")],
        repositoryFullName: "owner/repo",
        prNumber: 1,
        headSha: "abc123"
    });

    return publishCheckRunSync(store, { repositoryId: 123, payload, annotationCap: 20, policyAllowsDeepScan: true });
}
```

File: `packages/checks/p5-proof-scenarios.ts`

## P5.21 Show a degraded fast-lane run

The degraded proof scenario creates a fast-lane payload with failed coverage. The expected conclusion is `action_required`, because the required path did not complete honestly.

Code:

```ts
coverage: [buildCoverage("failed")]
```

File: `packages/checks/p5-proof-scenarios.ts`

## P5.22 Show an optional deep-lane denial

The deep-lane proof scenario creates a denied deep-lane coverage record and an advisory finding. The expected conclusion is `neutral`, so it is visible but not required.

Code:

```ts
const payload = buildCheckRunPayload({
    lane: "deep",
    findings: [buildFinding("warn", "deep")],
    coverage: [buildCoverage("denied_by_limit", "deep")],
    repositoryFullName: "owner/repo",
    prNumber: 1,
    headSha: "abc123"
});
```

File: `packages/checks/p5-proof-scenarios.ts`
