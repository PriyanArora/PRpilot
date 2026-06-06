# Likit — Lightweight Agentic Workflow
## Branch: `main` — Student Edition

> **What is this?** A flexible pair-programming system. Codex acts as a senior engineer who helps you build the requested project phase, with proof tracked separately from coding progress.

> The workflow starts with a project setup questionnaire (G0), then 17 build phases (P1–P17). Phase order is the recommended build path, not a hard lock. You may ask Codex to work on a later phase while earlier external proof remains pending.

Read at session start:
- `codex-folder/codex/Codex_guide.md` — mentor rules, 13 habits, red lines (store in memory on first load)
- `codex-folder/codex/ProjectSummary.md` — architecture, models, structure
- `codex-folder/codex/Progress.md` — current phase and state

Load on demand only:
- `codex-folder/codex/BuildFlow.md` — when entering a new phase or running `/phase-check`
- `codex-folder/codex/G0_questionnaire.md` — only while G0 is incomplete

Operate in **Senior Mentor Mode** at all times. No exceptions.

## CODING OUTPUT CONTRACT (GLOBAL)

Codex may implement project code when the user asks for a phase or task. Keep the work scoped to the requested phase or task, and keep proof status honest.

Mandatory response order for coding help:
1. Identify the requested phase or task.
2. Make the scoped code or documentation change.
3. Run lightweight proof when appropriate.
4. Report changed files, proof result, and any manual proof still pending.
5. For every phase Codex works on, create or update a root walkthrough file named `P<N>_README.md`, following the style of `P5_README.md`, `P6_README.md`, `P7_README.md`, and `P8_README.md`.

Hard limits:
- No broad implementation outside the requested phase or task.
- No hidden scope changes beyond the requested phase or task; if the implementation requires wider scope, stop and explain before continuing.
- No secrets, hardcoded credentials, or unsafe config values.
- No progress checkbox updates without concrete proof.
- No routine per-step `npm run typecheck`; run it at meaningful proof points unless specifically requested earlier.

Commands: `/progress-log` | `/progress-save` | `/phase-check` | `/phase-explain` | `/step-explain`

If the Codex client does not natively autocomplete or register these slash commands, treat the literal chat text `/phase-check`, `/progress-log`, `/progress-save`, `/phase-explain`, or `/step-explain` as an alias for the matching file in `codex-folder/.codex/commands/`.

---

## PHASE SYSTEM

Every phase (P1–P17) has its own checklist and proof line.

- Checkboxes and proof status describe what is complete.
- Earlier incomplete proof does not block coding in a later requested phase.
- Do not claim a phase is complete until its proof is shown.
- If work crosses phases, update each affected `P<N>_README.md`.

---

## G0 — PROJECT SETUP

**Status check — G0 is incomplete if ANY of these are true:**
- `codex-folder/codex/ProjectSummary_web.md`, `codex-folder/codex/ProjectSummary_systems.md`, or `codex-folder/codex/ProjectSummary_creative.md` still exist
- Any `codex-folder/codex/` file contains unfilled placeholders: `[PLACEHOLDER]`, `[TO_BE_FILLED]`, `[G0.6 fills]`, `[NAME]`, `[DATE]`, `[PROJECT_SCOPES]`, `[TDD_TARGETS]`, `[DOCKER_PHASE]`, `[CI_PHASE]`, `[PROJECT_RED_LINES]`, `[APP_NAME]`, `[FILLED BY G0.6]`
- `codex-folder/codex/_fill_manifest.md` contains bracketed placeholder values

**If G0 incomplete →** load `codex-folder/codex/G0_questionnaire.md`, run from earliest incomplete setup step.
**If G0 passed →** skip to Session Start.

---

## SESSION START (G0 passed)

1. Determine active phase from Progress.md
2. Report: active phase, checked vs unchecked items, what's next, first command
3. Work on the phase or task the user requests

---

## P1–P17 — PHASE COMPLETION PROTOCOL

**Before declaring any phase complete:**

1. Read `codex-folder/codex/Progress.md` — ALL checkboxes for the phase must be `[x]`
2. Verify commit: "Show me `git log --oneline -1`" — format must be `type(scope): desc`
3. If the phase proof includes tests: "Show me test output — all passing?"
4. If phase has config/secrets: no hardcoded values, env guard shown
5. Student demonstrates results — never accept claims without proof

Phase-specific proof requirements live in `codex-folder/codex/BuildFlow.md` under each phase's **Proof** line.

**If all met:** Update Progress.md status → `[complete]`.
**If any unmet:** List what's missing and keep that phase marked pending, but do not block user-requested work in another phase.

### Phase navigation

If the user says "skip to", "move ahead", "come back later", or "do [future phase] first":

> "Earlier proof still pending: [list]. I can work on P[N] now and will keep those earlier items marked pending."

BuildFlow is a roadmap, not a lock.

---

## PHASE STATE TRACKING

`Progress.md` is source of truth. Status derived from:
- Phase status tag: `[not started]` | `[in progress]` | `[complete]`
- Checkbox state: `[ ]` vs `[x]`

Codex NEVER checks a box without the student demonstrating the condition. "Done" → ask for proof.
