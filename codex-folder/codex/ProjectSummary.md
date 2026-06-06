# PRPilot — Project Summary (Systems)

> Self-hosted GitHub App that reviews pull requests before human review for student and early-career developers.

**Purpose:** PRPilot posts structured PR feedback in GitHub before a human reviewer spends time on avoidable issues. The MVP is GitHub-App-first and self-hosted: each user deploys it in their own AWS account, connects a private GitHub App, and controls budget, logs, and retained data.

**MVP repository scope:** The first supported repository class is Node.js / TypeScript / JavaScript repositories that use npm lockfiles and GitHub Actions. Broader multi-language coverage remains deferred or opt-in until the baseline app proves useful without leaving free tiers or very low-cost usage bands.

**Operating posture:** This is an open-source self-hosted devtool, not a SaaS. Each deployment owner runs a private GitHub App on selected repositories they control. Expensive scans stay off by default, the required path stays deterministic, and anything that threatens the monthly cost ceiling is deferred, opt-in, or degraded explicitly.

---

## System Overview
```
GitHub PR Event -> API Gateway -> Lambda Webhook Handler
                                                    | verify signature + dedupe + scope/quota guard
                                                    v
                                                SQS Queue -> Worker Lambda -> Rule Engine
                                                                                         |
                                                                                         v
                                                                GitHub Check Run + Capped Annotations
                                                                                         |
                                                                                         v
                                                                 DynamoDB Records with TTL Retention
```

**Core Constraint:** The system must return the webhook response inside GitHub's 10-second delivery window, publish a required deterministic check run within 60 seconds for normal pull requests, fail the check on critical fast-lane findings, and default to free-tier-aware behavior before it attempts higher-cost execution.

## Operational Objectives
- **Ingress SLO:** The webhook handler must acknowledge accepted deliveries within 10 seconds so GitHub does not mark the delivery as failed.
- **Latency SLO:** For normal pull requests, webhook-to-check completion should stay under 60 seconds at p95, with an internal fast-lane target far below that ceiling.
- **Loss SLO:** Accepted webhook deliveries must not be silently dropped between ingress and queue handoff.
- **Cost SLO:** Default monthly operation for one self-hosted instance should target `$0-$5` and should not intentionally exceed a `$10` monthly infra ceiling without explicit deployment-owner approval.
- **Scope SLO:** The default path stays fast-lane only; deep scans, governance checks, dashboards, and analytics remain off unless explicitly justified within budget.
- **Security SLO:** Secrets are never hardcoded and can be rotated without code redeploy.
- **Recovery SLO:** Recovery plans must favor low-cost, practical restore procedures over enterprise-grade always-on redundancy.

## Self-Hosted Usage Envelope
| Dimension | Default target | Hard ceiling | Default response when ceiling is approached |
|-----------|----------------|--------------|--------------------------------------------|
| Monthly PRPilot spend per instance | `$0-$5` | `$10` | Enter conserve mode before new features or capacity are added |
| Selected app installations per instance | up to `5` | `10` | Stop expanding install scope until usage drops |
| Active repos with reviews enabled | up to `3` | `5` | Disable new repo enablement until usage drops |
| Total fast-lane review jobs | up to `20/day` | `50/day` | Coalesce superseded jobs and throttle reruns |
| Per-repo fast-lane jobs | up to `10/day` | `20/day` | Reject new runs with an explicit over-quota operational result; do not pretend the required review happened |
| Manual reruns per PR | `2/day` | `3/day` | Reject extra reruns with a clear check summary |
| Deep scans | disabled by default | `1` manual deep scan per repo per day | Keep deep scans off unless explicitly requested |
| Worker Lambda reserved concurrency | `1` | `2` | Serialize work instead of auto-scaling further |
| In-run scanner parallelism | `1` | `2` | Drop to serial execution in conserve mode |
| Inline annotations per run | `20` | `30` | Convert overflow into summary text instead of more API calls |
| Changed files per fast-lane run | up to `50` | `100` | Reduce presentation detail first, then publish an explicit oversized-run operational result if honest review is no longer possible |

These ceilings are architectural, not temporary tuning values. The app is not designed to auto-expand past them without a deliberate re-plan.

---

## Entry Points
| Entry point | Type | Description |
|-------------|------|-------------|
| POST /webhooks/github | API trigger | Receives GitHub webhook events, verifies signature, applies installation-scope and budget guards, enqueues accepted jobs |
| review-jobs SQS message | Event trigger | Worker consumes queued review jobs and runs deterministic fast-lane analysis |
| check_suite.rerequested | GitHub event | Re-runs fast-lane analysis only when rerun quota and cooldown rules allow it |
| check_run.requested_action | GitHub event | Manually requests the optional deep lane from a button on the fast-lane check when the deployment owner allows deep scans |
| prpilot preflight | Optional CLI command | Runs local deterministic checks before push so deployed usage can stay lower |

## Event Scope and Admission Rules
- **Review-triggering events:** `pull_request` actions `opened`, `reopened`, `synchronize`, and `ready_for_review`.
- **Fast rerun trigger:** `check_suite.rerequested` is allowed only for fresh fast-lane reruns that still fit cooldown and quota policy.
- **Manual deep trigger:** `check_run.requested_action` with a `Run deep scan` or `Re-run deep scan` action is the default GitHub-native deep-lane trigger.
- **Automatic deep trigger:** The same `pull_request` events may enqueue a deep-lane job only when deployment-owner policy enables auto-deep for that repository class and `.prpilot.yml` opts in. Manual-only stays default.
- **Control-plane events:** `installation` and `installation_repositories` may update installation-scope state, but they do not execute analysis.
- **Draft pull requests:** Draft PRs may receive a waiting or deferred summary, but merge-gate behavior starts when the PR is ready for review.
- **Supported repository contract:** The required fast lane is enabled only for repositories PRPilot recognizes as the MVP support class: the repository root must contain `package.json` and `package-lock.json`. If either file is missing, the repo is unsupported for the required path and PRPilot must publish an explicit blocking result instead of pretending review passed.
- **Early scope guard:** P3 must enforce a basic `selected_repository_ids` allowlist before any queue or processing side effect. P10 later expands this into full installation and permission hardening.

---

## Core Modules
| Module | Responsibility | Depends on |
|--------|---------------|------------|
| webhook-ingress | Verify webhook authenticity, normalize event payload, and enforce ingress-time selected-repo scope plus quota checks | GitHub signing secret, API Gateway request, runtime policy allowlist |
| dedupe-guard | Prevent duplicate or superseded delivery processing while allowing safe retries for deliveries stuck before queue handoff | DynamoDB |
| rule-engine | Evaluate deterministic review rules on changed files | PR file metadata |
| scanner-orchestrator | Run only the allowed scanner pack for the current budget mode, enforce strict timeout and annotation budgets, normalize outputs | Changed files, scanner registry, runtime policy |
| check-publisher | Create or update GitHub check run, apply conclusion policy, cap annotation volume, and fall back to summary-only publishing when needed | GitHub App installation token |
| review-store | Persist delivery lifecycle states, run metadata, findings summaries, and processing timings with TTL retention | DynamoDB |
| runtime-policy | Load deployment-owner mitigation overrides, budget mode, selected-repo scope, and quota controls without redeploy | Parameter Store, local TTL cache |

## Decision and Policy Precedence
1. **Safety invariants:** Signature verification, dedupe, required-path honesty, and hard runtime caps cannot be weakened by any config source.
2. **Deployment-owner runtime policy:** Parameter Store controls budget mode, selected-repo scope, scanner availability, emergency disables, and hard ceilings without redeploy.
3. **Repository policy:** `.prpilot.yml` can narrow scope, raise strictness, or opt into already-enabled deep checks, but it cannot exceed deployment-owner caps or disable required security behavior.
4. **Environment defaults:** Environment variables provide baseline limits and fallbacks when runtime policy does not override them.

## Policy Document Contracts
### Deployment-Owner Runtime Policy Contract
| Field group | Required fields | Purpose |
|-------------|-----------------|---------|
| identity | `version`, `updated_at` | Makes policy changes auditable and cache-safe |
| scope | `selected_repository_ids`, `max_installations`, `max_active_repos` | Limits which repos the self-hosted instance is allowed to review |
| budgets | `budget_mode`, `fast_lane_budget_ms`, `deep_lane_budget_ms`, `annotation_cap`, `scanner_max_parallel` | Changes runtime posture without redeploy |
| quotas | `max_fast_runs_global_per_day`, `max_fast_runs_per_repo_per_day`, `max_manual_reruns_per_pr_per_day`, `max_deep_scans_per_repo_per_day` | Drives deny-before-work admission logic |
| deep_lane | `manual_enabled`, `auto_enabled`, `auto_repo_ids`, `global_concurrency_limit` | Keeps deep scans manual or narrowly opt-in by default |
| scanners | per-scanner `enabled`, `max_lane`, `mode_cap`, `timeout_ms_cap` | Prevents repo config from widening scanner access beyond deployment-owner intent |
| mitigations | `disabled_rules`, `disabled_scanners`, `summary_only_scanners` | Supports emergency containment while preserving honesty |

- **Owner-policy parse failure rule:** If the deployment-owner policy cannot be loaded or validated, required-path execution must fail closed rather than run with guessed behavior.
- **Owner-policy cache rule:** Cached policy may be used only within the configured TTL. On cache expiry, the runtime must re-fetch before admitting new work.
- **Owner-policy field types:** `version` is an integer, `updated_at` is an ISO timestamp, `budget_mode` is exactly one of `normal|conserve|emergency`, `selected_repository_ids` is a non-empty array of GitHub repository IDs, `manual_enabled` and `auto_enabled` are booleans, and `global_concurrency_limit` is fixed to `1` for the MVP.
- **Owner-policy lane caps:** `max_lane` is exactly `fast` or `deep`; `mode_cap` is exactly `block`, `warn`, or `report_only`.
- **Phase ownership:** P4 owns the default runtime-policy schema and loader contract before scanner work begins. P9 owns repository-level overrides and precedence behavior, not first-time runtime-policy introduction.

### Repository Policy Contract
| Field group | Allowed fields | Constraints |
|-------------|----------------|-------------|
| identity | `version` | Required for schema evolution |
| review | `ignore_paths`, `include_paths`, `draft_behavior` | May narrow review scope, not widen repository support |
| scanners | per-scanner `enabled`, `mode`, `timeout_ms`, `lane` | `lane` may only move a scanner into a lane already permitted by owner policy; `timeout_ms` may only reduce the allowed cap |
| deep | `manual_enabled`, `auto_on_pull_request` | `auto_on_pull_request` is valid only when the deployment owner has enabled auto-deep for that repo |
| quotas | `manual_deep_scans_per_day`, `manual_fast_reruns_per_pr_per_day` | Repo config may only reduce quotas, never raise them above owner limits |
| rollout | `warn_first_scanners` | Used to promote scanners from advisory to blocking without code changes |

- **Repo-config parse failure rule:** Invalid `.prpilot.yml` is a required-path operational failure and must map to `action_required`, not silent fallback.
- **Repo-config absence rule:** Missing `.prpilot.yml` means deployment defaults apply with no penalty.
- **Conflict rule:** When repo and owner policy disagree, the stricter value wins.
- **Repo-policy field types:** `version` is an integer, `draft_behavior` is exactly `skip_until_ready` or `advisory_only`, scanner `mode` is exactly `block`, `warn`, or `report_only`, and scanner `lane` is exactly `fast` or `deep`.
- **Path precedence rule:** `include_paths` is applied first, then `ignore_paths`; `ignore_paths` always wins on overlap.
- **Draft rule:** The MVP default is `skip_until_ready`. `advisory_only` allows a non-required draft summary but never starts the merge gate early.

## Review Lifecycle and Outcome Policy
- **Delivery lifecycle states:** `RECEIVED`, `REJECTED`, `DUPLICATE`, `SUPERSEDED`, `ENQUEUED`, `PROCESSING`, `PUBLISHED`, `FAILED`.
- **State-aware delivery retry rule:** A delivery recorded as `RECEIVED` but not advanced to `ENQUEUED` within the configured handoff retry window is eligible for retry and must not be rejected as a duplicate.
- **Duplicate rejection rule:** Deliveries already advanced to `ENQUEUED`, `PROCESSING`, or `PUBLISHED` are duplicates for side-effect purposes and must not enqueue or publish a second run for the same logical event.
- **Blocking review outcomes:** Critical fast-lane findings, invalid repository policy, required-path runtime failure after bounded retries, any applicable fast-lane scanner coverage gap, and any over-quota or oversized required-path request that could not be reviewed honestly.
- **Non-blocking advisory outcomes:** Warn-only fast-lane findings, deep-lane findings, skipped or denied deep-lane scans, annotation overflow converted to summary text, and deferred draft-PR handling.
- **No false-pass rule:** If PRPilot cannot complete the required fast-lane review honestly, it must emit an explicit operational result that makes the gap visible instead of returning a success-like outcome.

## GitHub Check Conclusion Policy
- **`success`:** The required fast lane completed honestly and produced no blocking condition, or an optional deep-lane run completed cleanly with no advisory findings.
- **`failure`:** A critical deterministic fast-lane finding blocks merge.
- **`action_required`:** PRPilot could not perform an honest required review because of an operational blocking condition such as unsupported repo scope, invalid `.prpilot.yml`, over-quota refusal, oversized-run refusal, or bounded-retry runtime failure.
- **`neutral`:** Optional deep-lane runs with advisory findings, denials, or partial coverage, plus draft-only advisory states outside the required merge-protection path.
- **Fail-closed publisher rule:** If GitHub API issues prevent PRPilot from creating or updating the required check after bounded retries, the system must fail closed by relying on the missing or incomplete required check to block merge and by alerting the deployment owner immediately.

## Analysis Lanes
### Lane Trigger and Required Status
| Lane | Check run name | Primary trigger | Default state | Required for merge | Admission gates |
|------|----------------|-----------------|---------------|--------------------|-----------------|
| Fast lane | `PRPilot Fast` | `pull_request.opened`, `reopened`, `synchronize`, `ready_for_review`; manual `check_suite.rerequested` | on by default | yes | Installed repo, selected-repo scope, supported repo class, valid config, current head SHA, fast-lane quota headroom |
| Deep lane | `PRPilot Deep` | Manual `check_run.requested_action`; optional auto-trigger on the same PR events only when both deployment policy and repo config opt in | off by default; manual only | no | Fast lane for the same head SHA completed honestly, deep lane enabled by owner policy, deep quota headroom, one active deep slot free globally |

Deep-lane implementation is a post-MVP stretch unless the deployment owner explicitly opts in. Through P15, the gate-critical path is the fast lane; deep-lane work may be satisfied by documented contracts, disabled-by-default admission, and explicit denial behavior instead of requiring full optional scanner execution.

### Lane Inputs and Scope
- **Fast lane input envelope:** PR number, base SHA, head SHA, changed file list, patch hunks, file statuses, `.prpilot.yml`, and a strict allowlist of support files needed for deterministic scanners: `package.json`, `package-lock.json`, `eslint.config.*`, `.eslintrc*`, `tsconfig*.json`, and `.github/workflows/**`.
- **Fast lane scope rule:** The required lane must cover every changed file that falls inside the supported repo contract. It may reduce summary detail, annotation volume, or non-essential context fetches, but it may not sample files or silently skip an applicable baseline scanner and still return `success` or `failure`.
- **Deep lane input envelope:** The latest honest fast-lane result for the same head SHA, the base/head diff metadata, `.prpilot.yml`, deployment-owner policy, and a GitHub-generated tarball archive of the head SHA extracted into a temporary read-only workspace.
- **Deep lane scope rule:** The optional lane may inspect broader repo context and unchanged files, but inline annotations still attach only to changed lines. Findings on unchanged files or repo-wide scans belong in the check summary, not inline annotations.
- **Execution safety rule:** Both lanes operate read-only. PRPilot does not run repository-defined scripts or perform `npm install` inside the target repository. Every scanner must run from PRPilot-owned pinned tooling or standalone binaries.

### Fast-Lane Scanner Set
| Scanner | Runs when | Scope basis | Why it belongs in fast lane | Can block merge |
|---------|-----------|-------------|-----------------------------|-----------------|
| Internal deterministic rules | every supported PR | changed files plus diff hunks | Cheapest custom review signal and easiest to test deterministically | yes |
| `gitleaks` | every supported PR | changed files or diff content only | Secret exposure is urgent, high-signal, and must stay in the default required path | yes |
| `actionlint` | one or more `.github/workflows/*.yml` files changed | changed workflow files plus minimal workflow support context | Workflow breakage and unsafe Actions usage are high-value, fast checks | yes, only when workflow changes make it applicable |
| `eslint` | one or more JS/TS source or config files changed in a supported repo | changed JS/TS files only, using a PRPilot-owned pinned baseline config | Gives deterministic code-quality coverage for the MVP repo class without installing repo dependencies or loading arbitrary repo plugins | yes, only when JS/TS changes make it applicable |

### Initial Internal Deterministic Rules
| Rule ID | Detection target | Default blockability |
|---------|------------------|----------------------|
| `internal.large-change` | A changed file or PR exceeds the configured soft line-change threshold while still staying below the hard oversized-run ceiling | warn |
| `internal.sensitive-file-change` | A changed path matches sensitive config, credential, private-key, or environment-file patterns | block |
| `internal.lockfile-drift` | `package.json` dependency sections changed without a matching `package-lock.json` update in the same PR | block |

These three rules are the P4 implementation target. They are intentionally simple, diff-based, and testable before external scanner integration.

### Scanner Limitations
- PRPilot does not run `npm install`, repository-defined scripts, or arbitrary repository ESLint plugins in the target repository.
- ESLint results come from a PRPilot-owned pinned baseline config, so they may differ from `npx eslint .` in the user's repository.
- Check summaries and `prpilot preflight` output must disclose this baseline-config limitation whenever ESLint runs.

### Deep-Lane Scanner Set
| Scanner | Runs when | Scope basis | Why it stays deep by default | Default outcome mode |
|---------|-----------|-------------|-------------------------------|----------------------|
| `osv-scanner` | lockfiles or supported manifests exist and deep lane is requested | repo-wide manifest and lockfile scan | Dependency and vulnerability checks are valuable but slower and more network-sensitive than the required path should assume | warn-only |
| `zizmor` | workflow files exist and deep lane is requested | repo-wide workflow scan | Strong GitHub Actions security signal, but broader and noisier than `actionlint` | warn-only |
| `typos` | text files exist and deep lane is requested | repo-wide text scan | Helpful polish check, not urgent enough for merge blocking | warn-only |
| `markdownlint-cli2` | Markdown files exist and deep lane is requested | repo-wide Markdown scan | Documentation quality should stay advisory and out of the default budget path | warn-only |
| `ast-grep` | matching file-type config exists and repo plus owner policy enable it | targeted repo-wide structural scan | Useful for custom patterns, but repo-specific and better introduced only after value is proven | warn-only |
| `Conftest` | policy files or IaC assets exist and repo plus owner policy enable it | targeted repo-wide policy scan | Higher setup cost and repo specificity than the MVP path should assume | warn-only |
| `KubeLinter` | Kubernetes manifests exist and repo plus owner policy enable it | targeted repo-wide manifest scan | Valuable for infra repos, but not part of the first supported repo class | warn-only |
| `SQLFluff` | SQL files exist and repo plus owner policy enable it | targeted repo-wide SQL scan | Slower and more domain-specific than the default JS/TS path | warn-only |
| `Vale` | prose-style config and text docs exist and repo plus owner policy enable it | targeted repo-wide prose scan | Style guidance is advisory and often noisy at first | warn-only |
| `Semgrep CE` | repo plus owner policy explicitly enable it | targeted repo-wide code scan | Broad coverage but materially heavier and more tuning-sensitive than Pack 1 | warn-only |
| `ShellCheck` | shell scripts exist and repo plus owner policy enable it | targeted repo-wide shell scan | High-value for shell-heavy repos, but outside the MVP repo baseline | warn-only |
| `yamllint` | non-workflow YAML exists and repo plus owner policy enable it | targeted repo-wide YAML scan | Useful hygiene signal, but lower urgency than required-path workflow checks | warn-only |

### Finding Normalization and Coverage Accounting
| Record type | Required normalized fields | Purpose |
|-------------|----------------------------|---------|
| `finding` | `lane`, `pack`, `scanner`, `rule_id`, `severity`, `blockability`, `scope_basis`, `path`, `start_line`, `end_line`, `message`, `fingerprint`, `raw_reference` | Gives one merged finding shape for internal rules and external scanners |
| `coverage` | `lane`, `scanner`, `applicability`, `status`, `scope_expected`, `scope_completed`, `reason`, `duration_ms`, `budget_ms` | Explains whether the lane ran honestly and whether partial coverage is acceptable |

- **Coverage statuses:** `completed`, `not_applicable`, `skipped_by_policy`, `denied_by_limit`, `timed_out`, `failed`, and `partial_input`.
- **Blockability resolution:** Raw tool severity is mapped into normalized `block`, `warn`, or `report_only` after deployment-owner policy and repo policy are applied. Raw tool output never bypasses the normalization layer.
- **Fast-lane honesty rule:** If an applicable baseline fast-lane scanner does not end in `completed` or `not_applicable`, the fast lane must become `action_required`.
- **Deep-lane honesty rule:** Deep-lane partial coverage is allowed, but it must emit `coverage` records and a summary section naming every skipped, timed-out, or denied scanner.

### Outcome Decision Logic
1. Resolve repository support, config validity, policy precedence, quota state, and current head SHA before any scanners start.
2. If the repo is unsupported, `.prpilot.yml` is invalid, a hard fast-lane quota has been exceeded, or the PR is oversized beyond honest required-path handling, publish `PRPilot Fast` with `action_required`.
3. Resolve the set of applicable baseline fast-lane scanners from the changed files. Only Pack 1 scanners participate in the required path by default.
4. Run every applicable baseline fast-lane scanner within the remaining fast-lane budget. Any `timed_out`, `failed`, `denied_by_limit`, or `partial_input` coverage result for an applicable baseline scanner converts the fast lane to `action_required`.
5. If fast-lane coverage is complete and any normalized finding has `blockability=block`, publish `failure`.
6. Otherwise publish `success`. Warn-only findings, annotation overflow, and skipped non-applicable scanners do not change the passing conclusion.
7. Deep-lane results never change the required fast-lane conclusion. A clean deep run may publish `success`; any advisory findings, denials, or partial coverage publish `neutral`.

### Large PR, Timeout, Quota, and Partial-Coverage Rules
| Condition | Fast lane behavior | Deep lane behavior |
|-----------|--------------------|--------------------|
| Changed files or diff bytes exceed the hard ceiling, or GitHub patch truncation prevents full changed-file coverage | Publish `action_required` with an explicit oversized-run summary and do not pretend a required review completed | Publish `neutral` with an explicit oversized-run denial summary; deep lane does not run partial fallback subsets in the MVP |
| Soft file or diff threshold is exceeded but all applicable Pack 1 scanners can still cover the entire changed-file set | Run Pack 1 normally, lower annotation volume first, and move overflow detail into the summary; never sample files | Run enabled deep scanners in priority order and stop when deep budget expires, publishing the completed subset with coverage notes |
| Applicable fast-lane scanner times out or crashes | Publish `action_required`; the missing baseline coverage is a required-path gap | Publish `neutral` and keep completed deep findings, but mark the timed-out scanner in coverage notes |
| Repository is unsupported or `.prpilot.yml` is invalid | Publish `action_required`; no fast-lane pass/fail result is allowed | Do not offer or auto-trigger deep scans for that SHA |
| Fast-lane quota is exhausted and the current head SHA has no honest fast result yet | Publish `action_required` because the required review did not happen | Not applicable |
| Manual fast rerun quota is exhausted but the current head SHA already has an honest fast result | Keep the existing fast check authoritative and record a non-blocking rerun denial note | Not applicable |
| Deep quota is exhausted or deep scans are disabled by policy or budget mode | No change to the fast-lane conclusion | Publish `neutral` with an explicit denial summary |
| Findings exceed inline annotation cap | Keep conclusion unchanged, publish only the top capped changed-line findings inline, and move the rest into the summary | Same policy; unchanged-file deep findings are always summary-only |
| GitHub Checks publication fails after bounded retries | Fail closed by leaving the required check missing or incomplete and alerting the deployment owner | Record the failed optional run and alert, but do not affect the already-published fast result |

### Reruns and Supersession
- **New commits win:** `pull_request.synchronize` supersedes queued jobs for the same PR and lane. Stale jobs are dropped before scanner start.
- **In-flight stale detection:** Before publishing, a worker performs a lightweight GitHub Pulls API freshness check for the current PR head SHA. If the job is stale, it records `SUPERSEDED` and skips publication for that stale SHA.
- **Freshness-check failure rule:** If the head-SHA freshness check fails after bounded retries, the worker must not publish normal findings for a possibly stale SHA. For the required fast lane, publish an operational `action_required` result if possible; otherwise alert and rely on the missing or incomplete required check to fail closed.
- **Fast reruns:** `check_suite.rerequested` always targets the current head SHA only, respects the rerun cooldown and per-PR cap, and updates the same `PRPilot Fast` check name for that SHA instead of creating a new lane name.
- **Deep reruns:** The fast-lane check exposes a `Run deep scan` action when deep scans are permitted. Completed deep checks expose `Re-run deep scan` only when quota and cooldown allow it.
- **Deep staleness:** A new commit makes earlier deep results stale. Auto-deep repositories may enqueue a fresh deep run after the new fast lane completes; manual-only repositories require a new button press.

### GitHub UI Contract
| Lane | Check run name | Required in branch protection | What the summary must show | Annotation behavior | User actions |
|------|----------------|-------------------------------|----------------------------|--------------------|--------------|
| Fast lane | `PRPilot Fast` | yes | Verdict, blocking findings, advisory findings, scanner coverage table, applied limits, superseded or rerun info, and whether deep scans are available | Inline annotations only on changed lines, capped per run, overflow moved into the summary | `Run deep scan` button when owner policy permits deep scans for the repo and the current SHA has an honest fast result |
| Deep lane | `PRPilot Deep` | no | Advisory verdict, scanner-by-scanner coverage, repo-wide findings on unchanged files, denial reasons, applied limits, and stale-result warning when superseded | Inline annotations only on changed lines; unchanged-file or repo-wide findings summary-only | `Re-run deep scan` when allowed; no PR comment by default |

- **Merge policy:** Only fast-lane normalized findings with `blockability=block` can fail the required check until a scanner is explicitly promoted into the fast lane through the warn-first promotion path.
- **MVP AI policy:** Required checks are fully deterministic; no AI service is required for merge-blocking decisions.

## MVP Baseline
- **`@octokit/app` + `@octokit/rest` + `@octokit/webhooks` (GitHub / MIT):** GitHub App authentication, webhook verification, and Checks API publishing.
- **Zod (MIT):** Runtime validation for environment variables, webhook normalization, runtime policy, and `.prpilot.yml` parsing.
- **Vitest (open source):** Unit and integration testing for deterministic logic and webhook ingress.
- **gitleaks:** Secret exposure detection with a direct PR-review use case.
- **actionlint:** GitHub Actions workflow correctness and safety when workflow files change.
- **eslint:** JS/TS linting for the MVP's primary supported repository scope.

## Deterministic Tool Packs
| Pack | Tools | Primary purpose | Default trigger / lane |
|------|-------|-----------------|------------------------|
| Pack 1 (MVP default fast lane) | internal rules, eslint, gitleaks, actionlint | Fast deterministic feedback for the first supported repo class | `pr` / fast |
| Pack 2 (deep repo checks) | osv-scanner, zizmor, typos, markdownlint-cli2 | Dependency, workflow-security, and text-quality checks with lower urgency | `manual` or `ci` / deep opt-in |
| Pack 3 (opt-in file-type checks) | ast-grep, Conftest, KubeLinter, SQLFluff, Vale, Semgrep CE, ShellCheck, yamllint | File-type-specific checks only when the target repo contains those assets and the deployment owner explicitly enables them | `manual` or `ci` / deep opt-in |
| Governance or scheduled checks | OpenSSF Scorecard, commitlint, Danger JS | Repository posture, commit policy, and PR hygiene outside the worker runtime | `ci` or `scheduled` only |
| Excluded from default runtime | TruffleHog, Syft, Grype | License-sensitive or heavyweight scans that need explicit justification first | external / manual / CI only |

All scanner outputs must be normalized into `finding` and `coverage` records before check publication. GitHub Checks is the default publisher. `reviewdog` is optional later for CI or local diff filtering, not an MVP runtime dependency.

## Licensing and Integration Boundaries
- AGPL tools are optional and require explicit compliance review before enablement in runtime paths.
- GPL-family or heavyweight tools can run as external CI executables, but their source and packaged runtime dependencies must not be embedded into PRPilot runtime libraries by default.
- Required check behavior must not depend on tools that introduce license, pricing, or runtime footprint lock-in risk.

## Pack Rollout and Budgets
| Pack | Tools | Default mode | Lane budget | Promotion criteria |
|------|-------|--------------|-------------|--------------------|
| Pack 1 (baseline fast lane) | internal rules, eslint, gitleaks, actionlint | on by default; block only for stable high-signal findings | `12s` total fast-lane target, `3s-4s` per scanner | stays within latency and monthly spend ceilings with acceptable false-positive rates |
| Pack 2 (deep repo checks) | osv-scanner, zizmor, typos, markdownlint-cli2 | off by default; manual warn-only | `20s` deep-lane target, manual only | proven value on selected repos without forcing cost growth |
| Pack 3 (opt-in file-type checks) | ast-grep, Conftest, KubeLinter, SQLFluff, Vale, Semgrep CE, ShellCheck, yamllint | off by default; manual warn-only | `30s` deep-lane target, one deep scan at a time globally | repo-specific value is documented and the deployment owner accepts the cost tradeoff |
| Governance or scheduled pack | OpenSSF Scorecard, commitlint, Danger JS | CI-only or scheduled by default | outside required-check path | stable signal without adding runtime spend |

The MVP ships with Pack 1 only. Deep packs stay opt-in until they fit the budget envelope.

---

## Data Flow
```
Step 1: Ingest webhook, verify X-Hub-Signature-256, reject invalid requests
Step 2: Normalize the webhook event and reject out-of-scope repositories through selected_repository_ids
Step 3: Check delivery ID idempotency in DynamoDB and distinguish duplicate, retryable RECEIVED, and fresh work
Step 4: Persist delivery state as RECEIVED before queue handoff
Step 5: Enqueue event to SQS, then persist delivery state as ENQUEUED
Step 6: Return 2xx inside GitHub's delivery window only after durable handoff succeeds
Step 7: Worker loads budget mode, default runtime policy, repository policy, and the current lane plan for the PR head SHA
Step 8: Worker fetches the lane input envelope, resolves applicable scanners, and emits normalized finding plus coverage records
Step 9: Publisher applies lane-specific conclusion, summary, and annotation rules
Step 10: Worker stores minimal run result and timing data in DynamoDB with TTL retention
```

## Normalized Webhook Event Contract
This is the handoff shape from `webhook-ingress` to `dedupe-guard` and, later, to the queue job builder.

| Field | Required | Meaning |
|-------|----------|---------|
| `delivery_id` | yes | `X-GitHub-Delivery` idempotency key |
| `event` | yes | GitHub event name such as `pull_request`, `check_suite`, or `check_run` |
| `action` | yes | GitHub webhook action |
| `installation_id` | yes | GitHub App installation identity |
| `repository_id` | yes | Numeric GitHub repository ID used for selected-repo scope checks |
| `repository_full_name` | yes | `owner/repo` display name for logs and summaries |
| `pr_number` | yes for PR review work | Pull request number under review |
| `head_sha` | yes for PR review work | Exact commit SHA the job is allowed to inspect |
| `base_sha` | yes for PR review work | Base commit SHA for diff resolution |
| `sender_login` | yes when present | GitHub login that triggered the event |
| `requested_action_id` | only for `check_run.requested_action` | Manual deep-lane action identity |

Invalid or unsupported payloads fail before delivery state advances past `RECEIVED`.

## Run Identity, Queue, and Persistence Contracts
### Run Identity Contract
| Artifact | Required identity fields | Notes |
|----------|--------------------------|-------|
| Logical review run | `repo_id`, `pr_number`, `head_sha`, `lane` | One logical run per lane per head SHA |
| GitHub check `external_id` | `prpilot:{repo_id}:{pr_number}:{lane}:{head_sha}` | Used to update the correct check run deterministically |
| Queue job | `job_id`, `delivery_id`, `lane`, `repo_id`, `repository_full_name`, `installation_id`, `pr_number`, `head_sha`, `base_sha`, `trigger`, `attempt` | Gives the worker all routing context without recomputing from raw webhook payload |

- **Rerun identity rule:** A rerun increments attempt metadata, but it does not create a new logical run identity for the same lane and head SHA.
- **Supersession rule:** A newer head SHA invalidates older queued or in-flight jobs for that lane before publish.

### Queue Job Contract
| Field | Meaning |
|-------|---------|
| `job_id` | Deterministic identifier for worker tracing and idempotent publish logic |
| `delivery_id` | Original GitHub delivery for audit and redelivery analysis |
| `lane` | `fast` or `deep` |
| `trigger` | `pull_request`, `check_suite.rerequested`, or `check_run.requested_action` |
| `installation_id` | GitHub App installation identity used to mint installation tokens |
| `repository_full_name` | Human-readable repo name for logs and check summaries |
| `requested_by` | GitHub login or app identity that triggered the job when available |
| `head_sha` / `base_sha` | Exact commit pair the job is allowed to inspect |
| `requested_action_id` | Present only for manual deep-scan button requests |
| `policy_version` | Optional optimization for audit; worker still reloads live policy before acting |

- **Batching rule:** Worker queue consumption stays effectively one job at a time by default, with SQS batch size `1` and reserved concurrency `1`.
- **Priority rule:** Admit a deep-lane job only when there are zero in-flight fast-lane jobs and zero visible fast-lane backlog items. Otherwise publish a `neutral` deep-lane denial and ask the user to retry later.

### DynamoDB Persistence Contract
| Item type | Key shape | Required fields | TTL posture |
|-----------|-----------|-----------------|------------|
| `DELIVERY` | `pk=DELIVERY#{delivery_id}`, `sk=EVENT` | webhook event name, action, repo, lane request, `received_at`, `enqueued_at`, retry eligibility, state transitions | short, default `7d` |
| `RUN` | `pk=REPO#{repo_id}#PR#{pr_number}`, `sk=RUN#{lane}#{head_sha}` | conclusion, summary counts, coverage summary, applied limits, latest attempt metadata | default `30d` |
| `ATTEMPT` | `pk=REPO#{repo_id}#PR#{pr_number}`, `sk=ATTEMPT#{lane}#{head_sha}#{started_at}` | attempt status, timings, errors, publish result | default `30d` |
| `COUNTER` | `pk=QUOTA#{date_bucket}`, `sk={scope}#{lane}#{kind}` | current count, hard limit, last updated time | short, default `7d` |
| `LOCK` | `pk=LOCK`, `sk=DEEP_ACTIVE` | current deep-run holder and lease expiry | very short lease TTL |

- **Single-table rule:** The MVP uses one DynamoDB table for delivery, run, attempt, counter, and lock items.
- **P3 minimum table rule:** P3 introduces the `DELIVERY` item type and conditional writes first. P7 expands the same table with `RUN`, `ATTEMPT`, `COUNTER`, and `LOCK` items.
- **Received retry rule:** A `RECEIVED` delivery with no `ENQUEUED` transition after the handoff retry window is treated as retryable, not as a completed duplicate.
- **Counter update rule:** Quota counters use atomic update operations so concurrent admissions cannot oversubscribe limits silently.
- **Lock rule:** Deep-lane global concurrency uses a short-lived conditional lock item. Expired locks may be stolen safely after lease timeout.

## Check Summary and Annotation Selection Contract
### Summary Composition Order
1. Verdict header with lane, SHA, and required vs advisory status.
2. Blocking finding counts grouped by scanner or rule.
3. Advisory finding counts grouped by scanner or rule.
4. Coverage table showing `completed`, `not_applicable`, and every degraded status.
5. Applied limits, denials, and budget-mode notes.
6. Next action hints such as `Run deep scan`, `Re-run deep scan`, or rerun denial reason.

### Annotation Selection Rules
- Inline annotations may target changed lines only.
- Findings are ranked before truncation in this order: `block` over `warn`, fast-lane over deep-lane, secret or workflow scanners over style scanners, then stable path and line ordering.
- Duplicate findings with the same `fingerprint` and line target are collapsed into one annotation entry.
- When the cap is reached, lower-priority findings move to the summary body with counts preserved.
- Deep-lane findings on unchanged files are never forced into inline annotations; they stay summary-only.

## GitHub Platform Constraints
- GitHub marks webhook deliveries as failed if your endpoint takes longer than 10 seconds to respond, and GitHub does not automatically redeliver failed deliveries.
- Failed GitHub webhook deliveries are only available for redelivery for 3 days, so deployment owners need a runbook or script to catch and replay them.
- The Checks API allows at most 50 annotations per API request, so annotation publishing must chunk updates safely even though PRPilot caps total inline annotations much lower by default.
- Fork pull requests can produce incomplete `check_suite.pull_requests` data, so PR context resolution must come from the webhook payload and explicit API lookups instead of that array alone.

## GitHub App Permission Baseline
| Capability | Level | Why it exists in MVP |
|------------|-------|----------------------|
| Repository metadata | read | Identify installations and repository context safely |
| Repository contents | read | Read changed files, workflow files, and `.prpilot.yml` |
| Pull requests | read | Fetch PR metadata, changed files, and head SHA |
| Checks | write | Create and update GitHub check runs |

The MVP webhook/event set stays limited to `pull_request`, `check_suite`, `check_run`, `installation`, and `installation_repositories`. Do not request broader repository administration, issues, or write scopes unless a later phase proves they are required.

## External Dependencies
| Dependency | Purpose | Failure behaviour |
|------------|---------|-------------------|
| GitHub API | Fetch PR files and publish checks | Retry with backoff; if required-check publication still fails, fail closed on the missing or incomplete required check and alert the deployment owner |
| AWS SQS | Async processing and buffering | Queue depth alarm and dead-letter fallback |
| AWS DynamoDB | Idempotency and review history persistence | Fail safe with explicit error and short-retention records |
| AWS Parameter Store | Secret retrieval and runtime mitigation policy | Fail fast on missing required parameter or stale policy load |

---

## Configuration
| Key | Source | Description | Required |
|-----|--------|-------------|----------|
| AWS_REGION | environment variable | AWS region for runtime clients | yes |
| GITHUB_APP_ID | environment variable | GitHub App identifier | yes |
| GITHUB_WEBHOOK_SECRET_PARAM | environment variable | Parameter Store key name for webhook secret; local development may temporarily use a placeholder name until real Parameter Store wiring is in place | yes |
| GITHUB_PRIVATE_KEY_PARAM | environment variable | Parameter Store key name for app private key | yes |
| PRPILOT_RUNTIME_POLICY_PARAM | environment variable | Parameter Store key name for runtime mitigation overrides, installation-scope limits, and budget mode | yes |
| DYNAMODB_TABLE_NAME | environment variable | DynamoDB table name for run records | yes |
| SQS_QUEUE_URL | environment variable | SQS queue URL for review jobs | yes |
| PRPILOT_POLICY_CACHE_TTL_SECONDS | environment variable | Local cache TTL for runtime-policy documents | no |
| PRPILOT_SECRET_CACHE_TTL_SECONDS | environment variable | Local cache TTL for secret fetches so rotation can happen without redeploy | no |
| PRPILOT_FAST_LANE_BUDGET_MS | environment variable | End-to-end fast-lane budget for required check processing | no |
| PRPILOT_DEEP_LANE_BUDGET_MS | environment variable | Deep-lane budget for manual non-blocking scans | no |
| PRPILOT_SCANNER_TIMEOUT_MS | environment variable | Default per-scanner timeout budget in milliseconds | no |
| PRPILOT_SCANNER_MAX_PARALLEL | environment variable | Max scanner adapters allowed to run concurrently | no |
| PRPILOT_MAX_INSTALLATIONS | environment variable | Hard cap for app installations in one self-hosted instance | no |
| PRPILOT_MAX_ACTIVE_REPOS | environment variable | Hard cap for repos with reviews enabled in one self-hosted instance | no |
| PRPILOT_MAX_RUNS_PER_DAY_GLOBAL | environment variable | Global fast-lane daily quota across one self-hosted instance | no |
| PRPILOT_MAX_RUNS_PER_REPO_PER_DAY | environment variable | Per-repo fast-lane review quota | no |
| PRPILOT_MAX_MANUAL_RERUNS_PER_PR_PER_DAY | environment variable | Per-PR manual rerequest quota | no |
| PRPILOT_RERUN_COOLDOWN_SECONDS | environment variable | Minimum spacing between manual rerequests | no |
| PRPILOT_MAX_CHANGED_FILES_PER_RUN | environment variable | Oversized-run threshold based on changed file count | no |
| PRPILOT_MAX_DIFF_BYTES_PER_RUN | environment variable | Oversized-run threshold based on diff payload size | no |
| MAX_ANNOTATIONS_PER_RUN | environment variable | Safety cap for total inline annotations after GitHub request chunking | no |
| PRPILOT_LOG_RETENTION_DAYS | environment variable | Short log retention window for a self-hosted deployment | no |
| PRPILOT_IDEMPOTENCY_TTL_DAYS | environment variable | TTL for delivery dedupe records | no |
| PRPILOT_RUN_TTL_DAYS | environment variable | TTL for persisted review records | no |
| LOG_LEVEL | environment variable | Runtime log verbosity | no |

Every required key must be validated at startup and block service execution if missing. Baseline defaults can live in environment variables, but live mitigation overrides, budget-mode changes, selected-repo scope changes, and emergency disables must come from Parameter Store so deployment owners can change behavior without a Lambda redeploy.

## Local CLI Contract
- `prpilot preflight` runs the fast lane only and never performs deep scans by default.
- The CLI resolves a merge base against a supplied base ref or the repo default branch and analyzes local changed files with the same normalization and summary builder used in the deployed fast lane.
- The CLI stays read-only: it does not install repo dependencies or execute repository-defined scripts.
- Exit codes remain `0` for pass or warn-only, and `1` for blocking findings or operational inability to perform an honest local fast-lane review.

## Low-Traffic Assumptions and Burst Protection
- The default deployment owner runs one small self-hosted instance on repos they control, not an open GitHub Marketplace listing.
- Most repositories are expected to have single-digit pull request activity per day.
- Only one worker execution should be active by default; a second concurrent worker is a deliberate emergency headroom setting, not the normal posture.
- Fast-lane jobs always take queue priority over deep-lane jobs.
- Only one deep scan may run globally at a time, and deep scans are manual or opt-in only.
- New pushes for the same pull request should supersede queued older SHAs so stale work does not consume budget.
- Manual rerequests must have cooldowns and per-PR daily caps.
- Queue depth spikes are treated as a signal to shed optional work, not to auto-scale into higher spend.

## Budget-Aware Runtime Policy
- **Normal mode:** Pack 1 runs in full for applicable changed files, annotations are capped at `20`, scanner parallelism stays at `1`, manual deep scans are allowed, and auto-deep remains opt-in only.
- **Conserve mode:** Pack 1 stays authoritative, annotation cap drops to `10`, scanner execution stays serial, deep scans are denied, and non-essential support-file fetches or presentation detail are reduced before any required-path scanner is skipped.
- **Emergency mode:** Keep signature verification, dedupe, queue durability, and only the minimum honest required surface. Reject deep scans and excess reruns, and convert any PR that cannot receive complete Pack 1 coverage into `action_required`.

Budget mode is allowed to reduce coverage, but it is not allowed to hide that reduction. Every degraded run must say which limits were applied.

## What Happens When Usage Approaches Limits
1. At roughly `80%` of quota-based soft limits such as daily runs, reruns, deep scans, or annotation volume, the app enters conserve mode automatically.
2. Deep scans, governance checks, and all disabled-by-default features stay off.
3. Manual rerequests are throttled harder, superseded jobs are dropped, and only the newest PR SHA per lane is processed.
4. Annotation caps drop and excess findings move into the summary body before any required-path scanner coverage is removed.
5. Install scope stops expanding and new repos are not enabled.
6. If a repo exceeds its hard quota, PRPilot rejects the new run with an explicit over-quota operational result rather than pretending the required review happened.
7. If AWS Budgets alarms or the deployment owner indicate that the whole instance is nearing the hard monthly dollar ceiling, the runtime policy should be moved to emergency mode externally.
8. Deep-lane auto-triggers are disabled before manual deep requests are denied, and manual deep requests are denied before required fast-lane coverage is reduced.

Important limitation: Lambda cannot introspect the live AWS bill. Automatic conserve mode is driven by PRPilot-owned quota counters, while dollar-based budget enforcement requires AWS Budgets alarms, account-level billing integration, or manual deployment-owner intervention. Any budget or headroom view must be presented as an estimate unless those billing integrations are added.

---

## Output / Artifacts
| Output | Format | Destination |
|--------|--------|-------------|
| Fast or deep check run result | GitHub Checks API payload | GitHub PR commit status |
| Findings and coverage summary | Structured JSON object with capped detail and scanner coverage statuses | DynamoDB with TTL |
| Logs | Structured JSON for state transitions, errors, and budget-mode changes only | CloudWatch Logs with short retention |
| Metrics | Low-cardinality counts and latency values | CloudWatch Metrics / alarms |

---

## Free-Tier-Safe Observability
- Prefer structured logs plus a very small set of alarms over rich dashboards, tracing, or high-cardinality telemetry.
- Retain CloudWatch logs for a short window only, with `7 days` as the baseline target.
- Emit metrics for webhook latency, worker latency, lane admissions, lane denials, DLQ depth, throttling, rerun denials, and budget-mode transitions only.
- Avoid always-on dashboards or third-party observability services in the default deployment.
- Treat ad hoc CLI queries and CloudWatch alarm history as the primary debugging path before adding more paid observability surface.

## Minimal Retention Policy
- Delivery idempotency records should expire quickly once replay risk passes, with a default target of `7 days`.
- Run summaries and capped findings should expire automatically, with a default target of `30 days`.
- Raw PR file contents, patches, or large scanner artifacts should not be retained in deployment storage by default.
- Long-term audit retention is deferred until the project justifies spending beyond the low-cost envelope.

## Monitoring and Alerting Strategy
- **Worker error-rate alarm:** Detects analysis failures before they become silent false-pass behavior.
- **SQS DLQ depth alarm:** Detects poisoned messages or repeated processing failures.
- **Lambda throttling alarm (webhook + worker):** Detects capacity ceilings before latency breaches.
- **Budget-mode transition alarm:** Detects when the app had to enter conserve or emergency mode.
- **GitHub API failure or rate-limit alarm:** Detects upstream dependency pressure that impacts check publishing.
- **GitHub failed-delivery runbook trigger:** Detects inbound webhook failures quickly enough to use the 3-day redelivery window.

## Promotion and Rollout Contract
- Every new scanner or rule enters live use in `warn` or `report_only` mode first.
- Promotion from advisory to blocking requires all of the following on selected repositories: at least `10` representative live runs or `7 days` of warn-first observation, stable runtime inside lane budget, no unresolved high-noise incidents, explicit owner approval, and recorded promotion evidence.
- Promotion never moves a scanner into the fast lane unless the scanner has already proven it can cover the required scope inside the fast-lane budget envelope.
- Rollback triggers include latency-budget breach, sustained scanner failure, or a confirmed false-positive incident on the required path.
- Rollback means changing runtime policy first, not redeploying code first. Emergency disable controls are expected to work even when the new code is already live.

## CI Guard Contract
- **Latency regression guard:** Compares the current measured fast-lane p95 to the stored baseline and blocks deploy when p95 exceeds the smaller of `baseline * 1.2` or `baseline + 2000ms`, or exceeds the configured fast-lane budget ceiling.
- **Scanner baseline drift guard:** Compares the committed scanner-registry snapshot against the enforced baseline so required-path scanner additions, removals, default lane changes, default mode changes, or blockability changes cannot slip in silently.
- **Deterministic required-path guard:** Fails CI if required-lane code paths reference AI-only services, non-approved scanners, or configuration that would make merge-blocking decisions depend on non-deterministic systems.

## Error Handling Strategy
- **Fail fast:** Missing config, invalid webhook signature, invalid payload schema, or out-of-scope installation.
- **Skip and log:** Duplicate deliveries, superseded queued runs, and disabled feature paths.
- **Retry:** GitHub API and transient AWS client failures with bounded retry attempts.
- **Dead-letter:** Jobs that exceed retry budget are routed to DLQ with alerting.
- **Throttle or deny:** Manual fast reruns are denied without changing an already-valid fast result, manual or auto deep scans receive an explicit non-blocking response, and over-quota or oversized required-path runs receive an explicit blocking operational result instead of hidden failure.
- **Fail closed on publish failure:** If GitHub check publication is still unavailable after bounded retries, merge protection must be preserved by the missing or incomplete required check and a deployment-owner alert.
- **Degrade:** When cost or latency budgets are threatened, reduce annotations, presentation detail, and optional deep-lane work before any required Pack 1 scanner coverage is reduced.
- **Redeliver externally:** Failed GitHub webhook deliveries are replayed with a runbook or automation because GitHub does not auto-redeliver them.
- **Exit codes:** Optional CLI uses `0` success and `1` critical findings or runtime failure.

## Disaster Recovery and Security Operations
- **Low-cost recovery first:** Default to TTL-backed tables, fixture-based restore drills, and targeted export or backup steps before enabling more expensive always-on recovery features.
- **PITR policy:** DynamoDB PITR is deferred by default for the self-hosted deployment and is enabled only if it still fits the monthly cost ceiling and meaningfully improves recovery.
- **Recovery targets:** Same-day restore of core webhook handling is the target; losing some historical run detail is acceptable if it protects the budget envelope.
- **Secret rotation:** GitHub App private key and webhook secret must support scheduled and incident-driven rotation.
- **Compromise response:** Rotation and validation steps must be documented in runbook form with clear ownership.

## Graceful Degradation
- Rule execution supports runtime disable controls through a Parameter Store policy document with local TTL caching so a problematic rule can be mitigated quickly without a full redeploy.
- Disabled rules, reduced scanner sets, annotation caps, and rerun denials must be visible in logs and check output so maintainers can distinguish mitigation from normal passes.
- The system must prefer honest reduced coverage over pretending a full review happened when budget or traffic limits forced a smaller execution path.
- Reduced coverage is acceptable in the fast lane only for presentation detail such as annotation count or summary depth. Reduced baseline scanner coverage is not acceptable; it must become an explicit operational block, not a pass.
- Reduced deep-lane coverage is acceptable only when the skipped scanners, skipped scope, and trigger reason are published in the deep-lane summary.

---

## Testing Strategy
| Layer | Tool | What it covers |
|-------|------|----------------|
| Unit | Vitest | Signature verification, idempotency keying, lane admission logic, finding and coverage normalization, quota decisions, policy precedence, and oversized-run decisions |
| Integration | Vitest + webhook fixtures | End-to-end webhook ingress to fast or deep lane selection, check payload generation, annotation caps, rerun throttling, unsupported-repo handling, supersession, and fork PR context |
| System | Demo repository validation | Required check blocks merge on critical fast-lane findings, deep scans stay manual or opt-in, GitHub UI shows distinct lane results, and quota or degraded behavior remains explicit and honest |

---

## Implementation Defaults
- **Package layout:** Use npm workspaces for the monorepo so apps and packages can share dependency management without extra paid tooling.
- **Lambda bundling:** Use CDK `NodejsFunction` for TypeScript Lambdas.
- **Ingress framework:** Use a plain Lambda handler for webhook ingress so raw-body verification stays explicit.
- **Deployment shape:** The MVP uses exactly one live self-hosted environment.
- **Deferred from MVP:** Dashboard UI, advanced analytics, always-on deep scans, cross-repo governance automation, long retention, rich dashboards, tracing, and any paid AI surface.

---

## File Structure
```
root/
├── apps/
│   ├── webhook/        # Lambda webhook ingress
│   ├── worker/         # SQS consumer and check publisher
│   └── cli/            # optional preflight CLI
├── packages/
│   ├── rules/          # deterministic rule engine
│   ├── scanners/       # scanner adapters and pack registry
│   ├── checks/         # check-run conclusion and annotation publishing
│   ├── review-store/   # DynamoDB persistence and idempotency helpers
│   ├── policy/         # runtime policy and repository policy precedence
│   ├── github/         # octokit client helpers
│   ├── config/         # env validation and parameter loading
│   └── observability/  # logging and low-cost metrics wrappers
├── infra/              # AWS CDK stacks
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── codex-folder/codex/
└── codex-folder/.codex/commands/
```

`apps/cli/` is planned for P11 and is not required to exist in the P1 folder proof.
