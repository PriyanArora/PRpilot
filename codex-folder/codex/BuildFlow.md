# Build Flow

> Phase done = checkpoint passes, not code written.
> Phase order is recommended, not a hard lock.
> Each phase has a **Proof** line describing what must be shown to call that phase complete.

## Mentor Output Contract (Applies To All Phases)
- Implement the requested phase or task directly when the user asks.
- Keep replies brief. If the student asks for the next step, give the next useful step for the requested phase plus one plain-language explanation.
- Assume the student has only built beginner JavaScript projects. Explain every new command, file, config key, and tool in plain language the first time it appears.
- When Codex changes code, use lightweight step proof when appropriate. Do not run `npm run typecheck` after every step; run it at meaningful proof points unless the student explicitly requests it earlier. Only ask for manual proof when the evidence is outside the local workspace.
- Keep implementation scoped to the requested phase or task.
- For every phase Codex works on, create or update `P<N>_README.md` at the repo root in the same walkthrough style as P5-P8.

## Prerequisites
- Node.js 22 LTS and npm 10+
- Git and GitHub account with permission to create a private GitHub App
- AWS account using free-tier eligible services where possible
- AWS CLI configured for local development profile or SSO
- Prefer a public demo repository or self-hosted runners during CI work so GitHub-hosted Actions usage stays free
- Keep the first deployment scoped to repositories you control; do not plan for broad public install growth during the MVP
- Do not add dashboard, vector database, paid AI APIs, or always-on deep scans before the default fast lane is stable inside the cost ceiling

---

## P1 — Repo Setup `[phase]`
**Goal:** Monorepo foundation with TypeScript tooling, linting, and the baseline runtime and cost-control config surface
- [ ] Conventional initial commit
- [ ] .gitignore covers build artifacts, secrets, dependencies, and AWS artifacts
- [ ] Folder structure and package boundaries match ProjectSummary modules
- [ ] `.env.example` includes required runtime keys plus budget, cache, and limit keys
- [ ] `npm install`, `npm run lint`, and `npm run typecheck` pass
**Proof:** Show output of `npm run lint && npm run typecheck`, `git log --oneline -1`, `.gitignore`, `.env.example`, and `find apps packages infra tests -maxdepth 2 -type d | sort`.

## P2 — GitHub App Registration + Webhook Ingress `[phase]`
**Goal:** Receive pull request events from a private GitHub App with least privilege and a documented install scope
- [ ] GitHub App is created with least-privilege permissions
- [ ] Exact MVP webhook events and actions are documented
- [ ] Manual deep-lane trigger is documented as `check_run.requested_action`, with manual-only as the default
- [ ] Permission matrix and selected-repo installation scope are documented
- [ ] Webhook endpoint receives pull request events in local development
- [ ] Secrets and runtime-policy references come from env or Parameter Store, not hardcoded
- [ ] Self-host setup notes state that the app is installed only on repos the deployment owner controls
**Proof:** Show GitHub App settings, the documented permission and event matrix, terminal logs with a `pull_request` webhook payload, and the selected-repo installation-scope note.

## P3 — Security Foundation `[phase]`
**Goal:** Verify request authenticity, enforce basic selected-repo scope, and prevent duplicate processing with persistent delivery state
- [ ] X-Hub-Signature-256 verification is enforced
- [ ] Invalid signatures are rejected with safe error response
- [ ] Normalized webhook event contract is defined before dedupe or queue handoff work
- [ ] Basic `selected_repository_ids` allowlist rejects out-of-scope repositories before side effects
- [ ] Minimal DynamoDB `DELIVERY` item contract and conditional-write behavior are introduced for idempotency
- [ ] Delivery ID dedupe prevents repeated processing side effects for already-enqueued deliveries
- [ ] Dedupe state treats stale `RECEIVED` records without `ENQUEUED` transition as retryable, not permanently lost
- [ ] Queue-handoff abstraction failure path avoids acknowledging work that was not safely handed off; P6 wires the real SQS path
**Proof:** Show passing tests for valid signature, invalid signature, normalized payload validation, selected-repo rejection, duplicate delivery fixtures, retryable stale-`RECEIVED` delivery, and queue-handoff failure behavior.

## P4 — Rule Engine Core `[phase]`
**Goal:** Deterministic analysis pipeline for changed pull request files with a fast-lane-only default runtime
- [ ] Normalized input model for changed files is defined
- [ ] Default deployment-owner runtime-policy schema and loader contract are defined before scanner decisions
- [ ] Budget mode enum, scanner mode enum, lane enum, and fail-closed policy-load behavior are fixed
- [ ] Fast-lane trigger, admission, and input-envelope rules are defined before scanner work starts
- [ ] Supported-repo detection is hard-coded, not inferred loosely at runtime
- [ ] Deep-lane trigger, admission, and broader-context rules are documented separately as disabled-by-default stretch scope
- [ ] Deep-lane workspace materialization is documented to one implementation path if the stretch scope is later enabled
- [ ] Initial deterministic rules are implemented: `internal.large-change`, `internal.sensitive-file-change`, and `internal.lockfile-drift`
- [ ] Rule output includes severity, blockability, message, and file context
- [ ] Scanner adapter contract is defined so external tools emit the same finding and coverage schemas as internal rules
- [ ] MVP pull-request scanner catalog is defined: `eslint` (JS/TS repos only), `gitleaks`, and `actionlint`
- [ ] Deep or CI catalog is defined separately: `osv-scanner`, `zizmor`, `typos`, `markdownlint-cli2`, all off by default in the runtime path
- [ ] Deep-lane default outcome mode is hard-coded scanner by scanner
- [ ] Optional file-type-specific catalog is documented separately: `ast-grep`, `Conftest`, `KubeLinter`, `SQLFluff`, `Vale`, `Semgrep CE`, `ShellCheck`, `yamllint`, all opt-in only
- [ ] Governance or scheduled checks are separated from PR-worker runtime: `OpenSSF Scorecard`, `commitlint`, `Danger JS`
- [ ] AGPL or heavyweight scanners are excluded from the default runtime unless later justified: `TruffleHog`, `Syft`, `Grype`
- [ ] Default behavior is explicitly fast-lane only
- [ ] Scanner applicability rules say whether each scanner is diff-only, changed-file-only, or broader repo-context-only
- [ ] Fast-lane honesty rules define which partial-coverage cases are acceptable and which must become `action_required`
- [ ] Deep-lane advisory rules define how timeouts, scanner failures, and summary-only repo-wide findings are presented
- [ ] Unsupported, oversized, and degraded required-path outcomes are defined before check publication work starts
- [ ] GitHub UI contract for fast-lane vs deep-lane summaries, annotations, and rerun actions is documented
**Proof:** Run `npm test -- --runInBand` for rule and adapter-mapping tests, show sample structured finding plus coverage output, and show the scanner-catalog snapshot with lane, trigger, input scope, mode, enabled-by-default state, and blockability policy.

## P5 — GitHub Check Runs `[phase]`
**Goal:** Publish honest GitHub review results with bounded annotation volume
- [ ] P5 integration is explicitly scoped to the reusable check-publisher and may use a synchronous caller before P6 introduces SQS worker wiring
- [ ] Separate check-run identities are defined for `PRPilot Fast` and `PRPilot Deep`
- [ ] Check run is created or updated for pull request head SHA
- [ ] Integration tests pass
- [ ] Critical findings map to the `failure` conclusion
- [ ] Warn-only required-path runs stay passing, while degraded or operational-block runs map to `action_required` and do not masquerade as success
- [ ] Deep-lane clean runs stay non-blocking and deep-lane advisory or denied runs map to a non-required conclusion
- [ ] Annotation publishing handles GitHub's 50-annotations-per-request limit safely
- [ ] Default per-run annotation cap is enforced with summary fallback
- [ ] Summary sections distinguish blocking findings, advisory findings, coverage gaps, applied limits, and deep-scan availability
- [ ] Optional deep-lane manual action is exposed only when fast-lane coverage for the current SHA is honest
**Proof:** Open a test pull request and show synchronous-only P5 publisher proof for a failing fast-lane run (`failure`), a degraded or operational-block fast-lane case (`action_required`), and one optional deep-lane result or denial summary, plus annotation preview and cap behavior when findings exceed the inline limit.

## P6 — Async Queue Pipeline `[phase]`
**Goal:** Move analysis to asynchronous SQS worker processing with strict runtime and rerun controls
- [ ] Webhook handler enqueues jobs and returns quickly
- [ ] Queue-job contract includes lane, trigger, head SHA, and identity fields needed for deterministic worker execution
- [ ] Worker consumes queue and routes jobs by lane without mixing fast-lane and deep-lane policy
- [ ] Worker runs deterministic fast-lane analysis before any optional deep-lane work
- [ ] Retry and dead-letter queue behavior is configured and tested
- [ ] DLQ investigation and replay steps are documented and practiced
- [ ] Worker executes applicable scanners within strict timeout budgets and low scanner parallelism
- [ ] Fast-lane jobs supersede stale older SHAs and deep-lane jobs for stale SHAs are dropped before publish
- [ ] Deep-lane admission contract denies work while disabled and, if enabled, permits only one global deep-lane job with fast-lane priority
- [ ] Deep-lane admission is denied whenever fast-lane backlog or in-flight fast work exists
- [ ] Superseded jobs and manual reruns are throttled before unnecessary work is spent
- [ ] Worker performs a lightweight GitHub API head-SHA freshness check before publishing
- [ ] Failed freshness-check behavior is documented and maps to an operational required-path result or fail-closed alert
- [ ] Scanner timeout and crash handling differs correctly by lane: fast lane blocks honestly, deep lane reports advisory partial coverage
- [ ] Findings from all enabled scanners are normalized and published through one diff-aware annotation path
- [ ] Lane-specific quota denials are visible in the published check output
**Proof:** Show enqueue logs, worker processing logs, one forced failure routed to DLQ, manual DLQ investigation evidence, one run proving timeout handling does not crash the worker, one rerun-throttle or superseded-job example, and one deep-lane denial or execution example that leaves the fast-lane result unchanged.

## P7 — Persistence Layer `[phase]`
**Goal:** Expand DynamoDB persistence beyond the P3 delivery-idempotency record with minimal retention and a low-cost recovery story
- [ ] DynamoDB schema extends the P3 `DELIVERY` item type with run, attempt, quota-counter, and deep-lock item types
- [ ] The MVP persistence design is fixed to one DynamoDB table
- [ ] Duplicate deliveries are queryable for audit
- [ ] Stored run data includes delivery state transitions, timing, check conclusion, coverage summary, and TTL retention fields
- [ ] Counter updates and deep-lane lock acquisition use conditional or atomic writes
- [ ] Minimal-retention policy is documented and automatic expiry is configured
- [ ] Recovery drill uses a low-cost backup or restore path; PITR remains optional until justified by budget
**Proof:** Show DynamoDB query output for one pull request with at least two persisted runs, TTL fields, quota-counter or lock evidence, and evidence of the chosen low-cost recovery drill.

## P8 — Main Feature Validation `[phase]`
**Goal:** Required merge-gate behavior on real pull requests
- [ ] Selected real repository used for validation is documented
- [ ] One real pull request with blocking findings is reviewed end to end
- [ ] One clean or fixed pull request is reviewed end to end
- [ ] Required fast-lane check publishes inside the target window on at least 3 real runs
- [ ] Critical finding blocks merge through branch protection
- [ ] Passing fast-lane result allows merge after fixes
- [ ] One operational edge case is demonstrated, such as invalid config, unsupported repo, oversized run, or quota denial
- [ ] Optional deep-lane result or explicit disabled/denied state is shown without changing required fast-lane behavior
**Proof:** Show blocked merge on a failing check, successful merge after fixes or a clean PR, latency evidence from at least 3 real runs, and one honest operational or advisory edge-case result.

## P9 — Repository Policy Config `[phase]`
**Goal:** Support `.prpilot.yml` severity thresholds, quotas, and opt-in behavior per repository
- [ ] Repository config file is parsed and validated
- [ ] P4 deployment-owner runtime-policy schema is reused and validated before applying repo overrides
- [ ] Allowed enum values and path-precedence rules are fixed in the config contracts
- [ ] Config values alter rule behavior per repository
- [ ] Edge cases handled
- [ ] No regressions in primary feature
- [ ] Scanner policy controls are supported (`enabled`, `mode`, `timeout_ms`) with safe defaults
- [ ] Policy supports lane placement and rollout state (`fast|deep`, `warn-first` promotion flow)
- [ ] Policy distinguishes manual deep-scan opt-in from automatic deep-on-PR opt-in
- [ ] Per-repo quotas and deep-scan opt-in rules can be configured safely without breaking the default path
- [ ] Invalid repo config and disallowed lane promotions produce explicit non-pass results instead of silent fallback
- [ ] Repository policy cannot weaken deployment-owner hard caps or required security controls
**Proof:** Show two runs with different configs, one invalid config error output, one run where scanner mode changes from warn to block via policy only, one run where lane assignment is changed by config, one quota or opt-in policy example, one manual-vs-auto deep opt-in example, and one case proving repo config cannot override a deployment-owner cap.

## P10 — App Permission and Installation Hardening `[phase]`
**Goal:** Ensure only in-scope app installations are processed
- [ ] Previously documented permission matrix is enforced
- [ ] Events from installed repositories inside the selected scope are accepted safely
- [ ] Unauthorized or out-of-scope access is rejected safely
- [ ] Auth tests pass
- [ ] Fork pull-request context is handled safely without depending on `check_suite.pull_requests`
- [ ] Installation-scope rules and any optional per-instance caps are reflected in the authorization path
**Proof:** Show tests and logs for accepted installed-repository events, accepted fork pull-request events from an installed base repository, rejected non-installed events, and installation-scope enforcement evidence.

## P11 — Optional Local Preflight CLI `[phase]`
**Goal:** Add optional local deterministic checks so some review load can stay off the deployed path
- [ ] Works end-to-end
- [ ] CLI resolves merge-base and changed-file input without relying on deployed webhook context
- [ ] External failure handled
- [ ] CLI exit code semantics validated
- [ ] Output encourages local use as a cost-saving preflight step without diverging from deployed results
- [ ] CLI output discloses that PRPilot-owned baseline ESLint config may differ from the repository's own ESLint setup
**Proof:** Run CLI on a sample repository, show summary output, and show exit code `1` on critical findings and `0` on pass.

## P12 — Infrastructure as Code `[phase]`
**Goal:** Codify the AWS system with repeatable CDK stacks before live hardening
- [ ] CDK defines Lambda, API Gateway, SQS, DynamoDB, IAM, and the minimal alarm set
- [ ] One live environment is required; extra environments are optional and justified
- [ ] Stack updates are reviewable before deploy
- [ ] Event source mappings, queue batch size, DLQ wiring, and concurrency limits reflect the lane contract
- [ ] Lambda reserved concurrency, TTL retention, log retention, and budget-related config are explicitly defined in IaC
- [ ] Stack outputs needed for webhook wiring and runtime config are surfaced for a self-host deployment
- [ ] Cloud resources used in earlier phases are brought under CDK control before live rollout
**Proof:** Show `cdk synth` and `cdk diff` output with expected resources only, including concurrency, TTL, log-retention, limit settings, and deployment outputs needed for webhook configuration.

## P13 — Reliability Hardening `[phase]`
**Goal:** Make retries, quotas, and runtime behavior safe under low-cost self-hosted traffic
- [ ] Idempotency behavior validated under repeated event load
- [ ] Queue retry policy and visibility timeout tuned for low traffic and bounded cost
- [ ] Minimal alarms are configured for failures, DLQ depth, throttling, and budget-mode transitions
- [ ] Concurrency settings and rerun throttles are validated under synthetic burst load
- [ ] Budget-aware runtime policy (`normal`, `conserve`, `emergency`) is documented and exercised using quota counters, not assumed live dollar-bill introspection
- [ ] Dollar-based budget response is documented as AWS Budgets alarm or deployment-owner runtime-policy intervention
- [ ] Lane-specific budget shedding order is validated: deny deep, reduce presentation, then block required-path gaps honestly
- [ ] Scanner timeout and scanner-failure handling maps to actionable runbook steps
- [ ] Oversized-run, unsupported-repo, quota-exhaustion, and partial-coverage runbook paths are documented and tested
- [ ] GitHub failed-delivery redelivery runbook is documented and practiced
- [ ] License-boundary checks are documented for AGPL and GPL scanner execution paths
**Proof:** Show synthetic load test output, alarm transitions for injected failure, throttling behavior under burst conditions, budget-mode transition evidence, rerun-throttle evidence, one oversized or quota-exhaustion handling example, GitHub failed-delivery redelivery evidence, and license-boundary runbook notes.

## P14 — Free-Tier-Safe Observability and Performance `[phase]`
**Goal:** Measure and improve webhook-to-check completion latency without adding expensive telemetry
- [ ] Measurable latency improvement is shown
- [ ] Core logs, metrics, and alarms are visible without requiring rich paid observability products
- [ ] Graceful when optional observability layers are absent
- [ ] Alarm thresholds are defined and mapped to operational actions
- [ ] Per-scanner runtime and finding-volume metrics are captured for enabled lanes
- [ ] Lane-admission, lane-denial, and coverage-gap metrics are captured separately for fast lane and deep lane
- [ ] Pack-level budgets are measured for Pack 1 and any enabled deep-lane runs
- [ ] Retention and metric volume stay within the free-tier-safe observability plan
**Proof:** Show before and after latency metrics at minimum p50 and p95, alarm coverage, one log query or CloudWatch console view if used, per-scanner timing breakdown, and pack-level budget report.

## P15 — Self-Hosted Deployment Validation `[phase]`
**Goal:** Deploy a secure live runtime in a user-owned AWS account and prove the private GitHub App flow end to end
- [ ] Live endpoint is reachable
- [ ] All core fast-lane functionality works in the live environment
- [ ] Secrets and config stay in host environment or Parameter Store only
- [ ] Selected-repo scope, deep-scan defaults, and cost ceilings are enforced live
- [ ] Optional deep-lane manual trigger either works or shows an explicit disabled/denied state without altering required fast-lane merge behavior
- [ ] High-risk rule changes use staged rollout with tested rollback path and runtime-policy-first rollback
- [ ] New scanner packs are rolled out in warn mode first and promoted only after the documented warn-first observation window plus stability and budget checks
- [ ] Pack rollout order is enforced (Pack 1 baseline, then opt-in Pack 2, then opt-in Pack 3)
**Proof:** Show live webhook health, a successful live fast-lane pull request check run, one live optional deep-lane result or denial, selected-repository scope or budget-mode evidence, staged rollout plus rollback evidence, one scanner pack promotion record, and rollout-order evidence.

## P16 — Documentation and Demo Readiness `[phase]`
**Goal:** Produce self-host onboarding docs and operator runbooks
- [ ] Setup guide covers local and live self-host environments
- [ ] Private GitHub App creation and AWS credential expectations are documented
- [ ] Security, cost-control, and reliability architecture are documented
- [ ] Docs explain queue contract, persistence model, policy precedence, and GitHub check behavior clearly enough for a fresh implementer
- [ ] Demo script validates the full primary user flow
- [ ] Operations runbook includes recovery, secret rotation, and approaching-limits policy
- [ ] Incident rehearsal is executed and timeline is recorded
**Proof:** Run demo script end-to-end without manual patching, show docs sections, and show incident or recovery rehearsal evidence.

## P17 — CI/CD `[phase]`
**Goal:** Automated test and deployment workflows with OIDC cloud auth and free-tier-aware usage
- [ ] Push triggers test run
- [ ] Merge to main triggers deploy or an explicitly gated live deploy path
- [ ] Failed tests block deploy
- [ ] OIDC federation to AWS replaces static cloud credentials
- [ ] Latency regression guard blocks deploy when baseline degrades beyond the documented tolerance rule
- [ ] Scanner policy drift guard blocks deployment when enforced scanner baseline is unintentionally changed
- [ ] CI verifies required-check path remains deterministic and non-AI
- [ ] Workflow job boundaries keep PR validation cheap and deploy steps gated
- [ ] CI usage stays within free GitHub Actions limits or is moved to a self-hosted runner
**Proof:** Show GitHub Actions logs for passing and failing pull requests, deployment job using AWS OIDC role assumption, latency-guard behavior, scanner-policy drift guard behavior, deterministic non-AI guard behavior, and evidence that the chosen CI path stays within the free-tier plan.
