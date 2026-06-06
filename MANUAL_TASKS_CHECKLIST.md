# Manual Tasks Checklist

**Current Manual Gate:** External proof for P5, P6, P7, P8, P9, and P10
**Purpose:** Track proof that cannot be completed by local code changes alone.
**Rule:** Do not mark an item complete without concrete evidence such as GitHub UI screenshots, logs, AWS console output, CLI output, or copied query results.
**Last Updated:** 2026-06-06
**Session Notes:** P5.M1 is complete by user confirmation: the new GitHub App was installed, webhook events reached the local `webhook:dev` server through ngrok, and the setup can trigger PRPilot from a real PR path. P5.M2 is paused for later; P8 has now been documented in `P8_README.md`, but no P8 live proof item is complete without external evidence. P9 and P10 have local proof paths; live repository-policy and authorization evidence remains manual.

---

## P5 — GitHub Check Runs `[manual proof pending]`

**Goal:** Prove the check publisher works on a real or controlled GitHub PR path.

**Tasks:**
- [x] P5.M1 Open or use a real test PR that can trigger PRPilot checks.
- [ ] P5.M2 Show `PRPilot Fast` publishing `failure` for a blocking fast-lane finding.
- [ ] P5.M3 Show a degraded or operational-block fast-lane run publishing `action_required`.
- [ ] P5.M4 Show one `PRPilot Deep` result or an explicit deep-lane denial summary.
- [ ] P5.M5 Show GitHub annotation preview evidence.
- [ ] P5.M6 Show annotation dedupe behavior.
- [ ] P5.M7 Show annotation-cap overflow behavior in the summary.

**Proof:** GitHub PR/check-run evidence for `failure`, `action_required`, deep result or denial, annotations, dedupe, and cap overflow.

---

## P6 — Async Queue Pipeline `[manual proof pending]`

**Goal:** Prove the queue and worker path works with live AWS/GitHub infrastructure.

**Tasks:**
- [ ] P6.M1 Show webhook ingress enqueues a real review job only after durable SQS handoff.
- [ ] P6.M2 Show worker processing logs from an SQS-triggered worker.
- [ ] P6.M3 Show one DLQ failure record.
- [ ] P6.M4 Show manual DLQ inspection or replay evidence.
- [ ] P6.M5 Show one scanner timeout-handling example.
- [ ] P6.M6 Show one freshness-check supersession or freshness-failure policy example.
- [ ] P6.M7 Show one rerun-throttle, superseded-job, or deep-lane denial example.
- [ ] P6.M8 Confirm the fast-lane result is unchanged by any deep-lane denial or optional deep run.

**Proof:** AWS/GitHub logs or console output for enqueue, worker processing, DLQ, timeout handling, freshness or throttle behavior, and deep-lane non-interference.

---

## P7 — Persistence Layer `[manual proof pending]`

**Goal:** Prove the persistence model works against live DynamoDB or a safe live-equivalent table.

**Tasks:**
- [ ] P7.M1 Create or deploy the DynamoDB table with `pk`, `sk`, and TTL enabled on `ttl`.
- [ ] P7.M2 Run the persistence path against a real PR with multiple runs.
- [ ] P7.M3 Show DynamoDB query output for `PK = REPO#<repositoryId>#PR#<prNumber>`.
- [ ] P7.M4 Show records for at least two runs under one PR partition.
- [ ] P7.M5 Show related delivery or attempt records under that PR partition.
- [ ] P7.M6 Show TTL fields on delivery, run, attempt, counter, and lock records where present.
- [ ] P7.M7 Show quota-counter evidence, including a denied increment or quota-exhausted case.
- [ ] P7.M8 Show deep-lane lock evidence, including a held-lock denial or lock expiry/release.
- [ ] P7.M9 Run the chosen low-cost recovery drill against exported live data or a safe table copy.
- [ ] P7.M10 Show recovery drill output proving records were restored and one PR partition could be queried.

**Proof:** DynamoDB table config, query output, counter or lock evidence, TTL evidence, and recovery drill evidence.

---

## P8 — Main Feature Validation `[manual proof pending]`

**Goal:** Prove the full merge-gate behavior works on a real pull request.

**Tasks:**
- [ ] P8.M1 Document the selected real validation repository, repository ID, installation ID, and branch protection rule requiring `PRPilot Fast`.
- [ ] P8.M2 Open a real failing PR with a deterministic blocking finding.
- [ ] P8.M3 Show webhook ingress logs for that real PR delivery.
- [ ] P8.M4 Show `PRPilot Fast` publishing for the PR head SHA.
- [ ] P8.M5 Show webhook-to-check latency for at least 3 real runs.
- [ ] P8.M6 Show branch protection blocking merge while `PRPilot Fast` is failing.
- [ ] P8.M7 Fix the PR and show the new `PRPilot Fast` result passes.
- [ ] P8.M8 Show the PR merges after the passing required check.
- [ ] P8.M9 Show one `PRPilot Deep` result or explicit deep-lane disabled/denied result.
- [ ] P8.M10 Show one graceful operational edge case such as unsupported repo, oversized run, quota denial, or required-path coverage gap.

**Proof:** GitHub PR/check-run evidence, webhook logs, latency timestamps from 3 real runs, branch-protection merge-block evidence, successful merge evidence, deep-lane non-interference evidence, and one honest operational edge-case result.

---

## P9 — Repository Policy Config `[manual proof pending]`

**Goal:** Prove repository policy config works on real or controlled PR paths.

**Tasks:**
- [ ] P9.M1 Show two PR runs with different `.prpilot.yml` configs.
- [ ] P9.M2 Show one invalid-config PR result that publishes an explicit non-pass operational result.
- [ ] P9.M3 Show one scanner mode change applied by policy only.
- [ ] P9.M4 Show one lane assignment change by config.
- [ ] P9.M5 Show one quota or opt-in policy example.
- [ ] P9.M6 Show one manual-vs-auto deep opt-in example.
- [ ] P9.M7 Show one case proving repo config cannot override a deployment-owner cap.

**Proof:** GitHub PR/check-run evidence or copied controlled-run output for config differences, invalid config, scanner policy changes, deep opt-in behavior, quota behavior, and owner-cap rejection.

---

## P10 — App Permission and Installation Hardening `[manual proof pending]`

**Goal:** Prove GitHub App authorization behavior against real webhook/action data.

**Tasks:**
- [ ] P10.M1 Show accepted installed same-repo webhook logs.
- [ ] P10.M2 Show accepted fork PR webhook logs using the installed base repository for authorization.
- [ ] P10.M3 Show rejected non-installed repository event evidence.
- [ ] P10.M4 Show rejected selected-scope violation evidence.
- [ ] P10.M5 Show stale or mismatched deep-action rejection from a real `check_run.requested_action`.
- [ ] P10.M6 Show GitHub App permission settings still match the least-privilege matrix.

**Proof:** GitHub App settings, webhook logs, and action logs for accepted same-repo, accepted fork base-repo, rejected non-installed, rejected out-of-scope, and stale-action cases.

---

## Completion Rule

When every checkbox above is complete, update `codex-folder/codex/Progress.md` with the external proof summary before moving to the next phase.
