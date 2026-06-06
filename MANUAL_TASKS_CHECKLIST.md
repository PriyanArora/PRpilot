# Manual Tasks Checklist

**Current Manual Gate:** External proof for P5, P6, P7, P8, P9, P10, P11, P12, P13, P14, P15, P16, and P17
**Purpose:** Track proof that cannot be completed by local code changes alone.
**Rule:** Do not mark an item complete without concrete evidence such as GitHub UI screenshots, logs, AWS console output, CLI output, or copied query results.
**Last Updated:** 2026-06-06
**Session Notes:** P5.M1 is complete by user confirmation: the new GitHub App was installed, webhook events reached the local `webhook:dev` server through ngrok, and the setup can trigger PRPilot from a real PR path. P5.M2 is paused for later; P8 has now been documented in `P8_README.md`, but no P8 live proof item is complete without external evidence. P9, P10, P11, P12, P13, P14, P15, P16, and P17 have local proof paths; live repository-policy, authorization, real-repo preflight comparison, live AWS IaC evidence, live reliability hardening evidence, live observability evidence, live deployment validation evidence, live demo/incident evidence, and live workflow evidence remains manual.

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

## P11 — Optional Local Preflight CLI `[manual proof pending]`

**Goal:** Prove local preflight use on a real target repository.

**Tasks:**
- [ ] P11.M1 Run `npm run preflight -- --base <branch>` inside a real target repository.
- [ ] P11.M2 Show one failing local preflight case and exit code `1`.
- [ ] P11.M3 Show one passing local preflight case and exit code `0`.
- [ ] P11.M4 Compare one local preflight failure with the deployed `PRPilot Fast` result for the same logical change.
- [ ] P11.M5 Confirm the baseline ESLint limitation note is visible in real CLI output.

**Proof:** Terminal output from real target repository runs and one comparison against deployed PRPilot check behavior.

---

## P12 — Infrastructure as Code `[manual proof pending]`

**Goal:** Prove the CDK stack against the intended AWS account and bring live resources under IaC control.

**Tasks:**
- [ ] P12.M1 Run `npm run infra:synth` and `cdk diff` with the intended AWS account and region.
- [ ] P12.M2 Show the diff contains only expected PRPilot API Gateway, Lambda, SQS, DynamoDB, IAM, log-retention, and alarm changes.
- [ ] P12.M3 Import or replace any previously-created live AWS resources so the one required live environment is under CDK control.
- [ ] P12.M4 Deploy the stack and show the `WebhookUrl`, `ReviewStateTableName`, `ReviewQueueUrl`, and `ReviewJobsDlqUrl` outputs.
- [ ] P12.M5 Confirm DynamoDB TTL is enabled on `ttl`, the queue redrives to the DLQ, Lambda reserved concurrency is set, and log retention is seven days.
- [ ] P12.M6 Confirm Lambda environment values contain Parameter Store names only, not secret contents.

**Proof:** CDK synth and diff output from the target account, deployed stack outputs, AWS console or CLI evidence for TTL, queue redrive, concurrency, log retention, and Parameter Store-name-only environment configuration.

---

## P13 — Reliability Hardening `[manual proof pending]`

**Goal:** Prove reliability behavior against deployed AWS/GitHub traffic and operational tooling.

**Tasks:**
- [ ] P13.M1 Run repeated-delivery tests or load against the deployed path.
- [ ] P13.M2 Show duplicate deliveries do not create duplicate check runs, queue jobs, or persistence side effects.
- [ ] P13.M3 Run a synthetic burst against the deployed path and show fast-lane priority under backlog.
- [ ] P13.M4 Show live CloudWatch or CLI evidence for failure, DLQ depth, throttling, queue-age, and budget-mode transition alarms.
- [ ] P13.M5 Exercise `normal`, `conserve`, and `emergency` budget modes through live runtime policy or quota counters.
- [ ] P13.M6 Show an optional deep-lane denial under conserve or emergency mode.
- [ ] P13.M7 Practice one GitHub failed-delivery redelivery.
- [ ] P13.M8 Show incident notes mapping scanner timeout, scanner failure, oversized run, unsupported repo, quota exhaustion, and partial coverage to runbook actions.
- [ ] P13.M9 Confirm deployment-owner approval before enabling any optional AGPL or GPL scanner.

**Proof:** Live AWS/GitHub logs, CloudWatch alarm evidence, runtime-policy or quota evidence, GitHub redelivery evidence, incident notes, and owner approval evidence for any cautious-license scanner.

---

## P14 — Free-Tier-Safe Observability and Performance `[manual proof pending]`

**Goal:** Prove observability and latency behavior against deployed runs without adding paid telemetry requirements.

**Tasks:**
- [ ] P14.M1 Capture live webhook-to-check latency samples before a runtime or deployment change.
- [ ] P14.M2 Capture live webhook-to-check latency samples after the change and calculate p50 and p95.
- [ ] P14.M3 Show one CloudWatch Logs Insights query or console view using delivery ID, repository, PR number, lane, head SHA, run status, and budget mode fields.
- [ ] P14.M4 Show per-scanner runtime and finding-volume metrics for at least one live run.
- [ ] P14.M5 Show lane admission, lane denial, and coverage-gap metrics for fast and deep lanes.
- [ ] P14.M6 Show Pack 1 and any enabled deep-lane budget metrics.
- [ ] P14.M7 Confirm log retention and metric cardinality remain inside the free-tier-safe plan.
- [ ] P14.M8 Confirm alarm thresholds and operator actions are acceptable for live traffic.

**Proof:** Live latency samples, p50/p95 calculation, CloudWatch logs or query evidence, metrics evidence, free-tier cardinality review, and alarm threshold review.

---

## P15 — Self-Hosted Deployment Validation `[manual proof pending]`

**Goal:** Prove the self-hosted deployment works in the intended AWS account and selected GitHub repository.

**Tasks:**
- [ ] P15.M1 Deploy the live CDK stack in the intended AWS account and region.
- [ ] P15.M2 Create or verify Parameter Store values for webhook secret, GitHub private key, and runtime policy.
- [ ] P15.M3 Prove the live webhook endpoint is reachable from GitHub.
- [ ] P15.M4 Install the private GitHub App on one selected repository.
- [ ] P15.M5 Show one successful live fast-lane PR check run.
- [ ] P15.M6 Show selected-repository scope rejecting or ignoring a non-selected repository.
- [ ] P15.M7 Show deep-scan default behavior in GitHub UI: disabled, denied, or manually triggered with quota proof.
- [ ] P15.M8 Show cost ceilings or budget-mode controls in the live path.
- [ ] P15.M9 Apply a warn-first scanner rollout to the selected low-risk repository.
- [ ] P15.M10 Observe live stability and budget evidence before promotion.
- [ ] P15.M11 Verify runtime-policy rollback and record rollback timing.
- [ ] P15.M12 Show scanner-pack promotion evidence only after 10 representative runs or 7 observation days.
- [ ] P15.M13 Show Pack 1 to Pack 3 rollout-order evidence.

**Proof:** CDK deployment output, Parameter Store evidence, GitHub App installation evidence, live webhook and PR check evidence, scope/budget/deep-lane evidence, rollout evidence, rollback timing, and scanner-pack promotion evidence.

---

## P16 — Documentation and Demo Readiness `[manual proof pending]`

**Goal:** Prove the docs and runbooks work against the live demo and an incident rehearsal.

**Tasks:**
- [ ] P16.M1 Run the five-minute demo script end-to-end against the live selected repository without manual patching.
- [ ] P16.M2 Show the demo includes a blocking `PRPilot Fast` result, branch-protection block, fix, passing result, and merge.
- [ ] P16.M3 Rehearse one incident scenario using `docs/operations-runbook.md`.
- [ ] P16.M4 Record the incident timeline using `docs/incident-rehearsal.md`.
- [ ] P16.M5 Show recovery-drill or DLQ-replay evidence used during rehearsal.

**Proof:** Demo recording or notes, GitHub PR evidence, runbook rehearsal notes, incident timeline, and recovery or DLQ evidence.

---

## P17 — CI/CD `[manual proof pending]`

**Goal:** Prove GitHub Actions validation, OIDC deployment, and CI guards in live workflow runs.

**Tasks:**
- [ ] P17.M1 Configure repository variables `AWS_ROLE_TO_ASSUME` and `AWS_REGION`.
- [ ] P17.M2 Create or verify the AWS IAM role trusted by GitHub OIDC.
- [ ] P17.M3 Show one passing PR workflow run.
- [ ] P17.M4 Show one failing PR workflow run.
- [ ] P17.M5 Show one OIDC-based deploy workflow run.
- [ ] P17.M6 Show latency regression guard behavior.
- [ ] P17.M7 Show scanner-policy drift guard behavior.
- [ ] P17.M8 Show deterministic required-path guard behavior.
- [ ] P17.M9 Confirm GitHub Actions usage stays within free limits or document the self-hosted runner move.

**Proof:** GitHub Actions logs, AWS OIDC role assumption evidence, guard pass/fail logs, and CI usage evidence.

---

## Completion Rule

When every checkbox above is complete, update `codex-folder/codex/Progress.md` with the external proof summary before moving to the next phase.
