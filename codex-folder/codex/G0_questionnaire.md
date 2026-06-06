# G0 — Project Setup Questionnaire (PRPilot: Self-Hosted GitHub App First)

> Loaded on demand by `codex-folder/AGENTS.md` when G0 is incomplete.
> 6 sub-gates, each must pass in order.
> This version is optimized for: self-hosted free-tier constraints, AWS alignment, GitHub App security, and beginner-friendly execution.

---

## G0.1 — Identity
Ask. Wait. Do NOT proceed until all answered.
```
1. Project name?
2. One-line description: what does it do and for whom?
3. What problem does it solve in pull-request review workflows?
4. Project type? (portfolio / production / learning / side project)
5. MVP success metric? (example: posts a check in <=60s and blocks merge on critical findings)
```
**Pass:** All 5 answered. Confirm: "Here is your identity summary: [summary]. Correct?" User confirms -> G0.2.

---

## G0.2 — Developer Profile
Ask. Wait. Do NOT proceed until all answered.
```
1. Your name?
2. Experience level? (beginner / intermediate / advanced)
3. Languages/frameworks you are comfortable with right now?
4. What are you not comfortable with yet?
5. What should you be able to build independently by project end?
6. Weekly time budget you can realistically sustain?
```
**Pass:** All 6 answered. Confirm summary. User confirms -> G0.3.

---

## G0.3 — Product Direction + Category Detection
Ask. Wait. Do NOT proceed until all answered.
```
1. Primary product surface for MVP? (GitHub App only / GitHub App + CLI / GitHub App + CLI + dashboard)
2. Which outputs must appear in GitHub? (check run, line annotations, PR comment, status check)
3. Should AI be optional plugin only for MVP? (yes/no)
4. Must project be self-hosted and free-tier-aware by default? (yes/no)
5. Which cloud provider is the target for architecture signal? (AWS required for this track)
6. What functionality is explicitly deferred until post-MVP?
```

Classify into exactly one category for template generation:

| Category | Classify as this if... |
|----------|------------------------|
| **web** | Browser dashboard is a required MVP surface, not optional. |
| **systems** | GitHub App/API/worker/CLI is the MVP and dashboard is optional or deferred. |
| **creative** | Game/mobile/desktop-first products (not expected for PRPilot). |

State: "Based on your answers, this is a **[category]** project. I will use the [category] template. Correct?"

**Pass:** All 6 answered. Category confirmed. No contradictions. -> G0.4.

---

## G0.4 — Architecture, Features, and Scope Control
Ask the question set for the locked category. Wait until all answered.

**systems (default expected for this project):**
```
1. Core MVP features (max 8 bullets, one line each)
2. Entry points (webhook route, worker trigger, optional CLI command)
3. Core modules and responsibilities
4. Event/data flow from webhook receipt to GitHub check output
5. Primary repository ecosystem for MVP (for example: JS/TS + npm + GitHub Actions only, or broader)
6. External dependencies and what each one is needed for
7. Free-tier guardrails (what gets disabled first if costs rise)
8. Explicit non-goals for MVP (what will not be built now)
```
Pass: Every feature -> module. Every module -> clear input/output. Every external dependency -> explicit value.

**web (only if dashboard is required in MVP):**
```
1. Core features (max 8 bullets, one line each)
2. Dashboard pages with route + auth level
3. API routes with method, path, auth, purpose
4. Core constraint that must never regress
5. GitHub App integration points and data source for each page
6. Free-tier guardrails and non-goals
```
Pass: Every feature -> route/page. Every route -> model/service. Dashboard value must justify added complexity.

**creative:**
```
1. Core features/interactions
2. Screens/scenes
3. Core systems
4. State persistence
5. External services and fallback behavior
```
Pass: Every feature -> screen/system. Persistence defined.

Confirm summary. User confirms -> G0.5.

---

## G0.5 — Security, DevOps, and Hiring-Signal Constraints
Ask. Wait. Do NOT proceed until all answered.

**All categories:**
```
1. What must NEVER happen? (project red lines)
2. Security baseline requirements?
3. Reliability requirements? (idempotency, retries, dead-letter handling)
4. DevOps baseline requirements? (CI checks, deployment, observability)
5. Cost guardrails? (budget alarms, concurrency limits, service limits)
6. Deprecated or unnecessary tools that must be avoided?
```

**For GitHub App / systems path, additionally require answers to these exact items:**
```
7. Webhook signature verification approach (X-Hub-Signature-256)?
8. Delivery deduplication strategy (X-GitHub-Delivery idempotency key)?
9. App permission matrix (minimum required scopes only)?
10. Secret management approach (no hardcoded keys, no repo secrets for cloud creds)?
11. CI auth to cloud (OIDC-only or not)?
12. Merge protection policy (required checks and fail conditions)?
13. How will you recover failed GitHub webhook deliveries if GitHub does not auto-redeliver them?
14. Where will runtime mitigation config live if deployment owners must change behavior without a Lambda redeploy?
15. What is your fork pull-request policy for installed base repositories in a self-hosted deployment?
16. What is the precedence between environment defaults, deployment-owner runtime policy, and repository config?
```

**Pass:** All answered. No contradictions with G0.4. Confirm summary. User confirms -> G0.6.

---

## G0.6 — Critique, Cross-Check, Finalize

Complete ALL steps in order.

**Step 1 — Critique (must be strict).** Find and present every issue:
- Scope risk: MVP too wide for timeline or skill level
- Stack bloat: tools/services with weak value relative to complexity
- Cost risk: anything likely to exceed free-tier first
- Security risk: signature checks, permissions, secret handling, token usage, replay handling
- Reliability risk: duplicate events, retry storms, no dead-letter strategy
- Hiring-signal risk: choices that do not showcase JS/TS + AWS + DevOps depth
- Obsolescence/misalignment risk: outdated or market-misaligned choices for target roles

**Step 2 — Resolve.** Discuss until EVERY concern is resolved with an explicit decision.

**Step 3 — Cross-check.**
- Feature -> module -> proof command linkage is complete
- Every external dependency has a reason and free-tier fallback
- Security controls map to concrete checks and tests
- Required-check downgrade, over-quota, and degraded-run behavior is explicit and honest
- Runtime policy precedence versus repository config is explicit
- Folder and package structure aligns with planned modules
- Build phases are sequenced for beginner execution (no advanced step before prerequisites)
- Cloud resources are codified before late-stage live reliability tuning and deployment
- Optional features (dashboard/AI extras) are clearly marked post-MVP
- GitHub operational constraints are captured explicitly (10s webhook response window, 3-day redelivery window, 50-annotations-per-request limit, fork PR context)

**Step 4 — Final summary.** Present:
- Name + tagline + category
- MVP scope and non-goals
- Final stack with AWS services
- Security baseline
- DevOps baseline
- Phase map and first gate
- Mentor output contract: explain the current step first, wait for explicit approval that the user understands and wants Codex to do that step, then apply only the approved current-step change, run proof, and report back
Ask: "Confirm to generate all files and lock this mentor output contract?"

**Step 5 — User confirms.** Explicit confirmation only.

**Step 6 — Write `codex-folder/codex/_fill_manifest.md` first.**
Fill every section from G0.1-G0.5 with actual values only. No placeholders.
Must include:
- IDENTITY, DEVELOPER, TECH STACK, COMMIT CONFIG
- ARCHITECTURE DECISIONS, DATA/STRUCTURE, CORE LOGIC
- FEATURES, ROUTES/ENTRY POINTS, RED LINES, ENV VARS
- PHASES with name, goal, checkboxes, proof command(s), commit message
Do not touch other files until manifest is complete.

**Step 7 — User reviews manifest.**
Prompt: "Review the fill manifest. Correct anything before file generation."
Wait for confirmation.

**Step 8 — Generate files from manifest in strict order.**
1. ProjectSummary.md (select by category, then delete unused templates)
2. Codex_guide.md (developer profile, scopes, TDD targets, red lines)
3. BuildFlow.md (phase goals, checkboxes, proof, commit)
4. Progress.md (phase names/checkpoints + category)

At each file: re-read manifest before writing. Do not rely on memory.

**Step 9 — Verify.**
- Read each generated file
- Search for AGENTS.md placeholder patterns; zero allowed
- Confirm unused templates deleted
- Confirm each phase includes a concrete proof command and observable output

**Step 10 — Store Codex_guide summary and mentor output contract in memory.**

**G0 pass condition:** Manifest complete, generated files complete, zero placeholders in `codex-folder/codex/`, unused templates deleted, and user confirmation recorded.
