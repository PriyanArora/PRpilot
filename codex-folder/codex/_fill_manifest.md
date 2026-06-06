# Fill Manifest
# Generated during G0.6. This is the single source of truth for all file generation.
# Codex writes this FIRST, user reviews and corrects HERE, then Codex fills all templates from this.
# Do not touch any template file until this manifest is confirmed by the user.

---

## IDENTITY
name: PRPilot
tagline: Self-hosted GitHub App that reviews pull requests before human review for student and early-career developers.
problem: Junior developers submit pull requests with avoidable quality and security issues, which increases review cycles and slows delivery. Existing linters catch syntax but miss many practical review concerns like missing error handling and risky changes. This project provides fast, structured pull request feedback directly inside GitHub before reviewer time is spent, while letting each user run the system in their own AWS account.
type: portfolio + learning
category: systems
core_constraint: The app must publish a required deterministic GitHub check run within 60 seconds for normal pull requests, return the webhook response inside GitHub's 10-second delivery window, and default to free-tier-aware behavior before it spends its way out of small self-hosted operation.

---

## DEVELOPER
dev_name: Priyan Arora
dev_level: beginner
dev_knows: JavaScript fundamentals, basic Git and GitHub workflows, beginner React
dev_gaps: TypeScript, backend architecture, AWS services, test design, production DevOps practices
dev_goal: Build and deploy a secure self-hosted GitHub App on AWS with CI/CD, reliability controls, and tests without copying implementation from an assistant.

---

## TECH STACK
| Layer | Technology | Host |
|-------|-----------|------|
| App Runtime | Node.js 22 + TypeScript (Hono optional for ingress ergonomics) | AWS Lambda |
| API Ingress | API Gateway HTTP API + Lambda webhook handler | AWS |
| Queue | Amazon SQS + dead-letter queue | AWS |
| Data Store | Amazon DynamoDB with TTL retention | AWS |
| Secrets | AWS Systems Manager Parameter Store (SecureString) + KMS | AWS |
| Runtime Policy | Standard AWS Systems Manager Parameter Store + local TTL cache | AWS |
| Observability | CloudWatch Logs, low-cardinality Metrics, minimal Alarms | AWS |
| IaC | AWS CDK (TypeScript) + NodejsFunction bundling | AWS |
| Package Management | npm workspaces | local + GitHub Actions |
| Validation | Zod | local + AWS Lambda |
| GitHub Integration | @octokit/app + @octokit/rest + @octokit/webhooks | GitHub |
| Scanner Orchestration | eslint, gitleaks, actionlint, osv-scanner, zizmor, typos, markdownlint-cli2, ast-grep, Conftest, KubeLinter, SQLFluff, Vale, Semgrep CE, ShellCheck, yamllint, OpenSSF Scorecard, commitlint, Danger JS | AWS Lambda worker + CI |
| Testing | Vitest + integration tests with webhook fixtures | local + GitHub Actions |
| CI/CD | GitHub Actions with OIDC federation to AWS, keeping within free usage or using self-hosted runners | GitHub + AWS |

---

## COMMIT CONFIG
scopes: app, webhook, checks, rules, queue, worker, db, infra, ci, security, docs, tests
tdd_targets: verifyWebhookSignature, dedupeDeliveryEvent, evaluateRuleSet, buildCheckRunPayload
docker_phase: not used in MVP
ci_phase: 17

---

## ARCHITECTURE DECISIONS
D1_title: GitHub App first, dashboard deferred
D1_decision: Ship a GitHub App that posts required check runs before adding any browser dashboard or local inspect UI.
D1_why: This minimizes scope, keeps the useful workflow inside GitHub, and avoids adding non-essential product surface before the core review path works.

D2_title: Deterministic rules first, AI optional plugin
D2_decision: Core analysis is rule-based and fully functional without paid model APIs.
D2_why: Ensures low-cost operation, predictable behavior, and easier testing for a beginner.

D3_title: AWS-native async pipeline
D3_decision: Use API Gateway plus Lambda for ingress and SQS plus worker Lambda for asynchronous processing.
D3_why: Aligns with target employers that use AWS and demonstrates cloud architecture fundamentals without requiring always-on servers.

D4_title: Security by default
D4_decision: Enforce webhook signature verification, idempotency on delivery IDs, least-privilege app permissions, and OIDC-only cloud auth in CI.
D4_why: Reduces attack surface and shows disciplined engineering habits even in a small self-hosted tool.

D5_title: Free-tier-aware self-hosted operating model
D5_decision: Treat low-cost per-instance operation as a primary architecture constraint and shed optional work before expanding infrastructure or scanner scope.
D5_why: The project must be realistic for a user deploying PRPilot into their own AWS account instead of assuming centralized spend.

D6_title: Low-cost recovery over enterprise durability
D6_decision: Use TTL retention, explicit restore drills, and targeted backup steps first; enable PITR only if it still fits the budget later.
D6_why: Reliability matters, but always-on premium recovery settings are not justified by default for a small self-hosted deployment.

D7_title: Runtime degradation controls
D7_decision: Rule execution supports runtime disable controls, budget mode, and quota policy through a Standard Parameter Store policy document, not Lambda env-var edits.
D7_why: Allows fast containment when a rule causes latency spikes, noisy findings, or spend growth without forcing a redeploy.

D8_title: Fast-lane-only default path
D8_decision: PR processing defaults to Pack 1 only; deep scans are manual or opt-in later, and required-path gaps must become explicit operational results rather than false passes.
D8_why: Preserves the core review loop while preventing slow or expensive scanners from becoming the default runtime burden.

D9_title: License-aware tool boundary
D9_decision: Treat AGPL or heavyweight tooling as external execution integrations only unless explicit compliance review approves tighter coupling.
D9_why: Preserves distribution flexibility and avoids accidental licensing or runtime-footprint problems.

D10_title: Non-AI required-check guarantee
D10_decision: Required merge-check decisions are computed only from deterministic tools and internal rules.
D10_why: Keeps review outcomes explainable, testable, and free from AI latency or pricing dependencies.

D11_title: JS/TS-first MVP scope
D11_decision: The first supported repository class is Node.js or TypeScript repositories with npm lockfiles and GitHub Actions workflows.
D11_why: Matches the strongest tool support in the smallest deterministic scanner set and prevents premature multi-language sprawl.

D12_title: Private GitHub App per deployment
D12_decision: Each self-hosted deployment uses its own private GitHub App installed only on repos the deployment owner controls.
D12_why: Removes the need for a shared marketplace-style app and prevents one central account from becoming the bottleneck.

D13_title: Free-tier-safe observability
D13_decision: Prefer structured logs, low-cardinality metrics, and a minimal alarm set over rich dashboards or tracing.
D13_why: Gives enough signal to operate the app without turning observability into the largest bill.

D14_title: Minimal retention
D14_decision: Keep only short-lived idempotency records and capped run summaries by default, with TTL-based expiry.
D14_why: Debugging value matters, but long retention and raw artifact storage are not justified in the MVP.

D15_title: Deployment-owner policy outranks repo policy
D15_decision: Parameter Store runtime policy sets hard caps, emergency disables, and scanner availability; `.prpilot.yml` may only narrow scope or opt into already-enabled behavior.
D15_why: Prevents individual repositories from weakening deployment-owner safety controls or spending rules.

D16_title: Early permission and event-scope lock
D16_decision: Document the exact webhook actions and minimum GitHub App permissions before webhook wiring begins.
D16_why: Prevents permission creep and avoids reworking the app registration after implementation has started.

D17_title: Deep lane designed but non-blocking for MVP
D17_decision: Keep deep-lane contracts documented, disabled by default, and satisfied through explicit denial behavior unless the owner opts into the stretch implementation.
D17_why: Preserves portfolio-quality architecture without making optional distributed-systems complexity block the beginner fast-lane MVP.

---

## OPERATING LIMITS
monthly_spend_target: 0 to 5 USD per self-hosted instance
monthly_spend_hard_cap: 10 USD per self-hosted instance without explicit deployment-owner approval
max_installations_default: 5 selected installations per self-hosted instance
max_installations_hard_cap: 10 selected installations per self-hosted instance
max_active_repos_default: 3 review-enabled repos per self-hosted instance
max_active_repos_hard_cap: 5 review-enabled repos per self-hosted instance
max_fast_lane_runs_per_day_default: 20 total, 10 per repo
max_fast_lane_runs_per_day_hard_cap: 50 total, 20 per repo
max_manual_reruns_per_pr_per_day: 2 default, 3 hard cap
max_deep_scans: disabled by default, at most 1 manual deep scan per repo per day
worker_reserved_concurrency: 1 default, 2 hard cap
scanner_parallelism: 1 default, 2 hard cap
annotation_cap_per_run: 20 default, 30 hard cap
log_retention_days: 7 default
run_record_ttl_days: 30 default
idempotency_ttl_days: 7 default
approaching_limit_policy: enter conserve mode from PRPilot-owned quota counters, reduce annotation cap, deny deep scans, and throttle reruns before adding spend
hard_limit_policy: keep the smallest honest deterministic fast lane or publish an explicit blocking operational result rather than scaling further automatically

---

## DATA / STRUCTURE

### web: Models
model_1: not applicable
model_2: not applicable

### systems: Modules
module_1: webhook-ingress | input: GitHub webhook HTTP request headers and payload | transform: verify signature, normalize payload, apply selected-repo installation-scope and quota guard, and hand off only accepted work | output: normalized event record and queue message or explicit operational response
module_2: dedupe-guard | input: delivery ID plus pull request identity, SHA, and delivery state | transform: reject duplicate deliveries and superseded queued work safely while allowing retry for stale RECEIVED records that never reached ENQUEUED | output: duplicate, retryable, superseded, or fresh-work decision
module_3: rule-engine | input: pull request file list and patch metadata | transform: evaluate deterministic quality and risk rules | output: normalized findings with severity, blockability, and summary
module_4: scanner-orchestrator | input: normalized changed-file set plus scanner policy | transform: execute default fast-lane scanners and optional deep scans by lane with timeout, concurrency, and quota controls | output: normalized scanner findings merged with deterministic rules
module_5: check-publisher | input: findings, budget mode, and pull request context | transform: map findings to GitHub check run conclusion, cap annotations, and fall back to summary-only publishing when needed | output: GitHub check run creation or update request
module_6: review-store | input: event metadata and review result | transform: persist keyed records, delivery states, status transitions, and TTL values | output: queryable review history in DynamoDB
module_7: runtime-policy | input: Parameter Store policy document name | transform: load and cache mitigation overrides, budget mode, installation-scope limits, and rerun limits | output: current runtime policy snapshot

### creative: Screens + Systems
screen_1: not applicable
screen_2: not applicable
system_1: not applicable
system_2: not applicable

---

## SEED / FIXTURES / TEST DATA
strategy: Use captured and sanitized GitHub webhook fixture payloads for pull_request opened, synchronize, and rerequested events. Keep at least 10 fixtures for happy path, malformed signature, duplicate delivery, rerun throttle, and large diff cases. Integration tests are idempotent by using synthetic delivery IDs per test run.

---

## CORE LOGIC
logic: Receive webhook and verify signature, reject invalid requests immediately, normalize payload into the ingress event contract, reject out-of-scope repository IDs through selected_repository_ids, dedupe by delivery ID in persistent DELIVERY state, allow retry for stale RECEIVED records that never reached ENQUEUED, reject or defer events that exceed installation-scope or rerun policy, persist received state, enqueue event to SQS, return within GitHub's delivery window only after durable handoff succeeds, worker fetches pull request file data, load runtime policy from Parameter Store, apply deployment-owner-over-repo policy precedence, run deterministic rules plus only the enabled fast-lane scanners by default, re-check the PR head SHA through GitHub API before publishing, apply timeout, concurrency, oversized-run, and annotation caps, build severity summary and conclusion, publish check run with safe annotation chunking or summary-only fallback, turn any dishonest required-path gap into an explicit operational block instead of a pass, persist result and timing metrics with TTL retention, expose rerun path for check_suite rerequested within throttle limits, and maintain a runbook for failed GitHub delivery redelivery.

---

## FEATURES
feature_1: Verify and ingest GitHub pull request webhooks securely
feature_2: Run deterministic PR quality rules and severity scoring
feature_3: Publish required GitHub check run with pass or fail conclusion
feature_4: Add capped actionable line-level annotations for flagged files
feature_5: Deduplicate repeated webhook deliveries safely
feature_6: Asynchronous processing with queue retries and DLQ handling
feature_7: Persist short-lived review history and processing metadata in DynamoDB
feature_8: Optional local preflight CLI command after MVP
feature_9: Integrate deterministic scanner packs through normalized finding adapters
feature_10: Enforce scanner policy modes block, warn, and annotate-only with staged rollout controls
feature_11: Enforce installation-scope limits, per-repo quotas, rerun throttling, and budget modes
feature_12: Keep default behavior fast-lane only, with deep scans manual or opt-in later
feature_13: Support runtime mitigation overrides from Parameter Store without redeploy
feature_14: Maintain GitHub failed-delivery redelivery procedure and evidence
feature_15: Keep observability and retention intentionally small enough for free-tier-aware operation
feature_16: Prevent repository policy from overriding deployment-owner caps, safety invariants, or required-path honesty rules
feature_17: Map required-path operational blocks to explicit GitHub check conclusions and fail closed if check publication is unavailable

---

## ROUTES / ENTRY POINTS / SCREENS

### web: Routes
public_routes:
  - not applicable

auth_routes:
  - not applicable

protected_routes:
  - not applicable

### systems: Entry Points
entry_1: POST /webhooks/github | API trigger | receives GitHub events, verifies signature, enqueues accepted events, and rejects or throttles over-limit requests
entry_2: SQS review-jobs queue | event trigger | runs fast-lane rule analysis and publishes GitHub check runs
entry_3: check_suite.rerequested webhook event | event trigger | requeues a fresh fast-lane analysis for a pull request if rerun policy allows it
entry_4: prpilot preflight | optional CLI command | runs local deterministic checks before push
entry_5: installation + installation_repositories | control-plane webhook events | updates installation-scope state without triggering analysis

### creative: Screens
# Already covered in DATA/STRUCTURE section above

---

## RED LINES
redline_1: No paid-only dependency is required for core MVP behavior.
redline_2: No hardcoded secrets, private keys, or tokens in repository history.
redline_3: No merge-blocking decision without an explainable deterministic finding.
redline_4: No skipped signature verification or idempotency handling in live code.
redline_5: No long-lived AWS credentials in CI; OIDC federation only.
redline_6: No accepted webhook delivery may be acknowledged before durable queue handoff guarantees are satisfied.
redline_7: No default self-hosted behavior may require deep scans, browser dashboards, tracing, or paid analytics.
redline_8: No secret rotation policy may be omitted for GitHub App credentials.
redline_9: No required-check decision may depend on non-deterministic or paid-only scanner behavior.
redline_10: Codex must never apply implementation code before the user has received the current-step explanation and explicitly approved Codex to do that step.
redline_11: Codex help sequence must stay current step first, explanation second, explicit approval third, scoped implementation fourth, proof/report fifth.
redline_12: No runtime mitigation promise may depend only on Lambda environment-variable edits.
redline_13: No fork pull-request context may rely only on `check_suite.pull_requests`.
redline_14: No annotation publisher may assume more than 50 annotations per GitHub Checks API request, and the default path must cap inline annotations well below that.
redline_15: No automatic growth beyond installation-scope, rerun, or concurrency limits without an explicit plan update.
redline_16: No long-retention storage or premium observability feature is enabled by default if it breaks the monthly cost ceiling.
redline_17: No over-quota, oversized, or degraded required-path run may be reported as if review succeeded.
redline_18: No phase proof may omit the concrete artifact or command output named by the checklist item.

---

## ENV VARS
env_1: AWS_REGION | AWS region for Lambda, SQS, DynamoDB, and Parameter Store | yes
env_2: GITHUB_APP_ID | GitHub App identifier used to mint installation tokens | yes
env_3: GITHUB_WEBHOOK_SECRET_PARAM | Parameter Store key name for webhook secret | yes
env_4: GITHUB_PRIVATE_KEY_PARAM | Parameter Store key name for GitHub App private key | yes
env_5: PRPILOT_RUNTIME_POLICY_PARAM | Parameter Store key name for runtime mitigation overrides, installation-scope limits, and budget mode | yes
env_6: DYNAMODB_TABLE_NAME | Table name for review and delivery records | yes
env_7: SQS_QUEUE_URL | Queue URL for asynchronous review jobs | yes
env_8: PRPILOT_POLICY_CACHE_TTL_SECONDS | Local cache TTL for runtime-policy documents | no
env_9: PRPILOT_SECRET_CACHE_TTL_SECONDS | Local cache TTL for secrets so rotation can happen without redeploy | no
env_10: PRPILOT_FAST_LANE_BUDGET_MS | End-to-end budget for required fast-lane processing | no
env_11: PRPILOT_DEEP_LANE_BUDGET_MS | Budget for deep-lane manual or opt-in processing | no
env_12: PRPILOT_SCANNER_TIMEOUT_MS | Default per-scanner timeout budget in milliseconds | no
env_13: PRPILOT_SCANNER_MAX_PARALLEL | Max scanner adapters allowed concurrently | no
env_14: PRPILOT_MAX_INSTALLATIONS | Hard cap for app installations in one self-hosted instance | no
env_15: PRPILOT_MAX_ACTIVE_REPOS | Hard cap for repos with reviews enabled in one self-hosted instance | no
env_16: PRPILOT_MAX_RUNS_PER_DAY_GLOBAL | Global fast-lane daily quota across one self-hosted instance | no
env_17: PRPILOT_MAX_RUNS_PER_REPO_PER_DAY | Per-repo fast-lane quota | no
env_18: PRPILOT_MAX_MANUAL_RERUNS_PER_PR_PER_DAY | Per-PR manual rerequest quota | no
env_19: PRPILOT_RERUN_COOLDOWN_SECONDS | Minimum spacing between manual rerequests | no
env_20: PRPILOT_MAX_CHANGED_FILES_PER_RUN | Oversized-run threshold based on changed file count | no
env_21: PRPILOT_MAX_DIFF_BYTES_PER_RUN | Oversized-run threshold based on diff payload size | no
env_22: MAX_ANNOTATIONS_PER_RUN | Safety cap for total check run annotations after chunking | no
env_23: PRPILOT_LOG_RETENTION_DAYS | Short log retention window for a self-hosted deployment | no
env_24: PRPILOT_IDEMPOTENCY_TTL_DAYS | TTL for delivery dedupe records | no
env_25: PRPILOT_RUN_TTL_DAYS | TTL for persisted review records | no
env_26: LOG_LEVEL | Structured log verbosity | no

---

## PHASES
phase_1_name: Repo Setup
phase_1_goal: Initialize monorepo structure, TypeScript baseline, lint and test tooling, and baseline cost-control config
phase_1_checkboxes:
  - Conventional initial commit
  - Git ignore rules include node modules, build output, env files, and AWS artifacts
  - Folder structure and package boundaries match systems architecture modules
  - Env example files list runtime keys plus budget, cache, and limit keys
  - Dependency install, lint, and typecheck run locally
phase_1_proof: Run npm install && npm run lint && npm run typecheck. Show git log --oneline -1, .gitignore, .env.example, and find apps packages infra tests -maxdepth 2 -type d | sort.
phase_1_commit: chore(init): bootstrap monorepo and tooling

phase_2_name: GitHub App Registration and Local Webhook Wiring
phase_2_goal: Register a private GitHub App, document installation scope, and receive signed test events through a local webhook path
phase_2_checkboxes:
  - GitHub App created with minimum repository permissions
  - Exact MVP webhook events and actions documented before wiring starts
  - Permission matrix and selected-repo installation scope documented before broad sharing
  - Local webhook tunnel receives pull request events
  - Secrets and runtime-policy references come from env or Parameter Store, not hardcoded
  - Self-host setup notes document that the app is installed only on repos the deployment owner controls
phase_2_proof: Show GitHub App settings, documented permission and event matrix, local request log with pull_request event payload, and selected-repo installation-scope note.
phase_2_commit: feat(webhook): wire github app webhook ingress

phase_3_name: Security Foundation
phase_3_goal: Implement signature verification, normalized webhook payloads, selected-repo scope, and persistent delivery deduplication before any business logic
phase_3_checkboxes:
  - Signature check enforces X-Hub-Signature-256 validation
  - Invalid signatures return 401 and are not queued
  - Normalized webhook event shape is defined before dedupe or queue handoff
  - Basic selected_repository_ids allowlist rejects out-of-scope repos before side effects
  - Minimal DynamoDB DELIVERY item contract supports conditional writes for idempotency
  - Delivery ID dedupe prevents duplicate processing for already-enqueued deliveries
  - Stale RECEIVED records without ENQUEUED transition are retryable instead of permanently lost
  - Queue-handoff abstraction failure path does not silently acknowledge unqueued deliveries before P6 wires real SQS
phase_3_proof: Run tests for valid and invalid signatures, normalized payload validation, selected-repo rejection, duplicate delivery fixture, stale RECEIVED retry, and queue-handoff failure behavior. Show passing output.
phase_3_commit: feat(security): add webhook verification and idempotency guard

phase_4_name: Rule Engine Skeleton
phase_4_goal: Build deterministic analysis pipeline with a self-hosted default that stays fast-lane only
phase_4_checkboxes:
  - Rule engine accepts normalized changed file inputs
  - Default deployment-owner runtime-policy schema and loader contract are defined before scanner decisions
  - Budget mode, scanner mode, and lane enums plus fail-closed policy-load behavior are fixed
  - Initial deterministic rules internal.large-change, internal.sensitive-file-change, and internal.lockfile-drift are implemented
  - Rule output schema includes severity, blockability, message, and file context
  - Scanner adapter contract maps external tool output into normalized finding and coverage schemas
  - MVP PR scanner catalog includes eslint for JS/TS repos, gitleaks, and actionlint only
  - Deep or CI catalog includes osv-scanner, zizmor, typos, and markdownlint-cli2, documented as disabled-by-default stretch scope
  - Optional file-type-specific catalog includes ast-grep, Conftest, KubeLinter, SQLFluff, Vale, Semgrep CE, ShellCheck, and yamllint as opt-in only
  - Governance and scheduled tools OpenSSF Scorecard, commitlint, and Danger JS are kept out of the PR worker runtime
  - AGPL or heavyweight tools TruffleHog, Syft, and Grype are excluded from the default runtime by default
  - Default behavior is explicitly fast-lane only
  - Unsupported, oversized, and degraded required-path outcomes are defined before check publication work starts
phase_4_proof: Run default runtime-policy contract tests plus unit tests for the three named rules and adapter mapping, print sample JSON findings and coverage from fixture, and show scanner-catalog configuration snapshot with lane, trigger, input scope, mode, enabled-by-default state, and blockability policy.
phase_4_commit: feat(rules): implement deterministic analyzer core

phase_5_name: Check Runs Integration
phase_5_goal: Publish GitHub check runs with bounded annotation volume through a reusable publisher before SQS worker wiring
phase_5_checkboxes:
  - P5 proof is explicitly synchronous-only and keeps check-publisher reusable for P6 worker invocation
  - Check run created or updated for pull request head commit
  - Severity summary maps to the correct GitHub check conclusion
  - Required status check behavior demonstrated in test repository
  - Critical findings map to failure, while degraded or operational-block outcomes map to action_required without masquerading as success
  - Annotation publishing handles GitHub's 50-annotations-per-request limit safely
  - Default inline annotation cap falls back to summary output when exceeded
phase_5_proof: Open test PR and show synchronous-only publisher proof from queued to completed with expected conclusion for a failing run (failure) and a degraded or operational-block case (action_required), plus annotation preview and cap evidence.
phase_5_commit: feat(checks): publish github check run results

phase_6_name: Async Processing Pipeline
phase_6_goal: Move analysis to SQS worker with retries, dead-letter handling, and strict rerun controls
phase_6_checkboxes:
  - Webhook ingress enqueues jobs and returns quickly
  - Worker consumes queue and runs rules asynchronously
  - Queue-job contract includes lane, trigger, installation ID, repo ID, head SHA, and sender context
  - Retry and dead-letter configuration tested with forced failure
  - DLQ investigation and replay procedure documented and practiced
  - Worker executes scanners within timeout budgets and low scanner parallelism
  - Worker re-checks current PR head SHA through GitHub Pulls API before publishing
  - Failed freshness checks after bounded retries map to operational required-path result or fail-closed alert
  - Superseded jobs and manual reruns are throttled before unnecessary work is spent
  - Findings from all enabled scanners are normalized and published through one GitHub Checks annotation path
phase_6_proof: Show enqueue log, worker log, dead-letter message after simulated failure, manual DLQ investigation evidence, one timeout-handling run, one GitHub API freshness-check supersession or failure-policy example, and one rerun-throttle or superseded-job example.
phase_6_commit: feat(queue): add sqs worker and retry pipeline

phase_7_name: Persistence Layer
phase_7_goal: Expand DynamoDB persistence beyond the P3 delivery-idempotency item with minimal retention and low-cost recovery
phase_7_checkboxes:
  - DynamoDB table schema extends the P3 DELIVERY item with RUN, ATTEMPT, COUNTER, and LOCK item types
  - Run lookup by repository and pull request is supported
  - Duplicate delivery records are queryable
  - Review result persistence includes delivery state transitions, timing, conclusion, and TTL values
  - Minimal-retention policy is documented and automatic expiry configured
  - Recovery drill uses a low-cost backup or restore path; PITR remains optional until justified by budget
phase_7_proof: Show DynamoDB query output for one pull request with at least two runs, TTL field evidence, and the chosen recovery drill.
phase_7_commit: feat(db): persist delivery and review records

phase_8_name: Merge-Gate Demonstration
phase_8_goal: Enforce required check policy in GitHub branch protection within the self-hosted operating envelope
phase_8_checkboxes:
  - Selected real repository used for validation is documented
  - Required check configured on demo repository branch rules
  - Real failing pull request triggers blocking findings
  - Critical finding blocks merge
  - Clean or fixed pull request passes the fast-lane check
  - Passing run allows merge
  - Webhook-to-check latency is measured across at least 3 real runs
  - One operational edge case is shown, such as invalid config, unsupported repo, oversized run, or quota denial
  - Optional deep-lane result or disabled/denied state is shown without changing fast-lane merge behavior
phase_8_proof: Show blocked merge screenshot, successful merge after fix or clean PR, latency evidence from at least 3 real runs, and one honest operational or advisory edge-case result.
phase_8_commit: feat(checks): enforce required status gate in demo repo

phase_9_name: Repository Configuration Support
phase_9_goal: Add repository-level policy configuration for thresholds, quotas, and opt-in behavior
phase_9_checkboxes:
  - P4 deployment-owner runtime-policy schema and loader path are reused before repo overrides are applied
  - .prpilot.yml schema defined and validated
  - Severity threshold and ignore path settings applied in analysis
  - Invalid config yields clear error in check output
  - Scanner policy controls enabled, mode, timeout_ms are supported with safe defaults
  - Lane placement and warn-first promotion state are controlled via config
  - Per-repo quotas and deep-scan opt-in rules are configurable safely
  - Repository policy cannot weaken deployment-owner caps or required security controls
phase_9_proof: Show two PR runs with different config behavior, one invalid config error, one scanner mode change from warn to block without redeploy, one lane assignment change by config, one quota or opt-in example, and one case proving repo config cannot override a deployment-owner cap.
phase_9_commit: feat(config): support repository-level review policies

phase_10_name: Access and Permission Hardening
phase_10_goal: Validate installation scope and prevent unauthorized processing
phase_10_checkboxes:
  - Previously documented app permission matrix enforced
  - Only installed repositories inside the selected scope are processed
  - Unauthorized or missing installation returns safe failure path
  - Fork pull-request context is resolved safely without depending on check_suite.pull_requests
  - Installation-scope rules and any optional per-instance caps are reflected in the authorization path
phase_10_proof: Show test logs for installed same-repo events, installed fork pull-request events, rejected non-installed repository event handling, and installation-scope enforcement evidence.
phase_10_commit: feat(security): harden installation and permission checks

phase_11_name: Optional Local Preflight CLI
phase_11_goal: Add minimal developer CLI for local deterministic checks before push
phase_11_checkboxes:
  - CLI reads changed files and runs deterministic rules locally
  - CLI output format matches check run summary model
  - CLI output discloses that PRPilot baseline ESLint may differ from repository ESLint setup
  - Non-zero exit code on critical issues
  - CLI is documented as a cost-saving preflight path that aligns with deployed review results
phase_11_proof: Run CLI in sample repo with failing and passing cases; show exit codes.
phase_11_commit: feat(cli): add local preflight review command

phase_12_name: Infrastructure as Code
phase_12_goal: Codify the AWS system with repeatable CDK stacks before live hardening and deployment
phase_12_checkboxes:
  - CDK app defines Lambda, API Gateway, SQS, DynamoDB, IAM, and minimal alarms
  - One live environment is required and extra environments are optional and justified
  - cdk synth and cdk diff are clean and reviewable
  - Lambda reserved concurrency, TTL retention, log retention, and budget config are explicitly defined
  - Stack outputs needed for webhook wiring and runtime config are surfaced for a self-host deployment
  - Cloud resources used in earlier phases are brought under CDK control before live rollout
phase_12_proof: Run cdk synth and cdk diff with no unexpected replacements, including concurrency, TTL, log-retention, limit settings, and deployment outputs needed for webhook configuration.
phase_12_commit: feat(infra): define aws resources with cdk

phase_13_name: Reliability Hardening
phase_13_goal: Ensure safe reprocessing, bounded retries, and self-hosted operational guardrails
phase_13_checkboxes:
  - Idempotency and replay protections validated under load tests
  - Queue visibility timeout and retry policy tuned for low traffic and bounded cost
  - Minimal alarms configured for failures, DLQ depth, throttling, and budget-mode transitions
  - Concurrency settings and rerun throttles validated under burst load
  - Budget-aware runtime policy normal, conserve, and emergency modes are documented and exercised through quota counters
  - Dollar-based budget response is documented through AWS Budgets alarms or deployment-owner runtime-policy intervention
  - Scanner-timeout and scanner-failure handling are mapped to runbook actions
  - GitHub failed-delivery redelivery procedure is documented and practiced
  - AGPL and GPL tool execution boundaries are documented and verified in runbooks
phase_13_proof: Show alarm definitions and a test run that triggers then clears an alert, throttling behavior under burst load, budget-mode transition evidence, rerun-throttle evidence, GitHub failed-delivery redelivery evidence, and license-boundary runbook evidence.
phase_13_commit: perf(worker): harden retries and runtime reliability

phase_14_name: Free-Tier-Safe Observability and Performance
phase_14_goal: Capture latency and failure metrics and improve webhook-to-check completion time without expensive telemetry
phase_14_checkboxes:
  - Structured logs include delivery ID, repository, run status, and budget mode
  - Core logs, metrics, and alarms are available without rich paid observability products
  - Completion latency measured and improved from baseline
  - Alarm thresholds are defined and mapped to operational actions
  - Per-scanner runtime and findings-volume metrics are captured
  - Pack-level budgets are measured for Pack 1 and any enabled deep-lane runs
  - Retention and metric volume stay within the free-tier-safe plan
phase_14_proof: Show before and after latency values at minimum p50 and p95, alarm coverage evidence, one log query or CloudWatch console view if used, per-scanner timing breakdown, and pack-level budget report.
phase_14_commit: perf(observability): instrument metrics and optimize latency

phase_15_name: Self-Hosted Deployment Validation
phase_15_goal: Deploy a secure live environment in a user-owned AWS account and prove the private GitHub App flow works end to end
phase_15_checkboxes:
  - Live stack deployed from IaC
  - Parameter Store secure values wired to runtime
  - End-to-end pull request review works in one selected live repository
  - Selected-repo scope, deep-scan defaults, and cost ceilings are enforced live
  - Optional deep-lane trigger either works or shows explicit disabled/denied state without changing fast-lane merge behavior
  - High-risk changes use staged rollout with validated rollback path
  - New scanner packs roll out in warn mode first and promote only after stability and budget review
  - Pack rollout order is enforced from Pack 1 to Pack 3
phase_15_proof: Show live endpoint health, successful live check run on real PR, selected-repository scope or budget-mode evidence, staged rollout plus rollback evidence, one scanner-pack promotion record, and rollout-order evidence.
phase_15_commit: chore(deploy): deploy live github app stack

phase_16_name: Documentation and Demo Readiness
phase_16_goal: Create self-host onboarding docs and interview-ready architecture artifacts for an honest deployable tool
phase_16_checkboxes:
  - Setup guide covers self-host local and live environments
  - Private GitHub App creation and AWS credential expectations are documented
  - Security, cost-control, and reliability architecture are documented
  - Five-minute demo script validates the full primary user flow
  - Operations runbook includes recovery, secret rotation, and approaching-limits policy
  - Incident rehearsal is executed and timeline is recorded
phase_16_proof: Present docs sections, execute full demo script once without manual fixes, and show incident or recovery rehearsal evidence.
phase_16_commit: docs(project): add self-host setup guide runbook and demo script

phase_17_name: CI/CD and Release Automation
phase_17_goal: Ship automated quality gates and deployment via OIDC-authenticated pipelines within free usage
phase_17_checkboxes:
  - Pull requests trigger lint, typecheck, and tests
  - Main merge triggers deployment workflow or explicitly gated live deploy path
  - Failed tests block deploy
  - OIDC federation to AWS replaces static cloud credentials
  - Latency regression guard blocks release when baseline degrades beyond tolerance
  - Scanner-policy drift guard blocks release when enforced scanner baseline is unintentionally changed
  - Deterministic non-AI guard blocks release if required path depends on AI service
  - CI usage stays within free GitHub Actions limits or uses a self-hosted runner
phase_17_proof: Show successful PR workflow, blocked failing workflow, deployment workflow logs using OIDC role assumption, latency-guard behavior, scanner-policy drift guard behavior, deterministic non-AI guard behavior, and proof that CI fits the free-tier plan.
phase_17_commit: ci(actions): add oidc pipelines and release checks
