# Progress

**Active Phase:** P14 — Free-Tier-Safe Observability and Performance (available on request; prior live proof pending)
**Requested Phase Rule:** The user may ask Codex to work on any phase even when earlier proof is pending.
**Immediate Next Step:** P14.0 — Walk through CloudWatch logs, metrics, alarms, cardinality, retention, and free-tier cost controls before adding observability.
**Project Category:** systems
**Last Updated:** 2026-06-06
**Session Notes:** Flexible phase navigation is enabled. P13 local implementation adds reliability hardening helpers for bounded retry policy, low-concurrency validation, synthetic burst simulation, quota-driven budget-mode transitions, lane-specific budget shedding, alarm action mapping, runbook outcome mapping, AGPL/GPL execution boundaries, local integration tests, and `P13_README.md`. External P5 GitHub PR proof, live P6 AWS/GitHub proof, live P7 DynamoDB proof, P8 live validation proof, P9 live repository-policy PR proof, P10 live authorization proof, P11 real-repo preflight comparison, P12 live AWS diff/deploy proof, and P13 live reliability proof remain tracked in `MANUAL_TASKS_CHECKLIST.md`.

> Current action rule: work on the phase or task the user requests. Earlier incomplete proof does not block later phase work.
> When the student asks "what's next" or runs `/phase-check`, answer with the next useful unchecked step for the active or requested phase plus one plain-language explanation only.
> Never mark a checkbox complete without concrete proof.
> Local proof can be verified directly by Codex. Use lightweight step proof during intermediate steps. Do not run `npm run typecheck` after every step; run it at meaningful proof points unless the student explicitly asks for it earlier. External proof still must be shown by the student.
> For every phase Codex works on, create or update the matching root walkthrough file `P<N>_README.md`.

---

## How To Use This File
- Read the active phase and any user-requested phase.
- Before starting substantial new code work, prefer a phase branch.
- Use branch names in the form `feat/pN-short-phase-name`, such as `feat/p3-security-foundation`.
- Work on the requested phase or task, even if earlier external proof is pending.
- Keep prior incomplete proof marked pending.
- If the student asks for explanation, explain the requested step in plain beginner language.
- When Codex changes code, use lightweight step proof when appropriate and report the result. Reserve `npm run typecheck` for meaningful proof points unless the student explicitly asks for it earlier.
- If the student explicitly says "check it", run the local verification command yourself.
- When a phase first uses a new external service, cloud primitive, GitHub API surface, or major mechanism, add and complete a setup walkthrough step before implementation. The walkthrough must explain what the service does, why this project needs it, the minimum safe configuration, local proof, and what not to build yet.
- Do not mark a phase complete until every checkbox in that phase is `[x]` and the proof is demonstrated.
- At the end of a phase, run the required proof commands when available and update the matching `P<N>_README.md`.

---

## G0 — Project Setup `[complete]`
**Goal:** Lock project direction, generate project-specific codex files, and remove setup placeholders.

**Steps:**
- [x] G0.1 Confirm project name, problem, and category
- [x] G0.2 Confirm developer background and learning goals
- [x] G0.3 Confirm architecture direction and hosting posture
- [x] G0.4 Confirm MVP scope, repo scope, and red lines
- [x] G0.5 Confirm security, cost, and DevOps constraints
- [x] G0.6 Review and critique the generated project plan
- [x] G0.7 Fill the manifest with final project values
- [x] G0.8 Generate codex files from the approved manifest
- [x] G0.9 Remove placeholder values from generated codex files
- [x] G0.10 Delete unused root-level `ProjectSummary_*` template files

**Proof:** `codex-folder/codex/` files exist with project-specific content, `codex-folder/codex/_fill_manifest.md` has no placeholder values, and unused root `ProjectSummary_*` templates are absent.

---

## P1 — Repo Setup `[complete]`
**Goal:** Build the project foundation: branch hygiene, repo structure, config hygiene, workspace tooling, and baseline cost-control config.

**Steps:**
- [x] P1.1 Run `git status -sb` and confirm the branch is `feat/app/repo-setup`, not `main`
- [x] P1.2 If the branch is still `main`, create `feat/app/repo-setup`
- [x] P1.3 Re-run `git status -sb` and confirm the branch switch worked
- [x] P1.4 Create `.gitignore` at the repo root
- [x] P1.5 Add dependency ignore rules for `node_modules/`
- [x] P1.6 Add build and TypeScript artifact rules for `dist/`, `build/`, `coverage/`, and `*.tsbuildinfo`
- [x] P1.7 Add env-file rules for `.env` and `.env.*`, while keeping `.env.example` trackable
- [x] P1.8 Add AWS/CDK artifact rules for `cdk.out/`
- [x] P1.9 Add log, temp, and machine-noise rules such as `*.log`, `.DS_Store`, `.idea/`, and `.vscode/`
- [x] P1.10 Create top-level folders `apps/`, `packages/`, `infra/`, and `tests/`
- [x] P1.11 Create app folder for webhook ingress
- [x] P1.12 Create app folder for async worker processing
- [x] P1.13 Create package folder for shared config and runtime-policy loading
- [x] P1.14 Create package folder for GitHub integration helpers
- [x] P1.15 Create package folder for rule-engine and findings-domain code
- [x] P1.16 Create package folder for review-store and persistence helpers
- [x] P1.17 Create test folders for unit and integration seams
- [x] P1.18 Create `.env.example` at the repo root
- [x] P1.19 Add required runtime keys to `.env.example`: `AWS_REGION`, `GITHUB_APP_ID`, `GITHUB_WEBHOOK_SECRET_PARAM`, `GITHUB_PRIVATE_KEY_PARAM`, `PRPILOT_RUNTIME_POLICY_PARAM`, `DYNAMODB_TABLE_NAME`, and `SQS_QUEUE_URL`
- [x] P1.20 Add cache keys to `.env.example`: `PRPILOT_POLICY_CACHE_TTL_SECONDS` and `PRPILOT_SECRET_CACHE_TTL_SECONDS`
- [x] P1.21 Add budget, timeout, concurrency, and quota keys to `.env.example`
- [x] P1.22 Add retention, annotation-cap, and log-level keys to `.env.example`
- [x] P1.23 Convert the root `package.json` into an npm workspace root
- [x] P1.24 Add root scripts for `lint` and `typecheck`
- [x] P1.25 Add TypeScript config files needed for workspace typechecking
- [x] P1.26 Add lint config and lint dependencies needed for the repo root
- [x] P1.27 Run `npm install`
- [x] P1.28 Run `npm run lint`
- [x] P1.29 Run `npm run typecheck`
- [x] P1.30 Stage the repo-setup foundation files
- [x] P1.31 Create the first conventional commit for repo setup
- [x] P1.32 Show `git log --oneline -1` and confirm it matches `type(scope): desc`

**Proof:** Show passing output for `npm run lint && npm run typecheck`, show `git log --oneline -1`, show `.gitignore`, show `.env.example`, and show `find apps packages infra tests -maxdepth 2 -type d | sort`.

---

## P2 — GitHub App Registration + Webhook Ingress `[in progress]`
**Goal:** Register the private GitHub App with least privilege and prove local webhook ingress works.

**Steps:**
- [x] P2.1 Create the GitHub App shell in GitHub settings
- [x] P2.2 Set only the minimum metadata needed for the MVP app record
- [x] P2.3 Grant `Repository metadata` read permission
- [x] P2.4 Grant `Contents` read permission
- [x] P2.5 Grant `Pull requests` read permission
- [x] P2.6 Grant `Checks` write permission
- [x] P2.7 Keep broader repository and org permissions disabled
- [x] P2.8 Document the allowed webhook event set: `pull_request`, `check_suite`, `check_run`, `installation`, and `installation_repositories`
- [x] P2.9 Document the allowed `pull_request` actions: `opened`, `reopened`, `synchronize`, and `ready_for_review`
- [x] P2.10 Document the `check_suite.rerequested` fast-rerun rule
- [x] P2.11 Document the `check_run.requested_action` manual deep-scan rule
- [x] P2.12 Document the private-app installation scope and self-host ownership posture
- [x] P2.13 Document selected-repository scope and any per-instance installation guardrail
- [x] P2.14 Generate a webhook secret and keep it outside the repo
- [x] P2.15 Expose a local webhook endpoint with a tunnel
- [x] P2.16 Send a real GitHub `pull_request` event to local development
- [x] P2.17 Capture terminal logs showing the real `pull_request` payload reached the app
- [x] P2.18 Verify all secrets and runtime-policy references are env values or Parameter Store names only

**Proof:** Show the GitHub App settings, show the documented permission and event matrix, show local logs containing a real `pull_request` payload, and show the selected-repository installation-scope note.

---

## P3 — Security Foundation `[complete]`
**Goal:** Make webhook processing authentic, selected-repo scoped, idempotent, and safe under delivery failures.

**Steps:**
- [x] P3.1 Add a test case for a valid webhook signature
- [x] P3.2 Add a test case for an invalid webhook signature
- [x] P3.3 Enforce `X-Hub-Signature-256` verification in the ingress path
- [x] P3.4 Return a safe rejection response for an invalid signature
- [x] P3.5 Add a duplicate-delivery fixture using a repeated GitHub delivery ID
- [x] P3.5a Define the normalized webhook event shape produced by ingress before dedupe or queue handoff
- [x] P3.5b Add the minimal DynamoDB `DELIVERY` item contract for delivery idempotency
- [x] P3.5c Add a selected-repository allowlist fixture using `selected_repository_ids`
- [x] P3.5d Reject out-of-scope repository IDs before any queue or processing side effect
- [x] P3.6 Check delivery IDs in persistent delivery state before any processing side effects happen
- [x] P3.7 Reject already-enqueued duplicate deliveries without double-processing the event
- [x] P3.7a Allow retry for stale `RECEIVED` delivery records that never reached `ENQUEUED`
- [x] P3.8 Add a test case for queue-handoff abstraction failure; P6 wires the real SQS path
- [x] P3.9 Ensure accepted deliveries only return success after durable handoff succeeds
- [x] P3.10 Show all signature, payload-normalization, selected-scope, duplicate-delivery, stale-`RECEIVED`, and queue-handoff-failure tests passing

**Proof:** Show passing tests for valid signature, invalid signature, normalized payload validation, selected-repository rejection, duplicate delivery handling, stale-`RECEIVED` retry handling, and queue-handoff failure behavior that avoids a false `200` acknowledgment.

---

## P4 — Rule Engine Core `[complete]`
**Goal:** Build the deterministic findings pipeline and define the scanner catalog boundaries.

**Steps:**
- [x] P4.1 Define the normalized changed-file input model used by all rules
- [x] P4.2 Decide which file metadata every rule receives
- [x] P4.2a Define the default deployment-owner runtime-policy schema before scanner decisions
- [x] P4.2a-setup Walk through runtime-policy and Parameter Store concepts before defining the loader contract
- [x] P4.2b Define the runtime-policy loader contract, cache TTL behavior, and fail-closed behavior
- [x] P4.2c Fix allowed enum values for budget mode, scanner mode, and lane
- [x] P4.3 Define the fast-lane trigger and admission matrix
- [x] P4.4 Define the fast-lane input envelope and support-file allowlist
- [x] P4.4a Hard-code supported-repo detection to require root `package.json` plus root `package-lock.json`
- [x] P4.5 Document the deep-lane trigger and admission matrix as disabled-by-default stretch scope
- [x] P4.6 Document the deep-lane broader-context input envelope for later opt-in use
- [x] P4.6a Document deep-lane repo materialization as a GitHub tarball of the head SHA extracted into a temporary read-only workspace if the stretch scope is enabled
- [x] P4.7 Define the normalized finding output shape with severity, blockability, message, and file context
- [x] P4.8 Define the normalized coverage output shape with applicability, status, scope, and budget metadata
- [x] P4.9 Implement `internal.large-change`
- [x] P4.10 Implement `internal.sensitive-file-change`
- [x] P4.11 Implement `internal.lockfile-drift`
- [x] P4.12 Add unit tests that prove the rules emit the normalized finding and coverage shapes
- [x] P4.13 Define the scanner adapter contract that maps external tool output into the same finding and coverage schemas
- [x] P4.14 Define the fast-lane PR scanner catalog for `eslint`, `gitleaks`, and `actionlint`
- [x] P4.15 Define the deep or CI scanner catalog for `osv-scanner`, `zizmor`, `typos`, and `markdownlint-cli2`
- [x] P4.15a Hard-code all deep-lane default scanner outcomes to `warn-only` in the MVP
- [x] P4.16 Document the optional file-type-specific integrations: `ast-grep`, `Conftest`, `KubeLinter`, `SQLFluff`, `Vale`, `Semgrep CE`, `ShellCheck`, and `yamllint`
- [x] P4.17 Keep `OpenSSF Scorecard`, `commitlint`, and `Danger JS` out of the PR-worker runtime and document them as governance or scheduled tools
- [x] P4.18 Exclude `TruffleHog`, `Syft`, and `Grype` from the default runtime unless later justified
- [x] P4.19 Define scanner applicability rules for diff-only, changed-file-only, and broader repo-context scanners
- [x] P4.20 Define the unsupported-repo outcome
- [x] P4.21 Define the oversized-run outcome
- [x] P4.22 Define which fast-lane partial-coverage cases are allowed and which must become `action_required`
- [x] P4.23 Define how deep-lane partial coverage, denials, and repo-wide summary-only findings are reported
- [x] P4.24 Document the GitHub UI contract for fast-lane and deep-lane summaries, annotations, and rerun actions
- [x] P4.25 Show sample normalized findings and coverage JSON output
- [x] P4.26 Show the scanner-catalog snapshot and passing rule-engine tests

**Proof:** Show default runtime-policy contract tests, rule-engine and adapter-mapping unit tests passing for the three named internal rules, sample normalized findings and coverage JSON output, and the scanner-catalog configuration snapshot with lane, trigger, input scope, mode, enabled-by-default state, and blockability policy.

---

## P5 — GitHub Check Runs `[local implementation complete — external PR proof pending]`
**Goal:** Publish honest GitHub check results with the right conclusion and bounded annotation volume.

**Steps:**
- [x] P5.1 Define the check-run payload builder input
- [x] P5.1a Document that P5 proves the reusable publisher through a synchronous caller before P6 wires SQS worker invocation
- [x] P5.1b Walk through the GitHub Checks API lifecycle, required permissions, conclusions, annotations, and rerun surfaces before publishing
- [x] P5.2 Define separate check-run identities for `PRPilot Fast` and `PRPilot Deep`
- [x] P5.3 Define the deterministic GitHub check `external_id` format
- [x] P5.4 Create a fast-lane check run for the current PR head SHA through the synchronous P5 proof path
- [x] P5.5 Update the same fast-lane check run on a rerun instead of creating noisy duplicates
- [x] P5.6 Create or update the optional deep-lane check run without changing the fast-lane result
- [x] P5.7 Map critical fast-lane findings to the `failure` conclusion
- [x] P5.8 Map warn-only required-path fast-lane runs to a passing conclusion
- [x] P5.9 Map degraded or operational-block fast-lane runs to `action_required`
- [x] P5.10 Map clean deep-lane runs to a non-required passing conclusion
- [x] P5.11 Map deep-lane advisory findings, denials, and partial coverage to a non-required advisory conclusion
- [x] P5.12 Add integration tests for lane-specific conclusion mapping
- [x] P5.13 Rank annotations before truncation using blockability and lane priority
- [x] P5.14 Dedupe annotations by finding fingerprint and location before publishing
- [x] P5.15 Add annotation chunking that respects GitHub's 50-annotations-per-request limit
- [x] P5.16 Enforce the default total annotation cap per run
- [x] P5.17 Move overflow findings into the summary body when the inline cap is exceeded
- [x] P5.18 Split the summary into blocking findings, advisory findings, coverage gaps, and applied limits
- [x] P5.19 Expose the deep-scan action only when the current fast-lane result is honest and policy allows it
- [x] P5.20 Show a failing fast-lane PR run with `failure`
- [x] P5.21 Show a degraded or operational-block fast-lane run with `action_required`
- [x] P5.22 Show one optional deep-lane result or explicit denial

**Proof:** Open a test PR and show the synchronous-only P5 check-publisher lifecycle with expected conclusion for a failing fast-lane run (`failure`), a degraded or operational-block fast-lane case (`action_required`), one optional deep-lane result or denial summary, plus annotation preview, dedupe behavior, and cap behavior when findings exceed the inline limit.

---

## P6 — Async Queue Pipeline `[local implementation complete — external AWS/GitHub proof pending]`
**Goal:** Move review work into SQS worker processing with retries, DLQ handling, and strict runtime controls.

**Steps:**
- [x] P6.0 Walk through SQS, durable queue handoff, visibility timeout, retries, and DLQ concepts before wiring queue behavior
- [x] P6.1 Enqueue review jobs from the webhook handler
- [x] P6.2 Return the webhook response quickly after safe queue handoff
- [x] P6.3 Make the worker consume queued jobs
- [x] P6.4 Define the queue-job contract used between the webhook and worker
- [x] P6.5 Route jobs by lane without letting deep-lane work bypass fast-lane priority
- [x] P6.6 Configure retry behavior for failed jobs
- [x] P6.7 Configure the dead-letter queue
- [x] P6.8 Document how to inspect a failed DLQ message
- [x] P6.9 Practice replaying one failed message
- [x] P6.10 Enforce per-scanner timeout handling in the worker
- [x] P6.11 Keep scanner parallelism at the low-cost target
- [x] P6.12 Enforce explicit deep-lane denial while disabled and one active deep-lane job globally if enabled
- [x] P6.12a Deny deep-lane admission when any fast-lane job is in flight or visible in backlog
- [x] P6.13 Drop or supersede stale fast-lane jobs for older PR SHAs
- [x] P6.14 Drop or mark stale deep-lane jobs when a newer SHA exists
- [x] P6.14a Re-check the current PR head SHA through the GitHub Pulls API before publishing
- [x] P6.14b Treat failed freshness checks after bounded retries as an operational required-path result or fail-closed alert
- [x] P6.15 Throttle manual fast rerequests before work is spent
- [x] P6.16 Enforce deep-scan quota and denial behavior before optional work starts
- [x] P6.17 Publish all findings through one unified diff-aware annotation path
- [x] P6.18 Show enqueue logs, worker logs, DLQ evidence, timeout evidence, and one rerun-throttle, deep-denial, or superseded-job case

**Proof:** Show enqueue logs, worker processing logs, one routed DLQ failure case, manual DLQ investigation evidence, timeout-handling evidence from at least one scanner run, one GitHub API freshness-check supersession or failure-policy example, one rerun-throttle or superseded-job example, and one deep-lane denial or execution example that leaves the fast-lane result unchanged.

---

## P7 — Persistence Layer `[local implementation complete — external DynamoDB proof pending]`
**Goal:** Expand DynamoDB persistence beyond the P3 delivery-idempotency record with TTL retention and a low-cost recovery story.

**Steps:**
- [x] P7.0 Walk through the DynamoDB single-table model, partition keys, sort keys, TTL, conditional writes, and low-cost recovery before expanding persistence
- [x] P7.1 Lock the MVP persistence design to one DynamoDB table for delivery, run, attempt, counter, and lock items
- [x] P7.2 Extend the P3 `DELIVERY` item shape with full audit fields
- [x] P7.3 Define the key shape for `RUN` items
- [x] P7.4 Define the key shape for `ATTEMPT` items
- [x] P7.5 Define the key shape for `COUNTER` items used by quota tracking
- [x] P7.6 Define the key shape for the deep-lane `LOCK` item
- [x] P7.7 Add TTL fields for delivery, run, attempt, counter, and lock records
- [x] P7.8 Persist duplicate-delivery records for audit visibility
- [x] P7.9 Persist delivery state transitions
- [x] P7.10 Persist review timing metrics
- [x] P7.11 Persist final check conclusions, summary counts, and coverage metadata
- [x] P7.12 Persist applied limits, denial reasons, and budget-mode notes
- [x] P7.13 Implement atomic counter updates for per-day quota enforcement
- [x] P7.14 Implement deep-lane lock acquire, release, and expiry behavior
- [x] P7.15 Document the retention window for each record type
- [x] P7.16 Enable automatic expiry using TTL
- [x] P7.17 Choose the low-cost backup or restore path
- [x] P7.18 Rehearse one recovery drill
- [x] P7.19 Show query output for at least one PR with multiple runs plus related delivery or attempt records

**Proof:** Show DynamoDB query output for at least one PR with multiple runs, TTL fields, quota-counter or lock evidence, and evidence of the chosen low-cost recovery drill.

---

## P8 — Main Feature Validation `[walkthrough documented — live proof pending]`
**Goal:** Prove the full merge-gate behavior works on a real pull request.

**Steps:**
- [ ] P8.1 Choose the selected real repository used for validation
- [ ] P8.2 Open a real failing pull request, not a stubbed fixture-only path
- [ ] P8.3 Show the webhook reached the system on real data
- [ ] P8.4 Show the required deterministic check was published inside the target window
- [ ] P8.4a Measure webhook-to-check latency across at least 3 real runs
- [ ] P8.5 Show a critical finding blocks the merge
- [ ] P8.6 Fix the pull request
- [ ] P8.7 Show the fast-lane check passes after the fix
- [ ] P8.8 Show the merge succeeds after the fix
- [ ] P8.9 Show one optional deep-lane result or explicit denial on the same live path
- [ ] P8.10 Show one graceful failure-handling example for a bad case such as invalid config, unsupported repo, or oversized run

**Proof:** Show blocked merge on failing check, successful merge after fixes, latency evidence from at least 3 real runs, and one honest operational or advisory edge-case result.

---

## P9 — Repository Policy Config `[local implementation complete — external PR proof pending]`
**Goal:** Support safe per-repository policy overrides without weakening deployment-owner controls.

**Steps:**
- [x] P9.1 Reuse and validate the P4 deployment-owner runtime-policy schema before applying repository overrides
- [x] P9.2 Define the `.prpilot.yml` schema
- [x] P9.2a Hard-code the allowed enum values for `budget_mode`, `draft_behavior`, scanner `mode`, and scanner `lane`
- [x] P9.2b Hard-code repository path precedence so `include_paths` filters first and `ignore_paths` wins on overlap
- [x] P9.3 Load the deployment-owner runtime policy through the P4 loader path
- [x] P9.4 Parse the repository config file
- [x] P9.5 Validate the deployment-owner runtime policy
- [x] P9.6 Validate the repository config file
- [x] P9.7 Apply threshold configuration in rule evaluation
- [x] P9.8 Apply ignored-path and include-path configuration in rule evaluation
- [x] P9.9 Show clear output for an invalid repo config file
- [x] P9.10 Keep default behavior unchanged when the repo file is missing
- [x] P9.11 Add scanner policy controls for `enabled`
- [x] P9.12 Add scanner policy controls for `mode`
- [x] P9.13 Add scanner policy controls for `timeout_ms`, but only as a tighter cap
- [x] P9.14 Add lane-placement controls for fast vs deep behavior
- [x] P9.15 Add warn-first promotion controls
- [x] P9.16 Add manual deep-scan opt-in rules
- [x] P9.17 Add automatic deep-on-PR opt-in rules behind deployment-owner allowlists
- [x] P9.18 Add per-repo quota controls
- [x] P9.19 Reject disallowed lane promotions or hard-cap overrides explicitly instead of silently ignoring them
- [x] P9.20 Prove repository policy cannot override deployment-owner hard caps or required security controls
- [x] P9.21 Show the required proof cases with two repo configs and one deployment-owner-cap override rejection

**Proof:** Show two PR runs with different configs, one invalid-config error case, one scanner mode change applied by policy only, one lane assignment change by config, one quota or opt-in policy example, one manual-vs-auto deep opt-in example, and one case proving repo config cannot override a deployment-owner cap.

---

## P10 — App Permission and Installation Hardening `[local implementation complete — external GitHub proof pending]`
**Goal:** Process only in-scope installations and handle fork PR context safely.

**Steps:**
- [x] P10.1 Enforce the documented permission matrix in code or auth checks
- [x] P10.2 Resolve installation identity from every supported webhook event shape
- [x] P10.3 Accept events from installed same-repo repositories
- [x] P10.4 Resolve fork pull-request context safely without depending on `check_suite.pull_requests`
- [x] P10.5 Reject events from non-installed repositories
- [x] P10.6 Reject unauthorized access paths safely
- [x] P10.7 Validate `check_run.requested_action` events came from PRPilot-owned checks
- [x] P10.8 Reject stale or mismatched deep-scan action requests for older SHAs
- [x] P10.9 Keep authorization and permission tests passing
- [x] P10.10 Enforce installation-scope guardrails
- [x] P10.11 Enforce the selected-repository scope rules
- [x] P10.12 Show logs and tests for accepted, rejected, stale-action, and out-of-scope cases

**Proof:** Show test logs for installed same-repo events, installed fork pull-request events, rejected non-installed repository events, stale or mismatched deep-action rejections, and installation-scope enforcement evidence.

---

## P11 — Optional Local Preflight CLI `[local implementation complete — real-repo comparison pending]`
**Goal:** Add a local deterministic preflight command that mirrors deployed review logic closely enough to save runtime work.

**Steps:**
- [x] P11.1 Define the CLI entry point
- [x] P11.2 Parse a base-ref argument or resolve the repository default branch automatically
- [x] P11.3 Resolve the merge base for the current branch
- [x] P11.4 Collect local changed files for analysis
- [x] P11.5 Load local repo config using the same validation path as the deployed fast lane
- [x] P11.6 Run deterministic fast-lane rules on the local changes
- [x] P11.7 Reuse the deployed findings and coverage shapes in local output
- [x] P11.8 Keep the local summary aligned with the deployed check-run summary order
- [x] P11.8a Disclose that PRPilot baseline ESLint results may differ from the repository's own ESLint setup
- [x] P11.9 Return exit code `1` when critical findings exist
- [x] P11.10 Return exit code `1` when the CLI cannot perform an honest local fast-lane review
- [x] P11.11 Return exit code `0` when the preflight passes or only warns
- [x] P11.12 Show the CLI on one failing case and one passing case

**Proof:** Run the CLI on failing and passing cases, show summary output, and show exit codes.

---

## P12 — Infrastructure as Code `[local implementation complete — live AWS proof pending]`
**Goal:** Put the AWS system under CDK control before live hardening and deployment.

**Steps:**
- [x] P12.0 Walk through CDK, Lambda, API Gateway, SQS, DynamoDB, IAM, Parameter Store, CloudWatch logs, and AWS cost boundaries before creating infrastructure
- [x] P12.1 Create the CDK app entry point
- [x] P12.2 Define Lambda resources for webhook ingress and worker processing
- [x] P12.3 Define API Gateway for webhook ingress
- [x] P12.4 Define SQS and the dead-letter queue
- [x] P12.5 Set the queue batch size and event-source mapping to match the low-concurrency lane contract
- [x] P12.6 Define the DynamoDB table and TTL configuration
- [x] P12.7 Define the minimum IAM permissions needed
- [x] P12.8 Define the minimal alarm set
- [x] P12.9 Encode Lambda reserved concurrency in IaC
- [x] P12.10 Encode log retention in IaC
- [x] P12.11 Encode budget-related config and limits in IaC
- [x] P12.12 Surface Parameter Store names and runtime env values through the stack safely
- [x] P12.13 Keep one required live environment and treat extras as optional
- [ ] P12.14 Bring any previously created cloud resources under CDK control
- [x] P12.15 Show `cdk synth`
- [ ] P12.16 Show `cdk diff`
- [x] P12.17 Surface the stack outputs needed for self-host webhook wiring and runtime config

**Proof:** Show `cdk synth` and `cdk diff` with expected resource changes only, including queue wiring, concurrency, TTL, log-retention, limit settings, and the outputs needed for webhook configuration.

---

## P13 — Reliability Hardening `[local implementation complete — live reliability proof pending]`
**Goal:** Make retries, replays, concurrency, and budget-mode behavior safe under low-cost self-hosted traffic.

**Steps:**
- [x] P13.1 Run repeated-delivery tests or load that exercise idempotency
- [x] P13.2 Prove duplicate deliveries do not create duplicate side effects
- [x] P13.3 Tune queue visibility timeout
- [x] P13.4 Tune retry policy for bounded cost
- [x] P13.5 Configure alarms for failures, DLQ depth, throttling, and budget-mode transitions
- [x] P13.6 Run a synthetic burst test
- [x] P13.7 Validate webhook and worker concurrency settings under burst load
- [x] P13.8 Validate rerun throttles under burst load
- [x] P13.9 Define runtime policy modes: `normal`, `conserve`, and `emergency`
- [x] P13.10 Exercise at least one quota-counter-driven transition into each budget mode
- [x] P13.10a Document dollar-based budget response through AWS Budgets alarms or deployment-owner runtime-policy intervention
- [x] P13.11 Exercise the deep-lane deny path under conserve or emergency mode
- [x] P13.12 Map scanner timeout handling to a runbook step
- [x] P13.13 Map scanner failure handling to a runbook step
- [x] P13.14 Document the lane-specific budget-shedding order: deny deep, reduce presentation, then block required-path gaps honestly
- [x] P13.15 Map oversized-run handling to a runbook step
- [x] P13.16 Map unsupported-repo handling to a runbook step
- [x] P13.17 Map quota-exhaustion handling to a runbook step
- [x] P13.18 Map partial-coverage handling to a runbook step
- [x] P13.19 Document the GitHub failed-delivery redelivery procedure
- [ ] P13.20 Practice one failed-delivery redelivery
- [x] P13.21 Document AGPL and GPL execution boundaries for cautious tools
- [ ] P13.22 Show the full proof set for load, alarms, throttling, budget modes, redelivery, and license boundaries

**Proof:** Show load-test results, alarm trigger or clear behavior, throttling control under burst conditions, budget-mode transition evidence, rerun-throttle evidence, one oversized or quota-exhaustion handling example, one deep-lane deny example, GitHub failed-delivery redelivery evidence, and license-boundary runbook notes.

---

## P14 — Free-Tier-Safe Observability and Performance `[available on request]`
**Goal:** Measure and improve webhook-to-check latency without adding expensive telemetry.

**Steps:**
- [ ] P14.0 Walk through CloudWatch logs, metrics, alarms, cardinality, retention, and free-tier cost controls before adding observability
- [ ] P14.1 Add structured logs with delivery ID, repository, PR number, lane, head SHA, run status, and budget mode
- [ ] P14.2 Add low-cardinality metrics for core latency and failure counts
- [ ] P14.3 Expose the minimal alarm set without requiring rich paid observability products
- [ ] P14.4 Record baseline latency before optimization
- [ ] P14.5 Improve latency from that baseline
- [ ] P14.6 Record after-change latency with at least p50 and p95
- [ ] P14.7 Define threshold values for error, throttling, queue depth, latency, and budget-mode alarms
- [ ] P14.8 Map each alarm threshold to an operational action
- [ ] P14.9 Capture per-scanner runtime metrics
- [ ] P14.10 Capture per-scanner finding-volume metrics
- [ ] P14.11 Capture lane-admission, lane-denial, and coverage-gap metrics separately for fast lane and deep lane
- [ ] P14.12 Capture pack-level budget metrics for Pack 1 and any enabled deep-lane runs
- [ ] P14.13 Confirm log retention and metric volume stay within the free-tier-safe plan
- [ ] P14.14 Show one log query or CloudWatch console view if used

**Proof:** Show before/after latency values (including p50 and p95), alarm coverage, one log query or CloudWatch console view if used, per-scanner timing breakdown, lane-admission versus lane-denial metrics, and pack-level budget report.

---

## P15 — Self-Hosted Deployment Validation `[available on request]`
**Goal:** Deploy the live backend in a user-owned AWS account and prove it works with the private GitHub App.

**Steps:**
- [ ] P15.0 Walk through live AWS deployment, Parameter Store secret setup, GitHub App installation, selected-repo scope, and rollback posture before deploying
- [ ] P15.1 Deploy the live stack through IaC
- [ ] P15.2 Wire secure Parameter Store values into the runtime
- [ ] P15.3 Prove the live webhook endpoint is reachable
- [ ] P15.4 Install the private GitHub App on one selected repository
- [ ] P15.5 Validate end-to-end live PR review in that selected repository
- [ ] P15.6 Enforce selected-repository scope in the live path
- [ ] P15.7 Enforce deep-scan defaults in the live path
- [ ] P15.8 Enforce cost ceilings or budget-mode controls in the live path
- [ ] P15.9 Show one live optional deep-lane manual trigger or explicit disabled/denied deep-lane state in GitHub UI
- [ ] P15.10 Define the staged-rollout target repo and rollback trigger before changing live scanner behavior
- [ ] P15.11 Apply a warn-only rollout to the selected low-risk repo first
- [ ] P15.12 Observe live stability and budget evidence before promotion
- [ ] P15.13 Verify the rollback path works through runtime policy first
- [ ] P15.14 Measure rollback timing
- [ ] P15.15 Roll out a new scanner pack in warn mode first
- [ ] P15.16 Promote the scanner pack only after at least 10 representative live runs or 7 days of warn-first observation, plus stability and budget validation
- [ ] P15.17 Enforce rollout order from Pack 1 to Pack 3
- [ ] P15.18 Show live webhook health, live PR evidence, rollout evidence, and budget-mode or selected-repository scope evidence

**Proof:** Show live webhook health, a successful live fast-lane PR check run, one live optional deep-lane result or denial, selected-repository scope or budget-mode evidence, staged rollout evidence with rollback timing, one scanner-pack promotion record, and rollout-order evidence.

---

## P16 — Documentation and Demo Readiness `[available on request]`
**Goal:** Make the project demoable, explainable, and operable.

**Steps:**
- [ ] P16.1 Write the self-host quickstart guide
- [ ] P16.2 Document local setup prerequisites and local run commands
- [ ] P16.3 Document live deployment prerequisites and AWS expectations
- [ ] P16.4 Write the private GitHub App and user-owned AWS setup guide
- [ ] P16.5 Document the security architecture
- [ ] P16.6 Document the cost-control architecture
- [ ] P16.7 Document the reliability architecture
- [ ] P16.8 Document queue, persistence, and policy-precedence behavior in plain language
- [ ] P16.9 Write the five-minute demo script
- [ ] P16.10 Run the demo script end-to-end without manual patching
- [ ] P16.11 Write the operations runbook
- [ ] P16.12 Document the recovery drill
- [ ] P16.13 Document the secret rotation procedure
- [ ] P16.14 Document the "approaching limits" policy
- [ ] P16.15 Rehearse one incident scenario using the runbook
- [ ] P16.16 Record the incident timeline and evidence

**Proof:** Present docs sections, run the full demo script once without manual patching, and show incident or recovery rehearsal evidence.

---

## P17 — CI/CD `[available on request]`
**Goal:** Automate testing and deployment with OIDC cloud auth and free-tier-aware usage.

**Steps:**
- [ ] P17.0 Walk through GitHub Actions, workflow triggers, job boundaries, secrets, AWS OIDC role assumption, and free-tier limits before adding CI/CD
- [ ] P17.1 Create the pull-request workflow
- [ ] P17.2 Add the Node setup and dependency-install job steps used by PR validation
- [ ] P17.3 Run lint on every PR
- [ ] P17.4 Run typecheck on every PR
- [ ] P17.5 Run tests on every PR
- [ ] P17.6 Block deploy when tests fail
- [ ] P17.7 Create the deploy workflow or explicit live-deploy path
- [ ] P17.8 Use AWS OIDC role assumption instead of static cloud credentials
- [ ] P17.9 Store or update the latency baseline artifact used by the regression guard
- [ ] P17.10 Add the latency regression guard tied to the established baseline and documented tolerance rule
- [ ] P17.11 Store the enforced scanner-registry baseline snapshot used by drift detection
- [ ] P17.12 Add the scanner-policy drift guard tied to the enforced scanner baseline
- [ ] P17.13 Add the deterministic non-AI guard for the required-check path
- [ ] P17.14 Keep PR validation jobs separate from deploy jobs so the default CI path stays cheap
- [ ] P17.15 Confirm CI usage stays within free GitHub Actions limits or move the path to a self-hosted runner
- [ ] P17.16 Show passing and failing workflow runs plus each guard in action

**Proof:** Show GitHub Actions logs for passing and failing PRs, an OIDC-based deploy run, latency regression guard behavior, scanner-policy drift guard behavior, deterministic non-AI guard behavior, and evidence that the chosen CI path fits the free-tier plan.
