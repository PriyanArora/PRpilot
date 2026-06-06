# P11 Optional Local Preflight CLI Walkthrough

## Manual Actions Still Needed

The P11 CLI is locally proven against temporary git repositories. Manual follow-up remains:

- Run `npm run preflight -- --base <branch>` inside a real target repository.
- Compare one local preflight failure with the deployed `PRPilot Fast` result for the same logical change.
- Confirm the baseline ESLint limitation text is acceptable in demo output.

## P11.1 Define the CLI entry point

The CLI entry point is `apps/cli/preflight.mjs`, exposed through:

```bash
npm run preflight -- --base main
```

## P11.2-P11.3 Resolve base ref and merge base

The CLI accepts `--base <ref>`. If omitted, it tries `origin/main`, `main`, `master`, then `HEAD~1`.

File: `apps/cli/preflight.mjs`

## P11.4 Collect local changed files

The CLI reads `git diff --numstat` and `git diff --name-status` from the merge base to `HEAD`.

File: `apps/cli/preflight.mjs`

## P11.5 Load local repo config

The CLI reads `.prpilot.yml` when present and applies the same include-first, ignore-wins path behavior introduced in P9.

File: `apps/cli/preflight.mjs`

## P11.6 Run deterministic fast-lane rules

The local CLI mirrors the internal fast-lane rules for large changes, sensitive file changes, and lockfile drift.

File: `apps/cli/preflight.mjs`

## P11.7-P11.8 Reuse deployed output shape and summary order

Output is JSON with `conclusion`, finding records using deployed field names, coverage records, and summary counts.

File: `apps/cli/preflight.mjs`

## P11.8a Disclose ESLint baseline limits

The CLI output includes a note that deployed PRPilot uses a PRPilot-owned baseline ESLint config that may differ from the repository's own setup.

## P11.9-P11.11 Exit code semantics

The CLI exits:

- `1` for critical findings.
- `1` when it cannot perform an honest local review.
- `0` for success or warnings only.

## P11.12 Local Proof

Run:

```bash
npm test -- tests/integration/preflight-cli.test.ts
```

Expected local proof:

- Failing lockfile drift exits `1`.
- Safe documentation change exits `0`.
- Local `.prpilot.yml` path filters can remove a file from review.
